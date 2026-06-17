'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/lib/actions/expense-categories';
import type { ExpenseCategory } from '@/lib/types/database';
import {
  CategoryBadge,
  CategoryIcon,
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
} from '../finance-ui';

interface Props {
  mode: 'create' | 'edit';
  category?: ExpenseCategory;
  parents: Array<{ id: string; name: string }>;
  onClose: () => void;
}

export function CategoryModal({ mode, category, parents, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [color, setColor] = useState(category?.color ?? '#6B7280');
  const [icon, setIcon] = useState(category?.icon ?? 'Tag');
  const [parentId, setParentId] = useState(category?.parent_category_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableParents = parents.filter((p) => p.id !== category?.id);

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 1) return setError('El nombre es obligatorio');
    if (!/^#[0-9a-fA-F]{6}$/.test(color))
      return setError('Color hex inválido (#RRGGBB)');

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      icon: icon || null,
      parent_category_id: parentId || null,
    };

    setLoading(true);
    const result =
      mode === 'create'
        ? await createCategoryAction(payload)
        : await updateCategoryAction({ id: category!.id, ...payload });
    setLoading(false);

    if (result?.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !loading && onClose()} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
          </h3>
          <button onClick={onClose} disabled={loading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview en vivo */}
          <div className="flex items-center justify-center py-2">
            <CategoryBadge name={name.trim() || 'Categoría'} color={color} icon={icon} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="Ej: Software" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Descripción</Label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color *</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  disabled={loading}
                  className="w-7 h-7 rounded-full grid place-items-center border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: color === c ? 'white' : 'transparent',
                  }}
                  title={c}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={loading}
              className="font-mono text-xs w-28"
              maxLength={7}
            />
          </div>

          {/* Icono */}
          <div className="space-y-2">
            <Label>Icono</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_NAMES.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  disabled={loading}
                  className={`aspect-square grid place-items-center rounded-md border transition-colors ${
                    icon === iconName
                      ? 'border-photocan-amber bg-photocan-amber/10 text-photocan-amber'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                  title={iconName}
                >
                  <CategoryIcon name={iconName} size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Padre */}
          {availableParents.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="parent">Categoría padre (opcional)</Label>
              <select
                id="parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin padre (categoría principal)</option>
                {availableParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      </div>
    </>
  );
}
