/**
 * Design 1d (point 5) — données de l'image d'aperçu de partage, tirées de la fiche publique (aucune donnée de plus).
 * Module serveur (la fiche publique est lue par lib/events/event-detail.server.ts).
 */
import type { PublicEventDetail } from '@/lib/events/event-detail';
import type { SharePreviewData } from '@/lib/og/event-preview.server';
import { hasSharePreview, sharePreviewPath, sharePreviewVersion, sharePriceLabel } from '@/lib/events/share-preview';

export { hasSharePreview, sharePreviewPath };

function capitalize(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Prix d'appel : catégories vendues en ligne qui ont encore des places. */
function previewPrice(event: PublicEventDetail): string | null {
    return sharePriceLabel(event.categories.filter((c) => !c.isSoldOut).map((c) => c.price));
}

export function sharePreviewData(event: PublicEventDetail): SharePreviewData {
    return {
        title: event.title,
        when: `${capitalize(event.dateFormatted)} · ${event.time}`,
        place: [event.venue, event.city].filter(Boolean).join(' · '),
        price: previewPrice(event),
        posterUrl: event.posterUrl,
        posterColor: event.posterColor,
    };
}

/** Version de l'image d'un événement (change avec ce qu'elle montre). */
export function sharePreviewVersionOf(event: PublicEventDetail): string {
    const d = sharePreviewData(event);
    return sharePreviewVersion(['v1', d.title, d.when, d.place, d.price, d.posterUrl, d.posterColor]);
}

/** Image générique du site (logo Bras levés), la seule permise pour un événement non publié. */
export const SITE_SHARE_IMAGE = { url: '/images/og-image.png', width: 1200, height: 630, alt: 'Event Village' } as const;

/**
 * Images de partage de la fiche (métadonnées Open Graph et Twitter) : l'aperçu généré pour un événement PUBLIÉ ;
 * l'image générique du site pour un événement suspendu, annulé ou terminé (aucune image propre à l'événement).
 */
export function shareImagesFor(event: PublicEventDetail): Array<{ url: string; width: number; height: number; alt: string }> {
    if (!hasSharePreview(event.status)) return [{ ...SITE_SHARE_IMAGE }];
    return [{
        url: sharePreviewPath(event.id, sharePreviewVersionOf(event)),
        width: 1200,
        height: 630,
        alt: `${event.title} — billets sur Event Village`,
    }];
}
