'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  RotateCcw,
  Trash2,
  MoreVertical,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  archiveClientAction,
  restoreClientAction,
  deleteClientAction,
} from '@/lib/actions/clients';
import type { Client } from '@/lib/types/database';

interface Props {
  client: Client;
  canDelete: boolean;
}

export function ArchiveButton({ client, canDelete }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalAction, setModalAction] = useState<
    'archive' | 'restore' | 'delete' | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const isArchived = !!client.archived_at;

  async function executeAction() {
    setError(null);
    setIsLoading(true);

    let result;

    if (modalAction === 'archive') {
      result = await archiveClientAction(client.id, reason);
    } else if (modalAction === 'restore') {
      result = await restoreClientAction(client.id);
    } else if (modalAction === 'delete') {
      result = await deleteClientAction(client.id);
    }

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setModalAction(null);

    if (modalAction === 'delete') {
      router.push('/clients');
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg min-w-[200px] py-1">
              {isArchived ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setModalAction('restore');
                  }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-green-500" />
                  Restaurar cliente
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setModalAction('archive');
                  }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                  Archivar cliente
                </button>
              )}

              {canDelete && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setModalAction('delete');
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar permanentemente
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación */}
      {modalAction && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={isLoading ? undefined : () => setModalAction(null)}
          />

          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {modalAction === 'archive' && 'Archivar cliente'}
                {modalAction === 'restore' && 'Restaurar cliente'}
                {modalAction === 'delete' && 'Eliminar permanentemente'}
              </h3>
              <button
                onClick={() => setModalAction(null)}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalAction === 'archive' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    El cliente quedará oculto de las listas activas pero sus
                    datos se conservan. Puedes restaurarlo cuando quieras.
                  </p>
                  <div className="space-y-2">
                    <label htmlFor="reason" className="text-sm font-medium">
                      Motivo (opcional)
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={isLoading}
                      rows={3}
                      placeholder="Ej: Contrato finalizado, cliente en pausa indefinida..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                    />
                  </div>
                </>
              )}

              {modalAction === 'restore' && (
                <p className="text-sm text-muted-foreground">
                  El cliente volverá a aparecer en las listas activas con estado{' '}
                  <strong>Activo</strong>.
                </p>
              )}

              {modalAction === 'delete' && (
                <div className="space-y-3">
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                    <strong>Esta acción es irreversible.</strong> Se eliminarán
                    permanentemente:
                    <ul className="list-disc list-inside mt-2 text-xs space-y-0.5">
                      <li>El cliente y todos sus datos</li>
                      <li>Todos los contactos asociados</li>
                      <li>Toda la información histórica</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Si solo quieres dejar de operarlo, usa <strong>Archivar</strong>{' '}
                    en lugar de eliminar.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={() => setModalAction(null)}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={executeAction}
                disabled={isLoading}
                variant={modalAction === 'delete' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : modalAction === 'archive' ? (
                  'Archivar'
                ) : modalAction === 'restore' ? (
                  'Restaurar'
                ) : (
                  'Eliminar permanentemente'
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
