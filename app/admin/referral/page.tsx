'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Users,
  Sparkles,
  Search,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Clock,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export interface RealUserRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: string;
  status: string;
  referral_status: 'STANDARD' | 'AMBASSADEUR';
  created_at: string;
  updated_at: string;
}

export default function AdminReferralAmbassadorsPage() {
  const [usersList, setUsersList] = useState<RealUserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'STANDARD' | 'AMBASSADEUR'>('ALL');
  const [selectedUser, setSelectedUser] = useState<RealUserRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Chargement des utilisateurs réels depuis Supabase
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users?referralStatus=${filterStatus}&search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setUsersList(data.users);
      }
    } catch (err) {
      console.error('[AdminReferral] Erreur chargement utilisateurs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Bascule du statut Ambassadeur (STANDARD <-> AMBASSADEUR)
  const handleToggleAmbassador = async (user: RealUserRow) => {
    setIsUpdating(user.id);
    setFeedback(null);

    const newReferralStatus = user.referral_status === 'AMBASSADEUR' ? 'STANDARD' : 'AMBASSADEUR';

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          referralStatus: newReferralStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');

      setFeedback({
        type: 'success',
        text: `Statut Ambassadeur de ${user.first_name} ${user.last_name} mis à jour : ${newReferralStatus}`,
      });
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setIsUpdating(null);
    }
  };

  const ambassadorsCount = usersList.filter((u) => u.referral_status === 'AMBASSADEUR').length;
  const standardCount = usersList.filter((u) => u.referral_status === 'STANDARD').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF6B35]">
              Console Superadmin HQ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion des Ambassadeurs & Parrainage
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchUsers()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Grille des Règles Officielles CDC V3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Utilisateurs Réels</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{usersList.length}</h3>
          <span className="text-xs text-slate-500">{standardCount} compte(s) standard</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase text-[#FF6B35]">Ambassadeurs Actifs</span>
          <h3 className="text-2xl font-black text-[#FF6B35]">{ambassadorsCount}</h3>
          <span className="text-xs text-emerald-600 font-bold">Taux VIP CDC V3 : N1 7% • N2 2%</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-400">Durée de Validité CDC</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">24 Mois</h3>
          <span className="text-xs text-slate-500">Pour tout filleul enregistré</span>
        </div>
      </div>

      {/* Tableau des Utilisateurs & Attribution */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Répertoire des Utilisateurs
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Attribuez le statut Ambassadeur pour débloquer les commissions N1/N2 majorées.
            </p>
          </div>

          {/* Filtres & Recherche */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#FF6B35]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === 'ALL' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-slate-500'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('AMBASSADEUR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === 'AMBASSADEUR' ? 'bg-[#FF6B35] text-white' : 'text-slate-500'
                }`}
              >
                Ambassadeurs
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('STANDARD')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === 'STANDARD' ? 'bg-zinc-700 text-white' : 'text-slate-500'
                }`}
              >
                Standard
              </button>
            </div>
          </div>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF6B35] mb-2" />
            <p className="text-xs">Chargement des utilisateurs réels...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <Users size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {usersList.map((user) => {
              const isAmbassador = user.referral_status === 'AMBASSADEUR';

              return (
                <div
                  key={user.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {user.role}
                      </span>
                      {isAmbassador ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400">
                          ⭐ Ambassadeur VIP
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                          Parrainage Standard
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                      className="text-xs"
                    >
                      <Sliders size={13} className="mr-1" />
                      Taux & Durée
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleAmbassador(user)}
                      disabled={isUpdating === user.id}
                      className={`text-xs ${
                        isAmbassador
                          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : 'text-[#FF6B35] bg-orange-50 dark:bg-orange-950/30 hover:bg-[#FF6B35] hover:text-white'
                      }`}
                    >
                      {isAmbassador ? 'Rétrograder' : 'Promouvoir Ambassadeur ⭐'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Personnalisation Taux & Durée (§132/§98) */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`Personnalisation Parrainage : ${selectedUser.first_name} ${selectedUser.last_name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
              <strong>Règle de Non-Rétroactivité (CDC V3) :</strong> Toute modification de taux ou de durée s&apos;appliquera exclusivement aux futures transactions. Les commissions passées restent figées.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">Taux N1 Client (%)</label>
                <input
                  type="number"
                  defaultValue={selectedUser.referral_status === 'AMBASSADEUR' ? 7.0 : 4.0}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">Taux N2 Client (%)</label>
                <input
                  type="number"
                  defaultValue={selectedUser.referral_status === 'AMBASSADEUR' ? 2.0 : 1.0}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">Taux N1 Prestataire (%)</label>
                <input
                  type="number"
                  defaultValue={selectedUser.referral_status === 'AMBASSADEUR' ? 7.0 : 4.0}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">Taux N2 Prestataire (%)</label>
                <input
                  type="number"
                  defaultValue={selectedUser.referral_status === 'AMBASSADEUR' ? 2.0 : 1.0}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">Durée de validité (Mois)</label>
              <select
                defaultValue="24"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
              >
                <option value="12">12 Mois</option>
                <option value="24">24 Mois (Standard CDC V3)</option>
                <option value="36">36 Mois (VIP Partenaire)</option>
                <option value="999">À vie</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Fermer
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFeedback({ type: 'success', text: `Taux personnalisés enregistrés pour ${selectedUser.first_name} ${selectedUser.last_name}.` });
                  setSelectedUser(null);
                }}
                className="bg-[#FF6B35] text-white"
              >
                Enregistrer la personnalisation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
