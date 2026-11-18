/**
 * Design 1b (points 8 et 9) — « Mes billets » façon Wallet, « Mes paiements », réabonnement aux notifications, avec la base.
 *  1. GET /api/tickets sert la couleur de la catégorie au contrôle (`categoryColor`, palette fermée ; null sans couleur),
 *     le début et la fin retenue (`startsAt`, `endsAt`, instants ISO : compte à rebours sur le téléphone), aucune photo
 *     distante en repli, et répond « Cache-Control: private, no-store » (page personnelle, jamais en cache partagé).
 *  2. GET /api/account/payments : « Remboursement en cours » dès qu'un billet du paiement est en remboursement (demande
 *     faite par ticket_refund_request, argent pas encore versé) ; témoin « Confirmé » avant ; après le versement, plus
 *     « Remboursement en cours ».
 *  3. Réabonnement automatique (lib/push/client.ts, faux navigateur ; vraies routes /api/push/config et
 *     /api/push/subscriptions, appelées dans le processus avec la session du compte connecté) : après « Déconnecter tous
 *     mes appareils » (abonnements du compte supprimés côté serveur, navigateur désabonné), la reconnexion du même compte,
 *     permission déjà accordée, réabonne l'appareil SANS fenêtre d'autorisation et l'abonnement est enregistré pour CE
 *     compte ; un autre compte connecté ensuite sur le même téléphone : enregistré pour lui seul, jamais pour le premier ;
 *     notifications désactivées sur l'appareil, ou permission retirée : rien.
 * Rouge avant correctif : /api/tickets ne servait ni la couleur ni les instants (et une photo Unsplash en repli) ; un billet
 * en remboursement laissait le paiement « Confirmé » ; syncPushSubscription n'était appelée nulle part et ne réabonnait
 * jamais un appareil sans abonnement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';
import { assertNotificationInvariants, fakeBrowserSubscription, newVapidKeys, withVapid } from './notif-helpers';
import { CashoutService } from '../../lib/payments/cashout.service';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Carré VIP', price: 5_000, total: 20 }, { name: 'Gratuit', price: 0, total: 20 }];

let partner: TestPartner;
let ev: DraftEvent;

before(async () => {
    partner = await newPartner('design1b-billets');
    ev = await createDraftEvent(partner, 'design1b-billets', CATEGORIES, { startsInHours: 48, durationHours: 5 });
    const { error } = await service.from('ticket_categories').update({ scan_color: 'VIOLET' }).eq('id', ev.categories['Carré VIP'].id);
    assert.equal(error, null, `couleur de la catégorie : ${error?.message}`);
    // Catégorie sans couleur (ancienne catégorie : colonne nullable) ; la finition 2b en attribue une à la création (run 372 : NOIR)
    const { error: noColorErr } = await service.from('ticket_categories').update({ scan_color: null }).eq('id', ev.categories.Gratuit.id);
    assert.equal(noColorErr, null, `catégorie sans couleur : ${noColorErr?.message}`);
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
});

after(async () => {
    await assertLot9bisInvariants('design1b-billets');
    await assertNotificationInvariants('design1b-billets');
});

async function myTickets(user: Buyer): Promise<{ tickets: Row[]; cacheControl: string | null }> {
    const handler = await routeHandler('../../app/api/tickets/route', 'GET', 'GET /api/tickets');
    const res = await handler(jsonRequest('/api/tickets', 'GET', user.accessToken));
    const cacheControl = res.headers.get('cache-control');
    const body = JSON.parse(await res.text()) as { tickets?: Row[] };
    assert.equal(res.status, 200, `Mes billets : HTTP ${res.status} ${JSON.stringify(body).slice(0, 400)}`);
    return { tickets: body.tickets ?? [], cacheControl };
}

async function paymentLabel(user: Buyer, paymentId: string): Promise<string> {
    const handler = await routeHandler('../../app/api/account/payments/route', 'GET', 'GET /api/account/payments');
    const res = await invoke(handler, jsonRequest('/api/account/payments', 'GET', user.accessToken));
    assert.equal(res.status, 200, `Mes paiements : ${show(res)}`);
    const item = ((res.body.items ?? []) as Row[]).find((i) => i.id === paymentId);
    assert.ok(item, `paiement ${paymentId} dans Mes paiements : ${show(res)}`);
    return String(item.status_label);
}

// ── 1. Couleur de la catégorie et instants ─────────────────────────────────

describe('design 1b (8) — GET /api/tickets : couleur de la catégorie, début et fin, sans cache', () => {
    test('catégorie VIOLET : categoryColor « VIOLET » ; catégorie sans couleur : null ; instants ISO ; private, no-store', async () => {
        const buyer = await newBuyer('d1b-couleur');
        const [paid] = (await buyConfirmed(buyer, ev, [['Carré VIP', 1]])).tickets;
        const freeId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, buyer);
        const { tickets, cacheControl } = await myTickets(buyer);
        assert.match(cacheControl ?? '', /private/, `Cache-Control : ${cacheControl}`);
        assert.match(cacheControl ?? '', /no-store/, `Cache-Control : ${cacheControl}`);
        const vip = tickets.find((t) => t.id === paid.id);
        const free = tickets.find((t) => t.id === freeId);
        assert.ok(vip && free, 'les deux billets dans Mes billets');
        assert.equal(vip!.categoryColor, 'VIOLET', 'couleur de la catégorie servie');
        assert.equal(free!.categoryColor, null, 'catégorie sans couleur : carte neutre');
        const startsAt = Date.parse(String(vip!.startsAt));
        const endsAt = Date.parse(String(vip!.endsAt));
        assert.ok(Number.isFinite(startsAt) && Number.isFinite(endsAt), `instants ISO : ${vip!.startsAt} → ${vip!.endsAt}`);
        assert.ok(endsAt > startsAt, 'fin après le début');
        assert.ok(Math.abs(startsAt - (Date.now() + 48 * 3600_000)) < 2 * 3600_000, `début dans 48 h environ : ${vip!.startsAt}`);
        for (const t of tickets) assert.ok(!/unsplash/.test(String(t.eventImageUrl ?? '')), `aucune photo distante en repli : ${t.eventImageUrl}`);
    });
});

// ── 2. Remboursement en cours ──────────────────────────────────────────────

describe('design 1b (8) — Mes paiements : « Remboursement en cours » dès qu’un billet l’est', () => {
    test('témoin « Confirmé » ; demande de remboursement d’un billet (pas encore versé) → « Remboursement en cours » ; versé → plus en cours', async () => {
        const buyer = await newBuyer('d1b-remboursement');
        const purchase = await buyConfirmed(buyer, ev, [['Carré VIP', 2]]);
        const paymentId = String(purchase.payment.id);
        assert.equal(await paymentLabel(buyer, paymentId), 'Confirmé', 'témoin avant la demande');

        const ticketId = String(purchase.tickets[0].id);
        const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: ticketId, p_actor: partner.userId, p_reason: 'Remboursement d’un billet (design 1b)' });
        assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, `remboursement accepté : ${JSON.stringify(data)}`);
        try {
            const { data: t } = await service.from('tickets').select('status').eq('id', ticketId).single();
            assert.equal((t as Row).status, 'REMBOURSEMENT_EN_COURS', 'précondition : billet en remboursement, argent pas encore versé');
            const { data: p } = await service.from('payments').select('status').eq('id', paymentId).single();
            assert.equal((p as Row).status, 'SUCCESS', 'précondition : le paiement reste SUCCESS tant que rien n’est versé');
            assert.equal(await paymentLabel(buyer, paymentId), 'Remboursement en cours', 'dès la demande (avant : « Confirmé » jusqu’au versement)');
        } finally {
            for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
                if (c.status === 'A_ENVOYER') await CashoutService.send(String(c.id));
            }
            await confirmCashouts();
        }
        const { data: after } = await service.from('tickets').select('status').eq('id', ticketId).single();
        if ((after as Row).status === 'REMBOURSE') {
            assert.notEqual(await paymentLabel(buyer, paymentId), 'Remboursement en cours', 'versé : plus « en cours »');
        }
    });
});

// ── 3. Réabonnement automatique ────────────────────────────────────────────

interface FakeSub { endpoint: string; options: { applicationServerKey: Buffer }; toJSON: () => unknown; unsubscribe: () => Promise<boolean> }

describe('design 1b (9) — réabonnement automatique de l’appareil après « Déconnecter tous mes appareils »', () => {
    test('permission accordée : réabonné sans fenêtre, enregistré pour le compte connecté seulement ; désactivé ou sans permission : rien', async () => {
        const keys = newVapidKeys();
        const a = await newBuyer('d1b-push-a');
        const b = await newBuyer('d1b-push-b');
        const browser = { permission: 'granted' as 'granted' | 'default', sub: null as FakeSub | null, requests: 0, subscribes: 0, storage: new Map<string, string>() };
        let connected: Buyer = a;
        const saved: Array<[string, PropertyDescriptor | undefined]> = [];
        const setGlobal = (key: string, value: unknown): void => {
            saved.push([key, Object.getOwnPropertyDescriptor(globalThis, key)]);
            Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        };
        const newSub = (): FakeSub => {
            const fresh = fakeBrowserSubscription();
            const sub: FakeSub = {
                endpoint: fresh.endpoint,
                options: { applicationServerKey: Buffer.from(keys.publicKey, 'base64url') },
                toJSON: () => fresh.json,
                unsubscribe: async () => { if (browser.sub === sub) browser.sub = null; return true; },
            };
            return sub;
        };
        const registration = {
            pushManager: {
                getSubscription: async () => browser.sub,
                subscribe: async () => { browser.subscribes += 1; browser.sub = newSub(); return browser.sub; },
            },
        };
        const configRoute = await routeHandler('../../app/api/push/config/route', 'GET', 'GET /api/push/config');
        const subscriptionsPost = await routeHandler('../../app/api/push/subscriptions/route', 'POST', 'POST /api/push/subscriptions');
        const subscriptionsDelete = await routeHandler('../../app/api/push/subscriptions/route', 'DELETE', 'DELETE /api/push/subscriptions');
        const realFetch = globalThis.fetch;
        setGlobal('window', globalThis);
        setGlobal('isSecureContext', true);
        setGlobal('PushManager', class {});
        setGlobal('Notification', class {
            static get permission() { return browser.permission; }
            static async requestPermission() { browser.requests += 1; return browser.permission; }
        });
        setGlobal('navigator', { userAgent: 'test design 1b', serviceWorker: { getRegistration: async () => registration, register: async () => registration, ready: Promise.resolve(registration) } });
        setGlobal('localStorage', {
            getItem: (k: string) => browser.storage.get(k) ?? null,
            setItem: (k: string, v: string) => { browser.storage.set(k, String(v)); },
            removeItem: (k: string) => { browser.storage.delete(k); },
        });
        // Les appels du navigateur portent la session du compte connecté (cookies dans la vraie page : jeton ici).
        setGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost').pathname;
            if (url === '/api/push/config') return configRoute(jsonRequest('/api/push/config', 'GET', connected.accessToken));
            if (url === '/api/push/subscriptions' && init?.method === 'POST') {
                return subscriptionsPost(jsonRequest('/api/push/subscriptions', 'POST', connected.accessToken, JSON.parse(String(init.body))));
            }
            if (url === '/api/push/subscriptions' && init?.method === 'DELETE') {
                return subscriptionsDelete(jsonRequest('/api/push/subscriptions', 'DELETE', connected.accessToken, JSON.parse(String(init.body))));
            }
            return realFetch(input, init);
        });
        const rowsOf = async (userId: string): Promise<Row[]> => {
            const { data, error } = await service.from('push_subscriptions').select('id, user_id, endpoint').eq('user_id', userId);
            assert.equal(error, null, `push_subscriptions : ${error?.message}`);
            return (data ?? []) as Row[];
        };
        try {
            await withVapid(async () => {
                const client = await import('../../lib/push/client');
                // A se connecte et active les notifications sur ce téléphone (geste : « Activer »)
                connected = a;
                assert.equal(await client.enablePush(), 'enabled');
                assert.equal((await rowsOf(a.userId)).length, 1, 'abonnement de A enregistré');

                // « Déconnecter tous mes appareils » : abonnements du compte supprimés côté serveur, navigateur désabonné
                await service.from('push_subscriptions').delete().eq('user_id', a.userId);
                await browser.sub!.unsubscribe();
                browser.requests = 0;
                browser.subscribes = 0;

                // Reconnexion de A, permission déjà accordée : réabonné seul, enregistré pour A
                assert.equal(await client.syncPushSubscription(), 'resubscribed');
                assert.equal(browser.requests, 0, 'aucune fenêtre d’autorisation');
                const rowsA = await rowsOf(a.userId);
                assert.equal(rowsA.length, 1, `un abonnement pour A : ${JSON.stringify(rowsA)}`);
                assert.equal(rowsA[0].endpoint, browser.sub!.endpoint, 'l’abonnement neuf de ce téléphone');

                // A se déconnecte (navigateur désabonné) ; B se connecte sur le même téléphone : l'abonnement est enregistré
                // pour B, le compte connecté, jamais pour A
                await browser.sub!.unsubscribe();
                await service.from('push_subscriptions').delete().eq('user_id', a.userId);
                connected = b;
                assert.equal(await client.syncPushSubscription(), 'resubscribed');
                const rowsB = await rowsOf(b.userId);
                assert.equal(rowsB.length, 1, `abonnement du compte connecté (B) : ${JSON.stringify(rowsB)}`);
                assert.equal(rowsB[0].endpoint, browser.sub!.endpoint);
                assert.deepEqual(await rowsOf(a.userId), [], 'rien pour A, qui n’est plus connecté');

                // B désactive les notifications de cet appareil, se déconnecte puis se reconnecte : plus de réabonnement
                await client.disablePush();
                assert.deepEqual(await rowsOf(b.userId), [], '« Désactiver » retire l’abonnement de B');
                browser.subscribes = 0;
                assert.equal(await client.syncPushSubscription(), 'skipped');
                assert.equal(browser.subscribes, 0, 'désactivé ici : aucun abonnement');

                // Permission plus accordée : rien
                browser.storage.clear();
                browser.permission = 'default';
                assert.equal(await client.syncPushSubscription(), 'skipped');
                assert.equal(browser.subscribes + browser.requests, 0);
            }, keys);
        } finally {
            for (const [key, desc] of saved.reverse()) {
                if (desc) Object.defineProperty(globalThis, key, desc);
                else delete (globalThis as Record<string, unknown>)[key];
            }
            await service.from('push_subscriptions').delete().in('user_id', [a.userId, b.userId]);
        }
    });
});

