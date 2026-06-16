import { redirect } from 'next/navigation';
import { CheckSquare, PlayCircle, Circle, Ban, CheckCircle2 } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listMyTasksAction } from '@/lib/actions/work-order-tasks';
import { MyTasksList } from './my-tasks-list';

function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export default async function MyWorkPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'work_orders.execute')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            Esta sección es para colaboradores con tareas asignadas.
          </div>
        </div>
      </div>
    );
  }

  const result = await listMyTasksAction({
    status: ['pending', 'in_progress', 'blocked', 'done'],
  });
  const tasks = ('tasks' in result ? result.tasks : []) ?? [];

  const weekStart = startOfWeek();
  const stats = {
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    doneThisWeek: tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completed_at &&
        new Date(t.completed_at).getTime() >= weekStart
    ).length,
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Workspace
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <CheckSquare className="w-7 h-7 text-photocan-amber" />
          Mis tareas
        </h1>
        <p className="text-muted-foreground text-sm">
          Las tareas de producción que tienes asignadas
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="En curso" value={stats.in_progress} icon={<PlayCircle className="w-4 h-4" />} tone="amber" />
        <StatCard label="Pendientes" value={stats.pending} icon={<Circle className="w-4 h-4" />} tone="muted" />
        <StatCard label="Bloqueadas" value={stats.blocked} icon={<Ban className="w-4 h-4" />} tone="red" />
        <StatCard label="Listas (semana)" value={stats.doneThisWeek} icon={<CheckCircle2 className="w-4 h-4" />} tone="green" />
      </div>

      <MyTasksList tasks={tasks as never} weekStart={weekStart} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'muted' | 'amber' | 'green' | 'red';
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    amber: 'text-photocan-amber',
    green: 'text-green-500',
    red: 'text-destructive',
  }[tone];

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2 ${toneClass}`}
      >
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
