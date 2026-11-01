/**
 * Lot 5 (tâches 5.3 et 5.6) — source des affiches affichées par les écrans publics.
 *
 * Une affiche ne vient que du stockage public du projet Supabase (contrat F1 : bucket public-images),
 * seul hôte autorisé par next.config.mjs (images.remotePatterns). Une URL d'un autre hôte (données
 * anciennes, banque d'images) n'est jamais chargée : l'écran affiche l'image locale neutre, sans
 * dépendre d'un service tiers.
 */

/** Image locale neutre (public/images/event-placeholder.svg), servie sans optimisation (SVG). */
export const EVENT_IMAGE_PLACEHOLDER = '/images/event-placeholder.svg';

const STORAGE_PATH = '/storage/v1/object/public/';

function projectStoragePrefix(): string | null {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    return base ? `${base}${STORAGE_PATH}` : null;
}

/** Vrai si l'URL est une image du stockage public du projet (même protocole, hôte et port). */
export function isProjectStorageImage(url: string | null | undefined): url is string {
    if (!url) return false;
    const prefix = projectStoragePrefix();
    return prefix !== null && url.startsWith(prefix) && !url.slice(prefix.length).split('/').includes('..');
}

/** Source à passer à next/image : l'affiche du projet, sinon l'image locale neutre. */
export function eventImageSrc(url: string | null | undefined): string {
    return isProjectStorageImage(url) ? url : EVENT_IMAGE_PLACEHOLDER;
}
