/**
 * Lot 5.1 — test de fumée, clic par clic, sur l'application démarrée (next start) avec les faux
 * services locaux (contrat P, « Fumée ») :
 *  1. le partenaire crée un événement (début dans 2 h) puis le soumet ;
 *  2. le SUPERADMIN le valide ;
 *  3. le partenaire le publie ;
 *  4. un client l'achète : faux SamirPay, puis /__test/samirpay/complete déclenche le vrai webhook,
 *     et la page de suivi affiche le succès ;
 *  5. le partenaire propriétaire scanne le billet sur /partner/scan (caméra simulée à partir de
 *     l'image du QR dynamique du client ; repli E2E_SCAN_MODE=barcode-detector) : « Entrée validée » ;
 *  6. la page de pilotage montre 1 vendu et 1 entrée.
 * Comptes du seed de test (indépendants de la démonstration). Sélecteurs par rôle et libellé
 * accessibles, alignés sur le contrat du lot 5 : le test échoue tant que les écrans du lot ne sont
 * pas livrés (formulaire partagé, transitions, /admin/events, pilotage).
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect, openRoleContext } from './support/fixtures';
import { fumeePayerPhone } from './support/accounts';
import { e2eConfig } from './support/env';
import { fakeScanMode, installFakeCamera } from './support/fake-camera';
import { PageGuard } from './support/network';
import { posterHtml, POSTER_SIZE } from './support/poster';

test.describe.configure({ mode: 'serial' });
test.setTimeout(6 * 60_000);

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Date et heure (Africa/Dakar = UTC+0) au format des champs date et time. */
function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Plus petit bloc qui contient le titre de l'événement et le bouton demandé (carte de la liste). */
function cardOf(page: Page, title: string, action: RegExp): Locator {
    return page.locator('li, article, tr, section, div')
        .filter({ has: page.getByText(title, { exact: true }) })
        .filter({ has: page.getByRole('button', { name: action }) })
        .last();
}

/** Clic sur une action ; si une modale de confirmation s'ouvre, elle est confirmée (même libellé ou « Confirmer »). */
async function actionWithConfirm(page: Page, scope: Locator, action: RegExp): Promise<void> {
    await scope.getByRole('button', { name: action }).click();
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
    if (await dialog.isVisible()) {
        await dialog.getByRole('button', { name: new RegExp(`${action.source}|confirmer`, 'i') }).last().click();
        await expect(dialog).toBeHidden();
    }
}

/** Indicateur de la page de pilotage : plus petit bloc du panneau qui porte le libellé et un nombre. */
function kpi(panel: Locator, label: RegExp): Locator {
    return panel.locator('dl, li, article, section, div')
        .filter({ has: panel.page().getByText(label) })
        .filter({ hasText: /\d/ })
        .last();
}

async function fakeServices(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${e2eConfig().fakeServicesUrl}${pathName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
        json = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        throw new Error(`faux services ${pathName} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, json };
}

test('fumée : créer, soumettre, valider, publier, acheter, scanner, piloter', async ({ browser }, testInfo) => {
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
    const title = `Fumée — Concert des Parcelles ${stamp}`;
    const category = 'Entrée générale';
    const start = new Date(Date.now() + 2 * 3600_000);
    start.setUTCSeconds(0, 0);
    start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
    const end = new Date(start.getTime() + 4 * 3600_000);
    const s = dakarParts(start);
    const e = dakarParts(end);
    let eventId = '';
    let ticketId = '';

    const contexts: BrowserContext[] = [];
    const guards: Array<{ role: string; guard: PageGuard }> = [];
    async function pageAs(role: 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client', withCamera = false): Promise<Page> {
        const context = await openRoleContext(browser, testInfo, role);
        if (withCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
        contexts.push(context);
        const page = await context.newPage();
        guards.push({ role, guard: new PageGuard(page) });
        return page;
    }

    try {
        const partner = await pageAs('fumee-organisateur', true);

        await test.step('1. le partenaire crée l’événement (début dans 2 h)', async () => {
            await partner.goto('/partner/events/new');
            await partner.getByLabel(/^titre/i).fill(title);
            await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
            await partner.getByLabel(/^description/i).fill('Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives.');
            await partner.getByLabel(/date de début/i).fill(s.date);
            await partner.getByLabel(/heure de début/i).fill(s.time);
            await partner.getByLabel(/date de fin/i).fill(e.date);
            await partner.getByLabel(/heure de fin/i).fill(e.time);
            await partner.getByLabel(/^lieu/i).fill('Esplanade des Parcelles Assainies');
            await partner.getByLabel(/^ville/i).fill('Dakar');
            await partner.getByLabel(/capacité/i).fill('100');

            const posterPage = await partner.context().newPage();
            await posterPage.setViewportSize(POSTER_SIZE);
            await posterPage.setContent(posterHtml({
                title: 'Concert des Parcelles', kicker: 'Fumée', dateLabel: `${s.date} · ${s.time}`, venue: 'Esplanade des Parcelles Assainies',
                city: 'Dakar', organizer: 'Organisateur de test', palette: 'terre', motif: 'soleil',
            }));
            const poster = await posterPage.screenshot({ type: 'png' });
            await posterPage.close();
            const upload = partner.waitForResponse((r) => r.url().includes('/api/partner/upload') && r.request().method() === 'POST');
            await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-fumee.png', mimeType: 'image/png', buffer: poster });
            expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);

            for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
                await partner.getByRole('button', { name: /^suivant/i }).click();
            }
            await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
            await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
            await partner.getByLabel(/nom de la catégorie/i).fill(category);
            await partner.getByLabel(/^prix/i).fill('5000');
            await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
            await partner.getByRole('button', { name: /^enregistrer/i }).click();
            await partner.waitForURL(/\/partner\/events(\?|$)/);
            await expect(partner.getByText(title, { exact: true })).toBeVisible();
        });

        await test.step('1 bis. le partenaire soumet l’événement', async () => {
            const card = cardOf(partner, title, /^soumettre/i);
            await actionWithConfirm(partner, card, /^soumettre/i);
            await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
                .toContainText(/en attente de validation/i);
        });

        await test.step('2. le SUPERADMIN valide l’événement', async () => {
            const admin = await pageAs('fumee-superadmin');
            // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
            // réponse de la fiche et de la transition est écrite dans e2e.log.
            admin.on('response', async (res) => {
                const url = new URL(res.url());
                if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
                const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
                console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
            });
            admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
            await admin.goto('/admin/events?status=EN_ATTENTE');
            await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
            await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
            await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
            await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
        });

        await test.step('3. le partenaire publie l’événement', async () => {
            await partner.goto('/partner/events');
            const card = cardOf(partner, title, /^publier/i);
            await actionWithConfirm(partner, card, /^publier/i);
            await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
                .toContainText(/publié/i);
        });

        const client = await pageAs('fumee-client');
        await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
            await client.goto('/explore');
            await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
            await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
            eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
            await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
            await client.getByRole('button', { name: /^acheter/i }).click();
            const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
            await expect(dialog).toBeVisible();
            await dialog.getByRole('radio', { name: /^wave/i }).check();
            await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
            await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
            await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
            const succeeded = client.waitForResponse(async (r) => {
                if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
                const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
                return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
            }, { timeout: 45_000 });
            const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
            expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
            expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
            const status = (await (await succeeded).json()) as { ticket_ids: string[] };
            ticketId = status.ticket_ids[0];
            await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
        });

        await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
            await partner.goto('/partner/scan');
            const select = partner.getByLabel('Événement contrôlé');
            const value = await select.locator('option', { hasText: title }).getAttribute('value');
            expect(value, 'événement publié proposé au scan').toBeTruthy();
            await select.selectOption(value as string);
            const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
            if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();

            expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
            const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
            await client.goto('/tickets');
            const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
            const ticketCard = client.locator('li, article, section, div')
                .filter({ has: client.getByText(title) })
                .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
                .last();
            const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
            await expect(qr).toBeVisible();
            const png = await qr.screenshot();
            await partner.evaluate(async ({ dataUrl, p }) => {
                const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
                if (!cam) throw new Error('caméra simulée absente de la page');
                cam.setPayload(p);
                await cam.show(dataUrl);
            }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
            await expect(partner.getByText('Entrée validée')).toBeVisible({ timeout: 40_000 });
        });

        await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
            expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
            await partner.goto(`/partner/events/${eventId}`);
            const apercu = partner.getByRole('tab', { name: /^aperçu/i });
            if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
            const panel = partner.getByRole('tabpanel');
            await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
            await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
        });
    } finally {
        const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
        if (issues.length > 0) {
            await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
            console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
        }
        for (const c of contexts) await c.close();
    }
});
