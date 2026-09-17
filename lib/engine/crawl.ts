import * as cheerio from 'cheerio';
import { PageData } from '../types';

const DEFAULT_MAX = Number(process.env.MAX_CRAWL_PAGES || 50);
const TIMEOUT = 12000;

function abs(base:string, href:string) { try { return new URL(href, base).toString().split('#')[0]; } catch { return null; } }
function cleanText(s:string) { return s.replace(/\s+/g,' ').trim(); }
function headersToObject(h:Headers){ const o:Record<string,string>={}; h.forEach((v,k)=>o[k.toLowerCase()]=v); return o; }

export function classifyUrl(url:string, status:number, contentType:string):NonNullable<PageData['resourceKind']>{
  const u = new URL(url);
  const path = u.pathname.toLowerCase();
  if(/^\/cdn-cgi\//.test(path) || /^\/_next\/(static|image)/.test(path) || /^\/wp-json(?:\/|$)/.test(path) || /^\/\.well-known\//.test(path)) return 'infrastructure';
  if(status>=300 && status<400) return 'redirect';
  if(status>=400) return 'error';
  if(/\.(?:css|js|mjs|json|xml|txt|csv|pdf|zip|gz|webp|png|jpe?g|gif|svg|ico|avif|woff2?|ttf|eot|mp4|webm|mov|wav|mp3)(?:$|\?)/i.test(path)) return 'asset';
  if(!/text\/html|application\/(xhtml\+xml|html)/i.test(contentType)) return 'non_html';
  return 'page';
}

export async function fetchPage(url:string):Promise<PageData> {
  const controller = new AbortController(); const t=setTimeout(()=>controller.abort(),TIMEOUT); const start=Date.now();
  try {
    const res=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'SiteIntelligenceAuditor/0.1 (+website audit)'}});
    const html = await res.text();
    const $ = cheerio.load(html);
    const pageUrl = url;
    const origin = new URL(url).origin;
    const resourceKind = classifyUrl(pageUrl, res.status, res.headers.get('content-type')||'');
    const cookies=(res.headers.get('set-cookie')||'').split(/,(?=[^;]+=[^;]+)/).filter(Boolean);
    if(resourceKind !== 'page') {
      return {url:pageUrl,status:res.status,contentType:res.headers.get('content-type')||'',resourceKind,html:'',title:'',description:'',h1:[],headings:[],links:[],images:[],scripts:[],stylesheets:[],canonical:null,lang:null,wordCount:0,loadMs:Date.now()-start,headers:headersToObject(res.headers),cookies,sourceSize:Buffer.byteLength(html)};
    }

    const links = $('a').map((_,el)=>{ const raw=$(el).attr('href')||''; const u=abs(pageUrl,raw); return {href:u||raw,text:cleanText($(el).text()).slice(0,180),external:!!u&&new URL(u).origin!==origin}; }).get();
    const images=$('img').map((_,el)=>({src:abs(pageUrl,$(el).attr('src')||'')||$(el).attr('src')||'',alt:$(el).attr('alt')??null,width:Number($(el).attr('width'))||undefined,height:Number($(el).attr('height'))||undefined})).get();
    const headings=$('h1,h2,h3,h4,h5,h6').map((_,el)=>({level:Number(el.tagName.slice(1)),text:cleanText($(el).text())})).get();
    const scripts=$('script[src]').map((_,el)=>abs(pageUrl,$(el).attr('src')||'')||'').get();
    const stylesheets=$('link[rel="stylesheet"]').map((_,el)=>abs(pageUrl,$(el).attr('href')||'')||'').get();
    const text=cleanText($('body').text());
    const canonical=$('link[rel="canonical"]').map((_,el)=>abs(pageUrl,$(el).attr('href')||'')||$(el).attr('href')||'').get()[0]||null;
    return {url:pageUrl,status:res.status,contentType:res.headers.get('content-type')||'',resourceKind,html,title:cleanText($('title').first().text()),description:cleanText($('meta[name="description"]').attr('content')||''),h1:$('h1').map((_,el)=>cleanText($(el).text())).get(),headings,links,images,scripts,stylesheets,canonical,lang:$('html').attr('lang')||null,wordCount:text?text.split(/\s+/).length:0,loadMs:Date.now()-start,headers:headersToObject(res.headers),cookies,sourceSize:Buffer.byteLength(html)};
  } finally { clearTimeout(t); }
}

export async function crawlSite(startUrl:string,maxPages=DEFAULT_MAX):Promise<{pages:PageData[],robots:string, sitemapUrls:string[], discovered:string[]}> {
  const start = new URL(startUrl); const queue=[start.toString()]; const seen=new Set<string>(); const pages:PageData[]=[]; const discovered:string[]=[]; let robots=''; let sitemapUrls:string[]=[];
  try { const r=await fetch(new URL('/robots.txt',start).toString(),{headers:{'user-agent':'SiteIntelligenceAuditor/0.1'}}); if(r.ok){ robots=await r.text(); sitemapUrls=[...robots.matchAll(/^\s*Sitemap:\s*(\S+)/gmi)].map(m=>m[1]); } } catch {}
  if(!sitemapUrls.length) sitemapUrls=[new URL('/sitemap.xml',start).toString()];
  while(queue.length && pages.length<maxPages){
    const url=queue.shift()!; const norm=url.endsWith('/')?url:url;
    if(seen.has(norm)) continue; seen.add(norm); discovered.push(norm);
    let p:PageData;
    try { p=await fetchPage(norm); } catch { continue; }
    pages.push(p);
    if(p.resourceKind === 'page') for(const l of p.links){ if(!l.external && l.href.startsWith(start.origin) && !seen.has(l.href) && queue.length<maxPages*3 && classifyUrl(l.href,200,'text/html')==='page') queue.push(l.href); }
  }
  return {pages,robots,sitemapUrls,discovered};
}
