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
import { fakeSmsTo } from './support/parcours';
import { serviceClient, userIdByEmail } from './support/service';

/**
 * Lot 9 quinquies (A3 : AUTH-05) : un compte ADMIN ou SUPERADMIN ouvre l'administration sur un nouvel appareil avec le
 * code administrateur reçu par SMS. Le code est lu dans le faux MTarget (GET /__test/sms), saisi dans la fenêtre ; le
 * cookie d'appareil (httpOnly) est ensuite enregistré avec l'état de connexion du rôle (valable 12 h).
 */
async function passAdminCode(page: Page, email: string): Promise<void> {
    const dialog = page.getByRole('alertdialog', { name: /code administrateur/i });
    await expect(dialog, 'fenêtre du code administrateur').toBeVisible({ timeout: 15_000 });
    const userId = await userIdByEmail(email);
    const { data, error } = await serviceClient().from('users').select('phone').eq('id', userId).single();
    if (error || !data?.phone) throw new Error(`[e2e] numéro du compte admin ${email} illisible : ${error?.message ?? 'absent'}`);
    const phone = String(data.phone);
    const before = new Set((await fakeSmsTo(phone)).map((m) => m.ticket));
    await dialog.getByRole('button', { name: /recevoir le code par sms/i }).click();
    let code: string | null = null;
    await expect.poll(async () => {
        const fresh = (await fakeSmsTo(phone)).filter((m) => !before.has(m.ticket));
        code = fresh.map((m) => /code administrateur (\d{6})/.exec(m.message)?.[1]).find((c): c is string => Boolean(c)) ?? null;
        return code;
    }, { message: 'SMS du code administrateur reçu par le faux MTarget', timeout: 15_000 }).not.toBeNull();
    await dialog.getByRole('textbox', { name: /chiffre 1 sur 6/i }).click();
    await page.keyboard.type(String(code));
    await dialog.getByRole('button', { name: /valider le code/i }).click();
    await expect(dialog, 'fenêtre fermée après le code').toBeHidden({ timeout: 15_000 });
}

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
        if (role.arrivee.test('/admin')) await passAdminCode(page, email);
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        await context.storageState({ path: storageStatePath(role.key) });
    });
}
