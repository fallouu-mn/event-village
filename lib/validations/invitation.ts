import { z } from 'zod';
import { toSenegaleseE164 } from './auth';
import { contactInfoMessage, hasContactInfo } from '@/lib/validations/contact-info';

/**
 * Lot 9, tâche 9.0 (contrat 4.1) — corps de POST /api/partner/events/[id]/invitations : une catégorie, 1 à 10 numéros
 * sénégalais distincts une fois normalisés en +221, 1 à 4 billets par numéro. Messages en français, affichés tels
 * quels sous le champ.
 */
export const MAX_INVITATION_PHONES = 10;
export const MAX_INVITATION_QUANTITY = 4;

/** Lot 9 ter (9t.17, contrat C.3.4) : nom de l'invité, facultatif, montré au contrôleur qui consulte la liste. */
export const MAX_GUEST_NAME_LENGTH = 60;

const PHONES_REQUIRED = 'Saisissez au moins un numéro de téléphone.';
const QUANTITY_INVALID = `Choisissez de 1 à ${MAX_INVITATION_QUANTITY} billets par numéro.`;
const GUEST_NAME_TOO_LONG = `Le nom de l’invité ne doit pas dépasser ${MAX_GUEST_NAME_LENGTH} caractères.`;
const GUEST_NAME_FORBIDDEN_CHAR = 'Le nom de l’invité contient un caractère non permis.';
const GUEST_NAMES_MISMATCH = 'Chaque nom d’invité doit correspondre à un numéro.';
/** Caractère de contrôle (Unicode Cc : U+0000 à U+001F, U+007F à U+009F), refusé par la base (tickets_guest_name_chk). */
function hasControlChar(text: string): boolean {
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
    }
    return false;
}

/** Nom d'un invité : espaces ôtés, chaîne vide → null (sans nom), 60 caractères au plus, sans caractère de contrôle. */
const GuestNameSchema = z.string({ required_error: 'Nom de l’invité manquant.', invalid_type_error: 'Nom de l’invité invalide.' })
    .trim()
    .max(MAX_GUEST_NAME_LENGTH, GUEST_NAME_TOO_LONG)
    .refine((name) => !hasControlChar(name), GUEST_NAME_FORBIDDEN_CHAR)
    // Lot 9 quater (D3 : AUD-26) : le nom de l'invité part dans le SMS d'invitation
    .refine((name) => !hasContactInfo(name), contactInfoMessage("Le nom de l'invité"))
    .transform((name) => (name === '' ? null : name))
    .nullable();

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
    // Lot 9 ter (9t.17) : un nom (ou null) par numéro, dans le même ordre ; absent : aucun nom
    guest_names: z.array(GuestNameSchema, { invalid_type_error: GUEST_NAMES_MISMATCH }).optional(),
}).superRefine((input, ctx) => {
    if (input.guest_names !== undefined && Array.isArray(input.phones) && input.guest_names.length !== input.phones.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['guest_names'], message: GUEST_NAMES_MISMATCH });
    }
});

export type CreateInvitationsInput = z.infer<typeof CreateInvitationsSchema>;

/** Corps de PATCH /api/partner/events/[id]/invitations/[ticketId] (9t.17) : `guest_name` null ou vide retire le nom. */
export const UpdateGuestNameSchema = z.object({
    guest_name: GuestNameSchema,
});

export type UpdateGuestNameInput = z.infer<typeof UpdateGuestNameSchema>;
