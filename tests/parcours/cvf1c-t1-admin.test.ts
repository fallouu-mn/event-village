/**
 * Correctifs de la contre-vérification de la finition 1 — T1 : un compte ADMIN ou SUPERADMIN ne peut jamais être invité ni
 * devenir contrôleur.
 *  a. Route POST /api/partner/team/invite : refus dès la première étape, AVANT la confirmation « ce numéro a déjà un
 *     compte » (aucun nom masqué, aucun requires_confirmation), avec et sans confirm_promotion ; texte neutre exact ;
 *     aucune invitation, aucun SMS, aucun rôle.
 *  b. controller_invitation_create (service_role) : refus NOT_INVITABLE, aucune ligne.
 *  c. controller_invitation_respond : un compte devenu admin après l'invitation ne peut pas l'accepter (route et
 *     fonction) : ni rôle CONTROLEUR, ni affectation ; il peut encore la refuser.
 *  d. PATCH /api/partner/team/assignments (identifiant d'un compte admin, événements à ajouter) : même refus neutre, sans
 *     nom masqué.
 * Rouge avant le correctif : la route rend EXISTING_ACCOUNT avec le nom masqué, puis crée l'invitation et le SMS (run 205
 * de la contre-vérification) ; les deux fonctions acceptent.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newAdmin } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    api, assignmentOf, freeEvent, invitationsFor, rolesOf, show, type Reply,
} from '../audit/cvf1-helpers';

const NOT_INVITABLE_TEXT = 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.';

let P: TestPartner;
let ev: SaleEvent;

before(async () => {
    P = await newPartner('cvf1c-t1');
    ev = await freeEvent(P, 'cvf1c-t1', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t1-admin');
});

/** Lignes CONTROLLER_INVITATION de la boîte d'envoi pour ce compte (tous canaux). */
async function invitationMessages(userId: string): Promise<number> {
    const { count, error } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
        .eq('type', 'CONTROLLER_INVITATION').eq('recipient_user_id', userId);
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    return count ?? 0;
}

function assertNeutralRefusal(r: Reply, what: string, admin: Buyer): void {
    assert.equal(r.status, 409, `${what} : statut (${show(r)})`);
    assert.equal(r.body.code, 'NOT_INVITABLE', `${what} : code (${show(r)})`);
    assert.equal(r.body.error, NOT_INVITABLE_TEXT, `${what} : texte (${show(r)})`);
    assert.equal(r.body.requires_confirmation, undefined, `${what} : aucune demande de confirmation (${show(r)})`);
    assert.equal(r.body.existing_user, undefined, `${what} : aucun nom masqué (${show(r)})`);
    const text = JSON.stringify(r.body);
    for (const leak of ['Nd***', admin.firstName, admin.lastName, 'admin', 'Admin', 'ADMIN']) {
        assert.ok(!text.includes(leak), `${what} : la réponse contient « ${leak} » (${show(r)})`);
    }
}

describe('T1 a. route d’invitation : refus neutre avant la confirmation', () => {
    for (const role of ['ADMIN', 'SUPERADMIN'] as const) {
        test(`${role} : première étape et confirmation refusées, ni invitation, ni SMS, ni rôle`, async () => {
            const target = await newAdmin(`cvf1c-t1-${role.toLowerCase()}`, [], { role });
            const before = await rolesOf(target.userId);
            const ask = await api('POST', 'partner/team/invite', { token: P.accessToken, body: { event_ids: [ev.eventId], phone: target.phoneE164 } });
            assertNeutralRefusal(ask, `${role}, première étape`, target);
            const confirm = await api('POST', 'partner/team/invite', { token: P.accessToken, body: { event_ids: [ev.eventId], phone: target.phoneE164, confirm_promotion: true } });
            assertNeutralRefusal(confirm, `${role}, confirmation`, target);
            assert.equal((await invitationsFor(P.partnerId, target.userId)).length, 0, `${role} : invitation créée`);
            assert.equal(await invitationMessages(target.userId), 0, `${role} : message d'invitation mis en file`);
            assert.deepEqual(await rolesOf(target.userId), before, `${role} : rôles modifiés`);
            assert.equal(await assignmentOf(ev.eventId, target.userId), null, `${role} : affecté`);
        });
    }
});

describe('T1 b. controller_invitation_create', () => {
    test('compte ADMIN : NOT_INVITABLE, aucune ligne', async () => {
        const target = await newAdmin('cvf1c-t1-rpc', []);
        const { data, error } = await service.rpc('controller_invitation_create', {
            p: { actor_id: P.userId, partner_id: P.partnerId, user_id: target.userId, assignments: [{ event_id: ev.eventId, can_accept_cash: false }] },
        });
        assert.equal(error, null, error?.message);
        const reply = data as Record<string, unknown>;
        assert.equal(reply.ok, false, `invitation d'un admin acceptée : ${JSON.stringify(reply)}`);
        assert.equal(reply.code, 'NOT_INVITABLE', JSON.stringify(reply));
        assert.equal(reply.message, NOT_INVITABLE_TEXT, JSON.stringify(reply));
        assert.equal((await invitationsFor(P.partnerId, target.userId)).length, 0, 'ligne créée');
        assert.equal(await invitationMessages(target.userId), 0, 'message mis en file');
    });
});

describe('T1 c. controller_invitation_respond : compte devenu admin après l’invitation', () => {
    test('acceptation refusée (route et fonction), ni rôle ni affectation ; le refus reste possible', async () => {
        // Invitation d'avant le correctif (ou d'avant le rôle) : ligne en attente posée au montage pour un compte ADMIN
        // dont la session passe la garde de l'administration (newAdmin, comme cvf1-6)
        const h = await newAdmin('cvf1c-t1-devenu', []);
        const { data: row, error: insErr } = await service.from('controller_invitations').insert({
            partner_id: P.partnerId, user_id: h.userId, created_by: P.userId,
            assignments: [{ event_id: ev.eventId, can_accept_cash: false }],
        }).select('id').single();
        assert.equal(insErr, null, `invitation d'avant (montage) : ${insErr?.message}`);
        const id = String(row!.id);
        const viaRoute = await api('POST', 'account/controller-invitations/[id]', {
            token: h.accessToken, path: `/api/account/controller-invitations/${id}`, params: { id }, body: { accept: true },
        });
        assert.equal(viaRoute.status, 403, `acceptation par un compte admin : ${show(viaRoute)}`);
        assert.equal(viaRoute.body.code, 'NOT_INVITABLE', show(viaRoute));
        const { data, error } = await service.rpc('controller_invitation_respond', { p: { invitation_id: id, actor_id: h.userId, accept: true } });
        assert.equal(error, null, error?.message);
        assert.equal((data as Record<string, unknown>).code, 'NOT_INVITABLE', JSON.stringify(data));
        assert.ok(!(await rolesOf(h.userId)).includes('CONTROLEUR'), 'rôle CONTROLEUR posé');
        assert.equal(await assignmentOf(ev.eventId, h.userId), null, 'affectation posée');
        const decline = await api('POST', 'account/controller-invitations/[id]', {
            token: h.accessToken, path: `/api/account/controller-invitations/${id}`, params: { id }, body: { accept: false },
        });
        assert.equal(decline.status, 200, `refus de l'invitation : ${show(decline)}`);
    });
});

describe('T1 d. PATCH /api/partner/team/assignments vers un compte admin', () => {
    test('refus neutre, sans nom masqué, ni invitation ni affectation', async () => {
        const target = await newAdmin('cvf1c-t1-patch', []);
        for (const confirm of [false, true]) {
            const r = await api('PATCH', 'partner/team/assignments', {
                token: P.accessToken,
                body: { controller_id: target.userId, assignments: [{ event_id: ev.eventId, can_accept_cash: false }], confirm_promotion: confirm },
            });
            assertNeutralRefusal(r, `affectation d'un admin (confirmation ${confirm})`, target);
        }
        assert.equal((await invitationsFor(P.partnerId, target.userId)).length, 0, 'invitation créée');
        assert.equal(await assignmentOf(ev.eventId, target.userId), null, 'affecté');
    });
});
