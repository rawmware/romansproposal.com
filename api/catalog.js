// GET /api/catalog: every product on the site, cheapest first (no supplier details).
const { getProducts, publicFields } = require("./_catalog");

module.exports = async (req, res) => {
  const products = (await getProducts()).map(publicFields);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=86400");
  res.status(200).json({ updatedAt: new Date().toISOString(), products });
};
