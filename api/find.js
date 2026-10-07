// GET /api/find?q=...: a shopper searched for something not in the lineup. Scrapes suppliers
// for it live (about 20-40s) and returns buyable matches. Results also join the catalog.
const { ACTOR, apify, recentRuns, datasetItems, mergePicks, scrapeInput, publicFields } = require("./_catalog");

const MAX_SEARCHES_PER_DAY = Number(process.env.MAX_SEARCHES_PER_DAY || 40);

module.exports = async (req, res) => {
  const q = String(req.query.q || "").toLowerCase().replace(/[^a-z0-9 \-]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 40) return res.status(400).json({ error: "Search for 2-40 letters." });
  if (!process.env.APIFY_TOKEN || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Live search is not switched on yet.", products: [] });
  }
  try {
    const dayAgo = Date.now() - 86400000;
    const today = (await recentRuns(100)).filter((r) => new Date(r.startedAt).getTime() >= dayAgo);
    if (today.length >= MAX_SEARCHES_PER_DAY) {
      return res.status(429).json({ error: "Live search is busy. Try again later.", products: [] });
    }
    const run = await apify(`/acts/${ACTOR}/runs?waitForFinish=55`, {
      method: "POST",
      body: JSON.stringify(scrapeInput([q], 16)),
    });
    if (run.data.status !== "SUCCEEDED") {
      return res.status(202).json({ pending: true, products: [] });
    }
    const items = await datasetItems(run.data.defaultDatasetId);
    res.status(200).json({ products: mergePicks([items]).map(publicFields) });
  } catch (err) {
    console.error("Live search failed:", err.message);
    res.status(502).json({ error: "Live search failed. Try again.", products: [] });
  }
};
