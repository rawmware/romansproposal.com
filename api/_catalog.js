// Shared catalog: the original products (Stripe Payment Links) plus cheap picks scraped from
// AliExpress by Apify. Picks accumulate across recent scrape runs, refresh themselves while the
// site has traffic, and can be extended on demand by shopper searches (see find.js).
// Files starting with "_" are not exposed as endpoints.
const STATIC = require("./_static.json");
const SEED = require("./_seed.json");

const ACTOR = "thirdwatch~aliexpress-product-scraper";
const APIFY = "https://api.apify.com/v2";
const MAX_SUPPLIER_COST = Number(process.env.MAX_SUPPLIER_COST || 6);
const KEEP_HOURS = 72; // how long scraped items stay listed
const MAX_RUNS = 30; // how many recent scrape runs to merge
const REFRESH_HOURS = 6; // start a new scrape when the newest one is older than this
const CACHE_MS = 10 * 60 * 1000;

const QUERIES = [
  "phone accessories", "kitchen gadgets", "car accessories", "cable organizer",
  "pet accessories", "bathroom gadgets", "cleaning tools", "led lights",
  "hair accessories", "jewelry", "desk accessories", "travel accessories",
  "fridge organizer", "keychain", "gym accessories", "storage organizer",
];
const QUERIES_PER_RUN = 8;

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

function categoryFor(query) {
  const q = String(query || "").trim().toLowerCase();
  return CATEGORY[q] || (q ? q.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 20) : "Finds");
}

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

function usable(item) {
  if (!item || !item.product_id || !item.image_url || !item.url) return false;
  if (BLOCKED.test(item.title || "")) return false;
  const cost = supplierCost(item);
  return cost > 0 && cost <= MAX_SUPPLIER_COST;
}

function toPick(item) {
  const cost = supplierCost(item);
  return {
    id: "ae-" + item.product_id,
    name: cleanTitle(item.title),
    price: retailPrice(cost),
    category: categoryFor(item.search_query),
    image: item.image_url,
    supplierUrl: item.url,
    supplierCost: cost,
  };
}

async function apify(path, options = {}) {
  const r = await fetch(APIFY + path, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`Apify ${r.status} ${path.split("?")[0]}`);
  return r.json();
}

async function recentRuns(limit, status) {
  const q = `?desc=1&limit=${limit}` + (status ? `&status=${status}` : "");
  return (await apify(`/acts/${ACTOR}/runs${q}`)).data.items || [];
}

function datasetItems(datasetId) {
  return apify(`/datasets/${datasetId}/items?clean=true`);
}

// Newest observation of each product wins; if it was listed higher in an earlier scrape,
// that earlier price is kept as a real "was" price.
function mergePicks(itemLists) {
  const byId = new Map();
  for (const items of itemLists) {
    for (const item of items) {
      if (!usable(item)) continue;
      const pick = toPick(item);
      const seen = byId.get(pick.id);
      if (!seen) byId.set(pick.id, pick);
      else if (pick.price > seen.price + 0.5 && pick.price > (seen.wasPrice || 0)) seen.wasPrice = pick.price;
    }
  }
  const seenImages = new Set();
  return [...byId.values()].filter((p) => !seenImages.has(p.image) && seenImages.add(p.image));
}

let cache = { at: 0, picks: null };

async function getPicks({ fresh = false } = {}) {
  if (!process.env.APIFY_TOKEN) return mergePicks([SEED]);
  if (!fresh && cache.picks && Date.now() - cache.at < CACHE_MS) return cache.picks;
  try {
    const cutoff = Date.now() - KEEP_HOURS * 3600 * 1000;
    const runs = (await recentRuns(MAX_RUNS, "SUCCEEDED"))
      .filter((run, i) => i < 3 || new Date(run.startedAt).getTime() >= cutoff);
    const lists = await Promise.all(runs.map((run) => datasetItems(run.defaultDatasetId).catch(() => [])));
    const picks = mergePicks([...lists, SEED]);
    cache = { at: Date.now(), picks };
    return picks;
  } catch (err) {
    console.error("Apify fetch failed:", err.message);
    return cache.picks || mergePicks([SEED]);
  }
}

// Scraped picks need STRIPE_SECRET_KEY to be buyable, so they only show once it is set.
async function getProducts(opts) {
  const picks = process.env.STRIPE_SECRET_KEY ? await getPicks(opts) : [];
  return [...picks, ...STATIC].sort((a, b) => a.price - b.price);
}

function publicFields(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    wasPrice: p.wasPrice || null,
    category: p.category,
    image: p.image,
    buy: p.paymentLink || `/api/checkout?id=${encodeURIComponent(p.id)}`,
  };
}

async function findProduct(id) {
  const products = await getProducts();
  return products.find((p) => p.id === id) || (await getProducts({ fresh: true })).find((p) => p.id === id) || null;
}

function scrapeInput(queries, maxResults) {
  return { queries, sortBy: "orders", maxPrice: MAX_SUPPLIER_COST, freeShippingOnly: true, country: "US", language: "en", maxResults };
}

// Starts a scrape of the next block of niches. Rotates by 6-hour slot so each run differs.
async function startScheduledScrape() {
  const slot = Math.floor(Date.now() / (REFRESH_HOURS * 3600 * 1000));
  const start = (slot * QUERIES_PER_RUN) % QUERIES.length;
  const queries = Array.from({ length: QUERIES_PER_RUN }, (_, i) => QUERIES[(start + i) % QUERIES.length]);
  const run = await apify(`/acts/${ACTOR}/runs`, { method: "POST", body: JSON.stringify(scrapeInput(queries, 12)) });
  return { runId: run.data.id, queries };
}

// Called on page traffic: kicks off a new scrape if the newest one is stale. Cheap no-op otherwise.
async function refreshIfStale() {
  if (!process.env.APIFY_TOKEN) return null;
  try {
    const [latest] = await recentRuns(1);
    const age = latest ? Date.now() - new Date(latest.startedAt).getTime() : Infinity;
    const busy = latest && (latest.status === "RUNNING" || latest.status === "READY");
    if (busy || age < REFRESH_HOURS * 3600 * 1000) return null;
    return await startScheduledScrape();
  } catch (err) {
    console.error("Refresh check failed:", err.message);
    return null;
  }
}

module.exports = {
  ACTOR, apify, recentRuns, datasetItems, mergePicks, scrapeInput,
  getProducts, publicFields, findProduct, startScheduledScrape, refreshIfStale,
};
