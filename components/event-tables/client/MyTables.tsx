'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookUser, Check, Clock, MessageCircle, Plus, Undo2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { TransferModal, type TransferTicketData } from '@/components/tickets/TransferModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDateTime, formatFcfa } from '@/lib/format';
import { readInviteNames, saveInviteName } from '@/lib/device/table-prefs';
import { isRecord, nonEmptyString, readAmount, readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';

/**
 * Lot 11c-b — « Ma table », onglet « Tables » de Mes billets (chargé à la demande par components/event-tables/client/load.ts).
 *
 *  - Une carte par table (GET /api/event-tables) : événement, « Table 12 · Carré VIP », une rangée de places (vous et vos
 *    invités) : place envoyée = avatar plein aux initiales de l'invité, en attente = pointillés et « •• 42 », à envoyer =
 *    pointillés et « + Inviter », entrée = coche. Un avatar se remplit (courte animation, coupée si « réduire les
 *    animations ») quand l'invité accepte sa place.
 *  - Envoi d'une place par le transfert existant (numéro, prénom gardé sur ce téléphone), par le carnet du téléphone quand
 *    le navigateur le permet (Contact Picker), ou annonce par WhatsApp (lien du serveur, sans jeton : la place elle-même
 *    arrive par le transfert).
 *  - Compteurs du serveur : « 4/6 places envoyées », puis « 2/6 entrés » le soir même.
 *  - Après un report de plus de 24 h : « Me faire rembourser la table », montant du serveur affiché avant de confirmer.
 *  - Aucun nombre de places ni montant calculé ici.
 */

// Fenêtres importées directement : ce module est déjà chargé à la demande (aucun import() de plus, leçon du lot poids)

type SeatState = 'ENVOYEE' | 'EN_ATTENTE' | 'A_ENVOYER' | 'ENTREE' | 'REMBOURSEE' | 'ANNULEE';
interface Seat { ticketId: string; state: SeatState; mine: boolean; guest: string | null; pendingTo: string | null; pendingUntil: string | null }
interface MyTable {
    bookingId: string;
    status: string;
    tableNumber: number;
    seats: number;
    typeName: string;
    zone: string | null;
    total: number | null;
    event: { id: string; title: string; status: string; startAt: string | null; location: string | null };
    counts: { sent: number; pending: number; toSend: number; entered: number };
    seatsDetail: Seat[];
    refund: { open: boolean; until: string | null; amount: number | null };
    whatsappUrl: string | null;
    inviteLeft: number;
}

const SEAT_STATES = new Set<SeatState>(['ENVOYEE', 'EN_ATTENTE', 'A_ENVOYER', 'ENTREE', 'REMBOURSEE', 'ANNULEE']);
const NETWORK = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

function readSeat(raw: unknown): Seat | null {
    if (!isRecord(raw)) return null;
    const ticketId = nonEmptyString(raw.ticket_id);
    const state = typeof raw.state === 'string' && SEAT_STATES.has(raw.state as SeatState) ? raw.state as SeatState : null;
    if (!ticketId || !state) return null;
    return { ticketId, state, mine: raw.mine === true, guest: nonEmptyString(raw.guest), pendingTo: nonEmptyString(raw.pending_to), pendingUntil: nonEmptyString(raw.pending_until) };
}

function readTable(raw: unknown): MyTable | null {
    if (!isRecord(raw) || !isRecord(raw.event) || !isRecord(raw.counts) || !Array.isArray(raw.seats_detail)) return null;
    const bookingId = nonEmptyString(raw.booking_id);
    const tableNumber = readAmount(raw.table_number);
    const seats = readAmount(raw.seats);
    const eventId = nonEmptyString(raw.event.id);
    if (!bookingId || tableNumber === null || seats === null || !eventId) return null;
    const seatsDetail = raw.seats_detail.map(readSeat);
    if (seatsDetail.some((s) => s === null)) return null;
    const refund = isRecord(raw.refund) ? raw.refund : {};
    const n = (v: unknown) => readAmount(v) ?? 0;
    return {
        bookingId, tableNumber, seats, status: nonEmptyString(raw.status) ?? 'ACTIVE',
        typeName: nonEmptyString(raw.type_name) ?? 'Table', zone: nonEmptyString(raw.zone), total: readAmount(raw.total),
        event: { id: eventId, title: nonEmptyString(raw.event.title) ?? 'Événement', status: nonEmptyString(raw.event.status) ?? 'PUBLIE', startAt: nonEmptyString(raw.event.start_at), location: nonEmptyString(raw.event.location) },
        counts: { sent: n(raw.counts.sent), pending: n(raw.counts.pending), toSend: n(raw.counts.to_send), entered: n(raw.counts.entered) },
        seatsDetail: seatsDetail as Seat[],
        refund: { open: refund.open === true, until: nonEmptyString(refund.until), amount: readAmount(refund.amount) },
        whatsappUrl: nonEmptyString(raw.whatsapp_url),
        inviteLeft: n(raw.invite_left),
    };
}

function initialsOf(name: string | null): string {
    if (!name) return '';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toLocaleUpperCase('fr-FR')).join('');
}

/** Le soir même (jour de Dakar) : les entrées comptent. Affichage seulement. */
function isEventDay(startAt: string | null): boolean {
    if (!startAt) return false;
    const day = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
    return day(new Date(startAt)) === day(new Date());
}

type ContactsApi = { select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> };
function contactsApi(): ContactsApi | null {
    if (typeof navigator === 'undefined') return null;
    const c = (navigator as Navigator & { contacts?: ContactsApi }).contacts;
    return c && typeof c.select === 'function' ? c : null;
}

export interface MyTablesTicketInfo { ticketNumber: string; seat?: string; dateFormatted?: string; timeFormatted?: string; venue?: string }

export function MyTables({ focusId, ticketInfo, refreshKey, onChanged }: {
    focusId: string | null;
    /** Billets du compte (Mes billets) : numéro et libellés d'une place, pour la fenêtre de transfert. */
    ticketInfo: (ticketId: string) => MyTablesTicketInfo | null;
    /** Change quand la liste des billets est relue (temps réel de Mes billets) : « Ma table » est relue aussi. */
    refreshKey: unknown;
    onChanged: () => void;
}) {
    const toast = useToast();
    const { profile } = useAuth();
    const [tables, setTables] = useState<MyTable[]>([]);
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [names, setNames] = useState<Record<string, string>>({});
    const [transfer, setTransfer] = useState<{ ticket: TransferTicketData; phone?: string; name?: string } | null>(null);
    const [refundOf, setRefundOf] = useState<MyTable | null>(null);
    const [refunding, setRefunding] = useState(false);
    const [canPickContact, setCanPickContact] = useState(false);
    const listRef = useRef<HTMLUListElement>(null);
    const prevStates = useRef(new Map<string, SeatState>());
    const focusedRef = useRef(false);

    useEffect(() => { setNames(readInviteNames()); setCanPickContact(contactsApi() !== null); }, []);

    const load = useCallback(async (mode: 'initial' | 'silent') => {
        let res: Response;
        try {
            res = await fetch('/api/event-tables', { cache: 'no-store' });
        } catch (err) {
            console.error('[ma table] liste injoignable :', err instanceof Error ? err.message : String(err));
            if (mode === 'initial') { setError(NETWORK); setPhase('error'); }
            return;
        }
        const body = await readJsonBody(res, 'ma-table/liste');
        const items = res.ok && isRecord(body) && Array.isArray(body.items) ? body.items.map(readTable) : null;
        if (!items || items.some((t) => t === null)) {
            if (res.ok) console.error('[ma table] réponse illisible :', body);
            if (mode === 'initial') { setError(serverErrorMessage(body) ?? 'Vos tables ne peuvent pas être affichées pour le moment.'); setPhase('error'); }
            return;
        }
        setTables(items as MyTable[]);
        setPhase('ready');
        setError(null);
    }, []);

    useEffect(() => { void load('initial'); }, [load]);
    const firstKey = useRef(true);
    useEffect(() => {
        if (firstKey.current) { firstKey.current = false; return; }
        void load('silent');
    }, [refreshKey, load]);

    // Avatar qui se remplit quand une place est acceptée (échelle et opacité, 260 ms)
    useEffect(() => {
        const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const next = new Map<string, SeatState>();
        for (const t of tables) for (const s of t.seatsDetail) next.set(s.ticketId, s.state);
        if (!reduce && listRef.current) {
            for (const [id, state] of next) {
                const before = prevStates.current.get(id);
                if (before && before !== state && (state === 'ENVOYEE' || state === 'ENTREE')) {
                    listRef.current.querySelector<HTMLElement>(`[data-seat="${CSS.escape(id)}"]`)?.animate(
                        [{ scale: '0.7', opacity: 0.4 }, { scale: '1.08', opacity: 1 }, { scale: '1', opacity: 1 }],
                        { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
                    );
                }
            }
        }
        prevStates.current = next;
    }, [tables]);

    // Table demandée dans l'adresse (?table=…) : amenée à l'écran une fois
    useEffect(() => {
        if (focusedRef.current || phase !== 'ready' || !focusId) return;
        focusedRef.current = true;
        const el = document.getElementById(`table-${focusId}`);
        if (el) {
            el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            el.focus({ preventScroll: true });
        }
    }, [phase, focusId]);

    const openTransfer = (table: MyTable, seat: Seat, phone?: string, name?: string) => {
        const info = ticketInfo(seat.ticketId);
        setTransfer({
            ticket: {
                id: seat.ticketId,
                ticketNumber: info?.ticketNumber ?? '',
                eventTitle: table.event.title,
                dateFormatted: info?.dateFormatted,
                timeFormatted: info?.timeFormatted,
                seat: info?.seat ?? `Table ${table.tableNumber}`,
                venue: info?.venue ?? table.event.location ?? undefined,
            },
            phone,
            name,
        });
    };

    const pickContact = async (table: MyTable, seat: Seat) => {
        const api = contactsApi();
        if (!api) { openTransfer(table, seat); return; }
        try {
            const [contact] = await api.select(['name', 'tel'], { multiple: false });
            if (!contact) return;
            openTransfer(table, seat, contact.tel?.[0]?.replace(/[^\d+]/g, ''), contact.name?.[0]);
        } catch (err) {
            console.warn('[ma table] carnet du téléphone indisponible :', err instanceof Error ? err.message : String(err));
            openTransfer(table, seat);
        }
    };

    const confirmRefund = async () => {
        if (!refundOf || refunding) return;
        setRefunding(true);
        try {
            const res = await fetch(`/api/event-tables/${encodeURIComponent(refundOf.bookingId)}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true }),
            });
            const body = await readJsonBody(res, 'ma-table/remboursement');
            if (res.ok) {
                toast.success('Remboursement demandé : il est versé sur le compte Mobile Money qui a payé.');
                setRefundOf(null);
                await load('silent');
                onChanged();
                return;
            }
            toast.error(serverErrorMessage(body) ?? 'Le remboursement n’a pas pu être demandé. Réessayez dans un instant.');
        } catch (err) {
            console.error('[ma table] remboursement injoignable :', err instanceof Error ? err.message : String(err));
            toast.error(NETWORK);
        } finally {
            setRefunding(false);
        }
    };

    const myInitials = useMemo(() => initialsOf([profile?.first_name, profile?.last_name].filter(Boolean).join(' ')) || 'V', [profile?.first_name, profile?.last_name]);

    if (phase === 'loading') {
        return (
            <div className="space-y-4" aria-busy="true">
                <span className="sr-only">Chargement de vos tables…</span>
                <div className="h-48 rounded-2xl bg-muted" />
            </div>
        );
    }
    if (phase === 'error') {
        return <ErrorState title="Impossible d’afficher vos tables" description={error ?? NETWORK} isRetrying={retrying} onRetry={() => { setRetrying(true); void load('initial').finally(() => setRetrying(false)); }} />;
    }
    if (tables.length === 0) {
        return (
            <EmptyState
                illustrated
                title="Aucune table pour le moment"
                description="Réservez une table depuis la fiche d’un événement : vos places à envoyer à vos invités apparaîtront ici."
                actionLabel="Explorer les événements"
                actionHref="/explore"
            />
        );
    }

    const missingFocus = focusId !== null && !tables.some((t) => t.bookingId === focusId);

    return (
        <>
            {missingFocus && <StatusBanner tone="neutral" title="Table introuvable">Cette table n’est pas dans votre compte.</StatusBanner>}
            <ul ref={listRef} className="ev-stagger grid gap-4 md:grid-cols-2" aria-label="Mes tables">
                {tables.map((table) => {
                    const active = table.status === 'ACTIVE';
                    const label = `Table ${table.tableNumber}${table.zone || table.typeName ? ` · ${table.zone ?? table.typeName}` : ''}`;
                    const ownIndex = table.seatsDetail.findIndex((s) => s.mine && (s.state === 'A_ENVOYER' || s.state === 'ENTREE'));
                    const firstFree = table.seatsDetail.find((s, i) => i !== ownIndex && s.state === 'A_ENVOYER') ?? null;
                    const eventDay = isEventDay(table.event.startAt);
                    const canInvite = active && table.event.status === 'PUBLIE';
                    return (
                        <li key={table.bookingId}>
                            <article
                                id={`table-${table.bookingId}`}
                                tabIndex={-1}
                                aria-label={`${label}, ${table.event.title}`}
                                className={cn('scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring', focusId === table.bookingId ? 'border-primary' : 'border-border')}
                            >
                                <div className="space-y-1 bg-primary-soft px-4 pb-4 pt-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="min-w-0 flex-1 break-words text-sm font-semibold text-primary-text">{table.event.title}</p>
                                        {!active && <Badge variant="neutral" size="sm">Remboursée</Badge>}
                                        {table.event.status !== 'PUBLIE' && <StatusBadge domain="event" status={table.event.status} size="sm" />}
                                    </div>
                                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground-strong">{label}</h2>
                                    <p className="text-sm text-foreground">
                                        {table.event.startAt ? <time dateTime={table.event.startAt}>{formatDateTime(table.event.startAt)}</time> : null}
                                        {table.event.location ? ` · ${table.event.location}` : ''}
                                    </p>
                                </div>

                                <div className="space-y-4 p-4">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                        <p className="font-semibold tabular-nums text-foreground-strong">
                                            <Users size={16} aria-hidden="true" className="mr-1.5 inline align-[-3px]" />
                                            {table.counts.sent}/{table.seats} places envoyées
                                        </p>
                                        {table.counts.pending > 0 && <p className="tabular-nums text-muted-foreground">{table.counts.pending} en attente</p>}
                                        {(eventDay || table.counts.entered > 0) && (
                                            <p className="font-semibold tabular-nums text-success-text">
                                                <Check size={16} aria-hidden="true" className="mr-1 inline align-[-3px]" />
                                                {table.counts.entered}/{table.seats} entrés
                                            </p>
                                        )}
                                    </div>

                                    <ul className="flex flex-wrap gap-3" aria-label="Places de la table">
                                        {table.seatsDetail.map((seat, i) => {
                                            const own = i === ownIndex;
                                            const localName = names[seat.ticketId] ?? null;
                                            const base = 'relative flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold';
                                            let face: React.ReactNode;
                                            let caption: string;
                                            if (own) {
                                                face = <span data-seat={seat.ticketId} className={cn(base, 'bg-primary text-primary-foreground')}>{myInitials}</span>;
                                                caption = seat.state === 'ENTREE' ? 'Vous, entré' : 'Vous';
                                            } else if (seat.state === 'ENVOYEE' || (seat.state === 'ENTREE' && !seat.mine)) {
                                                face = <span data-seat={seat.ticketId} className={cn(base, 'bg-success-soft text-success-text ring-2 ring-success-border')}>{initialsOf(seat.guest) || <Users size={18} aria-hidden="true" />}</span>;
                                                caption = seat.guest ?? 'Invité';
                                            } else if (seat.state === 'ENTREE') {
                                                face = <span data-seat={seat.ticketId} className={cn(base, 'bg-success-soft text-success-text ring-2 ring-success-border')}><Check size={18} aria-hidden="true" /></span>;
                                                caption = 'Entré avec vous';
                                            } else if (seat.state === 'EN_ATTENTE') {
                                                face = <span data-seat={seat.ticketId} className={cn(base, 'border-2 border-dashed border-warning-border bg-warning-soft text-warning-text')}>{initialsOf(localName) || <Clock size={18} aria-hidden="true" />}</span>;
                                                caption = `${localName ?? 'En attente'} ${seat.pendingTo ?? ''}`.trim();
                                            } else if (seat.state === 'A_ENVOYER' && canInvite) {
                                                return (
                                                    <li key={seat.ticketId} className="flex w-16 flex-col items-center gap-1 text-center">
                                                        <button
                                                            type="button"
                                                            data-seat={seat.ticketId}
                                                            onClick={() => openTransfer(table, seat)}
                                                            aria-label={`Inviter quelqu’un à la place ${i + 1} de la table ${table.tableNumber}`}
                                                            className={cn(base, 'ev-press border-2 border-dashed border-input bg-card text-primary-text hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                                                        >
                                                            <Plus size={20} aria-hidden="true" />
                                                        </button>
                                                        <small aria-hidden="true" className="text-caption font-semibold text-primary-text">Inviter</small>
                                                    </li>
                                                );
                                            } else {
                                                face = <span data-seat={seat.ticketId} className={cn(base, 'border-2 border-dashed border-input bg-muted text-muted-foreground')}>{i + 1}</span>;
                                                caption = seat.state === 'REMBOURSEE' ? 'Remboursée' : seat.state === 'ANNULEE' ? 'Annulée' : 'Libre';
                                            }
                                            return (
                                                <li key={seat.ticketId} className="flex w-16 flex-col items-center gap-1 text-center">
                                                    {face}
                                                    <small className="w-full break-words text-caption text-muted-foreground">{caption}</small>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {canInvite && table.inviteLeft > 0 && firstFree && (
                                        <div className="space-y-3 rounded-xl border border-border bg-muted p-3">
                                            <p className="text-base font-semibold text-foreground-strong">
                                                {table.inviteLeft > 1 ? `Envoyez vos ${table.inviteLeft} places` : 'Envoyez votre dernière place'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">Chaque invité reçoit son billet par SMS sur son numéro. Vous pouvez aussi faire entrer vos invités avec vous.</p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={() => openTransfer(table, firstFree)}>Inviter par son numéro</Button>
                                                {canPickContact && (
                                                    <Button variant="secondary" size="sm" leftIcon={<BookUser size={16} />} onClick={() => void pickContact(table, firstFree)}>Depuis mes contacts</Button>
                                                )}
                                                {table.whatsappUrl && (
                                                    <a href={table.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground-strong hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2">
                                                        <MessageCircle size={16} aria-hidden="true" className="text-success-text" />
                                                        Prévenir mes invités par WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {active && table.refund.open && table.refund.amount !== null && (
                                        <StatusBanner
                                            tone="info"
                                            title="La soirée a été reportée de plus de 24 h"
                                            action={(
                                                <Button variant="secondary" size="sm" leftIcon={<Undo2 size={16} />} onClick={() => setRefundOf(table)}>
                                                    Me faire rembourser la table
                                                </Button>
                                            )}
                                        >
                                            Vous pouvez demander le remboursement de toute la table (<span className="tabular-nums">{formatFcfa(table.refund.amount)}</span>){table.refund.until ? `, jusqu’au ${formatDateTime(table.refund.until)}` : ''}.
                                        </StatusBanner>
                                    )}
                                </div>
                            </article>
                        </li>
                    );
                })}
            </ul>

            {transfer && (
                <TransferModal
                    isOpen
                    ticket={transfer.ticket}
                    initialRecipient={transfer.phone}
                    guestName={{
                        initial: transfer.name,
                        onSent: (name) => { saveInviteName(transfer.ticket.id, name); setNames(readInviteNames()); },
                    }}
                    onClose={() => setTransfer(null)}
                    onTransferSuccess={() => { void load('silent'); onChanged(); }}
                />
            )}

            {refundOf && refundOf.refund.amount !== null && (
                <ConfirmDialog
                    isOpen
                    onClose={() => setRefundOf(null)}
                    onConfirm={() => { void confirmRefund(); }}
                    title="Me faire rembourser la table ?"
                    message={`Remboursement de ${formatFcfa(refundOf.refund.amount)}, frais de service compris, sur le compte Mobile Money qui a payé. Toutes les places de la table ${refundOf.tableNumber} seront annulées, celles de vos invités aussi.`}
                    confirmLabel="Me faire rembourser"
                    cancelLabel="Garder ma table"
                    variant="warning"
                    isLoading={refunding}
                />
            )}
        </>
    );
}
