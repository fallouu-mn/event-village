/**
 * Lot 2.8 — route d'émission par le staff (payment-security-15).
 * /api/events/[id]/tickets/purchase n'a aucun appelant dans l'interface (grep au rapport) : elle est
 * désactivée (410) et n'émet plus aucun billet, quel que soit le rôle. Le guichet complet sera revu
 * au lot 4.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as purchase } from '../../app/api/events/[id]/tickets/purchase/route';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { BASE_URL, routeContext } from './helpers';
import { createSaleEvent, eventTickets, SaleEvent } from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('guichet', [{ name: 'Standard', price: 5000, total: 10 }, { name: 'Gratuite', price: 0, total: 10 }]);
});

after(async () => {
    await assertPaymentInvariants('paiement-guichet');
});

describe('Route d’émission par le staff', () => {
    for (const role of ['SUPERADMIN', 'CONTROLLER_A', 'PARTNER_A', 'CLIENT'] as const) {
        test(`${role} : 410, aucun billet émis (payant ou gratuit)`, async () => {
            const s = await signInAs(role);
            for (const cat of [ev.categories.Standard.id, ev.categories.Gratuite.id]) {
                const res = await purchase(
                    new NextRequest(`${BASE_URL}/api/events/${ev.eventId}/tickets/purchase`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(s.accessToken) }, body: JSON.stringify({ categoryId: cat }) }),
                    routeContext({ id: ev.eventId }) as never,
                );
                assert.equal(res.status, 410, `${role} : HTTP ${res.status}`);
            }
            assert.equal((await eventTickets(ev.eventId)).length, 0);
        });
    }
});
