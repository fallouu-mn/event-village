/**
 * Lot 8 (AR12, contrat 18.4) — ordre réel des suites : celles qui créent des porteurs en masse passent après la
 * dernière suite temps réel. Au run 88, ces écritures massives ralentissent le lecteur de changements de Realtime
 * jusqu'à son annulation (PoolingReplicationError) ; scripts/run-tests.mjs les déplace, mais il ne reconnaît qu'un
 * import nommé dans la suite elle-même. Ce test formalise la règle sur la sortie réelle de `--list`, avec son
 * propre repérage (oracle écrit à part : aucun motif n'est lu dans le lanceur).
 *
 * Trois règles : (1) une suite lourde, directe ou par une aide, passe après la dernière suite temps réel ; (2) une
 * suite de tests/parcours qui écrit des billets par generate_series compte comme lourde : elle doit passer par
 * massHolders ; (3) ce fichier n'entre dans aucune des deux classes, sinon il déplacerait lui-même l'ordre.
 *
 * Sans base : vert dès l'écriture, annoncé. Écart signalé : aucune écriture, donc aucun appel d'invariants.
 * Ne pas écrire ici en clair un appel d'abonnement ni un import nommé de l'aide : le lanceur lit le texte brut,
 * commentaires compris, et classerait cette suite (règle 3).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SELF = 'tests/schema/ordre-suites.test.ts';
const HELPER = 'massHolders';
const HELPER_HOME = 'tests/parcours/terrain-helpers.ts';

/** Suites réelles, dans l'ordre du lanceur (la ligne de note et le total sont écartés). */
function listedSuites(): string[] {
    const out = execFileSync(process.execPath, ['scripts/run-tests.mjs', '--list'], { cwd: ROOT, encoding: 'utf8' });
    return out.split(/\r?\n/).filter((line) => /^tests\/.*\.test\.ts$/.test(line));
}

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Retire les commentaires : une mention dans un commentaire ne rend pas une suite lourde. */
function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Lecture brute, comme le lanceur : une suite temps réel est classée sur son texte, commentaires compris. */
function isRealtime(source: string): boolean {
    return /\bsubscribeCollect\s*\(/.test(source) || /\.channel\s*\(/.test(source);
}

function importsHelperByName(source: string): boolean {
    return Array.from(source.matchAll(/\bimport\s*(?:type\s+)?\{([^}]*)\}\s*from\b/g))
        .some((m) => m[1].split(',').some((part) => part.trim().split(/\s+/)[0] === HELPER));
}

function callsHelper(source: string): boolean {
    return new RegExp(`\\b${HELPER}\\s*\\(`).test(source);
}

/** Modules relatifs importés par une source, résolus depuis `from` (chemin relatif à la racine, séparateur /). */
function relativeImports(source: string, from: string): string[] {
    const dir = path.posix.dirname(from);
    const out: string[] = [];
    for (const m of Array.from(source.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g))) out.push(`${path.posix.normalize(path.posix.join(dir, m[1]))}.ts`);
    return out;
}

function writesTicketsInBulk(source: string): boolean {
    return /generate_series/i.test(source) && /INSERT\s+INTO\s+public\.tickets/i.test(source);
}

/** Aides de tests/ (hors suites, hors legacy) qui appellent l'aide de masse ; sa définition n'en fait pas partie. */
function helpersCallingBulk(): Set<string> {
    const found = new Set<string>();
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${entry.name}`;
            if (entry.isDirectory()) {
                if (entry.name !== 'legacy') walk(rel);
            } else if (rel.endsWith('.ts') && !rel.endsWith('.test.ts') && rel !== HELPER_HOME) {
                if (callsHelper(withoutComments(read(rel)))) found.add(rel);
            }
        }
    };
    walk('tests');
    return found;
}

function isHeavy(rel: string, source: string, bulkHelpers: ReadonlySet<string>): boolean {
    const code = withoutComments(source);
    return importsHelperByName(code)
        || (rel.startsWith('tests/parcours/') && writesTicketsInBulk(code))
        || relativeImports(code, rel).some((m) => bulkHelpers.has(m));
}

describe('Lot 8 — ordre des suites : les écritures massives après la dernière suite temps réel', () => {
    test('repérage : chaque motif est reconnu, une simple mention ne compte pas', () => {
        const subscribe = ['client', '.chan', 'nel', '("x")'].join('');
        const collect = ['subscribe', 'Collect', '(db, "t")'].join('');
        assert.ok(isRealtime(subscribe) && isRealtime(collect), 'les deux formes d’abonnement sont repérées');
        assert.ok(!isRealtime('const canal = "stock";'), 'un texte quelconque n’est pas une suite temps réel');

        const named = ['imp', 'ort { assertTerrainInvariants, ', HELPER, ' } from ', '"./terrain-helpers";'].join('');
        assert.ok(importsHelperByName(named), 'import nommé repéré');
        assert.ok(!importsHelperByName(named.replace(HELPER, `${HELPER}Bis`)), 'un autre nom n’est pas l’aide de masse');
        assert.ok(!isHeavy('tests/parcours/x.test.ts', `/* ${named} */`, new Set()), 'un commentaire qui la cite ne rend pas une suite lourde');
        assert.ok(isHeavy('tests/parcours/x.test.ts', named, new Set()), 'suite directe');

        const viaHelper = ['imp', 'ort { foo } from ', '"./aide-lourde";'].join('');
        assert.ok(isHeavy('tests/parcours/x.test.ts', viaHelper, new Set(['tests/parcours/aide-lourde.ts'])), 'suite lourde par une aide intermédiaire');
        assert.ok(!isHeavy('tests/parcours/x.test.ts', viaHelper, new Set(['tests/parcours/autre.ts'])), 'une autre aide ne compte pas');

        const bulk = 'INSERT INTO public.tickets (id) SELECT gen_random_uuid() FROM generate_series(1, 10)';
        assert.ok(isHeavy('tests/parcours/x.test.ts', `db.query(\`${bulk}\`)`, new Set()), 'écriture massive de billets en tests/parcours');
        assert.ok(!isHeavy('tests/security/x.test.ts', `db.query(\`${bulk}\`)`, new Set()), 'la règle generate_series vise tests/parcours');
    });

    test('toute suite lourde, directe ou par une aide, passe après la dernière suite temps réel', () => {
        const suites = listedSuites();
        assert.ok(suites.length > 100, `liste du lanceur inattendue : ${suites.length} suite(s)`);
        assert.ok(suites.includes(SELF), `${SELF} absente de --list`);

        const bulkHelpers = helpersCallingBulk();
        const sources = new Map(suites.map((s) => [s, read(s)]));
        const realtime = suites.filter((s) => isRealtime(sources.get(s)!));
        const heavy = suites.filter((s) => isHeavy(s, sources.get(s)!, bulkHelpers));
        assert.ok(realtime.length > 0, 'aucune suite temps réel repérée : le contrôle serait vide');
        assert.ok(heavy.length > 0, 'aucune suite lourde repérée : le contrôle serait vide');

        const lastRealtime = suites.indexOf(realtime[realtime.length - 1]);
        const misplaced = heavy.filter((s) => suites.indexOf(s) < lastRealtime);
        assert.deepEqual(misplaced, [], `suites lourdes avant la dernière suite temps réel (${suites[lastRealtime]}) : ${misplaced.join(', ')}`);
        console.log(`[ORDRE-SUITES] ${suites.length} suites, ${realtime.length} temps réel, dernière ${suites[lastRealtime]} ; lourdes : ${heavy.join(', ')}`);
    });

    test('toute écriture massive de billets en tests/parcours passe par l’aide que le lanceur reconnaît', () => {
        const direct = listedSuites().filter((s) => {
            const code = withoutComments(read(s));
            return s.startsWith('tests/parcours/') && writesTicketsInBulk(code) && !importsHelperByName(code);
        });
        assert.deepEqual(direct, [], `suites à écriture massive que le lanceur ne déplacera pas (règle massHolders de scripts/run-tests.mjs) : ${direct.join(', ')}`);
    });

    test('cette suite n’est classée ni temps réel ni lourde par le lanceur', () => {
        const own = read(SELF);
        assert.ok(!isRealtime(own), `${SELF} serait classée temps réel : elle déplacerait les suites lourdes`);
        assert.ok(!importsHelperByName(own), `${SELF} serait classée lourde`);
    });
});
