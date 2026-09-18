import { describe, expect, it } from 'vitest';
import { evaluateCandidates } from '../lib/evaluation/scoring';
import type { GoldCase } from '../lib/evaluation/types';
import type { AnalystCandidateInsight } from '../lib/analyst/types';

const gold:GoldCase={
  caseId:'case-1',siteLabel:'Example',description:'',goldInsights:[
    {id:'G1',title:'DevOps page has a title-to-H1 intent mismatch',description:'DevOps title conflicts with Cloud Migration H1.',type:'issue',areas:['seo','content'],importance:'must_find',keywords:['DevOps','Cloud Migration','title','H1'],expectedEvidencePatterns:['devops','h1'],expectedPriority:'this_week'},
    {id:'G2',title:'AI services need clearer differentiation',description:'AI service pages overlap heavily.',type:'opportunity',areas:['seo','marketing','content'],importance:'valuable',keywords:['AI','overlap','differentiation'],expectedEvidencePatterns:['ai'],expectedPriority:'this_month'},
  ],
};

const candidate=(id:string,title:string,what:string,evidenceRefs:string[]):AnalystCandidateInsight=>({candidateId:id,title,type:'issue',areas:['seo'],severity:'medium',priority:'this_week',confidence:'likely',scope:'page',what,whyItMatters:'This creates a specific site-level relevance or clarity problem for users.',fix:'Align the page topic and supporting content with the intended service and search intent.',owner:['seo'],affectedPageIds:['p1'],evidenceRefs,relatedCandidateIds:[],sourcePass:'seo_search'});

describe('evaluation framework',()=>{
  it('detects strong matches and reports precision/recall',()=>{
    const report=evaluateCandidates(gold,[
      candidate('c1','DevOps page has a title-to-H1 intent mismatch','The DevOps title conflicts with Cloud Migration Services in the H1.',['ev_devops','ev_h1']),
      candidate('c2','Completely generic SEO advice','Improve SEO by creating better content.',['ev_other']),
    ],{ev_devops:'The DevOps page title says DevOps Services Company while the H1 says Cloud Migration Services.',ev_h1:'H1 Cloud Migration Services on DevOps service page.',ev_other:'A different unrelated observation.'},2);
    expect(report.mustFindFound).toBe(1);
    expect(report.mustFindTotal).toBe(1);
    expect(report.precisionAtK).toBeGreaterThan(0);
    expect(report.falsePositiveRate).toBeGreaterThan(0);
  });
});
