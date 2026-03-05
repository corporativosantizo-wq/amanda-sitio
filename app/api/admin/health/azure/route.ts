// ============================================================================
// GET /api/admin/health/azure
// Health check para la conexión con Azure (Graph API / Outlook)
// Protegido con requireAdmin()
// ============================================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getAppToken } from '@/lib/services/outlook.service';

const ACCOUNTS = ['amanda@papeleo.legal', 'asistente@papeleo.legal', 'contador@papeleo.legal'];

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const envVars = {
    AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
  };

  const missingVars = Object.entries(envVars)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    return NextResponse.json({
      status: 'down',
      tokenObtained: false,
      error: `Missing env vars: ${missingVars.join(', ')}`,
      accounts: ACCOUNTS,
      lastCheck: new Date().toISOString(),
    });
  }

  try {
    await getAppToken();
    return NextResponse.json({
      status: 'healthy',
      tokenObtained: true,
      accounts: ACCOUNTS,
      lastCheck: new Date().toISOString(),
    });
  } catch (err: any) {
    const isExpired = err.message?.includes('AADSTS7000215') ||
      err.details?.includes?.('expired') ||
      err.details?.includes?.('invalid_client');

    return NextResponse.json({
      status: isExpired ? 'down' : 'degraded',
      tokenObtained: false,
      error: isExpired
        ? 'Azure client secret expired — rotate in Azure Portal'
        : 'Failed to obtain token',
      accounts: ACCOUNTS,
      lastCheck: new Date().toISOString(),
    });
  }
}
