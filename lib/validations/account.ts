import { z } from 'zod';
import { toSenegaleseE164 } from '@/lib/validations/auth';

/** Lot 9 (9.2, contrat 4.3) : corps des routes /api/account/*. Tout identifiant du corps est ignoré : le compte vient de la session. */

const nameSchema = (label: string) => z
    .string({ required_error: `${label} requis.`, invalid_type_error: `${label} invalide.` })
    .trim()
    .min(2, `${label} : 2 caractères au moins.`)
    .max(80, `${label} : 80 caractères au plus.`);

/** Une adresse en minuscules, ou vide : email technique du numéro rétabli (L24). Le domaine technique est réservé (D-cpt C3). */
const profileEmailSchema = z
    .string({ required_error: 'Adresse email requise.', invalid_type_error: 'Adresse email invalide.' })
    .trim()
    .toLowerCase()
    .max(254, 'Adresse email trop longue.')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Adresse email invalide.')
    .refine((value) => !value.endsWith('@eventvillage.sn'), 'Cette adresse est réservée. Saisissez votre propre adresse email.');

export const AccountProfileSchema = z.object({
    first_name: nameSchema('Prénom'),
    last_name: nameSchema('Nom'),
    email: profileEmailSchema,
});

/** Numéro sénégalais rendu en +221… */
const newPhoneSchema = z
    .string({ required_error: 'Numéro de téléphone requis.', invalid_type_error: 'Numéro de téléphone invalide.' })
    .trim()
    .refine((value) => toSenegaleseE164(value) !== null, 'Numéro de téléphone sénégalais invalide.')
    .transform((value) => toSenegaleseE164(value) as string);

export const PhoneChangeStartSchema = z.object({ phone: newPhoneSchema });

export const PhoneChangeConfirmSchema = z.object({
    phone: newPhoneSchema,
    code: z
        .string({ required_error: 'Code de vérification requis.', invalid_type_error: 'Code de vérification invalide.' })
        .trim()
        .regex(/^\d{6}$/, 'Le code de vérification comporte 6 chiffres.'),
});
