// Minimal Stripe REST client (no SDK needed) + webhook signature check.
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(status, message) {
    super(`Stripe ${status}: ${message}`);
    this.status = status;
  }
}

// Stripe expects form encoding with bracketed keys: a[b][0][c]=1
export function encodeForm(value, prefix = "", out = new URLSearchParams()) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.append(prefix, String(value));
  }
  return out;
}

export async function stripe(path, { method = "GET", params, idempotencyKey } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("CONFIG", "STRIPE_SECRET_KEY is not set");
  const headers = { Authorization: `Bearer ${key}` };
  let url = API + path;
  let body;
  if (params && method === "GET") {
    url += "?" + encodeForm(params).toString();
  } else if (params) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeForm(params).toString();
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(res.status, json?.error?.message || "Request failed");
  return json;
}

// https://docs.stripe.com/webhooks#verify-manually
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.create(null);
  const v1 = [];
  for (const item of header.split(",")) {
    const [k, v] = item.split("=");
    if (k === "v1") v1.push(v);
    else parts[k] = v;
  }
  const t = Number(parts.t);
  if (!t || v1.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  return v1.some((sig) => {
    const b = Buffer.from(sig || "");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
