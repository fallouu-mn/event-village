/**
 * Lot 7 (7.3, contrat 3.4, D55 à D57) — interrupteurs SUPERADMIN des services hors billetterie.
 *
 *  - features.halls_enabled  : salles de fête (catalogue, réservation, espace partenaire) ;
 *  - features.tables_enabled : réservation de tables (zones, tables, réservations) ;
 *  - features.orders_enabled : commandes de repas (produits, menu, commandes).
 *
 * Valeurs dans platform_settings ({"value": true|false}, défaut false, migration 20261105000001), écrites par
 * le SUPERADMIN seul (finance_setting_set). Lecture serveur en service_role à CHAQUE appel (aucun cache de
 * processus) : une bascule est visible dès la requête suivante. Une clé absente ou une valeur non booléenne
 * vaut false (service fermé) et produit un avertissement, une fois par processus et par clé. Une erreur de
 * lecture de la base est levée (FeatureFlagsUnavailableError) : jamais de repli silencieux.
 *
 * Fermé : pages en 404 (layouts de garde, notFound()), routes en 404 { error: 'Page introuvable.',
 * code: 'NOT_FOUND' } (featureNotFound). Le code et les données ne sont jamais supprimés.
 * Ordre (D56) : routes protégées = session, puis interrupteur ; GET publics = interrupteur d'abord.
 * Ne sont jamais coupés : webhook, statut et annulation de paiement, cron, supervision admin, statistiques et
 * tableau de bord partenaire (un paiement de service déjà en cours doit pouvoir se confirmer ou se rembourser).
 */
import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const FEATURE_SETTING_KEYS = {
    halls: 'features.halls_enabled',
    tables: 'features.tables_enabled',
    orders: 'features.orders_enabled',
} as const;

export type Feature = keyof typeof FEATURE_SETTING_KEYS;
export type FeatureFlags = Record<Feature, boolean>;

export const FEATURES: readonly Feature[] = ['halls', 'tables', 'orders'];

/** Lecture des interrupteurs impossible (base injoignable, erreur PostgREST). */
export class FeatureFlagsUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FeatureFlagsUnavailableError';
    }
}

const WARNED = Symbol.for('event-village.feature-flags-warned');
type ProcessFlags = typeof globalThis & { [WARNED]?: Set<string> };

function warnOnce(key: string, detail: string): void {
    const g = globalThis as ProcessFlags;
    const warned = g[WARNED] ?? (g[WARNED] = new Set<string>());
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[features] réglage ${key} ${detail} : service considéré comme désactivé.`);
}

/** Lit les trois interrupteurs en une requête. Lève FeatureFlagsUnavailableError si la base ne répond pas. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
    const keys = FEATURES.map((f) => FEATURE_SETTING_KEYS[f]);
    const { data, error } = await getServiceRoleClient()
        .from('platform_settings')
        .select('key, value')
        .in('key', keys);
    if (error) {
        throw new FeatureFlagsUnavailableError(`lecture des interrupteurs features.* impossible : ${error.message}`);
    }
    const byKey = new Map((data ?? []).map((row) => [String(row.key), row.value as unknown]));
    const flags: FeatureFlags = { halls: false, tables: false, orders: false };
    for (const feature of FEATURES) {
        const key = FEATURE_SETTING_KEYS[feature];
        if (!byKey.has(key)) {
            warnOnce(key, 'absent de platform_settings');
            continue;
        }
        const raw = byKey.get(key);
        const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { value?: unknown }).value : undefined;
        if (typeof value !== 'boolean') {
            warnOnce(key, `de valeur non booléenne (${JSON.stringify(raw)})`);
            continue;
        }
        flags[feature] = value;
    }
    return flags;
}

/**
 * Réponse 404 d'un service désactivé. Le corps est le même pour les trois interrupteurs (rien n'est révélé
 * sur le service) : le paramètre ne sert qu'à la lisibilité des appels.
 */
export function featureNotFound(_feature: Feature): NextResponse {
    return NextResponse.json({ error: 'Page introuvable.', code: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

/** Réponse 503 quand les interrupteurs ne peuvent pas être lus (erreur journalisée par l'appelant). */
export function featuresUnavailable(): NextResponse {
    return NextResponse.json(
        { error: 'Service momentanément indisponible. Réessayez dans un instant.', code: 'FEATURES_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
}

/**
 * Garde d'une route de service : null si le service est ouvert ; sinon la réponse à renvoyer telle quelle
 * (404 featureNotFound si l'interrupteur est fermé, 503 journalisé si la lecture échoue).
 * `features` : le service est ouvert si AU MOINS UN des interrupteurs donnés l'est (cas de /api/orders).
 */
export async function guardFeature(features: Feature | readonly Feature[], where: string): Promise<NextResponse | null> {
    const list: readonly Feature[] = typeof features === 'string' ? [features] : features;
    let flags: FeatureFlags;
    try {
        flags = await getFeatureFlags();
    } catch (err) {
        console.error(`[features] ${where} : ${err instanceof Error ? err.message : String(err)}`);
        return featuresUnavailable();
    }
    if (list.some((f) => flags[f])) return null;
    return featureNotFound(list[0]);
}
