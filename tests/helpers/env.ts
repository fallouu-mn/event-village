/**
 * GARDE-FOU ANTI-BASE RÉELLE — environnement de test Event Village.
 *
 * Chargé par TOUS les tests (via `--import ./tests/helpers/env.ts` dans le lanceur
 * `scripts/run-tests.mjs`, et importé en tête de chaque fichier de test).
 *
 * Garanties :
 *  1. seul le fichier `.env.test` (ou EV_ENV_FILE) est chargé — jamais `.env.local` ;
 *  2. le processus refuse de démarrer si l'URL Supabase n'est pas locale
 *     (localhost / 127.0.0.1) ou si une URL de service externe pointe hors de la machine ;
 *  3. les variables Supabase sont gelées : toute tentative de les réécrire pendant
 *     les tests (ex. un ancien chargeur de `.env.local`) lève une erreur explicite ;
 *  4. les intégrations externes (SMS, email, SamirPay) sont forcées sur les faux
 *     adaptateurs enregistrés dans `tests/fakes` — zéro requête réseau.
 */
import fs from 'node:fs';
import path from 'node:path';
import { installFakeIntegrations } from '../fakes';

const ROOT = process.cwd();
const ENV_FILE = process.env.EV_ENV_FILE || '.env.test';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const PROTECTED_KEYS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EV_INTEGRATIONS',
] as const;

const EXTERNAL_URL_KEYS = [
    'SAMIRPAY_API_URL',
    'SAMIRPAY_CASHIN_URL',
    'SAMIRPAY_CASHOUT_URL',
    'SAMIRPAY_SOLDE_URL',
    'SAMIRPAY_STATUS_URL',
    'MTARGET_API_URL',
] as const;

function fail(message: string): never {
    process.stderr.write(`\n[tests/helpers/env] REFUS DE DÉMARRER — ${message}\n\n`);
    process.exit(1);
}

function parseEnvFile(file: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

function hostOf(value: string): string {
    try {
        return new URL(value).hostname;
    } catch {
        return '<URL invalide>';
    }
}

function isLocalUrl(value: string | undefined): boolean {
    if (!value) return false;
    try {
        return LOCAL_HOSTS.has(new URL(value).hostname);
    } catch {
        return false;
    }
}

// ── 1. Chargement du fichier d'environnement de test (sans écraser le shell) ──
const envPath = path.resolve(ROOT, ENV_FILE);
if (!fs.existsSync(envPath)) {
    fail(
        `fichier d'environnement de test introuvable : ${envPath}\n` +
        `  → copiez .env.test.example vers .env.test et renseignez les clés de l'instance locale (supabase status).`
    );
}
const fileEnv = parseEnvFile(envPath);
for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

// ── 2. Contrôles stricts : base locale uniquement, aucun service externe réel ──
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!isLocalUrl(supabaseUrl)) {
    fail(
        `NEXT_PUBLIC_SUPABASE_URL ne pointe pas sur une instance Supabase LOCALE.\n` +
        `  Valeur chargée (hôte) : ${supabaseUrl ? hostOf(supabaseUrl) : '<absente>'} (source : ${ENV_FILE} ou variables du shell)\n` +
        `  Les tests ne doivent JAMAIS toucher le projet distant. Attendu : http://127.0.0.1:54321 (supabase start).`
    );
}
if (process.env.SUPABASE_URL && !isLocalUrl(process.env.SUPABASE_URL)) {
    fail(`SUPABASE_URL pointe hors de la machine (hôte : ${hostOf(process.env.SUPABASE_URL)}).`);
}
for (const key of EXTERNAL_URL_KEYS) {
    const value = process.env[key];
    if (value && !isLocalUrl(value)) {
        fail(`${key} pointe vers un service externe réel (hôte : ${hostOf(value)}). En test, seuls les faux adaptateurs sont autorisés.`);
    }
}
if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_test_fake') {
    fail('RESEND_API_KEY est renseignée avec une valeur non factice. Les tests ne doivent pas pouvoir envoyer de vrais emails.');
}

process.env.EV_INTEGRATIONS = 'fake';
if (!process.env.NODE_ENV) {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
process.env.EV_TEST_GUARD = '1';

// ── 3. Gel des variables protégées pour toute la durée du processus ──
const frozen = new Map<string, string | undefined>(PROTECTED_KEYS.map((k) => [k, process.env[k]]));
const realEnv = process.env;
process.env = new Proxy(realEnv, {
    set(target, key, value) {
        if (typeof key === 'string' && frozen.has(key) && String(value) !== frozen.get(key)) {
            throw new Error(
                `[tests/helpers/env] Tentative de modification de ${key} pendant les tests (garde-fou anti-base réelle). ` +
                `Supprimez tout chargement de .env.local dans les tests : l'environnement vient exclusivement de ${ENV_FILE}.`
            );
        }
        target[key as string] = value;
        return true;
    },
    deleteProperty(target, key) {
        if (typeof key === 'string' && frozen.has(key)) {
            throw new Error(`[tests/helpers/env] Suppression de ${key} interdite pendant les tests.`);
        }
        delete target[key as string];
        return true;
    },
    defineProperty(target, key, descriptor) {
        if (typeof key === 'string' && frozen.has(key)) {
            throw new Error(`[tests/helpers/env] Redéfinition de ${key} interdite pendant les tests.`);
        }
        Object.defineProperty(target, key, descriptor);
        return true;
    },
});

// ── 4. Verrou réseau : toute requête fetch vers un hôte non local est refusée ──
// Défense en profondeur : même un appel oublié hors des adaptateurs (SMS, email,
// SamirPay) ne peut pas sortir de la machine. Supabase local (127.0.0.1) reste autorisé.
const blockedRequests: string[] = [];
const realFetch = globalThis.fetch;

function requestUrl(input: Parameters<typeof fetch>[0]): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
}

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = requestUrl(input);
    let host = '';
    try {
        host = new URL(url).hostname;
    } catch {
        host = '';
    }
    if (!LOCAL_HOSTS.has(host)) {
        blockedRequests.push(url);
        throw new Error(`[tests/helpers/env] Requête réseau externe bloquée en test : ${host || url}`);
    }
    return realFetch(input, init);
}) as typeof fetch;

/** URLs dont la requête a été refusée par le verrou réseau (pour assertion). */
export function getBlockedRequests(): readonly string[] {
    return blockedRequests;
}

// ── 5. Faux adaptateurs (SMS, email, SamirPay) : aucune requête réseau ──
installFakeIntegrations();

export const TEST_ENV_FILE = envPath;
