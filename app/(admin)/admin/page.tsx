import { createClient } from '@/lib/supabase/server';
import { Building2, Shield, Users } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Estadísticas globales
  const { count: orgsCount } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true });

  const { count: usersCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: superAdminsCount } = await supabase
    .from('super_admins')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Vista global
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Plataforma Photocan OS
        </h1>
        <p className="text-muted-foreground text-sm">
          Resumen de todas las organizaciones, usuarios y actividad del SaaS.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-5 border-r border-border last:border-r-0">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Building2 className="w-3.5 h-3.5" />
            Organizaciones
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {orgsCount ?? 0}
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            agencias activas
          </div>
        </div>

        <div className="p-5 border-r border-border last:border-r-0">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Users className="w-3.5 h-3.5" />
            Usuarios totales
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {usersCount ?? 0}
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            en todas las organizaciones
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" />
            Super Admins
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {superAdminsCount ?? 0}
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            con acceso total
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-0.5 h-3.5 bg-photocan-amber rounded-sm" />
          Accesos rápidos
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            href="/admin/organizations"
            className="block p-5 border border-border rounded-lg bg-card hover:border-photocan-amber/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-photocan-amber" />
              <div className="font-medium">Gestionar organizaciones</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Ver todas las agencias, crear nuevas, gestionar configuración.
            </div>
          </Link>

          <Link
            href="/admin/super-admins"
            className="block p-5 border border-border rounded-lg bg-card hover:border-photocan-amber/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-photocan-amber" />
              <div className="font-medium">Super administradores</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Gestiona quién tiene acceso total al sistema.
            </div>
          </Link>
        </div>
      </div>

      {/* System status */}
      <div className="p-5 border border-border rounded-lg bg-card">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-0.5 h-3.5 bg-photocan-amber rounded-sm" />
          Estado del sistema
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Base de datos</span>
            <span className="flex items-center gap-2 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Operativa
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Auth</span>
            <span className="flex items-center gap-2 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Operativa
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Módulo 01 — Identidad y acceso</span>
            <span className="flex items-center gap-2 text-photocan-amber">
              <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
              En construcción
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
