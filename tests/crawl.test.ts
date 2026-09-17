import { describe, expect, it } from 'vitest';
import { classifyUrl } from '../lib/engine/crawl';

describe('URL classification',()=>{
  it('classifies Cloudflare infrastructure separately from pages',()=>expect(classifyUrl('https://example.com/cdn-cgi/l/email-protection',404,'text/html')).toBe('infrastructure'));
  it('classifies assets separately',()=>expect(classifyUrl('https://example.com/app.js',200,'application/javascript')).toBe('non_html'));
  it('keeps ordinary HTML URLs as pages',()=>expect(classifyUrl('https://example.com/services/ai',200,'text/html; charset=utf-8')).toBe('page'));
  it('classifies HTTP errors as errors',()=>expect(classifyUrl('https://example.com/missing',404,'text/html')).toBe('error'));
});
