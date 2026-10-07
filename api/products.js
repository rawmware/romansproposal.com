// GET /api/products -> the whole store catalog (cached at Vercel's edge).
import { buildCatalog } from "./_lib/catalog.js";
import { COLLECTIONS, STORE, isConfigured } from "./_lib/config.js";
import { json } from "./_lib/http.js";

const storeInfo = () => ({
  collections: COLLECTIONS.map(({ key, label }) => ({ key, label })),
  bundle: { minQty: STORE.bundleMinQty, percentOff: Math.round(STORE.bundleDiscount * 100) },
  delivery: STORE.deliveryEstimate,
  checkoutReady: isConfigured().cj && isConfigured().stripe
});

export async function GET() {
  if (!isConfigured().cj) {
    return json({ ready: false, products: [], ...storeInfo() }, { cache: "public, s-maxage=60" });
  }
  try {
    const { products, errors } = await buildCatalog();
    if (errors.length) console.error("Catalog partial errors:", errors);
    if (products.length === 0) {
      return json({ ready: false, products: [], ...storeInfo() }, { status: 503, cache: "no-store" });
    }
    return json(
      { ready: true, updatedAt: new Date().toISOString(), products, ...storeInfo() },
      { cache: "public, s-maxage=21600, stale-while-revalidate=86400" }
    );
  } catch (err) {
    console.error("Catalog failed:", err);
    return json({ ready: false, products: [], ...storeInfo() }, { status: 503, cache: "no-store" });
  }
}
