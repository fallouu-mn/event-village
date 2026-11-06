/**
 * Lot 8 (8.1, L22) — lecture de `.env.local` par les scripts de développement : mêmes valeurs que Next, par
 * @next/env lui-même. parseEnvFile de scripts/reset-test-password.core.ts lit autrement `#` et `$` : un
 * CRON_SECRET lu par lui pourrait différer de celui du serveur.
 *
 * Aucune valeur n'est jamais affichée, ni dans un message ni dans une erreur : seuls des noms de clés.
 * Le fichier et les messages se lisent depuis le dossier de travail.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Sous tsx, `import nextEnv from '@next/env'` rend undefined : chargement CommonJS explicite.
const { loadEnvConfig } = createRequire(import.meta.url)('@next/env');

const ENV_FILE = '.env.local';

function assertReadable(file) {
    if (!fs.existsSync(file)) throw new Error(`${ENV_FILE} introuvable dans le dossier de travail.`);
    const head = fs.readFileSync(file).subarray(0, 2);
    if ((head[0] === 0xFF && head[1] === 0xFE) || (head[0] === 0xFE && head[1] === 0xFF)) {
        throw new Error(`${ENV_FILE} est encodé en UTF-16 (cas de « > » sous PowerShell) : enregistrez-le en UTF-8, Next ne le lirait pas.`);
    }
}

/**
 * Charge `.env.local` comme `next dev`.
 * @param {{ cwd?: string, required?: string[] }} [options] `required` : noms exigés, dans le fichier ou le shell.
 * @returns {{ fileEnv: Record<string, string>, shellEnv: Record<string, string | undefined> }}
 *   fileEnv : valeurs du fichier telles que Next les lit, même si le shell définit la clé ;
 *   shellEnv : copie de l'environnement du shell, prise avant le chargement.
 *   process.env reçoit les clés du fichier absentes du shell : comme Next, une variable du shell n'est jamais remplacée.
 */
export function loadLocalEnv({ cwd = process.cwd(), required = [] } = {}) {
    if (process.env.NODE_ENV === 'test') {
        throw new Error('NODE_ENV=test : Next y saute .env.local sans rien dire. Retirez cette variable du terminal.');
    }
    assertReadable(path.join(cwd, ENV_FILE));

    const shellEnv = { ...process.env };
    const failures = [];
    // @next/env ne rend pas les valeurs du seul fichier : le shell est retiré le temps de la lecture.
    for (const key of Object.keys(process.env)) delete process.env[key];
    let fileEnv;
    try {
        const { combinedEnv } = loadEnvConfig(cwd, true, { info() {}, error(message) { failures.push(String(message)); } }, true);
        fileEnv = { ...combinedEnv };
    } finally {
        for (const key of Object.keys(process.env)) delete process.env[key];
        Object.assign(process.env, shellEnv);
    }
    delete fileEnv.__NEXT_PROCESSED_ENV;
    if (failures.length > 0) throw new Error(`Lecture impossible : ${failures.join(' ; ')}`);

    for (const [key, value] of Object.entries(fileEnv)) {
        if (!(key in shellEnv)) process.env[key] = value;
    }
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) throw new Error(`Variable absente de ${ENV_FILE} : ${missing.join(', ')}.`);
    return { fileEnv, shellEnv };
}

/** Port lu dans l'environnement : entier de 1 à 65535, sinon refus nommé. */
export function portOf(env, key, fallback) {
    const raw = env[key];
    const port = raw === undefined || raw === '' ? fallback : Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${key} : port invalide.`);
    return port;
}
