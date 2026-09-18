import { z } from 'zod';

export const analystPassSchema = z.enum([
  'business_understanding',
  'site_architecture',
  'seo_search',
  'marketing_content',
  'ux_conversion',
  'technical_performance',
  'cross_page_synthesis',
]);

export const insightTypeSchema = z.enum(['issue', 'opportunity', 'risk', 'verification']);
export const insightAreaSchema = z.enum([
  'development', 'seo', 'marketing', 'content', 'performance', 'ux', 'security', 'accessibility', 'analytics', 'legal', 'business',
]);
export const insightPrioritySchema = z.enum(['immediate', 'this_week', 'this_month', 'this_quarter', 'when_convenient']);
export const insightSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const insightConfidenceSchema = z.enum(['confirmed', 'likely', 'possible', 'needs_verification']);
export const insightScopeSchema = z.enum(['page', 'template', 'cluster', 'site', 'origin', 'component']);

const candidateCore = {
  candidateId: z.string().min(1),
  title: z.string().min(8).max(180),
  type: insightTypeSchema,
  areas: z.array(insightAreaSchema).min(1).max(4),
  severity: insightSeveritySchema,
  priority: insightPrioritySchema,
  confidence: insightConfidenceSchema,
  scope: insightScopeSchema,
  what: z.string().min(20).max(1000),
  whyItMatters: z.string().min(20).max(1200),
  fix: z.string().min(20).max(1500),
  owner: z.array(z.string().min(2)).min(1).max(4),
  affectedPageIds: z.array(z.string()).max(1000),
  evidenceRefs: z.array(z.string()).min(1).max(20),
  relatedCandidateIds: z.array(z.string()).max(50),
  expectedOutcome: z.string().max(800).optional(),
  verification: z.string().max(800).optional(),
};

export const analystCandidateSchema = z.object({
  ...candidateCore,
  sourcePass: analystPassSchema,
}).strict();

export const analystPassResultSchema = z.object({
  pass: analystPassSchema,
  observations: z.array(z.string().min(5)).max(80),
  derivedFacts: z.array(z.string().min(5)).max(50),
  candidateInsights: z.array(analystCandidateSchema).max(40),
  evidenceGaps: z.array(z.string().min(5)).max(40),
}).strict();

export const analystRunSchema = z.object({
  analystVersion: z.string().min(1),
  dossierSchemaVersion: z.literal('1.0'),
  passes: z.array(analystPassResultSchema).min(1).max(7),
  candidates: z.array(analystCandidateSchema).max(150),
}).strict();

const score = z.number().int().min(0).max(5);

export const judgeDecisionSchema = z.object({
  candidateId: z.string().min(1),
  verdict: z.enum(['keep', 'rewrite', 'merge', 'drop']),
  scores: z.object({
    truthfulness: score,
    evidenceQuality: score,
    specificity: score,
    businessRelevance: score,
    actionability: score,
    priorityFit: score,
    audienceFit: score,
    novelty: score,
    overall: score,
  }).strict(),
  evidenceAssessment: z.enum(['sufficient', 'partial', 'insufficient', 'contradicted']),
  strengths: z.array(z.string().min(5)).max(10),
  problems: z.array(z.string().min(5)).max(10),
  requiredChanges: z.array(z.string().min(5)).max(10),
  mergeWithCandidateIds: z.array(z.string()).max(20),
  rewrittenCandidate: z.object({
    title: z.string().min(8).max(180).optional(),
    what: z.string().min(20).max(1000).optional(),
    whyItMatters: z.string().min(20).max(1200).optional(),
    fix: z.string().min(20).max(1500).optional(),
    priority: insightPrioritySchema.optional(),
    severity: insightSeveritySchema.optional(),
    confidence: insightConfidenceSchema.optional(),
    owner: z.array(z.string().min(2)).max(4).optional(),
    areas: z.array(insightAreaSchema).max(4).optional(),
    expectedOutcome: z.string().max(800).optional(),
    verification: z.string().max(800).optional(),
  }).strict().optional(),
  evidenceRefs: z.array(z.string()).max(20),
}).strict();

export const judgeRunSchema = z.object({
  judgeVersion: z.string().min(1),
  decisions: z.array(judgeDecisionSchema).max(150),
  selectedCandidateIds: z.array(z.string()).max(150),
  droppedCandidateIds: z.array(z.string()).max(150),
  mergedCandidateIds: z.array(z.string()).max(150),
}).strict();
