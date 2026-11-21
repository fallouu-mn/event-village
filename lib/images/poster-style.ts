/**
 * Design 1d (point 1) — style d'une affiche, calculé une fois au dépôt (POST /api/partner/upload), au réencodage des
 * anciennes affiches (lib/events/poster-reencode.ts) et par le script des affiches existantes (scripts/poster-styles.ts) :
 *  - `color` : design 1e, couleur VIVE de l'affiche (pickPosterColor : vive, sinon sourde, gris seulement sans couleur ;
 *    avant : la dominante de sharp, qui tombait souvent sur un fond clair), assombrie jusqu'à un contraste d'au moins
 *    4,5:1 avec du texte blanc (on vise 4,6:1 pour garder une marge après arrondi) ; format « #rrggbb » ;
 *  - `blur` : petite image (24 px de côté au plus) déjà floutée, WebP, en adresse `data:` : le fond de la fiche
 *    l'agrandit (le navigateur lisse l'agrandissement) ; aucun flou CSS coûteux.
 * Sans affiche ou si l'image est illisible : rien n'est calculé, l'écran prend le jeton « bleu nuit »
 * (--poster-fallback, POSTER_FALLBACK_COLOR). Partie sans dépendance : lib/events/poster-color.ts. Module serveur (sharp).
 */
import sharp from 'sharp';
import { IMAGE_MAX_INPUT_PIXELS } from '@/lib/images/encode-image';
import {
    POSTER_BLUR_MAX_LENGTH,
    POSTER_BLUR_MAX_SIDE,
    POSTER_BLUR_PREFIX,
    darkenForWhiteText,
    pickPosterColor,
    rgbToHex,
} from '@/lib/events/poster-color';

export interface PosterStyle {
    color: string;
    blur: string;
}

/** Style d'une affiche (image déjà réencodée ou non) ; lève si l'image est illisible. */
export async function computePosterStyle(input: Buffer): Promise<PosterStyle> {
    const base = sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS }).rotate().flatten({ background: '#ffffff' });
    // Pixels d'une vignette de 64 px au plus (4 096 pixels) : assez pour la palette, rapide au dépôt
    const { data } = await base.clone().resize({ width: 64, height: 64, fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const color = rgbToHex(darkenForWhiteText(pickPosterColor(new Uint8Array(data.buffer, data.byteOffset, data.length))));
    let blur = '';
    for (const quality of [50, 35, 20, 10]) {
        const small = await base.clone()
            .resize({ width: POSTER_BLUR_MAX_SIDE, height: POSTER_BLUR_MAX_SIDE, fit: 'inside' })
            .blur(1.2)
            .webp({ quality })
            .toBuffer();
        blur = `${POSTER_BLUR_PREFIX}${small.toString('base64')}`;
        if (blur.length <= POSTER_BLUR_MAX_LENGTH) return { color, blur };
    }
    throw new Error(`image floutée trop lourde (${blur.length} caractères)`);
}
