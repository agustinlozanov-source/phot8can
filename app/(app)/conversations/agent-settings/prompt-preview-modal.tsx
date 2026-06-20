'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { buildAgentSystemPromptAction } from '@/lib/actions/agent-settings';

export function PromptPreviewModal({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await buildAgentSystemPromptAction();
      setLoading(false);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if ('system_prompt' in result) setPrompt(result.system_prompt ?? '');
    })();
  }, []);

  async function handleCopy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl bg-background border border-border rounded-lg shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">System Prompt Final</h3>
            <p className="text-xs text-muted-foreground">
              Esto es exactamente lo que se le pasa a Claude como instrucciones.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] p-5">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-secondary/50 border border-border rounded-md p-4 leading-relaxed">
              {prompt}
            </pre>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-between gap-2">
          <button
            onClick={handleCopy}
            disabled={!prompt}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar al portapapeles
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
