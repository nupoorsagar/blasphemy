/** JSON Schemas suitable for OpenAI structured outputs or other providers that accept JSON Schema. */

const candidateInsightProperties = () => ({
  candidateId: { type: 'string' },
  title: { type: 'string' },
  type: { type: 'string', enum: ['issue','opportunity','risk','verification'] },
  areas: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
  severity: { type: 'string', enum: ['critical','high','medium','low','info'] },
  priority: { type: 'string', enum: ['immediate','this_week','this_month','this_quarter','when_convenient'] },
  confidence: { type: 'string', enum: ['confirmed','likely','possible','needs_verification'] },
  scope: { type: 'string', enum: ['page','template','cluster','site','origin','component'] },
  what: { type: 'string' },
  whyItMatters: { type: 'string' },
  fix: { type: 'string' },
  owner: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
  affectedPageIds: { type: 'array', items: { type: 'string' }, maxItems: 1000 },
  evidenceRefs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
  relatedCandidateIds: { type: 'array', items: { type: 'string' }, maxItems: 50 },
  expectedOutcome: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  verification: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  sourcePass: { type: 'string', enum: ['business_understanding','site_architecture','seo_search','marketing_content','ux_conversion','technical_performance','cross_page_synthesis'] },
});

const candidateInsightRequired = ['candidateId','title','type','areas','severity','priority','confidence','scope','what','whyItMatters','fix','owner','affectedPageIds','evidenceRefs','relatedCandidateIds','expectedOutcome','verification','sourcePass'];

export const analystPassResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'string', enum: ['business_understanding', 'site_architecture', 'seo_search', 'marketing_content', 'ux_conversion', 'technical_performance', 'cross_page_synthesis'] },
    observations: { type: 'array', items: { type: 'string' }, maxItems: 80 },
    derivedFacts: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    candidateInsights: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: candidateInsightProperties(),
      required: candidateInsightRequired,
    }, maxItems: 40 },
    evidenceGaps: { type: 'array', items: { type: 'string' }, maxItems: 40 },
  },
  required: ['pass', 'observations', 'derivedFacts', 'candidateInsights', 'evidenceGaps'],
} as const;

export const judgeRunJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    judgeVersion: { type: 'string' },
    decisions: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        candidateId: { type: 'string' },
        verdict: { type: 'string', enum: ['keep', 'rewrite', 'merge', 'drop'] },
        scores: {
          type: 'object', additionalProperties: false,
          properties: Object.fromEntries([
            'truthfulness','evidenceQuality','specificity','businessRelevance','actionability','priorityFit','audienceFit','novelty','overall'
          ].map(k => [k, { type: 'integer', minimum: 0, maximum: 5 }])),
          required: ['truthfulness','evidenceQuality','specificity','businessRelevance','actionability','priorityFit','audienceFit','novelty','overall'],
        },
        evidenceAssessment: { type: 'string', enum: ['sufficient', 'partial', 'insufficient', 'contradicted'] },
        strengths: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        problems: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        requiredChanges: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        mergeWithCandidateIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
        rewrittenCandidate: { anyOf: [{ type: 'object', additionalProperties: false, properties: {
          title: { type: 'string' }, what: { type: 'string' }, whyItMatters: { type: 'string' }, fix: { type: 'string' },
          priority: { type: 'string', enum: ['immediate','this_week','this_month','this_quarter','when_convenient'] },
          severity: { type: 'string', enum: ['critical','high','medium','low','info'] },
          confidence: { type: 'string', enum: ['confirmed','likely','possible','needs_verification'] },
          owner: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          areas: { type: 'array', items: { type: 'string', enum: ['development','seo','marketing','content','performance','ux','security','accessibility','analytics','legal','business'] }, maxItems: 4 },
          expectedOutcome: { anyOf: [{ type: 'string' }, { type: 'null' }] }, verification: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        }, required: ['title','what','whyItMatters','fix','priority','severity','confidence','owner','areas','expectedOutcome','verification'] }, { type: 'null' }] },
        evidenceRefs: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      },
      required: ['candidateId','verdict','scores','evidenceAssessment','strengths','problems','requiredChanges','mergeWithCandidateIds','evidenceRefs'],
    }, maxItems: 150 },
    selectedCandidateIds: { type: 'array', items: { type: 'string' }, maxItems: 150 },
    droppedCandidateIds: { type: 'array', items: { type: 'string' }, maxItems: 150 },
    mergedCandidateIds: { type: 'array', items: { type: 'string' }, maxItems: 150 },
  },
  required: ['judgeVersion','decisions','selectedCandidateIds','droppedCandidateIds','mergedCandidateIds'],
} as const;
