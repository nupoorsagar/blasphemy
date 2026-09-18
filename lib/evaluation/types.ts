import type { InsightArea, InsightPriority, InsightType } from '../analyst/types';

export interface GoldInsight {
  id: string;
  title: string;
  description: string;
  type: InsightType;
  areas: InsightArea[];
  importance: 'must_find' | 'valuable' | 'nice_to_have';
  keywords: string[];
  expectedEvidencePatterns: string[];
  acceptableAlternatives?: string[];
  expectedPriority?: InsightPriority;
  expectedOwners?: string[];
  notes?: string;
}

export interface GoldCase {
  caseId: string;
  siteLabel: string;
  description: string;
  dossierPath?: string;
  goldInsights: GoldInsight[];
}

export interface CandidateEvaluation {
  candidateId: string;
  matchedGoldInsightId?: string;
  semanticMatch: number;
  evidenceMatch: number;
  specificity: number;
  actionability: number;
  priorityFit: number;
  score: number;
  falsePositive: boolean;
}

export interface EvaluationReport {
  caseId: string;
  candidateCount: number;
  goldCount: number;
  matchedGoldCount: number;
  mustFindFound: number;
  mustFindTotal: number;
  precisionAtK: number;
  recallAtK: number;
  evidenceAccuracy: number;
  actionability: number;
  falsePositiveRate: number;
  redundancyRate: number;
  qualityScore: number;
  candidateEvaluations: CandidateEvaluation[];
}
