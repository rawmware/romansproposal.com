// Runs after Stripe confirms payment: places + pays the order at CJ, which
// ships it straight to the customer. If CJ can't take the order at all, the
// customer is refunded automatically so nobody is left waiting.
import { createOrder, calculateFreight, getOrder, CJError } from "./cj.js";
import { stripe } from "./stripe.js";
import { alertOwner } from "./alert.js";
import { stateName } from "./us-states.js";
import { decodeItems, pickShipping } from "./orders.js";
import { STORE } from "./config.js";

const cut = (s, n) => String(s || "").slice(0, n);
const UNPAID = new Set(["CREATED", "IN_CART", "UNPAID"]);

async function tagPayment(paymentIntent, metadata) {
  if (!paymentIntent) return;
  try {
    await stripe(`/payment_intents/${paymentIntent}`, { method: "POST", params: { metadata } });
  } catch (err) {
    console.error("Could not tag payment", paymentIntent, err.message);
  }
}

async function shippingFor(session) {
  const pick = (s) => s?.collected_information?.shipping_details || s?.shipping_details;
  let details = pick(session);
  if (!details?.address) {
    const fresh = await stripe(`/checkout/sessions/${session.id}`);
    details = pick(fresh);
  }
  if (!details?.address) throw new Error("Checkout session has no shipping address");
  return details;
}

export function buildCjOrder(session, shipping, logisticName) {
  const a = shipping.address;
  const phone = String(session.customer_details?.phone || "")
    .replace(/^\+1/, "")
    .replace(/[^\d]/g, "");
  return {
    orderNumber: session.metadata.order,
    shippingCountryCode: "US",
    shippingCountry: "United States",
    shippingProvince: cut(stateName(a.state), 50),
    shippingCity: cut(a.city, 50),
    shippingZip: cut(a.postal_code, 20),
    shippingAddress: cut(a.line1, 500),
    shippingAddress2: cut(a.line2, 500),
    shippingCustomerName: cut(shipping.name || session.customer_details?.name, 50),
    shippingPhone: cut(phone, 20),
    email: cut(session.customer_details?.email, 50),
    remark: "",
    payType: 2, // pay from CJ wallet balance immediately
    logisticName,
    fromCountryCode: STORE.shipFrom,
    products: decodeItems(session.metadata.items)
  };
}

async function refund(session, reason) {
  await stripe("/refunds", {
    method: "POST",
    idempotencyKey: `refund-${session.metadata.order}`,
    params: {
      payment_intent: session.payment_intent,
      reason: "requested_by_customer",
      metadata: { order: session.metadata.order, why: cut(reason, 450) }
    }
  });
}

export async function fulfill(session) {
  const orderNo = session.metadata?.order;
  if (!orderNo || !session.metadata?.items) return { status: "ignored" };

  const existing = await getOrder(orderNo);
  if (existing) return { status: "already-placed", cjOrderId: existing.orderId };

  const shipping = await shippingFor(session);
  const order = buildCjOrder(session, shipping, session.metadata.logistic);
  if (order.products.length === 0) throw new Error(`Order ${orderNo} has no items`);

  let data;
  try {
    try {
      data = await createOrder(order);
    } catch (err) {
      // Shipping method no longer offered: re-quote once and retry.
      if (err instanceof CJError && (err.code === 1605000 || err.code === 1605001)) {
        const quote = pickShipping(
          await calculateFreight({ from: STORE.shipFrom, to: "US", products: order.products })
        );
        if (!quote) throw err;
        order.logisticName = quote.name;
        data = await createOrder(order);
      } else {
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof CJError && err.code === 1603003) return { status: "already-placed" };
    if (err instanceof CJError && err.transient) throw err; // let Stripe retry later
    if (!(err instanceof CJError)) throw err;

    const created = await getOrder(orderNo);
    if (created) {
      await alertOwner(
        `⚠️ Order ${orderNo} is at CJ but NOT paid (${err.message}). Add money to your CJ wallet, then pay it in My CJ → Orders. The customer already paid you.`
      );
      await tagPayment(session.payment_intent, { cj_order_id: created.orderId || "", cj_status: "UNPAID" });
      return { status: "needs-payment", cjOrderId: created.orderId };
    }
    await refund(session, err.message);
    await alertOwner(`↩️ Order ${orderNo} couldn't be placed with CJ (${err.message}). The customer was refunded automatically.`);
    await tagPayment(session.payment_intent, { cj_status: "REFUNDED", cj_error: cut(err.message, 450) });
    return { status: "refunded" };
  }

  const status = data?.orderStatus || "SUBMITTED";
  await tagPayment(session.payment_intent, { cj_order_id: data?.orderId || "", cj_status: status });
  if (UNPAID.has(status)) {
    await alertOwner(
      `⚠️ Order ${orderNo} was placed at CJ but is still ${status}. Check your CJ wallet balance and pay it in My CJ → Orders.`
    );
    return { status: "needs-payment", cjOrderId: data?.orderId };
  }
  return { status: "placed", cjOrderId: data?.orderId };
}
