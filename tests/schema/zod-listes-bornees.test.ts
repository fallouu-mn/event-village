/**
 * Lot 9 sexies — faille trouvée avant la mise à jour : déni de service par une liste trop longue (GHSA-mrhx-c7xc-m3w5).
 *
 * Zod accumule une erreur par élément invalide d'une liste. Mesure faite sur la zod 3.25.76 du dépôt : une liste
 * de 200 000 éléments invalides (environ 400 Ko de JSON) donnait 200 001 erreurs et une soixantaine de Mo de tas,
 * MÊME avec `.max(10)` : zod 3 continue d'examiner chaque élément après le refus de la longueur. Toute route qui
 * valide une liste venue d'une requête pouvait ainsi épuiser la mémoire du processus.
 *
 * Correctif : zod 4.6.6 ou plus récent, qui s'arrête au refus de la longueur, ET une borne (`.max` ou `.length`)
 * sur chaque liste des schémas de l'application. Sans base : ni écriture, ni invariants (signalé).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_DIRS = ['app', 'lib', 'components'];

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            out.push(...sourceFiles(full));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Méthodes appliquées en chaîne à l'appel `z.array(…)` : z.array(x).min(1).max(5).optional() → [min, max, optional]. */
function chainedMethods(call: ts.CallExpression): string[] {
    const names: string[] = [];
    let node: ts.Node = call;
    while (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
        && ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent) {
        names.push(node.parent.name.text);
        node = node.parent.parent;
    }
    return names;
}

function unboundedArrays(): { where: string; chain: string[] }[] {
    const found: { where: string; chain: string[] }[] = [];
    for (const dir of SOURCE_DIRS) {
        for (const file of sourceFiles(path.join(ROOT, dir))) {
            const text = fs.readFileSync(file, 'utf8');
            if (!text.includes('z.array(')) continue;
            const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
            const visit = (node: ts.Node): void => {
                if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
                    && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'z'
                    && node.expression.name.text === 'array') {
                    const chain = chainedMethods(node);
                    if (!chain.includes('max') && !chain.includes('length')) {
                        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                        found.push({ where: `${path.relative(ROOT, file).replace(/\\/g, '/')}:${line + 1}`, chain });
                    }
                }
                ts.forEachChild(node, visit);
            };
            visit(sf);
        }
    }
    return found;
}

describe('Lot 9 sexies — listes bornées contre l’épuisement de mémoire (GHSA-mrhx-c7xc-m3w5)', () => {
    test('zod installée en 4.6.6 ou plus récent', () => {
        const version = JSON.parse(fs.readFileSync(require.resolve('zod/package.json'), 'utf8')).version as string;
        const [major, minor, patch] = version.split('.').map((n) => Number.parseInt(n, 10));
        const recent = major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));
        assert.ok(recent, `zod ${version} : la correction de GHSA-mrhx-c7xc-m3w5 arrive en 4.6.6`);
    });

    test('une liste bornée trop longue donne UNE erreur, pas une par élément', () => {
        const n = 200_000;
        const schemas: [string, z.ZodTypeAny, unknown][] = [
            ['liste de textes, .max(10)', z.array(z.string()).max(10), new Array(n).fill(0)],
            ['champ liste d’identifiants, .min(1).max(50)', z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).strict(), { ids: new Array(n).fill(0) }],
            ['liste d’objets, .max(20)', z.array(z.object({ id: z.string() })).max(20), new Array(n).fill(0)],
        ];
        for (const [label, schema, input] of schemas) {
            const started = Date.now();
            const parsed = schema.safeParse(input);
            const elapsed = Date.now() - started;
            assert.equal(parsed.success, false, `${label} : refus attendu`);
            const issues = parsed.success ? [] : parsed.error.issues;
            assert.equal(issues.length, 1, `${label} : ${issues.length} erreur(s) pour ${n} éléments (une seule attendue : le refus de la longueur)`);
            assert.equal(issues[0].code, 'too_big', `${label} : refus de la longueur attendu (${JSON.stringify(issues[0])})`);
            assert.ok(elapsed < 1000, `${label} : ${elapsed} ms`);
        }
    });

    test('chaque z.array(…) de app/, lib/ et components/ a une borne (.max ou .length)', () => {
        const unbounded = unboundedArrays();
        assert.deepEqual(unbounded, [], `listes sans borne :\n${unbounded.map((u) => `${u.where} (chaîne : ${u.chain.join('.') || 'aucune'})`).join('\n')}`);
    });
});
