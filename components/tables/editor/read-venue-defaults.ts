/**
 * Lot 11b — réglages réels des tables (tables.*) pour la page serveur de création d'un établissement : durée du créneau
 * par défaut, délai de réponse, frais de service… Lecture par le client du rôle de service (comme les réglages des
 * salles, components/halls/partner/read-policy-texts.ts) ; une valeur illisible devient null et l'écran dit la règle
 * sans chiffre, sans bloquer la page. À n'importer que depuis une page serveur.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { defaultsOf, type VenueDefaults } from './venue-api';

const KEYS: Readonly<Record<keyof VenueDefaults, string>> = {
    slotMinutes: 'tables.slot_minutes',
    responseMinutes: 'tables.response_minutes',
    holdMinutes: 'tables.hold_minutes',
    noShowMinutes: 'tables.no_show_minutes',
    cancelFreeHours: 'tables.cancel_free_hours',
    serviceFeeRate: 'tables.service_fee_rate',
};

export async function readVenueDefaults(): Promise<VenueDefaults> {
    try {
        const { data, error } = await getServiceRoleClient().from('platform_settings').select('key, value').in('key', Object.values(KEYS));
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as { key: string; value: unknown }[];
        const v = (key: string): unknown => (rows.find((r) => r.key === key)?.value as { value?: unknown } | undefined)?.value;
        return defaultsOf({
            slotMinutes: v(KEYS.slotMinutes),
            responseMinutes: v(KEYS.responseMinutes),
            holdMinutes: v(KEYS.holdMinutes),
            noShowMinutes: v(KEYS.noShowMinutes),
            cancelFreeHours: v(KEYS.cancelFreeHours),
            serviceFeeRate: v(KEYS.serviceFeeRate),
        });
    } catch (err) {
        console.error('[tables] réglages des tables illisibles :', err instanceof Error ? err.message : String(err));
        return defaultsOf(null);
    }
}
