// End-to-end tests with CJ and Stripe mocked: catalog, checkout, webhook
// fulfilment (success, refund, unpaid), and order tracking.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.CJ_API_KEY = "CJ123@api@test";
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.CJ_MIN_GAP_MS = "0";
process.env.CJ_RETRY_MS = "1";
process.env.SITE_URL = "https://www.romansproposal.com";

const { listPriceCents, unitPriceCents, stripeFeeCents } = await import("../api/_lib/pricing.js");
const { encodeForm, verifyStripeSignature } = await import("../api/_lib/stripe.js");
const { _reset } = await import("../api/_lib/cj.js");
const { itemCode, cleanTitle, htmlToText } = await import("../api/_lib/catalog.js");
const products = await import("../api/products.js");
const product = await import("../api/product.js");
const checkout = await import("../api/checkout.js");
const webhook = await import("../api/stripe-webhook.js");
const order = await import("../api/order.js");

// ---- fake CJ + Stripe ------------------------------------------------------
const PID = "1796078021431009280";
const VID = "1796078021431009281";
const VID2 = "1796078021431009282";

let calls;
let cj; // per-test overrides
function cjOk(data) {
  return new Response(JSON.stringify({ code: 200, result: true, message: "Success", data }));
}
function cjErr(code, message) {
  return new Response(JSON.stringify({ code, result: false, message, data: null }));
}
const cjProduct = (overrides = {}) => ({
  pid: PID,
  productNameEn: "Magnetic Phone Holder For Car Dashboard",
  bigImage: "https://cf.cjdropshipping.com/a.jpg",
  productImageSet: ["https://cf.cjdropshipping.com/a.jpg", "https://cf.cjdropshipping.com/b.jpg"],
  description: "<p>Strong magnet.</p><p>Fits all phones &amp; cases</p><img src=x>",
  variants: [
    { vid: VID, variantKey: "Black", variantSellPrice: 3.2, inventories: [{ countryCode: "US", totalInventory: 40 }] },
    { vid: VID2, variantKey: "Silver", variantSellPrice: 3.6, inventories: [{ countryCode: "US", totalInventory: 0 }] }
  ],
  ...overrides
});

beforeEach(() => {
  _reset();
  calls = [];
  cj = {
    list: (url) => {
      const kw = url.searchParams.get("keyWord");
      return cjOk({
        content: [
          {
            productList: [
              { id: `${kw}-1`, nameEn: `Handy ${kw} gadget`, bigImage: "https://img/x.jpg", sellPrice: "2.50", warehouseInventoryNum: 300 },
              { id: `${kw}-2`, nameEn: "Kids toy blaster", bigImage: "https://img/y.jpg", sellPrice: "3.00", warehouseInventoryNum: 300 },
              { id: `${kw}-3`, nameEn: "Fancy expensive lamp", bigImage: "https://img/z.jpg", sellPrice: "40.00", warehouseInventoryNum: 300 },
              { id: PID, nameEn: "Magnetic Phone Holder", bigImage: "https://img/p.jpg", sellPrice: "3.20-3.60", warehouseInventoryNum: 40 }
            ]
          }
        ]
      });
    },
    product: () => cjOk(cjProduct()),
    freight: () => cjOk([
      { logisticName: "Slow Boat", logisticPrice: 2.1, logisticAging: "15-30" },
      { logisticName: "USPS+", logisticPrice: 4.71, logisticAging: "2-5" }
    ]),
    getOrder: () => cjErr(1603100, "Order not found"),
    createOrder: () => cjOk({ orderId: "CJ-9001", orderStatus: "UNSHIPPED" })
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const body = init.body;
    calls.push({ url, method: init.method || "GET", body, headers: init.headers || {} });
    if (url.host === "developers.cjdropshipping.com") {
      const p = url.pathname.replace("/api2.0/v1", "");
      if (p === "/authentication/getAccessToken") return cjOk({ accessToken: "tok" });
      if (p === "/product/listV2") return cj.list(url);
      if (p === "/product/query") return cj.product(url);
      if (p === "/logistic/freightCalculate") return cj.freight(JSON.parse(body));
      if (p === "/shopping/order/getOrderDetail") return cj.getOrder(url);
      if (p === "/shopping/order/createOrderV2") return cj.createOrder(JSON.parse(body));
    }
    if (url.host === "api.stripe.com") {
      if (url.pathname === "/v1/checkout/sessions") {
        return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
      }
      return new Response(JSON.stringify({ id: "ok" }));
    }
    if (url.host === "alerts.example") return new Response("ok");
    throw new Error("Unexpected fetch " + url);
  };
});

const req = (path, init) => new Request("https://www.romansproposal.com" + path, init);
const stripeCalls = (path) => calls.filter((c) => c.url.host === "api.stripe.com" && c.url.pathname === path);
const cjCalls = (path) => calls.filter((c) => c.url.pathname === "/api2.0/v1" + path);

// ---- pricing ----------------------------------------------------------------
test("prices end in .99, cover costs, and the bundle price is 15% off", () => {
  const p = listPriceCents(3.2);
  assert.equal(p % 100, 99);
  // (3.20 + 5.50) * 1.6 = 13.92 -> + Stripe fee -> 14.64 -> 14.99
  assert.equal(p, 1499);
  assert.equal(unitPriceCents(3.2, 1), 1499);
  assert.equal(unitPriceCents(3.2, 2), Math.round(1499 * 0.85));
  assert.equal(listPriceCents(0), null);
  assert.equal(stripeFeeCents(1000), 59);
});

test("stripe form encoding and signature check", () => {
  const form = encodeForm({ a: { b: [{ c: 1 }, { c: 2 }] }, d: true, e: undefined });
  assert.equal(form.toString(), "a%5Bb%5D%5B0%5D%5Bc%5D=1&a%5Bb%5D%5B1%5D%5Bc%5D=2&d=true");
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", "whsec_x").update(`${t}.{}`).digest("hex");
  assert.equal(verifyStripeSignature("{}", `t=${t},v1=${sig}`, "whsec_x"), true);
  assert.equal(verifyStripeSignature("{}", `t=${t},v1=${sig}`, "whsec_other"), false);
  assert.equal(verifyStripeSignature("{}", `t=${t - 1000},v1=${sig}`, "whsec_x"), false);
});

test("helpers: item codes are stable, titles and descriptions are cleaned", () => {
  assert.equal(itemCode(PID), itemCode(PID));
  assert.match(itemCode(PID), /^[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(cleanTitle("【HOT】 new_car  phone holder"), "New car phone holder");
  assert.equal(htmlToText("<p>Strong &amp; light</p><script>x()</script><p>Two</p>"), "Strong & light\nTwo");
});

// ---- catalog ------------------------------------------------------------------
test("catalog lists cheap US-warehouse items and drops blocked or pricey ones", async () => {
  const res = await products.GET(req("/api/products"));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ready, true);
  assert.match(res.headers.get("cache-control"), /s-maxage=21600/);
  const titles = data.products.map((p) => p.title);
  assert.ok(titles.some((t) => t.startsWith("Handy")));
  assert.ok(!titles.some((t) => /Kids|expensive/.test(t)));
  // Same product returned by several searches is listed once.
  assert.equal(data.products.filter((p) => p.id === PID).length, 1);
  assert.ok(data.products.every((p) => p.priceCents % 100 === 99 && p.code.length === 4));
  const listCall = cjCalls("/product/listV2")[0].url.searchParams;
  assert.equal(listCall.get("countryCode"), "US");
  assert.equal(listCall.get("endSellPrice"), "12");
  assert.ok(!("costUsd" in data.products[0]));
});

test("product endpoint hides supplier cost and out-of-stock variants", async () => {
  const res = await product.GET(req(`/api/product?id=${PID}`));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.variants.length, 1);
  assert.equal(data.variants[0].vid, VID);
  assert.equal(data.variants[0].costUsd, undefined);
  assert.equal(data.description, "Strong magnet.\nFits all phones & cases");
  assert.equal(cjCalls("/product/query")[0].url.searchParams.get("countryCode"), "US");
});

// ---- checkout -----------------------------------------------------------------
const postCheckout = (items) =>
  checkout.POST(req("/api/checkout", { method: "POST", body: JSON.stringify({ items }), headers: { "content-type": "application/json" } }));

test("checkout re-prices on the server and opens Stripe Checkout", async () => {
  const res = await postCheckout([{ id: PID, vid: VID, qty: 2 }]);
  const data = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data));
  assert.equal(data.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  assert.match(data.order, /^RP-[2-9A-HJ-NP-Z]{8}$/);

  const [call] = stripeCalls("/v1/checkout/sessions");
  const form = new URLSearchParams(call.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), String(Math.round(1499 * 0.85)));
  assert.equal(form.get("line_items[0][quantity]"), "2");
  assert.equal(form.get("shipping_address_collection[allowed_countries][0]"), "US");
  assert.equal(form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "0");
  assert.equal(form.get("metadata[items]"), `${VID}:2`);
  assert.equal(form.get("metadata[logistic]"), "USPS+"); // fast option preferred over the cheaper slow one
  assert.equal(form.get("metadata[order]"), data.order);
  assert.equal(call.headers["Idempotency-Key"], data.order);
  assert.ok(form.get("success_url").startsWith(`https://www.romansproposal.com/thanks.html?order=${data.order}`));
});

test("checkout refuses sold-out variants and money-losing carts", async () => {
  let res = await postCheckout([{ id: PID, vid: VID2, qty: 1 }]);
  assert.equal(res.status, 409);
  assert.equal(stripeCalls("/v1/checkout/sessions").length, 0);

  cj.freight = () => cjOk([{ logisticName: "USPS+", logisticPrice: 14.0, logisticAging: "2-5" }]);
  res = await postCheckout([{ id: PID, vid: VID, qty: 1 }]);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /supplier price/);
  assert.equal(stripeCalls("/v1/checkout/sessions").length, 0);
});

test("checkout ignores browser-supplied prices and bad input", async () => {
  const res = await postCheckout([{ id: PID, vid: VID, qty: 1, priceCents: 1 }]);
  const form = new URLSearchParams(stripeCalls("/v1/checkout/sessions")[0].body);
  assert.equal(res.status, 200);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "1499");
  assert.equal((await postCheckout([{ id: "<script>", vid: VID, qty: 1 }])).status, 400);
  assert.equal((await postCheckout([])).status, 400);
});

// ---- webhook / fulfilment -------------------------------------------------------
const session = (extra = {}) => ({
  id: "cs_test_1",
  payment_status: "paid",
  payment_intent: "pi_123",
  metadata: { order: "RP-ABCD2345", items: `${VID}:2`, logistic: "USPS+" },
  customer_details: { email: "buyer@example.com", phone: "+1 (603) 555-0199", name: "Pat Buyer" },
  collected_information: {
    shipping_details: {
      name: "Pat Buyer",
      address: { line1: "1 Main St", line2: "Apt 2", city: "Portsmouth", state: "NH", postal_code: "03801", country: "US" }
    }
  },
  ...extra
});

function signedEvent(obj, type = "checkout.session.completed") {
  const raw = JSON.stringify({ id: "evt_1", type, data: { object: obj } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", "whsec_test").update(`${t}.${raw}`).digest("hex");
  return req("/api/stripe-webhook", { method: "POST", body: raw, headers: { "stripe-signature": `t=${t},v1=${sig}` } });
}

test("webhook rejects unsigned requests", async () => {
  const res = await webhook.POST(req("/api/stripe-webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } }));
  assert.equal(res.status, 400);
  assert.equal(cjCalls("/shopping/order/createOrderV2").length, 0);
});

test("paid checkout places and pays the CJ order with the customer's address", async () => {
  const res = await webhook.POST(signedEvent(session()));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.status, "placed");
  const body = JSON.parse(cjCalls("/shopping/order/createOrderV2")[0].body);
  assert.equal(body.orderNumber, "RP-ABCD2345");
  assert.equal(body.payType, 2);
  assert.equal(body.shippingProvince, "New Hampshire");
  assert.equal(body.shippingCity, "Portsmouth");
  assert.equal(body.shippingZip, "03801");
  assert.equal(body.shippingAddress2, "Apt 2");
  assert.equal(body.shippingPhone, "6035550199");
  assert.equal(body.fromCountryCode, "US");
  assert.equal(body.logisticName, "USPS+");
  assert.deepEqual(body.products, [{ vid: VID, quantity: 2 }]);
  const tag = new URLSearchParams(stripeCalls("/v1/payment_intents/pi_123")[0].body);
  assert.equal(tag.get("metadata[cj_order_id]"), "CJ-9001");
  assert.equal(stripeCalls("/v1/refunds").length, 0);
});

test("duplicate webhook deliveries never create a second order", async () => {
  cj.getOrder = () => cjOk({ orderId: "CJ-9001", orderStatus: "UNSHIPPED" });
  const data = await (await webhook.POST(signedEvent(session()))).json();
  assert.equal(data.status, "already-placed");
  assert.equal(cjCalls("/shopping/order/createOrderV2").length, 0);
});

test("item removed at the supplier -> customer refunded automatically + owner alerted", async () => {
  process.env.ALERT_WEBHOOK_URL = "https://alerts.example/hook";
  cj.createOrder = () => cjErr(1602003, "Variant has been removed from shelves");
  const data = await (await webhook.POST(signedEvent(session()))).json();
  delete process.env.ALERT_WEBHOOK_URL;
  assert.equal(data.status, "refunded");
  const refund = stripeCalls("/v1/refunds")[0];
  assert.equal(new URLSearchParams(refund.body).get("payment_intent"), "pi_123");
  assert.equal(refund.headers["Idempotency-Key"], "refund-RP-ABCD2345");
  assert.equal(calls.filter((c) => c.url.host === "alerts.example").length, 1);
});

test("empty CJ wallet -> no refund, owner told to top up", async () => {
  let created = false;
  cj.createOrder = () => { created = true; return cjErr(1604000, "Balance is insufficient"); };
  cj.getOrder = () => (created ? cjOk({ orderId: "CJ-9002", orderStatus: "UNPAID" }) : cjErr(1603100, "Order not found"));
  const data = await (await webhook.POST(signedEvent(session()))).json();
  assert.equal(data.status, "needs-payment");
  assert.equal(stripeCalls("/v1/refunds").length, 0);
});

test("shipping method retired -> re-quotes and retries once", async () => {
  let n = 0;
  cj.createOrder = (body) => (n++ === 0 ? cjErr(1605001, "Logistic invalid") : cjOk({ orderId: "CJ-9003", orderStatus: "PENDING", used: body.logisticName }));
  const data = await (await webhook.POST(signedEvent(session()))).json();
  assert.equal(data.status, "placed");
  assert.equal(JSON.parse(cjCalls("/shopping/order/createOrderV2")[1].body).logisticName, "USPS+");
});

test("CJ outage -> 500 so Stripe retries later, nothing refunded", async () => {
  cj.createOrder = () => cjErr(1600000, "System busy");
  const res = await webhook.POST(signedEvent(session()));
  assert.equal(res.status, 500);
  assert.equal(stripeCalls("/v1/refunds").length, 0);
});

test("older Stripe API payload shape (shipping_details) still works", async () => {
  const s = session({ collected_information: undefined, shipping_details: session().collected_information.shipping_details });
  const data = await (await webhook.POST(signedEvent(s))).json();
  assert.equal(data.status, "placed");
});

test("unpaid sessions and unrelated events are acknowledged but not fulfilled", async () => {
  await webhook.POST(signedEvent(session({ payment_status: "unpaid" })));
  await webhook.POST(signedEvent(session(), "payment_intent.created"));
  assert.equal(cjCalls("/shopping/order/createOrderV2").length, 0);
});

// ---- tracking -----------------------------------------------------------------
test("order tracking shows status and tracking link only", async () => {
  cj.getOrder = () => cjOk({ orderId: "CJ-9001", orderStatus: "SHIPPED", trackNumber: "9400111", logisticName: "USPS+", shippingAddress: "1 Main St" });
  const data = await (await order.GET(req("/api/order?n=rp-abcd2345"))).json();
  assert.equal(data.status, "SHIPPED");
  assert.equal(data.trackingNumber, "9400111");
  assert.match(data.trackingUrl, /17track/);
  assert.equal(JSON.stringify(data).includes("Main St"), false);
  assert.equal((await order.GET(req("/api/order?n=nope"))).status, 400);
});
