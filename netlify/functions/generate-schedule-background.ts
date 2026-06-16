import type { Handler } from '@netlify/functions';
import { generateScheduleCore } from '../../lib/schedule-generator';

/**
 * Background function: corre hasta 15 minutos.
 * Disparada de manera asíncrona desde createScheduleAction.
 * Netlify la trata como background porque el nombre termina en "-background".
 *
 * Importa directamente desde lib/schedule-generator (SIN dependencias Next.js)
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
    const { schedule_id } = body as { schedule_id: string };

    if (!schedule_id) {
      console.error('[generate-schedule-background] Missing schedule_id');
      return { statusCode: 400, body: 'Missing schedule_id' };
    }

    console.log(
      `[generate-schedule-background] Starting for schedule ${schedule_id}`
    );

    const result = await generateScheduleCore({ schedule_id });

    if (result.error) {
      console.error(`[generate-schedule-background] Failed:`, result.error);
      return { statusCode: 500, body: result.error };
    }

    if (!result.success) {
      return { statusCode: 500, body: 'Unknown error' };
    }

    console.log(
      `[generate-schedule-background] Done. Schedule: ${result.scheduleId}, items: ${result.itemsGenerated}, tokens: ${result.tokensInput}/${result.tokensOutput}, duration: ${result.durationMs}ms`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        scheduleId: result.scheduleId,
        itemsGenerated: result.itemsGenerated,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-schedule-background] Catch error:', message);
    return { statusCode: 500, body: message };
  }
};
