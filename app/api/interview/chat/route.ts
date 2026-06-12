import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import type { InterviewTurn } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHAT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, user_message, is_initial } = body as {
      token: string;
      user_message: string;
      is_initial: boolean;
    };

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Cargar entrevista
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, status, mode, transcript, system_prompt_snapshot, client_id')
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
        { error: 'Modo de entrevista no válido para chat' },
        { status: 400 }
      );
    }

    if (!['pending', 'in_progress'].includes(interview.status)) {
      return NextResponse.json(
        { error: `Estado inválido: ${interview.status}` },
        { status: 400 }
      );
    }

    // Si es la primera vez, marcar como in_progress
    if (interview.status === 'pending') {
      await supabase
        .from('interviews')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', interview.id);
    }

    // Cargar info del cliente para personalizar contexto
    const { data: client } = await supabase
      .from('clients')
      .select('name, legal_name')
      .eq('id', interview.client_id)
      .maybeSingle();

    // Construir el historial para Claude
    const currentTranscript = (interview.transcript as InterviewTurn[]) || [];

    // Si no es initial, agregar el mensaje del usuario al transcript
    let updatedTranscript = currentTranscript;
    if (!is_initial && user_message.trim()) {
      const userTurn: InterviewTurn = {
        role: 'user',
        content: user_message.trim(),
        at: new Date().toISOString(),
      };
      updatedTranscript = [...currentTranscript, userTurn];

      // Guardar inmediatamente (antes de stream)
      await supabase
        .from('interviews')
        .update({ transcript: updatedTranscript })
        .eq('id', interview.id);
    }

    // Construir mensajes para Claude
    const messages: Anthropic.MessageParam[] = updatedTranscript.map(
      (turn) => ({
        role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: turn.content,
      })
    );

    // Si es la primera vez, agregar mensaje contextual para que Lía arranque
    if (is_initial && messages.length === 0) {
      messages.push({
        role: 'user',
        content: `Hola. Soy del negocio ${client?.name || 'mi empresa'}${
          client?.legal_name ? ` (${client.legal_name})` : ''
        }. Estoy listo para empezar la entrevista.`,
      });
    }

    // Llamar a Claude con streaming
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stream = anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      system: interview.system_prompt_snapshot || '',
      messages,
    });

    // Stream al cliente
    const encoder = new TextEncoder();
    let fullText = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text;
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // Al terminar el stream, guardar respuesta completa en BD
          const assistantTurn: InterviewTurn = {
            role: 'assistant',
            content: fullText,
            at: new Date().toISOString(),
          };

          const finalTranscript = [...updatedTranscript, assistantTurn];

          await supabase
            .from('interviews')
            .update({ transcript: finalTranscript })
            .eq('id', interview.id);

          controller.close();
        } catch (err) {
          console.error('[chat stream] Error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[/api/interview/chat] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Error inesperado',
      },
      { status: 500 }
    );
  }
}
