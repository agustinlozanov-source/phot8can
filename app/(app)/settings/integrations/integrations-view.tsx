'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageCircle,
  Instagram,
  Facebook,
  Send,
  Plug,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrganizationChannel } from '@/lib/types/database';
import { retryChannelConnectionAction } from '@/lib/actions/zernio-integrations';
import { ConnectChannelModal } from './connect-channel-modal';
import { DisconnectChannelModal } from './disconnect-channel-modal';

type ConnectPlatform = 'whatsapp' | 'instagram' | 'facebook' | 'telegram';

const PLATFORMS: {
  key: ConnectPlatform;
  label: string;
  icon: typeof MessageCircle;
  color: string;
}[] = [
  { key: 'whatsapp', label: 'WhatsApp Business', icon: MessageCircle, color: 'text-green-500' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { key: 'telegram', label: 'Telegram', icon: Send, color: 'text-sky-500' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  channels: OrganizationChannel[];
  canManage: boolean;
  canConfigureAgent: boolean;
  feedback: { connected: boolean; platform: string | null; error: string | null };
}

export function IntegrationsView({
  channels,
  canManage,
  canConfigureAgent,
  feedback,
}: Props) {
  const router = useRouter();
  const [connectPlatform, setConnectPlatform] = useState<ConnectPlatform | null>(
    null
  );
  const [disconnect, setDisconnect] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mapa platform → canal más reciente (la lista viene ordenada desc)
  const byPlatform = new Map<string, OrganizationChannel>();
  for (const c of channels) {
    if (!byPlatform.has(c.platform)) byPlatform.set(c.platform, c);
  }

  async function handleRetry(channelId: string) {
    setError(null);
    setRetryLoading(channelId);
    const result = await retryChannelConnectionAction(channelId);
    if (result?.error) {
      setError(result.error);
      setRetryLoading(null);
      return;
    }
    if ('authUrl' in result && result.authUrl) {
      window.location.href = result.authUrl;
      return;
    }
    setRetryLoading(null);
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Configuración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Plug className="w-7 h-7 text-photocan-amber" />
          Integraciones
        </h1>
        <p className="text-muted-foreground text-sm">
          Conecta los canales de comunicación de la organización
        </p>
      </div>

      {/* Feedback del OAuth */}
      {feedback.connected && (
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          Canal {feedback.platform ? `de ${feedback.platform}` : ''} conectado
          exitosamente.
        </div>
      )}
      {feedback.error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {feedback.error}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Grid de canales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLATFORMS.map((p) => {
          const channel = byPlatform.get(p.key);
          const status =
            !channel || channel.status === 'disconnected'
              ? 'disconnected'
              : channel.status;
          const Icon = p.icon;

          return (
            <div
              key={p.key}
              className="border border-border rounded-lg bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-secondary border border-border grid place-items-center flex-shrink-0">
                    <Icon className={`w-7 h-7 ${p.color}`} />
                  </div>
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <StatusBadge status={status} />
                  </div>
                </div>
              </div>

              {/* Info / estado */}
              {status === 'connected' && channel && (
                <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                  {channel.display_name && <div>{channel.display_name}</div>}
                  {channel.phone_number && (
                    <div className="font-mono">{channel.phone_number}</div>
                  )}
                  {channel.handle && (
                    <div className="font-mono">{channel.handle}</div>
                  )}
                  {channel.connected_at && (
                    <div>Conectado el {formatDate(channel.connected_at)}</div>
                  )}
                </div>
              )}
              {status === 'pending' && (
                <div className="text-xs text-muted-foreground mb-3">
                  Esperando autorización en Zernio...
                </div>
              )}
              {status === 'error' && channel?.last_error && (
                <div className="text-xs text-destructive mb-3 font-mono break-words">
                  {channel.last_error}
                </div>
              )}

              {/* Acciones */}
              {canManage && (
                <div className="flex gap-2">
                  {status === 'disconnected' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setConnectPlatform(p.key);
                      }}
                    >
                      <Plug className="w-3.5 h-3.5" />
                      Conectar
                    </Button>
                  )}
                  {(status === 'pending' || status === 'error') && channel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(channel.id)}
                      disabled={retryLoading === channel.id}
                    >
                      {retryLoading === channel.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      Reintentar
                    </Button>
                  )}
                  {status === 'connected' && channel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDisconnect({ id: channel.id, label: p.label })
                      }
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Desconectar
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Acerca de */}
      <div className="mt-8 border border-border rounded-lg bg-card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground mb-2">
          Acerca de las integraciones
        </h2>
        <p className="text-sm text-muted-foreground">
          Las integraciones permiten que los clientes te escriban directamente
          desde sus apps favoritas. Photocan OS unifica todas las conversaciones
          en un solo inbox. Los mensajes pueden ser respondidos por el equipo o
          automáticamente por el Agente IA.
        </p>
        {canConfigureAgent && (
          <Link
            href="/conversations/agent-settings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-photocan-amber-deep hover:underline mt-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Configurar el Agente IA
          </Link>
        )}
      </div>

      {connectPlatform && (
        <ConnectChannelModal
          platform={connectPlatform}
          onClose={() => setConnectPlatform(null)}
        />
      )}
      {disconnect && (
        <DisconnectChannelModal
          channelId={disconnect.id}
          platformLabel={disconnect.label}
          onClose={() => setDisconnect(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; Icon: typeof CheckCircle2; bg: string }
  > = {
    connected: {
      label: 'Conectado',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    pending: {
      label: 'Pendiente',
      Icon: Clock,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    error: {
      label: 'Error',
      Icon: AlertCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    disconnected: {
      label: 'Sin conectar',
      Icon: XCircle,
      bg: 'bg-secondary text-muted-foreground',
    },
  };
  const { label, Icon, bg } = config[status] ?? config.disconnected;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
