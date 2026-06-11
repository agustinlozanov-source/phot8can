'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  MoreVertical,
  Warehouse as WarehouseIcon,
  Package,
  X,
  Loader2,
  MapPin,
  Briefcase,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createWarehouseAction,
  updateWarehouseAction,
  archiveWarehouseAction,
  restoreWarehouseAction,
  deleteWarehouseAction,
} from '@/lib/actions/warehouses';
import type { Warehouse, WarehouseType } from '@/lib/types/database';

type WarehouseWithUser = Warehouse & {
  assigned_user: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

interface Props {
  warehouses: WarehouseWithUser[];
  assetCounts: Record<string, number>;
  users: Array<{ id: string; first_name: string; last_name: string }>;
  canManage: boolean;
}

export function WarehousesList({
  warehouses,
  assetCounts,
  users,
  canManage,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function handleArchive(warehouseId: string) {
    if (!confirm('¿Archivar este almacén?')) return;
    setActionLoading(warehouseId);
    const result = await archiveWarehouseAction(warehouseId);
    setActionLoading(null);
    setMenuOpenId(null);
    if (result?.error) alert(result.error);
    else router.refresh();
  }

  async function handleRestore(warehouseId: string) {
    setActionLoading(warehouseId);
    await restoreWarehouseAction(warehouseId);
    setActionLoading(null);
    setMenuOpenId(null);
    router.refresh();
  }

  async function handleDelete(warehouseId: string) {
    if (!confirm('¿Eliminar permanentemente este almacén?')) return;
    setActionLoading(warehouseId);
    const result = await deleteWarehouseAction(warehouseId);
    setActionLoading(null);
    setMenuOpenId(null);
    if (result?.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Nuevo almacén
          </Button>
        </div>
      )}

      {warehouses.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <WarehouseIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin almacenes configurados</div>
          <div className="text-sm text-muted-foreground mb-4">
            Crea el primer almacén para empezar a registrar activos.
          </div>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              Crear primer almacén
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((warehouse) => {
            const isArchived = !!warehouse.archived_at;
            const isMenuOpen = menuOpenId === warehouse.id;
            const assetCount = assetCounts[warehouse.id] || 0;

            return (
              <div
                key={warehouse.id}
                className={`border rounded-lg bg-card p-4 transition-colors ${
                  isArchived
                    ? 'border-border opacity-60'
                    : 'border-border hover:border-photocan-amber/30'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <WarehouseTypeIcon type={warehouse.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-medium truncate">
                          {warehouse.name}
                        </h3>
                        {isArchived && (
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            Archivado
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getTypeLabel(warehouse.type)}
                        {warehouse.assigned_user && (
                          <>
                            {' '}
                            ·{' '}
                            <span className="text-foreground">
                              {warehouse.assigned_user.first_name}{' '}
                              {warehouse.assigned_user.last_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() =>
                          setMenuOpenId(isMenuOpen ? null : warehouse.id)
                        }
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg min-w-[160px] py-1">
                            {!isArchived ? (
                              <>
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    setEditingId(warehouse.id);
                                  }}
                                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleArchive(warehouse.id)}
                                  disabled={!!actionLoading}
                                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                                >
                                  <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                                  Archivar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRestore(warehouse.id)}
                                  disabled={!!actionLoading}
                                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-green-500" />
                                  Restaurar
                                </button>
                                <div className="border-t border-border my-1" />
                                <button
                                  onClick={() => handleDelete(warehouse.id)}
                                  disabled={!!actionLoading}
                                  className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {warehouse.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {warehouse.description}
                  </p>
                )}

                {warehouse.location_notes && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{warehouse.location_notes}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-3 border-t border-border text-xs">
                  <Package className="w-3 h-3 text-photocan-amber-deep" />
                  <span className="font-mono font-medium">{assetCount}</span>
                  <span className="text-muted-foreground">
                    {assetCount === 1 ? 'activo' : 'activos'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear */}
      {creating && (
        <WarehouseModal
          mode="create"
          users={users}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {/* Modal editar */}
      {editingId && (
        <WarehouseModal
          mode="edit"
          warehouse={warehouses.find((w) => w.id === editingId)!}
          users={users}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL CREAR/EDITAR
// ============================================================

function WarehouseModal({
  mode,
  warehouse,
  users,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  warehouse?: WarehouseWithUser;
  users: Array<{ id: string; first_name: string; last_name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(warehouse?.name || '');
  const [type, setType] = useState<WarehouseType>(
    warehouse?.type || 'fixed'
  );
  const [assignedTo, setAssignedTo] = useState(
    warehouse?.assigned_to_user_id || ''
  );
  const [description, setDescription] = useState(
    warehouse?.description || ''
  );
  const [locationNotes, setLocationNotes] = useState(
    warehouse?.location_notes || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (type === 'personal' && !assignedTo) {
      setError('Los almacenes personales requieren usuario asignado');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.set('name', name);
    formData.set('type', type);
    if (assignedTo) formData.set('assigned_to_user_id', assignedTo);
    formData.set('description', description);
    formData.set('location_notes', locationNotes);

    if (mode === 'edit' && warehouse) {
      formData.set('id', warehouse.id);
    }

    const result =
      mode === 'create'
        ? await createWarehouseAction(formData)
        : await updateWarehouseAction(formData);

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Nuevo almacén' : 'Editar almacén'}
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Estuche Pelican #2"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <div className="grid grid-cols-3 gap-2">
              <TypeButton
                type="fixed"
                label="Fijo"
                description="Bodega, cuarto"
                icon={<WarehouseIcon className="w-4 h-4" />}
                selected={type === 'fixed'}
                onClick={() => setType('fixed')}
              />
              <TypeButton
                type="mobile"
                label="Móvil"
                description="Estuche, mochila"
                icon={<Briefcase className="w-4 h-4" />}
                selected={type === 'mobile'}
                onClick={() => setType('mobile')}
              />
              <TypeButton
                type="personal"
                label="Personal"
                description="Locker, cajón"
                icon={<UserIcon className="w-4 h-4" />}
                selected={type === 'personal'}
                onClick={() => setType('personal')}
              />
            </div>
          </div>

          {type === 'personal' && (
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Usuario asignado *</Label>
              <select
                id="assigned_to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                <option value="">Selecciona un usuario</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
              placeholder="Para qué se usa este almacén"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location_notes">Ubicación física</Label>
            <Input
              id="location_notes"
              value={locationNotes}
              onChange={(e) => setLocationNotes(e.target.value)}
              disabled={isLoading}
              placeholder="Estante 3, cuarto fondo"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : mode === 'create' ? (
                'Crear almacén'
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function WarehouseTypeIcon({ type }: { type: WarehouseType }) {
  const config = {
    fixed: { Icon: WarehouseIcon, bg: 'bg-blue-500/10 border-blue-500/30 text-blue-500' },
    mobile: { Icon: Briefcase, bg: 'bg-photocan-amber/10 border-photocan-amber/30 text-photocan-amber-deep' },
    personal: { Icon: UserIcon, bg: 'bg-purple-500/10 border-purple-500/30 text-purple-500' },
  };
  const { Icon, bg } = config[type];
  return (
    <div className={`w-9 h-9 rounded-md grid place-items-center border flex-shrink-0 ${bg}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

function TypeButton({
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  type: WarehouseType;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-md border text-left transition-colors ${
        selected
          ? 'border-photocan-amber bg-photocan-amber/10'
          : 'border-border hover:border-photocan-amber/30 bg-card'
      }`}
    >
      <div
        className={`mb-1 ${selected ? 'text-photocan-amber-deep' : 'text-muted-foreground'}`}
      >
        {icon}
      </div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{description}</div>
    </button>
  );
}

function getTypeLabel(type: WarehouseType): string {
  const labels = {
    fixed: 'Almacén fijo',
    mobile: 'Almacén móvil',
    personal: 'Personal',
  };
  return labels[type];
}
