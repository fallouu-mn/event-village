/**
 * Lot Carte B (B1), écart 2 de la contre-vérification — concordance des origines de tuiles entre lib/map/tiles.ts
 * (tileOrigins, lue par les cartes) et sa recopie dans next.config.mjs (mapTileOrigins, qui écrit la règle img-src de la
 * politique de sécurité du contenu : ce fichier n'importe pas de TypeScript). Pour chaque réglage des variables
 * NEXT_PUBLIC_MAP_TILE_URL et NEXT_PUBLIC_MAP_TILE_URL_DARK, la configuration est chargée dans un processus à part (les
 * variables sont lues au chargement) ; les origines des tuiles dans img-src sont exactement celles de tileOrigins, ni plus
 * ni moins.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tileOrigins } from '../../lib/map/tiles';

const ROOT = process.cwd();
/** Origines toujours présentes dans img-src, hors tuiles. */
const FIXED = new Set(["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://plus.unsplash.com']);

function imgSrcWith(env: { light?: string; dark?: string }): string[] {
    const script = `const m = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'next.config.mjs')).href)});`
        + `const rules = await m.default('phase-production-build').headers();`
        + `const all = rules.find((r) => r.source === '/(.*)');`
        + `const csp = all.headers.find((h) => h.key === 'Content-Security-Policy-Report-Only').value;`
        + `process.stdout.write(JSON.stringify(csp.split('; ').find((d) => d.startsWith('img-src ')).split(' ').slice(1)));`;
    const childEnv: NodeJS.ProcessEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '' };
    delete childEnv.NEXT_PUBLIC_MAP_TILE_URL;
    delete childEnv.NEXT_PUBLIC_MAP_TILE_URL_DARK;
    if (env.light !== undefined) childEnv.NEXT_PUBLIC_MAP_TILE_URL = env.light;
    if (env.dark !== undefined) childEnv.NEXT_PUBLIC_MAP_TILE_URL_DARK = env.dark;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, env: childEnv, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0, `chargement de next.config.mjs : ${r.stderr}`);
    return JSON.parse(r.stdout) as string[];
}

const CASES: Array<{ label: string; light?: string; dark?: string }> = [
    { label: 'défaut (Stadia)' },
    { label: 'clair seul réglé', light: 'https://tuiles.exemple.sn/{z}/{x}/{y}.png' },
    { label: 'clair et sombre réglés', light: 'https://clair.exemple.sn/{z}/{x}/{y}.png', dark: 'https://sombre.exemple.sn:8443/{z}/{x}/{y}{r}.png' },
    { label: 'sous-domaines {s}', light: 'https://{s}.tile.exemple.org/{z}/{x}/{y}.png' },
    { label: 'sombre seul réglé', dark: 'https://nuit.exemple.sn/{z}/{x}/{y}.png' },
    { label: 'adresse illisible', light: 'pas une adresse' },
];

describe('écart 2 — origines des tuiles : next.config.mjs suit lib/map/tiles.ts', () => {
    for (const c of CASES) {
        test(`img-src = tileOrigins : ${c.label}`, () => {
            const fromConfig = imgSrcWith(c).filter((s) => !FIXED.has(s)).sort();
            const expected = tileOrigins({ light: c.light, dark: c.dark }).sort();
            assert.deepEqual(fromConfig, expected, `img-src (hors origines fixes) : ${JSON.stringify(fromConfig)} ; tileOrigins : ${JSON.stringify(expected)}`);
        });
    }

    test('aucun « https: » entier ni joker dans img-src', () => {
        const all = imgSrcWith({});
        assert.ok(!all.includes('https:') && !all.some((s) => s.includes('*')), JSON.stringify(all));
    });
});
