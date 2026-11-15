/**
 * Correctifs de la contre-vérification de la finition 1 — T4 : hors de la plage du contrôle, le scanner ne rend que le
 * verdict ; ni nom du porteur, ni numéro, ni catégorie du billet. Même règle pour un scanneur non autorisé.
 *  a. Contrôleur affecté, contrôle pas encore ouvert puis fermé : le scan rend le verdict (event_not_open, event_ended)
 *     sans billet ; la vérification manuelle est refusée « contrôle fermé » (409 CONTROL_CLOSED) sans billet ; le renvoi
 *     d'un scan refusé hors plage (même clé) ne rend pas non plus le billet.
 *  b. Événement annulé : même règle.
 *  c. Scanneur non autorisé (client sans rôle), contrôle ouvert : scan et vérification refusés sans rien du billet.
 * Rouge avant le correctif : le verdict du scan porte `ticket` (porteur, numéro, catégorie) et la vérification manuelle
 * rend le billet (run 205 de la contre-vérification).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, type Buyer, type SaleEvent } from './paiement-helpers';
import { advanceEventTo } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { FREE, api, freeEvent, freeTicket, scanTicket, show, type Reply } from '../audit/cvf1-helpers';

let P: TestPartner;
let H: Buyer;

before(async () => {
    P = await newPartner('cvf1c-t4');
    H = await newBuyer('cvf1c-t4-porteur', { firstName: 'Mariama', lastName: 'Porteusequatre' });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t4-verdict');
});

/** Rien du billet dans la réponse : ni objet `ticket`, ni nom du porteur, ni numéro, ni catégorie. */
function assertNothingOfTicket(r: Reply, what: string, t: { number: string }): void {
    assert.equal(r.body.ticket, undefined, `${what} : billet rendu (${show(r)})`);
    const text = JSON.stringify(r.body);
    for (const leak of [H.firstName, H.lastName, t.number, FREE]) {
        assert.ok(!text.includes(leak), `${what} : la réponse contient « ${leak} » (${show(r)})`);
    }
}

async function closedCase(ev: SaleEvent, label: string, expected: string): Promise<void> {
    const c = await newController(P, ev.eventId, { label: `t4-${label}` });
    const t = await freeTicket(ev, H);
    const key = randomUUID();
    const sc = await scanTicket(c, ev.eventId, t.id, {}, key);
    assert.equal(sc.status, 200, `${label} : scan (${show(sc)})`);
    assert.equal(sc.body.result, expected, `${label} : verdict (${show(sc)})`);
    assertNothingOfTicket(sc, `${label} : scan`, t);
    const replay = await api('POST', 'controller/scan', { token: c.accessToken, body: { eventId: ev.eventId, replayOnly: true }, headers: { 'idempotency-key': key } });
    assert.equal(replay.body.result, expected, `${label} : renvoi (${show(replay)})`);
    assertNothingOfTicket(replay, `${label} : renvoi`, t);
    const lookup = await api('POST', 'controller/scan/lookup', { token: c.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number } });
    assert.equal(lookup.status, 409, `${label} : vérification manuelle (${show(lookup)})`);
    assert.equal(lookup.body.code, 'CONTROL_CLOSED', `${label} : vérification manuelle (${show(lookup)})`);
    assertNothingOfTicket(lookup, `${label} : vérification manuelle`, t);
}

describe('T4 a. hors de la plage du contrôle', () => {
    test('avant l’ouverture : verdict seul', async () => {
        await closedCase(await freeEvent(P, 'cvf1c-t4-avant', { startsInHours: 48 }), 'avant l’ouverture', 'event_not_open');
    });
    test('après la fermeture : verdict seul', async () => {
        await closedCase(await freeEvent(P, 'cvf1c-t4-apres', { startsInHours: -20, durationHours: 4 }), 'après la fermeture', 'event_ended');
    });
});

describe('T4 b. événement annulé', () => {
    test('verdict seul', async () => {
        const ev = await freeEvent(P, 'cvf1c-t4-annule', { startsInHours: 1 });
        await advanceEventTo(ev.eventId, 'ANNULE');
        await closedCase(ev, 'annulé', 'event_cancelled');
    });
});

describe('T4 c. scanneur non autorisé, contrôle ouvert', () => {
    test('scan et vérification refusés sans rien du billet', async () => {
        const ev = await freeEvent(P, 'cvf1c-t4-ouvert', { startsInHours: 1 });
        const t = await freeTicket(ev, H);
        const stranger = await newBuyer('cvf1c-t4-intrus', { firstName: 'Intrus', lastName: 'Sansrole' });
        const sc = await scanTicket(stranger, ev.eventId, t.id);
        assert.equal(sc.status, 403, `scan d'un client sans rôle : ${show(sc)}`);
        assertNothingOfTicket(sc, 'scan non autorisé', t);
        const lookup = await api('POST', 'controller/scan/lookup', { token: stranger.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number } });
        assert.equal(lookup.status, 403, `vérification d'un client sans rôle : ${show(lookup)}`);
        assertNothingOfTicket(lookup, 'vérification non autorisée', t);
    });
});
