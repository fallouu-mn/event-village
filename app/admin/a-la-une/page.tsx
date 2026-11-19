'use client';

/**
 * /admin/a-la-une — design 1b (À LA UNE) : les événements que le super-administrateur met en tête de l'accueil, dans l'ordre.
 *  - Liste ordonnée : « Monter » et « Descendre » (boutons accessibles, sans glisser-déposer), état d'affichage, dates,
 *    motif, auteur ; « Dates » et « Retirer » (confirmation, « qui est prévenu », motif obligatoire).
 *  - « Ajouter un événement » : recherche parmi les événements publiés pas encore terminés, dates facultatives (heure de
 *    Dakar, bornées par la fin de l'événement), motif obligatoire, aperçu de l'étiquette « À la une ».
 *  - Historique des retraits (à la main ou automatiques : annulation, suspension, fin) et journal (qui, quand, quoi, motif).
 *  - Sans choix : l'accueil montre les plus vendus de la semaine (texte exact de l'état vide).
 * Chaque écriture demande le mot de passe et le code administrateur (useIdentityConfirm) ; le serveur décide toujours
 * (super-administrateur seulement, routes /api/admin/a-la-une/**). Page de l'administration : jamais mise en cache.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, History, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { useIdentityConfirm } from '@/components/admin/IdentityConfirm';
import { formatDateTime, formatEventDateTime, toDakarDateTimeLocal } from '@/lib/format';
import type { FeaturedAdminItem, FeaturedAdminList } from '@/lib/events/featured.server';
import { AddFeaturedDialog, FeaturedLabelPreview, RemoveDialog, WindowDialog } from './FeaturedDialogs';
import { displayStateMeta, journalActionLabel, moveItem, removalLabel } from './featured-labels';

const EMPTY_TEXT = 'Sans choix, l’accueil montre les événements les plus vendus de la semaine.';
const TABS_PREFIX = 'a-la-une';

function windowText(item: FeaturedAdminItem): string {
    if (!item.starts_at && !item.ends_at) return 'Affiché jusqu’à la fin de l’événement.';
    if (item.starts_at && item.ends_at) return `Affiché du ${formatDateTime(item.starts_at)} au ${formatDateTime(item.ends_at)}.`;
    if (item.starts_at) return `Affiché à partir du ${formatDateTime(item.starts_at)}, jusqu’à la fin de l’événement.`;
    return `Affiché jusqu’au ${formatDateTime(item.ends_at)}.`;
}

function Time({ iso }: { iso: string }) {
    return <time dateTime={toDakarDateTimeLocal(iso)} className="text-caption text-muted-foreground">{formatDateTime(iso)}</time>;
}

export default function AlaUnePage() {
    const { isLoading: authLoading, hasRole } = useAuth();
    const isSuperadmin = hasRole('SUPERADMIN');
    const toast = useToast();
    const { run, dialog: identityDialog } = useIdentityConfirm();
    const [data, setData] = useState<FeaturedAdminList | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [order, setOrder] = useState<FeaturedAdminItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [announce, setAnnounce] = useState('');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<FeaturedAdminItem | null>(null);
    const [removing, setRemoving] = useState<FeaturedAdminItem | null>(null);
    const [tab, setTab] = useState<'historique' | 'journal'>('historique');
    const focusAfterMove = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);
    const buttons = useRef(new Map<string, HTMLButtonElement>());

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const list = await fetchJson<FeaturedAdminList>('/api/admin/a-la-une');
            setData(list);
            setOrder(list.active);
        } catch (err) {
            setLoadError(errorMessage(err, 'La une n’a pas pu être chargée. Réessayez.'));
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isSuperadmin) void load();
    }, [authLoading, isSuperadmin, load]);

    // Après un déplacement : le focus reste sur le bouton utilisé, ou passe à l'autre s'il est devenu inactif (bord de liste).
    useEffect(() => {
        const want = focusAfterMove.current;
        if (!want) return;
        focusAfterMove.current = null;
        const index = order.findIndex((i) => i.id === want.id);
        if (index < 0) return;
        const atEdge = want.dir === 'up' ? index === 0 : index === order.length - 1;
        const dir = atEdge ? (want.dir === 'up' ? 'down' : 'up') : want.dir;
        buttons.current.get(`${want.id}:${dir}`)?.focus();
    }, [order]);

    const move = async (index: number, delta: -1 | 1) => {
        if (saving) return;
        const before = order;
        const next = moveItem(before, index, delta);
        const item = before[index];
        focusAfterMove.current = { id: item.id, dir: delta < 0 ? 'up' : 'down' };
        setOrder(next);
        setSaving(true);
        try {
            const reply = await run(() => sendJson<{ ok?: boolean }>('/api/admin/a-la-une/ordre', 'POST', { ids: next.map((i) => i.id) }));
            if (reply === null) {
                setOrder(before);
                return;
            }
            if (reply.ok !== true) throw new Error('ordre non confirmé');
            setAnnounce(`« ${item.title} » est maintenant en position ${index + delta + 1} sur ${next.length}.`);
            void load();
        } catch (err) {
            setOrder(before);
            if (err instanceof ApiError && err.code === 'ORDER_STALE') {
                toast.warning(err.message);
                void load();
            } else {
                toast.error(errorMessage(err, 'L’ordre n’a pas pu être enregistré. Réessayez.'));
            }
        } finally {
            setSaving(false);
        }
    };

    const reloadAfter = (close: () => void) => () => {
        close();
        void load();
    };

    const header = (
        <PageHeader
            title="À la une"
            description="Les événements que vous mettez en tête de l’accueil, dans cet ordre. Seuls les événements publiés et pas encore terminés peuvent y figurer ; ils en sortent tout seuls s’ils sont annulés, suspendus ou terminés."
            back={{ href: '/admin/dashboard', label: 'Accueil' }}
            actions={isSuperadmin && data ? (
                <Button variant="primary" leftIcon={<Plus size={18} aria-hidden="true" />} onClick={() => setAdding(true)}>Ajouter un événement</Button>
            ) : undefined}
        />
    );

    if (authLoading || (isSuperadmin && !data && !loadError)) {
        return (
            <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
                {header}
                <div role="status" aria-busy="true" aria-label="Chargement de la une" className="flex flex-col gap-3">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!isSuperadmin) {
        return (
            <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
                {header}
                <StatusBanner tone="info" icon={<ShieldAlert size={20} aria-hidden="true" />} title="Réservé au super-administrateur">
                    Seul le super-administrateur choisit les événements à la une de l’accueil.
                </StatusBanner>
            </div>
        );
    }

    if (loadError || !data) {
        return (
            <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
                {header}
                <ErrorState
                    title="La une n’a pas pu être chargée"
                    description={loadError ?? undefined}
                    isRetrying={retrying}
                    onRetry={() => { setRetrying(true); void load().finally(() => setRetrying(false)); }}
                />
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
            {header}

            <section aria-labelledby="etiquette-titre" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0 space-y-1">
                    <h2 id="etiquette-titre" className="text-base font-bold text-foreground-strong">Étiquette vue par les visiteurs</h2>
                    <p className="text-sm text-muted-foreground">Elle s’affiche sur la carte de chaque événement à la une. Le motif et votre nom ne sont jamais montrés.</p>
                </div>
                <FeaturedLabelPreview />
            </section>

            <section aria-labelledby="liste-titre" className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 id="liste-titre" className="text-lg font-bold tracking-tight text-foreground-strong">Sur l’accueil, dans cet ordre</h2>
                    {order.length > 0 && <p className="text-sm text-muted-foreground tabular-nums">{order.length} sur 20 au plus</p>}
                </div>
                <p aria-live="polite" className="sr-only">{announce}</p>

                {order.length === 0 ? (
                    <EmptyState
                        icon={<Sparkles size={28} aria-hidden="true" />}
                        title="Aucun événement à la une"
                        description={EMPTY_TEXT}
                        actionLabel="Ajouter un événement"
                        onAction={() => setAdding(true)}
                    />
                ) : (
                    <ol className="ev-stagger space-y-3" aria-label="Événements à la une, dans l’ordre de l’accueil">
                        {order.map((item, index) => {
                            const state = displayStateMeta(item.display_state);
                            return (
                                <li key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                                    <div className="flex gap-3 sm:gap-4">
                                        <span aria-hidden="true"
                                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-base font-bold text-primary-text tabular-nums">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="min-w-0 break-words text-base font-bold text-foreground-strong">
                                                    <span className="sr-only">Position {index + 1} : </span>{item.title}
                                                </h3>
                                                <Badge variant={state.variant} size="sm">{state.label}</Badge>
                                            </div>
                                            <p className="text-sm text-foreground">
                                                {formatEventDateTime(item.start_date, item.start_time)}{item.city ? ` · ${item.city}` : ''}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{windowText(item)} {state.help}</p>
                                            <p className="text-sm text-muted-foreground">
                                                <span className="font-semibold text-foreground">Motif : </span>{item.reason}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Ajouté par {item.created_by_name ?? 'un super-administrateur'}, le <Time iso={item.created_at} />
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                        <IconButton
                                            ref={(el) => { if (el) buttons.current.set(`${item.id}:up`, el); else buttons.current.delete(`${item.id}:up`); }}
                                            variant="secondary"
                                            aria-label={`Monter « ${item.title} »`}
                                            disabled={index === 0 || saving}
                                            onClick={() => void move(index, -1)}
                                        >
                                            <ArrowUp size={18} />
                                        </IconButton>
                                        <IconButton
                                            ref={(el) => { if (el) buttons.current.set(`${item.id}:down`, el); else buttons.current.delete(`${item.id}:down`); }}
                                            variant="secondary"
                                            aria-label={`Descendre « ${item.title} »`}
                                            disabled={index === order.length - 1 || saving}
                                            onClick={() => void move(index, 1)}
                                        >
                                            <ArrowDown size={18} />
                                        </IconButton>
                                        <div className="ml-auto flex flex-wrap gap-2">
                                            <Button variant="secondary" size="sm" leftIcon={<CalendarClock size={16} aria-hidden="true" />}
                                                onClick={() => setEditing(item)} aria-label={`Dates d’affichage de « ${item.title} »`}>
                                                Dates
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-danger-text hover:bg-danger-soft"
                                                leftIcon={<Trash2 size={16} aria-hidden="true" />}
                                                onClick={() => setRemoving(item)} aria-label={`Retirer « ${item.title} » de la une`}>
                                                Retirer
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            <section aria-labelledby="suivi-titre" className="space-y-3">
                <h2 id="suivi-titre" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground-strong">
                    <History size={20} aria-hidden="true" /> Suivi
                </h2>
                <Tabs
                    ariaLabel="Historique et journal de la une"
                    idPrefix={TABS_PREFIX}
                    value={tab}
                    onChange={(id) => setTab(id === 'journal' ? 'journal' : 'historique')}
                    tabs={[
                        { id: 'historique', label: 'Retirés', count: data.history.length },
                        { id: 'journal', label: 'Journal', count: data.journal.length },
                    ]}
                />
                {tab === 'historique' ? (
                    <TabPanel idPrefix={TABS_PREFIX} tabIdValue="historique">
                        {data.history.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun événement retiré pour l’instant.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                                {data.history.map((h) => (
                                    <li key={h.id} className="space-y-1 p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="min-w-0 break-words text-sm font-semibold text-foreground-strong">{h.title}</span>
                                            <Badge variant="neutral" size="sm">{removalLabel(h.removed_code)}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {h.removed_by_name ? `Retiré par ${h.removed_by_name}` : 'Retiré automatiquement'}, le <Time iso={h.removed_at} />
                                        </p>
                                        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Motif : </span>{h.removed_reason}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </TabPanel>
                ) : (
                    <TabPanel idPrefix={TABS_PREFIX} tabIdValue="journal">
                        {data.journal.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune action pour l’instant.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                                {data.journal.map((j) => (
                                    <li key={j.id} className="space-y-1 p-4">
                                        <p className="text-sm text-foreground-strong">
                                            <span className="font-semibold">{journalActionLabel(j.action)}</span>
                                            {j.event_title ? ` · ${j.event_title}` : ''}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {j.actor_name ?? 'Automatique'}, le <Time iso={j.created_at} />
                                        </p>
                                        {j.reason && <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Motif : </span>{j.reason}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </TabPanel>
                )}
            </section>

            {adding && <AddFeaturedDialog onClose={() => setAdding(false)} onAdded={reloadAfter(() => setAdding(false))} />}
            {editing && <WindowDialog item={editing} onClose={() => setEditing(null)} onSaved={reloadAfter(() => setEditing(null))} />}
            {removing && <RemoveDialog item={removing} onClose={() => setRemoving(null)} onRemoved={reloadAfter(() => setRemoving(null))} />}
            {identityDialog}
        </div>
    );
}
