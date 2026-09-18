# Blasphemy Multi-Pass Analyst — Integrated

This version connects the existing audit pipeline to the Site Dossier → 7 analyst passes → Judge → report synthesis flow.

## Runtime flow

`crawl → deterministic rules → browser evidence → Site Dossier → 7 analyst passes → Judge → executive synthesis → saved audit/report`

The deterministic rule engine remains in place. Its findings are evidence and baseline insights; the multi-pass layer is responsible for higher-level cross-page interpretation and customer-facing strategic insights.

## Analyst passes

1. Business understanding
2. Site architecture
3. SEO + search intent
4. Marketing + content
5. UX + conversion
6. Technical + performance
7. Cross-page synthesis

## Judge

Each candidate is evaluated on truthfulness, evidence quality, specificity, business relevance, actionability, priority fit, audience fit and novelty. The judge can `keep`, `rewrite`, `merge` or `drop` a candidate.

## Files added/changed

- `lib/analyst/openaiAdapter.ts` — OpenAI Responses adapter.
- `lib/ai.ts` — integrated orchestration and executive synthesis.
- `lib/types.ts` — persists dossier/analyst/judge output on an audit.
- `app/api/audits/route.ts` — builds/runs the integrated analysis during an audit.
- `worker/index.ts` — worker uses the same integrated pipeline.
- `app/api/audits/[id]/complete/route.ts` — callback preserves integrated output.

## Configuration

Existing `OPENAI_API_KEY` and `OPENAI_MODEL` continue to work.

Optional:

- `OPENAI_ANALYST_MODEL` — model used for the seven analyst passes and judge. Falls back to `OPENAI_MODEL`.
- `BLASPHEMY_ANALYST_VERSION` — analyst version label.
- `BLASPHEMY_JUDGE_VERSION` — judge version label.

Do not commit `.env.local` or API keys.

## Verification

TypeScript type-checking passes on the integrated source. Full Vitest/build execution was not completed in the Linux packaging environment because the uploaded `node_modules` contains Windows-specific/optional native packages; install dependencies normally on the target machine before running the full test suite.
