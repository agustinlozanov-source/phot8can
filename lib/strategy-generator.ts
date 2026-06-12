/**
 * strategy-generator.ts
 *
 * Lógica pura de generación de estrategias con Claude.
 * SIN dependencias de Next.js (no 'use server', no next/cache, no next/headers).
 * Puede ser importado desde server actions Y desde Netlify background functions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { z } from 'zod';
import type { Database, InterviewTurn } from './types/database';

// ============================================================
// CONFIGURACIÓN
// ============================================================

const STRATEGY_MODEL = 'claude-sonnet-4-6';
const MAX_GENERATION_TOKENS = 8000;

// ============================================================
// SCHEMAS ZOD
// ============================================================

const claudeStrategyResponseSchema = z.object({
  title: z.string().min(1).max(200),
  layers: z
    .array(
      z.object({
        kind: z.enum([
          'insights',
          'positioning',
          'audience',
          'messages',
          'pillars',
          'tone',
          'action_plan',
        ]),
        title: z.string().min(1).max(200),
        content_html: z.string().min(1).max(20000),
      })
    )
    .length(7, 'Claude debe devolver exactamente 7 capas'),
});

// ============================================================
// CLIENTE SUPABASE DIRECTO (sin next/headers)
// ============================================================

function createServiceClientDirect() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 0,
        },
        transport: ws as unknown as typeof WebSocket,
      },
      global: {
        headers: {
          'x-application-name': 'photocan-bg-function',
        },
      },
    }
  );
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Claude a veces envuelve JSON en bloques markdown ```json ... ```
 * Esta función limpia eso antes de hacer JSON.parse
 */
export function extractJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export function transcriptToText(transcript: InterviewTurn[]): string {
  return transcript
    .map((turn) => {
      const role = turn.role === 'assistant' ? 'ENTREVISTADORA' : 'CLIENTE';
      return `${role}: ${turn.content}`;
    })
    .join('\n\n');
}

// ============================================================
// FUNCIÓN PRINCIPAL: GENERAR ESTRATEGIA
// ============================================================

export type GenerateStrategyResult =
  | {
      success: true;
      strategyId: string;
      tokensInput: number;
      tokensOutput: number;
      durationMs: number;
      error?: never;
    }
  | { error: string; success?: never };

export async function generateStrategyCore(params: {
  interview_id: string;
}): Promise<GenerateStrategyResult> {
  const supabase = createServiceClientDirect();

  // 1. Cargar entrevista
  const { data: interview } = await supabase
    .from('interviews')
    .select(
      'id, organization_id, client_id, status, transcript, system_prompt_snapshot'
    )
    .eq('id', params.interview_id)
    .maybeSingle();

  if (!interview) {
    return { error: 'Entrevista no encontrada' };
  }

  if (interview.status !== 'completed') {
    return {
      error: `La entrevista debe estar completada (actual: ${interview.status})`,
    };
  }

  // 2. Marcar como 'processing' para evitar dobles ejecuciones
  await supabase
    .from('interviews')
    .update({ status: 'processing' })
    .eq('id', interview.id);

  try {
    // 3. Cargar info del cliente y prompts en paralelo
    const [clientResult, promptsResult] = await Promise.all([
      supabase
        .from('clients')
        .select('name, legal_name, website, notes')
        .eq('id', interview.client_id)
        .maybeSingle(),
      supabase
        .from('strategy_prompts')
        .select('strategy_generation_prompt')
        .eq('organization_id', interview.organization_id)
        .maybeSingle(),
    ]);

    if (!clientResult.data || !promptsResult.data) {
      throw new Error('No se pudo cargar información del cliente o prompts');
    }

    const client = clientResult.data;
    const systemPrompt = promptsResult.data.strategy_generation_prompt;

    // 4. Construir mensaje para Claude
    const transcript = (interview.transcript as InterviewTurn[]) || [];
    const transcriptText = transcriptToText(transcript);

    const userMessage = `# Información del cliente
Nombre: ${client.name}
${client.legal_name ? `Razón social: ${client.legal_name}` : ''}
${client.website ? `Sitio web: ${client.website}` : ''}
${client.notes ? `Notas internas: ${client.notes}` : ''}

# Transcripción de la entrevista
${transcriptText}

---

Genera la estrategia digital en 7 capas siguiendo el formato JSON estricto que se te indicó. Solo el JSON, sin texto adicional.`;

    // 5. Llamar a Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: STRATEGY_MODEL,
      max_tokens: MAX_GENERATION_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const durationMs = Date.now() - startTime;

    // 6. Extraer y parsear JSON
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude no devolvió contenido de texto');
    }

    const jsonText = extractJSON(textBlock.text);
    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch {
      console.error('[generateStrategyCore] JSON inválido de Claude:', jsonText);
      throw new Error('Claude devolvió un JSON inválido');
    }

    // 7. Validar estructura con Zod
    const validation = claudeStrategyResponseSchema.safeParse(parsedData);
    if (!validation.success) {
      console.error(
        '[generateStrategyCore] Schema inválido:',
        validation.error
      );
      throw new Error(
        `Formato inválido: ${validation.error.errors[0].message}`
      );
    }

    // 8. Crear strategy en BD
    const { data: newStrategy, error: strategyError } = await supabase
      .from('strategies')
      .insert({
        organization_id: interview.organization_id,
        client_id: interview.client_id,
        interview_id: interview.id,
        title: validation.data.title,
        status: 'draft',
        version: 1,
        ai_model_used: STRATEGY_MODEL,
        generation_tokens_input: response.usage.input_tokens,
        generation_tokens_output: response.usage.output_tokens,
        generated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (strategyError || !newStrategy) {
      throw new Error(
        `Error guardando estrategia: ${strategyError?.message}`
      );
    }

    // 9. Crear las 7 capas
    const layersToInsert = validation.data.layers.map((layer, idx) => ({
      strategy_id: newStrategy.id,
      kind: layer.kind,
      layer_order: idx,
      title: layer.title,
      content_html: layer.content_html,
      ai_draft_content: layer.content_html, // snapshot original
      status: 'ai_draft' as const,
    }));

    const { error: layersError } = await supabase
      .from('strategy_layers')
      .insert(layersToInsert);

    if (layersError) {
      // Si falla, borramos la strategy para no dejar huérfana
      await supabase.from('strategies').delete().eq('id', newStrategy.id);
      throw new Error(`Error guardando capas: ${layersError.message}`);
    }

    // 10. Marcar entrevista como completed (terminó procesamiento)
    await supabase
      .from('interviews')
      .update({ status: 'completed' })
      .eq('id', interview.id);

    return {
      success: true,
      strategyId: newStrategy.id,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      durationMs,
    };
  } catch (err) {
    // Si algo falla, marcar entrevista como failed
    const errorMessage =
      err instanceof Error ? err.message : 'Error desconocido';

    await supabase
      .from('interviews')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 1000),
      })
      .eq('id', interview.id);

    console.error('[generateStrategyCore] Error:', err);
    return { error: errorMessage };
  }
}
