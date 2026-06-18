'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { disconnectChannelAction } from '@/lib/actions/zernio-integrations';

export function DisconnectChannelModal({
  channelId,
  platformLabel,
  onClose,
}: {
  channelId: string;
  platformLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setError(null);
    setLoading(true);
    const result = await disconnectChannelAction(channelId);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">¿Desconectar {platformLabel}?</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta acción detendrá la recepción de mensajes en este canal. Las
            conversaciones existentes se mantienen en el historial.
          </p>
          <p className="text-sm text-muted-foreground">
            Para reconectar después, deberás autorizar de nuevo desde Zernio.
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Desconectar'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
