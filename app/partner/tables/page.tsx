'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutGrid,
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    Users,
    MapPin,
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronRight
} from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Zone {
    id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
}

interface Table {
    id: string;
    zone_id: string;
    table_number: string;
    capacity: number;
    min_capacity: number;
    is_active: boolean;
    created_at: string;
}

interface TableReservation {
    id: string;
    table_id: string;
    zone_id: string;
    client_id: string;
    reservation_date: string;
    reservation_time: string;
    guest_count: number;
    status: string;
    payment_status: string;
    special_requests?: string;
    created_at: string;
}

const zoneSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caracteres.'),
    description: z.string().optional(),
});

const tableSchema = z.object({
    zone_id: z.string().min(1, 'Selectionnez une zone.'),
    table_number: z.string().min(1, 'Le numero est obligatoire.'),
    capacity: z.number().int().min(1, 'Capacite minimum 1 personne.'),
    min_capacity: z.number().int().min(1).optional(),
});

type Tab = 'zones' | 'reservations';

export default function PartnerTablesPage() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('zones');

    const [zones, setZones] = useState<Zone[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [reservations, setReservations] = useState<TableReservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reservationDate, setReservationDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    // Zone modal
    const [zoneModal, setZoneModal] = useState<{ isOpen: boolean; editId?: string }>({ isOpen: false });
    const [zoneName, setZoneName] = useState('');
    const [zoneDescription, setZoneDescription] = useState('');
    const [zoneErrors, setZoneErrors] = useState<Record<string, string>>({});
    const [zoneSaving, setZoneSaving] = useState(false);

    // Table modal
    const [tableModal, setTableModal] = useState<{ isOpen: boolean; editId?: string }>({ isOpen: false });
    const [tableZoneId, setTableZoneId] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [tableCapacity, setTableCapacity] = useState<number | ''>('');
    const [tableMinCapacity, setTableMinCapacity] = useState<number | ''>(1);
    const [tableErrors, setTableErrors] = useState<Record<string, string>>({});
    const [tableSaving, setTableSaving] = useState(false);

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; type: 'zone' | 'table'; id: string | null; label: string }>({
        isOpen: false, type: 'zone', id: null, label: ''
    });
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Reservation action
    const [resAction, setResAction] = useState<{ isOpen: boolean; type: 'confirm' | 'cancel'; id: string | null }>({
        isOpen: false, type: 'confirm', id: null
    });
    const [resActionLoading, setResActionLoading] = useState(false);

    const fetchZonesAndTables = useCallback(async () => {
        setIsLoading(true);
        try {
            const [zRes, tRes] = await Promise.all([
                fetch('/api/partner/tables?type=zones', { cache: 'no-store' }),
                fetch('/api/partner/tables?type=tables', { cache: 'no-store' }),
            ]);
            const zData = await zRes.json();
            const tData = await tRes.json();
            if (zData.success) setZones(zData.zones || []);
            if (tData.success) setTables(tData.tables || []);
        } catch {
            toast.error('Erreur lors du chargement.');
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchReservations = useCallback(async (date: string) => {
        try {
            const res = await fetch(`/api/partner/tables/reservations?date=${date}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setReservations(data.reservations || []);
        } catch {
            toast.error('Erreur chargement reservations.');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchZonesAndTables();
    }, [fetchZonesAndTables]);

    useEffect(() => {
        if (activeTab === 'reservations') {
            fetchReservations(reservationDate);
        }
    }, [activeTab, reservationDate, fetchReservations]);

    // ── Zone CRUD ──
    const openZoneModal = (zone?: Zone) => {
        if (zone) {
            setZoneName(zone.name);
            setZoneDescription(zone.description || '');
            setZoneModal({ isOpen: true, editId: zone.id });
        } else {
            setZoneName('');
            setZoneDescription('');
            setZoneModal({ isOpen: true });
        }
        setZoneErrors({});
    };

    const handleSaveZone = async () => {
        setZoneErrors({});
        const parsed = zoneSchema.safeParse({ name: zoneName, description: zoneDescription || undefined });
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as string;
                if (!errs[key]) errs[key] = issue.message;
            }
            setZoneErrors(errs);
            return;
        }

        setZoneSaving(true);
        try {
            const isEdit = !!zoneModal.editId;
            const url = isEdit ? `/api/partner/tables/${zoneModal.editId}` : '/api/partner/tables';
            const method = isEdit ? 'PATCH' : 'POST';
            const body = isEdit
                ? { type: 'zone', name: parsed.data.name, description: parsed.data.description || null }
                : { type: 'zone', name: parsed.data.name, description: parsed.data.description || null };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.success || data.zone) {
                toast.success(isEdit ? 'Zone mise a jour !' : 'Zone creee !');
                setZoneModal({ isOpen: false });
                fetchZonesAndTables();
            } else {
                toast.error(data.error || 'Echec de l\'operation.');
            }
        } catch {
            toast.error('Erreur reseau.');
        } finally {
            setZoneSaving(false);
        }
    };

    // ── Table CRUD ──
    const openTableModal = (table?: Table) => {
        if (table) {
            setTableZoneId(table.zone_id);
            setTableNumber(table.table_number);
            setTableCapacity(table.capacity);
            setTableMinCapacity(table.min_capacity || 1);
            setTableModal({ isOpen: true, editId: table.id });
        } else {
            setTableZoneId(zones[0]?.id || '');
            setTableNumber('');
            setTableCapacity('');
            setTableMinCapacity(1);
            setTableModal({ isOpen: true });
        }
        setTableErrors({});
    };

    const handleSaveTable = async () => {
        setTableErrors({});
        const parsed = tableSchema.safeParse({
            zone_id: tableZoneId,
            table_number: tableNumber,
            capacity: tableCapacity === '' ? 0 : Number(tableCapacity),
            min_capacity: tableMinCapacity === '' ? 1 : Number(tableMinCapacity),
        });
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as string;
                if (!errs[key]) errs[key] = issue.message;
            }
            setTableErrors(errs);
            return;
        }

        setTableSaving(true);
        try {
            const isEdit = !!tableModal.editId;
            const url = isEdit ? `/api/partner/tables/${tableModal.editId}` : '/api/partner/tables';
            const method = isEdit ? 'PATCH' : 'POST';
            const body = {
                type: 'table',
                zone_id: parsed.data.zone_id,
                table_number: parsed.data.table_number,
                capacity: parsed.data.capacity,
                min_capacity: parsed.data.min_capacity || 1,
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.success || data.table) {
                toast.success(isEdit ? 'Table mise a jour !' : 'Table creee !');
                setTableModal({ isOpen: false });
                fetchZonesAndTables();
            } else {
                toast.error(data.error || 'Echec de l\'operation.');
            }
        } catch {
            toast.error('Erreur reseau.');
        } finally {
            setTableSaving(false);
        }
    };

    // ── Delete ──
    const handleDelete = async () => {
        if (!deleteConfirm.id) return;
        setDeleteLoading(true);
        try {
            const typeParam = deleteConfirm.type === 'zone' ? 'zone' : 'table';
            const res = await fetch(`/api/partner/tables/${deleteConfirm.id}?type=${typeParam}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast.success(`${deleteConfirm.type === 'zone' ? 'Zone' : 'Table'} supprimee.`);
                fetchZonesAndTables();
            } else {
                toast.error(data.error || 'Echec de la suppression.');
            }
        } catch {
            toast.error('Erreur reseau.');
        } finally {
            setDeleteLoading(false);
            setDeleteConfirm({ isOpen: false, type: 'zone', id: null, label: '' });
        }
    };

    // ── Reservation actions ──
    const handleReservationAction = async () => {
        if (!resAction.id) return;
        setResActionLoading(true);
        try {
            if (resAction.type === 'confirm') {
                const res = await fetch(`/api/partner/tables/reservations/${resAction.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'CONFIRMEE' }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('Reservation confirmee !');
                    fetchReservations(reservationDate);
                } else {
                    toast.error(data.error || 'Echec.');
                }
            } else {
                const res = await fetch(`/api/partner/tables/reservations/${resAction.id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'Annulee par le partenaire' }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('Reservation annulee.');
                    fetchReservations(reservationDate);
                } else {
                    toast.error(data.error || 'Echec.');
                }
            }
        } catch {
            toast.error('Erreur reseau.');
        } finally {
            setResActionLoading(false);
            setResAction({ isOpen: false, type: 'confirm', id: null });
        }
    };

    // Stats
    const totalZones = zones.length;
    const totalTables = tables.length;
    const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);

    const getTablesForZone = (zoneId: string) => tables.filter((t) => t.zone_id === zoneId);

    const getTableNumber = (tableId: string) => {
        const t = tables.find((t) => t.id === tableId);
        return t ? `Table ${t.table_number}` : tableId.slice(0, 8);
    };

    const getZoneName = (zoneId: string) => {
        const z = zones.find((z) => z.id === zoneId);
        return z?.name || 'Zone inconnue';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <LayoutGrid className="w-8 h-8 text-[#FF5722]" />
                        Tables & Zones
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                        Organisez vos zones de restauration et gerez les reservations de tables
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchZonesAndTables} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#FF5722] flex items-center justify-center">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Zones</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalZones}</p>
                    </div>
                </div>
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                        <LayoutGrid className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Tables</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalTables}</p>
                    </div>
                </div>
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Capacite Totale</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalCapacity} places</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('zones')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'zones'
                            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
                    }`}
                >
                    <LayoutGrid className="w-3.5 h-3.5 inline mr-1.5" />
                    Zones & Tables
                </button>
                <button
                    onClick={() => setActiveTab('reservations')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'reservations'
                            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
                    }`}
                >
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                    Reservations
                </button>
            </div>

            {/* ═══ TAB: Zones & Tables ═══ */}
            {activeTab === 'zones' && (
                <div className="space-y-6">
                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => openZoneModal()}
                            className="bg-[#FF5722] hover:bg-[#ff5719] text-white text-xs shadow-lg shadow-[#FF5722]/20"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Nouvelle Zone
                        </Button>
                        {zones.length > 0 && (
                            <Button onClick={() => openTableModal()} variant="outline" size="sm" className="text-xs">
                                <Plus className="w-4 h-4 mr-1.5" />
                                Nouvelle Table
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-[#FF5722]" />
                            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Chargement...</p>
                        </div>
                    ) : zones.length === 0 ? (
                        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center mx-auto">
                                <MapPin className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune zone configuree</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                    Creez votre premiere zone (Terrasse, VIP, Interieur...) pour organiser vos tables.
                                </p>
                            </div>
                            <Button onClick={() => openZoneModal()} className="bg-[#FF5722] hover:bg-[#ff5719] text-white text-xs">
                                <Plus className="w-4 h-4 mr-2" />
                                Creer une zone
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {zones.map((zone) => {
                                const zoneTables = getTablesForZone(zone.id);
                                return (
                                    <div key={zone.id} className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                        {/* Zone Header */}
                                        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{zone.name}</h3>
                                                    {zone.description && (
                                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{zone.description}</p>
                                                    )}
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                                    {zoneTables.length} table{zoneTables.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button size="sm" variant="ghost" className="p-1.5" onClick={() => openZoneModal(zone)}>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                                </Button>
                                                {zoneTables.length === 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        onClick={() => setDeleteConfirm({ isOpen: true, type: 'zone', id: zone.id, label: zone.name })}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Tables Grid */}
                                        <div className="p-4">
                                            {zoneTables.length === 0 ? (
                                                <p className="text-xs text-slate-400 dark:text-zinc-500 italic text-center py-3">
                                                    Aucune table dans cette zone.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                    {zoneTables.map((table) => (
                                                        <div
                                                            key={table.id}
                                                            className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-center space-y-1 group hover:border-[#FF5722]/40 transition-all"
                                                        >
                                                            <p className="text-sm font-black text-slate-900 dark:text-white">
                                                                #{table.table_number}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-1">
                                                                <Users className="w-3 h-3" />
                                                                {table.capacity} pers.
                                                            </p>
                                                            <div className="flex items-center justify-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => openTableModal(table)}
                                                                    className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirm({ isOpen: true, type: 'table', id: table.id, label: `Table #${table.table_number}` })}
                                                                    className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
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
            )}

            {/* ═══ TAB: Reservations ═══ */}
            {activeTab === 'reservations' && (
                <div className="space-y-6">
                    {/* Date picker */}
                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Date :</label>
                        <input
                            type="date"
                            value={reservationDate}
                            onChange={(e) => setReservationDate(e.target.value)}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setReservationDate(new Date().toISOString().split('T')[0])}
                        >
                            Aujourd&apos;hui
                        </Button>
                    </div>

                    {reservations.length === 0 ? (
                        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center space-y-3">
                            <Calendar className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">Aucune reservation pour cette date</p>
                            <p className="text-xs text-slate-400 dark:text-zinc-500">
                                Selectionnez une autre date ou attendez de nouvelles reservations.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reservations.map((res) => (
                                <div
                                    key={res.id}
                                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900 dark:text-white">
                                                {getTableNumber(res.table_id)}
                                            </span>
                                            <ChevronRight className="w-3 h-3 text-slate-400" />
                                            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                                {getZoneName(res.zone_id)}
                                            </span>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                res.status === 'CONFIRMEE'
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                    : res.status === 'EN_ATTENTE'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse'
                                                    : res.status === 'ANNULEE'
                                                    ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            {res.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-400">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="font-semibold text-slate-900 dark:text-white">{res.reservation_time?.slice(0, 5)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5" />
                                            <span>{res.guest_count} convive{res.guest_count > 1 ? 's' : ''}</span>
                                        </div>
                                        {res.special_requests && (
                                            <p className="text-[11px] italic text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800">
                                                &quot;{res.special_requests}&quot;
                                            </p>
                                        )}
                                    </div>

                                    {res.status === 'EN_ATTENTE' && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <Button
                                                size="sm"
                                                onClick={() => setResAction({ isOpen: true, type: 'confirm', id: res.id })}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Confirmer
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setResAction({ isOpen: true, type: 'cancel', id: res.id })}
                                                className="w-full text-red-600 hover:bg-red-50 text-[11px]"
                                            >
                                                <XCircle className="w-3 h-3 mr-1" />
                                                Refuser
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ MODALS ═══ */}

            {/* Zone Modal */}
            <Modal
                isOpen={zoneModal.isOpen}
                onClose={() => setZoneModal({ isOpen: false })}
                title={zoneModal.editId ? 'Modifier la zone' : 'Nouvelle zone'}
                icon={<MapPin className="w-5 h-5" />}
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Nom de la zone <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Terrasse, VIP, Interieur"
                            value={zoneName}
                            onChange={(e) => setZoneName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {zoneErrors.name && <p className="mt-1 text-[11px] font-semibold text-red-500">{zoneErrors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Description optionnelle de la zone..."
                            value={zoneDescription}
                            onChange={(e) => setZoneDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setZoneModal({ isOpen: false })} className="text-xs">
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveZone}
                            isLoading={zoneSaving}
                            disabled={zoneSaving}
                            className="text-xs"
                        >
                            {zoneModal.editId ? 'Enregistrer' : 'Creer la zone'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Table Modal */}
            <Modal
                isOpen={tableModal.isOpen}
                onClose={() => setTableModal({ isOpen: false })}
                title={tableModal.editId ? 'Modifier la table' : 'Nouvelle table'}
                icon={<LayoutGrid className="w-5 h-5" />}
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Zone <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={tableZoneId}
                            onChange={(e) => setTableZoneId(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        >
                            <option value="">-- Choisir une zone --</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                        {tableErrors.zone_id && <p className="mt-1 text-[11px] font-semibold text-red-500">{tableErrors.zone_id}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Numero de table <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: 1, A1, VIP-01"
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {tableErrors.table_number && <p className="mt-1 text-[11px] font-semibold text-red-500">{tableErrors.table_number}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Capacite max <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="Ex: 4"
                                value={tableCapacity}
                                onChange={(e) => setTableCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                            />
                            {tableErrors.capacity && <p className="mt-1 text-[11px] font-semibold text-red-500">{tableErrors.capacity}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Capacite min
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={tableMinCapacity}
                                onChange={(e) => setTableMinCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setTableModal({ isOpen: false })} className="text-xs">
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveTable}
                            isLoading={tableSaving}
                            disabled={tableSaving}
                            className="text-xs"
                        >
                            {tableModal.editId ? 'Enregistrer' : 'Creer la table'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, type: 'zone', id: null, label: '' })}
                onConfirm={handleDelete}
                title={`Supprimer "${deleteConfirm.label}" ?`}
                message={`Cette action est irreversible. ${deleteConfirm.type === 'zone' ? 'La zone' : 'La table'} sera definitivement supprimee.`}
                confirmLabel="Supprimer"
                variant="danger"
                isLoading={deleteLoading}
            />

            {/* Reservation Action Confirm */}
            <ConfirmDialog
                isOpen={resAction.isOpen}
                onClose={() => setResAction({ isOpen: false, type: 'confirm', id: null })}
                onConfirm={handleReservationAction}
                title={resAction.type === 'confirm' ? 'Confirmer cette reservation ?' : 'Refuser cette reservation ?'}
                message={
                    resAction.type === 'confirm'
                        ? 'La reservation sera validee et le client sera notifie.'
                        : 'La reservation sera annulee et le client sera notifie.'
                }
                confirmLabel={resAction.type === 'confirm' ? 'Confirmer' : 'Refuser'}
                variant={resAction.type === 'cancel' ? 'danger' : 'default'}
                isLoading={resActionLoading}
            />
        </div>
    );
}
