import type { ActionableFinding, BrowserEvidence, Confidence, Evidence, Finding, InsightArea, InsightScope, Priority, Severity } from '../types';

const SECURITY_HEADER_CHECKS = new Set(['SEC-003','SEC-004','SEC-005','SEC-007','SEC-008']);
const PERFORMANCE_CHECKS = new Set(['PERF-001','PERF-003','PERF-004','PERF-005','PERF-006','PERF-007','PERF-022','PERF-023','PERF-024']);

function id(){ return `insight_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }

function areasFor(category:string, checkId:string):InsightArea[]{
  if(PERFORMANCE_CHECKS.has(checkId) || /performance/i.test(category)) return ['performance','development'];
  if(/security/i.test(category) || checkId.startsWith('SEC-')) return ['security','development'];
  if(/analytics/i.test(category) || checkId.startsWith('ANALYTICS-')) return ['analytics','marketing','development'];
  if(/content/i.test(category) || checkId.startsWith('CONTENT-') || checkId.startsWith('AI-')) return ['content','marketing'];
  if(/search|seo/i.test(category) || checkId.startsWith('SEO-') || checkId.startsWith('LOCAL-') || checkId.startsWith('SCHEMA-')) return ['seo','content'];
  if(/metadata|links|crawlability|domain/i.test(category) || checkId.startsWith('META-') || checkId.startsWith('LINK-') || checkId.startsWith('CRAWL-') || checkId.startsWith('TECH-')) return ['development','seo'];
  if(/trust/i.test(category) || checkId.startsWith('TRUST-')) return ['marketing','content'];
  return ['development'];
}

function ownersFor(areas:InsightArea[], checkId:string):string[]{
  if(checkId==='SEC-024') return ['legal','development'];
  const owners:string[]=[];
  if(areas.includes('development')) owners.push('web development');
  if(areas.includes('seo')) owners.push('SEO');
  if(areas.includes('marketing')) owners.push('marketing');
  if(areas.includes('content')) owners.push('content');
  if(areas.includes('performance') && !owners.includes('web development')) owners.push('web development');
  if(areas.includes('security')) owners.push('DevOps / security');
  if(areas.includes('analytics')) owners.push('analytics / marketing');
  if(areas.includes('legal')) owners.push('legal');
  return [...new Set(owners)];
}

function priorityFor(severity:Severity, checkId:string):Priority{
  if(checkId==='SEC-024' || checkId==='LINK-016') return 'immediate';
  if(severity==='critical') return 'immediate';
  if(severity==='high') return 'this_week';
  if(severity==='medium') return 'this_month';
  if(severity==='low') return 'when_convenient';
  return 'this_quarter';
}

function scopeFor(count:number, checkId:string):InsightScope{
  if(SECURITY_HEADER_CHECKS.has(checkId) || checkId==='ANALYTICS-002') return 'origin';
  if(count>=3) return 'template';
  return 'page';
}

function confidenceFor(findings:Finding[]):Confidence{
  if(findings.some(f=>f.confidence==='needs_verification')) return 'needs_verification';
  if(findings.every(f=>f.confidence==='confirmed')) return 'confirmed';
  if(findings.some(f=>f.confidence==='likely')) return 'likely';
  return 'possible';
}

function evidenceFrom(f:Finding, affectedUrls:string[]):Evidence[]{
  const evidence:Evidence[] = [{label:'Affected pages',value:String(affectedUrls.length)}];
  if(f.evidence){
    for(const [key,value] of Object.entries(f.evidence).slice(0,5)){
      if(value===undefined || value===null) continue;
      const rendered = typeof value === 'string' ? value : JSON.stringify(value);
      evidence.push({label:key,value:rendered.slice(0,420)});
    }
  }
  const seen=new Set<string>();
  return evidence.filter(item=>{ const key=`${item.label}::${item.value}`; if(seen.has(key)) return false; seen.add(key); return true; });
}

function groupKey(f:Finding){
  if(SECURITY_HEADER_CHECKS.has(f.checkId)) return 'site-security-headers';
  if(f.checkId==='MEDIA-007') return 'missing-image-dimensions';
  if(f.checkId==='META-024') return 'duplicate-ids';
  if(f.checkId==='ANALYTICS-002') return 'analytics-missing';
  return f.checkId;
}

function specialText(key:string, findings:Finding[], affectedUrls:string[]){
  const first=findings[0];
  if(key==='site-security-headers') return {
    title:'Several standard browser security protections are missing',
    what:`${new Set(findings.map(f=>f.checkId)).size} security-header controls were reported missing across ${affectedUrls.length} crawled page${affectedUrls.length===1?'':'s'}.`,
    why:'These controls are configured at the response/origin level and can reduce common browser-side security exposure. Because the same gap appears across pages, it should be fixed centrally rather than page by page.',
    fix:'Review and add the missing headers at the web server, reverse proxy or CDN level. Deploy a tested policy, then verify the production response headers.',
  };
  if(key==='missing-image-dimensions') return {
    title:'Images are missing explicit dimensions and may contribute to layout shifts',
    what:`${affectedUrls.length} page${affectedUrls.length===1?'':'s'} contain image elements without explicit width/height information.`,
    why:'When the browser cannot reserve the intended image space early, content can move as images arrive. This is a common contributor to layout instability.',
    fix:'Add intrinsic width and height attributes or stable aspect-ratio containers to informative images and verify layout stability after deployment.',
  };
  if(key==='duplicate-ids') return {
    title:'Duplicate HTML IDs can break anchors, labels and scripts',
    what:`Duplicate HTML id values were found on ${affectedUrls.length} page${affectedUrls.length===1?'':'s'}.`,
    why:'IDs are expected to be unique within a document. Duplicates can make fragment links, form labels and JavaScript selectors behave unpredictably.',
    fix:'Make each ID unique within the page or remove IDs that are not required.',
  };
  if(key==='analytics-missing') return {
    title:'Analytics implementation could not be verified',
    what:`No common analytics or tag-manager identifier was detected on ${affectedUrls.length} sampled page${affectedUrls.length===1?'':'s'}.`,
    why:'This may mean measurement is genuinely absent or implemented through a different mechanism. Without reliable measurement, acquisition and conversion work is harder to evaluate.',
    fix:'Verify the analytics implementation in production, confirm consent handling and make sure important conversion events are being recorded.',
  };
  return {
    title:first.title,
    what:first.message,
    why:first.why,
    fix:first.fix,
  };
}

export function findingsToInsights(findings:Finding[]):ActionableFinding[]{
  const groups=new Map<string,Finding[]>();
  for(const finding of findings){
    if(finding.severity==='info') continue;
    const key=groupKey(finding); const list=groups.get(key)||[]; list.push(finding); groups.set(key,list);
  }
  return [...groups.entries()].map(([key,list])=>{
    const affectedUrls=[...new Set(list.map(f=>f.pageUrl).filter(Boolean))];
    const first=list[0];
    const areas=[...new Set(list.flatMap(f=>areasFor(f.category,f.checkId)))];
    const severity=list.reduce<Severity>((worst,f)=>{
      const rank:{[k in Severity]:number}={critical:5,high:4,medium:3,low:2,info:1};
      return rank[f.severity]>rank[worst]?f.severity:worst;
    },'info');
    const text=specialText(key,list,affectedUrls);
    const relatedChecks=[...new Set(list.map(f=>f.checkId))];
    return {
      id:id(), title:text.title, areas, severity, priority:priorityFor(severity,first.checkId),
      confidence:confidenceFor(list), scope:scopeFor(affectedUrls.length,first.checkId), owner:ownersFor(areas,first.checkId),
      what:text.what, why:text.why, fix:text.fix, affectedUrls, relatedChecks,
      evidence:list.slice(0,3).flatMap(f=>evidenceFrom(f,affectedUrls)).slice(0,10),
    };
  }).sort((a,b)=>{
    const p:{[k in Priority]:number}={immediate:5,this_week:4,this_month:3,this_quarter:2,when_convenient:1};
    const s:{[k in Severity]:number}={critical:5,high:4,medium:3,low:2,info:1};
    return (p[b.priority]*10+s[b.severity])-(p[a.priority]*10+s[a.severity]);
  });
}

function perfStatus(metric:'lcp'|'inp'|'cls'|'ttfb', value:number):'good'|'needs_improvement'|'poor'{
  if(metric==='lcp') return value<=2500?'good':value<=4000?'needs_improvement':'poor';
  if(metric==='inp') return value<=200?'good':value<=500?'needs_improvement':'poor';
  if(metric==='cls') return value<=0.1?'good':value<=0.25?'needs_improvement':'poor';
  return value<=800?'good':value<=1800?'needs_improvement':'poor';
}

function performanceFindingId(metric:string,url:string){ return `browser_${metric}_${Buffer.from(url).toString('base64url').slice(0,18)}`; }
function performanceFinding(url:string, checkId:string, title:string, severity:Severity, message:string, why:string, fix:string, evidence:Record<string,unknown>):Finding{
  return {id:performanceFindingId(checkId,url),checkId,category:'Performance',severity,confidence:'confirmed',title,pageUrl:url,message,why,fix,evidence};
}

export function browserEvidenceToFindings(browser:BrowserEvidence[]):Finding[]{
  const out:Finding[]=[];
  for(const b of browser){
    if(b.error) continue;
    if(b.lcpMs!==null){
      const status=perfStatus('lcp',b.lcpMs);
      if(status!=='good') out.push(performanceFinding(b.url,'PERF-001','Poor LCP',status==='poor'?'high':'medium',`LCP was ${Math.round(b.lcpMs)} ms on the tested ${b.device} viewport.`,`LCP measures when the largest visible content element finishes rendering. A slower result means the main content is taking longer to become useful to the visitor.`,`Identify the LCP element first, then reduce its load/render delay. Optimise large hero media, ensure the LCP resource is discoverable early, reduce render-blocking work and re-test.`,{lcpMs:Math.round(b.lcpMs),lcpElement:b.lcpElement,lcpResource:b.lcpResource,lcpResourceTransferBytes:b.lcpResourceTransferBytes,viewport:b.viewport,device:b.device}));
    }
    if(b.cls!==null){
      const status=perfStatus('cls',b.cls);
      if(status!=='good') out.push(performanceFinding(b.url,'PERF-004','Poor CLS',status==='poor'?'high':'medium',`CLS was ${b.cls.toFixed(3)} on the tested ${b.device} viewport.`,`Unexpected movement can disrupt reading and cause visitors to click the wrong element.`,`Reserve space for images, embeds and dynamic content, and review the elements listed as layout-shift sources.`,{cls:Number(b.cls.toFixed(3)),layoutShiftSources:b.layoutShiftSources,viewport:b.viewport,device:b.device}));
    }
    if(b.inpMs!==null){
      const status=perfStatus('inp',b.inpMs);
      if(status!=='good') out.push(performanceFinding(b.url,'PERF-006','Poor INP',status==='poor'?'high':'medium',`The measured INP was ${Math.round(b.inpMs)} ms on the tested ${b.device} viewport.`,`Slow interaction response makes buttons, menus and controls feel unresponsive.`,`Profile long main-thread tasks and expensive event handlers, reduce JavaScript work and re-test with representative interactions.`,{inpMs:Math.round(b.inpMs),viewport:b.viewport,device:b.device}));
    }
    if(b.ttfbMs!==null){
      const status=perfStatus('ttfb',b.ttfbMs);
      if(status!=='good') out.push(performanceFinding(b.url,'PERF-007','Slow TTFB',status==='poor'?'high':'medium',`TTFB was ${Math.round(b.ttfbMs)} ms in this lab run.`,`TTFB reflects how quickly the initial response begins arriving and can delay every downstream loading step.`,`Review server processing time, caching, CDN configuration, redirects and backend work on the initial document request.`,{ttfbMs:Math.round(b.ttfbMs),viewport:b.viewport,device:b.device}));
    }
    if(b.overflow) out.push(performanceFinding(b.url,'PERF-024','Mobile horizontal overflow detected','high','The document was wider than the tested mobile viewport.','Horizontal overflow forces sideways scrolling or can clip important content and controls on mobile.','Find the overflowing element, remove fixed-width assumptions, constrain media and containers to the viewport, then re-test at mobile widths.',{documentWidth:b.viewport.width+1,viewportWidth:b.viewport.width}));
  }
  return out;
}

export function combineFindingsAndBrowser(findings:Finding[], browser:BrowserEvidence[]):ActionableFinding[]{
  return findingsToInsights([...findings,...browserEvidenceToFindings(browser)]);
}

export function summarizeInsights(insights:ActionableFinding[]){
  const byPriority=insights.reduce<Record<string,number>>((a,i)=>(a[i.priority]=(a[i.priority]||0)+1,a),{});
  const byArea=insights.reduce<Record<string,number>>((a,i)=>{ for(const area of i.areas) a[area]=(a[area]||0)+1; return a; },{});
  const bySeverity=insights.reduce<Record<string,number>>((a,i)=>(a[i.severity]=(a[i.severity]||0)+1,a),{});
  return {total:insights.length,byPriority,byArea,bySeverity};
}
