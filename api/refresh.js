// GET /api/refresh: run daily by Vercel Cron (see vercel.json). Starts an Apify scrape of
// cheap, free-shipping, best-selling AliExpress items; the site reads the newest results.
const { ACTOR } = require("./_catalog");

const QUERIES = [
  "phone accessories", "kitchen gadgets", "car accessories", "cable organizer",
  "pet accessories", "bathroom gadgets", "cleaning tools", "led lights",
  "hair accessories", "jewelry", "desk accessories", "travel accessories",
  "fridge organizer", "keychain", "gym accessories", "storage organizer",
];
const PER_DAY = 8;

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: "APIFY_TOKEN is not set" });

  // Rotate through the niches so each day brings a different lineup.
  const day = Math.floor(Date.now() / 86400000);
  const start = (day * PER_DAY) % QUERIES.length;
  const queries = Array.from({ length: PER_DAY }, (_, i) => QUERIES[(start + i) % QUERIES.length]);

  const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      queries,
      sortBy: "orders",
      maxPrice: 6,
      freeShippingOnly: true,
      country: "US",
      language: "en",
      maxResults: 12,
    }),
  });
  const run = await r.json();
  if (!r.ok) return res.status(502).json({ error: "Apify run failed to start", detail: run });
  res.status(200).json({ started: run.data && run.data.id, queries });
};
