import type { AnalystCandidateInsight } from '../analyst/types';
import type { EvaluationReport, GoldCase, GoldInsight, CandidateEvaluation } from './types';

function tokens(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 4),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function semanticMatch(candidate: AnalystCandidateInsight, gold: GoldInsight): number {
  const candidateText = `${candidate.title} ${candidate.what} ${candidate.whyItMatters}`;
  const goldText = `${gold.title} ${gold.description} ${gold.keywords.join(' ')}`;
  const overlap = jaccard(tokens(candidateText), tokens(goldText));
  const keywordHits = gold.keywords.filter(keyword => candidateText.toLowerCase().includes(keyword.toLowerCase())).length;
  const keywordScore = gold.keywords.length ? keywordHits / gold.keywords.length : 0;
  const areaScore = candidate.areas.some(area => gold.areas.includes(area)) ? 1 : 0;
  return Math.min(1, overlap * 0.55 + keywordScore * 0.35 + areaScore * 0.10);
}

function evidenceMatch(candidate: AnalystCandidateInsight, gold: GoldInsight, evidenceByRef: Record<string, string>): number {
  if (!candidate.evidenceRefs.length) return 0;
  if (!gold.expectedEvidencePatterns.length) return 1;
  const refsText = candidate.evidenceRefs
    .map(ref => evidenceByRef[ref] || '')
    .join(' ')
    .toLowerCase();
  if (!refsText.trim()) return 0;
  const hits = gold.expectedEvidencePatterns.filter(pattern => refsText.includes(pattern.toLowerCase())).length;
  return Math.min(1, hits / gold.expectedEvidencePatterns.length);
}

function specificity(candidate: AnalystCandidateInsight): number {
  let score = 0;
  if (candidate.affectedPageIds.length > 0) score += 0.25;
  if (candidate.evidenceRefs.length > 0) score += 0.25;
  if (candidate.fix.length >= 50) score += 0.25;
  if (!/improve|optimize|optimise|enhance|better website/i.test(candidate.fix)) score += 0.25;
  return score;
}

function actionability(candidate: AnalystCandidateInsight): number {
  let score = 0;
  if (candidate.owner.length) score += 0.2;
  if (candidate.fix.length >= 40) score += 0.3;
  if (candidate.verification) score += 0.2;
  if (candidate.expectedOutcome) score += 0.15;
  if (candidate.affectedPageIds.length) score += 0.15;
  return Math.min(1, score);
}

function priorityFit(candidate: AnalystCandidateInsight, gold: GoldInsight): number {
  if (!gold.expectedPriority) return 1;
  return candidate.priority === gold.expectedPriority ? 1 : 0.5;
}

function matchCandidate(candidate: AnalystCandidateInsight, gold: GoldInsight, evidenceByRef: Record<string, string>): CandidateEvaluation {
  const semantic = semanticMatch(candidate, gold);
  const evidence = evidenceMatch(candidate, gold, evidenceByRef);
  const spec = specificity(candidate);
  const action = actionability(candidate);
  const priority = priorityFit(candidate, gold);
  const score = semantic * 0.35 + evidence * 0.20 + spec * 0.15 + action * 0.20 + priority * 0.10;
  return {
    candidateId: candidate.candidateId,
    matchedGoldInsightId: score >= 0.45 ? gold.id : undefined,
    semanticMatch: semantic,
    evidenceMatch: evidence,
    specificity: spec,
    actionability: action,
    priorityFit: priority,
    score,
    falsePositive: score < 0.45,
  };
}

function redundancyRate(candidates: AnalystCandidateInsight[]): number {
  if (candidates.length < 2) return 0;
  let redundant = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const similarity = jaccard(tokens(`${candidates[i].title} ${candidates[i].what}`), tokens(`${candidates[j].title} ${candidates[j].what}`));
      if (similarity >= 0.65) redundant += 1;
    }
  }
  const possible = (candidates.length * (candidates.length - 1)) / 2;
  return redundant / Math.max(1, possible);
}

export function evaluateCandidates(goldCase: GoldCase, candidates: AnalystCandidateInsight[], evidenceByRef: Record<string, string> = {}, k = 20): EvaluationReport {
  const top = candidates.slice(0, k);
  const usedGold = new Set<string>();
  const evaluations: CandidateEvaluation[] = [];

  for (const candidate of top) {
    const ranked = goldCase.goldInsights
      .filter(gold => !usedGold.has(gold.id))
      .map(gold => matchCandidate(candidate, gold, evidenceByRef))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (best?.matchedGoldInsightId) usedGold.add(best.matchedGoldInsightId);
    evaluations.push(best || {
      candidateId: candidate.candidateId,
      semanticMatch: 0,
      evidenceMatch: 0,
      specificity: specificity(candidate),
      actionability: actionability(candidate),
      priorityFit: 0,
      score: 0,
      falsePositive: true,
    });
  }

  const matchedGoldCount = usedGold.size;
  const mustFind = goldCase.goldInsights.filter(g => g.importance === 'must_find');
  const mustFindFound = mustFind.filter(g => usedGold.has(g.id)).length;
  const precision = evaluations.filter(e => !e.falsePositive).length / Math.max(1, top.length);
  const recall = matchedGoldCount / Math.max(1, goldCase.goldInsights.length);
  const evidenceAccuracy = evaluations.reduce((sum, e) => sum + e.evidenceMatch, 0) / Math.max(1, evaluations.length);
  const actionabilityScore = evaluations.reduce((sum, e) => sum + e.actionability, 0) / Math.max(1, evaluations.length);
  const fpRate = evaluations.filter(e => e.falsePositive).length / Math.max(1, evaluations.length);
  const redundancy = redundancyRate(top);
  const quality = precision * 0.25 + recall * 0.20 + evidenceAccuracy * 0.20 + actionabilityScore * 0.20 + (1 - fpRate) * 0.10 + (1 - redundancy) * 0.05;

  return {
    caseId: goldCase.caseId,
    candidateCount: candidates.length,
    goldCount: goldCase.goldInsights.length,
    matchedGoldCount,
    mustFindFound,
    mustFindTotal: mustFind.length,
    precisionAtK: precision,
    recallAtK: recall,
    evidenceAccuracy,
    actionability: actionabilityScore,
    falsePositiveRate: fpRate,
    redundancyRate: redundancy,
    qualityScore: quality,
    candidateEvaluations: evaluations,
  };
}
