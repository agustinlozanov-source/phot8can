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
    // Zernio devuelve: ?connected=whatsapp&profileId=xxx&accountId=xxx&username=...
    // (NO incluye org_id; lo resolvemos por profileId). `platform` también puede
    // venir como el param que nosotros mandamos en el redirect_url.
    const platform = sp.get('connected') || sp.get('platform');
    const profileId = sp.get('profileId') || sp.get('profile_id');
    const accountId = sp.get('accountId') || sp.get('account_id');
    const username = sp.get('username');
    const displayName = sp.get('display_name') || sp.get('name');
    const phoneNumber = sp.get('phone_number') || sp.get('phone');
    const avatarUrl = sp.get('avatar_url') || sp.get('avatar');
    const accountDataRaw = sp.get('account_data');

    if (!profileId || !platform || !accountId) {
      console.error('[ZernioCallback] Parámetros faltantes', {
        profileId,
        platform,
        accountId,
      });
      return NextResponse.redirect(
        settingsUrl(req, 'error=' + encodeURIComponent('Faltan parámetros del callback'))
      );
    }

    // account_data: preferimos el JSON si viene, si no lo armamos con los params sueltos
    let accountData: Record<string, unknown> | undefined;
    if (accountDataRaw) {
      try {
        accountData = JSON.parse(accountDataRaw);
      } catch {
        console.warn('[ZernioCallback] account_data no es JSON válido');
      }
    }
    if (!accountData) {
      accountData = {};
      if (username) accountData.username = username;
      if (displayName) accountData.display_name = displayName;
      if (phoneNumber) accountData.phone_number = phoneNumber;
      if (avatarUrl) accountData.avatar_url = avatarUrl;
    }

    const result = await completeChannelConnectionAction({
      profile_id: profileId,
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
      `[ZernioCallback] Canal ${platform} conectado (profile ${profileId})`
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
