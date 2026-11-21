/**
 * Design 1e (vitesse) — mesure mobile en mode rapide : ligne « ci-perf: oui » du message du commit (contrôle statique).
 *  - le job « perf » ne tourne qu'en mode rapide et sur demande ; au run complet, la mesure reste l'étape bloquante du
 *    job e2e (inchangée) ;
 *  - mêmes étapes que le job e2e (ancres YAML), la seule phase « connexion », puis le même script de mesure : mêmes
 *    seuils, même calibration (perf-mobile-seuils.mjs n'est pas touché par ce job) ;
 *  - requis par le verdict quand il est demandé ; ses mesures sont publiées aux mêmes noms (perf/, js-budget.tsv).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

describe('design 1e — mesure mobile en mode rapide (ci-perf)', () => {
    const yml = read('.github/workflows/verify.yml');
    const job = yml.slice(yml.indexOf('\n  perf:\n'), yml.indexOf('\n  verdict:\n'));

    test('ligne « ci-perf: oui » lue par le job mode, sortie perf', () => {
        assert.match(yml, /grep -qE '\^ci-perf:\[\[:space:\]\]\*oui\[\[:space:\]\]\*\$'/);
        assert.match(yml, /\n {6}perf: \$\{\{ steps\.mode\.outputs\.perf \}\}\n/);
        assert.match(yml, /echo "perf=0" >> "\$GITHUB_OUTPUT"/);
    });

    test('job « perf » : mode rapide et demande seulement', () => {
        assert.ok(job.length > 200, 'job perf présent avant le verdict');
        assert.match(job, /if: \$\{\{ needs\.mode\.outputs\.rapide == '1' && needs\.mode\.outputs\.perf == '1' \}\}/);
        assert.doesNotMatch(job, /continue-on-error/);
    });

    test('mêmes étapes que le job e2e, phase « connexion » seule, même script de mesure', () => {
        for (const ancre of ['build', 'e2e-seed', 'e2e-start', 'e2e-env', 'e2e-chromium', 'e2e-seed-lance', 'e2e-jwt']) {
            assert.match(job, new RegExp(`\\n {6}- \\*${ancre}\\n`), `étape *${ancre}`);
        }
        assert.match(job, /EV_E2E_PHASES: connexion\n/);
        assert.match(job, /node scripts\/e2e\/perf-mobile\.mjs 2>&1 \| tee \/tmp\/perf-mobile\.log/);
        assert.match(job, /node scripts\/verify\.mjs --etapes js-budget/);
        assert.match(job, /timeout-minutes: 15\n/);
    });

    test('profil processeur : diagnostic du job perf seulement, après la mesure, hors verdict', () => {
        const i = job.indexOf('node scripts/e2e/perf-mobile.mjs');
        const j = job.indexOf('node scripts/e2e/perf-profil.mjs');
        assert.ok(i > 0 && j > i, 'profil lancé après la mesure');
        assert.doesNotMatch(read('scripts/e2e/perf-profil.mjs'), /perf-mobile-seuils/, 'le profil ne touche ni aux seuils ni aux verdicts');
        const e2eJob = yml.slice(yml.indexOf('\n  e2e:\n'), yml.indexOf('\n  responsive:\n'));
        assert.doesNotMatch(e2eJob, /perf-profil/, 'jamais dans le job e2e du run complet');
    });

    test('au run complet, la mesure reste dans le job e2e (étape bloquante inchangée)', () => {
        const e2eJob = yml.slice(yml.indexOf('\n  e2e:\n'), yml.indexOf('\n  responsive:\n'));
        assert.match(e2eJob, /- name: "E2E : performance mobile mesurée \(Lighthouse ≥ 90, LCP < 2,5 s, CLS < 0,1, toucher < 200 ms\)"/);
        assert.match(e2eJob, /if: \$\{\{ needs\.mode\.outputs\.rapide == '0' \}\}/);
    });

    test('requis par le verdict quand il est demandé ; mesures publiées aux mêmes noms', () => {
        assert.match(yml, /needs: \[mode, rapide, qualite, tests, e2e, responsive, perf\]/);
        const verdict = read('scripts/ci-verdict.mjs');
        assert.match(verdict, /const avecPerf = rapide && needs\.mode\?\.outputs\?\.perf === '1';/);
        assert.match(verdict, /\.\.\.\(avecPerf \? \['perf'\] : \[\]\)/);
        assert.match(verdict, /copier\(path\.join\(perfJob\.dir, 'perf'\), path\.join\(runDir, 'perf'\)\);/);
        assert.match(verdict, /copier\(path\.join\(perfJob\.dir, 'js-budget\.tsv'\), path\.join\(runDir, 'js-budget\.tsv'\)\);/);
    });

    test('seuils et calibration inchangés (90, 2,5 s, 0,1, 200 ms ; ×4 pour un indice de 2 000 ; 5 passages)', async () => {
        const s = await import('../../scripts/e2e/perf-mobile-seuils.mjs');
        assert.deepEqual({ ...s.SEUILS }, { score: 90, lcpMs: 2_500, cls: 0.1, toucherMs: 200 });
        assert.deepEqual({ ...s.REFERENCE_CPU }, { benchmarkIndex: 2000, multiplier: 4 });
        assert.equal(s.PASSAGES, 5);
    });
});
