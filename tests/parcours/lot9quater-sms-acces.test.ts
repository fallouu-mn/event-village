/**
 * Lot 9 quater — coût des SMS et contrôle d'accès (D1 : AUD-18 ; D2 : AUD-32 ; E1 : AUD-13 ; E2 : AUD-14). D3 (AUD-26,
 * adresses web et numéros refusés) : tests/schema/lot9quater-coordonnees.test.ts. Base LOCALE, faux MTarget.
 * Rouge avant correctif : aucune limite de transferts ni d'invitations par compte, invitation sans nom trouvée par les
 * 4 derniers chiffres, contrôle de zone repassé sans avertissement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, newController, scansOf, ticketPayload, type RouteResult } from './acces-helpers';
import { withEnv } from './notif-helpers';
import { assignGate, createZonedEvent, gateOf, guestSearch, scanAtGate, sendInvitations, type ZonedEvent } from './zones-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const VIP = 'VIP';
const SIMPLE = 'Simple';
let partner: TestPartner;
let ev: ZonedEvent;

before(async () => {
    partner = await newPartner('q-de');
    ev = await createZonedEvent(partner, 'q de', [
        { name: SIMPLE, price: 1_000, total: 50 },
        { name: VIP, price: 5_000, total: 50 },
    ], [
        { name: 'Entrée', kind: 'ENTREE', admits: [SIMPLE, VIP], gates: ['Porte Nord'] },
        { name: 'Carré VIP', kind: 'CONTROLE', admits: [VIP], gates: ['Accès carré'] },
    ]);
});

after(async () => {
    await assertLot9quaterInvariants('lot9quater-sms-acces');
});

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

async function transfer(owner: Buyer, ticketId: string, to: string): Promise<RouteResult> {
    const mod = await importModule('../../app/api/tickets/[id]/transfer/route') as { POST: Handler };
    const res = await mod.POST(authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: to }), routeContext({ id: ticketId }));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

async function controllerAt(gateName: string, label: string): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { label });
    const res = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, gateName));
    assert.equal(res.status, 200, show(res));
    return ctrl;
}

// ── D1 ─────────────────────────────────────────────────────────────────────

describe('D1 — transferts offerts par billet et par compte', () => {
    test('au-delà de la limite par billet puis par compte : 429 TRANSFER_RATE_LIMITED, aucun SMS ; une offre refusée rend ses unités', async () => {
        const owner = await newBuyer('q-d1');
        const intruder = await newBuyer('q-d1-intrus');
        await confirmPassword(owner, STRONG_PASSWORD);
        await confirmPassword(intruder, STRONG_PASSWORD);
        const tickets = (await buyConfirmed(owner, ev, [[SIMPLE, 2]])).tickets.map((t) => String(t.id));
        const outcome = await withEnv({ TRANSFER_PER_TICKET_DAY: '1', TRANSFER_PER_ACCOUNT_DAY: '1' }, async () => {
            const stolen = await transfer(intruder, tickets[0], randomSenegalPhone('76'));
            const first = await transfer(owner, tickets[0], randomSenegalPhone('76'));
            const sameTicket = await transfer(owner, tickets[0], randomSenegalPhone('76'));
            const otherTicket = await transfer(owner, tickets[1], randomSenegalPhone('76'));
            return { stolen, first, sameTicket, otherTicket };
        });
        console.log(`[D1] ${JSON.stringify(Object.fromEntries(Object.entries(outcome).map(([k, r]) => [k, `${r.status} ${String(r.body.code ?? '')}`])))}`);
        assert.notEqual(outcome.stolen.status, 200, 'offre d’un billet d’autrui refusée');
        assert.equal(outcome.first.status, 200, `première offre : unités rendues après le refus de l’intrus : ${show(outcome.first)}`);
        for (const r of [outcome.sameTicket, outcome.otherTicket]) {
            assert.equal(r.status, 429, show(r));
            assert.equal(r.body.code, 'TRANSFER_RATE_LIMITED');
        }
    });
});

// ── D2 ─────────────────────────────────────────────────────────────────────

describe('D2 — numéros invités par compte et par jour', () => {
    test('au-delà de la limite du compte : refus, aucun billet ni SMS', async () => {
        const result = await withEnv({ INVITATION_PER_ACCOUNT_DAY: '2' }, async () => {
            const ok = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[SIMPLE].id, phones: [randomSenegalPhone('77'), randomSenegalPhone('77')], quantity: 1 });
            const over = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[SIMPLE].id, phones: [randomSenegalPhone('77')], quantity: 1 });
            return { ok, over };
        });
        console.log(`[D2] ${show(result.ok)} ; ${show(result.over)}`);
        assert.equal(result.ok.status, 200, show(result.ok));
        assert.equal(result.over.status, 429, show(result.over));
        assert.match(String(result.over.body.error), /pour votre compte aujourd'hui/);
    });
});

// ── E1 ─────────────────────────────────────────────────────────────────────

describe('E1 — invitation sans nom : numéro complet exigé', () => {
    test('4 derniers chiffres : seules les invitations nommées ; numéro complet : l’invitation sans nom', async () => {
        const unnamed = randomSenegalPhone('77');
        const named = randomSenegalPhone('78');
        assert.equal((await sendInvitations(partner, ev.eventId, { category_id: ev.categories[SIMPLE].id, phones: [unnamed], quantity: 1 })).status, 200);
        assert.equal((await sendInvitations(partner, ev.eventId, { category_id: ev.categories[SIMPLE].id, phones: [named], quantity: 1, guest_names: ['Awa Diop'] })).status, 200);
        const ctrl = await controllerAt('Porte Nord', 'q-e1');
        const byLast4 = await guestSearch(ctrl, ev.eventId, unnamed.slice(-4));
        const byFull = await guestSearch(ctrl, ev.eventId, unnamed.slice(4));
        const namedLast4 = await guestSearch(ctrl, ev.eventId, named.slice(-4));
        console.log(`[E1] sans nom, 4 chiffres : ${show(byLast4)} ; complet : ${show(byFull)} ; nommée, 4 chiffres : ${show(namedLast4)}`);
        assert.deepEqual((byLast4.body.items as unknown[]) ?? [], [], 'aucune invitation sans nom par les 4 derniers chiffres');
        assert.equal(((byFull.body.items as unknown[]) ?? []).length, 1, 'trouvée par le numéro complet');
        assert.ok(((namedLast4.body.items as Array<{ guest_name?: string }>) ?? []).some((i) => i.guest_name === 'Awa Diop'), 'invitation nommée trouvée par 4 chiffres');
    });
});

// ── E2 ─────────────────────────────────────────────────────────────────────

describe('E2 — contrôle de zone repassé', () => {
    test('« Déjà passé à Carré VIP à HH:MM » sans ligne ; confirmé : passage compté, visible dans l’onglet Entrées', async () => {
        const buyer = await newBuyer('q-e2');
        const ticketId = String((await buyConfirmed(buyer, ev, [[VIP, 1]])).tickets[0].id);
        const nord = await controllerAt('Porte Nord', 'q-e2-nord');
        const carre = await controllerAt('Accès carré', 'q-e2-carre');
        const body = async () => ({ eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal((await scanAtGate(nord, await body(), gateOf(ev, 'Porte Nord'))).body.result, 'valid');
        assert.equal((await scanAtGate(carre, await body(), gateOf(ev, 'Accès carré'))).body.result, 'zone_ok');
        const again = await scanAtGate(carre, await body(), gateOf(ev, 'Accès carré'));
        console.log(`[E2] second passage : ${show(again)}`);
        assert.equal(again.body.result, 'zone_already_passed', show(again));
        assert.match(String(again.body.message), /^Déjà passé à Carré VIP à \d{2}:\d{2}$/);
        const zoneRows = async () => (await scansOf(ticketId)).filter((s) => s.zone_result === 'zone_ok').length;
        assert.equal(await zoneRows(), 1, 'aucune ligne écrite sans confirmation');
        const confirmed = await scanAtGate(carre, { ...(await body()), confirmZoneRepeat: true }, gateOf(ev, 'Accès carré'));
        assert.equal(confirmed.body.result, 'zone_ok', show(confirmed));
        assert.equal(await zoneRows(), 2, 'nouveau passage compté');
        const entries = await inspect(async (c) => (await c.query<{ r: Record<string, unknown> }>(
            'SELECT public.pilotage_compute_entries($1, false) AS r', [ev.eventId])).rows[0].r);
        const zones = ((entries as { by_zone?: Array<Record<string, unknown>> }).by_zone ?? []);
        const carreRow = zones.find((z) => z.name === 'Carré VIP');
        assert.ok(carreRow, `zone dans l’onglet Entrées : ${JSON.stringify(entries).slice(0, 300)}`);
        assert.ok(Number(carreRow!.repeats) >= 1, `passages répétés comptés : ${JSON.stringify(carreRow)}`);
    });
});

void service;
