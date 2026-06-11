'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Layers as LayersIcon,
  Package,
  DollarSign,
  ScrollText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createQuoteTemplateAction,
  updateQuoteTemplateAction,
} from '@/lib/actions/quote-templates';
import type { QuoteLayer, QuoteLayerKind } from '@/lib/types/database';

interface TemplateEditorProps {
  mode: 'create' | 'edit';
  templateId?: string;
  initialData: {
    name: string;
    description: string | null;
    folio_prefix: string;
    valid_days_default: number;
    currency_default: string;
    layers: QuoteLayer[];
    primary_color: string | null;
    is_default: boolean;
    is_active: boolean;
  };
}

export function TemplateEditor({
  mode,
  templateId,
  initialData,
}: TemplateEditorProps) {
  const router = useRouter();

  // Estado del formulario
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(
    initialData.description || ''
  );
  const [folioPrefix, setFolioPrefix] = useState(initialData.folio_prefix);
  const [validDays, setValidDays] = useState(initialData.valid_days_default);
  const [currency, setCurrency] = useState(initialData.currency_default);
  const [primaryColor, setPrimaryColor] = useState(
    initialData.primary_color || ''
  );
  const [isDefault, setIsDefault] = useState(initialData.is_default);

  // Estado de las capas (orden manipulable)
  const [layers, setLayers] = useState<QuoteLayer[]>(
    [...initialData.layers].sort((a, b) => a.order - b.order)
  );

  // Estado de cuál capa está expandida (mostrar editor de contenido)
  const [expandedLayer, setExpandedLayer] = useState<QuoteLayerKind | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Silence unused warning — primaryColor is sent in formData
  void primaryColor;

  // ─── Manipulación de capas ───────────────────────

  function toggleEnabled(index: number) {
    setLayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((l, i) => ({ ...l, order: i }));
    });
  }

  function moveDown(index: number) {
    if (index === layers.length - 1) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((l, i) => ({ ...l, order: i }));
    });
  }

  function updateLayerField(
    index: number,
    field: keyof QuoteLayer,
    value: string
  ) {
    setLayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  // ─── Submit ───────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.set('name', name);
    formData.set('description', description);
    formData.set('folio_prefix', folioPrefix);
    formData.set('valid_days_default', String(validDays));
    formData.set('currency_default', currency);
    formData.set('primary_color', primaryColor);
    formData.set('layers', JSON.stringify(layers));
    if (isDefault) formData.set('is_default', 'on');
    formData.set('is_active', 'on');

    if (mode === 'edit' && templateId) {
      formData.set('id', templateId);
    }

    const result =
      mode === 'create'
        ? await createQuoteTemplateAction(formData)
        : await updateQuoteTemplateAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    if (mode !== 'create') {
      router.refresh();
    }
    router.push('/catalog/templates');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── SECCIÓN 1: Identidad ─────────────── */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Identidad
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Plantilla corporativa"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={2}
            placeholder="Cuándo usar esta plantilla..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            disabled={isLoading}
            className="mt-0.5 rounded border-border"
          />
          <div>
            <div className="text-sm font-medium">Plantilla por defecto</div>
            <div className="text-xs text-muted-foreground">
              Se selecciona automáticamente al crear cotizaciones nuevas.
            </div>
          </div>
        </label>
      </div>

      {/* ─── SECCIÓN 2: Configuración ─────────────── */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Configuración
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="folio_prefix">Prefijo de folio</Label>
            <Input
              id="folio_prefix"
              value={folioPrefix}
              onChange={(e) => setFolioPrefix(e.target.value.toUpperCase())}
              required
              disabled={isLoading}
              placeholder="COT"
              maxLength={20}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Ej: COT-2026-0001</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valid_days">Vigencia (días)</Label>
            <Input
              id="valid_days"
              type="number"
              min="1"
              max="365"
              value={validDays}
              onChange={(e) =>
                setValidDays(parseInt(e.target.value, 10) || 15)
              }
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Días que dura la oferta
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency_default">Moneda</Label>
            <select
              id="currency_default"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber"
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
              <option value="COP">COP</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN 3: Capas ─────────────── */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Capas de la cotización
            </div>
            <p className="text-sm text-muted-foreground">
              Activa o desactiva las secciones y ordénalas con las flechas.
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {layers.filter((l) => l.enabled).length}/{layers.length} activas
          </div>
        </div>

        <div className="space-y-2">
          {layers.map((layer, index) => (
            <LayerCard
              key={layer.kind}
              layer={layer}
              index={index}
              totalLayers={layers.length}
              isExpanded={expandedLayer === layer.kind}
              isLoading={isLoading}
              onToggleEnabled={() => toggleEnabled(index)}
              onMoveUp={() => moveUp(index)}
              onMoveDown={() => moveDown(index)}
              onToggleExpand={() =>
                setExpandedLayer(
                  expandedLayer === layer.kind ? null : layer.kind
                )
              }
              onUpdateField={(field, value) =>
                updateLayerField(index, field, value)
              }
            />
          ))}
        </div>
      </div>

      {/* ─── Error ─────────────── */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Acciones ─────────────── */}
      <div className="flex gap-2 sticky bottom-4 bg-background border border-border rounded-lg p-4 shadow-lg">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/catalog/templates')}
          disabled={isLoading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'create' ? 'Creando...' : 'Guardando...'}
            </>
          ) : mode === 'create' ? (
            'Crear plantilla'
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// LAYER CARD
// ============================================================

function LayerCard({
  layer,
  index,
  totalLayers,
  isExpanded,
  isLoading,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onToggleExpand,
  onUpdateField,
}: {
  layer: QuoteLayer;
  index: number;
  totalLayers: number;
  isExpanded: boolean;
  isLoading: boolean;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleExpand: () => void;
  onUpdateField: (field: keyof QuoteLayer, value: string) => void;
}) {
  const meta = LAYER_META[layer.kind];
  const Icon = meta.icon;

  return (
    <div
      className={`border rounded-md transition-colors ${
        layer.enabled
          ? 'border-border bg-background'
          : 'border-border/50 bg-secondary/30'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Flechas reorden */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0 || isLoading}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalLayers - 1 || isLoading}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Número de orden */}
        <div className="w-6 text-center font-mono text-xs text-muted-foreground">
          {index + 1}
        </div>

        {/* Icono + Label */}
        <div
          className={`w-8 h-8 rounded-md grid place-items-center border ${
            layer.enabled
              ? 'bg-photocan-amber/10 border-photocan-amber/30 text-photocan-amber-deep'
              : 'bg-secondary border-border text-muted-foreground'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{meta.label}</div>
          <div className="text-xs text-muted-foreground truncate">
            {layer.title || meta.description}
          </div>
        </div>

        {/* Auto-generated badge */}
        {layer.auto_generated && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            Auto
          </span>
        )}

        {/* Toggle enabled */}
        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={isLoading}
          className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            layer.enabled
              ? 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20'
              : 'bg-secondary text-muted-foreground border border-border hover:bg-secondary/80'
          }`}
        >
          {layer.enabled ? (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Activa
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Oculta
            </span>
          )}
        </button>

        {/* Expandir */}
        {!layer.auto_generated && (
          <button
            type="button"
            onClick={onToggleExpand}
            disabled={isLoading}
            className="text-xs font-mono text-photocan-amber-deep hover:underline"
          >
            {isExpanded ? 'Cerrar' : 'Editar'}
          </button>
        )}
      </div>

      {/* Editor expandido */}
      {isExpanded && !layer.auto_generated && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3 bg-secondary/20">
          <div className="space-y-2">
            <Label className="text-xs">Título de la sección</Label>
            <Input
              value={layer.title || ''}
              onChange={(e) => onUpdateField('title', e.target.value)}
              disabled={isLoading}
              placeholder={meta.label}
            />
          </div>

          {layer.kind === 'cover' && (
            <div className="space-y-2">
              <Label className="text-xs">Subtítulo (solo portada)</Label>
              <Input
                value={layer.subtitle || ''}
                onChange={(e) => onUpdateField('subtitle', e.target.value)}
                disabled={isLoading}
                placeholder="Texto debajo del título principal"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">
              Contenido HTML
              <span className="text-muted-foreground font-normal ml-2">
                (acepta &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;,
                &lt;em&gt;)
              </span>
            </Label>
            <textarea
              value={layer.content_html || ''}
              onChange={(e) => onUpdateField('content_html', e.target.value)}
              disabled={isLoading}
              rows={6}
              placeholder={meta.placeholder}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
            />
          </div>
        </div>
      )}

      {/* Aviso para capas auto-generadas */}
      {isExpanded && layer.auto_generated && (
        <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/20">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-photocan-amber" />
            <div>
              Esta capa se genera automáticamente con los datos de la
              cotización. No requiere contenido manual.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// METADATA DE CAPAS
// ============================================================

const LAYER_META: Record<
  QuoteLayerKind,
  {
    label: string;
    description: string;
    icon: typeof FileText;
    placeholder: string;
  }
> = {
  cover: {
    label: 'Portada',
    description: 'Carátula con título, cliente y fecha',
    icon: ImageIcon,
    placeholder: 'No requiere contenido — usa el título y subtítulo',
  },
  introduction: {
    label: 'Presentación',
    description: 'Quiénes son y por qué elegirlos',
    icon: FileText,
    placeholder: '<p>Somos una agencia digital especializada en...</p>',
  },
  scope: {
    label: 'Alcance',
    description: 'Qué incluye el servicio',
    icon: LayersIcon,
    placeholder: '<p>El proyecto contempla los siguientes elementos:</p>',
  },
  deliverables: {
    label: 'Entregables',
    description: 'Lista automática de servicios cotizados',
    icon: Package,
    placeholder: 'Auto-generado',
  },
  investment: {
    label: 'Inversión',
    description: 'Precios, descuentos, impuestos y total',
    icon: DollarSign,
    placeholder: 'Auto-generado',
  },
  terms: {
    label: 'Términos y condiciones',
    description: 'Vigencia, forma de pago, cláusulas',
    icon: ScrollText,
    placeholder: '<ul><li>Vigencia: 15 días naturales...</li></ul>',
  },
  closing: {
    label: 'Cierre',
    description: 'Mensaje final y call to action',
    icon: CheckCircle2,
    placeholder:
      '<p>Si tienes preguntas o quieres ajustar algo, escríbenos.</p>',
  },
};
