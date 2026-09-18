export type FeedbackReason =
  | 'not_a_real_problem'
  | 'not_relevant'
  | 'too_generic'
  | 'wrong_evidence'
  | 'weak_fix'
  | 'wrong_priority'
  | 'already_fixed'
  | 'other';

export interface InsightFeedbackEvent {
  auditId: string;
  insightId: string;
  modelVersion: string;
  promptVersion: string;
  dossierSchemaVersion: string;
  useful: boolean;
  reason?: FeedbackReason;
  createdAt: string;
}

export interface PreferenceExample {
  auditId: string;
  chosenInsightId: string;
  rejectedInsightId: string;
  source: 'user_feedback';
}

export function feedbackToPreferences(events: InsightFeedbackEvent[]): PreferenceExample[] {
  const byAudit = new Map<string, InsightFeedbackEvent[]>();
  for (const event of events) {
    const list = byAudit.get(event.auditId) || [];
    list.push(event);
    byAudit.set(event.auditId, list);
  }
  const preferences: PreferenceExample[] = [];
  for (const [auditId, auditEvents] of byAudit) {
    const chosen = auditEvents.filter(event => event.useful);
    const rejected = auditEvents.filter(event => !event.useful);
    for (const c of chosen) for (const r of rejected) {
      preferences.push({ auditId, chosenInsightId: c.insightId, rejectedInsightId: r.insightId, source: 'user_feedback' });
    }
  }
  return preferences;
}
