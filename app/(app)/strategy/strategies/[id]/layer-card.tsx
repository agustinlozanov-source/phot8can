'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Pencil,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  updateLayerAction,
  approveLayerAction,
  unapproveLayerAction,
  regenerateLayerAction,
} from '@/lib/actions/strategies';
import type { StrategyLayer, StrategyLayerKind } from '@/lib/types/database';

type LayerWithReviewer = StrategyLayer & {
  reviewer: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  layer: LayerWithReviewer;
  canEdit: boolean;
  canApprove: boolean;
  canRegenerate: boolean;
}

export function LayerCard({
  layer,
  canEdit,
  canApprove,
  canRegenerate,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  const [editedTitle, setEditedTitle] = useState(layer.title);
  const [editedContent, setEditedContent] = useState(layer.content_html);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isApproved = layer.status === 'approved';
  const isEdited = layer.status === 'edited';
  const hasBeenModified = layer.content_html !== layer.ai_draft_content;

  async function handleSaveEdit() {
    setError(null);

    if (!editedTitle.trim() || !editedContent.trim()) {
      setError('Título y contenido no pueden estar vacíos');
      return;
    }

    setActionLoading('save');
    const result = await updateLayerAction({
      id: layer.id,
      title: editedTitle.trim(),
      content_html: editedContent.trim(),
    });
    setActionLoading(null);

    if (result && 'error' in result && result.error) {
      setError(result.error);
    } else {
      setIsEditing(false);
      router.refresh();
    }
  }

  function handleCancelEdit() {
    setEditedTitle(layer.title);
    setEditedContent(layer.content_html);
    setIsEditing(false);
    setError(null);
  }

  async function handleApprove() {
    setError(null);
    setActionLoading('approve');
    const result = await approveLayerAction(layer.id);
    setActionLoading(null);
    if (result && 'error' in result && result.error) setError(result.error);
    else router.refresh();
  }

  async function handleUnapprove() {
    if (!confirm('¿Quitar aprobación de esta capa?')) return;
    setError(null);
    setActionLoading('unapprove');
    const result = await unapproveLayerAction(layer.id);
    setActionLoading(null);
    if (result && 'error' in result && result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <>
      <div
        className={`border rounded-lg bg-card transition-colors ${
          isApproved
            ? 'border-green-500/30'
            : isEdited
              ? 'border-photocan-amber/30'
              : 'border-border'
        }`}
      >
        {/* Header de la capa */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-md grid place-items-center flex-shrink-0 ${
                isApproved
                  ? 'bg-green-500/10 border border-green-500/30 text-green-500'
                  : 'bg-photocan-amber/10 border border-photocan-amber/30 text-photocan-amber-deep'
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="text-[10px] font-mono font-bold">
                  {layer.layer_order + 1}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {getLayerKindLabel(layer.kind)}
                </div>
                {isApproved && layer.reviewer && (
                  <div className="text-[10px] text-muted-foreground">
                    Aprobada por {layer.reviewer.first_name}
                  </div>
                )}
                {isEdited && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-photocan-amber/10 text-photocan-amber-deep">
                    Editada
                  </span>
                )}
                {layer.regeneration_count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    Regenerada ×{layer.regeneration_count}
                  </span>
                )}
              </div>
              <h3 className="font-medium truncate">
                {isEditing ? (
                  <input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-photocan-amber focus:outline-none"
                    disabled={!!actionLoading}
                  />
                ) : (
                  layer.title
                )}
              </h3>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isEditing && (
              <>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    disabled={!!actionLoading}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}

                {canRegenerate && (
                  <button
                    onClick={() => setShowRegenerateModal(true)}
                    disabled={!!actionLoading}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Regenerar con IA"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}

                {hasBeenModified && (
                  <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title={
                      showOriginal
                        ? 'Ver versión actual'
                        : 'Ver borrador IA'
                    }
                  >
                    {showOriginal ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {canApprove && (
                  <>
                    {isApproved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUnapprove}
                        disabled={!!actionLoading}
                        className="ml-1"
                      >
                        {actionLoading === 'unapprove' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Desaprobar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleApprove}
                        disabled={!!actionLoading}
                        className="ml-1"
                      >
                        {actionLoading === 'approve' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Aprobar
                      </Button>
                    )}
                  </>
                )}
              </>
            )}

            {isEditing && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={!!actionLoading}
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'save' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {isEditing ? (
            <div>
              <Label className="text-xs">Contenido (HTML)</Label>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                disabled={!!actionLoading}
                rows={10}
                className="w-full mt-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Puedes usar HTML básico: &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;,
                &lt;strong&gt;, &lt;em&gt;
              </p>
            </div>
          ) : (
            <>
              {showOriginal && (
                <div className="mb-3 rounded-md bg-secondary/30 border border-border p-3">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                    Borrador original de IA (no editable)
                  </div>
                  <div
                    className="text-sm prose prose-sm max-w-none prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: layer.ai_draft_content,
                    }}
                  />
                </div>
              )}

              <div
                className="text-sm prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-p:text-foreground/90"
                dangerouslySetInnerHTML={{ __html: layer.content_html }}
              />
            </>
          )}

          {/* Feedback de regeneración si aplica */}
          {layer.regeneration_feedback && !isEditing && (
            <div className="mt-3 rounded-md bg-secondary/30 border border-border p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Último feedback de regeneración
              </div>
              <div className="text-xs italic">
                &quot;{layer.regeneration_feedback}&quot;
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal regenerar */}
      {showRegenerateModal && (
        <RegenerateModal
          layerId={layer.id}
          layerTitle={layer.title}
          onClose={() => setShowRegenerateModal(false)}
          onDone={() => {
            setShowRegenerateModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ============================================================
// MODAL REGENERAR CON FEEDBACK
// ============================================================

function RegenerateModal({
  layerId,
  layerTitle,
  onClose,
  onDone,
}: {
  layerId: string;
  layerTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (feedback.trim().length < 10) {
      setError('El feedback debe ser específico (mín. 10 caracteres)');
      return;
    }

    setIsLoading(true);
    const result = await regenerateLayerAction({
      layer_id: layerId,
      feedback: feedback.trim(),
    });
    setIsLoading(false);

    if (result && 'error' in result && result.error) {
      setError(result.error);
    } else {
      onDone();
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Regenerar capa</h3>
            <div className="text-xs text-muted-foreground">{layerTitle}</div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Claude va a regenerar esta capa basándose en tu feedback. Sé
            específico: qué te gustó, qué no, qué prefieres que diga.
          </p>

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback específico *</Label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isLoading}
              rows={5}
              placeholder="Ej: El posicionamiento es muy genérico. Quiero que enfatice más en la calidad artesanal y el origen mexicano. Mencionar específicamente la conexión emocional con la tradición familiar."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
            />
          </div>

          <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-xs flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-photocan-amber-deep mt-0.5 flex-shrink-0" />
            <div>
              Claude tomará en cuenta el transcript de la entrevista y las
              otras capas aprobadas para mantener consistencia. Esto puede
              tomar 20-30 segundos.
            </div>
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
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function getLayerKindLabel(kind: StrategyLayerKind): string {
  const labels: Record<StrategyLayerKind, string> = {
    insights: 'Insights',
    positioning: 'Posicionamiento',
    audience: 'Audiencia',
    messages: 'Mensajes',
    pillars: 'Pilares',
    tone: 'Tono y voz',
    action_plan: 'Plan de acción',
  };
  return labels[kind];
}
