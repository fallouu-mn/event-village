/**
 * Lot 11c-c — tables d'un événement : écrans de l'organisatrice, de la porte, du scanner et de l'administration, de bout en
 * bout sur le serveur construit (job « responsive » de la CI : nom en « …responsive.spec.ts »).
 *
 * Données propres au spec (la graine de démonstration n'est pas touchée) : un événement publié de la partenaire de
 * démonstration « organisateur3 » (aucun autre spec ne lit ses chiffres), deux types de tables placées sur le plan
 * (« Carré VIP » 4 × 6 places, « Table ronde » 6 × 8 places), deux tables vendues par le vrai achat (route du serveur, faux
 * SamirPay, vrai webhook), une troisième en paiement, une place envoyée et acceptée par une invitée, deux places entrées
 * (scan manuel du contrôleur affecté). Service des tables ouvert le temps du spec par le compteur partagé avec le spec du 11c-b (e2e/support/tables-service).
 *
 * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1440 px) : contrôle responsive (0 défaut bloquant) et
 * capture de l'éditeur, du plan en édition, de la jauge, de la vue client, d'un type figé, du pilotage, de la porte (table
 * ouverte, plein écran, impression), de la porte du contrôleur, du badge du scanner et de la fiche de l'administration.
 * Captures : .e2e-captures/captures-responsive/l11cc-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { request as pwRequest, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
import { createClientAccount, createControllerAccount, createPublishedEvent, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
import { fakeServices } from './support/parcours';
import { runResponsiveChecks } from './support/responsive-checks';
import { openTablesService, releaseTablesService } from './support/tables-service';
import { installFakeCamera } from './support/fake-camera';
import { requireStorageState, TEST_PASSWORD } from './support/accounts';
import { APP_URL } from './support/env';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
const STAMP = randomUUID().slice(0, 6);

interface Seeded { eventId: string; title: string; controller: ControllerAccount; seatNumber: string }

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `l11cc-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
}

/** Contrôle responsive de la page affichée : aucun défaut bloquant (défilement horizontal, texte coupé, chevauchement…). */
async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
    const r = await runResponsiveChecks(page, { width, phone });
    expect(r.blocking, `${label} : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
}

async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string): Promise<BrowserContext> {
    const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
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
        if (Date.now() - t0 > timeoutMs) throw new Error(`[l11cc] ${label} : rien après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, 400));
    }
}

/** Achat d'une table par la vraie route ; `complete` : paiement confirmé par le faux SamirPay et le vrai webhook. */
async function buyTable(eventId: string, buyer: ControllerAccount, typeId: string, tableId: string, complete: boolean): Promise<string | null> {
    const api = await pwRequest.newContext({ baseURL: APP_URL });
    try {
        const log = await api.post('/api/auth/login', { data: { identifier: buyer.email, password: TEST_PASSWORD } });
        expect(log.status(), `connexion de l’acheteuse : ${await log.text()}`).toBe(200);
        const res = await api.post(`/api/events/${eventId}/tables/checkout`, {
            headers: { 'Idempotency-Key': `l11cc-${randomUUID()}` },
            data: { typeId, tableId, operator: 'WAVE', payerPhone: buyer.local },
        });
        const body = await res.json() as Record<string, unknown>;
        expect(res.status(), `achat de la table : ${JSON.stringify(body)}`).toBe(200);
        const paymentId = String(body.payment_id ?? '');
        if (!complete) return null;
        const { data: pay, error } = await serviceClient().from('payments').select('external_transaction_id').eq('id', paymentId).single();
        if (error || !pay?.external_transaction_id) throw new Error(`[l11cc] transaction du paiement ${paymentId} : ${error?.message ?? 'absente'}`);
        const done = await fakeServices('/__test/samirpay/complete', { transactionId: pay.external_transaction_id });
        expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
        return waitFor('vente de la table', async () => {
            const { data } = await serviceClient().from('event_table_bookings').select('id').eq('payment_id', paymentId).maybeSingle();
            return data ? String(data.id) : null;
        });
    } finally {
        await api.dispose();
    }
}

async function seed(superadmin: string): Promise<Seeded> {
    const owner = readDemoIds().accounts.organisateur3;
    const service = serviceClient();
    const start = new Date(Date.now() + 60 * 60_000);
    const end = new Date(start.getTime() + 4 * 3600_000);
    const s = dakar(start);
    const e = dakar(end);
    const title = `Nuit des tables ${STAMP}`;
    const eventId = await createPublishedEvent({
        partnerUserId: owner.userId, superadminId: superadmin, title,
        description: 'Captures du lot 11c-c (tables d’un événement). Données fictives.',
        startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
        location: 'Terrasse de la Corniche', city: 'Dakar', capacity: 200,
        imageUrl: await partnerPosterOf(owner.userId),
        categories: [{ name: 'Entrée', price: 5_000, total: 80 }],
    });
    const vip = await rpcOk('event_table_type_save', {
        event_id: eventId, actor_id: owner.userId, count: 4,
        type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
    });
    const ronde = await rpcOk('event_table_type_save', {
        event_id: eventId, actor_id: owner.userId, count: 6,
        type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
    });
    const vipId = String((vip.type as Record<string, unknown>).id);
    const rondeId = String((ronde.type as Record<string, unknown>).id);
    const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', eventId).order('number');
    if (error || !rows) throw new Error(`[l11cc] tables de l'événement : ${error?.message}`);
    // Carré VIP en 2 × 2 en haut à gauche, tables rondes en deux rangées en bas
    const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 37.5], [32.5, 37.5]];
    const rondePos = [[52.5, 62.5], [67.5, 62.5], [82.5, 62.5], [52.5, 80], [67.5, 80], [82.5, 80]];
    let iv = 0;
    let ir = 0;
    const tables = rows.map((t) => {
        const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
        return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
    });
    await rpcOk('event_tables_save', { event_id: eventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });

    const vipTables = rows.filter((t) => t.category_id === vipId);
    const rondeTables = rows.filter((t) => t.category_id === rondeId);
    const awa = await createClientAccount(`l11cc-a-${STAMP}`);
    const fatou = await createClientAccount(`l11cc-b-${STAMP}`);
    const moussa = await createClientAccount(`l11cc-c-${STAMP}`);
    const guest = await createClientAccount(`l11cc-g-${STAMP}`);
    const bookingA = await buyTable(eventId, awa, vipId, String(vipTables[2].id), true);
    await buyTable(eventId, fatou, rondeId, String(rondeTables[0].id), true);
    await buyTable(eventId, moussa, rondeId, String(rondeTables[1].id), false);

    const { data: seats, error: sErr } = await service.from('tickets').select('id, ticket_number').eq('event_table_booking_id', bookingA!).order('ticket_number');
    if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cc] places de la table : ${sErr?.message ?? seats?.length}`);
    const transfer = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[0].id, actor_id: awa.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
    await rpcOk('ticket_transfer_accept', { transfer_id: transfer.transfer_id, actor_id: guest.userId });

    const controller = await createControllerAccount(`l11cc-${STAMP}`);
    const { error: aErr } = await service.from('event_controllers').upsert(
        { event_id: eventId, user_id: controller.userId, can_accept_cash: false, created_by: owner.userId, entry_point: 'Entrée principale' },
        { onConflict: 'event_id,user_id' });
    if (aErr) throw new Error(`[l11cc] affectation du contrôleur : ${aErr.message}`);
    // La place envoyée (seats[0]) est réémise au nom de l’invitée : les entrées portent sur deux places restées au titulaire
    for (const seat of seats.slice(1, 3)) {
        const number = String(seat.ticket_number);
        const { data, error: scanErr } = await service.rpc('ticket_scan', { p: {
            scanner_id: controller.userId, event_id: eventId, method: 'MANUAL', ticket_number: number, identity_verified: true,
            payload_hash: createHash('sha256').update(number.toUpperCase()).digest('hex'), client_key: `l11cc-${randomUUID()}`,
        } });
        if (scanErr || (data as { result?: string } | null)?.result !== 'valid') throw new Error(`[l11cc] entrée de la place ${number} : ${scanErr?.message ?? JSON.stringify(data)}`);
    }
    return { eventId, title, controller, seatNumber: String(seats[3].ticket_number) };
}

let seeded: Seeded | null = null;
let superadmin = '';
// Fusion du lot 11c-b : compteur partagé avec le spec du 11c-b, qui tourne en même temps (run 722 : service refermé par
// le premier spec fini) ; le dernier des deux remet l'état d'origine.
const SERVICE_USER = 'du lot 11c-c';

test.beforeAll(async () => {
    test.setTimeout(240_000);
    superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    await openTablesService(SERVICE_USER, superadmin);
    seeded = await seed(superadmin);
});

test.afterAll(async () => {
    if (superadmin) await releaseTablesService(SERVICE_USER, superadmin);
});

for (const theme of THEMES) {
    test(`tables d’un événement · ${theme.key} : organisatrice, porte, scanner, administration (390 et 1440 px)`, async ({ browser }, testInfo) => {
        test.setTimeout(600_000);
        const data = seeded!;
        const owner = readDemoIds().accounts.organisateur3;

        // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
        const org = await themedContext(browser, testInfo, theme.scheme);
        await login(org, owner.email);
        const page = await org.newPage();
        for (const w of WIDTHS) {
            await page.setViewportSize({ width: w.width, height: w.height });
            await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
            await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
            await page.getByRole('button', { name: /^Étape 4 : Billetterie$/ }).click();
            await page.getByRole('tab', { name: 'Tables' }).click();
            const editor = page.locator('[data-tables-editeur]');
            await expect(editor).toBeVisible({ timeout: 30_000 });
            // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
            await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
            await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
            await settle(page);
            await checkLayout(page, w.width, w.phone, 'éditeur des tables');
            await shot(page, 'editeur', w.width, theme.key);
            await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
            // Plan en édition : une table choisie (panneau de réglage)
            const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
            if (await table1.count() > 0) await table1.first().click();
            await settle(page);
            await shot(page, 'plan-edition', w.width, theme.key);
            await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
            await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
            await settle(page);
            await shot(page, 'vue-client', w.width, theme.key);
            // Type figé : prix et places verrouillés, avec la raison
            await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
            const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
            await expect(dialog).toContainText('Soit 25');
            await expect(dialog).toContainText('par personne.');
            await settle(page);
            await shot(page, 'type-fige', w.width, theme.key, false);
            await page.keyboard.press('Escape');

            await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
            const pil = page.locator('[data-tables-pilotage]');
            await expect(pil).toBeVisible({ timeout: 30_000 });
            await expect(pil.locator('text="Awa S." >> visible=true').first()).toBeVisible();
            await settle(page);
            await checkLayout(page, w.width, w.phone, 'pilotage des tables');
            await shot(page, 'pilotage', w.width, theme.key);

            await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
            const door = page.locator('[data-porte]');
            await expect(door).toBeVisible({ timeout: 30_000 });
            await expect(door.getByText('2/6').first()).toBeVisible();
            await settle(page);
            await checkLayout(page, w.width, w.phone, 'liste de la porte');
            await shot(page, 'porte', w.width, theme.key);
            await door.locator('[data-porte-table] button').first().click();
            await expect(door.getByText('Awa S.').first()).toBeVisible();
            await settle(page);
            await shot(page, 'porte-table-ouverte', w.width, theme.key);
            await page.getByRole('button', { name: 'Plein écran' }).click();
            await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
            await settle(page);
            await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
            await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
            await page.emulateMedia({ media: 'print' });
            await settle(page);
            await shot(page, 'porte-impression', w.width, theme.key);
            await page.emulateMedia({ media: 'screen' });
        }
        await org.close();

        // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
        const ctl = await themedContext(browser, testInfo, theme.scheme);
        await login(ctl, data.controller.email);
        await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
        const cpage = await ctl.newPage();
        for (const w of WIDTHS) {
            await cpage.setViewportSize({ width: w.width, height: w.height });
            await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
            await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
            await settle(cpage);
            await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
            await shot(cpage, 'porte-controleur', w.width, theme.key);

            await cpage.route(/\/api\/controller\/scan$/, async (route) => {
                if (route.request().method() !== 'POST') return route.continue();
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                    result: 'valid', replayed: false, message: 'Entrée validée',
                    ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
                    table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
                }) });
            });
            await cpage.goto('/controller/scanner', { waitUntil: 'load' });
            // Premier passage : écran de départ ; ensuite, le scanner retrouve le contrôle en cours (« Reprendre le contrôle »)
            const start = cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i });
            const resume = cpage.getByRole('button', { name: 'Reprendre le contrôle' });
            await expect(start.or(resume)).toBeVisible({ timeout: 30_000 });
            if (await resume.isVisible()) await resume.click();
            else await start.click();
            await cpage.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
            await expect(cpage.getByRole('link', { name: 'Liste des tables' })).toHaveAttribute('href', `/controller/porte/${data.eventId}`);
            await cpage.evaluate((p) => {
                const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
                if (!cam) throw new Error('caméra simulée absente');
                cam.setPayload(p);
            }, `EVT1:00000000-0000-4000-8000-000000000971:482913`);
            const overlay = cpage.locator('[data-scan-state="result"][data-scan-result="valid"]');
            await expect(overlay).toBeVisible({ timeout: 20_000 });
            await expect(overlay.locator('[data-scan-table]')).toContainText('Table 3 · Carré VIP');
            await expect(overlay.locator('[data-scan-table]')).toContainText('3/6 entrés');
            await cpage.waitForTimeout(250);
            await shot(cpage, 'scanner-badge', w.width, theme.key, false);
            await cpage.unroute(/\/api\/controller\/scan$/);
        }
        await ctl.close();

        // ── Administration : fiche de l'événement ─────────────────────────────────────────────────────────────────
        const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('admin'));
        const apage = await adm.newPage();
        for (const w of WIDTHS) {
            await apage.setViewportSize({ width: w.width, height: w.height });
            await apage.goto(`/admin/events/${data.eventId}`, { waitUntil: 'load' });
            const section = apage.locator('[data-admin-tables]');
            await expect(section).toBeVisible({ timeout: 30_000 });
            await expect(section.locator('text="Carré VIP" >> visible=true').first()).toBeVisible();
            await section.scrollIntoViewIfNeeded();
            await settle(apage);
            await checkLayout(apage, w.width, w.phone, 'fiche de l’administration');
            await section.screenshot({ path: path.join(SHOTS, `l11cc-admin__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 80 });
        }
        await adm.close();
    });
}
