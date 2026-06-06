import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verificar que sea super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!superAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-background">
      <AdminSidebar />
      <div className="flex flex-col min-w-0">
        <AdminTopbar superAdmin={superAdmin} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
