/**
 * Correctifs de la contre-vérification de la finition 1 — T5 : motif d'un admin de 5 à 500 caractères partout, par la
 * même aide (adminReasonRefusal) dans invitation-actions.ts et par controller_invitation_actor_check en base.
 *  a. « Renvoyer », « Annuler », « Effacer » une invitation avec un motif de 501 caractères : 400 REASON_TOO_LONG, texte
 *     exact, rien ne change (ni état, ni renvoi, ni effacement) ; 500 caractères : accepté.
 *  b. controller_invitation_cancel (service_role, sans la route) : 501 caractères → REASON_TOO_LONG ; rien ne change.
 * Rouge avant le correctif : 5 000 caractères acceptés et inscrits au journal (run 205 de la contre-vérification).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newAdmin } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, expireInvitation, freeEvent, invitationRow, inviteExisting, show, type Reply } from '../audit/cvf1-helpers';

const REASON_TOO_LONG_TEXT = 'Le motif est trop long : 500 caractères au plus. Raccourcissez-le.';

let P: TestPartner;
let ev: SaleEvent;
let writer: Buyer;

before(async () => {
    P = await newPartner('cvf1c-t5');
    ev = await freeEvent(P, 'cvf1c-t5', { startsInHours: 48 });
    writer = await newAdmin('cvf1c-t5-ecrit', ['events.read', 'events.write']);
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t5-motif');
});

async function action(kind: 'resend' | 'cancel' | 'clear', id: string, reason: string): Promise<Reply> {
    if (kind === 'clear') {
        return api('DELETE', 'partner/team/invitations/[id]', { token: writer.accessToken, path: `/api/partner/team/invitations/${id}`, params: { id }, body: { reason } });
    }
    return api('POST', `partner/team/invitations/[id]/${kind}`, { token: writer.accessToken, path: `/api/partner/team/invitations/${id}/${kind}`, params: { id }, body: { reason } });
}

function assertTooLong(r: Reply, what: string): void {
    assert.equal(r.status, 400, `${what} : statut (${show(r)})`);
    assert.equal(r.body.code, 'REASON_TOO_LONG', `${what} : code (${show(r)})`);
    assert.equal(r.body.error, REASON_TOO_LONG_TEXT, `${what} : texte (${show(r)})`);
}

describe('T5 a. actions sur une invitation, par la route', () => {
    test('501 caractères : refus exact, rien ne change ; 500 caractères : accepté', async () => {
        const h = await newBuyer('cvf1c-t5-h', { firstName: 'Khady', lastName: 'Invitee' });
        const id = await inviteExisting(P, [ev.eventId], h);
        const h2 = await newBuyer('cvf1c-t5-h2', { firstName: 'Khady', lastName: 'Echue' });
        const expired = await inviteExisting(P, [ev.eventId], h2);
        await expireInvitation(expired);
        const long = 'x'.repeat(501);
        assertTooLong(await action('resend', id, long), 'renvoyer');
        assertTooLong(await action('cancel', id, long), 'annuler');
        assertTooLong(await action('clear', expired, long), 'effacer');
        const row = await invitationRow(id);
        assert.equal(row.status, 'PENDING', `invitation passée à ${String(row.status)}`);
        assert.equal(Number(row.send_count), 1, 'invitation renvoyée');
        assert.equal((await invitationRow(expired)).cleared_at, null, 'invitation échue effacée');
        const ok = await action('cancel', id, 'y'.repeat(500));
        assert.equal(ok.status, 200, `motif de 500 caractères : ${show(ok)}`);
    });
});

describe('T5 b. controller_invitation_cancel sans la route', () => {
    test('501 caractères : REASON_TOO_LONG, invitation inchangée', async () => {
        const h = await newBuyer('cvf1c-t5-rpc', { firstName: 'Khady', lastName: 'Fonction' });
        const id = await inviteExisting(P, [ev.eventId], h);
        const { data, error } = await service.rpc('controller_invitation_cancel', {
            p: { actor_id: writer.userId, invitation_id: id, reason: 'x'.repeat(501) },
        });
        assert.equal(error, null, error?.message);
        const reply = data as Record<string, unknown>;
        assert.equal(reply.ok, false, `motif de 501 caractères accepté par la fonction : ${JSON.stringify(reply)}`);
        assert.equal(reply.code, 'REASON_TOO_LONG', JSON.stringify(reply));
        assert.equal(reply.message, REASON_TOO_LONG_TEXT, JSON.stringify(reply));
        assert.equal((await invitationRow(id)).status, 'PENDING', 'invitation annulée');
    });
});
