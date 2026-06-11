'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Copy,
  Star,
  Archive,
  RotateCcw,
  Trash2,
  MoreVertical,
  FileText,
  Layers,
  Calendar,
  Hash,
} from 'lucide-react';
import {
  setDefaultTemplateAction,
  archiveQuoteTemplateAction,
  restoreQuoteTemplateAction,
  deleteQuoteTemplateAction,
  duplicateQuoteTemplateAction,
} from '@/lib/actions/quote-templates';
import type { QuoteTemplate, QuoteLayer } from '@/lib/types/database';

interface Props {
  templates: QuoteTemplate[];
  canManage: boolean;
}

export function TemplatesList({ templates, canManage }: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function handleSetDefault(templateId: string) {
    setActionLoading(templateId);
    await setDefaultTemplateAction(templateId);
    setActionLoading(null);
    router.refresh();
  }

  async function handleDuplicate(templateId: string) {
    setActionLoading(templateId);
    const result = await duplicateQuoteTemplateAction(templateId);
    setActionLoading(null);
    if (result?.success && result.templateId) {
      router.push(`/catalog/templates/${result.templateId}`);
    }
  }

  async function handleArchive(templateId: string) {
    if (
      !confirm(
        '¿Archivar esta plantilla? Las cotizaciones existentes no se modifican.'
      )
    )
      return;
    setActionLoading(templateId);
    await archiveQuoteTemplateAction(templateId);
    setActionLoading(null);
    setMenuOpenId(null);
    router.refresh();
  }

  async function handleRestore(templateId: string) {
    setActionLoading(templateId);
    await restoreQuoteTemplateAction(templateId);
    setActionLoading(null);
    setMenuOpenId(null);
    router.refresh();
  }

  async function handleDelete(templateId: string) {
    if (
      !confirm(
        '¿Eliminar permanentemente esta plantilla? Esta acción no se puede deshacer.'
      )
    )
      return;
    setActionLoading(templateId);
    const result = await deleteQuoteTemplateAction(templateId);
    setActionLoading(null);
    setMenuOpenId(null);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  if (templates.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <div className="font-medium mb-1">Sin plantillas configuradas</div>
        <div className="text-sm text-muted-foreground mb-4">
          Crea la primera plantilla con las capas y contenido base de tus
          cotizaciones.
        </div>
        {canManage && (
          <Link
            href="/catalog/templates/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:bg-photocan-amber-deep transition-colors"
          >
            Crear primera plantilla
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => {
        const layers = (template.layers as unknown as QuoteLayer[]) || [];
        const enabledLayers = layers.filter((l) => l.enabled);
        const isArchived = !!template.archived_at;
        const isMenuOpen = menuOpenId === template.id;

        return (
          <div
            key={template.id}
            className={`border rounded-lg bg-card p-5 relative transition-colors ${
              template.is_default
                ? 'border-photocan-amber/40 bg-photocan-amber/[0.02]'
                : 'border-border hover:border-photocan-amber/30'
            } ${isArchived ? 'opacity-60' : ''}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{template.name}</h3>
                  {template.is_default && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-photocan-amber/20 text-photocan-amber-deep border border-photocan-amber/30 flex-shrink-0">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Por defecto
                    </span>
                  )}
                  {isArchived && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-secondary text-muted-foreground border border-border flex-shrink-0">
                      Archivada
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
              </div>

              {canManage && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() =>
                      setMenuOpenId(isMenuOpen ? null : template.id)
                    }
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg min-w-[180px] py-1">
                        {!isArchived && (
                          <>
                            {!template.is_default && (
                              <button
                                onClick={() => {
                                  setMenuOpenId(null);
                                  handleSetDefault(template.id);
                                }}
                                disabled={actionLoading === template.id}
                                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                              >
                                <Star className="w-3.5 h-3.5 text-photocan-amber" />
                                Marcar como default
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                handleDuplicate(template.id);
                              }}
                              disabled={actionLoading === template.id}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                              Duplicar
                            </button>
                            <Link
                              href={`/catalog/templates/${template.id}`}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              Editar
                            </Link>
                            <div className="border-t border-border my-1" />
                            <button
                              onClick={() => handleArchive(template.id)}
                              disabled={actionLoading === template.id}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                            >
                              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                              Archivar
                            </button>
                          </>
                        )}

                        {isArchived && (
                          <>
                            <button
                              onClick={() => handleRestore(template.id)}
                              disabled={actionLoading === template.id}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-green-500" />
                              Restaurar
                            </button>
                            <div className="border-t border-border my-1" />
                            <button
                              onClick={() => handleDelete(template.id)}
                              disabled={actionLoading === template.id}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat
                icon={<Layers className="w-3 h-3" />}
                label="Capas"
                value={`${enabledLayers.length}/${layers.length}`}
              />
              <Stat
                icon={<Hash className="w-3 h-3" />}
                label="Prefijo"
                value={template.folio_prefix}
              />
              <Stat
                icon={<Calendar className="w-3 h-3" />}
                label="Vigencia"
                value={`${template.valid_days_default}d`}
              />
            </div>

            {/* Lista resumida de capas */}
            <div className="space-y-1 mb-4">
              {layers
                .sort((a, b) => a.order - b.order)
                .map((layer, idx) => (
                  <div
                    key={`${layer.kind}-${idx}`}
                    className={`flex items-center gap-2 text-xs ${
                      layer.enabled
                        ? 'text-foreground'
                        : 'text-muted-foreground/50 line-through'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current" />
                    <span className="capitalize">
                      {getLayerLabel(layer.kind)}
                    </span>
                  </div>
                ))}
            </div>

            {/* CTA editar */}
            {!isArchived && canManage && (
              <Link
                href={`/catalog/templates/${template.id}`}
                className="text-xs font-mono text-photocan-amber-deep hover:underline inline-flex items-center gap-1"
              >
                Editar plantilla →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-2 rounded bg-secondary/50 border border-border">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium font-mono">{value}</div>
    </div>
  );
}

function getLayerLabel(kind: string): string {
  const labels: Record<string, string> = {
    cover: 'Portada',
    introduction: 'Presentación',
    scope: 'Alcance',
    deliverables: 'Entregables',
    investment: 'Inversión',
    terms: 'Términos',
    closing: 'Cierre',
  };
  return labels[kind] || kind;
}
