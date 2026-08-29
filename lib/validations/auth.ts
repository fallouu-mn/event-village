import { z } from 'zod';

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

/**
 * Validateur de numéro de téléphone sénégalais (Orange, Wave/Free, Expresso, Promobile)
 */
export const SenegalesePhoneSchema = z.string().refine((val) => {
    const normalized = normalizePhoneNumber(val);
    return /^\+221[7][05678]\d{7}$/.test(normalized);
}, {
    message: 'Numéro de téléphone sénégalais invalide (ex: 77 123 45 67 ou +221 78 987 65 43)',
});

/**
 * Schéma de Connexion (Email ou Téléphone + Mot de passe ou OTP)
 */
export const LoginSchema = z.object({
    identifier: z.string().min(3, 'Veuillez saisir votre email ou numéro de téléphone'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères').optional(),
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
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string().min(6, 'Veuillez confirmer votre mot de passe'),
    referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export type RegisterClientInput = z.infer<typeof RegisterClientSchema>;

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
 * Schéma de Réinitialisation de Mot de Passe
 */
export const ResetPasswordSchema = z.object({
    password: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string().min(6, 'Veuillez confirmer le mot de passe'),
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
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string().min(6, 'Veuillez confirmer le mot de passe'),

    // Identifiants légaux optionnels
    ninea: z.string().optional(),
    rccm: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export type RegisterPartnerInput = z.infer<typeof RegisterPartnerSchema>;
