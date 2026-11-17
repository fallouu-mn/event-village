/**
 * Finition 2a (3) — recherche de lieu de l'étape Accès, faite par le serveur (GET /api/partner/places/search), jamais
 * depuis le navigateur. Module serveur (service_role).
 *
 * Politique d'usage de Nominatim (https://operations.osmfoundation.org/policies/nominatim/), respectée ainsi :
 *  - une requête par seconde au plus, toutes instances de l'application confondues : créneau réservé en base
 *    (public.place_search_slot, espacement de 1,3 s) avant chaque appel ; finition 2b : l'appel attend l'heure de son
 *    créneau et ne part que s'il n'est pas en retard sur lui (150 ms au plus) et qu'au moins une seconde s'est écoulée
 *    depuis le dernier appel de ce processus ; sinon un autre créneau est réservé (waitForCall) ;
 *  - application identifiée : User-Agent « EventVillage/1.0 (+<adresse du site>; <contact>) », contact réglable
 *    (NOMINATIM_CONTACT) ;
 *  - résultats gardés (public.place_search_cache, 30 jours) : une recherche déjà faite ne rappelle pas le service ;
 *  - aucune recherche à la frappe ni de saisie semi-automatique : un appel par appui sur « Rechercher », quota par
 *    compte (PLACE_SEARCHES_PER_ACCOUNT_HOUR) ;
 *  - mention « © contributeurs OpenStreetMap » rendue avec les résultats (licence ODbL des données).
 * Adresse du service réglable (NOMINATIM_URL) : instance publique par défaut, service simulé ou adresse injoignable en CI.
 * Sénégal seulement (countrycodes=sn, puis bornes du pays), 5 résultats au plus.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { inSenegal } from '@/lib/events/senegal-cities';
import { foldText } from '@/lib/text/fold';

export { PLACE_ATTRIBUTION, PLACE_SEARCH_UNAVAILABLE } from './place-texts';
export const PLACE_QUERY_MIN = 3;
export const PLACE_QUERY_MAX = 120;

const CACHE_DAYS = 30;
const MAX_RESULTS = 5;
const REQUEST_TIMEOUT_MS = 6_000;
/** Attente maximale d'un créneau d'appel ; au-delà, la recherche est indisponible (jamais de file d'attente longue). */
const MAX_SLOT_WAIT_MS = 4_000;
/**
 * Finition 2b : retard admis d'un appel sur le début de son créneau. Les créneaux sont espacés de 1,3 s en base : deux
 * appels partis chacun dans les 150 ms de leur créneau sont séparés de 1,15 s au moins, toutes instances confondues.
 */
const SLOT_LATE_MAX_MS = 150;
/** Finition 2b : écart minimal entre deux appels de ce processus, mesuré au moment de l'appel (horloge monotone). */
const MIN_CALL_GAP_MS = 1_000;
let lastCallAt = Number.NEGATIVE_INFINITY;
const LABEL_MAX = 200;

export interface PlaceResult {
    label: string;
    latitude: number;
    longitude: number;
}

/** Service injoignable, en erreur, illisible, ou créneau d'appel trop lointain : la recherche est indisponible. */
export class PlaceSearchUnavailable extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlaceSearchUnavailable';
    }
}

/**
 * Recherche saisie, espaces ramenés à un seul (ce qui est envoyé au service). Correctifs de la contre-vérification de la
 * finition 2a (R1) : caractère nul et caractères de contrôle retirés (C0, suppression, C1 ; tabulation et retours à la
 * ligne deviennent des espaces), ainsi que les caractères invisibles de mise en forme (sens de lecture, largeur nulle) :
 * ils n'ont rien à faire dans un nom de lieu, et le nul empêchait de garder la réponse.
 */
export function normalizePlaceQuery(raw: string): string {
    let out = '';
    for (const ch of raw) {
        const c = ch.codePointAt(0) ?? 0;
        if (c >= 0x09 && c <= 0x0d) out += ' ';
        else if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
        else if ((c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2060 && c <= 0x2069) || c === 0xfeff) continue;
        else out += ch;
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** Clé de la réponse gardée : sans accents ni casse (« Thiès » et « THIES » partagent la même réponse). */
function cacheKey(query: string): string {
    return foldText(query).replace(/\s+/g, ' ').trim().slice(0, 200);
}

function userAgent(): string {
    const env = getServerEnv();
    const site = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    return `EventVillage/1.0 (+${site}${env.NOMINATIM_CONTACT ? `; ${env.NOMINATIM_CONTACT}` : ''})`;
}

async function cachedResults(key: string): Promise<PlaceResult[] | null> {
    const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
    const { data, error } = await getServiceRoleClient()
        .from('place_search_cache').select('results').eq('query_key', key).gte('created_at', since).maybeSingle();
    if (error) {
        console.warn(`[places] réponse gardée illisible (${key}) : ${error.message}`);
        return null;
    }
    return Array.isArray(data?.results) ? (data.results as PlaceResult[]) : null;
}

async function keepResults(key: string, results: PlaceResult[]): Promise<void> {
    const { error } = await getServiceRoleClient()
        .from('place_search_cache').upsert({ query_key: key, results, created_at: new Date().toISOString() }, { onConflict: 'query_key' });
    if (error) console.warn(`[places] réponse non gardée (${key}) : ${error.message}`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * Créneau d'appel réservé en base (une requête par seconde au plus), attente de l'heure du créneau, puis contrôle au
 * moment de l'appel. Finition 2b (run 252 : 801 ms entre deux appels) : la base espaçait les RÉSERVATIONS, pas les
 * appels ; un appel dont la réponse de réservation revenait en retard (charge du serveur) partait tard, trop près du
 * suivant. Désormais :
 *  - le créneau commence, sur l'horloge de ce processus, entre `envoi + attente` et `réception + attente` : l'appel attend
 *    la borne haute (jamais avant son créneau) ;
 *  - au moment de partir, son retard sur le créneau est au plus `maintenant − (envoi + attente)` : au-delà de 150 ms, ou
 *    à moins d'une seconde du dernier appel de ce processus, le créneau est perdu et un autre est réservé (dans les 4 s
 *    d'attente admises ; au-delà, la recherche est indisponible).
 * Le dernier appel est noté avant de rendre la main (aucune attente entre le contrôle et l'appel).
 */
async function waitForCall(): Promise<void> {
    const deadline = performance.now() + MAX_SLOT_WAIT_MS;
    for (;;) {
        const sent = performance.now();
        const { data, error } = await getServiceRoleClient().rpc('place_search_slot', {
            p_max_wait_ms: Math.max(0, Math.floor(deadline - sent)),
        });
        const received = performance.now();
        if (error) throw new PlaceSearchUnavailable(`créneau d'appel illisible : ${error.message}`);
        const slot = data as { ok?: boolean; wait_ms?: number } | null;
        if (slot?.ok !== true) throw new PlaceSearchUnavailable(`trop de recherches en cours (attente de ${slot?.wait_ms ?? '?'} ms)`);
        const wait = Math.max(0, Number(slot.wait_ms ?? 0));
        await sleep(received + wait - performance.now());
        const now = performance.now();
        const late = now - (sent + wait);
        if (late <= SLOT_LATE_MAX_MS && now - lastCallAt >= MIN_CALL_GAP_MS) {
            lastCallAt = now;
            return;
        }
        if (now >= deadline) throw new PlaceSearchUnavailable(`créneau d'appel manqué (retard de ${Math.round(late)} ms)`);
    }
}

function toResults(rows: unknown): PlaceResult[] {
    if (!Array.isArray(rows)) throw new PlaceSearchUnavailable('réponse illisible (liste attendue)');
    const out: PlaceResult[] = [];
    const seen = new Set<string>();
    for (const row of rows as Array<Record<string, unknown>>) {
        const latitude = Number(row?.lat);
        const longitude = Number(row?.lon);
        const label = typeof row?.display_name === 'string' ? row.display_name.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX) : '';
        if (!label || !inSenegal(latitude, longitude)) continue;
        const dedup = `${label}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        out.push({ label, latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 });
        if (out.length === MAX_RESULTS) break;
    }
    return out;
}

/** Lieux au Sénégal (5 au plus) pour une recherche déjà normalisée et bornée (3 à 120 caractères). */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
    const key = cacheKey(query);
    const kept = await cachedResults(key);
    if (kept) return kept;

    const base = getServerEnv().NOMINATIM_URL.replace(/\/+$/, '');
    const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'sn', limit: String(MAX_RESULTS), 'accept-language': 'fr' });
    const url = `${base}/search?${params.toString()}`;
    await waitForCall();
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { 'User-Agent': userAgent(), Accept: 'application/json', 'Accept-Language': 'fr' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            cache: 'no-store',
        });
    } catch (err) {
        throw new PlaceSearchUnavailable(`service injoignable : ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) throw new PlaceSearchUnavailable(`service en erreur (HTTP ${response.status})`);
    let rows: unknown;
    try {
        rows = await response.json();
    } catch {
        throw new PlaceSearchUnavailable('réponse illisible (JSON attendu)');
    }
    const results = toResults(rows);
    await keepResults(key, results);
    return results;
}
