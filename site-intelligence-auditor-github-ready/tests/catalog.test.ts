import { describe,it,expect } from 'vitest';
import { CHECK_CATALOG } from '../lib/engine/catalog';

describe('audit catalog',()=>{
 it('contains the complete expanded check catalog',()=>expect(CHECK_CATALOG).toHaveLength(340));
 it('has unique stable IDs',()=>expect(new Set(CHECK_CATALOG.map(x=>x.id)).size).toBe(340));
 it('marks browser rules separately',()=>expect(CHECK_CATALOG.filter(x=>x.type==='browser').length).toBeGreaterThan(10));
});
