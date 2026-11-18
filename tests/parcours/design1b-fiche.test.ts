/**
 * Design 1b (points 1, 6, 7, 11) — fiche publique d'un événement et bandeau de paiement en attente, AVEC la base locale.
 *
 *  1. GET /api/events/[id] (source unique, lib/events/event-detail.server.ts, aussi lue par la page en cache) :
 *     - `scanColor` servi pour chaque catégorie vendue en ligne (couleur du contrôle) ;
 *     - `counterSale` : vrai seulement s'il existe une catégorie active vendue au guichet avec des places ; la réponse ne
 *       contient AUCUNE donnée de caisse (ni nom, ni prix, ni identifiant d'une catégorie vendue seulement au guichet,
 *       ni sale_counter, ni quantités brutes) ;
 *     - vente en ligne close (fin de vente passée) → purchasable faux, catégorie non disponible ;
 *     - `refund` : null pour un événement publié ordinaire ; ANNULATION pour un annulé ; REPORT pour un début repoussé de
 *       plus de 24 h (event_start_changes), jamais pour un report de moins de 24 h ;
 *     - 404 conservé pour un événement non public (brouillon), à la route ET à la lecture de la page (readPublicSheet).
 *  2. Bandeau : GET /api/checkout/pending montre un paiement exactement quand le serveur refuse un second paiement
 *     (409 PAYMENT_PENDING, même identifiant) ; après « Annuler ce paiement » (route existante), plus de bandeau et un
 *     nouvel achat est accepté.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL, routeContext } from './helpers';
import { cart, checkout, createSaleEvent, importModule, newBuyer, providerSays, service, type SaleEvent } from './paiement-helpers';
import { createEventInStatus } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;
interface Result { status: number; body: Row }

const HOUR = 3600_000;
let partner: TestPartner;

before(async () => {
    partner = await newPartner('design1b-fiche');
});

after(async () => {
    await assertTerrainInvariants('design1b-fiche');
});

async function asResult(res: Response): Promise<Result> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

async function sheet(eventId: string): Promise<Result> {
    const mod = await importModule('../../app/api/events/[id]/route');
    const params = { id: eventId };
    const res = await mod.GET(new NextRequest(`${BASE_URL}/api/events/${eventId}`), { params: Object.assign(Promise.resolve(params), params) });
    return asResult(res);
}

function brief(r: Result): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

function categoriesOf(r: Result): Row[] {
    const event = r.body.event as Row | undefined;
    return (event?.categories as Row[] | undefined) ?? [];
}

describe('1. fiche publique : couleur, guichet, vente close, remboursement, 404', () => {
    test('scanColor servi pour chaque catégorie en ligne ; guichet signalé par un booléen, sans donnée de caisse', async () => {
        const ev = await createSaleEvent('d1b-couleur', [
            { name: 'Standard', price: 3_000, total: 50 },
            { name: 'Guichet seul', price: 4_500, total: 30 },
        ]);
        const { error: e1 } = await service.from('ticket_categories').update({ scan_color: 'ROSE' }).eq('id', ev.categories.Standard.id);
        assert.equal(e1, null, `couleur : ${e1?.message}`);
        const { error: e2 } = await service.from('ticket_categories').update({ sale_online: false, sale_counter: true }).eq('id', ev.categories['Guichet seul'].id);
        assert.equal(e2, null, `catégorie guichet : ${e2?.message}`);

        const r = await sheet(ev.eventId);
        assert.equal(r.status, 200, brief(r));
        const cats = categoriesOf(r);
        assert.deepEqual(cats.map((c) => c.name), ['Standard'], `seules les catégories vendues en ligne sont servies : ${brief(r)}`);
        assert.equal(cats[0].scanColor, 'ROSE', `couleur du contrôle servie : ${brief(r)}`);
        const event = r.body.event as Row;
        assert.equal(event.counterSale, true, `guichet sur place signalé : ${brief(r)}`);
        const dump = JSON.stringify(r.body);
        assert.ok(!dump.includes('Guichet seul'), 'le nom d’une catégorie vendue seulement au guichet ne sort pas');
        assert.ok(!dump.includes(ev.categories['Guichet seul'].id), 'l’identifiant d’une catégorie de guichet ne sort pas');
        assert.ok(!/sale_counter|saleCounter|sold_quantity|held_quantity|total_quantity|cash|especes/i.test(dump), `aucune donnée de caisse ni quantité brute : ${dump.slice(0, 400)}`);
    });

    test('aucune catégorie au guichet (ou plus de places) → counterSale faux', async () => {
        const ev = await createSaleEvent('d1b-sans-guichet', [{ name: 'Standard', price: 3_000, total: 20 }]);
        const { error } = await service.from('ticket_categories').update({ sale_counter: false }).eq('id', ev.categories.Standard.id);
        assert.equal(error, null, error?.message);
        const r = await sheet(ev.eventId);
        assert.equal(r.status, 200, brief(r));
        assert.equal((r.body.event as Row).counterSale, false, brief(r));
    });

    test('vente en ligne close → purchasable faux ; le guichet reste signalé s’il a des places', async () => {
        const ev = await createSaleEvent('d1b-vente-close', [{ name: 'Standard', price: 3_000, total: 20 }]);
        const { error } = await service.from('ticket_categories')
            .update({ sale_start: new Date(Date.now() - 48 * HOUR).toISOString(), sale_end: new Date(Date.now() - HOUR).toISOString() })
            .eq('id', ev.categories.Standard.id);
        assert.equal(error, null, error?.message);
        const r = await sheet(ev.eventId);
        assert.equal(r.status, 200, brief(r));
        const event = r.body.event as Row;
        assert.equal(event.purchasable, false, `vente close : ${brief(r)}`);
        assert.equal(event.salesEnded, true, brief(r));
        assert.equal(categoriesOf(r)[0].isAvailable, false, brief(r));
        assert.equal(event.counterSale, true, `catégorie vendue aussi au guichet (défaut) avec des places : ${brief(r)}`);
    });

    test('remboursement : rien pour un publié ordinaire ; REPORT après un report de plus de 24 h, rien pour moins de 24 h', async () => {
        const ev: SaleEvent = await createSaleEvent('d1b-report', [{ name: 'Standard', price: 3_000, total: 20 }]);
        const plain = await sheet(ev.eventId);
        assert.equal(plain.status, 200, brief(plain));
        assert.equal((plain.body.event as Row).refund, null, `aucune règle de remboursement pour un événement ordinaire : ${brief(plain)}`);

        const startsAt = Date.parse(String((plain.body.event as Row).startsAt));
        assert.ok(Number.isFinite(startsAt), `startsAt servi : ${brief(plain)}`);
        const small = await service.from('event_start_changes').insert({ event_id: ev.eventId, old_start_at: new Date(startsAt - 2 * HOUR).toISOString(), new_start_at: new Date(startsAt).toISOString() });
        assert.equal(small.error, null, small.error?.message);
        const afterSmall = await sheet(ev.eventId);
        assert.equal((afterSmall.body.event as Row).refund, null, `report de 2 h : aucune ligne : ${brief(afterSmall)}`);

        const big = await service.from('event_start_changes').insert({ event_id: ev.eventId, old_start_at: new Date(startsAt - 48 * HOUR).toISOString(), new_start_at: new Date(startsAt).toISOString() });
        assert.equal(big.error, null, big.error?.message);
        const afterBig = await sheet(ev.eventId);
        const refund = (afterBig.body.event as Row).refund as Row | null;
        assert.equal(refund?.kind, 'REPORT', `report de 48 h : règle du report : ${brief(afterBig)}`);
        assert.match(String(refund?.text), /Mes billets/, 'la demande se fait dans Mes billets');
        assert.ok(!JSON.stringify(afterBig.body).includes('actor_id'), 'l’auteur du report ne sort pas');
    });

    test('annulé → règle de l’annulation ; brouillon → 404 à la route et à la lecture de la page', async () => {
        const cancelled = await createEventInStatus(partner, 'd1b-annule', [{ name: 'Standard', price: 3_000, total: 20 }], 'ANNULE', { cancelFrom: 'PUBLIE' });
        const r = await sheet(cancelled.eventId);
        assert.equal(r.status, 200, brief(r));
        assert.equal(((r.body.event as Row).refund as Row | null)?.kind, 'ANNULATION', brief(r));
        assert.equal((r.body.event as Row).purchasable, false, brief(r));
        assert.equal((r.body.event as Row).counterSale, false, `événement annulé : aucun guichet : ${brief(r)}`);

        const draft = await createEventInStatus(partner, 'd1b-brouillon', [{ name: 'Standard', price: 3_000, total: 20 }], 'BROUILLON');
        const notFound = await sheet(draft.eventId);
        assert.equal(notFound.status, 404, brief(notFound));
        const { readPublicSheet } = await importModule('../../lib/events/event-detail.server');
        const read = await readPublicSheet(draft.eventId);
        assert.equal(read.kind, 'not-public', `lecture de la page : ${JSON.stringify(read).slice(0, 200)}`);
        assert.ok(!JSON.stringify(read).includes('TEST'), 'rien de l’événement non public ne sort');
    });
});

describe('2. bandeau de paiement en attente : même condition que le refus du serveur', () => {
    async function pendingOf(token: string, eventId: string): Promise<Result> {
        const mod = await importModule('../../app/api/checkout/pending/route');
        return asResult(await mod.GET(new NextRequest(`${BASE_URL}/api/checkout/pending?eventId=${eventId}`, { headers: { authorization: `Bearer ${token}` } })));
    }

    async function cancel(token: string, paymentId: string): Promise<Result> {
        const mod = await importModule('../../app/api/payments/[transactionId]/cancel/route');
        const req = new NextRequest(`${BASE_URL}/api/payments/${paymentId}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
        return asResult(await mod.POST(req, routeContext({ transactionId: paymentId })));
    }

    test('bandeau ⇔ 409 PAYMENT_PENDING ; « Annuler ce paiement » → plus de bandeau, nouvel achat accepté', async () => {
        const ev = await createSaleEvent('d1b-bandeau', [{ name: 'Standard', price: 3_000, total: 30 }]);
        const buyer = await newBuyer('d1b-bandeau');

        const none = await pendingOf(buyer.accessToken, ev.eventId);
        assert.equal(none.status, 200, brief(none));
        assert.equal(none.body.pending, null, 'aucun paiement : pas de bandeau');

        const first = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(first.status, 200, `premier paiement : HTTP ${first.status} ${JSON.stringify(first.body)}`);
        assert.ok(first.payment, 'paiement créé');

        const shown = await pendingOf(buyer.accessToken, ev.eventId);
        assert.equal((shown.body.pending as Row | null)?.payment_id, first.payment!.id, `bandeau du premier paiement : ${brief(shown)}`);

        const second = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer, 'ORANGE_MONEY'));
        assert.equal(second.status, 409, `second paiement refusé : HTTP ${second.status} ${JSON.stringify(second.body)}`);
        assert.equal(second.body.code, 'PAYMENT_PENDING');
        assert.equal(second.body.payment_id, first.payment!.id, 'le serveur bloque sur le paiement que montre le bandeau');

        providerSays(first.payment!, 'PENDING');
        const cancelled = await cancel(buyer.accessToken, first.payment!.id);
        assert.equal(cancelled.status, 200, `annulation : ${brief(cancelled)}`);
        assert.equal(cancelled.body.status, 'CANCELLED', brief(cancelled));

        const gone = await pendingOf(buyer.accessToken, ev.eventId);
        assert.equal(gone.body.pending, null, `plus de bandeau après l’annulation : ${brief(gone)}`);
        const third = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(third.status, 200, `nouvel achat accepté : HTTP ${third.status} ${JSON.stringify(third.body)}`);
        providerSays(third.payment!, 'PENDING');
        const cleanup = await cancel(buyer.accessToken, third.payment!.id);
        assert.equal(cleanup.status, 200, `nettoyage : ${brief(cleanup)}`);
    });
});
