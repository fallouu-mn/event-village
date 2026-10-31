/**
 * Validation des variables d'environnement SERVEUR (Zod).
 *
 * - `getServerEnv()` valide une seule fois et met en cache ; échec explicite
 *   listant chaque variable manquante ou invalide.
 * - Ne jamais importer ce module depuis un composant client : il lit `process.env`
 *   en entier et contient des secrets.
 *
 * Replis restants, à remplacer par des secrets dédiés (lot 4) :
 *  - lib/security/totp.ts : clé HMAC de dérivation = SUPABASE_AUTH_HOOK_SECRET
 *    || SUPABASE_SERVICE_ROLE_KEY (lot 1C.6 : plus de valeur littérale de repli)
 *  - lib/shifts/shift.service.ts : sel du PIN régisseur, même chaîne (lot 1C.6 : idem)
 *  - app/api/cron/moratoriums/route.ts et app/api/cron/ticket-transfers/route.ts :
 *    CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY (et cron non protégé si les deux manquent) ; les crons
 *    du lot 2 (lib/security/cron-auth.ts) exigent CRON_SECRET, sans repli
 */
import { z } from 'zod';

const optionalUrl = z.string().url().optional();
const optionalString = z.string().min(1).optional();
/** Limite entière positive lue dans l'environnement, avec une valeur par défaut prudente. */
const limit = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const serverEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Supabase (obligatoire)
    NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: 'URL Supabase invalide' }),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'clé anonyme Supabase requise'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'clé service role Supabase requise'),

    // Application
    NEXT_PUBLIC_APP_URL: z.string().url({ message: 'URL publique de l\'application requise' }),

    // SamirPay (obligatoire : la billetterie en dépend)
    SAMIRPAY_API_URL: z.string().url({ message: 'URL API SamirPay requise' }),
    SAMIRPAY_API_KEY: z.string().min(1, 'clé API SamirPay requise'),
    SAMIRPAY_SECRET_KEY: z.string().min(1, 'clé secrète SamirPay requise'),
    // Lot 2 : chemins fixés par le contrat sous SAMIRPAY_API_URL (plus de SAMIRPAY_*_URL). Le contrat
    // ne prévoit aucune signature de webhook : SAMIRPAY_WEBHOOK_SECRET n'est plus utilisé (jeton de
    // callback par paiement à la place, voir lib/payments/webhook.service.ts).
    SAMIRPAY_TIMEOUT_MS: limit(15000),

    // SMS MTarget (obligatoire, lot 1C.8 : le SMS est le canal essentiel)
    MTARGET_API_URL: optionalUrl, // défaut : API publique MTarget (lib/sms/mtarget-http.adapter.ts)
    MTARGET_USERNAME: z.string().min(1, 'identifiant MTarget requis (canal SMS obligatoire)'),
    MTARGET_PASSWORD: z.string().min(1, 'mot de passe MTarget requis (canal SMS obligatoire)'),
    MTARGET_SERVICE_ID: optionalString,
    MTARGET_SENDER: optionalString,

    // Anti-abus SMS (lot 1C.9) : chaque SMS est facturé. Compteurs en base, fenêtres fixes.
    SMS_OTP_PER_PHONE_15MIN: limit(3),
    SMS_OTP_PER_PHONE_DAY: limit(10),
    SMS_OTP_PER_IP_HOUR: limit(10),
    SMS_OTP_PER_IP_DAY: limit(30),
    SMS_PER_PHONE_DAY: limit(30), // tout SMS (notifications comprises), par destinataire
    SMS_GLOBAL_DAILY_CAP: limit(1000), // tous SMS confondus, par jour UTC (minuit à Dakar)
    // Dépôts publics de pièces d'inscription (lot 1C.2), par IP et par heure
    DOCUMENT_UPLOADS_PER_IP_HOUR: limit(20),
    // Lot 2 : chaîne paiement → billet
    PAYMENT_HOLD_MINUTES: limit(15), // durée de réservation du stock (et du délai d'attente de l'interface)
    CHECKOUT_PER_USER_15MIN: limit(10), // checkouts par compte (quota en base)
    CHECKOUT_PER_USER_DAY: limit(50),
    CLAIM_FREE_PER_USER_HOUR: limit(20), // demandes de billets gratuits par compte
    STATUS_POLL_RECONCILE_SECONDS: limit(5), // intervalle minimal des réconciliations demandées par la route de statut
    PAYMENT_RECONCILE_MIN_AGE_MINUTES: limit(2), // fenêtre d'attente avant le premier contrôle par le cron
    PAYMENT_PENDING_MAX_AGE_MINUTES: limit(60), // au-delà, un paiement encore PENDING chez SamirPay expire
    PAYMENT_LATE_SUCCESS_WINDOW_HOURS: limit(48), // succès tardifs recherchés sur les paiements EXPIRED/CANCELLED
    PAYMENT_RECONCILE_BATCH: limit(50),
    // Source de l'IP cliente pour les limites par IP : x-forwarded-for (1re valeur, à réserver à
    // un hébergement qui réécrit l'en-tête, ex. Vercel), x-real-ip, ou none (pas de limite par IP).
    CLIENT_IP_SOURCE: z.enum(['x-forwarded-for', 'x-real-ip', 'none']).default('x-forwarded-for'),

    // Email Resend (optionnel, lot 1C.8 : sans clé, le canal email est désactivé)
    RESEND_API_KEY: optionalString,
    NOTIFICATION_FROM_EMAIL: z.string().email().optional(),
    SUPPORT_EMAIL: z.string().email().optional(),

    // Codes OTP : secret HMAC dédié (lot 1C.4), sans valeur de repli
    OTP_HASH_SECRET: z.string().min(32, 'OTP_HASH_SECRET requis : secret aléatoire de 32 caractères au moins'),

    // Divers
    SUPERADMIN_PHONE: optionalString,
    SUPABASE_AUTH_HOOK_SECRET: optionalString,
    CRON_SECRET: optionalString,

    // Intégrations : "real" (défaut) ou "fake" (tests uniquement)
    EV_INTEGRATIONS: z.enum(['real', 'fake']).default('real'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export class ServerEnvError extends Error {
    constructor(public readonly issues: string[]) {
        super(
            'Configuration serveur invalide — variables d\'environnement manquantes ou incorrectes :\n' +
            issues.map((i) => `  - ${i}`).join('\n') +
            '\nRéférence : .env.example (production) / .env.test.example (tests).'
        );
        this.name = 'ServerEnvError';
    }
}

/**
 * Retourne l'environnement serveur validé. Lève ServerEnvError (message explicite)
 * si une variable requise manque ou est invalide.
 */
export function getServerEnv(): ServerEnv {
    if (cached) return cached;

    // Les chaînes vides sont traitées comme absentes (fichiers .env avec "CLE=")
    const raw: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(process.env)) {
        raw[key] = value === '' ? undefined : value;
    }

    const parsed = serverEnvSchema.safeParse(raw);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`);
        throw new ServerEnvError(issues);
    }

    if (parsed.data.EV_INTEGRATIONS === 'fake' && parsed.data.NODE_ENV === 'production') {
        throw new ServerEnvError(['EV_INTEGRATIONS=fake est interdit en production']);
    }
    for (const reused of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_AUTH_HOOK_SECRET'] as const) {
        if (parsed.data[reused] && parsed.data[reused] === parsed.data.OTP_HASH_SECRET) {
            throw new ServerEnvError([`OTP_HASH_SECRET doit être un secret dédié, différent de ${reused}`]);
        }
    }

    cached = parsed.data;
    return cached;
}

/** Réservé aux tests : force une nouvelle validation au prochain appel. */
export function resetServerEnvCache(): void {
    cached = null;
}
