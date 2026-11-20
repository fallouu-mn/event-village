/**
 * Design 1c (point 1) — contrôle responsive : branchement et couverture (contrôle statique ; le contrôle lui-même tourne
 * dans le job « responsive » de la CI, e2e/responsive.spec.ts).
 *  - largeurs 320, 360, 390, 768, 1024 et 1440 px ; captures à 360, 768 et 1440 px ; scanner aussi en paysage ;
 *  - toute page de app/ est contrôlée, ou exclue avec sa raison (salles du lot 10b, redirections, liens à jeton) ;
 *  - contrôles bloquants : défilement horizontal, texte hors de l'écran, coupé ou tronqué, chevauchements, tableau sur
 *    téléphone, cibles < 44 px et textes < 14 px (checks.ts) ;
 *  - CI : job à part, phases « connexion » et « responsive » seules, requis par le verdict ; jamais dans le job e2e.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_EXCLUSIONS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS,
} from '../../e2e/support/responsive-pages';
import type { DemoIds } from '../../e2e/support/demo-ids';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** Routes de app/ (dossiers qui contiennent un page.tsx), sans les groupes de routes. */
function appRoutes(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            if (e.isDirectory()) walk(`${dir}/${e.name}`);
            else if (e.name === 'page.tsx') {
                const route = dir.replace(/^app/, '').split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
                out.push(route === '' ? '/' : route);
            }
        }
    };
    walk('app');
    return out.sort();
}

/** Identifiants factices : toute valeur lue devient « ID » (chemins d'une page dynamique). */
function fakeIds(): DemoIds {
    const handler: ProxyHandler<object> = {
        get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 'ID' : prop === 'toString' ? () => 'ID' : new Proxy({}, handler)),
    };
    return new Proxy({}, handler) as DemoIds;
}

function matches(route: string, url: string): boolean {
    const a = route.split('/').filter(Boolean);
    const b = url.split('?')[0].split('/').filter(Boolean);
    if (a.length !== b.length) return false;
    return a.every((seg, i) => seg === b[i] || (/^\[.+\]$/.test(seg) && (b[i] === 'ID' || /^[0-9a-f-]{36}$/.test(b[i]))));
}

describe('design 1c — contrôle responsive : largeurs et captures', () => {
    test('six largeurs, du plus petit téléphone à l’ordinateur', () => {
        assert.deepEqual(RESPONSIVE_WIDTHS.map((w) => w.width), [320, 360, 390, 768, 1024, 1440]);
        for (const w of RESPONSIVE_WIDTHS) assert.ok(w.height >= 568, `${w.width} px : hauteur ${w.height}`);
        assert.equal(PHONE_MAX_WIDTH, 390);
    });

    test('captures à 360, 768 et 1440 px, en clair et en sombre', () => {
        assert.deepEqual([...RESPONSIVE_CAPTURE_WIDTHS], [360, 768, 1440]);
        const spec = read('e2e/responsive.spec.ts');
        assert.match(spec, /\{ key: 'clair', colorScheme: 'light' \},\n\s+\{ key: 'sombre', colorScheme: 'dark' \},/);
        assert.match(spec, /theme === 'clair' \|\| RESPONSIVE_CAPTURE_WIDTHS\.includes\(w\.width\)/);
        assert.match(spec, /page\.goto\(record\.url, \{ waitUntil: 'load' \}\)/, 'page rechargée à chaque largeur');
    });

    test('scanner : portrait et paysage', () => {
        assert.ok(RESPONSIVE_LANDSCAPE.length >= 1);
        for (const l of RESPONSIVE_LANDSCAPE) assert.ok(l.width > l.height, `${l.width}×${l.height} en paysage`);
        const scanner = RESPONSIVE_PAGES.filter((p) => p.groupe === 'scanner' && p.path(fakeIds()) === '/controller/scanner');
        assert.ok(scanner.some((p) => p.paysage && p.fakeCamera), 'scanner démarré (caméra) contrôlé en paysage');
        assert.ok(scanner.some((p) => p.paysage && !p.fakeCamera), 'départ du contrôle contrôlé en paysage');
    });
});

describe('design 1c — contrôle responsive : toutes les pages', () => {
    const routes = appRoutes();
    const urls = RESPONSIVE_PAGES.map((p) => p.path(fakeIds()));

    test('chaque route de app/ est contrôlée ou exclue avec sa raison', () => {
        const orphelines = routes.filter((r) => !(r in RESPONSIVE_EXCLUSIONS) && !urls.some((u) => matches(r, u)));
        assert.deepEqual(orphelines, [], 'routes ni contrôlées ni exclues');
        for (const [r, why] of Object.entries(RESPONSIVE_EXCLUSIONS)) {
            assert.ok(routes.includes(r), `exclusion d’une route inexistante : ${r}`);
            assert.ok(why.length > 10, `raison de l’exclusion de ${r}`);
            assert.ok(!urls.some((u) => matches(r, u)), `${r} à la fois exclue et contrôlée`);
        }
    });

    test('les quatre espaces sont couverts (publiques, organisatrice, administration, scanner)', () => {
        for (const g of ['public', 'organisatrice', 'administration', 'scanner'] as const) {
            assert.ok(RESPONSIVE_PAGES.filter((p) => p.groupe === g).length >= 3, `espace ${g}`);
        }
        for (const prefix of ['/partner/', '/admin/', '/controller/']) {
            const needed = routes.filter((r) => r.startsWith(prefix) && !(r in RESPONSIVE_EXCLUSIONS));
            for (const r of needed) assert.ok(urls.some((u) => matches(r, u)), `${r} contrôlée`);
        }
        const pilotage = RESPONSIVE_PAGES.filter((p) => p.id.startsWith('org-pilotage-')).map((p) => p.path(fakeIds()).split('tab=')[1] ?? 'apercu');
        assert.deepEqual(pilotage.sort(), ['apercu', 'caisse', 'cloture', 'entrees', 'equipe', 'infos', 'invitations', 'ventes']);
    });

    test('identifiants uniques (noms des captures et des résultats)', () => {
        const ids = RESPONSIVE_PAGES.map((p) => p.id);
        assert.equal(new Set(ids).size, ids.length);
        for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
    });
});

describe('design 1c — contrôles bloquants', () => {
    const src = read('e2e/support/responsive-checks.ts');

    test('défilement, texte hors écran, coupé ou tronqué, chevauchements, tableaux sur téléphone', () => {
        for (const msg of ['défilement horizontal', 'texte hors de l’écran', 'texte coupé', 'texte tronqué sans le texte entier', 'textes qui se chevauchent', 'tableau sur téléphone']) {
            assert.ok(src.includes(`: ${msg}`), msg);
        }
    });

    test('cibles de 44 px et textes de 14 px : contrôles communs de checks.ts à chaque largeur', () => {
        assert.match(src, /await runPageChecks\(page, \{ mobile: false, axe: false \}\)/);
        const checks = read('e2e/support/checks.ts');
        assert.match(checks, /if \(r\.width < 44 \|\| r\.height < 44\)/);
        assert.match(checks, /if \(size < 14\) smallTexts\.push/);
    });

    test('chaque défaut fait échouer le test de la page', () => {
        const spec = read('e2e/responsive.spec.ts');
        assert.match(spec, /expect\(blocking, `contrôles responsive de \$\{p\.id\} \(\$\{theme\.key\}\)`\)\.toEqual\(\[\]\)/);
    });
});

describe('design 1c — contrôle responsive en CI', () => {
    const yml = read('.github/workflows/verify.yml');
    const job = yml.slice(yml.indexOf('\n  responsive:\n'), yml.indexOf('\n  verdict:\n'));

    test('job « responsive » : run complet, ou mode rapide avec « ci-responsive: oui »', () => {
        assert.ok(job.length > 100, 'job responsive présent avant le verdict');
        assert.match(job, /if: \$\{\{ needs\.mode\.outputs\.rapide == '0' \|\| needs\.mode\.outputs\.responsive == '1' \}\}/);
        assert.match(job, /EV_E2E_PHASES: connexion,responsive\n/);
        assert.match(job, /npm run e2e 2>&1 \| tee \/tmp\/e2e\.log/);
        assert.match(job, /\n {6}- \*build\n/);
        assert.match(job, /\n {6}- \*e2e-seed\n/);
        assert.match(job, /\n {6}- \*e2e-start\n/);
        assert.doesNotMatch(job, /continue-on-error/);
        assert.match(yml, /grep -qE '\^ci-responsive:\[\[:space:\]\]\*oui\[\[:space:\]\]\*\$'/);
    });

    test('requis par le verdict', () => {
        assert.match(yml, /needs: \[mode, rapide, qualite, tests, e2e, responsive\]/);
        const verdict = read('scripts/ci-verdict.mjs');
        assert.match(verdict, /const avecResponsive = !rapide \|\| needs\.mode\?\.outputs\?\.responsive === '1';/);
        assert.match(verdict, /\.\.\.\(avecResponsive \? \['responsive'\] : \[\]\)/);
    });

    test('jamais dans le job e2e : phase hors des phases par défaut', () => {
        const run = read('scripts/e2e/run-e2e.mjs');
        assert.match(run, /\['responsive', \['--project=responsive', '--workers=3'\]\],/);
        assert.match(run, /const PAR_DEFAUT = phases\.map\(\(\[p\]\) => p\)\.filter\(\(p\) => p !== 'responsive'\);/);
        const e2eJob = yml.slice(yml.indexOf('\n  e2e:\n'), yml.indexOf('\n  responsive:\n'));
        assert.doesNotMatch(e2eJob, /\n {10}EV_E2E_PHASES:/, 'aucune variable EV_E2E_PHASES dans le job e2e');
    });
});
