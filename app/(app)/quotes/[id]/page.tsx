import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { QuoteDetail } from './quote-detail';

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'quote.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver cotizaciones.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Cargar cotización con todas sus relaciones
  const { data: quote } = await supabase
    .from('quotes')
    .select(
      `
      *,
      client:clients(id, name, legal_name, tax_id),
      contact:contacts(id, first_name, last_name, email, phone, position),
      template:quote_templates(id, name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!quote) notFound();

  // Cargar items
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  // Cargar ajustes
  const { data: adjustments } = await supabase
    .from('quote_adjustments')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  // Cargar impuestos aplicados
  const { data: taxes } = await supabase
    .from('quote_taxes')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  // Cargar servicios disponibles del catálogo (para el selector)
  const { data: availableServices } = await supabase
    .from('services')
    .select('id, name, description, service_type, default_price, currency, unit')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('service_type')
    .order('name');

  // Cargar impuestos disponibles del catálogo
  const { data: availableTaxes } = await supabase
    .from('taxes')
    .select('id, name, code, percentage')
    .eq('is_enabled', true)
    .order('position');

  // Cargar contactos del cliente
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, position, is_primary')
    .eq('client_id', quote.client_id)
    .order('is_primary', { ascending: false })
    .order('first_name');

  const canEdit = hasPermission(ctx, 'quote.edit');
  const canSend = hasPermission(ctx, 'quote.send');
  const canDelete = hasPermission(ctx, 'quote.delete');

  return (
    <div className="p-8 max-w-7xl">
      <Link
        href="/quotes"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Cotizaciones
      </Link>

      <QuoteDetail
        quote={quote as any}
        items={items || []}
        adjustments={adjustments || []}
        taxes={taxes || []}
        availableServices={availableServices || []}
        availableTaxes={availableTaxes || []}
        contacts={contacts || []}
        canEdit={canEdit}
        canSend={canSend}
        canDelete={canDelete}
        isSuperAdmin={ctx.isSuperAdmin}
      />
    </div>
  );
}
