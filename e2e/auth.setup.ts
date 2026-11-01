/**
 * Lot 5.1 — connexion par le formulaire, une fois par rôle, puis état de connexion enregistré dans
 * .auth/<rôle>.json (cookies @supabase/ssr sur l'hôte localhost, celui des redirections du middleware). Chaque rôle est un test distinct : un
 * rôle de démonstration qui échoue (seed:demo absent) n'empêche pas ceux du seed de test.
 *
 * Sélecteurs : libellé lié au champ d'abord (getByLabel). Tant que le formulaire de connexion n'a
 * pas de libellés liés (htmlFor/id, défaut d'accessibilité relevé par la découverte 5.1), le test
 * se replie sur le texte indicatif et l'écrit dans le journal et les annotations : ce repli est
 * visible, jamais silencieux.
 */
import fs from 'node:fs';
import { test as setup, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { AUTH_DIR, ROLES, storageStatePath, TEST_PASSWORD } from './support/accounts';
import { prepareContext } from './support/fixtures';

async function field(page: Page, testInfo: TestInfo, label: RegExp, fallback: Locator, nom: string): Promise<Locator> {
    const byLabel = page.getByLabel(label);
    if ((await byLabel.count()) > 0) return byLabel.first();
    const message = `champ « ${nom} » sans libellé lié (htmlFor/id) : sélection par repli (${fallback.toString()})`;
    console.warn(`[e2e][accessibilité] ${message}`);
    testInfo.annotations.push({ type: 'accessibilité', description: message });
    return fallback;
}

for (const role of ROLES) {
    setup(`connexion : ${role.libelle}`, async ({ page, context }, testInfo) => {
        await prepareContext(context, 'clair');
        const email = role.email();
        await page.goto('/login');
        const identifiant = await field(page, testInfo, /e-?mail ou t[ée]l[ée]phone/i, page.getByPlaceholder(/client@email\.com/i), 'Email ou Téléphone');
        const motDePasse = await field(page, testInfo, /^mot de passe$/i, page.locator('input[autocomplete="current-password"]'), 'Mot de passe');
        await identifiant.fill(email);
        await motDePasse.fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /^se connecter$/i }).click();
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
        await expect.poll(() => new URL(page.url()).pathname, { message: `page d'arrivée de ${role.libelle}`, timeout: 15_000 }).toMatch(role.arrivee);
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        await context.storageState({ path: storageStatePath(role.key) });
    });
}
