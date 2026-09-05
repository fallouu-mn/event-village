'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, UserPlus, Trash2, Loader2, Phone,
    ShieldCheck, ShieldOff, CheckCircle2, AlertCircle,
    Calendar, ChevronDown, X, Search, Mail, Send,
    RotateCcw, CheckSquare, Square, Settings, UserMinus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getBrowserClient } from '@/lib/supabase/client';
import { isEventEligibleForController } from '@/lib/events/event-status';

interface ControllerUser {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    status: string;
}

interface EventRef {
    id: string;
    title: string;
    date?: string;
    status?: string;
}

interface Assignment {
    id: string;
    event_id: string;
    can_accept_cash: boolean;
    created_at: string;
    users: ControllerUser;
    events: EventRef;
}

interface GroupedController {
    user: ControllerUser;
    assignments: Assignment[];
}

export default function PartnerTeamPage() {
    const toast = useToast();

    const [controllers, setControllers] = useState<Assignment[]>([]);
    const [events, setEvents]           = useState<EventRef[]>([]);
    const [loading, setLoading]         = useState(true);
    const [refreshing, setRefreshing]   = useState(false);
    const [filterEvent, setFilterEvent] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal d'invitation (Partie 2.A & 2.B)
    const [showModal, setShowModal]             = useState(false);
    const [invFirstName, setInvFirstName]       = useState('');
    const [invLastName, setInvLastName]         = useState('');
    const [invEmail, setInvEmail]               = useState('');
    const [invPhone, setInvPhone]               = useState('');
    const [invEventIds, setInvEventIds]         = useState<string[]>([]);
    const [invCanCash, setInvCanCash]           = useState(false);
    const [inviting, setInviting]               = useState(false);
    const [invPhoneError, setInvPhoneError]     = useState('');
    const [invNameError, setInvNameError]       = useState('');
    const [resendingId, setResendingId]         = useState<string | null>(null);

    // Modal de modification d'affectations (Partie 2.C)
    const [editModalCtrl, setEditModalCtrl]     = useState<GroupedController | null>(null);
    const [editEventIds, setEditEventIds]       = useState<string[]>([]);
    const [editCanCash, setEditCanCash]         = useState(false);
    const [updatingAssignments, setUpdatingAssignments] = useState(false);

    // Dialogs d'action
    // Action D : Retirer d'un événement
    const [confirmRemoveSingle, setConfirmRemoveSingle] = useState<{ assignmentId: string; eventId: string; eventTitle: string; ctrlName: string } | null>(null);
    // Action E : Retirer de tous les événements
    const [confirmRemoveAll, setConfirmRemoveAll] = useState<{ controllerId: string; ctrlName: string; eventCount: number } | null>(null);
    // Action F : Supprimer complètement le contrôleur
    const [confirmDeleteCtrl, setConfirmDeleteCtrl] = useState<{ controllerId: string; ctrlName: string } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // ── Fetch événements du partenaire ──
    const fetchEvents = useCallback(async () => {
        try {
            const res  = await fetch('/api/partner/events', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json();
            if (data.success && data.events) {
                const evList = data.events.map((e: any) => ({ id: e.id, title: e.title, date: e.date ?? e.start_date, status: e.status }));
                setEvents(evList);
                const eligible = evList.filter((e: any) => isEventEligibleForController(e.status));
                if (eligible.length === 1) {
                    setInvEventIds([eligible[0].id]);
                }
            }
        } catch {
            // Silencieux
        }
    }, []);

    // ── Événements éligibles aux affectations contrôleur (VALIDÉ ou PUBLIÉ) ──
    // Exclut strictement : BROUILLON, EN_ATTENTE, SUSPENDU, TERMINE
    // Tri chronologique puis alphabétique
    const availableEvents = useMemo(() => {
        return events
            .filter(e => isEventEligibleForController(e.status))
            .sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                if (dateA && dateB && dateA !== dateB) return dateA - dateB;
                return (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
            });
    }, [events]);

    // Réinitialiser le filtre événement si l'événement sélectionné n'est plus éligible / actif
    useEffect(() => {
        if (filterEvent !== 'all' && !availableEvents.some(e => e.id === filterEvent)) {
            setFilterEvent('all');
        }
    }, [filterEvent, availableEvents]);

    // ── Fetch contrôleurs assignés (anti-cache strict) ──
    const fetchControllers = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const res  = await fetch('/api/partner/team/all', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json();
            if (data.success) {
                setControllers(data.controllers ?? []);
            }
        } catch {
            if (!isSilent) toast.error('Impossible de charger l\'équipe.');
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchEvents();
        fetchControllers();
    }, [fetchEvents, fetchControllers]);

    // ── Abonnement Supabase Realtime (Synchronisation en direct équipe + événements) ──
    useEffect(() => {
        const supabase = getBrowserClient();
        const teamChannel = supabase
            .channel('partner-team-live-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_controllers',
                },
                () => {
                    fetchControllers(true);
                }
            )
            .subscribe();

        const eventsChannel = supabase
            .channel('partner-events-live-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'events',
                },
                () => {
                    fetchEvents();
                    fetchControllers(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(teamChannel);
            supabase.removeChannel(eventsChannel);
        };
    }, [fetchControllers, fetchEvents]);

    const refreshControllers = useCallback(() => { fetchControllers(false); }, [fetchControllers]);

    // ── Filtrage ──
    const filtered = useMemo(() => {
        return controllers.filter(a => {
            if (filterEvent !== 'all' && a.event_id !== filterEvent) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = `${a.users?.first_name ?? ''} ${a.users?.last_name ?? ''}`.toLowerCase();
                const phone = (a.users?.phone ?? '').toLowerCase();
                if (!name.includes(q) && !phone.includes(q)) return false;
            }
            return true;
        });
    }, [controllers, filterEvent, searchQuery]);

    // ── Groupement par contrôleur unique ──
    const groupedControllers: GroupedController[] = useMemo(() => {
        const map = new Map<string, GroupedController>();
        for (const a of filtered) {
            if (!a.users?.id) continue;
            const existing = map.get(a.users.id);
            if (existing) {
                existing.assignments.push(a);
            } else {
                map.set(a.users.id, {
                    user: a.users,
                    assignments: [a],
                });
            }
        }
        return Array.from(map.values());
    }, [filtered]);

    const uniqueControllerCount = useMemo(() => {
        return new Set(controllers.map(a => a.users?.id).filter(Boolean)).size;
    }, [controllers]);

    // ── Handlers Invitation (Partie 2.A & 2.B) ──
    const toggleEventSelection = (id: string) => {
        setInvEventIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleAllEvents = () => {
        if (invEventIds.length === availableEvents.length) {
            setInvEventIds([]);
        } else {
            setInvEventIds(availableEvents.map(e => e.id));
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (inviting) return;
        setInvPhoneError('');
        setInvNameError('');

        const phoneSanitized = invPhone.replace(/\s/g, '');
        if (!/^(7[0-8])\d{7}$/.test(phoneSanitized)) {
            setInvPhoneError('Numéro sénégalais valide requis (ex: 77 123 45 67).');
            return;
        }
        if (invEventIds.length === 0) {
            setInvPhoneError('Veuillez sélectionner au moins un événement.');
            return;
        }
        const hasIneligible = invEventIds.some(id => !availableEvents.some(ae => ae.id === id));
        if (hasIneligible) {
            setInvPhoneError("Ce contrôleur ne peut être affecté qu'à des événements confirmés.");
            return;
        }

        setInviting(true);
        try {
            const res  = await fetch('/api/partner/team/invite', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    event_ids:       invEventIds,
                    phone:           phoneSanitized,
                    first_name:      invFirstName.trim() || 'Contrôleur',
                    last_name:       invLastName.trim() || '',
                    email:           invEmail.trim() || undefined,
                    can_accept_cash: invCanCash,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'invitation.');
            await fetchControllers(true);
            toast.success(data.message || 'Contrôleur invité avec succès.');
            setShowModal(false);
            setInvFirstName(''); setInvLastName(''); setInvEmail('');
            setInvPhone(''); setInvCanCash(false);
            if (events.length > 1) setInvEventIds([]);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setInviting(false);
        }
    };

    // ── Renvoi d'invitation ──
    const handleResendInvite = async (assignment: Assignment) => {
        if (resendingId || actionLoading) return;
        setResendingId(assignment.id);
        try {
            const res = await fetch('/api/partner/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id:        assignment.event_id,
                    phone:           assignment.users.phone,
                    first_name:      assignment.users.first_name || 'Contrôleur',
                    last_name:       assignment.users.last_name || '',
                    resend:          true,
                    can_accept_cash: assignment.can_accept_cash,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors du renvoi.');
            toast.success(data.message || 'Invitation renvoyée par SMS avec succès.');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setResendingId(null);
        }
    };

    // ── Action C : Modifier les événements assignés ──
    const openEditAssignments = (grouped: GroupedController) => {
        setEditModalCtrl(grouped);
        setEditEventIds(grouped.assignments.map(a => a.event_id));
        setEditCanCash(grouped.assignments.some(a => a.can_accept_cash));
    };

    const handleSaveAssignments = async () => {
        if (!editModalCtrl || updatingAssignments) return;
        setUpdatingAssignments(true);
        try {
            const res = await fetch('/api/partner/team/assignments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    controller_id: editModalCtrl.user.id,
                    event_ids: editEventIds,
                    can_accept_cash: editCanCash,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');
            toast.success('Affectations mises à jour avec succès.');
            setEditModalCtrl(null);
            await fetchControllers(true);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setUpdatingAssignments(false);
        }
    };

    // ── Action D : Retirer d'un événement ──
    const handleRemoveSingle = async (assignmentId: string, eventId: string) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const res  = await fetch(`/api/partner/team/${eventId}?assignmentId=${assignmentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                // Confirmation serveur obtenue -> mise à jour immédiate du state
                setControllers(prev => prev.filter(c => c.id !== assignmentId));
                toast.success(data.message || 'Contrôleur retiré de cet événement.');
                setConfirmRemoveSingle(null);
            } else {
                toast.error(data.error || 'Erreur lors du retrait.');
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur réseau lors du retrait.');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Action E : Retirer de TOUS les événements du partenaire ──
    const handleRemoveAll = async (controllerId: string) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const res  = await fetch(`/api/partner/team/all?controllerId=${controllerId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                // Confirmation serveur obtenue -> mise à jour immédiate du state
                setControllers(prev => prev.filter(c => c.users?.id !== controllerId));
                toast.success(data.message || 'Contrôleur retiré de tous vos événements.');
                setConfirmRemoveAll(null);
            } else {
                toast.error(data.error || 'Erreur lors du retrait.');
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur réseau lors du retrait.');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Action F : Supprimer complètement le contrôleur de l'équipe ──
    const handleDeleteController = async (controllerId: string) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const res  = await fetch(`/api/partner/team/controller/${controllerId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                // Confirmation serveur obtenue -> mise à jour immédiate du state
                setControllers(prev => prev.filter(c => c.users?.id !== controllerId));
                toast.success(data.message || 'Contrôleur supprimé et désactivé avec succès.');
                setConfirmDeleteCtrl(null);
            } else {
                toast.error(data.error || 'Erreur lors de la suppression.');
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur réseau lors de la suppression.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

            {/* ── En-tête ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Users size={22} className="text-[#FF5722]" /> Mon Équipe Contrôleurs
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {uniqueControllerCount} membre{uniqueControllerCount > 1 ? 's' : ''} actif{uniqueControllerCount > 1 ? 's' : ''} — {controllers.length} affectation{controllers.length > 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setRefreshing(true);
                            fetchControllers().finally(() => setRefreshing(false));
                        }}
                        disabled={refreshing || loading}
                        title="Synchroniser la liste en temps réel"
                    >
                        <RotateCcw size={14} className={refreshing ? 'animate-spin mr-1.5' : 'mr-1.5'} />
                        <span className="hidden sm:inline">Actualiser</span>
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                        <UserPlus size={14} className="mr-1.5" /> Inviter un Contrôleur
                    </Button>
                </div>
            </div>

            {/* ── Filtres ── */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou numéro..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:border-[#FF5722]"
                    />
                </div>
                <div className="relative shrink-0">
                    <select
                        value={filterEvent}
                        onChange={e => setFilterEvent(e.target.value)}
                        className="h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#FF5722]"
                    >
                        <option value="all">Tous les événements</option>
                        {availableEvents.map(ev => (
                            <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* ── Liste des Contrôleurs (Groupés par membre) ── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 size={28} className="animate-spin text-slate-400" />
                </div>
            ) : groupedControllers.length === 0 ? (
                <div className="text-center py-16 space-y-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-8">
                    <Users size={40} className="text-slate-300 dark:text-zinc-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">
                        {controllers.length === 0
                            ? 'Aucun contrôleur dans votre équipe.'
                            : 'Aucun résultat correspondant aux filtres.'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Invitez vos vigiles pour leur donner accès au scan QR et au compostage sécurisé des billets à l&apos;entrée.
                    </p>
                    {controllers.length === 0 && (
                        <Button variant="primary" size="sm" onClick={() => setShowModal(true)} className="mt-2 min-h-[44px]">
                            <UserPlus size={14} className="mr-1.5" /> Inviter un premier contrôleur
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* ══════════════════════════════════════════════════════════
                        VUE TABLE DESKTOP (>= 768px - md)
                        ══════════════════════════════════════════════════════════ */}
                    <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                                        <th className="py-3 px-4">Membre & Contact</th>
                                        <th className="py-3 px-4">Statut</th>
                                        <th className="py-3 px-4">Événements Assignés</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                                    {groupedControllers.map(grouped => {
                                        const ctrl = grouped.user;
                                        const displayName = [ctrl?.first_name, ctrl?.last_name].filter(Boolean).join(' ') || 'Contrôleur';
                                        const displayPhone = (ctrl?.phone ?? '').replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
                                        const isPending = ctrl?.first_name === 'Contrôleur' && !ctrl?.last_name;
                                        const canAcceptCashAny = grouped.assignments.some(a => a.can_accept_cash);

                                        return (
                                            <tr key={ctrl.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                {/* Membre & Contact */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#FF5722]/10 dark:bg-[#FF5722]/20 flex items-center justify-center shrink-0 border border-[#FF5722]/20">
                                                            <span className="text-xs font-black text-[#FF5722]">
                                                                {displayName[0]?.toUpperCase() ?? 'C'}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-900 dark:text-white truncate">
                                                                {displayName}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                                                                <Phone size={10} className="text-slate-400" />
                                                                <span>{displayPhone}</span>
                                                            </div>
                                                            <div className="mt-1">
                                                                {canAcceptCashAny ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        <CheckCircle2 size={10} /> Cash OK
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                                        <AlertCircle size={10} /> Sans espèces
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Statut */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {isPending ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                                                            En attente activation
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                                                            Actif
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Événements assignés */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                        {grouped.assignments.map(a => (
                                                            <span
                                                                key={a.id}
                                                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-xs text-slate-700 dark:text-zinc-300 font-medium"
                                                            >
                                                                <Calendar size={11} className="text-[#FF5722] shrink-0" />
                                                                <span className="truncate max-w-[140px]">{a.events?.title || 'Événement'}</span>
                                                                {/* Action D : Retirer de cet événement précis */}
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => setConfirmRemoveSingle({
                                                                        assignmentId: a.id,
                                                                        eventId: a.event_id,
                                                                        eventTitle: a.events?.title || 'cet événement',
                                                                        ctrlName: displayName,
                                                                    })}
                                                                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                                    title={`Retirer de ${a.events?.title || 'cet événement'}`}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        {/* Action C : Modifier événements */}
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditAssignments(grouped)}
                                                            disabled={actionLoading || updatingAssignments}
                                                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                                                            title="Gérer les affectations d'événements"
                                                        >
                                                            <Settings size={13} />
                                                            <span>Gérer</span>
                                                        </button>

                                                        {/* Renvoyer SMS */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResendInvite(grouped.assignments[0])}
                                                            disabled={resendingId === grouped.assignments[0].id || actionLoading}
                                                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-amber-200/60 disabled:opacity-50"
                                                            title="Renvoyer le SMS d'invitation avec code"
                                                        >
                                                            {resendingId === grouped.assignments[0].id ? (
                                                                <Loader2 size={13} className="animate-spin" />
                                                            ) : (
                                                                <Send size={13} />
                                                            )}
                                                            <span>SMS</span>
                                                        </button>

                                                        {/* Action E : Retirer de TOUS les événements */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmRemoveAll({
                                                                controllerId: ctrl.id,
                                                                ctrlName: displayName,
                                                                eventCount: grouped.assignments.length,
                                                            })}
                                                            disabled={actionLoading}
                                                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                                                            title="Retirer de tous les événements (Action E)"
                                                        >
                                                            <UserMinus size={15} />
                                                        </button>

                                                        {/* Action F : Supprimer complètement */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDeleteCtrl({ controllerId: ctrl.id, ctrlName: displayName })}
                                                            disabled={actionLoading}
                                                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                                                            title="Supprimer définitivement (Action F)"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        VUE CARTES MOBILES (< 768px - md)
                        Touch targets >= 44px garantis
                        ══════════════════════════════════════════════════════════ */}
                    <div className="block md:hidden space-y-3">
                        {groupedControllers.map(grouped => {
                            const ctrl = grouped.user;
                            const displayName = [ctrl?.first_name, ctrl?.last_name].filter(Boolean).join(' ') || 'Contrôleur';
                            const displayPhone = (ctrl?.phone ?? '').replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
                            const isPending = ctrl?.first_name === 'Contrôleur' && !ctrl?.last_name;
                            const canAcceptCashAny = grouped.assignments.some(a => a.can_accept_cash);

                            return (
                                <div
                                    key={ctrl.id}
                                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3.5 transition-all"
                                >
                                    {/* Profil & Statut */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-[#FF5722]/10 dark:bg-[#FF5722]/20 flex items-center justify-center shrink-0 border border-[#FF5722]/20">
                                                <span className="text-sm font-black text-[#FF5722]">
                                                    {displayName[0]?.toUpperCase() ?? 'C'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                    {displayName}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                                                    <Phone size={11} className="text-slate-400" />
                                                    <span>{displayPhone}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isPending ? (
                                            <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 shrink-0">
                                                En attente
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 shrink-0">
                                                Actif
                                            </span>
                                        )}
                                    </div>

                                    {/* Statut encaissement */}
                                    <div className="text-xs">
                                        {canAcceptCashAny ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 size={12} /> Encaissement espèces autorisé
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                <AlertCircle size={12} /> Sans encaissement espèces
                                            </span>
                                        )}
                                    </div>

                                    {/* Événements assignés */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                            Événements assignés ({grouped.assignments.length}) :
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {grouped.assignments.map(a => (
                                                <span
                                                    key={a.id}
                                                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-xs text-slate-700 dark:text-zinc-300 font-medium"
                                                >
                                                    <Calendar size={11} className="text-[#FF5722] shrink-0" />
                                                    <span className="truncate max-w-[180px]">{a.events?.title || 'Événement'}</span>
                                                    {/* Action D : Retirer de cet événement précis */}
                                                    <button
                                                        type="button"
                                                        disabled={actionLoading}
                                                        onClick={() => setConfirmRemoveSingle({
                                                            assignmentId: a.id,
                                                            eventId: a.event_id,
                                                            eventTitle: a.events?.title || 'cet événement',
                                                            ctrlName: displayName,
                                                        })}
                                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                        title={`Retirer de ${a.events?.title || 'cet événement'}`}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Barre d'actions tactiles mobile (min-h-[44px]) */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                                        {/* Action C : Modifier événements */}
                                        <button
                                            type="button"
                                            onClick={() => openEditAssignments(grouped)}
                                            disabled={actionLoading || updatingAssignments}
                                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Settings size={14} />
                                            <span>Gérer</span>
                                        </button>

                                        {/* Renvoyer SMS */}
                                        <button
                                            type="button"
                                            onClick={() => handleResendInvite(grouped.assignments[0])}
                                            disabled={resendingId === grouped.assignments[0].id || actionLoading}
                                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-amber-200/60 disabled:opacity-50"
                                        >
                                            {resendingId === grouped.assignments[0].id ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Send size={14} />
                                            )}
                                            <span>SMS</span>
                                        </button>

                                        {/* Action E : Retirer de TOUS les événements */}
                                        <button
                                            type="button"
                                            onClick={() => setConfirmRemoveAll({
                                                controllerId: ctrl.id,
                                                ctrlName: displayName,
                                                eventCount: grouped.assignments.length,
                                            })}
                                            disabled={actionLoading}
                                            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50 flex items-center justify-center border border-amber-200/40"
                                            title="Retirer de tous les événements"
                                        >
                                            <UserMinus size={18} />
                                        </button>

                                        {/* Action F : Supprimer complètement */}
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteCtrl({ controllerId: ctrl.id, ctrlName: displayName })}
                                            disabled={actionLoading}
                                            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 flex items-center justify-center border border-red-200/40"
                                            title="Supprimer définitivement"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Action D : Dialog Confirmation Retrait d'un événement ── */}
            <ConfirmDialog
                isOpen={!!confirmRemoveSingle}
                onClose={() => setConfirmRemoveSingle(null)}
                onConfirm={() => confirmRemoveSingle && handleRemoveSingle(confirmRemoveSingle.assignmentId, confirmRemoveSingle.eventId)}
                title="Retirer de cet événement ?"
                message={`Voulez-vous retirer ${confirmRemoveSingle?.ctrlName} de l'événement "${confirmRemoveSingle?.eventTitle}" ? Ses autres affectations et l'historique de ses scans seront conservés.`}
                confirmLabel="Retirer de l'événement"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* ── Action E : Dialog Confirmation Retrait de TOUS les événements ── */}
            <ConfirmDialog
                isOpen={!!confirmRemoveAll}
                onClose={() => setConfirmRemoveAll(null)}
                onConfirm={() => confirmRemoveAll && handleRemoveAll(confirmRemoveAll.controllerId)}
                title="Retirer de tous vos événements ?"
                message={`Voulez-vous retirer ${confirmRemoveAll?.ctrlName} de TOUS ses événements assignés (${confirmRemoveAll?.eventCount ?? 0} événement${(confirmRemoveAll?.eventCount ?? 0) > 1 ? 's' : ''} au total) ? Le contrôleur n'aura plus aucun événement actif pour votre organisation, mais son compte et son historique restent intacts.`}
                confirmLabel="Retirer de tous les événements"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* ── Action F : Dialog Confirmation Suppression Complète ── */}
            <ConfirmDialog
                isOpen={!!confirmDeleteCtrl}
                onClose={() => setConfirmDeleteCtrl(null)}
                onConfirm={() => confirmDeleteCtrl && handleDeleteController(confirmDeleteCtrl.controllerId)}
                title="Supprimer définitivement le contrôleur ?"
                message={`Êtes-vous sûr de vouloir supprimer ${confirmDeleteCtrl?.ctrlName} de votre équipe ? Ses accès opérationnels au scanner seront immédiatement révoqués et sa session invalidée. Pour réintégrer ce contrôleur plus tard, une nouvelle invitation sera obligatoire.`}
                confirmLabel="Supprimer le contrôleur"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* ── Action C : Modal Modification des Affectations ── */}
            {editModalCtrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={e => { if (e.key === 'Escape') setEditModalCtrl(null); }}
                >
                    <div className="absolute inset-0" onClick={() => setEditModalCtrl(null)} />
                    <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                            <div>
                                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Settings size={18} className="text-[#FF5722]" /> Gérer les affectations
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Contrôleur : <span className="font-bold text-slate-700 dark:text-zinc-200">{editModalCtrl.user.first_name} {editModalCtrl.user.last_name}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditModalCtrl(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {(() => {
                                const assignableEvents = events
                                    .filter(e => isEventEligibleForController(e.status) || editEventIds.includes(e.id))
                                    .sort((a, b) => {
                                        const isEligibleA = isEventEligibleForController(a.status);
                                        const isEligibleB = isEventEligibleForController(b.status);
                                        if (isEligibleA !== isEligibleB) return isEligibleA ? -1 : 1;
                                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                                        const dateB = b.date ? new Date(b.date).getTime() : 0;
                                        if (dateA && dateB && dateA !== dateB) return dateA - dateB;
                                        return (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
                                    });
                                return (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                                            Sélectionnez les événements autorisés ({editEventIds.length}/{assignableEvents.length}) :
                                        </label>
                                        <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60">
                                            {assignableEvents.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-slate-400">
                                                    Aucun événement disponible pour affectation.
                                                </div>
                                            ) : (
                                                assignableEvents.map(ev => {
                                                    const isSelected = editEventIds.includes(ev.id);
                                                    const isEligible = isEventEligibleForController(ev.status);
                                                    return (
                                                        <div
                                                            key={ev.id}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setEditEventIds(prev => prev.filter(id => id !== ev.id));
                                                                } else if (isEligible) {
                                                                    setEditEventIds(prev => [...prev, ev.id]);
                                                                }
                                                            }}
                                                            className={`flex items-center justify-between min-h-[48px] p-2.5 rounded-lg border transition-all ${
                                                                isSelected
                                                                    ? isEligible
                                                                        ? 'border-[#FF5722] bg-[#FF5722]/5 font-bold shadow-sm cursor-pointer'
                                                                        : 'border-amber-400/60 bg-amber-500/10 font-bold shadow-sm cursor-pointer'
                                                                    : isEligible
                                                                        ? 'border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer'
                                                                        : 'border-transparent opacity-50 cursor-not-allowed text-slate-400'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                {isSelected ? (
                                                                    <CheckSquare size={16} className={isEligible ? "text-[#FF5722] shrink-0" : "text-amber-500 shrink-0"} />
                                                                ) : (
                                                                    <Square size={16} className="text-slate-400 shrink-0" />
                                                                )}
                                                                <span className="text-xs truncate">{ev.title}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                {!isEligible ? (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                                                                        {ev.status === 'TERMINE' ? 'Terminé (à retirer)' : `${ev.status || 'Non actif'} (à retirer)`}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                                                                        {ev.status === 'PUBLIE' ? 'En ligne' : 'Validé'}
                                                                    </span>
                                                                )}
                                                                {ev.date && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        {new Date(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Toggle Cash */}
                            <button
                                type="button"
                                onClick={() => setEditCanCash(!editCanCash)}
                                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                                    editCanCash
                                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800'
                                }`}
                            >
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    {editCanCash ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-slate-400" />}
                                    Autoriser l&apos;encaissement espèces
                                </span>
                                <div className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${editCanCash ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${editCanCash ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                </div>
                            </button>

                            <div className="flex items-center gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    fullWidth
                                    size="md"
                                    onClick={() => setEditModalCtrl(null)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    size="md"
                                    isLoading={updatingAssignments}
                                    onClick={handleSaveAssignments}
                                >
                                    Enregistrer
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal d'invitation contrôleur (Partie 2.A & 2.B) ── */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="invite-modal-title"
                    onKeyDown={e => { if (e.key === 'Escape') setShowModal(false); }}
                >
                    <div className="absolute inset-0" onClick={() => setShowModal(false)} />
                    <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800/60">
                            <h2 id="invite-modal-title" className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <UserPlus size={18} className="text-[#FF5722]" /> Inviter un contrôleur
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-4">
                            {/* Prénom & Nom */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1.5">
                                        Prénom <span className="text-slate-400 font-normal">(optionnel)</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Moussa"
                                        value={invFirstName}
                                        onChange={e => { setInvFirstName(e.target.value); setInvNameError(''); }}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1.5">
                                        Nom <span className="text-slate-400 font-normal">(optionnel)</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Diop"
                                        value={invLastName}
                                        onChange={e => { setInvLastName(e.target.value); setInvNameError(''); }}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                            </div>
                            {invNameError && <p className="text-[11px] text-red-500 font-medium">{invNameError}</p>}

                            {/* Téléphone */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1.5">
                                    Numéro du contrôleur *
                                </label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="77 123 45 67"
                                        value={invPhone}
                                        onChange={e => { setInvPhone(e.target.value); setInvPhoneError(''); }}
                                        className={`w-full h-11 pl-9 pr-3 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none ${
                                            invPhoneError
                                                ? 'border-red-400 focus:border-red-500'
                                                : 'border-slate-200 dark:border-zinc-700 focus:border-[#FF5722]'
                                        }`}
                                    />
                                </div>
                                {invPhoneError && <p className="text-[11px] text-red-500 font-medium mt-1">{invPhoneError}</p>}
                            </div>

                            {/* Email (optionnel) */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1.5">
                                    Email <span className="text-slate-400 font-normal">(optionnel)</span>
                                </label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        placeholder="controleur@email.com"
                                        value={invEmail}
                                        onChange={e => setInvEmail(e.target.value)}
                                        className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                            </div>

                            {/* Sélection multi-événements */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                                        Événements à assigner * ({invEventIds.length}/{availableEvents.length})
                                    </label>
                                    {availableEvents.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={toggleAllEvents}
                                            className="text-[11px] font-bold text-[#FF5722] hover:underline"
                                        >
                                            {invEventIds.length === availableEvents.length ? 'Tout désélectionner' : 'Sélectionner tous'}
                                        </button>
                                    )}
                                </div>

                                {availableEvents.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-center space-y-2">
                                        <AlertCircle size={22} className="text-amber-500 mx-auto" />
                                        <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                                            Aucun événement disponible
                                        </p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                                            Les contrôleurs peuvent uniquement être affectés à des événements confirmés et opérationnels.
                                            Créez ou faites confirmer un événement pour pouvoir l&apos;affecter.
                                        </p>
                                        <Link
                                            href="/partner/events"
                                            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5722] hover:underline pt-1"
                                        >
                                            Voir mes événements &rarr;
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60">
                                        {availableEvents.map(ev => {
                                            const isSelected = invEventIds.includes(ev.id);
                                            return (
                                                <div
                                                    key={ev.id}
                                                    onClick={() => toggleEventSelection(ev.id)}
                                                    className={`flex items-center justify-between min-h-[48px] p-2.5 rounded-lg border cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-[#FF5722] bg-[#FF5722]/5 font-bold shadow-sm'
                                                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {isSelected ? (
                                                            <CheckSquare size={16} className="text-[#FF5722] shrink-0" />
                                                        ) : (
                                                            <Square size={16} className="text-slate-400 shrink-0" />
                                                        )}
                                                        <span className="text-xs truncate">{ev.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                                                            {ev.status === 'PUBLIE' ? 'En ligne' : 'Validé'}
                                                        </span>
                                                        {ev.date && (
                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                {new Date(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Toggle cash */}
                            <button
                                type="button"
                                onClick={() => setInvCanCash(!invCanCash)}
                                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                                    invCanCash
                                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800'
                                }`}
                            >
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    {invCanCash ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-slate-400" />}
                                    Encaissement espèces
                                </span>
                                <div className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${invCanCash ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${invCanCash ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                </div>
                            </button>

                            <Button
                                variant="primary"
                                fullWidth
                                size="lg"
                                isLoading={inviting}
                                disabled={!invPhone.trim() || invEventIds.length === 0 || availableEvents.length === 0}
                            >
                                {invEventIds.length > 1 ? `Inviter sur ${invEventIds.length} événements` : 'Inviter le contrôleur'}
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
