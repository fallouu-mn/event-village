/**
 * Lot 1C.6 — plus de mot de passe ni de secret codé en dur dans les fichiers suivis par git.
 *  - scratch/ (scripts ad hoc visant le projet distant) et tests/exploit-before.ts sont supprimés ;
 *  - aucun mot de passe littéral dans tests/ ni scripts/ : les tests passent par les constantes
 *    de fixtures (TEST_PASSWORD, STRONG_PASSWORD), les suites legacy par l'environnement ;
 *  - aucun secret de repli littéral dans le code serveur (process.env.X || '…').
 * Les valeurs ne figurent jamais dans ce test : seules des règles de forme sont vérifiées.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function tracked(...paths: string[]): string[] {
    const out = execFileSync('git', ['ls-files', '--', ...paths], { encoding: 'utf8' });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Définitions autorisées des constantes de mot de passe des fixtures locales. */
const ALLOWED_DEFINITIONS = new Set(['tests/helpers/fixture-data.ts', 'tests/parcours/helpers.ts']);

describe('Secrets codés en dur', () => {
    test('scratch/ et tests/exploit-before.ts ne sont plus suivis', () => {
        assert.deepEqual(tracked('scratch'), [], 'fichiers scratch/ encore suivis par git');
        assert.deepEqual(tracked('tests/exploit-before.ts'), [], 'tests/exploit-before.ts encore suivi par git');
    });

    test('aucun mot de passe littéral dans tests/ et scripts/', () => {
        const offenders: string[] = [];
        for (const f of tracked('tests', 'scripts').filter((p) => /\.(ts|tsx|js|mjs|cjs)$/.test(p) && fs.existsSync(p))) {
            if (ALLOWED_DEFINITIONS.has(f)) continue;
            fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
                for (const m of Array.from(line.matchAll(/\b\w*[Pp]assword\w*\s*[:=]\s*(['"`])([^'"`]{6,})\1/g))) {
                    if (m[2].includes('${')) continue; // valeur générée (gabarit)
                    offenders.push(`${f}:${i + 1}`);
                }
            });
        }
        assert.deepEqual(offenders, [], `mots de passe littéraux (valeurs non affichées) :\n${offenders.join('\n')}`);
    });

    test('aucun secret de repli littéral dans le code serveur', () => {
        const offenders: string[] = [];
        for (const f of tracked('app', 'lib', 'middleware.ts').filter((p) => /\.(ts|tsx)$/.test(p) && fs.existsSync(p))) {
            fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
                if (/process\.env\.\w*(SECRET|KEY|SALT|PASSWORD|TOKEN)\w*[^;\n]*(\|\||\?\?)\s*(['"`])[^'"`]{6,}\3/.test(line)) offenders.push(`${f}:${i + 1}`);
            });
        }
        assert.deepEqual(offenders, [], `secrets de repli littéraux (valeurs non affichées) :\n${offenders.join('\n')}`);
    });
});
