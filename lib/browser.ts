import fs from 'node:fs';
import { chromium, type Browser } from 'playwright';
import type { BrowserEvidence } from './types';

function windowsChromeCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  return [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    localAppData ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    programFiles ? `${programFiles}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    programFilesX86 ? `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    localAppData ? `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    programFiles ? `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    programFilesX86 ? `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
  ].filter((value): value is string => Boolean(value));
}

export async function launchAuditBrowser(): Promise<{ browser: Browser; source: string }> {
  const explicit = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`PLAYWRIGHT_EXECUTABLE_PATH does not exist: ${explicit}`);
    return { browser: await chromium.launch({ headless: true, executablePath: explicit }), source: explicit };
  }
  for (const executablePath of windowsChromeCandidates()) {
    if (!fs.existsSync(executablePath)) continue;
    try { return { browser: await chromium.launch({ headless: true, executablePath }), source: executablePath }; } catch {}
  }
  try { return { browser: await chromium.launch({ headless: true }), source: 'playwright-managed-chromium' }; }
  catch(error){
    const message = error instanceof Error ? error.message : 'Unknown browser launch error';
    throw new Error('No usable browser was found. Install Chrome/Edge, set PLAYWRIGHT_EXECUTABLE_PATH, or run `npx playwright install chromium`. ' + message);
  }
}

function safeSelector(element:Element|null):string|null{
  if(!element) return null;
  const tag=element.tagName.toLowerCase();
  const id=element.getAttribute('id');
  if(id) return `${tag}#${id}`;
  const classes=(element.getAttribute('class')||'').split(/\s+/).filter(Boolean).slice(0,2);
  return classes.length ? `${tag}.${classes.join('.')}` : tag;
}

export async function collectBrowserEvidence(urls:string[]):Promise<BrowserEvidence[]>{
  if(!urls.length) return [];
  const {browser,source}=await launchAuditBrowser();
  const out:BrowserEvidence[]=[];
  const viewport={width:390,height:844};
  try{
    for(const url of urls){
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const measuredAt=new Date().toISOString();
      try{
        await page.addInitScript(()=>{
          (window as any).__blasphemyVitals={lcp:null,cls:0,inp:null,lcpElement:null,lcpResource:null,lcpResourceTransferBytes:null,longTasks:0,longestLongTask:0,layoutShiftSources:[]};
          try{
            new PerformanceObserver(list=>{
              const entries=list.getEntries() as any[];
              const last=entries[entries.length-1];
              if(last){
                const state=(window as any).__blasphemyVitals;
                state.lcp=last.startTime;
                state.lcpElement=last.element ? `${last.element.tagName.toLowerCase()}${last.element.id ? `#${last.element.id}` : ''}` : null;
                state.lcpResource=last.url||last.element?.currentSrc||last.element?.src||null;
              }
            }).observe({type:'largest-contentful-paint',buffered:true} as any);
          }catch{}
          try{
            new PerformanceObserver(list=>{
              const state=(window as any).__blasphemyVitals;
              for(const entry of list.getEntries() as any[]){
                if(entry.hadRecentInput) continue;
                state.cls += entry.value || 0;
                const target=entry.sources?.[0]?.node;
                if(target){ const key=`${target.tagName?.toLowerCase()||'element'}${target.id?`#${target.id}`:''}`; if(!state.layoutShiftSources.includes(key)) state.layoutShiftSources.push(key); }
              }
            }).observe({type:'layout-shift',buffered:true} as any);
          }catch{}
          try{
            new PerformanceObserver(list=>{
              const state=(window as any).__blasphemyVitals;
              for(const entry of list.getEntries() as any[]){ state.longTasks += 1; state.longestLongTask=Math.max(state.longestLongTask,entry.duration||0); }
            }).observe({type:'longtask',buffered:true} as any);
          }catch{}
          try{
            new PerformanceObserver(list=>{
              const state=(window as any).__blasphemyVitals;
              for(const entry of list.getEntries() as any[]){ if(typeof entry.duration==='number' && entry.duration>=16) state.inp=Math.max(state.inp||0,entry.duration); }
            }).observe({type:'event',buffered:true,durationThreshold:16} as any);
          }catch{}
        });
        await page.goto(url,{waitUntil:'networkidle',timeout:30000});
        await page.waitForTimeout(2000);
        const data=await page.evaluate(()=>{
          const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
          const state=(window as any).__blasphemyVitals||{};
          const resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          const match=state.lcpResource ? resources.find((r)=>r.name===state.lcpResource) : undefined;
          const width=document.documentElement.scrollWidth;
          const viewportWidth=window.innerWidth;
          return {
            lcpMs:typeof state.lcp==='number'?state.lcp:null,
            cls:typeof state.cls==='number'?state.cls:null,
            inpMs:typeof state.inp==='number'?state.inp:null,
            fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime||null,
            ttfbMs:navigation?.responseStart||null,
            lcpElement: state.lcpElement||null,
            lcpResource:state.lcpResource||null,
            lcpResourceTransferBytes:match?.transferSize ?? null,
            longTasks:state.longTasks||0,
            longestLongTaskMs:state.longestLongTask||null,
            layoutShiftSources:state.layoutShiftSources||[],
            overflow:width>viewportWidth+2,
          };
        });
        const notes:string[]=[];
        if(data.inpMs===null) notes.push('INP was not measured because this run did not contain a qualifying real user interaction.');
        notes.push('Lab measurement on a 390×844 mobile viewport; field data may differ.');
        out.push({url,browserSource:source,viewport,device:'mobile',measuredAt,...data,notes});
      }catch(error){
        out.push({url,browserSource:source,viewport,device:'mobile',measuredAt,lcpMs:null,cls:null,inpMs:null,fcpMs:null,ttfbMs:null,lcpElement:null,lcpResource:null,lcpResourceTransferBytes:null,longTasks:0,longestLongTaskMs:null,layoutShiftSources:[],overflow:false,error:error instanceof Error?error.message:'browser error',notes:['Browser measurement failed for this URL.']});
      }finally{ await page.close(); }
    }
  }finally{ await browser.close(); }
  return out;
}
