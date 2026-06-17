'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Sparkles,
  Edit2,
  Power,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExpenseCategory } from '@/lib/types/database';
import {
  seedDefaultCategoriesAction,
  setCategoryActiveAction,
  reorderCategoriesAction,
} from '@/lib/actions/expense-categories';
import { CategoryIcon, formatCurrency } from '../finance-ui';
import { CategoryModal } from './category-modal';

type CategoryRow = ExpenseCategory & {
  total_expenses: number;
  total_amount: number;
};

export function CategoriesList({
  active,
  inactive,
  canManage,
}: {
  active: CategoryRow[];
  inactive: CategoryRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [order, setOrder] = useState<CategoryRow[]>(active);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | {
    mode: 'create' | 'edit';
    category?: ExpenseCategory;
  }>(null);

  const parents = [...active, ...inactive].map((c) => ({ id: c.id, name: c.name }));
  const total = active.length + inactive.length;

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); // optimista
    setError(null);
    setLoading('reorder');
    const result = await reorderCategoriesAction({
      ordered_ids: next.map((c) => c.id),
    });
    setLoading(null);
    if (result?.error) {
      setError(result.error);
      setOrder(active); // revertir
    } else {
      router.refresh();
    }
  }

  async function toggleActive(c: CategoryRow) {
    setError(null);
    setLoading(`active-${c.id}`);
    const result = await setCategoryActiveAction({
      category_id: c.id,
      is_active: !c.is_active,
    });
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleSeed() {
    setError(null);
    setLoading('seed');
    const result = await seedDefaultCategoriesAction();
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  if (total === 0) {
    return (
      <>
        {error && <ErrorBanner error={error} />}
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
            <Tag className="w-5 h-5 text-photocan-amber" />
          </div>
          <div className="font-medium mb-2">Sin categorías de gastos</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Las categorías ayudan a organizar y reportar en qué se gasta el
            dinero.
          </p>
          {canManage && (
            <div className="flex items-center justify-center gap-2">
              <Button onClick={handleSeed} disabled={loading === 'seed'}>
                {loading === 'seed' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Seedear las base
              </Button>
              <Button variant="outline" onClick={() => setModal({ mode: 'create' })}>
                <Plus className="w-4 h-4" />
                Agregar manual
              </Button>
            </div>
          )}
        </div>
        {modal && (
          <CategoryModal mode={modal.mode} category={modal.category} parents={parents} onClose={() => setModal(null)} />
        )}
      </>
    );
  }

  const list = showInactive ? inactive : order;

  return (
    <div>
      {error && <ErrorBanner error={error} />}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 accent-photocan-amber"
          />
          Mostrar inactivas ({inactive.length})
        </label>
        {canManage && (
          <Button onClick={() => setModal({ mode: 'create' })}>
            <Plus className="w-4 h-4" />
            Agregar categoría
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {showInactive ? 'No hay categorías inactivas.' : 'No hay categorías activas.'}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c, i) => (
            <div
              key={c.id}
              className="border border-border rounded-lg bg-card p-3 flex items-center gap-3 hover:border-photocan-amber/40 transition-colors"
            >
              {/* Reorder (solo en activas) */}
              {canManage && !showInactive && (
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || loading === 'reorder'}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Subir"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1 || loading === 'reorder'}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Bajar"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Bullet de color + icon */}
              <div
                className="w-9 h-9 rounded-md grid place-items-center flex-shrink-0"
                style={{ background: `${c.color}1a`, color: c.color }}
              >
                <CategoryIcon name={c.icon} size={18} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.name}</span>
                  {!c.is_active && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Inactiva
                    </span>
                  )}
                </div>
                {c.description && (
                  <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                )}
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {c.total_expenses} gastos ·{' '}
                  <span className="text-green-500">{formatCurrency(c.total_amount, 'MXN')}</span>
                </div>
              </div>

              {/* Acciones */}
              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn title="Editar" onClick={() => { setError(null); setModal({ mode: 'edit', category: c }); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn
                    title={c.is_active ? 'Desactivar' : 'Reactivar'}
                    onClick={() => toggleActive(c)}
                    disabled={loading === `active-${c.id}`}
                    danger={c.is_active}
                  >
                    {loading === `active-${c.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                  </IconBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal mode={modal.mode} category={modal.category} parents={parents} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {error}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-40 ${
        danger ? 'hover:text-destructive' : ''
      }`}
    >
      {children}
    </button>
  );
}
