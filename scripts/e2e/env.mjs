/**
 * Lot 5.1 — chargement de `.env.e2e` et garde-fous communs aux scripts e2e (faux services,
 * démarrage de l'application, lanceur Playwright). Aucun secret n'est écrit ici : le fichier est
 * généré par la CI (secrets aléatoires openssl) et ignoré par git.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function fail(tag, message) {
    process.stderr.write(`\n[${tag}] REFUS DE DÉMARRER — ${message}\n\n`);
    process.exit(2);
}

export function parseEnvFile(file) {
    const out = {};
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        out[key] = value;
    }
    return out;
}

/** Charge le fichier (EV_E2E_ENV_FILE, défaut .env.e2e) sans écraser les variables du shell. */
export function loadE2eEnv(tag) {
    const name = process.env.EV_E2E_ENV_FILE || '.env.e2e';
    const file = path.resolve(ROOT, name);
    if (!fs.existsSync(file)) {
        fail(tag, `${name} introuvable. En CI il est généré par le workflow ; en local, créez-le à partir de l'instance locale (voir .github/workflows/verify.yml, étape « E2E : générer .env.e2e »).`);
    }
    const values = parseEnvFile(file);
    for (const [key, value] of Object.entries(values)) {
        if (process.env[key] === undefined) process.env[key] = value;
    }
    return { file, keys: Object.keys(values) };
}

/** URL obligatoire et locale ; sinon refus explicite. */
export function requireLocalUrl(tag, key) {
    const value = process.env[key];
    if (!value) fail(tag, `${key} absente.`);
    let url;
    try {
        url = new URL(value);
    } catch (err) {
        fail(tag, `${key} n'est pas une URL valide (${err instanceof Error ? err.message : String(err)}).`);
    }
    if (!LOCAL_HOSTNAMES.has(url.hostname)) fail(tag, `${key} pointe hors de la machine (hôte : ${url.hostname}).`);
    return url;
}

/** Entier de port obligatoire. */
export function requirePort(tag, key) {
    const raw = process.env[key];
    const port = Number(raw);
    if (!raw || !Number.isInteger(port) || port < 1024 || port > 65535) fail(tag, `${key} absente ou invalide (« ${raw ?? ''} ») : port attendu entre 1024 et 65535.`);
    return port;
}

/** Contrôles communs : base, application, SamirPay, MTarget locaux ; aucune clé Resend. */
export function assertLocalServices(tag) {
    requireLocalUrl(tag, 'NEXT_PUBLIC_SUPABASE_URL');
    const app = requireLocalUrl(tag, 'NEXT_PUBLIC_APP_URL');
    const samirpay = requireLocalUrl(tag, 'SAMIRPAY_API_URL');
    const mtarget = requireLocalUrl(tag, 'MTARGET_API_URL');
    if (process.env.SUPABASE_DB_URL) requireLocalUrl(tag, 'SUPABASE_DB_URL');
    if (process.env.RESEND_API_KEY) fail(tag, 'RESEND_API_KEY est renseignée : en e2e le canal email doit être désactivé (aucune requête vers Resend).');
    if (process.env.EV_INTEGRATIONS === 'fake') fail(tag, 'EV_INTEGRATIONS=fake : interdit avec next start (lib/env.ts) ; l\'application e2e utilise les vrais adaptateurs pointés sur les faux services.');
    return { app, samirpay, mtarget };
}
