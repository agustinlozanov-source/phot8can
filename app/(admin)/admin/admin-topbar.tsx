'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/(auth)/login/actions';
import { useRouter } from 'next/navigation';
import type { SuperAdmin } from '@/lib/types/database';

export function AdminTopbar({ superAdmin }: { superAdmin: SuperAdmin }) {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-6">
      <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
        Panel de administración del SaaS
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center">
            <UserIcon className="w-3 h-3 text-black" />
          </div>
          <div className="text-sm font-medium">{superAdmin.name}</div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Salir
        </Button>
      </div>
    </header>
  );
}
