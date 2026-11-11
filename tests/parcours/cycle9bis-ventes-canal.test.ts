/**
 * Lot 9 bis, tâche 28 (R50 ; contrat 5.28, 4.3, B66) — ventes par canal dans le pilotage : `pilotage_sales` sert
 * `by_channel` calculé par le serveur, quatre lignes dans l'ordre : En ligne (ONLINE), En ligne, gratuits
 * (ONLINE_FREE), Au guichet (COUNTER), Invitations (INVITATION), chacune `{ channel, label, tickets, amount }`, mêmes
 * filtres que les catégories (VALIDE, UTILISE) ; la somme des canaux égale les billets du pilotage.
 * Scène : un achat en ligne à 5 000 F, une vente au guichet à 5 000 F (caisse ouverte avec le PIN, aide openShift),
 * une invitation.
 * Rouge avant correctif : `by_channel` absent de pilotage_sales (M/20261106000001:1187-1278) ; SalesTab sans tableau
 * « Par canal » (`components/partner/pilotage/SalesTab.tsx:16-37`).
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift } from './acces-helpers';
import { invoke, pilotageOk, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const PRICE = 5_000;
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: PRICE, total: 30 }];
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';
const SALES_TAB = path.join('components', 'partner', 'pilotage', 'SalesTab.tsx');

let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    partner = await newPartner('ventes-canal');
    ev = await createTimedEvent(partner.partnerId, 'ventes-canal', CATEGORIES, { startsInHours: 1 });

    const buyer = await newBuyer('ventes-canal');
    await buyConfirmed(buyer, ev, [['Standard', 1]]);

    const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'ventes-canal' });
    const opened = await openShift(seller, ev.eventId);
    assert.equal(opened.status, 200, `caisse ouverte (PIN passé par l'aide) : ${show(opened)}`);
    const handler = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    const sale = await invoke(handler, authed('/api/controller/counter-sale', 'POST', seller,
        { eventId: ev.eventId, items: [{ categoryId: ev.categories.Standard.id, quantity: 1 }] }, { 'idempotency-key': randomUUID() }));
    assert.equal(sale.status, 200, `vente au guichet : ${show(sale)}`);

    const { data, error } = await service.rpc('ticket_invitation_create', {
        p: { actor_id: partner.userId, event_id: ev.eventId, category_id: ev.categories.Standard.id, phones: [randomSenegalPhone('76')], quantity: 1, limits: { per_event_hour: 50, per_phone_day: 3 } },
    });
    assert.equal(error, null, `ticket_invitation_create : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `invitation : ${JSON.stringify(data)}`);
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-ventes-canal');
});

describe('R50 — ventes par canal calculées par le serveur', () => {
    test('by_channel : En ligne 1, En ligne gratuits 0, Au guichet 1 (5 000 F), Invitations 1 (0 F) ; somme = billets du pilotage', async () => {
        const body = await pilotageOk(partner, ev.eventId, 'sales', 'propriétaire');
        assert.ok(Array.isArray(body.by_channel), `by_channel servi par pilotage_sales (aujourd’hui absent) : ${JSON.stringify(body).slice(0, 400)}`);
        const rows = body.by_channel as Row[];
        assert.deepEqual(rows.map((r) => [r.channel, r.label, Number(r.tickets)]), [
            ['ONLINE', 'En ligne', 1],
            ['ONLINE_FREE', 'En ligne, gratuits', 0],
            ['COUNTER', 'Au guichet', 1],
            ['INVITATION', 'Invitations', 1],
        ], `canaux, libellés et billets : ${JSON.stringify(rows)}`);
        const byCategory = (body.by_category ?? []) as Row[];
        const online = rows[0];
        const revenueOnline = byCategory.reduce((sum, c) => sum + Number(c.revenue_online ?? 0), 0);
        assert.equal(Number(online.amount), revenueOnline, `montant en ligne = recette en ligne des catégories : ${JSON.stringify(online)}`);
        assert.ok(Number(online.amount) >= PRICE, `montant en ligne d’au moins le prix du billet : ${JSON.stringify(online)}`);
        assert.equal(Number(rows[1].amount), 0, 'gratuits : 0 F');
        assert.equal(Number(rows[2].amount), PRICE, `guichet : ${PRICE} F encaissés`);
        assert.equal(Number(rows[3].amount), 0, 'invitations : 0 F');
        const channelTotal = rows.reduce((sum, r) => sum + Number(r.tickets), 0);
        const categoryTotal = byCategory.reduce((sum, c) => sum + Number(c.sold ?? 0) + Number(c.invitations ?? 0), 0);
        assert.equal(channelTotal, categoryTotal, `somme des canaux (${channelTotal}) = billets du pilotage par catégorie (${categoryTotal})`);
    });

    test('statique : SalesTab affiche un tableau « Par canal » à partir de by_channel', () => {
        assert.ok(fs.existsSync(SALES_TAB), `${SALES_TAB} absent`);
        const src = fs.readFileSync(SALES_TAB, 'utf8');
        assert.match(src, /Par canal/, 'titre « Par canal »');
        assert.match(src, /\bby_channel\b/, 'tableau alimenté par by_channel (aucun chiffre calculé dans le navigateur)');
    });
});
