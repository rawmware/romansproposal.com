// GET /api/checkout?id=...: sends the shopper to a Stripe checkout for one product.
// Price comes from the server-side catalog, never from the browser.
const { findProduct } = require("./_catalog");

function redirect(res, location, status = 303) {
  res.writeHead(status, { Location: location });
  res.end();
}

module.exports = async (req, res) => {
  const product = await findProduct(String(req.query.id || ""));
  if (!product) return redirect(res, "/?checkout=unavailable");
  if (product.paymentLink) return redirect(res, product.paymentLink);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return redirect(res, "/?checkout=unavailable");

  const origin = `https://${req.headers.host}`;
  const fulfil = `BUY FROM: ${product.supplierUrl} (cost ~$${product.supplierCost.toFixed(2)})`;
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(product.price * 100)),
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][product_data][images][0]": product.image,
    "shipping_address_collection[allowed_countries][0]": "US",
    "phone_number_collection[enabled]": "true",
    "payment_intent_data[description]": fulfil.slice(0, 1000),
    "payment_intent_data[metadata][supplier_url]": product.supplierUrl,
    "payment_intent_data[metadata][supplier_cost]": product.supplierCost.toFixed(2),
    "payment_intent_data[metadata][product_id]": product.id,
    success_url: `${origin}/?order=success`,
    cancel_url: `${origin}/`,
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await r.json();
  if (!r.ok) {
    console.error("Stripe checkout failed:", session.error && session.error.message);
    return redirect(res, "/?checkout=error");
  }
  return redirect(res, session.url);
};
