/**
 * Stabilité — connexion d'un administrateur : aucun rechargement de page après l'arrivée (mini-lot stabilite/connexion).
 *
 * Course vue aux runs 474 et 476 (connexion du super-administrateur dans e2e/auth.setup.ts) : après « Se connecter »,
 * components/auth/LoginForm.tsx appelait router.refresh() — sur /login d'un compte connecté, middleware.ts répond par une
 * redirection vers l'espace du compte, suivie SANS recharger la page — puis rechargeait toute la page 400 ms plus tard
 * (window.location.href). La fenêtre « Code administrateur » paraissait sur la première page ; un clic sur « Recevoir le code
 * par SMS » tombé avant le rechargement était perdu (aucun SMS, run 474) ou défait (SMS parti, fenêtre revenue à « Recevoir le
 * code par SMS », run 476).
 *
 * Test : compte ADMIN du seed de test (aucune autre phase ne l'ouvre), contexte neuf (appareil inconnu : la fenêtre du code
 * s'ouvre), connexion par le formulaire. Un script posé avant chaque document journalise dans sessionStorage chaque
 * chargement de document et chaque changement d'adresse sans rechargement (history.pushState / replaceState). Clic sur
 * « Recevoir le code par SMS » dès que la fenêtre paraît.
 *  1. Après le départ de /login, l'adresse ne change qu'une fois, par un chargement de document : aucune page de l'espace
 *     n'est affichée puis rechargée.
 *  2. La fenêtre passe à la saisie du code et y reste (case « chiffre 1 sur 6 » encore là 3 s plus tard) ; un seul SMS de code.
 */
import { expect, test } from '@playwright/test';
import { FIXTURE_USERS, TEST_PASSWORD } from '../tests/helpers/fixture-data';
import { openAnonymousContext } from './support/fixtures';
import { fakeSmsTo } from './support/parcours';

const LOG_KEY = '__ev_navigations';

/** Avant chaque document : journal des chargements et des changements d'adresse sans rechargement (sessionStorage). */
function installNavigationLog(key: string): void {
    const push = (kind: string, url: string): void => {
        try {
            const list = JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[];
            list.push(`${kind} ${new URL(url, location.href).pathname}`);
            sessionStorage.setItem(key, JSON.stringify(list));
        } catch {
            // Stockage indisponible : le test le verra (journal vide)
        }
    };
    push('document', location.href);
    for (const method of ['pushState', 'replaceState'] as const) {
        const original = history[method].bind(history);
        history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
            const before = location.pathname;
            original(data, unused, url);
            if (location.pathname !== before) push('soft', location.href);
        };
    }
}

test('connexion d’un administrateur : la page de l’espace n’est jamais rechargée après l’arrivée ; le code demandé tout de suite est gardé', async ({ browser }, testInfo) => {
    const admin = FIXTURE_USERS.ADMIN;
    const context = await openAnonymousContext(browser, testInfo);
    await context.addInitScript(installNavigationLog, LOG_KEY);
    const page = await context.newPage();
    try {
        await page.goto('/login');
        await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(admin.email);
        await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
        const before = new Set((await fakeSmsTo(admin.phone)).map((m) => m.ticket));
        await page.getByRole('button', { name: /^se connecter$/i }).click();

        // Clic dès que la fenêtre paraît, comme un utilisateur rapide (ou e2e/auth.setup.ts)
        const dialog = page.getByRole('alertdialog', { name: /code administrateur/i });
        await expect(dialog, 'fenêtre du code administrateur').toBeVisible({ timeout: 30_000 });
        await dialog.getByRole('button', { name: /recevoir le code par sms/i }).click();

        const codeBox = page.getByRole('alertdialog', { name: /code administrateur/i }).getByRole('textbox', { name: /chiffre 1 sur 6/i });
        await expect(codeBox, 'saisie du code affichée après « Recevoir le code par SMS »').toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(3_000);
        await expect(codeBox, 'saisie du code toujours affichée 3 s plus tard (aucun rechargement ne l’a défaite)').toBeVisible();

        const log = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[], LOG_KEY);
        console.log(`[CONNEXION-COURSE] journal des adresses : ${log.join(' → ')}`);
        const afterLogin = log.slice(log.findIndex((e) => !e.endsWith(' /login')));
        expect(log.some((e) => !e.endsWith(' /login')), `l'adresse a quitté /login (journal : ${log.join(' → ')})`).toBe(true);
        expect(afterLogin, `après /login, un seul changement d'adresse, par un chargement de document (journal : ${log.join(' → ')})`)
            .toEqual([`document /admin/dashboard`]);

        const codes = (await fakeSmsTo(admin.phone)).filter((m) => !before.has(m.ticket) && /code administrateur \d{6}/.test(m.message));
        expect(codes.length, 'un seul SMS de code administrateur').toBe(1);
    } finally {
        await context.close();
    }
});
