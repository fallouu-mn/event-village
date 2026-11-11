'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MapPin,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Tabs, TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { PartnerStatusDialog, type PartnerStatusResult, type PartnerStatusTarget } from '@/components/admin/PartnerStatusDialog';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { toastMessages } from '@/lib/messages/toast-messages';
import { formatDateTime, formatFcfa, formatInteger, toDakarDateTimeLocal } from '@/lib/format';

/**
 * Lot 5 (tâche 5.13, contrat O5 ; système de design, contrat Q) — tableau de bord de l'administration.
 *  - Indicateurs et compteurs lus sur GET /api/admin/metrics (calculés par le serveur) ; événements à
 *    valider lus sur GET /api/admin/events (compteurs du serveur).
 *  - File de validation des partenaires (GET /api/admin/partners), validation confirmée, refus motivé.
 *  - En direct : une inscription de partenaire ou une soumission d'événement (admin_signals) recharge
 *    les compteurs et la file, sans recharger la page.
 * Lot 9 bis (R6, R55, R51 ; contrat 5.12, 5.15) : la fiche « Dossier du partenaire » propose « Valider » et « Refuser »
 * pour un dossier EN_ATTENTE seulement (partners.validate), « Suspendre » pour un partenaire VALIDE
 * (partners.suspend) et « Réactiver » pour un SUSPENDU (partners.validate), tous deux avec un motif
 * (PartnerStatusDialog). Lien profond `?partenaires=ALL&dossier=<partnerId>` (depuis /admin/users) : la fiche s'ouvre.
 */

interface PartnerActivity {
  activity_type: string;
  is_active: boolean;
}

interface PartnerUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

interface PartnerItem {
  id: string;
  user_id: string;
  company_name: string;
  commercial_name?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  id_card_url?: string | null;
  business_doc_url?: string | null;
  is_verified: boolean;
  /** Lot 9 bis (R53, R90, R54) : numéro vérifié par le code SMS, NINEA et RCCM saisis, complément du dossier. */
  phone_verified?: boolean | null;
  ninea?: string | null;
  rccm?: string | null;
  resubmitted_at?: string | null;
  rejection_reason?: string | null;
  status: string;
  created_at: string;
  users?: PartnerUser | null;
  partner_activities?: PartnerActivity[] | null;
}

interface AdminKPIs {
  totalVolume: number;
  netRevenue: number;
  validatedPartners: number;
  pendingPartners: number;
  rejectedPartners: number;
  totalPartners: number;
  totalUsers: number;
  clientsCount: number;
  activeAmbassadors: number;
}

type Phase = 'loading' | 'ready' | 'error';

const ACTIVITY_LABELS: Record<string, string> = {
  RESTAURANT: 'Restaurant',
  TRAITEUR: 'Traiteur',
  SALLE: 'Salle de fête',
  ORGANISATEUR: 'Organisateur',
  PRESTATAIRE: 'Prestataire',
  PATISSERIE: 'Pâtisserie',
  ETABLISSEMENT_ALIMENTAIRE: 'Alimentaire',
  AUTRE: 'Autre',
};

const PARTNER_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  VALIDE: { label: 'Validé', variant: 'success' },
  REJETE: { label: 'Refusé', variant: 'danger' },
  SUSPENDU: { label: 'Suspendu', variant: 'danger' },
};

const PARTNER_TABS = ['EN_ATTENTE', 'VALIDE', 'REJETE', 'ALL'] as const;
type PartnerTab = (typeof PARTNER_TABS)[number];
const PARTNERS_ID_PREFIX = 'admin-partenaires';

function partnerStatus(status: string): { label: string; variant: BadgeVariant } {
  return PARTNER_STATUS[status] ?? { label: 'Statut inconnu', variant: 'neutral' };
}

function readError(body: unknown): string | null {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return null;
}

function managerName(p: PartnerItem): string {
  const name = p.users ? `${p.users.first_name ?? ''} ${p.users.last_name ?? ''}`.trim() : '';
  return name || 'Non renseigné';
}

function activitiesOf(p: PartnerItem): string[] {
  return (p.partner_activities ?? []).map((a) => ACTIVITY_LABELS[a.activity_type] ?? 'Autre');
}

function PartnersSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des partenaires" className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  );
}

export default function AdminDashboardPage() {
  const toast = useToast();
  const { hasRole, hasPermission } = useAuth();
  // Lot 9 bis (R51, B34) : « Valider » et « Refuser » seulement avec partners.validate (la route décide toujours).
  const canValidate = hasPermission('partners.validate');
  const canSuspend = hasPermission('partners.suspend');

  const [kpis, setKpis] = useState<AdminKPIs | null>(null);
  const [metricsPhase, setMetricsPhase] = useState<Phase>('loading');
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<number | null>(null);
  const [eventsAccess, setEventsAccess] = useState<'ok' | 'forbidden' | 'error'>('ok');

  const [activeTab, setActiveTab] = useTabParam<PartnerTab>(PARTNER_TABS, 'EN_ATTENTE', 'partenaires');
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [partnersPhase, setPartnersPhase] = useState<Phase>('loading');
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [selectedPartner, setSelectedPartner] = useState<PartnerItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [partnerToValidate, setPartnerToValidate] = useState<PartnerItem | null>(null);
  const [partnerToReject, setPartnerToReject] = useState<PartnerItem | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<{ partner: PartnerItem; target: PartnerStatusTarget } | null>(null);

  const partnersSeq = useRef(0);
  /** Lien profond ?dossier= : lu une fois, puis la fiche s'ouvre quand la liste est chargée. */
  const deepLinkRef = useRef<string | null | undefined>(undefined);

  // Visionneuse sécurisée de documents KYC
  // Lot 1C.2 : URL demandée par dossier et type de pièce ; le chemin est lu côté serveur.
  const handleViewDocument = async (partnerId: string, docType: 'id_card' | 'business_doc', filePath: string | null | undefined, docName: string) => {
    if (!filePath) return;
    setLoadingDoc(docType);
    try {
      const res = await fetch(`/api/partner/documents/signed-url?partnerId=${encodeURIComponent(partnerId)}&docType=${docType}`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || `Impossible de générer le lien de consultation (${docName}).`);
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(`[admin/dashboard] ouverture du document « ${docName} » en échec`, err);
      toast.error(toastMessages.admin.docLoadError);
    } finally {
      setLoadingDoc(null);
    }
  };

  const loadMetrics = useCallback(async (silent: boolean) => {
    if (!silent) setMetricsPhase('loading');
    try {
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.kpis) throw new Error(readError(body) ?? 'Indicateurs indisponibles');
      setKpis(body.kpis as AdminKPIs);
      setConfigWarning(typeof body.configWarning === 'string' ? body.configWarning : null);
      setMetricsPhase('ready');
    } catch (err) {
      console.error('[admin/dashboard] indicateurs en échec', err);
      if (silent) toast.error(toastMessages.admin.loadError);
      else setMetricsPhase('error');
    }
  }, [toast]);

  const loadPendingEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/events?status=EN_ATTENTE&pageSize=1', { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (res.status === 403) {
        setEventsAccess('forbidden');
        return;
      }
      if (!res.ok || !body?.counts) throw new Error(readError(body) ?? 'Compteur indisponible');
      setPendingEvents(Number(body.counts.EN_ATTENTE ?? 0));
      setEventsAccess('ok');
    } catch (err) {
      console.error('[admin/dashboard] compteur des événements à valider en échec', err);
      setEventsAccess('error');
    }
  }, []);

  const loadPartners = useCallback(async (silent: boolean) => {
    const seq = ++partnersSeq.current;
    if (!silent) {
      setPartnersPhase('loading');
      setPartnersError(null);
    }
    try {
      const res = await fetch(`/api/admin/partners?status=${activeTab}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (seq !== partnersSeq.current) return;
      if (!res.ok || !Array.isArray(body?.partners)) {
        throw new Error(res.status === 403 ? 'Votre compte n’a pas l’autorisation de consulter les partenaires.' : 'Impossible de charger les partenaires pour le moment.');
      }
      setPartners(body.partners as PartnerItem[]);
      setPartnersPhase('ready');
    } catch (err) {
      if (seq !== partnersSeq.current) return;
      console.error('[admin/dashboard] liste des partenaires en échec', err);
      if (silent) {
        toast.error(toastMessages.admin.loadError);
        return;
      }
      setPartnersError(err instanceof Error && !/fetch|network/i.test(err.message) ? err.message : 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
      setPartnersPhase('error');
    }
  }, [activeTab, toast]);

  useEffect(() => {
    void loadMetrics(false);
    void loadPendingEvents();
  }, [loadMetrics, loadPendingEvents]);

  useEffect(() => {
    void loadPartners(false);
  }, [loadPartners]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMetrics(true), loadPendingEvents(), loadPartners(true)]);
  }, [loadMetrics, loadPendingEvents, loadPartners]);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'admin-tableau-de-bord',
    // Lot 6 (contrat C6) : seuls les signaux de la file du tableau de bord rechargent la page ; les
    // signaux de la boîte d'envoi (échecs, volume de SMS) relèvent de la page Notifications.
    subscriptions: [{ table: 'admin_signals', event: 'INSERT', filter: 'kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED)' }],
    onSignal: refreshAll,
  });

  const retryPartners = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await loadPartners(false);
    } finally {
      setIsRetrying(false);
    }
  };

  const updatePartnerStatus = async (partner: PartnerItem, payload: { status: string; reason?: string }): Promise<string | null> => {
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return readError(body) ?? 'La mise à jour du partenaire a échoué. Réessayez dans un instant.';
      return null;
    } catch (err) {
      console.error('[admin/dashboard] mise à jour du partenaire en échec', err);
      return 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.';
    }
  };

  const confirmValidate = async (): Promise<void> => {
    const partner = partnerToValidate;
    if (!partner) return;
    setIsActionLoading(true);
    const error = await updatePartnerStatus(partner, { status: 'VALIDE' });
    setIsActionLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(toastMessages.admin.partnerValidated(partner.company_name));
    setPartnerToValidate(null);
    setIsDetailsModalOpen(false);
    await refreshAll();
  };

  const confirmReject = async (reason: string): Promise<void> => {
    const partner = partnerToReject;
    if (!partner) return;
    setIsActionLoading(true);
    setRejectError(null);
    const error = await updatePartnerStatus(partner, { status: 'REJETE', reason });
    setIsActionLoading(false);
    if (error) {
      setRejectError(error);
      return;
    }
    toast.success(toastMessages.admin.partnerRejected(partner.company_name));
    setPartnerToReject(null);
    setIsDetailsModalOpen(false);
    await refreshAll();
  };

  const openDetails = (partner: PartnerItem): void => {
    setSelectedPartner(partner);
    setIsDetailsModalOpen(true);
  };

  const askValidate = (partner: PartnerItem): void => {
    setIsDetailsModalOpen(false);
    setPartnerToValidate(partner);
  };

  const askReject = (partner: PartnerItem): void => {
    setIsDetailsModalOpen(false);
    setRejectError(null);
    setPartnerToReject(partner);
  };

  const askStatusChange = (partner: PartnerItem, target: PartnerStatusTarget): void => {
    setIsDetailsModalOpen(false);
    setStatusChange({ partner, target });
  };

  const statusChanged = async (result: PartnerStatusResult): Promise<void> => {
    const name = statusChange?.partner.company_name ?? 'Le partenaire';
    setStatusChange(null);
    if (result.status === 'SUSPENDU') {
      toast.success(`${name} est suspendu. Événements suspendus avec le compte : ${formatInteger(result.eventsSuspended)}.`);
    } else {
      const left = result.eventsLeftSuspended > 0 ? ` Restés suspendus : ${formatInteger(result.eventsLeftSuspended)}.` : '';
      toast.success(`${name} est réactivé. Événements remis en ligne : ${formatInteger(result.eventsRestored)}.${left}`);
    }
    await refreshAll();
  };

  // Lien profond ?dossier=<partnerId> (R6) : la fiche s'ouvre une fois la liste chargée ; un identifiant inconnu est dit.
  useEffect(() => {
    if (deepLinkRef.current === undefined) {
      deepLinkRef.current = new URLSearchParams(window.location.search).get('dossier');
    }
    const wanted = deepLinkRef.current;
    if (!wanted || partnersPhase !== 'ready') return;
    deepLinkRef.current = null;
    const found = partners.find((p) => p.id === wanted);
    if (found) {
      setSelectedPartner(found);
      setIsDetailsModalOpen(true);
    } else {
      toast.error('Ce partenaire n’apparaît pas dans la liste affichée. Choisissez l’onglet « Tous » puis ouvrez son dossier.');
    }
  }, [partners, partnersPhase, toast]);

  const tabs: TabItem[] = useMemo(() => [
    { id: 'EN_ATTENTE', label: 'En attente', count: kpis?.pendingPartners },
    { id: 'VALIDE', label: 'Validés', count: kpis?.validatedPartners },
    { id: 'REJETE', label: 'Refusés', count: kpis?.rejectedPartners },
    { id: 'ALL', label: 'Tous', count: kpis?.totalPartners },
  ], [kpis]);

  const partnerActions = (partner: PartnerItem, full = false) => (
    <div className={full ? 'grid grid-cols-1 gap-2 sm:grid-cols-3' : 'flex flex-wrap justify-end gap-2'}>
      <Button variant="secondary" size="sm" leftIcon={<Eye size={16} />} onClick={() => openDetails(partner)}>
        Dossier
      </Button>
      {canValidate && partner.status === 'EN_ATTENTE' && (
        <Button variant="primary" size="sm" leftIcon={<CheckCircle2 size={16} />} onClick={() => askValidate(partner)} disabled={isActionLoading}>
          Valider
        </Button>
      )}
      {canValidate && partner.status === 'EN_ATTENTE' && (
        <Button variant="ghost" size="sm" leftIcon={<XCircle size={16} />} onClick={() => askReject(partner)} disabled={isActionLoading} className="text-danger-fg">
          Refuser
        </Button>
      )}
    </div>
  );

  const partnerColumns: DataColumn<PartnerItem>[] = [
    {
      key: 'company',
      header: 'Partenaire',
      render: (p) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold text-fg">{p.company_name}</span>
          {p.commercial_name && p.commercial_name !== p.company_name && <span className="text-sm text-fg-muted">{p.commercial_name}</span>}
          {activitiesOf(p).length > 0 && (
            <span className="flex flex-wrap gap-1">
              {activitiesOf(p).map((a, i) => <Badge key={`${a}-${i}`} variant="brand" size="sm">{a}</Badge>)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Responsable',
      render: (p) => (
        <div className="flex min-w-0 flex-col gap-0.5 text-sm">
          <span className="text-fg">{managerName(p)}</span>
          {(p.phone || p.users?.phone) && <span className="text-fg-muted">{p.phone || p.users?.phone}</span>}
          {p.city && <span className="text-fg-muted">{p.city}</span>}
        </div>
      ),
    },
    { key: 'state', header: 'Statut', render: (p) => <Badge variant={partnerStatus(p.status).variant} size="sm">{partnerStatus(p.status).label}</Badge> },
    {
      key: 'created',
      header: 'Inscrit le',
      render: (p) => <time dateTime={toDakarDateTimeLocal(p.created_at)} className="whitespace-nowrap text-sm tabular-nums text-fg-muted">{formatDateTime(p.created_at)}</time>,
    },
    { key: 'actions', header: 'Actions', align: 'right', render: (p) => partnerActions(p) },
  ];

  const renderPartnerCard = (p: PartnerItem) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-fg">{p.company_name}</p>
          <p className="text-sm text-fg-muted">{managerName(p)}{p.city ? ` · ${p.city}` : ''}</p>
        </div>
        <Badge variant={partnerStatus(p.status).variant} size="sm" className="flex-shrink-0">{partnerStatus(p.status).label}</Badge>
      </div>
      {activitiesOf(p).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activitiesOf(p).map((a, i) => <Badge key={`${a}-${i}`} variant="brand" size="sm">{a}</Badge>)}
        </div>
      )}
      <p className="text-sm text-fg-muted">
        Inscrit le <time dateTime={toDakarDateTimeLocal(p.created_at)} className="tabular-nums">{formatDateTime(p.created_at)}</time>
      </p>
      {partnerActions(p, true)}
    </div>
  );

  const pendingEventsValue = eventsAccess === 'ok' && pendingEvents !== null ? formatInteger(pendingEvents) : '—';
  const pendingEventsHint = eventsAccess === 'forbidden'
    ? 'Votre compte n’a pas accès à la modération des événements.'
    : eventsAccess === 'error'
      ? 'Compteur indisponible pour le moment.'
      : 'Soumis par les organisateurs, en attente de votre examen.';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tableau de bord"
        description="Dossiers à traiter et vue d’ensemble de la plateforme."
        actions={(
          <>
            <LiveIndicator status={liveStatus} />
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={16} />} onClick={() => void refreshAll()}>
              Actualiser
            </Button>
          </>
        )}
      />

      {configWarning && (
        <StatusBanner tone="warning" title="Configuration à compléter">
          {configWarning}
        </StatusBanner>
      )}

      <section aria-labelledby="a-traiter" className="flex flex-col gap-3">
        <h2 id="a-traiter" className="text-lg font-bold tracking-tight text-fg">À traiter</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <KpiCard
              label="Événements à valider"
              value={pendingEventsValue}
              hint={pendingEventsHint}
              tone="warning"
              icon={<CalendarClock size={18} />}
              loading={eventsAccess === 'ok' && pendingEvents === null}
              className="border-0 p-0 sm:p-0"
            />
            <LinkButton href="/admin/events" variant="primary" rightIcon={<ArrowRight size={16} />}>
              Ouvrir la file de validation
            </LinkButton>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <KpiCard
              label="Partenaires à valider"
              value={kpis ? formatInteger(kpis.pendingPartners) : '—'}
              hint="Inscriptions avec leurs pièces justificatives."
              tone="warning"
              icon={<Building2 size={18} />}
              loading={metricsPhase === 'loading' && !kpis}
              className="border-0 p-0 sm:p-0"
            />
            <LinkButton href="#partenaires" variant="secondary" rightIcon={<ArrowRight size={16} />}>
              Voir les candidatures
            </LinkButton>
          </div>
        </div>
      </section>

      <section aria-labelledby="indicateurs" className="flex flex-col gap-3">
        <h2 id="indicateurs" className="text-lg font-bold tracking-tight text-fg">Indicateurs</h2>
        {metricsPhase === 'error' && !kpis ? (
          <ErrorState
            title="Indicateurs indisponibles"
            description="Impossible de charger les indicateurs de la plateforme. Vérifiez votre connexion, puis réessayez."
            onRetry={() => void loadMetrics(false)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Volume des transactions"
              value={kpis ? formatFcfa(kpis.totalVolume) : '—'}
              hint="Paiements en ligne encaissés"
              icon={<TrendingUp size={18} />}
              tone="info"
              loading={!kpis}
            />
            <KpiCard
              label="Revenu net de la plateforme"
              value={kpis ? formatFcfa(kpis.netRevenue) : '—'}
              hint="Commissions et frais Event Village"
              icon={<DollarSign size={18} />}
              tone="brand"
              loading={!kpis}
            />
            <KpiCard
              label="Partenaires validés"
              value={kpis ? formatInteger(kpis.validatedPartners) : '—'}
              hint={kpis ? `sur ${formatInteger(kpis.totalPartners)} inscrits` : undefined}
              icon={<Building2 size={18} />}
              tone="success"
              loading={!kpis}
            />
            <KpiCard
              label="Utilisateurs inscrits"
              value={kpis ? formatInteger(kpis.totalUsers) : '—'}
              hint={kpis ? `${formatInteger(kpis.activeAmbassadors)} ambassadeur(s) actif(s)` : undefined}
              icon={<Users size={18} />}
              loading={!kpis}
            />
          </div>
        )}
      </section>

      <section id="partenaires" aria-labelledby="partenaires-titre" className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div>
          <h2 id="partenaires-titre" className="text-lg font-bold tracking-tight text-fg">Candidatures des partenaires</h2>
          <p className="mt-1 text-sm text-fg-muted">Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.</p>
        </div>

        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={(next) => {
            if ((PARTNER_TABS as readonly string[]).includes(next)) setActiveTab(next as PartnerTab);
          }}
          ariaLabel="Statut des candidatures"
          idPrefix={PARTNERS_ID_PREFIX}
        />

        <TabPanel idPrefix={PARTNERS_ID_PREFIX} tabIdValue={activeTab}>
          {partnersPhase === 'loading' && <PartnersSkeleton />}
          {partnersPhase === 'error' && (
            <ErrorState
              title="Candidatures indisponibles"
              description={partnersError ?? undefined}
              onRetry={() => void retryPartners()}
              isRetrying={isRetrying}
            />
          )}
          {partnersPhase === 'ready' && (
            <DataList
              items={partners}
              columns={partnerColumns}
              getKey={(p) => p.id}
              caption="Candidatures des partenaires"
              renderCard={renderPartnerCard}
              empty={(
                <EmptyState
                  icon={<Building2 size={28} />}
                  title={activeTab === 'EN_ATTENTE' ? 'Aucune candidature en attente' : 'Aucune candidature'}
                  description={activeTab === 'EN_ATTENTE'
                    ? 'Les nouvelles inscriptions « Devenir partenaire » apparaissent ici en direct, avec leurs pièces justificatives.'
                    : 'Aucun partenaire ne correspond à ce filtre.'}
                />
              )}
            />
          )}
        </TabPanel>
      </section>

      <section aria-labelledby="raccourcis" className="flex flex-col gap-3">
        <h2 id="raccourcis" className="text-lg font-bold tracking-tight text-fg">Raccourcis</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/referral" variant="secondary" leftIcon={<Award size={16} />}>
            Parrainage et ambassadeurs
          </LinkButton>
          {hasRole('SUPERADMIN') && (
            <LinkButton href="/admin/audit" variant="secondary" leftIcon={<Activity size={16} />}>
              Journal d’audit
            </LinkButton>
          )}
          <LinkButton href="/admin/services" variant="secondary" leftIcon={<Building2 size={16} />}>
            Catalogues et services
          </LinkButton>
        </div>
      </section>

      {selectedPartner && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Dossier du partenaire"
          subtitle={selectedPartner.company_name}
          icon={<Building2 size={20} />}
          maxWidth="3xl"
          footer={(
            <>
              <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)} className="flex-1 sm:flex-none">
                Fermer
              </Button>
              {canSuspend && selectedPartner.status === 'VALIDE' && (
                <Button variant="danger" leftIcon={<PauseCircle size={16} />} onClick={() => askStatusChange(selectedPartner, 'SUSPENDU')} className="flex-1 sm:flex-none">
                  Suspendre
                </Button>
              )}
              {canValidate && selectedPartner.status === 'SUSPENDU' && (
                <Button variant="primary" leftIcon={<PlayCircle size={16} />} onClick={() => askStatusChange(selectedPartner, 'VALIDE')} className="flex-1 sm:flex-none">
                  Réactiver
                </Button>
              )}
              {canValidate && selectedPartner.status === 'EN_ATTENTE' && (
                <Button variant="ghost" leftIcon={<XCircle size={16} />} onClick={() => askReject(selectedPartner)} className="flex-1 text-danger-fg sm:flex-none">
                  Refuser
                </Button>
              )}
              {canValidate && selectedPartner.status === 'EN_ATTENTE' && (
                <Button variant="primary" leftIcon={<CheckCircle2 size={16} />} onClick={() => askValidate(selectedPartner)} className="flex-1 sm:flex-none">
                  Valider la candidature
                </Button>
              )}
            </>
          )}
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={partnerStatus(selectedPartner.status).variant}>{partnerStatus(selectedPartner.status).label}</Badge>
              {activitiesOf(selectedPartner).map((a, i) => <Badge key={`${a}-${i}`} variant="brand">{a}</Badge>)}
            </div>

            {selectedPartner.status === 'REJETE' && (
              <StatusBanner tone="danger" title="Motif du refus">
                {selectedPartner.rejection_reason || 'Aucun motif enregistré.'}
                {selectedPartner.resubmitted_at
                  ? ' Le partenaire a déjà complété son dossier une fois.'
                  : ' Le partenaire peut compléter son dossier une fois depuis son tableau de bord.'}
              </StatusBanner>
            )}

            <section aria-labelledby="dossier-structure">
              <h3 id="dossier-structure" className="mb-2 text-base font-semibold text-fg">Structure</h3>
              <dl className="grid gap-3 rounded-2xl border border-border bg-surface-sunken p-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Raison sociale</dt>
                  <dd className="break-words text-base font-medium text-fg">{selectedPartner.company_name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Nom commercial</dt>
                  <dd className="break-words text-base font-medium text-fg">{selectedPartner.commercial_name || 'Identique à la raison sociale'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Ville</dt>
                  <dd className="flex items-center gap-1.5 break-words text-base font-medium text-fg">
                    <MapPin size={16} className="flex-shrink-0 text-fg-muted" aria-hidden="true" />
                    {selectedPartner.city || 'Non renseignée'}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Adresse</dt>
                  <dd className="break-words text-base font-medium text-fg">{selectedPartner.address || 'Non renseignée'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">NINEA</dt>
                  <dd className="break-words text-base font-medium text-fg">{selectedPartner.ninea || 'Non renseigné'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">RCCM</dt>
                  <dd className="break-words text-base font-medium text-fg">{selectedPartner.rccm || 'Non renseigné'}</dd>
                </div>
              </dl>
              {selectedPartner.resubmitted_at && (
                <p className="mt-2 text-sm text-fg-muted">
                  Dossier complété par le partenaire le{' '}
                  <time dateTime={toDakarDateTimeLocal(selectedPartner.resubmitted_at)} className="tabular-nums">{formatDateTime(selectedPartner.resubmitted_at)}</time>
                  {' '}après un refus.
                </p>
              )}
            </section>

            <section aria-labelledby="dossier-contact">
              <h3 id="dossier-contact" className="mb-2 text-base font-semibold text-fg">Responsable du compte</h3>
              <dl className="grid gap-3 rounded-2xl border border-border bg-surface-sunken p-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Nom</dt>
                  <dd className="break-words text-base font-medium text-fg">{managerName(selectedPartner)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                    Téléphone
                    {selectedPartner.phone_verified ? (
                      <Badge variant="success" size="sm" icon={<CheckCircle2 size={12} aria-hidden="true" />}>Numéro vérifié</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Numéro non vérifié</Badge>
                    )}
                  </dt>
                  <dd className="text-base font-medium">
                    {(selectedPartner.phone || selectedPartner.users?.phone) ? (
                      <a href={`tel:${selectedPartner.phone || selectedPartner.users?.phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-brand-fg underline-offset-4 hover:underline">
                        <Phone size={16} aria-hidden="true" />
                        {selectedPartner.phone || selectedPartner.users?.phone}
                      </a>
                    ) : <span className="text-fg-muted">Non renseigné</span>}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">Email</dt>
                  <dd className="text-base font-medium">
                    {(selectedPartner.email || selectedPartner.users?.email) ? (
                      <a href={`mailto:${selectedPartner.email || selectedPartner.users?.email}`} className="inline-flex min-h-11 items-center gap-1.5 break-all text-brand-fg underline-offset-4 hover:underline">
                        <Mail size={16} className="flex-shrink-0" aria-hidden="true" />
                        {selectedPartner.email || selectedPartner.users?.email}
                      </a>
                    ) : <span className="text-fg-muted">Non renseigné</span>}
                  </dd>
                </div>
              </dl>
            </section>

            {selectedPartner.description && (
              <section aria-labelledby="dossier-activite">
                <h3 id="dossier-activite" className="mb-2 text-base font-semibold text-fg">Présentation de l’activité</h3>
                <p className="whitespace-pre-line break-words rounded-2xl border border-border bg-surface-sunken p-4 text-base leading-relaxed text-fg">
                  {selectedPartner.description}
                </p>
              </section>
            )}

            <section aria-labelledby="dossier-pieces">
              <h3 id="dossier-pieces" className="mb-2 text-base font-semibold text-fg">Pièces justificatives</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-fg">Pièce d’identité</p>
                      <p className="truncate text-sm text-fg-muted">{selectedPartner.id_card_url ? 'Document téléversé' : 'Non fournie'}</p>
                    </div>
                  </div>
                  {selectedPartner.id_card_url ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewDocument(selectedPartner.id, 'id_card', selectedPartner.id_card_url, 'Pièce d’identité')}
                      isLoading={loadingDoc === 'id_card'}
                      rightIcon={<ExternalLink size={16} />}
                      aria-label="Ouvrir la pièce d’identité dans un nouvel onglet"
                    >
                      Ouvrir
                    </Button>
                  ) : (
                    <Badge variant="neutral" size="sm">Absente</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-info-bg text-info-fg" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-fg">NINEA ou RCCM</p>
                      <p className="truncate text-sm text-fg-muted">{selectedPartner.business_doc_url ? 'Document téléversé' : 'Non fourni'}</p>
                    </div>
                  </div>
                  {selectedPartner.business_doc_url ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewDocument(selectedPartner.id, 'business_doc', selectedPartner.business_doc_url, 'NINEA/RCCM')}
                      isLoading={loadingDoc === 'business_doc'}
                      rightIcon={<ExternalLink size={16} />}
                      aria-label="Ouvrir le NINEA ou le RCCM dans un nouvel onglet"
                    >
                      Ouvrir
                    </Button>
                  ) : (
                    <Badge variant="neutral" size="sm">Absent</Badge>
                  )}
                </div>
              </div>
            </section>
          </div>
        </Modal>
      )}

      <PartnerStatusDialog
        partner={statusChange?.partner ?? null}
        target={statusChange?.target ?? 'SUSPENDU'}
        onClose={() => setStatusChange(null)}
        onDone={(result) => void statusChanged(result)}
      />

      <ConfirmDialog
        isOpen={!!partnerToValidate}
        onClose={() => {
          if (!isActionLoading) setPartnerToValidate(null);
        }}
        onConfirm={() => void confirmValidate()}
        title="Valider la candidature ?"
        message={partnerToValidate
          ? `« ${partnerToValidate.company_name} » pourra créer des événements et vendre des billets. Le responsable est prévenu par SMS.`
          : undefined}
        confirmLabel="Valider la candidature"
        isLoading={isActionLoading}
      />

      <ReasonDialog
        isOpen={!!partnerToReject}
        onClose={() => {
          if (!isActionLoading) setPartnerToReject(null);
        }}
        onConfirm={(reason) => void confirmReject(reason)}
        title="Refuser la candidature"
        description={partnerToReject ? `« ${partnerToReject.company_name} » sera prévenu par SMS avec votre motif.` : undefined}
        label="Motif du refus"
        hint="Au moins 3 caractères. Par exemple : NINEA manquant ou illisible, activité non éligible."
        confirmLabel="Refuser la candidature"
        variant="danger"
        isLoading={isActionLoading}
        error={rejectError ?? undefined}
      />
    </div>
  );
}
