/**
 * Lot 12b — commandes : écrans du client, de bout en bout sur le serveur construit (job « responsive » de la CI : nom en
 * « …responsive.spec.ts »).
 *
 * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
 * démonstration « organisateur3 » (ses événements servent aux specs cvcb et 11c-c, aucun établissement), validé, ouvert
 * 24 h sur 24, qui prend des commandes (livraison, retrait, sur place, acompte de 30 %, paiement à la remise) ; une zone
 * de livraison ; deux tables ; une carte : plat du jour avec 20 portions, plats avec photo et suppléments, boisson,
 * produit réglementé (affiché avec son prix, non commandable), dessert épuisé. Un client neuf, connecté UNE seule fois
 * (cookies repris ensuite : la route de connexion admet 30 essais par adresse IP et par heure, partagés dans le job).
 *
 * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px), le client fait le vrai parcours à l'écran : carte
 * des plats, plat du jour, produit non commandable, fiche d'un plat, panier et devis de la base, commande sur place (choix
 * de la table), choix de l'heure, puis commande à emporter « tout de suite » payée en entier : page de suivi avec compte à
 * rebours et paiement Wave, paiement confirmé par le faux SamirPay et le vrai webhook ; puis chaque étape (reçue,
 * acceptée, en préparation, prête avec le code de remise affiché, retirée) avancée par la fonction de la partenaire en
 * base ; une seconde commande payable à la remise, annulée à l'écran ; enfin Mes commandes.
 *
 * Interrupteur features.orders_enabled : ouvert au début de chaque test par le compteur partagé
 * (e2e/support/orders-service.ts), sous le verrou des services (groupe « services »), remis par le dernier inscrit.
 * Contrôle responsive (0 défaut bloquant) et capture de chaque écran :
 * .e2e-captures/captures-responsive/l12b-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
import { createClientAccount, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
import { fakeServices } from './support/parcours';
import { runResponsiveChecks } from './support/responsive-checks';
import { openOrdersService, releaseOrdersService } from './support/orders-service';
import { TEST_PASSWORD } from './support/accounts';
import { APP_URL } from './support/env';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
const STAMP = randomUUID().slice(0, 6);
const WHO = 'du lot 12b';
const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));

interface Seeded {
    venueId: string;
    venueName: string;
    ownerId: string;
    products: { daily: string; yassa: string; mafe: string; beer: string; dessert: string };
    client: ControllerAccount;
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `l12b-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
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

/** Une seule connexion du client pour tout le spec (quota de la route de connexion par adresse IP). */
let savedCookies: Awaited<ReturnType<BrowserContext['cookies']>> | null = null;
async function loginOnce(context: BrowserContext, identifier: string): Promise<void> {
    if (savedCookies) {
        await context.addCookies(savedCookies);
        return;
    }
    const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
    expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
    savedCookies = await context.cookies();
}

async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
    const t0 = Date.now();
    for (;;) {
        const v = await read();
        if (v !== null) return v;
        if (Date.now() - t0 > timeoutMs) throw new Error(`[l12b] ${label} : rien après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, 400));
    }
}

async function insertProduct(partnerId: string, venueId: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await serviceClient().from('products').insert({ partner_id: partnerId, venue_id: venueId, status: 'DISPONIBLE', ...row }).select('id').single();
    if (error || !data) throw new Error(`[l12b] produit ${String(row.name)} : ${error?.message}`);
    return String(data.id);
}

async function seed(superadmin: string): Promise<Seeded> {
    const owner = readDemoIds().accounts.organisateur3;
    const service = serviceClient();
    const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).maybeSingle();
    if (fErr || !fiche) throw new Error(`[l12b] fiche de organisateur3 : ${fErr?.message ?? 'absente'}`);
    if (fiche.status !== 'VALIDE') throw new Error(`[l12b] fiche de organisateur3 au statut ${String(fiche.status)} : VALIDE attendu`);
    const partnerId = String(fiche.id);
    const photo = await partnerPosterOf(owner.userId);
    const venueName = `Chez Fatou ${STAMP}`;
    const { data: venue, error: vErr } = await service.from('venues').insert({
        partner_id: partnerId, kind: 'RESTAURANT', name: venueName, city: 'Dakar', address: 'Route de la Corniche Ouest',
        description: 'Cuisine sénégalaise faite maison, plats du jour mijotés chaque matin.', photos: [photo],
        latitude: 14.6937, longitude: -17.4720,
    }).select('id').single();
    if (vErr || !venue) throw new Error(`[l12b] établissement : ${vErr?.message}`);
    const venueId = String(venue.id);
    await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
    await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
    await rpcOk('order_venue_settings_set', {
        actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
        deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 25,
    });
    const { error: zErr } = await service.from('order_delivery_zones').insert({ venue_id: venueId, name: 'Plateau', fee: 1_000, min_order: 3_000 });
    if (zErr) throw new Error(`[l12b] zone : ${zErr.message}`);
    for (const number of ['4', '7']) {
        const { error } = await service.from('restaurant_tables').insert({ partner_id: partnerId, venue_id: venueId, table_number: `${number}`, capacity: 4, is_active: true });
        if (error) throw new Error(`[l12b] table ${number} : ${error.message}`);
    }
    const categories: Record<string, string> = {};
    for (const [i, name] of ['Plats', 'Boissons', 'Desserts'].entries()) {
        const { data, error } = await service.from('product_categories').insert({ partner_id: partnerId, name, sort_order: i + 1 }).select('id').single();
        if (error || !data) throw new Error(`[l12b] catégorie ${name} : ${error?.message}`);
        categories[name] = String(data.id);
    }
    const daily = await insertProduct(partnerId, venueId, {
        name: 'Thiéboudienne du jour', price: 4_500, is_daily_special: true, category_id: categories.Plats, images: [photo],
        description: 'Riz au poisson, légumes du marché, sauce tomate.',
    });
    await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: daily, portions: 20 });
    const yassa = await insertProduct(partnerId, venueId, { name: 'Yassa poulet', price: 3_500, category_id: categories.Plats, images: [photo], description: 'Oignons confits, citron vert.' });
    for (const [name, price] of [['Piment', 200], ['Frites', 500]] as const) {
        const { error } = await service.from('product_options').insert({ product_id: yassa, name, price_delta: price });
        if (error) throw new Error(`[l12b] supplément ${name} : ${error.message}`);
    }
    const mafe = await insertProduct(partnerId, venueId, { name: 'Mafé', price: 3_000, category_id: categories.Plats });
    await insertProduct(partnerId, venueId, { name: 'Bissap', price: 1_000, category_id: categories.Boissons });
    const beer = await insertProduct(partnerId, venueId, { name: 'Gazelle', price: 1_200, category_id: categories.Boissons, is_regulated: true, regulated_kind: 'ALCOOL' });
    const dessert = await insertProduct(partnerId, venueId, { name: 'Thiakry', price: 1_500, category_id: categories.Desserts, is_stock_managed: true, stock_quantity: 0 });
    const client = await createClientAccount(`l12b-${STAMP}`);
    return { venueId, venueName, ownerId: owner.userId, products: { daily, yassa, mafe, beer, dessert }, client };
}

let seeded: Seeded | null = null;
let superadmin = '';

test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });

/** Prix d'un produit changé par la partenaire pendant que le client regarde son panier (garde « prix changé »). */
async function setPrice(productId: string, price: number): Promise<void> {
    const { error } = await serviceClient().from('products').update({ price }).eq('id', productId);
    if (error) throw new Error(`[l12b] prix du produit ${productId} : ${error.message}`);
}

/** Heure de Dakar (UTC) au quart d'heure inférieur, décalée de `minutes`, au format des fermetures (« AAAA-MM-JJ HH:MM »). */
function dakarQuarter(minutes: number): string {
    const q = 15 * 60_000;
    return new Date(Math.floor(Date.now() / q) * q + minutes * 60_000).toISOString().slice(0, 16).replace('T', ' ');
}

async function partnerStep(data: Seeded, orderId: string, action: string, extra: Record<string, unknown> = {}): Promise<void> {
    await rpcOk('order_partner_action', { actor_id: data.ownerId, order_id: orderId, action, ...extra });
}

async function completePayment(orderId: string, paymentId: string): Promise<void> {
    const tx = await waitFor(`transaction du paiement ${paymentId} de la commande ${orderId}`, async () => {
        const { data, error } = await serviceClient().from('payments').select('external_transaction_id, order_id, status').eq('id', paymentId).maybeSingle();
        if (error) throw new Error(`[l12b] paiement ${paymentId} illisible : ${error.message}`);
        if (data && data.order_id !== orderId) throw new Error(`[l12b] paiement ${paymentId} d’une autre commande (${String(data.order_id)})`);
        return data?.external_transaction_id ? String(data.external_transaction_id) : null;
    });
    const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
    expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
}

async function stepReached(page: Page, orderId: string, step: string): Promise<void> {
    await page.goto(`/orders/${orderId}`, { waitUntil: 'load' });
    await expect(page.getByTestId('frise-commande').locator(`[data-etape="${step}"]`)).toHaveAttribute('data-franchie', 'oui', { timeout: 30_000 });
}

for (const theme of THEMES) {
    test(`commandes du client · ${theme.key} : carte, panier, heure, sur place, prix changé, paiement, suivi, code et mode comptoir, annulation, solde, Mes commandes, fermeture (390 et 1 440 px)`, async ({ browser }, testInfo) => {
        test.setTimeout(900_000);
        superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
        await openOrdersService(`${WHO} (${theme.key})`, superadmin); // un nom par thème : les deux thèmes peuvent tourner ensemble
        try {
            seeded ??= await seed(superadmin);
            const data = seeded;
            const context = await themedContext(browser, testInfo, theme.scheme);
            try {
                await loginOnce(context, data.client.email);
                const page = await context.newPage();
                context.on('page', (p) => { if (p !== page) void p.close(); }); // page de l'opérateur (faux SamirPay)
                for (const w of WIDTHS) {
                    await page.setViewportSize({ width: w.width, height: w.height });
                    const scope = w.phone ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Votre panier' });

                    // 1. Carte des plats
                    await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
                    await expect(page.getByRole('heading', { level: 1, name: data.venueName })).toBeVisible({ timeout: 30_000 });
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'carte des plats');
                    await shot(page, 'carte', w.width, theme.key);

                    // 2. Plat du jour (jauge des portions)
                    const banner = page.getByRole('button', { name: /^Plat du jour : Thiéboudienne du jour, Plus que \d+ portions aujourd’hui$/ });
                    await banner.scrollIntoViewIfNeeded();
                    await expect(banner).toBeVisible();
                    await settle(page);
                    await shot(page, 'plat-du-jour', w.width, theme.key, false);

                    // 3. Produit non commandable (réglementé : prix affiché) et dessert épuisé
                    const beer = page.getByRole('button', { name: 'Gazelle, Non commandable en ligne' });
                    await beer.scrollIntoViewIfNeeded();
                    await expect(beer).toBeVisible();
                    await expect(page.getByRole('button', { name: 'Thiakry, Épuisé' })).toBeVisible();
                    await settle(page);
                    await shot(page, 'non-commandable', w.width, theme.key, false);

                    // 4. Fiche d'un plat : supplément, ajout au panier
                    await page.getByRole('button', { name: 'Voir Yassa poulet' }).click();
                    const sheet = page.getByRole('dialog', { name: 'Yassa poulet' });
                    await expect(sheet).toBeVisible();
                    await sheet.getByText('Piment', { exact: true }).click();
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'fiche d’un plat');
                    await shot(page, 'fiche-plat', w.width, theme.key, false);
                    await sheet.getByRole('button', { name: 'Ajouter 1 Yassa poulet au panier' }).click();
                    await expect(sheet).toBeHidden();

                    // 5. Panier et devis de la base (« À emporter » par défaut : aucune zone à choisir)
                    if (w.phone) await page.getByRole('button', { name: 'Voir le panier, 1 article' }).click();
                    await expect(scope.getByRole('region', { name: 'Montant de la commande' }).getByText('Total')).toBeVisible({ timeout: 20_000 });
                    // Yassa 3 500 + piment 200 = 3 700 ; frais 5 % : 185 ; total 3 885 (devis de la base, lu à l'écran)
                    await expect(scope.getByRole('region', { name: 'Montant de la commande' })).toContainText(/3\s885/);
                    await settle(page);
                    // Heure estimée servie par le devis (« Prête vers 13 h 05 ») : idée 10 des correctifs
                    await expect(scope.getByTestId('heure-estimee-panier')).toContainText(/Prête (demain )?vers \d{1,2} h/);
                    await checkLayout(page, w.width, w.phone, 'panier et devis');
                    await shot(page, 'panier-devis', w.width, theme.key, !w.phone);

                    // 6. Finaliser : sur place (table), heure
                    await scope.getByRole('button', { name: 'Finaliser' }).click();
                    await scope.getByRole('radio', { name: 'Sur place' }).click();
                    await scope.getByLabel('Votre table').selectOption({ label: 'Table 7' });
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'sur place');
                    await shot(page, 'sur-place', w.width, theme.key, !w.phone);
                    await scope.getByRole('radio', { name: 'Autre heure' }).click();
                    await expect(scope.getByLabel('Heure', { exact: true })).toBeVisible();
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'choix de l’heure');
                    await shot(page, 'choix-heure', w.width, theme.key, !w.phone);

                    // 7. À emporter, tout de suite, tout payer : commande puis page de suivi (compte à rebours, paiement)
                    await scope.getByRole('radio', { name: 'À emporter' }).click();
                    await scope.getByRole('radio', { name: 'Tout de suite' }).click();
                    await scope.getByRole('radio', { name: 'Tout payer' }).click();
                    const order = scope.getByRole('button', { name: 'Commander', exact: true });
                    await expect(order).toBeEnabled({ timeout: 20_000 });
                    // Prix changé par la partenaire entre l'affichage et la commande (idée 8) : rien de créé, ancien et nouveau
                    // prix ligne par ligne, un seul bouton « Commander à <nouveau total> » (3 700 + 200 + frais 195 = 4 095)
                    await setPrice(data.products.yassa, 3_700);
                    try {
                        await order.click();
                        const changed = scope.getByTestId('prix-change');
                        await expect(changed).toBeVisible({ timeout: 20_000 });
                        await expect(changed).toContainText(/Yassa poulet.*3\s700/);
                        await expect(changed).toContainText(/Total.*4\s095/);
                        // Contrôle la feuille revenue en haut (run 774 : l'annonce fait défiler la feuille, et le contrôle lisait
                        // les puces de l'heure passées sous le titre opaque de la feuille) ; capture l'annonce à l'écran
                        await scope.evaluate((root) => {
                            for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
                                if (el.scrollHeight > el.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) el.scrollTop = 0;
                            }
                        });
                        await settle(page);
                        await checkLayout(page, w.width, w.phone, 'prix changé');
                        await changed.scrollIntoViewIfNeeded();
                        await settle(page);
                        await shot(page, 'prix-change', w.width, theme.key, !w.phone);
                        await scope.getByRole('button', { name: /^Commander à 4\s095\sF\sCFA$/ }).click();
                        await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
                    } finally {
                        await setPrice(data.products.yassa, 3_500);
                    }
                    const orderId = page.url().split('/orders/')[1];
                    await expect(page.getByTestId('compte-a-rebours')).toContainText(/À payer dans \d+:\d{2}/, { timeout: 20_000 });
                    await expect(page.getByTestId('paiement-commande')).toBeVisible();
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'paiement et compte à rebours');
                    await shot(page, 'paiement', w.width, theme.key);

                    // 8. Paiement Wave : faux SamirPay et vrai webhook
                    // Opérateur mémorisé dès le 2ᵉ parcours (« Numéro Wave du payeur ») : la carte de l'opérateur est visée exactement
                    await page.getByTestId('paiement-commande').locator('label', { hasText: /^Wave$/ }).click();
                    const [payRes] = await Promise.all([
                        page.waitForResponse((r) => r.url().endsWith('/api/payments/create') && r.request().method() === 'POST', { timeout: 30_000 }),
                        page.getByRole('button', { name: /^Payer .* avec Wave$/ }).click(),
                    ]);
                    const payBody = await payRes.json().catch(() => null) as Record<string, unknown> | null;
                    expect([200, 201], `paiement de la commande : HTTP ${payRes.status()} ${JSON.stringify(payBody)}`).toContain(payRes.status());
                    await completePayment(orderId, String(payBody?.payment_id ?? ''));
                    await stepReached(page, orderId, 'RECUE');
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'suivi : envoyée');
                    await shot(page, 'suivi-recue', w.width, theme.key);

                    // 9. Chaque étape, avancée par la partenaire
                    await partnerStep(data, orderId, 'ACCEPTER');
                    await stepReached(page, orderId, 'ACCEPTEE');
                    await expect(page.getByTestId('heure-estimee')).toContainText('Prévue vers');
                    await settle(page);
                    await shot(page, 'suivi-acceptee', w.width, theme.key);
                    await partnerStep(data, orderId, 'PREPARER');
                    await stepReached(page, orderId, 'EN_PREPARATION');
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'suivi : en préparation');
                    await shot(page, 'suivi-preparation', w.width, theme.key);
                    await partnerStep(data, orderId, 'PRETE');
                    await stepReached(page, orderId, 'PRETE');
                    const cases = page.getByTestId('case-code');
                    await expect(cases).toHaveCount(4, { timeout: 30_000 });
                    await expect(page.getByTestId('code-remise')).toContainText('Montrez ce code à la remise');
                    const code = (await cases.allInnerTexts()).map((t) => t.trim()).join('');
                    expect(code, 'code de quatre chiffres').toMatch(/^\d{4}$/);
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'code de remise');
                    await shot(page, 'code', w.width, theme.key);
                    // Lien de l'avis « commande prête » (?comptoir=1) : le code s'ouvre en très grand (idée 11), sans copie
                    await page.goto(`/orders/${orderId}?comptoir=1`, { waitUntil: 'load' });
                    const counter = page.getByTestId('mode-comptoir');
                    await expect(counter).toBeVisible({ timeout: 30_000 });
                    await expect(counter).toContainText(code.split('').join(''));
                    await expect(counter).toHaveCSS('user-select', 'none');
                    expect(page.url(), 'le code ne passe jamais par l’adresse').not.toContain(code);
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'mode comptoir');
                    await shot(page, 'mode-comptoir', w.width, theme.key, false);
                    await counter.getByRole('button', { name: 'Fermer' }).click();
                    await expect(counter).toHaveCount(0);
                    await partnerStep(data, orderId, 'REMETTRE', { code });
                    await stepReached(page, orderId, 'REMISE');
                    await expect(page.getByTestId('code-remise')).toHaveCount(0);
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'suivi : retirée');
                    await shot(page, 'suivi-retiree', w.width, theme.key);

                    // 10. Annulation d'une commande payable à la remise (aucun paiement)
                    const made = await context.request.post(`${APP_URL}/api/orders/create`, {
                        headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
                        data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
                    });
                    const madeBody = await made.json() as { order?: { id?: string } };
                    expect(made.status(), `commande à annuler : ${JSON.stringify(madeBody)}`).toBe(201);
                    const second = String(madeBody.order?.id);
                    await page.goto(`/orders/${second}`, { waitUntil: 'load' });
                    await page.getByRole('button', { name: 'Annuler la commande' }).click();
                    await expect(page.getByRole('alertdialog', { name: 'Annuler la commande ?' })).toBeVisible();
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'annulation');
                    await shot(page, 'annulation', w.width, theme.key, false);
                    await page.getByRole('button', { name: 'Oui, annuler' }).click();
                    await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 20_000 });
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'commande annulée');
                    await shot(page, 'annulee', w.width, theme.key);

                    // 10 bis. Commande payable à la remise, acceptée : lien de l'avis « commande acceptée » (?payer=solde), le
                    // panneau du solde s'ouvre au montant relu en base (idée 12)
                    const third = await context.request.post(`${APP_URL}/api/orders/create`, {
                        headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
                        data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
                    });
                    const thirdBody = await third.json() as { order?: { id?: string } };
                    expect(third.status(), `commande payable à la remise : ${JSON.stringify(thirdBody)}`).toBe(201);
                    const accepted = String(thirdBody.order?.id);
                    await partnerStep(data, accepted, 'ACCEPTER');
                    await page.goto(`/orders/${accepted}?payer=solde`, { waitUntil: 'load' });
                    const balance = page.getByTestId('solde');
                    await expect(balance.getByTestId('paiement-solde')).toBeVisible({ timeout: 30_000 });
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'solde depuis l’avis');
                    await shot(page, 'solde-depuis-avis', w.width, theme.key);

                    // 11. Mes commandes (heure estimée rappelée pour la commande en cours : idée 10)
                    await page.goto('/orders', { waitUntil: 'load' });
                    await expect(page.locator(`[data-commande="${orderId}"]`).first()).toBeVisible({ timeout: 30_000 });
                    await expect(page.locator(`[data-commande="${accepted}"]`).getByTestId('heure-estimee-liste')).toContainText(/Prête (demain )?vers \d{1,2} h/);
                    await expect(page.getByRole('link', { name: /Commander à nouveau/ }).or(page.getByRole('button', { name: /Commander à nouveau/ })).first()).toBeVisible();
                    await settle(page);
                    await checkLayout(page, w.width, w.phone, 'Mes commandes');
                    await shot(page, 'mes-commandes', w.width, theme.key);
                    const undo = await context.request.post(`${APP_URL}/api/orders/${accepted}/cancel`, { data: {} });
                    expect(undo.status(), `annulation de la commande acceptée : ${await undo.text()}`).toBe(200);

                    // 12. Fermeture exceptionnelle annoncée sur la carte (idée 9), premier créneau proposé ; levée ensuite
                    const { data: closure, error: cErr } = await serviceClient().from('venue_closures')
                        .insert({ venue_id: data.venueId, starts_at: dakarQuarter(-60), ends_at: `${dakarQuarter(24 * 60).slice(0, 10)} 18:00`, reason: 'Fermeture des captures (lot 12b)' })
                        .select('id').single();
                    if (cErr || !closure) throw new Error(`[l12b] fermeture : ${cErr?.message}`);
                    try {
                        await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
                        await expect(page.getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/)).toBeVisible({ timeout: 30_000 });
                        await expect(page.getByTestId('fermeture-exceptionnelle')).toContainText('Premier créneau proposé');
                        await settle(page);
                        await checkLayout(page, w.width, w.phone, 'fermeture exceptionnelle');
                        await shot(page, 'fermeture', w.width, theme.key, false);
                    } finally {
                        await serviceClient().from('venue_closures').update({ cancelled_at: new Date().toISOString() }).eq('id', String(closure.id));
                    }
                }
            } finally {
                await context.close();
            }
        } finally {
            await releaseOrdersService(`${WHO} (${theme.key})`, superadmin);
        }
    });
}
