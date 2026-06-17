import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listRolesAction } from '@/lib/actions/roles';
import { RolesConfig } from './roles-config';

export default async function TeamRolesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'team.manage_roles')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para configurar roles.
          </div>
        </div>
      </div>
    );
  }

  const rolesRes = await listRolesAction();
  const roles = 'roles' in rolesRes ? rolesRes.roles : [];

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/team"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Equipo
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Configuración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Shield className="w-7 h-7 text-photocan-amber" />
          Roles y permisos
        </h1>
        <p className="text-muted-foreground text-sm">
          Los roles base no se editan; clónalos para crear variantes con
          permisos a medida.
        </p>
      </div>

      <RolesConfig roles={(roles || []) as never} />
    </div>
  );
}
