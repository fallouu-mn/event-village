import { z } from 'zod';
import { TECHNICAL_EMAIL_RE } from '@/lib/notifications/channels';

/** Lot 9 bis (B100) : refus d'une adresse du domaine technique, à l'inscription comme au profil. */
export const RESERVED_EMAIL_MESSAGE = 'Cette adresse est réservée. Saisissez votre propre adresse email.';

/** Lot 9 bis (R76, glossaire) : un seul texte pour un numéro invalide, importé par les écrans et les routes. */
export const INVALID_SN_PHONE_MESSAGE = 'Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67.';

/**
 * Normalise un numéro de téléphone sénégalais vers le format E.164 (+221XXXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.startsWith('+221')) {
        return cleaned;
    }
    if (cleaned.startsWith('221') && cleaned.length === 12) {
        return `+${cleaned}`;
    }
    if (cleaned.startsWith('00221') && cleaned.length === 14) {
        return `+${cleaned.substring(2)}`;
    }
    if (/^[7][05678]\d{7}$/.test(cleaned)) {
        return `+221${cleaned}`;
    }
    return cleaned;
}

const SENEGAL_MOBILE_E164 = /^\+221[7][05678]\d{7}$/;

/**
 * Lot 1C.1 — numéro mobile sénégalais au format E.164 (+221XXXXXXXXX), ou null si la saisie
 * n'en est pas un. À utiliser avant toute recherche de compte par téléphone.
 */
export function toSenegaleseE164(phone: string): string | null {
    const normalized = normalizePhoneNumber(phone.trim());
    return SENEGAL_MOBILE_E164.test(normalized) ? normalized : null;
}

/** Lot 9 ter (R96, D-R96-2) : refus d'un téléphone de contact d'événement (mobile ou fixe sénégalais). */
export const INVALID_SN_CONTACT_PHONE_MESSAGE = 'Numéro sénégalais invalide. Exemple : 77 123 45 67 ou 33 821 00 00.';

/** Neuf chiffres d'un numéro sénégalais de contact : mobiles 70, 75, 76, 77, 78 et fixes 30, 33. */
const SENEGAL_CONTACT_DIGITS = /^(?:7[05678]|3[03])\d{7}$/;

/**
 * Lot 9 ter (R96) — téléphone de contact d'un événement (mobile ou fixe sénégalais) au format E.164
 * (+221XXXXXXXXX), ou null si la saisie n'en est pas un. Préfixes +221, 00221 et 221 acceptés, ainsi que les
 * espaces, points, tirets et parenthèses.
 */
export function toSenegaleseContactE164(phone: string): string | null {
    let digits = phone.trim().replace(/[\s\-().]/g, '');
    if (digits.startsWith('+221')) digits = digits.slice(4);
    else if (digits.startsWith('00221')) digits = digits.slice(5);
    else if (digits.startsWith('221') && digits.length === 12) digits = digits.slice(3);
    return SENEGAL_CONTACT_DIGITS.test(digits) ? `+221${digits}` : null;
}

/**
 * Lot 9 ter (R96) — affichage d'un numéro sénégalais de contact : « 77 123 45 67 » ; null si la valeur n'est pas un
 * numéro sénégalais reconnu (une ancienne saisie libre s'affiche alors telle quelle).
 */
export function formatSnPhone(phone: string): string | null {
    const e164 = toSenegaleseContactE164(phone);
    if (!e164) return null;
    const d = e164.slice(4);
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/**
 * Formes sous lesquelles un même numéro E.164 est stocké en base : « +221… » (routes serveur)
 * et « 221… » (copie de auth.users.phone par le trigger d'inscription). Égalité exacte uniquement.
 */
export function phoneStorageForms(e164: string): string[] {
    return [e164, e164.replace(/^\+/, '')];
}

/**
 * Validateur de numéro de téléphone sénégalais (Orange, Wave/Free, Expresso, Promobile)
 */
export const SenegalesePhoneSchema = z.string().refine((val) => {
    const normalized = normalizePhoneNumber(val);
    return /^\+221[7][05678]\d{7}$/.test(normalized);
}, {
    message: INVALID_SN_PHONE_MESSAGE,
});

/**
 * Politique de mot de passe unique — appliquée à TOUS les flux (inscription, reset, admin)
 * 8+ caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
 */
export const StrongPasswordSchema = z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial (!@#$...)');

/**
 * Schéma de Connexion (Email ou Téléphone + Mot de passe ou OTP)
 */
export const LoginSchema = z.object({
    identifier: z.string().min(3, 'Veuillez saisir votre email ou numéro de téléphone'),
    password: z.string().min(1, 'Le mot de passe est requis').optional(),
    isOtpLogin: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Schéma d'Inscription Client (CDC V3)
 */
export const RegisterClientSchema = z.object({
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    phone: SenegalesePhoneSchema,
    email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
    password: StrongPasswordSchema,
    confirmPassword: z.string().min(8, 'Veuillez confirmer votre mot de passe'),
    referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export type RegisterClientInput = z.infer<typeof RegisterClientSchema>;

/**
 * Lot 7 (7.3, D1, contrat 3.6) — inscription « numéro d'abord », étape 1 : le numéro seul
 * (POST /api/auth/register/start : code REGISTER envoyé, aucun compte créé).
 */
export const RegisterStartSchema = z.object({
    phone: SenegalesePhoneSchema,
});

export type RegisterStartInput = z.infer<typeof RegisterStartSchema>;

/**
 * Lot 7 (7.3, D1, contrat 3.6) — étape 2 : code reçu par SMS et profil (POST /api/auth/register). Le code
 * est vérifié et consommé AVANT la création du compte. Aucune confirmation du mot de passe exigée (l'écran
 * affiche le mot de passe sur demande). `code` est facultatif dans le schéma : son absence a son propre refus
 * (REGISTRATION_CODE_REQUIRED), après la validation du reste du profil (aucun essai consommé).
 */
export const RegisterWithCodeSchema = z.object({
    phone: SenegalesePhoneSchema,
    code: z.string().trim().optional(),
    firstName: z.string().trim().min(2, 'Le prénom doit contenir au moins 2 caractères').max(80, 'Le prénom est trop long'),
    lastName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(80, 'Le nom est trop long'),
    // Lot 9 bis (B100, G53-7) : le domaine technique eventvillage.sn et ses sous-domaines sont réservés (sinon un compte
    // prendrait l'adresse technique d'un autre numéro).
    email: z.string().trim().email('Adresse email invalide')
        .refine((value) => !TECHNICAL_EMAIL_RE.test(value), RESERVED_EMAIL_MESSAGE)
        .optional().or(z.literal('')),
    password: StrongPasswordSchema,
    referralCode: z.string().trim().max(64, 'Code de parrainage invalide').optional(),
});

export type RegisterWithCodeInput = z.infer<typeof RegisterWithCodeSchema>;

/**
 * Schéma de Vérification OTP
 */
export const VerifyOtpSchema = z.object({
    phone: SenegalesePhoneSchema,
    token: z.string().length(6, 'Le code OTP doit comporter exactement 6 chiffres'),
    type: z.enum(['sms', 'signup', 'recovery', 'magiclink']).default('sms'),
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

/**
 * Schéma de Demande de Récupération de Mot de Passe
 */
export const ForgotPasswordSchema = z.object({
    identifier: z.string().min(3, 'Veuillez saisir votre email ou numéro de téléphone'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

/**
 * Schéma de Réinitialisation de Mot de Passe — Niveau Bancaire
 * Exige : 8+ caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
 */
export const ResetPasswordSchema = z.object({
    password: StrongPasswordSchema,
    confirmPassword: z.string().min(8, 'Veuillez confirmer le mot de passe'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

/**
 * Types d'activités pour partenaires multi-activités
 */
export const PartnerActivityTypes = [
    'RESTAURANT',
    'TRAITEUR',
    'SALLE',
    'ORGANISATEUR',
    'PRESTATAIRE',
    'PATISSERIE',
    'ETABLISSEMENT_ALIMENTAIRE',
    'AUTRE',
] as const;

/**
 * Schéma d'Inscription / Onboarding Partenaire
 */
export const RegisterPartnerSchema = z.object({
    // Données Entreprise
    companyName: z.string().min(2, 'La raison sociale est requise'),
    commercialName: z.string().optional(),
    description: z.string().min(10, 'Une brève description de votre activité est requise'),
    address: z.string().min(3, 'L\'adresse de l\'établissement est requise'),
    city: z.string().default('Dakar'),
    activities: z.array(z.enum(PartnerActivityTypes)).min(1, 'Sélectionnez au moins un type d\'activité'),

    // Données Gestionnaire / Compte
    firstName: z.string().min(2, 'Le prénom du gérant est requis'),
    lastName: z.string().min(2, 'Le nom du gérant est requis'),
    phone: SenegalesePhoneSchema,
    email: z.string().email('Adresse email professionnelle requise'),
    password: StrongPasswordSchema,
    confirmPassword: z.string().min(8, 'Veuillez confirmer le mot de passe'),

    // Identifiants légaux optionnels
    ninea: z.string().optional(),
    rccm: z.string().optional(),

    // Documents Professionnels Obligatoires (Bucket Privé Sécurisé).
    // Lot 1C.2 : jetons de dépôt remis par /api/partner/documents/upload (plus de chemin libre).
    idCardUploadToken: z.string().min(32, "La pièce d'identité du gérant (CNI ou Passeport) est obligatoire"),
    businessDocUploadToken: z.string().min(32, "Le document d'entreprise (RCCM ou NINEA) est obligatoire"),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export type RegisterPartnerInput = z.infer<typeof RegisterPartnerSchema>;

