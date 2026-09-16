'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function runAudit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await fetch('/api/audits', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start audit');
      router.push(`/audits/${data.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to start audit'); setBusy(false); }
  }

  return <main>
    <div className="container">
      <nav className="nav"><div className="brand">Site Intelligence Auditor</div><div className="badge">340-rule audit engine</div></nav>
      <section className="hero">
        <div className="kicker">Website intelligence, not another vanity score</div>
        <h1>Find what’s wrong. Understand why. Know what to fix.</h1>
        <p>Audit SEO, links, performance, accessibility, content, UX, trust, security and website consistency from one URL — then turn the evidence into practical fixes.</p>
        <form className="audit-form" onSubmit={runAudit}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" aria-label="Website URL" required />
          <button disabled={busy}>{busy ? 'Auditing…' : 'Run audit'}</button>
        </form>
        {error && <p style={{color:'var(--bad)',fontSize:14}}>{error}</p>}
      </section>
      <section className="section"><div className="grid">
        <div className="card"><div className="kicker">Technical</div><h3>Crawl & code</h3><p>Broken links, redirects, canonicals, robots, sitemaps, headers, source hygiene and production artefacts.</p></div>
        <div className="card"><div className="kicker">Growth</div><h3>Search & content</h3><p>Intent, topic coverage, metadata, duplicate content, positioning, trust evidence and internal linking.</p></div>
        <div className="card"><div className="kicker">Experience</div><h3>UX & performance</h3><p>Mobile behavior, Core Web Vitals, accessibility, conversion journeys and browser-level evidence.</p></div>
      </div></section>
      <footer className="footer">Built as a general-purpose website health and growth platform. AI analysis is optional and runs server-side.</footer>
    </div>
  </main>;
}
