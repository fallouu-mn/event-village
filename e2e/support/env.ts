/**
 * Lot 5.1 — environnement des tests de bout en bout (Playwright).
 *
 * Source : `.env.e2e` (généré par la CI, ignoré par git ; EV_E2E_ENV_FILE pour un autre fichier),
 * chargé sans écraser les variables du shell. Tout ce que le navigateur peut joindre est local :
 * l'application (http://127.0.0.1:3000), Supabase local et les faux services. Une URL non locale
 * fait échouer le chargement de la configuration, quel que soit le test lancé.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** URL de l'application imposée par le contrat P (cookies de session et callBackUrl SamirPay en dépendent). */
export const APP_URL = 'http://127.0.0.1:3000';
export const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';
export const DEFAULT_FAKE_SERVICES_URL = 'http://127.0.0.1:4010';

export const E2E_ENV_FILE = process.env.EV_E2E_ENV_FILE || '.env.e2e';

export function parseEnvFile(file: string): Record<string, string> {
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

let loadedFrom: string | null = null;

/** Charge `.env.e2e` une seule fois (sans écraser le shell). Renvoie le chemin et sa présence. */
export function loadE2eEnv(): { file: string; present: boolean } {
    const file = path.resolve(process.cwd(), E2E_ENV_FILE);
    const present = fs.existsSync(file);
    if (present && loadedFrom !== file) {
        for (const [key, value] of Object.entries(parseEnvFile(file))) {
            if (process.env[key] === undefined) process.env[key] = value;
        }
        loadedFrom = file;
    }
    return { file, present };
}

function localUrl(name: string, value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`[e2e] ${name} n'est pas une URL valide.`);
    }
    if (!LOCAL_HOSTNAMES.has(url.hostname)) {
        throw new Error(`[e2e] Refus : ${name} pointe hors de la machine (hôte : ${url.hostname}). Les tests de bout en bout ne joignent que des services locaux.`);
    }
    return url;
}

export interface E2eConfig {
    appUrl: string;
    supabaseUrl: string;
    fakeServicesUrl: string;
    /** Hôtes (host:port) que le navigateur a le droit de joindre ; tout le reste est bloqué. */
    allowedHosts: ReadonlySet<string>;
    envFile: string;
    envFilePresent: boolean;
}

let cached: E2eConfig | null = null;

export function e2eConfig(): E2eConfig {
    if (cached) return cached;
    const { file, present } = loadE2eEnv();
    const appEnv = process.env.NEXT_PUBLIC_APP_URL;
    if (appEnv && localUrl('NEXT_PUBLIC_APP_URL', appEnv).origin !== APP_URL) {
        throw new Error(`[e2e] NEXT_PUBLIC_APP_URL vaut ${appEnv} : le contrat impose ${APP_URL} (cookies et callBackUrl).`);
    }
    const supabase = localUrl('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL);
    const fake = localUrl('E2E_FAKE_SERVICES_URL', process.env.E2E_FAKE_SERVICES_URL || DEFAULT_FAKE_SERVICES_URL);
    for (const key of ['SAMIRPAY_API_URL', 'MTARGET_API_URL', 'SUPABASE_DB_URL']) {
        const value = process.env[key];
        if (value) localUrl(key, value);
    }
    const allowed = new Set<string>([new URL(APP_URL).host, new URL(DEFAULT_SUPABASE_URL).host, supabase.host, fake.host]);
    if (!present) {
        console.log(`[e2e] ${E2E_ENV_FILE} absent : hôtes locaux par défaut (${Array.from(allowed).join(', ')}).`);
    }
    cached = { appUrl: APP_URL, supabaseUrl: supabase.origin, fakeServicesUrl: fake.origin, allowedHosts: allowed, envFile: file, envFilePresent: present };
    return cached;
}
