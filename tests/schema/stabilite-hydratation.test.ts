/**
 * Lot stabilité (hydratation et tests intermittents) — garde-fous lus dans le code, sans base ni navigateur. Les preuves
 * en navigateur sont dans e2e/hydratation.responsive.spec.ts (job responsive) et dans le contrôle durable (contrôle
 * responsive et captures : toute erreur d'hydratation bloque la page, avec son nom).
 *  1. useFeatureFlags : jamais d'état initial tiré du cache du module (rendu du navigateur ≠ rendu du serveur pour un
 *     composant hydraté après la première lecture des interrupteurs) ; valeur du serveur (null) pendant l'hydratation.
 *  2. Contrôle durable : erreurs d'hydratation reconnues (n° 418, 423, 425, « did not match ») et bloquantes dans le
 *     contrôle responsive et les captures ; aucun nouveau suppressHydrationWarning.
 *  3. Carte d'Explorer : lieu « Aller à » choisi avant la création de la carte gardé et appliqué ; état de la carte exposé.
 *  4. Scanner : reprise de session décidée avant l'affichage (useLayoutEffect), contrôleur et partenaire.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');

describe('stabilité — hydratation', () => {
    test('useFeatureFlags : valeur du serveur (null) pendant l’hydratation, jamais useState(resolved)', () => {
        const src = read('lib/features/client.ts');
        assert.doesNotMatch(src, /useState\s*(<[^>]*>)?\s*\(\s*resolved\s*\)/, 'état initial tiré du cache du module');
        assert.match(src, /useSyncExternalStore\(\s*subscribe\s*,\s*clientFlags\s*,\s*serverFlags\s*\)/);
        assert.match(src, /const serverFlags = \(\): ClientFeatureFlags \| null => null;/);
        assert.match(src, /resolved = flags;\n\s*listeners\.forEach\(\(l\) => l\(\)\);/, 'abonnés prévenus à l’arrivée de la lecture');
    });

    test('contrôle durable : erreurs reconnues, bloquantes dans le contrôle responsive et nommées dans les captures', () => {
        const hydration = read('e2e/support/hydration.ts');
        const re = /export const HYDRATION_ERROR_RE = (\/.+\/i);/.exec(hydration);
        assert.ok(re, 'HYDRATION_ERROR_RE');
        const rx = new RegExp(re[1].slice(1, -2), 'i');
        for (const msg of [
            'Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=',
            'Minified React error #423; visit https://react.dev/errors/423',
            'Minified React error #425; visit https://react.dev/errors/425',
            'Warning: Text content did not match. Server: "a" Client: "b"',
            "Hydration failed because the server rendered HTML didn't match the client.",
        ]) assert.match(msg, rx, msg);
        assert.doesNotMatch('Minified React error #421', rx, 'n° 421 (autre erreur) non confondu');
        const responsive = read('e2e/responsive.spec.ts');
        assert.match(responsive, /const hydration = watchHydration\(page\);/);
        assert.match(responsive, /blocking\.push\(`erreur d'hydratation sur \$\{p\.id\} à \$\{at\} : \$\{h\}`\)/, 'bloquant, avec le nom de la page et la largeur');
        assert.match(responsive, /last\.blocking\.push\(/, 'erreur tardive rattachée à la dernière largeur');
        const captures = read('e2e/captures.spec.ts');
        assert.match(captures, /record\.blocking\.push\(\.\.\.hydration\.errors\.map\(\(h\) => `erreur d'hydratation sur \$\{screen\.id\}/);
    });

    test('aucun nouveau suppressHydrationWarning (seulement ceux d’avant le lot : thème posé avant l’affichage)', () => {
        const out = execFileSync('git', ['grep', '-n', 'suppressHydrationWarning', '--', 'app', 'components', 'lib'], { encoding: 'utf8' });
        const files = out.trim().split('\n').map((l) => l.split(':')[0]).sort();
        assert.deepEqual(files, ['app/layout.tsx', 'app/layout.tsx', 'components/ui/ThemeToggle.tsx', 'components/ui/ThemeToggle.tsx']);
    });

    test('reproduction : fuseau, minute, minuit, début, en cours, heure figée, morceaux lents, réseau, processeur, page tardive', () => {
        const spec = read('e2e/hydratation.responsive.spec.ts');
        assert.match(spec, /const BROWSER_TZ = 'Asia\/Tokyo';/);
        for (const id of ['heure-reelle', 'minute', 'minuit', 'debut', 'en-cours', 'heure-figee', 'morceaux-lents', 'reseau-4g', 'processeur-lent']) {
            assert.match(spec, new RegExp(`id: '${id}'`), id);
        }
        assert.match(spec, /const THEMES: ThemeKey\[\] = \['clair', 'sombre'\];/);
        assert.match(spec, /LATE_PAGE_CHUNK/);
        assert.match(spec, /\^Rechercher un événement\$/, 'Explorer : un seul champ de recherche');
    });
});

describe('stabilité — tests intermittents', () => {
    test('carte d’Explorer : lieu choisi avant la carte gardé puis appliqué ; état de la carte exposé', () => {
        const src = read('components/explore/ExploreMap.tsx');
        assert.match(src, /const pendingPlaceRef = useRef\(''\);/);
        assert.match(src, /if \(!mapRef\.current\) \{\n\s*pendingPlaceRef\.current = p\.id;\n\s*return;\n\s*\}/);
        assert.match(src, /const pending = QUICK_PLACES\.find\(\(x\) => x\.id === pendingPlaceRef\.current\);/);
        assert.match(src, /data-ev-carte=\{ready \? 'prete' : 'chargement'\}/);
        const spec = read('e2e/carte-b3.responsive.spec.ts');
        assert.equal((spec.match(/data-ev-carte="prete"/g) ?? []).length, 2, 'les deux tests attendent la carte prête');
    });

    test('scanner : reprise de session avant l’affichage (contrôleur et partenaire), clic résolu à l’action', () => {
        for (const rel of ['app/controller/scanner/page.tsx', 'app/partner/scan/page.tsx']) {
            const src = read(rel);
            const i = src.indexOf('readScanSession(SURFACE');
            assert.ok(i > 0, rel);
            const before = src.slice(Math.max(0, i - 900), i);
            assert.match(before, /useLayoutEffect\(\(\) => \{\n\s*if \(restoreDoneRef\.current/, `${rel} : reprise dans useLayoutEffect`);
        }
        const spec = read('e2e/lot11cc.responsive.spec.ts');
        assert.match(spec, /const startOrResume = start\.or\(resume\);\n\s*await expect\(startOrResume\)\.toBeVisible\(\{ timeout: 30_000 \}\);\n\s*await startOrResume\.click\(\);/);
        assert.doesNotMatch(spec, /if \(await resume\.isVisible\(\)\) await resume\.click\(\);/);
    });

    test('suivi d’une commande : heure estimée après minuit acceptée par la spec lot12b', () => {
        assert.match(read('e2e/lot12b.responsive.spec.ts'), /toContainText\(\/Prévue \(le \.\+ \)\?vers \\d\{2\} h \\d\{2\}\/\)/);
        assert.match(read('components/orders/client/tracking/OrderTracking.tsx'), /`Prévue le \$\{formatDate\(at\)\} vers \$\{hourText\(at\)\}`/);
    });
});
