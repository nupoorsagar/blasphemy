'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';

type Finding={id:string;checkId:string;category:string;severity:string;confidence:string;title:string;pageUrl:string;message:string;why:string;fix:string;evidence?:Record<string,unknown>};
type Audit={id:string;url:string;status:string;pages:{url:string;status:number;title:string}[];findings:Finding[];aiSummary?:{summary:string;priorities:string[];actions:string[]}};
export default function AuditPage({params}:{params:Promise<{id:string}>}){
 const [audit,setAudit]=useState<Audit|null>(null); const [err,setErr]=useState('');
 useEffect(()=>{params.then(({id})=>fetch(`/api/audits/${id}`).then(r=>r.json()).then(d=>d.error?setErr(d.error):setAudit(d)).catch(e=>setErr(e.message)));},[params]);
 if(err) return <main className="container dashboard"><p>{err}</p><Link href="/">← New audit</Link></main>;
 if(!audit) return <main className="container dashboard"><div className="status"><span className="dot"/> Loading audit…</div></main>;
 const counts=audit.findings.reduce<Record<string,number>>((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{});
 return <main><div className="container dashboard">
  <div className="toolbar"><div><div className="kicker">Audit report</div><h1>{audit.url}</h1><div className="muted">{audit.pages.length} pages crawled · {audit.findings.length} findings</div></div><Link href="/" className="badge">New audit</Link></div>
  <div className="metrics">{['critical','high','medium','low'].map(k=><div className="metric" key={k}><span className={`sev ${k}`}>{k}</span><strong>{counts[k]||0}</strong></div>)}</div>
  {audit.aiSummary && <section className="card" style={{margin:'18px 0'}}><div className="kicker">AI interpretation</div><h2>What needs attention</h2><p>{audit.aiSummary.summary}</p><div className="grid" style={{marginTop:12}}><div><strong>Priorities</strong>{audit.aiSummary.priorities.map((x,i)=><p className="muted" key={i}>→ {x}</p>)}</div><div><strong>Actions</strong>{audit.aiSummary.actions.map((x,i)=><p className="muted" key={i}>→ {x}</p>)}</div><div><strong>Method</strong><p className="muted">AI is given the crawl evidence and deterministic findings only; it should not invent website facts.</p></div></div></section>}
  <section><div className="toolbar"><h2>Findings</h2><span className="muted">Evidence-first recommendations</span></div><div className="findings">{audit.findings.map(f=><article className="finding" key={f.id}><div className="finding-head"><div><span className="code">{f.checkId} · {f.category}</span><h3>{f.title}</h3></div><span className={`sev ${f.severity}`}>{f.severity}</span></div><p>{f.message}</p><p className="muted"><b>Why:</b> {f.why}</p><p className="muted"><b>Fix:</b> {f.fix}</p><div className="code">{f.pageUrl} · confidence: {f.confidence}{f.evidence?` · evidence: ${JSON.stringify(f.evidence).slice(0,500)}`:''}</div></article>)}</div></section>
 </div></main>
}
