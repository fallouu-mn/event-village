/**
 * Lot 9 bis, tâche 27 (R48 ; contrat 5.27, B65) — annulation d'un événement commencé : l'impact compte les billets
 * déjà utilisés à l'entrée, qui seront aussi remboursés. `event_cancellation_impact` sert `in_progress` (début passé) et
 * `used_online { tickets, amount }` (billets UTILISE payés en ligne, part du paiement) ; le dialogue d'annulation
 * avertit et exige « J’ai compris ».
 * Scène : deux billets payés en ligne dans un même paiement, l'un scanné à l'entrée, puis l'événement commencé.
 * Rouge avant correctif : l'impact ne compte que les billets VALIDE (`tickets.online = 1`) alors que
 * `online_refund_total` additionne le paiement entier (M/20261102000003:715-744) ; ni `in_progress` ni `used_online` ;
 * EventCancelDialog sans avertissement (`:159-170`).
 * Interprétation (signalée) : la part d'un billet utilisé est son prix plus ses frais de service.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { newController, scan, ticketPayload, ticketRow } from './acces-helpers';
import { advanceEventTo, createDraftEvent, shiftEventDates, type DraftEvent } from './cycle-helpers';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 20 }];
const CANCEL_DIALOG = path.join('components', 'events', 'EventCancelDialog.tsx');

let partner: TestPartner;
let ev: DraftEvent;
let usedTicket: Row;

before(async () => {
    partner = await newPartner('annulation-en-cours');
    ev = await createDraftEvent(partner, 'annulation-en-cours', CATEGORIES, { startsInHours: 1, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    const buyer = await newBuyer('annulation-en-cours');
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 2]]);
    assert.equal(tickets.length, 2, 'deux billets payés en ligne');
    const ctrl = await newController(partner, ev.eventId, { label: 'annulation-en-cours' });
    const scanned = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(String(tickets[0].id)) });
    assert.equal(scanned.body.result, 'valid', `précondition : un billet entré : ${JSON.stringify(scanned.body)}`);
    usedTicket = await ticketRow(String(tickets[0].id));
    assert.equal(usedTicket.status, 'UTILISE', 'précondition : billet UTILISE');
    await shiftEventDates(ev.eventId, { startsInHours: -1, durationHours: 4 });
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-annulation-en-cours');
});

describe('R48 — annulation en cours d’événement : billets déjà utilisés comptés', () => {
    test('event_cancellation_impact : in_progress true, used_online { tickets: 1, amount: part du billet utilisé }', async () => {
        const { data, error } = await service.rpc('event_cancellation_impact', { p: { event_id: ev.eventId, actor_id: partner.userId } });
        assert.equal(error, null, `event_cancellation_impact : ${error?.message}`);
        const impact = (data ?? {}) as Row;
        assert.equal(impact.ok, true, JSON.stringify(impact));
        assert.equal(impact.in_progress, true, `événement commencé : in_progress (aujourd’hui absent) : ${JSON.stringify(impact)}`);
        const used = impact.used_online as Row | undefined;
        assert.ok(used && typeof used === 'object', `used_online servi (aujourd’hui absent, tickets.online = 1 pour un total de 2 billets) : ${JSON.stringify(impact)}`);
        assert.equal(Number(used.tickets), 1, `un billet déjà utilisé : ${JSON.stringify(used)}`);
        const share = Number(usedTicket.price) + Number(usedTicket.service_fee ?? 0);
        assert.equal(Number(used.amount), share, `part du paiement du billet utilisé (prix + frais de service) : ${JSON.stringify(used)}`);
        assert.ok(Number(impact.online_refund_total) >= share, `compris dans le total remboursé en ligne : ${JSON.stringify(impact)}`);
    });

    test('statique : EventCancelDialog avertit (« L’événement a commencé ») et exige la case « J’ai compris »', () => {
        assert.ok(fs.existsSync(CANCEL_DIALOG), `${CANCEL_DIALOG} absent`);
        const src = fs.readFileSync(CANCEL_DIALOG, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
        assert.match(src, /L[’']événement a commencé/, 'avertissement « L’événement a commencé : … billets déjà utilisés à l’entrée sont aussi remboursés »');
        assert.match(src, /déjà utilisés à l[’']entrée sont aussi remboursés/, 'texte de l’avertissement (contrat 5.27)');
        assert.match(src, /J[’']ai compris/, 'case « J’ai compris »');
        assert.match(src, /\bused_online\b/, 'avertissement alimenté par used_online');
        assert.match(src, /\bin_progress\b/, 'avertissement conditionné à in_progress');
    });
});
