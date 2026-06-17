'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Copy,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cloneRoleAction,
  deleteCustomRoleAction,
} from '@/lib/actions/roles';

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_custom: boolean;
  cloned_from_role_id: string | null;
  active_user_count: number;
};

export function RolesConfig({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<Role | null>(null);

  const baseRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);
  const roleName = (id: string | null) =>
    roles.find((r) => r.id === id)?.name ?? null;

  async function handleDelete(role: Role) {
    if (!confirm(`¿Borrar el rol "${role.name}"?`)) return;
    setError(null);
    setLoading(`del-${role.id}`);
    const result = await deleteCustomRoleAction(role.id);
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Roles base */}
      <div className="mb-8">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Roles base
        </div>
        <div className="space-y-2">
          {baseRoles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              onClone={() => {
                setError(null);
                setCloneSource(role);
              }}
            />
          ))}
        </div>
      </div>

      {/* Roles personalizados */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Roles personalizados ({customRoles.length})
        </div>
        {customRoles.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Aún no hay roles personalizados. Clona un rol base para crear uno.
          </div>
        ) : (
          <div className="space-y-2">
            {customRoles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                clonedFromName={roleName(role.cloned_from_role_id)}
                deleting={loading === `del-${role.id}`}
                onDelete={() => handleDelete(role)}
              />
            ))}
          </div>
        )}
      </div>

      {cloneSource && (
        <CloneRoleModal
          source={cloneSource}
          onClose={() => setCloneSource(null)}
        />
      )}
    </div>
  );
}

function RoleRow({
  role,
  clonedFromName,
  deleting,
  onClone,
  onDelete,
}: {
  role: Role;
  clonedFromName?: string | null;
  deleting?: boolean;
  onClone?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-medium flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-photocan-amber" />
            {role.name}
          </span>
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
              role.is_system
                ? 'bg-secondary text-muted-foreground'
                : 'bg-photocan-amber/10 text-photocan-amber-deep'
            }`}
          >
            {role.is_system ? 'Sistema' : 'Personalizado'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Users className="w-3 h-3" />
            {role.active_user_count}{' '}
            {role.active_user_count === 1 ? 'miembro' : 'miembros'}
          </span>
        </div>
        {role.description && (
          <div className="text-xs text-muted-foreground">{role.description}</div>
        )}
        {clonedFromName && (
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            clonado de {clonedFromName}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {role.is_system ? (
          <Button size="sm" variant="outline" onClick={onClone}>
            <Copy className="w-3.5 h-3.5" />
            Clonar
          </Button>
        ) : (
          <>
            <Link
              href={`/team/roles/${role.id}/edit`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-secondary transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function CloneRoleModal({
  source,
  onClose,
}: {
  source: Role;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(`${source.name} (copia)`);
  const [description, setDescription] = useState(source.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClone() {
    setError(null);
    if (!name.trim()) return setError('El nombre es obligatorio');
    setLoading(true);
    const result = await cloneRoleAction({
      source_role_id: source.id,
      new_name: name.trim(),
      new_description: description.trim() || undefined,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    if ('roleId' in result && result.roleId) {
      router.push(`/team/roles/${result.roleId}/edit`);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !loading && onClose()} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">Clonar rol</h3>
          <button onClick={onClose} disabled={loading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Rol de origen</Label>
            <div className="text-sm px-3 py-2 rounded-md bg-secondary/50 border border-border text-muted-foreground">
              {source.name}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clone_name">Nuevo nombre *</Label>
            <Input id="clone_name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clone_desc">Descripción (opcional)</Label>
            <textarea
              id="clone_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Se copiarán todos los permisos del rol de origen. Podrás ajustarlos
            en el siguiente paso.
          </p>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleClone} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Clonar y editar'}
          </Button>
        </div>
      </div>
    </>
  );
}
