// GET /api/catalog: every product on the site, cheapest first (no supplier details).
// Each uncached hit also checks whether a new scrape is due, so traffic keeps the lineup fresh.
const { getProducts, publicFields, refreshIfStale } = require("./_catalog");

module.exports = async (req, res) => {
  await refreshIfStale();
  const products = (await getProducts()).map(publicFields);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=86400");
  res.status(200).json({ updatedAt: new Date().toISOString(), products });
};
