import { NextRequest, NextResponse } from 'next/server';
import { signContractPublicAction } from '@/lib/actions/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Capturar IP real del cliente
    // Netlify pone la IP real en x-nf-client-connection-ip
    // Como fallback usa x-forwarded-for o x-real-ip
    const ipAddress =
      request.headers.get('x-nf-client-connection-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const userAgent = request.headers.get('user-agent') || null;

    const result = await signContractPublicAction(body, {
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      contractId: result?.contractId,
    });
  } catch (err) {
    console.error('[/api/contracts/sign] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Error inesperado',
      },
      { status: 500 }
    );
  }
}
