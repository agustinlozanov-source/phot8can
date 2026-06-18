import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listChannelsAction } from '@/lib/actions/zernio-integrations';
import { IntegrationsView } from './integrations-view';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; platform?: string; error?: string }>;
}) {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'conversations.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver integraciones.
          </div>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const result = await listChannelsAction();
  const channels = 'channels' in result ? result.channels : [];

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Configuración
      </Link>

      <IntegrationsView
        channels={(channels || []) as never}
        canManage={hasPermission(ctx, 'conversations.manage_channels')}
        canConfigureAgent={hasPermission(ctx, 'conversations.configure_agent')}
        feedback={{
          connected: sp.connected === '1',
          platform: sp.platform ?? null,
          error: sp.error ?? null,
        }}
      />
    </div>
  );
}
