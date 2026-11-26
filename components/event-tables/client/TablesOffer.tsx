'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ExternalLink, LayoutGrid, Loader2, Map as MapIcon, PartyPopper, RefreshCw, Sparkles, Users, Wine } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { PhoneVerifyDialog } from '@/components/tickets/PhoneVerifyDialog';
import { formatFcfa } from '@/lib/format';
import { isRecord, nonEmptyString, readAmount, readJsonBody, serverErrorMessage, operatorLabel } from '@/lib/payments/payment-client';
import type { SamirPayOperatorName } from '@/lib/samirpay/types';
import type { TablesEventInfo } from '@/components/event-page/TicketingSwitch';
import { HoldCountdown } from './HoldCountdown';
import { PayStep, type StartedPayment } from './PayStep';
import { PlanDialog } from './PlanDialog';
import { PlanView } from './PlanView';
import { TableConfirmed, type ConfirmedTable } from './TableConfirmed';
import {
    perPersonText,
    readOffer,
    readPaymentPoll,
    readQuote,
    remainingText,
    saveChoice,
    takeChoice,
    type Offer,
    type OfferType,
    type TableQuote,
} from './offer-api';

/**
 * Lot 11c-b — onglet « Tables » de la fiche d'un événement (chargé à la demande, components/event-tables/client/load.ts).
 *
 *  - Offre relue sur le serveur à l'ouverture et à chaque signal temps réel du stock des types (public_category_stock de
 *    l'événement, signal existant : attente, vente, libération). Une ligne par type : nom, places, prix de la table, prix
 *    par personne en petit, ce qui est compris, minimum sur place (indiqué seulement), tables restantes vraies.
 *  - Avec plan : le client choisit SA table sur le plan (fenêtre plein écran : feuille du bas sur téléphone, panneau
 *    collant à droite sur ordinateur). Sans plan : il choisit un type, le numéro est donné après le paiement.
 *  - Devis de la base (prix, frais, total), un seul grand bouton « Réserver la table 12 » ; connexion par le parcours
 *    existant (choix gardé 30 minutes), numéro vérifié par le parcours existant ; paiement Wave ou Orange Money, puis
 *    « Table gardée 9:42 » (expires_at du serveur) jusqu'à la confirmation : coche animée, carte de la table, « Envoyez
 *    vos 5 places ».
 *  - Une table prise pendant qu'on regarde : courte animation sur le plan et « La table 7 vient d'être prise ».
 *  - Aucun montant ni nombre de places calculé ici ; refus du serveur affichés tels quels.
 */

type Step = 'choose' | 'pay' | 'waiting' | 'done';
interface QuoteState { key: string; quote: TableQuote | null; error: string | null }

const NETWORK = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const FINAL_FAILED = new Set(['FAILED', 'CANCELLED', 'EXPIRED']);
const POLL_MS = 3_000;

const TONE_TEXT = { success: 'text-success-text', warning: 'text-warning-text', danger: 'text-danger-text' } as const;

async function fetchOffer(eventId: string): Promise<{ ok: true; offer: Offer } | { ok: false; message: string }> {
    let res: Response;
    try {
        res = await fetch(`/api/events/${encodeURIComponent(eventId)}/tables`, { cache: 'no-store' });
    } catch (err) {
        console.error('[tables] offre injoignable :', err instanceof Error ? err.message : String(err));
        return { ok: false, message: NETWORK };
    }
    const body = await readJsonBody(res, 'tables/offre');
    const offer = res.ok ? readOffer(body) : null;
    if (!offer) {
        if (res.ok) console.error('[tables] offre illisible :', body);
        return { ok: false, message: serverErrorMessage(body) ?? 'Les tables ne peuvent pas être affichées pour le moment.' };
    }
    return { ok: true, offer };
}

function TypeFacts({ type }: { type: OfferType }) {
    const remaining = remainingText(type.remainingTables);
    return (
        <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-lg font-bold tabular-nums text-foreground-strong">{formatFcfa(type.price)}</p>
                <span className="text-sm text-muted-foreground">la table</span>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">{perPersonText(formatFcfa(type.pricePerPerson), type.pricePerPersonExact)}</p>
            {type.includedText && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground">
                    <Wine size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-primary-text" />
                    <span><span className="font-semibold">Compris : </span>{type.includedText}</span>
                </p>
            )}
            {type.onsiteNote && (
                <p className="mt-1 text-sm text-muted-foreground"><span className="font-semibold">Sur place : </span>{type.onsiteNote}</p>
            )}
            <p className={cn('mt-2 text-sm font-semibold', type.refusal ? 'text-muted-foreground' : TONE_TEXT[remaining.tone])}>
                {type.refusal ?? remaining.text}
            </p>
        </>
    );
}

export function TablesOffer({ event, active }: { event: TablesEventInfo; active: boolean }) {
    const router = useRouter();
    const toast = useToast();
    const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
    const eventId = event.id;

    const [offer, setOffer] = useState<Offer | null>(null);
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [typeId, setTypeId] = useState<string | null>(null);
    const [tableId, setTableId] = useState<string | null>(null);
    const [planOpen, setPlanOpen] = useState(false);
    const [step, setStep] = useState<Step>('choose');
    const [operator, setOperator] = useState<SamirPayOperatorName | null>(null);
    const [quoteState, setQuoteState] = useState<QuoteState | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [justTaken, setJustTaken] = useState<string[]>([]);
    const [payment, setPayment] = useState<StartedPayment | null>(null);
    const [confirmed, setConfirmed] = useState<ConfirmedTable | null>(null);
    const [failedPayment, setFailedPayment] = useState<string | null>(null);
    const [verifyRetry, setVerifyRetry] = useState<(() => void) | null>(null);
    const [details, setDetails] = useState(false);

    const offerRef = useRef<Offer | null>(null);
    const stepRef = useRef<Step>('choose');
    const selRef = useRef<{ typeId: string | null; tableId: string | null }>({ typeId: null, tableId: null });
    stepRef.current = step;
    selRef.current = { typeId, tableId };

    const say = useCallback((text: string) => {
        setNotice(text);
    }, []);
    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(null), 5_000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    // ── Offre (et tables prises pendant qu'on regarde) ─────────────────────────────────────────────────────────────

    const applyOffer = useCallback((next: Offer) => {
        const prev = offerRef.current;
        offerRef.current = next;
        setOffer(next);
        setPhase('ready');
        setLoadError(null);
        // Paiement lancé ou confirmé : la table choisie est tenue par CE client (elle passe « prise » pour les autres)
        const holding = stepRef.current === 'waiting' || stepRef.current === 'done';
        const { typeId: selType, tableId: selTable } = selRef.current;
        if (prev) {
            const before = new Map(prev.tables.map((t) => [t.id, t.state]));
            const taken = next.tables.filter((t) => before.get(t.id) === 'LIBRE' && t.state === 'PRISE' && !(holding && t.id === selTable));
            if (taken.length > 0) {
                setJustTaken(taken.map((t) => t.id));
                const mine = taken.find((t) => t.id === selTable);
                if (mine) {
                    setTableId(null);
                    if (stepRef.current === 'pay') setStep('choose');
                    say(`La table ${mine.number} vient d’être prise. Choisissez-en une autre.`);
                } else {
                    say(taken.length === 1 ? `La table ${taken[0].number} vient d’être prise.` : `Les tables ${taken.map((t) => t.number).join(', ')} viennent d’être prises.`);
                }
            }
        }
        // Sans plan : type devenu complet ou retiré pendant le choix
        if (!holding && selType && !next.planEnabled) {
            const type = next.types.find((t) => t.id === selType);
            if (!type || type.remainingTables <= 0 || type.refusal) {
                setTypeId(null);
                if (stepRef.current === 'pay') setStep('choose');
                say(type ? `Toutes les tables « ${type.name} » sont prises.` : 'Ce type de table n’est plus en vente.');
            }
        }
    }, [say]);

    const refresh = useCallback(async () => {
        const r = await fetchOffer(eventId);
        if (r.ok) applyOffer(r.offer);
        else if (!offerRef.current) { setLoadError(r.message); setPhase('error'); }
        else console.warn('[tables] offre non relue :', r.message);
    }, [eventId, applyOffer]);

    useEffect(() => { void refresh(); }, [refresh]);

    const { status: liveStatus } = useRealtimeRefresh({
        channelKey: `tables-evenement-${eventId}`,
        subscriptions: [{ table: 'public_category_stock', filter: `event_id=eq.${eventId}` }],
        onSignal: refresh,
        enabled: active && phase === 'ready' && step !== 'done',
    });

    // Retour de la connexion : choix gardé repris s'il est encore possible (une seule fois)
    const restoredRef = useRef(false);
    useEffect(() => {
        if (restoredRef.current || !offer || authLoading) return;
        restoredRef.current = true;
        const saved = takeChoice(eventId);
        if (!saved) return;
        const type = offer.types.find((t) => t.id === saved.typeId);
        const table = saved.tableId ? offer.tables.find((t) => t.id === saved.tableId) : null;
        if (!type || type.refusal || type.remainingTables <= 0 || (saved.tableId && (!table || table.state !== 'LIBRE'))) {
            toast.info('La table choisie avant la connexion n’est plus disponible : choisissez-en une autre.');
            return;
        }
        setTypeId(type.id);
        setTableId(table ? table.id : null);
        if (offer.planEnabled) setPlanOpen(true);
        toast.info('Votre choix est repris : vérifiez-le puis réservez.');
    }, [offer, authLoading, eventId, toast]);

    // ── Devis du serveur (type, table, opérateur) ─────────────────────────────────────────────────────────────────

    const quoteKey = typeId ? `${typeId}|${tableId ?? ''}|${operator ?? ''}` : null;
    useEffect(() => {
        if (!quoteKey || !typeId || (step !== 'choose' && step !== 'pay')) return undefined;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/tables/quote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ typeId, tableId, operator }),
                    signal: controller.signal,
                });
                const body = await readJsonBody(res, 'tables/devis');
                if (controller.signal.aborted) return;
                const quote = res.ok ? readQuote(body) : null;
                if (!quote) {
                    if (res.ok) console.error('[tables] devis illisible :', body);
                    setQuoteState({ key: quoteKey, quote: null, error: serverErrorMessage(body) ?? 'Le prix n’a pas pu être calculé. Réessayez dans un instant.' });
                    return;
                }
                if (quote.table && quote.table.state !== 'LIBRE' && stepRef.current === 'choose') {
                    setTableId(null);
                    say(`La table ${quote.table.number} vient d’être prise. Choisissez-en une autre.`);
                    void refresh();
                    return;
                }
                setQuoteState({ key: quoteKey, quote, error: null });
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('[tables] devis impossible :', err instanceof Error ? err.message : String(err));
                setQuoteState({ key: quoteKey, quote: null, error: 'Connexion impossible : le prix n’a pas pu être calculé.' });
            }
        }, 150);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [quoteKey, typeId, tableId, operator, eventId, step, say, refresh]);

    const quote = quoteState && quoteState.key === quoteKey ? quoteState.quote : null;
    const quoteError = quoteState && quoteState.key === quoteKey ? quoteState.error : null;
    const quoteLoading = Boolean(quoteKey) && !quote && !quoteError;

    // ── Attente du paiement puis confirmation ────────────────────────────────────────────────────────────────────

    const finishWith = useCallback(async (bookingId: string, amount: number) => {
        const res = await fetch(`/api/event-tables/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
        const body = await readJsonBody(res, 'tables/ma-table');
        const table = res.ok && isRecord(body) && isRecord(body.table) ? body.table : null;
        const number = table ? readAmount(table.table_number) : null;
        const seats = table ? readAmount(table.seats) : null;
        const inviteLeft = table ? readAmount(table.invite_left) : null;
        if (!table || number === null || seats === null || inviteLeft === null) {
            console.error('[tables] table payée illisible :', body);
            return false;
        }
        const place = nonEmptyString(table.zone) ?? nonEmptyString(table.type_name);
        setConfirmed({ bookingId, label: `Table ${number}${place ? ` · ${place}` : ''}`, seats, amount, inviteLeft });
        setStep('done');
        return true;
    }, []);

    useEffect(() => {
        if (step !== 'waiting' || !payment) return undefined;
        let alive = true;
        let running = false;
        const poll = async () => {
            if (running) return;
            running = true;
            try {
                const res = await fetch(`/api/payments/${encodeURIComponent(payment.paymentId)}/status`, { cache: 'no-store' });
                const body = await readJsonBody(res, 'tables/suivi');
                const view = res.ok ? readPaymentPoll(body) : null;
                if (!alive || !view) return;
                if (view.status === 'SUCCESS' && view.bookingId) {
                    if (await finishWith(view.bookingId, view.amount)) return;
                    router.push(view.successUrl ?? `/tickets?tab=tables#table-${view.bookingId}`);
                    return;
                }
                if (FINAL_FAILED.has(view.status)) {
                    setPayment(null);
                    setStep('choose');
                    setTableId(null);
                    setFailedPayment('Le paiement n’a pas abouti : la table est libérée. Vous pouvez en choisir une autre.');
                    void refresh();
                }
            } catch (err) {
                console.warn('[tables] suivi du paiement momentanément injoignable :', err instanceof Error ? err.message : String(err));
            } finally {
                running = false;
            }
        };
        void poll();
        const timer = window.setInterval(() => void poll(), POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { alive = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, [step, payment, finishWith, refresh, router]);

    // ── Actions ─────────────────────────────────────────────────────────────────────────────────────────────────

    const types = useMemo(() => offer?.types ?? [], [offer]);
    const selectedType = types.find((t) => t.id === typeId) ?? null;
    const selectedTable = offer?.tables.find((t) => t.id === tableId) ?? null;

    const chooseTable = useCallback((id: string) => {
        const t = offerRef.current?.tables.find((x) => x.id === id);
        if (!t || t.state !== 'LIBRE' || stepRef.current !== 'choose') return;
        setTableId(id);
        setTypeId(t.typeId);
        setFailedPayment(null);
    }, []);

    const reserve = () => {
        if (!typeId) return;
        if (!isAuthenticated) {
            saveChoice(eventId, { typeId, tableId });
            toast.info('Connectez-vous pour réserver : votre choix est gardé.');
            router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}?tables=1`)}`);
            return;
        }
        setFailedPayment(null);
        setStep('pay');
    };

    const restart = () => {
        setStep('choose');
        setPayment(null);
        setConfirmed(null);
        setTypeId(null);
        setTableId(null);
        void refresh();
    };

    const onStarted = (p: StartedPayment) => {
        setPayment(p);
        setStep('waiting');
    };

    const onTableGone = (message: string) => {
        setStep('choose');
        setTableId(null);
        say(message);
        void refresh();
    };

    // ── Rendu ───────────────────────────────────────────────────────────────────────────────────────────────────

    if (phase === 'loading') {
        return (
            <div className="space-y-3" aria-busy="true">
                <span className="sr-only">Chargement des tables…</span>
                <div className="h-7 w-1/2 rounded-lg bg-muted" />
                <div className="h-28 rounded-xl bg-muted" />
                <div className="h-28 rounded-xl bg-muted" />
            </div>
        );
    }
    if (phase === 'error' || !offer) {
        return (
            <ErrorState
                title="Impossible d’afficher les tables"
                description={loadError ?? NETWORK}
                isRetrying={retrying}
                onRetry={() => { setRetrying(true); void refresh().finally(() => setRetrying(false)); }}
            />
        );
    }

    const plan = offer.planEnabled;
    const selectionTitle = selectedType
        ? plan && selectedTable ? `Table ${selectedTable.number}` : `Une table ${selectedType.name}`
        : null;
    const ctaLabel = plan && selectedTable ? `Réserver la table ${selectedTable.number}` : selectedType ? `Réserver une table ${selectedType.name}` : 'Réserver';
    const tableLabelForHold = plan && selectedTable ? `La table ${selectedTable.number}` : selectedType ? `Votre table ${selectedType.name}` : 'Votre table';

    const noticeChip = notice && (
        <p role="status" className="ev-sheet-up rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-text">
            {notice}
        </p>
    );

    const panel = (
        <div className="space-y-4">
            {step === 'done' && confirmed ? (
                <>
                    <TableConfirmed table={confirmed} event={event} />
                    <Button variant="ghost" fullWidth onClick={restart} leftIcon={<RefreshCw size={16} />}>Réserver une autre table</Button>
                </>
            ) : step === 'waiting' && payment ? (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{selectedType?.name ?? 'Votre table'}</p>
                        <p className="text-xl font-bold tracking-tight text-foreground-strong">
                            {plan && selectedTable ? `Table ${selectedTable.number}` : 'Paiement en cours'}
                        </p>
                    </div>
                    {payment.expiresAt && <HoldCountdown expiresAt={payment.expiresAt} tableLabel={tableLabelForHold} />}
                    <p className="flex items-start gap-2 text-sm text-foreground">
                        <Loader2 size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 animate-spin text-primary-text" />
                        <span>Validez la demande de paiement dans {operatorLabel(payment.operator)}. Cette page se met à jour toute seule dès que le paiement est reçu.</span>
                    </p>
                    {payment.link && (
                        <a href={payment.link} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-base font-semibold text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Ouvrir {operatorLabel(payment.operator)}
                            <ExternalLink size={16} aria-hidden="true" />
                        </a>
                    )}
                    <LinkButton href={payment.statusPath} variant="ghost" fullWidth>Suivre le paiement sur sa page</LinkButton>
                </div>
            ) : step === 'pay' && typeId ? (
                <>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 text-base font-bold text-foreground-strong">{selectionTitle}{selectedType && plan ? <span className="font-medium text-muted-foreground"> · {selectedType.name}</span> : null}</p>
                        <p className="flex-shrink-0 text-base font-bold tabular-nums text-foreground-strong" aria-live="polite">{quote ? formatFcfa(quote.total) : '…'}</p>
                    </div>
                    <PayStep
                        eventId={eventId}
                        typeId={typeId}
                        tableId={plan ? tableId : null}
                        total={quote ? quote.total : null}
                        totalLoading={quoteLoading}
                        operator={operator}
                        onOperator={setOperator}
                        onStarted={onStarted}
                        onBack={() => setStep('choose')}
                        onPhoneNotVerified={(retry) => setVerifyRetry(() => retry)}
                        onTableGone={onTableGone}
                    />
                </>
            ) : selectedType ? (
                <>
                    {failedPayment && <StatusBanner tone="warning" title="Paiement non abouti">{failedPayment}</StatusBanner>}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-lg font-bold tracking-tight text-foreground-strong">{selectionTitle}</p>
                            <p className="text-sm text-muted-foreground">
                                {plan ? `${selectedType.name} · ` : ''}<span className="inline-flex items-center gap-1"><Users size={14} aria-hidden="true" />{selectedType.seats} places</span>
                            </p>
                            {!plan && <p className="text-sm text-muted-foreground">Son numéro vous est donné après le paiement.</p>}
                        </div>
                        <div className="flex-shrink-0 text-right">
                            <p className="text-lg font-bold tabular-nums text-foreground-strong" aria-live="polite" aria-busy={quoteLoading || undefined}>
                                {quote ? formatFcfa(quote.total) : quoteError ? '—' : '…'}
                            </p>
                            <small className="block text-caption text-muted-foreground">frais compris</small>
                        </div>
                    </div>
                    {quoteError && <p role="alert" className="text-sm font-medium text-danger-text">{quoteError}</p>}
                    <button
                        type="button"
                        aria-expanded={details}
                        onClick={() => setDetails((v) => !v)}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                    >
                        Détail du prix
                        <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform duration-fast', details && 'rotate-180')} />
                    </button>
                    <div className={cn('space-y-3', !details && 'hidden lg:block')}>
                        {quote && (
                            <dl className="space-y-1.5 rounded-xl bg-muted p-3 text-sm">
                                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Table ({quote.seats} places)</dt><dd className="tabular-nums text-foreground-strong">{formatFcfa(quote.price)}</dd></div>
                                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Frais de service</dt><dd className="tabular-nums text-foreground-strong">{formatFcfa(quote.serviceFee)}</dd></div>
                                <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold"><dt className="text-foreground-strong">Total</dt><dd className="tabular-nums text-foreground-strong">{formatFcfa(quote.total)}</dd></div>
                                <p className="pt-1 tabular-nums text-muted-foreground">{perPersonText(formatFcfa(quote.pricePerPerson), quote.pricePerPersonExact)}, hors frais</p>
                            </dl>
                        )}
                        {selectedType.includedText && <p className="text-sm text-foreground"><span className="font-semibold">Compris : </span>{selectedType.includedText}</p>}
                        {selectedType.onsiteNote && <p className="text-sm text-muted-foreground"><span className="font-semibold">Sur place : </span>{selectedType.onsiteNote}</p>}
                        <p className="text-sm text-muted-foreground">Payée en entier. Pas d’annulation de votre part ; toute la table est remboursée si la soirée est annulée ou reportée de plus de 24 h.</p>
                    </div>
                    <Button variant="gradient" fullWidth className="ev-press" onClick={reserve} disabled={!quote}>
                        {ctaLabel}
                    </Button>
                </>
            ) : plan ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <LayoutGrid size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                    Touchez une table libre sur le plan pour voir son prix et la réserver.
                </p>
            ) : null}
        </div>
    );

    const showInlinePanel = !planOpen && (step !== 'choose' || Boolean(selectedType) || Boolean(failedPayment));

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight text-foreground-strong">Tables</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {offer.open
                            ? plan ? 'Choisissez votre table sur le plan. Prix pour toute la table.' : 'Choisissez un type de table. Prix pour toute la table.'
                            : offer.refusal ?? 'La vente de tables est fermée pour cet événement.'}
                    </p>
                </div>
                <LiveIndicator status={liveStatus} className="flex-shrink-0" />
            </div>

            {!planOpen && noticeChip}

            {types.length === 0 ? (
                <EmptyState
                    illustrated
                    title="Plus aucune table en vente"
                    description="Les tables de cet événement sont toutes parties. Les billets restent dans l’onglet « Billets »."
                />
            ) : (
                <ul className="ev-stagger space-y-3" aria-label="Types de tables">
                    {types.map((type) => {
                        const soldOut = type.remainingTables <= 0 || Boolean(type.refusal) || !offer.open;
                        const selected = !plan && typeId === type.id;
                        const body = (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="min-w-0 break-words text-base font-semibold text-foreground-strong">{type.name}</h3>
                                    <Badge variant="neutral" size="sm" icon={<Users size={12} aria-hidden="true" />} className="flex-shrink-0">{type.seats} places</Badge>
                                </div>
                                <TypeFacts type={type} />
                            </>
                        );
                        if (plan || soldOut || step !== 'choose') {
                            return (
                                <li key={type.id} className={cn('rounded-xl border p-4', soldOut ? 'border-border bg-muted' : 'border-border bg-card')}>{body}</li>
                            );
                        }
                        return (
                            <li key={type.id}>
                                <label className={cn(
                                    'ev-press relative block cursor-pointer rounded-xl border p-4 transition-colors duration-fast',
                                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card',
                                    selected ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:bg-muted',
                                )}>
                                    <input
                                        type="radio"
                                        name={`type-table-${eventId}`}
                                        value={type.id}
                                        checked={selected}
                                        onChange={() => { setTypeId(type.id); setTableId(null); setFailedPayment(null); }}
                                        className="sr-only"
                                        aria-label={`${type.name}, ${type.seats} places, ${formatFcfa(type.price)} la table`}
                                    />
                                    {body}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}

            {plan && offer.open && types.some((t) => t.remainingTables > 0 && !t.refusal) && step === 'choose' && (
                <Button variant={selectedType ? 'secondary' : 'gradient'} fullWidth className="ev-press" leftIcon={<MapIcon size={18} />} onClick={() => setPlanOpen(true)}>
                    {selectedTable ? `Table ${selectedTable.number} choisie : voir le plan` : 'Voir le plan et choisir ma table'}
                </Button>
            )}

            {showInlinePanel && (
                <>
                    {/* Téléphone : feuille fixée au-dessus de la barre de navigation ; ordinateur : dans le panneau de la fiche */}
                    <div
                        role="region"
                        aria-label="Votre table"
                        className="fixed inset-x-0 bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] z-30 max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-[20px] border-t border-border bg-card px-4 pb-4 pt-3 shadow-popover ev-sheet-up lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-xl lg:border lg:p-4 lg:shadow-none"
                    >
                        <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-input lg:hidden" />
                        {panel}
                    </div>
                    <div aria-hidden="true" className="h-56 lg:hidden" />
                </>
            )}

            {offer.open && types.length > 0 && step === 'choose' && !selectedType && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles size={16} aria-hidden="true" className="text-primary-text" />
                    Un billet par invité : vous envoyez les places après le paiement.
                </p>
            )}

            {planOpen && (
                <PlanDialog
                    title={step === 'done' ? 'Table réservée' : 'Choisissez votre table'}
                    subtitle={event.title}
                    onClose={() => setPlanOpen(false)}
                    plan={(
                        <div className="flex h-full min-h-0 flex-col gap-3">
                            {noticeChip}
                            {step === 'done' ? (
                                <div className="flex flex-1 items-center justify-center text-primary-text" aria-hidden="true"><PartyPopper size={64} /></div>
                            ) : (
                                <PlanView
                                    tables={offer.tables}
                                    zones={offer.zones}
                                    types={types}
                                    selectedId={tableId}
                                    onSelect={chooseTable}
                                    justTaken={justTaken}
                                    fill
                                />
                            )}
                        </div>
                    )}
                    panel={panel}
                />
            )}

            {verifyRetry && (
                <PhoneVerifyDialog
                    isOpen
                    phone={profile?.phone ?? null}
                    onClose={() => setVerifyRetry(null)}
                    onVerified={() => { const retry = verifyRetry; setVerifyRetry(null); retry(); }}
                />
            )}
        </div>
    );
}
