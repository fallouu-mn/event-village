/**
 * Design 1c (point 1) — contrôle responsive de toutes les pages publiques, de l'organisatrice, de l'administration et du
 * scanner (liste : e2e/support/responsive-pages.ts ; contrôles : e2e/support/responsive-checks.ts).
 *
 * Une page, un thème : un test. La page est rechargée à chaque largeur (320, 360, 390, 768, 1024, 1440 px ; le scanner
 * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
 * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
 *
 * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
 * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
 * (responsive.tsv et responsive.txt, publiés sur ci-results).
 *
 * Lot 10b, généralisé au lot 11b : pages des salles de fête et des tables (`services` dans responsive-pages.ts) contrôlées
 * interrupteurs features.halls_enabled et features.tables_enabled ouverts. Chaque test prend d'abord le verrou de la phase
 * (fixture servicesLock, e2e/support/services-switch.ts) : groupe « services » pour ces pages, « autres » pour toutes les
 * autres ; jamais les deux groupes à la fois, les interrupteurs sont remis à leur valeur d'origine dès que le dernier test
 * des services en cours est fini. L'attente du verrou est ajoutée au délai du test et notée dans le résultat.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
import { watchHydration } from './support/hydration';
import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
import { fakeScanMode, installFakeCamera } from './support/fake-camera';
import {
    PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
} from './support/responsive-pages';
import { runResponsiveChecks } from './support/responsive-checks';
import { keepHomeOutOfServicesWindow } from './support/services-switch';
import { readTheme, themeProblem } from './support/theme-check';

const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');

const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];

interface Size { width: number; height: number; paysage?: boolean }

function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
    const base: Size[] = RESPONSIVE_WIDTHS
        .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
        .map((w) => ({ width: w.width, height: w.height }));
    const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
    return [...base, ...land];
}

/** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
async function settle(page: Page, notes: string[], at: string): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
        .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
    await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
}

interface ResponsiveRecord {
    page: string;
    titre: string;
    groupe: string;
    role: CaptureRole;
    theme: ThemeKey;
    url: string | null;
    sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
    notes: string[];
    error: string | null;
}

for (const theme of THEMES) {
    const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
    for (const role of roles) {
        test.describe(`${theme.key} · ${role}`, () => {
            test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
            for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
                test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
                    test.setTimeout(240_000);
                    const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
                    try {
                        // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
                        await servicesLock.enter(p.services ? 'services' : 'autres');
                        if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
                        if (p.services) {
                            record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
                            await keepHomeOutOfServicesWindow(page);
                        }
                        const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
                        record.url = p.path(demo);
                        guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
                        if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
                        // Lot stabilité (contrôle durable) : erreur d'hydratation de React (n° 418, 423, 425, « did not match ») =
                        // page en échec, avec son nom et la largeur (les autres erreurs de la page restent notées)
                        const hydration = watchHydration(page);
                        let hydrationSeen = 0;
                        for (const size of sizesFor(p, theme.key)) {
                            const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
                            await page.setViewportSize({ width: size.width, height: size.height });
                            const response = await page.goto(record.url, { waitUntil: 'load' });
                            if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
                            if (p.ready) await p.ready(page);
                            else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
                            if (p.actions) await p.actions(page);
                            await settle(page, record.notes, at);
                            const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
                            const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
                            // Finition 5 (point 1) : thème demandé vraiment affiché (classe dark et fond lus sur la page), bloquant
                            const themeIssue = themeProblem(await readTheme(page), theme.key, at);
                            if (themeIssue) blocking.push(themeIssue);
                            for (const h of hydration.since(hydrationSeen)) blocking.push(`erreur d'hydratation sur ${p.id} à ${at} : ${h}`);
                            hydrationSeen = hydration.mark();
                            let capture: string | null = null;
                            if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
                                fs.mkdirSync(SHOTS, { recursive: true });
                                capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
                                await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
                            }
                            record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
                        }
                        // Erreur d'hydratation arrivée après le relevé de la dernière largeur : rattachée à celle-ci
                        const late = hydration.since(hydrationSeen);
                        const last = record.sizes[record.sizes.length - 1];
                        if (last) for (const h of late) last.blocking.push(`erreur d'hydratation sur ${p.id} (après le relevé de ${last.size}) : ${h}`);
                    } catch (err) {
                        record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
                        throw err;
                    } finally {
                        // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
                        record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
                        fs.mkdirSync(RESULTS, { recursive: true });
                        fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
                    }
                    const blocking = record.sizes.flatMap((s) => s.blocking);
                    expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
                });
            }
        });
    }
}
