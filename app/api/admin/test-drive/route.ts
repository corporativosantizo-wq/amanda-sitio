// TEMPORARY diagnostic route — delete after OneDrive 403 is resolved
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { testDriveAccess } from '@/lib/molly/graph-drive';

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const results = await testDriveAccess('amanda@papeleo.legal');
    return NextResponse.json({ account: 'amanda@papeleo.legal', results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
