'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Insight={id:string;title:string;areas:string[];severity:string;priority:string;confidence:string;scope:string;owner:string[];what:string;why:string;fix:string;affectedUrls:string[];relatedChecks:string[];evidence:{label:string;value:string}[]};
type BrowserEvidence={url:string;browserSource:string;viewport:{width:number;height:number};device:string;measuredAt:string;lcpMs:number|null;cls:number|null;inpMs:number|null;fcpMs:number|null;ttfbMs:number|null;lcpElement:string|null;lcpResource:string|null;lcpResourceTransferBytes:number|null;longTasks:number;longestLongTaskMs:number|null;layoutShiftSources:string[];overflow:boolean;error?:string;notes:string[]};
type AIStrategic={title:string;area:string;priority:string;what:string;why:string;fix:string;owner:string[];confidence:string};
type Audit={id:string;url:string;status:string;pages:{url:string;status:number;title:string;resourceKind?:string}[];findings:{severity:string}[];insights?:Insight[];browserEvidence?:BrowserEvidence[];aiSummary?:{summary:string;priorities:string[];actions:string[];strategicInsights?:AIStrategic[]}};

const teams=[['all','All insights'],['development','Development & Technical'],['seo','SEO'],['marketing','Marketing'],['content','Content'],['performance','Performance'],['ux','UX & Conversion'],['security','Security'],['analytics','Analytics'],['legal','Legal']];
const priorityLabels:{[key:string]:string}={immediate:'Immediate',this_week:'This week',this_month:'This month',this_quarter:'This quarter',when_convenient:'When convenient'};
function metricLabel(value:number|null,unit:string){ return value===null?'—':`${unit==='ms'?Math.round(value):value.toFixed(3)}${unit}`; }
function formatBytes(value:number|null){ if(value===null) return '—'; if(value<1024) return `${value} B`; return `${(value/1024/1024).toFixed(2)} MB`; }
function Metric({label,value,status}:{label:string;value:string;status?:string}){return <div className="metric"><span className="muted">{label}</span><strong>{value}</strong>{status&&<span className={`status-pill ${status}`}>{status.replace('_',' ')}</span>}</div>}

export default function AuditPage({params}:{params:Promise<{id:string}>}){
 const [audit,setAudit]=useState<Audit|null>(null); const [err,setErr]=useState(''); const [team,setTeam]=useState('all'); const [priority,setPriority]=useState('all');
 useEffect(()=>{params.then(({id})=>fetch(`/api/audits/${id}`).then(r=>r.json()).then(d=>d.error?setErr(d.error):setAudit(d)).catch(e=>setErr(e.message)));},[params]);
 const insights=useMemo(()=>{
   const all=audit?.insights||[];
   return all.filter(i=>(team==='all'||i.areas.includes(team))&&(priority==='all'||i.priority===priority));
 },[audit,team,priority]);
 if(err) return <main className="container dashboard"><p>{err}</p><Link href="/">← New audit</Link></main>;
 if(!audit) return <main className="container dashboard"><div className="status"><span className="dot"/> Loading audit…</div></main>;
 const allInsights=audit.insights||[];
 const high=allInsights.filter(i=>i.severity==='critical'||i.severity==='high').length;
 const browser=audit.browserEvidence||[];
 return <main><div className="container dashboard">
  <div className="toolbar"><div><div className="kicker">Website Intelligence Report</div><h1>{audit.url}</h1><div className="muted">{audit.pages.filter(p=>!p.resourceKind||p.resourceKind==='page').length} pages analysed · {allInsights.length} actionable insights · {audit.findings.length} raw observations</div></div><Link href="/" className="badge">New audit</Link></div>
  <section className="hero-summary">
    <div><div className="kicker">What should we fix?</div><h2>{high} high-priority {high===1?'issue':'issues'} need attention</h2><p className="muted">Blasphemy turns technical observations into actions, owners, priorities and evidence instead of treating every rule failure as a separate problem.</p></div>
    <div className="priority-strip">{Object.keys(priorityLabels).map(p=><button key={p} className={priority===p?'active':''} onClick={()=>setPriority(priority===p?'all':p)}>{priorityLabels[p]} <b>{allInsights.filter(i=>i.priority===p).length}</b></button>)}</div>
  </section>

  <section className="performance-panel">
   <div className="toolbar"><div><div className="kicker">Performance Intelligence</div><h2>Real browser measurements</h2></div><span className="muted">Mobile lab runs · {browser.length} pages</span></div>
   {browser.length===0 ? <p className="muted">Browser performance data was unavailable for this audit. The crawl and deterministic audit are still available.</p> : <div className="perf-grid">{browser.slice(0,6).map(b=><div className="perf-card" key={b.url}>
      <div className="code">{new URL(b.url).pathname || '/'}</div>
      <div className="metrics compact">
       <Metric label="LCP" value={metricLabel(b.lcpMs,'ms')} status={b.lcpMs===null?'':b.lcpMs<=2500?'good':b.lcpMs<=4000?'needs_improvement':'poor'}/>
       <Metric label="CLS" value={metricLabel(b.cls,'')} status={b.cls===null?'':b.cls<=0.1?'good':b.cls<=0.25?'needs_improvement':'poor'}/>
       <Metric label="INP" value={metricLabel(b.inpMs,'ms')} status={b.inpMs===null?'not measured':b.inpMs<=200?'good':b.inpMs<=500?'needs_improvement':'poor'}/>
       <Metric label="TTFB" value={metricLabel(b.ttfbMs,'ms')}/>
      </div>
      {b.lcpElement&&<p className="muted"><b>LCP element:</b> {b.lcpElement}{b.lcpResource&&<> · {formatBytes(b.lcpResourceTransferBytes)}</>}</p>}
      {b.notes.map((n,i)=><p className="muted note" key={i}>{n}</p>)}
    </div>)}</div>}
  </section>

  {audit.aiSummary&&<section className="card ai-card"><div className="kicker">AI interpretation</div><h2>Cross-page opportunities</h2><p>{audit.aiSummary.summary}</p><div className="grid" style={{marginTop:12}}><div><strong>Priorities</strong>{audit.aiSummary.priorities.map((x,i)=><p className="muted" key={i}>→ {x}</p>)}</div><div><strong>Actions</strong>{audit.aiSummary.actions.map((x,i)=><p className="muted" key={i}>→ {x}</p>)}</div></div></section>}

  <section><div className="toolbar"><div><div className="kicker">Actionable insights</div><h2>What to do next</h2></div><span className="muted">{insights.length} shown</span></div>
   <div className="filters">{teams.map(([value,label])=><button key={value} className={team===value?'active':''} onClick={()=>setTeam(value)}>{label}</button>)}</div>
   <div className="findings">{insights.map(i=><article className="finding" key={i.id}>
     <div className="finding-head"><div><div className="chips"><span className={`sev ${i.severity}`}>{i.severity}</span><span className="chip">{priorityLabels[i.priority]}</span><span className="chip">{i.confidence.replace('_',' ')}</span><span className="chip">{i.scope}</span></div><h3>{i.title}</h3></div></div>
     <p><b>What.</b> {i.what}</p><p><b>Why it matters.</b> {i.why}</p><p><b>Fix.</b> {i.fix}</p>
     <div className="insight-meta"><div><b>Owner</b><span>{i.owner.join(' · ')}</span></div><div><b>Areas</b><span>{i.areas.join(' · ')}</span></div><div><b>Affected</b><span>{i.affectedUrls.length} URL{i.affectedUrls.length===1?'':'s'}</span></div></div>
     {i.evidence.length>0&&<details><summary>Evidence</summary><div className="evidence-grid">{i.evidence.map((e,n)=><div key={n}><b>{e.label}</b><span>{e.value}</span></div>)}</div></details>}
   </article>)}</div>
   {insights.length===0&&<div className="empty card"><h3>No insights match this filter.</h3><p className="muted">Try another team or priority.</p></div>}
  </section>

  {audit.aiSummary?.strategicInsights?.length ? <section><div className="toolbar"><div><div className="kicker">Strategic analysis</div><h2>Marketing, SEO & content opportunities</h2></div></div><div className="findings">{audit.aiSummary.strategicInsights.map((i,n)=><article className="finding" key={n}><div className="finding-head"><div><div className="chips"><span className="chip">{i.area}</span><span className="chip">{priorityLabels[i.priority]}</span><span className="chip">{i.confidence.replace('_',' ')}</span></div><h3>{i.title}</h3></div></div><p><b>What.</b> {i.what}</p><p><b>Why it matters.</b> {i.why}</p><p><b>Fix.</b> {i.fix}</p><div className="insight-meta"><div><b>Owner</b><span>{i.owner.join(' · ')}</span></div></div></article>)}</div></section> : null}
 </div></main>
}
