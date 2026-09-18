import { NextResponse } from 'next/server';
import { updateAudit } from '@/lib/store';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const secret=process.env.AUDIT_CALLBACK_SECRET; if(secret && req.headers.get('x-audit-secret')!==secret) return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await params; const body=await req.json(); const updated=updateAudit(id,{status:'complete',pages:body.pages||[],findings:body.findings||[],insights:body.insights||[],browserEvidence:body.browserEvidence||[],robots:body.robots||'',sitemapUrls:body.sitemapUrls||[],aiSummary:body.aiSummary||undefined,dossier:body.dossier,analystRun:body.analystRun,judgeRun:body.judgeRun});
 if(!updated) return NextResponse.json({error:'Audit not found'},{status:404}); return NextResponse.json({ok:true});
}
