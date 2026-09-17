export type Severity = 'critical'|'high'|'medium'|'low'|'info';
export type Confidence = 'confirmed'|'likely'|'possible'|'needs_verification';
export type Priority = 'immediate'|'this_week'|'this_month'|'this_quarter'|'when_convenient';
export type InsightScope = 'page'|'template'|'site'|'origin'|'asset'|'component';
export type InsightArea = 'development'|'seo'|'marketing'|'content'|'performance'|'ux'|'accessibility'|'security'|'analytics'|'legal';

export type Finding = {
  id: string;
  checkId: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  pageUrl: string;
  message: string;
  why: string;
  fix: string;
  evidence?: Record<string, unknown>;
};

export type Evidence = {
  label: string;
  value: string;
};

export type ActionableFinding = {
  id: string;
  title: string;
  areas: InsightArea[];
  severity: Severity;
  priority: Priority;
  confidence: Confidence;
  scope: InsightScope;
  owner: string[];
  what: string;
  why: string;
  fix: string;
  affectedUrls: string[];
  relatedChecks: string[];
  evidence: Evidence[];
};

export type BrowserEvidence = {
  url: string;
  browserSource: string;
  viewport: {width:number;height:number};
  device: 'mobile'|'desktop';
  measuredAt: string;
  lcpMs: number|null;
  cls: number|null;
  inpMs: number|null;
  fcpMs: number|null;
  ttfbMs: number|null;
  lcpElement: string|null;
  lcpResource: string|null;
  lcpResourceTransferBytes: number|null;
  longTasks: number;
  longestLongTaskMs: number|null;
  layoutShiftSources: string[];
  overflow: boolean;
  error?: string;
  notes: string[];
};

export type PageData = {
  url: string;
  status: number;
  contentType: string;
  resourceKind?: 'page'|'asset'|'infrastructure'|'redirect'|'error'|'non_html';
  html: string;
  title: string;
  description: string;
  h1: string[];
  headings: {level:number;text:string}[];
  links: {href:string;text:string;external:boolean}[];
  images: {src:string;alt:string|null;width?:number;height?:number}[];
  scripts: string[];
  stylesheets: string[];
  canonical: string|null;
  lang: string|null;
  wordCount: number;
  loadMs: number;
  headers: Record<string,string>;
  cookies: string[];
  sourceSize: number;
};

export type Audit = {
  id: string;
  url: string;
  domain: string;
  status: 'queued'|'running'|'complete'|'failed';
  createdAt: string;
  pages: PageData[];
  findings: Finding[];
  insights?: ActionableFinding[];
  browserEvidence?: BrowserEvidence[];
  aiSummary?: {
    summary:string;
    priorities:string[];
    actions:string[];
    strategicInsights?: Array<{
      title:string;
      area:InsightArea;
      priority:Priority;
      what:string;
      why:string;
      fix:string;
      owner:string[];
      confidence:Confidence;
    }>;
  };
  error?: string;
};
