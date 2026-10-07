// Turns CJ supplier data into store products (title, price, images, variants).
import { createHash } from "node:crypto";
import { STORE, COLLECTIONS, BLOCKED_TITLE } from "./config.js";
import { listProducts, getProduct } from "./cj.js";
import { listPriceCents, minPrice } from "./pricing.js";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Short, stable item code for reels/captions ("item K7Q2"). Derived from the
// supplier product id, so it never changes while the product is listed.
export function itemCode(pid) {
  const bytes = createHash("sha1").update(String(pid)).digest();
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[bytes[i] % 32];
  return code;
}

export function cleanTitle(raw) {
  let t = String(raw || "")
    .replace(/[【\[(（][^\]】)）]*[\]】)）]/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 64) t = t.slice(0, 64).replace(/\s+\S*$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

export function htmlToText(html, max = 1500) {
  const text = String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

const httpsImage = (url) => {
  if (!url || typeof url !== "string") return null;
  const u = url.trim().replace(/^http:\/\//i, "https://");
  return u.startsWith("https://") ? u : null;
};

function parseImageList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return value ? [value] : [];
}

function toListing(item, collection) {
  const cost = minPrice(item.nowPrice || item.sellPrice);
  const image = httpsImage(item.bigImage);
  const title = cleanTitle(item.nameEn);
  if (!item.id || !image || !title || cost == null) return null;
  if (cost < STORE.minCostUsd || cost > STORE.maxCostUsd) return null;
  if (BLOCKED_TITLE.test(item.nameEn || "")) return null;
  const stock = Number(item.warehouseInventoryNum ?? item.totalVerifiedInventory);
  if (Number.isFinite(stock) && stock < 10) return null;
  return {
    id: item.id,
    code: itemCode(item.id),
    title,
    image,
    priceCents: listPriceCents(cost),
    category: collection.key,
    stock: Number.isFinite(stock) ? stock : null
  };
}

// Pulls every collection from CJ (US warehouse, in budget, in stock).
export async function buildCatalog() {
  const seen = new Set();
  const products = [];
  const errors = [];
  for (const collection of COLLECTIONS) {
    try {
      const data = await listProducts({
        keyWord: collection.keyword,
        page: 1,
        size: Math.min(100, STORE.perCollection * 3),
        countryCode: STORE.shipFrom,
        startSellPrice: STORE.minCostUsd,
        endSellPrice: STORE.maxCostUsd,
        startWarehouseInventory: 10,
        orderBy: 1,
        sort: "desc"
      });
      const items = (data?.content || []).flatMap((c) => c.productList || []);
      let added = 0;
      for (const item of items) {
        if (added >= STORE.perCollection) break;
        if (seen.has(item.id)) continue;
        const listing = toListing(item, collection);
        if (!listing) continue;
        seen.add(item.id);
        products.push(listing);
        added++;
      }
    } catch (err) {
      errors.push(`${collection.key}: ${err.message}`);
      if (err.code === "CONFIG") throw err;
    }
  }
  return { products, errors };
}

function usInventory(variant) {
  const list = Array.isArray(variant.inventories) ? variant.inventories : null;
  if (!list) return null;
  return list
    .filter((inv) => inv.countryCode === STORE.shipFrom)
    .reduce((sum, inv) => sum + (Number(inv.totalInventory) || 0), 0);
}

// Full product with variants that are in stock in the US warehouse.
export async function loadProduct(pid) {
  const p = await getProduct(pid, STORE.shipFrom);
  if (!p || !p.pid) return null;
  if (BLOCKED_TITLE.test(p.productNameEn || "")) return null;

  const variants = (p.variants || [])
    .map((v) => {
      const cost = Number(v.variantSellPrice);
      const stock = usInventory(v);
      return {
        vid: v.vid,
        name: (v.variantKey || "").replace(/-/g, " / ") || "Standard",
        costUsd: cost,
        priceCents: listPriceCents(cost),
        image: httpsImage(v.variantImage),
        stock
      };
    })
    .filter((v) => v.vid && v.priceCents && (v.stock == null || v.stock > 0));

  if (variants.length === 0) return null;

  const images = [...new Set([httpsImage(p.bigImage), ...parseImageList(p.productImageSet).map(httpsImage)])]
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: p.pid,
    code: itemCode(p.pid),
    title: cleanTitle(p.productNameEn),
    images,
    description: htmlToText(p.description),
    variants,
    fromPriceCents: Math.min(...variants.map((v) => v.priceCents))
  };
}

// What the browser is allowed to see (no supplier cost).
export const publicProduct = (product) =>
  product && {
    ...product,
    variants: product.variants.map(({ costUsd, ...v }) => v)
  };
