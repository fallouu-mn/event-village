'use client';

/**
 * Lot 12d — liste des commandes de l'administration (GET /api/admin/orders) : puces de groupe (À décider, En cours,
 * Terminées, Annulées, Non payées, Toutes), recherche par numéro ou établissement, pagination servie par la base (« Page X
 * sur Y »), cartes sur téléphone et tableau sur ordinateur, pastilles « À décider », « Signalement », « Client absent ».
 * Le groupe, la recherche et la page restent dans l'adresse (lien de l'avis : /admin/orders?groupe=A_DECIDER). Montants
 * servis par la base, jamais calculés ici ; refus du serveur affichés tels quels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/ui/IntentLink';
import { AlertTriangle, ChevronLeft, ChevronRight, MessageSquareWarning, PackageSearch, Search, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextInput } from '@/components/ui/Field';
import { fetchJson, errorMessage } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { ADMIN_MODE_LABELS, ADMIN_ORDER_GROUPS, adminStateTone, label, type AdminOrderGroup, type AdminOrderList, type AdminOrderRow } from './order-admin-labels';

const EMPTY_TEXT: Record<AdminOrderGroup, { title: string; description: string }> = {
    A_DECIDER: { title: 'Rien à décider', description: 'Aucune absence de client ni aucun signalement n’attend l’équipe. Vous serez prévenu à chaque nouveau cas.' },
    EN_COURS: { title: 'Aucune commande en cours', description: 'Les commandes reçues, en préparation ou en route apparaîtront ici.' },
    TERMINEES: { title: 'Aucune commande terminée', description: 'Les commandes remises ou closes apparaîtront ici.' },
    ANNULEES: { title: 'Aucune commande annulée', description: 'Les commandes refusées, sans réponse ou annulées apparaîtront ici.' },
    NON_PAYEES: { title: 'Aucune commande non payée', description: 'Les commandes en attente de paiement ou jamais payées apparaîtront ici.' },
    TOUTES: { title: 'Aucune commande', description: 'Les commandes des établissements apparaîtront ici.' },
};

function Flags({ o }: { o: AdminOrderRow }) {
    return (
        <span className="flex flex-wrap gap-1.5">
            {o.to_decide && <Badge variant="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>À décider</Badge>}
            {o.issue_open && <Badge variant="danger" icon={<MessageSquareWarning size={14} aria-hidden="true" />}>Signalement</Badge>}
            {o.absence && o.absence !== 'DECIDEE' && <Badge variant="info" icon={<UserX size={14} aria-hidden="true" />}>Client absent</Badge>}
        </span>
    );
}

function writeUrl(group: AdminOrderGroup, q: string, page: number): void {
    const sp = new URLSearchParams();
    if (group !== 'TOUTES') sp.set('groupe', group);
    if (q) sp.set('q', q);
    if (page > 1) sp.set('page', String(page));
    const next = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`;
    window.history.replaceState(window.history.state, '', next);
}

export function AdminOrdersListView({ initialGroup, initialQuery, initialPage }: { initialGroup: AdminOrderGroup; initialQuery: string; initialPage: number }) {
    const [group, setGroup] = useState<AdminOrderGroup>(initialGroup);
    const [query, setQuery] = useState(initialQuery);
    const [typed, setTyped] = useState(initialQuery);
    const [page, setPage] = useState(initialPage);
    const [data, setData] = useState<AdminOrderList | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const seq = useRef(0);

    const load = useCallback(async () => {
        const mine = ++seq.current;
        setLoading(true);
        try {
            const sp = new URLSearchParams({ groupe: group, page: String(page) });
            if (query) sp.set('q', query);
            const body = await fetchJson<AdminOrderList>(`/api/admin/orders?${sp.toString()}`);
            if (mine !== seq.current) return;
            setData(body);
            setError(null);
        } catch (err) {
            if (mine !== seq.current) return;
            setError(errorMessage(err, 'Impossible de charger les commandes. Réessayez.'));
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [group, query, page]);

    useEffect(() => {
        writeUrl(group, query, page);
        void load();
    }, [group, query, page, load]);

    const chooseGroup = (g: AdminOrderGroup) => {
        setGroup(g);
        setPage(1);
    };
    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setQuery(typed.trim());
        setPage(1);
    };

    const columns: DataColumn<AdminOrderRow>[] = [
        {
            key: 'numero', header: 'Commande', hideOnCard: true,
            render: (o) => (
                <Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary-text underline-offset-4 hover:underline focus-visible:underline">
                    {o.order_number}
                </Link>
            ),
        },
        { key: 'etat', header: 'État', render: (o) => <Badge variant={adminStateTone(o.state)}>{o.stateLabel}</Badge> },
        { key: 'a-decider', header: 'À suivre', render: (o) => (o.to_decide || o.issue_open || (o.absence && o.absence !== 'DECIDEE') ? <Flags o={o} /> : '—') },
        {
            key: 'etablissement', header: 'Établissement',
            render: (o) => (
                <span className="break-words">
                    {o.venue_name}
                    {o.partner_name && o.partner_name !== o.venue_name && <span className="block text-sm text-muted-foreground">{o.partner_name}</span>}
                </span>
            ),
        },
        { key: 'mode', header: 'Remise', render: (o) => label(ADMIN_MODE_LABELS, o.mode) },
        { key: 'client', header: 'Client', render: (o) => <span className="break-words">{o.client_name ?? '—'}</span> },
        { key: 'quand', header: 'Créée le', render: (o) => <time dateTime={o.created_at} className="tabular-nums">{formatDateTime(o.created_at)}</time> },
        { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfa(o.goods_total)}</span> },
        { key: 'paye', header: 'Payé en ligne', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfa(o.paid)}</span> },
        { key: 'rembourse', header: 'Remboursé', align: 'right', render: (o) => <span className="tabular-nums">{o.refunded > 0 ? formatFcfa(o.refunded) : '—'}</span> },
    ];

    const pages = data?.pages ?? 1;
    const current = data?.page ?? page;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Commandes"
                description="Toutes les commandes des établissements : suivez les étapes, annulez et remboursez, décidez après l’absence d’un client et répondez aux signalements."
            />

            <div className="space-y-4">
                <div role="group" aria-label="Groupe de commandes" className="-mx-1 flex flex-wrap gap-2 px-1">
                    {ADMIN_ORDER_GROUPS.map((g) => (
                        <FilterChip key={g.id} pressed={group === g.id} onClick={() => chooseGroup(g.id)}>
                            {g.label}
                        </FilterChip>
                    ))}
                </div>
                <form onSubmit={submitSearch} role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <TextInput
                        label="Rechercher une commande"
                        hint="Numéro de commande, nom de l’établissement ou de la partenaire."
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        maxLength={80}
                        fieldClassName="sm:max-w-md sm:flex-1"
                        autoComplete="off"
                    />
                    <Button type="submit" variant="secondary" leftIcon={<Search size={18} aria-hidden="true" />} className="sm:mb-[1.625rem]">
                        Rechercher
                    </Button>
                </form>
            </div>

            {loading && !data ? (
                <div className="space-y-3" aria-busy="true" aria-label="Chargement des commandes">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
            ) : error && !data ? (
                <ErrorState description={error} onRetry={() => void load()} isRetrying={loading} />
            ) : data && (
                <div className={loading ? 'opacity-60 transition-opacity duration-fast ease-standard' : 'transition-opacity duration-fast ease-standard'} aria-busy={loading}>
                    {error && <p role="alert" className="mb-3 text-sm text-danger-text">{error}</p>}
                    <p className="mb-3 text-sm text-muted-foreground tabular-nums" aria-live="polite">
                        {data.total === 0 ? 'Aucune commande' : `${formatInteger(data.total)} commande${data.total > 1 ? 's' : ''}`}
                        {query ? ` pour « ${query} »` : ''}
                    </p>
                    <DataList
                        items={data.orders}
                        columns={columns}
                        getKey={(o) => o.id}
                        caption="Commandes des établissements"
                        breakpoint="xl"
                        renderCard={(o) => (
                            <Card className="p-4">
                                <Link href={`/admin/orders/${o.id}`} className="group block min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="break-all font-semibold text-foreground-strong">{o.order_number}</p>
                                            <p className="break-words text-sm text-muted-foreground">{o.venue_name} · {label(ADMIN_MODE_LABELS, o.mode)}</p>
                                        </div>
                                        <ChevronRight size={20} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-muted-foreground transition-transform duration-fast ease-standard motion-safe:group-hover:translate-x-0.5" />
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Badge variant={adminStateTone(o.state)}>{o.stateLabel}</Badge>
                                        <Flags o={o} />
                                    </div>
                                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                                        <dt className="text-muted-foreground">Total</dt>
                                        <dd className="text-right font-semibold tabular-nums text-foreground-strong">{formatFcfa(o.goods_total)}</dd>
                                        <dt className="text-muted-foreground">Payé en ligne</dt>
                                        <dd className="text-right tabular-nums">{formatFcfa(o.paid)}</dd>
                                        {o.refunded > 0 && (<><dt className="text-muted-foreground">Remboursé</dt><dd className="text-right tabular-nums">{formatFcfa(o.refunded)}</dd></>)}
                                        <dt className="text-muted-foreground">Créée le</dt>
                                        <dd className="text-right tabular-nums"><time dateTime={o.created_at}>{formatDateTime(o.created_at)}</time></dd>
                                        {o.client_name && (<><dt className="text-muted-foreground">Client</dt><dd className="break-words text-right">{o.client_name}</dd></>)}
                                    </dl>
                                </Link>
                            </Card>
                        )}
                        empty={<EmptyState illustrated icon={<PackageSearch size={32} aria-hidden="true" />} title={query ? 'Aucune commande trouvée' : EMPTY_TEXT[group].title} description={query ? 'Vérifiez le numéro ou le nom saisi, ou choisissez un autre groupe.' : EMPTY_TEXT[group].description} />}
                    />
                    {pages > 1 && (
                        <nav aria-label="Pages de la liste des commandes" className="mt-6 flex flex-wrap items-center justify-between gap-3">
                            <Button variant="secondary" onClick={() => setPage(Math.max(1, current - 1))} disabled={current <= 1 || loading} leftIcon={<ChevronLeft size={18} aria-hidden="true" />}>
                                Précédente
                            </Button>
                            <p className="order-first w-full text-center text-sm tabular-nums text-muted-foreground sm:order-none sm:w-auto" aria-live="polite">Page {formatInteger(current)} sur {formatInteger(pages)}</p>
                            <Button variant="secondary" onClick={() => setPage(Math.min(pages, current + 1))} disabled={current >= pages || loading} rightIcon={<ChevronRight size={18} aria-hidden="true" />}>
                                Suivante
                            </Button>
                        </nav>
                    )}
                </div>
            )}
        </div>
    );
}
