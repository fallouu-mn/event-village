/**
 * Lot 9 ter, tâche 9t.5 (consigne 0.5 ; contrat 5.B 9t.5, B.2.2 (1) à (3), (7), (8), 4.2 B.3, décisions B-D5 à B-D8,
 * arbitrage 13) — consentement d'un contrôleur déjà actif ailleurs : une partenaire qui n'a jamais eu ce contrôleur dans
 * son équipe (aucun lien `partner_controllers`) ne l'affecte plus directement ; elle lui envoie une invitation à accepter
 * (parcours R37). Le lien naît à toute insertion dans event_controllers (trigger F11) et n'est jamais supprimé ; un compte
 * temporaire jamais activé garde le chemin du code d'activation ; la RPC controller_assignments_sync refuse
 * CONTROLLER_CONSENT_REQUIRED ; l'invitation d'un contrôleur actif inconnu consomme une unité invite_phone (R98).
 *
 * Montage : partenaires A et B neuves, événements PUBLIE evA1, evA2 (A) et evB (B) ; chaque cas a son propre contrôleur
 * de A (newController(A, evA1) : l'upsert d'affectation déclenche F11). Routes : POST /api/partner/team/invite,
 * PATCH /api/partner/team/assignments (jeton de la partenaire), POST /api/account/controller-invitations/[id] (jeton du
 * contrôleur). Aucun service_role pour l'acteur testé, sauf la RPC du cas 5 (contrat : appel direct de la RPC).
 *
 * Rouge avant correctif (M06, fix(9t.5)) : aujourd'hui tout compte au rôle CONTROLEUR est affecté directement
 * (invite/route.ts:385-450, assignments/route.ts:158 puis controller_assignments_sync sans garde) : cas 1, 2, 5 et 7
 * échouent sur l'affectation directe ou l'absence de quota ; le cas 8 échoue sur la table partner_controllers absente.
 * Témoins 3, 4 et 6 verts aujourd'hui (le 4 garde le correctif : sans lien durable, il rougirait). after() :
 * assertLot9terInvariants (x5 : chaque affectation a son lien), garde de schéma rouge jusqu'à M11.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { getFakes } from '../fakes';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { maskPersonName } from '../../lib/security/mask';
import { randomSenegalPhone } from './helpers';
import { service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, respondControllerInvitation, type RouteResult } from './acces-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';
import { outboxRows, withEnv } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { alignQuotaWindow, assertSameQuotaWindow } from './terrain-helpers';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];
const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const ASSIGNMENTS_ROUTE = '../../app/api/partner/team/assignments/route';

/** Textes exacts du contrat (4.2 B.3), nom masqué du titulaire en variable. */
function inviteConsentMessage(name: string): string {
    return `Ce numéro appartient déjà à un compte Event Village (${name}). Ce titulaire n’a jamais contrôlé vos événements : il doit accepter votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ?`;
}
function patchConsentMessage(name: string): string {
    return `Ce compte (${name}) n’a jamais contrôlé vos événements : il doit accepter votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ?`;
}

let partnerA: TestPartner;
let partnerB: TestPartner;
let evA1: DraftEvent;
let evA2: DraftEvent;
let evB: DraftEvent;

before(async () => {
    partnerA = await newPartner('consent-a');
    partnerB = await newPartner('consent-b');
    evA1 = await createEventInStatus(partnerA, 'consent-a1', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
    evA2 = await createEventInStatus(partnerA, 'consent-a2', CATEGORIES, 'PUBLIE', { startsInHours: 96 });
    evB = await createEventInStatus(partnerB, 'consent-b', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
});

after(async () => {
    await assertLot9terInvariants('equipe-consentement-9ter');
});

// ── Routes et lectures ─────────────────────────────────────────────────────

async function invite(partner: TestPartner, body: Row): Promise<RouteResult> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
    return invoke(handler, jsonRequest('/api/partner/team/invite', 'POST', partner.accessToken, body));
}

async function patchAssignments(partner: TestPartner, body: Row): Promise<RouteResult> {
    const handler = await routeHandler(ASSIGNMENTS_ROUTE, 'PATCH', 'PATCH /api/partner/team/assignments');
    return invoke(handler, jsonRequest('/api/partner/team/assignments', 'PATCH', partner.accessToken, body));
}

async function assignedEvents(userId: string): Promise<string[]> {
    const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.event_id)).sort();
}

async function invitationsOf(partnerId: string, userId: string): Promise<Row[]> {
    const { data, error } = await service.from('controller_invitations').select('id, status, assignments').eq('partner_id', partnerId).eq('user_id', userId);
    assert.equal(error, null, `invitations de contrôleur : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function linked(partnerId: string, userId: string): Promise<boolean> {
    const { data, error } = await service.from('partner_controllers').select('partner_id').eq('partner_id', partnerId).eq('user_id', userId);
    assert.equal(error, null, `lien partner_controllers (table du lot 9 ter, migration 20261110000006) : ${error?.code ?? ''} ${error?.message ?? ''}`);
    return (data ?? []).length === 1;
}

async function assignmentAudits(actorId: string, controllerId: string): Promise<number> {
    const { data, error } = await service.from('audit_logs').select('id').eq('action', 'CONTROLLER_ASSIGNMENTS_UPDATED').eq('user_id', actorId).eq('object_id', controllerId);
    assert.equal(error, null, `journal CONTROLLER_ASSIGNMENTS_UPDATED : ${error?.message}`);
    return (data ?? []).length;
}

/** Contrôleur actif chez A : rôle CONTROLEUR, affecté à evA1 (l'insertion pose le lien (A, C) après M06). */
async function activeAtA(label: string): Promise<Buyer> {
    return newController(partnerA, evA1.eventId, { label });
}

describe('9t.5 (0.5) : un contrôleur actif ailleurs consent avant d\'être affecté', () => {
    test('B invite le numéro d\'un contrôleur actif chez A : confirmation demandée, puis invitation à accepter, aucune affectation ; acceptée : affecté et lien (B, C) créé', async () => {
        const c = await activeAtA('consent-1');
        const name = maskPersonName(c.firstName, c.lastName);

        const ask = await invite(partnerB, { event_ids: [evB.eventId], phone: c.phone9, can_accept_cash: false });
        assert.equal(ask.status, 200, `étape de confirmation (aujourd'hui 201 avec affectation directe) : ${show(ask)}`);
        assert.equal(ask.body.requires_confirmation, true, show(ask));
        assert.equal(ask.body.code, 'EXISTING_ACCOUNT', show(ask));
        assert.equal(ask.body.message, inviteConsentMessage(name), `texte exact (4.2 B.3) : ${show(ask)}`);
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'étape de confirmation : aucune affectation chez B');

        const sent = await invite(partnerB, { event_ids: [evB.eventId], phone: c.phone9, can_accept_cash: false, confirm_promotion: true });
        assert.equal(sent.status, 201, show(sent));
        assert.ok(typeof sent.body.invitation_id === 'string' && sent.body.invitation_id.length > 0, `invitation créée : ${show(sent)}`);
        assert.deepEqual(sent.body.assignments, [], `aucune affectation avant l'acceptation : ${show(sent)}`);
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'aucune ligne event_controllers (evB, C)');
        const invitations = await invitationsOf(partnerB.partnerId, c.userId);
        assert.deepEqual(invitations.map((i) => [i.id, i.status]), [[sent.body.invitation_id, 'PENDING']], 'une invitation PENDING (B, C)');
        const sms = await outboxRows({ type: 'CONTROLLER_INVITATION', keyPrefix: `CONTROLLER_INVITATION:${String(sent.body.invitation_id)}`, channel: 'SMS' });
        assert.equal(sms.length, 1, `une ligne CONTROLLER_INVITATION SMS vers C : ${JSON.stringify(sms.map((r) => [r.recipient_user_id, r.status]))}`);
        assert.equal(sms[0].recipient_user_id, c.userId);

        const accepted = await respondControllerInvitation(c, String(sent.body.invitation_id), true);
        assert.equal(accepted.status, 200, `acceptation par le contrôleur : HTTP ${accepted.status} ${JSON.stringify(accepted.body)}`);
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId, evB.eventId].sort(), 'affecté à evB après son acceptation');
        assert.equal(await linked(partnerB.partnerId, c.userId), true, 'lien (B, C) créé par l\'affectation acceptée');
    });

    test('B, PATCH des affectations d\'un contrôleur actif chez A : confirmation demandée, puis invitation, aucune affectation', async () => {
        const c = await activeAtA('consent-2');
        const name = maskPersonName(c.firstName, c.lastName);

        const ask = await patchAssignments(partnerB, { controller_id: c.userId, assignments: [{ event_id: evB.eventId }] });
        assert.equal(ask.status, 200, show(ask));
        assert.equal(ask.body.requires_confirmation, true, `étape de confirmation (aujourd'hui 200 added [evB]) : ${show(ask)}`);
        assert.equal(ask.body.code, 'EXISTING_ACCOUNT', show(ask));
        assert.equal(ask.body.message, patchConsentMessage(name), `texte exact (4.2 B.3) : ${show(ask)}`);
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'étape de confirmation : aucune affectation chez B');

        const sent = await patchAssignments(partnerB, { controller_id: c.userId, assignments: [{ event_id: evB.eventId }], confirm_promotion: true });
        assert.equal(sent.status, 200, show(sent));
        assert.ok(typeof sent.body.invitation_id === 'string' && sent.body.invitation_id.length > 0, `invitation créée : ${show(sent)}`);
        assert.deepEqual(sent.body.added, [], show(sent));
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'aucune affectation avant l\'acceptation');
        assert.deepEqual((await invitationsOf(partnerB.partnerId, c.userId)).map((i) => i.status), ['PENDING'], 'une invitation PENDING (B, C)');
    });

    test('témoin : A affecte son contrôleur à un second événement, par l\'invitation et par le PATCH : affectation directe, aucune invitation', async () => {
        const c1 = await activeAtA('consent-3a');
        const byInvite = await invite(partnerA, { event_ids: [evA2.eventId], phone: c1.phone9, can_accept_cash: false });
        assert.equal(byInvite.status, 201, show(byInvite));
        assert.equal(byInvite.body.requires_confirmation, undefined, show(byInvite));
        assert.deepEqual(await assignedEvents(c1.userId), [evA1.eventId, evA2.eventId].sort(), 'affecté directement par l\'invitation');

        const c2 = await activeAtA('consent-3b');
        const byPatch = await patchAssignments(partnerA, { controller_id: c2.userId, assignments: [{ event_id: evA1.eventId }, { event_id: evA2.eventId }] });
        assert.equal(byPatch.status, 200, show(byPatch));
        assert.deepEqual(byPatch.body.added, [evA2.eventId], show(byPatch));
        assert.deepEqual(await invitationsOf(partnerA.partnerId, c1.userId), [], 'aucune invitation pour c1');
        assert.deepEqual(await invitationsOf(partnerA.partnerId, c2.userId), [], 'aucune invitation pour c2');
    });

    test('A retire toutes les affectations de son contrôleur puis le réaffecte : direct, le lien survit au retrait', async () => {
        const c = await activeAtA('consent-4');
        const removed = await patchAssignments(partnerA, { controller_id: c.userId, assignments: [] });
        assert.equal(removed.status, 200, show(removed));
        assert.deepEqual(await assignedEvents(c.userId), [], 'plus aucune affectation');
        const again = await patchAssignments(partnerA, { controller_id: c.userId, assignments: [{ event_id: evA2.eventId }] });
        assert.equal(again.status, 200, show(again));
        assert.equal(again.body.requires_confirmation, undefined, `aucune confirmation demandée : ${show(again)}`);
        assert.deepEqual(again.body.added, [evA2.eventId], show(again));
        assert.deepEqual(await invitationsOf(partnerA.partnerId, c.userId), [], 'aucune invitation');
    });

    test('RPC controller_assignments_sync par B sur un contrôleur de A : CONTROLLER_CONSENT_REQUIRED, rien écrit', async () => {
        const c = await activeAtA('consent-5');
        const auditsBefore = await assignmentAudits(partnerB.userId, c.userId);
        const { data, error } = await service.rpc('controller_assignments_sync', {
            p: { actor_id: partnerB.userId, actor_role: 'PARTENAIRE', controller_id: c.userId, partner_id: partnerB.partnerId, assignments: [{ event_id: evB.eventId }] },
        });
        assert.equal(error, null, `controller_assignments_sync : ${error?.message}`);
        const body = (data ?? {}) as Row;
        assert.deepEqual({ ok: body.ok, code: body.code, message: body.message },
            { ok: false, code: 'CONTROLLER_CONSENT_REQUIRED', message: 'Ce contrôleur doit d’abord accepter votre invitation.' }, `refus de la RPC : ${JSON.stringify(body)}`);
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'aucune ligne event_controllers (evB, C)');
        assert.equal(await assignmentAudits(partnerB.userId, c.userId), auditsBefore, 'aucun journal CONTROLLER_ASSIGNMENTS_UPDATED');
    });

    test('témoin : compte temporaire jamais activé créé par A, B l\'invite : chemin du code d\'activation inchangé', async () => {
        const phone = randomSenegalPhone('76');
        const first = await invite(partnerA, { event_ids: [evA1.eventId], phone, first_name: 'Awa' });
        assert.equal(first.status, 201, `compte temporaire créé par A : ${show(first)}`);
        assert.equal(first.body.is_new_user, true, show(first));
        const since = getFakes().sms.messagesTo(phone).length;
        const second = await invite(partnerB, { event_ids: [evB.eventId], phone });
        assert.equal(second.status, 201, `B affecte le compte temporaire comme aujourd'hui : ${show(second)}`);
        assert.equal(second.body.is_new_user, false, show(second));
        assert.equal(second.body.requires_confirmation, undefined, show(second));
        assert.equal(second.body.sms_sent, true, show(second));
        assert.equal(getFakes().sms.messagesTo(phone).length - since, 1, 'un SMS d\'activation');
    });

    test('quota R98 : l\'invitation confirmée d\'un contrôleur actif inconnu consomme une unité invite_phone (limite 1 : la seconde partenaire reçoit 429)', async () => {
        const c = await activeAtA('consent-7');
        const partnerD = await newPartner('consent-d');
        const evD = await createEventInStatus(partnerD, 'consent-d', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        await withEnv({ INVITE_PER_PHONE_DAY: '1', INVITE_PER_PARTNER_HOUR: '1000' }, async () => {
            const win = await alignQuotaWindow(86_400, 60_000);
            const fromB = await invite(partnerB, { event_ids: [evB.eventId], phone: c.phone9, confirm_promotion: true });
            const fromD = await invite(partnerD, { event_ids: [evD.eventId], phone: c.phone9, confirm_promotion: true });
            await assertSameQuotaWindow(win, 'deux invitations confirmées');
            assert.equal(fromB.status, 201, `première invitation : ${show(fromB)}`);
            assert.ok(typeof fromB.body.invitation_id === 'string', `la première est une invitation à accepter : ${show(fromB)}`);
            assert.equal(fromD.status, 429, `seconde invitation au même numéro, limite 1 : ${show(fromD)}`);
            assert.equal(fromD.body.code, 'PHONE_INVITE_RATE_LIMIT', show(fromD));
        });
        assert.deepEqual(await assignedEvents(c.userId), [evA1.eventId], 'aucune affectation chez B ni chez D');
    });

    test('schéma : partner_controllers en RLS sans politique, aucun privilège pour anon et authenticated, aucune clé étrangère ; rétro-remplissage des 4 sources', async () => {
        const schema = await inspect(async (db) => {
            const t = await db.query<{ reg: string | null; rls: boolean | null }>(
                `SELECT to_regclass('public.partner_controllers')::text AS reg,
                        (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.partner_controllers')) AS rls`);
            if (!t.rows[0].reg) return null;
            const policies = await db.query<{ policyname: string }>(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_controllers'`);
            const privileges = await db.query<{ role: string; ok: boolean }>(
                `SELECT r AS role, has_table_privilege(r, 'public.partner_controllers', 'SELECT,INSERT,UPDATE,DELETE') AS ok FROM unnest(ARRAY['anon', 'authenticated']) AS r`);
            const fks = await db.query<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid = 'public.partner_controllers'::regclass AND contype = 'f'`);
            return { rls: t.rows[0].rls, policies: policies.rows.map((r) => r.policyname), privileges: privileges.rows, fks: fks.rows.map((r) => r.conname) };
        });
        assert.ok(schema, 'table public.partner_controllers absente (lot 9 ter 0.5, migration 20261110000006)');
        assert.equal(schema.rls, true, 'RLS activée');
        assert.deepEqual(schema.policies, [], 'aucune politique');
        assert.deepEqual(schema.privileges.filter((p) => p.ok).map((p) => p.role), [], 'aucun privilège pour anon ni authenticated');
        assert.deepEqual(schema.fks, [], 'aucune clé étrangère (K9)');

        const users = [await newController(partnerB, null, { label: 'retro-aff' }), await newController(partnerB, null, { label: 'retro-caisse' }),
            await newController(partnerB, null, { label: 'retro-invit' }), await newController(partnerB, null, { label: 'retro-scan' })];
        const ids = users.map((u) => u.userId);
        const found = await inRolledBackTransaction(async (db) => {
            await db.query(`INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by) VALUES ($1, $2, FALSE, $3)`,
                [evB.eventId, ids[0], partnerB.userId]);
            await db.query(`INSERT INTO public.controller_shifts (controller_id, event_id, partner_id, status, expected_cash_total) VALUES ($1, $2, $3, 'OUVERT', 0)`,
                [ids[1], evB.eventId, partnerB.partnerId]);
            await db.query(`INSERT INTO public.controller_invitations (partner_id, user_id, created_by, status, responded_at) VALUES ($1, $2, $3, 'ACCEPTED', now())`,
                [partnerB.partnerId, ids[2], partnerB.userId]);
            await db.query(`INSERT INTO public.ticket_scans (event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, scanner_role)
                            VALUES ($1, $2, 'invalid', FALSE, 'QR', FALSE, $3, 'CONTROLEUR')`, [evB.eventId, ids[3], randomBytes(32).toString('hex')]);
            // Le lien posé par le trigger F11 est retiré : seule la reprise doit le recréer.
            await db.query(`DELETE FROM public.partner_controllers WHERE partner_id = $1 AND user_id = ANY ($2::uuid[])`, [partnerB.partnerId, ids]);
            await db.query(BACKFILL_SQL);
            return (await db.query<{ user_id: string }>(
                `SELECT user_id FROM public.partner_controllers WHERE partner_id = $1 AND user_id = ANY ($2::uuid[]) ORDER BY user_id`, [partnerB.partnerId, ids])).rows.map((r) => r.user_id);
        });
        assert.deepEqual(found, [...ids].sort(), '4 liens recréés par la reprise : affectation, caisse, invitation acceptée, scan de contrôleur');
    });
});

/** Rétro-remplissage de M06 (contrat B.2.2 (8)), rejoué tel quel dans une transaction annulée. */
const BACKFILL_SQL = `
INSERT INTO public.partner_controllers (partner_id, user_id, first_seen_at)
SELECT x.partner_id, x.user_id, min(x.seen_at)
  FROM (SELECT e.partner_id, ec.user_id, ec.created_at AS seen_at
          FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
        UNION ALL
        SELECT s.partner_id, s.controller_id, s.opened_at FROM public.controller_shifts s
        UNION ALL
        SELECT ci.partner_id, ci.user_id, COALESCE(ci.responded_at, ci.created_at)
          FROM public.controller_invitations ci WHERE ci.status = 'ACCEPTED'
        UNION ALL
        SELECT e.partner_id, sc.scanner_id, sc.created_at
          FROM public.ticket_scans sc JOIN public.events e ON e.id = sc.event_id
         WHERE sc.scanner_role = 'CONTROLEUR' AND sc.scanner_id IS NOT NULL) x
 WHERE x.partner_id IS NOT NULL AND x.user_id IS NOT NULL
 GROUP BY x.partner_id, x.user_id
ON CONFLICT (partner_id, user_id) DO NOTHING`;
