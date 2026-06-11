import {
  Document,
  Page,
  Text,
  View,
} from '@react-pdf/renderer';
import { styles, COLORS } from './styles';
import type {
  Quote,
  QuoteItem,
  QuoteAdjustment,
  QuoteTax,
  QuoteLayer,
} from '@/lib/types/database';

// ============================================================
// TIPOS
// ============================================================

interface QuoteData {
  quote: Quote;
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
  } | null;
  items: QuoteItem[];
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
  layers: QuoteLayer[];
}

// ============================================================
// DOCUMENTO PRINCIPAL
// ============================================================

export function QuoteDocument(data: QuoteData) {
  const { quote, organization, layers } = data;

  const activeLayers = layers
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order);

  const coverLayer = activeLayers.find((l) => l.kind === 'cover');
  const restLayers = activeLayers.filter((l) => l.kind !== 'cover');

  const orgName = organization?.name || 'Organización';
  const issueDate = new Date(quote.issue_date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const validUntil = new Date(quote.valid_until).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document
      title={`Cotización ${quote.folio}`}
      author={orgName}
      subject={quote.title || 'Propuesta comercial'}
    >
      {/* ── Página 1: Portada ── */}
      {coverLayer && (
        <Page size="A4" style={styles.page}>
          <PageHeader orgName={orgName} folio={quote.folio} />
          <CoverContent layer={coverLayer} data={data} />
          <PageFooter
            issueDate={issueDate}
            validUntil={validUntil}
            folio={quote.folio}
          />
        </Page>
      )}

      {/* ── Páginas restantes: una por cada capa ── */}
      {restLayers.map((layer, idx) => (
        <Page key={`${layer.kind}-${idx}`} size="A4" style={styles.page}>
          <PageHeader orgName={orgName} folio={quote.folio} />
          <LayerContent layer={layer} data={data} />
          <PageFooter
            issueDate={issueDate}
            validUntil={validUntil}
            folio={quote.folio}
          />
        </Page>
      ))}
    </Document>
  );
}

// ============================================================
// HEADER Y FOOTER
// ============================================================

function PageHeader({ orgName, folio }: { orgName: string; folio: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: COLORS.amber,
          }}
        />
        <Text style={styles.headerOrgName}>{orgName}</Text>
      </View>
      <Text style={styles.headerFolio}>{folio}</Text>
    </View>
  );
}

function PageFooter({
  issueDate,
  validUntil,
  folio,
}: {
  issueDate: string;
  validUntil: string;
  folio: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {folio} · Emitida {issueDate}
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages} · Vigencia ${validUntil}`
        }
      />
    </View>
  );
}

// ============================================================
// PORTADA
// ============================================================

function CoverContent({
  layer,
  data,
}: {
  layer: QuoteLayer;
  data: QuoteData;
}) {
  const { quote, client } = data;

  return (
    <View style={styles.coverWrapper}>
      <Text style={styles.coverEyebrow}>· PROPUESTA COMERCIAL ·</Text>

      <Text style={styles.coverTitle}>
        {layer.title || 'Propuesta comercial'}
      </Text>

      {layer.subtitle && (
        <Text style={styles.coverSubtitle}>{layer.subtitle}</Text>
      )}

      <Text style={styles.coverForLabel}>PREPARADA PARA</Text>
      <Text style={styles.coverClientName}>
        {client?.name || 'Cliente'}
      </Text>
      {client?.legal_name && (
        <Text style={styles.coverClientLegal}>{client.legal_name}</Text>
      )}

      {quote.message_to_client && (
        <View style={styles.coverMessage}>
          <Text style={styles.coverMessageLabel}>MENSAJE</Text>
          <Text style={styles.coverMessageText}>
            {quote.message_to_client}
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// DESPACHADOR DE CAPAS
// ============================================================

function LayerContent({
  layer,
  data,
}: {
  layer: QuoteLayer;
  data: QuoteData;
}) {
  switch (layer.kind) {
    case 'introduction':
    case 'scope':
    case 'terms':
    case 'closing':
      return <ContentSection layer={layer} />;
    case 'deliverables':
      return <DeliverablesSection layer={layer} items={data.items} />;
    case 'investment':
      return <InvestmentSection layer={layer} data={data} />;
    default:
      return null;
  }
}

// ============================================================
// SECCIÓN DE TEXTO
// ============================================================

function ContentSection({ layer }: { layer: QuoteLayer }) {
  return (
    <View style={styles.sectionWrapper}>
      <Text style={styles.sectionEyebrow}>SECCIÓN</Text>
      <Text style={styles.sectionTitle}>{layer.title || 'Sin título'}</Text>

      {layer.content_html ? (
        <RichContent html={layer.content_html} />
      ) : (
        <Text style={styles.contentText}>Esta sección está vacía.</Text>
      )}
    </View>
  );
}

function RichContent({ html }: { html: string }) {
  const hasList = /<ul>|<ol>/i.test(html);

  if (hasList) {
    const liMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    const items = liMatches.map((li) =>
      li
        .replace(/<\/?li[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim()
    );

    const beforeList = html.split(/<(?:ul|ol)>/i)[0];
    const beforeText = beforeList
      .replace(/<\/?p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    return (
      <View>
        {beforeText && (
          <Text style={[styles.contentText, styles.contentParagraph]}>
            {beforeText}
          </Text>
        )}
        <View style={styles.contentList}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.contentListItem}>
              <Text style={styles.contentBullet}>•</Text>
              <Text style={styles.contentListItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const paragraphs = html
    .split(/<\/?p[^>]*>/gi)
    .map((p) => p.replace(/<[^>]+>/g, '').trim())
    .filter((p) => p.length > 0);

  return (
    <View>
      {paragraphs.map((p, idx) => (
        <Text
          key={idx}
          style={[styles.contentText, styles.contentParagraph]}
        >
          {p}
        </Text>
      ))}
    </View>
  );
}

// ============================================================
// ENTREGABLES
// ============================================================

function DeliverablesSection({
  layer,
  items,
}: {
  layer: QuoteLayer;
  items: QuoteItem[];
}) {
  return (
    <View style={styles.sectionWrapper}>
      <Text style={styles.sectionEyebrow}>SECCIÓN</Text>
      <Text style={styles.sectionTitle}>
        {layer.title || 'Entregables'}
      </Text>

      {items.length === 0 ? (
        <Text style={styles.contentText}>Sin entregables especificados.</Text>
      ) : (
        items.map((item, idx) => {
          const composition = item.composition_snapshot as
            | Array<{ name: string; quantity: number; unit: string }>
            | null;

          return (
            <View key={item.id} style={styles.deliverableCard} wrap={false}>
              <View style={styles.deliverableRow}>
                <Text style={styles.deliverableNumber}>{idx + 1}</Text>
                <View style={styles.deliverableBody}>
                  <View style={styles.deliverableHeader}>
                    <Text style={styles.deliverableName}>{item.name}</Text>
                    <Text style={styles.deliverableTag}>
                      {getTypeLabel(item.service_type)}
                    </Text>
                  </View>
                  {item.description && (
                    <Text style={styles.deliverableDesc}>
                      {item.description}
                    </Text>
                  )}
                  <Text style={styles.deliverableMeta}>
                    {Number(item.quantity)} × {item.unit}
                  </Text>

                  {item.service_type === 'package' &&
                    composition &&
                    composition.length > 0 && (
                      <View style={styles.deliverableComposition}>
                        <Text style={styles.deliverableCompositionLabel}>
                          INCLUYE
                        </Text>
                        {composition.map((c, cidx) => (
                          <View
                            key={cidx}
                            style={styles.deliverableCompositionItem}
                          >
                            <Text style={styles.deliverableCompQty}>
                              {c.quantity}×
                            </Text>
                            <Text>
                              {c.name} ({c.unit})
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// ============================================================
// INVERSIÓN
// ============================================================

function InvestmentSection({
  layer,
  data,
}: {
  layer: QuoteLayer;
  data: QuoteData;
}) {
  const { quote, items, adjustments, taxes } = data;
  const currency = quote.currency;

  const subtotal = Number(quote.subtotal);
  const discountTotal = Number(quote.discount_total);
  const baseAfterDiscount = subtotal - discountTotal;
  const total = Number(quote.total);

  const discounts = adjustments.filter((a) => a.adjustment_type !== 'bonus');
  const bonuses = adjustments.filter((a) => a.adjustment_type === 'bonus');

  return (
    <View style={styles.sectionWrapper}>
      <Text style={styles.sectionEyebrow}>SECCIÓN</Text>
      <Text style={styles.sectionTitle}>
        {layer.title || 'Inversión'}
      </Text>

      {/* Tabla de items */}
      <View style={styles.investmentTable}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>CONCEPTO</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>
            CANTIDAD
          </Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>
            UNITARIO
          </Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>
            SUBTOTAL
          </Text>
        </View>

        {items.map((item) => (
          <View key={item.id} style={styles.tableRow} wrap={false}>
            <Text style={styles.tableCellLeft}>{item.name}</Text>
            <Text style={styles.tableCellMid}>
              {Number(item.quantity)} {item.unit}
            </Text>
            <Text style={[styles.tableCellRight, { fontFamily: 'Helvetica' }]}>
              {formatPrice(Number(item.unit_price), currency)}
            </Text>
            <Text style={styles.tableCellRight}>
              {formatPrice(Number(item.subtotal), currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Resumen económico */}
      <View style={styles.summaryBox} wrap={false}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {formatPrice(subtotal, currency)}
          </Text>
        </View>

        {discounts.length > 0 && (
          <>
            {discounts.map((d) => (
              <View key={d.id} style={styles.summarySubRow}>
                <Text style={styles.summarySubLabel}>
                  {d.label}
                  {d.adjustment_type === 'discount_percent' &&
                    ` (${Number(d.amount).toFixed(0)}%)`}
                </Text>
                <Text style={styles.summarySubValue}>
                  -{formatPrice(Number(d.calculated_amount), currency)}
                </Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summarySubRow}>
              <Text style={styles.summarySubLabel}>
                Subtotal con descuentos
              </Text>
              <Text style={styles.summarySubValue}>
                {formatPrice(baseAfterDiscount, currency)}
              </Text>
            </View>
          </>
        )}

        {taxes.map((t) => (
          <View key={t.id} style={styles.summarySubRow}>
            <Text style={styles.summarySubLabel}>
              {t.name} ({Number(t.percentage).toFixed(0)}%)
            </Text>
            <Text style={styles.summarySubValue}>
              +{formatPrice(Number(t.tax_amount), currency)}
            </Text>
          </View>
        ))}

        <View style={styles.summaryTotalRow}>
          <Text style={styles.summaryTotalLabel}>Inversión total</Text>
          <Text style={styles.summaryTotalValue}>
            {formatPrice(total, currency)}
          </Text>
        </View>
      </View>

      {/* Bonificaciones */}
      {bonuses.length > 0 && (
        <View style={styles.bonusBox} wrap={false}>
          <Text style={styles.bonusLabel}>BONIFICACIONES INCLUIDAS</Text>
          {bonuses.map((b) => (
            <View key={b.id} style={styles.bonusRow}>
              <Text style={styles.bonusName}>{b.label}</Text>
              <Text style={styles.bonusValue}>
                {formatPrice(Number(b.amount), currency)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getTypeLabel(type: 'atomic' | 'package' | 'addon'): string {
  const labels = { atomic: 'SERVICIO', package: 'PAQUETE', addon: 'ADDON' };
  return labels[type];
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
