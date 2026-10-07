import { STORE } from "./config.js";

const toCents = (usd) => Math.round(Number(usd) * 100);

// Round up to the next .99 (e.g. 15.14 -> 15.99).
const charm = (usd) => {
  let p = Math.ceil(usd) - 0.01;
  if (p < usd) p += 1;
  return p;
};

// Our everyday price for one unit, shipping included, in cents.
export function listPriceCents(costUsd) {
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const landed = cost + STORE.shippingAllowanceUsd;
  const withMargin = landed * (1 + STORE.markup);
  const withFees = (withMargin + STORE.stripeFeeFixedCents / 100) / (1 - STORE.stripeFeePercent);
  return toCents(charm(withFees));
}

export const bundleApplies = (totalQty) => totalQty >= STORE.bundleMinQty;

export function unitPriceCents(costUsd, totalQty) {
  const base = listPriceCents(costUsd);
  if (base == null) return null;
  return bundleApplies(totalQty) ? Math.round(base * (1 - STORE.bundleDiscount)) : base;
}

export function stripeFeeCents(revenueCents) {
  return Math.round(revenueCents * STORE.stripeFeePercent) + STORE.stripeFeeFixedCents;
}

// "1.20-3.50" or "2.15" or 2.15 -> lowest number.
export function minPrice(value) {
  if (typeof value === "number") return value;
  const nums = String(value ?? "")
    .split(/[^0-9.]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.min(...nums) : null;
}

export { toCents };
