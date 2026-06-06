import { createClient } from '@/lib/supabase/server';

export default async function SuperAdminsPage() {
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from('super_admins')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Plataforma
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Super Administradores
        </h1>
        <p className="text-muted-foreground text-sm">
          Cuentas con acceso total al sistema.
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Nombre
              </th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Correo
              </th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Estado
              </th>
              <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Último acceso
              </th>
            </tr>
          </thead>
          <tbody>
            {admins?.map((admin) => (
              <tr key={admin.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{admin.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {admin.email}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Activo
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {admin.last_login_at
                    ? new Date(admin.last_login_at).toLocaleString('es-MX')
                    : 'Nunca'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
