/**
 * Lot 12d — commandes : espace du livreur (livraisons du jour, livraison prête, saisie du code et reste en espèces, client
 * absent, invitation), administration des commandes (liste « À décider », fiche, décision après une absence), partenaire
 * (commandes prévues pendant une fermeture, pause des commandes) et client (signaler un problème, signalement envoyé,
 * bandeau de pause, allergènes et piment), de bout en bout sur le serveur construit (job « responsive » de la CI : nom en
 * « …responsive.spec.ts »).
 *
 * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
 * démonstration « organisateur » (session déjà préparée), validé, ouvert 24 h sur 24, qui prend des commandes (livraison, retrait, paiement à la
 * remise : aucun paiement réel) ; des plats avec allergènes et piment ; un livreur actif (fumee-client), invité aussi par
 * « organisateur2 » (invitation en attente), qui passe aussi deux commandes à retirer comme client ; des livraisons à chaque étape (prête, en route, client absent en attente,
 * client absent à décider : horloge avancée par une écriture LOCALE de la base, SUPABASE_DB_URL de .env.e2e, hôte local
 * vérifié) ; deux commandes en préparation du même compte, client cette fois (dont une signalée) ; une commande prévue demain dans une
 * fermeture exceptionnelle posée ensuite ; une pause de 60 minutes.
 *
 * Interrupteurs : features.orders_enabled par le compteur partagé e2e/support/orders-service.ts (lots 12b et 12c) ;
 * features.tables_enabled (page des fermetures, sous la garde des tables) par e2e/support/tables-service.ts ; sous le verrou
 * des services (groupe « services »).
 *
 * AUCUNE connexion dans le spec : le quota de 30 connexions par adresse et par heure du job (PASSWORD_LOGIN_PER_IP_HOUR) est
 * atteint par la préparation des sessions et les autres specs (runs 789 et 793 : 429). Sessions préparées reprises : le client
 * du seed de test (fumee-client, lu par aucun autre spec du job responsive) est le livreur, et le client de ses deux
 * commandes à retirer ; organisateur (partenaire) ; fumee-superadmin (administration).
 * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
 * capture. Captures : .e2e-captures/captures-responsive/l12d-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
import { runResponsiveChecks } from './support/responsive-checks';
import { requireStorageState } from './support/accounts';
import { openOrdersService, releaseOrdersService } from './support/orders-service';
import { openTablesService, releaseTablesService } from './support/tables-service';
import { e2eConfig } from './support/env';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
const WIDTHS = [
    { width: 390, height: 844, phone: true },
    { width: 1440, height: 900, phone: false },
] as const;
const STAMP = randomUUID().slice(0, 6);
const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
const WHO = 'lot12d';

interface Ref { id: string; number: string }
interface Seeded {
    venueId: string;
    closureId: string;
    invitationId: string;
    courier: ControllerAccount;
    orders: { prete: Ref; route: Ref; absent: Ref; equipe: Ref; prep: Ref; signale: Ref; fermeture: Ref };
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    // Écrans relus toutes les 10 à 15 s : jamais « réseau au repos » ; attente bornée
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
    await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `l12d-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
}

async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
    const r = await runResponsiveChecks(page, { width, phone });
    expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
}

async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string): Promise<BrowserContext> {
    const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
    await context.addInitScript((value: string) => {
        try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
        document.cookie = `ev-theme=${value}; path=/`;
    }, scheme);
    return context;
}

async function title(page: Page, name: string | RegExp): Promise<void> {
    const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
    await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

/** Écriture LOCALE de la base (horloge des tests) : hôte local vérifié, drapeau des fonctions de commande posé. */
async function localSql(text: string, params: unknown[]): Promise<void> {
    e2eConfig();
    const url = process.env.SUPABASE_DB_URL;
    if (!url) throw new Error('[l12d] SUPABASE_DB_URL absent de .env.e2e : horloge de l’absence impossible à avancer');
    const host = new URL(url).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`[l12d] SUPABASE_DB_URL non locale (${host})`);
    const c = new Client({ connectionString: url, application_name: 'ev-e2e-l12d' });
    await c.connect();
    try {
        await c.query('BEGIN');
        await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
        await c.query(text, params);
        await c.query('COMMIT');
    } finally {
        await c.end();
    }
}

/** Compte du seed de test (session préparée) : identifiant, numéro, prénom et nom. */
async function fixtureAccount(email: string): Promise<ControllerAccount> {
    const userId = await userIdByEmail(email);
    const { data, error } = await serviceClient().from('users').select('phone, first_name, last_name').eq('id', userId).single();
    if (error || !data?.phone) throw new Error(`[l12d] compte ${email} : ${error?.message ?? 'sans numéro'}`);
    const phone = String(data.phone);
    return { userId, email, phone, local: phone.replace(/^\+221/, ''), firstName: String(data.first_name ?? ''), lastName: String(data.last_name ?? '') };
}

function tomorrow(): string {
    return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

async function seed(superadmin: string): Promise<Seeded> {
    const demo = readDemoIds().accounts;
    const owner = demo.organisateur;
    const service = serviceClient();
    const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
    if (fErr || !fiche || fiche.status !== 'VALIDE') throw new Error(`[l12d] fiche de organisateur : ${fErr?.message ?? String(fiche?.status)}`);

    const { data: venue, error: vErr } = await service.from('venues').insert({
        partner_id: fiche.id, kind: 'RESTAURANT', name: `Le Baobab ${STAMP}`, address: 'Rue 10, Médina', city: 'Dakar',
        latitude: 14.68, longitude: -17.45, confirmation_mode: 'AUTO',
    }).select('id').single();
    if (vErr || !venue) throw new Error(`[l12d] établissement : ${vErr?.message}`);
    const venueId = String(venue.id);
    await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
    await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
    await rpcOk('order_venue_settings_set', {
        actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT'],
        deposit_allowed: false, deposit_percent: null, pay_on_handover: true, prep_minutes: 20,
    });
    const zone = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Médina – Fass', fee: 1_000, min_order: 0 });
    const zoneId = String((zone.zone as Record<string, unknown>).id);
    const save = async (fields: Record<string, unknown>, allergens: string[], spice: number): Promise<string> => {
        const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
        const id = String((r.product as Record<string, unknown>).id);
        await rpcOk('order_product_details_set', { actor_id: owner.userId, product_id: id, allergens, spice_level: spice });
        return id;
    };
    const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500 }, ['MOUTARDE', 'GLUTEN'], 2);
    const thieb = await save({ name: 'Thiéboudienne', description: 'Riz au poisson, légumes du marché.', price: 4_500 }, ['POISSON', 'CELERI'], 1);
    await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000 }, [], 0);
    await save({ name: 'Pastels au thon', description: 'Chaussons frits, sauce très pimentée.', price: 2_000 }, ['POISSON', 'GLUTEN', 'OEUFS'], 3);

    // Livreur actif ; invitation en attente d'une autre partenaire (organisateur2)
    const courier = await fixtureAccount(FIXTURE_USERS.CLIENT.email);
    const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
    await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
    const other = await rpcOk('order_courier_invite', { actor_id: demo.organisateur2.userId, phone: courier.phone });

    // Commandes payables à la remise (au plus 3 en cours par compte) ; le livreur est aussi le client de deux retraits
    const client = courier;
    const buyers: ControllerAccount[] = [];
    for (const k of ['a', 'b']) buyers.push(await createClientAccount(`l12d-${k}-${STAMP}`));
    const line = (productId: string, quantity: number) => ({ product_id: productId, quantity, option_ids: [] });
    const place = async (who: ControllerAccount, body: Record<string, unknown>): Promise<Ref> => {
        const r = await rpcOk('order_create', { client_id: who.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
        return { id: String(r.order_id), number: String(r.order_number) };
    };
    const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
        for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
    };
    const deliver = (who: ControllerAccount) => ({ mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 7, rue 10 Médina, face à la mosquée', phone: who.local });
    const leave = async (o: Ref): Promise<void> => {
        await act(o.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'CONFIER', courier_id: courier.userId });
    };
    const absent = async (o: Ref): Promise<void> => {
        await rpcOk('order_courier_action', { order_id: o.id, actor_id: courier.userId, action: 'EN_ROUTE', minutes: 20 });
        await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'APPEL' });
        await localSql(`UPDATE public.orders SET last_call_at = now() - interval '31 seconds' WHERE id = $1`, [o.id]);
        await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'APPEL' });
        await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'ABSENT' });
    };
    const prete = await place(buyers[0], { ...deliver(buyers[0]), items: [line(yassa, 2), line(thieb, 1)] });
    await leave(prete);
    const route = await place(buyers[0], { ...deliver(buyers[0]), items: [line(thieb, 2)] });
    await leave(route);
    await rpcOk('order_courier_action', { order_id: route.id, actor_id: courier.userId, action: 'EN_ROUTE', minutes: 15 });
    const absentOrder = await place(buyers[0], { ...deliver(buyers[0]), items: [line(yassa, 1)] });
    await leave(absentOrder);
    await absent(absentOrder);
    const equipe = await place(buyers[1], { ...deliver(buyers[1]), items: [line(thieb, 1)] });
    await leave(equipe);
    await absent(equipe);
    await localSql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [equipe.id]);
    const tick = await service.rpc('order_watch_tick');
    if (tick.error) throw new Error(`[l12d] order_watch_tick : ${tick.error.message}`);

    const prep = await place(client, { mode: 'RETRAIT', phone: client.local, items: [line(yassa, 1)] });
    await act(prep.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
    const signale = await place(client, { mode: 'RETRAIT', phone: client.local, items: [line(thieb, 1)] });
    await act(signale.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
    await rpcOk('order_issue_report', { actor_id: client.userId, order_id: signale.id, reason: 'RETARD', details: 'Toujours rien après 40 minutes.' });

    // Commande prévue demain à 13 h, puis fermeture exceptionnelle de 12 h à 15 h
    const day = tomorrow();
    const fermeture = await place(buyers[1], { mode: 'RETRAIT', phone: buyers[1].local, scheduled_for: `${day}T13:00`, items: [line(yassa, 3)] });
    await act(fermeture.id, { action: 'ACCEPTER' });
    const { data: closure, error: cErr } = await service.from('venue_closures')
        .insert({ venue_id: venueId, starts_at: `${day}T12:00:00`, ends_at: `${day}T15:00:00`, reason: 'Travaux en cuisine', created_by: owner.userId })
        .select('id').single();
    if (cErr || !closure) throw new Error(`[l12d] fermeture : ${cErr?.message}`);

    // Pause de 60 minutes (bandeau de la carte, état de l'écran des commandes)
    await rpcOk('order_venue_pause', { actor_id: owner.userId, venue_id: venueId, minutes: 60 });

    return {
        venueId, closureId: String(closure.id), invitationId: String(other.invitation_id), courier,
        orders: { prete, route, absent: absentOrder, equipe, prep, signale, fermeture },
    };
}

let seeded: Seeded | null = null;
let superadmin = '';

test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });

for (const theme of THEMES) {
    test(`livreur, administration, fermeture, pause, signalement, allergènes · ${theme.key} (390 et 1 440 px)`, async ({ browser }, testInfo) => {
        test.setTimeout(900_000);
        superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
        const who = `${WHO} (${theme.key})`;
        await openOrdersService(who, superadmin);
        await openTablesService(who, superadmin);
        try {
            seeded ??= await seed(superadmin);
            const d = seeded;

            // ── Livreur ───────────────────────────────────────────────────────────────────────────────────────
            const cour = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-client'));
            const cp = await cour.newPage();
            for (const w of WIDTHS) {
                await cp.setViewportSize({ width: w.width, height: w.height });
                await cp.goto('/courier/orders', { waitUntil: 'load' });
                await title(cp, 'Mes livraisons');
                await expect(cp.getByRole('link', { name: new RegExp(`^Livraison ${d.orders.route.number},`) }).first()).toBeVisible({ timeout: 30_000 });
                await expect(cp.getByRole('heading', { name: 'Client absent' }).first()).toBeVisible();
                await settle(cp);
                await checkLayout(cp, w.width, w.phone, 'livraisons du jour');
                await shot(cp, 'livreur-liste', w.width, theme.key);

                await cp.goto(`/courier/orders/${d.orders.prete.id}`, { waitUntil: 'load' });
                await title(cp, `Livraison ${d.orders.prete.number}`);
                await expect(cp.getByRole('button', { name: 'Je pars' })).toBeVisible({ timeout: 30_000 });
                await expect(cp.getByText('Le numéro du client s’affiche quand vous partez.')).toBeVisible();
                await settle(cp);
                await checkLayout(cp, w.width, w.phone, 'livraison prête');
                await shot(cp, 'livreur-livraison', w.width, theme.key);

                await cp.goto(`/courier/orders/${d.orders.route.id}`, { waitUntil: 'load' });
                await title(cp, `Livraison ${d.orders.route.number}`);
                const code = cp.getByRole('group', { name: 'Code de remise à 4 chiffres' });
                await expect(code).toBeVisible({ timeout: 30_000 });
                await expect(cp.getByText(/^Reste reçu en espèces/).first()).toBeVisible();
                await expect(cp.getByRole('button', { name: 'Appeler le client' })).toBeVisible();
                await code.scrollIntoViewIfNeeded();
                await settle(cp);
                await checkLayout(cp, w.width, w.phone, 'saisie du code');
                await shot(cp, 'livreur-code', w.width, theme.key);

                await cp.goto(`/courier/orders/${d.orders.absent.id}`, { waitUntil: 'load' });
                await title(cp, `Livraison ${d.orders.absent.number}`);
                await expect(cp.getByText(/^Client absent : attente/).first()).toBeVisible({ timeout: 30_000 });
                await settle(cp);
                await checkLayout(cp, w.width, w.phone, 'client absent');
                await shot(cp, 'livreur-client-absent', w.width, theme.key);

                await cp.goto(`/courier/invitations/${d.invitationId}`, { waitUntil: 'load' });
                await title(cp, /vous invite à livrer$/);
                await expect(cp.getByRole('button', { name: 'Accepter' })).toBeVisible({ timeout: 30_000 });
                await settle(cp);
                await checkLayout(cp, w.width, w.phone, 'invitation');
                await shot(cp, 'livreur-invitation', w.width, theme.key);
            }
            await cour.close();

            // ── Administration ────────────────────────────────────────────────────────────────────────────────
            const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-superadmin'));
            const ap = await adm.newPage();
            for (const w of WIDTHS) {
                await ap.setViewportSize({ width: w.width, height: w.height });
                await ap.goto('/admin/orders?groupe=A_DECIDER', { waitUntil: 'load' });
                await title(ap, 'Commandes');
                await expect(ap.getByRole('link', { name: d.orders.equipe.number }).first()).toBeVisible({ timeout: 30_000 });
                await settle(ap);
                await checkLayout(ap, w.width, w.phone, 'commandes à décider');
                await shot(ap, 'admin-liste', w.width, theme.key);

                await ap.goto(`/admin/orders/${d.orders.route.id}`, { waitUntil: 'load' });
                await title(ap, `Commande ${d.orders.route.number}`);
                await expect(ap.getByRole('heading', { name: 'Étapes' })).toBeVisible({ timeout: 30_000 });
                await settle(ap);
                await checkLayout(ap, w.width, w.phone, 'fiche d’une commande');
                await shot(ap, 'admin-fiche', w.width, theme.key);

                await ap.goto(`/admin/orders/${d.orders.equipe.id}`, { waitUntil: 'load' });
                await title(ap, `Commande ${d.orders.equipe.number}`);
                const decide = ap.getByRole('heading', { name: 'Décider après l’absence du client' });
                await expect(decide).toBeVisible({ timeout: 30_000 });
                await ap.getByText('Ne rien rembourser', { exact: true }).first().click();
                await ap.getByLabel('Motif').last().fill('Deux appels et trente minutes d’attente sans réponse.');
                await ap.getByRole('button', { name: 'Voir le montant rendu' }).click();
                await expect(ap.getByRole('button', { name: /^Confirmer/ })).toBeVisible({ timeout: 30_000 });
                await decide.scrollIntoViewIfNeeded();
                await settle(ap);
                await checkLayout(ap, w.width, w.phone, 'décision après une absence');
                await shot(ap, 'admin-decision', w.width, theme.key);
            }
            await adm.close();

            // ── Partenaire : fermeture avec commandes, pause ──────────────────────────────────────────────────
            const org = await themedContext(browser, testInfo, theme.scheme, requireStorageState('organisateur'));
            const op = await org.newPage();
            for (const w of WIDTHS) {
                await op.setViewportSize({ width: w.width, height: w.height });
                await op.goto(`/partner/tables/edition/${d.venueId}/fermetures?fermeture=${d.closureId}`, { waitUntil: 'load' });
                const section = op.getByRole('heading', { name: 'Commandes prévues pendant cette fermeture' }).first();
                await expect(section).toBeVisible({ timeout: 30_000 });
                await expect(op.getByRole('button', { name: `Garder la commande ${d.orders.fermeture.number}` })).toBeVisible();
                await section.scrollIntoViewIfNeeded();
                await settle(op);
                await checkLayout(op, w.width, w.phone, 'fermeture avec commandes');
                await shot(op, 'partenaire-fermeture', w.width, theme.key);

                await op.goto('/partner/orders', { waitUntil: 'load' });
                await title(op, 'Commandes');
                await expect(op.getByRole('heading', { name: 'Pause des commandes' }).first()).toBeVisible({ timeout: 30_000 });
                await settle(op);
                await checkLayout(op, w.width, w.phone, 'pause des commandes');
                await shot(op, 'partenaire-pause', w.width, theme.key, false);
            }
            await org.close();

            // ── Cliente : signalement, bandeau de pause, allergènes ───────────────────────────────────────────
            // Même compte que le livreur (session préparée)
            const cli = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-client'));
            const pp = await cli.newPage();
            for (const w of WIDTHS) {
                await pp.setViewportSize({ width: w.width, height: w.height });
                await pp.goto(`/orders/${d.orders.prep.id}`, { waitUntil: 'load' });
                await pp.getByRole('button', { name: 'Signaler un problème' }).first().click({ timeout: 30_000 });
                const dialog = pp.getByRole('alertdialog', { name: 'Signaler un problème' });
                await expect(dialog).toBeVisible({ timeout: 10_000 });
                await expect(dialog.getByRole('radiogroup', { name: 'Motif du signalement' })).toBeVisible();
                await settle(pp);
                await checkLayout(pp, w.width, w.phone, 'signaler un problème');
                await shot(pp, 'client-signalement', w.width, theme.key, false);
                await pp.keyboard.press('Escape');

                await pp.goto(`/orders/${d.orders.signale.id}`, { waitUntil: 'load' });
                await expect(pp.getByText('Signalement envoyé').first()).toBeVisible({ timeout: 30_000 });
                await settle(pp);
                await checkLayout(pp, w.width, w.phone, 'signalement envoyé');
                await shot(pp, 'client-signalement-envoye', w.width, theme.key);

                await pp.goto(`/restaurants/${d.venueId}/menu`, { waitUntil: 'load' });
                await expect(pp.locator('[data-testid="pause-commandes"] >> visible=true').first()).toBeVisible({ timeout: 30_000 });
                await expect(pp.getByText(/^Ce restaurant reprend les commandes à \d{1,2} h( \d{2})?$/).first()).toBeVisible();
                await expect(pp.getByRole('button', { name: 'Sans piment' })).toBeVisible();
                await settle(pp);
                await checkLayout(pp, w.width, w.phone, 'carte en pause');
                await shot(pp, 'client-carte-pause', w.width, theme.key);
                await pp.getByRole('button', { name: 'Voir Yassa poulet' }).click();
                const sheet = pp.getByRole('dialog', { name: 'Yassa poulet' });
                await expect(sheet).toBeVisible({ timeout: 10_000 });
                await expect(sheet.getByRole('list', { name: 'Allergènes du plat' })).toBeVisible();
                await settle(pp);
                await checkLayout(pp, w.width, w.phone, 'allergènes et piment');
                await shot(pp, 'client-allergenes', w.width, theme.key, false);
                await pp.keyboard.press('Escape');
            }
            await cli.close();
        } finally {
            await releaseTablesService(who, superadmin);
            await releaseOrdersService(who, superadmin);
        }
    });
}
