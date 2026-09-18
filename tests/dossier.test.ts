import { describe, expect, it } from 'vitest';
import { buildSiteDossier } from '../lib/dossier';
import type { PageData } from '../lib/types';

const page = (url:string, title:string, h1:string[], html:string, links:any[]=[]):PageData => ({
  url, status:200, contentType:'text/html', html, title, description:`Description for ${title}`, h1,
  headings:h1.map(text=>({level:1,text})), links, images:[], scripts:[], stylesheets:[], canonical:url,
  lang:'en-GB', wordCount:200, loadMs:100, headers:{}, cookies:[], sourceSize:html.length
});

describe('site dossier',()=>{
  it('builds page classifications and content zones',()=>{
    const pages=[page('https://example.com/','Example | Home',['Example'], '<html><body><header>Brand</header><nav><a href="/services">Services</a></nav><main><h1>Example</h1><p>Business software for healthcare organisations. Book a demo.</p><a href="/contact">Book a demo</a></main><footer>Privacy</footer></body></html>',[{href:'https://example.com/services',text:'Services',external:false}]), page('https://example.com/services/ai/','AI Services',['AI Development'], '<html><body><main><h1>AI Development</h1><p>AI development services for businesses.</p><a href="/contact">Request a quote</a></main></body></html>',[{href:'https://example.com/contact',text:'Request a quote',external:false}])];
    const dossier=buildSiteDossier({auditId:'a1',url:'https://example.com/',pages,robots:'User-agent: *\nAllow: /',sitemapUrls:['https://example.com/sitemap.xml'],discovered:pages.map(p=>p.url)});
    expect(dossier.crawl.pages[0].classification).toBe('homepage');
    expect(dossier.crawl.pages[1].classification).toBe('service');
    expect(dossier.crawl.pages[0].content.zones.main?.wordCount).toBeGreaterThan(0);
    expect(dossier.content.siteMessaging.primaryServices.length).toBeGreaterThan(0);
    expect(dossier.conversion.ctas.length).toBeGreaterThan(0);
    expect(dossier.evidence.items.length).toBeGreaterThan(0);
  });

  it('detects near duplicate pages and records derived facts',()=>{
    const common='<html><body><main><h1>AI Development Services</h1><p>We provide AI development services for businesses, automation, machine learning and secure software delivery.</p><a href="/contact">Contact us</a></main></body></html>';
    const pages=[page('https://example.com/service/ai/','AI Development',['AI Development'],common),page('https://example.com/servicesoverview/ai-development/','AI Development Services',['AI Development'],common)];
    const dossier=buildSiteDossier({auditId:'a2',url:'https://example.com/',pages,robots:'',discovered:pages.map(p=>p.url)});
    expect(dossier.content.duplicates.some(x=>x.type==='near_duplicate')).toBe(true);
    expect(dossier.derived.facts.some(x=>x.type==='near_duplicate_cluster')).toBe(true);
  });
});
