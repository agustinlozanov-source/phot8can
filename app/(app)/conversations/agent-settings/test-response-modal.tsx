'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import {
  listClientsForAgentTestAction,
  previewAgentResponseAction,
} from '@/lib/actions/agent-settings';

type ClientOption = { id: string; name: string };

export function TestResponseModal({ onClose }: { onClose: () => void }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    system_prompt: string;
    test_message: string;
    note: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await listClientsForAgentTestAction();
      if ('clients' in res) setClients(res.clients ?? []);
    })();
  }, []);

  async function handleGenerate() {
    if (!message.trim()) {
      setError('Escribe un mensaje de prueba');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await previewAgentResponseAction({
      message,
      client_id: clientId || undefined,
    });
    setLoading(false);
    if ('error' in res && res.error) {
      setError(res.error);
      return;
    }
    if ('system_prompt' in res) {
      setResult({
        system_prompt: res.system_prompt ?? '',
        test_message: res.test_message ?? message,
        note: res.note ?? '',
      });
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Probar respuesta del agente</h3>
            <p className="text-xs text-muted-foreground">
              Simula un mensaje de cliente y ve el prompt que recibiría el agente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Cliente (opcional)
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Si seleccionas un cliente, se incluye su contexto (estrategia,
              cronograma, etc.).
            </p>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm outline-none focus:border-photocan-amber/50"
            >
              <option value="">Sin cliente específico</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Mensaje del cliente
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hola, ¿cuándo me entregan el reel del jueves?"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm outline-none resize-y focus:border-photocan-amber/50"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generar respuesta
          </button>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-md border border-photocan-amber/30 bg-photocan-amber/5 px-3 py-2 text-xs text-photocan-amber-deep">
                {result.note}
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Mensaje de prueba
                </div>
                <div className="text-sm bg-secondary/50 border border-border rounded-md p-3">
                  {result.test_message}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  System prompt construido
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-secondary/50 border border-border rounded-md p-3 leading-relaxed max-h-[300px] overflow-y-auto">
                  {result.system_prompt}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-secondary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
