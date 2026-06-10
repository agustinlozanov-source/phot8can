'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/(auth)/login/actions';
import { useRouter } from 'next/navigation';

interface AppTopbarProps {
  displayName: string;
  initials: string;
  roles: Array<{ id: string; name: string; color: string | null }>;
}

export function AppTopbar({ displayName, initials, roles }: AppTopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        {roles.length > 0 && (
          <div className="flex items-center gap-1.5">
            {roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border text-[10px] font-mono uppercase tracking-wider"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: role.color || '#999' }}
                />
                {role.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center text-[10px] font-bold text-black">
            {initials}
          </div>
          <div className="text-sm font-medium">{displayName}</div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Salir
        </Button>
      </div>
    </header>
  );
}
