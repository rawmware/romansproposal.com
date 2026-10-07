// GET /api/order?n=RP-XXXXXXXX -> shipping status + tracking (no personal data).
import { getOrder } from "./_lib/cj.js";
import { ORDER_RE, STATUS_TEXT } from "./_lib/orders.js";
import { isConfigured } from "./_lib/config.js";
import { json } from "./_lib/http.js";

export async function GET(request) {
  const n = (new URL(request.url).searchParams.get("n") || "").trim().toUpperCase();
  if (!ORDER_RE.test(n)) return json({ error: "Order numbers look like RP-7K2M9QXA." }, { status: 400 });
  if (!isConfigured().cj) return json({ error: "Tracking is unavailable right now." }, { status: 503 });
  try {
    const o = await getOrder(n);
    if (!o) {
      return json({
        found: false,
        message: "We don't see that order at the warehouse yet. If you just ordered, give it a few minutes and check again."
      });
    }
    const status = String(o.orderStatus || "CREATED").toUpperCase();
    const track = o.trackNumber || null;
    return json({
      found: true,
      order: n,
      status,
      statusText: STATUS_TEXT[status] || "Order received.",
      carrier: o.logisticName || null,
      trackingNumber: track,
      trackingUrl: track ? `https://t.17track.net/en#nums=${encodeURIComponent(track)}` : null,
      placedAt: o.createDate || null
    });
  } catch (err) {
    console.error("Order lookup failed:", n, err);
    return json({ error: "Couldn't check right now. Try again in a minute." }, { status: 503 });
  }
}
