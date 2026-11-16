'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatusBanner } from '@/components/ui/StatusBanner';
import Link from 'next/link';
import {
  ChevronLeft,
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  Sliders,
  XCircle,
  CheckCircle,
  Key,
  User,
  QrCode,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { LinkButton } from '@/components/ui/LinkButton';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { permissionDescription, permissionLabel } from '@/lib/admin/permission-labels';
import { PERMISSION_GROUPS, PERMISSION_PROFILES, dependentsOf, withDependencies } from '@/lib/admin/permission-profiles';
import { ERASED_ACCOUNT_LABEL, accountStatusLabel, roleLabel } from '@/lib/labels/account';
import { isDeliverableEmail } from '@/lib/notifications/channels';
import { noticesText } from '@/lib/admin/confirmations';
import { TextInput } from '@/components/ui/Field';

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'PARTENAIRE' | 'CONTROLEUR' | 'CLIENT';
  status: 'ACTIF' | 'EN_ATTENTE' | 'SUSPENDU' | 'SUPPRIME';
  referral_status: 'STANDARD' | 'AMBASSADEUR';
  created_at: string;
  /** Lot 9 quinquies (A2) : compte créé par un admin pas encore activé (lien valable ou expiré). */
  activation?: 'PENDING' | 'EXPIRED' | null;
}

/** Message français d'une réponse en échec (`{ error }` de la route), sinon le repli donné. */
function refusalOf(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string' && (data as { error: string }).error.trim()) {
    return (data as { error: string }).error;
  }
  return fallback;
}

/**
 * Lot 9 bis (R51, B34 ; contrat 5.12) : les boutons qui écrivent ne s'affichent qu'avec la permission users.write
 * (création, suspension, réactivation, anonymisation) ; « Permissions » et toute action sur un compte ADMIN restent
 * au SUPERADMIN (R71, B33), comme côté serveur. Un refus éventuel de la route est affiché tel quel (texte français).
 * Lot 9 bis (R75, contrat 5.41) : rôles et statuts par lib/labels/account.ts, jamais la valeur brute de la base.
 * Lot 9 bis (R6, R59, B38, B74 ; contrat 4.2, 5.15) : le statut d'un compte partenaire ne se change pas ici : la ligne
 * propose « Voir la fiche partenaire » (/admin/dashboard?partenaires=ALL&dossier=<partnerId>, identifiant lu sur
 * GET /api/admin/partners avec partners.read). Suspendre ou réactiver un autre compte demande un motif (ReasonDialog),
 * repris dans l'avis au titulaire (ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED).
 */
export default function AdminUsersManagementPage() {
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  const canWrite = hasPermission('users.write');
  const isSuperadmin = hasRole('SUPERADMIN');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  /** Fiche partenaire de chaque compte partenaire (user_id → partners.id), lue avec partners.read. */
  const [partnerIdByUser, setPartnerIdByUser] = useState<Record<string, string>>({});
  const canReadPartners = hasPermission('partners.read');

  // Changement de statut d'un compte non partenaire, avec motif (R59)
  const [statusTarget, setStatusTarget] = useState<UserItem | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Modal Création Utilisateur / Admin
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPERADMIN' | 'CONTROLEUR' | 'CLIENT'>('CONTROLEUR');
  const [isCreating, setIsCreating] = useState(false);

  // Dialog de confirmation suppression
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Permissions Granulaires pour Admin
  const [selectedAdmin, setSelectedAdmin] = useState<UserItem | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  // Lot 9 quater (B7 : N-07, E-12) : état de la lecture des droits ; la grille n'affiche jamais les cases d'un autre admin
  const [permsState, setPermsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const permsRequestFor = useRef<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/users?role=${roleFilter}&search=${encodeURIComponent(search)}`);
      const data: unknown = await res.json().catch(() => null);
      const list = data && typeof data === 'object' ? (data as { users?: unknown }).users : undefined;
      if (!res.ok || !Array.isArray(list)) {
        // Lot 9 bis (R51) : refus de la route (permission users.read absente…) dit en français, jamais une liste vide muette.
        setUsers([]);
        setListError(refusalOf(data, 'Impossible de charger les comptes pour le moment. Réessayez.'));
        return;
      }
      setUsers(list as UserItem[]);
    } catch (err) {
      console.error('[AdminUsers] Erreur chargement:', err);
      setUsers([]);
      setListError('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Lot 9 bis (R6) : identifiant de la fiche de chaque partenaire, pour le lien « Voir la fiche partenaire ».
  useEffect(() => {
    if (!canReadPartners) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/partners?status=ALL', { cache: 'no-store' });
        const data: unknown = await res.json().catch(() => null);
        const list = data && typeof data === 'object' ? (data as { partners?: unknown }).partners : undefined;
        if (!res.ok || !Array.isArray(list)) {
          console.error(`[AdminUsers] fiches partenaires non lues (HTTP ${res.status})`);
          return;
        }
        const map: Record<string, string> = {};
        for (const row of list as Array<{ id?: unknown; user_id?: unknown }>) {
          if (typeof row.id === 'string' && typeof row.user_id === 'string') map[row.user_id] = row.id;
        }
        if (active) setPartnerIdByUser(map);
      } catch (err) {
        console.error('[AdminUsers] fiches partenaires non lues :', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [canReadPartners]);

  // Création d'un nouvel utilisateur ou administrateur
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim().toLowerCase() || undefined,
          role: newRole,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(refusalOf(data, 'Erreur lors de la création.'));

      // Lot 9 quinquies (A2) : le titulaire choisit son mot de passe par le lien reçu par SMS
      const reply = (data ?? {}) as { activation?: string; message?: string; userId?: string };
      const noRights = newRole === 'ADMIN' ? ' Il n’a encore aucun droit : choisissez-les maintenant.' : '';
      if (reply.activation === 'SENT') {
        toast.success(`Compte ${roleLabel(newRole)} de ${newFirstName} ${newLastName} créé. Le lien d’activation est parti par SMS (valable 24 heures).${noRights}`);
      } else {
        toast.error(reply.message ?? 'Compte créé, mais le SMS d’activation n’est pas parti. Renvoyez le lien depuis la liste.');
      }
      const created = { first_name: newFirstName.trim(), last_name: newLastName.trim() };
      setIsCreateModalOpen(false);
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      await fetchUsers();
      // Finition 3b (E-36) : un administrateur créé n'a aucun droit ; la grille de ses droits s'ouvre tout de suite.
      if (newRole === 'ADMIN' && reply.userId) {
        void handleOpenPermissions({ ...created, id: reply.userId } as UserItem);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la création.';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Lot 9 quinquies (A2) : renvoi du lien d'activation (le précédent n'est plus valable)
  const handleResendActivation = async (user: UserItem) => {
    setResendingId(user.id);
    try {
      const res = await fetch('/api/admin/users/activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(refusalOf(data, 'Le lien n’a pas pu être renvoyé.'));
      const reply = (data ?? {}) as { activation?: string; message?: string };
      if (reply.activation === 'SENT') toast.success(`Nouveau lien d’activation envoyé à ${user.first_name} ${user.last_name}.`);
      else toast.error(reply.message ?? 'Le SMS n’est pas parti. Réessayez dans un instant.');
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Le lien n’a pas pu être renvoyé.');
    } finally {
      setResendingId(null);
    }
  };

  // Suspension ou réactivation d'un compte non partenaire, avec motif (lot 9 bis, R59 ; refus dits dans la boîte)
  const handleToggleStatus = async (user: UserItem, reason: string) => {
    const newStatus = user.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
    setIsChangingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: newStatus,
          reason,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setStatusError(refusalOf(data, 'Erreur lors du changement de statut.'));
        return;
      }

      toast.success(
        newStatus === 'ACTIF'
          ? `Le compte de ${user.first_name} ${user.last_name} a été réactivé avec succès.`
          : `Le compte de ${user.first_name} ${user.last_name} a été suspendu.`
      );
      setStatusTarget(null);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('[AdminUsers] changement de statut en échec :', err);
      setStatusError('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Ouverture de la modal des permissions
  const handleOpenPermissions = async (adminUser: UserItem) => {
    // Lot 9 quater (B7 : N-07) : grille vidée et « Chargement… » AVANT la lecture ; une réponse arrivée pour un autre
    // admin (fenêtre rouverte entre-temps) est ignorée ; un échec rend la grille illisible et « Enregistrer » inactif.
    permsRequestFor.current = adminUser.id;
    setAdminPermissions([]);
    setPermsState('loading');
    setSelectedAdmin(adminUser);
    setIsPermModalOpen(true);

    try {
      const res = await fetch(`/api/admin/permissions?adminId=${adminUser.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (permsRequestFor.current !== adminUser.id) return;
      if (!res.ok || !Array.isArray(data?.assignedPermissions)) {
        console.error('[admin/users] droits illisibles :', res.status, data);
        setPermsState('error');
        return;
      }
      setAdminPermissions(data.assignedPermissions as string[]);
      setPermsState('ready');
    } catch (err) {
      console.error('[admin/users] lecture des droits impossible :', err);
      if (permsRequestFor.current === adminUser.id) setPermsState('error');
    }
  };

  // Sauvegarde des permissions
  const handleSavePermissions = async () => {
    if (!selectedAdmin || permsState !== 'ready') return;
    setIsSavingPerms(true);

    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: selectedAdmin.id,
          permissions: adminPermissions,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(refusalOf(data, 'Erreur lors de la mise à jour des permissions.'));

      toast.success(`Droits de ${selectedAdmin.first_name} ${selectedAdmin.last_name} enregistrés. Effet immédiat : il voit ses nouveaux écrans en rechargeant la page.`);
      setIsPermModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l\'enregistrement des permissions.';
      toast.error(msg);
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Finition 3b (E-36) : cocher un droit d'écriture coche sa lecture ; décocher une lecture décoche ce qui en dépend.
  const togglePermissionItem = (perm: string) => {
    if (adminPermissions.includes(perm)) {
      const drop = new Set([perm, ...dependentsOf(perm)]);
      setAdminPermissions(adminPermissions.filter((p) => !drop.has(p)));
    } else {
      setAdminPermissions(withDependencies([...adminPermissions, perm]));
    }
  };

  // Suppression définitive d'un compte utilisateur
  const handleDeleteUser = (user: UserItem) => {
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}/anonymize`, {
        method: 'POST',
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(refusalOf(data, 'Erreur lors de l\'anonymisation.'));

      toast.success(`Le compte de ${userToDelete.first_name} ${userToDelete.last_name} a été définitivement anonymisé (RGPD).`);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l\'anonymisation.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            aria-label="Retour à l’accueil de l’administration"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
              Comptes et administrateurs
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </Button>

          {canWrite && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<UserPlus size={16} aria-hidden="true" />}
            >
              Créer un compte
            </Button>
          )}
        </div>
      </div>

      {/* Filtres & Recherche */}
      <div className="space-y-6 rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Rechercher un compte"
              placeholder="Rechercher par nom, email ou téléphone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-4 text-base text-fg outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par rôle">
            {['ALL', 'SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR', 'CLIENT'].map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={roleFilter === role}
                onClick={() => setRoleFilter(role)}
                className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  roleFilter === role ? 'bg-brand text-on-brand' : 'border border-border text-fg-muted hover:bg-surface-sunken hover:text-fg'
                }`}
              >
                {role === 'ALL' ? 'Tous' : roleLabel(role)}
              </button>
            ))}
          </div>
        </div>

        {/* Liste Réelle des Utilisateurs */}
        {isLoading ? (
          <div role="status" className="py-12 text-center text-fg-muted">
            <RefreshCw size={24} className="mx-auto mb-2 text-brand-fg motion-safe:animate-spin" aria-hidden="true" />
            <p className="text-sm">Chargement des comptes…</p>
          </div>
        ) : listError ? (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger-border bg-danger-bg p-4 text-sm text-danger-fg">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p>{listError}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-fg-muted">
            <Users size={32} className="mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold">Aucun compte ne correspond à cette recherche.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isSuper = user.role === 'SUPERADMIN';
              const isAdmin = user.role === 'ADMIN';
              const isSuspended = user.status === 'SUSPENDU';
              const isDeleted = user.status === 'SUPPRIME';
              const partnerId = partnerIdByUser[user.id];
              const isPartner = user.role === 'PARTENAIRE' || partnerId !== undefined;

              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDeleted
                      ? 'bg-slate-100/60 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800 opacity-75'
                      : 'bg-slate-50 dark:bg-zinc-900/70 border-slate-200/80 dark:border-zinc-800/80'
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </h4>

                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          isSuper
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                            : isAdmin
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                            : user.role === 'PARTENAIRE'
                            ? 'bg-orange-100 text-[#FF5722] dark:bg-orange-950/40'
                            : 'bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {roleLabel(user.role)}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isDeleted
                            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 font-black'
                            : isSuspended
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {isDeleted ? ERASED_ACCOUNT_LABEL : accountStatusLabel(user.status)}
                      </span>

                      {user.activation && !isDeleted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {user.activation === 'PENDING' ? 'Activation en attente' : 'Activation en attente (lien expiré)'}
                        </span>
                      )}

                      {user.referral_status === 'AMBASSADEUR' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Ambassadeur
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Phone size={12} />
                        <span>{user.phone || 'Non renseigné'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {/* Lot 9 quater (A4) : une adresse technique n'est jamais affichée */}
                        <span>{isDeliverableEmail(user.email) ? user.email : 'Non renseigné'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Bouton Permissions Granulaires pour Admin */}
                    {isAdmin && !isDeleted && isSuperadmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenPermissions(user)}
                        className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-600 hover:text-white"
                      >
                        <Key size={13} className="mr-1" />
                        Permissions
                      </Button>
                    )}

                    {/* Lot 9 quinquies (A2) : renvoi du lien d'activation d'un compte créé par un admin */}
                    {user.activation && !isDeleted && canWrite && (!(isAdmin || isSuper) || isSuperadmin) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={resendingId === user.id}
                        onClick={() => void handleResendActivation(user)}
                      >
                        Renvoyer le lien
                      </Button>
                    )}

                    {/* Suspension / Réactivation / Suppression */}
                    {/* Lot 9 bis (R6) : une partenaire se suspend ou se réactive depuis sa fiche, avec un motif */}
                    {isPartner && !isDeleted && (
                      partnerId !== undefined ? (
                        <LinkButton
                          href={`/admin/dashboard?partenaires=ALL&dossier=${encodeURIComponent(partnerId)}`}
                          variant="secondary"
                          size="sm"
                        >
                          Voir la fiche partenaire
                        </LinkButton>
                      ) : (
                        <span className="text-sm text-fg-muted">Statut géré depuis la fiche partenaire</span>
                      )
                    )}

                    {!isSuper && !isDeleted && canWrite && (!isAdmin || isSuperadmin) && (
                      <>
                        {!isPartner && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setStatusError(null);
                            setStatusTarget(user);
                          }}
                          className={`text-xs ${
                            isSuspended
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          }`}
                        >
                          {isSuspended ? 'Réactiver' : 'Suspendre'}
                        </Button>
                        )}
                        {/* Lot 9 quater (B2 : E-39, AUD-23) : aucune suppression depuis une ligne de partenaire */}
                        {!isPartner && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          title="Supprimer définitivement ce compte"
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/30 flex items-center gap-1"
                        >
                          <Trash2 size={13} />
                          <span>Supprimer</span>
                        </Button>
                        )}
                      </>
                    )}

                    {isDeleted && (
                      <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 italic px-2">
                        Compte supprimé
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* ====================================================================
          MODAL CRÉATION UTILISATEUR / ADMIN (SUPERADMIN ONLY)
          ==================================================================== */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un compte"
        subtitle="Le compte est actif tout de suite ; le titulaire choisit lui-même son mot de passe."
        icon={<UserPlus size={18} />}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Prénom" required autoComplete="off" placeholder="Ex : Moussa" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
            <TextInput label="Nom" required autoComplete="off" placeholder="Ex : Diop" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
          </div>
          <TextInput label="Numéro de téléphone (Sénégal)" type="tel" required inputMode="tel" placeholder="77 123 45 67" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="tabular-nums" />
          <TextInput label="Email (facultatif)" type="email" placeholder="contact@domaine.sn" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />

          <div className="rounded-xl border border-border bg-surface-sunken p-3 text-sm text-fg-muted">
            {/* Lot 9 quinquies (A2 : AUTH-02) : plus aucun mot de passe saisi par l'administrateur */}
            <p className="font-semibold text-fg">Mot de passe choisi par le titulaire</p>
            <p className="mt-1">Le titulaire reçoit par SMS un lien d’activation valable 24 heures pour choisir son mot de passe.</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-fg">Rôle</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={newRole === 'CONTROLEUR'}
                onClick={() => setNewRole('CONTROLEUR')}
                className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  newRole === 'CONTROLEUR' ? 'border-brand bg-brand-bg' : 'border-border bg-surface hover:bg-surface-sunken'
                }`}
              >
                <QrCode size={18} className="mt-0.5 flex-shrink-0 text-brand-fg" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">Contrôleur</span>
                  <span className="block text-sm text-fg-muted">Scanne les billets des événements où un partenaire l’affecte</span>
                </span>
              </button>
              {/* Lot 9 bis (R71, B33) : créer un administrateur ou un superadmin est réservé au SUPERADMIN */}
              {isSuperadmin && (
                <>
              <button
                type="button"
                aria-pressed={newRole === 'ADMIN'}
                onClick={() => setNewRole('ADMIN')}
                className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  newRole === 'ADMIN' ? 'border-brand bg-brand-bg' : 'border-border bg-surface hover:bg-surface-sunken'
                }`}
              >
                <Key size={18} className="mt-0.5 flex-shrink-0 text-brand-fg" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">Administrateur</span>
                  <span className="block text-sm text-fg-muted">Agit selon les droits que vous lui donnez</span>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={newRole === 'SUPERADMIN'}
                onClick={() => setNewRole('SUPERADMIN')}
                className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  newRole === 'SUPERADMIN' ? 'border-brand bg-brand-bg' : 'border-border bg-surface hover:bg-surface-sunken'
                }`}
              >
                <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-brand-fg" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">Superadmin</span>
                  <span className="block text-sm text-fg-muted">Tous les droits, dont les réglages et la création d’administrateurs</span>
                </span>
              </button>
                </>
              )}
              <button
                type="button"
                aria-pressed={newRole === 'CLIENT'}
                onClick={() => setNewRole('CLIENT')}
                className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  newRole === 'CLIENT' ? 'border-brand bg-brand-bg' : 'border-border bg-surface hover:bg-surface-sunken'
                }`}
              >
                <User size={18} className="mt-0.5 flex-shrink-0 text-brand-fg" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">Client</span>
                  <span className="block text-sm text-fg-muted">Achète des billets, sans accès professionnel</span>
                </span>
              </button>
            </div>
          </fieldset>

          <p className="flex items-start gap-2 rounded-xl border border-info-border bg-info-bg p-3 text-sm text-info-fg">
            <Info size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              {newRole === 'CONTROLEUR' && 'À sa connexion, il arrive sur son scanner. Il ne contrôle qu’après avoir été affecté à un événement par un partenaire.'}
              {newRole === 'ADMIN' && 'Un administrateur n’a aucun droit tant que vous ne lui en donnez pas : vous les choisissez juste après la création.'}
              {newRole === 'SUPERADMIN' && 'Tous les droits, dont les réglages de la plateforme et la création d’administrateurs.'}
              {newRole === 'CLIENT' && 'Achète des billets et parraine ses proches, sans accès professionnel.'}
            </span>
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreating} leftIcon={<UserPlus size={16} aria-hidden="true" />}>
              Créer le compte {roleLabel(newRole)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ====================================================================
          MODAL PERMISSIONS GRANULAIRES ADMIN (SUPERADMIN ONLY)
          ==================================================================== */}
      {selectedAdmin && (
        <Modal
          isOpen={isPermModalOpen}
          onClose={() => setIsPermModalOpen(false)}
          title={`Droits de ${selectedAdmin.first_name} ${selectedAdmin.last_name}`}
          subtitle="Effet immédiat ; la personne voit ses nouveaux écrans en rechargeant la page. Elle n’est pas prévenue."
          icon={<Key size={20} />}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Partez d’un profil prêt, puis ajustez les cases. Un droit qui modifie amène toujours le droit de voir.
            </p>

            {permsState === 'loading' && (
              <p role="status" className="py-6 text-center text-sm text-fg-muted">Chargement…</p>
            )}
            {permsState === 'error' && (
              <StatusBanner tone="danger" announce="alert" title="Droits illisibles">
                Droits illisibles : fermez et rouvrez.
              </StatusBanner>
            )}
            {permsState === 'ready' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Profils prêts">
                {PERMISSION_PROFILES.map((profile) => (
                  <Button
                    key={profile.key}
                    type="button"
                    variant="secondary"
                    size="sm"
                    title={profile.hint}
                    onClick={() => setAdminPermissions(withDependencies(profile.permissions))}
                  >
                    {profile.label}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setAdminPermissions([])}>
                  Aucun droit
                </Button>
              </div>
              <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
                {PERMISSION_GROUPS.map((group) => (
                  <fieldset key={group.title} className="space-y-2 rounded-2xl border border-border p-3">
                    <legend className="px-1 text-sm font-semibold text-fg">{group.title}</legend>
                    {group.permissions.filter((perm) => (ADMIN_PERMISSIONS as readonly string[]).includes(perm)).map((perm) => {
                      const isChecked = adminPermissions.includes(perm);
                      const inputId = `droit-${perm.replace('.', '-')}`;
                      return (
                        <label key={perm} htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface-sunken">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermissionItem(perm)}
                            className="mt-1 h-5 w-5 flex-shrink-0 rounded border-border-strong accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-fg">{permissionLabel(perm)}</span>
                            <span className="block text-sm text-fg-muted">{permissionDescription(perm)}</span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
            </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
              <Button variant="secondary" type="button" onClick={() => setIsPermModalOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSavePermissions}
                isLoading={isSavingPerms}
                disabled={permsState !== 'ready'}
                leftIcon={<ShieldCheck size={16} aria-hidden="true" />}
              >
                Enregistrer les droits
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lot 9 bis (R59) : motif de la suspension ou de la réactivation, repris dans l'avis au titulaire */}
      <ReasonDialog
        isOpen={statusTarget !== null}
        onClose={() => {
          if (!isChangingStatus) setStatusTarget(null);
        }}
        onConfirm={(reason) => {
          if (statusTarget) void handleToggleStatus(statusTarget, reason);
        }}
        title={statusTarget?.status === 'SUSPENDU' ? 'Réactiver le compte' : 'Suspendre le compte'}
        description={statusTarget
          ? statusTarget.status === 'SUSPENDU'
            ? `${statusTarget.first_name} ${statusTarget.last_name} pourra de nouveau se connecter. ${noticesText('account_reactivate')}`
            : `${statusTarget.first_name} ${statusTarget.last_name} ne pourra plus se connecter : ses sessions sont fermées. Ses billets payés restent valables à l’entrée. ${noticesText('account_suspend')}`
          : undefined}
        label={statusTarget?.status === 'SUSPENDU' ? 'Motif de la réactivation' : 'Motif de la suspension'}
        hint={statusTarget?.status === 'SUSPENDU'
          ? 'Au moins 3 caractères. Gardé au journal ; la personne ne le voit pas.'
          : 'Au moins 3 caractères. Envoyé à la personne (le SMS n’en garde que le début) et gardé au journal.'}
        confirmLabel={statusTarget?.status === 'SUSPENDU' ? 'Réactiver le compte' : 'Suspendre le compte'}
        variant={statusTarget?.status === 'SUSPENDU' ? 'primary' : 'danger'}
        isLoading={isChangingStatus}
        error={statusError ?? undefined}
        maxLength={500}
      />

      {/* ConfirmDialog Anonymisation RGPD */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title={userToDelete ? `Supprimer définitivement ${userToDelete.first_name} ${userToDelete.last_name} ?` : 'Supprimer définitivement ce compte ?'}
        message="Nom, téléphone et email sont effacés pour toujours ; ce compte ne pourra plus jamais se connecter. Ses paiements et ses billets restent dans l’historique. La personne n’est pas prévenue. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        isLoading={isDeleting}
      />
    </div>
  );
}

