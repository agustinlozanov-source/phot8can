import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { getExpenseByIdAction } from '@/lib/actions/expenses';
import { ExpenseDetail } from './expense-detail';

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'expenses.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const result = await getExpenseByIdAction(id);
  if ('error' in result || !result.expense) notFound();

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/finance/expenses"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Gastos
      </Link>

      <ExpenseDetail
        expense={result.expense as never}
        canManage={hasPermission(ctx, 'expenses.manage')}
        canCancel={hasPermission(ctx, 'expenses.cancel')}
      />
    </div>
  );
}
