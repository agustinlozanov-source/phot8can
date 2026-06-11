'use client';

import { QuoteHeader } from './quote-header';
import { QuoteItemsSection } from './quote-items-section';
import { QuoteAdjustmentsSection } from './quote-adjustments-section';
import { QuoteTaxesSection } from './quote-taxes-section';
import { QuoteSummary } from './quote-summary';
import type {
  Quote,
  QuoteItem,
  QuoteAdjustment,
  QuoteTax,
} from '@/lib/types/database';

interface QuoteWithRelations extends Quote {
  client: {
    id: string;
    name: string;
    legal_name: string | null;
    tax_id: string | null;
  } | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    position: string | null;
  } | null;
  template: {
    id: string;
    name: string;
  } | null;
}

interface AvailableService {
  id: string;
  name: string;
  description: string | null;
  service_type: 'atomic' | 'package' | 'addon';
  default_price: number;
  currency: string;
  unit: string;
}

interface AvailableTax {
  id: string;
  name: string;
  code: string | null;
  percentage: number;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
}

interface Props {
  quote: QuoteWithRelations;
  items: QuoteItem[];
  adjustments: QuoteAdjustment[];
  taxes: QuoteTax[];
  availableServices: AvailableService[];
  availableTaxes: AvailableTax[];
  contacts: Contact[];
  canEdit: boolean;
  canSend: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
}

export function QuoteDetail({
  quote,
  items,
  adjustments,
  taxes,
  availableServices,
  availableTaxes,
  contacts,
  canEdit,
  canSend,
  canDelete,
  isSuperAdmin,
}: Props) {
  // El usuario puede editar contenido solo si:
  // - Tiene permiso de edit
  // - Y la cotización está en borrador o el super admin la abre
  const isLocked =
    !canEdit ||
    (quote.status !== 'draft' && !isSuperAdmin);

  return (
    <div>
      {/* Header con folio, estado y acciones */}
      <QuoteHeader
        quote={quote}
        canEdit={canEdit}
        canSend={canSend}
        canDelete={canDelete}
        isSuperAdmin={isSuperAdmin}
        contacts={contacts}
        itemsCount={items.length}
      />

      {/* Aviso si está bloqueada por estado */}
      {isLocked && canEdit && quote.status !== 'draft' && (
        <div className="mb-6 rounded-md bg-secondary/50 border border-border p-3 text-xs text-muted-foreground">
          Esta cotización está en estado{' '}
          <strong className="text-foreground capitalize">
            {quote.status}
          </strong>
          . El contenido no puede modificarse para mantener su integridad
          histórica.{' '}
          {isSuperAdmin && (
            <span className="text-photocan-amber-deep">
              (Como Super Admin puedes editarla de todos modos.)
            </span>
          )}
        </div>
      )}

      {/* Grid principal: contenido + sidebar de resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Contenido principal */}
        <div className="space-y-6 min-w-0">
          <QuoteItemsSection
            quoteId={quote.id}
            items={items}
            availableServices={availableServices}
            currency={quote.currency}
            locked={isLocked}
          />

          <QuoteAdjustmentsSection
            quoteId={quote.id}
            adjustments={adjustments}
            currency={quote.currency}
            locked={isLocked}
          />

          <QuoteTaxesSection
            quoteId={quote.id}
            taxes={taxes}
            availableTaxes={availableTaxes}
            currency={quote.currency}
            locked={isLocked}
          />
        </div>

        {/* Sidebar de resumen sticky */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <QuoteSummary
            quote={quote}
            itemsCount={items.length}
            adjustments={adjustments}
            taxes={taxes}
          />
        </div>
      </div>
    </div>
  );
}
