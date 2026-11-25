/**
 * Lot Carte B (B1) — fond de carte de toutes les cartes Leaflet (Explorer, aperçu de l'accueil, fiche, étape Accès de la
 * création d'un événement).
 *
 * Décision du client (21/11) : Stadia Maps, tuiles raster, styles « Alidade Smooth » (clair) et « Alidade Smooth Dark »
 * (sombre). Authentification PAR DOMAINE, déclarée dans le tableau de bord de Stadia : AUCUNE clé dans le code du
 * navigateur. Sur localhost, Stadia sert sans clé (volume limité) pour la recette.
 *
 * Réglages (construction de l'application, variables publiques) :
 *  - NEXT_PUBLIC_MAP_TILE_URL : adresse des tuiles du thème clair (`{z}`, `{x}`, `{y}`, `{r}` facultatif) ;
 *  - NEXT_PUBLIC_MAP_TILE_URL_DARK : adresse du thème sombre (défaut : celle du clair si NEXT_PUBLIC_MAP_TILE_URL est
 *    donnée, sinon Alidade Smooth Dark) ;
 *  - NEXT_PUBLIC_MAP_TILE_ATTRIBUTION : mention affichée (défaut : la mention exigée par Stadia).
 * La politique de sécurité du contenu (next.config.mjs) n'autorise que l'hôte de ces adresses pour les images.
 */

export const STADIA_LIGHT_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';
export const STADIA_DARK_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

/** Mention exigée par Stadia : Stadia Maps, OpenMapTiles, contributeurs OpenStreetMap (liens vers leurs pages). */
export const STADIA_ATTRIBUTION = '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> '
    + '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> '
    + '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">contributeurs OpenStreetMap</a>';

export type MapTheme = 'light' | 'dark';

export interface TileConfig {
    url: string;
    attribution: string;
    /** Zoom maximal servi (Stadia : 20). */
    maxZoom: number;
}

function clean(value: string | undefined): string {
    return (value ?? '').trim();
}

/**
 * Fond de carte du thème. Les variables NEXT_PUBLIC_* sont remplacées par leur valeur à la construction (process.env
 * lu en toutes lettres, sinon Next ne les remplace pas).
 */
export function tileConfig(theme: MapTheme): TileConfig {
    const light = clean(process.env.NEXT_PUBLIC_MAP_TILE_URL);
    const dark = clean(process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK);
    const attribution = clean(process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) || STADIA_ATTRIBUTION;
    const url = theme === 'dark' ? (dark || light || STADIA_DARK_URL) : (light || STADIA_LIGHT_URL);
    return { url, attribution, maxZoom: 20 };
}

/** Origines (protocole et hôte) des tuiles des deux thèmes, pour la politique de sécurité du contenu. */
export function tileOrigins(env: { light?: string; dark?: string } = {
    light: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    dark: process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK,
}): string[] {
    const light = clean(env.light);
    const dark = clean(env.dark);
    const urls = [light || STADIA_LIGHT_URL, dark || light || STADIA_DARK_URL];
    const out = new Set<string>();
    for (const u of urls) {
        // Sous-domaines « {s} » de Leaflet : a, b et c
        for (const sub of u.includes('{s}') ? ['a', 'b', 'c'] : ['']) {
            try {
                out.add(new URL(u.replace(/\{s\}/g, sub).replace(/\{[a-z]+\}/g, '0')).origin);
            } catch (err) {
                console.warn(`[carte] adresse des tuiles illisible, aucune origine autorisée : ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
    return Array.from(out);
}
