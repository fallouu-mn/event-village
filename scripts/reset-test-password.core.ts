/**
 * Lot 2.0 — règles pures du script scripts/reset-test-password.ts (testées sans réseau par
 * tests/schema/reset-test-password.test.ts). Aucune entrée/sortie ici.
 */
import crypto from 'node:crypto';

export interface ResetArgs {
    email?: string;
}

/** Seule option admise : --email <adresse>. Tout le reste (mot de passe compris) est refusé. */
export function parseArgs(argv: string[]): ResetArgs {
    const out: ResetArgs = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--email') {
            const value = argv[i + 1];
            if (!value || value.startsWith('-')) throw new Error('--email attend une adresse.');
            out.email = value.trim().toLowerCase();
            i += 1;
            continue;
        }
        throw new Error(`Argument refusé : « ${a.split('=')[0]} ». Le mot de passe se saisit au clavier, jamais en argument ; seule l'option --email est admise.`);
    }
    return out;
}

/** Lecture minimale d'un fichier .env (KEY=valeur, guillemets simples ou doubles, commentaires #). */
export function parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        env[key] = value;
    }
    return env;
}

export interface TargetProject {
    url: string;
    ref: string;
    serviceRoleKey: string;
    anonKey: string;
}

const HOSTED_PROJECT = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;

/**
 * Projet ciblé : celui de .env.local, et lui seul. Refus si une variable d'environnement du shell
 * désigne un autre projet, si l'URL n'est pas un projet Supabase hébergé (instance locale, hôte
 * piégé), ou si une clé manque.
 */
export function resolveTargetProject(envLocal: Record<string, string>, processEnv: Record<string, string | undefined>): TargetProject {
    const url = (envLocal.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const m = url.match(HOSTED_PROJECT);
    if (!m) throw new Error('NEXT_PUBLIC_SUPABASE_URL de .env.local doit être un projet Supabase hébergé (https://<référence>.supabase.co).');
    for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']) {
        const other = processEnv[key];
        if (other && other.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
            throw new Error(`${key} du shell désigne un autre projet que celui de .env.local : refus.`);
        }
    }
    const serviceRoleKey = (envLocal.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = (envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente de .env.local.');
    if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY absente de .env.local.');
    return { url: url.replace(/\/$/, ''), ref: m[1], serviceRoleKey, anonKey };
}

/** Problèmes du mot de passe proposé (liste vide : accepté). */
export function checkPasswordStrength(candidate: string): string[] {
    const problems: string[] = [];
    if (candidate.length < 14) problems.push('14 caractères au moins');
    if (!/[a-z]/.test(candidate)) problems.push('une minuscule');
    if (!/[A-Z]/.test(candidate)) problems.push('une majuscule');
    if (!/[0-9]/.test(candidate)) problems.push('un chiffre');
    if (!/[^A-Za-z0-9]/.test(candidate)) problems.push('un caractère spécial');
    if (candidate !== candidate.trim()) problems.push('aucune espace au début ni à la fin');
    return problems;
}

export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
}

/** Ligne de journal (JSON) : jamais de mot de passe, email masqué. */
export function buildJournalEntry(params: {
    projectRef: string;
    userId: string | null;
    email: string;
    outcome: 'PASSWORD_CHANGED' | 'ABORTED' | 'FAILED';
    sessionsRevoked: boolean;
    operator: string;
    detail?: string;
}): string {
    return JSON.stringify({
        at: new Date().toISOString(),
        script: 'reset-test-password',
        project_ref: params.projectRef,
        user_id: params.userId,
        email: maskEmail(params.email),
        outcome: params.outcome,
        sessions_revoked: params.sessionsRevoked,
        operator: params.operator,
        run_id: crypto.randomUUID(),
        ...(params.detail ? { detail: params.detail } : {}),
    });
}
