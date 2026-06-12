import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { RequestDetail } from './request-detail';

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'inventory.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from('asset_requests')
    .select(
      `
      *,
      requester:users!asset_requests_requested_by_fkey(id, first_name, last_name, email),
      decider:users!asset_requests_decided_by_fkey(id, first_name, last_name),
      client:clients(id, name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!request) notFound();

  // Cargar items con su asset
  const { data: items } = await supabase
    .from('asset_request_items')
    .select(
      `
      *,
      asset:assets(
        id, name, brand, model, serial_number, category, status,
        warehouse:warehouses!assets_current_warehouse_id_fkey(id, name)
      )
    `
    )
    .eq('request_id', id)
    .order('created_at');

  // Identificar quién soy para saber qué acciones puedo hacer
  let currentUserId: string | null = null;
  if (!ctx.isSuperAdmin && ctx.authUserId) {
    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', ctx.authUserId)
      .maybeSingle();
    currentUserId = appUser?.id || null;
  }

  const canApprove = hasPermission(ctx, 'inventory.approve_requests');
  const canCheckout = hasPermission(ctx, 'inventory.checkout_checkin');
  const isRequester = currentUserId === request.requested_by;

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/inventory/requests"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Solicitudes
      </Link>

      <RequestDetail
        request={request as never}
        items={(items || []) as never}
        canApprove={canApprove}
        canCheckout={canCheckout}
        isRequester={isRequester}
        isSuperAdmin={ctx.isSuperAdmin}
      />
    </div>
  );
}
