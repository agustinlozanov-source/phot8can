'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Percent, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaxModal } from './tax-modal';
import {
  toggleTaxEnabledAction,
  deleteTaxAction,
} from '@/lib/actions/catalog';
import type { Tax } from '@/lib/types/database';

export function TaxesList({
  taxes,
  canManage,
}: {
  taxes: Tax[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function openCreateModal() {
    setEditingTax(null);
    setModalOpen(true);
  }

  function openEditModal(tax: Tax) {
    setEditingTax(tax);
    setModalOpen(true);
  }

  async function handleToggle(tax: Tax) {
    setActionLoading(tax.id);
    await toggleTaxEnabledAction(tax.id, !tax.is_enabled);
    setActionLoading(null);
    router.refresh();
  }

  async function handleDelete(tax: Tax) {
    if (
      !confirm(
        `¿Eliminar el impuesto "${tax.name}"? Las cotizaciones existentes no se modifican.`
      )
    ) {
      return;
    }
    setActionLoading(tax.id);
    await deleteTaxAction(tax.id);
    setActionLoading(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Impuestos configurados
        </div>
        {canManage && (
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Nuevo impuesto
          </Button>
        )}
      </div>

      {taxes.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Percent className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin impuestos configurados</div>
          <div className="text-sm text-muted-foreground mb-4">
            Agrega los impuestos que apliques en tus cotizaciones (IVA, IEPS,
            ISR retenido, etc.)
          </div>
          {canManage && (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Crear primer impuesto
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Código
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Porcentaje
                </th>
                <th className="text-center px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Por defecto
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                {canManage && (
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {taxes.map((tax) => (
                <tr
                  key={tax.id}
                  className={`border-t border-border ${
                    !tax.is_enabled ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{tax.name}</div>
                    {tax.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {tax.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {tax.code || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm font-medium">
                      {Number(tax.percentage).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tax.apply_by_default ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber-deep">
                        <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
                        Sí
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tax.is_enabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Habilitado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Deshabilitado
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleToggle(tax)}
                          disabled={actionLoading === tax.id}
                          title={tax.is_enabled ? 'Deshabilitar' : 'Habilitar'}
                          className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(tax)}
                          title="Editar"
                          className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tax)}
                          disabled={actionLoading === tax.id}
                          title="Eliminar"
                          className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info card */}
      <div className="mt-6 rounded-md bg-muted/50 border border-border p-4 text-xs text-muted-foreground">
        <div className="font-medium text-foreground mb-1.5">
          Sobre los impuestos
        </div>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            <strong>Por defecto:</strong> los impuestos con este flag se
            aplican automáticamente al crear cotizaciones nuevas.
          </li>
          <li>
            <strong>Habilitado:</strong> un impuesto deshabilitado no aparece
            como opción en cotizaciones nuevas, pero las existentes lo
            conservan.
          </li>
          <li>
            Cambiar un impuesto <strong>no</strong> modifica las cotizaciones
            ya emitidas.
          </li>
        </ul>
      </div>

      {modalOpen && (
        <TaxModal
          tax={editingTax}
          onClose={() => {
            setModalOpen(false);
            setEditingTax(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingTax(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
