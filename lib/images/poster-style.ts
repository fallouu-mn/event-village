/**
 * Design 1d (point 1) — style d'une affiche, calculé une fois au dépôt (POST /api/partner/upload), au réencodage des
 * anciennes affiches (lib/events/poster-reencode.ts) et par le script des affiches existantes (scripts/poster-styles.ts) :
 *  - `color` : couleur dominante de l'affiche (histogramme de sharp, `stats().dominant`), assombrie jusqu'à un contraste
 *    d'au moins 4,5:1 avec du texte blanc (on vise 4,6:1 pour garder une marge après arrondi) ; format « #rrggbb » ;
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
    rgbToHex,
} from '@/lib/events/poster-color';

export interface PosterStyle {
    color: string;
    blur: string;
}

/** Style d'une affiche (image déjà réencodée ou non) ; lève si l'image est illisible. */
export async function computePosterStyle(input: Buffer): Promise<PosterStyle> {
    const base = sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS }).rotate().flatten({ background: '#ffffff' });
    const { dominant } = await base.clone().resize({ width: 96, height: 96, fit: 'inside' }).stats();
    const color = rgbToHex(darkenForWhiteText(dominant));
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
