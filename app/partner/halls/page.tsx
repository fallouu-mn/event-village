'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Building2,
    Plus,
    Calendar,
    Users,
    DollarSign,
    CheckCircle2,
    Clock,
    XCircle,
    MapPin,
    AlertCircle,
    RefreshCw,
    Percent,
    Eye
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HallReservation {
    id: string;
    start_date: string;
    end_date: string;
    total_amount: number;
    deposit_amount: number;
    balance_amount: number;
    moratorium_date: string | null;
    status: 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE' | 'TERMINEE';
    payment_status: string;
    created_at: string;
}

interface Hall {
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    price_per_day: number | null;
    price_per_hour: number | null;
    deposit_percentage: number;
    address: string | null;
    city: string | null;
    amenities: string[];
    is_active: boolean;
    hall_reservations?: HallReservation[];
}

export default function PartnerHallsPage() {
    const [halls, setHalls] = useState<Hall[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchHalls = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/partner/halls', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setHalls(data.halls || []);
            }
        } catch (err) {
            console.error('Erreur chargement salles:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHalls();
    }, []);

    const handleConfirmReservation = async (reservationId: string) => {
        setActionLoading(reservationId);
        setFeedback(null);
        try {
            const res = await fetch(`/api/partner/halls/reservations/${reservationId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CONFIRM' }),
            });
            const data = await res.json();
            if (data.success) {
                setFeedback({ type: 'success', message: 'Réservation confirmée avec succès !' });
                fetchHalls();
            } else {
                setFeedback({ type: 'error', message: data.error || 'Échec confirmation.' });
            }
        } catch (err) {
            setFeedback({ type: 'error', message: 'Erreur réseau.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelReservation = async (reservationId: string) => {
        if (!confirm('Annuler cette réservation ?')) return;
        setActionLoading(reservationId);
        setFeedback(null);
        try {
            const res = await fetch(`/api/partner/halls/reservations/${reservationId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CANCEL', reason: 'Annulation par le partenaire' }),
            });
            const data = await res.json();
            if (data.success) {
                setFeedback({ type: 'success', message: 'Réservation annulée.' });
                fetchHalls();
            } else {
                setFeedback({ type: 'error', message: data.error || 'Échec annulation.' });
            }
        } catch (err) {
            setFeedback({ type: 'error', message: 'Erreur réseau.' });
        } finally {
            setActionLoading(null);
        }
    };

    // Statistiques globales
    const totalHalls = halls.length;
    const allReservations = halls.flatMap((h) => h.hall_reservations || []);
    const confirmedCount = allReservations.filter((r) => r.status === 'CONFIRMEE').length;
    const pendingCount = allReservations.filter((r) => r.status === 'EN_ATTENTE').length;
    const totalRevenue = allReservations
        .filter((r) => r.status === 'CONFIRMEE')
        .reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-[#FF6B35]" />
                        Réservation de Salles
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                        Gérez vos salles, définissez vos acomptes personnalisés et suivez les réservations (§42-§50 CDC V3.0)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchHalls} disabled={isLoading} className="flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                    <Link href="/partner/halls/new">
                        <Button className="bg-[#FF6B35] hover:bg-[#ff5719] text-white flex items-center gap-2 shadow-lg shadow-[#FF6B35]/20">
                            <Plus className="w-4 h-4" />
                            Ajouter une salle
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Notifications */}
            {feedback && (
                <div
                    className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                    }`}
                >
                    {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#FF6B35] flex items-center justify-center font-bold">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Salles Gérées</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalHalls}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Demandes en Attente</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{pendingCount}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Réservations Confirmées</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{confirmedCount}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Chiffre d'Affaires</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalRevenue.toLocaleString('fr-FR')} F</p>
                    </div>
                </div>
            </div>

            {/* Liste des Salles */}
            {isLoading ? (
                <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#FF6B35]" />
                    <p className="text-sm font-medium">Chargement des salles...</p>
                </div>
            ) : halls.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center mx-auto">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune salle configurée</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            Ajoutez votre première salle de réception pour recevoir des réservations en ligne avec acompte garanti.
                        </p>
                    </div>
                    <Link href="/partner/halls/new">
                        <Button className="bg-[#FF6B35] hover:bg-[#ff5719] text-white text-xs">
                            <Plus className="w-4 h-4 mr-2" />
                            Créer ma première salle
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {halls.map((hall) => {
                        const reservations = hall.hall_reservations || [];
                        return (
                            <div
                                key={hall.id}
                                className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white">{hall.name}</h3>
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-[#FF6B35] border border-orange-200">
                                                Acompte configurable : {hall.deposit_percentage}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
                                            <span className="flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5" />
                                                Capacité : {hall.capacity} personnes
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <DollarSign className="w-3.5 h-3.5" />
                                                {hall.price_per_day ? `${Number(hall.price_per_day).toLocaleString('fr-FR')} F / jour` : `${Number(hall.price_per_hour).toLocaleString('fr-FR')} F / heure`}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {hall.city || 'Dakar'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Réservations Liées à la Salle */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                                        Réservations ({reservations.length})
                                    </h4>

                                    {reservations.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">Aucune réservation pour le moment.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {reservations.map((res) => (
                                                <div
                                                    key={res.id}
                                                    className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-2 text-xs"
                                                >
                                                    <div className="flex items-center justify-between font-bold">
                                                        <span className="text-slate-900 dark:text-white">
                                                            {res.start_date} → {res.end_date}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                                                                res.status === 'CONFIRMEE'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : res.status === 'EN_ATTENTE'
                                                                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}
                                                        >
                                                            {res.status}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 text-slate-600 dark:text-zinc-400">
                                                        <div className="flex justify-between">
                                                            <span>Total :</span>
                                                            <span className="font-bold text-slate-900 dark:text-white">
                                                                {Number(res.total_amount).toLocaleString('fr-FR')} F
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Acompte requis :</span>
                                                            <span className="font-semibold text-emerald-600">
                                                                {Number(res.deposit_amount).toLocaleString('fr-FR')} F
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Solde restant :</span>
                                                            <span className="font-semibold text-orange-600">
                                                                {Number(res.balance_amount).toLocaleString('fr-FR')} F
                                                            </span>
                                                        </div>
                                                        {res.moratorium_date && (
                                                            <div className="flex justify-between text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-slate-200 dark:border-zinc-700">
                                                                <span>Moratoire solde :</span>
                                                                <span>{res.moratorium_date}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {res.status === 'EN_ATTENTE' && (
                                                        <div className="pt-2 flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleConfirmReservation(res.id)}
                                                                disabled={actionLoading === res.id}
                                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                                                            >
                                                                Confirmer
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleCancelReservation(res.id)}
                                                                disabled={actionLoading === res.id}
                                                                className="w-full text-red-600 hover:bg-red-50 text-[11px]"
                                                            >
                                                                Refuser
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
