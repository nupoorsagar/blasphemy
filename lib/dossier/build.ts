import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import type { Finding, PageData } from '../types';
import type {
  AccessibilityModel, ArchitectureModel, AudienceModel, Claim, ContentModel, ContentRelationship, ContentZoneName,
  ConversionModel, DossierEvidence, PageClassification, PageDossier, PageIntent, PerformanceModel, SecurityModel, SiteDossier, ProofElement
} from './types';

const NOW = () => new Date().toISOString();
const hash = (value: string) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 10);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const words = (s: string) => clean(s) ? clean(s).split(/\s+/).length : 0;
const tokenize = (s: string) => new Set(clean(s.toLowerCase()).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(x => x.length > 2));
const jaccard = (a: Set<string>, b: Set<string>) => { const intersection = [...a].filter(x => b.has(x)).length; const union = new Set([...a, ...b]).size; return union ? intersection / union : 0; };
const uniq = <T>(arr: T[]) => [...new Set(arr)];
const isInternal = (url: string, origin: string) => { try { return new URL(url).origin === origin; } catch { return false; } };
const pathPattern = (url: string) => { const u = new URL(url); return u.pathname.split('/').filter(Boolean).map(seg => /^\d+$/.test(seg) ? ':id' : seg.startsWith('20') ? ':year' : /^[a-z0-9-]{18,}$/.test(seg) ? ':slug' : seg).join('/') || '/'; };
const classify = (p: PageData): PageClassification => {
  if (p.status >= 400) return 'error';
  if (/\/cdn-cgi\//i.test(p.url)) return 'infrastructure';
  const path = new URL(p.url).pathname.toLowerCase();
  if (path === '/' || path === '') return 'homepage';
  if (/privacy|terms|cookie|legal|refund|disclaimer/.test(path)) return 'legal';
  if (/contact|book|quote|request-demo|schedule/.test(path)) return 'contact';
  if (/about|company|team/.test(path)) return 'about';
  if (/case-stud|portfolio|success-stor/.test(path)) return 'case_study';
  if (/industry|industries|sector/.test(path)) return 'industry';
  if (/product|products|solution\//.test(path)) return 'product';
  if (/service|services|what-we-do/.test(path)) return 'service';
  if (/blog|news|insight/.test(path)) return 'blog';
  if (/article|guide|resources/.test(path)) return 'article';
  return p.links.some(l => /demo|quote|book|contact/i.test(l.text)) ? 'landing_page' : 'other';
};
const zoneFor = (el: any, $: cheerio.CheerioAPI): ContentZoneName => {
  let node: any = el;
  for (let i = 0; i < 5 && node; i += 1) {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'header') return 'header'; if (tag === 'nav') return 'navigation'; if (tag === 'footer') return 'footer'; if (tag === 'aside') return 'sidebar';
    const cls = ($(node).attr('class') || '').toLowerCase();
    if (/breadcrumb/.test(cls)) return 'breadcrumb';
    node = node.parent || null;
  }
  return 'main';
};

function evidence(items: DossierEvidence[], kind: DossierEvidence['kind'], pageId: string | undefined, field: string, value: unknown, confidence: DossierEvidence['confidence']='confirmed', locator?: DossierEvidence['locator']) {
  const evidenceId = `ev_${items.length + 1}_${hash(`${kind}:${pageId}:${field}:${JSON.stringify(value)}`)}`;
  items.push({ evidenceId, kind, pageId, field, value, observedAt: NOW(), source: 'crawler', confidence, locator });
  return evidenceId;
}

function extractStructuredData(html: string) {
  const $ = cheerio.load(html); const types: string[] = [];
  $('script[type="application/ld+json"]').each((_: any, el: any) => { try { const parsed = JSON.parse($(el).text()); const arr = Array.isArray(parsed) ? parsed : [parsed]; for (const obj of arr) { if (obj && typeof obj === 'object') { const t = (obj as any)['@type']; if (Array.isArray(t)) types.push(...t.map(String)); else if (t) types.push(String(t)); } } } catch {} });
  return uniq(types);
}

function inferAudience(text: string) {
  const rules: [RegExp,string][] = [
    [/\b(nhs|hospital|clinic|pharma|pharmaceutical|healthcare|health tech|healthtech)\b/i, 'Healthcare organisations'],
    [/\b(enterprise|corporate|business|b2b|decision[- ]makers)\b/i, 'Business buyers'],
    [/\b(startups?|founders|small businesses|smbs?)\b/i, 'Startups / small businesses'],
    [/\b(developers?|engineers?|technical teams?)\b/i, 'Technical teams'],
    [/\b(homeowners?|consumers?|customers?|patients?)\b/i, 'Consumers'],
    [/\b(student|students|university|college|education)\b/i, 'Education'],
  ]; return uniq(rules.filter(([r]) => r.test(text)).map(([,x]) => x));
}

function inferIntent(classification: PageClassification, text: string, ctas: { text: string }[]): PageIntent {
  const primaryTopic = clean(text.split(/\n|\.|:/)[0] || '') || undefined;
  const audience = inferAudience(text);
  const ctaText = ctas.map(c => c.text).join(' ');
  const transactional = /buy|purchase|book|schedule|sign up|register|order/i.test(ctaText);
  const commercial = /quote|demo|consult|contact|services?|solutions?|pricing/i.test(`${text} ${ctaText}`);
  const searchIntent = classification === 'contact' || transactional ? 'transactional' : commercial || ['service','product','industry','case_study'].includes(classification) ? 'commercial' : ['blog','article'].includes(classification) ? 'informational' : classification === 'homepage' ? 'mixed' : 'unknown';
  const journeyStage = transactional ? 'conversion' : classification === 'case_study' ? 'evaluation' : ['service','product','industry'].includes(classification) ? 'consideration' : ['blog','article'].includes(classification) ? 'awareness' : 'unknown';
  const desiredAction = ctas[0]?.text || undefined;
  const secondaryTopics = uniq(text.toLowerCase().match(/\b[a-z][a-z0-9-]{4,}\b/g)?.slice(0, 30) || []).filter(x => !/there|their|about|which|these|those|company|services?/.test(x)).slice(0, 12);
  return { primaryTopic, secondaryTopics, searchIntent, audience, journeyStage, desiredAction, evidenceRefs: [] };
}

function buildPage(p: PageData, allPages: PageData[], evidenceItems: DossierEvidence[], browserEvidence?: any[]): PageDossier {
  const pageId = `page_${hash(p.url)}`; const $ = cheerio.load(p.html); const classification = classify(p);
  const main = $('main').first(); const mainText = clean(main.length ? main.text() : $('body').clone().find('header,nav,footer,script,style,noscript').remove().end().text());
  const zones: PageDossier['content']['zones'] = {};
  const zoneSelectors: [ContentZoneName,string][] = [['header','header'],['navigation','nav'],['breadcrumb','[class*="breadcrumb" i]'],['main','main'],['sidebar','aside'],['footer','footer']];
  for (const [name, selector] of zoneSelectors) { const el = $(selector).first(); if (!el.length) continue; const text = clean(el.text()); zones[name] = { name, text, wordCount: words(text), visible: true, domPath: selector, repeatedAcrossPages: false }; }
  if (!zones.main) zones.main = { name: 'main', text: mainText, wordCount: words(mainText), visible: true, repeatedAcrossPages: false };

  const evidenceRefs: string[] = [];
  evidenceRefs.push(evidence(evidenceItems, 'metadata', pageId, 'title', p.title));
  evidenceRefs.push(evidence(evidenceItems, 'metadata', pageId, 'h1', p.h1));
  evidenceRefs.push(evidence(evidenceItems, 'url', pageId, 'classification', classification));

  const headings = p.headings.map((h) => ({ level: h.level, text: h.text }));
  const links = p.links.map(l => { const el = $('a').filter((_: any, a: any) => clean($(a).text()) === l.text && ($(a).attr('href') || '') === l.href).first(); return { ...l, rel: el.attr('rel')?.split(/\s+/).filter(Boolean), zone: el.length ? zoneFor(el.get(0), $) : undefined }; });
  const ctas: PageDossier['content']['ctas'] = [];
  $('a,button').each((i: any, el: any) => { const text = clean($(el).text()); if (!text || ctas.length >= 20) return; if (/contact|book|quote|demo|consult|schedule|buy|start|sign up|get started|learn more|request|download/i.test(text)) ctas.push({ text, href: el.tagName.toLowerCase() === 'a' ? $(el).attr('href') : undefined, kind: el.tagName.toLowerCase() === 'a' ? 'link' : 'button', zone: zoneFor(el, $), position: i }); });
  const forms: PageDossier['content']['forms'] = []; $('form').each((_: any, el: any) => { const fields: any[] = []; $(el).find('input,select,textarea').each((_: any, field: any) => { const name = $(field).attr('name'); const id = $(field).attr('id'); let label: string | undefined; if (id) { const l = $(`label[for="${id}"]`).first(); if (l.length) label = clean(l.text()); } fields.push({ name, type: $(field).attr('type') || field.tagName.toLowerCase(), label, required: $(field).is('[required]') }); }); forms.push({ action: $(el).attr('action') ? new URL($(el).attr('action')!, p.url).toString() : undefined, method: ($(el).attr('method') || 'get').toUpperCase(), fields }); });
  const proof: PageDossier['content']['proof'] = [];
  const proofPatterns: [RegExp, ProofElement['type']][] = [[/testimonial|what our clients say|client says/i,'testimonial'],[/case stud|success stor/i,'case_study'],[/client logo|our clients|trusted by/i,'client_logo'],[/iso\s*\d+|certif|accredit/i,'certification'],[/\b\d+\+?\s+(projects?|clients?|customers?|years?|countries?|users?)/i,'statistic'],[/reviews?|ratings?|stars?/i,'review']];
  for (const [rx,type] of proofPatterns) { const node = $('body').find('*').filter((_: any, el: any) => rx.test(clean($(el).text()))).first(); if (node.length) proof.push({ type, text: clean($(node).text()).slice(0, 500) }); }

  const structuredDataTypes = extractStructuredData(p.html);
  const visibleText = mainText || clean($('body').text());
  const textForIntent = `${p.title} ${p.h1.join(' ')} ${visibleText.slice(0, 15000)}`;
  const intent = inferIntent(classification, textForIntent, ctas);
  const matchingBrowser = browserEvidence?.find((b: any) => b.url === p.url);
  const performance = matchingBrowser ? mapPerformance(matchingBrowser) : undefined;
  const inbound = allPages.reduce((n, page) => n + page.links.filter(l => !l.external && l.href === p.url).length, 0);
  const depth = new URL(p.url).pathname.split('/').filter(Boolean).length;
  const strategic = classification === 'homepage' || ['service','product','industry','contact'].includes(classification) ? 'core' : ['case_study','about'].includes(classification) ? 'supporting' : 'secondary';
  const internalLinkCount = p.links.filter(l => !l.external).length;
  const isConversion = ctas.length > 0 || forms.length > 0;
  const importance = { strategicRole: strategic, businessImportance: strategic === 'core' ? 'high' : 'medium', reasons: [classification, isConversion ? 'contains conversion element' : ''], signals: { isHomepage: classification === 'homepage', isPrimaryNavigation: allPages.some(x => x.url !== p.url && x.links.some(l => l.href === p.url && /services?|products?|contact|industries?|solutions?/i.test(l.text))), isServicePage: classification === 'service', isConversionPage: isConversion, isIndustryPage: classification === 'industry', hasInboundLinks: inbound, internalLinkCount, depth } } as any;
  return { pageId, url: p.url, normalizedUrl: normalizeUrl(p.url), statusCode: p.status, contentType: p.contentType, classification, importance, hierarchy: { depth, parentUrls: p.links.filter(l => !l.external).map(l => l.href).filter(u => new URL(u).pathname.split('/').length < depth + 1).slice(0, 10), pathSegments: new URL(p.url).pathname.split('/').filter(Boolean) }, metadata: { title: p.title, description: p.description, lang: p.lang, canonical: p.canonical }, content: { zones, headings, paragraphs: mainText.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 80).map(text => ({ text: text.slice(0, 600) })), images: p.images.map(i => ({ ...i })), links, ctas, forms, proof, wordCount: words(mainText), visibleMainText: mainText.slice(0, 30000) }, intent, seo: { indexableAssumption: classification === 'legal' ? 'likely_indexable' : 'unknown', titleLength: p.title.length, descriptionLength: p.description.length, h1: p.h1, canonicalPresent: Boolean(p.canonical), structuredDataTypes }, performance, rawSignals: { scripts: p.scripts, stylesheets: p.stylesheets, headers: p.headers, cookies: p.cookies, sourceSize: p.sourceSize, loadMs: p.loadMs }, evidenceRefs };
}

function normalizeUrl(url: string) { try { const u = new URL(url); u.hash = ''; const entries = [...u.searchParams.entries()].sort(([a],[b]) => a.localeCompare(b)); u.search = new URLSearchParams(entries).toString(); return u.toString(); } catch { return url; } }
function mapPerformance(b: any): PageDossier['performance'] {
  if (b.error) return { source: 'lab', device: 'mobile', measurementStatus: 'failed', browserSource: b.browserSource, error: b.error };
  const rate = (v: number | undefined, good: number, mid: number, inverse = false): any => { if (v == null || !Number.isFinite(v)) return undefined; const ok = inverse ? v <= good : v >= good; void ok; return v <= good ? 'good' : v <= mid ? 'needs_improvement' : 'poor'; };
  const vitals = b.vitals || {};
  return { source: 'lab', device: 'mobile', measurementStatus: 'measured', lcp: vitals.lcp > 0 ? { valueMs: vitals.lcp, rating: rate(vitals.lcp, 2500, 4000) } : undefined, inp: vitals.inp > 0 ? { valueMs: vitals.inp, rating: rate(vitals.inp, 200, 500) } : undefined, cls: typeof vitals.cls === 'number' ? { value: vitals.cls, rating: rate(vitals.cls, 0.1, 0.25) } : undefined, overflow: Boolean(b.overflow), loadMs: b.loadMs, browserSource: b.browserSource };
}

export interface BuildDossierInput { auditId: string; url: string; pages: PageData[]; robots: string; sitemapUrls?: string[]; discovered?: string[]; findings?: Finding[]; browserEvidence?: any[]; toolVersion?: string; maxPages?: number; userContext?: Record<string, unknown>; }

export function buildSiteDossier(input: BuildDossierInput): SiteDossier {
  const evidenceItems: DossierEvidence[] = []; const origin = new URL(input.url).origin; const pageDossiers = input.pages.map(p => buildPage(p, input.pages, evidenceItems, input.browserEvidence));
  const pageByUrl = new Map(pageDossiers.map(p => [p.url, p]));
  const pageIds = pageDossiers.map(p => p.pageId);
  const home = pageDossiers.find(p => p.classification === 'homepage');
  const allText = pageDossiers.map(p => p.content.visibleMainText).join('\n');
  const identityName = home?.metadata.title?.split(/[|–—-]/)[0]?.trim() || undefined;
  const socialProfiles = [...new Set(input.pages.flatMap(p => p.links.filter(l => /linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com/i.test(l.href)).map(l => l.href)))].map(url => ({ platform: new URL(url).hostname.replace(/^www\./,''), url }));
  const markets = uniq((allText.match(/\b(UK|United Kingdom|USA|US|United States|India|Canada|Australia|Europe|UAE|Dubai|GCC|Singapore|global|worldwide)\b/gi) || []).map(x => x.toLowerCase() === 'uk' ? 'UK' : x[0].toUpperCase() + x.slice(1)));
  const audiences = uniq(pageDossiers.flatMap(p => p.intent.audience));
  const servicePages = pageDossiers.filter(p => p.classification === 'service');
  const industries = uniq(pageDossiers.filter(p => p.classification === 'industry').flatMap(p => [p.metadata.title, ...p.content.headings.filter(h => h.level <= 2).map(h => h.text)]).filter(Boolean));
  const primaryServices = uniq(servicePages.map(p => p.metadata.title || p.content.headings.find(h => h.level === 1)?.text).filter(Boolean) as string[]).slice(0, 40);
  const ctaTexts = uniq(pageDossiers.flatMap(p => p.content.ctas.map(c => c.text))).slice(0, 40);
  const trustSignals = uniq(pageDossiers.flatMap(p => p.content.proof.map(x => x.type))).slice(0, 20);
  const siteMessaging = { proposition: home?.content.visibleMainText.slice(0, 800), primaryServices, targetAudiences: audiences, industries, differentiators: [], outcomes: uniq((allText.match(/\b(increase|improve|reduce|save|grow|secure|automate|accelerate|scale|transform|deliver)\b[^.!?]{0,90}/gi) || []).slice(0, 20)), callsToAction: ctaTexts, trustSignals, evidenceRefs: home ? home.evidenceRefs : [] };

  const internalLinks = pageDossiers.flatMap(p => p.content.links.filter(l => !l.external && isInternal(l.href, origin)).map(l => ({ from: p.pageId, to: pageByUrl.get(normalizeUrl(l.href))?.pageId || `external_internal_${hash(l.href)}`, text: l.text })));
  const incoming = new Map(pageIds.map(id => [id, 0])); internalLinks.forEach(l => { if (incoming.has(l.to)) incoming.set(l.to, incoming.get(l.to)! + 1); });
  const orphanPages = pageDossiers.filter(p => p.classification !== 'homepage' && (incoming.get(p.pageId) || 0) === 0).map(p => p.pageId);
  const deadEnds = pageDossiers.filter(p => ['service','product','industry','case_study'].includes(p.classification) && p.content.ctas.length === 0 && p.content.links.filter(l => !l.external).length <= 2).map(p => p.pageId);
  const clustersMap = new Map<string,string[]>(); pageDossiers.forEach(p => { const seg = p.hierarchy.pathSegments[0] || 'root'; clustersMap.set(seg, [...(clustersMap.get(seg)||[]), p.pageId]); });
  const clusters = [...clustersMap.entries()].filter(([, ids]) => ids.length >= 2).map(([label, ids]) => ({ clusterId: `cluster_${hash(label)}`, label, pageIds: ids, pathPrefix: `/${label}` }));
  const templateMap = new Map<string,string[]>(); pageDossiers.forEach(p => { const pat = pathPattern(p.url); templateMap.set(pat, [...(templateMap.get(pat)||[]), p.pageId]); });
  const templates = [...templateMap.entries()].filter(([, ids]) => ids.length >= 2).map(([pattern, ids]) => ({ templateId: `tpl_${hash(pattern)}`, pattern, pageIds: ids, pageCount: ids.length }));
  templates.forEach(t => t.pageIds.forEach(id => { const p = pageDossiers.find(x => x.pageId === id); if (p) p.template = { templateId: t.templateId, pattern: t.pattern, pageCount: t.pageCount }; }));

  const relationships: ContentRelationship[] = []; const routeRelationships: ArchitectureModel['routeRelationships'] = [];
  for (let i = 0; i < pageDossiers.length; i += 1) for (let j = i + 1; j < pageDossiers.length; j += 1) {
    const a = pageDossiers[i], b = pageDossiers[j]; const sim = jaccard(tokenize(a.content.visibleMainText), tokenize(b.content.visibleMainText));
    if (sim >= 0.82) relationships.push({ type: 'near_duplicate', pageIds: [a.pageId,b.pageId], similarity: Number(sim.toFixed(3)), evidenceRefs: [evidence(evidenceItems,'content',a.pageId,'nearDuplicate',{with:b.url,similarity:sim})] });
    const sameTopic = a.classification === b.classification && ['service','product','industry'].includes(a.classification) && jaccard(tokenize(`${a.metadata.title} ${a.content.headings.map(h=>h.text).join(' ')}`), tokenize(`${b.metadata.title} ${b.content.headings.map(h=>h.text).join(' ')}`)) >= 0.45;
    if (sameTopic) relationships.push({ type: 'shared_intent', pageIds: [a.pageId,b.pageId], similarity: Number(sim.toFixed(3)), evidenceRefs: [] });
    if (a.hierarchy.pathSegments.join('/') === b.hierarchy.pathSegments.join('/')) routeRelationships.push({ type: 'duplicate_path', urls: [a.url,b.url], evidenceRefs: [] });
  }
  const differentiation = clusters.filter(c => c.label === 'service' || servicePages.some(p => c.pageIds.includes(p.pageId))).map(c => {
    const ps = c.pageIds.map(id => pageDossiers.find(p => p.pageId === id)!).filter(Boolean); const shared = ps.flatMap(p => p.content.headings.filter(h=>h.level<=2).map(h=>h.text.toLowerCase()));
    const intentOverlap: 'high' | 'medium' | 'low' = ps.length > 4 ? 'high' : ps.length > 2 ? 'medium' : 'low';
    return { clusterId: c.clusterId, label: c.label, pageIds: c.pageIds, sharedTopics: uniq(shared).slice(0,12), sharedEntities: [], intentOverlap, uniqueSignals: uniq(ps.flatMap(p => p.intent.secondaryTopics)).slice(0,20), evidenceRefs: [] };
  });
  const terminology = [['E-commerce','ecommerce','Ecommerce'],['Cross Platform','Cross-Platform'],['services','solutions','development']].map(group => { const present = group.filter(v => new RegExp(`\\b${v.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`,'i').test(allText)); return present.length > 1 ? { canonical: undefined, variants: present, pageIds: pageDossiers.filter(p => present.some(v => new RegExp(`\\b${v.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`,'i').test(p.content.visibleMainText))).map(p => p.pageId) } : null; }).filter(Boolean) as ContentModel['terminology'];

  const claims: Claim[] = []; const claimRegex: [RegExp, Claim['type']][] = [[/\bzero downtime\b|\b24\/7 monitoring\b|\b99\.\d+%\b/ig,'performance'],[/\bGDPR\b|\bHIPAA\b|\bISO\s*27001\b/ig,'compliance'],[/\bsecure\b|\bfully secure\b/ig,'security'],[/\btrusted\b|\bproven\b|\bleader\b/ig,'trust'],[/\bdrive conversions?\b|\bincrease revenue\b|\bboost sales\b/ig,'business_outcome'],[/\bavailable 24\/7\b|\bround[- ]the[- ]clock\b/ig,'availability']];
  for (const p of pageDossiers) for (const [rx,type] of claimRegex) for (const m of p.content.visibleMainText.matchAll(rx)) { const text = clean(m[0]); const ref = evidence(evidenceItems,'content',p.pageId,'claim',text,'likely'); claims.push({ claimId:`claim_${hash(`${p.pageId}:${text}`)}`, text, type, pageIds:[p.pageId], evidenceRefs:[ref] }); }

  const robotsPresent = Boolean(input.robots.trim()); const missingTitles = pageDossiers.filter(p => !p.metadata.title).map(p=>p.pageId); const missingDescriptions = pageDossiers.filter(p=>!p.metadata.description).map(p=>p.pageId);
  const titleGroups = new Map<string,string[]>(); pageDossiers.filter(p=>p.metadata.title).forEach(p => titleGroups.set(p.metadata.title,[...(titleGroups.get(p.metadata.title)||[]),p.pageId]));
  const descGroups = new Map<string,string[]>(); pageDossiers.filter(p=>p.metadata.description).forEach(p => descGroups.set(p.metadata.description,[...(descGroups.get(p.metadata.description)||[]),p.pageId]));
  const duplicateTitles = [...titleGroups.entries()].filter(([,ids])=>ids.length>1).map(([value,pageIds])=>({value,pageIds})); const duplicateDescriptions=[...descGroups.entries()].filter(([,ids])=>ids.length>1).map(([value,pageIds])=>({value,pageIds}));
  const structuredTypes = uniq(pageDossiers.flatMap(p=>p.seo.structuredDataTypes));
  const security: SecurityModel = buildSecurity(pageDossiers, origin);
  const analytics = buildAnalytics(pageDossiers);
  const performance = buildPerformance(pageDossiers);
  const accessibility: AccessibilityModel = { landmarksMissing: pageDossiers.filter(p=>!(p.content.zones.header&&p.content.zones.main&&p.content.zones.footer)).map(p=>p.pageId), pagesWithMissingAlt: pageDossiers.filter(p=>p.content.images.some(i=>i.alt===null)).map(p=>p.pageId), pagesWithNamelessLinks: pageDossiers.filter(p=>p.content.links.some(l=>!l.text)).map(p=>p.pageId), headingAnomalies: pageDossiers.filter(p=>hasHeadingAnomaly(p.content.headings)).map(p=>p.pageId) };
  const audience: AudienceModel = { audiences: audiences.map(label=>({label,evidenceRefs:[],pageIds:pageDossiers.filter(p=>p.intent.audience.includes(label)).map(p=>p.pageId)})), intents: uniq(pageDossiers.map(p=>p.intent.searchIntent)).map(label=>({label,pageIds:pageDossiers.filter(p=>p.intent.searchIntent===label).map(p=>p.pageId)})), journeys: [{ name:'Primary site journey', steps:['Landing page','Relevant page','Conversion action'], evidenceRefs:[] }], pageIntentMap: pageDossiers.map(p=>({pageId:p.pageId,intent:p.intent})) };
  const conversion: ConversionModel = { goals: ctaTexts.map(label=>({label,evidenceRefs:[]})), ctas: pageDossiers.flatMap(p=>p.content.ctas.map(c=>({pageId:p.pageId,text:c.text,href:c.href,zone:c.zone}))), forms: pageDossiers.flatMap(p=>p.content.forms.map(f=>({pageId:p.pageId,action:f.action,fieldCount:f.fields.length,requiredFields:f.fields.filter(x=>x.required).length}))), journeys: [], trustSignals: pageDossiers.flatMap(p=>p.content.proof.map(x=>({pageId:p.pageId,type:x.type,text:x.text}))), deadEnds };
  const derivedFacts = buildDerivedFacts(pageDossiers, servicePages, differentiation, orphanPages, relationships, claims, evidenceItems);
  return { schemaVersion:'1.0', audit:{ auditId:input.auditId,url:input.url,domain:new URL(input.url).hostname,startedAt:NOW(),completedAt:NOW(),toolVersion:input.toolVersion||'0.1.0',crawl:{maxPages:input.maxPages||pageDossiers.length,pageCount:pageDossiers.length,discoveredCount:input.discovered?.length||pageDossiers.length,robotsPresent},completeness:{crawl:'complete',browser:input.browserEvidence?.length?'partial':'failed',performance:input.browserEvidence?.some((b:any)=>!b.error)?'partial':'failed',content:'complete'}}, context:{userProvided:input.userContext,inferred:{businessType:inferBusinessType(allText),primaryGoal:inferPrimaryGoal(pageDossiers),targetMarkets:markets,targetAudiences:audiences,confidence:audiences.length||markets.length?'likely':'possible',evidenceRefs:home?.evidenceRefs||[]}}, site:{canonicalOrigin:origin,domains:[{hostname:new URL(input.url).hostname,protocol:new URL(input.url).protocol,pageCount:pageDossiers.length}],identity:{organizationName:identityName,description:home?.metadata.description,industry:industries.slice(0,20),businessModel:inferBusinessType(allText),locations:markets,socialProfiles},geography:{detectedMarkets:markets,localeSignals:uniq(pageDossiers.map(p=>p.metadata.lang).filter(Boolean) as string[]),regionalVariants:[]},technology:{detectedTechnologies:uniq(input.pages.flatMap(p=>p.scripts).filter(s=>/gtm|google-analytics|hubspot|clarity|hotjar|recaptcha/i.test(s)).map(s=>/gtm/i.test(s)?'Google Tag Manager':/analytics/i.test(s)?'Google Analytics':/hubspot/i.test(s)?'HubSpot':/clarity/i.test(s)?'Microsoft Clarity':/hotjar/i.test(s)?'Hotjar':'Other'))}},crawl:{summary:{pages:pageDossiers.filter(p=>p.classification!=='error'&&p.classification!=='infrastructure').length,errors:pageDossiers.filter(p=>p.classification==='error').length,redirects:input.pages.filter(p=>[301,302,307,308].includes(p.status)).length,assets:input.pages.filter(p=>p.contentType && !/text\/html/i.test(p.contentType)).length},pages:pageDossiers,assets:input.pages.filter(p=>p.contentType && !/text\/html/i.test(p.contentType)).map(p=>({url:p.url,contentType:p.contentType})),redirects:input.pages.filter(p=>[301,302,307,308].includes(p.status)).map(p=>({url:p.url,status:p.status})),errors:input.pages.filter(p=>p.status>=400).map(p=>({url:p.url,status:p.status}))},architecture:{navigation:{links:(home?.content.links||[]).filter(l=>l.zone==='navigation').map(l=>l.href),labels:(home?.content.links||[]).filter(l=>l.zone==='navigation').map(l=>l.text),primaryUrls:(home?.content.links||[]).filter(l=>l.zone==='navigation').map(l=>l.href).slice(0,30)},pageTypes:uniq(pageDossiers.map(p=>p.classification)).map(classification=>({classification,count:pageDossiers.filter(p=>p.classification===classification).length,urls:pageDossiers.filter(p=>p.classification===classification).map(p=>p.url).slice(0,50)})),templates,clusters,internalLinks,orphanPages,deepPages:pageDossiers.filter(p=>p.hierarchy.depth>=4).map(p=>p.pageId),deadEnds,routeRelationships},content:{siteMessaging,topics:buildTopics(pageDossiers),entities:buildEntities(pageDossiers),claims,terminology,duplicates:relationships,differentiation},audience,conversion,seo:{indexability:{indexablePages:pageDossiers.filter(p=>p.seo.indexableAssumption==='likely_indexable').length,likelyNonIndexablePages:pageDossiers.filter(p=>p.seo.indexableAssumption==='likely_non_indexable').length,unknownPages:pageDossiers.filter(p=>p.seo.indexableAssumption==='unknown').length},metadata:{duplicateTitles,duplicateDescriptions,missingTitles,missingDescriptions},canonicals:{missing:pageDossiers.filter(p=>!p.metadata.canonical).map(p=>p.pageId),external:pageDossiers.filter(p=>{try{return Boolean(p.metadata.canonical)&&new URL(p.metadata.canonical!).origin!==origin}catch{return false}}).map(p=>p.pageId),mismatched:[]},sitemap:{declared:input.sitemapUrls||[],discovered:[]},robots:{content:input.robots,present:robotsPresent},regional:{candidateRegions:markets,localeSignals:uniq(pageDossiers.map(p=>p.metadata.lang).filter(Boolean) as string[])},structuredData:{types:structuredTypes,pagesWithStructuredData:pageDossiers.filter(p=>p.seo.structuredDataTypes.length>0).length}},performance,accessibility,security,analytics,derived:{facts:derivedFacts},evidence:{items:evidenceItems} };
}

function buildTopics(pages: PageDossier[]) { const map = new Map<string,{mentions:number;pageIds:Set<string>}>(); for (const p of pages) { const text = `${p.metadata.title} ${p.content.headings.map(h=>h.text).join(' ')}`.toLowerCase(); const tokens = text.match(/\b[a-z][a-z0-9-]{4,}\b/g) || []; for (const t of new Set(tokens)) { if (/^(these|those|which|their|there|about|company|services|solutions|development)$/.test(t)) continue; const item=map.get(t)||{mentions:0,pageIds:new Set<string>()}; item.mentions += 1; item.pageIds.add(p.pageId); map.set(t,item); } } return [...map.entries()].sort((a,b)=>b[1].mentions-a[1].mentions).slice(0,80).map(([label,v])=>({label,mentions:v.mentions,pageIds:[...v.pageIds]})); }
function buildEntities(pages: PageDossier[]) { const candidates = pages.flatMap(p=>[p.metadata.title,...p.content.headings.filter(h=>h.level<=2).map(h=>h.text)]).filter(Boolean) as string[]; const map=new Map<string,{mentions:number;pageIds:Set<string>}>(); for(const p of pages){for(const c of candidates.filter(x=>p.metadata.title===x||p.content.headings.some(h=>h.text===x))){const item=map.get(c)||{mentions:0,pageIds:new Set<string>()};item.mentions++;item.pageIds.add(p.pageId);map.set(c,item);}} return [...map.entries()].sort((a,b)=>b[1].mentions-a[1].mentions).slice(0,60).map(([label,v])=>({label,mentions:v.mentions,pageIds:[...v.pageIds]})); }
function buildSecurity(pages: PageDossier[], origin: string): SecurityModel { const common=['strict-transport-security','content-security-policy','x-content-type-options','referrer-policy','permissions-policy']; return { headersByOrigin:[{origin,headers:pages[0]?.rawSignals.headers||{},missingCommon:common.filter(h=>!pages.some(p=>p.rawSignals.headers[h])),pageIds:pages.map(p=>p.pageId)}], insecureResourcePages:pages.filter(p=>p.content.links.some(l=>l.href.startsWith('http://')) || p.rawSignals.scripts.some(s=>s.startsWith('http://'))).map(p=>p.pageId), legalPageCandidates:pages.filter(p=>p.classification==='legal').map(p=>p.pageId) }; }
function buildAnalytics(pages: PageDossier[]) { const defs:[RegExp,'GA4'|'UA'|'GTM'][]=[[/\bG-[A-Z0-9]{8,}\b/gi,'GA4'],[/\bUA-\d+-\d+\b/gi,'UA'],[/\bGTM-[A-Z0-9]{4,}\b/gi,'GTM']]; const out=new Map<string,{type:'GA4'|'UA'|'GTM';pageIds:string[]}>(); for(const p of pages) for(const [rx,type] of defs) for(const m of p.content.visibleMainText.concat(' ',p.rawSignals.scripts.join(' ')).matchAll(rx)){const value=m[0].toUpperCase();const key=type+':'+value;const item=out.get(key)||{type,pageIds:[]};item.pageIds.push(p.pageId);out.set(key,item);} return {identifiers:[...out.entries()].map(([key,v])=>({type:v.type,value:key.split(':')[1],pageIds:uniq(v.pageIds)})),pagesWithAnalytics:pages.filter(p=>/[G]-[A-Z0-9]{8,}|UA-\d+-\d+|GTM-[A-Z0-9]{4,}/i.test(p.content.visibleMainText.concat(' ',p.rawSignals.scripts.join(' ')))).map(p=>p.pageId),pagesWithoutDetectedAnalytics:pages.filter(p=>!/[G]-[A-Z0-9]{8,}|UA-\d+-\d+|GTM-[A-Z0-9]{4,}/i.test(p.content.visibleMainText.concat(' ',p.rawSignals.scripts.join(' ')))).map(p=>p.pageId)}; }
function buildPerformance(pages: PageDossier[]): PerformanceModel { const metrics=pages.filter(p=>p.performance).map(p=>({pageId:p.pageId,lcpMs:p.performance?.lcp?.valueMs,inpMs:p.performance?.inp?.valueMs,cls:p.performance?.cls?.value,fcpMs:p.performance?.fcp?.valueMs,ttfbMs:p.performance?.ttfb?.valueMs,status:p.performance?.measurementStatus||'unknown'})); const patterns:PerformanceModel['patterns']=[]; for(const p of pages){const perf=p.performance;if(!perf||perf.measurementStatus!=='measured')continue;if((perf.lcp?.valueMs||0)>4000)patterns.push({type:'lcp',pageIds:[p.pageId],evidenceRefs:p.evidenceRefs});if((perf.cls?.value||0)>0.25)patterns.push({type:'cls',pageIds:[p.pageId],evidenceRefs:p.evidenceRefs});if((perf.inp?.valueMs||0)>500)patterns.push({type:'inp',pageIds:[p.pageId],evidenceRefs:p.evidenceRefs});if((perf.ttfb?.valueMs||0)>1800)patterns.push({type:'ttfb',pageIds:[p.pageId],evidenceRefs:p.evidenceRefs});if(perf.overflow)patterns.push({type:'overflow',pageIds:[p.pageId],evidenceRefs:p.evidenceRefs});} return {labPages:pages.filter(p=>p.performance?.source==='lab').length,measuredPages:pages.filter(p=>p.performance?.measurementStatus==='measured').length,failedPages:pages.filter(p=>p.performance?.measurementStatus==='failed').length,metrics,patterns}; }
function inferBusinessType(text: string) { if (/\bsoftware|saas|technology|IT services?|development/i.test(text)) return 'Technology / software services'; if (/\becommerce|shop|store|products?|cart|checkout/i.test(text)) return 'Ecommerce'; if (/\bclinic|hospital|healthcare|medical|pharmacy/i.test(text)) return 'Healthcare'; return undefined; }
function inferPrimaryGoal(pages: PageDossier[]) { if (pages.some(p=>p.content.forms.length||p.content.ctas.some(c=>/quote|demo|consult|contact|book/i.test(c.text)))) return 'Generate enquiries / leads'; if (pages.some(p=>p.content.ctas.some(c=>/buy|purchase|cart|order/i.test(c.text)))) return 'Drive purchases'; return undefined; }
function hasHeadingAnomaly(headings:{level:number}[]) { let prev=1; for(const h of headings){if(h.level>prev+1)return true;prev=h.level;} return false; }
function buildDerivedFacts(pages: PageDossier[], servicePages: PageDossier[], differentiation: any[], orphans: string[], relationships: ContentRelationship[], claims: Claim[], evidenceItems: DossierEvidence[]) { const facts:any[]=[]; const ref=(kind:string, value:string, pageId?:string)=>evidence(evidenceItems,kind as any,pageId,'derived',value,'likely'); if(servicePages.length>=4){const ev=ref('content',`Service cluster contains ${servicePages.length} service pages`);facts.push({factId:`fact_${hash('service-cluster')}`,type:'service_cluster',statement:`The site contains a substantial service-page cluster (${servicePages.length} pages).`,confidence:'confirmed',supportingEvidenceRefs:[ev],affectedPageIds:servicePages.map(p=>p.pageId),derivation:{method:'page classification',inputs:servicePages.map(p=>p.url)}});} if(differentiation.length){facts.push(...differentiation.filter(x=>x.intentOverlap==='high').map((x:any)=>({factId:`fact_${hash(x.clusterId)}`,type:'intent_overlap',statement:`Pages in the ${x.label} cluster show high structural/topic overlap and should be reviewed for differentiation.`,confidence:'likely',supportingEvidenceRefs:x.evidenceRefs,affectedPageIds:x.pageIds,derivation:{method:'cluster + topic similarity',inputs:x.pageIds}})));} if(orphans.length){facts.push({factId:`fact_${hash('orphans')}`,type:'orphan_content',statement:`${orphans.length} crawled pages have no inbound internal link in the crawl graph.`,confidence:'confirmed',supportingEvidenceRefs:[],affectedPageIds:orphans,derivation:{method:'internal link graph',inputs:orphans}});} if(relationships.some(r=>r.type==='near_duplicate')){const near=relationships.filter(r=>r.type==='near_duplicate');facts.push({factId:`fact_${hash('near-duplicates')}`,type:'near_duplicate_cluster',statement:`${near.length} page pairs have very high visible-content similarity and warrant review.`,confidence:'likely',supportingEvidenceRefs:near.flatMap(r=>r.evidenceRefs),affectedPageIds:uniq(near.flatMap(r=>r.pageIds)),derivation:{method:'Jaccard token similarity',inputs:near.map(r=>r.pageIds.join(','))}});} if(claims.length){facts.push({factId:`fact_${hash('claims')}`,type:'claims',statement:`The site contains ${claims.length} detected strong/regulated/business claims that can be checked against supporting evidence.`,confidence:'likely',supportingEvidenceRefs:claims.slice(0,20).flatMap(c=>c.evidenceRefs),affectedPageIds:uniq(claims.flatMap(c=>c.pageIds)),derivation:{method:'claim pattern extraction',inputs:claims.map(c=>c.text)}});} return facts; }

export { classify as classifyPageForDossier, normalizeUrl };
