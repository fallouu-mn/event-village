/**
 * Lot 10b (point 2) : petites aides d'affichage des écrans client des salles. Aucun montant n'est calculé ici : les
 * montants viennent des routes et sont seulement mis en forme (fcfaText de lib/halls/views).
 */
import type { BadgeVariant } from '@/components/ui/Badge';
import type { StatusBannerTone } from '@/components/ui/StatusBanner';

/** Ton d'un état de réservation (`stateTone` de la route) → variante de pastille. */
export function badgeVariantOf(tone: string): BadgeVariant {
    if (tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger') return tone;
    return 'neutral';
}

export function bannerToneOf(tone: string): StatusBannerTone {
    if (tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger') return tone;
    return 'neutral';
}

/** « 1 jour », « 3 jours », « 1 heure », « 5 heures ». */
export function unitsText(mode: 'JOUR' | 'HEURE', units: number): string {
    if (mode === 'HEURE') return units > 1 ? `${units} heures` : '1 heure';
    return units > 1 ? `${units} jours` : '1 jour';
}

/** Nombre avec espaces de milliers : « 1 200 ». */
export function countText(n: number): string {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Première lettre en capitale (« samedi 5 décembre » → « Samedi 5 décembre »). */
export function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
