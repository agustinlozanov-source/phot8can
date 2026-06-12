import { NextRequest, NextResponse } from 'next/server';
import { completeInterviewPublicAction } from '@/lib/actions/interviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json(
        { error: 'Token requerido' },
        { status: 400 }
      );
    }

    // 1. Marcar entrevista como completada
    const completeResult = await completeInterviewPublicAction(token);

    if (completeResult.error) {
      return NextResponse.json(
        { error: completeResult.error },
        { status: 400 }
      );
    }

    // 2. Disparar background function para generar estrategia
    // Esta llamada es asíncrona — Netlify la procesa con hasta 15min de timeout
    if (completeResult.interviewId) {
      const siteUrl = process.env.URL || process.env.DEPLOY_URL || '';

      // Fire and forget — no esperamos respuesta
      fetch(`${siteUrl}/.netlify/functions/generate-strategy-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interview_id: completeResult.interviewId }),
      }).catch((err) => {
        console.error('[complete] Error disparando background:', err);
      });
    }

    return NextResponse.json({
      success: true,
      interviewId: completeResult.interviewId,
      message: 'Entrevista completada. Generando estrategia en background...',
    });
  } catch (err) {
    console.error('[/api/interview/complete] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Error inesperado',
      },
      { status: 500 }
    );
  }
}
