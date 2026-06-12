'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  X,
  AlertCircle,
  Mic,
  MessageSquare,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createInterviewAction } from '@/lib/actions/interviews';
import type { InterviewMode } from '@/lib/types/database';

interface Props {
  clients: Array<{ id: string; name: string; legal_name: string | null }>;
}

export function NewInterviewButton({ clients }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del form
  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState<InterviewMode>('text');

  // Estado post-creación (cuando se generó el link)
  const [createdData, setCreatedData] = useState<{
    interviewId: string;
    token: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Selecciona un cliente');
      return;
    }

    setIsLoading(true);

    const result = await createInterviewAction({
      client_id: clientId,
      mode,
    });

    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.success && result.interviewId && result.token) {
      setCreatedData({
        interviewId: result.interviewId,
        token: result.token,
      });
    }
  }

  function getInterviewUrl(token: string) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/interview/${token}`;
  }

  async function handleCopyLink() {
    if (!createdData) return;
    const url = getInterviewUrl(createdData.token);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setOpen(false);
    setError(null);
    setClientId('');
    setMode('text');
    setCreatedData(null);
    setCopied(false);
    router.refresh();
  }

  function goToInterview() {
    if (!createdData) return;
    router.push(`/strategy/interviews/${createdData.interviewId}`);
    reset();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Nueva entrevista
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
        {/* MODO POST-CREACIÓN: mostrar link generado */}
        {createdData ? (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-md bg-green-500/10 border border-green-500/30 grid place-items-center flex-shrink-0">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Entrevista creada</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Comparte este link con tu cliente. Lía estará esperándolos.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Link público de la entrevista</Label>
                <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md border border-border">
                  <code className="text-xs font-mono truncate flex-1">
                    {getInterviewUrl(createdData.token)}
                  </code>
                </div>
              </div>

              <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-photocan-amber-deep mt-0.5 flex-shrink-0" />
                <div>
                  El link funciona sin login. Cualquiera con el link puede
                  iniciar la entrevista. No lo compartas públicamente.
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={goToInterview}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4" />
                Ver detalle
              </Button>
              <Button onClick={handleCopyLink} className="flex-1">
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          /* MODO INICIAL: formulario para crear */
          <>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nueva entrevista</h3>
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

              {/* Modo */}
              <div className="space-y-2">
                <Label>Modo de entrevista *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('text')}
                    disabled={isLoading}
                    className={`p-4 rounded-md border text-left transition-colors ${
                      mode === 'text'
                        ? 'border-photocan-amber bg-photocan-amber/10'
                        : 'border-border hover:border-photocan-amber/30 bg-card'
                    }`}
                  >
                    <MessageSquare
                      className={`w-5 h-5 mb-2 ${
                        mode === 'text'
                          ? 'text-photocan-amber-deep'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-sm font-medium mb-0.5">Texto</div>
                    <div className="text-[10px] text-muted-foreground">
                      Chat tipo ChatGPT
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      ~$0.10 USD
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('voice')}
                    disabled={isLoading}
                    className={`p-4 rounded-md border text-left transition-colors ${
                      mode === 'voice'
                        ? 'border-photocan-amber bg-photocan-amber/10'
                        : 'border-border hover:border-photocan-amber/30 bg-card'
                    }`}
                  >
                    <Mic
                      className={`w-5 h-5 mb-2 ${
                        mode === 'voice'
                          ? 'text-photocan-amber-deep'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-sm font-medium mb-0.5">Voz</div>
                    <div className="text-[10px] text-muted-foreground">
                      Conversación natural
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      ~$2 USD
                    </div>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  El cliente no puede cambiar de modo una vez que empieza.
                </p>
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
                  onClick={reset}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !clientId}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear entrevista'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
