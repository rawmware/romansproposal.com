// GET /api/product?id=<CJ product id> -> one product with its variants.
import { loadProduct, publicProduct } from "./_lib/catalog.js";
import { isConfigured } from "./_lib/config.js";
import { json } from "./_lib/http.js";

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[A-Za-z0-9-]{6,64}$/.test(id)) return json({ error: "Unknown product" }, { status: 400 });
  if (!isConfigured().cj) return json({ error: "Store is opening soon" }, { status: 503 });
  try {
    const product = await loadProduct(id);
    if (!product) return json({ error: "This deal sold out." }, { status: 404, cache: "public, s-maxage=600" });
    return json(publicProduct(product), { cache: "public, s-maxage=3600, stale-while-revalidate=21600" });
  } catch (err) {
    console.error("Product failed:", id, err);
    if (err.code === 1602001 || err.code === 1602002) {
      return json({ error: "This deal sold out." }, { status: 404, cache: "public, s-maxage=600" });
    }
    return json({ error: "Couldn't load this item. Try again in a moment." }, { status: 503 });
  }
}
