export type EvidenceSource = 'crawler' | 'browser' | 'user' | 'integration' | 'derived';
export type Confidence = 'confirmed' | 'likely' | 'possible' | 'needs_verification' | 'unknown';

export type PageClassification =
  | 'homepage' | 'service' | 'product' | 'industry' | 'case_study' | 'blog'
  | 'article' | 'about' | 'contact' | 'legal' | 'listing' | 'landing_page'
  | 'other' | 'error' | 'infrastructure';

export type ContentZoneName = 'header' | 'navigation' | 'breadcrumb' | 'main' | 'sidebar' | 'footer';

export interface DossierEvidence {
  evidenceId: string;
  kind: 'html' | 'http' | 'browser' | 'screenshot' | 'performance' | 'content' | 'url' | 'metadata' | 'analytics' | 'user_input' | 'external';
  pageId?: string;
  field?: string;
  value: unknown;
  observedAt: string;
  source: EvidenceSource;
  confidence: Confidence;
  locator?: { selector?: string; xpath?: string; url?: string };
}

export interface ContentZone {
  name: ContentZoneName;
  text: string;
  wordCount: number;
  visible: boolean;
  domPath?: string;
  repeatedAcrossPages: boolean;
  repeatGroupId?: string;
}

export interface Heading { level: number; text: string; selector?: string; }
export interface DossierLink { href: string; text: string; external: boolean; rel?: string[]; zone?: ContentZoneName; }
export interface ImageObservation { src: string; alt: string | null; width?: number; height?: number; zone?: ContentZoneName; }
export interface CTAObservation { text: string; href?: string; kind: 'link' | 'button'; zone?: ContentZoneName; position?: number; }
export interface FormObservation { action?: string; method: string; fields: { name?: string; type: string; label?: string; required: boolean }[]; }
export interface ProofElement { type: 'testimonial' | 'case_study' | 'client_logo' | 'certification' | 'statistic' | 'review'; text: string; }
export interface Claim { claimId: string; text: string; type: 'performance' | 'security' | 'compliance' | 'business_outcome' | 'experience' | 'trust' | 'capacity' | 'availability' | 'other'; pageIds: string[]; evidenceRefs: string[]; }

export interface PageImportance {
  strategicRole: 'core' | 'supporting' | 'secondary' | 'unknown';
  businessImportance: 'high' | 'medium' | 'low' | 'unknown';
  reasons: string[];
  signals: {
    isHomepage: boolean;
    isPrimaryNavigation: boolean;
    isServicePage: boolean;
    isConversionPage: boolean;
    isIndustryPage: boolean;
    hasInboundLinks: number;
    internalLinkCount: number;
    depth: number;
  };
}

export interface PageIntent {
  primaryTopic?: string;
  secondaryTopics: string[];
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational' | 'local' | 'mixed' | 'unknown';
  audience: string[];
  journeyStage: 'awareness' | 'consideration' | 'evaluation' | 'conversion' | 'support' | 'unknown';
  desiredAction?: string;
  evidenceRefs: string[];
}

export interface PageDossier {
  pageId: string;
  url: string;
  normalizedUrl: string;
  statusCode?: number;
  contentType?: string;
  classification: PageClassification;
  importance: PageImportance;
  hierarchy: { depth: number; parentUrls: string[]; pathSegments: string[] };
  template?: { templateId: string; pattern: string; pageCount: number };
  metadata: { title: string; description: string; lang: string | null; canonical: string | null };
  content: {
    zones: Partial<Record<ContentZoneName, ContentZone>>;
    headings: Heading[];
    paragraphs: { text: string }[];
    images: ImageObservation[];
    links: DossierLink[];
    ctas: CTAObservation[];
    forms: FormObservation[];
    proof: ProofElement[];
    wordCount: number;
    visibleMainText: string;
  };
  intent: PageIntent;
  seo: {
    indexableAssumption: 'unknown' | 'likely_indexable' | 'likely_non_indexable';
    titleLength: number;
    descriptionLength: number;
    h1: string[];
    canonicalPresent: boolean;
    structuredDataTypes: string[];
  };
  performance?: PagePerformance;
  rawSignals: { scripts: string[]; stylesheets: string[]; headers: Record<string, string>; cookies: string[]; sourceSize: number; loadMs: number };
  evidenceRefs: string[];
}

export interface PagePerformance {
  source: 'lab' | 'field' | 'synthetic' | 'unknown';
  device?: 'mobile' | 'desktop';
  measurementStatus: 'measured' | 'failed' | 'partial';
  lcp?: { valueMs: number; rating?: 'good' | 'needs_improvement' | 'poor' | 'unknown' };
  inp?: { valueMs: number; rating?: 'good' | 'needs_improvement' | 'poor' | 'unknown' };
  cls?: { value: number; rating?: 'good' | 'needs_improvement' | 'poor' | 'unknown' };
  fcp?: { valueMs: number };
  ttfb?: { valueMs: number };
  lcpElement?: { selector?: string; tag?: string; text?: string };
  lcpResource?: { url?: string; sizeBytes?: number; durationMs?: number };
  longTasks?: { durationMs: number; startTimeMs: number }[];
  layoutShifts?: { value: number; startTimeMs: number; sources?: string[] }[];
  diagnostics?: string[];
  overflow?: boolean;
  loadMs?: number;
  browserSource?: string;
  error?: string;
}

export interface ArchitectureModel {
  navigation: { links: string[]; labels: string[]; primaryUrls: string[] };
  pageTypes: { classification: PageClassification; count: number; urls: string[] }[];
  templates: { templateId: string; pattern: string; pageIds: string[]; pageCount: number }[];
  clusters: { clusterId: string; label: string; pageIds: string[]; pathPrefix?: string; }[];
  internalLinks: { from: string; to: string; text: string }[];
  orphanPages: string[];
  deepPages: string[];
  deadEnds: string[];
  routeRelationships: { type: 'duplicate_path' | 'query_variant' | 'similar_route'; urls: string[]; evidenceRefs: string[] }[];
}

export interface SiteMessaging {
  proposition?: string;
  primaryServices: string[];
  targetAudiences: string[];
  industries: string[];
  differentiators: string[];
  outcomes: string[];
  callsToAction: string[];
  trustSignals: string[];
  evidenceRefs: string[];
}

export interface ContentRelationship { type: 'near_duplicate' | 'shared_intent' | 'shared_topic'; pageIds: string[]; similarity: number; evidenceRefs: string[]; }
export interface DifferentiationCluster { clusterId: string; label: string; pageIds: string[]; sharedTopics: string[]; sharedEntities: string[]; intentOverlap: 'high' | 'medium' | 'low' | 'unknown'; uniqueSignals: string[]; evidenceRefs: string[]; }

export interface ContentModel {
  siteMessaging: SiteMessaging;
  topics: { label: string; mentions: number; pageIds: string[] }[];
  entities: { label: string; mentions: number; pageIds: string[] }[];
  claims: Claim[];
  terminology: { canonical?: string; variants: string[]; pageIds: string[] }[];
  duplicates: ContentRelationship[];
  differentiation: DifferentiationCluster[];
}

export interface AudienceModel { audiences: { label: string; evidenceRefs: string[]; pageIds: string[] }[]; intents: { label: string; pageIds: string[] }[]; journeys: { name: string; steps: string[]; evidenceRefs: string[] }[]; pageIntentMap: { pageId: string; intent: PageIntent }[]; }
export interface ConversionModel { goals: { label: string; evidenceRefs: string[] }[]; ctas: { pageId: string; text: string; href?: string; zone?: ContentZoneName }[]; forms: { pageId: string; action?: string; fieldCount: number; requiredFields: number }[]; journeys: { fromPageId: string; toPageId?: string; action: string; evidenceRefs: string[] }[]; trustSignals: { pageId: string; type: string; text: string }[]; deadEnds: string[]; }
export interface SEOModel { indexability: { indexablePages: number; likelyNonIndexablePages: number; unknownPages: number }; metadata: { duplicateTitles: { value: string; pageIds: string[] }[]; duplicateDescriptions: { value: string; pageIds: string[] }[]; missingTitles: string[]; missingDescriptions: string[] }; canonicals: { missing: string[]; external: string[]; mismatched: string[] }; sitemap: { declared: string[]; discovered: string[] }; robots: { content: string; present: boolean }; regional: { candidateRegions: string[]; localeSignals: string[] }; structuredData: { types: string[]; pagesWithStructuredData: number }; }
export interface PerformanceModel { labPages: number; measuredPages: number; failedPages: number; metrics: { pageId: string; lcpMs?: number; inpMs?: number; cls?: number; fcpMs?: number; ttfbMs?: number; status: string }[]; patterns: { type: 'lcp' | 'cls' | 'inp' | 'ttfb' | 'long_task' | 'overflow' | 'unknown'; pageIds: string[]; evidenceRefs: string[] }[]; }
export interface AccessibilityModel { landmarksMissing: string[]; pagesWithMissingAlt: string[]; pagesWithNamelessLinks: string[]; headingAnomalies: string[]; }
export interface SecurityModel { headersByOrigin: { origin: string; headers: Record<string,string>; missingCommon: string[]; pageIds: string[] }[]; insecureResourcePages: string[]; legalPageCandidates: string[]; }
export interface AnalyticsModel { identifiers: { type: 'GA4' | 'UA' | 'GTM' | 'other'; value: string; pageIds: string[] }[]; pagesWithAnalytics: string[]; pagesWithoutDetectedAnalytics: string[]; }

export interface DerivedFact { factId: string; type: string; statement: string; confidence: Confidence; supportingEvidenceRefs: string[]; affectedPageIds: string[]; derivation: { method: string; inputs: string[] } }

export interface SiteDossier {
  schemaVersion: '1.0';
  audit: { auditId: string; url: string; domain: string; startedAt: string; completedAt: string; toolVersion: string; crawl: { maxPages: number; pageCount: number; discoveredCount: number; robotsPresent: boolean }; completeness: { crawl: 'complete' | 'partial' | 'failed'; browser: 'complete' | 'partial' | 'failed'; performance: 'complete' | 'partial' | 'failed'; content: 'complete' | 'partial' | 'failed' } };
  context: { userProvided?: Record<string, unknown>; inferred: { businessType?: string; primaryGoal?: string; targetMarkets: string[]; targetAudiences: string[]; confidence: Confidence; evidenceRefs: string[] } };
  site: { canonicalOrigin: string; domains: { hostname: string; protocol: string; pageCount: number }[]; identity: { organizationName?: string; description?: string; industry: string[]; businessModel?: string; locations: string[]; socialProfiles: { platform: string; url: string }[] }; geography: { detectedMarkets: string[]; localeSignals: string[]; regionalVariants: string[] }; technology: { detectedTechnologies: string[] } };
  crawl: { summary: { pages: number; errors: number; redirects: number; assets: number }; pages: PageDossier[]; assets: { url: string; contentType: string }[]; redirects: { url: string; status: number }[]; errors: { url: string; status: number }[]; };
  architecture: ArchitectureModel;
  content: ContentModel;
  audience: AudienceModel;
  conversion: ConversionModel;
  seo: SEOModel;
  performance: PerformanceModel;
  accessibility: AccessibilityModel;
  security: SecurityModel;
  analytics: AnalyticsModel;
  derived: { facts: DerivedFact[] };
  evidence: { items: DossierEvidence[] };
}
