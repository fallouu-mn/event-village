'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ShoppingBag,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Phone,
    User,
    MapPin,
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    Truck,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface OrderItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes: string | null;
}

interface RichOrder {
    id: string;
    order_number: string;
    client_id: string;
    client?: { first_name: string; last_name: string; phone: string } | null;
    subtotal: number;
    delivery_fee: number;
    service_fee: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    delivery_mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE';
    order_status: 'EN_ATTENTE' | 'CONFIRMEE' | 'EN_PREPARATION' | 'PRETE' | 'EN_LIVRAISON' | 'LIVREE' | 'ANNULEE' | 'REJETEE';
    payment_status: 'PENDING' | 'PARTIAL' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    delivery_notes: string | null;
    delivery_address: string | null;
    created_at: string;
    updated_at: string;
    order_items?: OrderItem[];
}

// Valid next statuses for each current status (CDC business rules)
const NEXT_STATUSES: Record<string, { status: string; label: string; variant: 'primary' | 'danger' | 'secondary' }[]> = {
    EN_ATTENTE: [
        { status: 'CONFIRMEE', label: 'Confirmer', variant: 'primary' },
        { status: 'REJETEE', label: 'Rejeter', variant: 'danger' },
    ],
    CONFIRMEE: [
        { status: 'EN_PREPARATION', label: 'Mettre en préparation', variant: 'primary' },
        { status: 'ANNULEE', label: 'Annuler', variant: 'danger' },
    ],
    EN_PREPARATION: [
        { status: 'PRETE', label: 'Marquer prête', variant: 'primary' },
    ],
    PRETE: [
        { status: 'EN_LIVRAISON', label: 'Partir en livraison', variant: 'primary' },
        { status: 'LIVREE', label: 'Marquer livrée', variant: 'secondary' },
    ],
    EN_LIVRAISON: [
        { status: 'LIVREE', label: 'Marquer livrée', variant: 'primary' },
    ],
    LIVREE: [],
    ANNULEE: [],
    REJETEE: [],
};

const STATUS_FILTERS = ['ALL', 'EN_ATTENTE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE', 'ANNULEE'] as const;

const DELIVERY_MODE_LABELS: Record<string, string> = {
    LIVRAISON: 'Livraison',
    RETRAIT: 'Retrait',
    SUR_PLACE: 'Sur place',
};

const DELIVERY_MODE_ICONS: Record<string, React.ElementType> = {
    LIVRAISON: Truck,
    RETRAIT: Package,
    SUR_PLACE: MapPin,
};

export default function PartnerOrdersPage() {
    const { partner } = useAuth();
    const toast = useToast();

    const [orders, setOrders] = useState<RichOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('ALL');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        orderId: string;
        newStatus: string;
        label: string;
        variant: 'danger' | 'warning' | 'default';
    }>({ open: false, orderId: '', newStatus: '', label: '', variant: 'default' });
    const [isUpdating, setIsUpdating] = useState(false);

    const activeFilterRef = useRef(activeFilter);
    activeFilterRef.current = activeFilter;

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = activeFilterRef.current !== 'ALL'
                ? `/api/partner/orders?status=${activeFilterRef.current}`
                : '/api/partner/orders';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setOrders(data.orders || []);
            } else {
                setError(data.error || 'Erreur de chargement.');
            }
        } catch {
            setError('Impossible de charger les commandes.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Realtime subscription
    useEffect(() => {
        if (!partner?.id) return;
        fetchOrders();

        const supabase = getBrowserClient();
        const channel = supabase
            .channel(`partner-orders-page-${partner.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `partner_id=eq.${partner.id}` },
                () => { fetchOrders(); }
            )
            .subscribe((status) => {
                setConnected(status === 'SUBSCRIBED');
            });

        return () => { supabase.removeChannel(channel); };
    }, [partner?.id, fetchOrders]);

    // Re-fetch when filter changes
    useEffect(() => {
        if (partner?.id) fetchOrders();
    }, [activeFilter, partner?.id, fetchOrders]);

    const handleStatusUpdate = async () => {
        if (!confirmDialog.orderId || !confirmDialog.newStatus) return;
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/partner/orders/${confirmDialog.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_status: confirmDialog.newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Statut mis à jour : ${confirmDialog.newStatus.replace(/_/g, ' ')}`);
                setConfirmDialog(prev => ({ ...prev, open: false }));
                fetchOrders();
            } else {
                toast.error(data.error || 'Échec de la mise à jour.');
            }
        } catch {
            toast.error('Erreur réseau.');
        } finally {
            setIsUpdating(false);
        }
    };

    const openConfirm = (orderId: string, newStatus: string, label: string) => {
        const isDanger = ['ANNULEE', 'REJETEE'].includes(newStatus);
        setConfirmDialog({
            open: true,
            orderId,
            newStatus,
            label,
            variant: isDanger ? 'danger' : 'default',
        });
    };

    const filteredOrders = orders;

    const pendingCount = orders.filter(o => o.order_status === 'EN_ATTENTE').length;

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <ShoppingBag className="w-6 h-6 text-[#FF6B35]" />
                            Commandes
                        </h1>
                        {pendingCount > 0 && (
                            <Badge variant="warning" size="sm">{pendingCount} en attente</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        {connected ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Wifi className="w-3 h-3" />
                                Realtime actif
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                            </span>
                        ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                                <WifiOff className="w-3 h-3" />
                                Connexion...
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={fetchOrders}
                    disabled={loading}
                >
                    Actualiser
                </Button>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                            activeFilter === f
                                ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-[#FF6B35]/50'
                        }`}
                    >
                        {f === 'ALL' ? 'Toutes' : f.replace(/_/g, ' ')}
                        {f === 'EN_ATTENTE' && pendingCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {error && <ErrorState description={error} onRetry={fetchOrders} />}

            {!error && !loading && filteredOrders.length === 0 && (
                <EmptyState
                    title="Aucune commande"
                    description="Vous n'avez pas encore reçu de commande pour ce filtre."
                    icon={<ShoppingBag size={28} />}
                />
            )}

            {!error && (loading || filteredOrders.length > 0) && (
                <div className="space-y-3">
                    {loading && orders.length === 0 && (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                            ))}
                        </div>
                    )}

                    {filteredOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        const ModeIcon = DELIVERY_MODE_ICONS[order.delivery_mode] || MapPin;
                        const nextStatuses = NEXT_STATUSES[order.order_status] || [];
                        const clientName = order.client
                            ? `${order.client.first_name} ${order.client.last_name}`
                            : `Client #${order.client_id.slice(0, 8)}`;

                        return (
                            <div
                                key={order.id}
                                className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden"
                            >
                                {/* Order header row */}
                                <button
                                    className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF6B35] flex items-center justify-center flex-shrink-0">
                                            <ModeIcon size={18} />
                                        </div>
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                                    {order.order_number}
                                                </span>
                                                <StatusBadge status={order.order_status} />
                                                <StatusBadge status={order.payment_status} />
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                                                <User className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate font-medium">{clientName}</span>
                                                {order.client?.phone && (
                                                    <>
                                                        <span>·</span>
                                                        <Phone className="w-3 h-3 flex-shrink-0" />
                                                        <span>{order.client.phone}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                                                <Clock className="w-3 h-3" />
                                                {new Date(order.created_at).toLocaleString('fr-FR', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                                <span>·</span>
                                                <span className="font-semibold">{DELIVERY_MODE_LABELS[order.delivery_mode]}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                                        <div className="text-right">
                                            <div className="text-sm font-black text-slate-900 dark:text-white">
                                                {order.total_amount.toLocaleString('fr-FR')} FCFA
                                            </div>
                                            {order.balance_amount > 0 && (
                                                <div className="text-[10px] text-amber-600 font-bold">
                                                    Reste : {order.balance_amount.toLocaleString('fr-FR')} F
                                                </div>
                                            )}
                                        </div>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </div>
                                </button>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                                        {/* Order items */}
                                        {order.order_items && order.order_items.length > 0 && (
                                            <div className="pt-4 space-y-2">
                                                <h4 className="text-[11px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                                    Produits commandés
                                                </h4>
                                                <div className="rounded-xl overflow-hidden border border-slate-100 dark:border-zinc-800">
                                                    {order.order_items.map((item, idx) => (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-center justify-between px-3 py-2.5 text-xs ${
                                                                idx % 2 === 0 ? 'bg-slate-50/70 dark:bg-zinc-800/40' : 'bg-white dark:bg-zinc-900'
                                                            }`}
                                                        >
                                                            <div>
                                                                <span className="font-bold text-slate-900 dark:text-white">
                                                                    {item.product_name}
                                                                </span>
                                                                {item.notes && (
                                                                    <span className="ml-2 text-slate-400 dark:text-zinc-500 italic">
                                                                        ({item.notes})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-right">
                                                                <span className="text-slate-500 dark:text-zinc-400">
                                                                    ×{item.quantity} × {item.unit_price.toLocaleString('fr-FR')} F
                                                                </span>
                                                                <span className="font-black text-slate-900 dark:text-white w-20">
                                                                    {item.total_price.toLocaleString('fr-FR')} F
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center justify-between px-3 py-2.5 bg-orange-50/60 dark:bg-orange-950/20 border-t border-slate-100 dark:border-zinc-800">
                                                        <span className="text-[11px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wide">Total</span>
                                                        <span className="text-sm font-black text-[#FF6B35]">
                                                            {order.total_amount.toLocaleString('fr-FR')} FCFA
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Delivery info */}
                                        {order.delivery_address && (
                                            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-zinc-300">
                                                <MapPin className="w-3.5 h-3.5 text-[#FF6B35] mt-0.5 flex-shrink-0" />
                                                <span>{order.delivery_address}</span>
                                            </div>
                                        )}
                                        {order.delivery_notes && (
                                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
                                                Note : {order.delivery_notes}
                                            </div>
                                        )}

                                        {/* Financial summary */}
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            {[
                                                { label: 'Sous-total', value: order.subtotal },
                                                { label: 'Livraison', value: order.delivery_fee },
                                                { label: 'Payé', value: order.paid_amount },
                                            ].map(item => (
                                                <div key={item.label} className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700">
                                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold uppercase">{item.label}</div>
                                                    <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                                                        {item.value.toLocaleString('fr-FR')} F
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Status action buttons */}
                                        {nextStatuses.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {nextStatuses.map((ns) => (
                                                    <Button
                                                        key={ns.status}
                                                        variant={ns.variant}
                                                        size="sm"
                                                        leftIcon={
                                                            ['ANNULEE', 'REJETEE'].includes(ns.status)
                                                                ? <XCircle className="w-3.5 h-3.5" />
                                                                : <CheckCircle2 className="w-3.5 h-3.5" />
                                                        }
                                                        onClick={() => openConfirm(order.id, ns.status, ns.label)}
                                                    >
                                                        {ns.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirm dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.open}
                onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                onConfirm={handleStatusUpdate}
                title={`${confirmDialog.label} ?`}
                message={`Confirmer la transition vers le statut "${confirmDialog.newStatus.replace(/_/g, ' ')}" pour cette commande.`}
                confirmLabel={confirmDialog.label}
                variant={confirmDialog.variant}
                isLoading={isUpdating}
            />
        </div>
    );
}
