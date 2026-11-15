/**
 * Contre-vérification de la finition 1, attaque 7 — un admin sur l'équipe d'une organisatrice.
 *
 *  a. ADMIN events.read : lit l'équipe (can_manage faux) ; aucune écriture (invitation, renvoi, annulation, effacement,
 *     réglages, point d'entrée, espèces, affectations, retraits).
 *  b. ADMIN sans permission : ni lecture ni écriture.
 *  c. ADMIN events.write dont la session n'a pas le code administrateur : ni lecture ni écriture, ni par la REST.
 *  d. ADMIN events.write rétrogradé (rôle retiré, ancien jeton) : aucune écriture.
 *  e. ADMIN events.write avec le code : motif exigé sur chaque écriture (absent, trop court, blanc, plus de 500 caractères
 *     refusés) ; avec un motif valable, l'action passe et le motif est inscrit au journal.
 * Sortie brute `[CVF1-7]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newController } from '../parcours/acces-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    adminWithoutCode, api, assignmentOf, expireInvitation, freeEvent, invitationRow, invitationsFor, inviteExisting, ok2xx,
    restRows, show, userClient, type Reply, type Row,
} from './cvf1-helpers';

const REASON = 'Demande écrite de l’organisatrice, ticket support 4521';

let P: TestPartner;
let ev: SaleEvent;
let C: Buyer;
let inv: string;
let invExp: string;
let newcomer: Buyer;
let assignment: Row;

before(async () => {
    P = await newPartner('cvf1-adm-p');
    ev = await freeEvent(P, 'adm', { startsInHours: 48 });
    C = await newController(P, ev.eventId, { label: 'cvf1-adm-c' });
    assignment = (await assignmentOf(ev.eventId, C.userId))!;
    const h = await newBuyer('cvf1-adm-h', { firstName: 'Admin', lastName: 'Cible' });
    inv = await inviteExisting(P, [ev.eventId], h);
    const h2 = await newBuyer('cvf1-adm-h2', { firstName: 'Admin', lastName: 'Echue' });
    invExp = await inviteExisting(P, [ev.eventId], h2);
    await expireInvitation(invExp);
    newcomer = await newBuyer('cvf1-adm-neuf', { firstName: 'Nouveau', lastName: 'Numero' });
});

after(async () => {
    await assertFinition1Invariants('cvf1-7-admin');
});

/** Toutes les écritures d'équipe, avec le motif donné (ou sans). */
async function allWrites(token: string, reason: unknown): Promise<Array<[string, Reply]>> {
    const r = reason === undefined ? {} : { reason };
    const aid = String(assignment.id);
    return [
        ['POST invite', await api('POST', 'partner/team/invite', { token, body: { event_ids: [ev.eventId], phone: newcomer.phoneE164, confirm_promotion: true, ...r } })],
        ['POST resend', await api('POST', 'partner/team/invitations/[id]/resend', { token, path: `/api/partner/team/invitations/${inv}/resend`, params: { id: inv }, body: r })],
        ['POST cancel', await api('POST', 'partner/team/invitations/[id]/cancel', { token, path: `/api/partner/team/invitations/${inv}/cancel`, params: { id: inv }, body: r })],
        ['DELETE invitation (effacer)', await api('DELETE', 'partner/team/invitations/[id]', { token, path: `/api/partner/team/invitations/${invExp}`, params: { id: invExp }, body: r })],
        ['PATCH settings', await api('PATCH', 'partner/team/settings', { token, body: { eventId: ev.eventId, controllerId: C.userId, entryPoint: 'Porte admin', canAcceptCash: true, ...r } })],
        ['PATCH entry-point', await api('PATCH', 'partner/team/entry-point', { token, body: { eventId: ev.eventId, controllerId: C.userId, entryPoint: 'Porte admin', ...r } })],
        ['PATCH assignments/[id]', await api('PATCH', 'partner/team/assignments/[id]', { token, path: `/api/partner/team/assignments/${aid}`, params: { id: aid }, body: { canAcceptCash: true, ...r } })],
        ['PATCH assignments', await api('PATCH', 'partner/team/assignments', { token, body: { controllerId: C.userId, eventIds: [], ...r } })],
        ['DELETE team/[eventId]', await api('DELETE', 'partner/team/[eventId]', { token, path: `/api/partner/team/${ev.eventId}?assignmentId=${aid}`, params: { eventId: ev.eventId }, body: r })],
        ['DELETE team/controller', await api('DELETE', 'partner/team/controller/[controllerId]', { token, path: `/api/partner/team/controller/${C.userId}?partnerId=${P.partnerId}`, params: { controllerId: C.userId }, body: r })],
        ['DELETE team/all', await api('DELETE', 'partner/team/all', { token, path: `/api/partner/team/all?controllerId=${C.userId}&partnerId=${P.partnerId}`, body: r })],
    ];
}

async function assertNothingChanged(tag: string): Promise<void> {
    const a = await assignmentOf(ev.eventId, C.userId);
    assert.ok(a, `${tag} : le contrôleur a été retiré`);
    assert.equal(a.entry_point, assignment.entry_point, `${tag} : point d'entrée modifié`);
    assert.equal(a.can_accept_cash, assignment.can_accept_cash, `${tag} : droit d'encaisser modifié`);
    const i = await invitationRow(inv);
    assert.equal(i.status, 'PENDING', `${tag} : invitation passée à ${String(i.status)}`);
    assert.equal(Number(i.send_count), 1, `${tag} : invitation renvoyée`);
    assert.equal((await invitationRow(invExp)).cleared_at, null, `${tag} : invitation échue effacée`);
    assert.deepEqual(await invitationsFor(P.partnerId, newcomer.userId), [], `${tag} : invitation créée`);
}

async function noWriteAccepted(token: string, reason: unknown, tag: string): Promise<string[]> {
    const breaches: string[] = [];
    for (const [what, r] of await allWrites(token, reason)) {
        console.log(`[CVF1-7] ${tag} : ${what} → ${show(r)}`);
        if (ok2xx(r)) breaches.push(`${tag} : ${what} → ${show(r)}`);
    }
    return breaches;
}

describe('a à d. admins sans le droit d’écrire', () => {
    test('a. ADMIN events.read : lit sans pouvoir écrire, même avec un motif', async () => {
        const reader = await newAdmin('cvf1-adm-lit', ['events.read']);
        const view = await api('GET', 'partner/team', { token: reader.accessToken, path: `/api/partner/team?partnerId=${P.partnerId}` });
        console.log(`[CVF1-7] events.read : lecture → HTTP ${view.status} can_manage=${String(view.body.can_manage)}`);
        assert.equal(view.status, 200, `lecture de l'équipe par events.read : ${show(view)}`);
        assert.equal(view.body.can_manage, false, 'can_manage vrai pour un admin events.read');
        const breaches = await noWriteAccepted(reader.accessToken, REASON, 'events.read');
        assert.deepEqual(breaches, [], `écritures acceptées sans events.write :\n${breaches.join('\n')}`);
        await assertNothingChanged('events.read');
    });

    test('b. ADMIN sans permission : ni lecture ni écriture', async () => {
        const none = await newAdmin('cvf1-adm-rien', []);
        const view = await api('GET', 'partner/team', { token: none.accessToken, path: `/api/partner/team?partnerId=${P.partnerId}` });
        console.log(`[CVF1-7] sans permission : lecture → ${show(view)}`);
        const breaches = await noWriteAccepted(none.accessToken, REASON, 'sans permission');
        if (ok2xx(view)) breaches.push(`lecture de l'équipe sans permission : ${show(view)}`);
        assert.deepEqual(breaches, [], breaches.join('\n'));
        await assertNothingChanged('sans permission');
    });

    test('c. ADMIN events.write sans le code administrateur de la session : rien, ni par la REST', async () => {
        const noCode = await adminWithoutCode('adm-sanscode', ['events.read', 'events.write']);
        const view = await api('GET', 'partner/team', { token: noCode.accessToken, path: `/api/partner/team?partnerId=${P.partnerId}` });
        console.log(`[CVF1-7] sans code : lecture → ${show(view)}`);
        const breaches = await noWriteAccepted(noCode.accessToken, REASON, 'sans code');
        if (ok2xx(view)) breaches.push(`lecture de l'équipe sans le code : ${show(view)}`);
        for (const [table, filter] of [['event_controllers', { event_id: ev.eventId }], ['controller_invitations', { partner_id: P.partnerId }]] as const) {
            const r = await restRows(userClient(noCode.accessToken), table, filter);
            console.log(`[CVF1-7] sans code : REST ${table} → ${r.rows.length} ligne(s)${r.error ? ` ; refus ${r.error}` : ''}`);
            if (r.rows.length > 0) breaches.push(`REST ${table} lue sans le code : ${r.rows.length} ligne(s)`);
        }
        assert.deepEqual(breaches, [], breaches.join('\n'));
        await assertNothingChanged('sans code');
    });

    test('d. ADMIN events.write rétrogradé, ancien jeton : aucune écriture', async () => {
        const demoted = await newAdmin('cvf1-adm-retro', ['events.read', 'events.write']);
        const { error } = await service.from('user_roles').delete().eq('user_id', demoted.userId).eq('role', 'ADMIN');
        assert.equal(error, null, `rôle ADMIN retiré (montage) : ${error?.message}`);
        const breaches = await noWriteAccepted(demoted.accessToken, REASON, 'rétrogradé');
        assert.deepEqual(breaches, [], breaches.join('\n'));
        await assertNothingChanged('rétrogradé');
    });
});

describe('e. ADMIN events.write avec le code : motif exigé et journalisé', () => {
    let writer: Buyer;
    before(async () => {
        writer = await newAdmin('cvf1-adm-ecrit', ['events.read', 'events.write']);
    });

    test('sans motif, trop court, blanc, plus de 500 caractères : chaque écriture refusée', async () => {
        const breaches: string[] = [];
        for (const [label, reason] of [['sans motif', undefined], ['3 caractères', 'abc'], ['blanc', '        '], ['5 000 caractères', 'x'.repeat(5_000)]] as const) {
            breaches.push(...await noWriteAccepted(writer.accessToken, reason, `motif ${label}`));
        }
        assert.deepEqual(breaches, [], `écritures d'un admin acceptées sans motif valable :\n${breaches.join('\n')}`);
        await assertNothingChanged('motifs refusés');
    });

    test('motif valable : l’action passe et le motif est inscrit au journal', async () => {
        // Objets neufs : l'essai précédent a pu en modifier (c'est alors lui qui échoue)
        const c2 = await newController(P, ev.eventId, { label: 'cvf1-adm-c2' });
        const h3 = await newBuyer('cvf1-adm-h3', { firstName: 'Admin', lastName: 'Valable' });
        const inv2 = await inviteExisting(P, [ev.eventId], h3);
        const settings = await api('PATCH', 'partner/team/settings', {
            token: writer.accessToken, body: { eventId: ev.eventId, controllerId: c2.userId, entryPoint: 'Porte admin', canAcceptCash: true, reason: REASON },
        });
        const cancel = await api('POST', 'partner/team/invitations/[id]/cancel', { token: writer.accessToken, path: `/api/partner/team/invitations/${inv2}/cancel`, params: { id: inv2 }, body: { reason: REASON } });
        const removal = await api('DELETE', 'partner/team/controller/[controllerId]', {
            token: writer.accessToken, path: `/api/partner/team/controller/${c2.userId}?partnerId=${P.partnerId}`, params: { controllerId: c2.userId }, body: { reason: REASON },
        });
        console.log(`[CVF1-7] motif valable : réglages → ${show(settings)} ; annulation → ${show(cancel)} ; retrait → ${show(removal)}`);
        assert.equal(settings.status, 200, show(settings));
        assert.equal(cancel.status, 200, show(cancel));
        assert.equal(removal.status, 200, show(removal));
        const { data: logs, error } = await service.from('audit_logs').select('action, user_role, metadata').eq('user_id', writer.userId);
        assert.equal(error, null, `journal : ${error?.message}`);
        console.log(`[CVF1-7] journal de l'admin : ${JSON.stringify((logs ?? []).map((l) => [l.action, l.user_role, String((l.metadata as Row | null)?.reason ?? '').slice(0, 60)]))}`);
        const withReason = (logs ?? []).filter((l) => JSON.stringify(l.metadata ?? {}).includes(REASON));
        for (const action of ['CONTROLLER_SETTINGS_SET', 'CONTROLLER_INVITATION_CANCELLED']) {
            assert.ok(withReason.some((l) => l.action === action), `${action} sans le motif au journal`);
        }
        assert.ok(withReason.length >= 3, `motif journalisé pour ${withReason.length} action(s) sur 3 (réglages, annulation, retrait)`);
    });
});
