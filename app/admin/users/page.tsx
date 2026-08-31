'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Lock,
  Phone,
  Mail,
  Sliders,
  XCircle,
  CheckCircle,
  Key,
  Eye,
  EyeOff,
  User,
  QrCode,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { ADMIN_PERMISSIONS } from '@/lib/admin/admin-auth';

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'PARTENAIRE' | 'CONTROLEUR' | 'CLIENT';
  status: 'ACTIF' | 'EN_ATTENTE' | 'SUSPENDU';
  referral_status: 'STANDARD' | 'AMBASSADEUR';
  created_at: string;
}

export default function AdminUsersManagementPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal Création Utilisateur / Admin
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users?role=${roleFilter}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('[AdminUsers] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création.');

      toast.success(`Le compte ${newRole} de ${newFirstName} ${newLastName} a été créé avec succès.`);
      setIsCreateModalOpen(false);
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setNewPassword('');
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la création.';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Suspension ou Réactivation
  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error('Erreur lors du changement de statut.');

      toast.success(
        newStatus === 'ACTIF'
          ? `Le compte de ${user.first_name} ${user.last_name} a été réactivé avec succès.`
          : `Le compte de ${user.first_name} ${user.last_name} a été suspendu.`
      );
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l\'opération.';
      toast.error(msg);
    }
  };

  // Ouverture de la modal des permissions
  const handleOpenPermissions = async (adminUser: UserItem) => {
    setSelectedAdmin(adminUser);
    setIsPermModalOpen(true);

    try {
      const res = await fetch(`/api/admin/permissions?adminId=${adminUser.id}`);
      const data = await res.json();
      if (res.ok) {
        setAdminPermissions(data.assignedPermissions || []);
      }
    } catch {
      setAdminPermissions([]);
    }
  };

  // Sauvegarde des permissions
  const handleSavePermissions = async () => {
    if (!selectedAdmin) return;
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour des permissions.');

      toast.success(`Les permissions de l'administrateur ${selectedAdmin.first_name} ${selectedAdmin.last_name} ont été enregistrées.`);
      setIsPermModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l\'enregistrement des permissions.';
      toast.error(msg);
    } finally {
      setIsSavingPerms(false);
    }
  };

  const togglePermissionItem = (perm: string) => {
    if (adminPermissions.includes(perm)) {
      setAdminPermissions(adminPermissions.filter((p) => p !== perm));
    } else {
      setAdminPermissions([...adminPermissions, perm]);
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
      const res = await fetch(`/api/admin/users?userId=${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');

      toast.success(`Le compte de ${userToDelete.first_name} ${userToDelete.last_name} a été définitivement supprimé.`);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la suppression.';
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
            className="w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">
              Console Superadmin HQ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion des Utilisateurs & Permissions RBAC
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

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#FF5722] text-white"
          >
            <UserPlus size={15} />
            <span>Créer un Compte / Admin</span>
          </Button>
        </div>
      </div>

      {/* Filtres & Recherche */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#FF5722]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-800/80">
            {['ALL', 'SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR', 'CLIENT'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  roleFilter === role
                    ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {role === 'ALL' ? 'Tous' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Liste Réelle des Utilisateurs */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722] mb-2" />
            <p className="text-xs">Chargement des utilisateurs...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <Users size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isSuper = user.role === 'SUPERADMIN';
              const isAdmin = user.role === 'ADMIN';
              const isSuspended = user.status === 'SUSPENDU';

              return (
                <div
                  key={user.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </h4>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          isSuper
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                            : isAdmin
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                            : user.role === 'PARTENAIRE'
                            ? 'bg-orange-100 text-[#FF5722] dark:bg-orange-950/40'
                            : 'bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {user.role}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isSuspended
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {user.status}
                      </span>

                      {user.referral_status === 'AMBASSADEUR' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          ⭐ Ambassadeur
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
                        <span>{user.email || 'Non renseigné'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Bouton Permissions Granulaires pour Admin */}
                    {isAdmin && (
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

                    {/* Suspension / Réactivation */}
                    {!isSuper && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleStatus(user)}
                          className={`text-xs ${
                            isSuspended
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          }`}
                        >
                          {isSuspended ? 'Réactiver' : 'Suspendre'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          title="Supprimer définitivement ce compte"
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
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
        title="Créer un Compte Métier"
        subtitle="Attribution de rôle sécurisée et synchronisation instantanée"
        icon={<UserPlus size={18} />}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
          {/* Prénom et Nom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Prénom <span className="text-[#FF5722]">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex : Moussa"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 hover:bg-slate-50 focus:bg-white dark:bg-zinc-900/80 dark:focus:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-semibold focus:outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/15 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Nom <span className="text-[#FF5722]">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex : Diop"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 hover:bg-slate-50 focus:bg-white dark:bg-zinc-900/80 dark:focus:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-semibold focus:outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Numéro de Téléphone (Sénégal) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Numéro de Téléphone (Sénégal) <span className="text-[#FF5722]">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-zinc-800 text-[11px] font-black text-slate-700 dark:text-zinc-300 border border-slate-300/60 dark:border-zinc-700 pointer-events-none">
                <span>🇸🇳</span>
                <span>+221</span>
              </div>
              <input
                type="tel"
                required
                placeholder="77 123 45 67"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-10 pl-22 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 hover:bg-slate-50 focus:bg-white dark:bg-zinc-900/80 dark:focus:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-mono font-bold focus:outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/15 transition-all"
              />
            </div>
          </div>

          {/* Email & Mot de Passe sur 2 colonnes pour économiser de la hauteur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Email (Optionnel)
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="email"
                  placeholder="contact@domaine.sn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 hover:bg-slate-50 focus:bg-white dark:bg-zinc-900/80 dark:focus:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-semibold focus:outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Mot de passe temporaire <span className="text-[#FF5722]">*</span>
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 hover:bg-slate-50 focus:bg-white dark:bg-zinc-900/80 dark:focus:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-mono font-bold focus:outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white transition-colors"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Rôle Attribué (Sélecteur Compact 2x2) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Rôle Attribué <span className="text-[#FF5722]">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* CONTROLEUR */}
              <button
                type="button"
                onClick={() => setNewRole('CONTROLEUR')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  newRole === 'CONTROLEUR'
                    ? 'border-[#FF5722] bg-orange-50/80 dark:bg-orange-950/30 text-slate-900 dark:text-white shadow-xs ring-1 ring-[#FF5722]'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  newRole === 'CONTROLEUR' ? 'bg-[#FF5722] text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                }`}>
                  <QrCode size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 dark:text-white">CONTRÔLEUR</span>
                    {newRole === 'CONTROLEUR' && <CheckCircle2 size={13} className="text-[#FF5722]" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                    Scanner de billets sur site (/scan)
                  </p>
                </div>
              </button>

              {/* ADMIN */}
              <button
                type="button"
                onClick={() => setNewRole('ADMIN')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  newRole === 'ADMIN'
                    ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-white shadow-xs ring-1 ring-purple-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  newRole === 'ADMIN' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                }`}>
                  <Key size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 dark:text-white">ADMINISTRATEUR</span>
                    {newRole === 'ADMIN' && <CheckCircle2 size={13} className="text-purple-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                    Supervision avec permissions
                  </p>
                </div>
              </button>

              {/* SUPERADMIN */}
              <button
                type="button"
                onClick={() => setNewRole('SUPERADMIN')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  newRole === 'SUPERADMIN'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 text-slate-900 dark:text-white shadow-xs ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  newRole === 'SUPERADMIN' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                }`}>
                  <ShieldCheck size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 dark:text-white">SUPERADMIN</span>
                    {newRole === 'SUPERADMIN' && <CheckCircle2 size={13} className="text-amber-500" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                    Accès maître absolu HQ
                  </p>
                </div>
              </button>

              {/* CLIENT */}
              <button
                type="button"
                onClick={() => setNewRole('CLIENT')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  newRole === 'CLIENT'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-slate-900 dark:text-white shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  newRole === 'CLIENT' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                }`}>
                  <User size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 dark:text-white">CLIENT STANDARD</span>
                    {newRole === 'CLIENT' && <CheckCircle2 size={13} className="text-emerald-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                    Utilisateur public standard
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Note Contextuelle Rapide */}
          <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 flex items-center gap-2 text-[11px] text-slate-700 dark:text-zinc-300">
            <Info size={14} className="text-[#FF5722] flex-shrink-0" />
            <p className="leading-tight">
              {newRole === 'CONTROLEUR' && (
                <span><strong>Routage :</strong> Redirigé automatiquement vers le scanner de billets (<code>/scan</code>) dès sa connexion.</span>
              )}
              {newRole === 'ADMIN' && (
                <span><strong>Gestion :</strong> Accès console administration avec attribution de permissions personnalisées.</span>
              )}
              {newRole === 'SUPERADMIN' && (
                <span><strong>Accès Maître :</strong> Tous les privilèges administratifs et financiers de la plateforme.</span>
              )}
              {newRole === 'CLIENT' && (
                <span><strong>Catalogue :</strong> Accès aux réservations d&apos;événements et au portefeuille de parrainage.</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-xl px-4 h-10 font-bold text-xs"
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isCreating}
              leftIcon={<UserPlus size={15} />}
              className="rounded-xl px-5 h-10 font-black text-xs bg-[#FF5722] hover:bg-[#E8551F] text-white shadow-md shadow-[#FF5722]/25"
            >
              Créer le compte {newRole}
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
          title="Permissions Granulaires"
          subtitle={`Attribution des droits d'administration pour ${selectedAdmin.first_name} ${selectedAdmin.last_name}`}
          icon={<Key size={20} />}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-500 dark:text-zinc-400">
              Sélectionnez les permissions spécifiques que cet administrateur est autorisé à exercer au quotidien.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1">
              {ADMIN_PERMISSIONS.map((perm) => {
                const isChecked = adminPermissions.includes(perm);
                return (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => togglePermissionItem(perm)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isChecked
                        ? 'border-[#FF5722] bg-orange-50/80 dark:bg-orange-950/30 text-slate-900 dark:text-white font-bold ring-1 ring-[#FF5722]'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-bold">{perm}</span>
                    <span
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                        isChecked ? 'bg-[#FF5722] text-white shadow-xs' : 'border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800'
                      }`}
                    >
                      {isChecked ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setIsPermModalOpen(false)}
                className="rounded-xl px-5 font-bold"
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSavePermissions}
                isLoading={isSavingPerms}
                leftIcon={<ShieldCheck size={16} />}
                className="rounded-xl px-6 font-black bg-[#FF5722] hover:bg-[#E8551F] text-white shadow-md shadow-[#FF5722]/25"
              >
                Enregistrer les permissions
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ConfirmDialog Suppression */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Supprimer ce compte ?"
        message={userToDelete
          ? `Vous allez supprimer définitivement le compte de ${userToDelete.first_name} ${userToDelete.last_name} (${userToDelete.phone}). Cette action est irréversible.`
          : ''}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        isLoading={isDeleting}
      />
    </div>
  );
}
