/**
 * Lot 12c — commandes : écrans de la partenaire (catalogue, produit, produit en vérification, nouveau produit, réglages de
 * vente, zones de livraison, commandes en téléphone, tablette et ordinateur, fiche d'une commande reçue, saisie du code de
 * remise, livreurs, tableau de bord) et page « Produits à vérifier » de l'administration, de bout en bout sur le serveur
 * construit (job « responsive » de la CI : nom en « …responsive.spec.ts »).
 *
 * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
 * démonstration « organisateur2 » (lue par aucun autre spec e2e), validé, ouvert 24 h sur 24, qui prend des commandes
 * (livraison, retrait, sur place, acompte, paiement à la remise) ; trois zones de livraison (une désactivée) ; des produits
 * enregistrés par la fonction en base (plat du jour avec portions, plat avec suppléments, boisson, dessert presque épuisé,
 * produit réglementé, « Bière Gazelle » mise « à vérifier » par la base) ; deux livreurs (un actif, une invitation en
 * attente) ; des commandes dans chaque étape (reçue au plus tôt, reçue pour plus tard, acceptée, en préparation, prête à
 * retirer avec un reste à payer, en route en livraison, remise), toutes payables à la remise (aucun paiement réel).
 *
 * Interrupteur features.orders_enabled : ouvert au début de chaque test et remis à sa valeur d'origine à la fin, sous le
 * verrou des services (groupe « services » : aucun test du groupe « autres » ne tourne pendant ce temps,
 * e2e/support/services-switch.ts).
 *
 * Pour chaque thème (clair, sombre) et chaque largeur (390, 768 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
 * capture. Captures : .e2e-captures/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
import { runResponsiveChecks } from './support/responsive-checks';
import { requireStorageState, TEST_PASSWORD } from './support/accounts';
import { APP_URL } from './support/env';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
const WIDTHS = [
    { width: 390, height: 844, phone: true },
    { width: 768, height: 1024, phone: false },
    { width: 1440, height: 900, phone: false },
] as const;
const STAMP = randomUUID().slice(0, 6);
const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));

interface Seeded {
    venueId: string;
    venueName: string;
    products: { yassa: string; biere: string };
    orders: { recue: { id: string; number: string }; prete: { id: string; number: string } };
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    // La page des commandes se relit toutes les 5 s : jamais « réseau au repos » ; attente bornée
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
    await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `l12c-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
}

async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
    const r = await runResponsiveChecks(page, { width, phone });
    expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
}

type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * Session de la partenaire, ouverte UNE fois pour tout le spec (run 726 : la seconde connexion, au thème sombre, tombait
 * sur la limite des connexions par adresse de la phase responsive, 429 LOGIN_RATE_LIMITED) ; reprise par le thème suivant.
 */
let partnerSession: SessionState | null = null;

async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string | SessionState): Promise<BrowserContext> {
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

async function title(page: Page, name: string | RegExp): Promise<void> {
    const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
    await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

async function setOrdersService(open: boolean, actor: string): Promise<void> {
    const { data, error } = await serviceClient().rpc('finance_setting_set', { p_key: 'features.orders_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 12c' });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l12c] interrupteur des commandes : ${error?.message ?? JSON.stringify(data)}`);
}

/** Heure de Dakar (UTC) au quart d'heure, `hours` heures plus tard, au format attendu par la base. */
function laterSlot(hours: number): string {
    const at = new Date(Date.now() + hours * 3600_000);
    at.setUTCMinutes(Math.ceil(at.getUTCMinutes() / 15) * 15, 0, 0);
    return at.toISOString().slice(0, 16);
}

async function seed(superadmin: string): Promise<Seeded> {
    const owner = readDemoIds().accounts.organisateur2;
    const service = serviceClient();
    const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
    if (fErr || !fiche) throw new Error(`[l12c] fiche de organisateur2 : ${fErr?.message ?? 'absente'}`);
    if (fiche.status !== 'VALIDE') throw new Error(`[l12c] fiche de organisateur2 au statut ${String(fiche.status)} : VALIDE attendu`);
    const partnerId = String(fiche.id);

    // Établissement validé, ouvert 24 h sur 24, qui prend des commandes
    const venueName = `Chez Fatou ${STAMP}`;
    const { data: venue, error: vErr } = await service.from('venues').insert({
        partner_id: partnerId, kind: 'RESTAURANT', name: venueName, address: 'Route de la Corniche Ouest', city: 'Dakar',
        latitude: 14.6937, longitude: -17.4441, confirmation_mode: 'AUTO',
    }).select('id').single();
    if (vErr || !venue) throw new Error(`[l12c] établissement : ${vErr?.message}`);
    const venueId = String(venue.id);
    await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
    await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
    await rpcOk('order_venue_settings_set', {
        actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
        deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 20,
    });
    const almadies = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Almadies', fee: 1_500, min_order: 5_000 });
    await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Mermoz – Sacré-Cœur', fee: 1_000, min_order: 0 });
    await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Yoff', fee: 2_000, min_order: 10_000, is_active: false });
    const zoneId = String((almadies.zone as Record<string, unknown>).id);

    const { data: cats, error: cErr } = await service.from('product_categories').insert([
        { partner_id: partnerId, name: `Plats ${STAMP}`, sort_order: 0 },
        { partner_id: partnerId, name: `Boissons ${STAMP}`, sort_order: 1 },
        { partner_id: partnerId, name: `Desserts ${STAMP}`, sort_order: 2 },
    ]).select('id, name');
    if (cErr || !cats) throw new Error(`[l12c] catégories : ${cErr?.message}`);
    const cat = (prefix: string) => String(cats.find((c) => String(c.name).startsWith(prefix))!.id);
    const save = async (fields: Record<string, unknown>): Promise<string> => {
        const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
        return String((r.product as Record<string, unknown>).id);
    };
    const thieb = await save({ name: 'Thiéboudienne du jour', description: 'Riz au poisson, légumes du marché, sauce tomate.', price: 4_500, category_id: cat('Plats'), is_daily_special: true });
    const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500, category_id: cat('Plats') });
    const bissap = await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000, category_id: cat('Boissons') });
    const thiakry = await save({ name: 'Thiakry', description: 'Couscous de mil au lait caillé.', price: 1_500, category_id: cat('Desserts'), is_stock_managed: true, stock_quantity: 4 });
    await save({ name: 'Whisky 12 ans', price: 15_000, category_id: cat('Boissons'), is_regulated: true, regulated_kind: 'ALCOOL' });
    const biere = await save({ name: 'Bière Gazelle 65 cl', description: 'Bière blonde locale, servie fraîche.', price: 1_500, category_id: cat('Boissons') });
    await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Frites', price: 500 });
    await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Sauce piment', price: 0 });
    await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: thieb, portions: 50 });

    // Livreurs : un actif, une invitation en attente
    const courier = await createClientAccount(`l12c-livreur-${STAMP}`);
    const pending = await createClientAccount(`l12c-invite-${STAMP}`);
    const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
    await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
    await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: pending.phone });

    // Commandes payables à la remise (au plus 3 non payées par client : trois clientes)
    const clients: ControllerAccount[] = [];
    for (const k of ['a', 'b', 'c']) clients.push(await createClientAccount(`l12c-${k}-${STAMP}`));
    const place = async (client: ControllerAccount, body: Record<string, unknown>): Promise<{ id: string; number: string }> => {
        const r = await rpcOk('order_create', { client_id: client.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
        return { id: String(r.order_id), number: String(r.order_number) };
    };
    const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
        for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
    };
    const line = (productId: string, quantity: number, extra: Record<string, unknown> = {}) => ({ product_id: productId, quantity, option_ids: [], ...extra });
    const recue = await place(clients[0], { mode: 'RETRAIT', items: [line(yassa, 2, { notes: 'Sans oignons' }), line(bissap, 2)], phone: clients[0].local });
    await place(clients[0], { mode: 'SUR_PLACE', onsite_label: 'Terrasse 4', scheduled_for: laterSlot(3), items: [line(yassa, 3), line(thiakry, 1)] });
    const acceptee = await place(clients[1], { mode: 'SUR_PLACE', onsite_label: 'Table 7', items: [line(yassa, 1), line(bissap, 1)] });
    await act(acceptee.id, { action: 'ACCEPTER', minutes: 25 });
    const prep = await place(clients[1], { mode: 'RETRAIT', items: [line(bissap, 4)], phone: clients[1].local });
    await act(prep.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
    const prete = await place(clients[1], { mode: 'RETRAIT', items: [line(yassa, 2)], phone: clients[1].local });
    await act(prete.id, { action: 'ACCEPTER' }, { action: 'PRETE' });
    const route = await place(clients[2], { mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 12, route des Almadies, près de la pharmacie', phone: clients[2].local, items: [line(yassa, 2), line(bissap, 2)] });
    await act(route.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'EN_ROUTE', minutes: 20 });
    const remise = await place(clients[2], { mode: 'SUR_PLACE', onsite_label: 'Comptoir', items: [line(bissap, 3)] });
    await act(remise.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });

    return { venueId, venueName, products: { yassa, biere }, orders: { recue, prete } };
}

let seeded: Seeded | null = null;
let superadmin = '';

test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });

for (const theme of THEMES) {
    test(`commandes · ${theme.key} : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)`, async ({ browser }, testInfo) => {
        test.setTimeout(900_000);
        superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
        const { data: flag } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.orders_enabled').maybeSingle();
        const previous = (flag?.value as { value?: boolean } | null)?.value === true;
        await setOrdersService(true, superadmin);
        try {
            seeded ??= await seed(superadmin);
            const data = seeded;
            const owner = readDemoIds().accounts.organisateur2;

            const org = await themedContext(browser, testInfo, theme.scheme, partnerSession ?? undefined);
            if (!partnerSession) {
                await login(org, owner.email);
                // Session seulement : le thème est posé par chaque contexte (cookie et stockage), jamais repris d'un autre
                const state = await org.storageState();
                partnerSession = {
                    cookies: state.cookies.filter((c) => c.name !== 'ev-theme'),
                    origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((l) => l.name !== 'ev-theme') })),
                };
            }
            const page = await org.newPage();
            for (const w of WIDTHS) {
                await page.setViewportSize({ width: w.width, height: w.height });

                // Commandes : colonnes (tablette, ordinateur) ou onglets (téléphone)
                await page.goto('/partner/orders', { waitUntil: 'load' });
                await title(page, 'Commandes');
                await expect(page.locator(`[aria-label="Ouvrir la commande ${data.orders.recue.number}"] >> visible=true`).first(), 'commande reçue au tableau').toBeVisible({ timeout: 30_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'commandes');
                await shot(page, 'commandes', w.width, theme.key);

                // Fiche d'une commande reçue : compte à rebours et « Accepter »
                await page.goto(`/partner/orders/${data.orders.recue.id}`, { waitUntil: 'load' });
                await title(page, /^Commande /);
                await expect(page.getByRole('button', { name: /^Accepter/ }).first()).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'fiche d’une commande reçue');
                await shot(page, 'commande-recue', w.width, theme.key);

                // Saisie du code de remise : retrait prêt, reste à payer
                await page.goto(`/partner/orders/${data.orders.prete.id}`, { waitUntil: 'load' });
                await title(page, /^Commande /);
                const codeGroup = page.getByRole('group', { name: 'Code de remise à 4 chiffres' });
                await expect(codeGroup).toBeVisible({ timeout: 30_000 });
                await codeGroup.scrollIntoViewIfNeeded();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'saisie du code de remise');
                await shot(page, 'saisie-code', w.width, theme.key);

                await page.goto('/partner/orders/livreurs', { waitUntil: 'load' });
                await title(page, 'Livreurs');
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'livreurs');
                await shot(page, 'livreurs', w.width, theme.key);

                // Catalogue, produit, produit en vérification, nouveau produit
                await page.goto(`/partner/products?etablissement=${data.venueId}`, { waitUntil: 'load' });
                await title(page, 'Ma carte');
                await expect(page.getByText('Yassa poulet', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'catalogue');
                await shot(page, 'catalogue', w.width, theme.key);

                await page.goto(`/partner/products/${data.products.yassa}`, { waitUntil: 'load' });
                await title(page, 'Yassa poulet');
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'fiche d’un produit');
                await shot(page, 'produit', w.width, theme.key);

                await page.goto(`/partner/products/${data.products.biere}`, { waitUntil: 'load' });
                await title(page, 'Bière Gazelle 65 cl');
                await expect(page.getByText('En vérification par Event Village').first()).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'produit en vérification');
                await shot(page, 'produit-verification', w.width, theme.key);

                await page.goto(`/partner/products/new?etablissement=${data.venueId}`, { waitUntil: 'load' });
                await title(page, 'Nouveau produit');
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'nouveau produit');
                await shot(page, 'nouveau-produit', w.width, theme.key);

                // Réglages de vente et zones de livraison
                await page.goto(`/partner/products/vente?etablissement=${data.venueId}`, { waitUntil: 'load' });
                await title(page, 'Réglages de vente');
                const zones = page.getByRole('heading', { name: /^zones de livraison/i }).first();
                await expect(zones).toBeVisible({ timeout: 30_000 });
                await expect(page.getByText('Almadies', { exact: true }).first()).toBeVisible();
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'réglages de vente');
                await shot(page, 'reglages', w.width, theme.key);
                await zones.scrollIntoViewIfNeeded();
                await settle(page);
                await shot(page, 'zones', w.width, theme.key, false);

                // Tableau de bord : carte des commandes lue par les routes serveur
                await page.goto('/partner/dashboard', { waitUntil: 'load' });
                await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await checkLayout(page, w.width, w.phone, 'tableau de bord');
                await shot(page, 'tableau-de-bord', w.width, theme.key);
            }
            await org.close();

            // Administration : produits à vérifier (la bière de la carte, mot trouvé surligné)
            const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-superadmin'));
            const apage = await adm.newPage();
            for (const w of WIDTHS) {
                await apage.setViewportSize({ width: w.width, height: w.height });
                await apage.goto(`/admin/products?produit=${data.products.biere}`, { waitUntil: 'load' });
                await title(apage, 'Produits à vérifier');
                await expect(apage.locator(`#produit-${data.products.biere}`)).toBeVisible({ timeout: 30_000 });
                await settle(apage);
                await checkLayout(apage, w.width, w.phone, 'produits à vérifier');
                await shot(apage, 'admin-produits', w.width, theme.key);
            }
            await adm.close();
        } finally {
            await setOrdersService(previous, superadmin);
        }
    });
}
