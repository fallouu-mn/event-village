'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Sparkles, Search, RefreshCw, Clock, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatInteger, formatPercent } from '@/lib/format';
import { roleLabel } from '@/lib/labels/account';
import { isDeliverableEmail } from '@/lib/notifications/channels';

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
  const [listError, setListError] = useState<string | null>(null);
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

  // Comptes lus par GET /api/admin/users ; un refus ou une panne est dit à l'écran (design 1c : aucun repli silencieux).
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/users?referralStatus=${filterStatus}&search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json().catch(() => null) as { users?: unknown; error?: unknown } | null;
      if (!res.ok || !Array.isArray(data?.users)) {
        console.error('[AdminReferral] comptes non lus :', res.status);
        setUsersList([]);
        setListError(typeof data?.error === 'string' && data.error.trim() ? data.error : 'Impossible de charger les comptes pour le moment. Réessayez.');
        return;
      }
      setUsersList(data.users as RealUserRow[]);
    } catch (err) {
      console.error('[AdminReferral] Erreur chargement utilisateurs:', err);
      setUsersList([]);
      setListError('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
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

      // « Annuler » : la même bascule, relancée sur la fiche à jour, remet le statut d'avant.
      toast.undoable(
        newReferralStatus === 'AMBASSADEUR'
          ? `${user.first_name} ${user.last_name} est maintenant ambassadeur.`
          : `${user.first_name} ${user.last_name} n’est plus ambassadeur.`,
        () => void handleToggleAmbassador({ ...user, referral_status: newReferralStatus })
      );
      await fetchUsers();
    } catch (err: unknown) {
      // Message de l'API dit tel quel ; une exception du navigateur (réseau, réponse illisible) devient une phrase simple.
      const msg = err instanceof Error && !(err instanceof TypeError) && !(err instanceof SyntaxError)
        ? err.message
        : 'La mise à jour a échoué. Vérifiez votre connexion, puis réessayez.';
      toast.error(msg, { onRetry: () => void handleToggleAmbassador(user) });
    } finally {
      setIsUpdating(null);
    }
  };

  const ambassadorsCount = usersList.filter((u) => u.referral_status === 'AMBASSADEUR').length;
  const standardCount = usersList.filter((u) => u.referral_status === 'STANDARD').length;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader
        title="Parrainage et ambassadeurs"
        description="Taux et durée du parrainage, et comptes nommés ambassadeurs."
        back={{ href: '/admin/dashboard', label: 'Accueil de l’administration' }}
        actions={(
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchUsers()}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
          >
            Actualiser
          </Button>
        )}
      />

      {/* Grille du parrainage : comptes lus par /api/admin/users, taux et durées par /api/admin/referral/config (R67) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Comptes affichés"
          value={formatInteger(usersList.length)}
          hint={`${formatInteger(standardCount)} sans statut d’ambassadeur`}
          icon={<Users size={18} />}
          loading={isLoading}
        />
        <KpiCard
          label="Ambassadeurs"
          value={formatInteger(ambassadorsCount)}
          tone="brand"
          icon={<Sparkles size={18} />}
          loading={isLoading || config.status === 'loading'}
          hint={config.status === 'ready'
            ? (config.ambassador
              ? `Taux ambassadeur : ${rate(config.ambassador.rate_n1)} sur les filleuls directs, ${rate(config.ambassador.rate_n2)} sur les filleuls de ses filleuls`
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

      {/* Comptes et statut d'ambassadeur */}
      <section aria-labelledby="parrainage-comptes" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="parrainage-comptes" className="text-xl font-bold text-foreground-strong">Comptes</h2>
          <p className="text-sm text-muted-foreground">
            Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls.
          </p>
        </div>

        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="relative w-full md:max-w-md">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              aria-label="Rechercher un compte"
              placeholder="Rechercher par nom, email ou téléphone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-base text-foreground-strong placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
            <FilterChip pressed={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')}>Tous</FilterChip>
            <FilterChip pressed={filterStatus === 'AMBASSADEUR'} onClick={() => setFilterStatus('AMBASSADEUR')}>Ambassadeurs</FilterChip>
            <FilterChip pressed={filterStatus === 'STANDARD'} onClick={() => setFilterStatus('STANDARD')}>Sans statut d’ambassadeur</FilterChip>
          </div>
        </Card>

        {isLoading && usersList.length === 0 ? (
          <div role="status" aria-label="Chargement des comptes" className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : listError ? (
          <ErrorState title="Comptes indisponibles" description={listError} onRetry={() => void fetchUsers()} isRetrying={isLoading} />
        ) : usersList.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="Aucun compte" description="Aucun compte ne correspond à cette recherche." />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Comptes du parrainage" aria-busy={isLoading || undefined}>
            {usersList.map((user) => {
              const isAmbassador = user.referral_status === 'AMBASSADEUR';
              const fullName = `${user.first_name} ${user.last_name}`.trim();

              return (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-base font-semibold text-foreground-strong">{fullName || 'Nom non renseigné'}</p>
                      <Badge variant="default" size="sm">{roleLabel(user.role)}</Badge>
                      {isAmbassador
                        ? <Badge variant="brand" size="sm">Ambassadeur</Badge>
                        : <Badge variant="neutral" size="sm">Parrainage standard</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                        <Phone size={16} className="flex-shrink-0" aria-hidden="true" />
                        <span className="sr-only">Téléphone : </span>
                        <span className="tabular-nums">{user.phone || 'Non renseigné'}</span>
                      </span>
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                        <Mail size={16} className="flex-shrink-0" aria-hidden="true" />
                        <span className="sr-only">Email : </span>
                        {/* Lot 9 quater (A4) : une adresse technique n'est jamais affichée */}
                        <span className="min-w-0 break-all">{isDeliverableEmail(user.email) ? user.email : 'Non renseigné'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">
                    <Button
                      variant={isAmbassador ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => void handleToggleAmbassador(user)}
                      isLoading={isUpdating === user.id}
                      leftIcon={isAmbassador ? undefined : <Sparkles size={16} aria-hidden="true" />}
                      className={isAmbassador ? 'text-danger-text hover:bg-danger-soft' : undefined}
                    >
                      {isAmbassador ? 'Retirer le statut d’ambassadeur' : 'Nommer ambassadeur'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
