// Minimal CJ Dropshipping API client (https://developers.cjdropshipping.com).
// CJ allows about 1 request per second per account, so calls are spaced out
// and rate-limit / "system busy" answers are retried.

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

// Codes worth retrying: rate limited, quota, system busy, read timeout,
// warehouse data temporarily unavailable.
const TRANSIENT = new Set([1600000, 1600200, 1600201, 1600301, 1608002, 1610001]);
const AUTH = new Set([1600001, 1600002, 1600030]);

export class CJError extends Error {
  constructor(code, message, { transient = false } = {}) {
    super(`CJ ${code}: ${message}`);
    this.code = code;
    this.transient = transient;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCallAt = 0;
let queue = Promise.resolve();
// Serialise calls within this function instance and keep them >1s apart.
function throttle() {
  const turn = queue.then(async () => {
    const gap = Number(process.env.CJ_MIN_GAP_MS ?? 1100);
    const wait = lastCallAt + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

let token = null;

async function rawCall(path, { method = "GET", query, body, accessToken } = {}) {
  await throttle();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, String(v));
  }
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["CJ-Access-Token"] = accessToken;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
  } catch (err) {
    throw new CJError("NETWORK", err.message, { transient: true });
  }
  if (res.status === 429 || res.status >= 500) {
    throw new CJError(`HTTP${res.status}`, "CJ unavailable", { transient: true });
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new CJError(`HTTP${res.status}`, "Unreadable CJ response", { transient: true });
  }
  if (json.code === 200 || json.result === true) return json.data;
  throw new CJError(json.code, json.message || "Unknown CJ error", {
    transient: TRANSIENT.has(json.code)
  });
}

async function getToken(force = false) {
  if (token && !force) return token;
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new CJError("CONFIG", "CJ_API_KEY is not set");
  const data = await rawCall("/authentication/getAccessToken", {
    method: "POST",
    body: { apiKey }
  });
  token = data.accessToken;
  return token;
}

export async function cj(path, options = {}) {
  let authRetried = false;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const accessToken = await getToken();
      return await rawCall(path, { ...options, accessToken });
    } catch (err) {
      lastErr = err;
      if (err instanceof CJError && AUTH.has(err.code) && !authRetried) {
        authRetried = true;
        token = null;
        continue;
      }
      if (err instanceof CJError && err.transient && attempt < 3) {
        await sleep(Number(process.env.CJ_RETRY_MS ?? 1500) * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ---- Endpoints used by the store -------------------------------------------

export const listProducts = (query) => cj("/product/listV2", { query });

export const getProduct = (pid, countryCode) =>
  cj("/product/query", { query: { pid, countryCode } });

export const calculateFreight = ({ from, to, products }) =>
  cj("/logistic/freightCalculate", {
    method: "POST",
    body: { startCountryCode: from, endCountryCode: to, products }
  });

export const createOrder = (order) =>
  cj("/shopping/order/createOrderV2", { method: "POST", body: order });

// Accepts our own order number (e.g. RP-7K2M9QXA) or a CJ order id.
export async function getOrder(orderId) {
  try {
    return await cj("/shopping/order/getOrderDetail", { query: { orderId } });
  } catch (err) {
    if (err instanceof CJError && err.code === 1603100) return null;
    throw err;
  }
}

export const getBalance = () => cj("/shopping/pay/getBalance");

// For tests.
export function _reset() {
  token = null;
  lastCallAt = 0;
  queue = Promise.resolve();
}
