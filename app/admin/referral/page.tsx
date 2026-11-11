'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Users,
  Sparkles,
  Search,
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
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatInteger, formatPercent } from '@/lib/format';

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

/** Ligne active de referral_config, servie par GET /api/admin/referral/config (R67). */
interface ReferralConfigRow {
  sponsor_status: string;
  referral_type: string;
  rate_n1: number;
  rate_n2: number;
  duration_months: number;
}

type ConfigState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; standard: ReferralConfigRow | null; ambassador: ReferralConfigRow | null };

/** Taux en points de pourcentage (7 → « 7 % »). */
function rate(points: number): string {
  return formatPercent(points / 100, 2);
}

/** Durée en mois (« 12 mois »). */
function months(n: number): string {
  return `${formatInteger(n)} mois`;
}

/**
 * Lot 9 bis, tâche 41 (R67 ; contrat 5.41, D-txt E.41) : les cartes « Taux ambassadeur » et « Durée du parrainage »
 * lisent la grille en base (lignes client vers client ; les lignes prestataire ne sont pas affichées) au lieu de
 * valeurs écrites dans la page ; lecture en échec : message et « Réessayer », jamais une valeur de repli.
 */
export default function AdminReferralAmbassadorsPage() {
  const toast = useToast();
  const [usersList, setUsersList] = useState<RealUserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'STANDARD' | 'AMBASSADEUR'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigState>({ status: 'loading' });

  const fetchConfig = useCallback(async () => {
    setConfig({ status: 'loading' });
    try {
      const res = await fetch('/api/admin/referral/config', { cache: 'no-store' });
      const data = await res.json().catch(() => null) as { configs?: ReferralConfigRow[]; error?: string } | null;
      if (!res.ok || !Array.isArray(data?.configs)) {
        console.error('[AdminReferral] configuration du parrainage :', res.status, data?.error ?? '');
        setConfig({ status: 'error', message: typeof data?.error === 'string' && data.error ? data.error : 'Impossible de charger la configuration du parrainage.' });
        return;
      }
      const pick = (sponsor: string) => data.configs?.find((r) => r.sponsor_status === sponsor && r.referral_type === 'CLIENT_TO_CLIENT') ?? null;
      setConfig({ status: 'ready', standard: pick('STANDARD'), ambassador: pick('AMBASSADEUR') });
    } catch (err) {
      console.error('[AdminReferral] configuration du parrainage : réseau', err);
      setConfig({ status: 'error', message: 'Impossible de charger la configuration du parrainage. Vérifiez votre connexion.' });
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

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

      toast.success(
        newReferralStatus === 'AMBASSADEUR'
          ? `Le statut Ambassadeur a bien été attribué à ${user.first_name} ${user.last_name}.`
          : `Le statut Ambassadeur a été retiré pour ${user.first_name} ${user.last_name}.`
      );
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour.';
      toast.error(msg);
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">
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

      {/* Grille du parrainage : comptes lus par /api/admin/users, taux et durées par /api/admin/referral/config (R67) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Utilisateurs"
          value={formatInteger(usersList.length)}
          hint={`${formatInteger(standardCount)} compte(s) standard`}
          icon={<Users size={18} />}
          loading={isLoading}
        />
        <KpiCard
          label="Ambassadeurs actifs"
          value={formatInteger(ambassadorsCount)}
          tone="brand"
          icon={<Sparkles size={18} />}
          loading={isLoading || config.status === 'loading'}
          hint={config.status === 'ready'
            ? (config.ambassador
              ? `Taux ambassadeur : N1 ${rate(config.ambassador.rate_n1)}, N2 ${rate(config.ambassador.rate_n2)}`
              : 'Taux ambassadeur non configuré')
            : 'Taux ambassadeur indisponible'}
        />
        <KpiCard
          label="Durée du parrainage"
          icon={<Clock size={18} />}
          loading={config.status === 'loading'}
          value={config.status === 'ready' && config.standard ? months(config.standard.duration_months) : 'Indisponible'}
          hint={config.status === 'ready'
            ? `${config.standard ? 'Compte standard' : 'Compte standard : non configuré'} ; ${config.ambassador ? `${months(config.ambassador.duration_months)} pour un ambassadeur` : 'ambassadeur : non configuré'}`
            : 'Durée non lue'}
        />
      </div>

      {config.status === 'error' && (
        <StatusBanner
          tone="danger"
          announce="alert"
          title="Taux et durées du parrainage indisponibles"
          action={<Button variant="secondary" onClick={() => void fetchConfig()} leftIcon={<RefreshCw size={16} />}>Réessayer</Button>}
        >
          {config.message}
        </StatusBanner>
      )}

      {/* Lot 8, A1 (contrat 13.4, L86) : les taux et la durée ne s'enregistrent nulle part, l'écran ne propose plus de les saisir. */}
      <StatusBanner tone="neutral" title="La personnalisation des taux n’est pas disponible pour le moment." />

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
                className="pl-8 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#FF5722]"
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
                  filterStatus === 'AMBASSADEUR' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'
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
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722] mb-2" />
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
                      onClick={() => handleToggleAmbassador(user)}
                      disabled={isUpdating === user.id}
                      className={`text-xs ${
                        isAmbassador
                          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : 'text-[#FF5722] bg-orange-50 dark:bg-orange-950/30 hover:bg-[#FF5722] hover:text-white'
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
    </div>
  );
}
