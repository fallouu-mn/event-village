/**
 * Correctifs de la contre-vérification de la finition 1 — R3 : un motif d'admin trop long reçoit le bon message sur chaque
 * écriture de l'équipe (et plus « Point d’entrée invalide (80 caractères au plus) », « canAcceptCash doit valoir vrai ou
 * faux », « Too big: expected string… » ni « 5 caractères au moins »).
 *  a. 501 caractères : 400 REASON_TOO_LONG, « Le motif est trop long : 500 caractères au plus. Raccourcissez-le. », rien ne
 *     change, sur : inviter, réglages, point d'entrée, droit d'encaisser, événements du contrôleur, retirer de cet
 *     événement, retirer de l'équipe (deux routes).
 *  b. 3 caractères : 400 REASON_REQUIRED, « Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au
 *     journal. », sur les mêmes routes (inchangé).
 * Rouge avant le correctif : textes de la contre-vérification (run 205, § 3).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, assignmentOf, freeEvent, invitationsFor, show, type Reply, type Row } from '../audit/cvf1-helpers';

const TOO_LONG = { code: 'REASON_TOO_LONG', error: 'Le motif est trop long : 500 caractères au plus. Raccourcissez-le.' };
const TOO_SHORT = { code: 'REASON_REQUIRED', error: 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.' };

let P: TestPartner;
let ev: SaleEvent;
let C: Buyer;
let assignment: Row;
let newcomer: Buyer;
let writer: Buyer;

before(async () => {
    P = await newPartner('cvf1c-r3');
    ev = await freeEvent(P, 'cvf1c-r3', { startsInHours: 48 });
    C = await newController(P, ev.eventId, { label: 'cvf1c-r3-c' });
    assignment = (await assignmentOf(ev.eventId, C.userId))!;
    newcomer = await newBuyer('cvf1c-r3-neuf', { firstName: 'Nouveau', lastName: 'Numerotrois' });
    writer = await newAdmin('cvf1c-r3-ecrit', ['events.read', 'events.write']);
});

after(async () => {
    await assertFinition1Invariants('cvf1c-r3-textes-motif');
});

async function writes(reason: string): Promise<Array<[string, Reply]>> {
    const token = writer.accessToken;
    const aid = String(assignment.id);
    const r = { reason };
    return [
        ['inviter', await api('POST', 'partner/team/invite', { token, body: { event_ids: [ev.eventId], phone: newcomer.phoneE164, confirm_promotion: true, ...r } })],
        ['réglages', await api('PATCH', 'partner/team/settings', { token, body: { eventId: ev.eventId, controllerId: C.userId, entryPoint: 'Porte admin', canAcceptCash: true, ...r } })],
        ['point d’entrée', await api('PATCH', 'partner/team/entry-point', { token, body: { eventId: ev.eventId, controllerId: C.userId, entryPoint: 'Porte admin', ...r } })],
        ['droit d’encaisser', await api('PATCH', 'partner/team/assignments/[id]', { token, path: `/api/partner/team/assignments/${aid}`, params: { id: aid }, body: { canAcceptCash: true, ...r } })],
        ['événements du contrôleur', await api('PATCH', 'partner/team/assignments', { token, body: { controller_id: C.userId, assignments: [{ event_id: ev.eventId, can_accept_cash: true }], ...r } })],
        ['retirer de cet événement', await api('DELETE', 'partner/team/[eventId]', { token, path: `/api/partner/team/${ev.eventId}?assignmentId=${aid}`, params: { eventId: ev.eventId }, body: r })],
        ['retirer de l’équipe', await api('DELETE', 'partner/team/controller/[controllerId]', { token, path: `/api/partner/team/controller/${C.userId}?partnerId=${P.partnerId}`, params: { controllerId: C.userId }, body: r })],
        ['retirer de l’équipe (liste)', await api('DELETE', 'partner/team/all', { token, path: `/api/partner/team/all?controllerId=${C.userId}&partnerId=${P.partnerId}`, body: r })],
    ];
}

async function assertNothingChanged(tag: string): Promise<void> {
    const a = await assignmentOf(ev.eventId, C.userId);
    assert.ok(a, `${tag} : le contrôleur a été retiré`);
    assert.equal(a.entry_point, assignment.entry_point, `${tag} : point d'entrée modifié`);
    assert.equal(a.can_accept_cash, assignment.can_accept_cash, `${tag} : droit d'encaisser modifié`);
    assert.deepEqual(await invitationsFor(P.partnerId, newcomer.userId), [], `${tag} : invitation créée`);
}

describe('R3. motif d’admin : le message dit ce qui ne va pas', () => {
    test('501 caractères : « trop long » partout, rien ne change', async () => {
        const wrong: string[] = [];
        for (const [what, r] of await writes('x'.repeat(501))) {
            if (r.status !== 400 || r.body.code !== TOO_LONG.code || r.body.error !== TOO_LONG.error) wrong.push(`${what} → ${show(r)}`);
        }
        assert.deepEqual(wrong, [], `messages faux pour un motif trop long :\n${wrong.join('\n')}`);
        await assertNothingChanged('motif trop long');
    });

    test('3 caractères : « 5 caractères au moins » partout, rien ne change', async () => {
        const wrong: string[] = [];
        for (const [what, r] of await writes('abc')) {
            if (r.status !== 400 || r.body.code !== TOO_SHORT.code || r.body.error !== TOO_SHORT.error) wrong.push(`${what} → ${show(r)}`);
        }
        assert.deepEqual(wrong, [], `messages faux pour un motif trop court :\n${wrong.join('\n')}`);
        await assertNothingChanged('motif trop court');
    });
});
