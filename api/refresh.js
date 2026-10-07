// GET /api/refresh: run daily by Vercel Cron (see vercel.json) as a backstop to the
// traffic-driven refresh. Starts an Apify scrape of cheap, free-shipping, best-selling items.
const { startScheduledScrape } = require("./_catalog");

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: "APIFY_TOKEN is not set" });
  try {
    res.status(200).json(await startScheduledScrape());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
