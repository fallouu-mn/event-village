/**
 * Design 1e — captures avant / après du rapport (docs/design-1e-rapport.md, section « Captures »), dans le job
 * « responsive » de la CI (projet responsive : nom en « …responsive.spec.ts »). Accueil, fiche, Mes billets, menu ouvert,
 * barre du bas, en-tête de l'ordinateur (survol d'une rubrique, menu du compte ouvert), panneau des notifications, tableau
 * de bord de l'organisatrice avec la barre latérale ouverte puis repliée ; 360, 1024 et 1440 px, clair et sombre.
 * Quelques contrôles de comportement au passage (bloquants) : menu en dialogue et page inerte, Échap qui le referme et
 * rend le focus au bouton, barre latérale repliée gardée après rechargement, puis dépliée.
 * Captures : .e2e-captures/captures-responsive/d1e-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
import { readDemoIds, E2E_OUTPUT_DIR } from './support/demo-ids';

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];
const WIDTHS = [360, 1024, 1440] as const;
const HEIGHT: Record<number, number> = { 360: 780, 1024: 768, 1440: 900 };

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
    await page.screenshot({ path: path.join(SHOTS, `d1e-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
}

async function open(page: Page, url: string, width: number): Promise<void> {
    await page.setViewportSize({ width, height: HEIGHT[width] });
    await page.goto(url, { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
    await settle(page);
}

const SCREENS: Array<{ id: string; role: CaptureRole; url: () => string }> = [
    { id: 'accueil', role: 'anonyme', url: () => '/' },
    { id: 'fiche', role: 'anonyme', url: () => `/events/${readDemoIds().events.ceSoir.id}` },
    { id: 'mes-billets', role: 'client', url: () => '/tickets?tab=a-venir' },
];

for (const theme of THEMES) {
    test.describe(`design 1e · captures · ${theme.key}`, () => {
        test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });

        for (const s of SCREENS) {
            test.describe(s.role, () => {
                test.use({ evRole: s.role });
                test(`${s.id} à 360, 1024 et 1440 px`, async ({ page }) => {
                    test.setTimeout(180_000);
                    for (const w of WIDTHS) {
                        await open(page, s.url(), w);
                        await shot(page, s.id, w, theme.key);
                    }
                });
            });
        }

        test.describe('client', () => {
            test.use({ evRole: 'client' });
            test('menu ouvert et barre du bas (360 px) : dialogue, page inerte, Échap rend le focus', async ({ page }) => {
                test.setTimeout(120_000);
                await open(page, '/', 360);
                const bar = page.getByRole('navigation', { name: /^navigation rapide$/i });
                await expect(bar).toBeVisible();
                await bar.screenshot({ path: path.join(SHOTS, `d1e-barre-du-bas__360__${theme.key}.jpg`), type: 'jpeg', quality: 85, scale: 'css' });
                const button = page.getByRole('button', { name: 'Ouvrir le menu' });
                await button.click();
                const menu = page.getByRole('dialog', { name: 'Menu' });
                await expect(menu).toBeVisible();
                await expect(page.locator('.ev-push-page')).toHaveAttribute('inert', '');
                await shot(page, 'menu-ouvert', 360, theme.key);
                await page.keyboard.press('Escape');
                await expect(page.locator('.ev-push-page')).not.toHaveAttribute('inert', '');
                await expect(button).toBeFocused({ timeout: 2_000 });
            });

            test('en-tête de l’ordinateur : survol d’une rubrique, menu du compte, panneau des notifications', async ({ page }) => {
                test.setTimeout(150_000);
                for (const w of [1024, 1440] as const) {
                    await open(page, '/', w);
                    await page.getByRole('navigation', { name: 'Rubriques' }).getByRole('link', { name: 'Explorer' }).hover();
                    await shot(page, 'entete-survol', w, theme.key);
                    await page.mouse.move(w / 2, 600);
                    const account = page.locator('header [data-ev-account]');
                    await account.click();
                    await shot(page, 'menu-du-compte', w, theme.key);
                    await page.keyboard.press('Escape');
                }
                for (const w of WIDTHS) {
                    await open(page, '/tickets?tab=a-venir', w);
                    await page.getByRole('button', { name: /^Notifications/ }).click();
                    await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
                    await shot(page, 'notifications', w, theme.key);
                    await page.keyboard.press('Escape');
                }
            });
        });

        test.describe('organisateur', () => {
            test.use({ evRole: 'organisateur' });
            test('tableau de bord : barre latérale ouverte puis repliée (gardée au rechargement)', async ({ page }) => {
                test.setTimeout(150_000);
                for (const w of [1024, 1440] as const) {
                    await open(page, '/partner/dashboard', w);
                    await shot(page, 'org-barre-ouverte', w, theme.key);
                    await page.getByRole('button', { name: 'Replier la barre latérale' }).click();
                    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'replie');
                    await page.locator('aside nav a').first().hover();
                    await shot(page, 'org-barre-repliee', w, theme.key);
                    await page.reload({ waitUntil: 'load' });
                    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'replie');
                    await page.getByRole('button', { name: 'Déplier la barre latérale' }).click();
                    await expect(page.locator('html')).not.toHaveAttribute('data-sidebar', 'replie');
                }
                await open(page, '/partner/dashboard', 360);
                await shot(page, 'org-tableau-de-bord', 360, theme.key);
            });
        });
    });
}
