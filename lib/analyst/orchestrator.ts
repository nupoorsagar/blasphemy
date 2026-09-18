import type { SiteDossier } from '../dossier/types';
import { analystPassResultSchema, judgeRunSchema } from './schema';
import { buildAnalystSystemPrompt, buildAnalystUserPayload, judgeSystemPrompt } from './prompts';
import { analystPassResultJsonSchema, judgeRunJsonSchema } from './openaiSchemas';
import type { AnalystCandidateInsight, AnalystPass, AnalystPassResult, AnalystRun, JudgeRun } from './types';

export interface StructuredModelAdapter {
  generate(input: {
    system: string;
    user: unknown;
    jsonSchema: unknown;
  }): Promise<unknown>;
}

export interface AnalystExecutionOptions {
  analystVersion?: string;
  passes?: AnalystPass[];
}

const orderedPasses: AnalystPass[] = [
  'business_understanding',
  'site_architecture',
  'seo_search',
  'marketing_content',
  'ux_conversion',
  'technical_performance',
  'cross_page_synthesis',
];

export async function runAnalyst(
  dossier: SiteDossier,
  adapter: StructuredModelAdapter,
  options: AnalystExecutionOptions = {},
): Promise<AnalystRun> {
  const passes = options.passes || orderedPasses;
  const results: AnalystPassResult[] = [];

  for (const pass of passes) {
    const raw = await adapter.generate({
      system: buildAnalystSystemPrompt(pass),
      user: buildAnalystUserPayload(pass, dossier, results),
      jsonSchema: analystPassResultJsonSchema,
    });
    const parsed = analystPassResultSchema.parse(raw);
    if (parsed.pass !== pass) throw new Error(`Analyst returned pass ${parsed.pass} while ${pass} was requested.`);
    results.push(parsed);
  }

  const candidates: AnalystCandidateInsight[] = [];
  for (const result of results) candidates.push(...result.candidateInsights);

  return {
    analystVersion: options.analystVersion || 'analyst-v1',
    dossierSchemaVersion: dossier.schemaVersion,
    passes: results,
    candidates,
  };
}

export async function runJudge(
  dossier: SiteDossier,
  candidates: AnalystCandidateInsight[],
  adapter: StructuredModelAdapter,
  judgeVersion = 'judge-v1',
): Promise<JudgeRun> {
  const raw = await adapter.generate({
    system: judgeSystemPrompt,
    user: {
      task: 'Judge the candidate insights for this website and decide which deserve to reach the customer.',
      website: { url: dossier.site.canonicalOrigin, dossierSchemaVersion: dossier.schemaVersion },
      candidates,
      evidence: dossier.evidence.items,
      outputRules: {
        everyDecisionMustReferenceCandidate: true,
        selectedMustBeKeepOrRewrite: true,
        mergeMustNameTargetCandidates: true,
        dropMustExplainWhy: true,
      },
    },
    jsonSchema: judgeRunJsonSchema,
  });

  const parsed = judgeRunSchema.parse(raw);
  const candidateIds = new Set(candidates.map(candidate => candidate.candidateId));
  for (const decision of parsed.decisions) {
    if (!candidateIds.has(decision.candidateId)) throw new Error(`Judge referenced unknown candidate: ${decision.candidateId}`);
    for (const mergeId of decision.mergeWithCandidateIds) {
      if (!candidateIds.has(mergeId)) throw new Error(`Judge referenced unknown merge candidate: ${mergeId}`);
    }
  }
  return parsed;
}

export { orderedPasses };
