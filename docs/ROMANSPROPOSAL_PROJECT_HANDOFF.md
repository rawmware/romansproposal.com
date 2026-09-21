# RomansProposal.com — Project Handoff

**Owner:** Roman / RawmWare  
**Primary domain:** romansproposal.com  
**GitHub repository:** rawmware/romansproposal.com  
**Date:** 2026-09-13  
**Status:** Planning and repository setup

## Purpose

RomansProposal.com is a personal, one-page web experience that will serve as Roman’s proposal for a mentorship with Cayden.

This is not meant to be a generic portfolio template or a disposable landing page. It should demonstrate Roman’s curiosity, technical growth, creativity, persistence, and ability to turn an idea into a real product.

The primary audience is Cayden. The site should communicate:

> This is what I want to learn, this is what I have already tried, this is how seriously I take it, and this is why I would value your mentorship.

Roman is willing to spend money on the domain because the project has personal value. The site should make that effort visible: intentional, polished, technically thoughtful, and personal.

## Human goal

The site should communicate Roman’s request for formal or informal mentorship. The intended relationship may include:

- Showing Cayden the projects and experiments Roman has already worked on.
- Meeting approximately once a week, based on Cayden’s availability.
- Taking notes after each meeting, researching independently, trying concepts on his own, and returning prepared.
- Asking questions without expecting Cayden to remove the technical depth.
- Continuing to learn terminology and concepts independently so Cayden does not have to simplify everything.
- Learning how real applications are designed, built, secured, maintained, and used within a company.

Roman is not taking his current IT work for granted. He wants to grow from supporting technology into understanding how software and applications are created.

## Product brief

The first release should be a focused, responsive, single-page proposal containing:

1. A strong opening that establishes Roman’s intention.
2. Why he is asking Cayden specifically.
3. The mentorship vision and expected working rhythm.
4. Roman’s commitment to learning between meetings.
5. The roadmap of what he wants to learn and build.
6. A memorable closing request.
7. A compact menu button for navigation and project links.

The experience should feel like a small interactive product rather than a long document pasted into a browser.

## Navigation and connectivity

The page should have a clear menu button, likely in a minimal header.

The menu should contain:

- Home / Proposal.
- GitHub: https://github.com/rawmware/romansproposal.com
- RawmWare: https://rawmware.com
- Proposal Guide: the deterministic helper described below, if included in version one.

The menu must be mobile friendly, keyboard accessible, closable with Escape, and usable without JavaScript wherever practical.

## Technical direction

Use modern technology, but keep the final product light, fast, and understandable.

Recommended foundation:

- React with TypeScript.
- Vite or another lightweight modern build tool appropriate for a static Vercel deployment.
- Semantic HTML and accessible component structure.
- Modern CSS with design tokens, responsive layouts, and progressive enhancement.
- CSS animations and browser APIs before adding large animation libraries.
- Current stable dependency versions at implementation time, with a committed lockfile.
- Static-first architecture: no database, authentication, server, or external runtime service unless a later feature genuinely requires it.
- GitHub as the source of truth and Vercel as the deployment platform.

“State of the art” should mean thoughtful architecture, excellent interaction design, accessibility, performance, and clean code—not adding dependencies simply because they are popular.

Possible enhancements include feature-detected View Transitions, reduced-motion support, responsive typography, lazy-loaded nonessential assets, metadata for link previews, and basic performance checks. Every enhancement needs a graceful fallback.

## The bot / interactive guide

The site should contain a small interactive helper, but it does not need to be an AI model or an API-powered chatbot.

The preferred first version is a deterministic Proposal Guide built entirely in the browser. It can use:

- A local set of intents and responses stored in TypeScript or JSON.
- A small rules-based matcher for words, buttons, or selected topics.
- Suggested prompts such as “Why Cayden?”, “What do you want to learn?”, “What would the meetings look like?”, and “What have you already built?”
- Responses that reveal or scroll to the relevant proposal section.
- A clear label explaining that it is a lightweight project guide, not a cloud AI model.

The first version must not require:

- An external API.
- An API key or secret.
- A downloaded local language model.
- A model-loading screen.
- User accounts or stored personal conversations.
- Any background request that could create unexpected cost or security-review concerns.

This keeps the experience instant, predictable, private, and deployable as a static site. A model or API can be considered later only as an optional, clearly separated experiment.

The helper should support the proposal rather than overpower it. The main message must remain readable without interacting with the bot.

## Visual and emotional direction

The visual language should be personal, modern, minimal, and premium without feeling corporate or over-designed.

Desired qualities:

- Clear hierarchy and generous spacing.
- Strong opening statement.
- High-quality typography.
- A restrained color palette with one intentional accent.
- Subtle motion that rewards interaction without slowing the page down.
- A menu that feels like part of the product.
- A phone-first layout that still looks excellent on desktop.
- A balance between vulnerability, ambition, and technical confidence.

Do not make it look like a résumé, a generic SaaS homepage, or a tutorial template. It should feel like Roman made something specifically for this moment.

## Content principles

Use the existing proposal and roadmap documents as the content source of truth. Preserve the emotional honesty and personal voice while editing for web readability.

The writing should be:

- Direct and human.
- Ambitious without pretending Roman already knows everything.
- Specific about the mentorship request.
- Honest about the gap between Roman’s current experience and where he wants to go.
- Focused on action, consistency, and willingness to learn.

Do not replace the raw emotional core with generic motivational language.

## Confirmed project connections

These checks were performed on 2026-09-13.

### GitHub

- The public repository exists at https://github.com/rawmware/romansproposal.com.
- The default branch is main.
- Before this handoff was added, the repository contained only README.md, so it was ready for the initial application scaffold.

### Vercel

- The connected Vercel account exposes the team rawmware’s projects.
- The team is on the Hobby plan.
- A live project named for RomansProposal was not returned by the current Vercel project listing.
- The next AI must not assume that a Vercel project or production deployment already exists. It needs to create or import the Vercel project, connect it to rawmware/romansproposal.com, and configure the custom domain.

### Domain and DNS

- Roman reports that romansproposal.com is registered and its DNS is managed through Squarespace.
- The intended hosting path is Squarespace DNS → Vercel hosting → GitHub-connected project.
- The actual Vercel project/domain association still needs to be verified after the Vercel project is created or imported.

## Deployment plan

1. Scaffold the React/TypeScript application in rawmware/romansproposal.com.
2. Build and test the proposal page locally.
3. Add the deterministic Proposal Guide.
4. Add metadata, accessibility behavior, responsive styling, and a production build check.
5. Connect the GitHub repository to a Vercel project under Roman’s account.
6. Configure romansproposal.com as the production domain in Vercel.
7. Confirm the required Squarespace DNS records match Vercel’s instructions.
8. Create a preview deployment and test it on iPhone and desktop.
9. Promote the verified build to production.
10. Confirm the production domain, GitHub link, RawmWare link, menu, proposal content, and deterministic guide all work.

## Rules for the next AI

- Keep the first release static and lightweight.
- Do not add an external AI API or local model unless Roman explicitly requests it later.
- Do not add API keys, secrets, analytics trackers, or hidden network calls.
- Do not use GPT, OpenAI, or unrelated provider branding in the site.
- Do not modify rawmware.com; link to it only.
- Do not let the interactive helper replace the proposal itself.
- Do not claim production is live until the Vercel deployment and custom domain have been verified.
- Use preview deployments and visual checks before changing production.
- Keep the code organized enough that Roman can study it and explain the decisions to Cayden.
- Favor clear, maintainable code over clever code.

## Definition of done for version one

Version one is complete when:

- romansproposal.com loads over HTTPS from Vercel.
- The page is a polished one-page mentorship proposal.
- The menu works on mobile and desktop.
- The GitHub and RawmWare links work.
- The deterministic Proposal Guide works without an API, model, login, or network dependency.
- The page is responsive, keyboard accessible, and usable with reduced motion enabled.
- The repository contains the complete source code and a clear README.
- The build passes without production-affecting warnings.
- The site feels like a real demonstration of Roman’s capability, not merely a document placed online.

## North-star statement

RomansProposal.com is a small project with a serious purpose: use a thoughtfully engineered web experience to show Cayden that Roman is ready to learn, ready to work, and willing to build his way toward software engineering.
