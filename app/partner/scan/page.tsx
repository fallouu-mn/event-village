'use client';

/**
 * Scan partenaire (lot 4) — même voie que le scanner contrôleur (/api/controller/scan) et même
 * carte de résultat. Le partenaire propriétaire choisit l'un de ses événements ; la saisie manuelle
 * exige la vérification d'une pièce d'identité et n'est acceptée que si le réglage
 * access.manual_entry_scope l'autorise (sinon : « saisie manuelle refusée »).
 * Lot 7 (7.2) : clé d'idempotence par lecture et relances (components/scan/scan-client), aucun son ; la
 * caméra lit `onScan` par une ref et s'arrête pendant l'envoi et l'affichage du résultat (aucune boucle
 * orpheline) ; une lecture ignorée est tracée ; saisie manuelle en deux temps (vérifier, puis valider).
 *
 * Reprise de session (amendement A10, mêmes règles que /controller/scanner, lib/scan/scan-session) :
 *  1. événement et mode (caméra ou saisie manuelle) retenus sur l'appareil, clé par compte, sans donnée
 *     personnelle ; repris seulement si l'événement est encore publié et à vous (liste relue sur le serveur),
 *     sinon message et choix de l'événement ; effacés à la déconnexion (AuthProvider) ;
 *  2. compteur et derniers scans servis par GET /api/controller/scans (le serveur vérifie la propriété de
 *     l'événement, comme pour le scan ; le middleware ouvre cette lecture au partenaire, voie de contrôle
 *     partagée) et relus au montage, après chaque scan et à chaque retour (visibilitychange, pageshow). La
 *     liste « Scans de la session », tenue dans la page et perdue au retour, est supprimée ;
 *  3. scan sans verdict renvoyé au retour avec la même clé (2 minutes au plus), « Résultat retrouvé » ; ce renvoi ne
 *     demande que le verdict de la lecture d'origine (8.2 e, L45), sans ligne en base le billet reste à rescanner ;
 *  5. caméra coupée en arrière-plan, écran « Reprendre le contrôle » au retour (pas de caisse ici : point 4
 *     sans objet pour le partenaire).
 *
 * Lot 9 bis (R16, B48, contrat 4.3) : la liste ne retient que les événements dont le serveur dit le contrôle ouvert
 * (GET /api/controller/scan/state, même règle que ticket_scan) : un PUBLIE dans sa fenêtre, mais aussi un TERMINE
 * tant que la fenêtre après la fin reste ouverte ; plus aucune décision d'après le seul statut.
 *
 * Lot 9 ter (9t.15, contrat C.1.4) : événement à zones (GET /api/partner/events/[id]/zones) → liste requise « Porte de
 * contrôle » (portes groupées par zone) ; `gateId` envoyé avec chaque scan et chaque vérification. La règle des zones est
 * appliquée par le serveur (sans porte choisie : « Aucune porte… », rien n'est validé).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, Keyboard, Loader2, QrCode, ShieldAlert, Ticket } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { CameraQrScanner, type CameraReadVerdict } from '@/components/scan/CameraQrScanner';
import { ManualEntryForm } from '@/components/scan/ManualEntryForm';
import { ScanHistoryList, type ServedRefusal, type ServedScan } from '@/components/scan/ScanHistoryList';
import { ScanResultPanel } from '@/components/scan/ScanResultPanel';
import { newIdempotencyKey, postScan, recoveredTimeOf, type ScanOutcome, type ScanRequest } from '@/components/scan/scan-client';
import { formatInteger, formatShortDate, formatTime } from '@/lib/format';
import {
    clearPendingScan, clearScanSession, isVerdictReceived, pendingPayload, readPendingScan, readScanSession,
    savePendingScan, saveScanSession, useScannerReturn, type ScanInputMode, type ScanReturnReason,
} from '@/lib/scan/scan-session';

interface PartnerEvent { id: string; title: string; start_date?: string; status?: string }

/** Lot 9 ter : zones et portes de l'événement contrôlé (null : sans zone ou pas encore lues). */
interface ZoneGates { zones: Array<{ id: string; name: string; gates: Array<{ id: string; name: string }> }> }

/** Au plus 50 événements par lecture de l'état du contrôle (route scan/state). */
const MAX_STATE_EVENTS = 50;
/** Statuts dont le contrôle peut être ouvert (scan_event_problem) ; l'ouverture elle-même est dite par le serveur. */
const SCANNABLE_STATUSES = ['PUBLIE', 'TERMINE'];

/** Chiffres et historique servis par GET /api/controller/scans (jamais comptés dans la page). */
interface ServedStats {
    doorLabel: string;
    doorEntries: number;
    myEntries: number;
    myRefusals: number;
    refusalsByResult: ServedRefusal[];
    recent: ServedScan[];
}

/**
 * `recoveredAt` : heure de la lecture quand le renvoi au retour a rendu un verdict, sinon null. `resumed` : scan renvoyé
 * au retour, avec ou sans verdict.
 */
interface Shown { outcome: ScanOutcome; recoveredAt: number | null; resumed: boolean }

const PAGE_PATH = '/partner/scan';
const SURFACE = 'partenaire' as const;
const FEEDBACK_DISPLAY_MS = 4000;
/** Résultat d'un scan repris au retour dans l'application : affiché plus longtemps (le contrôleur revient). */
const RECOVERED_DISPLAY_MS = 10_000;
/** Même QR qu'une entrée validée : ignoré pendant 20 s (D41). */
const DUPLICATE_VALID_MS = 20_000;
/** Chiffres relus après un scan (regroupe les rafales). */
const STATS_AFTER_SCAN_MS = 800;

function toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function errText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export default function PartnerScanPage() {
    const router = useRouter();
    const { user } = useAuth();
    const accountId = user?.id ?? null;
    const [events, setEvents] = useState<PartnerEvent[]>([]);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [eventId, setEventId] = useState('');
    const [scanMode, setScanMode] = useState<ScanInputMode>('camera');
    const [isVerifying, setIsVerifying] = useState(false);
    const [shown, setShown] = useState<Shown | null>(null);
    const [stats, setStats] = useState<ServedStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    /** Session retenue non reprise (événement plus ouvert au contrôle). */
    const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
    const [pendingNotice, setPendingNotice] = useState<string | null>(null);
    /** Session retrouvée : la caméra attend « Reprendre le contrôle » (aucun démarrage sans geste). */
    const [resumeGate, setResumeGate] = useState(false);
    /** Envoi en cours : lu par la caméra au moment de la lecture (jamais une valeur périmée). */
    const busyRef = useRef(false);
    const lastValidRef = useRef<{ payload: string; at: number } | null>(null);
    const eventIdRef = useRef(eventId);
    eventIdRef.current = eventId;
    const accountIdRef = useRef(accountId);
    accountIdRef.current = accountId;
    const restoreDoneRef = useRef(false);
    /** L'application a été quittée pendant l'envoi en cours (useScannerReturn). */
    const awayRef = useRef(false);
    /** Renvoi du scan en attente (défini plus bas, appelé par runScan). */
    const resumePendingRef = useRef<(reason: string) => void>(() => undefined);
    const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Lot 9 ter : zones de l'événement contrôlé et porte choisie (envoyée avec chaque scan). */
    const [zoneGates, setZoneGates] = useState<ZoneGates | null>(null);
    const [zonesError, setZonesError] = useState<string | null>(null);
    const [gateId, setGateId] = useState('');

    const goToLogin = useCallback(() => {
        router.replace(`/login?redirect=${encodeURIComponent(PAGE_PATH)}`);
    }, [router]);

    // ── Événements du partenaire ouverts au contrôle (`quiet` : relecture au retour, un échec est journalisé sans écran
    // d'erreur) : liste lue, puis état du contrôle dit par le serveur (scan/state), seuls les événements ouverts restent ──
    const fetchEvents = useCallback(async (opts: { quiet?: boolean } = {}): Promise<PartnerEvent[] | null> => {
        const quiet = opts.quiet === true;
        try {
            const res = await fetch('/api/partner/events', { cache: 'no-store' });
            if (res.status === 401) {
                goToLogin();
                return null;
            }
            const data = await res.json();
            if (!res.ok || !data.success) {
                if (quiet) console.warn('[partner/scan] événements non relus au retour :', res.status, data.error);
                else setEventsError(data.error || 'Impossible de charger vos événements.');
                return null;
            }
            const candidates = ((data.events ?? []) as PartnerEvent[])
                .filter((e) => SCANNABLE_STATUSES.includes(String(e.status)))
                .sort((x, y) => String(y.start_date ?? '').localeCompare(String(x.start_date ?? '')))
                .slice(0, MAX_STATE_EVENTS);
            let list: PartnerEvent[] = [];
            if (candidates.length > 0) {
                const stateRes = await fetch(`/api/controller/scan/state?event_ids=${candidates.map((e) => encodeURIComponent(e.id)).join(',')}`, { cache: 'no-store' });
                if (stateRes.status === 401) {
                    goToLogin();
                    return null;
                }
                const state = await stateRes.json();
                if (!stateRes.ok || !Array.isArray(state.items)) {
                    if (quiet) console.warn('[partner/scan] état du contrôle non relu au retour :', stateRes.status, state.error);
                    else setEventsError(state.error || 'L’état du contrôle de vos événements n’a pas pu être lu.');
                    return null;
                }
                const open = new Set((state.items as Array<{ event_id?: unknown; open?: unknown }>)
                    .filter((i) => i.open === true).map((i) => String(i.event_id)));
                list = candidates.filter((e) => open.has(e.id))
                    .sort((x, y) => String(x.start_date ?? '').localeCompare(String(y.start_date ?? '')));
            }
            setEvents(list);
            setEventsError(null);
            return list;
        } catch (err) {
            console.warn('[partner/scan] événements : réseau indisponible', errText(err));
            if (!quiet) setEventsError('Erreur réseau : vos événements n’ont pas pu être chargés.');
            return null;
        } finally {
            setLoadingEvents(false);
        }
    }, [goToLogin]);

    useEffect(() => {
        void fetchEvents().then((list) => {
            if (list) setEventId((current) => current || list[0]?.id || '');
        });
    }, [fetchEvents]);

    // ── Reprise de session : même événement et même mode, si l'événement est encore publié et à vous ──
    useEffect(() => {
        if (restoreDoneRef.current || loadingEvents || !accountId || eventsError) return;
        restoreDoneRef.current = true;
        const memory = readScanSession(SURFACE, accountId);
        if (!memory) return;
        if (!events.some((e) => e.id === memory.eventId)) {
            clearScanSession(SURFACE, accountId);
            setRestoreNotice('L’événement que vous contrôliez n’est plus ouvert au contrôle : choisissez un événement.');
            setEventId('');
            return;
        }
        console.info(`[partner/scan] session reprise : même événement, mode ${memory.mode === 'camera' ? 'caméra' : 'saisie manuelle'}`);
        setEventId(memory.eventId);
        setScanMode(memory.mode);
        setResumeGate(memory.mode === 'camera');
    }, [loadingEvents, accountId, events, eventsError]);

    // Mémoire de l'appareil tenue à jour (identifiants seulement), après la tentative de reprise
    useEffect(() => {
        if (!accountId || !eventId || !restoreDoneRef.current) return;
        saveScanSession(SURFACE, accountId, { eventId, assignmentId: null, mode: scanMode, area: 'controle' });
    }, [accountId, eventId, scanMode, loadingEvents]);

    // ── Chiffres et historique (serveur) ──
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
            console.warn('[partner/scan] chiffres du contrôle : réseau indisponible', errText(err));
            if (id === eventIdRef.current) setStatsError('Réseau indisponible : chiffres non actualisés.');
        }
    }, [goToLogin]);

    const scheduleStats = useCallback(() => {
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
        statsTimerRef.current = setTimeout(() => {
            statsTimerRef.current = null;
            void fetchStats();
        }, STATS_AFTER_SCAN_MS);
    }, [fetchStats]);

    useEffect(() => () => {
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    }, []);

    // Résultat affiché 4 s (incident technique compris ; 10 s pour un scan repris au retour), puis la caméra reprend
    useEffect(() => {
        if (!shown) return;
        const timer = setTimeout(() => setShown(null), shown.resumed ? RECOVERED_DISPLAY_MS : FEEDBACK_DISPLAY_MS);
        return () => clearTimeout(timer);
    }, [shown]);

    /** Envoi d'un scan ; clé et requête gardées sur l'appareil jusqu'au verdict (renvoi au retour, même clé). */
    const runScan = useCallback(async (request: ScanRequest, payload: string | null, key?: string, recoveredAt: number | null = null) => {
        if (busyRef.current) {
            console.info('[partner/scan] lecture ignorée : un scan est déjà en cours');
            return;
        }
        const scanKey = key ?? newIdempotencyKey();
        const account = accountIdRef.current;
        if (account) savePendingScan(SURFACE, account, { key: scanKey, eventId: request.eventId, request, createdAt: recoveredAt ?? Date.now() });
        busyRef.current = true;
        awayRef.current = document.visibilityState === 'hidden';
        setIsVerifying(true);
        setPendingNotice(null);
        let left = false;
        try {
            const result = await postScan(request, { key: scanKey, replayOnly: recoveredAt !== null });
            const verdict = isVerdictReceived(result);
            left = !verdict && awayRef.current;
            // Gardé pour un renvoi au retour seulement si l'application a été quittée pendant l'envoi
            if (account && !left) clearPendingScan(SURFACE, account, scanKey);
            if (left) {
                console.info('[partner/scan] sortie pendant l’envoi : scan renvoyé au retour avec sa clé');
                return;
            }
            if (result.httpStatus === 401) {
                router.replace(`/login?redirect=${encodeURIComponent(PAGE_PATH)}`);
                return;
            }
            setShown({ outcome: result, recoveredAt: recoveredTimeOf(result, recoveredAt), resumed: recoveredAt !== null });
            if (result.result === 'valid' && !result.failure && payload) lastValidRef.current = { payload, at: Date.now() };
            // Compteur et historique relus sur le serveur (un incident technique n'y figure pas)
            scheduleStats();
        } finally {
            busyRef.current = false;
            setIsVerifying(false);
            if (left && document.visibilityState === 'visible') resumePendingRef.current('visible');
        }
    }, [router, scheduleStats]);

    const runScanRef = useRef(runScan);
    runScanRef.current = runScan;

    /** Scan en attente : renvoyé avec sa clé (moins de 2 minutes, même événement, aucun scan en cours). */
    const resumePendingScan = useCallback((reason: string) => {
        const account = accountIdRef.current;
        const id = eventIdRef.current;
        if (!account || !id || busyRef.current) return;
        const { pending, expired } = readPendingScan(SURFACE, account);
        if (expired) {
            setPendingNotice(`Billet lu à ${formatTime(expired.createdAt)} sans réponse : vérifiez « Derniers scans » ou scannez-le de nouveau.`);
        }
        if (!pending) return;
        if (pending.eventId !== id) {
            console.info(`[partner/scan] scan en attente d’un autre événement oublié (${reason})`);
            clearPendingScan(SURFACE, account, pending.key);
            return;
        }
        if (navigator.onLine === false) {
            setPendingNotice(`Billet lu à ${formatTime(pending.createdAt)} sans réponse : renvoi au retour du réseau, sans double entrée.`);
            return;
        }
        console.info(`[partner/scan] scan en attente renvoyé avec sa clé d’origine (${reason})`);
        void runScanRef.current(pending.request, pendingPayload(pending), pending.key, pending.createdAt);
    }, []);
    resumePendingRef.current = resumePendingScan;

    // Événement contrôlé (montage, reprise, changement) : chiffres et historique relus sur le serveur
    useEffect(() => {
        if (!eventId) return;
        setStats(null);
        setStatsError(null);
        void fetchStats();
    }, [eventId, fetchStats]);

    // Lot 9 ter : zones et portes de l'événement contrôlé (porte remise à zéro au changement d'événement)
    useEffect(() => {
        setZoneGates(null);
        setZonesError(null);
        setGateId('');
        if (!eventId) return;
        let live = true;
        fetch(`/api/partner/events/${encodeURIComponent(eventId)}/zones`, { cache: 'no-store' })
            .then(async (res) => {
                const body = await res.json() as { configured?: boolean; zones?: ZoneGates['zones']; error?: string };
                if (!res.ok) throw new Error(body.error || 'Portes de l’événement non lues.');
                if (live) setZoneGates(body.configured && Array.isArray(body.zones) ? { zones: body.zones } : null);
            })
            .catch((err: unknown) => {
                console.warn('[partner/scan] zones non lues :', errText(err));
                if (live) setZonesError(errText(err));
            });
        return () => { live = false; };
    }, [eventId]);
    // Porte envoyée avec chaque scan d'un événement à zones (absente sans zone)
    const scanGate = zoneGates ? gateId || null : undefined;

    // Scan en attente renvoyé au montage (compte et événement connus)
    useEffect(() => {
        if (eventId && accountId) resumePendingScan('montage');
    }, [eventId, accountId, resumePendingScan]);

    useEffect(() => {
        const onOnline = () => {
            void fetchStats();
            resumePendingScan('retour du réseau');
        };
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [fetchStats, resumePendingScan]);

    // Retour dans l'application : événements (encore publiés ?), chiffres et historique relus ; scan en attente renvoyé
    const handleReturn = useCallback((reason: ScanReturnReason) => {
        console.info(`[partner/scan] retour dans l’application (${reason}) : chiffres et historique relus sur le serveur`);
        void fetchEvents({ quiet: true }).then((list) => {
            const id = eventIdRef.current;
            if (list && id && !list.some((e) => e.id === id)) {
                // Jamais un autre événement contrôlé à l'insu du partenaire : choix explicite
                setRestoreNotice('L’événement que vous contrôliez n’est plus ouvert au contrôle : choisissez un événement.');
                setShown(null);
                setEventId('');
            }
        });
        void fetchStats();
        resumePendingScan(reason === 'visible' ? 'retour au premier plan' : 'page restaurée');
    }, [fetchEvents, fetchStats, resumePendingScan]);
    useScannerReturn(handleReturn, awayRef);

    const handleCameraScan = useCallback((code: string): CameraReadVerdict => {
        const payload = code.trim();
        if (!eventId || !payload) return 'ignored';
        if (busyRef.current) {
            console.info('[partner/scan] lecture ignorée : un scan est déjà en cours');
            return 'ignored';
        }
        const last = lastValidRef.current;
        if (last && last.payload === payload && Date.now() - last.at < DUPLICATE_VALID_MS) {
            console.info('[partner/scan] lecture ignorée : même QR que l’entrée validée il y a moins de 20 s');
            return 'ignored';
        }
        void runScan({ eventId, payload, gateId: scanGate }, payload);
        return 'accepted';
    }, [eventId, runScan, scanGate]);

    const handleManualValidate = useCallback(async (manualTicketNumber: string, key: string) => {
        if (!eventId) return;
        await runScan({ eventId, manualTicketNumber, identityVerified: true, gateId: scanGate }, null, key);
    }, [eventId, runScan, scanGate]);

    const chooseMode = (mode: ScanInputMode) => {
        setResumeGate(false);
        setScanMode(mode);
    };

    const selectedEvent = events.find((e) => e.id === eventId);
    const outcome = shown?.outcome ?? null;
    const counter = stats ? `${stats.doorLabel} : ${formatInteger(stats.doorEntries)} entrée${stats.doorEntries > 1 ? 's' : ''}` : 'Compteur en cours de lecture…';

    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-16">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-fg sm:text-2xl">
                        <QrCode aria-hidden="true" className="text-brand-fg" size={24} />
                        <span>Contrôle des entrées</span>
                    </h1>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        QR dynamique de l’application, ou numéro du billet avec pièce d’identité.
                    </p>
                </div>
                <LinkButton href="/partner/dashboard" variant="secondary" size="sm" leftIcon={<ChevronLeft size={16} aria-hidden="true" />}>
                    Tableau de bord
                </LinkButton>
            </div>

            {restoreNotice && (
                <StatusBanner tone="warning" title="Contrôle précédent non repris">
                    {restoreNotice}
                </StatusBanner>
            )}

            {/* Événement contrôlé */}
            {loadingEvents ? (
                <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
                    <Loader2 size={18} aria-hidden="true" className="text-brand-fg motion-safe:animate-spin" /> Chargement de vos événements…
                </div>
            ) : eventsError ? (
                <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-border-strong bg-surface-sunken p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-fg">
                        <ShieldAlert size={18} aria-hidden="true" /> {eventsError}
                    </p>
                    <p className="text-sm text-fg">
                        Contrôleur d’un événement ? Utilisez le scanner contrôleur, depuis votre espace contrôleur.
                    </p>
                    <div>
                        <LinkButton href="/controller/scanner" variant="secondary" size="sm">Ouvrir le scanner contrôleur</LinkButton>
                    </div>
                </div>
            ) : events.length === 0 ? (
                <div role="status" className="rounded-2xl border border-border bg-surface p-4 text-sm text-fg">
                    Aucun événement ouvert au contrôle en ce moment : le contrôle ouvre quelques heures avant le début et ferme quelques heures après la fin.
                </div>
            ) : (
                <Select
                    id="partner-scan-event"
                    label="Événement contrôlé"
                    value={eventId}
                    placeholder={eventId ? undefined : 'Choisissez un événement'}
                    onChange={(e) => { setEventId(e.target.value); setShown(null); setRestoreNotice(null); }}
                    options={events.map((e) => ({
                        value: e.id,
                        label: `${e.title}${e.start_date ? ` — ${formatShortDate(e.start_date)}` : ''}`,
                    }))}
                />
            )}

            {selectedEvent && zonesError && (
                <StatusBanner tone="warning" title="Portes de l’événement non lues">{zonesError}</StatusBanner>
            )}

            {selectedEvent && zoneGates && (
                <Select
                    id="partner-scan-gate"
                    label="Porte de contrôle"
                    required
                    hint="Choisissez la porte où vous contrôlez : la règle des zones s’applique à vos scans."
                    placeholder="Choisissez une porte"
                    value={gateId}
                    onChange={(e) => { setGateId(e.target.value); setShown(null); }}
                >
                    {zoneGates.zones.map((z) => (
                        <optgroup key={z.id} label={z.name}>
                            {z.gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </optgroup>
                    ))}
                </Select>
            )}

            {selectedEvent && (
                <>
                    <p role="status" aria-atomic="true" className="flex items-center gap-2 text-sm font-semibold tabular-nums text-fg">
                        <Ticket size={16} aria-hidden="true" className="text-brand-fg" />
                        {counter}{statsError && stats ? ' (non actualisé)' : ''}
                    </p>

                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mode de contrôle">
                        <Button
                            variant={scanMode === 'camera' ? 'primary' : 'secondary'}
                            size="lg"
                            className="gap-2 whitespace-nowrap px-4 text-sm"
                            aria-pressed={scanMode === 'camera'}
                            onClick={() => chooseMode('camera')}
                            leftIcon={<Camera size={18} />}
                        >
                            Caméra
                        </Button>
                        <Button
                            variant={scanMode === 'manual' ? 'primary' : 'secondary'}
                            size="lg"
                            className="gap-2 whitespace-nowrap px-4 text-sm"
                            aria-pressed={scanMode === 'manual'}
                            onClick={() => chooseMode('manual')}
                            leftIcon={<Keyboard size={18} />}
                        >
                            Saisie manuelle
                        </Button>
                    </div>

                    {pendingNotice && (
                        <StatusBanner tone="warning" title="Scan sans réponse">
                            {pendingNotice}
                        </StatusBanner>
                    )}

                    {outcome && (
                        <ScanResultPanel outcome={outcome} recoveredAt={shown?.recoveredAt ?? null} />
                    )}

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        {scanMode === 'camera' ? (
                            <CameraQrScanner
                                onScan={handleCameraScan}
                                paused={isVerifying || outcome !== null}
                                onSwitchToManual={() => chooseMode('manual')}
                                autoStart={!resumeGate}
                                onResume={() => setResumeGate(false)}
                            />
                        ) : (
                            <ManualEntryForm eventId={eventId} gateId={scanGate} onValidate={handleManualValidate} isSubmitting={isVerifying} onSessionExpired={goToLogin} />
                        )}
                    </div>

                    <ScanHistoryList
                        recent={stats?.recent ?? []}
                        myEntries={stats?.myEntries ?? null}
                        myRefusals={stats?.myRefusals ?? null}
                        refusalsByResult={stats?.refusalsByResult ?? []}
                        loading={stats === null}
                        error={statsError}
                    />
                </>
            )}
        </div>
    );
}
