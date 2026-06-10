import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClientsList } from './clients-list';
import { NewClientButton } from './new-client-button';
import { Users } from 'lucide-react';

export default async function ClientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Verificar que sea usuario regular (no super admin)
  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!appUser) {
    // Si es super admin, sigue funcionando con sus permisos
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!superAdmin) redirect('/login');
  }

  // Verificar permiso de ver clientes
  const { data: canView } = await supabase.rpc('current_user_has_permission', {
    permission_code: 'client.view',
  });

  // Super admin no necesita el permiso (su política es is_super_admin())
  const { data: isSuperAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!canView && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver clientes.
          </div>
        </div>
      </div>
    );
  }

  // Verificar permiso de crear (para mostrar el botón)
  const { data: canCreate } = await supabase.rpc(
    'current_user_has_permission',
    {
      permission_code: 'client.create',
    }
  );

  // Cargar todos los clientes de la organización (RLS filtra automáticamente)
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*, contacts(id, first_name, last_name, email, is_primary)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar clientes
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  // Cargar usuarios para el selector de account manager (al crear cliente)
  const { data: orgUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Clientes
          </h1>
          <p className="text-muted-foreground text-sm">
            Empresas que tu agencia atiende. {clients?.length ?? 0} en total.
          </p>
        </div>

        {(canCreate || isSuperAdmin) && (
          <NewClientButton users={orgUsers || []} />
        )}
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-4 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            Total
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {clients?.length ?? 0}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Activos
          </div>
          <div className="text-2xl font-semibold tracking-tight text-green-500">
            {clients?.filter((c) => c.status === 'active' && !c.archived_at)
              .length ?? 0}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            En pausa
          </div>
          <div className="text-2xl font-semibold tracking-tight text-photocan-amber">
            {clients?.filter((c) => c.status === 'paused' && !c.archived_at)
              .length ?? 0}
          </div>
        </div>
        <div className="p-4">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Archivados
          </div>
          <div className="text-2xl font-semibold tracking-tight text-muted-foreground">
            {clients?.filter((c) => c.archived_at).length ?? 0}
          </div>
        </div>
      </div>

      {/* Lista (componente cliente con filtros/búsqueda) */}
      {clients && clients.length > 0 ? (
        <ClientsList clients={clients} />
      ) : (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Aún no hay clientes</div>
          <div className="text-sm text-muted-foreground mb-4">
            Crea tu primer cliente para empezar a operar.
          </div>
          {(canCreate || isSuperAdmin) && (
            <NewClientButton users={orgUsers || []} />
          )}
        </div>
      )}
    </div>
  );
}
