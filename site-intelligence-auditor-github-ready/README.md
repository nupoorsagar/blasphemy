# Site Intelligence Auditor

A general-purpose website auditing SaaS focused on actionable findings rather than a single SEO score.

## Product promise

**What is wrong with my website, why does it matter, and exactly what should I fix?**

The platform combines:

- deterministic crawl/HTML/link/metadata/technical checks
- browser-based performance and interaction checks via Playwright worker
- AI interpretation with the OpenAI Responses API
- evidence-first findings with severity + confidence
- an executive dashboard and deep-dive finding views

## Architecture

```text
Browser
  -> Next.js UI / API (Vercel)
      -> Crawl engine (HTTP + Cheerio)
      -> Finding engine (340-rule registry)
      -> OpenAI analysis (server-side)
      -> Audit store (in-memory MVP; optional Postgres seam)

Separate worker (Railway/Render/Fly/etc.)
  -> Playwright
  -> browser performance/mobile checks
  -> callback to /api/audits/:id/complete
```

Vercel should host the SaaS UI and short API requests. The worker handles long-running browser work.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Add `OPENAI_API_KEY` for AI summaries.
4. Install dependencies and browsers:

```bash
npm install
npx playwright install chromium
```

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000` and audit a public URL.

## Deploy to Vercel

Import the repository into Vercel and set `OPENAI_API_KEY`. The app does not expose the key to the browser.

For production, wire a Postgres database and deploy `worker/index.ts` as a long-lived job worker. The worker can send completed browser evidence to the callback endpoint.

## Audit model

Each finding stores:

- check ID
- severity
- confidence
- page/element
- evidence
- why it matters
- concrete fix
- optional selector/source excerpt

Multiple low-level checks can roll up into one user-facing issue later.

## Current rule coverage

The product includes the full expanded 340-check catalog discussed during planning. The HTTP audit executes the rules that can be evaluated without a real browser; browser-only rules are registered and can be populated by the Playwright worker.

### Worker

For a deeper browser audit, run:

```bash
npm run worker -- https://example.com 30 my-audit-id
```

The worker records mobile layout evidence and browser timing signals in `data/*.json`. Set `AUDIT_CALLBACK_BASE_URL` to an endpoint containing `{id}` to post the result back to a running app.
