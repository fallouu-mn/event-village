/**
 * Contre-vérification de la finition 3d, attaque 5 — choix de l'organisatrice dans Équipe
 * (GET /api/partner/team/organizers ; routes de l'équipe avec ?partnerId= ou sur les objets d'une organisatrice).
 *  a. Admin sans events.read : liste des organisatrices et équipe d'une organisatrice refusées.
 *  b. Admin events.read seulement : lecture permise (témoin), puis CHAQUE écriture de l'équipe de l'organisatrice choisie
 *     (inviter, réglages, affectations, porte, point d'entrée, retirer un contrôleur, vider un événement ou toute l'équipe,
 *     effacer une invitation) : 403, rien ne change.
 *  c. Une partenaire qui se sert de ce choix : liste des organisatrices, ?partnerId= d'une autre, ?eventId= d'une autre,
 *     invitation sur l'événement d'une autre : refus ou sa propre équipe seulement.
 *  d. La liste ne rend que nom, ville, statut et identifiant de fiche (aucun numéro, adresse ni compte).
 * Sortie brute `[CVF3D-5]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { createTimedEvent, newController } from '../parcours/acces-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { call, show, type Reply, type Row, type TestAdmin } from './cvf3d-helpers';

let P: TestPartner;
let P2: TestPartner;
let E: SaleEvent;
let E2: SaleEvent;
let C: Buyer;
let C2: Buyer;
let invitationId: string;

async function pendingInvitation(partner: TestPartner, userId: string, eventId: string): Promise<string> {
    const { data, error } = await service.from('controller_invitations').insert({
        partner_id: partner.partnerId, user_id: userId, created_by: partner.userId,
        assignments: [{ event_id: eventId, can_accept_cash: false }],
    }).select('id').single();
    assert.equal(error, null, `invitation en attente (montage) : ${error?.message}`);
    return String(data!.id);
}

async function teamState(partner: TestPartner): Promise<string> {
    const [a, i, s] = await Promise.all([
        service.from('event_controllers').select('event_id, user_id, can_accept_cash').in('event_id', [E.eventId]).order('user_id'),
        service.from('controller_invitations').select('id, status').eq('partner_id', partner.partnerId).order('id'),
        service.from('events').select('id, updated_at').eq('id', E.eventId),
    ]);
    for (const x of [a, i, s]) assert.equal(x.error, null, x.error?.message);
    return JSON.stringify([a.data, i.data, s.data]);
}

before(async () => {
    P = await newPartner('cvf3d5-p');
    P2 = await newPartner('cvf3d5-p2');
    E = await createTimedEvent(P.partnerId, 'cvf3d5-e', [{ name: 'Standard', price: 2_000, total: 10 }]);
    E2 = await createTimedEvent(P2.partnerId, 'cvf3d5-e2', [{ name: 'Standard', price: 2_000, total: 10 }]);
    C = await newController(P, E.eventId, { label: 'cvf3d5-c' });
    C2 = await newController(P2, E2.eventId, { label: 'cvf3d5-c2' });
    const invitee = await newBuyer('cvf3d5-invite');
    invitationId = await pendingInvitation(P, invitee.userId, E.eventId);
});

after(async () => {
    await assertFinition3dInvariants('cvf3d-5-equipe');
});

describe('5. qui choisit une organisatrice', () => {
    test('a. admin sans events.read : liste et équipe refusées', async () => {
        const admin = await newAdmin('cvf3d5-a', ['refunds.manage']);
        const list = await call('GET', 'partner/team/organizers', { token: admin.accessToken });
        const team = await call('GET', 'partner/team', { token: admin.accessToken, path: `/api/partner/team?partnerId=${P.partnerId}` });
        console.log(`[CVF3D-5a] liste : ${show(list)} ; équipe : ${show(team)}`);
        assert.equal(list.status, 403, show(list));
        assert.equal(team.status, 403, show(team));
    });

    test('b. admin events.read seulement : lecture permise, chaque écriture de l\'équipe choisie refusée, rien ne change', async () => {
        const reader: TestAdmin = await newAdmin('cvf3d5-b', ['events.read']);
        const list = await call('GET', 'partner/team/organizers', { token: reader.accessToken, path: '/api/partner/team/organizers?q=cvf3d5' });
        const team = await call('GET', 'partner/team', { token: reader.accessToken, path: `/api/partner/team?partnerId=${P.partnerId}` });
        const before0 = await teamState(P);
        const q = `?partnerId=${P.partnerId}`;
        const aid = randomUUID();
        const writes: Array<[string, string, string, Row, Record<string, string>?]> = [
            ['POST', 'partner/team/invite', `/api/partner/team/invite${q}`, { event_ids: [E.eventId], phone: C.phoneE164, confirm_promotion: true, reason: 'Contre-vérification' }],
            ['PATCH', 'partner/team/settings', `/api/partner/team/settings${q}`, { reason: 'Contre-vérification' }],
            ['PATCH', 'partner/team/assignments', `/api/partner/team/assignments${q}`, { event_id: E.eventId, user_id: C.userId, can_accept_cash: true, reason: 'Contre-vérification' }],
            ['PATCH', 'partner/team/assignments/[id]', `/api/partner/team/assignments/${aid}${q}`, { can_accept_cash: true, reason: 'Contre-vérification' }, { id: aid }],
            ['PATCH', 'partner/team/entry-point', `/api/partner/team/entry-point${q}`, { event_id: E.eventId, user_id: C.userId, reason: 'Contre-vérification' }],
            ['PATCH', 'partner/team/gate', `/api/partner/team/gate${q}`, { event_id: E.eventId, user_id: C.userId, reason: 'Contre-vérification' }],
            ['DELETE', 'partner/team/controller/[controllerId]', `/api/partner/team/controller/${C.userId}${q}`, { reason: 'Contre-vérification' }, { controllerId: C.userId }],
            ['DELETE', 'partner/team/[eventId]', `/api/partner/team/${E.eventId}${q}`, { reason: 'Contre-vérification' }, { eventId: E.eventId }],
            ['DELETE', 'partner/team/all', `/api/partner/team/all${q}`, { reason: 'Contre-vérification' }],
            ['DELETE', 'partner/team/invitations/[id]', `/api/partner/team/invitations/${invitationId}${q}`, { reason: 'Contre-vérification' }, { id: invitationId }],
        ];
        // Actions d'une invitation rangées dans un sous-dossier (renvoyer, annuler), s'il y en a
        const base = path.join(process.cwd(), 'app', 'api', 'partner', 'team', 'invitations', '[id]');
        for (const action of fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []) {
            writes.push(['POST', `partner/team/invitations/[id]/${action}`, `/api/partner/team/invitations/${invitationId}/${action}${q}`, { reason: 'Contre-vérification' }, { id: invitationId }]);
        }
        const out: string[] = [];
        const wrong: string[] = [];
        for (const [method, rel, url, body, params] of writes) {
            const r: Reply = await call(method, rel, { token: reader.accessToken, path: url, body, params: params ?? {} });
            out.push(`${method} ${rel} → ${r.status} ${String(r.body.code ?? '')}`);
            if (r.status !== 403) wrong.push(`${method} ${rel} : ${show(r)}`);
        }
        const after0 = await teamState(P);
        console.log(`[CVF3D-5b] lecture : liste ${list.status} (${Array.isArray(list.body.organizers) ? (list.body.organizers as unknown[]).length : '?'} organisatrices), équipe ${show(team).slice(0, 160)}`);
        console.log(`[CVF3D-5b] écritures : ${out.join(' | ')}`);
        assert.equal(list.status, 200, `témoin, liste : ${show(list)}`);
        assert.equal(team.status, 200, `témoin, équipe : ${show(team)}`);
        assert.deepEqual(wrong, [], `écritures non refusées (403) à un admin events.read :\n${wrong.join('\n')}`);
        assert.equal(after0, before0, 'l\'équipe de l\'organisatrice a changé');
    });
});

describe('5. une partenaire qui se sert du choix', () => {
    test('c. liste refusée ; ?partnerId= et ?eventId= d\'une autre : sa propre équipe ou refus ; invitation sur l\'événement d\'une autre refusée', async () => {
        const list = await call('GET', 'partner/team/organizers', { token: P.accessToken });
        const viaPartner = await call('GET', 'partner/team', { token: P.accessToken, path: `/api/partner/team?partnerId=${P2.partnerId}` });
        const viaEvent = await call('GET', 'partner/team', { token: P.accessToken, path: `/api/partner/team?eventId=${E2.eventId}` });
        const invitesBefore = (await service.from('controller_invitations').select('id').eq('partner_id', P2.partnerId)).data?.length ?? 0;
        const invite = await call('POST', 'partner/team/invite', {
            token: P.accessToken, path: `/api/partner/team/invite?partnerId=${P2.partnerId}`,
            body: { event_ids: [E2.eventId], phone: C.phoneE164, confirm_promotion: true },
        });
        const invitesAfter = (await service.from('controller_invitations').select('id').eq('partner_id', P2.partnerId)).data?.length ?? 0;
        const text = JSON.stringify(viaPartner.body);
        const leaked = [P2.partnerId, C2.userId, C2.phoneE164, E2.eventId].filter((v) => text.includes(v));
        console.log(`[CVF3D-5c] liste : ${show(list)} ; ?partnerId= d'une autre : ${viaPartner.status}, acts_as_admin ${String(viaPartner.body.acts_as_admin)}, données de l'autre : ${leaked.length === 0 ? 'aucune' : leaked.join(', ')} ; ?eventId= d'une autre : ${show(viaEvent)} ; invitation sur l'événement d'une autre : ${show(invite)} (invitations de l'autre : ${invitesBefore} → ${invitesAfter})`);
        assert.equal(list.status, 403, show(list));
        assert.ok(viaPartner.status === 200 ? leaked.length === 0 && viaPartner.body.acts_as_admin === false : viaPartner.status >= 400, `?partnerId= d'une autre : ${show(viaPartner)}`);
        assert.ok(viaEvent.status === 404 || viaEvent.status === 403, show(viaEvent));
        assert.ok(invite.status >= 400, `invitation sur l'événement d'une autre : ${show(invite)}`);
        assert.equal(invitesAfter, invitesBefore, 'invitation créée chez l\'autre organisatrice');
    });

    test('d. la liste ne rend que nom, ville, statut et identifiant de fiche', async () => {
        const reader = await newAdmin('cvf3d5-d', ['events.read']);
        const r = await call('GET', 'partner/team/organizers', { token: reader.accessToken, path: '/api/partner/team/organizers?q=cvf3d5' });
        const items = (Array.isArray(r.body.organizers) ? r.body.organizers : []) as Row[];
        assert.ok(items.some((x) => x.partner_id === P.partnerId), `fiche de P absente de la recherche (montage) : ${show(r)}`);
        const keys = [...new Set(items.flatMap((x) => Object.keys(x)))].sort();
        const text = JSON.stringify(r.body);
        const leaked = [P.phoneE164, P.phone9, P.email, P.userId, P2.phoneE164, P2.email, P2.userId].filter((v) => text.includes(v));
        console.log(`[CVF3D-5d] ${r.status} ; ${items.length} organisatrice(s) ; champs : ${keys.join(', ')} ; données de compte : ${leaked.length === 0 ? 'aucune' : leaked.join(', ')}`);
        assert.equal(r.status, 200, show(r));
        assert.ok(keys.every((k) => ['city', 'name', 'partner_id', 'status'].includes(k)), `champs en plus : ${keys.join(', ')}`);
        assert.deepEqual(leaked, []);
    });
});
