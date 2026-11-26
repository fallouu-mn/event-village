/**
 * Lot Carte B3 — repères des lieux sur la carte d'Explorer (HTML pour un `L.divIcon`, styles .ev-repere--salle et
 * .ev-repere--resto de app/globals.css). Module de la carte seulement (chargé à l'ouverture de la vue Carte) : la fiche
 * d'un événement, qui charge components/ui/MapMarker.ts, n'en porte rien.
 *
 * Formes distinctes, pas seulement des couleurs (WCAG 1.4.1) :
 *  - événement : billet à encoches, talon orange (MapMarker.ts) ;
 *  - salle : bâtiment (toit en pointe, angles droits) avec « Dès 150 000 F/jour » ;
 *  - restaurant : pastille ronde avec des couverts et le nom.
 * Icônes dessinées en SVG (aucune police d'icônes), cachées aux lecteurs d'écran : le nom complet du repère est son
 * `aria-label` (placeAccessibleName).
 */
import type { PublicMapPlace } from '@/lib/lieux/carte-lieux';

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const SVG_HEAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

/** Bâtiment (salle). */
export const HALL_ICON_SVG = `${SVG_HEAD}<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/></svg>`;
/** Couverts (restaurant). */
export const RESTO_ICON_SVG = `${SVG_HEAD}<path d="M4 3v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3"/><path d="M7 3v18"/><path d="M20 15V3a4 4 0 0 0-4 4v6a2 2 0 0 0 2 2h2zm0 0v6"/></svg>`;

/** Nom raccourci (20 caractères) pour le repère d'un restaurant ; le nom entier reste dans le nom accessible. */
function shortName(name: string): string {
    const t = name.trim().replace(/\s+/g, ' ');
    return t.length > 20 ? `${t.slice(0, 19).trimEnd()}…` : t;
}

/** « 150 000 F/jour » : prix court du repère d'une salle. */
function hallPrice(price: number | null): string {
    return price !== null ? `Dès ${Math.round(price).toLocaleString('fr-FR')} F/jour` : 'Salle';
}

/** HTML du repère d'un lieu ; `chosen` : touché, survolé ou focalisé (orange de la marque, agrandi). */
export function placeMarkerHtml(p: Pick<PublicMapPlace, 'type' | 'name' | 'price'>, chosen: boolean): string {
    const kind = p.type === 'salle' ? 'salle' : 'resto';
    const classes = ['ev-repere', `ev-repere--${kind}`, chosen ? 'ev-repere--choisi' : ''].filter(Boolean).join(' ');
    const icon = p.type === 'salle' ? HALL_ICON_SVG : RESTO_ICON_SVG;
    const text = escapeHtml(p.type === 'salle' ? hallPrice(p.price) : shortName(p.name));
    return `<span class="${classes}"><span class="ev-repere__billet"><span class="ev-repere__icone">${icon}</span>${text}</span></span>`;
}
