import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { ClientDetail } from './client-detail';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'client.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver este cliente.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Cargar cliente con sus contactos
  const { data: client } = await supabase
    .from('clients')
    .select('*, contacts(*)')
    .eq('id', clientId)
    .maybeSingle();

  if (!client) notFound();

  // Cargar usuarios de la org para el selector de account manager
  const { data: orgUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');

  // Cargar info del account manager actual (si tiene)
  let accountManager = null;
  if (client.account_manager_id) {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('id', client.account_manager_id)
      .maybeSingle();
    accountManager = data;
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Breadcrumb */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Clientes
      </Link>

      <ClientDetail
        client={client}
        contacts={client.contacts || []}
        users={orgUsers || []}
        accountManager={accountManager}
        canEdit={hasPermission(ctx, 'client.edit')}
        canManageContacts={hasPermission(ctx, 'contact.manage')}
        canDelete={ctx.isSuperAdmin}
      />
    </div>
  );
}
