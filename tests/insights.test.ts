import { describe, expect, it } from 'vitest';
import { browserEvidenceToFindings, findingsToInsights } from '../lib/engine/insights';
import type { BrowserEvidence, Finding } from '../lib/types';

const finding=(overrides:Partial<Finding>={}):Finding=>({
  id:crypto.randomUUID(), checkId:'MEDIA-007', category:'Media', severity:'medium', confidence:'confirmed',
  title:'Images missing explicit dimensions', pageUrl:'https://example.com/', message:'4 image(s) have no explicit dimensions.',
  why:'Missing dimensions can contribute to layout movement during loading.', fix:'Provide width and height attributes.', evidence:{count:4}, ...overrides,
});

describe('actionable insight engine',()=>{
  it('groups repeated page observations into one insight',()=>{
    const result=findingsToInsights([finding(),finding({pageUrl:'https://example.com/services'}),finding({pageUrl:'https://example.com/about'})]);
    expect(result).toHaveLength(1);
    expect(result[0].affectedUrls).toHaveLength(3);
    expect(result[0].owner).toContain('web development');
  });

  it('correlates missing security headers at origin scope',()=>{
    const result=findingsToInsights([
      finding({checkId:'SEC-003',category:'Security & privacy',title:'HSTS missing'}),
      finding({checkId:'SEC-005',category:'Security & privacy',title:'CSP missing'}),
      finding({checkId:'SEC-007',category:'Security & privacy',title:'Referrer-Policy missing'}),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe('origin');
    expect(result[0].title).toMatch(/security protections/i);
    expect(result[0].relatedChecks).toEqual(expect.arrayContaining(['SEC-003','SEC-005','SEC-007']));
  });
});

describe('browser performance findings',()=>{
  const base:BrowserEvidence={url:'https://example.com/',browserSource:'test',viewport:{width:390,height:844},device:'mobile',measuredAt:new Date().toISOString(),lcpMs:4800,cls:0.28,inpMs:null,fcpMs:1900,ttfbMs:1200,lcpElement:'img#hero',lcpResource:'https://example.com/hero.webp',lcpResourceTransferBytes:2800000,longTasks:3,longestLongTaskMs:220,layoutShiftSources:['img#hero'],overflow:false,notes:[]};
  it('creates an actionable LCP finding with evidence',()=>{
    const result=browserEvidenceToFindings([base]);
    const lcp=result.find(x=>x.checkId==='PERF-001');
    expect(lcp?.severity).toBe('high');
    expect(lcp?.evidence?.lcpMs).toBe(4800);
    expect(lcp?.evidence?.lcpElement).toBe('img#hero');
  });
  it('does not invent an INP result when the browser run had no interaction',()=>{
    expect(browserEvidenceToFindings([base]).some(x=>x.checkId==='PERF-006')).toBe(false);
  });
});
