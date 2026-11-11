/**
 * Validation des variables d'environnement SERVEUR (Zod).
 *
 * - `getServerEnv()` valide une seule fois et met en cache ; échec explicite
 *   listant chaque variable manquante ou invalide.
 * - Ne jamais importer ce module depuis un composant client : il lit `process.env`
 *   en entier et contient des secrets.
 *
 * Secrets dédiés, sans valeur de repli, distincts entre eux et des autres secrets (contrôlé ici) :
 * OTP_HASH_SECRET (lot 1C.4), TICKET_TOTP_MASTER_KEY (code dynamique des billets, lot 4) et
 * REGISSEUR_PIN_KEY (PIN régisseur, lot 4). Lot 6 : VAPID_PRIVATE_KEY (push web, facultative) rejoint les
 * secrets dont la réutilisation comme secret dédié est refusée.
 *
 * Toutes les routes cron exigent CRON_SECRET, sans repli (lib/security/cron-auth.ts, refuseUnlessCron) ;
 * depuis le lot 5, moratoriums et ticket-transfers n'acceptent plus la clé service_role.
 *
 * Le cache est invalidé par resetServerEnvCache() : les tests qui changent une limite dans leur
 * processus l'appellent après avoir modifié process.env.
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
    // Lot 2 : chemins fixés par le contrat sous SAMIRPAY_API_URL (plus de SAMIRPAY_*_URL).
    SAMIRPAY_TIMEOUT_MS: limit(15000),
    // Lot 9 bis (H3) : secret de signature des webhooks SamirPay v1.2 (« whsec_… »), FACULTATIF. Défini : tout
    // webhook sans signature valide est refusé (lib/samirpay/webhook-signature.ts) ; absent : seul le jeton de
    // callback par paiement protège la route. La confirmation par le statut reste exigée dans les deux cas.
    SAMIRPAY_WEBHOOK_SECRET: z.string().min(16, 'secret de 16 caractères au moins (whsec_…)').optional(),

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
    SMS_PER_PHONE_DAY: limit(30), // notifications (hors OTP) par destinataire ; l'OTP a ses propres compteurs (lot 4)
    SMS_GLOBAL_DAILY_CAP: limit(1000), // tous SMS confondus, par jour UTC (minuit à Dakar)
    // Lot 4 : SMS non OTP déclenchés par un compte connecté (invitations, équipe, transferts, billets gratuits)
    SMS_PER_ACCOUNT_DAY: limit(30),
    // Lot 4 : part du plafond global réservée à l'OTP ; les SMS non OTP s'arrêtent à (100 − part) %
    SMS_GLOBAL_OTP_RESERVED_PERCENT: z.coerce.number().int().min(0).max(100).default(30),
    // Dépôts publics de pièces d'inscription (lot 1C.2), par IP et par heure
    DOCUMENT_UPLOADS_PER_IP_HOUR: limit(20),
    // Lot 2 : chaîne paiement → billet
    // Lot 9 bis (H2) : remplacée par le réglage SUPERADMIN finance.payment_hold_minutes (10 min, de 5 à 60). Encore
    // lue par lib/payments/checkout.service.ts jusqu'au correctif H2 de ce fichier ; la ligne est retirée ensuite.
    PAYMENT_HOLD_MINUTES: limit(15), // durée de réservation du stock (et du délai d'attente de l'interface)
    CHECKOUT_PER_USER_15MIN: limit(10), // checkouts par compte (quota en base)
    CHECKOUT_PER_USER_DAY: limit(50),
    CLAIM_FREE_PER_USER_HOUR: limit(20), // demandes de billets gratuits par compte
    STATUS_POLL_RECONCILE_SECONDS: limit(5), // intervalle minimal des réconciliations demandées par la route de statut
    PAYMENT_RECONCILE_MIN_AGE_MINUTES: limit(2), // fenêtre d'attente avant le premier contrôle par le cron
    PAYMENT_PENDING_MAX_AGE_MINUTES: limit(60), // au-delà, un paiement encore PENDING chez SamirPay expire
    PAYMENT_LATE_SUCCESS_WINDOW_HOURS: limit(48), // succès tardifs recherchés sur les paiements EXPIRED/CANCELLED
    PAYMENT_RECONCILE_BATCH: limit(50),
    // Lot 4 : quotas en base (lib/security/quota.ts), toutes les tentatives comptées, refus si la garde
    // ne répond pas. Fenêtres fixes : 10 s, minute, 15 min, heure, jour.
    SCAN_PER_SCANNER_10S: limit(30), // scans par scanneur (contrôleur, partenaire, admin)
    LIVE_CODE_PER_USER_MIN: limit(60), // codes dynamiques demandés par compte
    RESOLVE_PHONE_PER_IP_HOUR: limit(30), // résolutions numéro → compte, par IP
    VERIFY_OTP_PER_PHONE_15MIN: limit(10), // vérifications de code OTP, par numéro
    CONTROLLER_SETUP_PER_PHONE_HOUR: limit(10), // activations de compte contrôleur, par numéro
    PARTNER_REGISTER_PER_IP_HOUR: limit(10), // inscriptions partenaire, par IP
    INVITE_PER_PARTNER_HOUR: limit(20), // invitations de contrôleurs, par partenaire
    INVITE_PER_PHONE_DAY: limit(3), // invitations reçues par un numéro, tous partenaires confondus
    REGISSEUR_PIN_PER_SHIFT_15MIN: limit(5), // vérifications du PIN régisseur
    // Lot 5 (5.0) : demandes de retrait par compte et par heure, reçus SMS du guichet par caisse et par jour,
    // incidents de scan déclarés par l'appareil (appels) et écrits par le serveur (lignes), par scanneur et par minute
    WITHDRAWAL_REQUEST_PER_USER_HOUR: limit(10),
    COUNTER_RECEIPT_PER_SHIFT_DAY: limit(500),
    SCAN_INCIDENT_REPORT_PER_SCANNER_MIN: limit(10),
    SCAN_INCIDENT_LOG_PER_SCANNER_MIN: limit(60),
    // Lot 7 (7.1, D37) : téléchargements du lot de codes hors ligne (GET /api/tickets/[id]/offline-codes), par
    // billet et par compte, fenêtres fixes d'une heure ; une ouverture de l'application ne retélécharge que si
    // le lot manque, a expiré, a changé de version ou se termine dans moins de 24 h
    OFFLINE_CODES_PER_TICKET_HOUR: limit(12),
    OFFLINE_CODES_PER_USER_HOUR: limit(60),
    // Lot 7 (7.2, D43) : vérifications de saisie manuelle (POST /api/controller/scan/lookup), par contrôleur et par minute
    SCAN_LOOKUP_PER_SCANNER_MIN: limit(20),
    // Lot 9 (9.0) : invitations (lignes numéro) par événement et par heure, puis par numéro et par jour
    INVITATION_PER_EVENT_HOUR: limit(50),
    INVITATION_PER_PHONE_DAY: limit(3),
    // Lot 9 (9.2) : codes de changement de numéro par compte et par jour ; envois de photo par compte et par heure
    PHONE_CHANGE_PER_ACCOUNT_DAY: limit(5),
    AVATAR_UPLOADS_PER_ACCOUNT_HOUR: limit(20),
    // Lot 9 bis (13, 42) : confirmations et changements de mot de passe par compte, par 15 minutes
    PASSWORD_CONFIRM_PER_ACCOUNT_15MIN: limit(5),
    // Lot 9 bis (14) : connexions par mot de passe (POST /api/auth/login), par IP et par heure
    PASSWORD_LOGIN_PER_IP_HOUR: limit(30),
    // Lot 9 bis (48) : liens de vérification d'email par compte et par heure, puis par adresse (seau haché) et par jour
    EMAIL_VERIFY_PER_ACCOUNT_HOUR: limit(3),
    EMAIL_VERIFY_PER_ADDRESS_DAY: limit(5),
    // Source de l'IP cliente pour les limites par IP : x-forwarded-for (1re valeur, à réserver à
    // un hébergement qui réécrit l'en-tête, ex. Vercel), x-real-ip, ou none (pas de limite par IP).
    CLIENT_IP_SOURCE: z.enum(['x-forwarded-for', 'x-real-ip', 'none']).default('x-forwarded-for'),

    // Email Resend (optionnel, lot 1C.8 : sans clé, le canal email est désactivé)
    RESEND_API_KEY: optionalString,
    NOTIFICATION_FROM_EMAIL: z.string().email().optional(),
    // Lot 9 bis (41/R70) : adresse de support montrée aux personnes, lue côté serveur seulement (lib/support.ts, qui
    // porte l'adresse par défaut) ; jamais en NEXT_PUBLIC_
    SUPPORT_EMAIL: z.string().email().optional(),

    // Lot 6 (contrat E6) : délai maximal d'un appel MTarget ; au-delà, l'issue est incertaine (jamais renvoyé)
    MTARGET_TIMEOUT_MS: limit(15000),

    // Push web (lot 6, contrat F4) — FACULTATIF : les trois variables VAPID ou aucune. Sans elles (ou avec
    // une configuration partielle ou invalide), le canal push est désactivé (lignes SKIPPED
    // PUSH_NOT_CONFIGURED, un seul avertissement) et tout le reste fonctionne. Validées par
    // lib/push/config.ts (et non ici) : une erreur de configuration du push n'empêche jamais le démarrage.
    VAPID_PUBLIC_KEY: optionalString,
    VAPID_PRIVATE_KEY: optionalString, // secret : clé privée P-256 (base64url, 32 octets)
    VAPID_SUBJECT: optionalString, // mailto:… ou https:…
    // Liste blanche des services push (anti-SSRF) : REMPLACE la liste par défaut ; à laisser vide en production
    PUSH_ENDPOINT_ALLOWED_ORIGINS: optionalString,
    PUSH_TIMEOUT_MS: limit(10000), // délai maximal d'un envoi vers un service push
    PUSH_SUBSCRIBE_PER_USER_HOUR: limit(20), // inscriptions d'appareils par compte et par heure
    PUSH_TEST_PER_USER_HOUR: limit(5), // notifications d'essai par compte et par heure

    // Codes OTP : secret HMAC dédié (lot 1C.4), sans valeur de repli
    OTP_HASH_SECRET: z.string().min(32, 'OTP_HASH_SECRET requis : secret aléatoire de 32 caractères au moins'),
    // Lot 4 : clé maître du code dynamique des billets (lib/security/totp.ts) et clé du PIN régisseur
    // (lib/shifts/shift.service.ts), sans valeur de repli
    TICKET_TOTP_MASTER_KEY: z.string({ required_error: 'TICKET_TOTP_MASTER_KEY requis : secret aléatoire dédié (openssl rand -hex 32)' })
        .min(32, 'TICKET_TOTP_MASTER_KEY requis : secret aléatoire de 32 caractères au moins'),
    REGISSEUR_PIN_KEY: z.string({ required_error: 'REGISSEUR_PIN_KEY requis : secret aléatoire dédié (openssl rand -hex 32)' })
        .min(32, 'REGISSEUR_PIN_KEY requis : secret aléatoire de 32 caractères au moins'),

    // Divers
    SUPERADMIN_PHONE: optionalString,
    SUPABASE_AUTH_HOOK_SECRET: optionalString,
    CRON_SECRET: optionalString,

    // Intégrations : "real" (défaut) ou "fake" (tests, et mode d'essai en développement ; refusé ailleurs, voir getServerEnv)
    EV_INTEGRATIONS: z.enum(['real', 'fake']).default('real'),
    // Lot 8 (8.1), mode d'essai seulement ; aucune de ces variables n'existe en production.
    // URL du faux SamirPay local, exigée et contrôlée par lib/integrations/dev-adapters.ts
    EV_DEV_FAKE_SERVICES_URL: optionalString,
    // Posée par scripts/dev/essai-start.mjs seulement, sans effet si SAMIRPAY_API_URL n'est pas locale
    EV_ESSAI_SIMULATION: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Secrets dédiés : chacun doit différer des autres secrets et des autres secrets dédiés. */
const DEDICATED_SECRETS = ['OTP_HASH_SECRET', 'TICKET_TOTP_MASTER_KEY', 'REGISSEUR_PIN_KEY'] as const;
// Lot 6 (F4) : la clé privée VAPID ne doit servir de secret dédié nulle part. Lot 9 bis (H3) : le secret des
// webhooks SamirPay non plus.
const OTHER_SECRETS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_AUTH_HOOK_SECRET', 'CRON_SECRET', 'SAMIRPAY_SECRET_KEY', 'SAMIRPAY_API_KEY', 'VAPID_PRIVATE_KEY', 'SAMIRPAY_WEBHOOK_SECRET'] as const;

function dedicatedSecretReuse(env: ServerEnv): string[] {
    const issues: string[] = [];
    DEDICATED_SECRETS.forEach((key, i) => {
        for (const other of [...OTHER_SECRETS, ...DEDICATED_SECRETS.slice(i + 1)]) {
            if (env[other] && env[other] === env[key]) issues.push(`${key} doit être un secret dédié, différent de ${other}`);
        }
    });
    return issues;
}

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

    // Lot 8 (8.1) : `process.env.NODE_ENV` littéral, figé au build, et non parsed.data : `NODE_ENV=development
    // next start` passerait, et le défaut « development » du schéma autoriserait le mode si la variable manquait.
    if (parsed.data.EV_INTEGRATIONS === 'fake' && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
        throw new ServerEnvError(['EV_INTEGRATIONS=fake est interdit hors développement et test']);
    }
    const reuse = dedicatedSecretReuse(parsed.data);
    if (reuse.length > 0) throw new ServerEnvError(reuse);

    cached = parsed.data;
    return cached;
}

/** Réservé aux tests : force une nouvelle validation au prochain appel. */
export function resetServerEnvCache(): void {
    cached = null;
}
