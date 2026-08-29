'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { PaymentRealtimeRecord } from '@/lib/realtime/types';
import { EventVillagePaymentStatus } from '@/lib/samirpay/types';

export interface UsePaymentStatusResult {
    payment: PaymentRealtimeRecord | null;
    status: EventVillagePaymentStatus | 'IDLE';
    loading: boolean;
    error: string | null;
    connected: boolean;
    refetch: () => Promise<void>;
}

export function usePaymentStatus(transactionId: string | null): UsePaymentStatusResult {
    const [payment, setPayment] = useState<PaymentRealtimeRecord | null>(null);
    const [status, setStatus] = useState<EventVillagePaymentStatus | 'IDLE'>('IDLE');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isTerminalRef = useRef<boolean>(false);

    // Fonction de récupération initiale et fallback
    const fetchStatus = useCallback(async () => {
        if (!transactionId) return;

        try {
            const res = await fetch(`/api/payments/${encodeURIComponent(transactionId)}/status`);
            if (!res.ok) {
                if (res.status === 404) {
                    setError('Paiement non trouvé');
                }
                return;
            }

            const data = await res.json();
            if (data.success && data.payment) {
                const currentPayment = data.payment as PaymentRealtimeRecord;
                setPayment(currentPayment);
                setStatus(currentPayment.status);

                // Si état terminal, on arrête le polling
                if (['SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED'].includes(currentPayment.status)) {
                    isTerminalRef.current = true;
                    if (pollingTimerRef.current) {
                        clearInterval(pollingTimerRef.current);
                        pollingTimerRef.current = null;
                    }
                }
            }
        } catch (err: unknown) {
            console.warn('[usePaymentStatus] Erreur fetchStatus:', err);
        }
    }, [transactionId]);

    useEffect(() => {
        if (!transactionId) {
            setPayment(null);
            setStatus('IDLE');
            setLoading(false);
            setConnected(false);
            return;
        }

        setLoading(true);
        setError(null);
        isTerminalRef.current = false;

        const supabase = getBrowserClient();

        // 1. Récupération initiale
        fetchStatus().finally(() => setLoading(false));

        // 2. Création de la subscription Supabase Realtime ciblée
        const channelName = `payment-status-${transactionId}-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'payments',
                },
                (payload) => {
                    const updated = payload.new as PaymentRealtimeRecord;
                    // Vérification que l'événement concerne bien cette transaction
                    if (
                        updated.transaction_id === transactionId ||
                        updated.external_order_id === transactionId ||
                        updated.id === transactionId
                    ) {
                        setPayment(updated);
                        setStatus(updated.status);

                        if (['SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED'].includes(updated.status)) {
                            isTerminalRef.current = true;
                            if (pollingTimerRef.current) {
                                clearInterval(pollingTimerRef.current);
                                pollingTimerRef.current = null;
                            }
                        }
                    }
                }
            )
            .subscribe((subscriptionStatus) => {
                if (subscriptionStatus === 'SUBSCRIBED') {
                    setConnected(true);
                } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
                    setConnected(false);
                }
            });

        // 3. Stratégie de fallback polling périodique doux (toutes les 4 secondes)
        // en cas de latence réseau ou retard de Realtime
        pollingTimerRef.current = setInterval(() => {
            if (!isTerminalRef.current) {
                fetchStatus();
            }
        }, 4000);

        // 4. Nettoyage strict au démontage du composant
        return () => {
            if (pollingTimerRef.current) {
                clearInterval(pollingTimerRef.current);
                pollingTimerRef.current = null;
            }
            supabase.removeChannel(channel);
        };
    }, [transactionId, fetchStatus]);

    return {
        payment,
        status,
        loading,
        error,
        connected,
        refetch: fetchStatus,
    };
}
