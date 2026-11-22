/**
 * Finition 5 (point 2) — pages d'arrivée des avis : session et propriété exigées, même 404 sans indice.
 *
 * Routes lues par les pages d'arrivée : GET /api/tickets/<billet> (page /tickets/<billet>) et
 * GET /api/finance/withdrawals/<envoi> (pages /partner/finance/retraits/<envoi> et /wallet/retraits/<envoi>).
 *  1. billet : son propriétaire le lit (200) ; un autre compte, un identifiant deviné ou mal formé reçoivent EXACTEMENT
 *     la même réponse 404 « Cet élément n'est plus disponible » (même corps, aucun indice) ; sans session : 401 ;
 *  2. retrait : la partenaire lit son retrait par l'envoi que portent les avis WITHDRAWAL_* ; un autre compte, un envoi
 *     deviné ou mal formé : même 404 ; sans session : 401.
 * Montage : partenaire neuve, deux billets vendus à une cliente (paiement confirmé), retrait demandé par withdrawal_request
 * (non envoyé). Fin de suite : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as ticketRoute } from '../../app/api/tickets/[id]/route';
import { GET as withdrawalRoute } from '../../app/api/finance/withdrawals/[id]/route';
import { UNAVAILABLE_BODY } from '../../lib/tickets/focus';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { authed } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { BASE_URL } from './helpers';

type Row = Record<string, unknown>;
const WITHDRAWAL_RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function result(res: Response): Promise<{ status: number; body: Row }> {
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Row : {} };
}

let partner: TestPartner;
let owner: Buyer;
let stranger: Buyer;
let ticketId: string;
let cashoutId: string;

before(async () => {
    partner = await newPartner('f5-arrivee');
    const ev = await createPartnerEvent(partner.partnerId, 'F5 pages d’arrivée', [{ name: 'Standard', price: 5_000, total: 10 }]);
    owner = await newBuyer('f5-arrivee-a');
    stranger = await newBuyer('f5-arrivee-b');
    await withSettings({ 'finance.payout_hold_enabled': false }, async () => buyConfirmed(owner, ev, [['Standard', 2]]));
    const { data: tickets, error } = await service.from('tickets').select('id').eq('user_id', owner.userId).eq('event_id', ev.eventId);
    assert.equal(error, null, `billets de la cliente : ${error?.message}`);
    assert.equal((tickets ?? []).length, 2, 'deux billets vendus');
    ticketId = String(tickets![0].id);
    const out = await withSettings(WITHDRAWAL_RULES, async () => {
        const { data, error: wErr } = await service.rpc('withdrawal_request', {
            p: { user_id: partner.userId, account_kind: 'ORGANISATEUR', gross_amount: 10_000, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: partner.phone9, client_key: randomUUID() },
        });
        assert.equal(wErr, null, `withdrawal_request : ${wErr?.message}`);
        return (data ?? {}) as Row;
    });
    assert.equal(out.ok, true, `retrait refusé : ${JSON.stringify(out)}`);
    cashoutId = String(out.cashout_id);
});

after(async () => {
    await assertLot9terInvariants('f5-pages-arrivee');
});

describe('finition 5 — billet : propriétaire seulement, même 404 sans indice', () => {
    test('propriétaire : 200, le billet demandé', async () => {
        const r = await result(await ticketRoute(authed(`/api/tickets/${ticketId}`, 'GET', owner), ctx(ticketId)));
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
        assert.equal((r.body.ticket as Row | undefined)?.id, ticketId);
    });

    test('autre compte, identifiant deviné, identifiant mal formé : exactement la même réponse 404', async () => {
        const seen: Array<{ status: number; body: Row }> = [];
        for (const [who, id] of [[stranger, ticketId], [owner, randomUUID()], [owner, 'abc'], [owner, `${ticketId}'--`]] as Array<[Buyer, string]>) {
            const r = await result(await ticketRoute(authed(`/api/tickets/${encodeURIComponent(id)}`, 'GET', who), ctx(id)));
            seen.push(r);
        }
        for (const r of seen) assert.deepEqual(r, { status: 404, body: { ...UNAVAILABLE_BODY } }, 'même statut, même corps');
    });

    test('sans session : 401 (la page renvoie vers la connexion)', async () => {
        const r = await ticketRoute(new NextRequest(`${BASE_URL}/api/tickets/${ticketId}`), ctx(ticketId));
        assert.equal(r.status, 401);
    });
});

describe('finition 5 — retrait : propriétaire seulement, même 404 sans indice', () => {
    test('partenaire : 200, son retrait retrouvé par l’envoi des avis', async () => {
        const r = await result(await withdrawalRoute(authed(`/api/finance/withdrawals/${cashoutId}`, 'GET', partner), ctx(cashoutId)));
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
        const w = r.body.withdrawal as Row;
        assert.deepEqual({ kind: w.account_kind, gross: Number(w.gross_amount) }, { kind: 'ORGANISATEUR', gross: 10_000 });
        assert.ok(!('user_id' in w) && !('cashout_id' in w), 'aucune donnée d’un autre usage renvoyée');
    });

    test('autre compte, envoi deviné ou mal formé : exactement la même réponse 404', async () => {
        for (const [who, id] of [[owner, cashoutId], [stranger, cashoutId], [partner, randomUUID()], [partner, 'nimporte']] as Array<[Buyer, string]>) {
            const r = await result(await withdrawalRoute(authed(`/api/finance/withdrawals/${encodeURIComponent(id)}`, 'GET', who), ctx(id)));
            assert.deepEqual(r, { status: 404, body: { ...UNAVAILABLE_BODY } }, `${who === partner ? 'partenaire' : 'autre compte'}, ${id}`);
        }
    });

    test('sans session : 401', async () => {
        const r = await withdrawalRoute(new NextRequest(`${BASE_URL}/api/finance/withdrawals/${cashoutId}`), ctx(cashoutId));
        assert.equal(r.status, 401);
    });
});
