/**
 * Lot 11c-b — tables d'un événement : écrans du client, de bout en bout sur le serveur construit (job « responsive » de la
 * CI : nom en « …responsive.spec.ts »).
 *
 * Données propres au spec (la graine de démonstration n'est pas touchée) : deux événements publiés de la partenaire de
 * démonstration « organisateur2 » (le spec du lot 11c-c utilise « organisateur3 ») :
 *  - « Soirée des tables » avec plan : « Carré VIP » (4 × 6 places, 150 000 F) et « Table ronde » (6 × 8 places,
 *    120 000 F) ; une table vendue à Awa (titulaire) par le vrai achat (route du serveur, faux SamirPay, vrai webhook), une
 *    place envoyée et acceptée par un invité, une autre envoyée et en attente ; une table ronde vendue à une autre cliente
 *    (prise sur le plan) ;
 *  - « Brunch des tables » sans plan : « Table famille » (3 × 4 places, 60 000 F).
 * Service des tables ouvert le temps du spec (rouvert avant chaque écran : un autre spec peut le refermer), remis ensuite.
 *
 * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1440 px), un nouveau client fait le vrai parcours à l'écran :
 * fiche avec l'onglet « Tables », plan et feuille de devis, « Réserver la table N », paiement Wave, « Table gardée » (compte à
 * rebours), paiement confirmé par le faux SamirPay → confirmation ; puis la fiche sans plan (type choisi, devis), « Ma
 * table » du titulaire et le billet de l'invité. Contrôle responsive (0 défaut bloquant) et capture de chaque écran :
 * .e2e-captures/captures-responsive/l11cb-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { request as pwRequest, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
import { createClientAccount, createPublishedEvent, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
import { fakeServices } from './support/parcours';
import { runResponsiveChecks } from './support/responsive-checks';
import { TEST_PASSWORD } from './support/accounts';
import { APP_URL } from './support/env';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
const STAMP = randomUUID().slice(0, 6);

interface TableRow { id: string; number: number }
interface Seeded {
    planEventId: string;
    noPlanEventId: string;
    holder: ControllerAccount;
    guest: ControllerAccount;
    bookingId: string;
    /** Tables libres proposées aux clients des 4 parcours (une par thème et largeur). */
    free: TableRow[];
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `l11cb-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
}

async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
    const r = await runResponsiveChecks(page, { width, phone });
    expect(r.blocking, `${label} : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
}

async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark'): Promise<BrowserContext> {
    const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme });
    await context.addInitScript((value: string) => {
        try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
        document.cookie = `ev-theme=${value}; path=/`;
    }, scheme);
    return context;
}

async function login(context: BrowserContext, identifier: string): Promise<void> {
    const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
    expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
}

function dakar(at: Date): { date: string; time: string } {
    const iso = at.toISOString();
    return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)}:00` };
}

async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
    const t0 = Date.now();
    for (;;) {
        const v = await read();
        if (v !== null) return v;
        if (Date.now() - t0 > timeoutMs) throw new Error(`[l11cb] ${label} : rien après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, 400));
    }
}

async function completePayment(paymentId: string): Promise<void> {
    const tx = await waitFor('transaction du paiement', async () => {
        const { data } = await serviceClient().from('payments').select('external_transaction_id').eq('id', paymentId).maybeSingle();
        return data?.external_transaction_id ? String(data.external_transaction_id) : null;
    });
    const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
    expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
}

/** Achat d'une table par la vraie route, paiement confirmé par le faux SamirPay et le vrai webhook ; rend la vente. */
async function buyTable(eventId: string, buyer: ControllerAccount, typeId: string, tableId: string): Promise<string> {
    const api = await pwRequest.newContext({ baseURL: APP_URL });
    try {
        const log = await api.post('/api/auth/login', { data: { identifier: buyer.email, password: TEST_PASSWORD } });
        expect(log.status(), `connexion de l’acheteuse : ${await log.text()}`).toBe(200);
        const res = await api.post(`/api/events/${eventId}/tables/checkout`, {
            headers: { 'Idempotency-Key': `l11cb-${randomUUID()}` },
            data: { typeId, tableId, operator: 'WAVE', payerPhone: buyer.local },
        });
        const body = await res.json() as Record<string, unknown>;
        expect(res.status(), `achat de la table : ${JSON.stringify(body)}`).toBe(200);
        const paymentId = String(body.payment_id ?? '');
        await completePayment(paymentId);
        return waitFor('vente de la table', async () => {
            const { data } = await serviceClient().from('event_table_bookings').select('id').eq('payment_id', paymentId).maybeSingle();
            return data ? String(data.id) : null;
        });
    } finally {
        await api.dispose();
    }
}

async function setTablesService(open: boolean, actor: string): Promise<void> {
    const { data, error } = await serviceClient().rpc('event_tables_setting_set', { p_key: 'features.event_tables_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 11c-b' });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l11cb] interrupteur des tables : ${error?.message ?? JSON.stringify(data)}`);
}

async function seed(superadmin: string): Promise<Seeded> {
    const owner = readDemoIds().accounts.organisateur2;
    const service = serviceClient();
    const start = new Date(Date.now() + 26 * 3600_000);
    const end = new Date(start.getTime() + 5 * 3600_000);
    const s = dakar(start);
    const e = dakar(end);
    const poster = await partnerPosterOf(owner.userId);
    const planEventId = await createPublishedEvent({
        partnerUserId: owner.userId, superadminId: superadmin, title: `Soirée des tables ${STAMP}`,
        description: 'Captures du lot 11c-b (tables d’un événement, écrans du client). Données fictives.',
        startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
        location: 'Terrasse des Almadies', city: 'Dakar', capacity: 200, imageUrl: poster,
        categories: [{ name: 'Entrée', price: 5_000, total: 60 }],
    });
    const vip = await rpcOk('event_table_type_save', {
        event_id: planEventId, actor_id: owner.userId, count: 4,
        type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
    });
    const ronde = await rpcOk('event_table_type_save', {
        event_id: planEventId, actor_id: owner.userId, count: 6,
        type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
    });
    const vipId = String((vip.type as Record<string, unknown>).id);
    const rondeId = String((ronde.type as Record<string, unknown>).id);
    const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', planEventId).order('number');
    if (error || !rows) throw new Error(`[l11cb] tables de l'événement : ${error?.message}`);
    const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 40], [32.5, 40]];
    const rondePos = [[57.5, 22.5], [72.5, 22.5], [87.5, 22.5], [57.5, 62.5], [72.5, 62.5], [87.5, 62.5]];
    let iv = 0;
    let ir = 0;
    const tables = rows.map((t) => {
        const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
        return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
    });
    await rpcOk('event_tables_save', { event_id: planEventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
    const vipTables = rows.filter((t) => t.category_id === vipId).map((t) => ({ id: String(t.id), number: Number(t.number) }));
    const rondeTables = rows.filter((t) => t.category_id === rondeId).map((t) => ({ id: String(t.id), number: Number(t.number) }));

    const noPlanEventId = await createPublishedEvent({
        partnerUserId: owner.userId, superadminId: superadmin, title: `Brunch des tables ${STAMP}`,
        description: 'Captures du lot 11c-b (sans plan de salle). Données fictives.',
        startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
        location: 'Jardin du Plateau', city: 'Dakar', capacity: 100, imageUrl: poster,
        categories: [{ name: 'Entrée', price: 3_000, total: 40 }],
    });
    await rpcOk('event_table_type_save', {
        event_id: noPlanEventId, actor_id: owner.userId, count: 3,
        type: { name: 'Table famille', seats: 4, price: 60_000, included_text: 'Jus frais et pâtisseries', payment_mode: 'FULL' },
    });

    const holder = await createClientAccount(`l11cb-a-${STAMP}`);
    const guest = await createClientAccount(`l11cb-g-${STAMP}`);
    const other = await createClientAccount(`l11cb-b-${STAMP}`);
    const pendingTo = await createClientAccount(`l11cb-p-${STAMP}`);
    const bookingId = await buyTable(planEventId, holder, vipId, vipTables[0].id);
    await buyTable(planEventId, other, rondeId, rondeTables[0].id);

    const { data: seats, error: sErr } = await service.from('tickets').select('id').eq('event_table_booking_id', bookingId).order('ticket_number');
    if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cb] places de la table : ${sErr?.message ?? seats?.length}`);
    const sent = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[1].id, actor_id: holder.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
    await rpcOk('ticket_transfer_accept', { transfer_id: sent.transfer_id, actor_id: guest.userId });
    await rpcOk('ticket_transfer_initiate', { ticket_id: seats[2].id, actor_id: holder.userId, recipient: pendingTo.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });

    return { planEventId, noPlanEventId, holder, guest, bookingId, free: [vipTables[1], vipTables[2], vipTables[3], rondeTables[1]] };
}

let seeded: Seeded | null = null;
let superadmin = '';
let previous = false;

test.beforeAll(async () => {
    test.setTimeout(240_000);
    superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
    previous = (data?.value as { value?: boolean } | null)?.value === true;
    await setTablesService(true, superadmin);
    seeded = await seed(superadmin);
});

test.afterAll(async () => {
    if (superadmin) await setTablesService(previous, superadmin);
});

let round = 0;

for (const theme of THEMES) {
    for (const w of WIDTHS) {
        test(`parcours d’achat d’une table, ${w.width} px, ${theme.key}`, async ({ browser }, testInfo) => {
            test.setTimeout(240_000);
            const data = seeded!;
            const table = data.free[round++];
            await setTablesService(true, superadmin);
            const buyer = await createClientAccount(`l11cb-c${round}-${STAMP}`);
            const context = await themedContext(browser, testInfo, theme.scheme);
            try {
                await login(context, buyer.email);
                const page = await context.newPage();
                await page.setViewportSize({ width: w.width, height: w.height });
                context.on('page', (p) => { if (p !== page) void p.close(); }); // page de paiement de l'opérateur (faux SamirPay)

                // 1. Fiche avec plan : onglet « Tables »
                await page.goto(`/events/${data.planEventId}?tables=1`);
                await expect(page.getByRole('tab', { name: /Tables/ })).toHaveAttribute('aria-selected', 'true');
                await expect(page.getByRole('heading', { name: 'Tables', exact: true })).toBeVisible();
                const openPlan = page.getByRole('button', { name: 'Voir le plan et choisir ma table' });
                await expect(openPlan).toBeVisible();
                await expect(page.getByRole('heading', { name: 'Carré VIP', exact: true })).toBeVisible();
                // Tables restantes vraies (le Carré VIP se remplit d'un parcours à l'autre, jusqu'à « Complet »)
                await expect(page.getByText(/^(Plus que \d+ tables|Plus qu’une table|Complet|\d+ tables disponibles)$/).first()).toBeVisible();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'fiche avec plan');
                await shot(page, 'fiche-plan', w.width, theme.key);

                // 2. Plan et feuille de devis
                await openPlan.click();
                // Titre de la fenêtre : « Choisissez votre table », puis « Table réservée » à la confirmation
                const dialog = page.getByRole('dialog');
                await expect(page.getByRole('dialog', { name: 'Choisissez votre table' })).toBeVisible();
                await expect(dialog.getByRole('button', { name: /Table \d+, 6 places, prise/ }).first()).toBeVisible();
                await dialog.locator(`[data-table-id="${table.id}"]`).click();
                const reserve = dialog.getByRole('button', { name: `Réserver la table ${table.number}` });
                await expect(reserve).toBeEnabled();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'plan et feuille de devis');
                await shot(page, 'plan-devis', w.width, theme.key, false);

                // 3. Paiement puis « Table gardée »
                await reserve.click();
                await dialog.locator('label', { hasText: 'Wave' }).click();
                const pay = dialog.getByRole('button', { name: /^Payer .* avec Wave$/ });
                await expect(pay).toBeEnabled();
                await pay.click();
                await expect(dialog.getByText('Table gardée')).toBeVisible({ timeout: 20_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'compte à rebours');
                await shot(page, 'compte-a-rebours', w.width, theme.key, false);

                // 4. Paiement confirmé : confirmation, puis « Envoyez vos N places »
                const { data: pays } = await serviceClient().from('payments').select('id').eq('client_id', buyer.userId).order('created_at', { ascending: false }).limit(1);
                await completePayment(String(pays?.[0]?.id));
                await expect(dialog.getByRole('heading', { name: 'Votre table est réservée' })).toBeVisible({ timeout: 30_000 });
                await expect(dialog.getByRole('link', { name: /^Envoyez vos \d+ places$/ })).toBeVisible();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'confirmation');
                await shot(page, 'confirmation', w.width, theme.key, false);

                // 5. Fiche sans plan : choix d'un type et devis
                await page.goto(`/events/${data.noPlanEventId}?tables=1`);
                await page.locator('label', { hasText: 'Table famille' }).click();
                await expect(page.getByRole('button', { name: 'Réserver une table Table famille' })).toBeEnabled();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'fiche sans plan, devis');
                await shot(page, 'fiche-sans-plan', w.width, theme.key, !w.phone);
            } finally {
                await context.close();
            }
        });

        test(`Ma table et billet de l’invité, ${w.width} px, ${theme.key}`, async ({ browser }, testInfo) => {
            test.setTimeout(120_000);
            const data = seeded!;
            await setTablesService(true, superadmin);
            const holderCtx = await themedContext(browser, testInfo, theme.scheme);
            try {
                await login(holderCtx, data.holder.email);
                const page = await holderCtx.newPage();
                await page.setViewportSize({ width: w.width, height: w.height });
                await page.goto(`/tickets?tab=tables#table-${data.bookingId}`);
                await expect(page.getByRole('heading', { name: /^Table \d+ · Carré VIP$/ })).toBeVisible({ timeout: 20_000 });
                await expect(page.getByText('1/6 places envoyées')).toBeVisible();
                await expect(page.getByText('Envoyez vos 3 places')).toBeVisible();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'Ma table');
                await shot(page, 'ma-table', w.width, theme.key);
            } finally {
                await holderCtx.close();
            }
            const guestCtx = await themedContext(browser, testInfo, theme.scheme);
            try {
                await login(guestCtx, data.guest.email);
                const page = await guestCtx.newPage();
                await page.setViewportSize({ width: w.width, height: w.height });
                await page.goto('/tickets');
                await expect(page.getByText('Invité par Awa S.').first()).toBeVisible({ timeout: 20_000 });
                await expect(page.getByText(/Table \d+ · Carré VIP/).first()).toBeVisible();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'billet de l’invité');
                await shot(page, 'billet-invite', w.width, theme.key);
            } finally {
                await guestCtx.close();
            }
        });
    }
}
