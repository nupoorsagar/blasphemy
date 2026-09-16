import { Audit } from './types';
const store = new Map<string,Audit>();
export function createAudit(a:Audit){store.set(a.id,a);return a;}
export function getAudit(id:string){return store.get(id) || null;}
export function updateAudit(id:string, patch:Partial<Audit>){const current=store.get(id); if(!current) return null; const next={...current,...patch}; store.set(id,next); return next;}
