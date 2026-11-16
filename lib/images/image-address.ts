/**
 * Correctifs de la contre-vérification de la finition 2a (T6) — le dossier events/ du compartiment public-images est
 * réservé aux affiches des événements : la purge des affiches et l'effacement d'une affiche remplacée y travaillent. Une
 * image de salle, de produit ou du profil (logo, couverture) qui citerait un fichier de ce dossier serait effacée avec
 * l'affiche : ces champs refusent donc une adresse du dossier events/ (salles et produits : HallService, ProductService ;
 * profil : PATCH /api/partner/profile). Les adresses déjà enregistrées restent protégées : la purge et le remplacement
 * lisent aussi ces colonnes (storage_public_citations, migration 20261116000008).
 */
import { PublicError } from '@/lib/api/public-error';

const PUBLIC_MARK = '/storage/v1/object/public/public-images/';

export const POSTER_FOLDER_REFUSED_TEXT = 'Cette image vient du dossier des affiches d’événement : déposez-la depuis cette page.';

/** Vrai si l'adresse désigne un fichier du dossier events/ du compartiment public (segments décodés). */
export function citesPosterFolder(url: unknown): boolean {
    if (typeof url !== 'string') return false;
    const i = url.indexOf(PUBLIC_MARK);
    if (i < 0) return false;
    const first = url.slice(i + PUBLIC_MARK.length).split(/[?#]/)[0].split('/')[0];
    let decoded = first;
    try {
        decoded = decodeURIComponent(first);
    } catch {
        decoded = first;
    }
    return decoded === 'events' || decoded.startsWith('events/');
}

/** Refus (PublicError 400 IMAGE_FOLDER_INVALID) si une des images cite le dossier des affiches. */
export function assertNoPosterFolder(images: unknown): void {
    const list = Array.isArray(images) ? images : images === undefined || images === null ? [] : [images];
    if (list.some(citesPosterFolder)) throw new PublicError(POSTER_FOLDER_REFUSED_TEXT, 'IMAGE_FOLDER_INVALID', 400);
}
