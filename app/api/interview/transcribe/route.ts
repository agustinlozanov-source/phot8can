import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const WHISPER_MODEL = 'whisper-1';
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB (límite de Whisper)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const audio = formData.get('audio') as File | null;

    if (!token) {
      return NextResponse.json(
        { error: 'Token requerido' },
        { status: 400 }
      );
    }

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio requerido' },
        { status: 400 }
      );
    }

    if (audio.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'El audio es demasiado largo' },
        { status: 400 }
      );
    }

    // Validar entrevista
    const supabase = await createServiceClient();
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, status, mode')
      .eq('public_access_token', token)
      .maybeSingle();

    if (!interview) {
      return NextResponse.json(
        { error: 'Entrevista no encontrada' },
        { status: 404 }
      );
    }

    if (interview.mode !== 'text') {
      return NextResponse.json(
        { error: 'Esta función solo está disponible en entrevistas de texto' },
        { status: 400 }
      );
    }

    if (!['pending', 'in_progress'].includes(interview.status)) {
      return NextResponse.json(
        { error: 'Esta entrevista no está activa' },
        { status: 400 }
      );
    }

    // Llamar a Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audio, 'audio.webm');
    whisperFormData.append('model', WHISPER_MODEL);
    whisperFormData.append('language', 'es');
    whisperFormData.append('response_format', 'json');

    const whisperResponse = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('[transcribe] Whisper error:', errorText);
      return NextResponse.json(
        { error: 'Error en transcripción. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    const data = await whisperResponse.json();
    const transcribedText = (data.text as string) || '';

    if (!transcribedText.trim()) {
      return NextResponse.json(
        { error: 'No se detectó audio claro' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: transcribedText.trim(),
    });
  } catch (err) {
    console.error('[/api/interview/transcribe] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Error inesperado',
      },
      { status: 500 }
    );
  }
}
