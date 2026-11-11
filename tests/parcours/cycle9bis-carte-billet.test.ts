/**
 * Lot 9 bis, tâche 24 (R25, R66 ; contrat 5.24, 4.3, B58) — carte du billet : GET /api/tickets sert le prix, les frais
 * de service, le canal, l'état de l'événement et ce que la carte peut montrer (`codeVisible`, `transferAllowed`,
 * `eventNotice`), calculés par le serveur (`ticket_card_states`) ; live-code refuse un événement suspendu ou annulé.
 *  1. Événement SUSPENDU : `codeVisible = false`, `eventStatus = 'SUSPENDU'`, `eventNotice` au texte du contrat ;
 *     live-code 409 EVENT_SUSPENDED.
 *  2. TERMINE hors de la fenêtre de contrôle : QR et transfert masqués ; TERMINE dans la fenêtre : QR visible,
 *     transfert masqué.
 *  3. Billet payé 5 000 F : `price = 5000`, `serviceFee` = frais du billet (> 0) ; invitation : `saleChannel =
 *     'INVITATION'`, prix 0.
 *  4. Statique : TicketCard conditionne le QR à `codeVisible` et « Transférer » à `transferAllowed`, affiche « Frais de
 *     service » et le message `eventNotice`.
 * Rouge avant correctif : /api/tickets ne lit ni le statut de l'événement ni service_fee, ne renvoie pas le prix
 * (`app/api/tickets/route.ts:39-51`, `:130-148`) ; live-code ne contrôle que le statut du billet (`:42-45`) ; la carte
 * montre le QR de tout billet VALIDE (`TicketCard.tsx:208-212`).
 * Fuseau : Africa/Dakar = UTC+0. Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { liveCode, withAccessSettings } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcTransition, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 20 }, { name: 'Gratuit', price: 0, total: 20 }];
const WINDOW = { 'access.scan_window_before_hours': 6, 'access.scan_window_after_hours': 6 } as const;
const TICKETS_ROUTE = '../../app/api/tickets/route';
const TICKET_CARD = path.join('components', 'tickets', 'TicketCard.tsx');
const SUSPENDED_NOTICE = 'Événement suspendu : l’entrée n’est pas possible pour le moment.';

let partner: TestPartner;
let superId: string;

before(async () => {
    partner = await newPartner('carte-billet');
    superId = await superadminId();
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-carte-billet');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function publishedEvent(label: string, startsInHours = 1): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, CATEGORIES, { startsInHours, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

/** Événement TERMINE dont la fin est passée de `endedHoursAgo` heures (début passé exigé par la fin manuelle). */
async function finishedEvent(label: string, endedHoursAgo: number, holder: Buyer): Promise<{ ev: DraftEvent; ticketId: string }> {
    const ev = await publishedEvent(label, 48);
    const ticketId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, holder);
    await shiftEventDates(ev.eventId, { startsInHours: -(endedHoursAgo + 2), durationHours: 2 });
    assertRpcOk(await rpcTransition(ev.eventId, superId, 'TERMINE'), `fin manuelle de ${label}`);
    return { ev, ticketId };
}

async function card(user: Buyer, ticketId: string): Promise<Row> {
    const handler = await routeHandler(TICKETS_ROUTE, 'GET', 'GET /api/tickets');
    const res = await invoke(handler, jsonRequest('/api/tickets', 'GET', user.accessToken));
    assert.equal(res.status, 200, `Mes billets : ${show(res)}`);
    const t = ((res.body.tickets ?? []) as Row[]).find((x) => x.id === ticketId);
    assert.ok(t, `billet ${ticketId} dans Mes billets`);
    return t;
}

function fields(t: Row, keys: string[]): Row {
    for (const k of keys) assert.ok(k in t, `champ ${k} servi par GET /api/tickets (contrat 5.24), reçu ${JSON.stringify(t).slice(0, 500)}`);
    return Object.fromEntries(keys.map((k) => [k, t[k]]));
}

// ── 1. Événement suspendu ──────────────────────────────────────────────────

describe('R25 — billet d’un événement suspendu', () => {
    test('GET /api/tickets : codeVisible false, eventStatus SUSPENDU, eventNotice ; live-code → 409 EVENT_SUSPENDED', async () => {
        const ev = await publishedEvent('carte-suspendu');
        const buyer = await newBuyer('carte-suspendu');
        const [ticket] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        assertRpcOk(await rpcTransition(ev.eventId, superId, 'SUSPENDU', 'Verification des autorisations'), 'suspension');
        const t = await card(buyer, String(ticket.id));
        assert.deepEqual(fields(t, ['codeVisible', 'eventStatus', 'eventNotice']),
            { codeVisible: false, eventStatus: 'SUSPENDU', eventNotice: SUSPENDED_NOTICE },
            'QR masqué et état de l’événement dit sur la carte (aujourd’hui « Valable » et QR)');
        const code = await liveCode(buyer, String(ticket.id));
        assert.equal(code.status, 409, `live-code d’un événement suspendu : 409 attendu (aujourd’hui 200, live-code/route.ts:42) : ${show(code)}`);
        assert.equal(code.body.code, 'EVENT_SUSPENDED', show(code));
        assert.equal(code.body.error, SUSPENDED_NOTICE, show(code));
    });
});

// ── 2. Événement terminé ───────────────────────────────────────────────────

describe('R66 — billet d’un événement terminé : QR selon la fenêtre de contrôle, transfert masqué dès la fin', () => {
    test('TERMINE fini il y a 8 h (fenêtre de 6 h fermée) : codeVisible false, transferAllowed false ; fini il y a 2 h : codeVisible true, transferAllowed false', async () => {
        await withAccessSettings(WINDOW, async () => {
            const holder = await newBuyer('carte-termine');
            const closed = await finishedEvent('carte-fenetre-fermee', 8, holder);
            const open = await finishedEvent('carte-fenetre-ouverte', 2, holder);
            assert.deepEqual(fields(await card(holder, closed.ticketId), ['codeVisible', 'transferAllowed', 'eventStatus']),
                { codeVisible: false, transferAllowed: false, eventStatus: 'TERMINE' }, 'fenêtre fermée : ni QR ni transfert');
            assert.deepEqual(fields(await card(holder, open.ticketId), ['codeVisible', 'transferAllowed', 'eventStatus']),
                { codeVisible: true, transferAllowed: false, eventStatus: 'TERMINE' }, 'dans la fenêtre : QR montré, transfert masqué (refusé par la base après la fin)');
        });
    });
});

// ── 3. Prix, frais et canal ────────────────────────────────────────────────

describe('R66 — prix, frais de service et canal sur la carte', () => {
    test('billet payé 5 000 F : price 5000, serviceFee = frais du billet ; invitation : saleChannel INVITATION, price 0', async () => {
        const ev = await publishedEvent('carte-prix', 48);
        const buyer = await newBuyer('carte-prix');
        const [ticket] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        const fee = Number(ticket.service_fee ?? 0);
        assert.ok(fee > 0, `précondition : frais de service du billet payé (${JSON.stringify(ticket.service_fee)})`);
        assert.deepEqual(fields(await card(buyer, String(ticket.id)), ['price', 'serviceFee', 'saleChannel']),
            { price: 5000, serviceFee: fee, saleChannel: 'ONLINE' }, 'prix et frais servis (aujourd’hui absents)');

        const guest = await newBuyer('carte-invite');
        const invitationId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, guest, { saleChannel: 'INVITATION' });
        assert.deepEqual(fields(await card(guest, invitationId), ['price', 'serviceFee', 'saleChannel']),
            { price: 0, serviceFee: 0, saleChannel: 'INVITATION' }, 'invitation : « Invitation » à la place du prix');
    });
});

// ── 4. Carte (statique) ────────────────────────────────────────────────────

describe('R25, R66 — TicketCard suit les champs servis (contrôle statique)', () => {
    test('QR conditionné à codeVisible, « Transférer » à transferAllowed, eventNotice, « Frais de service », « Gratuit » et « Invitation »', () => {
        assert.ok(fs.existsSync(TICKET_CARD), `${TICKET_CARD} absent`);
        const src = fs.readFileSync(TICKET_CARD, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
        assert.match(src, /\bcodeVisible\b/, 'QR montré selon codeVisible (aujourd’hui tout billet VALIDE non verrouillé)');
        assert.match(src, /\btransferAllowed\b/, '« Transférer » selon transferAllowed');
        assert.match(src, /\beventNotice\b/, 'message de l’événement à la place du QR');
        assert.match(src, /Frais de service/, 'ligne « Frais de service »');
        assert.match(src, /['"`>]\s*Gratuit\b/, 'prix « Gratuit »');
        assert.match(src, /['"`>]\s*Invitation\b/, 'prix « Invitation »');
    });
});
