import { describe,it,expect } from 'vitest';
import { runDeterministicRules } from '../lib/engine/rules';
import type { PageData } from '../lib/types';
const page:PageData={url:'https://example.com/',status:200,contentType:'text/html',html:'<html><body><h1></h1><img src=""><a href="/missing"></a><script src="https://cdn.example.com/a.js"></script></body></html>',title:'',description:'',h1:[''],headings:[{level:1,text:''}],links:[{href:'https://example.com/missing',text:'',external:false}],images:[{src:'',alt:null}],scripts:['https://cdn.example.com/a.js'],stylesheets:[],canonical:null,lang:null,wordCount:2,loadMs:30,headers:{},cookies:[],sourceSize:160};
describe('deterministic findings',()=>{it('emits concrete findings with evidence',()=>{const f=runDeterministicRules([page],''); expect(f.some(x=>x.checkId==='META-001')).toBe(true); expect(f.some(x=>x.checkId==='MEDIA-001')).toBe(true); expect(f.every(x=>x.pageUrl)).toBe(true); expect(f.every(x=>x.fix)).toBe(true);});});
