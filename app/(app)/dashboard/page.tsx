import { createClient } from '@/lib/supabase/server';
import { Users, Building2, Sparkles, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!appUser) return null;

  const orgId = appUser.organization_id;

  const { count: usersCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_active', true);

  const { count: pendingInvitations } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  const hour = new Date().getHours();
  let greeting = 'Buenos días';
  if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';
  if (hour >= 19 || hour < 6) greeting = 'Buenas noches';

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          {appUser.organization?.name}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {greeting}, {appUser.first_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Bienvenido al sistema operativo de tu agencia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-5 border-r border-border last:border-r-0">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Users className="w-3.5 h-3.5" />
            Equipo
          </div>
          <div className="text-3xl font-semibold tracking-tight">{usersCount ?? 0}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">usuarios activos</div>
        </div>
        <div className="p-5 border-r border-border last:border-r-0">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Building2 className="w-3.5 h-3.5" />
            Clientes
          </div>
          <div className="text-3xl font-semibold tracking-tight">—</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">módulo en construcción</div>
        </div>
        <div className="p-5 border-r border-border last:border-r-0">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Estrategias activas
          </div>
          <div className="text-3xl font-semibold tracking-tight">—</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">módulo en construcción</div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <FileText className="w-3.5 h-3.5" />
            Cotizaciones del mes
          </div>
          <div className="text-3xl font-semibold tracking-tight">—</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">módulo en construcción</div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-0.5 h-3.5 bg-photocan-amber rounded-sm" />
          Lo que puedes hacer hoy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            href="/team"
            className="block p-5 border border-border rounded-lg bg-card hover:border-photocan-amber/30 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <Users className="w-5 h-5 text-photocan-amber" />
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </div>
            <div className="font-medium mb-1">Gestionar equipo</div>
            <div className="text-xs text-muted-foreground">
              Invita a tu equipo, gestiona usuarios y revisa invitaciones pendientes.
            </div>
            {(pendingInvitations ?? 0) > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber">
                <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
                {pendingInvitations}{' '}
                {pendingInvitations === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}
              </div>
            )}
          </Link>
          <div className="block p-5 border border-dashed border-border rounded-lg bg-card/50">
            <div className="flex items-start justify-between mb-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase text-muted-foreground/50 tracking-wider">
                pronto
              </span>
            </div>
            <div className="font-medium mb-1 text-muted-foreground">Agregar primer cliente</div>
            <div className="text-xs text-muted-foreground">
              El módulo de CRM se construye después del equipo.
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border border-border rounded-lg bg-card">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-0.5 h-3.5 bg-photocan-amber rounded-sm" />
          Estado de la plataforma
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Módulo 01 — Identidad y acceso</span>
            <span className="flex items-center gap-2 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Operativo
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Módulo 02 — Clientes (CRM)</span>
            <span className="flex items-center gap-2 text-photocan-amber">
              <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
              En construcción
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground/50">Módulo 03 — Cotizaciones</span>
            <span className="flex items-center gap-2 text-muted-foreground/50">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              Próximo
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground/50">Módulo 04 — Estrategia e IA</span>
            <span className="flex items-center gap-2 text-muted-foreground/50">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              Próximo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
