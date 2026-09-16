import OpenAI from 'openai';
import { Audit } from './types';

export async function analyzeAudit(audit: Pick<Audit,'url'|'domain'|'pages'|'findings'>) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const pageDigest = audit.pages.slice(0,20).map(p=>({url:p.url,title:p.title,h1:p.h1.slice(0,2),words:p.wordCount,status:p.status,description:p.description.slice(0,220)}));
  const findingDigest = audit.findings.slice(0,80).map(f=>({checkId:f.checkId,severity:f.severity,title:f.title,pageUrl:f.pageUrl,message:f.message,why:f.why,fix:f.fix}));
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    input: [
      {role:'system',content:'You are a neutral website audit analyst. Produce concise evidence-based observations and practical fixes. Never invent facts that are not in the supplied data. Return JSON only.'},
      {role:'user',content:JSON.stringify({task:'Analyze this website audit. Identify the most important cross-page issues, positioning/content gaps, buyer objections, trust gaps, and conversion opportunities. Also summarize the homepage proposition if possible.', website:{url:audit.url,domain:audit.domain},pages:pageDigest,findings:findingDigest})}
    ],
    text:{format:{type:'json_schema',name:'audit_analysis',schema:{type:'object',additionalProperties:false,properties:{summary:{type:'string'},priorities:{type:'array',items:{type:'string'}},actions:{type:'array',items:{type:'string'}}},required:['summary','priorities','actions']}}}
  });
  const text=response.output_text;
  return JSON.parse(text) as {summary:string;priorities:string[];actions:string[]};
}
