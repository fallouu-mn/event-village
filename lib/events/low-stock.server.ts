import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot 9 ter (9t.19, contrat D.2.3) — seuil de la tranche « bientôt complet » (réglage access.low_stock_threshold,
 * défaut 10), lu par la fiche publique et par les cartes du catalogue. Même règle que low_stock_threshold() en base
 * (20261102000006_lot5_temps_reel.sql:110-128) : une valeur hors de 1 à 1000 donne le défaut ; une erreur de lecture
 * est levée (jamais remplacée en silence par le défaut).
 */
export const LOW_STOCK_KEY = 'access.low_stock_threshold';
export const LOW_STOCK_DEFAULT = 10;

export async function lowStockThreshold(): Promise<number> {
    const { data, error } = await getServiceRoleClient().from('platform_settings').select('value').eq('key', LOW_STOCK_KEY).maybeSingle();
    if (error) throw new Error(`réglage ${LOW_STOCK_KEY} illisible : ${error.message}`);
    const raw = (data?.value as { value?: unknown } | null | undefined)?.value;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : LOW_STOCK_DEFAULT;
}
