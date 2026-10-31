/**
 * Validation des variables d'environnement SERVEUR (Zod).
 *
 * - `getServerEnv()` valide une seule fois et met en cache ; échec explicite
 *   listant chaque variable manquante ou invalide.
 * - Ne jamais importer ce module depuis un composant client : il lit `process.env`
 *   en entier et contient des secrets.
 *
 * Replis à retirer au lot 4 (listés ici pour traçabilité, NON modifiés dans ce lot) :
 *  - lib/security/totp.ts L18 : clé HMAC de dérivation = SUPABASE_AUTH_HOOK_SECRET
 *    || SUPABASE_SERVICE_ROLE_KEY || 'event-village-totp-master-salt-2026'
 *  - lib/shifts/shift.service.ts L51 : sel du PIN régisseur = SUPABASE_AUTH_HOOK_SECRET
 *    || SUPABASE_SERVICE_ROLE_KEY || 'event-village-regisseur-pin-salt-2026'
 *  - app/api/cron/moratoriums/route.ts L22 et app/api/cron/ticket-transfers/route.ts :
 *    CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY (et cron non protégé si les deux manquent)
 */
import { z } from 'zod';

const optionalUrl = z.string().url().optional();
const optionalString = z.string().min(1).optional();

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
    SAMIRPAY_WEBHOOK_SECRET: optionalString, // rendu obligatoire au lot 2 (vérification des webhooks)
    SAMIRPAY_CASHIN_URL: optionalUrl,
    SAMIRPAY_CASHOUT_URL: optionalUrl,
    SAMIRPAY_SOLDE_URL: optionalUrl,
    SAMIRPAY_STATUS_URL: optionalUrl,

    // SMS MTarget (optionnel : sans identifiants, l'envoi échoue proprement)
    MTARGET_API_URL: optionalUrl,
    MTARGET_USERNAME: optionalString,
    MTARGET_PASSWORD: optionalString,
    MTARGET_SERVICE_ID: optionalString,
    MTARGET_SENDER: optionalString,

    // Email Resend (optionnel : sans clé, l'envoi est journalisé)
    RESEND_API_KEY: optionalString,
    NOTIFICATION_FROM_EMAIL: z.string().email().optional(),
    SUPPORT_EMAIL: z.string().email().optional(),

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

    cached = parsed.data;
    return cached;
}

/** Réservé aux tests : force une nouvelle validation au prochain appel. */
export function resetServerEnvCache(): void {
    cached = null;
}
