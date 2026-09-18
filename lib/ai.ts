import OpenAI from 'openai';
import type { ActionableFinding, Audit, BrowserEvidence, Confidence, InsightArea, Priority } from './types';
import { buildSiteDossier } from './dossier';
import { runAnalyst, runJudge, createOpenAIAnalystAdapter } from './analyst';
import type { AnalystCandidateInsight } from './analyst';
import type { PageData, Finding } from './types';

export interface IntegratedAnalysis {
  summary: string;
  priorities: string[];
  actions: string[];
  strategicInsights: Array<{
    title: string;
    area: InsightArea;
    priority: Priority;
    what: string;
    why: string;
    fix: string;
    owner: string[];
    confidence: Confidence;
    severity?: string;
    scope?: string;
    affectedUrls?: string[];
    evidenceRefs?: string[];
    sourcePass?: string;
  }>;
  analystRun?: unknown;
  judgeRun?: unknown;
}

function candidateToStrategic(candidate: AnalystCandidateInsight, dossier: ReturnType<typeof buildSiteDossier>) {
  const firstArea = candidate.areas[0] as InsightArea;
  return {
    title: candidate.title,
    area: firstArea,
    priority: candidate.priority as Priority,
    what: candidate.what,
    why: candidate.whyItMatters,
    fix: candidate.fix,
    owner: candidate.owner,
    confidence: candidate.confidence as Confidence,
    severity: candidate.severity,
    scope: candidate.scope,
    affectedUrls: candidate.affectedPageIds.map(id => dossier.crawl.pages.find(p => p.pageId === id)?.url).filter(Boolean) as string[],
    evidenceRefs: candidate.evidenceRefs,
    sourcePass: candidate.sourcePass,
  };
}

/**
 * Build the Site Dossier, run all analyst passes, judge every candidate, and return
 * only customer-facing KEEP/REWRITE insights. Legacy deterministic insights are
 * intentionally supplied as evidence, not treated as the final AI answer.
 */
export async function analyzeAudit(audit: Pick<Audit,'id'|'url'|'domain'|'pages'|'findings'|'insights'|'browserEvidence'> & { robots?: string; sitemapUrls?: string[] }) {
  if (!process.env.OPENAI_API_KEY) return null;

  const dossier = buildSiteDossier({
    auditId: audit.id || `audit_${Date.now()}`,
    url: audit.url,
    pages: audit.pages as PageData[],
    robots: audit.robots || '',
    sitemapUrls: audit.sitemapUrls,
    discovered: audit.pages.map(p => p.url),
    findings: audit.findings as Finding[],
    browserEvidence: audit.browserEvidence || [],
    toolVersion: 'blasphemy-multipass-v1',
    maxPages: audit.pages.length,
  });

  const adapter = createOpenAIAnalystAdapter();
  const analystRun = await runAnalyst(dossier, adapter, {
    analystVersion: process.env.BLASPHEMY_ANALYST_VERSION || 'analyst-v1',
  });
  const judgeRun = await runJudge(dossier, analystRun.candidates, adapter, process.env.BLASPHEMY_JUDGE_VERSION || 'judge-v1');

  const byId = new Map(analystRun.candidates.map(c => [c.candidateId, c]));
  const strategicInsights = judgeRun.decisions
    .filter(d => d.verdict === 'keep' || d.verdict === 'rewrite')
    .map(d => {
      const base = byId.get(d.candidateId);
      if (!base) return null;
      const merged = d.rewrittenCandidate ? { ...base, ...d.rewrittenCandidate } : base;
      return candidateToStrategic(merged, dossier);
    })
    .filter(Boolean) as IntegratedAnalysis['strategicInsights'];

  // A compact executive synthesis is generated from the judged set only.
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const synthesis = await client.responses.create({
    model: process.env.OPENAI_MODEL || process.env.OPENAI_ANALYST_MODEL || 'gpt-5.6-luna',
    input: [
      { role: 'system', content: 'You are Blasphemy report editor. Summarize only the supplied judged website insights. Do not add new facts. Keep the language concrete and owner-oriented. Return JSON only.' },
      { role: 'user', content: JSON.stringify({ website: { url: audit.url, domain: audit.domain }, judgedInsights: strategicInsights }) },
    ],
    text: { format: { type: 'json_schema', name: 'audit_executive_synthesis', schema: {
      type: 'object', additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        priorities: { type: 'array', items: { type: 'string' } },
        actions: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary','priorities','actions'],
    } } },
  });
  const executive = JSON.parse(synthesis.output_text) as { summary:string; priorities:string[]; actions:string[] };

  return { ...executive, strategicInsights, analystRun, judgeRun, dossier } satisfies IntegratedAnalysis & { dossier: unknown };
}
