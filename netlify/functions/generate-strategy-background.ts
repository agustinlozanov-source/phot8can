import type { Handler } from '@netlify/functions';
import { generateStrategyCore } from '../../lib/strategy-generator';

/**
 * Background function: corre hasta 15 minutos.
 * Disparada de manera asíncrona desde /api/interview/complete.
 * Netlify la trata como background porque el nombre termina en "-background".
 *
 * Importa directamente desde lib/strategy-generator (SIN dependencias Next.js)
 * para evitar problemas de bundling con next/cache, next/headers, etc.
 */
export const handler: Handler = async (event) => {
  console.log('[bg] Handler entered. ENV check:', {
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    body_length: event.body?.length || 0,
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { interview_id } = body as { interview_id: string };

    if (!interview_id) {
      console.error('[generate-strategy-background] Missing interview_id');
      return { statusCode: 400, body: 'Missing interview_id' };
    }

    console.log(
      `[generate-strategy-background] Starting for interview ${interview_id}`
    );

    const result = await generateStrategyCore({ interview_id });

    if (result.error) {
      console.error(`[generate-strategy-background] Failed:`, result.error);
      return { statusCode: 500, body: result.error };
    }

    if (!result.success) {
      return { statusCode: 500, body: 'Unknown error' };
    }

    console.log(
      `[generate-strategy-background] Done. Strategy: ${result.strategyId}, tokens: ${result.tokensInput}/${result.tokensOutput}, duration: ${result.durationMs}ms`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        strategyId: result.strategyId,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-strategy-background] Catch error:', message);
    return { statusCode: 500, body: message };
  }
};
