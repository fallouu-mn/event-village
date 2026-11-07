'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CalendarRange, CalendarPlus, Search, Smartphone, Ticket } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LinkButton } from '@/components/ui/LinkButton';
import { Button } from '@/components/ui/Button';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { EVENT_STATUSES, EVENT_STATUS_META, type EventStatus } from '@/lib/events/event-status';
import { formatFcfa, formatInteger } from '@/lib/format';
import { KpiAmount } from '@/components/partner/pilotage/PilotageBlocks';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { EventCancelDialog } from '@/components/events/EventCancelDialog';
import { PartnerEventCard, type EventAction, type PartnerEventItem } from '@/components/partner/events-list/PartnerEventCard';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';

/**
 * Lot 5, tâche 5.11 (contrat H) — liste des événements de l'organisateur.
 *  - Indicateurs et compteurs des onglets : GET /api/partner/events/overview, calculés par la base sur TOUS
 *    les événements (jamais sur la liste filtrée, jamais dans le navigateur).
 *  - Onglets par statut (Annulé compris), libellés de EVENT_STATUS_META ; onglet courant dans `?statut=`.
 *  - Actions de chaque carte : event_actions (servies par GET /api/partner/events) ; transitions par
 *    POST …/transition, annulation par EventCancelDialog (tâche 5.8).
 *  - Temps réel : event_status_history (statuts de ses événements, RLS propriétaire), puis rechargement.
 */

type ListTab = 'TOUS' | EventStatus;

const TAB_IDS: readonly ListTab[] = ['TOUS', ...EVENT_STATUSES];
const TABS_PREFIX = 'evenements-statut';

interface Overview {
    counts: Partial<Record<EventStatus, number>>;
    totals: { events: number; tickets_sold: number; revenue_online: number; revenue_cash: number };
}

interface PendingTransition {
    event: PartnerEventItem;
    action: EventAction;
}

const EMPTY_MESSAGES: Record<ListTab, string> = {
    TOUS: 'Créez votre premier événement : il restera en brouillon jusqu’à ce que vous le soumettiez à la validation.',
    BROUILLON: 'Aucun brouillon. Les événements créés restent ici jusqu’à leur soumission.',
    EN_ATTENTE: 'Aucun événement en attente : l’équipe Event Village a traité toutes vos demandes.',
    VALIDE: 'Aucun événement validé à publier pour le moment.',
    PUBLIE: 'Aucun événement en ligne pour le moment.',
    SUSPENDU: 'Aucun événement suspendu.',
    TERMINE: 'Aucun événement terminé pour le moment.',
    ANNULE: 'Aucun événement annulé.',
};

function successMessage(action: EventAction): string {
    if (action.to === 'EN_ATTENTE') return 'Événement soumis : l’équipe Event Village va vérifier la fiche.';
    if (action.to === 'PUBLIE') return 'Événement publié : la page publique est en ligne et la billetterie est ouverte.';
    if (action.to === 'BROUILLON') return 'Événement retiré de la validation : vous pouvez de nouveau le modifier.';
    return 'Statut de l’événement mis à jour.';
}

export default function PartnerEventsPage() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useTabParam<ListTab>(TAB_IDS, 'TOUS', 'statut');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const [events, setEvents] = useState<PartnerEventItem[] | null>(null);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const seq = useRef(0);

    const [pending, setPending] = useState<{ eventId: string; to: string } | null>(null);
    const [confirmTransition, setConfirmTransition] = useState<PendingTransition | null>(null);
    const [reasonTransition, setReasonTransition] = useState<PendingTransition | null>(null);
    const [reasonError, setReasonError] = useState<string | undefined>(undefined);
    const [cancelTarget, setCancelTarget] = useState<PartnerEventItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PartnerEventItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    /** Liste (filtrée) et indicateurs (sur tous les événements), lus ensemble : une seule erreur affichée. */
    const load = useCallback(async (mode: 'initial' | 'silent' | 'retry') => {
        const mine = ++seq.current;
        if (mode === 'initial') setLoading(true);
        if (mode === 'retry') setRetrying(true);
        const params = new URLSearchParams();
        if (activeTab !== 'TOUS') params.set('status', activeTab);
        if (search) params.set('search', search);
        const query = params.toString();
        try {
            const [list, ov] = await Promise.all([
                fetchJson<{ events?: PartnerEventItem[] }>(query ? `/api/partner/events?${query}` : '/api/partner/events'),
                fetchJson<Overview>('/api/partner/events/overview'),
            ]);
            if (mine !== seq.current) return;
            setEvents(Array.isArray(list.events) ? list.events : []);
            setOverview(ov);
            setError(null);
        } catch (err) {
            if (mine !== seq.current) return;
            console.error('[partner/events] chargement', err);
            setError(errorMessage(err, 'Lecture de vos événements impossible pour le moment.'));
        } finally {
            if (mine === seq.current) {
                setLoading(false);
                setRetrying(false);
            }
        }
    }, [activeTab, search]);

    useEffect(() => {
        void load('initial');
    }, [load]);

    const refresh = useCallback(() => load('silent'), [load]);

    const { status: liveStatus } = useRealtimeRefresh({
        channelKey: 'partner-events-list',
        subscriptions: [{ table: 'event_status_history', event: 'INSERT' }],
        onSignal: refresh,
    });

    const tabs: TabItem[] = useMemo(() => [
        { id: 'TOUS', label: 'Tous', count: overview?.totals.events },
        ...EVENT_STATUSES.map((s) => ({ id: s, label: EVENT_STATUS_META[s].label, count: overview ? overview.counts[s] ?? 0 : undefined })),
    ], [overview]);

    const runTransition = async (event: PartnerEventItem, action: EventAction, reason?: string): Promise<boolean> => {
        setPending({ eventId: event.id, to: action.to });
        try {
            await sendJson(`/api/partner/events/${event.id}/transition`, 'POST', reason ? { to: action.to, reason } : { to: action.to });
            toast.success(successMessage(action));
            await refresh();
            return true;
        } catch (err) {
            const message = errorMessage(err, 'Changement de statut impossible pour le moment.');
            toast.error(message);
            if (reason !== undefined) setReasonError(message);
            return false;
        } finally {
            setPending(null);
        }
    };

    const onTransition = (event: PartnerEventItem, action: EventAction): void => {
        if (action.reason_required) {
            setReasonError(undefined);
            setReasonTransition({ event, action });
            return;
        }
        // La publication ouvre la billetterie au public : confirmation explicite
        if (action.to === 'PUBLIE') {
            setConfirmTransition({ event, action });
            return;
        }
        void runTransition(event, action);
    };

    const confirmDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await sendJson(`/api/partner/events/${deleteTarget.id}`, 'DELETE');
            toast.success('Brouillon supprimé.');
            setDeleteTarget(null);
            await refresh();
        } catch (err) {
            toast.error(errorMessage(err, 'Suppression impossible pour le moment.'));
        } finally {
            setDeleting(false);
        }
    };

    const totals = overview?.totals;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 lg:py-8">
            <PageHeader
                title="Mes événements"
                description="Soumettez, publiez et pilotez vos événements. Les indicateurs portent sur tous vos événements."
                eyebrow={<LiveIndicator status={liveStatus} />}
                actions={
                    <LinkButton href="/partner/events/new" variant="primary" leftIcon={<CalendarPlus size={18} />}>
                        Créer un événement
                    </LinkButton>
                }
                className="pb-0 sm:pb-0"
            />

            {error ? (
                <ErrorState
                    title="Vos événements n’ont pas pu être chargés"
                    description={error}
                    onRetry={() => void load('retry')}
                    isRetrying={retrying}
                />
            ) : (
                <>
                    <section aria-label="Indicateurs sur tous vos événements" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {loading && !totals ? (
                            <>
                                <KpiCardSkeleton />
                                <KpiCardSkeleton />
                                <KpiCardSkeleton />
                                <KpiCardSkeleton />
                            </>
                        ) : (
                            <>
                                <KpiCard label="Événements" value={formatInteger(totals?.events)} hint="Tous statuts confondus" icon={<CalendarRange size={18} />} tone="brand" />
                                <KpiCard label="Billets vendus" value={formatInteger(totals?.tickets_sold)} hint="Hors invitations" icon={<Ticket size={18} />} tone="info" />
                                <KpiCard label="Recettes en ligne" value={<KpiAmount value={formatFcfa(totals?.revenue_online)} />} hint="Billets payés en ligne, remboursements déduits" icon={<Smartphone size={18} />} tone="success" />
                                <KpiCard label="Recettes en espèces" value={<KpiAmount value={formatFcfa(totals?.revenue_cash)} />} hint="Encaissées par vos contrôleurs" icon={<Banknote size={18} />} tone="warning" />
                            </>
                        )}
                    </section>

                    <div className="flex flex-col gap-4">
                        <ScrollableTabs
                            tabs={tabs}
                            value={activeTab}
                            onChange={(id) => setActiveTab(id as ListTab)}
                            ariaLabel="Statut des événements"
                            idPrefix={TABS_PREFIX}
                        />

                        <form
                            role="search"
                            className="flex flex-col gap-2 sm:flex-row sm:items-end"
                            onSubmit={(e) => {
                                e.preventDefault();
                                setSearch(searchInput.trim().slice(0, 100));
                            }}
                        >
                            <TextInput
                                label="Rechercher un événement"
                                type="search"
                                placeholder="Titre de l’événement"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                fieldClassName="flex-1"
                                maxLength={100}
                            />
                            <Button type="submit" variant="secondary" leftIcon={<Search size={18} />}>
                                Rechercher
                            </Button>
                        </form>

                        <TabPanel idPrefix={TABS_PREFIX} tabIdValue={activeTab}>
                            {loading || events === null ? (
                                <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Chargement des événements">
                                    <KpiCardSkeleton className="min-h-40" />
                                    <KpiCardSkeleton className="min-h-40" />
                                </div>
                            ) : events.length === 0 ? (
                                <EmptyState
                                    title={search ? 'Aucun événement ne correspond à la recherche' : 'Aucun événement'}
                                    description={search ? 'Essayez un autre titre, ou effacez la recherche.' : EMPTY_MESSAGES[activeTab]}
                                    actionLabel={search ? 'Effacer la recherche' : activeTab === 'TOUS' ? 'Créer un événement' : undefined}
                                    actionHref={!search && activeTab === 'TOUS' ? '/partner/events/new' : undefined}
                                    onAction={search ? () => { setSearch(''); setSearchInput(''); } : undefined}
                                />
                            ) : (
                                <ul className="flex flex-col gap-4" aria-label="Événements">
                                    {events.map((ev) => (
                                        <li key={ev.id}>
                                            <PartnerEventCard
                                                event={ev}
                                                pendingTo={pending?.eventId === ev.id ? pending.to : null}
                                                onTransition={onTransition}
                                                onCancel={setCancelTarget}
                                                onDelete={setDeleteTarget}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </TabPanel>
                    </div>
                </>
            )}

            <Modal
                isOpen={confirmTransition !== null}
                onClose={() => {
                    if (!pending) setConfirmTransition(null);
                }}
                title="Publier l’événement ?"
                subtitle={confirmTransition?.event.title}
                maxWidth="md"
                busy={pending !== null}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConfirmTransition(null)} disabled={pending !== null} className="flex-1 sm:flex-none">
                            Pas maintenant
                        </Button>
                        <Button
                            variant="primary"
                            isLoading={pending !== null}
                            className="flex-1 sm:flex-none"
                            onClick={async () => {
                                if (!confirmTransition) return;
                                const ok = await runTransition(confirmTransition.event, confirmTransition.action);
                                if (ok) setConfirmTransition(null);
                            }}
                        >
                            {confirmTransition?.action.label ?? 'Publier'}
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
                isOpen={reasonTransition !== null}
                onClose={() => setReasonTransition(null)}
                onConfirm={async (reason) => {
                    if (!reasonTransition) return;
                    const ok = await runTransition(reasonTransition.event, reasonTransition.action, reason);
                    if (ok) setReasonTransition(null);
                }}
                title={reasonTransition?.action.label ?? 'Motif'}
                description="Indiquez le motif de ce changement : il est conservé dans l’historique de l’événement."
                confirmLabel={reasonTransition?.action.label ?? 'Confirmer'}
                isLoading={pending !== null}
                error={reasonError}
            />

            <ConfirmDialog
                isOpen={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => void confirmDelete()}
                title="Supprimer ce brouillon ?"
                message={deleteTarget ? `« ${deleteTarget.title} » et ses catégories de billets seront supprimés définitivement.` : undefined}
                confirmLabel="Supprimer le brouillon"
                variant="danger"
                isLoading={deleting}
            />

            {cancelTarget && (
                <EventCancelDialog
                    eventId={cancelTarget.id}
                    eventTitle={cancelTarget.title}
                    scope="partner"
                    open={cancelTarget !== null}
                    onClose={() => setCancelTarget(null)}
                    onCancelled={() => void refresh()}
                />
            )}
        </div>
    );
}
