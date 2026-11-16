/**
 * Finition 2a (1b), correctifs de la contre-vérification (T5) — réencodage d'une image, le même pour la route de dépôt
 * (POST /api/partner/upload) et pour les affiches d'avant la finition (scripts/reencode-posters.ts) : orientation
 * appliquée, réduite à 1 600 px au plus de côté, WebP qualité 82, une seule image (la première d'une image animée) ;
 * sharp ne recopie aucune métadonnée (EXIF et position GPS, XMP, IPTC, profil ICC) : seuls les pixels sont gardés.
 * Module serveur.
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const IMAGE_MAX_SIDE_PX = 1600;
export const IMAGE_WEBP_QUALITY = 82;
/** Image de plus de 40 millions de pixels refusée avant décodage (bombe de décompression). */
export const IMAGE_MAX_INPUT_PIXELS = 40_000_000;

/** Image réencodée (WebP) ; lève si l'image est illisible. */
export async function encodeImage(input: Buffer): Promise<Buffer> {
    return sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: IMAGE_MAX_SIDE_PX, height: IMAGE_MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: IMAGE_WEBP_QUALITY })
        .toBuffer();
}

/** Nom d'un fichier déposé (STORED_IMAGE_NAME_RE, lib/images/stored-name.ts). */
export function storedImageName(now: number = Date.now()): string {
    return `${now}_${randomUUID().slice(0, 8)}.webp`;
}
