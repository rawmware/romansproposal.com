// Store settings. Everything money-related can be overridden with Vercel
// environment variables so you never have to touch code to change pricing.

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== "" && value != null ? n : fallback;
};

const env = process.env;

export const STORE = {
  name: "Roman's Proposal",
  supportEmail: env.SUPPORT_EMAIL || "roman.proposal@gmail.com",

  // Price = (supplier cost + shipping allowance) marked up, then Stripe's fee
  // added on top and rounded up to .99. MARKUP=0.6 means 60% over landed cost.
  markup: num(env.MARKUP, 0.6),
  shippingAllowanceUsd: num(env.SHIPPING_ALLOWANCE_USD, 5.5),
  // Checkout refuses any order that would earn less than this after the
  // supplier, real shipping, and Stripe are paid. Protects you from losses.
  minProfitUsd: num(env.MIN_PROFIT_USD, 3),

  // A real discount, applied server-side: 2+ items in the bag = 15% off.
  bundleMinQty: 2,
  bundleDiscount: num(env.BUNDLE_DISCOUNT, 0.15),

  // Only list items whose supplier cost is in this range (USD).
  minCostUsd: num(env.MIN_COST_USD, 1),
  maxCostUsd: num(env.MAX_COST_USD, 12),
  perCollection: num(env.PER_COLLECTION, 14),

  // Items ship from CJ's US warehouses only: fast delivery, fewer complaints.
  shipFrom: "US",
  shipTo: ["US"],
  deliveryEstimate: { min: 3, max: 8 },

  stripeFeePercent: 0.029,
  stripeFeeFixedCents: 30
};

// What the store sells. Each collection becomes a CJ search; results are
// merged, filtered, priced, and cached for a few hours.
export const COLLECTIONS = [
  { key: "kitchen", label: "Kitchen", keyword: "kitchen gadget" },
  { key: "home", label: "Home", keyword: "storage organizer" },
  { key: "lights", label: "Lights", keyword: "LED light" },
  { key: "phone", label: "Phone", keyword: "phone holder" },
  { key: "car", label: "Car", keyword: "car accessories" },
  { key: "pets", label: "Pets", keyword: "pet toy" },
  { key: "jewelry", label: "Jewelry", keyword: "jewelry" },
  { key: "hair", label: "Hair", keyword: "hair clip" },
  { key: "fitness", label: "Fitness", keyword: "fitness" },
  { key: "cleaning", label: "Cleaning", keyword: "cleaning brush" }
];

// Never list these: brand names (counterfeit risk), items Meta ads / Stripe
// restrict, and kids' products (extra US safety rules).
export const BLOCKED_TITLE = new RegExp(
  "\\b(" +
    [
      "knife", "knives", "blade", "dagger", "gun", "pistol", "rifle", "weapon",
      "tactical", "ammo", "pepper spray", "taser", "stun", "brass knuckle",
      "vape", "e-?cig", "cigarette", "hookah", "cbd", "thc", "kratom",
      "sex", "sexy", "adult", "erotic", "lingerie", "dildo", "vibrator",
      "baby", "babies", "infant", "toddler", "newborn", "kid", "kids", "child", "children",
      "medical", "supplement", "capsule", "pill", "drug", "injection", "syringe",
      "lighter", "drone", "replica", "lithium",
      "nike", "adidas", "apple", "iphone", "airpods?", "samsung", "disney", "marvel",
      "pokemon", "hello kitty", "gucci", "louis vuitton", "chanel", "rolex", "lv",
      "stanley", "yeti", "barbie", "lego", "nfl", "nba"
    ].join("|") +
    ")\\b",
  "i"
);

export const isConfigured = () => ({
  cj: Boolean(env.CJ_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  webhook: Boolean(env.STRIPE_WEBHOOK_SECRET)
});
