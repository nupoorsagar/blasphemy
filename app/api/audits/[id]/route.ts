import { NextResponse } from 'next/server';
import { getAudit } from '@/lib/store';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){ const {id}=await params; const audit=getAudit(id); if(!audit) return NextResponse.json({error:'Audit not found'},{status:404}); return NextResponse.json(audit); }
