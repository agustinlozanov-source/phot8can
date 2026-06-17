'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCustomRoleAction } from '@/lib/actions/roles';

type Permission = { id: string; code: string; description: string };

export function EditRoleForm({
  roleId,
  initialName,
  initialDescription,
  allPermissions,
  currentPermissionIds,
}: {
  roleId: string;
  initialName: string;
  initialDescription: string;
  allPermissions: Record<string, Permission[]>;
  currentPermissionIds: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentPermissionIds)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const categories = Object.keys(allPermissions).sort();

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setSaved(false);
  }

  function toggleCategory(perms: Permission[], allOn: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      for (const p of perms) {
        if (allOn) n.delete(p.id);
        else n.add(p.id);
      }
      return n;
    });
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError('El nombre es obligatorio');
    setLoading(true);
    const result = await updateCustomRoleAction({
      role_id: roleId,
      name: name.trim(),
      description: description.trim() || null,
      permission_ids: Array.from(selected),
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Datos del rol */}
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role_name">Nombre</Label>
          <Input
            id="role_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role_desc">Descripción</Label>
          <textarea
            id="role_desc"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
            disabled={loading}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
          />
        </div>
      </div>

      {/* Matriz de permisos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
            Permisos ({selected.size})
          </h2>
        </div>
        <div className="space-y-4">
          {categories.map((cat) => {
            const perms = allPermissions[cat];
            const allOn = perms.every((p) => selected.has(p.id));
            return (
              <div
                key={cat}
                className="border border-border rounded-lg bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/40 border-b border-border">
                  <span className="text-xs font-mono uppercase tracking-wider font-medium">
                    {cat}
                  </span>
                  <button
                    onClick={() => toggleCategory(perms, allOn)}
                    className="text-[10px] font-mono text-muted-foreground hover:text-photocan-amber transition-colors"
                  >
                    {allOn ? 'Quitar todos' : 'Marcar todos'}
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {perms.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-secondary/30"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        disabled={loading}
                        className="w-4 h-4 mt-0.5 accent-photocan-amber"
                      />
                      <div className="min-w-0">
                        <div className="text-sm">{p.description}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {p.code}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Barra de guardado sticky */}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={handleSave} disabled={loading} size="lg" className="shadow-lg">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Guardado' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
