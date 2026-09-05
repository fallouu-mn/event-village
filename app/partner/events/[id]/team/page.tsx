'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, UserPlus, Trash2, Loader2,
    ShieldCheck, ShieldOff, Phone, CheckCircle2, AlertCircle,
    Mail, Send, User,
} from 'lucide-react';
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

interface Assignment {
    id: string;
    can_accept_cash: boolean;
    created_at: string;
    users: ControllerUser;
}

export default function PartnerEventTeamPage() {
    const { id: eventId } = useParams<{ id: string }>();
    const router = useRouter();
    const toast = useToast();

    const [controllers, setControllers] = useState<Assignment[]>([]);
    const [loading, setLoading]         = useState(true);
    const [eventTitle, setEventTitle]   = useState('');
    const [eventStatus, setEventStatus] = useState<string>('');

    // Invite form
    const [firstName, setFirstName]       = useState('');
    const [lastName, setLastName]         = useState('');
    const [email, setEmail]               = useState('');
    const [phone, setPhone]               = useState('');
    const [canAcceptCash, setCanAcceptCash] = useState(false);
    const [inviting, setInviting]         = useState(false);
    const [phoneError, setPhoneError]     = useState('');
    const [nameError, setNameError]       = useState('');
    const [resendingId, setResendingId]   = useState<string | null>(null);

    // Confirm dialog
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [removing, setRemoving] = useState(false);

    const fetchControllers = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await fetch(`/api/partner/team/${eventId}`);
            const data = await res.json();
            if (data.success) setControllers(data.controllers ?? []);
        } catch {
            toast.error('Impossible de charger l\'équipe.');
        } finally {
            setLoading(false);
        }
    }, [eventId, toast]);

    useEffect(() => {
        if (!eventId) return;
        fetchControllers();
        // Fetch event metadata
        fetch(`/api/partner/events/${eventId}`)
            .then(r => r.json())
            .then(d => {
                if (d.event?.title) setEventTitle(d.event.title);
                if (d.event?.status) setEventStatus(d.event.status);
            })
            .catch(() => {});

        // Abonnement Supabase Realtime pour synchronisation instantanée
        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`partner-event-team-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_controllers',
                    filter: `event_id=eq.${eventId}`,
                },
                () => {
                    fetchControllers();
                }
            )
            .subscribe();

        const eventMetaChannel = supabase
            .channel(`partner-event-meta-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'events',
                    filter: `id=eq.${eventId}`,
                },
                (payload: any) => {
                    if (payload.new?.title) setEventTitle(payload.new.title);
                    if (payload.new?.status) setEventStatus(payload.new.status);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(eventMetaChannel);
        };
    }, [eventId, fetchControllers]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError('');
        setNameError('');

        if (eventStatus && !isEventEligibleForController(eventStatus)) {
            toast.error("Ce contrôleur ne peut pas être affecté à cet événement car l'événement n'est pas encore confirmé.");
            return;
        }

        const cleanPhone = phone.replace(/\s/g, '');
        if (!/^(7[0-8])\d{7}$/.test(cleanPhone)) {
            setPhoneError('Numéro sénégalais valide requis (ex: 77 123 45 67).');
            return;
        }

        setInviting(true);
        try {
            const res  = await fetch('/api/partner/team/invite', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    event_id:        eventId,
                    phone:           cleanPhone,
                    first_name:      firstName.trim() || 'Contrôleur',
                    last_name:       lastName.trim() || '',
                    email:           email.trim() || undefined,
                    can_accept_cash: canAcceptCash,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'invitation.');
            toast.success(data.message || 'Contrôleur invité avec succès.');
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhone('');
            setCanAcceptCash(false);
            fetchControllers();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setInviting(false);
        }
    };

    const handleResendInvite = async (assignment: Assignment) => {
        setResendingId(assignment.id);
        try {
            const res = await fetch('/api/partner/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id:        eventId,
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

    const handleRemove = async (assignmentId: string) => {
        setRemoving(true);
        try {
            const res  = await fetch(`/api/partner/team/${eventId}?assignmentId=${assignmentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');
            toast.success('Contrôleur retiré.');
            setControllers(prev => prev.filter(c => c.id !== assignmentId));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setRemoving(false);
            setConfirmRemoveId(null);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href={`/partner/events/${eventId}/edit`} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                    <ArrowLeft size={20} className="text-slate-600 dark:text-zinc-400" />
                </Link>
                <div>
                    <h1 className="text-base font-black text-slate-900 dark:text-white">Mon Équipe — Contrôleurs</h1>
                    {eventTitle && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[280px]">{eventTitle}</p>}
                </div>
            </div>

            {/* Formulaire d'invitation ou Bannière de statut non éligible */}
            {eventStatus && !isEventEligibleForController(eventStatus) ? (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                            Affectation de contrôleurs non disponible
                        </h2>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                        Cet événement est actuellement en statut <strong className="uppercase">{eventStatus}</strong>.
                        Les contrôleurs peuvent uniquement être affectés à des événements confirmés et opérationnels (VALIDÉ ou PUBLIÉ).
                    </p>
                    <div className="pt-1">
                        <Link
                            href="/partner/events"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF5722] hover:underline"
                        >
                            &larr; Retour à la liste de mes événements
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <UserPlus size={16} className="text-[#FF5722]" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Inviter un contrôleur</h2>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-3">
                        {/* Prénom & Nom */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Prénom <span className="text-slate-400 font-normal">(optionnel)</span></label>
                                <input
                                    type="text"
                                    placeholder="Ex: Moussa"
                                    value={firstName}
                                    onChange={e => { setFirstName(e.target.value); setNameError(''); }}
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:border-[#FF5722]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Nom <span className="text-slate-400 font-normal">(optionnel)</span></label>
                                <input
                                    type="text"
                                    placeholder="Ex: Diop"
                                    value={lastName}
                                    onChange={e => { setLastName(e.target.value); setNameError(''); }}
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:border-[#FF5722]"
                                />
                            </div>
                        </div>
                        {nameError && <p className="text-[11px] text-red-500">{nameError}</p>}

                        {/* Téléphone */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                                Numéro du contrôleur *
                            </label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="77 123 45 67"
                                    value={phone}
                                    onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                                    className={`w-full h-11 pl-9 pr-3 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold focus:outline-none ${
                                        phoneError
                                            ? 'border-red-400 focus:border-red-500'
                                            : 'border-slate-200 dark:border-zinc-700 focus:border-[#FF5722]'
                                    }`}
                                />
                            </div>
                            {phoneError && <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>}
                        </div>

                        {/* Email (optionnel) */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                                Email <span className="text-slate-400 font-normal">(optionnel)</span>
                            </label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    placeholder="controleur@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:border-[#FF5722]"
                                />
                            </div>
                        </div>

                        {/* Toggle espèces */}
                        <button
                            type="button"
                            onClick={() => setCanAcceptCash(!canAcceptCash)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                canAcceptCash
                                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                    : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800'
                            }`}
                        >
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                {canAcceptCash
                                    ? <ShieldCheck size={14} className="text-emerald-500" />
                                    : <ShieldOff size={14} className="text-slate-400" />
                                }
                                Autoriser l&apos;encaissement en espèces
                            </span>
                            <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${canAcceptCash ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${canAcceptCash ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>

                        <Button
                            variant="primary"
                            fullWidth
                            size="lg"
                            isLoading={inviting}
                            disabled={!phone.trim() || (!!eventStatus && !isEventEligibleForController(eventStatus))}
                        >
                            {inviting ? 'Envoi en cours...' : 'Inviter le contrôleur'}
                        </Button>
                    </form>
                </div>
            )}

            {/* Liste des contrôleurs */}
            <div className="space-y-3">
                <h2 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Contrôleurs assignés ({controllers.length})
                </h2>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : controllers.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                        <UserPlus size={36} className="text-slate-300 dark:text-zinc-600 mx-auto" />
                        <p className="text-xs text-slate-400 dark:text-zinc-500">
                            Aucun contrôleur assigné. Invitez votre équipe ci-dessus.
                        </p>
                    </div>
                ) : (
                    controllers.map(assignment => {
                        const ctrl = assignment.users;
                        const displayName = [ctrl.first_name, ctrl.last_name].filter(Boolean).join(' ') || 'Contrôleur';
                        const displayPhone = ctrl.phone?.replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') ?? '';

                        return (
                            <div
                                key={assignment.id}
                                className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-black text-slate-500 dark:text-zinc-400">
                                        {displayName[0]?.toUpperCase() ?? 'C'}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">{displayPhone}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {assignment.can_accept_cash ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 size={11} /> Espèces autorisées
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500">
                                                <AlertCircle size={11} /> Sans espèces
                                            </span>
                                        )}
                                        {ctrl.first_name === 'Contrôleur' && !ctrl.last_name && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                                                En attente
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Renvoyer l'invitation SMS (Touch target >= 44px) */}
                                <button
                                    type="button"
                                    onClick={() => handleResendInvite(assignment)}
                                    disabled={resendingId === assignment.id}
                                    className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 border border-amber-200/60 dark:border-amber-900/40"
                                    title="Renvoyer l'invitation avec code d'accès par SMS"
                                >
                                    {resendingId === assignment.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Send size={14} />
                                    )}
                                    <span className="hidden sm:inline">Renvoyer SMS</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setConfirmRemoveId(assignment.id)}
                                    className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center justify-center border border-red-200/40 dark:border-red-900/40"
                                    title="Retirer le contrôleur de cet événement"
                                    aria-label="Retirer de l'événement"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmDialog
                isOpen={!!confirmRemoveId}
                onClose={() => setConfirmRemoveId(null)}
                onConfirm={() => confirmRemoveId && handleRemove(confirmRemoveId)}
                title="Retirer de cet événement ?"
                message="Le contrôleur perdra l'accès au scanner pour cet événement. Ses autres affectations et l'historique de ses scans seront conservés."
                confirmLabel="Retirer de l'événement"
                variant="danger"
                isLoading={removing}
            />
        </div>
    );
}
