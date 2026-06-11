import { Package, Layers, Plus, Download } from 'lucide-react';
import type {
  Quote,
  QuoteItem,
  QuoteAdjustment,
  QuoteTax,
  QuoteLayer,
} from '@/lib/types/database';

interface QuoteWithRelations extends Quote {
  client: {
    id: string;
    name: string;
    legal_name: string | null;
    tax_id: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    primary_color: string | null;
    logo_url: string | null;
  } | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    position: string | null;
  } | null;
}

interface Props {
  quote: QuoteWithRelations;
  items: QuoteItem[];
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
  layers: QuoteLayer[];
}

export function PublicQuoteView({
  quote,
  items,
  adjustments,
  taxes,
  layers,
}: Props) {
  // Solo capas activas, ordenadas
  const activeLayers = layers
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order);

  const orgColor = quote.organization?.primary_color || '#E89A1F';

  return (
    <div className="min-h-screen bg-background">
      {/* Header sutil arriba */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {quote.organization?.logo_url ? (
              <img
                src={quote.organization.logo_url}
                alt={quote.organization.name}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded grid place-items-center font-bold text-xs text-black"
                style={{ background: orgColor }}
              >
                {quote.organization?.name.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="text-sm font-medium">
              {quote.organization?.name}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/quotes/${quote.id}/pdf?token=${encodeURIComponent(
                quote.public_share_token || ''
              )}`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-colors"
            >
              <Download className="w-3 h-3" />
              Descargar PDF
            </a>
            <div className="text-xs font-mono text-muted-foreground">
              {quote.folio}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-12 md:space-y-16">
        {activeLayers.map((layer, idx) => (
          <LayerRenderer
            key={`${layer.kind}-${idx}`}
            layer={layer}
            quote={quote}
            items={items}
            adjustments={adjustments}
            taxes={taxes}
            orgColor={orgColor}
          />
        ))}

        {/* Footer con info de contacto */}
        <div className="border-t border-border pt-8 mt-12">
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <div className="font-mono uppercase tracking-widest text-[10px]">
              {quote.folio} · Emitida el{' '}
              {new Date(quote.issue_date).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div>
              Vigencia hasta{' '}
              <strong className="text-foreground">
                {new Date(quote.valid_until).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LAYER RENDERER (despacha al renderer correcto según el kind)
// ============================================================

function LayerRenderer({
  layer,
  quote,
  items,
  adjustments,
  taxes,
  orgColor,
}: {
  layer: QuoteLayer;
  quote: QuoteWithRelations;
  items: QuoteItem[];
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
  orgColor: string;
}) {
  switch (layer.kind) {
    case 'cover':
      return <CoverLayer layer={layer} quote={quote} orgColor={orgColor} />;
    case 'introduction':
    case 'scope':
    case 'terms':
    case 'closing':
      return <ContentLayer layer={layer} orgColor={orgColor} />;
    case 'deliverables':
      return (
        <DeliverablesLayer layer={layer} items={items} orgColor={orgColor} />
      );
    case 'investment':
      return (
        <InvestmentLayer
          layer={layer}
          quote={quote}
          items={items}
          adjustments={adjustments}
          taxes={taxes}
          orgColor={orgColor}
        />
      );
    default:
      return null;
  }
}

// ============================================================
// COVER LAYER (portada)
// ============================================================

function CoverLayer({
  layer,
  quote,
  orgColor,
}: {
  layer: QuoteLayer;
  quote: QuoteWithRelations;
  orgColor: string;
}) {
  return (
    <section className="text-center py-8 md:py-12">
      <div
        className="text-xs font-mono uppercase tracking-widest mb-6 flex items-center justify-center gap-2"
        style={{ color: orgColor }}
      >
        <span
          className="w-6 h-px"
          style={{ background: orgColor }}
        />
        Propuesta comercial
        <span
          className="w-6 h-px"
          style={{ background: orgColor }}
        />
      </div>

      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
        {layer.title || 'Propuesta comercial'}
      </h1>

      {layer.subtitle && (
        <p className="text-lg text-muted-foreground mb-8">
          {layer.subtitle}
        </p>
      )}

      <div className="mt-12 inline-block">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Preparada para
        </div>
        <div className="text-2xl font-medium mb-1">
          {quote.client?.name}
        </div>
        {quote.client?.legal_name && (
          <div className="text-sm text-muted-foreground font-mono">
            {quote.client.legal_name}
          </div>
        )}
      </div>

      {/* Mensaje opcional al cliente */}
      {quote.message_to_client && (
        <div className="mt-12 max-w-xl mx-auto p-5 border border-border rounded-lg bg-card/50 text-left">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Mensaje
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {quote.message_to_client}
          </p>
        </div>
      )}
    </section>
  );
}

// ============================================================
// CONTENT LAYER (introduction, scope, terms, closing)
// ============================================================

function ContentLayer({
  layer,
  orgColor,
}: {
  layer: QuoteLayer;
  orgColor: string;
}) {
  return (
    <section>
      <SectionHeader title={layer.title} orgColor={orgColor} />

      {layer.content_html ? (
        <div
          className="prose-quote text-sm md:text-base leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: layer.content_html }}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Esta sección está vacía.
        </p>
      )}
    </section>
  );
}

// ============================================================
// DELIVERABLES LAYER (lista de servicios)
// ============================================================

function DeliverablesLayer({
  layer,
  items,
  orgColor,
}: {
  layer: QuoteLayer;
  items: QuoteItem[];
  orgColor: string;
}) {
  return (
    <section>
      <SectionHeader title={layer.title || 'Entregables'} orgColor={orgColor} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Sin entregables especificados.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const composition = item.composition_snapshot as
              | Array<{ name: string; quantity: number; unit: string }>
              | null;

            return (
              <div
                key={item.id}
                className="border border-border rounded-lg p-5 bg-card"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className="text-xs font-mono w-6 h-6 grid place-items-center rounded-full flex-shrink-0 mt-0.5"
                    style={{
                      background: `${orgColor}15`,
                      color: orgColor,
                      border: `1px solid ${orgColor}40`,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-medium text-base">{item.name}</h3>
                      <ServiceTypeTag type={item.service_type} />
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-sm text-muted-foreground">
                      {Number(item.quantity)} × {item.unit}
                    </div>
                  </div>
                </div>

                {/* Composición del paquete */}
                {item.service_type === 'package' &&
                  composition &&
                  composition.length > 0 && (
                    <div
                      className="mt-3 ml-9 pl-3 border-l-2 space-y-1"
                      style={{ borderColor: `${orgColor}40` }}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                        Incluye
                      </div>
                      {composition.map((c, cidx) => (
                        <div
                          key={cidx}
                          className="text-sm text-muted-foreground flex items-center gap-2"
                        >
                          <span
                            className="font-mono"
                            style={{ color: orgColor }}
                          >
                            {c.quantity}×
                          </span>
                          <span>{c.name}</span>
                          <span className="text-muted-foreground/60 text-xs">
                            ({c.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// INVESTMENT LAYER (precios)
// ============================================================

function InvestmentLayer({
  layer,
  quote,
  items,
  adjustments,
  taxes,
  orgColor,
}: {
  layer: QuoteLayer;
  quote: QuoteWithRelations;
  items: QuoteItem[];
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
  orgColor: string;
}) {
  const subtotal = Number(quote.subtotal);
  const discountTotal = Number(quote.discount_total);
  const baseAfterDiscount = subtotal - discountTotal;
  const total = Number(quote.total);

  const discounts = adjustments.filter(
    (a) => a.adjustment_type !== 'bonus'
  );
  const bonuses = adjustments.filter(
    (a) => a.adjustment_type === 'bonus'
  );

  return (
    <section>
      <SectionHeader title={layer.title || 'Inversión'} orgColor={orgColor} />

      {/* Detalle línea por línea */}
      <div className="border border-border rounded-lg overflow-hidden bg-card mb-4">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Concepto
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                Cantidad
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">
                Precio unitario
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                  {Number(item.quantity)} {item.unit}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatPrice(Number(item.unit_price), quote.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {formatPrice(Number(item.subtotal), quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen económico */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-5 space-y-2 text-sm">
          {/* Subtotal */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">
              {formatPrice(subtotal, quote.currency)}
            </span>
          </div>

          {/* Descuentos */}
          {discounts.length > 0 && (
            <>
              {discounts.map((d) => (
                <div
                  key={d.id}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>
                    {d.label}
                    {d.adjustment_type === 'discount_percent' && (
                      <span className="font-mono ml-1">
                        ({Number(d.amount).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                  <span className="font-mono">
                    −{formatPrice(Number(d.calculated_amount), quote.currency)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-xs pt-1 border-t border-border/40">
                <span className="text-muted-foreground">
                  Subtotal con descuentos
                </span>
                <span className="font-mono">
                  {formatPrice(baseAfterDiscount, quote.currency)}
                </span>
              </div>
            </>
          )}

          {/* Impuestos */}
          {taxes.map((t) => (
            <div
              key={t.id}
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>
                {t.name}{' '}
                <span className="font-mono">
                  ({Number(t.percentage).toFixed(0)}%)
                </span>
              </span>
              <span className="font-mono">
                +{formatPrice(Number(t.tax_amount), quote.currency)}
              </span>
            </div>
          ))}

          {/* Total final */}
          <div
            className="flex justify-between items-end pt-4 mt-3 border-t-2"
            style={{ borderColor: orgColor }}
          >
            <span className="text-base font-medium">Inversión total</span>
            <span
              className="text-3xl font-semibold font-mono"
              style={{ color: orgColor }}
            >
              {formatPrice(total, quote.currency)}
            </span>
          </div>
        </div>

        {/* Bonificaciones (informativas) */}
        {bonuses.length > 0 && (
          <div
            className="p-4 border-t border-border space-y-1"
            style={{ background: `${orgColor}08` }}
          >
            <div
              className="text-[10px] font-mono uppercase tracking-widest mb-2"
              style={{ color: orgColor }}
            >
              Bonificaciones incluidas
            </div>
            {bonuses.map((b) => (
              <div
                key={b.id}
                className="flex justify-between text-sm"
                style={{ color: orgColor }}
              >
                <span className="font-medium">{b.label}</span>
                <span className="font-mono">
                  {formatPrice(Number(b.amount), quote.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// HELPERS
// ============================================================

function SectionHeader({
  title,
  orgColor,
}: {
  title?: string;
  orgColor: string;
}) {
  return (
    <div className="mb-6">
      <div
        className="text-[10px] font-mono uppercase tracking-widest mb-2 flex items-center gap-2"
        style={{ color: orgColor }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: orgColor }}
        />
        Sección
      </div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        {title || 'Sin título'}
      </h2>
    </div>
  );
}

function ServiceTypeTag({ type }: { type: 'atomic' | 'package' | 'addon' }) {
  const config = {
    atomic: { label: 'Servicio', Icon: Package },
    package: { label: 'Paquete', Icon: Layers },
    addon: { label: 'Addon', Icon: Plus },
  };
  const { label, Icon } = config[type];

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-secondary border border-border text-muted-foreground">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
