'use client';

/**
 * Scan partenaire (lot 4) — même voie que le scanner contrôleur (/api/controller/scan) et même
 * carte de résultat. Le partenaire propriétaire choisit l'un de ses événements ; la saisie manuelle
 * exige la vérification d'une pièce d'identité et n'est acceptée que si le réglage
 * access.manual_entry_scope l'autorise (sinon : « saisie manuelle refusée »). Les encaissements
 * espèces se font depuis le scanner de caisse (contrôleur affecté, caisse ouverte).
 * Lot 7 (7.2) : clé d'idempotence par lecture et relances (components/scan/scan-client), aucun son ; la
 * caméra lit `onScan` par une ref et s'arrête pendant l'envoi et l'affichage du résultat (aucune boucle
 * orpheline) ; une lecture ignorée est tracée ; saisie manuelle en deux temps (vérifier, puis valider).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, Keyboard, Loader2, QrCode, ShieldAlert, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CameraQrScanner, type CameraReadVerdict } from '@/components/scan/CameraQrScanner';
import { ManualEntryForm } from '@/components/scan/ManualEntryForm';
import { ScanResultPanel } from '@/components/scan/ScanResultPanel';
import { isTechnicalOutcome, isTicketRefusal, postScan, titleFor, type ScanOutcome, type ScanRequest } from '@/components/scan/scan-client';

interface PartnerEvent { id: string; title: string; start_date?: string; status?: string }

interface HistoryEntry { key: string; at: string; outcome: ScanOutcome }

const PAGE_PATH = '/partner/scan';
const FEEDBACK_DISPLAY_MS = 4000;
/** Même QR qu'une entrée validée : ignoré pendant 20 s (D41). */
const DUPLICATE_VALID_MS = 20_000;

export default function PartnerScanPage() {
    const router = useRouter();
    const [events, setEvents] = useState<PartnerEvent[]>([]);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [eventId, setEventId] = useState('');
    const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
    const [isVerifying, setIsVerifying] = useState(false);
    const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [validated, setValidated] = useState(0);
    const [refused, setRefused] = useState(0);
    /** Envoi en cours : lu par la caméra au moment de la lecture (jamais une valeur périmée). */
    const busyRef = useRef(false);
    const lastValidRef = useRef<{ payload: string; at: number } | null>(null);

    const goToLogin = useCallback(() => {
        router.replace(`/login?redirect=${encodeURIComponent(PAGE_PATH)}`);
    }, [router]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/partner/events?status=PUBLIE', { cache: 'no-store' });
                if (res.status === 401) {
                    goToLogin();
                    return;
                }
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok || !data.success) {
                    setEventsError(data.error || 'Impossible de charger vos événements.');
                    return;
                }
                const list = ((data.events ?? []) as PartnerEvent[]).filter((e) => e.status === 'PUBLIE');
                setEvents(list);
                setEventId((current) => current || list[0]?.id || '');
            } catch (err) {
                console.warn('[partner/scan] événements : réseau indisponible', err instanceof Error ? err.message : String(err));
                if (!cancelled) setEventsError('Erreur réseau : vos événements n’ont pas pu être chargés.');
            } finally {
                if (!cancelled) setLoadingEvents(false);
            }
        })();
        return () => { cancelled = true; };
    }, [goToLogin]);

    // Résultat affiché 4 s (incident technique compris), puis la caméra reprend
    useEffect(() => {
        if (!outcome) return;
        const timer = setTimeout(() => setOutcome(null), FEEDBACK_DISPLAY_MS);
        return () => clearTimeout(timer);
    }, [outcome]);

    const runScan = useCallback(async (request: ScanRequest, payload: string | null, key?: string) => {
        if (busyRef.current) {
            console.info('[partner/scan] lecture ignorée : un scan est déjà en cours');
            return;
        }
        busyRef.current = true;
        setIsVerifying(true);
        try {
            const result = await postScan(request, { key });
            if (result.httpStatus === 401) {
                router.replace(`/login?redirect=${encodeURIComponent(PAGE_PATH)}`);
                return;
            }
            setOutcome(result);
            setHistory((prev) => [{ key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), outcome: result }, ...prev].slice(0, 10));
            if (result.result === 'valid' && !result.failure) {
                setValidated((n) => n + 1);
                if (payload) lastValidRef.current = { payload, at: Date.now() };
            }
            // Refus du billet seulement : un incident technique n'est jamais compté
            else if (isTicketRefusal(result)) setRefused((n) => n + 1);
        } finally {
            busyRef.current = false;
            setIsVerifying(false);
        }
    }, [router]);

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
        void runScan({ eventId, payload }, payload);
        return 'accepted';
    }, [eventId, runScan]);

    const handleManualValidate = useCallback(async (manualTicketNumber: string, key: string) => {
        if (!eventId) return;
        await runScan({ eventId, manualTicketNumber, identityVerified: true }, null, key);
    }, [eventId, runScan]);

    const selectedEvent = events.find((e) => e.id === eventId);

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-16">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <QrCode aria-hidden="true" className="text-[#FF5722]" size={24} />
                        <span>Contrôle des entrées</span>
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 mt-0.5">
                        QR dynamique de l’application, ou numéro du billet avec pièce d’identité.
                    </p>
                </div>
                <Link href="/partner/dashboard">
                    <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={16} aria-hidden="true" />}>
                        Tableau de bord
                    </Button>
                </Link>
            </div>

            {/* Événement contrôlé */}
            {loadingEvents ? (
                <div role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                    <Loader2 size={18} aria-hidden="true" className="animate-spin text-[#FF5722]" /> Chargement de vos événements…
                </div>
            ) : eventsError ? (
                <div role="alert" className="p-4 rounded-2xl border-2 border-slate-400 dark:border-zinc-500 bg-slate-100 dark:bg-zinc-800/80 space-y-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                        <ShieldAlert size={18} aria-hidden="true" /> {eventsError}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-zinc-200">
                        Contrôleur d’un événement ? Utilisez le <Link href="/controller/scanner" className="font-bold underline">scanner contrôleur</Link>.
                    </p>
                </div>
            ) : events.length === 0 ? (
                <div role="status" className="p-4 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-700 dark:text-zinc-200">
                    Aucun événement publié à contrôler.
                </div>
            ) : (
                <div className="space-y-1.5">
                    <label htmlFor="partner-scan-event" className="text-xs font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider block">
                        Événement contrôlé
                    </label>
                    <select
                        id="partner-scan-event"
                        value={eventId}
                        onChange={(e) => { setEventId(e.target.value); setOutcome(null); }}
                        className="w-full min-h-[48px] px-3 rounded-xl border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]"
                    >
                        {events.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.title}{e.start_date ? ` — ${new Date(e.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {selectedEvent && (
                <>
                    <div className="flex items-center justify-center">
                        <div className="p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center gap-1" role="group" aria-label="Mode de contrôle">
                            <button
                                type="button"
                                aria-pressed={scanMode === 'camera'}
                                onClick={() => setScanMode('camera')}
                                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] ${
                                    scanMode === 'camera' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Camera size={16} aria-hidden="true" /> Caméra
                            </button>
                            <button
                                type="button"
                                aria-pressed={scanMode === 'manual'}
                                onClick={() => setScanMode('manual')}
                                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] ${
                                    scanMode === 'manual' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Keyboard size={16} aria-hidden="true" /> Saisie manuelle
                            </button>
                        </div>
                    </div>

                    {outcome && (
                        <ScanResultPanel outcome={outcome}>
                            {outcome.result === 'cash_required' && (
                                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                                    Encaissement à faire depuis le scanner de caisse (contrôleur habilité, caisse ouverte). Le billet n’est pas validé.
                                </p>
                            )}
                        </ScanResultPanel>
                    )}

                    <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                        {scanMode === 'camera' ? (
                            <CameraQrScanner onScan={handleCameraScan} paused={isVerifying || outcome !== null} onSwitchToManual={() => setScanMode('manual')} />
                        ) : (
                            <ManualEntryForm eventId={eventId} onValidate={handleManualValidate} isSubmitting={isVerifying} onSessionExpired={goToLogin} />
                        )}
                    </div>

                    <section className="space-y-3" aria-labelledby="partner-scan-history">
                        <div className="flex items-center justify-between">
                            <h2 id="partner-scan-history" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                                Scans de la session ({history.length})
                            </h2>
                            <p role="status" aria-atomic="true" className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                                <Ticket size={16} aria-hidden="true" className="text-[#FF5722]" />
                                {validated} validé{validated > 1 ? 's' : ''} · {refused} refusé{refused > 1 ? 's' : ''}
                            </p>
                        </div>
                        {history.length === 0 ? (
                            <p className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center text-sm text-slate-600 dark:text-zinc-300">
                                Aucun scan pendant cette session.
                            </p>
                        ) : (
                            <ul className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                                {history.map(({ key, at, outcome: h }) => {
                                    const dot = isTechnicalOutcome(h) ? 'bg-slate-400' : h.result === 'valid' ? 'bg-emerald-500' : isTicketRefusal(h) ? 'bg-red-500' : 'bg-amber-500';
                                    return (
                                        <li key={key} className="p-3 flex items-center justify-between gap-3 text-sm">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                                <span className="font-semibold text-slate-900 dark:text-white truncate">{titleFor(h)}</span>
                                                {h.ticket?.ticket_number && <span className="font-mono text-xs text-slate-600 dark:text-zinc-300 truncate">{h.ticket.ticket_number}</span>}
                                            </span>
                                            <time dateTime={at} className="text-xs font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                                                {new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </time>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
