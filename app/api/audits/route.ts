import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crawlSite } from '@/lib/engine/crawl';
import { runDeterministicRules, summarizeFindings } from '@/lib/engine/rules';
import { browserEvidenceToFindings, findingsToInsights, summarizeInsights } from '@/lib/engine/insights';
import { collectBrowserEvidence } from '@/lib/browser';
import { analyzeAudit } from '@/lib/ai';
import { createAudit } from '@/lib/store';
import type { Audit } from '@/lib/types';

const schema=z.object({url:z.string().url()});
export const maxDuration=60;

export async function POST(req:Request){
  try{
    const parsed=schema.parse(await req.json());
    const u=new URL(parsed.url);
    if(!/^https?:$/.test(u.protocol)) return NextResponse.json({error:'Only HTTP(S) websites are supported.'},{status:400});
    const id=crypto.randomUUID();
    const seed:Audit={id,url:u.toString(),domain:u.hostname,status:'running',createdAt:new Date().toISOString(),pages:[],findings:[],insights:[],browserEvidence:[]};
    createAudit(seed);

    const {pages,robots}=await crawlSite(u.toString());
    const findings=runDeterministicRules(pages,robots);
    const browserUrls=pages.filter(p=>!p.resourceKind || p.resourceKind==='page').slice(0,Number(process.env.BROWSER_AUDIT_PAGES||8)).map(p=>p.url);
    let browserEvidence=await collectBrowserEvidence(browserUrls).catch(()=>[]);
    const insights=findingsToInsights([...findings,...browserEvidenceToFindings(browserEvidence)]);
    const aiSummary=await analyzeAudit({url:seed.url,domain:seed.domain,pages,findings,insights,browserEvidence}).catch(()=>null);
    const audit:Audit={...seed,status:'complete',pages,findings,insights,browserEvidence,aiSummary:aiSummary||undefined};
    createAudit(audit);
    return NextResponse.json({id,auditId:id,summary:{raw:summarizeFindings(findings),insights:summarizeInsights(insights),browserPages:browserEvidence.length}});
  }catch(err){
    return NextResponse.json({error:err instanceof Error?err.message:'Invalid request'},{status:400});
  }
}
