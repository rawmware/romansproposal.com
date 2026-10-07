// POST /api/checkout { items: [{ id, vid, qty }] } -> { url } (Stripe Checkout)
// Prices are recomputed here from live supplier data; the browser's numbers
// are never trusted. Orders that wouldn't make a profit are refused.
import { loadProduct } from "./_lib/catalog.js";
import { calculateFreight } from "./_lib/cj.js";
import { stripe } from "./_lib/stripe.js";
import { STORE, isConfigured } from "./_lib/config.js";
import { unitPriceCents, stripeFeeCents, bundleApplies } from "./_lib/pricing.js";
import { newOrderNumber, encodeItems, pickShipping } from "./_lib/orders.js";
import { json, siteOrigin } from "./_lib/http.js";

const MAX_LINES = 10;
const MAX_QTY = 5;

class SoldOut extends Error {}

function normalize(items) {
  const byVid = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    const id = String(raw?.id || "");
    const vid = String(raw?.vid || "");
    const qty = Math.floor(Number(raw?.qty));
    if (!/^[A-Za-z0-9-]{6,64}$/.test(id) || !/^[A-Za-z0-9-]{6,64}$/.test(vid)) continue;
    if (!(qty >= 1)) continue;
    const prev = byVid.get(vid);
    byVid.set(vid, { id, vid, qty: Math.min(MAX_QTY, (prev?.qty || 0) + qty) });
  }
  return [...byVid.values()].slice(0, MAX_LINES);
}

export async function POST(request) {
  const cfg = isConfigured();
  if (!cfg.cj || !cfg.stripe) {
    return json({ error: "Checkout opens soon. Check back shortly!" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, { status: 400 });
  }
  const items = normalize(body?.items);
  if (items.length === 0) return json({ error: "Your bag is empty." }, { status: 400 });

  try {
    const products = new Map();
    for (const id of new Set(items.map((i) => i.id))) products.set(id, await loadProduct(id));

    const totalQty = items.reduce((n, i) => n + i.qty, 0);
    const lines = items.map((item) => {
      const product = products.get(item.id);
      const variant = product?.variants.find((v) => v.vid === item.vid);
      if (!product || !variant) throw new SoldOut("One of your items just sold out. Please remove it and try again.");
      if (variant.stock != null && variant.stock < item.qty) {
        throw new SoldOut(`Only ${variant.stock} left of "${product.title}".`);
      }
      return {
        ...item,
        title: product.title,
        variant: variant.name,
        image: variant.image || product.images[0],
        costUsd: variant.costUsd,
        unitCents: unitPriceCents(variant.costUsd, totalQty)
      };
    });

    const shipping = pickShipping(
      await calculateFreight({
        from: STORE.shipFrom,
        to: "US",
        products: lines.map((l) => ({ vid: l.vid, quantity: l.qty }))
      })
    );
    if (!shipping) throw new SoldOut("Sorry, this item can't ship right now. Please pick another deal.");

    const revenue = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
    const supplierCents =
      Math.round(lines.reduce((sum, l) => sum + l.costUsd * l.qty, 0) * 100) + Math.round(shipping.price * 100);
    const profit = revenue - stripeFeeCents(revenue) - supplierCents;
    if (profit < STORE.minProfitUsd * 100) {
      console.warn("Refused unprofitable cart", { revenue, supplierCents, profit, items });
      throw new SoldOut("The supplier price on this item just changed, so it's unavailable right now. Please pick another deal.");
    }

    const order = newOrderNumber();
    const origin = siteOrigin(request);
    const params = {
      mode: "payment",
      line_items: lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: "usd",
          unit_amount: l.unitCents,
          product_data: {
            name: `${l.title}${l.variant && l.variant !== "Standard" ? ` (${l.variant})` : ""}`.slice(0, 250),
            images: l.image ? [l.image] : undefined,
            description: bundleApplies(totalQty)
              ? `Bundle price: ${Math.round(STORE.bundleDiscount * 100)}% off`
              : undefined,
            metadata: { pid: l.id, vid: l.vid }
          }
        }
      })),
      shipping_address_collection: { allowed_countries: STORE.shipTo },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Free shipping from our US warehouse",
            delivery_estimate: {
              minimum: { unit: "business_day", value: STORE.deliveryEstimate.min },
              maximum: { unit: "business_day", value: STORE.deliveryEstimate.max }
            }
          }
        }
      ],
      metadata: {
        order,
        items: encodeItems(lines),
        logistic: shipping.name,
        supplier_cost_cents: supplierCents
      },
      payment_intent_data: { description: `Order ${order}`, metadata: { order } },
      custom_text: {
        submit: { message: `Your order number is ${order}. Track it anytime at ${origin}/track.html` }
      },
      success_url: `${origin}/thanks.html?order=${order}&v=${(revenue / 100).toFixed(2)}`,
      cancel_url: `${origin}/?bag=1`
    };
    if (process.env.STRIPE_AUTOMATIC_TAX === "true") params.automatic_tax = { enabled: true };

    const session = await stripe("/checkout/sessions", { method: "POST", params, idempotencyKey: order });
    return json({ url: session.url, order });
  } catch (err) {
    if (err instanceof SoldOut) return json({ error: err.message }, { status: 409 });
    console.error("Checkout failed:", err);
    return json({ error: "Checkout hiccup. Please try again in a moment." }, { status: 502 });
  }
}
