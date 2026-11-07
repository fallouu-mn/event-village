'use client';

import React, { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { Ban, CalendarDays, MapPin, Pencil, Send, Undo2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { ErrorState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatDateTime, formatEventDateTime } from '@/lib/format';
import { EventCancelDialog } from '@/components/events/EventCancelDialog';
import { RefundProgress } from '@/components/events/RefundProgress';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { OverviewTab } from '@/components/partner/pilotage/OverviewTab';
import { SalesTab } from '@/components/partner/pilotage/SalesTab';
import { EntriesTab } from '@/components/partner/pilotage/EntriesTab';
import { TeamTab } from '@/components/partner/pilotage/TeamTab';
import { CashTab } from '@/components/partner/pilotage/CashTab';
import { ClosingTab } from '@/components/partner/pilotage/ClosingTab';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import type { EventAction, PilotageOverview } from '@/components/partner/pilotage/types';

/**
 * Lot 5, tâche 5.10 (contrat I) — page de pilotage d'un événement par son organisateur.
 *  - Onglets dans `?tab=` : Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture (les anciennes pages
 *    …/team et …/caisse redirigent ici).
 *  - Une seule source de vérité : les routes …/pilotage/* (RPC pilotage_*), jamais de calcul ici.
 *  - En direct : ticket_scans, scan_incidents, controller_shifts et l'historique des statuts de CET
 *    événement (filtre event_id) déclenchent le rechargement de l'en-tête et de l'onglet affiché.
 *  - Annulation (tâche 5.8) : « Annuler l'événement » selon can_cancel, puis avancement des remboursements.
 */

const TAB_IDS = ['apercu', 'ventes', 'entrees', 'equipe', 'caisse', 'cloture'] as const;
type PilotageTabId = (typeof TAB_IDS)[number];
const TABS: TabItem[] = [
    { id: 'apercu', label: 'Aperçu' },
    { id: 'ventes', label: 'Ventes' },
    { id: 'entrees', label: 'Entrées' },
    { id: 'equipe', label: 'Équipe' },
    { id: 'caisse', label: 'Caisse' },
    { id: 'cloture', label: 'Clôture' },
];
const TABS_PREFIX = 'pilotage';

/** Événement clos : « En direct » à côté du statut se lirait comme un second statut. */
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['ANNULE', 'TERMINE']);

function actionIcon(to: string): React.ReactNode {
    if (to === 'EN_ATTENTE') return <Send size={18} />;
    if (to === 'PUBLIE') return <Upload size={18} />;
    return <Undo2 size={18} />;
}

export default function PartnerEventPilotagePage() {
    const params = useParams<{ id: string }>();
    const eventId = typeof params?.id === 'string' ? params.id : '';
    const toast = useToast();
    const [activeTab, setActiveTab] = useTabParam<PilotageTabId>(TAB_IDS, 'apercu');
    const [signal, setSignal] = useState(0);

    const overview = useServerData<PilotageOverview>(eventId ? `/api/partner/events/${eventId}/pilotage/overview` : null, signal);
    const ov = overview.data;

    const onSignal = useCallback(() => {
        setSignal((n) => n + 1);
    }, []);

    const { status: liveStatus } = useRealtimeRefresh({
        channelKey: `pilotage-${eventId || 'inconnu'}`,
        subscriptions: [
            { table: 'ticket_scans', filter: `event_id=eq.${eventId}` },
            { table: 'scan_incidents', filter: `event_id=eq.${eventId}` },
            { table: 'controller_shifts', filter: `event_id=eq.${eventId}` },
            { table: 'event_status_history', event: 'INSERT', filter: `event_id=eq.${eventId}` },
        ],
        onSignal,
        enabled: Boolean(eventId),
    });

    const [pendingTo, setPendingTo] = useState<string | null>(null);
    const [publishAction, setPublishAction] = useState<EventAction | null>(null);
    const [reasonAction, setReasonAction] = useState<EventAction | null>(null);
    const [reasonError, setReasonError] = useState<string | undefined>(undefined);
    const [cancelOpen, setCancelOpen] = useState(false);

    const runTransition = async (action: EventAction, reason?: string): Promise<boolean> => {
        setPendingTo(action.to);
        try {
            await sendJson(`/api/partner/events/${eventId}/transition`, 'POST', reason ? { to: action.to, reason } : { to: action.to });
            toast.success('Statut de l’événement mis à jour.');
            setSignal((n) => n + 1);
            return true;
        } catch (err) {
            const message = errorMessage(err, 'Changement de statut impossible pour le moment.');
            toast.error(message);
            if (reason !== undefined) setReasonError(message);
            return false;
        } finally {
            setPendingTo(null);
        }
    };

    const onAction = (action: EventAction): void => {
        if (action.reason_required) {
            setReasonError(undefined);
            setReasonAction(action);
        } else if (action.to === 'PUBLIE') {
            setPublishAction(action);
        } else {
            void runTransition(action);
        }
    };

    if (overview.loading && !ov) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 lg:py-8" role="status" aria-busy="true" aria-label="Chargement du pilotage">
                <div className="flex flex-col gap-3">
                    <span className="h-5 w-40 rounded bg-surface-sunken motion-safe:animate-pulse" />
                    <span className="h-8 w-3/4 rounded bg-surface-sunken motion-safe:animate-pulse" />
                    <span className="h-5 w-1/2 rounded bg-surface-sunken motion-safe:animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </div>
            </div>
        );
    }

    if (!ov) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-6 lg:py-8">
                <PageHeader title="Pilotage de l’événement" back={{ href: '/partner/events', label: 'Mes événements' }} className="pb-0 sm:pb-0" />
                <ErrorState
                    title="Le pilotage n’a pas pu être chargé"
                    description={overview.error ?? 'Événement introuvable ou non autorisé.'}
                    onRetry={() => void overview.reload()}
                    isRetrying={overview.refreshing}
                />
            </div>
        );
    }

    const ev = ov.event;
    const place = [ev.location, ev.city].filter(Boolean).join(', ');
    const reason = ov.last_reason;
    const busy = pendingTo !== null;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 lg:py-8">
            <PageHeader
                back={{ href: '/partner/events', label: 'Mes événements' }}
                eyebrow={
                    <>
                        <StatusBadge domain="event" status={ov.status} />
                        {/* « Annulé » suivi de « En direct » en vert se lisait comme deux statuts contradictoires
                            (relecture du run 77) : pour un événement clos, « En direct » n'est plus affiché ; le
                            pilotage reste abonné, et « Connexion… » ou « Hors ligne » restent visibles. */}
                        {!(CLOSED_STATUSES.has(ov.status) && liveStatus === 'live') && <LiveIndicator status={liveStatus} />}
                    </>
                }
                title={ev.title}
                description={
                    <span className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
                        <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={16} aria-hidden="true" />
                            {formatEventDateTime(ev.start_date, ev.start_time)}
                        </span>
                        {place && (
                            <span className="inline-flex items-center gap-1.5">
                                <MapPin size={16} aria-hidden="true" />
                                {place}
                            </span>
                        )}
                    </span>
                }
                actions={
                    <>
                        {ov.actions.map((action) => (
                            <Button
                                key={action.to}
                                variant={action.to === 'PUBLIE' || action.to === 'EN_ATTENTE' ? 'primary' : 'secondary'}
                                leftIcon={actionIcon(action.to)}
                                isLoading={pendingTo === action.to}
                                disabled={busy}
                                onClick={() => onAction(action)}
                            >
                                {action.label}
                            </Button>
                        ))}
                        {ov.can_edit && (
                            <LinkButton href={`/partner/events/${eventId}/edit`} variant="secondary" leftIcon={<Pencil size={18} />}>
                                Modifier
                            </LinkButton>
                        )}
                        {ov.can_cancel && (
                            <Button variant="ghost" leftIcon={<Ban size={18} />} onClick={() => setCancelOpen(true)} disabled={busy} className="text-danger-fg">
                                Annuler l’événement
                            </Button>
                        )}
                    </>
                }
                className="pb-0 sm:pb-0"
            />

            {overview.error && (
                <StatusBanner tone="warning" title="Données peut-être dépassées" announce="alert" action={<Button variant="secondary" size="sm" onClick={() => void overview.reload()}>Réessayer</Button>}>
                    {overview.error}
                </StatusBanner>
            )}

            {reason && (
                <StatusBanner
                    tone={reason.kind === 'SUSPENSION' ? 'suspended' : 'danger'}
                    title={reason.kind === 'SUSPENSION' ? 'Suspendu par l’équipe Event Village' : 'Refusé par l’équipe Event Village'}
                >
                    <p>{reason.reason || 'Aucun motif communiqué.'}</p>
                    {reason.at && (
                        <p className="mt-1">
                            Le <time dateTime={reason.at}>{formatDateTime(reason.at)}</time>
                        </p>
                    )}
                </StatusBanner>
            )}

            {ov.status === 'ANNULE' && <RefundProgress eventId={eventId} isAdmin={false} />}

            <div className="flex flex-col gap-5">
                <ScrollableTabs tabs={TABS} value={activeTab} onChange={(id) => setActiveTab(id as PilotageTabId)} ariaLabel="Rubriques du pilotage" idPrefix={TABS_PREFIX} />
                <TabPanel idPrefix={TABS_PREFIX} tabIdValue={activeTab}>
                    {activeTab === 'apercu' && <OverviewTab data={ov} saleStopped={ov.status === 'ANNULE'} />}
                    {activeTab === 'ventes' && <SalesTab eventId={eventId} signal={signal} />}
                    {activeTab === 'entrees' && <EntriesTab eventId={eventId} signal={signal} />}
                    {activeTab === 'equipe' && <TeamTab eventId={eventId} eventStatus={ov.status} signal={signal} />}
                    {activeTab === 'caisse' && <CashTab eventId={eventId} signal={signal} />}
                    {activeTab === 'cloture' && <ClosingTab eventId={eventId} signal={signal} />}
                </TabPanel>
            </div>

            <Modal
                isOpen={publishAction !== null}
                onClose={() => {
                    if (!busy) setPublishAction(null);
                }}
                title="Publier l’événement ?"
                subtitle={ev.title}
                maxWidth="md"
                busy={busy}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setPublishAction(null)} disabled={busy} className="flex-1 sm:flex-none">
                            Pas maintenant
                        </Button>
                        <Button
                            variant="primary"
                            isLoading={busy}
                            className="flex-1 sm:flex-none"
                            onClick={async () => {
                                if (!publishAction) return;
                                const ok = await runTransition(publishAction);
                                if (ok) setPublishAction(null);
                            }}
                        >
                            {publishAction?.label ?? 'Publier'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm leading-relaxed text-fg-muted">
                    La page publique sera visible de tous et la billetterie ouverte selon les dates de vente de chaque catégorie.
                    Après la publication, les changements de date, de lieu ou de titre seront notifiés aux acheteurs.
                </p>
            </Modal>

            <ReasonDialog
                isOpen={reasonAction !== null}
                onClose={() => setReasonAction(null)}
                onConfirm={async (text) => {
                    if (!reasonAction) return;
                    const ok = await runTransition(reasonAction, text);
                    if (ok) setReasonAction(null);
                }}
                title={reasonAction?.label ?? 'Motif'}
                description="Indiquez le motif de ce changement : il est conservé dans l’historique de l’événement."
                confirmLabel={reasonAction?.label ?? 'Confirmer'}
                isLoading={busy}
                error={reasonError}
            />

            <EventCancelDialog
                eventId={eventId}
                eventTitle={ev.title}
                scope="partner"
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                onCancelled={() => setSignal((n) => n + 1)}
            />
        </div>
    );
}
