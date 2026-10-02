# SEO and traffic launch plan

Prepared October 2, 2026. These edits are local until deployed.

## Findings

- The live apex redirects to https://www.romansproposal.com/; use that host consistently.
- Live robots.txt and sitemap.xml returned HTTP 404 during the audit.
- Homepage lacked a canonical and organization/site structured data.
- Contact JavaScript overwrote the displayed Gmail address with a placeholder inbox.
- Content marked reveal was hidden without JavaScript. It is now visible by default.
- Existing local changes include an application catalog. Preserve and review those separately when publishing.
- The connected Vercel team returned no projects, so production deployment was not established.

## Publish and verify

1. Identify the Vercel account/project serving www.romansproposal.com and deploy a preview of this website directory.
2. Check homepage and guide on desktop and mobile, proposal builder, email recipients, and existing application catalog.
3. Publish the verified deployment. Confirm both canonical pages, robots.txt, and sitemap.xml return 200, and unknown paths return 404.
4. In a verified Google Search Console domain property, submit https://www.romansproposal.com/sitemap.xml. Inspect both URLs and request indexing if eligible. Verification requires the owner's account or DNS access; do not invent a verification token.

## First 30 days

- Record Search Console baseline clicks, impressions, search queries, indexed pages, and inquiry count. Review weekly. No analytics tracker was added.
- Share the planning guide from Roman's existing business profiles, explaining one concrete workflow it helps plan. Draft: "Not sure what to automate first? I wrote a checklist for choosing between lead follow-up, booking, intake, and an AI assistant, including failure handling and a simple time-savings calculation: https://www.romansproposal.com/automation-planning-guide.html" No posts or messages have been sent.
- Add this site to owned portfolio/profile links where relevant. No other website was changed.
- Publish one real project walkthrough with permission: original problem, screenshots, workflow, limitations, and measured results. Avoid invented testimonials or savings.
- Use actual Search Console queries and client questions to choose the next service guide. Focus on useful answers, not near-duplicate city or industry pages.
- If the business qualifies for a Google Business Profile, set it up using the actual service area and business details. Confirm eligibility first; no location has been assumed.

## Measurement

Track qualified inquiries and booked conversations alongside search clicks. Establish a baseline before setting numeric growth targets. Indexing and ranking are not guaranteed, and no traffic increase has yet been measured.

References: https://developers.google.com/search/docs/fundamentals/creating-helpful-content and https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
