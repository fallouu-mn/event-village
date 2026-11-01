'use client';

/**
 * Scanner du contrôleur (lot 4) — voie unique /api/controller/scan.
 *  - Caméra : QR dynamique EVT1 uniquement ; saisie manuelle distincte avec pièce d'identité vérifiée.
 *  - Statut HTTP lu (components/scan/scan-client) : 401 → connexion ; 403, 429, 5xx et réseau sont des
 *    incidents techniques (carte neutre, ni voix wolof, ni compteur de refus).
 *  - cash_required : caméra et saisie en pause jusqu'à la décision ; un refus du serveur à
 *    l'encaissement reste affiché avec des actions explicites (ouvrir la caisse, réessayer, abandonner).
 *  - Statistiques lues sur le serveur (/api/controller/assignments), jamais incrémentées à la main.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Banknote, Calendar, Camera, ChevronDown, Keyboard, Loader2, LogOut, MapPin, PauseCircle,
    ShieldAlert, Ticket, Users, Volume2, VolumeX, AlertTriangle,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CameraQrScanner } from '@/components/scan/CameraQrScanner';
import { CombatFlashOverlay } from '@/components/scan/CombatFlashOverlay';
import { ManualEntryForm } from '@/components/scan/ManualEntryForm';
import { ScanResultPanel } from '@/components/scan/ScanResultPanel';
import {
    combatTypeFor, confirmCashCheckin, formatFcfa, isTechnicalOutcome, isTicketRefusal, postScan, titleFor, wolofTypeFor,
    type ScanOutcome, type ScanRequest,
} from '@/components/scan/scan-client';
import { isEventEligibleForController } from '@/lib/events/event-status';
import { ShiftStatusBanner, OpenShiftModal, CloseShiftModal, ZSummaryModal } from '@/components/shifts/ShiftModals';
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

function eventStatusLabel(status?: string): string | null {
    switch (status) {
        case 'TERMINE': return 'Terminé';
        case 'SUSPENDU': return 'Suspendu';
        case 'ANNULE': return 'Annulé';
        default: return null;
    }
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
            <div className="flex flex-col items-center justify-center py-20 gap-3" role="status">
                <Loader2 size={32} aria-hidden="true" className="animate-spin text-[#FF5722]" />
                <p className="text-sm text-slate-600 dark:text-zinc-300">Chargement…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-3" role="alert">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <Button variant="outline" onClick={() => { setLoading(true); void fetchAssignments(); }}>Réessayer</Button>
            </div>
        );
    }

    if (assignments.length === 0) {
        return (
            <>
                <div className="text-center py-16 space-y-4">
                    <Calendar size={48} aria-hidden="true" className="text-slate-300 dark:text-zinc-600 mx-auto" />
                    <h2 className="text-base font-bold text-slate-700 dark:text-zinc-200">Aucun événement assigné</h2>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 max-w-sm mx-auto">
                        Vous serez informé lorsqu&apos;un nouvel événement vous sera assigné.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-bold text-slate-700 dark:text-zinc-200 transition-colors min-h-[44px]"
                        >
                            <ArrowLeft size={14} aria-hidden="true" />
                            <span>Retour à l&apos;accueil</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:text-red-600 transition-colors min-h-[44px]"
                        >
                            <LogOut size={14} aria-hidden="true" /> Se déconnecter
                        </button>
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
    const scanDisabled = cashPending || isVerifying;

    return (
        <div className="space-y-4">
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

            {/* Barre de navigation et voix wolof */}
            <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 px-3 py-2 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-colors py-1.5 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 min-h-[44px]"
                    title="Basculer vers l'espace client (billetterie, réservations, commandes)"
                >
                    <ArrowLeft size={15} aria-hidden="true" className="text-[#FF5722] shrink-0" />
                    <span className="hidden sm:inline">Mon espace Client</span>
                    <span className="sm:hidden">Client</span>
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleToggleMute}
                        data-testid="toggle-wolof-mute-btn"
                        aria-pressed={!isMuted}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-sm font-bold transition-colors border ${
                            isMuted
                                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-600'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700'
                        }`}
                        aria-label={isMuted ? 'Voix wolof désactivée. Activer.' : 'Voix wolof activée. Désactiver.'}
                    >
                        {isMuted ? <VolumeX size={16} aria-hidden="true" className="shrink-0" /> : <Volume2 size={16} aria-hidden="true" className="shrink-0" />}
                        <span className="hidden sm:inline">Voix wolof :</span>
                        <span className="uppercase font-black">{isMuted ? 'OFF' : 'ON'}</span>
                    </button>
                    {controllerName && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FF5722]/10 text-[#C2410C] dark:text-[#FF8A65] border border-[#FF5722]/30">
                            Contrôleur
                        </span>
                    )}
                </div>
            </div>

            {/* Sélecteur d'événement */}
            {assignments.length > 1 && (
                <div className="space-y-1.5">
                    <label htmlFor="scanner-event-select" className="text-xs font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider block">
                        Mes événements ({assignments.length})
                    </label>
                    <div className="relative">
                        <select
                            id="scanner-event-select"
                            value={selected?.id ?? ''}
                            onChange={(e) => {
                                const found = assignments.find(a => a.id === e.target.value);
                                if (found) selectEvent(found);
                            }}
                            disabled={cashPending}
                            className="w-full min-h-[48px] pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm font-bold text-slate-900 dark:text-white appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] disabled:opacity-60"
                        >
                            {assignments.map(a => {
                                const label = eventStatusLabel(a.events?.status);
                                return (
                                    <option key={a.id} value={a.id}>
                                        {a.events?.title || 'Sans titre'}{label ? ` [${label}]` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                </div>
            )}

            {selected && (
                <>
                    {/* En-tête de l'événement */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">{selected.events?.title}</h2>
                                {eventStatusLabel(eventStatus) && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/30 uppercase tracking-wider shrink-0">
                                        {eventStatusLabel(eventStatus)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                                {selected.events?.location && <span className="flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> {selected.events.location}</span>}
                                {selected.can_accept_cash && <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold"><Banknote size={12} aria-hidden="true" /> Encaissement autorisé</span>}
                            </div>
                        </div>
                    </div>

                    {/* Statistiques (serveur) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                            <Ticket size={20} aria-hidden="true" className="text-emerald-700 dark:text-emerald-300 mb-1" />
                            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono leading-none">{selected.stats?.total_tickets ?? 0}</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 mt-1">Billets valides</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#FF5722]/5 dark:bg-[#FF5722]/10 border border-[#FF5722]/20 text-center">
                            <Users size={20} aria-hidden="true" className="text-[#C2410C] dark:text-[#FF8A65] mb-1" />
                            <span className="text-xl sm:text-2xl font-black text-[#C2410C] dark:text-[#FF8A65] font-mono leading-none">{selected.stats?.scanned_today ?? 0}</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 mt-1">Arrivées</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-center">
                            <ShieldAlert size={20} aria-hidden="true" className="text-amber-700 dark:text-amber-300 mb-1" />
                            <span className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 font-mono leading-none">{currentRefused}</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 mt-1">Billets refusés</span>
                        </div>
                        <p className="sr-only" role="status" aria-atomic="true">
                            {`${selected.stats?.scanned_today ?? 0} arrivées, ${currentRefused} billets refusés`}
                        </p>
                    </div>

                    {selected.can_accept_cash && (
                        <ShiftStatusBanner
                            canAcceptCash={selected.can_accept_cash}
                            activeShift={activeShift}
                            onOpenShiftClick={() => setShowOpenShiftModal(true)}
                            onCloseShiftClick={() => setShowCloseShiftModal(true)}
                        />
                    )}

                    {!isEventEligibleForController(eventStatus) ? (
                        <div role="status" className={`p-6 rounded-2xl border text-center space-y-2 ${
                            eventStatus === 'SUSPENDU' || eventStatus === 'ANNULE'
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-900/60'
                                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                        }`}>
                            <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/70 dark:bg-zinc-900/70 text-slate-800 dark:text-zinc-100">
                                <AlertTriangle size={14} aria-hidden="true" />
                                {eventStatus === 'SUSPENDU' ? 'Événement suspendu'
                                    : eventStatus === 'TERMINE' ? 'Événement terminé'
                                    : eventStatus === 'ANNULE' ? 'Événement annulé'
                                    : 'Événement non publié'}
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                                {eventStatus === 'SUSPENDU' ? 'Les contrôles d’accès sont suspendus sur cet événement.'
                                    : eventStatus === 'TERMINE' ? 'Les scans ne sont plus autorisés sur cet événement.'
                                    : eventStatus === 'ANNULE' ? 'Événement annulé : aucune entrée n’est possible, les billets sont remboursés.'
                                    : 'Le contrôle ouvrira quand l’événement sera publié.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Encaissement espèces en attente ou refusé par le serveur */}
                            {cashPending && feedback && (
                                cashError ? (
                                    <ScanResultPanel outcome={cashError} title="Encaissement non enregistré">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                                            Rien n’a été encaissé ni validé. Ne laissez pas entrer le spectateur tant que l’encaissement n’est pas confirmé.
                                        </p>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {cashError.code === 'CASH_NO_OPEN_SHIFT' && (
                                                <Button variant="primary" size="lg" className="min-h-[48px]" onClick={() => setShowOpenShiftModal(true)}>
                                                    Ouvrir ma caisse
                                                </Button>
                                            )}
                                            {cashError.code !== 'CASH_SCAN_EXPIRED' && (
                                                <Button variant="secondary" size="lg" className="min-h-[48px]" isLoading={cashConfirming} onClick={handleConfirmCash}>
                                                    Réessayer l’encaissement
                                                </Button>
                                            )}
                                            <Button variant="outline" size="lg" className="min-h-[48px]" onClick={handleAbandonCash}>
                                                {cashError.code === 'CASH_SCAN_EXPIRED' ? 'Fermer et rescanner le billet' : 'Abandonner (pas d’entrée)'}
                                            </Button>
                                        </div>
                                    </ScanResultPanel>
                                ) : (
                                    <ScanResultPanel outcome={feedback}>
                                        {selected.can_accept_cash ? (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <Button variant="primary" size="lg" className="min-h-[48px]" isLoading={cashConfirming} onClick={handleConfirmCash}>
                                                    <Banknote size={18} aria-hidden="true" className="mr-1.5" />
                                                    {feedback.amountDue !== undefined ? `J’ai reçu ${formatFcfa(feedback.amountDue)} : valider l’entrée` : 'J’ai reçu les espèces : valider l’entrée'}
                                                </Button>
                                                <Button variant="outline" size="lg" className="min-h-[48px]" onClick={handleAbandonCash} disabled={cashConfirming}>
                                                    Annuler (le spectateur ne paie pas)
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                                                    Vous n’êtes pas habilité à encaisser : orientez le spectateur vers la caisse de l’événement.
                                                </p>
                                                <Button variant="outline" size="lg" fullWidth className="min-h-[48px]" onClick={handleAbandonCash}>
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
                            <div className="flex gap-2" role="group" aria-label="Mode de contrôle">
                                <button
                                    type="button"
                                    aria-pressed={inputMode === 'camera'}
                                    onClick={() => { setInputMode('camera'); if (!cashPending) setFeedback(null); }}
                                    className={`flex-1 min-h-[48px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] ${
                                        inputMode === 'camera' ? 'bg-[#FF5722] text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    <Camera size={16} aria-hidden="true" /> Caméra
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={inputMode === 'manual'}
                                    onClick={() => { setInputMode('manual'); if (!cashPending) setFeedback(null); }}
                                    className={`flex-1 min-h-[48px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] ${
                                        inputMode === 'manual' ? 'bg-[#FF5722] text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    <Keyboard size={16} aria-hidden="true" /> Saisie manuelle
                                </button>
                            </div>

                            {inputMode === 'camera' && !cashPending && (
                                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                                    <CameraQrScanner
                                        onScan={handleCameraScan}
                                        isVerifying={scanDisabled}
                                        onSwitchToManual={() => setInputMode('manual')}
                                        autoResumeDelayMs={2500}
                                    />
                                </div>
                            )}
                            {inputMode === 'camera' && cashPending && (
                                <div role="status" className="p-4 rounded-2xl border border-dashed border-blue-400 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/20 flex items-center gap-3">
                                    <PauseCircle size={24} aria-hidden="true" className="text-blue-700 dark:text-blue-300 shrink-0" />
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                        Caméra en pause : confirmez ou annulez l’encaissement en cours avant de scanner le billet suivant.
                                    </p>
                                </div>
                            )}

                            {inputMode === 'manual' && (
                                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
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
                        <section className="space-y-1.5" aria-labelledby="scanner-history-title">
                            <h3 id="scanner-history-title" className="text-xs font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                                Derniers scans
                            </h3>
                            <ul className="space-y-1">
                                {scanHistory.slice(0, 8).map(({ key, at, outcome }) => {
                                    const technical = isTechnicalOutcome(outcome);
                                    const dot = technical ? 'bg-slate-400'
                                        : outcome.result === 'valid' ? 'bg-emerald-500'
                                        : isTicketRefusal(outcome) ? 'bg-red-500'
                                        : 'bg-amber-500';
                                    return (
                                        <li key={key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800/50">
                                            <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate flex-1">
                                                {titleFor(outcome)}{outcome.ticket?.ticket_number ? ` · ${outcome.ticket.ticket_number}` : ''}
                                            </span>
                                            <time dateTime={at} className="text-[11px] text-slate-500 dark:text-zinc-400 shrink-0 font-mono">
                                                {new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </time>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            type="button"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="min-h-[44px] px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-300 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
                        >
                            <LogOut size={14} aria-hidden="true" /> Se déconnecter
                        </button>
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

