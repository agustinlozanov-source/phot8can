import { NextRequest, NextResponse } from 'next/server';
import { completeChannelConnectionAction } from '@/lib/actions/zernio-integrations';

function settingsUrl(req: NextRequest, params: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    req.nextUrl.origin;
  return `${base}/settings/integrations?${params}`;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get('org_id');
    const platform = sp.get('platform');
    const accountId = sp.get('account_id');
    const accountDataRaw = sp.get('account_data');

    if (!orgId || !platform || !accountId) {
      console.error('[ZernioCallback] Parámetros faltantes', {
        orgId,
        platform,
        accountId,
      });
      return NextResponse.redirect(
        settingsUrl(req, 'error=' + encodeURIComponent('Faltan parámetros del callback'))
      );
    }

    let accountData: Record<string, unknown> | undefined;
    if (accountDataRaw) {
      try {
        accountData = JSON.parse(accountDataRaw);
      } catch {
        console.warn('[ZernioCallback] account_data no es JSON válido');
      }
    }

    const result = await completeChannelConnectionAction({
      org_id: orgId,
      platform,
      account_id: accountId,
      account_data: accountData,
    });

    if ('error' in result && result.error) {
      console.error('[ZernioCallback] Error:', result.error);
      return NextResponse.redirect(
        settingsUrl(req, 'error=' + encodeURIComponent(result.error))
      );
    }

    console.log(
      `[ZernioCallback] Canal ${platform} conectado para org ${orgId}`
    );
    return NextResponse.redirect(
      settingsUrl(req, `connected=1&platform=${encodeURIComponent(platform)}`)
    );
  } catch (err) {
    console.error('[ZernioCallback] Error inesperado:', err);
    return NextResponse.redirect(
      settingsUrl(req, 'error=' + encodeURIComponent('Error al conectar el canal'))
    );
  }
}
