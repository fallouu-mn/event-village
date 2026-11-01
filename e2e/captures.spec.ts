/**
 * Lot 5.1 — captures d'écran des écrans du lot (contrat P).
 *
 * Projets « mobile » (390×844, DPR 2) et « desktop » (1440×900) ; dans chacun, thèmes clair et
 * sombre (localStorage['ev-theme'] posé avant le chargement + colorScheme). Une capture par
 * écran, vue et thème : .e2e-captures/captures/<écran>__<mobile|ordinateur>__<clair|sombre>.png.
 * La capture est faite même si un contrôle échoue ; le test échoue ensuite sur les contrôles
 * bloquants (défilement horizontal à 390 px, « § », enum brut, erreur de console, requête en
 * échec). Avertissements (cibles < 44 px, textes < 14 px, axe-core) dans index.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
import { runPageChecks } from './support/checks';
import { writeCaptureRecord, type CaptureRecord } from './support/capture-record';
import { CAPTURES_DIR, readDemoIds, type DemoIds } from './support/demo-ids';
import { fakeScanMode, installFakeCamera } from './support/fake-camera';
import { SCREENS, type Screen } from './support/screens';

const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];
const ROLE_ORDER: readonly CaptureRole[] = ['anonyme', 'client', 'organisateur', 'admin', 'controleur'];

/** Attente « page stable » ; une attente non aboutie est notée dans l'index (jamais ignorée). */
async function settle(page: Page, notes: string[]): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch((err: Error) => {
        notes.push(`réseau jamais au repos après 15 s (${err.message.split('\n')[0]})`);
    });
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 15_000 }).catch((err: Error) => {
        notes.push(`images encore en chargement après 15 s (${err.message.split('\n')[0]})`);
    });
    await page.evaluate(() => document.fonts.ready.then(() => true));
}

function globalMasks(page: Page) {
    return [
        page.locator('[data-e2e-mask]'),
        page.getByText(/^(il y a|dans) \d+\s?(s|sec|min|minutes?|h|heures?|j|jours?)\b/i),
        page.getByText(/^à l[’']instant$/i),
    ];
}

async function capture(page: Page, screen: Screen, file: string): Promise<string> {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    const target = path.join(CAPTURES_DIR, file);
    await page.screenshot({
        path: target,
        animations: 'disabled',
        caret: 'hide',
        scale: 'device',
        mask: [...globalMasks(page), ...(screen.masks ? screen.masks(page) : [])],
    });
    return target;
}

for (const theme of THEMES) {
    for (const role of ROLE_ORDER) {
        const screens = SCREENS.filter((s) => s.role === role);
        if (screens.length === 0) continue;
        test.describe(`${theme.key} · ${role}`, () => {
            test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });

            for (const screen of screens) {
                test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
                    const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
                    const file = `${screen.id}__${vue}__${theme.key}.png`;
                    const started = Date.now();
                    const record: CaptureRecord = {
                        file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
                        url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
                    };
                    try {
                        const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
                        record.url = screen.path(demo);
                        guard.configure({
                            allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
                            ignoreConsoleErrors: Boolean(screen.injectError),
                        });
                        if (screen.injectError) {
                            record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
                            await page.route(screen.injectError, (route) => route.fulfill({
                                status: 500,
                                contentType: 'application/json; charset=utf-8',
                                body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
                            }));
                        }
                        if (screen.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
                        const response = await page.goto(record.url, { waitUntil: 'load' });
                        record.status = response ? response.status() : null;
                        await settle(page, record.notes);
                        const sc = { page, context, guard, ids: demo };
                        if (screen.ready) await screen.ready(sc);
                        if (screen.actions) {
                            await screen.actions(sc);
                            await settle(page, record.notes);
                        }
                        const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
                        record.blocking.push(...checks.blocking);
                        record.warnings.push(...checks.warnings);
                        record.axeDetails = checks.axeDetails;
                        const shot = await capture(page, screen, file);
                        record.captured = true;
                        await testInfo.attach(file, { path: shot, contentType: 'image/png' });
                    } catch (err) {
                        record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
                        if (!record.captured && !page.isClosed()) {
                            await capture(page, screen, file).then(
                                async (shot) => {
                                    record.captured = true;
                                    record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
                                    await testInfo.attach(file, { path: shot, contentType: 'image/png' });
                                },
                                (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
                            );
                        }
                        throw err;
                    } finally {
                        record.blocking.push(...guard.blockingIssues());
                        record.durationMs = Date.now() - started;
                        writeCaptureRecord(record);
                    }
                    expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
                });
            }
        });
    }
}
