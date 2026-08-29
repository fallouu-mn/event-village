import { EventVillagePaymentStatus } from '@/lib/samirpay/types';

export interface PaymentRealtimeRecord {
    id: string;
    transaction_id: string;
    external_order_id?: string;
    external_transaction_id?: string;
    client_id: string;
    partner_id?: string;
    order_id?: string;
    hall_reservation_id?: string;
    table_reservation_id?: string;
    ticket_id?: string;
    amount: number;
    currency: string;
    status: EventVillagePaymentStatus;
    provider_status?: string;
    paid_at?: string;
    created_at: string;
    updated_at: string;
}

export interface OrderRealtimeRecord {
    id: string;
    order_number: string;
    client_id: string;
    partner_id: string;
    subtotal: number;
    delivery_fee: number;
    service_fee: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    delivery_mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE';
    order_status: 'EN_ATTENTE' | 'CONFIRMEE' | 'EN_PREPARATION' | 'PRETE' | 'EN_LIVRAISON' | 'LIVREE' | 'ANNULEE' | 'REJETEE';
    payment_status: 'PENDING' | 'PARTIAL' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    created_at: string;
    updated_at: string;
}

export interface RealtimeHookState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    connected: boolean;
}
