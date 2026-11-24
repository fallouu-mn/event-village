/**
 * Finition 5 (point 3, consigne du 22/11) — mesure mobile fiable, sans base ni navigateur.
 *
 * Quand le ralentissement calculé dépasse ×6 (ou que l'indice de puissance de la machine sort de la plage habituelle
 * 1 000 à 3 000, ou qu'il est illisible), la tentative Lighthouse est « faussée » et refaite dans le même job, au plus
 * 2 fois ; si elle reste faussée, le verdict dit « MESURE FAUSSÉE, À RELANCER » au lieu de « HORS SEUIL ». Un CLS mesuré
 * ou un toucher hors seuil (ralentissement fixe ×4, indépendant de la calibration) reste un vrai HORS SEUIL.
 * Seuils, calibration (×4 pour un indice de 2 000) et médiane de 5 inchangés ; chaque tentative est gardée au journal.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    MESURE_FIABLE, MIN_PASSAGES_VALIDES, PASSAGES, REFERENCE_CPU, SEUILS, TENTATIVES_TSV_HEADER, calibratedCpuMultiplier, causesMesureFaussee, decisionTentative,
    etatFinal, lighthouseOk, tentativesRows, texteRapport, verdictPage, verdictToucher,
} from '../../scripts/e2e/perf-mobile-seuils.mjs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** Tours de calibration pour une liste d'indices (ralentissement calculé comme le script : calibratedCpuMultiplier). */
const tours = (...indices: Array<number | null>) => indices.map((benchmarkIndex, i) => ({
    tour: i + 1, benchmarkIndex, multiplier: calibratedCpuMultiplier(benchmarkIndex as number),
}));
const lh = (score: number) => ({ score, lcp: 1_000, cls: 0, error: null });
const page = (id: string, scores: number[], reelCls = 0) => ({
    id, libelle: id, lighthouse: scores.map(lh), reel: scores.map(() => ({ cls: reelCls, error: null })),
});
const touches = [{ page: 'p', cible: 'c', eventTimingMs: 50, temoinMs: 60, error: null }];

describe('finition 5 — mesure mobile fiable (mesure faussée refaite)', () => {
    test('seuils, calibration et médiane de 5 INCHANGÉS', () => {
        assert.deepEqual({ ...SEUILS }, { score: 90, lcpMs: 2_500, cls: 0.1, toucherMs: 200 });
        assert.deepEqual({ ...REFERENCE_CPU }, { benchmarkIndex: 2000, multiplier: 4 });
        assert.equal(PASSAGES, 5);
        assert.equal(MIN_PASSAGES_VALIDES, 2);
        assert.equal(calibratedCpuMultiplier(3000), 6, 'indice 3 000 ↔ ×6 : les deux bornes de la règle coïncident');
        assert.deepEqual({ ...MESURE_FIABLE }, { ralentissementMax: 6, indiceMin: 1_000, indiceMax: 3_000, reprisesMax: 2 });
        assert.ok(Object.isFrozen(MESURE_FIABLE) && Object.isFrozen(SEUILS) && Object.isFrozen(REFERENCE_CPU));
    });

    test('faussée : ralentissement > ×6, indice hors [1 000 ; 3 000] ou illisible ; bornes incluses valides', () => {
        assert.deepEqual(causesMesureFaussee(tours(2000, 1996, 3000, 1000, 2500)), [], 'plage habituelle (bornes incluses) : valide');
        // Run 585 : indices 3 682,5 → ×7,37, etc.
        const r585 = causesMesureFaussee(tours(3682.5, 3421.5, 3421.5, 3404, 3593));
        assert.equal(r585.length, 5);
        assert.ok(r585.every((c) => c.sens === 'rapide'));
        assert.match(r585[0].texte, /tour 1 : machine trop rapide, indice 3683 → ralentissement ×7,37/);
        assert.deepEqual(causesMesureFaussee(tours(3001)).map((c) => c.sens), ['rapide']);
        assert.deepEqual(causesMesureFaussee(tours(999)).map((c) => c.sens), ['lent']);
        assert.deepEqual(causesMesureFaussee(tours(null)).map((c) => c.sens), ['illisible']);
        // Un seul tour hors plage suffit
        assert.equal(causesMesureFaussee(tours(2000, 2100, 3200, 2000, 2000)).length, 1);
    });

    test('décision : refaite tant qu’il reste des reprises (2 au plus) ; machine trop rapide ET seuils tenus = acceptée', () => {
        const rapide = tours(3600, 3600, 3600, 3600, 3600);
        assert.deepEqual(
            [1, 2, 3].map((numero) => decisionTentative({ numero, calibrations: rapide, pagesOk: false }).refaire),
            [true, true, false],
            '3 tentatives au plus (1 + 2 reprises)',
        );
        const fin = decisionTentative({ numero: 3, calibrations: rapide, pagesOk: false });
        assert.equal(fin.faussee, true);
        assert.equal(fin.acceptee, false);
        // Plus sévère que la référence et seuils tenus : rien à refaire
        assert.deepEqual(
            (({ faussee, acceptee, refaire }) => ({ faussee, acceptee, refaire }))(decisionTentative({ numero: 1, calibrations: rapide, pagesOk: true })),
            { faussee: true, acceptee: true, refaire: false },
        );
        // Machine trop lente : la mesure est plus indulgente, un bon score n'est pas fiable → refaite
        assert.equal(decisionTentative({ numero: 1, calibrations: tours(800, 2000, 2000, 2000, 2000), pagesOk: true }).refaire, true);
        // Valide : jamais refaite, même hors seuil (vrai défaut de page)
        assert.deepEqual(
            (({ faussee, refaire }) => ({ faussee, refaire }))(decisionTentative({ numero: 1, calibrations: tours(2000, 2000, 2000, 2000, 2000), pagesOk: false })),
            { faussee: false, refaire: false },
        );
    });

    test('verdict final : FAUSSÉE (à relancer) au lieu de HORS SEUIL ; vrais défauts hors calibration restent HORS SEUIL', () => {
        const pagesKo = [page('accueil', [85, 87, 85, 86, 84]), page('fiche', [95, 95, 95, 95, 95])];
        const verdicts = pagesKo.map(verdictPage);
        const derniere = decisionTentative({ numero: 3, calibrations: tours(3600, 3600, 3600, 3600, 3600), pagesOk: false });
        const toucherOk = verdictToucher(touches);
        assert.equal(etatFinal({ pages: verdicts, lighthousePages: pagesKo.map(lighthouseOk), toucher: toucherOk, derniere }), 'FAUSSÉE');
        // Même scores, tentative valide : vrai HORS SEUIL
        const valide = decisionTentative({ numero: 1, calibrations: tours(2000, 2000, 2000, 2000, 2000), pagesOk: false });
        assert.equal(etatFinal({ pages: verdicts, lighthousePages: pagesKo.map(lighthouseOk), toucher: toucherOk, derniere: valide }), 'HORS SEUIL');
        // CLS mesuré hors seuil (×4 fixe) : HORS SEUIL même si la calibration est faussée
        const clsKo = [page('accueil', [85, 85, 85, 85, 85], 0.3)];
        assert.equal(etatFinal({ pages: clsKo.map(verdictPage), lighthousePages: clsKo.map(lighthouseOk), toucher: toucherOk, derniere }), 'HORS SEUIL');
        // Toucher hors seuil : HORS SEUIL
        const toucherKo = verdictToucher([{ page: 'p', cible: 'c', eventTimingMs: 450, temoinMs: 460, error: null }]);
        assert.equal(etatFinal({ pages: verdicts, lighthousePages: pagesKo.map(lighthouseOk), toucher: toucherKo, derniere }), 'HORS SEUIL');
        // Tout tient : OK
        const bon = [page('accueil', [93, 92, 94, 91, 95])];
        assert.equal(etatFinal({ pages: bon.map(verdictPage), lighthousePages: bon.map(lighthouseOk), toucher: toucherOk, derniere }), 'OK');
        // Erreur fatale (Mes billets sur la page de connexion) : HORS SEUIL
        const fatal = [{ ...page('mes-billets', [85, 85, 85, 85, 85]), fatal: 'session perdue' }];
        assert.equal(etatFinal({ pages: fatal.map(verdictPage), lighthousePages: fatal.map(lighthouseOk), toucher: toucherOk, derniere }), 'HORS SEUIL');
    });

    test('rapport lisible : « MESURE FAUSSÉE, À RELANCER », jamais « HORS SEUIL » pour les mesures Lighthouse ; chaque tentative listée', () => {
        const pagesKo = [page('accueil', [85, 87, 85, 86, 84])];
        const cal = tours(3682.5, 3421.5, 3421.5, 3404, 3593);
        const tentatives = [1, 2, 3].map((numero) => ({
            decision: decisionTentative({ numero, calibrations: cal, pagesOk: false }),
            calibrations: cal,
            scores: { accueil: [85, 87, 85, 86, 84] },
        }));
        const r = texteRapport({ pages: pagesKo.map(verdictPage), toucher: verdictToucher(touches), etat: 'FAUSSÉE', tentatives });
        assert.equal(r.ok, false, 'le job reste rouge : rien n’est prouvé');
        assert.equal(r.etat, 'FAUSSÉE');
        assert.match(r.texte, /^MESURE FAUSSÉE, À RELANCER/m);
        assert.match(r.texte, /^VERDICT : MESURE FAUSSÉE, À RELANCER/m);
        assert.doesNotMatch(r.texte, /HORS SEUIL/, 'aucune conclusion « hors seuil »');
        assert.match(r.texte, /tentative 1 : FAUSSÉE, refaite/);
        assert.match(r.texte, /tentative 2 : FAUSSÉE, refaite/);
        assert.match(r.texte, /tentative 3 : FAUSSÉE, plus de reprise/);
        // Journal : une ligne par tour de chaque tentative
        const rows = tentativesRows(tentatives);
        assert.equal(rows.length, 15);
        const cols = TENTATIVES_TSV_HEADER.split('\t').length;
        assert.ok(rows.every((l) => l.split('\t').length === cols));
        assert.deepEqual(rows[0].split('\t').slice(0, 5), ['1', '1', '3683', '7.37', 'faussé']);
        assert.match(rows[0], /accueil 85/);
        assert.match(rows[14], /faussée : plus de reprise$/);
        // Sans état fourni : comportement d'origine (rapports du design 1b)
        assert.match(texteRapport({ pages: pagesKo.map(verdictPage), toucher: verdictToucher(touches) }).texte, /^VERDICT : HORS SEUIL/m);
    });

    test('script : boucle des tentatives, reprise seulement si le temps le permet, journal tentatives.tsv, annotation « à relancer »', () => {
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /for \(let numero = 1; numero <= MESURE_FIABLE\.reprisesMax \+ 1; numero\+\+\)/);
        assert.match(script, /decisionTentative\(\{ numero, calibrations: /);
        assert.match(script, /if \(!decision\.refaire\) break;/);
        assert.match(script, /remaining\(\) < besoin/);
        assert.match(script, /'tentatives\.tsv'/);
        assert.match(script, /'lighthouse-tentatives\.tsv'/);
        assert.match(script, /::error title=Mesure mobile faussée, à relancer::/);
        // Calibration et seuils : mêmes appels qu'avant (aucune autre source)
        assert.match(script, /cpuSlowdownMultiplier = calibratedCpuMultiplier\(cal\.benchmarkIndex\)/);
        assert.match(script, /etatFinal\(\{ pages: verdicts/);
        // Étape de la CI : délai inchangé (15 min), toujours bloquante
        const yml = read('.github/workflows/verify.yml');
        const step = yml.slice(yml.indexOf('id: perf-mobile\n'), yml.indexOf('node scripts/e2e/perf-mobile.mjs'));
        assert.match(step, /timeout-minutes: 15\n/);
        assert.doesNotMatch(step, /continue-on-error/);
        // Résumé du run : état de la mesure (faussee-a-relancer) et nombre de tentatives
        const verdict = read('scripts/ci-verdict.mjs');
        assert.match(verdict, /r\.verdict === 'FAUSSÉE' \? 'faussee-a-relancer'/);
        assert.match(verdict, /perf_mobile_tentatives=/);
    });

    test('run 602 : reprise non lancée faute de temps dite telle quelle (jamais « refaite ») ; 2 min gardées pour la suite', () => {
        const cal = tours(3600, 3600, 3600, 3600, 3600);
        const t1 = { decision: decisionTentative({ numero: 1, calibrations: cal, pagesOk: false }), calibrations: cal, scores: { accueil: [85, 85, 85, 85, 85] } };
        const t2decision = { ...decisionTentative({ numero: 2, calibrations: cal, pagesOk: false }), refaire: false, sansTemps: true };
        const t2 = { decision: t2decision, calibrations: cal, scores: { accueil: [85, 85, 85, 85, 85] } };
        const tentatives = [t1, t2];
        const r = texteRapport({ pages: [verdictPage(page('accueil', [85, 85, 85, 85, 85]))], toucher: verdictToucher(touches), etat: 'FAUSSÉE', tentatives });
        assert.match(r.texte, /tentative 1 : FAUSSÉE, refaite/);
        assert.match(r.texte, /tentative 2 : FAUSSÉE, reprise non lancée \(temps insuffisant dans le délai de l’étape\)/);
        assert.match(tentativesRows(tentatives).at(-1) ?? '', /faussée : reprise non lancée \(temps insuffisant\)$/);
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /const RESERVE_SUITE_MS = 120_000;/);
        assert.match(script, /last\.decision = \{ \.\.\.last\.decision, refaire: false, sansTemps: true \};/);
    });

    test('interrupteur de preuve EV_PERF_PREUVE_FAUSSEE : décision de la tentative 1 seulement, jamais posé par la CI', () => {
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /process\.env\.EV_PERF_PREUVE_FAUSSEE === '1' && numero === 1/);
        assert.match(script, /! PREUVE \(EV_PERF_PREUVE_FAUSSEE=1\)/, 'toujours écrit dans le rapport');
        for (const f of fs.readdirSync(path.join(ROOT, '.github', 'workflows'))) {
            assert.doesNotMatch(read(`.github/workflows/${f}`), /EV_PERF_PREUVE_FAUSSEE/, `${f} ne doit pas poser l’interrupteur de preuve`);
        }
    });
});
