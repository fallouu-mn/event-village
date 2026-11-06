/**
 * Lot 8 (consigne 8.3 b, contrat 15.5, décisions L79, L84 ; commit test(8.3b)) — recette de la billetterie : quatre parcours
 * enchaînés sur une seule base, celle du seed e2e, sans db reset, découpés en 8 actes étiquetés par rôle. Le parcours d'un
 * rôle est la réunion de ses actes :
 *   npx playwright test --project=recette --grep "\[client\]"
 * Mode « serial » : chaque acte s'appuie sur le précédent (le client achète ce que le partenaire a publié, le partenaire
 * retire ce que le client a payé). Un acte rouge saute les suivants : le premier rouge est le seul à lire.
 *
 * Comptes neufs créés à l'écran : client C1, partenaire P1, contrôleur K1 ; numéros dérivés de l'horloge, codes SMS lus sur
 * le faux MTarget (GET /__test/sms). Comptes du seed : fumee-superadmin, admin (démonstration, notifications.write),
 * fumee-client-bis (destinataire du transfert et second acheteur). Aucune route de test dans l'application.
 *
 * Données (contrat 15.5) : E1 de P1, début à ≈ 20 h, 100 places, avec Standard 6 000 F (en ligne et guichet, 50), Sur place
 * 5 000 F (guichet seul, 20), Invitations 0 F (aucun canal, 10), Découverte 0 F (en ligne, 20) ; E2 de P1 à J+2, Standard
 * 3 000 F, pour une annulation qui ne casse pas E1. Réglages posés à l'écran à l'acte 1 et remis dans afterAll :
 * finance.payout_hold_enabled à false (fonds disponibles pour le retrait) et access.scan_window_before_hours à 24.
 *
 * Écart de données, signalé : le contrat achète 2 Standard. C1 les achète, et le second client en achète 2 de plus, seuls
 * billets payants encore valables pour le remboursement à l'écran (acte 6, A4) et le remboursement bloqué (acte 8, A3) :
 * ceux de C1 sont consommés par le scan hors ligne et par le transfert.
 *
 * Invariants (a) à (t) (L79) : fin des actes 4, 5, 6 et 8, boîte d'envoi vidée par la vraie route, 0 ligne restée due
 * exigée, [INVARIANT-RECETTE] dans e2e.log. Jamais pendant un paiement en cours.
 *
 * Preuves portées ici et absentes ailleurs : A15 (programme et infos pratiques affichés sur la fiche), A3 et A4 de bout en
 * bout sur les vrais écrans, inscription du partenaire et du client à l'écran, activation d'un contrôleur par son SMS.
 * Les erreurs du navigateur sont imprimées et jointes, sans bloquer, comme la fumée.
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
import { readDemoIds } from './support/demo-ids';
import { test, expect, openAnonymousContext, openRoleContext } from './support/fixtures';
import type { RoleKey } from './support/accounts';
import { e2eConfig } from './support/env';
import { PageGuard } from './support/network';
import {
    actionWithConfirm, assertInvariants, buyThroughUi, cardOf, dakarDayFrom, dakarParts, drainOutbox, escapeRe, expectResumed, fakeServices, fakeSmsTo, fillOtp, kpi,
    openTab, payloadFromLot, readStoredLots, restoreSetting, settingValue, smsCode, smsSeen, type StoredLot,
} from './support/parcours';
import { posterHtml, POSTER_SIZE } from './support/poster';
import { createPublishedEvent, eventImageUrl, outboxOfEvent, serviceClient, ticketNumbers, userIdByEmail } from './support/service';
import { installScanProbe, livePayload, openScanner, presentPayload, verifyHolderPhone } from './support/terrain';
import { FIXTURE_USERS, TEST_PASSWORD } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });
test.setTimeout(6 * 60_000);

const HOLD_KEY = 'finance.payout_hold_enabled';
const SCAN_WINDOW_KEY = 'access.scan_window_before_hours';
const FAKE_BALANCE = 50_000_000;
const NOTICE_E2 = 'Concert de recette annulé : les billets payés en ligne sont remboursés automatiquement.';
const PROGRAM = { time: '20:30', title: 'Grand cercle de recette', participant: 'Ensemble des Almadies' };
const PRACTICAL = {
    address: '12, route de la Corniche, Ngor', parking: 'Parking surveillé devant le site.',
    access: 'Entrée principale par la plage de Ngor.', rules: 'Billet présenté sur téléphone, sans objet en verre.',
};

interface CategorySpec { name: string; price: number; total: number; online: boolean; counter: boolean; result: string }
const CATEGORIES: readonly CategorySpec[] = [
    { name: 'Standard', price: 6000, total: 50, online: true, counter: true, result: 'En ligne et au guichet' },
    { name: 'Sur place', price: 5000, total: 20, online: false, counter: true, result: 'Sur place uniquement' },
    { name: 'Invitations', price: 0, total: 10, online: false, counter: false, result: 'Invitations seulement' },
    { name: 'Découverte', price: 0, total: 20, online: true, counter: false, result: 'En ligne uniquement' },
];

/** Numéros dérivés de l'horloge, un préfixe par compte : `^\+221[7][05678]\d{7}$` (lib/validations/auth.ts). */
const TAIL = String(Date.now() % 10_000_000).padStart(7, '0');
const STAMP = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
const local = (prefix: string): string => `${prefix}${TAIL}`;

/** Objet Recette du contrat : état partagé par les actes, en mémoire du fichier. */
interface Recette {
    c1: { local: string; phone: string; firstName: string; userId: string };
    p1: { local: string; phone: string; email: string; company: string; firstName: string; userId: string };
    k1: { local: string; phone: string; firstName: string };
    bisPhone: string;
    e1: { id: string; title: string; categories: Record<string, string> };
    e2: { id: string; title: string };
    pin: string;
    /** Billets : Std1 scanné hors ligne, Std2 transféré puis saisi à la main, free scanné en ligne, e2 remboursé par l'annulation. */
    tickets: { std1: string; std2: string; free: string; e2: string; refundShown: string; refundBlocked: string };
    numbers: Record<string, string>;
    /** Lot hors ligne de Std2 relevé AVANT son transfert : ancien code présenté à l'acte 5. */
    oldLot: StoredLot | null;
}

const r: Recette = {
    c1: { local: local('78'), phone: `+221${local('78')}`, firstName: 'Awa', userId: '' },
    p1: {
        local: local('77'), phone: `+221${local('77')}`, email: `p1.${TAIL}@recette.eventvillage.local`, company: `Recette Productions ${STAMP}`, firstName: 'Mame', userId: '',
    },
    k1: { local: local('76'), phone: `+221${local('76')}`, firstName: 'Modou' },
    bisPhone: FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''),
    e1: { id: '', title: `Recette — Nuit de Ngor ${STAMP}`, categories: {} },
    e2: { id: '', title: `Recette — Concert annulé ${STAMP}` },
    pin: '',
    tickets: { std1: '', std2: '', free: '', e2: '', refundShown: '', refundBlocked: '' },
    numbers: {},
    oldLot: null,
};

/** Réglages lus avant l'acte 1, remis dans afterAll même après un échec. */
const previousSettings = new Map<string, unknown>();

interface Opened { who: string; context: BrowserContext; page: Page; guard: PageGuard }

/** Contextes gardés d'un acte à l'autre (un seul worker, mode serial), fermés et diagnostiqués dans afterAll. */
const opened: Opened[] = [];
const byWho = new Map<string, Opened>();

function adopt(who: string, context: BrowserContext, page: Page): Page {
    const o = { who, context, page, guard: new PageGuard(page) };
    opened.push(o);
    byWho.set(who, o);
    return page;
}

function known(who: string): Page {
    const o = byWho.get(who);
    if (!o) throw new Error(`[e2e][recette] page de « ${who} » absente : un acte précédent n'a pas abouti`);
    return o.page;
}

async function asRole(browser: Browser, testInfo: TestInfo, role: RoleKey): Promise<Page> {
    const existing = byWho.get(role);
    if (existing) return existing.page;
    const context = await openRoleContext(browser, testInfo, role, 'clair');
    return adopt(role, context, await context.newPage());
}

async function asNew(browser: Browser, testInfo: TestInfo, who: string, opts: { probe?: boolean } = {}): Promise<Page> {
    const context = await openAnonymousContext(browser, testInfo, opts.probe ? 'sombre' : 'clair');
    if (opts.probe) await context.addInitScript(installScanProbe);
    return adopt(who, context, await context.newPage());
}

function pathOf(url: string): string {
    return new URL(url).pathname;
}

/** Réponse d'une route, attendue autour d'une action : statut exigé, corps cité dans le message d'échec. */
async function expectRoute(page: Page, method: string, path: RegExp | string, action: () => Promise<unknown>, status: number, what: string): Promise<Record<string, unknown>> {
    const waited = page.waitForResponse((res) => {
        if (res.request().method() !== method) return false;
        const p = pathOf(res.url());
        return typeof path === 'string' ? p === path : path.test(p);
    });
    await action();
    const res = await waited;
    const text = await res.text();
    expect(res.status(), `${what} : ${text.slice(0, 300)}`).toBe(status);
    if (!/json/i.test(res.headers()['content-type'] ?? '')) return {};
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
        throw new Error(`${what} : réponse JSON illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 300)}`);
    }
}

/** Ligne d'un réglage sur /admin/finance-settings : valeur modifiée à l'écran, motif obligatoire. */
function settingRow(page: Page, label: string): Locator {
    return page.getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) });
}

async function editSetting(page: Page, label: string, apply: (row: Locator) => Promise<unknown>, reason: string): Promise<Locator> {
    const row = settingRow(page, label);
    await row.getByRole('button', { name: `Modifier ${label}` }).click();
    await apply(row);
    await row.getByRole('textbox', { name: /^motif/i }).fill(reason);
    return row;
}

async function saveSetting(page: Page, label: string, row: Locator, value: string): Promise<void> {
    await expectRoute(page, 'PUT', '/api/admin/finance-settings', () => row.getByRole('button', { name: /^enregistrer$/i }).click(), 200, `réglage « ${label} »`);
    await expect(settingRow(page, label).getByText(value, { exact: true }), `réglage « ${label} » affiché`).toBeVisible();
}

/** Connexion par le formulaire (e2e/auth.setup.ts), mot de passe de test. */
async function signIn(page: Page, identifier: string, arrival: RegExp): Promise<void> {
    await page.goto('/login');
    await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(identifier);
    await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^se connecter$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
    await expect.poll(() => pathOf(page.url()), { message: `page d'arrivée de ${identifier}`, timeout: 15_000 }).toMatch(arrival);
}

/** Pièce d'inscription : seule la signature du contenu est lue par la route de dépôt. */
function pdfDocument(name: string): { name: string; mimeType: string; buffer: Buffer } {
    return { name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${name}, pièce fictive de la recette\n%%EOF\n`, 'latin1') };
}

async function posterPng(page: Page, title: string, dateLabel: string): Promise<Buffer> {
    const poster = await page.context().newPage();
    await poster.setViewportSize(POSTER_SIZE);
    await poster.setContent(posterHtml({ title, kicker: 'Recette', dateLabel, venue: 'Corniche de Ngor', city: 'Dakar', organizer: r.p1.company, palette: 'ocean', motif: 'vagues' }));
    const png = await poster.screenshot({ type: 'png' });
    await poster.close();
    return png;
}

async function addCategory(page: Page, index: number, c: CategorySpec): Promise<void> {
    await page.getByRole('button', { name: /^ajouter une catégorie$/i }).click();
    const section = page.locator('section[aria-labelledby$="-titre"]').nth(index);
    await section.getByLabel(/^nom de la catégorie/i).fill(c.name);
    await section.getByLabel(/^prix/i).fill(String(c.price));
    await section.getByLabel(/^quantité mise en vente/i).fill(String(c.total));
    await section.getByRole('checkbox', { name: /^vendue en ligne/i }).setChecked(c.online);
    await section.getByRole('checkbox', { name: /^vendue au guichet/i }).setChecked(c.counter);
    await expect(section.getByText(c.result, { exact: true }), `résumé des canaux de « ${c.name} »`).toBeVisible();
}

/** Billets d'un compte sur un événement, du plus ancien au plus récent. */
async function ticketsOf(eventId: string, userId: string, categoryId: string): Promise<string[]> {
    const { data, error } = await serviceClient().from('tickets').select('id').eq('event_id', eventId).eq('user_id', userId).eq('category_id', categoryId).order('ticket_number');
    if (error) throw new Error(`[e2e] billets de ${userId} : ${error.message}`);
    return (data ?? []).map((t) => String(t.id));
}

async function ticketStatus(id: string): Promise<string> {
    const { data, error } = await serviceClient().from('tickets').select('status').eq('id', id).single();
    if (error || !data) throw new Error(`[e2e] billet ${id} : ${error?.message ?? 'introuvable'}`);
    return String(data.status);
}

/** Plein écran du résultat refermé : le scanner reçoit de nouveau les gestes. */
async function resultClosed(page: Page): Promise<void> {
    await expect(page.locator('[data-scan-state="result"]'), 'plein écran du résultat refermé').toHaveCount(0, { timeout: 20_000 });
}

async function expectScan(page: Page, payload: string, what: string, expected: string): Promise<void> {
    const { record } = await presentPayload(page, payload, what);
    await expect(page.locator(`[data-scan-result="${expected}"]`).first(), `${what} : « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
    await resultClosed(page);
}

async function videoPlaying(page: Page, what: string): Promise<void> {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
        .catch((err: unknown) => {
            throw new Error(`${what} : aucun flux vidéo en lecture (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
        });
}

/** Remboursement unitaire à l'écran (A4) : recherche, motif, confirmation ; le POST ne part que de la seconde étape. */
async function refundOnScreen(page: Page, ticketNumber: string, reason: string, expectedNotice: RegExp): Promise<void> {
    await page.goto(`/partner/events/${r.e1.id}`);
    await openTab(page, /^ventes/i);
    await page.getByLabel(/^numéro du billet/i).fill(ticketNumber);
    await expectRoute(page, 'GET', /\/tickets\/lookup$/, () => page.getByRole('button', { name: /^rechercher le billet$/i }).click(), 200, `recherche du billet ${ticketNumber}`);
    await page.getByRole('button', { name: /^rembourser ce billet$/i }).click();
    const reasonDialog = page.getByRole('dialog', { name: /^motif du remboursement$/i });
    await expect(reasonDialog).toBeVisible();
    await reasonDialog.getByRole('textbox').fill(reason);
    await reasonDialog.getByRole('button', { name: /^continuer$/i }).click();
    const confirm = page.getByRole('alertdialog', { name: /^confirmer le remboursement/i });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(reason), 'motif rappelé dans la confirmation').toBeVisible();
    await expect(confirm.getByRole('button', { name: /^revenir à la fiche$/i })).toBeVisible();
    await expectRoute(page, 'POST', /\/tickets\/[^/]+\/refund$/, () => confirm.getByRole('button', { name: /^rembourser le client$/i }).click(), 200, `remboursement du billet ${ticketNumber}`);
    await expect(page.getByText(expectedNotice).first(), `issue du remboursement du billet ${ticketNumber}`).toBeVisible();
}

test.beforeAll(() => {
    e2eConfig();
});

test.afterAll(async () => {
    const problems: string[] = [];
    const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    for (const [key, value] of Array.from(previousSettings.entries())) {
        await restoreSetting(key, value, superadminId).catch((err: unknown) => problems.push(err instanceof Error ? err.message : String(err)));
    }
    const balance = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE })
        .catch((err: unknown) => ({ status: 0, json: { error: err instanceof Error ? err.message : String(err) } }));
    if (balance.status !== 200) problems.push(`solde du faux SamirPay non rétabli : ${JSON.stringify(balance)}`);
    for (const { who, guard } of opened) {
        const seen = [...guard.blockingIssues(), ...guard.nonBlockingIssues()];
        if (seen.length > 0) console.log(`[e2e][recette] ${who} — observations du navigateur (non bloquantes) :\n${seen.join('\n')}`);
    }
    for (const c of Array.from(new Set(opened.map((o) => o.context)))) await c.close();
    if (problems.length > 0) throw new Error(`[e2e][recette] remise en état incomplète :\n${problems.join('\n')}`);
});

test('acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé', async ({ browser }, testInfo) => {
    for (const key of [HOLD_KEY, SCAN_WINDOW_KEY]) previousSettings.set(key, await settingValue(key));
    const page = await asRole(browser, testInfo, 'fumee-superadmin');
    const hold = 'Délai de garde des ventes';
    const holdReason = `Recette ${STAMP} : fonds disponibles dès le paiement`;

    await test.step('motif exigé, puis réglage enregistré et historisé', async () => {
        await page.goto('/admin/finance-settings');
        const row = settingRow(page, hold);
        await row.getByRole('button', { name: `Modifier ${hold}` }).click();
        await row.getByLabel(/^nouvelle valeur/i).selectOption('false');
        await row.getByRole('button', { name: /^enregistrer$/i }).click();
        await expect(row.getByText(/indiquez le motif/i), 'sans motif, rien n’est envoyé').toBeVisible();
        await row.getByRole('button', { name: /^annuler$/i }).click();

        const edited = await editSetting(page, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('false'), holdReason);
        await saveSetting(page, hold, edited, 'Désactivé');
        await expect(page.getByRole('listitem').filter({ hasText: holdReason }), 'motif dans l’historique des modifications').toBeVisible();
        expect(await settingValue(HOLD_KEY), `${HOLD_KEY} en base`).toBe(false);
    });

    await test.step('fenêtre de scan portée à 24 h (billet et contrôle de la veille)', async () => {
        const label = 'Ouverture du contrôle avant le début';
        const row = await editSetting(page, label, (l) => l.getByLabel(/^nouvelle valeur/i).fill('24'), `Recette ${STAMP} : contrôle ouvert la veille`);
        await saveSetting(page, label, row, '24 h');
        expect(await settingValue(SCAN_WINDOW_KEY), `${SCAN_WINDOW_KEY} en base`).toBe(24);
    });

    await test.step('un ADMIN lit les réglages, sa modification est refusée', async () => {
        const admin = await asRole(browser, testInfo, 'admin');
        await admin.goto('/admin/finance-settings');
        const row = await editSetting(admin, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('true'), 'Tentative d’un ADMIN sans le droit');
        await expectRoute(admin, 'PUT', '/api/admin/finance-settings', () => row.getByRole('button', { name: /^enregistrer$/i }).click(), 403, 'modification par un ADMIN');
        await expect(row.getByText('Réglage non enregistré'), 'refus affiché').toBeVisible();
        expect(await settingValue(HOLD_KEY), `${HOLD_KEY} inchangé après le refus`).toBe(false);
    });
});

test('acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2', async ({ browser }, testInfo) => {
    const partner = await asNew(browser, testInfo, 'P1');
    const admin = await asRole(browser, testInfo, 'fumee-superadmin');

    await test.step('inscription du partenaire : formulaire, 2 pièces, code SMS', async () => {
        await partner.goto('/partner/register');
        await partner.locator('#partenaire-raison-sociale').fill(r.p1.company);
        await partner.locator('#partenaire-description').fill('Organisateur de la recette de la billetterie. Données fictives.');
        await partner.locator('#partenaire-adresse').fill('12, route de la Corniche, Ngor');
        await partner.locator('#partenaire-ville').fill('Dakar');
        await partner.locator('#partenaire-prenom').fill(r.p1.firstName);
        await partner.locator('#partenaire-nom').fill('Recette');
        await partner.locator('#partenaire-telephone').fill(r.p1.local);
        await partner.locator('#partenaire-email').fill(r.p1.email);
        await partner.locator('#partenaire-mot-de-passe').fill(TEST_PASSWORD);
        await partner.locator('#partenaire-confirmation').fill(TEST_PASSWORD);
        await partner.locator('#partenaire-piece-identite').setInputFiles(pdfDocument('piece-identite.pdf'));
        await partner.locator('#partenaire-document-entreprise').setInputFiles(pdfDocument('rccm.pdf'));
        const seen = await smsSeen(r.p1.phone);
        await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^envoyer mon dossier$/i }).click(), 200, 'dépôt du dossier');
        await expect(partner.getByRole('heading', { name: /^vérifiez votre numéro$/i })).toBeVisible();
        await fillOtp(partner, await smsCode(r.p1.phone, seen, 'inscription du partenaire'));
        await partner.getByRole('button', { name: /^vérifier le code$/i }).click();
        await expect(partner.getByRole('heading', { name: /^dossier reçu$/i })).toBeVisible();
    });

    await test.step('validation par le SUPERADMIN, après consultation d’une pièce', async () => {
        await admin.goto('/admin/dashboard');
        await openTab(admin, /^en attente/i);
        const row = admin.locator('tr').filter({ hasText: r.p1.company });
        await row.getByRole('button', { name: /^dossier$/i }).click();
        const details = admin.getByRole('dialog', { name: /^dossier du partenaire/i });
        await expect(details).toBeVisible();
        const signed = await expectRoute(admin, 'GET', '/api/partner/documents/signed-url',
            () => details.getByRole('button', { name: /^ouvrir la pièce d’identité/i }).click(), 200, 'lien de consultation de la pièce d’identité');
        expect(typeof signed.signedUrl, 'URL signée de la pièce').toBe('string');
        const file = await fetch(String(signed.signedUrl));
        expect(file.status, 'pièce lue par son URL signée').toBe(200);
        expect((await file.text()).startsWith('%PDF-'), 'pièce d’identité : le fichier déposé').toBe(true);
        await details.getByRole('button', { name: /^valider la candidature$/i }).click();
        const validation = admin.getByRole('alertdialog', { name: /^valider la candidature/i });
        await expectRoute(admin, 'PATCH', /^\/api\/admin\/partners\/[^/]+\/status$/, () => validation.getByRole('button', { name: /^valider la candidature$/i }).click(), 200, 'validation de la candidature');
        await expect(row, 'candidature sortie de la file').toHaveCount(0);
    });

    await test.step('P1 se connecte, crée E1 : affiche, programme, infos pratiques, 4 catégories et leurs canaux', async () => {
        await signIn(partner, r.p1.email, /^\/partner(\/|$)/);
        r.p1.userId = await userIdByEmail(r.p1.email);

        const start = new Date(Date.now() + 20 * 3600_000);
        start.setUTCSeconds(0, 0);
        start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
        const s = dakarParts(start);
        const e = dakarParts(new Date(start.getTime() + 4 * 3600_000));
        await partner.goto('/partner/events/new');
        await partner.getByLabel(/^titre/i).fill(r.e1.title);
        await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
        await partner.getByLabel(/^description/i).fill('Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives.');
        await partner.getByLabel(/date de début/i).fill(s.date);
        await partner.getByLabel(/heure de début/i).fill(s.time);
        await partner.getByLabel(/date de fin/i).fill(e.date);
        await partner.getByLabel(/heure de fin/i).fill(e.time);
        await partner.getByLabel(/^lieu/i).fill('Corniche de Ngor');
        await partner.getByLabel(/^ville/i).fill('Dakar');
        await partner.getByLabel(/capacité/i).fill('100');
        const upload = partner.waitForResponse((res) => res.url().includes('/api/partner/upload') && res.request().method() === 'POST');
        await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-recette.png', mimeType: 'image/png', buffer: await posterPng(partner, 'Nuit de Ngor', `${s.date} · ${s.time}`) });
        expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);

        await partner.getByRole('button', { name: /^suivant/i }).click();
        await expect(partner.getByRole('heading', { level: 2, name: /^programme$/i })).toBeVisible();
        await partner.getByRole('button', { name: /^ajouter une ligne$/i }).click();
        await partner.getByLabel(/^heure/i).fill(PROGRAM.time);
        await partner.getByLabel(/^intitulé/i).fill(PROGRAM.title);
        await partner.getByLabel(/^artiste ou intervenant/i).fill(PROGRAM.participant);

        await partner.getByRole('button', { name: /^suivant/i }).click();
        await expect(partner.getByRole('heading', { level: 2, name: /^accès et informations pratiques$/i })).toBeVisible();
        await partner.getByLabel(/^adresse précise/i).fill(PRACTICAL.address);
        await partner.getByLabel(/^stationnement/i).fill(PRACTICAL.parking);
        await partner.getByLabel(/^indications d.accès/i).fill(PRACTICAL.access);
        await partner.getByLabel(/^règles à respecter/i).fill(PRACTICAL.rules);

        await partner.getByRole('button', { name: /^suivant/i }).click();
        await expect(partner.getByRole('heading', { level: 2, name: /^billetterie$/i })).toBeVisible();
        for (let i = 0; i < CATEGORIES.length; i++) await addCategory(partner, i, CATEGORIES[i]);
        await partner.getByRole('button', { name: /^enregistrer le brouillon$/i }).click();
        await partner.waitForURL(/\/partner\/events(\?|$)/);
        await expect(partner.getByText(r.e1.title, { exact: true })).toBeVisible();

        const { data: ev, error } = await serviceClient().from('events').select('id').eq('title', r.e1.title).single();
        if (error || !ev) throw new Error(`[e2e] événement E1 : ${error?.message ?? 'introuvable'}`);
        r.e1.id = String(ev.id);
        const { data: cats, error: catErr } = await serviceClient().from('ticket_categories').select('id, name, sale_online, sale_counter, is_visible').eq('event_id', r.e1.id);
        if (catErr) throw new Error(`[e2e] catégories de E1 : ${catErr.message}`);
        for (const c of cats ?? []) r.e1.categories[String(c.name)] = String(c.id);
        expect((cats ?? []).map((c) => `${String(c.name)} ${String(c.sale_online)} ${String(c.sale_counter)} ${String(c.is_visible)}`).sort(), 'canaux enregistrés, is_visible en miroir')
            .toEqual(CATEGORIES.map((c) => `${c.name} ${c.online} ${c.counter} ${c.online}`).sort());
    });

    await test.step('soumission par P1, validation par le SUPERADMIN, publication par P1', async () => {
        await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^soumettre/i), /^soumettre/i);
        await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/en attente de validation/i);

        await admin.goto('/admin/events?status=EN_ATTENTE');
        await admin.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).click();
        await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
        await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
        await expect(admin.getByText(/^validé$/i).first()).toBeVisible();

        await partner.goto('/partner/events');
        await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^publier/i), /^publier/i);
        await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/publié/i);
    });

    await test.step('E2 de P1 à J+2 (RPC du lot 5), Standard 3 000 F : l’annulation de l’acte 7 ne touche pas E1', async () => {
        const day = dakarDayFrom(new Date(), 2);
        r.e2.id = await createPublishedEvent({
            partnerUserId: r.p1.userId,
            superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
            title: r.e2.title,
            description: 'Concert de la recette destiné à être annulé : remboursement automatique. Données fictives.',
            startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
            location: 'Corniche de Ngor', city: 'Dakar', capacity: 100,
            imageUrl: await eventImageUrl(r.e1.id),
            category: { name: 'Standard', price: 3000, total: 50 },
        });
    });
});

test('acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur', async () => {
    const partner = known('P1');
    await partner.goto(`/partner/events/${r.e1.id}`);
    await openTab(partner, /^équipe/i);

    await test.step('invitation de K1 avec la permission espèces, SMS d’activation', async () => {
        await partner.getByLabel(/^prénom/i).fill(r.k1.firstName);
        await partner.getByLabel(/^nom/i).first().fill('Controle');
        await partner.getByLabel(/^téléphone du contrôleur/i).fill(r.k1.local);
        await partner.getByRole('checkbox', { name: /encaissement en espèces/i }).check();
        const invited = await expectRoute(partner, 'POST', '/api/partner/team/invite', () => partner.getByRole('button', { name: /^inviter le contrôleur$/i }).click(), 201, 'invitation du contrôleur');
        expect(String(invited.message ?? ''), 'SMS d’activation parti').toMatch(/SMS avec code d'activation envoyé/);
    });

    await test.step('point d’entrée et permission espèces lus sur la fiche du contrôleur', async () => {
        const card = partner.getByRole('list', { name: /^contrôleurs affectés$/i }).getByRole('listitem').filter({ hasText: r.k1.firstName });
        await expect(card.getByRole('switch'), 'permission espèces de cette affectation').toHaveAttribute('aria-checked', 'true');
        await card.getByLabel(/^point d.entrée/i).fill('Porte Ngor');
        await expectRoute(partner, 'PATCH', '/api/partner/team/entry-point', () => card.getByRole('button', { name: /^enregistrer$/i }).click(), 200, 'point d’entrée');
    });

    await test.step('PIN régisseur généré, affiché une fois', async () => {
        await openTab(partner, /^caisse/i);
        await partner.getByRole('button', { name: /^générer le code pin$/i }).click();
        await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/regisseur-pin`, () => partner.getByRole('alertdialog').getByRole('button', { name: /^générer le code$/i }).click(), 200, 'génération du PIN');
        const dialog = partner.getByRole('dialog', { name: /^nouveau code pin régisseur$/i });
        await expect(dialog).toBeVisible();
        r.pin = (await dialog.getByLabel(/^code pin/i).innerText()).trim();
        expect(r.pin, 'PIN affiché à sa génération').toMatch(/^\d{4,8}$/);
        await dialog.getByRole('button', { name: /^j’ai noté le code$/i }).click();
        await expect(partner.getByText(/un code est en place/i)).toBeVisible();
    });
});

test('acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert', async ({ browser }, testInfo) => {
    const client = await asNew(browser, testInfo, 'C1');
    const standard = (): RegExp => /ajouter un billet standard/i;

    await test.step('visiteur : recherche, ville, fiche avec programme et infos pratiques (A15), catégories hors ligne absentes', async () => {
        await client.goto('/explore');
        await client.getByLabel(/^rechercher un événement/i).fill(r.e1.title);
        await client.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
        await expect(client.getByRole('link', { name: /Nuit du Sabar/ }), 'recherche : un autre événement de Dakar disparaît').toHaveCount(0);
        await client.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).first().click();
        await client.waitForURL(new RegExp(`/events/${r.e1.id}`));
        await expect(client.getByRole('heading', { level: 1, name: r.e1.title })).toBeVisible();

        await expect(client.getByRole('heading', { name: /^programme$/i }), 'A15 : section Programme').toBeVisible();
        await expect(client.getByText(PROGRAM.title, { exact: true }), 'A15 : ligne du programme').toBeVisible();
        await expect(client.getByText(PROGRAM.participant), 'A15 : artiste du programme').toBeVisible();
        await expect(client.getByRole('heading', { name: /^lieu et accès$/i }), 'A15 : section des infos pratiques').toBeVisible();
        for (const text of [PRACTICAL.address, PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
            await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
        }

        await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
        await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
        await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
        await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
        await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
    });

    await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
        await client.getByRole('button', { name: standard() }).click();
        await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
        await client.waitForURL(/\/login\?redirect=/);
        await client.getByRole('link', { name: /^créer un compte client$/i }).click();
        await client.waitForURL(/\/register\?redirect=/);
        const seen = await smsSeen(r.c1.phone);
        await client.locator('#inscription-telephone').fill(r.c1.local);
        await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
        await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
        await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
        await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
        await client.getByLabel(/^nom/i).fill('Recette');
        await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
        await client.getByRole('button', { name: /^créer mon compte$/i }).click();
        await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
    });

    await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
        const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
        if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
        r.c1.userId = String(data.id);
        const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
                body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
            });
            return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
        }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
        expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
        expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
    });

    await test.step('achat de 2 Standard, puis achat gratuit', async () => {
        const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
        r.tickets.std1 = std1;
        r.tickets.std2 = std2;

        await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
        await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
        await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
        await client.waitForURL(/\/tickets(\?|$)/);
        const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
        expect(free.length, 'un billet gratuit émis').toBe(1);
        r.tickets.free = free[0];
    });

    await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
        const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
        const sw = adopt('C1-hors-ligne', context, await context.newPage());
        const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
        Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
        await sw.goto('/tickets');
        for (const number of [n1, n2, nFree]) {
            const card = sw.locator('li, article').filter({ hasText: number }).last();
            await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
            await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
        }
        const lots = await readStoredLots(sw, r.tickets.std2);
        expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
        r.oldLot = lots[0];
    });

    await test.step('transfert du 2e billet au second client, acceptation', async () => {
        const recipient = verifyHolderPhone('client-bis');
        console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
        await client.goto('/tickets');
        const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
        await card.getByRole('button', { name: /^transférer$/i }).click();
        const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(r.bisPhone);
        await expectRoute(client, 'POST', `/api/tickets/${r.tickets.std2}/transfer`, () => dialog.getByRole('button', { name: /^envoyer le billet$/i }).click(), 200, 'transfert du billet');
        await dialog.getByRole('button', { name: /^terminer$/i }).click();

        const bis = await asRole(browser, testInfo, 'fumee-client-bis');
        await bis.goto('/tickets?tab=recus');
        const offer = bis.locator('li, article, section').filter({ hasText: r.e1.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
        await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
        const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
        await expect(confirm).toBeVisible();
        await expectRoute(bis, 'POST', /^\/api\/tickets\/transfers\/[^/]+\/claim$/, () => confirm.getByRole('button', { name: /^accepter le billet$/i }).click(), 200, 'acceptation du transfert');
    });

    await test.step('le second client achète 2 Standard ; C1 achète un billet de E2', async () => {
        const bis = known('fumee-client-bis');
        const [shown, blocked] = await buyThroughUi(bis, r.e1.id, 'Standard', 2, r.bisPhone);
        r.tickets.refundShown = shown;
        r.tickets.refundBlocked = blocked;
        const [nShown, nBlocked] = await ticketNumbers([shown, blocked]);
        Object.assign(r.numbers, { refundShown: nShown, refundBlocked: nBlocked });
        const [e2Ticket] = await buyThroughUi(client, r.e2.id, 'Standard', 1, r.c1.local);
        r.tickets.e2 = e2Ticket;
    });

    await test.step('invariants (a) à (t)', async () => {
        await assertInvariants('recette-client');
    });
});

test('acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture', async ({ browser }, testInfo) => {
    const page = await asNew(browser, testInfo, 'K1', { probe: true });
    const client = known('C1');
    const sw = known('C1-hors-ligne');
    const receiptTo = local('75');

    await test.step('activation du compte par le code du SMS d’invitation', async () => {
        await page.goto(`/controller/setup?phone=${encodeURIComponent(r.k1.phone)}`);
        await expect(page.getByRole('heading', { level: 1, name: /^activer votre compte contrôleur$/i })).toBeVisible();
        await fillOtp(page, await smsCode(r.k1.phone, new Set(), 'invitation du contrôleur'));
        await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
        await page.getByLabel(/^confirmer le mot de passe/i).fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /^activer mon compte$/i }).click();
        await page.waitForURL(/\/controller\/scanner/, { timeout: 30_000 });
    });

    await test.step('ouverture du contrôle à sa porte et de la caisse', async () => {
        await openScanner(page, r.e1.title);
        await openTab(page, /^caisse$/i);
        await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
        const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(/^fonds de caisse/i).fill('5000');
        await expectRoute(page, 'POST', '/api/controller/shifts/open', () => dialog.getByRole('button', { name: /^ouvrir la caisse$/i }).click(), 200, 'ouverture de la caisse');
        await openTab(page, /^contrôle$/i);
        await videoPlaying(page, 'retour au contrôle après l’ouverture de la caisse');
    });

    await test.step('scan en ligne du billet gratuit, code du porteur', async () => {
        await expectScan(page, await livePayload(client, r.tickets.free), 'billet gratuit en ligne', 'valid');
        expect(await ticketStatus(r.tickets.free), 'billet gratuit composté').toBe('UTILISE');
    });

    await test.step('téléphone du client hors ligne : QR accepté', async () => {
        await sw.context().setOffline(true);
        byWho.get('C1-hors-ligne')?.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
        const res = await sw.goto(`/billet/hors-ligne?id=${encodeURIComponent(r.tickets.std1)}`);
        expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
        const qr = sw.locator('[data-ev-qr-payload]');
        await expect(qr, 'QR du billet affiché hors ligne').toBeVisible({ timeout: 20_000 });
        const payload = String(await qr.getAttribute('data-ev-qr-payload'));
        expect(payload, 'payload affiché hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${r.tickets.std1}:\\d{6}$`));
        await expectScan(page, payload, 'billet présenté hors ligne', 'valid');
        await sw.context().setOffline(false);
        expect(await ticketStatus(r.tickets.std1), 'billet hors ligne composté').toBe('UTILISE');
    });

    await test.step('ancien code du billet transféré : refusé', async () => {
        if (!r.oldLot) throw new Error('lot d’avant le transfert absent (acte 4)');
        await expectScan(page, payloadFromLot(r.oldLot).payload, 'ancien code du billet transféré', 'qr_expired');
    });

    await test.step('saisie manuelle du billet transféré, pièce conforme', async () => {
        await page.getByRole('button', { name: /^saisie manuelle$/i }).click();
        await page.getByLabel(/^numéro du billet/i).fill(r.numbers.std2);
        await page.getByRole('button', { name: /^vérifier le billet$/i }).click();
        await expect(page.getByRole('heading', { name: new RegExp(`billet ${escapeRe(r.numbers.std2)}`, 'i') })).toBeVisible();
        await page.getByRole('checkbox', { name: /^pièce d.identité conforme au titulaire/i }).check();
        await page.getByRole('button', { name: /^pièce conforme, valider l.entrée$/i }).click();
        await expect(page.locator('[data-scan-result="valid"]').first(), 'saisie manuelle : entrée validée').toBeVisible();
        await resultClosed(page);
        expect(await ticketStatus(r.tickets.std2), 'billet saisi à la main composté').toBe('UTILISE');
        await page.getByRole('button', { name: /^caméra$/i }).click();
        await videoPlaying(page, 'retour à la caméra');
    });

    await test.step('guichet : Sur place avec sa mention, Invitations et Découverte absentes, vente, reçu', async () => {
        await openTab(page, /^guichet$/i);
        const list = page.getByRole('list', { name: /^catégories en vente$/i });
        const onSite = list.getByRole('listitem').filter({ hasText: 'Sur place' });
        await expect(onSite.getByText('Sur place uniquement', { exact: true }), 'mention de la catégorie vendue au guichet seulement').toBeVisible();
        await expect(list.getByRole('listitem'), 'guichet : seules les catégories vendues au guichet').toHaveCount(2);
        await page.getByRole('button', { name: /^ajouter un billet sur place$/i }).click();
        await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toContainText(/5\s000/);
        await page.getByLabel(/^numéro de l.acheteur/i).fill(receiptTo);
        const sold = await expectRoute(page, 'POST', '/api/controller/counter-sale', () => page.getByRole('button', { name: /^j.ai reçu .*valider la vente$/i }).click(), 200, 'vente au guichet');
        expect(sold.receipt_queued, `reçu SMS mis en file : ${JSON.stringify(sold)}`).toBe(true);
        await expect(page.getByText(/reçu sms envoyé à l.acheteur/i), 'vente et reçu annoncés').toBeVisible();
    });

    await test.step('reprise de session : sortie puis retour, même événement, « Reprendre le contrôle »', async () => {
        await openTab(page, /^contrôle$/i);
        await videoPlaying(page, 'retour au contrôle après le guichet');
        await page.goto('/controller/profile');
        await expect(page.getByRole('heading', { level: 1 }).first(), 'page du profil du contrôleur ouverte').toBeVisible({ timeout: 30_000 });
        await page.goBack();
        await expectResumed(page, r.e1.title, 'camera', 'retour depuis le profil');
        await page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }).click();
        await videoPlaying(page, '« Reprendre le contrôle »');
    });

    await test.step('clôture de caisse sans écart, Z de caisse', async () => {
        await openTab(page, /^caisse$/i);
        await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
        const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(/^espèces encaissées comptées/i).fill('5000');
        await expectRoute(page, 'POST', '/api/controller/shifts/close', () => dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click(), 200, 'clôture sans écart');
        const z = page.getByRole('dialog', { name: /^caisse clôturée$/i });
        await expect(z).toBeVisible();
        await z.getByRole('button', { name: /^terminé$/i }).click();
    });

    await test.step('invariants (a) à (t), puis reçu du guichet arrivé au faux MTarget', async () => {
        await assertInvariants('recette-controleur');
        const receipts = await fakeSmsTo(`+221${receiptTo}`);
        expect(receipts.length, 'reçu de la vente au guichet envoyé par la boîte d’envoi').toBe(1);
    });
});

test('acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran', async () => {
    const partner = known('P1');

    await test.step('pilotage : vendus, entrées, espèces, caisse clôturée', async () => {
        await partner.goto(`/partner/events/${r.e1.id}`);
        await openTab(partner, /^aperçu/i);
        const panel = partner.getByRole('tabpanel');
        // 2 Standard de C1, 2 du second client, 1 gratuit, 1 au guichet ; entrées : gratuit, hors ligne, saisie manuelle, guichet
        await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)6(\D|$)/);
        await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)4(\D|$)/);
        await openTab(partner, /^caisse/i);
        await expect(kpi(partner.getByRole('tabpanel'), /^espèces encaissées/i)).toContainText(/5\s000/);
        await expect(kpi(partner.getByRole('tabpanel'), /^caisses clôturées/i)).toContainText(/(^|\D)1(\D|$)/);
    });

    await test.step('export des participants, journalisé', async () => {
        await openTab(partner, /^clôture/i);
        const exported = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e1.id}/participants-export`);
        await partner.getByRole('button', { name: /^exporter les participants$/i }).click();
        const res = await exported;
        expect(res.status(), 'export des participants').toBe(200);
        expect(await res.text(), 'export : les billets de l’événement').toContain('Standard');
        const { data, error } = await serviceClient().from('participant_exports').select('event_id').eq('id', String(res.headers()['x-export-id'])).maybeSingle();
        if (error) throw new Error(`[e2e] journal des exports : ${error.message}`);
        expect(data?.event_id, 'export écrit au journal').toBe(r.e1.id);
    });

    await test.step('rapport de clôture du tableau de bord : libellés, PDF', async () => {
        await partner.goto('/partner/dashboard');
        await partner.locator('tr').filter({ hasText: r.e1.title }).getByRole('button', { name: /^clôture$/i }).click();
        const dialog = partner.getByRole('dialog', { name: /^rapport de clôture$/i });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/^généré le/i)).toBeVisible();
        await expect(dialog.getByText('Entrées validées', { exact: true })).toBeVisible();
        await expectRoute(partner, 'GET', '/api/partner/reports/closing/pdf', () => dialog.getByRole('button', { name: /^télécharger le pdf$/i }).click(), 200, 'rapport PDF');
        await dialog.getByRole('button', { name: /^fermer$/i }).click();
        await expect(dialog).toBeHidden();
    });

    await test.step('/partner/finance : code SMS, retrait de 6 000 F, frais de 60 F, envoi au faux SamirPay', async () => {
        await partner.goto('/partner/finance');
        const wave = partner.getByRole('radio', { name: /^wave/i });
        await wave.dispatchEvent('click');
        await expect(wave).toBeChecked();
        await partner.getByLabel(/qui reçoit le retrait/i).fill(r.p1.local);
        await partner.getByLabel(/^montant à retirer/i).fill('6000');
        const seen = await smsSeen(r.p1.phone);
        await expectRoute(partner, 'POST', '/api/withdrawals/otp', () => partner.getByRole('button', { name: /^recevoir le code de confirmation$/i }).click(), 200, 'code de confirmation du retrait');
        await fillOtp(partner, await smsCode(r.p1.phone, seen, 'code du retrait'));
        await expectRoute(partner, 'POST', '/api/withdrawals/request', () => partner.getByRole('button', { name: /^confirmer le retrait$/i }).click(), 200, 'demande de retrait');
        await expect(partner.getByText('Retrait versé', { exact: true })).toBeVisible();
        const summary = partner.locator('dl').filter({ hasText: 'Montant versé' });
        await expect(summary, 'frais de retrait').toContainText(/60\sF/);
        await expect(summary, 'montant versé').toContainText(/5\s940/);
        const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/samirpay/transactions`);
        const { transactions } = (await res.json()) as { transactions: Array<{ kind: string; amount: number; status: string }> };
        expect(transactions.filter((t) => t.kind === 'CASHOUT' && t.amount === 5940 && t.status === 'SUCCESS').length, 'envoi de 5 940 F au faux SamirPay').toBeGreaterThan(0);
    });

    await test.step('A4 : remboursement d’un billet à l’écran, double confirmation', async () => {
        await refundOnScreen(partner, r.numbers.refundShown, `Recette ${STAMP} : client empêché`, /^remboursement versé$/i);
        await expect.poll(() => ticketStatus(r.tickets.refundShown), { message: 'billet remboursé', timeout: 15_000 }).toBe('REMBOURSE');
    });

    await test.step('invariants (a) à (t)', async () => {
        await assertInvariants('recette-partenaire');
    });
});

test('acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public', async ({ browser }, testInfo) => {
    const partner = known('P1');
    const client = known('C1');

    await test.step('annulation par P1 dans la modale', async () => {
        await partner.goto(`/partner/events/${r.e2.id}`);
        await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
        const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
        await dialog.getByLabel(/^avis public aux participants/i).fill(NOTICE_E2);
        await dialog.getByLabel(/^motif interne/i).fill('Recette de la billetterie, lot 8.');
        await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(r.e2.title);
        const cancelled = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e2.id}/cancel` && res.request().method() === 'POST', { timeout: 60_000 });
        await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
        const res = await cancelled;
        expect(res.status(), `annulation de E2 : ${(await res.text()).slice(0, 300)}`).toBe(200);
        await expect(dialog).toBeHidden();
    });

    await test.step('vraie route de l’envoyeur : avis d’annulation et de remboursement partis', async () => {
        await expect.poll(() => ticketStatus(r.tickets.e2), { message: 'billet de E2 remboursé par l’annulation', timeout: 30_000 }).toBe('REMBOURSE');
        await drainOutbox('après l’annulation de E2');
        const lines = (await outboxOfEvent(r.e2.id, ['EVENT_CANCELLED', 'REFUND_PAID'])).filter((l) => l.channel === 'SMS' && (l.recipient_user_id === r.c1.userId || l.recipient_phone === r.c1.phone));
        expect(lines.map((l) => `${l.type} ${l.status}`).sort(), `avis du client : ${JSON.stringify(lines.map((l) => ({ type: l.type, status: l.status, reason: l.reason })))}`)
            .toEqual(['EVENT_CANCELLED SENT', 'REFUND_PAID SENT']);
    });

    await test.step('Mes billets : billet Remboursé', async () => {
        await client.goto('/tickets?tab=tous');
        const card = client.locator('li, article').filter({ hasText: r.e2.title }).last();
        await expect(card, 'billet de E2 dans Mes billets').toBeVisible({ timeout: 30_000 });
        await expect(card, 'statut affiché').toContainText(/remboursé/i);
    });

    await test.step('page publique de E2 : bandeau et avis de l’organisateur', async () => {
        const visitor = await asNew(browser, testInfo, 'visiteur');
        const res = await visitor.goto(`/events/${r.e2.id}`);
        expect(res?.status(), 'page d’un événement annulé').toBe(200);
        await expect(visitor.getByText(NOTICE_E2), 'avis public').toBeVisible();
        await expect(visitor.getByRole('button', { name: /ajouter un billet/i }), 'plus aucune vente').toHaveCount(0);
    });
});

test('acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus', async ({ browser }, testInfo) => {
    const partner = known('P1');
    const superadmin = await asRole(browser, testInfo, 'fumee-superadmin');
    const admin = await asRole(browser, testInfo, 'admin');
    const { failedId } = readDemoIds().notifications;

    await test.step('supervision /admin/notifications, ligne en échec, relance', async () => {
        await admin.goto('/admin/notifications?status=FAILED');
        await expect(admin.getByRole('link', { name: /^voir le détail/i }).first(), 'ligne en échec dans la liste').toBeVisible();
        await admin.goto(`/admin/notifications/${failedId}`);
        await admin.getByRole('button', { name: /^relancer$/i }).click();
        const confirm = admin.getByRole('alertdialog');
        await expect(confirm).toBeVisible();
        await expectRoute(admin, 'POST', `/api/admin/notifications/${failedId}/retry`, () => confirm.getByRole('button', { name: /^relancer$/i }).click(), 200, 'relance de la notification');
        const { data, error } = await serviceClient().from('notification_outbox').select('status').eq('id', failedId).single();
        if (error || !data) throw new Error(`[e2e] ligne ${failedId} : ${error?.message ?? 'introuvable'}`);
        expect(String(data.status), 'ligne relancée, plus en échec').not.toBe('FAILED');
    });

    await test.step('A3 : solde du faux SamirPay à 0, remboursement bloqué à l’écran du partenaire', async () => {
        const emptied = await fakeServices('/__test/samirpay/balance', { solde: 0 });
        expect(emptied.status, `solde vidé : ${JSON.stringify(emptied.json)}`).toBe(200);
        await refundOnScreen(partner, r.numbers.refundBlocked, `Recette ${STAMP} : solde insuffisant`, /^remboursement enregistré, versement en attente$/i);
        expect(await ticketStatus(r.tickets.refundBlocked), 'billet en attente du versement').toBe('REMBOURSEMENT_EN_COURS');
    });

    await test.step('A3 : solde rétabli, relance sur /admin/finance, billet remboursé', async () => {
        const restored = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE });
        expect(restored.status, `solde rétabli : ${JSON.stringify(restored.json)}`).toBe(200);
        await superadmin.goto('/admin/finance');
        const panel = superadmin.locator('section').filter({ has: superadmin.getByRole('heading', { name: /^remboursements à reprendre$/i }) });
        const row = panel.locator('tr').filter({ hasText: r.e1.title });
        await expect(row, 'remboursement bloqué dans la liste').toBeVisible();
        await expect(row, 'motif en français').toContainText(/solde du compte partenaire samirpay insuffisant/i);
        await row.getByRole('button', { name: /^relancer le remboursement/i }).click();
        const confirm = superadmin.getByRole('alertdialog', { name: /^relancer ce remboursement/i });
        await expect(confirm).toBeVisible();
        await expectRoute(superadmin, 'POST', /^\/api\/admin\/refunds\/[^/]+\/retry$/, () => confirm.getByRole('button', { name: /^relancer$/i }).click(), 200, 'relance du remboursement');
        await expect(panel.getByText('Relance envoyée', { exact: true }), 'relance confirmée').toBeVisible();
        await expect(row, 'la ligne quitte la liste').toHaveCount(0);
        await expect.poll(() => ticketStatus(r.tickets.refundBlocked), { message: 'billet remboursé après la relance', timeout: 15_000 }).toBe('REMBOURSE');
    });

    await test.step('suspension de E1 sur sa fiche, avec motif : plus de vente, bandeau public', async () => {
        await superadmin.goto(`/admin/events/${r.e1.id}`);
        await superadmin.getByRole('button', { name: /^suspendre/i }).click();
        const dialog = superadmin.getByRole('dialog', { name: /^suspendre l’événement$/i });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(/^motif de la suspension/i).fill(`Recette ${STAMP} : contrôle de l’organisateur`);
        await expectRoute(superadmin, 'POST', /^\/api\/admin\/events\/[^/]+\/transition$/, () => dialog.getByRole('button', { name: /^suspendre/i }).click(), 200, 'suspension de E1');
        const { data, error } = await serviceClient().from('events').select('status').eq('id', r.e1.id).single();
        if (error || !data) throw new Error(`[e2e] statut de E1 : ${error?.message ?? 'introuvable'}`);
        expect(String(data.status), 'E1 suspendu').toBe('SUSPENDU');
        const visitor = known('visiteur');
        await visitor.goto(`/events/${r.e1.id}`);
        await expect(visitor.getByText(/suspendu/i).first(), 'bandeau de la page publique').toBeVisible();
        await expect(visitor.getByRole('button', { name: /ajouter un billet/i }), 'plus aucune vente').toHaveCount(0);
    });

    await test.step('suspension du compte de P1 : session refusée', async () => {
        await superadmin.goto('/admin/users');
        await superadmin.getByPlaceholder(/rechercher par nom/i).fill(r.p1.email);
        const row = cardOf(superadmin, r.p1.email, /^suspendre$/i);
        await expectRoute(superadmin, 'PATCH', '/api/admin/users', () => row.getByRole('button', { name: /^suspendre$/i }).click(), 200, 'suspension de P1');
        const { data, error } = await serviceClient().from('users').select('status').eq('id', r.p1.userId).single();
        if (error || !data) throw new Error(`[e2e] compte de P1 : ${error?.message ?? 'introuvable'}`);
        expect(String(data.status), 'compte de P1').toBe('SUSPENDU');
        await expect.poll(async () => String((await partner.request.get('/api/partner/events', { maxRedirects: 0 })).status()),
            { message: 'P1 suspendu : route partenaire refusée', timeout: 15_000 }).toMatch(/^40[13]$/);
    });

    await test.step('invariants (a) à (t)', async () => {
        await assertInvariants('recette-admin');
    });
});
