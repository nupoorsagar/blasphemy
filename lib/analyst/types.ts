import type { SiteDossier } from '../dossier/types';

export const ANALYST_PASSES = [
  'business_understanding',
  'site_architecture',
  'seo_search',
  'marketing_content',
  'ux_conversion',
  'technical_performance',
  'cross_page_synthesis',
] as const;

export type AnalystPass = typeof ANALYST_PASSES[number];

export type InsightType = 'issue' | 'opportunity' | 'risk' | 'verification';
export type InsightArea =
  | 'development'
  | 'seo'
  | 'marketing'
  | 'content'
  | 'performance'
  | 'ux'
  | 'security'
  | 'accessibility'
  | 'analytics'
  | 'legal'
  | 'business';
export type InsightPriority = 'immediate' | 'this_week' | 'this_month' | 'this_quarter' | 'when_convenient';
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type InsightConfidence = 'confirmed' | 'likely' | 'possible' | 'needs_verification';
export type InsightScope = 'page' | 'template' | 'cluster' | 'site' | 'origin' | 'component';

export interface AnalystCandidateInsight {
  candidateId: string;
  title: string;
  type: InsightType;
  areas: InsightArea[];
  severity: InsightSeverity;
  priority: InsightPriority;
  confidence: InsightConfidence;
  scope: InsightScope;
  what: string;
  whyItMatters: string;
  fix: string;
  owner: string[];
  affectedPageIds: string[];
  evidenceRefs: string[];
  relatedCandidateIds: string[];
  expectedOutcome?: string;
  verification?: string;
  sourcePass: AnalystPass;
}

export interface AnalystPassResult {
  pass: AnalystPass;
  observations: string[];
  derivedFacts: string[];
  candidateInsights: AnalystCandidateInsight[];
  evidenceGaps: string[];
}

export interface AnalystRun {
  analystVersion: string;
  dossierSchemaVersion: SiteDossier['schemaVersion'];
  passes: AnalystPassResult[];
  candidates: AnalystCandidateInsight[];
}

export interface AnalystRunInput {
  dossier: SiteDossier;
  previousPasses?: AnalystPassResult[];
}

export type JudgeVerdict = 'keep' | 'rewrite' | 'merge' | 'drop';
export type EvidenceAssessment = 'sufficient' | 'partial' | 'insufficient' | 'contradicted';

export interface JudgeScores {
  truthfulness: number;
  evidenceQuality: number;
  specificity: number;
  businessRelevance: number;
  actionability: number;
  priorityFit: number;
  audienceFit: number;
  novelty: number;
  overall: number;
}

export interface JudgeDecision {
  candidateId: string;
  verdict: JudgeVerdict;
  scores: JudgeScores;
  evidenceAssessment: EvidenceAssessment;
  strengths: string[];
  problems: string[];
  requiredChanges: string[];
  mergeWithCandidateIds: string[];
  rewrittenCandidate?: Partial<AnalystCandidateInsight>;
  evidenceRefs: string[];
}

export interface JudgeRun {
  judgeVersion: string;
  decisions: JudgeDecision[];
  selectedCandidateIds: string[];
  droppedCandidateIds: string[];
  mergedCandidateIds: string[];
}
