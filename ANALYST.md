# Blasphemy Analyst, Judge & Evaluation Framework

## Pipeline

`SiteDossier -> Analyst passes -> candidate insights -> Judge -> selected insights -> Report Editor`

The Analyst is deliberately multi-pass. The first passes build understanding; later passes identify problems and opportunities; the final synthesis removes overlap.

## Passes

1. `business_understanding` — understand what the organization sells, who it serves, markets, positioning, proof and claims.
2. `site_architecture` — understand navigation, page types, clusters, routes, dead ends and cross-domain journeys.
3. `seo_search` — assess topic clarity, intent, metadata relationships, indexability, duplication, regional signals and content gaps.
4. `marketing_content` — assess proposition, differentiation, proof, claims, audience relevance, terminology and content strategy.
5. `ux_conversion` — assess CTAs, forms, trust, buyer journeys and browser-backed friction.
6. `technical_performance` — interpret measured browser/HTTP/performance evidence and diagnose root causes.
7. `cross_page_synthesis` — select and combine the strongest cross-page/site-level insights.

## Analyst contract

Every candidate requires:

- title
- type
- areas
- severity
- priority
- confidence
- scope
- what
- why it matters
- fix
- owner
- affected page IDs
- evidence references
- optional expected outcome and verification

The Analyst may infer, but must label inference with appropriate confidence and cite evidence.

## Judge contract

The Judge scores each candidate 0–5 on:

- truthfulness
- evidence quality
- specificity
- business relevance
- actionability
- priority fit
- audience fit
- novelty

The Judge can `keep`, `rewrite`, `merge`, or `drop`.

### Drop examples

- generic best-practice advice
- fixed-threshold nitpicks without meaningful impact
- claims of rankings/revenue/legal violations without evidence
- duplicate versions of the same underlying finding
- performance conclusions when browser measurement failed

## Evaluation

Maintain a Gold Set of websites with manually curated high-value insights. A Gold Insight has an ID, description, keywords, expected evidence patterns and importance.

Track:

- precision@K
- recall@K
- must-find recall
- evidence accuracy
- actionability
- false-positive rate
- redundancy rate
- composite quality score

Use the Gold Set for every model, prompt and judge change. Do not optimize only for raw insight count.

## Model-provider adapter

`lib/analyst/orchestrator.ts` exposes a provider-neutral `StructuredModelAdapter`. The app can pass an OpenAI, Anthropic, or future proprietary adapter without changing dossier or evaluation code.

The orchestrator runs passes in this order:

`business_understanding -> site_architecture -> seo_search -> marketing_content -> ux_conversion -> technical_performance -> cross_page_synthesis`

Each later pass receives prior-pass outputs. The final synthesis pass receives the complete accumulated candidate set through the dossier + prior-pass context.

## Judge thresholds

The Judge is a quality gate, not a second idea generator. A practical initial policy is:

- `keep` when the candidate is evidence-backed, specific and materially useful.
- `rewrite` when the core finding is valuable but the wording/recommendation/priority needs correction.
- `merge` when the underlying problem duplicates another candidate.
- `drop` when evidence is weak, the impact is trivial, the claim is generic, or the conclusion overreaches.

The deterministic evaluation harness should be treated as a product regression test, not as a substitute for human review.
