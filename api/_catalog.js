// Shared catalog: the original products (Stripe Payment Links) plus daily cheap picks
// scraped from AliExpress by Apify. Files starting with "_" are not exposed as endpoints.
const STATIC = require("./_static.json");
const SEED = require("./_seed.json");

const ACTOR = "thirdwatch~aliexpress-product-scraper";
const MAX_SUPPLIER_COST = Number(process.env.MAX_SUPPLIER_COST || 6);
const MAX_PICKS = 80;

// Items that are restricted to ship or risky to resell.
const BLOCKED = /battery|batteries|power bank|lighter|vape|e-cig|knife|knives|blade|razor|gun|weapon|medical|medicine|supplement|cosmetic|cream for|serum|toy for kids|baby bottle|pacifier/i;

const CATEGORY = {
  "phone accessories": "Phone", "kitchen gadgets": "Kitchen", "car accessories": "Car",
  "cable organizer": "Desk", "pet accessories": "Pet", "bathroom gadgets": "Home",
  "cleaning tools": "Home", "led lights": "Home", "hair accessories": "Style",
  "jewelry": "Style", "desk accessories": "Desk", "travel accessories": "Travel",
  "fridge organizer": "Kitchen", "keychain": "Style", "gym accessories": "Fitness",
  "storage organizer": "Home",
};

// AliExpress often shows a one-time new-customer price (e.g. $0.33). Treat anything under $1
// as that and cost the item at its listed price instead, so repeat orders stay profitable.
function supplierCost(item) {
  const sale = Number(item.sale_price) || 0;
  const orig = Number(item.original_price) || 0;
  return sale >= 1 ? sale : orig || sale;
}

// Customer price: at least 2.5x cost, at least $7 profit, never under $7.99. Ends in .99.
function retailPrice(cost) {
  const raw = Math.max(cost * 2.5, cost + 7, 7.99);
  return Math.ceil(raw) - 0.01;
}

function cleanTitle(title) {
  let t = String(title || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^(1pc|1 pc|1pcs|new)\s+/i, "");
  t = t.replace(/^[A-Z]{4,}\s+/, ""); // drop unknown all-caps seller brands like "NNBILI"
  if (t.length > 60) t = t.slice(0, 60).replace(/[\s,/-]+\S*$/, "");
  t = t.replace(/[\s,]+(for|or|and|with|to|of|in)$/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function toPick(item) {
  const cost = supplierCost(item);
  return {
    id: "ae-" + item.product_id,
    name: cleanTitle(item.title),
    price: retailPrice(cost),
    category: CATEGORY[item.search_query] || "Finds",
    image: item.image_url,
    supplierUrl: item.url,
    supplierCost: cost,
  };
}

async function fetchScraped() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return SEED;
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs/last/dataset/items?status=SUCCEEDED&clean=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) throw new Error(`Apify ${r.status}`);
    const items = await r.json();
    return Array.isArray(items) && items.length ? items : SEED;
  } catch (err) {
    console.error("Apify fetch failed, using seed:", err.message);
    return SEED;
  }
}

async function getPicks() {
  const seenIds = new Set();
  const seenImages = new Set();
  const picks = [];
  for (const item of await fetchScraped()) {
    if (!item || !item.product_id || !item.image_url || !item.url) continue;
    if (BLOCKED.test(item.title || "")) continue;
    const cost = supplierCost(item);
    if (!cost || cost > MAX_SUPPLIER_COST) continue;
    if (seenIds.has(item.product_id) || seenImages.has(item.image_url)) continue;
    seenIds.add(item.product_id);
    seenImages.add(item.image_url);
    picks.push(toPick(item));
    if (picks.length >= MAX_PICKS) break;
  }
  return picks;
}

// Scraped picks need STRIPE_SECRET_KEY to be buyable, so they only show once it is set.
async function getProducts() {
  const picks = process.env.STRIPE_SECRET_KEY ? await getPicks() : [];
  return [...picks, ...STATIC].sort((a, b) => a.price - b.price);
}

function publicFields(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    image: p.image,
    buy: p.paymentLink || `/api/checkout?id=${encodeURIComponent(p.id)}`,
  };
}

async function findProduct(id) {
  return (await getProducts()).find((p) => p.id === id) || null;
}

module.exports = { ACTOR, getProducts, publicFields, findProduct };
