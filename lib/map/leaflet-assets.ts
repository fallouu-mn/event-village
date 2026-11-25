/**
 * Lot Carte B — Leaflet et sa feuille de style pour la carte d'Explorer et l'aperçu de l'accueil, sans morceau de code
 * chargeable de plus.
 *
 *  - Leaflet : `import('leaflet')` à l'ouverture de la carte (morceau déjà existant de la bibliothèque, partagé avec la
 *    carte de la fiche et l'étape Accès ; le calendrier n'en charge rien).
 *  - Feuille de style : copie exacte de leaflet/dist/leaflet.css (1.9.4) servie comme fichier statique
 *    (public/leaflet/leaflet-1.9.4.css, vérifiée identique par tests/schema/carte-b-ecrans.test.ts), ajoutée une fois à la
 *    page. Importer la feuille par webpack ajouterait une entrée à la table des morceaux, chargée par toutes les pages, et
 *    importer le module de la carte de la fiche en créait des variantes (run 613) : budgets JS de toutes les routes.
 */

export const LEAFLET_CSS_HREF = '/leaflet/leaflet-1.9.4.css';

let cssReady: Promise<void> | null = null;

/** Ajoute la feuille de style de Leaflet à la page (une fois) ; se résout quand elle est chargée (ou en échec, journalisé). */
export function ensureLeafletCss(): Promise<void> {
    if (typeof document === 'undefined') return Promise.resolve();
    if (cssReady) return cssReady;
    cssReady = new Promise<void>((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_HREF;
        link.dataset.evLeaflet = '';
        link.onload = () => resolve();
        link.onerror = () => {
            console.warn('[carte] feuille de style de Leaflet indisponible : la carte s’affiche sans elle');
            resolve();
        };
        document.head.appendChild(link);
    });
    return cssReady;
}

/** Leaflet et sa feuille de style, prêts. */
export async function loadLeafletWithCss(): Promise<typeof import('leaflet')> {
    const [mod] = await Promise.all([import('leaflet'), ensureLeafletCss()]);
    const withDefault = mod as unknown as { default?: typeof import('leaflet') };
    return withDefault.default ?? (mod as unknown as typeof import('leaflet'));
}
