'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Search,
  Edit2,
  Key,
  Power,
  Copy,
  Check,
  RefreshCw,
  Ban,
  Loader2,
  AlertCircle,
  X,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
} from '@/lib/actions/team-members';
import {
  cancelInvitationAction,
  regenerateInvitationTokenAction,
} from '@/lib/actions/team-invitations';
import { InviteMemberModal } from './invite-member-modal';
import {
  Avatar,
  RoleChips,
  MemberStatusBadge,
  formatDate,
  daysUntil,
  TONE_CLASS,
  type RoleChip,
} from './team-ui';

type Member = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_active: boolean;
  roles: RoleChip[];
  active_tasks_count: number;
};

type Invitation = {
  id: string;
  email: string;
  invitation_token: string;
  status: string;
  expires_at: string;
  created_at: string;
  roles: RoleChip[];
  creator: { first_name: string; last_name: string } | null;
};

type Role = { id: string; name: string };

interface Props {
  members: Member[];
  invitations: Invitation[];
  roles: Role[];
  currentUserId: string | null;
  canManage: boolean;
  canManageRoles: boolean;
}

export function TeamDashboard({
  members,
  invitations,
  roles,
  currentUserId,
  canManage,
  canManageRoles,
}: Props) {
  const [tab, setTab] = useState<'members' | 'invitations'>('members');
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Administración
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
            <Users className="w-7 h-7 text-photocan-amber" />
            Equipo
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los miembros, invitaciones y roles de tu organización
          </p>
        </div>
        {canManageRoles && (
          <Link
            href="/team/roles"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurar roles
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Miembros activos" value={members.filter((m) => m.is_active).length} icon={<Users className="w-4 h-4" />} />
        <Stat label="Invitaciones pendientes" value={invitations.length} icon={<Mail className="w-4 h-4" />} />
        <Stat label="Roles disponibles" value={roles.length} icon={<Shield className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 border border-border rounded-md p-1 bg-card">
          <TabBtn active={tab === 'members'} onClick={() => setTab('members')} label="Miembros del equipo" count={members.length} />
          <TabBtn active={tab === 'invitations'} onClick={() => setTab('invitations')} label="Invitaciones pendientes" count={invitations.length} />
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Invitar miembro
          </Button>
        )}
      </div>

      {tab === 'members' ? (
        <MembersTab
          members={members}
          roles={roles}
          currentUserId={currentUserId}
          canManage={canManage}
          onInvite={() => setInviteOpen(true)}
        />
      ) : (
        <InvitationsTab invitations={invitations} canManage={canManage} />
      )}

      {inviteOpen && (
        <InviteMemberModal roles={roles} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

// ============================================================
// TAB: MIEMBROS
// ============================================================

function MembersTab({
  members,
  roles,
  currentUserId,
  canManage,
  onInvite,
}: {
  members: Member[];
  roles: Role[];
  currentUserId: string | null;
  canManage: boolean;
  onInvite: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [pwdMember, setPwdMember] = useState<Member | null>(null);

  const filtered = useMemo(() => {
    let result = members;
    if (!showInactive) result = result.filter((m) => m.is_active);
    if (roleFilter)
      result = result.filter((m) => m.roles.some((r) => r.id === roleFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [members, showInactive, roleFilter, search]);

  async function toggleActive(m: Member) {
    const verb = m.is_active ? 'desactivar' : 'reactivar';
    if (!confirm(`¿${verb[0].toUpperCase()}${verb.slice(1)} a ${m.first_name}?`))
      return;
    setError(null);
    setLoading(`active-${m.id}`);
    const result = await setMemberActiveAction({
      user_id: m.id,
      is_active: !m.is_active,
    });
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  if (members.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-16 text-center">
        <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="font-medium mb-2">
          Aún no hay miembros además de ti
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Invita a tu primer colaborador para empezar a delegar trabajo.
        </p>
        {canManage && (
          <Button onClick={onInvite}>
            <UserPlus className="w-4 h-4" />
            Invitar miembro
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap px-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 accent-photocan-amber"
          />
          Mostrar inactivos
        </label>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <Th>Miembro</Th>
              <Th>Email</Th>
              <Th>Roles</Th>
              <Th>Tareas</Th>
              <Th>Estado</Th>
              {canManage && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      firstName={m.first_name}
                      lastName={m.last_name}
                      url={m.avatar_url}
                      size="sm"
                    />
                    <span className="font-medium">
                      {m.first_name} {m.last_name}
                      {m.id === currentUserId && (
                        <span className="text-[10px] font-mono text-muted-foreground ml-1">
                          (tú)
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3">
                  <RoleChips roles={m.roles} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {m.active_tasks_count > 0 ? (
                    <span className="text-photocan-amber-deep">
                      {m.active_tasks_count} activas
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <MemberStatusBadge active={m.is_active} />
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn
                        title="Editar"
                        onClick={() => {
                          setError(null);
                          setEditMember(m);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Cambiar contraseña"
                        onClick={() => {
                          setError(null);
                          setPwdMember(m);
                        }}
                      >
                        <Key className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn
                        title={m.is_active ? 'Desactivar' : 'Reactivar'}
                        onClick={() => toggleActive(m)}
                        disabled={loading === `active-${m.id}`}
                        danger={m.is_active}
                      >
                        {loading === `active-${m.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </IconBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground mt-3">
          No hay miembros que coincidan con el filtro.
        </div>
      )}

      {editMember && (
        <EditMemberModal
          member={editMember}
          roles={roles}
          onClose={() => setEditMember(null)}
        />
      )}
      {pwdMember && (
        <PasswordModal
          member={pwdMember}
          onClose={() => setPwdMember(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// TAB: INVITACIONES
// ============================================================

function InvitationsTab({
  invitations,
  canManage,
}: {
  invitations: Invitation[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelInv, setCancelInv] = useState<Invitation | null>(null);

  function linkFor(inv: Invitation) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/invite/${inv.invitation_token}`;
  }

  async function copy(inv: Invitation) {
    await navigator.clipboard.writeText(linkFor(inv));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function regenerate(inv: Invitation) {
    setError(null);
    setLoading(`regen-${inv.id}`);
    const result = await regenerateInvitationTokenAction(inv.id);
    setLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  if (invitations.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
        No hay invitaciones pendientes
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <Th>Email</Th>
              <Th>Roles</Th>
              <Th>Enviada por</Th>
              <Th>Fecha</Th>
              <Th>Vigencia</Th>
              {canManage && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => {
              const exp = daysUntil(inv.expires_at);
              return (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{inv.email}</td>
                  <td className="px-4 py-3">
                    <RoleChips roles={inv.roles} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.creator
                      ? `${inv.creator.first_name} ${inv.creator.last_name}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {formatDate(inv.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${TONE_CLASS[exp.tone]}`}>
                      {exp.label}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="Copiar link" onClick={() => copy(inv)}>
                          {copiedId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn
                          title="Regenerar link"
                          onClick={() => regenerate(inv)}
                          disabled={loading === `regen-${inv.id}`}
                        >
                          {loading === `regen-${inv.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn
                          title="Cancelar"
                          danger
                          onClick={() => {
                            setError(null);
                            setCancelInv(inv);
                          }}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </IconBtn>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cancelInv && (
        <CancelInvitationModal
          invitation={cancelInv}
          onClose={() => setCancelInv(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// MODALES
// ============================================================

function EditMemberModal({
  member,
  roles,
  onClose,
}: {
  member: Member;
  roles: Role[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [roleIds, setRoleIds] = useState<string[]>(
    member.roles.map((r) => r.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(id: string) {
    setRoleIds((s) => (s.includes(id) ? s.filter((r) => r !== id) : [...s, id]));
  }

  async function handleSave() {
    setError(null);
    if (roleIds.length === 0) return setError('Selecciona al menos un rol');
    setLoading(true);
    const result = await updateMemberAction({
      user_id: member.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role_ids: roleIds,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <Modal title={`Editar ${member.first_name}`} onClose={onClose} disabled={loading}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Apellido</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Roles</Label>
          <div className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/40">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                  disabled={loading}
                  className="w-4 h-4 accent-photocan-amber"
                />
                <span className="text-sm">{r.name}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <ErrorLine error={error} />}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading} className="flex-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function PasswordModal({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setError(null);
    if (password.length < 8) return setError('Mínimo 8 caracteres');
    setLoading(true);
    const result = await resetMemberPasswordAction({
      user_id: member.id,
      new_password: password,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    setDone(true);
  }

  return (
    <Modal title={`Contraseña de ${member.first_name}`} onClose={onClose} disabled={loading}>
      {done ? (
        <div className="space-y-4">
          <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
            Contraseña actualizada. Comparte la nueva contraseña con{' '}
            {member.first_name} de forma segura.
          </div>
          <Button onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_pwd">Nueva contraseña</Label>
              <Input
                id="new_pwd"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            {error && <ErrorLine error={error} />}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cambiar contraseña'}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

function CancelInvitationModal({
  invitation,
  onClose,
}: {
  invitation: Invitation;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    setLoading(true);
    const result = await cancelInvitationAction({
      invitation_id: invitation.id,
      reason: reason.trim() || undefined,
    });
    setLoading(false);
    if (result?.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Cancelar invitación" onClose={onClose} disabled={loading}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El link de <strong>{invitation.email}</strong> dejará de funcionar.
        </p>
        <div className="space-y-2">
          <Label htmlFor="cancel_reason">Motivo (opcional)</Label>
          <textarea
            id="cancel_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
          />
        </div>
        {error && <ErrorLine error={error} />}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
          Volver
        </Button>
        <Button onClick={handleCancel} disabled={loading} className="flex-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancelar invitación'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ============================================================
// AUXILIARES
// ============================================================

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
      <span className={`font-mono tabular-nums ${active ? 'text-black/70' : 'text-muted-foreground'}`}>
        {count}
      </span>
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-40 ${
        danger ? 'hover:text-destructive' : ''
      }`}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  disabled,
  children,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !disabled && onClose()} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} disabled={disabled} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 pt-5">{children}</div>;
}

function ErrorLine({ error }: { error: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {error}
    </div>
  );
}
