/**
 * Design 1b (lot PERF) — performance mobile mesurée en CI, sans base ni navigateur :
 *  - logique pure de scripts/e2e/perf-mobile-seuils.mjs : médiane, CLS par fenêtres de session, seuils (score ≥ 90,
 *    LCP < 2 500 ms, CLS < 0,1, toucher < 200 ms : bornes exactes), passages en erreur écartés, erreur fatale de
 *    « Mes billets » (page de connexion), lignes TSV et rapport lisible ;
 *  - branchement : .github/workflows/verify.yml a l'étape BLOQUANTE (après `npm run e2e`, sans continue-on-error,
 *    délai ≤ 10 min, sortie perf_mobile du job) et publie les résultats même en échec (rassemblement `if: always()`) ;
 *    scripts/ci-verdict.mjs écrit perf_mobile dans run.txt ; lighthouse en devDependency à version exacte.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    MIN_PASSAGES_VALIDES, PASSAGES, REFERENCE_CPU, SEUILS, calibratedCpuMultiplier, TOUCHER_TSV_HEADER, TSV_HEADER, clsSessionWindows, finalPathMatches, median,
    texteRapport, toucherRows, tsvRows, verdictPage, verdictToucher,
} from '../../scripts/e2e/perf-mobile-seuils.mjs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

interface LhPass { score: number | null; lcp: number | null; cls: number | null; error?: string | null }
const lh = (score: number | null, lcp: number | null, cls: number | null, error: string | null = null): LhPass => ({ score, lcp, cls, error });
const reel = (cls: number | null, error: string | null = null) => ({ cls, error });
const bonnePage = (over: Partial<Parameters<typeof verdictPage>[0]> = {}) => ({
    id: 'accueil',
    libelle: 'Accueil',
    lighthouse: [lh(95, 1_800, 0.01), lh(93, 1_900, 0.02), lh(97, 1_700, 0)],
    reel: [reel(0.01), reel(0), reel(0.02)],
    ...over,
});

describe('design 1b — performance mobile : seuils et médiane (module pur)', () => {
    test('seuils de l’utilisateur et 3 passages par page', () => {
        assert.deepEqual({ ...SEUILS }, { score: 90, lcpMs: 2_500, cls: 0.1, toucherMs: 200 });
        assert.equal(PASSAGES, 3);
        assert.equal(MIN_PASSAGES_VALIDES, 2);
    });

    test('médiane : impaire, paire, valeurs absentes ignorées, vide → null', () => {
        assert.equal(median([3, 1, 2]), 2);
        assert.equal(median([4, 1, 3, 2]), 2.5);
        assert.equal(median([88, null, 95, Number.NaN, 91] as number[]), 91);
        assert.equal(median([]), null);
        assert.equal(median([null] as unknown as number[]), null);
    });

    test('CLS : pire fenêtre de session (1 s d’écart, 5 s au plus), décalages après saisie ignorés', () => {
        assert.equal(clsSessionWindows([]), 0);
        // Deux fenêtres : 0,05 + 0,04 (écart 500 ms) puis, après 2 s, 0,03
        assert.equal(Number(clsSessionWindows([
            { startTime: 100, value: 0.05 }, { startTime: 600, value: 0.04 }, { startTime: 2_600, value: 0.03 },
        ]).toFixed(4)), 0.09);
        // Saisie récente : ignorée
        assert.equal(clsSessionWindows([{ startTime: 100, value: 0.5, hadRecentInput: true }, { startTime: 200, value: 0.02 }]), 0.02);
        // Fenêtre plafonnée à 5 s : décalages toutes les 900 ms, la 7e entrée (5 400 ms) ouvre une nouvelle fenêtre
        const chaine = Array.from({ length: 8 }, (_, i) => ({ startTime: i * 900, value: 0.02 }));
        assert.equal(Number(clsSessionWindows(chaine).toFixed(4)), 0.12);
        // Ordre d’arrivée quelconque
        assert.equal(Number(clsSessionWindows([{ startTime: 600, value: 0.04 }, { startTime: 100, value: 0.05 }]).toFixed(4)), 0.09);
    });

    test('page conforme : OK, quatre mesures (score, LCP, CLS Lighthouse, CLS mesuré)', () => {
        const v = verdictPage(bonnePage());
        assert.equal(v.ok, true);
        assert.equal(v.mesures.length, 4);
        assert.ok(v.mesures.every((m) => m.texte.startsWith('OK — ')));
        assert.equal(v.mesures[0].valeur, 95);
    });

    test('bornes exactes : score 90 admis, 89 refusé ; LCP 2 499 admis, 2 500 refusé ; CLS 0,099 admis, 0,1 refusé', () => {
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(90, 1_000, 0), lh(90, 1_000, 0), lh(90, 1_000, 0)] })).ok, true);
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(89, 1_000, 0), lh(99, 1_000, 0), lh(80, 1_000, 0)] })).ok, false);
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(95, 2_499, 0), lh(95, 2_499, 0), lh(95, 2_499, 0)] })).ok, true);
        const lcp = verdictPage(bonnePage({ lighthouse: [lh(95, 2_500, 0), lh(95, 2_500, 0), lh(95, 2_500, 0)] }));
        assert.equal(lcp.ok, false);
        assert.match(lcp.mesures[1].texte, /^HORS SEUIL — affichage principal/);
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(95, 1_000, 0.099), lh(95, 1_000, 0.099), lh(95, 1_000, 0.099)] })).ok, true);
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(95, 1_000, 0.1), lh(95, 1_000, 0.1), lh(95, 1_000, 0.1)] })).ok, false);
        const clsReel = verdictPage(bonnePage({ reel: [reel(0.1), reel(0.2), reel(0.01)] }));
        assert.equal(clsReel.ok, false, 'CLS mesuré médian 0,1 : refusé');
        assert.match(clsReel.mesures[3].texte, /^HORS SEUIL — sauts de mise en page \(CLS mesuré/);
    });

    test('c’est la MÉDIANE qui compte : un passage lent sur trois ne fait pas échouer, deux oui', () => {
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(70, 4_000, 0.3), lh(92, 2_000, 0), lh(94, 1_900, 0)] })).ok, true);
        assert.equal(verdictPage(bonnePage({ lighthouse: [lh(70, 4_000, 0.3), lh(85, 3_000, 0), lh(94, 1_900, 0)] })).ok, false);
    });

    test('passages en erreur écartés ; moins de 2 passages valides : « mesure manquante », HORS SEUIL', () => {
        const deux = verdictPage(bonnePage({ lighthouse: [lh(null, null, null, 'NO_FCP'), lh(92, 2_000, 0), lh(94, 1_900, 0)] }));
        assert.equal(deux.ok, true);
        assert.equal(deux.mesures[0].valeur, 93);
        assert.equal(deux.erreurs.length, 1);
        const un = verdictPage(bonnePage({ lighthouse: [lh(null, null, null, 'NO_FCP'), lh(null, null, null, 'délai'), lh(99, 1_000, 0)] }));
        assert.equal(un.ok, false);
        assert.match(un.mesures[0].texte, /mesure manquante \(1 passage\(s\) valide\(s\) sur 1/);
        assert.equal(verdictPage(bonnePage({ lighthouse: [] })).ok, false);
        assert.equal(verdictPage(bonnePage({ reel: [reel(null, 'délai'), reel(null, 'délai'), reel(0)] })).ok, false);
    });

    test('erreur fatale (Mes billets mesurée sur la page de connexion) : HORS SEUIL malgré de bonnes valeurs', () => {
        const v = verdictPage(bonnePage({ id: 'mes-billets', libelle: 'Mes billets', fatal: 'session du client refusée' }));
        assert.equal(v.ok, false);
        assert.equal(v.fatal, 'session du client refusée');
    });

    test('URL finale : Mes billets connectée admise, page de connexion refusée', () => {
        assert.equal(finalPathMatches('http://localhost:3000/tickets?tab=a-venir', '/tickets'), true);
        assert.equal(finalPathMatches('http://localhost:3000/tickets/', '/tickets'), true);
        assert.equal(finalPathMatches('http://localhost:3000/login?next=%2Ftickets', '/tickets'), false);
        assert.equal(finalPathMatches('http://localhost:3000/', '/'), true);
        assert.equal(finalPathMatches('pas une url', '/'), false);
    });

    test('toucher : la plus longue interaction < 200 ms (199 admis, 200 refusé), mesure témoin aussi', () => {
        const t = (eventTimingMs: number | null, temoinMs: number | null, error: string | null = null) => ({ page: 'Accueil', cible: 'puce', eventTimingMs, temoinMs, error });
        assert.equal(verdictToucher([t(40, 30), t(199, 120), t(0, 12)]).ok, true);
        const lent = verdictToucher([t(40, 30), t(200, 120)]);
        assert.equal(lent.ok, false);
        assert.equal(lent.maxEventTimingMs, 200);
        assert.match(lent.textes[0], /^HORS SEUIL — réaction au toucher \(Event Timing/);
        assert.equal(verdictToucher([t(40, 30), t(50, 200)]).ok, false, 'mesure témoin à 200 ms : refusée');
        const rapide = verdictToucher([t(0, 10), t(0, 11)]);
        assert.equal(rapide.ok, true, 'aucune interaction au-dessus de 16 ms : admis');
        assert.match(rapide.textes[0], /moins de 16 ms/);
        assert.equal(verdictToucher([t(40, 30), t(null, null, 'toucher non reçu par la page (aucun clic)')]).ok, false, 'toucher en erreur');
        assert.equal(verdictToucher([t(40, 30)], ['Mes billets : rien à toucher']).ok, false, 'page sans contrôle touchable');
        assert.equal(verdictToucher([]).ok, false, 'aucun toucher');
    });

    test('sorties : TSV (une ligne par passage puis la médiane, colonnes alignées) et rapport en français', () => {
        const page = bonnePage();
        const rows = tsvRows(page.id, page.lighthouse.map((p, i) => ({ ...p, tbt: 100 + i, fcp: 900, si: 1_500, bytes: 400_000, finalUrl: 'http://localhost:3000/' })), page.reel.map((r) => ({ ...r, lcp: 2_000 })));
        const cols = TSV_HEADER.split('\t').length;
        assert.equal(rows.length, PASSAGES + 1);
        assert.ok(rows.every((r) => r.split('\t').length === cols), 'même nombre de colonnes que l’en-tête');
        const med = rows[rows.length - 1].split('\t');
        assert.deepEqual([med[0], med[1], med[2], med[3]], ['accueil', 'mediane', '95', '1800']);
        const touches = [{ page: 'Accueil', cible: 'puce\t« Concerts »', eventTimingMs: 40, temoinMs: 30, etatChange: true, error: null }];
        const trows = toucherRows(touches);
        assert.equal(trows[0].split('\t').length, TOUCHER_TSV_HEADER.split('\t').length, 'tabulation du libellé neutralisée');

        const okRapport = texteRapport({ pages: [verdictPage(page)], toucher: verdictToucher(touches) });
        assert.equal(okRapport.ok, true);
        assert.match(okRapport.texte, /^OK — Accueil$/m);
        assert.match(okRapport.texte, /^VERDICT : OK/m);
        const koRapport = texteRapport({ pages: [verdictPage(page), verdictPage(bonnePage({ id: 'fiche', libelle: 'Fiche', lighthouse: [lh(60, 5_000, 0.3), lh(61, 5_000, 0.3), lh(62, 5_000, 0.3)] }))], toucher: verdictToucher(touches) });
        assert.equal(koRapport.ok, false);
        assert.match(koRapport.texte, /^HORS SEUIL — Fiche$/m);
        assert.match(koRapport.texte, /^VERDICT : HORS SEUIL/m);
        assert.doesNotMatch(koRapport.texte, /undefined|null|NaN/);
    });
});

describe('design 1b — performance mobile : branchement en CI', () => {
    const yml = read('.github/workflows/verify.yml');

    /** Bloc d'une étape (de son « - name: » au suivant, même indentation). */
    function stepBlock(nameStart: string): string {
        const i = yml.indexOf(`      - name: ${nameStart}`);
        assert.ok(i >= 0, `étape « ${nameStart} » absente de verify.yml`);
        const next = yml.indexOf('\n      - ', i + 10);
        return yml.slice(i, next === -1 ? undefined : next);
    }

    test('étape bloquante après npm run e2e : script, délai ≤ 10 min, aucun continue-on-error, lancée même si l’e2e échoue', () => {
        const step = stepBlock('"E2E : performance mobile mesurée');
        assert.match(step, /\n {8}id: perf-mobile\n/);
        assert.match(step, /node scripts\/e2e\/perf-mobile\.mjs 2>&1 \| tee \/tmp\/perf-mobile\.log/);
        assert.match(step, /set -o pipefail/, 'le code du script doit traverser le tee');
        assert.doesNotMatch(step, /continue-on-error/);
        assert.doesNotMatch(step, /--dry/);
        const timeout = /timeout-minutes: (\d+)/.exec(step);
        assert.ok(timeout && Number(timeout[1]) > 0 && Number(timeout[1]) <= 10, 'timeout-minutes entre 1 et 10');
        assert.match(step, /if: \$\{\{ !cancelled\(\) && steps\.build\.outcome == 'success' && steps\.e2e-start\.outcome == 'success' \}\}/);
        assert.doesNotMatch(step, /steps\.e2e\.outcome/, 'mesure indépendante du résultat de l’e2e');
        assert.ok(yml.indexOf('id: perf-mobile') > yml.indexOf('npm run e2e 2>&1 | tee /tmp/e2e.log'), 'après npm run e2e');
        assert.doesNotMatch(yml, /^\s*continue-on-error:\s*true/m, 'aucune étape ne masque un échec');
    });

    test('job e2e : sortie perf_mobile, délai qui laisse passer l’e2e (47 min) puis la mesure', () => {
        const job = yml.slice(yml.indexOf('\n  e2e:\n'), yml.indexOf('\n  verdict:\n'));
        assert.match(job, /\n {6}perf_mobile: \$\{\{ steps\.perf-mobile\.outcome \}\}\n/);
        const jobTimeout = Number(/\n {4}timeout-minutes: (\d+)/.exec(job)?.[1]);
        const e2eTimeout = Number(/timeout-minutes: (\d+)\n {8}run: \|\n {10}\. \/tmp\/etape\.sh e2e\n/.exec(job)?.[1]);
        const perfTimeout = Number(/timeout-minutes: (\d+)\n {8}run: \|\n {10}\. \/tmp\/etape\.sh perf-mobile\n/.exec(job)?.[1]);
        assert.ok(e2eTimeout > 0 && perfTimeout > 0, 'délais de l’e2e et de la mesure lus');
        assert.ok(jobTimeout >= e2eTimeout + perfTimeout + 8, `job ${jobTimeout} min ≥ e2e ${e2eTimeout} + mesure ${perfTimeout} + 8 min (installation, build, seed)`);
    });

    test('résultats publiés même en échec : rassemblement if: always() avec les rapports Lighthouse, journal perf-mobile.log', () => {
        const gather = stepBlock('Rassembler les captures et mesures de l\'e2e');
        assert.match(gather, /\n {8}if: always\(\)\n/);
        assert.match(gather, /-name '\*\.tsv' -o -name '\*\.txt' -o -name 'lighthouse\*\.json' -o -name 'lighthouse\*\.json\.gz'/);
        assert.match(yml, /for f in [^\n]* e2e perf-mobile; do/, 'perf-mobile.log rassemblé avec les journaux du job');
        const verdict = read('scripts/ci-verdict.mjs');
        assert.match(verdict, /'build', 'perf-mobile'\]\) copier\(/, 'perf-mobile.log copié dans le dossier du run');
        assert.match(verdict, /lignes\.push\(`perf_mobile=\$\{o\.perf_mobile \|\| 'skipped'\}`\)/, 'perf_mobile=<success|failure> dans run.txt');
        assert.match(verdict, /\['mode', 'qualite', 'tests', 'e2e'\]/, 'le résultat du job e2e (donc de l’étape) décide du verdict');
    });

    test('lighthouse : devDependency à version exacte, verrouillée, et Chromium de Playwright (aucun Chrome téléchargé)', () => {
        const pkg = JSON.parse(read('package.json')) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
        const v = pkg.devDependencies?.lighthouse;
        assert.ok(v && /^\d+\.\d+\.\d+$/.test(v), `version exacte attendue (reçu : ${v})`);
        assert.equal(pkg.dependencies?.lighthouse, undefined, 'pas en dépendance de production');
        const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { version?: string; dev?: boolean }> };
        assert.equal(lock.packages['node_modules/lighthouse']?.version, v);
        assert.equal(lock.packages['node_modules/lighthouse']?.dev, true);
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /from '\.\/perf-mobile-seuils\.mjs'/);
        assert.match(script, /chromium\.executablePath\(\)/);
        assert.match(script, /onlyCategories: \['performance'\]/);
        assert.doesNotMatch(script, /chrome-launcher|puppeteer\.launch|desktopConfig|formFactor: '/, 'préréglage mobile par défaut, Chromium de Playwright');
        assert.match(script, /'\/tickets\?tab=a-venir'/);
        assert.match(script, /process\.argv\.includes\('--dry'\)/);
    });

    test('décision 1b : mesure en HTTP/2 par un relais local (seuils inchangés), relais réellement en h2', async () => {
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /import \{ startH2Proxy \} from '\.\/h2-proxy\.mjs';/);
        assert.match(script, /if \(process\.env\.PERF_HTTP2 !== '0'\)/);
        assert.match(script, /'--ignore-certificate-errors'/);
        assert.match(script, /ignoreHTTPSErrors: true/);
        const relais = read('scripts/e2e/h2-proxy.mjs');
        assert.match(relais, /http2\.createSecureServer\(/);
        assert.doesNotMatch(relais, /BEGIN (RSA )?PRIVATE KEY/, 'aucun certificat dans le dépôt');
        // Relais réel devant un petit serveur HTTP/1.1 : réponse transmise en h2, en-têtes de connexion retirés
        const http = await import('node:http');
        const http2 = await import('node:http2');
        const os = await import('node:os');
        const { startH2Proxy } = await import('../../scripts/e2e/h2-proxy.mjs');
        const up = http.createServer((req, res) => { res.setHeader('connection', 'keep-alive'); res.end(`ok ${String(req.headers['x-forwarded-proto'])}`); });
        await new Promise<void>((r) => up.listen(0, '127.0.0.1', () => r()));
        const port = (up.address() as { port: number }).port;
        const proxy = await startH2Proxy(`http://127.0.0.1:${port}`, path.join(os.tmpdir(), 'ev-h2-proxy-test'));
        try {
            const client = http2.connect(proxy.origin, { rejectUnauthorized: false });
            const { status, body, conn } = await new Promise<{ status: number; body: string; conn: unknown }>((resolve, reject) => {
                const req = client.request({ ':path': '/' });
                let body = '';
                let status = 0;
                let conn: unknown;
                req.on('response', (h) => { status = Number(h[':status']); conn = h.connection; });
                req.setEncoding('utf8');
                req.on('data', (c: string) => { body += c; });
                req.on('end', () => resolve({ status, body, conn }));
                req.on('error', reject);
                req.end();
            });
            client.close();
            assert.equal(status, 200);
            assert.equal(body, 'ok https');
            assert.equal(conn, undefined);
        } finally {
            await proxy.close();
            await new Promise<void>((r) => up.close(() => r()));
        }
    });

    test('décision du 18/11 : ralentissement calibré sur l’indice de puissance (même téléphone), seuils et médiane de 3 inchangés', () => {
        assert.deepEqual({ ...REFERENCE_CPU }, { benchmarkIndex: 2000, multiplier: 4 });
        assert.equal(calibratedCpuMultiplier(2000), 4);
        assert.equal(calibratedCpuMultiplier(3571), 7.14, 'runner du run 385');
        assert.equal(calibratedCpuMultiplier(1996), 3.99, 'runner du run 401');
        assert.equal(calibratedCpuMultiplier(100), 1, 'borne basse');
        assert.equal(calibratedCpuMultiplier(50_000), 16, 'borne haute');
        for (const v of [null, undefined, Number.NaN, 0, -5]) assert.equal(calibratedCpuMultiplier(v as unknown as number), 4, String(v));
        assert.equal(SEUILS.score, 90);
        assert.equal(PASSAGES, 3);
        // Valeurs brutes : indice et ralentissement de chaque passage dans lighthouse.tsv, tours de calibration dans calibration.tsv
        assert.deepEqual(TSV_HEADER.split('\t').slice(-2), ['indice_puissance', 'ralentissement_cpu']);
        const rows = tsvRows('accueil', [{ score: 92, lcp: 1_800, cls: 0, tbt: 200, fcp: 1_000, si: 1_100, bytes: 500_000, finalUrl: '/', benchmarkIndex: 3571, cpu: 7.14 } as never], []);
        assert.deepEqual(rows[0].split('\t').slice(-2), ['3571', '7.14']);
        const script = read('scripts/e2e/perf-mobile.mjs');
        assert.match(script, /throttling: \{ cpuSlowdownMultiplier \}/);
        assert.match(script, /cpuSlowdownMultiplier = calibratedCpuMultiplier\(cal\.benchmarkIndex\)/);
        assert.match(script, /'calibration\.tsv'/);
    });
});
