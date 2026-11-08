import { z } from 'zod';
import { toSenegaleseE164 } from './auth';

/**
 * Lot 9, tâche 9.0 (contrat 4.1) — corps de POST /api/partner/events/[id]/invitations : une catégorie, 1 à 10 numéros
 * sénégalais distincts une fois normalisés en +221, 1 à 4 billets par numéro. Messages en français, affichés tels
 * quels sous le champ.
 */
export const MAX_INVITATION_PHONES = 10;
export const MAX_INVITATION_QUANTITY = 4;

const PHONES_REQUIRED = 'Saisissez au moins un numéro de téléphone.';
const QUANTITY_INVALID = `Choisissez de 1 à ${MAX_INVITATION_QUANTITY} billets par numéro.`;

const PhonesSchema = z.array(z.string({ invalid_type_error: 'Numéro de téléphone invalide.' }), {
    required_error: PHONES_REQUIRED,
    invalid_type_error: PHONES_REQUIRED,
})
    .min(1, PHONES_REQUIRED)
    .max(MAX_INVITATION_PHONES, `${MAX_INVITATION_PHONES} numéros au plus par envoi.`)
    .transform((phones, ctx) => {
        const normalized: string[] = [];
        for (let index = 0; index < phones.length; index += 1) {
            const phone = toSenegaleseE164(phones[index]);
            if (!phone) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message: 'Numéro de téléphone sénégalais invalide.' });
                return z.NEVER;
            }
            if (normalized.includes(phone)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message: 'Ce numéro figure deux fois dans la liste.' });
                return z.NEVER;
            }
            normalized.push(phone);
        }
        return normalized;
    });

export const CreateInvitationsSchema = z.object({
    category_id: z.string({ required_error: 'Choisissez une catégorie.', invalid_type_error: 'Choisissez une catégorie.' })
        .uuid('Choisissez une catégorie.'),
    phones: PhonesSchema,
    quantity: z.number({ required_error: QUANTITY_INVALID, invalid_type_error: QUANTITY_INVALID })
        .int(QUANTITY_INVALID)
        .min(1, QUANTITY_INVALID)
        .max(MAX_INVITATION_QUANTITY, QUANTITY_INVALID),
});

export type CreateInvitationsInput = z.infer<typeof CreateInvitationsSchema>;
