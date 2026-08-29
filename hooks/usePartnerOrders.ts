'use client';

import { useEffect, useState, useCallback } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { OrderRealtimeRecord } from '@/lib/realtime/types';

export interface UsePartnerOrdersResult {
    orders: OrderRealtimeRecord[];
    loading: boolean;
    error: string | null;
    connected: boolean;
    refetch: () => Promise<void>;
}

export function usePartnerOrders(partnerId: string | null): UsePartnerOrdersResult {
    const [orders, setOrders] = useState<OrderRealtimeRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    const fetchOrders = useCallback(async () => {
        if (!partnerId) {
            setOrders([]);
            setLoading(false);
            return;
        }

        try {
            const supabase = getBrowserClient();
            if (!supabase) return;
            
            const { data, error: fetchErr } = await supabase
                .from('orders')
                .select('*')
                .eq('partner_id', partnerId)
                .order('created_at', { ascending: false });

            if (fetchErr) {
                setError(fetchErr.message);
            } else if (data) {
                setOrders(data as OrderRealtimeRecord[]);
            }
        } catch {
            setError('Mode déconnecté / local');
        } finally {
            setLoading(false);
        }
    }, [partnerId]);

    useEffect(() => {
        if (!partnerId) {
            setOrders([]);
            setLoading(false);
            setConnected(false);
            return;
        }

        fetchOrders();

        const supabase = getBrowserClient();
        const channelName = `partner-orders-${partnerId}-${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                    filter: `partner_id=eq.${partnerId}`,
                },
                (payload) => {
                    const newOrder = payload.new as OrderRealtimeRecord;
                    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `partner_id=eq.${partnerId}`,
                },
                (payload) => {
                    const updatedOrder = payload.new as OrderRealtimeRecord;
                    setOrders((prev) =>
                        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'orders',
                    filter: `partner_id=eq.${partnerId}`,
                },
                (payload) => {
                    const oldOrder = payload.old as { id: string };
                    setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    setConnected(false);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [partnerId, fetchOrders]);

    return {
        orders,
        loading,
        error,
        connected,
        refetch: fetchOrders,
    };
}
