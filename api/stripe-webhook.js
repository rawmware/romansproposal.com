// POST /api/stripe-webhook  (add this URL in Stripe → Developers → Webhooks)
// Events: checkout.session.completed, checkout.session.async_payment_succeeded
import { verifyStripeSignature } from "./_lib/stripe.js";
import { fulfill } from "./_lib/fulfill.js";
import { json } from "./_lib/http.js";

const HANDLED = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export async function POST(request) {
  const raw = await request.text();
  const ok = verifyStripeSignature(raw, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Invalid signature" }, { status: 400 });

  const event = JSON.parse(raw);
  if (!HANDLED.has(event.type)) return json({ received: true });

  const session = event.data?.object;
  if (session?.payment_status !== "paid") return json({ received: true, status: "awaiting-payment" });

  try {
    const result = await fulfill(session);
    console.log("Fulfilment", session.metadata?.order, result);
    return json({ received: true, ...result });
  } catch (err) {
    // Non-2xx makes Stripe retry with backoff for up to 3 days.
    console.error("Fulfilment failed, Stripe will retry:", session?.metadata?.order, err);
    return json({ error: "Fulfilment pending" }, { status: 500 });
  }
}
