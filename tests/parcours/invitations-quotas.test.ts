/**
 * Lot 9, tâche 9.0 — quotas des invitations (contrat 4.1, 5.1 étape 7, L4, AR15, X3 ; découverte 9-invitations,
 * 1.4, 3.5). Fenêtres fixes de quota_reserve : alignement par alignQuotaWindow, contrôle par assertSameQuotaWindow
 * (patron acces-limiteurs). Une « invitation » est une ligne numéro d'un envoi, pas un billet (L4).
 *  - 51e numéro de l'heure sur un événement refusé (défaut 50) ; 4e envoi du jour pour un numéro refusé (défaut 3),
 *    tous événements confondus, quelle que soit la quantité ;
 *  - tout ou rien : aucune écriture pour les autres numéros de l'envoi refusé, aucun quota consommé ;
 *  - un refus de stock ne consomme pas de quota ; un tiers ne brûle pas le quota d'un événement (réservation dans
 *    la RPC, après droits et stock) ;
 *  - INVITATION_PER_EVENT_HOUR et INVITATION_PER_PHONE_DAY pris en compte (withEnv).
 *
 * Rouge avant correctif : ni la route d'envoi, ni la RPC ticket_invitation_create, ni les variables
 * INVITATION_PER_* n'existent : chaque cas échoue à son premier envoi en nommant la route absente ; after() :
 * assertLot9Invariants nomme le schéma manquant jusqu'à M2 et M4.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { alignQuotaWindow, assertSameQuotaWindow } from '../helpers/quota-window';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { randomSenegalPhone, routeContext } from './helpers';
import { categoryState, eventTickets, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent } from './acces-helpers';
import { outboxRows, withEnv } from './notif-helpers';
import { routeHandler } from './pilotage-helpers';

type Row = Record<string, unknown>;

const ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const STANDARD = 'Standard';
const EVENT_MESSAGE = 'Limite d\'invitations atteinte pour cet événement. Réessayez plus tard.';
const PHONE_MESSAGE = 'Ce numéro a déjà reçu le maximum d\'invitations aujourd\'hui.';

interface SendResult { status: number; body: Row; retryAfter: string | null }

let partner: TestPartner;

before(async () => {
    partner = await newPartner('invitations-quotas');
});

after(async () => {
    await assertLot9Invariants('invitations-quotas');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function newEvent(label: string, total = 30): Promise<SaleEvent> {
    const categories: CategorySpec[] = [{ name: STANDARD, price: 5_000, total, maxPerOrder: 10 }];
    return createTimedEvent(partner.partnerId, `quotas ${label}`, categories, { startsInHours: 48 });
}

async function send(user: Buyer, ev: SaleEvent, phones: string[], quantity = 1): Promise<SendResult> {
    const handler = await routeHandler(ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations (contrat 4.1)');
    const path = `/api/partner/events/${ev.eventId}/invitations`;
    const res = await handler(authed(path, 'POST', user, { category_id: ev.categories[STANDARD].id, phones, quantity }), routeContext({ id: ev.eventId }));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Row : {}, retryAfter: res.headers.get('retry-after') };
}

function showSend(r: SendResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)} Retry-After=${r.retryAfter}`;
}

async function sendOk(user: Buyer, ev: SaleEvent, phones: string[], quantity = 1): Promise<void> {
    const r = await send(user, ev, phones, quantity);
    assert.equal(r.status, 200, `envoi accepté attendu : ${showSend(r)}`);
}

function assertQuota(r: SendResult, message: string, what: string): void {
    assert.equal(r.status, 429, `${what} : 429 attendu, ${showSend(r)}`);
    assert.equal(r.body.code, 'QUOTA_EXCEEDED', `${what} : ${showSend(r)}`);
    assert.equal(r.body.error, message, `${what} : message selon la portée, ${showSend(r)}`);
    assert.ok(Number(r.body.retry_after_seconds) > 0, `${what} : retry_after_seconds, ${showSend(r)}`);
    assert.equal(r.retryAfter, String(r.body.retry_after_seconds), `${what} : en-tête Retry-After, ${showSend(r)}`);
}

function phones(n: number): string[] {
    return Array.from({ length: n }, () => randomSenegalPhone('76'));
}

async function ticketCount(ev: SaleEvent): Promise<number> {
    return (await eventTickets(ev.eventId)).length;
}

async function smsCount(phone: string): Promise<number> {
    return (await outboxRows({ type: 'INVITATION_RECEIVED', phone })).length;
}

// ── Valeurs par défaut ─────────────────────────────────────────────────────

describe('9.0 Quotas : valeurs par défaut (variables absentes)', () => {
    test('événement : 50 numéros par heure, le 51e est refusé, stock et billets inchangés', async () => {
        await withEnv({ INVITATION_PER_EVENT_HOUR: undefined, INVITATION_PER_PHONE_DAY: undefined }, async () => {
            const ev = await newEvent('defaut-heure', 60);
            const win = await alignQuotaWindow(3600, 45_000);
            for (let batch = 0; batch < 5; batch += 1) await sendOk(partner, ev, phones(10));
            assert.equal(await ticketCount(ev), 50, 'cinquante invitations acceptées');
            const extra = randomSenegalPhone('76');
            const refused = await send(partner, ev, [extra]);
            await assertSameQuotaWindow(win, 'rafale de 51 numéros');
            assertQuota(refused, EVENT_MESSAGE, '51e numéro');
            assert.equal(await ticketCount(ev), 50, 'aucun billet pour le 51e numéro');
            assert.equal((await categoryState(ev.categories[STANDARD].id)).sold, 50, 'stock inchangé');
            assert.equal(await smsCount(extra), 0, 'aucun SMS pour le 51e numéro');
        });
    });

    test('numéro : 3 envois par jour, tous événements confondus, quelle que soit la quantité ; le 4e est refusé', async () => {
        await withEnv({ INVITATION_PER_EVENT_HOUR: undefined, INVITATION_PER_PHONE_DAY: undefined }, async () => {
            const [a, b, c] = [await newEvent('jour-a'), await newEvent('jour-b'), await newEvent('jour-c')];
            const phone = randomSenegalPhone('76');
            const win = await alignQuotaWindow(86_400, 30_000);
            await sendOk(partner, a, [phone], 4);
            await sendOk(partner, b, [phone], 1);
            await sendOk(partner, c, [phone], 1);
            const refused = await send(partner, a, [phone], 1);
            await assertSameQuotaWindow(win, 'quatre envois au même numéro');
            assertQuota(refused, PHONE_MESSAGE, '4e envoi du jour');
            assert.equal(await ticketCount(a), 4, 'quatre billets du premier envoi seulement');
            assert.equal(await smsCount(phone), 3, 'trois SMS, un par envoi accepté');
        });
    });
});

// ── Tout ou rien ───────────────────────────────────────────────────────────

describe('9.0 Quotas : tout ou rien, ordre de réservation (L4, 5.1 étape 7)', () => {
    test('un numéro au plafond dans l’envoi : refus entier, rien pour les autres numéros, leur quota intact', async () => {
        await withEnv({ INVITATION_PER_PHONE_DAY: '1' }, async () => {
            const ev = await newEvent('tout-ou-rien');
            const [used, fresh] = phones(2);
            const win = await alignQuotaWindow(86_400, 30_000);
            await sendOk(partner, ev, [used]);
            const refused = await send(partner, ev, [fresh, used]);
            assertQuota(refused, PHONE_MESSAGE, 'envoi avec un numéro au plafond');
            assert.equal(await ticketCount(ev), 1, 'aucun billet de l’envoi refusé');
            assert.equal((await categoryState(ev.categories[STANDARD].id)).sold, 1, 'stock inchangé');
            assert.equal(await smsCount(fresh), 0, 'aucun SMS à l’autre numéro');
            await sendOk(partner, ev, [fresh]);
            await assertSameQuotaWindow(win, 'tout ou rien');
            assert.equal(await smsCount(fresh), 1, 'quota de l’autre numéro non consommé');
        });
    });

    test('une règle par numéro : 3 numéros sur une limite de 2 refusés en bloc, puis 2 acceptés', async () => {
        await withEnv({ INVITATION_PER_EVENT_HOUR: '2' }, async () => {
            const ev = await newEvent('env-heure');
            const [a, b, c] = phones(3);
            const win = await alignQuotaWindow(3600, 15_000);
            assertQuota(await send(partner, ev, [a, b, c]), EVENT_MESSAGE, 'trois numéros pour une limite de 2');
            assert.equal(await ticketCount(ev), 0, 'envoi refusé en bloc');
            await sendOk(partner, ev, [a, b]);
            assertQuota(await send(partner, ev, [c]), EVENT_MESSAGE, 'troisième numéro de l’heure');
            await assertSameQuotaWindow(win, 'limite par événement');
            assert.equal(await ticketCount(ev), 2, 'deux billets');
        });
    });

    test('un refus de stock ne consomme aucun quota', async () => {
        await withEnv({ INVITATION_PER_PHONE_DAY: '1' }, async () => {
            const ev = await newEvent('stock', 1);
            const spare = await newEvent('stock-b');
            const phone = randomSenegalPhone('76');
            const win = await alignQuotaWindow(86_400, 30_000);
            const refused = await send(partner, ev, [phone], 2);
            assert.equal(refused.status, 409, showSend(refused));
            assert.equal(refused.body.code, 'SALE_CHECK_FAILED', showSend(refused));
            await sendOk(partner, ev, [phone], 1);
            assertQuota(await send(partner, spare, [phone]), PHONE_MESSAGE, 'plafond effectivement atteint après l’envoi accepté');
            await assertSameQuotaWindow(win, 'refus de stock');
            assert.equal(await smsCount(phone), 1, 'un seul SMS');
        });
    });

    test('un tiers ne consomme pas le quota de l’événement', async () => {
        await withEnv({ INVITATION_PER_EVENT_HOUR: '1' }, async () => {
            const ev = await newEvent('tiers');
            const other = await newPartner('invitations-quotas-tiers');
            const win = await alignQuotaWindow(3600, 15_000);
            for (let i = 0; i < 3; i += 1) {
                const r = await send(other, ev, [randomSenegalPhone('76')]);
                assert.equal(r.status, 404, showSend(r));
                assert.equal(r.body.code, 'EVENT_NOT_FOUND', showSend(r));
            }
            await sendOk(partner, ev, [randomSenegalPhone('76')]);
            assertQuota(await send(partner, ev, [randomSenegalPhone('76')]), EVENT_MESSAGE, 'limite atteinte par le propriétaire seul');
            await assertSameQuotaWindow(win, 'tiers sans effet');
        });
    });
});
