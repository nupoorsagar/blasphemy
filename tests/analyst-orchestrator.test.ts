import { describe, expect, it } from 'vitest';
import { runAnalyst, runJudge } from '../lib/analyst/orchestrator';
import type { SiteDossier } from '../lib/dossier/types';
import type { AnalystCandidateInsight } from '../lib/analyst/types';

const dossier = { schemaVersion: '1.0', site: { canonicalOrigin: 'https://example.com' }, evidence: { items: [] } } as unknown as SiteDossier;

const candidate: AnalystCandidateInsight = {
  candidateId:'c1', title:'Specific issue', type:'issue', areas:['seo'], severity:'medium', priority:'this_month', confidence:'confirmed', scope:'page',
  what:'A concrete observed problem exists on an important page.', whyItMatters:'The problem can make the page purpose less clear.', fix:'Update the relevant page title and heading to match the intended service.', owner:['seo'], affectedPageIds:['p1'], evidenceRefs:['ev1'], relatedCandidateIds:[], sourcePass:'seo_search'
};

describe('analyst orchestrator',()=>{
  it('runs ordered analyst passes and preserves prior-pass context',async()=>{
    const calls:string[]=[];
    const adapter={generate:async(input:{system:string;user:any;jsonSchema:unknown})=>{calls.push(input.user.pass);return {pass:input.user.pass,observations:['obs'],derivedFacts:[],candidateInsights:[{...candidate,sourcePass:input.user.pass}],evidenceGaps:[]};}};
    const run=await runAnalyst(dossier,adapter,{passes:['business_understanding','seo_search']});
    expect(calls).toEqual(['business_understanding','seo_search']);
    expect(run.candidates).toHaveLength(2);
  });

  it('validates judge references against candidate IDs',async()=>{
    const adapter={generate:async()=>({judgeVersion:'judge-v1',decisions:[{candidateId:'c1',verdict:'keep',scores:{truthfulness:5,evidenceQuality:5,specificity:4,businessRelevance:4,actionability:4,priorityFit:4,audienceFit:4,novelty:4,overall:5},evidenceAssessment:'sufficient',strengths:['evidence-backed'],problems:[],requiredChanges:[],mergeWithCandidateIds:[],evidenceRefs:['ev1']}],selectedCandidateIds:['c1'],droppedCandidateIds:[],mergedCandidateIds:[]})};
    const result=await runJudge(dossier,[candidate],adapter);
    expect(result.selectedCandidateIds).toEqual(['c1']);
  });
});
