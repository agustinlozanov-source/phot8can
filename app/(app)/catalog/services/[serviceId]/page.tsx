import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { ServiceDetail } from './service-detail';

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  const supabase = await createClient();

  // Cargar el servicio
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service) notFound();

  // Si es un paquete, cargar su composición
  let composition: Array<{
    id: string;
    included_service_id: string;
    quantity: number;
    position: number;
    notes: string | null;
    included_service: {
      id: string;
      name: string;
      service_type: 'atomic' | 'package' | 'addon';
      default_price: number;
      currency: string;
      unit: string;
    };
  }> = [];

  if (service.service_type === 'package') {
    const { data: compData } = await supabase
      .from('package_composition')
      .select(
        '*, included_service:services!package_composition_included_service_id_fkey(id, name, service_type, default_price, currency, unit)'
      )
      .eq('package_service_id', serviceId)
      .order('position', { ascending: true });

    composition = (compData || []).filter((c) => c.included_service) as any;
  }

  // Si es paquete, cargar todos los servicios atómicos disponibles para selector
  let availableServices: Array<{
    id: string;
    name: string;
    service_type: 'atomic' | 'package' | 'addon';
    default_price: number;
    currency: string;
    unit: string;
  }> = [];

  if (service.service_type === 'package') {
    const { data: allServices } = await supabase
      .from('services')
      .select('id, name, service_type, default_price, currency, unit')
      .eq('service_type', 'atomic')
      .eq('is_active', true)
      .is('archived_at', null)
      .neq('id', serviceId)
      .order('name');

    availableServices = allServices || [];
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Breadcrumb */}
      <Link
        href="/catalog/services"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Catálogo
      </Link>

      <ServiceDetail
        service={service}
        composition={composition}
        availableServices={availableServices}
        canManage={hasPermission(ctx, 'config.services')}
        canDelete={ctx.isSuperAdmin}
      />
    </div>
  );
}
