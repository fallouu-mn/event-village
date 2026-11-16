/**
 * Finition 2b (C, E-24) — ce qui manque pour envoyer un événement à la validation, avant de l'envoyer. Mêmes règles et
 * mêmes textes que la base à la soumission (event_transition, BROUILLON → EN_ATTENTE : 20261116000003_f2a_carte.sql) :
 *  - affiche absente ;
 *  - repère du lieu absent (latitude ou longitude) ;
 *  - aucune catégorie de billets active ;
 *  - début passé (heure de Dakar) ;
 *  - période de vente d'une catégorie active qui dépasse la fin retenue de l'événement (début de vente à la fin ou après,
 *    fin de vente après la fin).
 * L'écran « Vérifier avant d'envoyer » les liste, chacun avec son étape ; la base reste seule juge à l'envoi. La parité
 * avec la base est vérifiée par tests/parcours/f2b-verifier-envoyer.test.ts.
 */
import { eventEndAt } from './event-end';
import { dakarInstant, parseSaleDateTime } from '@/lib/validations/event';

export type SubmissionStep = 'infos' | 'acces' | 'billetterie';

export interface MissingItem {
    /** Champ de la base (même nom que `missing[].field` du refus de event_transition). */
    field: 'image_url' | 'latitude' | 'ticket_categories' | 'start_date';
    /** Étape du formulaire où le corriger. */
    step: SubmissionStep;
    message: string;
}

export interface SubmissionInput {
    image_url: string | null;
    latitude: number | null;
    longitude: number | null;
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
    categories: ReadonlyArray<{ name: string; is_active: boolean; sale_start: string | null; sale_end: string | null }>;
    /** Instant de référence (défaut : maintenant). */
    now?: Date;
}

/** Instant d'une date de vente (ISO avec fuseau, ou saisie « AAAA-MM-JJTHH:mm » à l'heure de Dakar) ; null si illisible. */
function saleInstant(value: string | null): number | null {
    if (!value) return null;
    const iso = parseSaleDateTime(value) ?? value;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
}

export function submissionMissing(input: SubmissionInput): MissingItem[] {
    const out: MissingItem[] = [];
    if (!input.image_url || input.image_url.trim() === '') {
        // Texte de la base tel quel (apostrophe droite : 'Ajoutez une affiche à l''événement.')
        out.push({ field: 'image_url', step: 'infos', message: 'Ajoutez une affiche à l\'événement.' });
    }
    if (input.latitude === null || input.longitude === null) {
        out.push({ field: 'latitude', step: 'acces', message: 'Placez le repère du lieu sur la carte (étape Accès).' });
    }
    const active = input.categories.filter((c) => c.is_active);
    if (active.length === 0) {
        out.push({ field: 'ticket_categories', step: 'billetterie', message: 'Ajoutez au moins une catégorie de billets active.' });
    }
    const now = (input.now ?? new Date()).getTime();
    const datesReadable = /^\d{4}-\d{2}-\d{2}$/.test(input.start_date) && /^\d{2}:\d{2}/.test(input.start_time);
    if (datesReadable && dakarInstant(input.start_date, input.start_time) <= now) {
        out.push({ field: 'start_date', step: 'infos', message: 'La date de début est passée : changez-la avant de soumettre.' });
    }
    if (datesReadable) {
        const end = eventEndAt({ start_date: input.start_date, start_time: input.start_time, end_date: input.end_date, end_time: input.end_time }).getTime();
        const late = active
            .filter((c) => {
                const start = saleInstant(c.sale_start);
                const stop = saleInstant(c.sale_end);
                return (start !== null && start >= end) || (stop !== null && stop > end);
            })
            .map((c) => c.name)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        for (const name of late) {
            out.push({ field: 'ticket_categories', step: 'billetterie', message: `La période de vente de « ${name} » dépasse la fin de l’événement.` });
        }
    }
    return out;
}
