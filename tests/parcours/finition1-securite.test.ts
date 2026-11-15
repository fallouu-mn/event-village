/**
 * Finition 1 (équipe) — sécurité, prouvée avant tout changement d'écran (consigne : « LA SÉCURITÉ PASSE AVANT TOUT »).
 *
 *  S1 (faille, corrigée en premier) : la politique de lecture `ec_select_by_creator` de event_controllers
 *     (20260904000002_event_controllers.sql:21-24, jamais reprise depuis) laisse lire une affectation à qui l'a créée
 *     (`created_by = auth.uid()`), sans statut du compte ni propriété actuelle de l'événement. Mesuré :
 *       a. un admin qui a affecté un contrôleur, puis perd son rôle ADMIN, lit encore cette affectation par la REST ;
 *       b. une partenaire SUSPENDUE dont le jeton n'a pas expiré (jwt_expiry 3600 s) lit encore les affectations de
 *          son équipe par la REST (même famille qu'AUD-06, fermée pour les aides RLS au lot 9 quater mais pas ici).
 *     Attendu : aucune ligne dans ces deux cas ; la partenaire active lit toujours son équipe, le contrôleur sa ligne.
 *  Cloisonnement (routes nouvelles de la finition) : une partenaire ne lit ni n'agit sur l'équipe d'une autre, ni par
 *     l'identifiant d'un événement, ni par celui d'une invitation, ni en passant partnerId ; rien ne change chez l'autre.
 *  Un contrôleur ne voit pas les autres contrôleurs (garde-fou : vert avant, la REST ne lui rend que sa ligne).
 *  Une fiche partenaire non validée n'agit pas (garde des routes /api/partner/*, lot 9 quinquies).
 *  « Renvoyer » ne permet pas d'envoyer des SMS en masse : quota par numéro (INVITE_PER_PHONE_DAY = 3 en test) et par
 *     organisateur (INVITE_PER_PARTNER_HOUR), réservés AVANT la RPC ; au-delà, 429 et aucun SMS de plus.
 * Montage par le service_role ; attaques avec la clé anon et la session de l'acteur, ou par les routes.
 * Fin de suite : assertFinition1Invariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { invoke, routeHandler, show, type Row } from './pilotage-helpers';
import { routeContext } from './helpers';
import { outboxRows } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 20 }];
const TEAM_ROUTE = '../../app/api/partner/team/route';
const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const RESEND_ROUTE = '../../app/api/partner/team/invitations/[id]/resend/route';
const CANCEL_ROUTE = '../../app/api/partner/team/invitations/[id]/cancel/route';
const CLEAR_ROUTE = '../../app/api/partner/team/invitations/[id]/route';
const SETTINGS_ROUTE = '../../app/api/partner/team/settings/route';

function asUser(accessToken: string) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}

async function restAssignments(accessToken: string, filter: { eventId?: string; createdBy?: string }): Promise<Row[]> {
    let q = asUser(accessToken).from('event_controllers').select('id, event_id, user_id, created_by');
    if (filter.eventId) q = q.eq('event_id', filter.eventId);
    if (filter.createdBy) q = q.eq('created_by', filter.createdBy);
    const { data, error } = await q;
    assert.equal(error, null, `lecture REST de event_controllers : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function teamGet(token: string, query: string) {
    const GET = await routeHandler(TEAM_ROUTE, 'GET', 'GET /api/partner/team');
    return invoke(GET, jsonRequest(`/api/partner/team${query}`, 'GET', token));
}

async function inviteExisting(partner: TestPartner, eventId: string, holder: Buyer) {
    const POST = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
    const res = await invoke(POST, jsonRequest('/api/partner/team/invite', 'POST', partner.accessToken, {
        event_ids: [eventId], phone: holder.phoneE164, confirm_promotion: true,
    }));
    assert.equal(res.status, 201, `invitation du titulaire ${holder.phoneE164} : ${show(res)}`);
    assert.equal(typeof res.body.invitation_id, 'string', `identifiant de l'invitation : ${show(res)}`);
    return String(res.body.invitation_id);
}

async function invitationAction(route: string, method: string, token: string, invitationId: string, body: Row = {}) {
    const handler = await routeHandler(route, method, `${method} ${route}`);
    const path = route === CLEAR_ROUTE ? `/api/partner/team/invitations/${invitationId}` : `/api/partner/team/invitations/${invitationId}/${route === RESEND_ROUTE ? 'resend' : 'cancel'}`;
    return invoke(handler, jsonRequest(path, method, token, body), routeContext({ id: invitationId }));
}

async function invitationRow(id: string): Promise<Row> {
    const { data, error } = await service.from('controller_invitations').select('*').eq('id', id).single();
    assert.equal(error, null, `invitation ${id} : ${error?.message}`);
    return data as Row;
}

let partnerA: TestPartner;
let partnerB: TestPartner;
let evA: SaleEvent;

before(async () => {
    partnerA = await newPartner('f1-sec-a');
    partnerB = await newPartner('f1-sec-b');
    evA = await createTimedEvent(partnerA.partnerId, 'f1-sec-a', CATEGORIES, { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('finition1-securite');
});

describe('S1 — lecture de event_controllers par la REST : propriété actuelle et compte actif', () => {
    test('a. un admin rétrogradé ne lit plus l’affectation qu’il avait créée', async () => {
        const admin = await newAdmin('f1-retro', ['events.write']);
        const controller = await newController(partnerA, null, { label: 'f1-retro' });
        const { error } = await service.from('event_controllers').insert({ event_id: evA.eventId, user_id: controller.userId, created_by: admin.userId });
        assert.equal(error, null, `affectation créée par l'admin (montage) : ${error?.message}`);
        const { error: delErr } = await service.from('user_roles').delete().eq('user_id', admin.userId).eq('role', 'ADMIN');
        assert.equal(delErr, null, `rôle ADMIN retiré (montage) : ${delErr?.message}`);
        const rows = await restAssignments(admin.accessToken, { createdBy: admin.userId });
        console.log(`[F1-S1a] admin rétrogradé, affectations lues par la REST : ${rows.length}`);
        assert.deepEqual(rows, [], `un compte qui n'est plus admin lit encore ${rows.length} affectation(s) qu'il avait créée(s)`);
    });

    test('b. une partenaire suspendue (jeton encore valable) ne lit plus son équipe ; active, elle la lit', async () => {
        const partner = await newPartner('f1-susp');
        const ev = await createTimedEvent(partner.partnerId, 'f1-susp', CATEGORIES, { startsInHours: 48 });
        await newController(partner, ev.eventId, { label: 'f1-susp' });
        const before = await restAssignments(partner.accessToken, { eventId: ev.eventId });
        assert.equal(before.length, 1, `témoin : la partenaire active lit son équipe (${before.length} ligne)`);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', partner.userId);
        assert.equal(error, null, `suspension (montage) : ${error?.message}`);
        const after = await restAssignments(partner.accessToken, { eventId: ev.eventId });
        console.log(`[F1-S1b] partenaire suspendue, affectations lues avec l'ancien jeton : ${after.length}`);
        assert.deepEqual(after, [], `une partenaire suspendue lit encore ${after.length} affectation(s) de son équipe`);
    });

    test('garde-fou : un contrôleur ne voit que sa propre affectation, ni la ligne ni le compte des autres', async () => {
        const c1 = await newController(partnerA, evA.eventId, { label: 'f1-c1' });
        const c2 = await newController(partnerA, evA.eventId, { label: 'f1-c2' });
        const rows = await restAssignments(c1.accessToken, { eventId: evA.eventId });
        assert.deepEqual(rows.map((r) => r.user_id), [c1.userId], `le contrôleur lit d'autres affectations : ${JSON.stringify(rows)}`);
        const { data: other, error } = await asUser(c1.accessToken).from('users').select('id, phone').eq('id', c2.userId);
        assert.equal(error, null, `lecture REST de users : ${error?.message}`);
        assert.deepEqual(other ?? [], [], 'le contrôleur lit le compte d’un autre contrôleur');
        const res = await teamGet(c1.accessToken, `?eventId=${evA.eventId}`);
        assert.equal(res.status, 403, `GET /api/partner/team par un contrôleur : ${show(res)}`);
    });
});

describe('Cloisonnement entre partenaires (routes de l’équipe)', () => {
    test('la partenaire B ne lit pas l’équipe de A, ni par l’événement ni en passant partnerId', async () => {
        const holder = await newBuyer('f1-iso-holder');
        await inviteExisting(partnerA, evA.eventId, holder);
        const byEvent = await teamGet(partnerB.accessToken, `?eventId=${evA.eventId}`);
        assert.equal(byEvent.status, 404, `B lit l'équipe d'un événement de A : ${show(byEvent)}`);
        const byPartner = await teamGet(partnerB.accessToken, `?partnerId=${partnerA.partnerId}`);
        assert.equal(byPartner.status, 200, `équipe de B : ${show(byPartner)}`);
        assert.equal(byPartner.body.partner_id, partnerB.partnerId, `partnerId de A accepté pour B : ${show(byPartner)}`);
        const text = JSON.stringify(byPartner.body);
        assert.ok(!text.includes(holder.phoneE164) && !text.includes(evA.eventId), 'l’équipe de B contient des données de A');
    });

    test('la partenaire B n’agit sur aucune invitation ni aucun réglage de A ; rien ne change chez A', async () => {
        const holder = await newBuyer('f1-iso-act');
        const invitationId = await inviteExisting(partnerA, evA.eventId, holder);
        const c = await newController(partnerA, evA.eventId, { label: 'f1-iso-ctrl' });
        for (const [route, method] of [[RESEND_ROUTE, 'POST'], [CANCEL_ROUTE, 'POST'], [CLEAR_ROUTE, 'DELETE']] as const) {
            const res = await invitationAction(route, method, partnerB.accessToken, invitationId);
            assert.equal(res.status, 404, `${method} ${route} par B sur l'invitation de A : ${show(res)}`);
        }
        const PATCH = await routeHandler(SETTINGS_ROUTE, 'PATCH', 'PATCH /api/partner/team/settings');
        const res = await invoke(PATCH, jsonRequest('/api/partner/team/settings', 'PATCH', partnerB.accessToken, {
            eventId: evA.eventId, controllerId: c.userId, canAcceptCash: true, entryPoint: 'Porte B',
        }));
        assert.equal(res.status, 404, `réglages d'un contrôleur de A par B : ${show(res)}`);
        const inv = await invitationRow(invitationId);
        assert.equal(inv.status, 'PENDING', 'invitation de A modifiée par B');
        assert.equal(Number(inv.send_count), 1, 'invitation de A renvoyée par B');
        const { data: ec } = await service.from('event_controllers').select('can_accept_cash, entry_point').eq('event_id', evA.eventId).eq('user_id', c.userId).single();
        assert.deepEqual(ec, { can_accept_cash: false, entry_point: null }, 'réglages du contrôleur de A modifiés par B');
    });
});

describe('Fiche partenaire non validée', () => {
    test('une partenaire dont la fiche attend la validation ne lit ni n’agit sur l’équipe', async () => {
        const partner = await newPartner('f1-attente');
        const ev = await createTimedEvent(partner.partnerId, 'f1-attente', CATEGORIES, { startsInHours: 48 });
        const holder = await newBuyer('f1-attente-holder');
        const invitationId = await inviteExisting(partner, ev.eventId, holder);
        const { error } = await service.from('partners').update({ status: 'EN_ATTENTE' }).eq('id', partner.partnerId);
        assert.equal(error, null, `fiche remise en attente (montage) : ${error?.message}`);
        const read = await teamGet(partner.accessToken, '');
        assert.equal(read.status, 403, `lecture de l'équipe, fiche en attente : ${show(read)}`);
        assert.equal(read.body.code, 'PARTNER_NOT_VALIDATED', show(read));
        const cancel = await invitationAction(CANCEL_ROUTE, 'POST', partner.accessToken, invitationId);
        assert.equal(cancel.status, 403, `annulation, fiche en attente : ${show(cancel)}`);
        assert.equal((await invitationRow(invitationId)).status, 'PENDING', 'invitation annulée malgré la fiche en attente');
        const { error: back } = await service.from('partners').update({ status: 'VALIDE' }).eq('id', partner.partnerId);
        assert.equal(back, null, `fiche revalidée (fin de test) : ${back?.message}`);
    });
});

describe('« Renvoyer » ne permet pas d’envoyer des SMS en masse', () => {
    test('renvois plafonnés par numéro (3 par jour en test) : 429 au-delà, aucun SMS de plus', async () => {
        const holder = await newBuyer('f1-renvoi');
        const invitationId = await inviteExisting(partnerA, evA.eventId, holder); // 1 unité du numéro
        const statuses: number[] = [];
        for (let i = 0; i < 4; i += 1) {
            const res = await invitationAction(RESEND_ROUTE, 'POST', partnerA.accessToken, invitationId);
            statuses.push(res.status);
            if (res.status === 429) assert.equal(res.body.code, 'PHONE_INVITE_RATE_LIMIT', show(res));
        }
        const sms = await outboxRows({ type: 'CONTROLLER_INVITATION', userId: holder.userId, channel: 'SMS' });
        console.log(`[F1-RENVOI] renvois : ${statuses.join(', ')} ; SMS d'invitation en file : ${sms.length}`);
        assert.deepEqual(statuses, [200, 200, 429, 429], `renvois : ${statuses.join(', ')}`);
        assert.equal(sms.length, 3, `SMS d'invitation vers le même numéro : ${sms.length} (1 invitation + 2 renvois attendus)`);
        assert.equal(Number((await invitationRow(invitationId)).send_count), 3, 'compteur d’envois de l’invitation');
    });
});
