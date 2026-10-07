import { randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ORDER_RE = /^RP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

export function newOrderNumber() {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % 32];
  return `RP-${s}`;
}

// Cart is stored on the Stripe session as "vid:qty,vid:qty".
export const encodeItems = (lines) => lines.map((l) => `${l.vid}:${l.qty}`).join(",");

export const decodeItems = (value) =>
  String(value || "")
    .split(",")
    .map((pair) => {
      const i = pair.lastIndexOf(":");
      return { vid: pair.slice(0, i), quantity: Number(pair.slice(i + 1)) };
    })
    .filter((p) => p.vid && Number.isInteger(p.quantity) && p.quantity > 0);

// Pick the cheapest shipping method that arrives within ~10 days if possible.
export function pickShipping(options) {
  const list = (Array.isArray(options) ? options : [])
    .map((o) => ({
      name: o.logisticName,
      price: Number(o.totalPostageFee ?? o.logisticPrice),
      maxDays: Math.max(...String(o.logisticAging || "").split(/[^0-9]+/).map(Number).filter(Number.isFinite), 0) || 99
    }))
    .filter((o) => o.name && Number.isFinite(o.price) && o.price >= 0)
    .sort((a, b) => a.price - b.price);
  return list.find((o) => o.maxDays <= 10) || list[0] || null;
}

export const STATUS_TEXT = {
  CREATED: "Order received. Getting it ready.",
  IN_CART: "Order received. Getting it ready.",
  UNPAID: "Order received. Getting it ready.",
  PENDING: "Paid and being packed at the warehouse.",
  PROCESSING: "Being packed at the warehouse.",
  UNSHIPPED: "Being packed at the warehouse.",
  SHIPPED: "Shipped. On its way to you.",
  DELIVERED: "Delivered.",
  CANCELLED: "Cancelled. If you were charged, a refund is on its way."
};
