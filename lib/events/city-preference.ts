/**
 * Lot 9 (9.1, L22) — ville du visiteur, gardée sur l'appareil sous la clé `ev-city`. Un compte connecté utilise son
 * profil et n'écrit jamais ici (appareil partagé). À lire dans un effet : rien n'est disponible au rendu serveur.
 * Le stockage peut être refusé (navigation privée, quota) : aucun appel ne lève, l'incident est journalisé.
 */
const CITY_KEY = 'ev-city';

export function readLocalCity(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const city = window.localStorage.getItem(CITY_KEY)?.trim();
        return city && city.length >= 2 && city.length <= 80 ? city : null;
    } catch (err) {
        console.warn('[city-preference] lecture impossible :', err instanceof Error ? err.message : String(err));
        return null;
    }
}

export function writeLocalCity(city: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(CITY_KEY, city);
    } catch (err) {
        console.warn('[city-preference] écriture impossible :', err instanceof Error ? err.message : String(err));
    }
}
