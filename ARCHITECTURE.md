# Architecture & production path

## MVP

- Next.js App Router serves the marketing page, audit form, and report dashboard.
- `/api/audits` validates a URL, crawls same-origin pages, executes deterministic checks, and optionally asks OpenAI for cross-page interpretation.
- `lib/engine/catalog.ts` is the stable check registry. Rule code should reference IDs, never display names as identifiers.
- `lib/engine/crawl.ts` is the HTTP crawler. It intentionally keeps browser work out of the request path.
- `worker/index.ts` is the Playwright worker for mobile layout and browser timing evidence.
- `lib/store.ts` is an in-memory repository for the starter deployment. Replace it with Postgres in production.

## Production evolution

1. Replace `lib/store.ts` with a Postgres-backed repository implementing the same `createAudit/getAudit/updateAudit` contract.
2. Add a durable job queue between the API and worker; do not run full crawls inside a serverless request.
3. Add authentication/organizations/projects and usage metering.
4. Store screenshots and crawl artifacts in object storage.
5. Add scheduled re-audits and historical comparison.
6. Add competitor comparison only after deterministic page/topic extraction is reliable.

## Security

- Keep `OPENAI_API_KEY` server-side only.
- Never accept an API key from the browser.
- Treat crawled HTML as untrusted input.
- Cap pages, concurrency, response size and request timeouts.
- Do not crawl non-public/private network addresses in production without an explicit allowlist/safety layer.
- Escape/render source evidence safely; never inject crawled HTML into the dashboard.
