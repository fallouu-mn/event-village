/**
 * Finition 5 (point 1) — outillage du thème sombre des captures et du contrôle responsive (sans base ni navigateur).
 *
 * Cause du défaut (depuis le design 1a, 17/11) : e2e/auth.setup.ts connectait les comptes en thème clair ; ThemeProvider
 * recopiait ce choix dans le cookie `ev-theme=light`, enregistré avec la session (storageState) ; le cookie l'emportait
 * ensuite sur localStorage['ev-theme'] posé par e2e/support/fixtures.ts (ordre de THEME_BOOT_SCRIPT, lib/theme.ts) :
 * toutes les variantes « sombre » des pages connectées sortaient en clair.
 * Correctif : (1) le cookie n'est plus enregistré avec la session ; (2) prepareContext pose le cookie du thème demandé ;
 * (3) preuve sur la page : classe `dark` de <html> et fond calculé de <body>, contrôle BLOQUANT dans les captures et le
 * contrôle responsive (e2e/support/theme-check.ts).
 * Plus : ligne « ci-captures: oui » (avec « ci-responsive: oui ») = captures sombres en mode rapide, dans le job responsive.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { THEME_BOOT_SCRIPT } from '../../lib/theme';
import { relativeLuminance, themeProblem, THEME_LUMINANCE } from '../../e2e/support/theme-check';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** Valeur RVB « r g b » d'un jeton de app/globals.css, dans :root ou .dark. */
function token(bloc: ':root' | '.dark', name: string): [number, number, number] {
    const css = read('app/globals.css');
    const start = css.indexOf(bloc === ':root' ? '  :root {' : '  .dark {');
    const body = css.slice(start, css.indexOf('\n  }', start));
    const m = new RegExp(`--${name}: (\\d+) (\\d+) (\\d+);`).exec(body);
    assert.ok(m, `jeton --${name} absent de ${bloc}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe('finition 5 — thème sombre vraiment affiché dans les captures', () => {
    test('le script anti-flash lit le cookie AVANT localStorage (cause du défaut)', () => {
        const cookieAt = THEME_BOOT_SCRIPT.indexOf('document.cookie');
        const storageAt = THEME_BOOT_SCRIPT.indexOf("localStorage.getItem('ev-theme')");
        assert.ok(cookieAt > 0 && storageAt > cookieAt, 'cookie lu en premier : il doit donc porter le thème du test');
    });

    test('connexion des rôles : le cookie du thème n’est plus enregistré avec la session', () => {
        const setup = read('e2e/auth.setup.ts');
        const clear = setup.indexOf("await context.clearCookies({ name: 'ev-theme' });");
        const save = setup.indexOf('await context.storageState({ path: storageStatePath(role.key) });');
        assert.ok(clear > 0 && save > clear, 'cookie ev-theme retiré juste avant l’enregistrement de l’état de connexion');
    });

    test('chaque contexte reçoit le cookie du thème demandé (même nom, hôte de l’application)', () => {
        const fixtures = read('e2e/support/fixtures.ts');
        const fn = fixtures.slice(fixtures.indexOf('export async function prepareContext'), fixtures.indexOf('interface Fixtures'));
        assert.match(fn, /await context\.addCookies\(\[\{ name: 'ev-theme', value: EV_THEME_VALUE\[theme\], url: e2eConfig\(\)\.appUrl, sameSite: 'Lax' \}\]\);/);
        assert.match(fn, /await context\.addInitScript\(setThemeBeforeLoad, EV_THEME_VALUE\[theme\]\);/, 'localStorage toujours posé');
        assert.match(fixtures, /await prepareContext\(context, evTheme\);/, 'fixture des captures et du responsive');
    });

    test('preuve lue sur la page : bloquante dans les captures et dans le contrôle responsive (chaque largeur)', () => {
        const captures = read('e2e/captures.spec.ts');
        assert.match(captures, /record\.themeLu = await readTheme\(page\);\n\s*const themeIssue = themeProblem\(record\.themeLu, theme\.key\);\n\s*if \(themeIssue\) record\.blocking\.push\(themeIssue\);/);
        const responsive = read('e2e/responsive.spec.ts');
        assert.match(responsive, /const themeIssue = themeProblem\(await readTheme\(page\), theme\.key, at\);\n\s*if \(themeIssue\) blocking\.push\(themeIssue\);/);
        assert.match(responsive, /record\.sizes\.push\(\{ size: at, blocking,/, 'le défaut de thème entre dans les contrôles bloquants de la largeur');
    });

    test('luminance : fonds de la charte reconnus, page claire en « sombre » refusée et inversement', () => {
        assert.equal(relativeLuminance('rgb(255, 255, 255)'), 1);
        assert.equal(relativeLuminance('rgb(0, 0, 0)'), 0);
        assert.equal(relativeLuminance('rgba(0, 0, 0, 0)'), null, 'transparent : illisible');
        assert.equal(relativeLuminance('n’importe quoi'), null);
        const fond = (bloc: ':root' | '.dark') => `rgb(${token(bloc, 'background').join(', ')})`;
        const sombre = { darkClass: true, background: fond('.dark'), luminance: relativeLuminance(fond('.dark')), choice: 'dark' };
        const clair = { darkClass: false, background: fond(':root'), luminance: relativeLuminance(fond(':root')), choice: 'light' };
        assert.equal(themeProblem(sombre, 'sombre'), null, `fond sombre de la charte (${sombre.background}) ≤ ${THEME_LUMINANCE.sombreMax}`);
        assert.equal(themeProblem(clair, 'clair'), null);
        // Le défaut d'avant : page claire capturée sous « sombre »
        assert.match(String(themeProblem(clair, 'sombre', '360 px')), /^thème sombre demandé mais page affichée en clair \(360 px\) : classe dark absente, choix « light »/);
        assert.match(String(themeProblem(sombre, 'clair')), /^thème clair demandé mais page affichée en sombre/);
        // Classe posée mais fond resté clair (couleur en dur sur body) : refusé aussi
        assert.ok(themeProblem({ ...clair, darkClass: true }, 'sombre'));
    });

    test('ligne « ci-captures: oui » : captures SOMBRES dans le job responsive du mode rapide, résultats publiés', () => {
        const yml = read('.github/workflows/verify.yml');
        // Run 590 : un « \n » devenu vrai retour à la ligne rendait le workflow illisible (aucun job lancé)
        const { load } = createRequire(path.join(ROOT, 'package.json'))('js-yaml') as { load: (text: string) => unknown };
        const doc = load(yml) as { jobs: { responsive: { steps: Array<{ id?: string; env?: Record<string, string> }> } } };
        assert.equal(doc.jobs.responsive.steps.find((s) => s?.id === 'captures-sombres')?.env?.EV_CAPTURES_THEMES, 'sombre', 'verify.yml lisible (YAML)');
        assert.match(yml, /grep -qE '\^ci-captures:\[\[:space:\]\]\*oui\[\[:space:\]\]\*\$'/);
        assert.match(yml, /\n {6}captures: \$\{\{ steps\.mode\.outputs\.captures \}\}\n/);
        const job = yml.slice(yml.indexOf('\n  responsive:\n'), yml.indexOf('\n  verdict:\n'));
        const step = job.slice(job.indexOf('id: captures-sombres'), job.indexOf('- *diagnostic'));
        assert.match(step, /needs\.mode\.outputs\.rapide == '1' && needs\.mode\.outputs\.captures == '1'/, 'jamais au run complet');
        assert.match(step, /EV_E2E_PHASES: captures\n/);
        assert.match(step, /EV_CAPTURES_THEMES: sombre\n/);
        assert.match(step, /mv "\/tmp\/resp-bak\/\$d" "\$W\/\$d"/, 'résultats du responsive remis après la phase');
        assert.doesNotMatch(step, /continue-on-error/);
        const captures = read('e2e/captures.spec.ts');
        assert.match(captures, /process\.env\.EV_CAPTURES_THEMES/);
        assert.match(captures, /const THEMES = WANTED_THEMES\.length > 0 \? ALL_THEMES\.filter/);
        const e2eJob = yml.slice(yml.indexOf('\n  e2e:\n'), yml.indexOf('\n  responsive:\n'));
        assert.doesNotMatch(e2eJob, /EV_CAPTURES_THEMES/, 'run complet : les deux thèmes');
        const verdict = read('scripts/ci-verdict.mjs');
        assert.match(verdict, /copier\(path\.join\(responsive\.dir, 'captures'\), path\.join\(runDir, 'captures'\)\);/);
    });
});
