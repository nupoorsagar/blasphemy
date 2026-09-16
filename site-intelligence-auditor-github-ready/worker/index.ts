import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { crawlSite } from '../lib/engine/crawl';
import { runDeterministicRules } from '../lib/engine/rules';
import { analyzeAudit } from '../lib/ai';

async function browserEvidence(urls:string[]){
  const browser=await chromium.launch({headless:true}); const out=[];
  try{
    for(const url of urls){
      const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
      try{
        const webVitals = await page.evaluateOnNewDocument(() => {
          (window as any).__siaVitals={lcp:0,cls:0,inp:0};
          new PerformanceObserver(list=>{ const e=list.getEntries().pop() as any; if(e) (window as any).__siaVitals.lcp=e.startTime; }).observe({type:'largest-contentful-paint',buffered:true});
          new PerformanceObserver(list=>{ for(const e of list.getEntries() as any) if(!e.hadRecentInput) (window as any).__siaVitals.cls += e.value; }).observe({type:'layout-shift',buffered:true});
          new PerformanceObserver(list=>{ const e=list.getEntries().pop() as any; if(e) (window as any).__siaVitals.inp=Math.max((window as any).__siaVitals.inp,e.duration||0); }).observe({type:'event',buffered:true,durationThreshold:40} as any);
        });
        void webVitals;
        const started=Date.now(); await page.goto(url,{waitUntil:'networkidle',timeout:25000});
        const data=await page.evaluate(()=>({
          title:document.title, width:document.documentElement.scrollWidth, viewport:window.innerWidth,
          buttons:[...document.querySelectorAll('button,a')].filter((e:any)=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&r.bottom<=window.innerHeight+10}).length,
          htmlSize:document.documentElement.outerHTML.length,
          vitals:(window as any).__siaVitals||{lcp:0,cls:0,inp:0}
        }));
        out.push({url,...data,loadMs:Date.now()-started,overflow:data.width>data.viewport+2});
      }catch(e){ out.push({url,error:e instanceof Error?e.message:'browser error'}); }
      await page.close();
    }
  } finally { await browser.close(); }
  return out;
}

async function main(){
  const url=process.argv[2]; const maxPages=Number(process.argv[3]||process.env.MAX_CRAWL_PAGES||30); const auditId=process.argv[4]||process.env.AUDIT_ID||`local_${Date.now()}`; if(!url){ console.error('Usage: npm run worker -- https://example.com 30'); process.exit(1); }
  const {pages,robots}=await crawlSite(url,maxPages); const findings=runDeterministicRules(pages,robots); const browser=await browserEvidence(pages.slice(0,10).map(p=>p.url));
  const aiSummary=await analyzeAudit({url,domain:new URL(url).hostname,pages,findings}).catch(()=>null);
  const result={id:auditId,url,createdAt:new Date().toISOString(),pages,findings,browserEvidence:browser,aiSummary};
  const dir='data'; await fs.mkdir(dir,{recursive:true}); const path=`${dir}/${result.id}.json`; await fs.writeFile(path,JSON.stringify(result,null,2)); console.log(`Saved ${path}`);
  if(process.env.AUDIT_CALLBACK_BASE_URL && process.env.AUDIT_CALLBACK_SECRET){
    const endpoint=process.env.AUDIT_CALLBACK_BASE_URL!.replace('{id}',encodeURIComponent(auditId));
    await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-audit-secret':process.env.AUDIT_CALLBACK_SECRET},body:JSON.stringify(result)}).catch(e=>console.warn('Callback failed:',e.message));
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
