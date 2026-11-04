'use client';

/**
 * Scanner du contrôleur — voie unique /api/controller/scan (lot 4), refondu au lot 7 (tâche 7.2, contrat 6.2 ;
 * décisions D39 à D54, amendement A6).
 *
 * Parcours (390 × 844, une main) : écran « Commencer le contrôle » (événement, porte ; le premier toucher
 * autorise la vibration), puis en-tête compact (événement, « Porte A : 312 entrées », réseau), caméra en
 * haut, bascule « Caméra / Saisie manuelle », onglets Guichet et Caisse si l'affectation permet les espèces,
 * historique repliable.
 *
 * Une lecture : « Envoi… » au rendu suivant, « Réseau lent » après 1,5 s (nouvel essai automatique, même clé
 * d'idempotence), puis résultat plein écran (jetons --scan-*), une vibration distincte par catégorie (aucune
 * pour un incident technique), aucun son, et retour automatique au scan (délai réglable sur l'appareil pour
 * une entrée validée ; 3 s pour un refus ; l'encaissement attend une action). Hors ligne : bandeau
 * permanent, jamais de validation. Statut HTTP lu (components/scan/scan-client) : 401 renvoie à la connexion ;
 * 403, 429, 5xx, délai et réseau sont des incidents techniques (écran neutre, jamais un refus).
 *
 * Aucune lecture n'est ignorée sans trace : la caméra lit `onScan` par une ref (plus de boucle orpheline,
 * A6), la page n'ignore une lecture que si un scan est déjà en cours ou si c'est le même QR qu'une entrée
 * validée il y a moins de 20 s (D41), et elle le dit (console et message à l'écran).
 * Chiffres (porte, entrées, refus, historique) lus sur /api/controller/scans, jamais comptés ici (D42).
 * Marques de mesure : ev-scan:read (lecture envoyée), ev-scan:pending (« Envoi… » affiché),
 * ev-scan:result (résultat affiché).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Banknote, Calendar, Camera, Keyboard, Loader2, LogOut, Settings2 } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import { detachPushSubscription } from '@/lib/push/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { CameraQrScanner, type CameraReadVerdict } from '@/components/scan/CameraQrScanner';
import { CombatFlashOverlay } from '@/components/scan/CombatFlashOverlay';
import { ManualEntryForm } from '@/components/scan/ManualEntryForm';
import { ScannerShiftBanner, type ServedShift } from '@/components/scan/ScannerShiftBanner';
import { ScanStatusBar } from '@/components/scan/ScanStatusBar';
import { ScanHistoryList, type ServedRefusal, type ServedScan } from '@/components/scan/ScanHistoryList';
import { ScannerStartScreen, type StartChoice } from '@/components/scan/ScannerStartScreen';
import {
    categoryFor, confirmCashCheckin, isTechnicalOutcome, postScan, SCAN_INCIDENTS_ENDPOINT, titleFor,
    type ScanOutcome, type ScanRequest,
} from '@/components/scan/scan-client';
import { EVENT_STATUS_META, isEventEligibleForController, isEventStatus } from '@/lib/events/event-status';
import { formatEventDateTime, formatFcfa, formatTime } from '@/lib/format';
import { triggerHapticFeedback } from '@/lib/hardware/feedback';
import type { ShiftSummary } from '@/lib/shifts/shift.service';

// Caisse et guichet chargés à la demande : ni la caisse ni le guichet ne pèsent sur l'ouverture du scanner
const OpenShiftModal = dynamic(() => import('@/components/shifts/ShiftModals').then((m) => m.OpenShiftModal), { ssr: false });
const CloseShiftModal = dynamic(() => import('@/components/shifts/ShiftModals').then((m) => m.CloseShiftModal), { ssr: false });
const ZSummaryModal = dynamic(() => import('@/components/shifts/ShiftModals').then((m) => m.ZSummaryModal), { ssr: false });
const CounterSalePanel = dynamic(() => import('@/components/scan/CounterSalePanel').then((m) => m.CounterSalePanel), {
    ssr: false,
    loading: () => <p role="status" className="text-sm text-fg-muted">Chargement du guichet…</p>,
});

// ── Types ─────────────────────────────────────────────────────────

interface EventInfo {
    id: string; title: string; date?: string; start_time?: string | null; location?: string;
    status: string;
}

interface Assignment {
    id: string;
    can_accept_cash: boolean;
    entry_point: string | null;
    counter_sale_enabled: boolean;
    events: EventInfo;
}

interface ScanStats {
    doorLabel: string;
    doorEntries: number;
    myEntries: number;
    myRefusals: number;
    refusalsByResult: ServedRefusal[];
    recent: ServedScan[];
}

type InputMode = 'camera' | 'manual';
type Stage = 'idle' | 'pending' | 'slow' | 'result';
type Area = 'controle' | 'guichet' | 'caisse';

interface Shown { id: number; outcome: ScanOutcome; payload: string | null }

interface DeviceIncident { eventId: string; kind: 'NETWORK' | 'TIMEOUT'; at: string }

const SCANNER_PATH = '/controller/scanner';
/** « Réseau lent » après 1,5 s sans réponse (contrat 6.2). */
const SLOW_AFTER_MS = 1500;
/** Même QR qu'une entrée validée : ignoré pendant 20 s (D41). */
const DUPLICATE_VALID_MS = 20_000;
/** Retour automatique : refus, hors fenêtre et incident technique (D44). */
const REFUSAL_RETURN_MS = 3000;
/** Retour automatique d'une entrée validée : choix de l'appareil (D44). */
const ACCEPT_RETURN_CHOICES = [1000, 1500, 2000, 3000] as const;
const DEFAULT_ACCEPT_RETURN_MS = 1500;
const AUTO_RETURN_KEY = 'ev_scanner_auto_return_ms';
/** Compteurs relus après un scan (regroupe les rafales) ; temps réel : 5 s (contrat 6.2). */
const STATS_AFTER_SCAN_MS = 800;
const STATS_AFTER_REALTIME_MS = 5000;
const MAX_INCIDENTS_PER_REPORT = 20;

/** Libellé (EVENT_STATUS_META) d'un événement fermé au contrôle : terminé, suspendu ou annulé ; null sinon. */
function closedStatusLabel(status?: string): string | null {
    if (status !== 'TERMINE' && status !== 'SUSPENDU' && status !== 'ANNULE') return null;
    return isEventStatus(status) ? EVENT_STATUS_META[status].label : null;
}

function readAutoReturn(): number {
    try {
        const raw = Number(window.localStorage.getItem(AUTO_RETURN_KEY));
        return (ACCEPT_RETURN_CHOICES as readonly number[]).includes(raw) ? raw : DEFAULT_ACCEPT_RETURN_MS;
    } catch (err) {
        console.warn('[scanner] préférence de retour automatique illisible (valeur par défaut) :', err instanceof Error ? err.message : String(err));
        return DEFAULT_ACCEPT_RETURN_MS;
    }
}

function mark(name: 'ev-scan:read' | 'ev-scan:pending' | 'ev-scan:result'): void {
    try {
        performance.mark(name);
    } catch (err) {
        console.warn(`[scanner] marque ${name} non posée :`, err instanceof Error ? err.message : String(err));
    }
}

function toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

// ── Composant principal ──────────────────────────────────────────

export default function ControllerScannerPage() {
    const router = useRouter();

    // Affectations
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [started, setStarted] = useState(false);
    const [controllerName, setControllerName] = useState('');

    // Scan
    const [inputMode, setInputMode] = useState<InputMode>('camera');
    const [area, setArea] = useState<Area>('controle');
    const [stage, setStage] = useState<Stage>('idle');
    const [attempt, setAttempt] = useState(1);
    const [shown, setShown] = useState<Shown | null>(null);
    const [cashConfirming, setCashConfirming] = useState(false);
    const [cashError, setCashError] = useState<ScanOutcome | null>(null);
    const [ignoredNotice, setIgnoredNotice] = useState<string | null>(null);
    const [online, setOnline] = useState(true);
    const [autoReturnMs, setAutoReturnMs] = useState(DEFAULT_ACCEPT_RETURN_MS);

    // Chiffres servis par le serveur
    const [stats, setStats] = useState<ScanStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    // Caisse
    const [activeShift, setActiveShift] = useState<ServedShift | null>(null);
    const [showOpenShift, setShowOpenShift] = useState(false);
    const [showCloseShift, setShowCloseShift] = useState(false);
    const [zSummary, setZSummary] = useState<ShiftSummary | null>(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const selected = assignments.find((a) => a.id === selectedId) ?? null;
    const eventId = selected?.events?.id ?? null;

    const eventIdRef = useRef<string | null>(null);
    eventIdRef.current = started ? eventId : null;
    /** Un scan est envoyé ou son résultat est affiché : toute lecture est écartée (avec trace). */
    const busyRef = useRef(false);
    const lastValidRef = useRef<{ payload: string; at: number } | null>(null);
    const ignoredTraceRef = useRef<{ payload: string; at: number } | null>(null);
    const seqRef = useRef(0);
    const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const incidentsRef = useRef<DeviceIncident[]>([]);
    const flushingRef = useRef(false);

    /** Session expirée (HTTP 401) : retour à la connexion, jamais un « billet invalide ». */
    const redirectIfSessionExpired = useCallback((outcome: { httpStatus: number | null }): boolean => {
        if (outcome.httpStatus !== 401) return false;
        router.replace(`/login?redirect=${encodeURIComponent(SCANNER_PATH)}`);
        return true;
    }, [router]);

    const goToLogin = useCallback(() => {
        router.replace(`/login?redirect=${encodeURIComponent(SCANNER_PATH)}`);
    }, [router]);

    // ── Démarrage : préférence orpheline de l'audio retirée (D52), préférence de retour, réseau ──
    useEffect(() => {
        try {
            window.localStorage.removeItem('event_village_wolof_muted');
        } catch (err) {
            console.warn('[scanner] préférence audio du lot 4 non retirée :', err instanceof Error ? err.message : String(err));
        }
        setAutoReturnMs(readAutoReturn());
        setOnline(navigator.onLine !== false);
    }, []);

    // ── Affectations ──
    const fetchAssignments = useCallback(async () => {
        try {
            const res = await fetch('/api/controller/assignments', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (res.status === 401) {
                goToLogin();
                return;
            }
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Impossible de charger les événements.');
                return;
            }
            const list: Assignment[] = ((data.assignments ?? []) as Array<Record<string, unknown>>).map((a) => ({
                id: String(a.id),
                can_accept_cash: a.can_accept_cash === true,
                entry_point: typeof a.entry_point === 'string' && a.entry_point.trim() !== '' ? a.entry_point : null,
                counter_sale_enabled: a.counter_sale_enabled === true,
                events: (a.events ?? {}) as EventInfo,
            }));
            // Événements ouverts au contrôle d'abord, puis par date
            list.sort((x, y) => Number(isEventEligibleForController(y.events?.status)) - Number(isEventEligibleForController(x.events?.status))
                || String(x.events?.date ?? '').localeCompare(String(y.events?.date ?? '')));
            setAssignments(list);
            if (data.controller) {
                const name = [data.controller.first_name, data.controller.last_name].filter(Boolean).join(' ');
                setControllerName(name);
            }
            setSelectedId((current) => (current && list.some((a) => a.id === current) ? current
                : (list.find((a) => isEventEligibleForController(a.events?.status)) ?? list[0])?.id ?? null));
            setLoadError('');
        } catch (err) {
            console.warn('[scanner] affectations : réseau indisponible', err instanceof Error ? err.message : String(err));
            setLoadError('Réseau indisponible : vos événements n’ont pas pu être chargés.');
        } finally {
            setLoading(false);
        }
    }, [goToLogin]);

    useEffect(() => { void fetchAssignments(); }, [fetchAssignments]);

    // ── Chiffres du contrôleur (serveur) ──
    const fetchStats = useCallback(async () => {
        const id = eventIdRef.current;
        if (!id) return;
        try {
            const res = await fetch(`/api/controller/scans?event_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
            if (res.status === 401) {
                goToLogin();
                return;
            }
            const data = await res.json();
            if (id !== eventIdRef.current) return;
            if (!res.ok) {
                setStatsError(typeof data.error === 'string' ? data.error : 'Vos chiffres n’ont pas pu être lus.');
                return;
            }
            setStats({
                doorLabel: String(data.door_label ?? 'Vos entrées'),
                doorEntries: toNumber(data.door_entries),
                myEntries: toNumber(data.my_entries),
                myRefusals: toNumber(data.my_refusals),
                refusalsByResult: Array.isArray(data.refusals_by_result) ? data.refusals_by_result : [],
                recent: Array.isArray(data.recent) ? data.recent : [],
            });
            setStatsError(null);
        } catch (err) {
            console.warn('[scanner] chiffres du contrôle : réseau indisponible', err instanceof Error ? err.message : String(err));
            if (id === eventIdRef.current) setStatsError('Réseau indisponible : chiffres non actualisés.');
        }
    }, [goToLogin]);

    const scheduleStats = useCallback((delayMs: number) => {
        if (statsTimerRef.current) {
            if (delayMs >= STATS_AFTER_REALTIME_MS) return; // une relecture est déjà prévue
            clearTimeout(statsTimerRef.current);
        }
        statsTimerRef.current = setTimeout(() => {
            statsTimerRef.current = null;
            void fetchStats();
        }, delayMs);
    }, [fetchStats]);

    const fetchActiveShift = useCallback(async () => {
        const id = eventIdRef.current;
        if (!id) return;
        try {
            const res = await fetch(`/api/controller/shifts/active?event_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
            const data = await res.json();
            if (id !== eventIdRef.current) return;
            if (res.ok && data.success) {
                setActiveShift(data.shift ? { ...data.shift, expected_cash_in_drawer: data.expected_cash_in_drawer ?? data.shift.expected_cash_in_drawer ?? null } : null);
            } else {
                console.warn('[scanner] caisse active illisible :', res.status, data?.error);
            }
        } catch (err) {
            console.warn('[scanner] caisse active : réseau indisponible', err instanceof Error ? err.message : String(err));
        }
    }, []);

    // ── Incidents réseau de l'appareil, déclarés en lot au retour du réseau (D54) ──
    const flushIncidents = useCallback(async () => {
        const first = incidentsRef.current[0];
        if (!first || flushingRef.current || navigator.onLine === false) return;
        const batch = incidentsRef.current.filter((i) => i.eventId === first.eventId).slice(0, MAX_INCIDENTS_PER_REPORT);
        flushingRef.current = true;
        try {
            const res = await fetch(SCAN_INCIDENTS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: first.eventId, incidents: batch.map(({ kind, at }) => ({ kind, at })) }),
            });
            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429)) {
                if (!res.ok) console.warn(`[scanner] incidents refusés par le serveur (HTTP ${res.status}) : abandonnés`);
                incidentsRef.current = incidentsRef.current.filter((i) => !batch.includes(i));
            } else {
                console.warn(`[scanner] incidents non déclarés (HTTP ${res.status}) : nouvel essai au prochain retour du réseau`);
            }
        } catch (err) {
            console.warn('[scanner] incidents non déclarés (réseau) : nouvel essai plus tard', err instanceof Error ? err.message : String(err));
        } finally {
            flushingRef.current = false;
        }
    }, []);

    useEffect(() => {
        const goOnline = () => {
            setOnline(true);
            void flushIncidents();
            void fetchStats();
        };
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, [fetchStats, flushIncidents]);

    // ── Événement contrôlé : chiffres, caisse, temps réel (billets compostés, anti-rebond 5 s) ──
    useEffect(() => {
        if (!started || !eventId) return;
        setStats(null);
        setStatsError(null);
        void fetchStats();
        if (selected?.can_accept_cash) void fetchActiveShift();
        else setActiveShift(null);
        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`scanner-tickets-live-${eventId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventId}` },
                (payload: { new: Record<string, unknown> }) => {
                    if ((payload.new as { status?: string })?.status === 'UTILISE') scheduleStats(STATS_AFTER_REALTIME_MS);
                })
            .subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [started, eventId, selected?.can_accept_cash, fetchStats, fetchActiveShift, scheduleStats]);

    useEffect(() => () => {
        for (const t of [slowTimerRef, noticeTimerRef, statsTimerRef]) if (t.current) clearTimeout(t.current);
    }, []);

    // ── Marques de mesure : « Envoi… » et résultat affichés ──
    useEffect(() => {
        if (stage === 'pending') mark('ev-scan:pending');
    }, [stage]);
    useEffect(() => {
        if (shown) mark('ev-scan:result');
    }, [shown]);

    // ── Résultat : vibration, plein écran, compteurs ──
    const presentOutcome = useCallback((outcome: ScanOutcome, payload: string | null) => {
        if (slowTimerRef.current) {
            clearTimeout(slowTimerRef.current);
            slowTimerRef.current = null;
        }
        const technical = isTechnicalOutcome(outcome);
        // Une vibration par résultat, aucune pour un incident technique (D47, D50)
        triggerHapticFeedback(categoryFor(outcome));
        if (outcome.result === 'valid' && !technical && payload) lastValidRef.current = { payload, at: Date.now() };
        const id = eventIdRef.current;
        if (id && (outcome.failure === 'network' || outcome.failure === 'offline' || outcome.failure === 'timeout')) {
            const incident: DeviceIncident = { eventId: id, kind: outcome.failure === 'timeout' ? 'TIMEOUT' : 'NETWORK', at: new Date().toISOString() };
            incidentsRef.current = [...incidentsRef.current, incident].slice(-100);
        }
        busyRef.current = true;
        seqRef.current += 1;
        setShown({ id: seqRef.current, outcome, payload });
        setStage('result');
        if (!technical) {
            scheduleStats(STATS_AFTER_SCAN_MS);
            if (incidentsRef.current.length > 0) void flushIncidents();
        }
    }, [flushIncidents, scheduleStats]);

    const dismissResult = useCallback(() => {
        setShown(null);
        setCashError(null);
        setStage('idle');
        busyRef.current = false;
    }, []);

    /** Envoi d'un scan (caméra ou saisie manuelle) : « Envoi… », « Réseau lent », puis résultat. */
    const runScan = useCallback(async (request: ScanRequest, payload: string | null, key?: string) => {
        busyRef.current = true;
        setCashError(null);
        setShown(null);
        setAttempt(1);
        setStage('pending');
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        slowTimerRef.current = setTimeout(() => {
            slowTimerRef.current = null;
            setStage((s) => (s === 'pending' ? 'slow' : s));
        }, SLOW_AFTER_MS);
        const outcome = await postScan(request, { key, onAttempt: setAttempt });
        if (redirectIfSessionExpired(outcome)) {
            if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
            busyRef.current = false;
            setStage('idle');
            return;
        }
        presentOutcome(outcome, payload);
    }, [presentOutcome, redirectIfSessionExpired]);

    const runScanRef = useRef(runScan);
    runScanRef.current = runScan;

    /** Lecture ignorée : toujours tracée (console, au plus une fois par QR et par 5 s) et dite à l'écran. */
    const traceIgnored = useCallback((payload: string, reason: string, notice: string | null) => {
        const now = Date.now();
        const last = ignoredTraceRef.current;
        if (!last || last.payload !== payload || now - last.at > 5000) {
            ignoredTraceRef.current = { payload, at: now };
            console.info(`[scanner] lecture ignorée : ${reason}`);
        }
        if (notice) {
            setIgnoredNotice(notice);
            if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = setTimeout(() => setIgnoredNotice(null), 3000);
        }
    }, []);

    /** Lecture de la caméra (stable : la caméra la lit par une ref, aucune fermeture périmée). */
    const handleCameraRead = useCallback((code: string): CameraReadVerdict => {
        const payload = code.trim();
        const id = eventIdRef.current;
        if (!payload) return 'ignored';
        if (!id) {
            traceIgnored(payload, 'aucun événement choisi', null);
            return 'ignored';
        }
        if (busyRef.current) {
            traceIgnored(payload, 'un scan est déjà en cours ou affiché', null);
            return 'ignored';
        }
        const last = lastValidRef.current;
        if (last && last.payload === payload && Date.now() - last.at < DUPLICATE_VALID_MS) {
            traceIgnored(payload, `même QR que l’entrée validée à ${formatTime(last.at)} (anti-doublon de 20 s)`,
                `Même billet que l’entrée validée à ${formatTime(last.at)} : présentez le billet suivant.`);
            return 'ignored';
        }
        mark('ev-scan:read');
        void runScanRef.current({ eventId: id, payload }, payload);
        return 'accepted';
    }, [traceIgnored]);

    const handleManualValidate = useCallback(async (manualTicketNumber: string, key: string) => {
        const id = eventIdRef.current;
        if (!id || busyRef.current) {
            console.info('[scanner] validation manuelle ignorée : un scan est déjà en cours ou affiché');
            return;
        }
        mark('ev-scan:read');
        await runScanRef.current({ eventId: id, manualTicketNumber, identityVerified: true }, null, key);
    }, []);

    // ── Encaissement espèces (PUT, tout ou rien côté serveur, idempotent) ──
    const handleConfirmCash = async () => {
        const id = eventIdRef.current;
        const pending = shown?.outcome;
        if (!pending?.scanId || !id) return;
        if (!activeShift) {
            // L'écran d'encaissement reste affiché : l'encaissement reprend une fois la caisse ouverte
            setShowOpenShift(true);
            return;
        }
        setCashConfirming(true);
        try {
            const outcome = await confirmCashCheckin(pending.scanId, id);
            if (redirectIfSessionExpired(outcome)) return;
            if (outcome.result === 'valid' && !outcome.failure) {
                setCashError(null);
                presentOutcome({
                    ...outcome,
                    ticket: pending.ticket,
                    message: outcome.amount !== undefined ? `Encaissé : ${formatFcfa(outcome.amount)}. Entrée validée.` : outcome.message,
                }, shown?.payload ?? null);
                void fetchActiveShift();
            } else {
                // Refus du serveur : rien n'est encaissé ni composté ; l'écran reste jusqu'à une action explicite
                setCashError(outcome);
            }
        } finally {
            setCashConfirming(false);
        }
    };

    const handleLogout = async () => {
        const supabase = getBrowserClient();
        // Lot 6 (contrat F4) : l'appareil ne reçoit plus les notifications push du compte après la déconnexion
        // (erreur journalisée par detachPushSubscription, la déconnexion continue).
        await detachPushSubscription();
        await supabase.auth.signOut({ scope: 'global' });
        router.push('/login');
    };

    const changeAutoReturn = (value: number) => {
        setAutoReturnMs(value);
        try {
            window.localStorage.setItem(AUTO_RETURN_KEY, String(value));
        } catch (err) {
            console.warn('[scanner] préférence de retour automatique non enregistrée :', err instanceof Error ? err.message : String(err));
        }
    };

    const backToStart = () => {
        dismissResult();
        lastValidRef.current = null;
        setStarted(false);
        setArea('controle');
        setStats(null);
        void fetchAssignments();
    };

    const logoutDialog = (
        <ConfirmDialog
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            onConfirm={handleLogout}
            title="Se déconnecter ?"
            message="Vous serez déconnecté de tous vos appareils. Vous devrez vous reconnecter pour accéder au scanner."
            confirmLabel="Déconnexion"
            variant="danger"
        />
    );

    const logoutButton = (
        <div className="flex justify-center pt-2">
            <Button variant="ghost" leftIcon={<LogOut size={18} />} onClick={() => setShowLogoutConfirm(true)}>
                Se déconnecter
            </Button>
        </div>
    );

    // ── Rendu : chargement, erreur, aucune affectation, écran de départ ──

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20" role="status" aria-busy="true">
                <Loader2 size={32} aria-hidden="true" className="text-brand-fg motion-safe:animate-spin" />
                <p className="text-sm text-fg-muted">Chargement de vos événements…</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <>
                <ErrorState
                    title="Vos événements n’ont pas pu être chargés"
                    description={loadError}
                    onRetry={() => { setLoading(true); void fetchAssignments(); }}
                />
                {logoutButton}
                {logoutDialog}
            </>
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
                        <h1 className="text-lg font-semibold text-fg">Aucun événement assigné</h1>
                        <p className="mx-auto max-w-sm text-sm leading-relaxed text-fg-muted">
                            Vous serez informé lorsqu’un nouvel événement vous sera assigné.
                        </p>
                    </div>
                    <LinkButton href="/" variant="secondary">Retour à l’accueil</LinkButton>
                </div>
                {logoutButton}
                {logoutDialog}
            </>
        );
    }

    if (!started || !selected) {
        const choices: StartChoice[] = assignments.map((a) => ({
            id: a.id,
            title: a.events?.title || 'Événement sans titre',
            dateLabel: formatEventDateTime(a.events?.date ?? null, a.events?.start_time ?? null),
            location: a.events?.location ?? null,
            closedLabel: closedStatusLabel(a.events?.status),
            entryPoint: a.entry_point,
        }));
        return (
            <>
                <ScannerStartScreen
                    choices={choices}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onStart={() => { lastValidRef.current = null; setStarted(true); }}
                    controllerName={controllerName || undefined}
                />
                {logoutButton}
                {logoutDialog}
            </>
        );
    }

    // ── Rendu : contrôle en cours ──

    const eventStatus = selected.events?.status;
    const eligible = isEventEligibleForController(eventStatus);
    const canCash = selected.can_accept_cash;
    const showCounter = canCash && selected.counter_sale_enabled;
    const outcome = shown?.outcome ?? null;
    const cashPending = outcome?.result === 'cash_required' && !isTechnicalOutcome(outcome);
    const modalOpen = showOpenShift || showCloseShift || zSummary !== null;
    // Hors ligne, la caméra continue de lire : chaque lecture affiche « Hors ligne : rien n'est validé »
    const cameraPaused = stage !== 'idle' || modalOpen;
    const tabs = [
        { id: 'controle', label: 'Contrôle' },
        ...(showCounter ? [{ id: 'guichet', label: 'Guichet' }] : []),
        ...(canCash ? [{ id: 'caisse', label: 'Caisse' }] : []),
    ];
    const currentArea: Area = tabs.some((t) => t.id === area) ? area : 'controle';

    const pendingLayer = stage === 'pending' || stage === 'slow' ? (
        <div data-scan-state={stage} role="status" aria-live="polite"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-scan-tech-bg p-6 text-center text-scan-tech-fg">
            <Loader2 size={40} aria-hidden="true" className="motion-safe:animate-spin" />
            <p className="text-2xl font-bold">{stage === 'pending' ? 'Envoi…' : 'Réseau lent'}</p>
            {stage === 'slow' && (
                <p className="max-w-xs text-base font-semibold">
                    Ne refaites pas scanner : nouvel essai automatique{attempt > 1 ? ` (essai ${attempt} sur 3)` : ''}.
                </p>
            )}
        </div>
    ) : null;

    const control = (
        <div className="flex flex-col gap-3">
            {!eligible ? (
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
                    {/* Caméra gardée ouverte mais en pause pendant un encaissement (décision attendue) */}
                    {inputMode === 'camera' && (
                        <CameraQrScanner
                            onScan={handleCameraRead}
                            paused={cameraPaused || cashPending}
                            onSwitchToManual={() => setInputMode('manual')}
                            overlay={pendingLayer}
                        />
                    )}
                    {inputMode === 'manual' && (
                        <div className="relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                            {pendingLayer && <div className="relative min-h-40 overflow-hidden rounded-2xl">{pendingLayer}</div>}
                            <ManualEntryForm
                                eventId={selected.events.id}
                                onValidate={handleManualValidate}
                                isSubmitting={stage === 'pending' || stage === 'slow'}
                                disabled={cashPending || !online}
                                disabledReason={!online ? 'Hors ligne : la saisie manuelle reprendra au retour du réseau.' : 'Saisie en pause : tranchez d’abord l’encaissement en cours.'}
                                onSessionExpired={goToLogin}
                            />
                        </div>
                    )}

                    {ignoredNotice && (
                        <p role="status" className="rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-fg">
                            {ignoredNotice}
                        </p>
                    )}

                    {/* Mode : caméra ou saisie manuelle */}
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mode de contrôle">
                        <Button
                            variant={inputMode === 'camera' ? 'primary' : 'secondary'}
                            size="lg"
                            className="gap-2 whitespace-nowrap px-4 text-sm"
                            aria-pressed={inputMode === 'camera'}
                            onClick={() => setInputMode('camera')}
                            leftIcon={<Camera size={18} />}
                        >
                            Caméra
                        </Button>
                        <Button
                            variant={inputMode === 'manual' ? 'primary' : 'secondary'}
                            size="lg"
                            className="gap-2 whitespace-nowrap px-4 text-sm"
                            aria-pressed={inputMode === 'manual'}
                            onClick={() => setInputMode('manual')}
                            leftIcon={<Keyboard size={18} />}
                        >
                            Saisie manuelle
                        </Button>
                    </div>
                </>
            )}

            <ScanHistoryList
                recent={stats?.recent ?? []}
                myEntries={stats?.myEntries ?? null}
                myRefusals={stats?.myRefusals ?? null}
                refusalsByResult={stats?.refusalsByResult ?? []}
                loading={stats === null}
                error={statsError}
            />

            <details className="rounded-2xl border border-border bg-surface">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-base font-semibold text-fg">
                    <Settings2 size={18} aria-hidden="true" className="text-fg-muted" />
                    Réglages de cet appareil
                </summary>
                <div className="px-4 pb-4">
                    <Select
                        id="scanner-auto-return"
                        label="Retour au scan après une entrée validée"
                        hint="Un refus reste affiché 3 secondes ; un encaissement attend votre décision. Touchez l’écran pour revenir tout de suite."
                        value={String(autoReturnMs)}
                        onChange={(e) => changeAutoReturn(Number(e.target.value))}
                        options={ACCEPT_RETURN_CHOICES.map((ms) => ({ value: String(ms), label: `${String(ms / 1000).replace('.', ',')} s` }))}
                    />
                </div>
            </details>
        </div>
    );

    const cashArea = (
        <div className="flex flex-col gap-3">
            <ScannerShiftBanner
                canAcceptCash={canCash}
                activeShift={activeShift}
                onOpenShiftClick={() => setShowOpenShift(true)}
                onCloseShiftClick={() => setShowCloseShift(true)}
            />
        </div>
    );

    // Durée du plein écran : entrée validée = préférence de l'appareil ; encaissement = attend une action
    const overlayDuration = !outcome ? 0
        : cashPending ? 0
        : outcome.result === 'valid' && !isTechnicalOutcome(outcome) ? autoReturnMs
        : REFUSAL_RETURN_MS;
    const recentByMe = outcome?.result === 'already_used' && outcome.ticket?.checked_in_by_me === true && outcome.ticket.checked_in_at
        ? Date.now() - Date.parse(outcome.ticket.checked_in_at) < 30_000 : false;

    return (
        <div className="flex flex-col gap-3">
            <ScanStatusBar
                eventTitle={selected.events?.title || 'Événement sans titre'}
                doorLabel={stats?.doorLabel ?? null}
                doorEntries={stats?.doorEntries ?? null}
                online={online}
                statsStale={statsError !== null && stats !== null}
                onChangeEvent={backToStart}
                onLogout={() => setShowLogoutConfirm(true)}
            />

            {!online && (
                <div data-scan-state="offline">
                    <StatusBanner tone="danger" title="Hors ligne : aucune entrée ne peut être validée" announce="alert">
                        Faites patienter, passez sur le routeur de secours, puis reprenez.
                    </StatusBanner>
                </div>
            )}

            {tabs.length > 1 ? (
                <>
                    <Tabs tabs={tabs} value={currentArea} onChange={(id) => setArea(id as Area)} ariaLabel="Espace du contrôleur" idPrefix="scanner" />
                    <TabPanel idPrefix="scanner" tabIdValue={currentArea}>
                        {currentArea === 'controle' && control}
                        {currentArea === 'guichet' && (
                            <CounterSalePanel
                                eventId={selected.events.id}
                                onOpenShift={() => setShowOpenShift(true)}
                                onSold={() => { void fetchActiveShift(); scheduleStats(STATS_AFTER_SCAN_MS); }}
                                onSessionExpired={goToLogin}
                            />
                        )}
                        {currentArea === 'caisse' && cashArea}
                    </TabPanel>
                </>
            ) : control}

            {/* Résultat plein écran : un seul à la fois, neuf à chaque scan */}
            {outcome && (
                <CombatFlashOverlay
                    key={shown?.id}
                    status={outcome.result}
                    kind={categoryFor(outcome)}
                    title={isTechnicalOutcome(outcome) ? titleFor(outcome) : undefined}
                    message={outcome.message}
                    holderName={outcome.ticket?.holder}
                    category={outcome.ticket?.category}
                    ticketNumber={outcome.ticket?.ticket_number}
                    checkedInAt={outcome.ticket?.checked_in_at ?? null}
                    checkedInByMe={recentByMe}
                    amountDue={outcome.amountDue}
                    durationMs={overlayDuration}
                    onDismiss={dismissResult}
                >
                    {cashPending ? (
                        canCash ? (
                            <>
                                {cashError && (
                                    <StatusBanner tone="danger" title="Encaissement non enregistré" announce="alert">
                                        {titleFor(cashError)}. Rien n’a été encaissé ni validé : ne laissez pas entrer le spectateur.
                                    </StatusBanner>
                                )}
                                <Button variant="primary" size="lg" fullWidth isLoading={cashConfirming} onClick={() => void handleConfirmCash()} leftIcon={<Banknote size={18} />}>
                                    {!activeShift ? 'Ouvrir ma caisse pour encaisser'
                                        : outcome.amountDue !== undefined ? `J’ai reçu ${formatFcfa(outcome.amountDue)} : valider l’entrée` : 'J’ai reçu les espèces : valider l’entrée'}
                                </Button>
                                <Button variant="secondary" size="lg" fullWidth onClick={dismissResult} disabled={cashConfirming}>
                                    Annuler : le spectateur ne paie pas
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-semibold">Vous n’êtes pas habilité à encaisser : orientez le spectateur vers la caisse de l’événement.</p>
                                <Button variant="secondary" size="lg" fullWidth onClick={dismissResult}>Fermer et reprendre le scan</Button>
                            </>
                        )
                    ) : undefined}
                </CombatFlashOverlay>
            )}

            {canCash && (
                <OpenShiftModal
                    isOpen={showOpenShift}
                    onClose={() => setShowOpenShift(false)}
                    eventId={selected.events.id}
                    eventTitle={selected.events.title}
                    onShiftOpened={() => { void fetchActiveShift(); }}
                />
            )}
            {canCash && activeShift && (
                <CloseShiftModal
                    isOpen={showCloseShift}
                    onClose={() => setShowCloseShift(false)}
                    shift={activeShift}
                    onShiftClosed={(summary) => {
                        setActiveShift(null);
                        setZSummary(summary);
                    }}
                />
            )}
            {zSummary && (
                <ZSummaryModal isOpen={zSummary !== null} onClose={() => setZSummary(null)} summary={zSummary} />
            )}
            {logoutDialog}
        </div>
    );
}
