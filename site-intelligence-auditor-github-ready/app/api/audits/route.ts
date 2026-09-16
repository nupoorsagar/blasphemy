import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crawlSite } from '@/lib/engine/crawl';
import { runDeterministicRules, summarizeFindings } from '@/lib/engine/rules';
import { analyzeAudit } from '@/lib/ai';
import { createAudit } from '@/lib/store';
import { Audit } from '@/lib/types';

const schema=z.object({url:z.string().url()});
export const maxDuration=60;
export async function POST(req:Request){
  try{
    const parsed=schema.parse(await req.json()); const u=new URL(parsed.url); if(!/^https?:$/.test(u.protocol)) return NextResponse.json({error:'Only HTTP(S) websites are supported.'},{status:400});
    const id=crypto.randomUUID();
    const seed:Audit={id,url:u.toString(),domain:u.hostname,status:'running',createdAt:new Date().toISOString(),pages:[],findings:[]}; createAudit(seed);
    const {pages,robots}=await crawlSite(u.toString());
    const findings=runDeterministicRules(pages,robots);
    const aiSummary=await analyzeAudit({url:seed.url,domain:seed.domain,pages,findings}).catch(()=>null);
    const audit:Audit={...seed,status:'complete',pages,findings,aiSummary:aiSummary||undefined}; createAudit(audit);
    return NextResponse.json({id,auditId:id,summary:summarizeFindings(findings)});
  }catch(err){ return NextResponse.json({error:err instanceof Error?err.message:'Invalid request'},{status:400}); }
}
