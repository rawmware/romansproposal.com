// Optional heads-up when something needs a human (low CJ wallet, auto-refund).
// Set ALERT_WEBHOOK_URL to a Discord or Slack incoming-webhook URL.
export async function alertOwner(message) {
  console.error("[ALERT]", message);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message.slice(0, 1900), text: message }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    console.error("Alert webhook failed:", err.message);
  }
}
