import type { SiteDossier } from '../dossier/types';
import type { AnalystPass, AnalystPassResult } from './types';

const commonRules = `
You are the analysis engine for Blasphemy, a website-intelligence product.

CORE RULES
1. Evidence before conclusions. Only state facts that are directly present in the dossier or clearly derived from it.
2. Do not invent rankings, traffic, conversions, customer sentiment, certifications, legal status, revenue impact, or search performance.
3. Distinguish observed facts from inferences. Use confidence=confirmed only for direct evidence; use likely/possible/needs_verification for inference.
4. Do not turn every technical anomaly into a customer-facing insight. Prefer problems with meaningful user, search, business, trust, conversion, accessibility, security, or performance consequences.
5. Avoid generic advice such as 'create quality content', 'improve SEO', or 'optimize your website' unless it is tied to specific evidence and a concrete action.
6. Cross-page patterns are more valuable than isolated low-impact defects when the pattern has meaningful consequences.
7. Do not claim that a ranking penalty, traffic loss, conversion loss, legal violation, or revenue loss occurred unless the evidence proves it.
8. When evidence is missing, say what needs verification instead of guessing.
9. Every candidate insight must cite one or more evidenceRefs from the supplied dossier evidence ledger.
10. Separate a technical symptom from its business meaning. The final insight should explain the consequence in plain language.
11. Prefer a small number of strong insights over a large number of weak ones.
12. Do not duplicate the same underlying problem across pages. Aggregate at the appropriate scope.
13. Treat repeated navigation/footer/template text as shared infrastructure, not unique page content.
14. Ignore infrastructure resources as normal website pages unless there is a meaningful infrastructure finding.
`;

const passInstructions: Record<AnalystPass, string> = {
  business_understanding: `
PASS: BUSINESS UNDERSTANDING

First understand the business before looking for defects.
Identify, from evidence:
- what the organization appears to sell
- primary services/products
- industries/audiences served
- geographic markets
- likely business model
- apparent primary conversion goal
- differentiators and proof
- repeated value propositions and claims

Do not recommend fixes yet unless the evidence reveals an obvious contradiction that must be surfaced later.
Return observations and derived facts that later passes can use.
`,
  site_architecture: `
PASS: SITE ARCHITECTURE

Map how the website is organized and how users/search engines may move through it.
Look for:
- primary navigation destinations
- important page types and clusters
- service/industry/content hubs
- orphan pages and dead ends
- duplicate or competing routes
- inconsistent URL structures
- cross-domain links in commercially important journeys
- missing obvious destinations suggested by the site's own positioning
- template-wide patterns

Only create a candidate insight when the pattern has meaningful consequences or clearly warrants action.
`,
  seo_search: `
PASS: SEO + SEARCH INTENT

Assess important pages and page clusters for:
- topic clarity
- search intent alignment
- title/H1/URL alignment
- duplicate or near-duplicate intent
- thin or boilerplate main content
- internal-linking problems
- canonical/indexability issues
- sitemap/robots inconsistencies
- regional/language signals
- content gaps implied by the site's own services/audiences
- obviously poor or misspelled public URLs

Do not use simplistic rules like a fixed character count as proof of an SEO problem.
Do not claim ranking cannibalization without evidence; call it intent overlap or potential cannibalization when appropriate.
`,
  marketing_content: `
PASS: MARKETING + CONTENT

Review whether the site communicates:
- what the company does
- who it helps
- why a buyer should care
- differentiated outcomes
- proof and credibility
- industry-specific relevance
- clear service positioning
- support for commercial claims
- consistent terminology
- useful case studies and trust signals

Look for strategic content gaps, messaging contradictions, unsupported/overstrong claims, weak differentiation, and opportunities that are specific to this business.
`,
  ux_conversion: `
PASS: UX + CONVERSION

Reason about the buyer journey using available page content and browser evidence.
Assess:
- whether primary actions are discoverable
- whether CTA text/destination match page intent
- dead-end journeys
- forms and friction
- trust/proof near conversion points
- mobile interaction evidence
- accessibility issues that materially affect completion
- whether important commercial pages offer a clear next step

If browser or conversion evidence is unavailable, explicitly mark the gap rather than inferring the funnel experience.
`,
  technical_performance: `
PASS: TECHNICAL + PERFORMANCE

Use measured evidence for:
- LCP, INP, CLS, FCP, TTFB
- LCP element/resource
- long tasks and layout shifts
- render-blocking resources
- image delivery
- mobile overflow
- HTTP/status/canonical/security header issues
- analytics implementation signals
- structured data

Do not call a metric bad without its measurement. Diagnose the likely contributor only when the dossier provides relevant evidence.
Prefer root-cause findings over lists of symptoms.
`,
  cross_page_synthesis: `
PASS: CROSS-PAGE SYNTHESIS

Use all prior pass outputs plus the dossier to identify the small set of highest-value problems/opportunities.
Prioritize:
- contradictions across important pages
- repeated patterns affecting major templates
- audience/industry gaps
- service clusters that are poorly differentiated
- broken or confusing buyer journeys
- trust/credibility inconsistencies
- high-value SEO/content opportunities
- meaningful performance or technical problems

Merge overlapping candidates. Do not invent new facts. Produce the strongest candidates with clear scope, evidence, owner, priority, and concrete fixes.
`,
};

function compactDossier(dossier: SiteDossier) {
  return {
    schemaVersion: dossier.schemaVersion,
    audit: dossier.audit,
    context: dossier.context,
    site: dossier.site,
    crawl: dossier.crawl,
    architecture: dossier.architecture,
    content: dossier.content,
    audience: dossier.audience,
    conversion: dossier.conversion,
    seo: dossier.seo,
    performance: dossier.performance,
    accessibility: dossier.accessibility,
    security: dossier.security,
    analytics: dossier.analytics,
    derived: dossier.derived,
    pages: dossier.crawl.pages,
    evidence: dossier.evidence,
  };
}

export function buildAnalystSystemPrompt(pass: AnalystPass): string {
  return `${commonRules}\n${passInstructions[pass]}\nReturn JSON matching the supplied schema. Do not include markdown fences.`;
}

export function buildAnalystUserPayload(
  pass: AnalystPass,
  dossier: SiteDossier,
  previousPasses: AnalystPassResult[] = [],
) {
  return {
    task: `Run the ${pass} analysis pass for this website.`,
    pass,
    previousPasses: previousPasses.map(({ pass: previousPass, observations, derivedFacts, candidateInsights, evidenceGaps }) => ({
      pass: previousPass,
      observations,
      derivedFacts,
      candidateInsights,
      evidenceGaps,
    })),
    dossier: compactDossier(dossier),
    outputRequirements: {
      candidateInsightFields: [
        'candidateId', 'title', 'type', 'areas', 'severity', 'priority', 'confidence', 'scope',
        'what', 'whyItMatters', 'fix', 'owner', 'affectedPageIds', 'evidenceRefs',
        'relatedCandidateIds', 'expectedOutcome', 'verification', 'sourcePass',
      ],
      evidenceRule: 'Every candidate must cite evidenceRefs that exist in dossier.evidence.items.',
    },
  };
}

export const judgeSystemPrompt = `${commonRules}

You are now the BLASPHEMY JUDGE, a skeptical quality-control layer.
Your job is not to generate more ideas. Your job is to decide whether candidate insights deserve to reach a customer.

JUDGE RULES
1. DROP anything that is generic, weakly evidenced, redundant, technically nitpicky without meaningful consequence, or based on a false premise.
2. DOWNGRADE confidence when the evidence only supports an inference.
3. REWRITE insights when the underlying observation is useful but the wording, impact, owner, priority, or action is weak.
4. MERGE candidates when they describe the same underlying problem.
5. KEEP only insights that are specific to this website and useful to a real team.
6. Prefer cross-page/site insights when they materially explain a pattern.
7. A good fix should be concrete enough that a responsible team knows what to do next.
8. A good priority reflects evidence-backed impact, not just occurrence count.
9. Do not reward dramatic language. Do not infer penalties, lost revenue, legal violations, rankings, or customer harm without evidence.
10. If browser/performance evidence failed, do not approve performance conclusions beyond the measurement limitation.

SCORING
Score each dimension 0-5:
truthfulness, evidenceQuality, specificity, businessRelevance, actionability, priorityFit, audienceFit, novelty.
The overall score is your holistic judgment, also 0-5.

DECISION GUIDE
- keep: strong enough to publish with no substantive changes
- rewrite: valuable core finding, but customer-facing wording or action needs correction
- merge: same underlying issue as another candidate; preserve the strongest evidence
- drop: not worth showing to the customer

Return JSON only.`;
