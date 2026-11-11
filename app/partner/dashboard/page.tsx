'use client';

/**
 * Tableau de bord du partenaire (lot 7, tâche 7.4 ; contrat section 8, D69, D70).
 *  - Une seule source : GET /api/partner/dashboard, lu par useServerData. Tous les chiffres (montants du grand
 *    livre, billets, taux, nombre d'événements), la première utilisation (`onboarding`) et l'essai (`trial`)
 *    sont servis par le serveur ; la page ne fait que les formater (lib/format).
 *  - Chargement : KpiCard en squelette ; échec : ErrorState avec « Réessayer » (jamais de « 0 F CFA » sans
 *    donnée) ; états vides explicites.
 *  - Bandeaux du compte : en attente, refusé (avec le motif servi), suspendu (avec le motif servi). Lot 9 bis (R5, B16,
 *    contrat 5.2) : le bandeau de la suspension dit ce qui se passe vraiment (événements en ligne suspendus par la
 *    cascade, fonds gelés jusqu'à la réactivation) ; l'ancien texte, faux, est retiré.
 *  - Bloc « Commandes en direct » affiché seulement si features.orders_enabled est ouvert (useFeatureFlags) ;
 *    usePartnerOrders reste importé (SCENARIO 15) mais ne s'abonne que si le service est ouvert.
 *  - Le rapport de clôture est une modale chargée à la demande (next/dynamic).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
    Activity,
    CalendarDays,
    CheckCircle2,
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    QrCode,
    RefreshCw,
    ShieldCheck,
    ShoppingBag,
    Ticket,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { usePartnerOrders } from '@/hooks/usePartnerOrders';
import { useFeatureFlags } from '@/lib/features/client';
import { useServerData } from '@/components/partner/useServerData';
import { FirstEventSteps, type FirstEventOnboarding } from '@/components/partner/onboarding/FirstEventSteps';
import { useToast } from '@/components/ui/Toast';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDate, formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import type { PartnerActivityItem, PartnerDashboardData, PartnerEventBreakdown } from '@/lib/partner/partner-dashboard.service';

const ClosingReportModal = dynamic(
    () => import('@/components/partner/ClosingReportModal').then((m) => m.ClosingReportModal),
    { ssr: false },
);

interface DashboardResponse {
    dashboard?: PartnerDashboardData;
    data?: PartnerDashboardData;
    /** Lot 9 bis (R70, B88) : adresse de support lue côté serveur (SUPPORT_EMAIL), jamais écrite dans l'écran. */
    support_email?: string;
}

const ORDER_STATUS_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
    EN_ATTENTE: { label: 'En attente', variant: 'warning' },
    CONFIRMEE: { label: 'Confirmée', variant: 'info' },
    EN_PREPARATION: { label: 'En préparation', variant: 'warning' },
    PRETE: { label: 'Prête', variant: 'info' },
    EN_LIVRAISON: { label: 'En livraison', variant: 'info' },
    LIVREE: { label: 'Livrée', variant: 'success' },
    ANNULEE: { label: 'Annulée', variant: 'danger' },
    REJETEE: { label: 'Refusée', variant: 'danger' },
};

const DELIVERY_MODE_LABELS: Record<string, string> = {
    LIVRAISON: 'Livraison',
    RETRAIT: 'Retrait sur place',
    SUR_PLACE: 'Sur place',
};

const ACTIVITY_ICONS: Record<PartnerActivityItem['type'], { icon: React.ElementType; className: string }> = {
    SALE: { icon: Ticket, className: 'bg-info-bg text-info-fg' },
    CHECKIN: { icon: QrCode, className: 'bg-success-bg text-success-fg' },
    ORDER: { icon: ShoppingBag, className: 'bg-brand-bg text-brand-fg' },
    WITHDRAWAL: { icon: Wallet, className: 'bg-surface-sunken text-fg' },
};

/** Ouvre un export (PDF ou CSV servi par une route) dans un nouvel onglet. */
function openExport(url: string): void {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) window.location.assign(url);
}

export default function PartnerDashboardPage() {
    const toast = useToast();
    const flags = useFeatureFlags();
    const { data: body, error, loading, refreshing, reload } = useServerData<DashboardResponse>('/api/partner/dashboard');
    const dashboard = body?.dashboard ?? body?.data ?? null;
    const partner = dashboard?.partner ?? null;
    const kpis = dashboard?.kpis ?? null;
    const trial = dashboard?.trial ?? null;
    const onboarding = (dashboard?.onboarding ?? null) as FirstEventOnboarding | null;
    const supportEmail = typeof body?.support_email === 'string' && body.support_email.includes('@') ? body.support_email : null;

    // Commandes en direct : abonnement seulement si le service des commandes est ouvert (D69).
    const ordersOpen = flags?.orders === true;
    const { orders: liveOrders, connected } = usePartnerOrders(ordersOpen && partner ? partner.id : null);

    const [closing, setClosing] = React.useState<{ id: string; title: string } | null>(null);

    // Démarrage de l'essai à la première visite d'un partenaire validé (action idempotente du serveur),
    // puis relecture : la durée et la date de fin affichées sont celles que le serveur a posées.
    const activationAsked = useRef(false);
    useEffect(() => {
        if (!partner || !trial || activationAsked.current) return;
        if (partner.status !== 'VALIDE' || trial.started_at) return;
        activationAsked.current = true;
        void (async () => {
            try {
                const res = await fetch('/api/partner/activation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const reply = (await res.json().catch((err: unknown) => {
                        console.error('[tableau de bord] réponse d’activation illisible :', err);
                        return null;
                    })) as { error?: string } | null;
                    console.error('[tableau de bord] activation de l’essai refusée, HTTP', res.status, reply);
                    toast.error(reply?.error ?? 'La période d’essai n’a pas pu démarrer. Rechargez la page pour réessayer.');
                    return;
                }
                await reload();
            } catch (err) {
                console.error('[tableau de bord] activation de l’essai impossible :', err);
                toast.error('Connexion impossible : la période d’essai démarrera à votre prochaine visite.');
            }
        })();
    }, [partner, trial, reload, toast]);

    const handleRefresh = useCallback(() => {
        void reload();
    }, [reload]);

    const eventColumns: DataColumn<PartnerEventBreakdown>[] = [
        {
            key: 'event',
            header: 'Événement',
            render: (ev) => (
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <span className="break-words font-semibold text-fg">{ev.title}</span>
                    <StatusBadge domain="event" status={ev.status} size="sm" />
                </div>
            ),
        },
        {
            key: 'date',
            header: 'Date et lieu',
            render: (ev) => (
                <div className="flex flex-col">
                    <time dateTime={ev.startAt ?? undefined} className="text-sm text-fg">{formatDateTime(ev.startAt)}</time>
                    <span className="text-sm text-fg-muted">{ev.city || ev.location || '—'}</span>
                </div>
            ),
        },
        {
            key: 'sold',
            header: 'Vendus / capacité',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-col tabular-nums">
                    <span className="font-semibold text-fg">{formatInteger(ev.ticketsSold)} / {formatInteger(ev.capacity)}</span>
                    <span className="text-sm text-fg-muted">{formatInteger(ev.fillRatePercent)} % rempli</span>
                </div>
            ),
        },
        {
            key: 'entries',
            header: 'Entrées',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-col tabular-nums">
                    <span className="font-semibold text-fg">{formatInteger(ev.ticketsCheckedIn)}</span>
                    <span className="text-sm text-fg-muted">{formatInteger(ev.checkInRatePercent)} % des vendus</span>
                </div>
            ),
        },
        {
            key: 'gross',
            header: 'Ventes en ligne',
            align: 'right',
            render: (ev) => <span className="font-semibold tabular-nums text-fg">{formatFcfa(ev.grossRevenue)}</span>,
        },
        {
            key: 'net',
            header: 'Net partenaire',
            align: 'right',
            render: (ev) => <span className="font-bold tabular-nums text-brand-fg">{formatFcfa(ev.netRevenue)}</span>,
        },
        {
            key: 'actions',
            header: 'Rapports',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" leftIcon={<FileText size={16} aria-hidden="true" />} onClick={() => setClosing({ id: ev.id, title: ev.title })}>
                        Clôture
                    </Button>
                    <IconButton
                        aria-label={`Télécharger le rapport PDF de ${ev.title}`}
                        title="Rapport PDF"
                        variant="secondary"
                        onClick={() => openExport(`/api/partner/reports/closing/pdf?eventId=${encodeURIComponent(ev.id)}`)}
                    >
                        <Download size={18} />
                    </IconButton>
                    <IconButton
                        aria-label={`Exporter les ventes de ${ev.title} en CSV`}
                        title="Export CSV"
                        variant="secondary"
                        onClick={() => openExport(`/api/partner/reports/accounting?eventId=${encodeURIComponent(ev.id)}&format=csv`)}
                    >
                        <FileSpreadsheet size={18} />
                    </IconButton>
                </div>
            ),
        },
    ];

    const title = partner?.commercialName || partner?.companyName || 'Tableau de bord';

    return (
        <div className="mx-auto max-w-6xl space-y-6 py-6 pb-24 sm:space-y-8">
            <PageHeader
                eyebrow={<span className="text-sm font-medium text-fg-muted">Espace partenaire</span>}
                title={title}
                description="Ventes, entrées et solde de vos événements."
                actions={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleRefresh}
                            isLoading={refreshing}
                            disabled={loading}
                            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
                        >
                            Actualiser
                        </Button>
                        <a
                            href="/api/partner/reports/accounting?format=csv"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'no-underline gap-1.5' })}
                        >
                            <FileSpreadsheet size={16} aria-hidden="true" />
                            Export comptable
                        </a>
                        <LinkButton href="/partner/scan" size="sm" leftIcon={<QrCode size={16} />}>
                            Scanner des billets
                        </LinkButton>
                    </>
                }
            />

            {error && !dashboard ? (
                <ErrorState
                    title="Tableau de bord indisponible"
                    description={`${error} Aucun chiffre n’est affiché tant que le serveur n’a pas répondu.`}
                    onRetry={handleRefresh}
                    isRetrying={refreshing || loading}
                />
            ) : (
                <>
                    {error && dashboard && (
                        <StatusBanner tone="danger" announce="alert" title="Actualisation impossible">
                            {error} Les chiffres affichés sont ceux de la dernière lecture réussie.
                        </StatusBanner>
                    )}

                    {/* Bandeaux du compte (statut servi par le serveur) */}
                    {partner?.status === 'EN_ATTENTE' && (
                        <StatusBanner tone="warning" title="Compte en cours de vérification" icon={<Clock size={20} />}>
                            Vos pièces sont vérifiées par l’équipe Event Village. Vous recevrez un SMS dès la validation de votre compte ;
                            vous pourrez alors créer et publier vos événements.
                        </StatusBanner>
                    )}
                    {partner?.status === 'REJETE' && (
                        <StatusBanner
                            tone="danger"
                            title="Demande de compte partenaire refusée"
                            action={supportEmail ? <LinkButton href={`mailto:${supportEmail}`} variant="secondary" size="sm">Contacter le support</LinkButton> : undefined}
                        >
                            {partner.rejectionReason ? <>Motif : {partner.rejectionReason}</> : 'Aucun motif n’a été précisé.'}{' '}
                            Contactez le support pour corriger votre dossier.
                        </StatusBanner>
                    )}
                    {partner?.status === 'SUSPENDU' && (
                        <StatusBanner tone="suspended" title="Compte partenaire suspendu">
                            {partner.suspendedReason ? <>Motif : {partner.suspendedReason}. </> : null}
                            Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte. Contactez le support Event Village.
                        </StatusBanner>
                    )}

                    {/* Période d'essai (durée et date de fin servies) */}
                    {trial?.active && trial.ends_at && (
                        <StatusBanner tone="success" title="Période d’essai gratuite en cours" icon={<ShieldCheck size={20} />} className="tabular-nums">
                            {trial.days !== null ? `${formatInteger(trial.days)} jours offerts, ` : ''}
                            jusqu’au <time dateTime={trial.ends_at}>{formatDate(trial.ends_at)}</time>.
                        </StatusBanner>
                    )}

                    {/* Première utilisation (étapes cochées par le serveur) */}
                    {onboarding?.visible && <FirstEventSteps onboarding={onboarding} />}

                    {/* Indicateurs */}
                    <section aria-labelledby="kpi-titre" className="space-y-3">
                        <h2 id="kpi-titre" className="sr-only">Indicateurs</h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                            <KpiCard
                                loading={loading || !kpis}
                                label="Ventes en ligne"
                                value={kpis ? formatFcfa(kpis.grossRevenue) : ''}
                                hint="Prix des billets vendus en ligne, tous événements."
                                tone="brand"
                                icon={<TrendingUp size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Net partenaire"
                                value={kpis ? formatFcfa(kpis.netRevenue) : ''}
                                hint={kpis ? `Après ${formatFcfa(kpis.refundedAmount)} de remboursements.` : undefined}
                                tone="success"
                                icon={<Wallet size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Billets vendus"
                                value={kpis ? formatInteger(kpis.ticketsSold) : ''}
                                hint={kpis ? `${formatInteger(kpis.ticketsCheckedIn)} entrées validées aux portes.` : undefined}
                                tone="info"
                                icon={<Ticket size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Disponible au retrait"
                                value={kpis ? formatFcfa(kpis.soldeDisponible) : ''}
                                hint={kpis ? `Déjà versé : ${formatFcfa(kpis.totalWithdrawn)}.` : undefined}
                                tone="neutral"
                                icon={<CheckCircle2 size={18} />}
                            />
                        </div>
                        {kpis && (
                            <p className="text-sm tabular-nums text-fg-muted">
                                Les ventes en espèces au guichet ({formatFcfa(kpis.cashSales)}) et les invitations n’alimentent pas le solde.{' '}
                                <LinkButton href="/partner/finance" variant="ghost" size="sm" className="-ml-2 align-middle">Voir mes finances</LinkButton>
                            </p>
                        )}
                    </section>

                    {/* Événements */}
                    <section aria-labelledby="evenements-titre" className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h2 id="evenements-titre" className="flex items-center gap-2 text-lg font-bold text-fg">
                                    <CalendarDays size={20} className="text-brand-fg" aria-hidden="true" />
                                    Mes événements
                                </h2>
                                {kpis && (
                                    <Badge variant="neutral" size="sm" className="tabular-nums">
                                        {formatInteger(kpis.totalEvents)} au total
                                    </Badge>
                                )}
                            </div>
                            <LinkButton href="/partner/events" variant="ghost" size="sm">Tous mes événements</LinkButton>
                        </div>
                        {loading || !dashboard ? (
                            <div className="space-y-2" role="status" aria-busy="true">
                                <span className="sr-only">Chargement des événements…</span>
                                <div className="h-20 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />
                                <div className="h-20 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />
                            </div>
                        ) : (
                            <DataList
                                items={dashboard.events}
                                columns={eventColumns}
                                getKey={(ev) => ev.id}
                                caption="Ventes, entrées et rapports par événement"
                                cardTitle={(ev) => ev.title}
                                empty={
                                    <EmptyState
                                        title="Aucun événement pour le moment"
                                        description="Créez votre premier événement : il restera en brouillon jusqu’à ce que vous le soumettiez à la validation."
                                        actionLabel={partner?.status === 'VALIDE' ? 'Créer un événement' : undefined}
                                        actionHref={partner?.status === 'VALIDE' ? '/partner/events/new' : undefined}
                                        icon={<CalendarDays size={28} />}
                                    />
                                }
                            />
                        )}
                    </section>

                    {/* Activité récente et commandes en direct */}
                    <div className={ordersOpen ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
                        <section aria-labelledby="activite-titre" className="space-y-3">
                            <h2 id="activite-titre" className="flex items-center gap-2 text-lg font-bold text-fg">
                                <Activity size={20} className="text-brand-fg" aria-hidden="true" />
                                Activité récente
                            </h2>
                            {loading || !dashboard ? (
                                <div className="h-40 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" role="status" aria-busy="true">
                                    <span className="sr-only">Chargement de l’activité…</span>
                                </div>
                            ) : dashboard.recentActivity.length === 0 ? (
                                <EmptyState
                                    title="Aucune opération récente"
                                    description="Ventes, entrées validées et retraits apparaîtront ici."
                                    icon={<Activity size={28} />}
                                />
                            ) : (
                                <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                                    {dashboard.recentActivity.map((item) => {
                                        const visual = ACTIVITY_ICONS[item.type];
                                        const Icon = visual.icon;
                                        return (
                                            <li key={item.id} className="flex items-center justify-between gap-3 p-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${visual.className}`} aria-hidden="true">
                                                        <Icon size={16} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-fg">{item.title}</p>
                                                        <p className="truncate text-sm text-fg-muted">{item.description}</p>
                                                    </div>
                                                </div>
                                                <time dateTime={item.createdAt} className="flex-shrink-0 text-caption text-fg-muted">
                                                    {formatDateTime(item.createdAt)}
                                                </time>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        {ordersOpen && (
                            <section aria-labelledby="commandes-titre" className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 id="commandes-titre" className="flex items-center gap-2 text-lg font-bold text-fg">
                                        <ShoppingBag size={20} className="text-brand-fg" aria-hidden="true" />
                                        Commandes en direct
                                    </h2>
                                    <span className="text-sm text-fg-muted" role="status">{connected ? 'En direct' : 'Connexion…'}</span>
                                </div>
                                {liveOrders.length === 0 ? (
                                    <EmptyState
                                        title="Aucune commande en cours"
                                        description="Les commandes de vos clients s’afficheront ici dès leur paiement."
                                        icon={<ShoppingBag size={28} />}
                                    />
                                ) : (
                                    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                                        {liveOrders.slice(0, 6).map((order) => {
                                            const st = ORDER_STATUS_LABELS[order.order_status] ?? { label: 'Statut inconnu', variant: 'neutral' as BadgeVariant };
                                            return (
                                                <li key={order.id} className="flex items-center justify-between gap-3 p-4">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-semibold text-fg">{order.order_number}</span>
                                                            <Badge variant={st.variant} size="sm">{st.label}</Badge>
                                                        </div>
                                                        <p className="text-sm text-fg-muted">
                                                            {DELIVERY_MODE_LABELS[order.delivery_mode] ?? 'Commande'} ·{' '}
                                                            <time dateTime={order.created_at} className="text-sm">{formatDateTime(order.created_at)}</time>
                                                        </p>
                                                    </div>
                                                    <span className="flex-shrink-0 text-sm font-bold tabular-nums text-fg">{formatFcfa(order.total_amount)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <LinkButton href="/partner/orders" variant="ghost" size="sm">Toutes les commandes</LinkButton>
                            </section>
                        )}
                    </div>
                </>
            )}

            {closing && (
                <ClosingReportModal isOpen onClose={() => setClosing(null)} eventId={closing.id} eventTitle={closing.title} />
            )}
        </div>
    );
}
