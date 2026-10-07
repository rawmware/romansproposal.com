# romansproposal.com: cheap-finds store

A phone-first store built for Instagram traffic. Products load automatically
from **CJ Dropshipping's US warehouses**, customers pay through **your Stripe**,
and each paid order is **placed and paid at CJ automatically**. CJ then ships
it straight to the customer.

```
Instagram ad / link in bio
        │
        ▼
romansproposal.com ──► /api/products  (CJ catalog, auto-refreshed every ~6h)
        │
   Buy now / Checkout
        ▼
/api/checkout ──► re-checks live CJ price + shipping, refuses money-losing carts
        │
        ▼
Stripe Checkout (card, Apple Pay, Google Pay) ──► money to your Stripe balance
        │  webhook
        ▼
/api/stripe-webhook ──► creates + pays the CJ order from your CJ wallet
        │                  ├─ item gone at CJ?  → customer auto-refunded
        │                  └─ CJ wallet empty?  → you get an alert to top up
        ▼
CJ ships from a US warehouse (3–8 business days) ──► /track.html shows tracking
```

---

## One-time setup (about 30 minutes)

Only you can do these steps: they need your logins and your money.

### 1. CJ Dropshipping (supplier)
1. Sign up free at <https://cjdropshipping.com>.
2. **Apps → Install App**. Under *Others*, install **API**.
3. Go to <https://www.cjdropshipping.com/my.html#/authorize/API> → **Add API** → Type **API Key** → Confirm → copy the key.
4. **Wallet → Recharge**: add **$50–100**. Each sale pays CJ for the product and shipping from this balance.

### 2. Stripe (payments)
1. **Developers → API keys**: copy the **Secret key** (`sk_live_…`).
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://www.romansproposal.com/api/stripe-webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the **Signing secret** (`whsec_…`).
3. **Settings → Customer emails**: turn on receipts for **successful payments**.
4. **Settings → Business → Public details**: set the support email and a statement descriptor customers will recognise (e.g. `ROMANSPROPOSAL`). This cuts down on "I don't recognise this charge" disputes.

### 3. Vercel (hosting)
**Project → Settings → Environment Variables** (Production), then **Redeploy**:

| Name | Value |
|---|---|
| `CJ_API_KEY` | key from step 1 |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `SITE_URL` | `https://www.romansproposal.com` |
| `ALERT_WEBHOOK_URL` | *(optional, recommended)* a Discord or Slack webhook URL. You get a phone notification if the CJ wallet runs low or an order was auto-refunded |

> Vercel's free *Hobby* plan is for non-commercial sites only. A store needs **Vercel Pro** ($20/mo).

### 4. Go live
1. Merge this branch into `main`. Vercel deploys it automatically.
2. **Place one real order yourself** for the cheapest item. That's the only true end-to-end test of your Stripe and CJ accounts. Check that it shows in Stripe → Payments and in My CJ → Orders, then use `/track.html`.
3. Start posting and running ads.

---

## Running ads and posts
- Every product has a 4-character **item code** (e.g. `#K7Q2`). Say "item K7Q2, link in bio". Viewers type it into the box at the top of the site.
- To send an ad straight to one product, open it on the site and tap **Copy link to this item** (`https://www.romansproposal.com/?p=<id>`).
- **Meta Pixel** (lets Instagram optimise ads for purchases): put your Pixel ID in `store-config.js`. Purchases, add-to-carts and checkouts are tracked automatically.

## What still needs a human
- **Top up the CJ wallet** when you get a low-balance alert. Orders wait (they aren't lost) until it's paid.
- **Customer emails** (`roman.proposal@gmail.com`): mostly "where's my order?" Point people to `/track.html`. For damaged or missing items, refund from Stripe → Payments → Refund, then open a dispute in My CJ to recover your cost.
- **Chargebacks**: respond in Stripe with the tracking number. Ignoring them can get a Stripe account closed.

## Pricing and settings (optional Vercel env vars)
| Variable | Default | Meaning |
|---|---|---|
| `MARKUP` | `0.6` | 60% over supplier cost + shipping allowance, before Stripe's fee |
| `SHIPPING_ALLOWANCE_USD` | `5.5` | Shipping cost built into each item's price |
| `MIN_PROFIT_USD` | `3` | Checkout refuses carts that would earn less than this |
| `BUNDLE_DISCOUNT` | `0.15` | Discount when the bag has 2+ items |
| `MIN_COST_USD` / `MAX_COST_USD` | `1` / `12` | Supplier price range to list |
| `PER_COLLECTION` | `14` | Items per category (10 categories, ~100+ items) |
| `SUPPORT_EMAIL` | `roman.proposal@gmail.com` | Shown to customers |
| `STRIPE_AUTOMATIC_TAX` | off | `true` to collect sales tax via Stripe Tax (set it up in Stripe first) |

Categories, search keywords and the blocked-word list (brands, weapons,
kids' items, etc.) live in `api/_lib/config.js`.

## Files
- `index.html`, `app.js`, `styles.css`: the storefront (no build step)
- `thanks.html`, `track.html`, `policies.html`: confirmation, tracking, and policies (shipping, returns, privacy, terms, contact)
- `api/*.js`: Vercel functions: `products`, `product`, `checkout`, `stripe-webhook`, `order`
- `api/_lib/`: CJ and Stripe clients, pricing, catalog, fulfilment
- `test/store.test.js`: end-to-end tests with CJ and Stripe mocked (`npm test`)
