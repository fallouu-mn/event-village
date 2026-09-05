'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import {
    Calendar, MapPin, Ticket, ScanLine, Banknote,
    CheckCircle2, XCircle, AlertTriangle, Clock,
    Loader2, LogOut, Keyboard, Camera, ChevronDown,
    ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CameraQrScanner } from '@/components/scan/CameraQrScanner';
import { isEventEligibleForController } from '@/lib/events/event-status';

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

type ScanResult = 'valid' | 'already_used' | 'invalid' | 'unauthorized' | 'payment_required' | 'cash_required' | null;

interface ScanFeedback {
    result: ScanResult;
    message: string;
    ticket_info?: {
        ticket_number?: string;
        event_title?: string;
        category?: string;
        checked_in_at?: string;
        amount_due?: number;
        ticket_id?: string;
        order_id?: string;
    };
    stats?: EventStats;
}

type InputMode = 'camera' | 'manual';

const FEEDBACK_DISPLAY_MS = 2500;

// ── Composant Principal ──────────────────────────────────────────

export default function ControllerScannerPage() {
    const router = useRouter();

    // Données
    const [assignments, setAssignments]       = useState<Assignment[]>([]);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState('');
    const [selected, setSelected]             = useState<Assignment | null>(null);
    const [controllerName, setControllerName] = useState('');
    const [controllerId, setControllerId]     = useState<string | null>(null);
    const [refusedCountMap, setRefusedCountMap] = useState<Record<string, number>>({});

    // Scanner
    const [inputMode, setInputMode]           = useState<InputMode>('camera');
    const [manualCode, setManualCode]         = useState('');
    const [isVerifying, setIsVerifying]       = useState(false);
    const [feedback, setFeedback]             = useState<ScanFeedback | null>(null);
    const [cashConfirming, setCashConfirming] = useState(false);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Historique des scans de la session
    const [scanHistory, setScanHistory] = useState<(ScanFeedback & { _key: string })[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // ── Fetch assignations & état contrôleur ──
    const fetchAssignments = useCallback(async () => {
        try {
            const res = await fetch('/api/controller/assignments', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            const data = await res.json();
            if (data.success) {
                const list: Assignment[] = data.assignments ?? [];
                setAssignments(list);
                if (data.controller?.id) {
                    setControllerId(data.controller.id);
                }
                if (data.controller) {
                    const name = [data.controller.first_name, data.controller.last_name].filter(Boolean).join(' ');
                    setControllerName(name || 'Contrôleur');
                }

                // Réajustement immédiat de l'événement sélectionné
                setSelected(current => {
                    if (list.length === 0) return null;
                    if (!current) {
                        const active = list.find(a => a.events?.status !== 'TERMINE');
                        return active || list[0];
                    }
                    const stillAssigned = list.find(a => a.events?.id === current.events?.id);
                    if (stillAssigned) {
                        return stillAssigned;
                    }
                    // Si l'événement sélectionné a été retiré, basculer sur le premier événement actif restant
                    const fallback = list.find(a => a.events?.status !== 'TERMINE');
                    return fallback || list[0];
                });
            } else {
                setError(data.error || 'Impossible de charger les événements.');
            }
        } catch {
            setError('Erreur réseau.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Chargement initial
    useEffect(() => {
        fetchAssignments();
        const supabase = getBrowserClient();
        supabase.auth.getUser().then((res: any) => {
            if (res.data?.user?.id) setControllerId(res.data.user.id);
        });
    }, [fetchAssignments]);

    // ── Supabase Realtime : Affectations contrôleur ──
    useEffect(() => {
        if (!controllerId) return;
        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`scanner-assignments-${controllerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_controllers',
                    filter: `user_id=eq.${controllerId}`,
                },
                () => {
                    fetchAssignments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [controllerId, fetchAssignments]);

    // ── Supabase Realtime : Statut des événements (TERMINE, etc.) ──
    useEffect(() => {
        const supabase = getBrowserClient();
        const channel = supabase
            .channel('scanner-events-live')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'events',
                },
                (payload: any) => {
                    const updated = payload.new as any;
                    if (!updated?.id) return;
                    setAssignments(prev => prev.map(a => {
                        if (a.events?.id === updated.id) {
                            return {
                                ...a,
                                events: {
                                    ...a.events,
                                    status: updated.status,
                                    title: updated.title ?? a.events.title,
                                    date: updated.start_date ?? a.events.date,
                                }
                            };
                        }
                        return a;
                    }));
                    setSelected(prev => {
                        if (!prev || prev.events?.id !== updated.id) return prev;
                        return {
                            ...prev,
                            events: {
                                ...prev.events,
                                status: updated.status,
                                title: updated.title ?? prev.events.title,
                                date: updated.start_date ?? prev.events.date,
                            }
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // ── Supabase Realtime : Statut du compte contrôleur (Désactivation / Révocation) ──
    useEffect(() => {
        if (!controllerId) return;
        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`scanner-user-live-${controllerId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${controllerId}`,
                },
                async (payload: any) => {
                    const u = payload.new as any;
                    if (u && (u.status === 'SUSPENDU' || u.status === 'INACTIF' || u.role !== 'CONTROLEUR')) {
                        await supabase.auth.signOut({ scope: 'global' });
                        router.push('/login?error=account_deactivated');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [controllerId, router]);

    // ── Supabase Realtime : Comptage dynamique des billets de l'événement en direct ──
    useEffect(() => {
        if (!selected?.events?.id) return;
        const eventId = selected.events.id;
        const supabase = getBrowserClient();

        const channel = supabase
            .channel(`scanner-tickets-live-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tickets',
                    filter: `event_id=eq.${eventId}`,
                },
                (payload: any) => {
                    const newT = payload.new as any;
                    if (newT?.status === 'UTILISE') {
                        setSelected(prev => {
                            if (!prev || prev.events?.id !== eventId) return prev;
                            return {
                                ...prev,
                                stats: {
                                    ...prev.stats,
                                    scanned_today: (prev.stats?.scanned_today ?? 0) + 1,
                                    total_tickets: prev.stats?.total_tickets ?? 0,
                                }
                            };
                        });
                        setAssignments(prev => prev.map(a => {
                            if (a.events?.id === eventId) {
                                return {
                                    ...a,
                                    stats: {
                                        ...a.stats,
                                        scanned_today: (a.stats?.scanned_today ?? 0) + 1,
                                        total_tickets: a.stats?.total_tickets ?? 0,
                                    }
                                };
                            }
                            return a;
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selected?.events?.id]);

    // ── Nettoyage timer ──
    useEffect(() => () => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    }, []);

    // ── Scan handler ──
    const handleScan = useCallback(async (code: string) => {
        if (isVerifying || !code.trim()) return;
        setIsVerifying(true);
        setFeedback(null);

        try {
            const res = await fetch('/api/controller/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr_code: code.trim() }),
            });
            const data = await res.json();

            const fb: ScanFeedback = {
                result: data.scan_result || 'invalid',
                message: data.message || data.error || 'Erreur inconnue.',
                ticket_info: data.ticket_info,
                stats: data.stats,
            };
            setFeedback(fb);
            setScanHistory(prev => [{ ...fb, _key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...prev].slice(0, 15));

            // Incrémentation du compteur de refus si le billet est rejeté
            if (fb.result && fb.result !== 'valid' && fb.result !== 'cash_required' && selected?.events?.id) {
                const eventId = selected.events.id;
                setRefusedCountMap(prev => ({
                    ...prev,
                    [eventId]: (prev[eventId] ?? 0) + 1,
                }));
            }

            // Mise à jour stats en temps réel
            if (data.stats && selected) {
                setSelected(prev => prev ? { ...prev, stats: data.stats } : prev);
                setAssignments(prev => prev.map(a => a.events?.id === selected.events?.id ? { ...a, stats: data.stats } : a));
            }

            // Haptic différencié selon le résultat
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                    if (fb.result === 'valid') navigator.vibrate(100);
                    else if (fb.result === 'already_used') navigator.vibrate([80, 60, 80]);
                    else if (fb.result === 'invalid' || fb.result === 'unauthorized') navigator.vibrate([120, 80, 120, 80, 120]);
                } catch {}
            }

            // Auto-clear le feedback (sauf cash_required qui attend la confirmation)
            if (fb.result !== 'cash_required') {
                if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
                feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
            }
        } catch {
            if (selected?.events?.id) {
                const eventId = selected.events.id;
                setRefusedCountMap(prev => ({
                    ...prev,
                    [eventId]: (prev[eventId] ?? 0) + 1,
                }));
            }
            setFeedback({ result: 'invalid', message: 'Erreur réseau.' });
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
        } finally {
            setIsVerifying(false);
            setManualCode('');
        }
    }, [isVerifying, selected]);

    // ── Cash confirm ──
    const handleConfirmCash = async () => {
        if (!feedback?.ticket_info?.ticket_id) return;
        setCashConfirming(true);
        try {
            const res = await fetch('/api/controller/scan', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: feedback.ticket_info.ticket_id,
                    order_id: feedback.ticket_info.order_id,
                }),
            });
            const data = await res.json();
            const fb: ScanFeedback = {
                result: data.scan_result || (data.error ? 'invalid' : 'valid'),
                message: data.message || data.error || 'Erreur.',
            };
            setFeedback(fb);
            setScanHistory(prev => [{ ...fb, _key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...prev].slice(0, 15));

            if (data.stats && selected) {
                setSelected(prev => prev ? { ...prev, stats: data.stats } : prev);
                setAssignments(prev => prev.map(a => a.events?.id === selected.events?.id ? { ...a, stats: data.stats } : a));
            } else if (selected) {
                setSelected(prev => prev ? {
                    ...prev,
                    stats: {
                        scanned_today: (prev.stats?.scanned_today ?? 0) + 1,
                        total_tickets: prev.stats?.total_tickets ?? 0,
                    },
                } : prev);
                setAssignments(prev => prev.map(a => a.events?.id === selected.events?.id ? {
                    ...a,
                    stats: {
                        scanned_today: (a.stats?.scanned_today ?? 0) + 1,
                        total_tickets: a.stats?.total_tickets ?? 0,
                    }
                } : a));
            }

            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
        } catch {
            setFeedback({ result: 'invalid', message: 'Erreur réseau.' });
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
        } finally {
            setCashConfirming(false);
        }
    };

    // ── Logout (global — invalide toutes les sessions) ──
    const handleLogout = async () => {
        const supabase = getBrowserClient();
        await supabase.auth.signOut({ scope: 'global' });
        router.push('/login');
    };

    // ── Feedback Color Helper ──
    const feedbackStyles = (result: ScanResult) => {
        switch (result) {
            case 'valid':            return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-400 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 size={24} className="text-emerald-500" /> };
            case 'already_used':     return { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-400 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', icon: <AlertTriangle size={24} className="text-amber-500" /> };
            case 'cash_required':    return { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-400 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', icon: <Banknote size={24} className="text-blue-500" /> };
            case 'payment_required': return { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-400 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', icon: <Banknote size={24} className="text-orange-500" /> };
            default:                 return { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-400 dark:border-red-700', text: 'text-red-700 dark:text-red-300', icon: <XCircle size={24} className="text-red-500" /> };
        }
    };

    // ── Rendu : Loading / Error / Empty ──

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={32} className="animate-spin text-[#FF5722]" />
                <p className="text-sm text-slate-500 dark:text-zinc-400">Chargement…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-sm text-red-500">{error}</p>
                <Button variant="outline" onClick={() => router.refresh()}>Réessayer</Button>
            </div>
        );
    }

    if (assignments.length === 0) {
        return (
            <>
                <div className="text-center py-16 space-y-4">
                    <Calendar size={48} className="text-slate-300 dark:text-zinc-600 mx-auto" />
                    <h2 className="text-sm font-bold text-slate-600 dark:text-zinc-400">Aucun événement assigné</h2>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
                        Vous serez informé lorsqu&apos;un nouvel événement vous sera assigné.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition-colors min-h-[44px]"
                        >
                            <ArrowLeft size={14} />
                            <span>Retour à l&apos;accueil</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors min-h-[44px]"
                        >
                            <LogOut size={14} /> Se déconnecter
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

    // ── Calcul métriques Phase 4 ──
    const currentRefused = selected?.events?.id ? (refusedCountMap[selected.events.id] ?? 0) : 0;

    // ── Rendu Principal ──

    return (
        <div className="space-y-4">

            {/* Barre de navigation / Retour & Identité contrôleur */}
            <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-colors py-1.5 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 min-h-[38px]"
                    title="Retourner à l'accueil"
                >
                    <ArrowLeft size={15} className="text-[#FF5722]" />
                    <span>Retour à l&apos;accueil</span>
                </Link>

                {controllerName && (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/controller/profile"
                            className="hidden sm:inline-block text-xs text-slate-500 dark:text-zinc-400 hover:text-[#FF5722] transition-colors"
                        >
                            Connecté : <span className="font-bold text-slate-700 dark:text-zinc-300">{controllerName}</span>
                        </Link>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20">
                            Contrôleur
                        </span>
                    </div>
                )}
            </div>

            {/* ── Phase 5 : Sélecteur d'événement responsive (Mobile dropdown / Desktop pills) ── */}
            {assignments.length > 1 && (
                <div className="space-y-1.5">
                    <label htmlFor="scanner-event-select" className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                        Mes événements ({assignments.length}) :
                    </label>

                    {/* Sélecteur mobile (< 640px) : Zéro débordement horizontal, touch target >= 44px */}
                    <div className="relative sm:hidden">
                        <select
                            id="scanner-event-select"
                            value={selected?.id ?? ''}
                            onChange={(e) => {
                                const found = assignments.find(a => a.id === e.target.value);
                                if (found) { setSelected(found); setFeedback(null); }
                            }}
                            className="w-full min-h-[44px] pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-900 dark:text-white appearance-none focus:outline-none focus:border-[#FF5722] truncate shadow-sm"
                        >
                            {assignments.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.events?.title || 'Sans titre'} {a.events?.status === 'TERMINE' ? ' [Terminé]' : a.events?.status === 'SUSPENDU' ? ' [Suspendu]' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Sélecteur Desktop / Tablet (>= 640px) */}
                    <div className="hidden sm:flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {assignments.map(a => {
                            const evDate = a.events?.date ? new Date(a.events.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                            const isCurrent = selected?.id === a.id;
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => { setSelected(a); setFeedback(null); }}
                                    className={`shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border text-left transition-all ${
                                        isCurrent
                                            ? 'border-[#FF5722] bg-[#FF5722]/5 font-bold shadow-sm'
                                            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs text-slate-900 dark:text-white truncate max-w-[180px]">
                                            {a.events?.title ?? 'Sans titre'}
                                        </p>
                                        {a.events?.status === 'TERMINE' && (
                                            <span className="text-[8px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded">
                                                Terminé
                                            </span>
                                        )}
                                        {a.events?.status === 'SUSPENDU' && (
                                            <span className="text-[8px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded">
                                                Suspendu
                                            </span>
                                        )}
                                    </div>
                                    {evDate && <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">{evDate}</p>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {selected && (
                <>
                    {/* En-tête événement compact */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-black text-slate-900 dark:text-white truncate">{selected.events?.title}</h2>
                                {selected.events?.status === 'TERMINE' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider shrink-0">
                                        Terminé
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                {selected.events?.location && <span className="flex items-center gap-0.5"><MapPin size={9} /> {selected.events.location}</span>}
                                {selected.can_accept_cash && <span className="flex items-center gap-0.5 text-emerald-500 font-bold"><Banknote size={9} /> Cash OK</span>}
                            </div>
                        </div>
                    </div>

                    {/* ── Phase 4 : Hiérarchie Visuelle des Statistiques Scanner ── */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
                        {/* 1. Billets Valides (Métrique Principale) */}
                        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                            <span className="text-lg sm:text-xl mb-0.5" role="img" aria-label="Billets">🎫</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight leading-none">
                                {selected.stats?.total_tickets ?? 0}
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-zinc-300 mt-1">
                                Billets valides
                            </span>
                        </div>

                        {/* 2. Arrivées (Scannés Aujourd'hui) */}
                        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-[#FF5722]/5 dark:bg-[#FF5722]/10 border border-[#FF5722]/20 text-center">
                            <span className="text-lg sm:text-xl mb-0.5" role="img" aria-label="Arrivées">👥</span>
                            <span className="text-xl sm:text-2xl font-black text-[#FF5722] font-mono tracking-tight leading-none">
                                {selected.stats?.scanned_today ?? 0}
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-zinc-300 mt-1">
                                Arrivées
                            </span>
                        </div>

                        {/* 3. Billets Refusés */}
                        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-center">
                            <span className="text-lg sm:text-xl mb-0.5" role="img" aria-label="Refusés">⚠️</span>
                            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight leading-none">
                                {currentRefused}
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-zinc-300 mt-1">
                                Billets refusés
                            </span>
                        </div>
                    </div>

                    {/* ── Phase 10 : État vide des scans ── */}
                    {(selected.stats?.scanned_today ?? 0) === 0 && (
                        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-dashed border-slate-200 dark:border-zinc-700 text-center">
                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                « Aucune entrée pour le moment — Les statistiques apparaîtront dès les premiers contrôles. »
                            </p>
                        </div>
                    )}

                    {/* Blocage si événement non opérationnel (Partie 7 CDC & Hotfix opérationnel) */}
                    {!isEventEligibleForController(selected.events?.status) ? (
                        <div className={`p-6 rounded-2xl border text-center space-y-2 ${
                            selected.events?.status === 'SUSPENDU'
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                        }`}>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                selected.events?.status === 'SUSPENDU'
                                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            }`}>
                                <AlertTriangle size={14} />
                                {selected.events?.status === 'SUSPENDU' ? 'Événement Suspendu' :
                                 selected.events?.status === 'TERMINE' ? 'Événement Terminé' :
                                 'Événement Non Opérationnel'}
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                                {selected.events?.status === 'SUSPENDU'
                                    ? 'Les contrôles d\'accès sont temporairement suspendus sur cet événement.'
                                    : selected.events?.status === 'TERMINE'
                                    ? 'Les scans ne sont plus autorisés sur cet événement.'
                                    : 'Cet événement n\'est pas encore validé pour les contrôles.'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
                                {selected.events?.status === 'SUSPENDU'
                                    ? 'L\'événement a été suspendu par l\'administration. Les scans sont bloqués jusqu\'à réactivation.'
                                    : selected.events?.status === 'TERMINE'
                                    ? 'L\'événement a pris fin. Les statistiques enregistrées restent consultables dans l\'historique.'
                                    : 'L\'accès sera ouvert dès la validation et publication de l\'événement.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Feedback Scan ── */}
                            {feedback && (() => {
                                const s = feedbackStyles(feedback.result);
                                return (
                                    <div className={`p-4 rounded-2xl border ${s.bg} ${s.border} space-y-3 transition-all animate-in fade-in duration-200`}>
                                        <div className="flex items-start gap-3">
                                            <div className="shrink-0 mt-0.5">{s.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold ${s.text}`}>
                                                    {feedback.result === 'valid' && 'Accès Autorisé'}
                                                    {feedback.result === 'already_used' && 'Billet Déjà Utilisé'}
                                                    {feedback.result === 'invalid' && 'Billet Invalide'}
                                                    {feedback.result === 'unauthorized' && 'Non Autorisé'}
                                                    {feedback.result === 'payment_required' && 'Paiement Requis'}
                                                    {feedback.result === 'cash_required' && 'Encaissement Espèces'}
                                                </p>
                                                <p className={`text-xs ${s.text} opacity-80 mt-0.5`}>{feedback.message}</p>
                                                {feedback.ticket_info?.category && (
                                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                                                        {feedback.ticket_info.category} — {feedback.ticket_info.ticket_number}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bouton encaissement espèces */}
                                        {feedback.result === 'cash_required' && feedback.ticket_info?.amount_due && (
                                            <Button
                                                variant="primary"
                                                fullWidth
                                                size="lg"
                                                isLoading={cashConfirming}
                                                onClick={handleConfirmCash}
                                            >
                                                <Banknote size={16} className="mr-1.5" />
                                                Confirmer {feedback.ticket_info.amount_due.toLocaleString('fr-FR')} FCFA et Valider l&apos;entrée
                                            </Button>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── Toggle Camera / Manuel (Touch targets >= 44px) ── */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setInputMode('camera'); setFeedback(null); }}
                                    className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                                        inputMode === 'camera'
                                            ? 'bg-[#FF5722] text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    <Camera size={14} /> Caméra
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setInputMode('manual'); setFeedback(null); }}
                                    className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                                        inputMode === 'manual'
                                            ? 'bg-[#FF5722] text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    <Keyboard size={14} /> Manuel
                                </button>
                            </div>

                            {/* ── Scanner Caméra ── */}
                            {inputMode === 'camera' && (
                                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                                    <CameraQrScanner
                                        onScan={handleScan}
                                        isVerifying={isVerifying}
                                        onSwitchToManual={() => setInputMode('manual')}
                                        autoResumeDelayMs={2500}
                                    />
                                </div>
                            )}

                            {/* ── Saisie Manuelle ── */}
                            {inputMode === 'manual' && (
                                <form
                                    onSubmit={e => { e.preventDefault(); handleScan(manualCode); }}
                                    className="space-y-3"
                                >
                                    <div className="relative">
                                        <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="EV-QR-... ou TCK-..."
                                            value={manualCode}
                                            onChange={e => setManualCode(e.target.value)}
                                            className="w-full min-h-[44px] pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF5722]/30"
                                            autoFocus
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        fullWidth
                                        size="lg"
                                        className="min-h-[44px]"
                                        isLoading={isVerifying}
                                        disabled={!manualCode.trim()}
                                    >
                                        Vérifier le billet
                                    </Button>
                                </form>
                            )}
                        </>
                    )}

                    {/* ── Historique Session ── */}
                    {scanHistory.length > 0 && (
                        <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                Derniers scans
                            </h3>
                            <div className="space-y-1">
                                {scanHistory.slice(0, 8).map((h) => {
                                    const color = h.result === 'valid' ? 'text-emerald-500'
                                        : h.result === 'already_used' ? 'text-amber-500'
                                        : 'text-red-500';
                                    return (
                                        <div key={h._key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800/50">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.result === 'valid' ? 'bg-emerald-500' : h.result === 'already_used' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                            <span className={`text-[11px] truncate flex-1 ${color}`}>
                                                {h.ticket_info?.ticket_number || h.message}
                                            </span>
                                            <span className="text-[9px] text-slate-300 dark:text-zinc-600 shrink-0">
                                                {h.ticket_info?.category || (h.result === 'valid' ? 'OK' : h.result === 'already_used' ? 'Doublon' : 'Erreur')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Pied — Déconnexion (Touch target >= 44px) */}
                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            type="button"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="min-h-[44px] px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
                        >
                            <LogOut size={14} /> Se déconnecter
                        </button>
                    </div>

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
