import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import {
  listRolePermissionsAction,
  listAllPermissionsAction,
} from '@/lib/actions/roles';
import { EditRoleForm } from './edit-role-form';

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'team.manage_roles')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: role } = await supabase
    .from('roles')
    .select('id, name, description, is_custom, cloned_from_role_id, organization_id')
    .eq('id', id)
    .maybeSingle();

  if (!role || role.organization_id !== ctx.organization.id) notFound();

  if (!role.is_custom) {
    return (
      <div className="p-8 max-w-4xl">
        <Link
          href="/team/roles"
          className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Roles
        </Link>
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Este rol no es editable</div>
          <div className="text-sm text-muted-foreground">
            Los roles base no se editan. Clónalo para crear una variante.
          </div>
        </div>
      </div>
    );
  }

  // Nombre del rol de origen (si fue clonado)
  let clonedFromName: string | null = null;
  if (role.cloned_from_role_id) {
    const { data: parent } = await supabase
      .from('roles')
      .select('name')
      .eq('id', role.cloned_from_role_id)
      .maybeSingle();
    clonedFromName = parent?.name ?? null;
  }

  const [currentRes, allRes] = await Promise.all([
    listRolePermissionsAction(id),
    listAllPermissionsAction(),
  ]);

  const currentPermissions =
    'permissions' in currentRes ? currentRes.permissions : [];
  const allPermissions =
    'permissions' in allRes && !Array.isArray(allRes.permissions)
      ? allRes.permissions
      : {};

  const currentIds = (currentPermissions as Array<{ id: string }>).map(
    (p) => p.id
  );

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/team/roles"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Roles
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Rol personalizado
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Shield className="w-7 h-7 text-photocan-amber" />
          {role.name}
        </h1>
        {clonedFromName && (
          <p className="text-muted-foreground text-sm">
            Clonado de{' '}
            <span className="text-foreground font-medium">{clonedFromName}</span>
          </p>
        )}
      </div>

      <EditRoleForm
        roleId={role.id}
        initialName={role.name}
        initialDescription={role.description ?? ''}
        allPermissions={allPermissions as never}
        currentPermissionIds={currentIds}
      />
    </div>
  );
}
