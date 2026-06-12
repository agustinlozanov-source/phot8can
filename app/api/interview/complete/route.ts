import { NextRequest, NextResponse } from 'next/server';
import {
  completeInterviewPublicAction,
} from '@/lib/actions/interviews';
import { generateStrategyFromInterviewAction } from '@/lib/actions/strategies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Claude puede tardar hasta 60s

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

    // 2. Disparar generación de estrategia (en background, no esperamos respuesta)
    // Esto es fire-and-forget: el cliente recibe respuesta inmediata,
    // y la generación corre en el servidor.
    if (completeResult.interviewId) {
      // No await: dejamos que corra en background
      generateStrategyFromInterviewAction({
        interview_id: completeResult.interviewId,
      }).catch((err) => {
        console.error('[complete] Error en generación de estrategia:', err);
      });
    }

    return NextResponse.json({
      success: true,
      interviewId: completeResult.interviewId,
      message: 'Entrevista completada. Generando estrategia...',
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
