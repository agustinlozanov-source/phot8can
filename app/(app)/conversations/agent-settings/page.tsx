import { redirect } from 'next/navigation';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { getAgentSettingsAction } from '@/lib/actions/agent-settings';
import { AgentSettingsView } from './agent-settings-view';

export default async function AgentSettingsPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'conversations.configure_agent')) {
    redirect('/conversations');
  }

  const result = await getAgentSettingsAction();

  if ('error' in result || !('settings' in result)) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">No se pudo cargar el agente</div>
          <div className="text-sm text-muted-foreground">
            {'error' in result ? result.error : 'Error desconocido'}
          </div>
        </div>
      </div>
    );
  }

  return <AgentSettingsView initialSettings={result.settings as never} />;
}
