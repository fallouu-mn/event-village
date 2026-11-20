/**
 * Finition 1 (équipe) — une seule équipe, claire, sans jargon (revue d'ergonomie, section 3.2 : E-10, E-11, E-13 à E-21).
 *
 *  E-13 : une seule lecture serveur, GET /api/partner/team (RPC partner_team_view), pour la page (tous les événements)
 *         et l'onglet du pilotage (un événement) : nom, numéro, état et date, porte ou point d'entrée, espèces, caisse
 *         ouverte, entrées et dernier scan par événement ; invitations ; événements avec leurs portes ; can_manage.
 *  E-21 : compte à activer : date d'envoi du code et échéance (« Code expiré le … » quand elle est passée).
 *  E-11, E-19 : invitations en attente, expirées, refusées et annulées visibles 30 jours, sur la page ET dans l'onglet,
 *         avec le numéro saisi ; « Annuler » (nouvel état, le lien ne mène plus à rien), « Effacer » (expirée, refusée
 *         ou annulée seulement), « Renvoyer » (+72 h).
 *  E-18 : un seul texte quand le numéro invité a déjà un compte, sans le mot « affectation ».
 *  E-10 : renvoi du SMS d'activation : « SMS renvoyé à {prénom} : code valable jusqu’au {date}. »
 *  E-14 : réglages d'un contrôleur sur un événement (porte ou point d'entrée, « Peut changer de porte », espèces) en
 *         un seul enregistrement (PATCH /api/partner/team/settings), journalisé.
 *  E-16 : « Retirer de l'équipe » : le serveur refuse le scanner dès la confirmation (scan_scanner_authorized), y
 *         compris avec une session ouverte avant ; other_organizers servi pour le texte de la fenêtre.
 *  E-20 : avis à la partenaire quand le contrôleur accepte, refuse ou laisse expirer : cloche, push, email, jamais de SMS.
 *  E-17 : un admin muni de events.write agit sur l'équipe d'un organisateur avec un motif (journal) ; sans motif, 400 ;
 *         events.read seul : lecture, can_manage faux, écritures refusées ; admin sans organisateur ni événement : 400.
 * Fin de suite : assertFinition1Invariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, myControllerInvitations, newController, respondControllerInvitation } from './acces-helpers';
import { newAdmin, outboxRows, type TestAdmin } from './notif-helpers';
import { invoke, routeHandler, show, type Row } from './pilotage-helpers';
import { randomSenegalPhone, routeContext } from './helpers';
import { formatDateTime } from '../../lib/format';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 20 }];
const TEAM_ROUTE = '../../app/api/partner/team/route';
const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const RESEND_ROUTE = '../../app/api/partner/team/invitations/[id]/resend/route';
const CANCEL_ROUTE = '../../app/api/partner/team/invitations/[id]/cancel/route';
const CLEAR_ROUTE = '../../app/api/partner/team/invitations/[id]/route';
const SETTINGS_ROUTE = '../../app/api/partner/team/settings/route';
const REMOVE_TEAM_ROUTE = '../../app/api/partner/team/controller/[controllerId]/route';
const REMINDERS_ROUTE = '../../app/api/cron/reminders/route';
const DAY = 24 * 3600_000;

let partner: TestPartner;
let evZones: SaleEvent;
let evFree: SaleEvent;
let gateId: string;

async function teamGet(token: string, query = ''): Promise<Row> {
    const GET = await routeHandler(TEAM_ROUTE, 'GET', 'GET /api/partner/team');
    const res = await invoke(GET, jsonRequest(`/api/partner/team${query}`, 'GET', token));
    assert.equal(res.status, 200, `GET /api/partner/team${query} : ${show(res)}`);
    return res.body;
}

function members(view: Row): Row[] { return (view.members ?? []) as Row[]; }
function invitations(view: Row): Row[] { return (view.invitations ?? []) as Row[]; }
function member(view: Row, userId: string): Row {
    const m = members(view).find((x) => x.user_id === userId);
    assert.ok(m, `membre ${userId} absent de la vue : ${JSON.stringify(view).slice(0, 1500)}`);
    return m;
}
function invitation(view: Row, id: string): Row | undefined { return invitations(view).find((x) => x.id === id); }

async function invite(token: string, body: Row) {
    const POST = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
    return invoke(POST, jsonRequest('/api/partner/team/invite', 'POST', token, body));
}

async function inviteExisting(eventIds: string[], holder: Buyer): Promise<string> {
    const res = await invite(partner.accessToken, { event_ids: eventIds, phone: holder.phoneE164, confirm_promotion: true });
    assert.equal(res.status, 201, `invitation de ${holder.phoneE164} : ${show(res)}`);
    return String(res.body.invitation_id);
}

async function invitationAction(kind: 'resend' | 'cancel' | 'clear', token: string, id: string, body: Row = {}) {
    const route = kind === 'resend' ? RESEND_ROUTE : kind === 'cancel' ? CANCEL_ROUTE : CLEAR_ROUTE;
    const method = kind === 'clear' ? 'DELETE' : 'POST';
    const handler = await routeHandler(route, method, `${method} ${kind}`);
    const path = kind === 'clear' ? `/api/partner/team/invitations/${id}` : `/api/partner/team/invitations/${id}/${kind}`;
    return invoke(handler, jsonRequest(path, method, token, body), routeContext({ id }));
}

async function settings(token: string, body: Row) {
    const PATCH = await routeHandler(SETTINGS_ROUTE, 'PATCH', 'PATCH /api/partner/team/settings');
    return invoke(PATCH, jsonRequest('/api/partner/team/settings', 'PATCH', token, body));
}

async function scannerAuthorized(scannerId: string, eventId: string): Promise<boolean> {
    const { data, error } = await service.rpc('scan_scanner_authorized', { p_scanner: scannerId, p_event: eventId });
    assert.equal(error, null, `scan_scanner_authorized : ${error?.message}`);
    return data === true;
}

before(async () => {
    partner = await newPartner('f1-equipe');
    evZones = await createTimedEvent(partner.partnerId, 'f1-zones', CATEGORIES, { startsInHours: 48 });
    evFree = await createTimedEvent(partner.partnerId, 'f1-libre', CATEGORIES, { startsInHours: 72 });
    const { data: zone, error: zErr } = await service.from('event_zones').insert({ event_id: evZones.eventId, name: 'Pelouse', kind: 'ENTREE' }).select('id').single();
    assert.equal(zErr, null, `zone (montage) : ${zErr?.message}`);
    const { data: gate, error: gErr } = await service.from('event_gates').insert({ event_id: evZones.eventId, zone_id: zone!.id, name: 'Porte Nord' }).select('id').single();
    assert.equal(gErr, null, `porte (montage) : ${gErr?.message}`);
    gateId = String(gate!.id);
    // Invariant (x10) du lot 9 ter : toute catégorie active d'un événement à zones est admise par une zone d'entrée
    const { error: zcErr } = await service.from('zone_categories').insert({ event_id: evZones.eventId, zone_id: zone!.id, category_id: evZones.categories.Standard.id });
    assert.equal(zcErr, null, `catégorie de la zone (montage) : ${zcErr?.message}`);
});

after(async () => {
    await assertFinition1Invariants('finition1-equipe');
});

describe('E-13, E-14 — une seule lecture pour la page et pour l’onglet', () => {
    test('page : porte, point d’entrée, espèces et caisse par événement ; onglet : cet événement seulement', async () => {
        const c = await newController(partner, evZones.eventId, { label: 'f1-vue', canAcceptCash: true });
        const { error: gErr } = await service.from('event_controllers').update({ gate_id: gateId, gate_change_allowed: true }).eq('event_id', evZones.eventId).eq('user_id', c.userId);
        assert.equal(gErr, null, `porte du contrôleur (montage) : ${gErr?.message}`);
        const { error: aErr } = await service.from('event_controllers').insert({ event_id: evFree.eventId, user_id: c.userId, created_by: partner.userId, entry_point: 'Porte Sud', can_accept_cash: false });
        assert.equal(aErr, null, `seconde affectation (montage) : ${aErr?.message}`);
        const { error: sErr } = await service.from('controller_shifts').insert({ controller_id: c.userId, event_id: evZones.eventId, partner_id: partner.partnerId });
        assert.equal(sErr, null, `caisse ouverte (montage) : ${sErr?.message}`);

        const page = await teamGet(partner.accessToken);
        assert.equal(page.partner_id, partner.partnerId);
        assert.equal(page.can_manage, true, 'la propriétaire gère son équipe');
        const m = member(page, c.userId);
        assert.equal(m.account_state, 'ACTIVE', JSON.stringify(m));
        assert.ok(typeof m.active_since === 'string' && !Number.isNaN(Date.parse(String(m.active_since))), `« Actif depuis le … » : ${JSON.stringify(m)}`);
        assert.equal(m.phone, c.phoneE164);
        const byEvent = new Map(((m.assignments ?? []) as Row[]).map((a) => [a.event_id, a]));
        const z = byEvent.get(evZones.eventId) as Row;
        const f = byEvent.get(evFree.eventId) as Row;
        assert.ok(z && f, `deux événements pour le contrôleur : ${JSON.stringify(m.assignments)}`);
        // Finition 2b (A, modification signalée au rapport) : la base pose une couleur au contrôle à toute catégorie qui n'en a
        // pas (première proposée : BLANC) ; avant, Standard restait sans couleur (null)
        assert.deepEqual(z.gate, { id: gateId, name: 'Porte Nord', zone_name: 'Pelouse', categories: [{ name: 'Standard', scan_color: 'BLANC' }] }, `porte : ${JSON.stringify(z)}`);
        assert.equal(z.gate_change_allowed, true);
        assert.equal(z.can_accept_cash, true);
        assert.equal(z.open_shift, true, 'caisse ouverte servie');
        assert.equal(z.entries, 0);
        assert.equal(f.gate, null);
        assert.equal(f.entry_point, 'Porte Sud');
        assert.equal(f.can_accept_cash, false, 'espèces par événement, pas un agrégat');
        assert.equal(f.open_shift, false);
        const evRow = ((page.events ?? []) as Row[]).find((e) => e.id === evZones.eventId);
        assert.ok(evRow, 'événement servi avec ses portes');
        assert.deepEqual(evRow.gates, [{ id: gateId, name: 'Porte Nord', zone_name: 'Pelouse', categories: [{ name: 'Standard', scan_color: 'BLANC' }] }]);
        assert.equal(evRow.has_zones, true);

        const tab = await teamGet(partner.accessToken, `?eventId=${evFree.eventId}`);
        assert.equal(((tab.event ?? {}) as Row).id, evFree.eventId, 'onglet : événement servi');
        const mt = member(tab, c.userId);
        assert.deepEqual(((mt.assignments ?? []) as Row[]).map((a) => a.event_id), [evFree.eventId], 'onglet : la seule affectation de cet événement');
        assert.ok(!members(tab).some((x) => ((x.assignments ?? []) as Row[]).some((a) => a.event_id !== evFree.eventId)), 'onglet : aucun autre événement');
    });
});

describe('E-21 — compte à activer : code envoyé le … / code expiré le …', () => {
    test('date d’envoi et échéance du code ; échéance passée servie telle quelle', async () => {
        const phone = randomSenegalPhone('77');
        const res = await invite(partner.accessToken, { event_ids: [evFree.eventId], phone, first_name: 'Awa', last_name: 'Ndiaye' });
        assert.equal(res.status, 201, `invitation d'un numéro neuf : ${show(res)}`);
        const { data: u } = await service.from('users').select('id').eq('phone', phone).single();
        const userId = String(u!.id);
        let m = member(await teamGet(partner.accessToken), userId);
        assert.equal(m.account_state, 'PENDING_ACTIVATION', JSON.stringify(m));
        const act = m.activation as Row;
        assert.ok(act && Date.parse(String(act.expires_at)) > Date.now() + 23 * 3600_000, `code valable 24 h : ${JSON.stringify(act)}`);
        assert.ok(Date.parse(String(act.sent_at)) <= Date.now(), `date d'envoi : ${JSON.stringify(act)}`);
        const { error } = await service.from('otp_codes').update({ created_at: new Date(Date.now() - 25 * 3600_000).toISOString(), expires_at: new Date(Date.now() - 3600_000).toISOString() })
            .eq('phone', phone).eq('purpose', 'CONTROLLER_SETUP');
        assert.equal(error, null, `code vieilli (montage) : ${error?.message}`);
        m = member(await teamGet(partner.accessToken), userId);
        assert.ok(Date.parse(String((m.activation as Row).expires_at)) < Date.now(), `« Code expiré le … » : ${JSON.stringify(m.activation)}`);
    });
});

describe('E-10, E-18 — textes du renvoi et du numéro qui a déjà un compte', () => {
    test('numéro qui a déjà un compte : un seul texte, sans « affectation »', async () => {
        const holder = await newBuyer('f1-e18', { firstName: 'Moustapha', lastName: 'Diallo' });
        const res = await invite(partner.accessToken, { event_ids: [evFree.eventId], phone: holder.phoneE164 });
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.requires_confirmation, true);
        assert.equal(res.body.message,
            'Ce numéro a déjà un compte Event Village (Mo*** D***). Nous lui envoyons une invitation par SMS : il contrôlera vos événements après l’avoir acceptée dans l’application, sous 72 h. Son compte, ses billets et son portefeuille ne changent pas.');
        const sent = await invite(partner.accessToken, { event_ids: [evFree.eventId], phone: holder.phoneE164, confirm_promotion: true });
        assert.equal(sent.status, 201, show(sent));
        assert.equal(sent.body.message, `Invitation envoyée à Mo*** D*** : réponse attendue avant le ${formatDateTime(String(sent.body.invitation_expires_at))}.`);
        assert.ok(!/affectation/i.test(String(res.body.message) + String(sent.body.message)), 'mot « affectation » à l’écran');
    });

    test('renvoi du SMS d’activation : « SMS renvoyé à {prénom} : code valable jusqu’au {date}. »', async () => {
        const phone = randomSenegalPhone('76');
        const first = await invite(partner.accessToken, { event_ids: [evFree.eventId], phone, first_name: 'Fatou', last_name: 'Sarr' });
        assert.equal(first.status, 201, show(first));
        const again = await invite(partner.accessToken, { event_ids: [evFree.eventId], phone, resend: true });
        assert.equal(again.status, 200, show(again));
        const { data: otp } = await service.from('otp_codes').select('expires_at').eq('phone', phone).eq('purpose', 'CONTROLLER_SETUP')
            .order('created_at', { ascending: false }).limit(1).single();
        assert.equal(again.body.message, `SMS renvoyé à Fatou : code valable jusqu’au ${formatDateTime(String(otp!.expires_at))}.`);
    });
});

describe('E-11, E-19 — invitations visibles, annulées, effacées, renvoyées', () => {
    test('en attente : numéro saisi, nom masqué, sur la page ET dans l’onglet ; renvoi : +72 h', async () => {
        const holder = await newBuyer('f1-attente', { firstName: 'Lamine', lastName: 'Cisse' });
        const id = await inviteExisting([evFree.eventId], holder);
        for (const view of [await teamGet(partner.accessToken), await teamGet(partner.accessToken, `?eventId=${evFree.eventId}`)]) {
            const inv = invitation(view, id);
            assert.ok(inv, `invitation absente de la vue (${view.event ? 'onglet' : 'page'})`);
            assert.equal(inv.state, 'PENDING');
            assert.equal(inv.phone_entered, holder.phoneE164, 'numéro saisi par la partenaire');
            assert.equal(inv.display_name, 'La*** C***');
            assert.deepEqual(((inv.events ?? []) as Row[]).map((e) => e.id), [evFree.eventId]);
        }
        const before = Date.parse(String(invitation(await teamGet(partner.accessToken), id)!.expires_at));
        const { error } = await service.from('controller_invitations').update({ expires_at: new Date(Date.now() + 3600_000).toISOString() }).eq('id', id);
        assert.equal(error, null);
        const res = await invitationAction('resend', partner.accessToken, id);
        assert.equal(res.status, 200, show(res));
        const after = Date.parse(String(invitation(await teamGet(partner.accessToken), id)!.expires_at));
        assert.ok(after > Date.now() + 71 * 3600_000 && after >= before - 60_000, `invitation prolongée de 72 h : ${new Date(after).toISOString()}`);
    });

    test('refusée et expirée : visibles avec leur date ; effacées : disparaissent ; plus de 30 jours : absentes', async () => {
        const declined = await newBuyer('f1-refus');
        const idDeclined = await inviteExisting([evFree.eventId], declined);
        const r = await respondControllerInvitation(declined, idDeclined, false);
        assert.equal(r.status, 200, `refus : ${JSON.stringify(r.body)}`);
        const expired = await newBuyer('f1-expire');
        const idExpired = await inviteExisting([evFree.eventId], expired);
        await service.from('controller_invitations').update({ created_at: new Date(Date.now() - 4 * DAY).toISOString(), expires_at: new Date(Date.now() - DAY).toISOString() }).eq('id', idExpired);
        const old = await newBuyer('f1-ancienne');
        const idOld = await inviteExisting([evFree.eventId], old);
        await service.from('controller_invitations').update({ status: 'DECLINED', created_at: new Date(Date.now() - 40 * DAY).toISOString(), expires_at: new Date(Date.now() - 37 * DAY).toISOString(), responded_at: new Date(Date.now() - 31 * DAY).toISOString() }).eq('id', idOld);

        let view = await teamGet(partner.accessToken);
        assert.equal(invitation(view, idDeclined)?.state, 'DECLINED');
        assert.ok(invitation(view, idDeclined)?.responded_at, '« Refusée le … »');
        assert.equal(invitation(view, idExpired)?.state, 'EXPIRED', 'en attente échue : servie comme expirée');
        assert.equal(invitation(view, idOld), undefined, 'invitation de plus de 30 jours encore affichée');

        for (const id of [idDeclined, idExpired]) {
            const res = await invitationAction('clear', partner.accessToken, id);
            assert.equal(res.status, 200, `effacer ${id} : ${show(res)}`);
        }
        view = await teamGet(partner.accessToken);
        assert.equal(invitation(view, idDeclined), undefined);
        assert.equal(invitation(view, idExpired), undefined);
    });

    test('annuler : le lien ne mène plus à rien ; une invitation en attente ne s’efface pas', async () => {
        const holder = await newBuyer('f1-annule');
        const id = await inviteExisting([evFree.eventId], holder);
        const clear = await invitationAction('clear', partner.accessToken, id);
        assert.equal(clear.status, 409, `effacer une invitation en attente : ${show(clear)}`);
        assert.equal(clear.body.error, 'Cette invitation attend encore une réponse : annulez-la d’abord.');
        const cancel = await invitationAction('cancel', partner.accessToken, id);
        assert.equal(cancel.status, 200, show(cancel));
        assert.equal(invitation(await teamGet(partner.accessToken), id)?.state, 'CANCELLED');
        const mine = await myControllerInvitations(holder);
        assert.deepEqual(((mine.body.items ?? []) as Row[]).filter((i) => i.id === id), [], 'invitation annulée encore proposée au titulaire');
        const answer = await respondControllerInvitation(holder, id, true);
        assert.equal(answer.status, 410, `réponse à une invitation annulée : ${JSON.stringify(answer.body)}`);
        assert.equal(answer.body.error, 'L’organisateur a annulé cette invitation.');
        const { data: ec } = await service.from('event_controllers').select('id').eq('user_id', holder.userId);
        assert.deepEqual(ec ?? [], [], 'affectation posée malgré l’annulation');
        const again = await invitationAction('resend', partner.accessToken, id);
        assert.equal(again.status, 409, `renvoi d'une invitation annulée : ${show(again)}`);
    });
});

describe('E-14 — réglages d’un contrôleur en un seul enregistrement', () => {
    test('sans zone : point d’entrée et espèces ; à zones : porte, « Peut changer de porte », espèces ; porte inconnue refusée', async () => {
        const c = await newController(partner, evFree.eventId, { label: 'f1-reglages' });
        await service.from('event_controllers').insert({ event_id: evZones.eventId, user_id: c.userId, created_by: partner.userId });
        const free = await settings(partner.accessToken, { eventId: evFree.eventId, controllerId: c.userId, entryPoint: 'Porte Est', canAcceptCash: true });
        assert.equal(free.status, 200, show(free));
        const zoned = await settings(partner.accessToken, { eventId: evZones.eventId, controllerId: c.userId, gateId, gateChangeAllowed: true, canAcceptCash: false });
        assert.equal(zoned.status, 200, show(zoned));
        const { data: rows } = await service.from('event_controllers').select('event_id, entry_point, gate_id, gate_change_allowed, can_accept_cash').eq('user_id', c.userId);
        const byEvent = new Map((rows ?? []).map((x: Row) => [x.event_id, x]));
        assert.deepEqual(byEvent.get(evFree.eventId), { event_id: evFree.eventId, entry_point: 'Porte Est', gate_id: null, gate_change_allowed: false, can_accept_cash: true });
        assert.deepEqual(byEvent.get(evZones.eventId), { event_id: evZones.eventId, entry_point: 'Porte Nord', gate_id: gateId, gate_change_allowed: true, can_accept_cash: false });
        const bad = await settings(partner.accessToken, { eventId: evZones.eventId, controllerId: c.userId, gateId: evFree.eventId, canAcceptCash: false });
        assert.equal(bad.status, 409, `porte inconnue : ${show(bad)}`);
        const { data: audit } = await service.from('audit_logs').select('action').eq('action', 'CONTROLLER_SETTINGS_SET').eq('user_id', partner.userId);
        assert.ok((audit ?? []).length >= 2, 'réglages journalisés');
    });
});

describe('E-16 — « Retirer de l’équipe » ferme le scanner tout de suite', () => {
    test('après le retrait, le serveur refuse le scanner (session ouverte avant comprise) ; other_organizers servi', async () => {
        const other = await newPartner('f1-autre');
        const evOther = await createTimedEvent(other.partnerId, 'f1-autre', CATEGORIES, { startsInHours: 48 });
        const c = await newController(partner, evFree.eventId, { label: 'f1-retrait' });
        await service.from('event_controllers').insert({ event_id: evOther.eventId, user_id: c.userId, created_by: other.userId });
        assert.equal(member(await teamGet(partner.accessToken), c.userId).other_organizers, true, 'contrôle aussi pour un autre organisateur');
        assert.equal(await scannerAuthorized(c.userId, evFree.eventId), true, 'témoin : scanner autorisé avant');
        const DELETE = await routeHandler(REMOVE_TEAM_ROUTE, 'DELETE', 'DELETE /api/partner/team/controller/[controllerId]');
        const res = await invoke(DELETE, jsonRequest(`/api/partner/team/controller/${c.userId}`, 'DELETE', partner.accessToken), routeContext({ controllerId: c.userId }));
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.deactivated, false, 'il garde son rôle : il contrôle ailleurs');
        assert.equal(await scannerAuthorized(c.userId, evFree.eventId), false, 'scanner encore autorisé après le retrait');
        assert.equal(await scannerAuthorized(c.userId, evOther.eventId), true, 'retrait chez l’autre organisateur');
        assert.equal(members(await teamGet(partner.accessToken)).some((m) => m.user_id === c.userId), false, 'encore dans l’équipe');
    });
});

describe('E-20 — avis à la partenaire : acceptée, refusée, expirée (cloche, push, email ; aucun SMS)', () => {
    async function partnerNotices(type: string): Promise<Row[]> {
        return (await outboxRows({ type, userId: partner.userId })) as unknown as Row[];
    }
    function checkChannels(rows: Row[], what: string): void {
        const channels = new Set(rows.map((r) => String(r.channel)));
        assert.ok(channels.has('IN_APP'), `${what} : cloche absente (${[...channels].join(', ')})`);
        // Finition 4 (décision du client du 19/11 : chaque étape importante sur les 4 canaux ; modification signalée au rapport) : la partenaire est prévenue aussi par SMS
        assert.ok(channels.has('SMS'), `${what} : SMS absent pour la partenaire`);
        for (const ch of channels) assert.ok(['IN_APP', 'PUSH', 'EMAIL', 'SMS'].includes(ch), `${what} : canal ${ch}`);
    }

    test('acceptée et refusée : un avis chacun, avec le nom', async () => {
        const yes = await newBuyer('f1-oui', { firstName: 'Aminata', lastName: 'Fall' });
        const idYes = await inviteExisting([evFree.eventId], yes);
        const no = await newBuyer('f1-non', { firstName: 'Ousmane', lastName: 'Ba' });
        const idNo = await inviteExisting([evFree.eventId], no);
        assert.equal((await respondControllerInvitation(yes, idYes, true)).status, 200);
        assert.equal((await respondControllerInvitation(no, idNo, false)).status, 200);
        const accepted = (await partnerNotices('CONTROLLER_INVITATION_ACCEPTED')).filter((r) => String(r.idempotency_key).includes(idYes));
        const declined = (await partnerNotices('CONTROLLER_INVITATION_DECLINED')).filter((r) => String(r.idempotency_key).includes(idNo));
        checkChannels(accepted, 'acceptée');
        checkChannels(declined, 'refusée');
        assert.ok(JSON.stringify(accepted).includes('Aminata'), 'nom du contrôleur dans l’avis');
        assert.equal(member(await teamGet(partner.accessToken), yes.userId).account_state, 'ACTIVE', 'la ligne passe à « Prêt »');
    });

    test('expirée : la tâche planifiée la clôt et prévient la partenaire une seule fois', async () => {
        const late = await newBuyer('f1-tard', { firstName: 'Khady', lastName: 'Sow' });
        const id = await inviteExisting([evFree.eventId], late);
        await service.from('controller_invitations').update({ created_at: new Date(Date.now() - 4 * DAY).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
        const run = async () => {
            const GET = await routeHandler(REMINDERS_ROUTE, 'GET', 'GET /api/cron/reminders');
            return invoke(GET, jsonRequest('/api/cron/reminders', 'GET', null, undefined, { authorization: `Bearer ${process.env.CRON_SECRET}` }));
        };
        assert.equal((await run()).status, 200);
        assert.equal((await run()).status, 200);
        const { data: row } = await service.from('controller_invitations').select('status').eq('id', id).single();
        assert.equal(row!.status, 'EXPIRED');
        const notices = (await partnerNotices('CONTROLLER_INVITATION_EXPIRED')).filter((r) => String(r.idempotency_key).includes(id));
        checkChannels(notices, 'expirée');
        assert.equal(notices.filter((r) => r.channel === 'IN_APP').length, 1, 'un seul avis malgré deux passages');
    });
});

describe('E-17 — droits de l’admin sur l’équipe', () => {
    let writer: TestAdmin;
    let reader: TestAdmin;
    before(async () => {
        writer = await newAdmin('f1-ecrit', ['events.write', 'events.read']);
        reader = await newAdmin('f1-lit', ['events.read']);
    });

    test('sans organisateur ni événement : 400 ; avec : can_manage selon la permission', async () => {
        const GET = await routeHandler(TEAM_ROUTE, 'GET', 'GET /api/partner/team');
        const none = await invoke(GET, jsonRequest('/api/partner/team', 'GET', writer.accessToken));
        assert.equal(none.status, 400, show(none));
        assert.equal(none.body.error, 'Choisissez l’organisateur dont vous gérez l’équipe.');
        assert.equal((await teamGet(writer.accessToken, `?partnerId=${partner.partnerId}`)).can_manage, true);
        assert.equal((await teamGet(reader.accessToken, `?partnerId=${partner.partnerId}`)).can_manage, false);
        assert.equal((await teamGet(writer.accessToken, `?eventId=${evFree.eventId}`)).partner_id, partner.partnerId);
    });

    test('events.write : motif exigé puis journalisé ; events.read : écriture refusée', async () => {
        const holder = await newBuyer('f1-admin-inv');
        const id = await inviteExisting([evFree.eventId], holder);
        const ro = await invitationAction('cancel', reader.accessToken, id, { reason: 'Demande de l’organisateur par téléphone' });
        assert.equal(ro.status, 403, show(ro));
        const noReason = await invitationAction('cancel', writer.accessToken, id);
        assert.equal(noReason.status, 400, show(noReason));
        assert.equal(noReason.body.code, 'REASON_REQUIRED');
        const ok = await invitationAction('cancel', writer.accessToken, id, { reason: 'Demande de l’organisateur par téléphone' });
        assert.equal(ok.status, 200, show(ok));
        const { data: audit } = await service.from('audit_logs').select('user_role, metadata').eq('action', 'CONTROLLER_INVITATION_CANCELLED').eq('object_id', id).single();
        assert.equal(audit!.user_role, 'ADMIN');
        assert.equal((audit!.metadata as Row).reason, 'Demande de l’organisateur par téléphone');

        const c = await newController(partner, evFree.eventId, { label: 'f1-admin-reg' });
        const noMotif = await settings(writer.accessToken, { eventId: evFree.eventId, controllerId: c.userId, entryPoint: 'Guichet', canAcceptCash: true });
        assert.equal(noMotif.status, 400, show(noMotif));
        const withMotif = await settings(writer.accessToken, { eventId: evFree.eventId, controllerId: c.userId, entryPoint: 'Guichet', canAcceptCash: true, reason: 'Renfort au guichet demandé par l’organisateur' });
        assert.equal(withMotif.status, 200, show(withMotif));
        const denied = await settings(reader.accessToken, { eventId: evFree.eventId, controllerId: c.userId, entryPoint: 'X', canAcceptCash: false, reason: 'Essai sans la permission' });
        assert.equal(denied.status, 403, show(denied));
    });
});

describe('Complément 9 — portes et couleurs dans l’équipe', () => {
    test('porte : ce qu’elle laisse entrer, avec la couleur au contrôle ; avertissements ; porte choisie dans la liste seulement', async () => {
        const ev = await createTimedEvent(partner.partnerId, 'f1-couleurs', [
            { name: 'Simple', price: 2_000, total: 20 }, { name: 'VIP', price: 5_000, total: 10 }, { name: 'VVIP', price: 9_000, total: 5 },
        ], { startsInHours: 48 });
        for (const [name, color] of [['VIP', 'OR'], ['VVIP', 'VIOLET']] as const) {
            const { error } = await service.from('ticket_categories').update({ scan_color: color }).eq('id', ev.categories[name].id);
            assert.equal(error, null, `couleur de ${name} (montage) : ${error?.message}`);
        }
        const { data: zone, error: zErr } = await service.from('event_zones').insert({ event_id: ev.eventId, name: 'Carré', kind: 'ENTREE' }).select('id').single();
        assert.equal(zErr, null, `zone (montage) : ${zErr?.message}`);
        for (const name of ['VIP', 'VVIP']) {
            const inserted: { error: { message: string } | null } = await service.from('zone_categories').insert({ event_id: ev.eventId, zone_id: zone!.id, category_id: ev.categories[name].id });
            assert.equal(inserted.error, null, `catégorie ${name} de la zone (montage) : ${inserted.error?.message}`);
        }
        // « Simple » est admise par une zone d'entrée sans porte (invariant (x10) respecté) : aucune porte ne la laisse entrer
        const { data: annexe, error: aErr } = await service.from('event_zones').insert({ event_id: ev.eventId, name: 'Annexe', kind: 'ENTREE', position: 1 }).select('id').single();
        assert.equal(aErr, null, `zone sans porte (montage) : ${aErr?.message}`);
        const simple: { error: { message: string } | null } = await service.from('zone_categories').insert({ event_id: ev.eventId, zone_id: annexe!.id, category_id: ev.categories.Simple.id });
        assert.equal(simple.error, null, `catégorie Simple de la zone sans porte (montage) : ${simple.error?.message}`);
        const { data: gVip } = await service.from('event_gates').insert({ event_id: ev.eventId, zone_id: zone!.id, name: 'Porte VIP' }).select('id').single();
        await service.from('event_gates').insert({ event_id: ev.eventId, zone_id: zone!.id, name: 'Porte Est' });
        const c = await newController(partner, ev.eventId, { label: 'f1-couleurs' });
        await service.from('event_controllers').update({ gate_id: gVip!.id }).eq('event_id', ev.eventId).eq('user_id', c.userId);

        const view = await teamGet(partner.accessToken, `?eventId=${ev.eventId}`);
        const a = ((member(view, c.userId).assignments ?? []) as Row[])[0];
        assert.deepEqual((a.gate as Row).categories, [{ name: 'VIP', scan_color: 'OR' }, { name: 'VVIP', scan_color: 'VIOLET' }],
            `« Porte VIP — laisse entrer : VIP (or), VVIP (violet) » : ${JSON.stringify(a.gate)}`);
        const evRow = ((view.events ?? []) as Row[])[0];
        // Finition 2b (A, modification signalée au rapport) : Simple, insérée la première, a reçu BLANC de la base (avant : null)
        assert.deepEqual(evRow.uncovered_categories, [{ name: 'Simple', scan_color: 'BLANC' }], 'catégorie en vente acceptée par aucune porte');
        assert.deepEqual(evRow.gates_without_controller, ['Porte Est'], 'porte sans contrôleur');

        const free = await settings(partner.accessToken, { eventId: ev.eventId, controllerId: c.userId, entryPoint: 'Entrée libre', canAcceptCash: false });
        assert.equal(free.status, 409, `texte libre sur un événement à zones : ${show(free)}`);
        assert.equal(free.body.code, 'GATES_CONFIGURED');
        const foreignGate = await settings(partner.accessToken, { eventId: ev.eventId, controllerId: c.userId, gateId, canAcceptCash: false });
        assert.equal(foreignGate.status, 409, `porte d'un autre événement : ${show(foreignGate)}`);
        assert.equal(foreignGate.body.code, 'GATE_INVALID');
        const noZones = await teamGet(partner.accessToken, `?eventId=${evFree.eventId}`);
        const freeEvent = ((noZones.events ?? []) as Row[])[0];
        assert.equal(freeEvent.has_zones, false, 'sans zone : « Toutes les catégories » à l’écran');
        assert.deepEqual(freeEvent.uncovered_categories, [], 'sans zone : aucun avertissement de catégorie');
    });
});
