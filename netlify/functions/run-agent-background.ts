import type { Handler } from '@netlify/functions';
import { runAgentForConversation } from '../../lib/agent-runner';

/**
 * Background function: corre hasta 15 minutos.
 * Disparada de forma asíncrona desde el webhook de Zernio (/api/zernio/webhook)
 * cuando llega un mensaje entrante y el agente está activo con auto_respond.
 * Netlify la trata como background porque el nombre termina en "-background".
 *
 * Importa runAgentForConversation desde lib/agent-runner, que es lógica pura
 * (sin next/*), por lo que se puede bundlear sin problemas.
 */
export const handler: Handler = async (event) => {
  console.log('[run-agent-bg] Handler entered. ENV check:', {
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    has_zernio: !!process.env.ZERNIO_API_KEY,
    body_length: event.body?.length || 0,
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { conversation_id, mode, triggered_by } = body as {
      conversation_id?: string;
      mode?: 'auto' | 'suggest';
      triggered_by?: 'webhook' | 'user_request';
    };

    if (!conversation_id) {
      console.error('[run-agent-background] Missing conversation_id');
      return { statusCode: 400, body: 'Missing conversation_id' };
    }

    console.log(
      `[run-agent-background] Starting for conversation ${conversation_id} (mode=${
        mode ?? 'auto'
      })`
    );

    const result = await runAgentForConversation(conversation_id, {
      mode: mode ?? 'auto',
      triggered_by: triggered_by ?? 'webhook',
    });

    if ('error' in result && result.error) {
      console.error(`[run-agent-background] Failed:`, result.error);
      // 200 igualmente: no queremos que Netlify reintente el background job.
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: result.error }),
      };
    }

    console.log(
      `[run-agent-background] Done for conversation ${conversation_id}`
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-agent-background] Catch error:', message);
    return { statusCode: 200, body: JSON.stringify({ success: false, error: message }) };
  }
};
