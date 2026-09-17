import OpenAI from 'openai';
import type { ActionableFinding, Audit, BrowserEvidence, Confidence, InsightArea, Priority } from './types';

export async function analyzeAudit(audit: Pick<Audit,'url'|'domain'|'pages'|'findings'|'insights'|'browserEvidence'>) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const pageDigest = audit.pages.filter(p=>!p.resourceKind || p.resourceKind==='page').slice(0,30).map(p=>({
    url:p.url,title:p.title,h1:p.h1.slice(0,2),words:p.wordCount,status:p.status,description:p.description.slice(0,220)
  }));
  const insightDigest = (audit.insights||[]).slice(0,50).map((i:ActionableFinding)=>({
    title:i.title,areas:i.areas,severity:i.severity,priority:i.priority,confidence:i.confidence,scope:i.scope,owner:i.owner,what:i.what,why:i.why,fix:i.fix,affectedUrls:i.affectedUrls.slice(0,12),evidence:i.evidence.slice(0,8)
  }));
  const browserDigest = (audit.browserEvidence||[]).slice(0,20).map((b:BrowserEvidence)=>({
    url:b.url,device:b.device,lcpMs:b.lcpMs,cls:b.cls,inpMs:b.inpMs,fcpMs:b.fcpMs,ttfbMs:b.ttfbMs,lcpElement:b.lcpElement,lcpResource:b.lcpResource,longTasks:b.longTasks,longestLongTaskMs:b.longestLongTaskMs,overflow:b.overflow,notes:b.notes
  }));
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    input: [
      {role:'system',content:`You are a neutral website audit analyst. Convert verified audit evidence into concise, actionable insights for the website owner. Never invent facts, URLs, metrics, legal requirements, competitors, customer behaviour, or causes that are not supported by the supplied evidence. Separate observed facts from reasonable interpretation. When evidence is insufficient, use confidence "needs_verification" and say what should be checked. Do not rank departments against each other. Return JSON only.`},
      {role:'user',content:JSON.stringify({
        task:'Identify the most important additional cross-page SEO, marketing, content, UX and conversion issues that are supported by the supplied evidence. Produce practical recommendations in the same What / Why / Fix style as the deterministic findings. Avoid duplicating an existing insight unless adding meaningful interpretation.',
        website:{url:audit.url,domain:audit.domain},pages:pageDigest,insights:insightDigest,browser:browserDigest,
      })}
    ],
    text:{format:{type:'json_schema',name:'audit_analysis',schema:{type:'object',additionalProperties:false,properties:{
      summary:{type:'string'},
      priorities:{type:'array',items:{type:'string'}},
      actions:{type:'array',items:{type:'string'}},
      strategicInsights:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        title:{type:'string'},area:{type:'string',enum:['development','seo','marketing','content','performance','ux','accessibility','security','analytics','legal']},priority:{type:'string',enum:['immediate','this_week','this_month','this_quarter','when_convenient']},what:{type:'string'},why:{type:'string'},fix:{type:'string'},owner:{type:'array',items:{type:'string'}},confidence:{type:'string',enum:['confirmed','likely','possible','needs_verification']}
      },required:['title','area','priority','what','why','fix','owner','confidence']}}
    },required:['summary','priorities','actions','strategicInsights']}}}
  });
  return JSON.parse(response.output_text) as {
    summary:string;
    priorities:string[];
    actions:string[];
    strategicInsights:Array<{title:string;area:InsightArea;priority:Priority;what:string;why:string;fix:string;owner:string[];confidence:Confidence}>;
  };
}
