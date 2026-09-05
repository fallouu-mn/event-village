'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    Calendar,
    Plus,
    Search,
    Ticket,
    DollarSign,
    CheckCircle2,
    Clock,
    MapPin,
    Send,
    Trash2,
    Eye,
    Pencil,
    RefreshCw,
    Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toastMessages } from '@/lib/messages/toast-messages';

interface EventItem {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    start_time: string;
    location: string;
    city: string | null;
    status: 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE';
    image_url: string | null;
    capacity: number | null;
    created_at: string;
    ticket_categories?: Array<{
        id: string;
        name: string;
        price: number;
        total_quantity: number;
        sold_quantity: number;
    }>;
}

export default function PartnerEventsPage() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string>('TOUS');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const toast = useToast();
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; eventId: string | null }>({ isOpen: false, eventId: null });

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const url = new URL('/api/partner/events', window.location.origin);
            if (selectedStatus !== 'TOUS') url.searchParams.set('status', selectedStatus);
            if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());

            const res = await fetch(url.toString(), { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setEvents(data.events || []);
            }
        } catch (err) {
            console.error('Erreur chargement événements:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStatus]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchEvents();
    };

    const handlePublish = async (eventId: string) => {
        setActionLoading(eventId);
        try {
            const res = await fetch(`/api/partner/events/${eventId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PUBLIE' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Événement mis en ligne ! La billetterie est maintenant ouverte.');
                fetchEvents();
            } else {
                toast.error(data.error || 'Erreur lors de la publication.');
            }
        } catch {
            toast.error('Erreur réseau, réessayez.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitForValidation = async (eventId: string) => {
        setActionLoading(eventId);
        try {
            const res = await fetch(`/api/partner/events/${eventId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'EN_ATTENTE' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(toastMessages.events.submitted());
                fetchEvents();
            } else {
                toast.error(data.error || toastMessages.events.submitError);
            }
        } catch {
            toast.error(toastMessages.common.networkError);
        } finally {
            setActionLoading(null);
        }
    };

    const openDeleteConfirm = (eventId: string) => {
        setDeleteConfirm({ isOpen: true, eventId });
    };

    const confirmDelete = async () => {
        const eventId = deleteConfirm.eventId;
        if (!eventId) return;
        setActionLoading(eventId);
        try {
            const res = await fetch(`/api/partner/events/${eventId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                toast.success(toastMessages.events.deleted);
                fetchEvents();
            } else {
                toast.error(data.error || toastMessages.events.deleteError);
            }
        } catch {
            toast.error(toastMessages.common.networkError);
        } finally {
            setActionLoading(null);
            setDeleteConfirm({ isOpen: false, eventId: null });
        }
    };

    // Calcul des statistiques
    const totalEvents = events.length;
    const publishedEvents = events.filter((e) => e.status === 'PUBLIE').length;
    const totalTicketsSold = events.reduce((acc, ev) => {
        const catSold = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0), 0) || 0;
        return acc + catSold;
    }, 0);
    const totalRevenue = events.reduce((acc, ev) => {
        const catRev = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0) * Number(c.price || 0), 0) || 0;
        return acc + catRev;
    }, 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Entête */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-[#FF5722]" />
                        Événements & Billetterie
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                        Créez, gérez et suivez les ventes de vos billets en temps réel (§30-§41 CDC V3.0)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchEvents}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                    <Link href="/partner/events/new">
                        <Button variant="primary" className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Créer un événement
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Statistiques Rapides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#FF5722] flex items-center justify-center font-bold">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Total Événements</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalEvents}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">En Ligne (Publiés)</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{publishedEvents}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold">
                        <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Billets Vendus</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalTicketsSold}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Chiffre d&apos;Affaires</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalRevenue.toLocaleString('fr-FR')} F</p>
                    </div>
                </div>
            </div>

            {/* Barre de Recherche et Filtres */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                    {/* Onglets Filtres */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                        {['TOUS', 'BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedStatus(tab)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap active:scale-[0.98] ${
                                    selectedStatus === tab
                                        ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold scale-[1.02]'
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {tab === 'TOUS' ? 'Tous les événements' : tab}
                            </button>
                        ))}
                    </div>

                    {/* Recherche */}
                    <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-sm w-full">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par titre..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5722]"
                            />
                        </div>
                        <Button type="submit" size="sm" variant="outline">
                            Filtrer
                        </Button>
                    </form>
                </div>
            </div>

            {/* Liste des Événements */}
            {isLoading ? (
                <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#FF5722]" />
                    <p className="text-sm font-medium">Chargement de vos événements...</p>
                </div>
            ) : events.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center mx-auto">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun événement trouvé</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            {selectedStatus !== 'TOUS'
                                ? `Aucun événement avec le statut "${selectedStatus}".`
                                : 'Vous n\'avez pas encore créé d\'événement. Lancez votre première billetterie en ligne !'}
                        </p>
                    </div>
                    <Link href="/partner/events/new">
                        <Button variant="primary" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Créer un événement maintenant
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((ev) => {
                        const totalSold = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0), 0) || 0;
                        const totalCap = ev.ticket_categories?.reduce((s, c) => s + (c.total_quantity || 0), 0) || ev.capacity || 0;
                        const fillPercent = totalCap > 0 ? Math.min(100, Math.round((totalSold / totalCap) * 100)) : 0;

                        return (
                            <div
                                key={ev.id}
                                className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:border-[#FF5722]/40 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    {/* Image Header */}
                                    <div className="relative h-44 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                        {ev.image_url ? (
                                            <Image
                                                src={ev.image_url}
                                                alt={ev.title}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                            />
                                        ) : (
                                            <div className="text-center p-4">
                                                <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                                <span className="text-xs text-slate-400 font-medium">Image non définie</span>
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3">
                                            <StatusBadge status={ev.status} size="sm" />
                                        </div>
                                    </div>

                                    {/* Contenu */}
                                    <div className="p-5 space-y-3">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                                            {ev.title}
                                        </h3>

                                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span>
                                                    {ev.start_date} à {ev.start_time.slice(0, 5)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="truncate">{ev.location} ({ev.city || 'Dakar'})</span>
                                            </div>
                                        </div>

                                        {/* Jauge de vente billetterie */}
                                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                                                    <Ticket className="w-3.5 h-3.5 text-[#FF5722]" />
                                                    Billets vendus
                                                </span>
                                                <span className="text-slate-900 dark:text-white">
                                                    {totalSold} / {totalCap > 0 ? totalCap : '∞'}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] transition-all"
                                                    style={{ width: `${fillPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Contextuelles */}
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                                    {ev.status === 'BROUILLON' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openDeleteConfirm(ev.id)}
                                                disabled={actionLoading === ev.id}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                Supprimer
                                            </Button>
                                            <Link href={`/partner/events/${ev.id}/edit`}>
                                                <Button size="sm" variant="outline" className="text-xs">
                                                    <Pencil className="w-3.5 h-3.5 mr-1" />
                                                    Modifier
                                                </Button>
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handleSubmitForValidation(ev.id)}
                                                disabled={actionLoading === ev.id}
                                            >
                                                <Send className="w-3.5 h-3.5 mr-1" />
                                                Soumettre (§31)
                                            </Button>
                                        </>
                                    )}

                                    {ev.status === 'EN_ATTENTE' && (
                                        <div className="flex items-center justify-between w-full">
                                            <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                                                <Clock className="w-4 h-4" />
                                                En examen
                                            </div>
                                            <Link href={`/partner/events/${ev.id}/edit`}>
                                                <Button size="sm" variant="outline" className="text-xs">
                                                    <Pencil className="w-3.5 h-3.5 mr-1" />
                                                    Modifier
                                                </Button>
                                            </Link>
                                        </div>
                                    )}

                                    {ev.status === 'PUBLIE' && (
                                        <Link href={`/events/${ev.id}`} target="_blank" className="w-full">
                                            <Button size="sm" variant="outline" className="w-full text-xs flex items-center justify-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5" />
                                                Voir la page publique
                                            </Button>
                                        </Link>
                                    )}

                                    {ev.status === 'VALIDE' && (
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Validé
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handlePublish(ev.id)}
                                                disabled={actionLoading === ev.id}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
                                            >
                                                {actionLoading === ev.id ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Radio className="w-3.5 h-3.5" />
                                                )}
                                                Publier
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, eventId: null })}
                onConfirm={confirmDelete}
                title="Supprimer ce brouillon ?"
                message="Cette action est irreversible. Le brouillon et ses categories de billets seront definitivement supprimes."
                confirmLabel="Supprimer"
                variant="danger"
                isLoading={actionLoading === deleteConfirm.eventId}
            />
        </div>
    );
}
