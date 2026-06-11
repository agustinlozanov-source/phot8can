'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, X, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createQuoteAction } from '@/lib/actions/quotes';

interface Props {
  clients: Array<{ id: string; name: string; legal_name: string | null }>;
  templates: Array<{ id: string; name: string; is_default: boolean }>;
}

export function NewQuoteButton({ clients, templates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del form
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState(
    templates.find((t) => t.is_default)?.id || templates[0]?.id || ''
  );
  const [title, setTitle] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Selecciona un cliente');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.set('client_id', clientId);
    if (templateId) formData.set('template_id', templateId);
    if (title.trim()) formData.set('title', title.trim());

    const result = await createQuoteAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result?.success && result.quoteId) {
      setOpen(false);
      router.push(`/quotes/${result.quoteId}`);
    }
  }

  function reset() {
    setOpen(false);
    setError(null);
    setClientId('');
    setTitle('');
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Nueva cotización
      </Button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : reset}
      />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center">
              <FileText className="w-4 h-4 text-photocan-amber" />
            </div>
            <h3 className="text-lg font-semibold">Nueva cotización</h3>
          </div>
          <button
            onClick={reset}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="client_id">Cliente *</Label>
            {clients.length === 0 ? (
              <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-photocan-amber-deep flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-photocan-amber-deep">
                    No hay clientes activos.
                  </strong>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crea un cliente primero en{' '}
                    <a
                      href="/clients"
                      className="underline hover:text-photocan-amber-deep"
                    >
                      Clientes
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <select
                id="client_id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Plantilla */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template_id">Plantilla</Label>
              <select
                id="template_id"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default ? ' (por defecto)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {templates.length === 0 && (
            <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-photocan-amber-deep flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-photocan-amber-deep">
                  No hay plantillas disponibles.
                </strong>
                <p className="text-xs text-muted-foreground mt-1">
                  Crea una plantilla en{' '}
                  <a
                    href="/catalog/templates"
                    className="underline hover:text-photocan-amber-deep"
                  >
                    Catálogo → Plantillas
                  </a>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              placeholder="Propuesta de redes sociales Q2"
            />
            <p className="text-xs text-muted-foreground">
              Descripción breve interna y para el cliente. Si no lo pones, se
              usa solo el folio.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !clientId || templates.length === 0}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear cotización'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
