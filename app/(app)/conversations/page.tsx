import { redirect } from 'next/navigation';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import {
  listConversationsAction,
  getConversationByIdAction,
  listMessagesAction,
} from '@/lib/actions/conversations';
import { ConversationsView } from './conversations-view';
import type {
  ConversationWithRelations,
  Message,
} from '@/lib/types/database';

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation_id?: string }>;
}) {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') redirect('/login');
  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'conversations.view')) redirect('/my-work');

  const canManage = hasPermission(ctx, 'conversations.manage');
  const canAssign = hasPermission(ctx, 'conversations.assign');
  const canArchive = hasPermission(ctx, 'conversations.archive');
  const currentUserId = ctx.mode === 'user' ? ctx.user.id : null;

  const { conversation_id } = await searchParams;

  const listResult = await listConversationsAction({ status: 'open' });
  const conversations =
    ('conversations' in listResult ? listResult.conversations : []) ?? [];

  // Deep link: precargar la conversación seleccionada + sus mensajes
  let initialConversation: ConversationWithRelations | null = null;
  let initialMessages: Message[] = [];
  if (conversation_id) {
    const [convRes, msgRes] = await Promise.all([
      getConversationByIdAction(conversation_id),
      listMessagesAction(conversation_id),
    ]);
    if ('conversation' in convRes) {
      initialConversation = convRes.conversation as never;
    }
    if ('messages' in msgRes) {
      initialMessages = msgRes.messages as never;
    }
  }

  return (
    <ConversationsView
      initialConversations={conversations as never}
      initialSelectedId={conversation_id ?? null}
      initialConversation={initialConversation}
      initialMessages={initialMessages}
      canManage={canManage}
      canAssign={canAssign}
      canArchive={canArchive}
      currentUserId={currentUserId}
    />
  );
}
