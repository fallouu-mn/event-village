/**
 * Lot 2.0 — script de changement du mot de passe du superadmin du projet de test distant.
 * Le script n'est jamais exécuté par les tests (ni par l'assistant) : seules ses règles pures
 * sont vérifiées ici, sans réseau.
 *  - mot de passe jamais en argument : toute option autre que --email est refusée ;
 *  - projet ciblé = uniquement celui de .env.local ; refus si une variable d'environnement
 *    pointe ailleurs, si l'URL n'est pas un projet Supabase hébergé, si une clé manque ;
 *  - politique de mot de passe ;
 *  - journal sans mot de passe ;
 *  - saisie au clavier obligatoire (aucune lecture depuis un fichier ou un tube).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Import dynamique : le module n'existe pas avant le correctif, et le typecheck de la CI passe avant les tests.
const CORE_PATH = '../../scripts/reset-test-password.core';
interface Core {
    parseArgs(argv: string[]): { email?: string };
    parseEnvFile(content: string): Record<string, string>;
    resolveTargetProject(env: Record<string, string>, processEnv: Record<string, string | undefined>): { url: string; ref: string; serviceRoleKey: string; anonKey: string };
    checkPasswordStrength(candidate: string): string[];
    buildJournalEntry(p: { projectRef: string; userId: string | null; email: string; outcome: string; sessionsRevoked: boolean; operator: string }): string;
}
let core: Core;
before(async () => {
    core = (await import(CORE_PATH)) as Core;
});

const ENV_LOCAL = [
    '# projet de test',
    'NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY="clé-anon-factice"',
    "SUPABASE_SERVICE_ROLE_KEY='clé-service-factice'",
].join('\n');

describe('scripts/reset-test-password', () => {
    test('arguments : seul --email est accepté, jamais de mot de passe', () => {
        assert.deepEqual(core.parseArgs(['--email', 'superadmin@eventvillage.sn']), { email: 'superadmin@eventvillage.sn' });
        assert.deepEqual(core.parseArgs([]), {});
        for (const argv of [['--password', 'x'], ['--password=x'], ['-p', 'x'], ['secret-positionnel'], ['--url', 'https://autre.supabase.co'], ['--email']]) {
            assert.throws(() => core.parseArgs(argv), Error, `argument refusé : ${argv.join(' ')}`);
        }
    });

    test('projet : uniquement celui de .env.local', () => {
        const env = core.parseEnvFile(ENV_LOCAL);
        const target = core.resolveTargetProject(env, {});
        assert.equal(target.ref, 'abcdefghijklmnopqrst');
        assert.equal(target.url, 'https://abcdefghijklmnopqrst.supabase.co');
        assert.equal(target.serviceRoleKey, 'clé-service-factice');
        assert.equal(target.anonKey, 'clé-anon-factice');

        assert.throws(() => core.resolveTargetProject(env, { NEXT_PUBLIC_SUPABASE_URL: 'https://autreprojet0000000.supabase.co' }), /\.env\.local/, 'variable d’environnement vers un autre projet');
        assert.throws(() => core.resolveTargetProject(env, { SUPABASE_URL: 'http://127.0.0.1:54321' }), /\.env\.local/, 'SUPABASE_URL vers un autre projet');
        assert.throws(() => core.resolveTargetProject(core.parseEnvFile('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_SERVICE_ROLE_KEY=x\nNEXT_PUBLIC_SUPABASE_ANON_KEY=y'), {}), /supabase\.co/, 'instance locale refusée');
        assert.throws(() => core.resolveTargetProject(core.parseEnvFile('NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co.evil.example\nSUPABASE_SERVICE_ROLE_KEY=x\nNEXT_PUBLIC_SUPABASE_ANON_KEY=y'), {}), /supabase\.co/, 'hôte piégé refusé');
        assert.throws(() => core.resolveTargetProject(core.parseEnvFile('NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=y'), {}), /SUPABASE_SERVICE_ROLE_KEY/, 'clé service absente');
        assert.doesNotThrow(() => core.resolveTargetProject(env, { NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' }), 'même projet accepté');
    });

    test('politique de mot de passe', () => {
        assert.deepEqual(core.checkPasswordStrength('Tr0p-Court!'), ['14 caractères au moins']);
        assert.ok(core.checkPasswordStrength('toutenminuscules-sans-chiffre').length >= 2);
        assert.deepEqual(core.checkPasswordStrength('Un-Mot-De-Passe-Solide-2026'), []);
        assert.ok(core.checkPasswordStrength(' Espace-Au-Debut-2026').includes('aucune espace au début ni à la fin'));
    });

    test('journal : aucune trace du mot de passe', () => {
        const typed = 'Un-Mot-De-Passe-Solide-2026';
        const line = core.buildJournalEntry({ projectRef: 'abcdefghijklmnopqrst', userId: '00000000-0000-4000-8000-000000000001', email: 'superadmin@eventvillage.sn', outcome: 'PASSWORD_CHANGED', sessionsRevoked: true, operator: 'poste-local' });
        assert.ok(!line.includes(typed));
        const entry = JSON.parse(line);
        assert.equal(entry.project_ref, 'abcdefghijklmnopqrst');
        assert.equal(entry.outcome, 'PASSWORD_CHANGED');
        assert.ok(!('password' in entry), 'aucun champ mot de passe');
        assert.notEqual(entry.email, 'superadmin@eventvillage.sn', 'email masqué');
    });

    test('lanceur : saisie au clavier obligatoire, mot de passe jamais lu depuis argv, un fichier ou l’environnement', () => {
        const src = fs.readFileSync('scripts/reset-test-password.ts', 'utf8');
        assert.match(src, /process\.stdin\.isTTY/, 'refus hors terminal interactif');
        assert.match(src, /setRawMode\(true\)/, 'saisie masquée');
        assert.doesNotMatch(src, /process\.env\.\w*PASS/i, 'aucun mot de passe lu dans l’environnement');
        assert.doesNotMatch(src, /readFileSync\([^)]*(pass|pwd|secret)/i, 'aucun mot de passe lu dans un fichier');
        assert.match(src, /parseArgs\(process\.argv\.slice\(2\)\)/, 'arguments validés par parseArgs');
    });
});
