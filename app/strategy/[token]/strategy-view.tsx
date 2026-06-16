'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  AlertCircle,
  Calendar,
  ArrowDown,
} from 'lucide-react';
import {
  approveStrategyPublicAction,
  rejectStrategyPublicAction,
} from '@/lib/actions/strategies';
import type {
  Strategy,
  StrategyLayer,
  StrategyLayerKind,
} from '@/lib/types/database';

type StrategyData = Strategy & {
  client: { id: string; name: string; legal_name: string | null } | null;
};

interface Props {
  strategy: StrategyData;
  layers: StrategyLayer[];
  organization: {
    name: string;
    primaryColor: string;
    logoUrl: string | null;
  };
}

export function StrategyView({ strategy, layers, organization }: Props) {
  const [decisionMode, setDecisionMode] = useState<
    'none' | 'approve' | 'reject'
  >('none');
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  const alreadyDecided = ['approved', 'rejected'].includes(strategy.status);
  const isApproved = strategy.status === 'approved';
  const isRejected = strategy.status === 'rejected';
  const orgColor = organization.primaryColor;

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (approverName.trim().length < 3) {
      setError('Por favor escribe tu nombre completo');
      return;
    }

    setIsLoading(true);
    const result = await approveStrategyPublicAction({
      token: strategy.public_access_token!,
      approved_by_name: approverName.trim(),
    });
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setDone('approved');
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rejectionReason.trim().length < 10) {
      setError('Por favor describe qué quisieras ajustar (mín. 10 caracteres)');
      return;
    }

    setIsLoading(true);
    const result = await rejectStrategyPublicAction({
      token: strategy.public_access_token!,
      reason: rejectionReason.trim(),
    });
    setIsLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setDone('rejected');
    }
  }

  // Pantalla post-decisión
  if (done === 'approved') {
    return <PostDecisionScreen type="approved" organization={organization} />;
  }
  if (done === 'rejected') {
    return <PostDecisionScreen type="rejected" organization={organization} />;
  }

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt={organization.name}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded grid place-items-center font-mono font-bold text-xs"
                style={{ background: orgColor, color: '#000' }}
              >
                {organization.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: orgColor }}
              >
                {organization.name}
              </div>
              <div className="text-sm font-medium truncate">
                Estrategia digital
              </div>
            </div>
          </div>

          {!alreadyDecided && (
            <a
              href="#decision"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-medium text-black hover:opacity-90 transition-opacity"
              style={{ background: orgColor }}
            >
              Ir a aprobar
              <ArrowDown className="w-3 h-3" />
            </a>
          )}

          {isApproved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded bg-green-500/10 text-green-500">
              <CheckCircle2 className="w-3 h-3" />
              Aprobada
            </span>
          )}

          {isRejected && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded bg-destructive/10 text-destructive">
              <XCircle className="w-3 h-3" />
              En ajustes
            </span>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <div
          className="text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2"
          style={{ color: orgColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: orgColor }}
          />
          Propuesta estratégica
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">
          {strategy.title}
        </h1>
        {strategy.client && (
          <p className="text-lg text-muted-foreground">
            Para <strong className="text-foreground">{strategy.client.name}</strong>
            {strategy.client.legal_name && ` · ${strategy.client.legal_name}`}
          </p>
        )}

        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {new Date(strategy.sent_to_client_at || strategy.generated_at).toLocaleDateString(
              'es-MX',
              { day: 'numeric', month: 'long', year: 'numeric' }
            )}
          </div>
          <div>·</div>
          <div>{layers.length} capas estratégicas</div>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 pb-12">
        <div className="border border-border rounded-lg bg-card p-6">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-md grid place-items-center flex-shrink-0"
              style={{
                background: `${orgColor}15`,
                border: `1px solid ${orgColor}30`,
              }}
            >
              <Sparkles className="w-4 h-4" style={{ color: orgColor }} />
            </div>
            <div>
              <h3 className="font-medium mb-1">Lo que vas a leer aquí</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta es la estrategia digital que hemos construido específicamente
                para tu negocio, basándonos en lo que conversamos en la
                entrevista. Son 7 capas que se conectan entre sí — desde los
                insights de fondo hasta el plan de acción concreto de los
                próximos 90 días.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Léela con calma. Cuando termines, abajo encontrarás dos opciones:
                aprobar y empezar, o pedir ajustes si algo no resuena.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CAPAS */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="space-y-12">
          {layers.map((layer, idx) => (
            <LayerSection
              key={layer.id}
              layer={layer}
              index={idx}
              orgColor={orgColor}
            />
          ))}
        </div>
      </section>

      {/* DECISIÓN */}
      <section
        id="decision"
        className="border-t border-border bg-card/30 py-16 scroll-mt-20"
      >
        <div className="max-w-2xl mx-auto px-6">
          {alreadyDecided ? (
            <AlreadyDecidedView strategy={strategy} orgColor={orgColor} />
          ) : (
            <>
              <div className="text-center mb-8">
                <div
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: orgColor }}
                >
                  Decisión
                </div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">
                  ¿Aprobamos esta estrategia?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Si todo resuena contigo, dale aprobar y arrancamos. Si algo no
                  encaja, dinos qué ajustar.
                </p>
              </div>

              {decisionMode === 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setDecisionMode('approve')}
                    className="border border-border rounded-lg bg-card p-6 hover:border-photocan-amber/40 transition-colors text-left group"
                  >
                    <div
                      className="w-10 h-10 rounded-md grid place-items-center mb-3"
                      style={{
                        background: `${orgColor}15`,
                        border: `1px solid ${orgColor}30`,
                      }}
                    >
                      <CheckCircle2
                        className="w-5 h-5"
                        style={{ color: orgColor }}
                      />
                    </div>
                    <h3 className="font-medium mb-1">Aprobar y arrancar</h3>
                    <p className="text-xs text-muted-foreground">
                      Esta estrategia refleja lo que quiero. Sigamos al plan de
                      ejecución.
                    </p>
                  </button>

                  <button
                    onClick={() => setDecisionMode('reject')}
                    className="border border-border rounded-lg bg-card p-6 hover:border-border/80 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-md grid place-items-center mb-3 bg-secondary border border-border">
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium mb-1">Pedir ajustes</h3>
                    <p className="text-xs text-muted-foreground">
                      Hay cosas que no encajan o quiero refinar. Dejo comentarios.
                    </p>
                  </button>
                </div>
              )}

              {decisionMode === 'approve' && (
                <form
                  onSubmit={handleApprove}
                  className="border border-border rounded-lg bg-card p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2
                      className="w-5 h-5"
                      style={{ color: orgColor }}
                    />
                    <h3 className="font-medium">Aprobar estrategia</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Por favor escribe tu nombre completo para confirmar que tú
                    estás aprobando esta estrategia.
                  </p>

                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium" htmlFor="name">
                      Tu nombre completo
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      disabled={isLoading}
                      placeholder="Ej: Agustín Lozano García"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive mb-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecisionMode('none')}
                      disabled={isLoading}
                      className="flex-1 h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-10 rounded-md text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      style={{ background: orgColor }}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Aprobando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar aprobación
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {decisionMode === 'reject' && (
                <form
                  onSubmit={handleReject}
                  className="border border-border rounded-lg bg-card p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-medium">Pedir ajustes</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Cuéntanos qué quisieras que ajustemos. Sé específico: qué
                    capa, qué te gustaría diferente, por qué. Esto nos ayuda a
                    iterar más rápido.
                  </p>

                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium" htmlFor="reason">
                      Tu feedback
                    </label>
                    <textarea
                      id="reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={isLoading}
                      rows={5}
                      placeholder="Ej: Los mensajes clave se sienten muy genéricos. Me gustaría que enfaticen más el origen mexicano y la conexión emocional con la tradición familiar."
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive mb-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecisionMode('none')}
                      disabled={isLoading}
                      className="flex-1 h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-10 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar feedback'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-muted-foreground font-mono">
          Estrategia preparada por {organization.name}
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// SECCIÓN DE CAPA
// ============================================================

function LayerSection({
  layer,
  index,
  orgColor,
}: {
  layer: StrategyLayer;
  index: number;
  orgColor: string;
}) {
  return (
    <article className="scroll-mt-20">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-md grid place-items-center font-mono font-bold text-xs"
            style={{
              background: `${orgColor}15`,
              border: `1px solid ${orgColor}30`,
              color: orgColor,
            }}
          >
            {index + 1}
          </div>
          <div
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: orgColor }}
          >
            {getLayerKindLabel(layer.kind)}
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {layer.title}
        </h2>
      </header>

      <div
        className="prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-p:text-foreground/90"
        dangerouslySetInnerHTML={{ __html: layer.content_html }}
      />
    </article>
  );
}

// ============================================================
// VISTA YA DECIDIDA
// ============================================================

function AlreadyDecidedView({
  strategy,
  orgColor,
}: {
  strategy: StrategyData;
  orgColor: string;
}) {
  if (strategy.status === 'approved') {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4"
          style={{
            background: `${orgColor}20`,
            border: `2px solid ${orgColor}40`,
          }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: orgColor }} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Estrategia aprobada
        </h2>
        <p className="text-muted-foreground mb-3">
          Aprobada por {strategy.approved_by_name}
        </p>
        {strategy.decided_at && (
          <p className="text-xs text-muted-foreground font-mono">
            {new Date(strategy.decided_at).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-secondary border-2 border-border grid place-items-center mx-auto mb-4">
        <XCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">
        Feedback recibido
      </h2>
      <p className="text-muted-foreground mb-4">
        Tu equipo está trabajando en los ajustes que solicitaste.
      </p>
      {strategy.rejection_reason && (
        <div className="text-left max-w-md mx-auto rounded-md bg-card border border-border p-4 mt-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Tu feedback
          </div>
          <p className="text-sm">{strategy.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PANTALLA POST-DECISIÓN
// ============================================================

function PostDecisionScreen({
  type,
  organization,
}: {
  type: 'approved' | 'rejected';
  organization: { name: string; primaryColor: string };
}) {
  const orgColor = organization.primaryColor;

  if (type === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div
            className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6"
            style={{
              background: `${orgColor}20`,
              border: `2px solid ${orgColor}40`,
            }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: orgColor }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            ¡Estrategia aprobada!
          </h1>
          <p className="text-muted-foreground mb-2">
            Gracias por la confianza. Tu equipo de {organization.name} ya está
            preparando el plan de ejecución.
          </p>
          <p className="text-sm text-muted-foreground">
            En las próximas horas te contactaremos con los siguientes pasos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-secondary border-2 border-border grid place-items-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Recibimos tu feedback
        </h1>
        <p className="text-muted-foreground mb-2">
          Gracias por tomarte el tiempo. Tu equipo de {organization.name} va a
          ajustar la estrategia con tus comentarios y te enviará una nueva
          versión pronto.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getLayerKindLabel(kind: StrategyLayerKind): string {
  const labels: Record<StrategyLayerKind, string> = {
    insights: 'Insights del negocio',
    positioning: 'Posicionamiento',
    audience: 'Audiencia objetivo',
    messages: 'Mensajes clave',
    pillars: 'Pilares de contenido',
    tone: 'Tono y voz',
    action_plan: 'Plan de acción',
  };
  return labels[kind];
}
