/**
 * Correctifs de la contre-vérification de la finition 1 — R2 : invitations simultanées du même numéro par la même
 * organisatrice. Verrou dans controller_invitation_create : UNE seule invitation créée et UN seul SMS ; les autres
 * demandes sont refusées (409 INVITATION_ALREADY_SENT, « Une invitation vient d’être envoyée à ce numéro… »), jamais une
 * erreur 500.
 *  a. Quatre demandes simultanées : une invitation créée (tous états confondus), un SMS, une réponse 201.
 *  b. « Inviter de nouveau » avec d'autres événements : l'invitation est remplacée comme avant (finition 1).
 * Rouge avant le correctif : 201, 201, 429, 201 ; trois invitations créées et trois SMS (run 205 § 3).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, freeEvent, invitationsFor, show, smsCount } from '../audit/cvf1-helpers';

const ALREADY_SENT_TEXT = 'Une invitation vient d’être envoyée à ce numéro. Attendez sa réponse ou utilisez « Renvoyer ».';

let P: TestPartner;
let ev: SaleEvent;
let ev2: SaleEvent;

before(async () => {
    P = await newPartner('cvf1c-r2');
    ev = await freeEvent(P, 'cvf1c-r2', { startsInHours: 48 });
    ev2 = await freeEvent(P, 'cvf1c-r2-b', { startsInHours: 72 });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-r2-invitations-simultanees');
});

describe('R2. invitations simultanées du même numéro', () => {
    test('a. quatre demandes : une invitation, un SMS, les autres refusées sans erreur', async () => {
        const h = await newBuyer('cvf1c-r2-h', { firstName: 'Double', lastName: 'Simultanee' });
        const rs = await Promise.all(Array.from({ length: 4 }, () => api('POST', 'partner/team/invite', {
            token: P.accessToken, body: { event_ids: [ev.eventId], phone: h.phoneE164, confirm_promotion: true },
        })));
        console.log(`[CVF1C-R2] quatre demandes : ${rs.map((r) => r.status).join(', ')}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(rs.filter((r) => r.status === 201).length, 1, `réponses 201 : ${rs.map(show).join(' | ')}`);
        for (const r of rs.filter((x) => x.status !== 201)) {
            assert.equal(r.status, 409, `refus : ${show(r)}`);
            assert.equal(r.body.code, 'INVITATION_ALREADY_SENT', show(r));
            assert.equal(r.body.error, ALREADY_SENT_TEXT, show(r));
        }
        assert.equal((await invitationsFor(P.partnerId, h.userId)).length, 1, 'invitations créées');
        assert.equal(await smsCount('CONTROLLER_INVITATION', h.userId), 1, 'SMS envoyés');
    });

    test('b. « Inviter de nouveau » avec d’autres événements : l’invitation est remplacée', async () => {
        const h = await newBuyer('cvf1c-r2-h2', { firstName: 'Nouvelle', lastName: 'Invitation' });
        const first = await api('POST', 'partner/team/invite', { token: P.accessToken, body: { event_ids: [ev.eventId], phone: h.phoneE164, confirm_promotion: true } });
        assert.equal(first.status, 201, show(first));
        const second = await api('POST', 'partner/team/invite', { token: P.accessToken, body: { event_ids: [ev.eventId, ev2.eventId], phone: h.phoneE164, confirm_promotion: true } });
        assert.equal(second.status, 201, `réinvitation avec un autre événement : ${show(second)}`);
        const rows = await invitationsFor(P.partnerId, h.userId);
        assert.deepEqual(rows.map((r) => r.status), ['CANCELLED', 'PENDING'], JSON.stringify(rows.map((r) => r.status)));
    });
});
