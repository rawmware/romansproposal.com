# romansproposal.com — Roman's Proposal

**Live:** https://romansproposal.com · **Deploys:** Vercel (auto-deploys from `main`)

A clean, professional marketing site for Roman's software & AI services business —
websites, AI assistants, and automations for real estate teams, law firms, and local
businesses. The centerpiece is an interactive **proposal builder**: visitors answer
three questions and get an instant itemized estimate, then send it as a pre-filled
email inquiry.

## Stack

Plain HTML + CSS + vanilla JS. No build step, no dependencies, no trackers, no
cookies. Vercel serves it as a static site.

## Files

- `index.html` — all content and structure
- `styles.css` — design system (ink + gold, Fraunces/Inter/JetBrains Mono)
- `app.js` — nav, scroll reveals, hero terminal, proposal builder, contact form
- `docs/ROMANSPROPOSAL_PROJECT_HANDOFF.md` — archived earlier project direction (mentorship proposal, Sep 2026)

## Editing prices & contact info

Everything business-critical lives in one `CONFIG` object at the top of `app.js`:

```js
var CONFIG = {
  contactEmail: "hello@romansproposal.com", // <-- change to the real inbox
  prices: { website: { label: "New website", from: 1200 }, ... },
  ...
};
```

Change the numbers there and both the proposal builder and the mailto inquiry update.

## Deploy

Push to `main` — the connected Vercel project redeploys automatically.
