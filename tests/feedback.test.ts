import { describe, expect, it } from 'vitest';
import { feedbackToPreferences } from '../lib/evaluation/feedback';

describe('feedback learning bridge',()=>{
  it('turns useful/not useful feedback into preference pairs',()=>{
    const prefs=feedbackToPreferences([
      {auditId:'a',insightId:'good',modelVersion:'m1',promptVersion:'p1',dossierSchemaVersion:'1.0',useful:true,createdAt:'2026-01-01'},
      {auditId:'a',insightId:'bad',modelVersion:'m1',promptVersion:'p1',dossierSchemaVersion:'1.0',useful:false,reason:'too_generic',createdAt:'2026-01-01'},
    ]);
    expect(prefs).toEqual([{auditId:'a',chosenInsightId:'good',rejectedInsightId:'bad',source:'user_feedback'}]);
  });
});
