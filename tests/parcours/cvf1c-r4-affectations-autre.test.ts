/**
 * Correctifs de la contre-vérification de la finition 1 — R4 : PATCH /api/partner/team/assignments envoyé par
 * l'organisatrice A avec le contrôleur de l'organisatrice B (qu'elle n'a jamais eu dans son équipe) et aucun événement à
 * ajouter : 404 sans indice, la même réponse que pour un identifiant inconnu ; jamais « Événements du contrôleur
 * enregistrés. » ; rien ne change chez B.
 * Rouge avant le correctif : 200 « Événements du contrôleur enregistrés. » (run 205 § 3).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, assignmentOf, freeEvent, show } from '../audit/cvf1-helpers';

let A: TestPartner;
let B: TestPartner;
let evB: SaleEvent;

before(async () => {
    A = await newPartner('cvf1c-r4-a');
    B = await newPartner('cvf1c-r4-b');
    evB = await freeEvent(B, 'cvf1c-r4-b', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-r4-affectations-autre');
});

describe('R4. événements du contrôleur d’une autre organisatrice', () => {
    test('liste vide : 404 comme un identifiant inconnu, rien ne change chez B', async () => {
        const cB = await newController(B, evB.eventId, { label: 'cvf1c-r4-cb', canAcceptCash: true });
        const before = await assignmentOf(evB.eventId, cB.userId);
        const foreign = await api('PATCH', 'partner/team/assignments', { token: A.accessToken, body: { controller_id: cB.userId, assignments: [] } });
        const unknown = await api('PATCH', 'partner/team/assignments', { token: A.accessToken, body: { controller_id: randomUUID(), assignments: [] } });
        console.log(`[CVF1C-R4] contrôleur de B → ${show(foreign)} ; identifiant inconnu → ${show(unknown)}`);
        assert.equal(foreign.status, 404, `contrôleur d'une autre organisatrice : ${show(foreign)}`);
        assert.deepEqual(foreign.body, unknown.body, 'réponse différente de celle d’un identifiant inconnu');
        assert.ok(!JSON.stringify(foreign.body).includes('enregistr'), show(foreign));
        assert.deepEqual(await assignmentOf(evB.eventId, cB.userId), before, 'affectation de B modifiée');
    });
});
