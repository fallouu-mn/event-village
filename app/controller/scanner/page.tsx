'use client';

/**
 * Scanner du contrôleur (lot 4) — voie unique /api/controller/scan.
 *  - Caméra : QR dynamique EVT1 uniquement ; saisie manuelle distincte avec pièce d'identité vérifiée.
 *  - Statut HTTP lu (components/scan/scan-client) : 401 → connexion ; 403, 429, 5xx et réseau sont des
 *    incidents techniques (carte neutre, ni voix wolof, ni compteur de refus).
 *  - cash_required : caméra et saisie en pause jusqu'à la décision ; un refus du serveur à
 *    l'encaissement reste affiché avec des actions explicites (ouvrir la caisse, réessayer, abandonner).
 *  - Statistiques lues sur le serveur (/api/controller/assignments), jamais incrémentées à la main.
 * Lot 5 (contrat Q, relecture des captures du run 50) : écran sur le système de design (tokens, plus de
 * couleurs codées ni de chasse fixe, libellés en casse de phrase, cibles de 44 px, montants et heures de
 * lib/format) ; comportement du lot 4 inchangé. Le flash plein écran (CombatFlashOverlay) garde ses
 * couleurs de haute visibilité, imposées par tests/scanner-combat-ui.test.ts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Banknote, Calendar, Camera, Keyboard, Loader2, LogOut, MapPin, PauseCircle, ScanLine,
    ShieldAlert, Ticket, Users, Volume2, VolumeX,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import { detachPushSubscription } from '@/lib/push/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { CameraQrScanner } from '@/components/scan/CameraQrScanner';
import { CombatFlashOverlay } from '@/components/scan/CombatFlashOverlay';
import { ManualEntryForm } from '@/components/scan/ManualEntryForm';
import { ScanResultPanel } from '@/components/scan/ScanResultPanel';
import { ScannerShiftBanner } from '@/components/scan/ScannerShiftBanner';
import {
    combatTypeFor, confirmCashCheckin, isTechnicalOutcome, isTicketRefusal, postScan, titleFor, wolofTypeFor,
    type ScanOutcome, type ScanRequest,
} from '@/components/scan/scan-client';
import { EVENT_STATUS_META, isEventEligibleForController, isEventStatus } from '@/lib/events/event-status';
import { formatFcfa, formatInteger, formatTime } from '@/lib/format';
import { OpenShiftModal, CloseShiftModal, ZSummaryModal } from '@/components/shifts/ShiftModals';
import type { Shift, ShiftSummary } from '@/lib/shifts/shift.service';
import { triggerCombatSensoryFeedback, type CombatFeedbackType } from '@/lib/hardware/feedback';
import { playWolofAudio, repeatLastWolofAudio, stopWolofAudio, isWolofMuted, toggleWolofMuted } from '@/lib/hardware/wolof-audio';

// ── Types ─────────────────────────────────────────────────────────

interface EventStats { scanned_today: number; total_tickets: number; }

interface EventInfo {
    id: string; title: string; date: string; location: string;
    status: string; cover_image_url?: string;
}

interface Assignment {
    id: string; can_accept_cash: boolean;
    events: EventInfo; stats: EventStats;
}

type InputMode = 'camera' | 'manual';

interface HistoryEntry { key: string; at: string; outcome: ScanOutcome }

const FEEDBACK_DISPLAY_MS = 3500;
const STATS_REFRESH_DEBOUNCE_MS = 800;
const SCANNER_PATH = '/controller/scanner';

/** Libellé (EVENT_STATUS_META) d'un événement fermé au contrôle : terminé, suspendu ou annulé ; null sinon. */
function closedStatusLabel(status?: string): string | null {
    if (status !== 'TERMINE' && status !== 'SUSPENDU' && status !== 'ANNULE') return null;
    return isEventStatus(status) ? EVENT_STATUS_META[status].label : null;
}

// ── Composant Principal ──────────────────────────────────────────

export default function ControllerScannerPage() {
    const router = useRouter();

    // Données
    const [assignments, setAssignments]       = useState<Assignment[]>([]);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState('');
    const [selected, setSelected]             = useState<Assignment | null>(null);
    const [controllerName, setControllerName] = useState('');
    const [refusedCountMap, setRefusedCountMap] = useState<Record<string, number>>({});

    // Scanner
    const [inputMode, setInputMode]           = useState<InputMode>('camera');
    const [isVerifying, setIsVerifying]       = useState(false);
    const [feedback, setFeedback]             = useState<ScanOutcome | null>(null);
    const [cashError, setCashError]           = useState<ScanOutcome | null>(null);
    const [cashConfirming, setCashConfirming] = useState(false);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Mute Audio Wolof
    const [isMuted, setIsMuted] = useState(false);

    // Flash plein écran (haute visibilité foule / nuit)
    const [combatFlash, setCombatFlash] = useState<{
        status: CombatFeedbackType;
        message?: string;
        holderName?: string;
        category?: string;
        ticketNumber?: string;
        durationMs?: number;
    } | null>(null);

    const [scanHistory, setScanHistory] = useState<HistoryEntry[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Sessions de caisse
    const [activeShift, setActiveShift]               = useState<Shift | null>(null);
    const [showOpenShiftModal, setShowOpenShiftModal]   = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [showZSummaryModal, setShowZSummaryModal]     = useState(false);
    const [zSummary, setZSummary]                       = useState<ShiftSummary | null>(null);

    /** Encaissement espèces en attente de décision : caméra et saisie en pause. */
    const cashPending = feedback?.result === 'cash_required';

    useEffect(() => {
        setIsMuted(isWolofMuted());
    }, []);

    const handleToggleMute = useCallback(() => {
        setIsMuted(toggleWolofMuted());
    }, []);

    const handleRepeatWolof = useCallback(async () => {
        const wolof = feedback ? wolofTypeFor(feedback) : null;
        await repeatLastWolofAudio('wolof', wolof ?? undefined);
    }, [feedback]);

    /** Session expirée (HTTP 401) : retour à la connexion, jamais un « billet invalide ». */
    const redirectIfSessionExpired = useCallback((outcome: ScanOutcome): boolean => {
        if (outcome.httpStatus !== 401) return false;
        router.replace(`/login?redirect=${encodeURIComponent(SCANNER_PATH)}`);
        return true;
    }, [router]);

    const fetchActiveShift = useCallback(async (eventId: string) => {
        try {
            const res = await fetch(`/api/controller/shifts/active?event_id=${eventId}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok && data.success) setActiveShift(data.shift || null);
            else console.warn('[scanner] caisse active illisible :', res.status, data?.error);
        } catch (err) {
            console.warn('[scanner] caisse active : réseau indisponible', err instanceof Error ? err.message : String(err));
        }
    }, []);

    // ── Assignations, état du contrôleur et statistiques (serveur) ──
    const fetchAssignments = useCallback(async () => {
        try {
            const res = await fetch('/api/controller/assignments', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (res.status === 401) {
                router.replace(`/login?redirect=${encodeURIComponent(SCANNER_PATH)}`);
                return;
            }
            const data = await res.json();
            if (data.success) {
                const list: Assignment[] = data.assignments ?? [];
                setAssignments(list);
                if (data.controller) {
                    const name = [data.controller.first_name, data.controller.last_name].filter(Boolean).join(' ');
                    setControllerName(name || 'Contrôleur');
                }
                setSelected(current => {
                    if (list.length === 0) return null;
                    if (!current) return list.find(a => a.events?.status !== 'TERMINE') || list[0];
                    return list.find(a => a.events?.id === current.events?.id)
                        || list.find(a => a.events?.status !== 'TERMINE')
                        || list[0];
                });
                setError('');
            } else {
                setError(data.error || 'Impossible de charger les événements.');
            }
        } catch (err) {
            console.warn('[scanner] assignations : réseau indisponible', err instanceof Error ? err.message : String(err));
            setError('Erreur réseau.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    /** Rafraîchit les compteurs depuis le serveur (regroupe les rafales de scans et d'événements Realtime). */
    const scheduleStatsRefresh = useCallback(() => {
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
        statsTimerRef.current = setTimeout(() => { void fetchAssignments(); }, STATS_REFRESH_DEBOUNCE_MS);
    }, [fetchAssignments]);

    useEffect(() => {
        void fetchAssignments();
    }, [fetchAssignments]);

    useEffect(() => {
        if (selected?.events?.id && selected?.can_accept_cash) void fetchActiveShift(selected.events.id);
        else setActiveShift(null);
    }, [selected?.events?.id, selected?.can_accept_cash, fetchActiveShift]);

    // Lot 5 (contrat O3) : plus d'abonnement à event_controllers, events ni users, absents de la publication
    // supabase_realtime (aucun message n'arrivait). Le serveur reste la source de vérité : chaque scan vérifie
    // l'affectation, le statut de l'événement et celui du compte, et les affectations sont relues à chaque
    // billet composté (compteurs ci-dessous).

    // ── Realtime : billets compostés de l'événement (toutes portes) → compteurs serveur ──
    useEffect(() => {
        if (!selected?.events?.id) return;
        const eventId = selected.events.id;
        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`scanner-tickets-live-${eventId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventId}` },
                (payload: { new: Record<string, unknown> }) => {
                    if ((payload.new as { status?: string })?.status === 'UTILISE') scheduleStatsRefresh();
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selected?.events?.id, scheduleStatsRefresh]);

    useEffect(() => () => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
        stopWolofAudio();
    }, []);

    // ── Retour du scan : flash, voix, carte, historique, compteur de refus ──
    const presentOutcome = useCallback((outcome: ScanOutcome, eventId: string | undefined) => {
        const technical = isTechnicalOutcome(outcome);
        const combatType = combatTypeFor(outcome);

        // Incident technique : aucun signal de rejet (ni son, ni vibration, ni voix)
        if (!technical) triggerCombatSensoryFeedback(combatType);
        const wolof = wolofTypeFor(outcome);
        if (wolof) {
            playWolofAudio(wolof).catch((err: unknown) => console.warn('[scanner] voix wolof indisponible', err instanceof Error ? err.message : String(err)));
        }

        setCombatFlash({
            status: combatType,
            message: technical ? `${titleFor(outcome)} — ${outcome.message}` : outcome.message,
            holderName: outcome.ticket?.holder,
            category: outcome.ticket?.category,
            ticketNumber: outcome.ticket?.ticket_number,
            durationMs: combatType === 'valid' ? 1000 : 3500,
        });

        setFeedback(outcome);
        setScanHistory(prev => [{ key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), outcome }, ...prev].slice(0, 15));

        // Compteur « billets refusés » : refus du billet seulement (jamais un incident technique)
        if (eventId && isTicketRefusal(outcome)) {
            setRefusedCountMap(prev => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + 1 }));
        }

        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        // Un encaissement en attente et un incident technique restent affichés jusqu'à l'action suivante
        if (outcome.result !== 'cash_required' && !technical) {
            feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
        }
    }, []);

    // ── Scan (caméra ou saisie manuelle) ──
    const runScan = useCallback(async (request: ScanRequest) => {
        if (cashPending) return;
        if (isVerifying) return;
        setIsVerifying(true);
        setCashError(null);
        try {
            const outcome = await postScan(request);
            if (redirectIfSessionExpired(outcome)) return;
            presentOutcome(outcome, request.eventId);
            if (outcome.result === 'valid') scheduleStatsRefresh();
        } finally {
            setIsVerifying(false);
        }
    }, [cashPending, isVerifying, redirectIfSessionExpired, presentOutcome, scheduleStatsRefresh]);

    const handleCameraScan = useCallback((code: string) => {
        const eventId = selected?.events?.id;
        const payload = code.trim();
        if (!eventId || !payload) return;
        void runScan({ eventId, payload });
    }, [selected?.events?.id, runScan]);

    const handleManualScan = useCallback(async (manualTicketNumber: string, identityVerified: boolean) => {
        const eventId = selected?.events?.id;
        if (!eventId) return;
        await runScan({ eventId, manualTicketNumber, identityVerified });
    }, [selected?.events?.id, runScan]);

    // ── Encaissement espèces (PUT, tout ou rien côté serveur) ──
    const handleConfirmCash = async () => {
        const eventId = selected?.events?.id;
        if (!feedback?.scanId || !eventId) return;
        if (selected?.can_accept_cash && !activeShift) {
            // La carte d'encaissement reste affichée : l'encaissement reprend une fois la caisse ouverte
            setShowOpenShiftModal(true);
            return;
        }
        setCashConfirming(true);
        try {
            const outcome = await confirmCashCheckin(feedback.scanId, eventId);
            if (redirectIfSessionExpired(outcome)) return;
            if (outcome.result === 'valid' && !outcome.failure) {
                setCashError(null);
                presentOutcome({ ...outcome, ticket: feedback.ticket, message: outcome.amount !== undefined ? `Encaissé : ${formatFcfa(outcome.amount)}. Entrée validée.` : outcome.message }, eventId);
                if (selected?.can_accept_cash) void fetchActiveShift(eventId);
                scheduleStatsRefresh();
            } else {
                // Refus du serveur : rien n'est encaissé ni composté ; l'écran reste jusqu'à une action explicite
                setCashError(outcome);
            }
        } finally {
            setCashConfirming(false);
        }
    };

    /** Abandon de l'encaissement : le spectateur n'entre pas, le scan reprend. */
    const handleAbandonCash = () => {
        setCashError(null);
        setFeedback(null);
    };

    const handleLogout = async () => {
        const supabase = getBrowserClient();
        // Lot 6 (contrat F4) : l'appareil ne reçoit plus les notifications push du compte après la déconnexion
        // (erreur journalisée par detachPushSubscription, la déconnexion continue).
        await detachPushSubscription();
        await supabase.auth.signOut({ scope: 'global' });
        router.push('/login');
    };

    const selectEvent = (a: Assignment) => {
        setSelected(a);
        setFeedback(null);
        setCashError(null);
    };

    // ── Rendu : chargement / erreur / aucune affectation ──

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20" role="status" aria-busy="true">
                <Loader2 size={32} aria-hidden="true" className="text-brand-fg motion-safe:animate-spin" />
                <p className="text-sm text-fg-muted">Chargement de vos événements…</p>
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                title="Vos événements n’ont pas pu être chargés"
                description={error}
                onRetry={() => { setLoading(true); void fetchAssignments(); }}
            />
        );
    }

    if (assignments.length === 0) {
        return (
            <>
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-surface px-6 py-12 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
                        <Calendar size={28} />
                    </span>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold text-fg">Aucun événement assigné</h2>
                        <p className="mx-auto max-w-sm text-sm leading-relaxed text-fg-muted">
                            Vous serez informé lorsqu’un nouvel événement vous sera assigné.
                        </p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <LinkButton href="/" variant="secondary" leftIcon={<ArrowLeft size={18} />}>
                            Retour à l’accueil
                        </LinkButton>
                        <Button variant="ghost" leftIcon={<LogOut size={18} />} onClick={() => setShowLogoutConfirm(true)}>
                            Se déconnecter
                        </Button>
                    </div>
                </div>
                <ConfirmDialog
                    isOpen={showLogoutConfirm}
                    onClose={() => setShowLogoutConfirm(false)}
                    onConfirm={handleLogout}
                    title="Se déconnecter ?"
                    message="Vous serez déconnecté de tous vos appareils. Vous devrez vous reconnecter pour accéder au scanner."
                    confirmLabel="Déconnexion"
                    variant="danger"
                />
            </>
        );
    }

    const currentRefused = selected?.events?.id ? (refusedCountMap[selected.events.id] ?? 0) : 0;
    const eventStatus = selected?.events?.status;
    const eventStatusLabel = closedStatusLabel(eventStatus);
    const scanDisabled = cashPending || isVerifying;
    const arrivals = selected?.stats?.scanned_today ?? 0;
    const validTickets = selected?.stats?.total_tickets ?? 0;

    return (
        <div className="flex flex-col gap-4">
            <CombatFlashOverlay
                status={combatFlash?.status ?? null}
                message={combatFlash?.message}
                holderName={combatFlash?.holderName}
                category={combatFlash?.category}
                ticketNumber={combatFlash?.ticketNumber}
                durationMs={combatFlash?.durationMs}
                onDismiss={() => setCombatFlash(null)}
                onRepeatWolof={handleRepeatWolof}
            />

            {/* Rôle et voix wolof (le retour à l'espace client est dans l'en-tête de l'espace contrôleur) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-bg text-brand-fg" aria-hidden="true">
                        <ScanLine size={16} />
                    </span>
                    <span className="truncate">{controllerName ? `Contrôleur · ${controllerName}` : 'Contrôleur'}</span>
                </span>
                <Button
                    variant="secondary"
                    onClick={handleToggleMute}
                    data-testid="toggle-wolof-mute-btn"
                    aria-pressed={!isMuted}
                    leftIcon={isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    className={isMuted ? undefined : 'border-success-border bg-success-bg text-success-fg hover:bg-success-bg'}
                >
                    <span className="sr-only">Voix wolof : </span>
                    {isMuted ? 'Son coupé' : 'Son activé'}
                </Button>
            </div>

            {/* Sélecteur d'événement */}
            {assignments.length > 1 && (
                <Select
                    id="scanner-event-select"
                    label={`Mes événements (${formatInteger(assignments.length)})`}
                    value={selected?.id ?? ''}
                    onChange={(e) => {
                        const found = assignments.find(a => a.id === e.target.value);
                        if (found) selectEvent(found);
                    }}
                    disabled={cashPending}
                    hint={cashPending ? 'Tranchez d’abord l’encaissement en cours pour changer d’événement.' : undefined}
                    options={assignments.map(a => {
                        const label = closedStatusLabel(a.events?.status);
                        return { value: a.id, label: `${a.events?.title || 'Événement sans titre'}${label ? ` · ${label}` : ''}` };
                    })}
                />
            )}

            {selected && (
                <>
                    {/* En-tête de l'événement */}
                    <section aria-labelledby="scanner-event-title" className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 id="scanner-event-title" className="min-w-0 break-words text-base font-semibold text-fg">{selected.events?.title}</h2>
                            {eventStatusLabel && <StatusBadge domain="event" status={eventStatus} />}
                        </div>
                        {(selected.events?.location || selected.can_accept_cash) && (
                            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
                                {selected.events?.location && (
                                    <span className="inline-flex items-start gap-1.5 text-fg-muted">
                                        <MapPin size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                                        <span className="min-w-0 break-words">{selected.events.location}</span>
                                    </span>
                                )}
                                {selected.can_accept_cash && (
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-success-fg">
                                        <Banknote size={16} aria-hidden="true" className="flex-shrink-0" />
                                        Encaissement en espèces autorisé
                                    </span>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Statistiques (serveur) */}
                    <section aria-label="Statistiques du contrôle" className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-3 text-center">
                            <Ticket size={20} aria-hidden="true" className="text-success-fg" />
                            <span className="text-2xl font-bold leading-none text-fg tabular-nums">{formatInteger(validTickets)}</span>
                            <span className="text-sm leading-snug text-fg-muted">Billets valides</span>
                        </div>
                        <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-3 text-center">
                            <Users size={20} aria-hidden="true" className="text-brand-fg" />
                            <span className="text-2xl font-bold leading-none text-fg tabular-nums">{formatInteger(arrivals)}</span>
                            <span className="text-sm leading-snug text-fg-muted">Arrivées</span>
                        </div>
                        <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-3 text-center">
                            <ShieldAlert size={20} aria-hidden="true" className="text-danger-fg" />
                            <span className="text-2xl font-bold leading-none text-fg tabular-nums">{formatInteger(currentRefused)}</span>
                            <span className="text-sm leading-snug text-fg-muted">Billets refusés</span>
                        </div>
                        <p className="sr-only" role="status" aria-atomic="true">
                            {`${formatInteger(arrivals)} arrivées, ${formatInteger(currentRefused)} billets refusés`}
                        </p>
                    </section>

                    {selected.can_accept_cash && (
                        <ScannerShiftBanner
                            canAcceptCash={selected.can_accept_cash}
                            activeShift={activeShift}
                            onOpenShiftClick={() => setShowOpenShiftModal(true)}
                            onCloseShiftClick={() => setShowCloseShiftModal(true)}
                        />
                    )}

                    {!isEventEligibleForController(eventStatus) ? (
                        <StatusBanner
                            tone={eventStatus === 'SUSPENDU' || eventStatus === 'ANNULE' ? 'danger' : 'warning'}
                            title={eventStatus === 'SUSPENDU' ? 'Événement suspendu'
                                : eventStatus === 'TERMINE' ? 'Événement terminé'
                                : eventStatus === 'ANNULE' ? 'Événement annulé'
                                : 'Événement non publié'}
                        >
                            {eventStatus === 'SUSPENDU' ? 'Les contrôles d’accès sont suspendus sur cet événement.'
                                : eventStatus === 'TERMINE' ? 'Les scans ne sont plus autorisés sur cet événement.'
                                : eventStatus === 'ANNULE' ? 'Événement annulé : aucune entrée n’est possible, les billets sont remboursés.'
                                : 'Le contrôle ouvrira quand l’événement sera publié.'}
                        </StatusBanner>
                    ) : (
                        <>
                            {/* Encaissement espèces en attente ou refusé par le serveur */}
                            {cashPending && feedback && (
                                cashError ? (
                                    <ScanResultPanel outcome={cashError} title="Encaissement non enregistré">
                                        <p className="text-sm font-semibold text-fg">
                                            Rien n’a été encaissé ni validé. Ne laissez pas entrer le spectateur tant que l’encaissement n’est pas confirmé.
                                        </p>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {cashError.code === 'CASH_NO_OPEN_SHIFT' && (
                                                <Button variant="primary" size="lg" onClick={() => setShowOpenShiftModal(true)}>
                                                    Ouvrir ma caisse
                                                </Button>
                                            )}
                                            {cashError.code !== 'CASH_SCAN_EXPIRED' && (
                                                <Button variant="secondary" size="lg" isLoading={cashConfirming} onClick={handleConfirmCash}>
                                                    Réessayer l’encaissement
                                                </Button>
                                            )}
                                            <Button variant="outline" size="lg" onClick={handleAbandonCash}>
                                                {cashError.code === 'CASH_SCAN_EXPIRED' ? 'Fermer et rescanner le billet' : 'Abandonner (pas d’entrée)'}
                                            </Button>
                                        </div>
                                    </ScanResultPanel>
                                ) : (
                                    <ScanResultPanel outcome={feedback}>
                                        {selected.can_accept_cash ? (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <Button variant="primary" size="lg" isLoading={cashConfirming} onClick={handleConfirmCash} leftIcon={<Banknote size={18} />}>
                                                    {feedback.amountDue !== undefined ? `J’ai reçu ${formatFcfa(feedback.amountDue)} : valider l’entrée` : 'J’ai reçu les espèces : valider l’entrée'}
                                                </Button>
                                                <Button variant="outline" size="lg" onClick={handleAbandonCash} disabled={cashConfirming}>
                                                    Annuler (le spectateur ne paie pas)
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm font-semibold text-fg">
                                                    Vous n’êtes pas habilité à encaisser : orientez le spectateur vers la caisse de l’événement.
                                                </p>
                                                <Button variant="outline" size="lg" fullWidth onClick={handleAbandonCash}>
                                                    Fermer et reprendre le scan
                                                </Button>
                                            </>
                                        )}
                                    </ScanResultPanel>
                                )
                            )}

                            {/* Résultat du dernier scan */}
                            {feedback && !cashPending && (
                                <ScanResultPanel outcome={feedback} onRepeatWolof={handleRepeatWolof} />
                            )}

                            {/* Mode : caméra ou saisie manuelle */}
                            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mode de contrôle">
                                <Button
                                    variant={inputMode === 'camera' ? 'primary' : 'secondary'}
                                    size="lg"
                                    className="gap-2 whitespace-nowrap px-4 text-sm"
                                    aria-pressed={inputMode === 'camera'}
                                    onClick={() => { setInputMode('camera'); if (!cashPending) setFeedback(null); }}
                                    leftIcon={<Camera size={18} />}
                                >
                                    Caméra
                                </Button>
                                <Button
                                    variant={inputMode === 'manual' ? 'primary' : 'secondary'}
                                    size="lg"
                                    className="gap-2 whitespace-nowrap px-4 text-sm"
                                    aria-pressed={inputMode === 'manual'}
                                    onClick={() => { setInputMode('manual'); if (!cashPending) setFeedback(null); }}
                                    leftIcon={<Keyboard size={18} />}
                                >
                                    Saisie manuelle
                                </Button>
                            </div>

                            {inputMode === 'camera' && !cashPending && (
                                <div className="overflow-hidden rounded-2xl">
                                    <CameraQrScanner
                                        onScan={handleCameraScan}
                                        isVerifying={scanDisabled}
                                        onSwitchToManual={() => setInputMode('manual')}
                                        autoResumeDelayMs={2500}
                                    />
                                </div>
                            )}
                            {inputMode === 'camera' && cashPending && (
                                <StatusBanner tone="info" title="Caméra en pause" icon={<PauseCircle size={20} />}>
                                    Confirmez ou annulez l’encaissement en cours avant de scanner le billet suivant.
                                </StatusBanner>
                            )}

                            {inputMode === 'manual' && (
                                <div className="rounded-2xl border border-border bg-surface p-4">
                                    <ManualEntryForm
                                        onSubmit={handleManualScan}
                                        isSubmitting={isVerifying}
                                        disabled={cashPending}
                                        disabledReason="Saisie en pause : tranchez d’abord l’encaissement en cours."
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Historique de la session */}
                    {scanHistory.length > 0 && (
                        <section className="flex flex-col gap-2" aria-labelledby="scanner-history-title">
                            <h3 id="scanner-history-title" className="text-base font-semibold text-fg">
                                Derniers scans
                            </h3>
                            <ul className="flex flex-col gap-1.5">
                                {scanHistory.slice(0, 8).map(({ key, at, outcome }) => {
                                    const technical = isTechnicalOutcome(outcome);
                                    const dot = technical ? 'bg-fg-muted'
                                        : outcome.result === 'valid' ? 'bg-success'
                                        : isTicketRefusal(outcome) ? 'bg-danger'
                                        : 'bg-warning';
                                    return (
                                        <li key={key} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                                            <span aria-hidden="true" className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot}`} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                                                {titleFor(outcome)}{outcome.ticket?.ticket_number ? ` · ${outcome.ticket.ticket_number}` : ''}
                                            </span>
                                            <time dateTime={at} className="flex-shrink-0 text-sm text-fg-muted tabular-nums">
                                                {formatTime(at)}
                                            </time>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    <div className="flex justify-center pb-8 pt-2">
                        <Button variant="ghost" leftIcon={<LogOut size={18} />} onClick={() => setShowLogoutConfirm(true)} className="text-fg-muted hover:text-danger-fg">
                            Se déconnecter
                        </Button>
                    </div>

                    <OpenShiftModal
                        isOpen={showOpenShiftModal}
                        onClose={() => setShowOpenShiftModal(false)}
                        eventId={selected.events.id}
                        eventTitle={selected.events.title}
                        onShiftOpened={(shift) => setActiveShift(shift)}
                    />

                    {activeShift && (
                        <CloseShiftModal
                            isOpen={showCloseShiftModal}
                            onClose={() => setShowCloseShiftModal(false)}
                            shift={activeShift}
                            onShiftClosed={(summary) => {
                                setActiveShift(null);
                                setZSummary(summary);
                                setShowZSummaryModal(true);
                            }}
                        />
                    )}

                    <ZSummaryModal
                        isOpen={showZSummaryModal}
                        onClose={() => setShowZSummaryModal(false)}
                        summary={zSummary}
                    />
                </>
            )}

            <ConfirmDialog
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={handleLogout}
                title="Se déconnecter ?"
                message="Vous serez déconnecté de tous vos appareils. Vous devrez vous reconnecter pour accéder au scanner."
                confirmLabel="Déconnexion"
                variant="danger"
            />
        </div>
    );
}
