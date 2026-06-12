import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REALTIME_MODEL = 'gpt-realtime';
const VOICE = 'shimmer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    // 1. Validar que la entrevista exista y sea de modo voz
    const supabase = await createServiceClient();

    const { data: interview } = await supabase
      .from('interviews')
      .select(
        'id, status, mode, system_prompt_snapshot, organization_id, client_id'
      )
      .eq('public_access_token', token)
      .maybeSingle();

    if (!interview) {
      return NextResponse.json(
        { error: 'Entrevista no encontrada' },
        { status: 404 }
      );
    }

    if (interview.mode !== 'voice') {
      return NextResponse.json(
        { error: 'Esta entrevista no es de modo voz' },
        { status: 400 }
      );
    }

    if (!['pending', 'in_progress'].includes(interview.status)) {
      return NextResponse.json(
        { error: `Estado inválido: ${interview.status}` },
        { status: 400 }
      );
    }

    // 2. Cargar info del cliente para personalizar el prompt
    const { data: client } = await supabase
      .from('clients')
      .select('name, legal_name')
      .eq('id', interview.client_id)
      .maybeSingle();

    // 3. Cargar nombre del entrevistador
    const { data: prompts } = await supabase
      .from('strategy_prompts')
      .select('interviewer_name')
      .eq('organization_id', interview.organization_id)
      .maybeSingle();

    const interviewerName = prompts?.interviewer_name || 'Lía';

    // 4. Construir el system prompt completo (snapshot + contexto del cliente)
    const baseSystemPrompt = interview.system_prompt_snapshot || '';
    const contextLine = `\n\n## Información del cliente con el que vas a hablar\nNombre del negocio: ${client?.name || 'su negocio'}${
      client?.legal_name ? ` (${client.legal_name})` : ''
    }\n\nPreséntate brevemente como "${interviewerName}", explica que vas a tener una conversación de unos 20-30 minutos sobre el negocio, y empieza con tu primera pregunta sobre la historia del negocio. Habla con calidez y de manera natural.`;

    const fullSystemPrompt = baseSystemPrompt + contextLine;

    // 5. Pedir token efímero a OpenAI
    const sessionResponse = await fetch(
      'https://api.openai.com/v1/realtime/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: VOICE,
          instructions: fullSystemPrompt,
          modalities: ['audio', 'text'],
          input_audio_transcription: {
            model: 'whisper-1',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
          },
          temperature: 0.8,
          max_response_output_tokens: 4096,
        }),
      }
    );

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('[/api/interview/session] OpenAI error:', {
        status: sessionResponse.status,
        statusText: sessionResponse.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { 
          error: 'OpenAI rechazó la sesión',
          debug: {
            status: sessionResponse.status,
            openai_response: errorText,
          },
        },
        { status: 500 }
      );
    }

    const sessionData = await sessionResponse.json();

    // 6. Si la entrevista está pending, marcarla como in_progress
    if (interview.status === 'pending') {
      await supabase
        .from('interviews')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', interview.id);
    }

    // 7. Devolver el token efímero al cliente
    return NextResponse.json({
      success: true,
      client_secret: sessionData.client_secret,
      model: REALTIME_MODEL,
      voice: VOICE,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('[/api/interview/session] Catch error:', {
      message: errorMessage,
      stack: errorStack,
    });
    return NextResponse.json(
      {
        error: errorMessage,
        debug: {
          stack: errorStack,
        },
      },
      { status: 500 }
    );
  }
}
