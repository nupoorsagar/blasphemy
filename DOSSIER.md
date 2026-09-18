# Blasphemy Site Dossier

The Site Dossier is the normalized evidence layer between crawling/browser collection and AI website analysis.

## Principles

- Facts and measurements are stored here; recommendations are generated later.
- Observation, inference and recommendation remain separate.
- Page content is split into meaningful zones so navigation/footer boilerplate is not mistaken for primary content.
- Cross-page relationships are stored explicitly so an analyst can reason about service clusters, near-duplicates, page types, conversion paths and site-wide patterns.
- Every important extracted fact can point back to an evidence record.
- Missing/failed measurements are represented as status, never silently treated as good.

## Build

```ts
import { buildSiteDossier } from '@/lib/dossier';

const dossier = buildSiteDossier({
  auditId,
  url,
  pages,
  robots,
  sitemapUrls,
  discovered,
  findings,
  browserEvidence,
  maxPages,
});
```

The API and CLI worker now attach the resulting dossier to the audit object/result.

## Main sections

### `context`
User-provided and inferred business context, markets and audiences.

### `site`
Organization identity, domains, geography, social profiles and detected technologies.

### `crawl`
Page inventory, page classifications, errors, redirects and non-HTML assets.

### `architecture`
Navigation, page types, templates, clusters, internal-link graph, orphan pages, depth and route relationships.

### `content`
Main proposition, services, audiences, topics, entities, claims, terminology, near-duplicates and differentiation clusters.

### `audience`
Page intent, audience signals, search intent and journey-stage hypotheses.

### `conversion`
CTA inventory, forms, trust signals, conversion journeys and dead ends.

### `seo`
Metadata, canonical, indexability assumptions, sitemap/robots and structured-data evidence.

### `performance`
Lab/field status and Core Web Vitals measurements when browser evidence is available.

### `accessibility`
Landmark, image-alt, nameless-link and heading-structure observations.

### `security`
Origin-level response headers, insecure resources and legal-page candidates.

### `analytics`
Valid-looking GA4, UA and GTM identifiers and coverage.

### `derived.facts`
Evidence-backed cross-page facts such as large service clusters, high-similarity page pairs and orphan-page patterns. These are still not customer-facing recommendations.

### `evidence.items`
The provenance ledger used to trace dossier facts back to crawler/browser/user/integration evidence.

## Intended next stage

The next layer should consume the dossier through a multi-pass Analyst → Judge → Editor pipeline. The dossier itself should remain recommendation-free.
