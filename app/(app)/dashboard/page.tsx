import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: appUser } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!appUser) redirect('/login');

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          {appUser.organization?.name}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Hola, {appUser.first_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Dashboard principal de la agencia.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <div className="font-medium mb-1">Próximamente</div>
        <div className="text-sm text-muted-foreground">
          Esta sección se construirá en los próximos módulos del roadmap.
        </div>
      </div>
    </div>
  );
}
