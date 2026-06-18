'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startChannelConnectionAction } from '@/lib/actions/zernio-integrations';

type ConnectPlatform = 'whatsapp' | 'instagram' | 'facebook' | 'telegram';

const PLATFORM_LABEL: Record<ConnectPlatform, string> = {
  whatsapp: 'WhatsApp Business',
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
};

export function ConnectChannelModal({
  platform,
  onClose,
}: {
  platform: ConnectPlatform;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    const result = await startChannelConnectionAction({ platform });
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if ('authUrl' in result && result.authUrl) {
      window.location.href = result.authUrl;
      return; // no reseteamos loading: estamos redirigiendo
    }
    setError('No se recibió la URL de autorización');
    setLoading(false);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Conectar {PLATFORM_LABEL[platform]}
          </h3>
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
            Te vamos a redirigir a Zernio para autorizar la conexión. Una vez
            completado, podrás recibir y enviar mensajes desde Photocan OS.
          </p>
          {platform === 'whatsapp' && (
            <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 px-3 py-2 text-xs text-photocan-amber-deep">
              Necesitas tener una cuenta de WhatsApp Business activa.
            </div>
          )}
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
          <Button onClick={handleContinue} disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirigiendo...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Continuar a Zernio
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
