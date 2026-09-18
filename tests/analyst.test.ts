import { describe, expect, it } from 'vitest';
import { analystCandidateSchema, analystPassResultSchema, judgeDecisionSchema } from '../lib/analyst/schema';
import { buildAnalystSystemPrompt, buildAnalystUserPayload, judgeSystemPrompt } from '../lib/analyst/prompts';
import { buildSiteDossier } from '../lib/dossier';
import type { PageData } from '../lib/types';

const page = (url:string, title:string, h1:string[], html:string):PageData => ({
  url, status:200, contentType:'text/html', html, title, description:`Description for ${title}`, h1,
  headings:h1.map(text=>({level:1,text})), links:[], images:[], scripts:[], stylesheets:[], canonical:url,
  lang:'en-GB', wordCount:200, loadMs:100, headers:{}, cookies:[], sourceSize:html.length,
});

describe('analyst framework',()=>{
  const dossier=buildSiteDossier({
    auditId:'analyst-1',url:'https://example.com/',pages:[
      page('https://example.com/','Example Technology Services',['Example'], '<html><body><nav>Services About Contact</nav><main><h1>Example</h1><p>Technology services for healthcare organisations.</p><a href="/contact">Book a demo</a></main></body></html>'),
    ],robots:'',discovered:['https://example.com/'],sitemapUrls:[],
  });

  it('validates analyst candidates and judge decisions',()=>{
    const candidate=analystCandidateSchema.parse({
      candidateId:'c1',title:'The homepage proposition is not clearly differentiated',type:'opportunity',areas:['marketing','content'],severity:'medium',priority:'this_month',confidence:'likely',scope:'page',
      what:'The homepage describes technology services for healthcare organisations but does not clearly state a distinctive reason to choose the company.',whyItMatters:'A generic proposition can make it harder for a buyer to understand the offer and why it is relevant to them.',fix:'Rewrite the hero proposition around the primary audience, problem solved and differentiating capability, then support it with proof.',owner:['marketing','content'],affectedPageIds:[dossier.crawl.pages[0].pageId],evidenceRefs:[dossier.evidence.items[0].evidenceId],relatedCandidateIds:[],sourcePass:'marketing_content'
    });
    expect(candidate.sourcePass).toBe('marketing_content');

    const decision=judgeDecisionSchema.parse({
      candidateId:'c1',verdict:'keep',scores:{truthfulness:5,evidenceQuality:4,specificity:4,businessRelevance:5,actionability:4,priorityFit:4,audienceFit:5,novelty:4,overall:4},evidenceAssessment:'sufficient',strengths:['Site-specific'],problems:[],requiredChanges:[],mergeWithCandidateIds:[],evidenceRefs:candidate.evidenceRefs,
    });
    expect(decision.verdict).toBe('keep');
  });

  it('builds prompts with anti-bullshit rules and previous-pass context',()=>{
    const system=buildAnalystSystemPrompt('seo_search');
    const payload=buildAnalystUserPayload('seo_search',dossier,[{
      pass:'business_understanding',observations:['B2B technology services'],derivedFacts:[],candidateInsights:[],evidenceGaps:[],
    }]);
    expect(system).toContain('Do not invent rankings');
    expect(system).toContain('Do not turn every technical anomaly');
    expect(JSON.stringify(payload)).toContain('business_understanding');
    expect(judgeSystemPrompt).toContain('DROP anything that is generic');
  });

  it('validates a pass result shape',()=>{
    const result=analystPassResultSchema.parse({pass:'business_understanding',observations:['Technology services for healthcare organisations.'],derivedFacts:[],candidateInsights:[],evidenceGaps:[]});
    expect(result.pass).toBe('business_understanding');
  });
});
