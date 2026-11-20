/**
 * Lot 10b (point 2) : filtres de la recherche des salles, partagés par la page serveur (/halls) et le formulaire client.
 * Module sans « use client » : la page serveur appelle filtersQuery (run 483 : appelée depuis un module client, la page
 * plantait).
 */
export interface HallFilters {
    q: string;
    city: string;
    date: string;
    days: string;
    capacity: string;
    priceMax: string;
    sort: 'recent' | 'price';
}

export const EMPTY_FILTERS: HallFilters = { q: '', city: '', date: '', days: '', capacity: '', priceMax: '', sort: 'recent' };

/** Adresse de recherche (paramètres vides retirés ; la durée n'a de sens qu'avec une date). */
export function filtersQuery(f: HallFilters): string {
    const p = new URLSearchParams();
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.city) p.set('city', f.city);
    if (f.date) {
        p.set('date', f.date);
        if (f.days && f.days !== '1') p.set('days', f.days);
    }
    if (f.capacity.trim()) p.set('capacity', f.capacity.trim());
    if (f.priceMax.trim()) p.set('price_max', f.priceMax.trim());
    if (f.sort === 'price') p.set('sort', 'price');
    return p.toString();
}
