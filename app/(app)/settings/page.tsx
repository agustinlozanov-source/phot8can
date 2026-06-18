import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Settings, Plug, ArrowRight } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';

export default async function SettingsPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  const canIntegrations =
    hasPermission(ctx, 'conversations.view') ||
    hasPermission(ctx, 'conversations.manage_channels');

  const sections = [
    {
      show: canIntegrations,
      href: '/settings/integrations',
      icon: Plug,
      title: 'Integraciones',
      description:
        'Conecta WhatsApp, Instagram y otros canales para recibir mensajes de clientes.',
    },
  ].filter((s) => s.show);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Administración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Settings className="w-7 h-7 text-photocan-amber" />
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Ajustes de la organización
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-sm text-muted-foreground">
            No hay secciones de configuración disponibles para tu rol.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group border border-border rounded-lg bg-card p-5 hover:border-photocan-amber/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="w-10 h-10 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-photocan-amber" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-photocan-amber transition-colors" />
                </div>
                <div className="font-medium mb-0.5">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.description}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
