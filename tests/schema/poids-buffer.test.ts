/**
 * Lot poids (piste 3) — pas de polyfill `Buffer` dans le JavaScript du navigateur.
 *
 * Next fournit `Buffer` (ProvidePlugin) à tout module du navigateur qui le cite : son polyfill (next/dist/compiled/buffer,
 * ~2 100 octets gzip) entrait dans TOUTES les pages, pour une seule ligne de @supabase/storage-js (toBase64, métadonnées
 * d'un téléversement : `typeof Buffer !== "undefined" ? Buffer… : btoa(…)`), branche que le navigateur n'emprunte jamais ici.
 * next.config.mjs retire `Buffer` du ProvidePlugin de la construction du navigateur (serveur et Edge inchangés). Ce test
 * vérifie que ce retrait reste sans effet :
 *  - dans les dépendances du navigateur, seul @supabase/storage-js cite `Buffer`, et toujours derrière `typeof Buffer` ;
 *  - aucun code de l'application chargé par le navigateur (fichiers « use client » et tout ce qu'ils importent) ne cite
 *    `Buffer` ;
 *  - aucun code du navigateur n'emploie le stockage Supabase (supabase.storage).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const rel = (abs: string): string => path.relative(ROOT, abs).split(path.sep).join('/');

function sources(): string[] {
    const out: string[] = [];
    const walk = (p: string) => {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
            const f = path.join(p, e.name);
            if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(f); } else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(f);
        }
    };
    for (const d of ['app', 'components', 'lib', 'hooks']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
    return out;
}

/** Résolution des imports de l'application (« @/… » et relatifs) ; les paquets sont ignorés. */
function resolveImport(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
}

/** Code (sans commentaires) : une mention de `Buffer` dans un commentaire ne compte pas. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');

describe('lot poids — pas de polyfill Buffer dans le navigateur', () => {
    test('next.config.mjs retire Buffer du ProvidePlugin de la construction du navigateur seulement', () => {
        const conf = read('next.config.mjs');
        assert.match(conf, /if \(!isServer\) \{\n\s+for \(const plugin of config\.plugins\) \{\n\s+if \(plugin\?\.constructor\?\.name === 'ProvidePlugin' && plugin\.definitions && 'Buffer' in plugin\.definitions\) \{\n\s+delete plugin\.definitions\.Buffer;/);
        assert.doesNotMatch(conf, /delete plugin\.definitions\.process/, 'process (petit) reste fourni');
    });

    test('dépendances du navigateur : seul @supabase/storage-js cite Buffer, toujours derrière typeof Buffer', () => {
        const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
        const serveur = new Set(['next', 'sharp', 'web-push', 'react', 'react-dom']);
        const paquets = [...Object.keys(pkg.dependencies).filter((d) => !serveur.has(d)),
            '@supabase/auth-js', '@supabase/postgrest-js', '@supabase/realtime-js', '@supabase/storage-js', '@supabase/functions-js',
            '@supabase/phoenix', 'iceberg-js', 'cookie', 'tslib'];
        const trouves: string[] = [];
        for (const d of paquets) {
            const root = path.join(ROOT, 'node_modules', d);
            if (!fs.existsSync(root)) continue;
            const walk = (p: string) => {
                for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                    const f = path.join(p, e.name);
                    if (e.isDirectory()) { if (!['node_modules', 'test', 'tests', 'umd'].includes(e.name)) walk(f); } else if (/\.(m?js|cjs)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
                        const src = fs.readFileSync(f, 'utf8');
                        if (!/\bBuffer\b/.test(src)) continue;
                        trouves.push(`${d}/${path.relative(root, f).split(path.sep).join('/')}`);
                        if (d === '@supabase/storage-js') {
                            for (const ligne of src.split('\n').filter((l) => /\bBuffer\b/.test(l))) {
                                assert.match(ligne, /if \(typeof Buffer !== "undefined"\) return Buffer\.from\(data\)\.toString\("base64"\);/, `${f} : Buffer sans garde`);
                            }
                        }
                    }
                }
            };
            walk(root);
        }
        assert.deepEqual(trouves.sort(), ['@supabase/storage-js/dist/index.cjs', '@supabase/storage-js/dist/index.mjs']);
    });

    test('aucun code de l\'application chargé par le navigateur ne cite Buffer', () => {
        const fichiers = sources();
        const clients = fichiers.filter((f) => /^\s*['"]use client['"]/m.test(fs.readFileSync(f, 'utf8').slice(0, 400)));
        assert.ok(clients.length > 100, `${clients.length} fichiers « use client »`);
        const vus = new Set<string>();
        const pile = [...clients];
        while (pile.length > 0) {
            const f = pile.pop() as string;
            if (vus.has(f)) continue;
            vus.add(f);
            const src = code(fs.readFileSync(f, 'utf8'));
            for (const m of src.matchAll(/(?:import|export)\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
                if (/^(?:import|export)\s+type\b/.test(m[0])) continue;
                const r = resolveImport(f, m[1] ?? m[2]);
                if (r && !vus.has(r)) pile.push(r);
            }
        }
        const fautifs = [...vus].filter((f) => /\bBuffer\b/.test(code(fs.readFileSync(f, 'utf8')))).map(rel);
        assert.deepEqual(fautifs, [], `Buffer cité par du code du navigateur : ${fautifs.join(', ')}`);
    });

    test('aucun code du navigateur n\'emploie le stockage Supabase (supabase.storage)', () => {
        const fautifs = sources().filter((f) => {
            const src = fs.readFileSync(f, 'utf8');
            return /^\s*['"]use client['"]/m.test(src.slice(0, 400)) && /\.storage\b/.test(code(src));
        }).map(rel);
        assert.deepEqual(fautifs, []);
    });
});
