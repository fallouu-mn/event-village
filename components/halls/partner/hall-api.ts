/**
 * Lot 10b (point 4, écrans de la salle) : types des réponses des routes /api/partner/halls/** et petites aides
 * d'affichage partagées par les écrans de la propriétaire. Aucun montant calculé ici : les montants viennent des routes
 * et ne sont que mis en forme (fcfaText). Les types des réservations et des recettes sont ceux du serveur (import de
 * type seulement, effacé à la compilation).
 */
import type { EarningRow, PartnerReservationView } from '@/lib/halls/queries';
import type { BadgeVariant } from '@/components/ui/Badge';
import { fetchJson } from '@/components/partner/fetch-json';
import { periodText } from '@/lib/halls/views';

export type { EarningRow };

/** Une salle de « Mes salles » (GET /api/partner/halls). */
export interface PartnerHallRow {
    id: string;
    name: string;
    capacity: number | null;
    price_per_day: number | null;
    price_per_hour: number | null;
    city: string | null;
    address: string | null;
    images: string[] | null;
    is_active: boolean;
    validation_status: string;
    validation_reason: string | null;
    updated_at: string;
    statusLabel: string;
    statusTone: string;
    statusHint: string;
    upcomingCount: number;
}

/** Fiche d'une salle lue par sa propriétaire (GET /api/partner/halls/[id]). */
export interface OwnHall {
    id: string;
    name: string;
    description: string | null;
    capacity: number | null;
    price_per_day: number | null;
    price_per_hour: number | null;
    deposit_mode: string | null;
    deposit_value: number | null;
    cancellation_policy: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    city: string | null;
    amenities: string[] | null;
    images: string[] | null;
    is_active: boolean;
    validation_status: string;
    validation_reason: string | null;
    created_at: string;
    updated_at: string;
    has_active_reservations: boolean;
}

/** Réservation vue par la salle (calendrier et détail). */
export type PartnerReservation = PartnerReservationView;
export type PartnerReservationDetail = PartnerReservationView & { canCancel: boolean };

export interface EarningsBody {
    availableTotal: number;
    upcomingTotal: number;
    rows: EarningRow[];
}

/** Clés des trois règles d'annulation (mêmes valeurs que la base). */
export type PolicyKey = 'SOUPLE' | 'MODEREE' | 'STRICTE';
export const POLICY_KEYS: readonly PolicyKey[] = ['SOUPLE', 'MODEREE', 'STRICTE'];

/** Ton d'un état (lib/halls/views.ts) → variante de pastille. */
export function toneVariant(tone: string | null | undefined): BadgeVariant {
    return tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger' ? tone : 'neutral';
}

/** Ton d'un état → ton de bandeau. */
export function toneBanner(tone: string | null | undefined): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
    return tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger' ? tone : 'neutral';
}

/** Période d'une réservation ou d'une ligne de recettes, en mots, avec une majuscule (« Le 5 décembre 2026 »). */
export function periodOf(r: { startDate: string; endDate: string; startTime: string | null; endTime: string | null }): string {
    const text = periodText({ start_date: r.startDate, end_date: r.endDate, start_time: r.startTime, end_time: r.endTime });
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Envoi JSON en PUT (fetch-json ne propose que POST, PATCH et DELETE) ; même traitement des refus. */
export function putJson<T>(url: string, payload: unknown): Promise<T> {
    return fetchJson<T>(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

/** Salle refusée ou suspendue : son motif est affiché. */
export function showsReason(status: string): boolean {
    return status === 'REFUSEE' || status === 'SUSPENDUE';
}
