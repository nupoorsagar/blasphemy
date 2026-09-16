# Rule engine contract

Every rule has a stable ID, category, severity and execution type.

```ts
{
  id: 'LINK-001',
  name: 'Broken internal links',
  category: 'Links',
  severity: 'high',
  type: 'deterministic',
  implemented: true
}
```

## Evidence contract

A finding should be reproducible from its evidence:

- page URL
- target URL or element when applicable
- status/measurement
- selector/source excerpt when useful
- viewport/device for browser findings
- confidence

## Execution types

`deterministic` should be used for things the crawler can prove: status codes, link targets, metadata, HTML structure, response headers and simple source patterns.

`browser` should be used for runtime behavior: Core Web Vitals, layout overflow, focus behavior, mobile navigation, forms and screenshots.

`ai` should be used for semantic interpretation: intent, value proposition, audience clarity, content gaps, contradictions, differentiation and buyer-objection handling.

The system should never let AI overwrite deterministic evidence. AI enriches the report; it does not become the source of truth for HTTP/HTML facts.
