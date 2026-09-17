import { collectBrowserEvidence } from '../lib/browser';
import fs from 'node:fs/promises';
import { crawlSite } from '../lib/engine/crawl';
import { runDeterministicRules } from '../lib/engine/rules';
import { browserEvidenceToFindings, findingsToInsights, summarizeInsights } from '../lib/engine/insights';
import { analyzeAudit } from '../lib/ai';

async function main(){
  const url=process.argv[2];
  const maxPages=Number(process.argv[3]||process.env.MAX_CRAWL_PAGES||30);
  const auditId=process.argv[4]||process.env.AUDIT_ID||`local_${Date.now()}`;
  if(!url){ console.error('Usage: npm run worker -- https://example.com 30 audit-id'); process.exit(1); }

  const {pages,robots}=await crawlSite(url,maxPages);
  const findings=runDeterministicRules(pages,robots);
  const browserUrls=pages.filter(p=>!p.resourceKind || p.resourceKind==='page').slice(0,Number(process.env.BROWSER_AUDIT_PAGES||10)).map(p=>p.url);
  const browserEvidence=await collectBrowserEvidence(browserUrls).catch(error=>{
    console.warn('Browser audit unavailable:',error instanceof Error?error.message:error);
    return [];
  });
  const insights=findingsToInsights([...findings,...browserEvidenceToFindings(browserEvidence)]);
  const aiSummary=await analyzeAudit({url,domain:new URL(url).hostname,pages,findings,insights,browserEvidence}).catch(()=>null);
  const result={id:auditId,url,createdAt:new Date().toISOString(),pages,findings,insights,browserEvidence,aiSummary,summary:summarizeInsights(insights)};
  const dir='data'; await fs.mkdir(dir,{recursive:true});
  const path=`${dir}/${result.id}.json`;
  await fs.writeFile(path,JSON.stringify(result,null,2));
  console.log(`Saved ${path}`);
  console.log(`Pages: ${pages.length} | Raw findings: ${findings.length} | Actionable insights: ${insights.length} | Browser pages: ${browserEvidence.length}`);

  if(process.env.AUDIT_CALLBACK_BASE_URL && process.env.AUDIT_CALLBACK_SECRET){
    const endpoint=process.env.AUDIT_CALLBACK_BASE_URL.replace('{id}',encodeURIComponent(auditId));
    await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-audit-secret':process.env.AUDIT_CALLBACK_SECRET},body:JSON.stringify(result)}).catch(e=>console.warn('Callback failed:',e.message));
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
