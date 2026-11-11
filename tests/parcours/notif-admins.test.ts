/**
 * Lot 6, tâche 6.6 — notifications des administrateurs (contrat D notif_admin_recipients et
 * notif_enqueue_admins, C6 admin_signals, E2, E3, J1.7, J2.2, J2.3, J2.5, J2.13 ; décisions 13, 53 ;
 * S2 groupe Pros).
 *  - Destinataires : comptes ACTIF avec SUPERADMIN dans user_roles, ou ADMIN avec la permission du type
 *    dans admin_permissions ; jamais un ADMIN sans la permission, un admin suspendu, ni un compte dont
 *    seul users.role vaut ADMIN. Chaque destinataire trouvé est revérifié en base.
 *  - Types : événement soumis (events.read), partenaire inscrit (partners.read), remboursement à
 *    reprendre bloqué et refusé, cashout incertain (refunds.manage), créance (payments.read),
 *    notification FAILED, seuil de SMS du jour, plafond de SMS (notifications.read) ; une ligne par
 *    administrateur et par canal, clé `<TYPE>:<référence>:<admin_id>:<canal>`, aucun SMS aux admins.
 *  - admin_signals : REFUND_TO_RETRY, CASHOUT_UNCERTAIN, NOTIFICATION_FAILED, SMS_DAILY_THRESHOLD acceptés,
 *    un seul signal par référence (index unique partiel).
 * Lot 7 (7.0 a et 7.0 d, T2) : le seuil du jour devient l'alerte à 80 % du budget des SMS optionnels
 * (ADMIN_SMS_OPTIONAL_80, signal SMS_OPTIONAL_80, notif.sms_optional_daily_cap ; notif.sms_daily_alert est
 * supprimée, D15) ; le cas du plafond porte sur un jour futur tiré au hasard, et non plus sur le jour UTC réel
 * (couplage avec sms-anti-abus supprimé, consigne 7.0 d). Rouges jusqu'à fix(7.0a).
 * Comptage par lignes de la boîte d'envoi filtrées par type et référence (jamais globalement) ; les
 * comptes administrateurs sont créés par la suite.
 *
 * Rouge avant correctif : boîte d'envoi, registre, notif_admin_recipients, triggers et RPC du lot
 * absents ; aujourd'hui les admins sont prévenus en TypeScript, par users.role (notifySuperadmins) ou les
 * seuls SUPERADMIN (lib/admin/alerts.ts, sms-guard.ts), avec un SMS à chaque admin ; admin_signals
 * refuse les nouveaux types (CHECK du lot 5).
 *
 * Interprétations retenues :
 *  - alerte à 80 % du budget optionnel (lot 7) : prouvée sur un jour futur tiré au hasard (200 à 350 jours)
 *    avec un SMS optionnel envoyé ce jour-là par l'horloge simulée et un plafond de 1, donc un seuil de 1
 *    (withNotifSettings), pour ne dépendre d'aucune autre suite (une alerte par jour) ; un autre jour futur
 *    sans SMS sert de témoin ;
 *  - plafond SMS : notification_admin_alert appelée directement sur un jour futur tiré au hasard (600 à
 *    900 jours, lot 7 : plus aucune ligne sur le jour UTC réel, que sms-anti-abus vérifie seul) ; l'appel
 *    par sms-guard est vérifié par notif-migration.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inRolledBackTransaction } from '../helpers/db';
import { getFakes } from '../fakes';
import { randomSenegalPhone } from './helpers';
import { fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, eventHistory } from './cycle-helpers';
import {
    assertNotificationInvariants, dakarAt, dakarDay, dispatchAt, insertOutboxRow, markEmailVerified, newAdmin, outboxRows, withNotifSettings,
    type OutboxChannel, type OutboxRow, type TestAdmin,
} from './notif-helpers';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertNotificationInvariants('notif-admins');
});

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
type Permission = 'events.read' | 'partners.read' | 'refunds.manage' | 'payments.read' | 'notifications.read';

const PERMISSIONS: Permission[] = ['events.read', 'partners.read', 'refunds.manage', 'payments.read', 'notifications.read'];

let superadmin: TestAdmin;
const admins = {} as Record<Permission, TestAdmin>;
let noPermission: TestAdmin;
let suspended: TestAdmin;
let legacyRole: Buyer;

before(async () => {
    superadmin = await newAdmin('notif-sa', [], { role: 'SUPERADMIN' }); await markEmailVerified(superadmin.userId); // lot 9 bis (R87, B96) : email seulement à une adresse vérifiée
    for (const p of PERMISSIONS) { admins[p] = await newAdmin(`notif-${p.replace('.', '-')}`, [p]); await markEmailVerified(admins[p].userId); }
    noPermission = await newAdmin('notif-sans-permission', []);
    suspended = await newAdmin('notif-suspendu', [...PERMISSIONS]);
    const { error: sErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
    assert.equal(sErr, null, `admin suspendu : ${sErr?.message}`);
    legacyRole = await newBuyer('notif-role-herite');
    const { data, error } = await service.from('users').update({ role: 'ADMIN' }).eq('id', legacyRole.userId).select('role').single();
    assert.equal(error, null, `users.role hérité : ${error?.message}`);
    assert.equal(data.role, 'ADMIN', 'précondition : users.role = ADMIN sans ligne user_roles ADMIN');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/**
 * Lignes d'une alerte admin (`<base><admin_id>:<canal>`) : destinataires conformes à la permission,
 * canaux exacts pour l'admin qui a la permission et pour le SUPERADMIN de la suite.
 */
async function adminAlert(type: string, base: string, permission: Permission, channels: OutboxChannel[]): Promise<OutboxRow[]> {
    const rows = await outboxRows({ type, keyPrefix: base });
    const recipients = new Set(rows.map((r) => String(r.recipient_user_id)));
    const label = `${type} (${base}…)`;
    assert.ok(recipients.has(superadmin.userId), `${label} : le SUPERADMIN reçoit tout (destinataires ${JSON.stringify(Array.from(recipients))})`);
    assert.ok(recipients.has(admins[permission].userId), `${label} : l'ADMIN qui a ${permission} reçoit`);
    assert.ok(!recipients.has(noPermission.userId), `${label} : un ADMIN sans permission ne reçoit rien`);
    assert.ok(!recipients.has(suspended.userId), `${label} : un admin suspendu ne reçoit rien`);
    assert.ok(!recipients.has(legacyRole.userId), `${label} : users.role n'est pas lu (décision 13)`);
    for (const other of PERMISSIONS.filter((p) => p !== permission)) {
        assert.ok(!recipients.has(admins[other].userId), `${label} : l'ADMIN qui n'a que ${other} ne reçoit rien`);
    }
    for (const who of [superadmin, admins[permission]]) {
        const mine = rows.filter((r) => r.recipient_user_id === who.userId);
        assert.deepEqual(mine.map((r) => r.channel).sort(), [...channels].sort(), `${label} : canaux de ${who.role} ${JSON.stringify(mine.map((r) => r.channel))}`);
        for (const r of mine) {
            assert.equal(r.idempotency_key, `${base}${who.userId}:${r.channel}`, `${label} : clé ${r.idempotency_key}`);
            assert.equal(r.family, 'ESSENTIAL', `${label} : famille ESSENTIAL`);
            assert.notEqual(r.status, 'SKIPPED', `${label} : ${r.channel} non SKIPPED à l'insertion (${r.reason})`);
        }
    }
    assert.ok(rows.every((r) => r.channel !== 'SMS'), `${label} : aucun SMS aux administrateurs`);
    await assertEligible(Array.from(recipients), permission, label);
    return rows;
}

/** Chaque destinataire est ACTIF, et SUPERADMIN, ou ADMIN avec la permission (user_roles, admin_permissions). */
async function assertEligible(userIds: string[], permission: Permission, label: string): Promise<void> {
    const { data: users, error } = await service.from('users').select('id, status').in('id', userIds);
    assert.equal(error, null, `${label} : comptes : ${error?.message}`);
    const { data: roles, error: rErr } = await service.from('user_roles').select('user_id, role').in('user_id', userIds);
    assert.equal(rErr, null, `${label} : rôles : ${rErr?.message}`);
    const { data: perms, error: pErr } = await service.from('admin_permissions').select('user_id, permission').in('user_id', userIds).eq('permission', permission);
    assert.equal(pErr, null, `${label} : permissions : ${pErr?.message}`);
    const bad: string[] = [];
    for (const id of userIds) {
        const u = (users ?? []).find((x) => x.id === id);
        const r = (roles ?? []).filter((x) => x.user_id === id).map((x) => String(x.role));
        const allowed = r.includes('SUPERADMIN') || (r.includes('ADMIN') && (perms ?? []).some((x) => x.user_id === id));
        if (!u || u.status !== 'ACTIF' || !allowed) bad.push(`${id} (statut ${u?.status}, rôles ${r.join(',')})`);
    }
    assert.deepEqual(bad, [], `${label} : destinataires non conformes`);
}

async function signals(kind: string, refId: string): Promise<Row[]> {
    const { data, error } = await service.from('admin_signals').select('*').eq('kind', kind).eq('ref_id', refId);
    assert.equal(error, null, `admin_signals ${kind} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function deliverFor(rows: OutboxRow[], who: TestAdmin, now: Date = new Date()): Promise<OutboxRow[]> {
    const mine = rows.filter((r) => r.recipient_user_id === who.userId);
    await dispatchAt(now, { ids: mine.map((r) => r.id) });
    return outboxRows({ ids: mine.map((r) => r.id) });
}

async function assertInApp(rows: OutboxRow[], who: TestAdmin, title: string, contains: string[], actionUrl: string): Promise<Row> {
    const r = rows.find((x) => x.channel === 'IN_APP');
    assert.ok(r, 'ligne IN_APP');
    assert.equal(r.status, 'SENT', `${r.idempotency_key} : SENT (${r.status} ${r.reason})`);
    const { data, error } = await service.from('notifications').select('*').eq('id', r.notification_id).single();
    assert.equal(error, null, `notification : ${error?.message}`);
    const n = data as Row;
    assert.equal(n.user_id, who.userId, 'destinataire de la notification');
    assert.equal(n.title, title, `titre (G4) : ${n.title}`);
    for (const c of contains) assert.ok(String(n.content).includes(c), `contenu « ${n.content} » sans « ${c} »`);
    assert.equal((n.metadata as Row | null)?.actionUrl, actionUrl, 'lien');
    return n;
}

async function cancelByPartner(owner: TestPartner, eventId: string): Promise<void> {
    const { POST } = await importModule('../../app/api/partner/events/[id]/cancel/route');
    const { data: ev, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre : ${error?.message}`);
    const res: Response = await (POST as Handler)(jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', owner.accessToken, {
        internalReason: 'Test lot 6 : annulation', publicNotice: 'Événement annulé : les acheteurs sont remboursés.', confirmTitle: String(ev.title),
    }), routeCtx({ id: eventId }));
    assert.equal(res.status, 200, `annulation : HTTP ${res.status} ${await res.text()}`);
}

/** Événement payé en ligne puis annulé par le partenaire ; renvoie le cashout de remboursement. */
async function cancelledRefund(label: string, mode: 'success' | 'rejected' | 'timeout-after-send' | 'no-balance'): Promise<{ owner: TestPartner; ev: SaleEvent; cashout: Row }> {
    const owner = await newPartner(`adm-${label}`);
    const ev = await createPartnerEvent(owner.partnerId, `adm-${label}`, [{ name: 'Standard', price: 5_000, total: 10 }]);
    const { payment } = await buyConfirmed(await newBuyer(`adm-${label}`), ev, [['Standard', 1]]);
    const balance = fakePay().balance;
    if (mode === 'no-balance') fakePay().balance = 0;
    else setFakeMode('cashoutMode', mode);
    try {
        await cancelByPartner(owner, ev.eventId);
    } finally {
        fakePay().balance = balance;
        setFakeMode('cashoutMode', 'success');
    }
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', payment.id);
    assert.equal(error, null, `cashout : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'un cashout de remboursement');
    return { owner, ev, cashout: data![0] as Row };
}

// ── Événements et partenaires ──────────────────────────────────────────────

describe('6.6 Admin — événement soumis et partenaire inscrit', () => {
    test('événement soumis : ADMIN_EVENT_SUBMITTED (in-app, push, email) aux admins events.read et au SUPERADMIN, sans SMS', async () => {
        const owner = await newPartner('adm-soumis');
        const ev = await createDraftEvent(owner, 'adm-soumis', [{ name: 'Standard', price: 5_000, total: 10 }], { startsInHours: 72 });
        await advanceEventTo(ev.eventId, 'EN_ATTENTE', { partnerUserId: owner.userId });
        const h = (await eventHistory(ev.eventId)).filter((x) => x.new_status === 'EN_ATTENTE').pop();
        assert.ok(h, 'ligne d’historique EN_ATTENTE');
        const rows = await adminAlert('ADMIN_EVENT_SUBMITTED', `ADMIN_EVENT_SUBMITTED:${h.id}:`, 'events.read', ['EMAIL', 'IN_APP', 'PUSH']);
        assert.ok(rows.every((r) => r.event_id === ev.eventId), 'event_id porté par chaque ligne');
        assert.equal((await signals('EVENT_SUBMITTED', ev.eventId)).length + (await signals('EVENT_SUBMITTED', h.id)).length, 1, 'signal du lot 5 conservé, une fois');
        const sent = await deliverFor(rows, admins['events.read']);
        await assertInApp(sent, admins['events.read'], 'Événement à valider', [ev.title], `/admin/events/${ev.eventId}`);
    });

    test('partenaire inscrit : ADMIN_PARTNER_REGISTERED (in-app, push, email) aux admins partners.read et au SUPERADMIN', async () => {
        const owner = await newPartner('adm-inscrit');
        const rows = await adminAlert('ADMIN_PARTNER_REGISTERED', `ADMIN_PARTNER_REGISTERED:${owner.partnerId}:`, 'partners.read', ['EMAIL', 'IN_APP', 'PUSH']);
        const { data, error } = await service.from('partners').select('company_name').eq('id', owner.partnerId).single();
        assert.equal(error, null, `partenaire : ${error?.message}`);
        const sent = await deliverFor(rows, admins['partners.read']);
        await assertInApp(sent, admins['partners.read'], 'Nouvelle candidature', [String(data.company_name)], '/admin/dashboard');
    });
});

// ── Argent ─────────────────────────────────────────────────────────────────

describe('6.6 Admin — remboursements, cashouts incertains, créances (trg_cashouts_notify, fin_alert_superadmins)', () => {
    test('remboursement bloqué (solde insuffisant) : ADMIN_REFUND_TO_RETRY BLOQUE aux admins refunds.manage, un signal REFUND_TO_RETRY', async () => {
        const { cashout } = await cancelledRefund('bloque', 'no-balance');
        assert.equal(cashout.status, 'A_ENVOYER', `cashout en attente (${cashout.status})`);
        assert.ok(cashout.blocked_reason, 'motif de blocage');
        const rows = await adminAlert('ADMIN_REFUND_TO_RETRY', `ADMIN_REFUND_TO_RETRY:${cashout.id}:${Number(cashout.attempt_count ?? 0)}:BLOQUE:`, 'refunds.manage', ['EMAIL', 'IN_APP', 'PUSH']);
        assert.ok(rows.every((r) => r.template_data.cashout_id === cashout.id), 'template_data.cashout_id');
        assert.equal((await signals('REFUND_TO_RETRY', String(cashout.id))).length, 1, 'un signal REFUND_TO_RETRY');
        const sent = await deliverFor(rows, admins['refunds.manage']);
        const n = await assertInApp(sent, admins['refunds.manage'], 'Remboursement à reprendre', ['bloqué'], '/admin/finance');
        assert.equal((n.metadata as Row).cashout_id, cashout.id, 'metadata.cashout_id (lu par les tests existants)');
    });

    test('remboursement refusé par l’opérateur : ADMIN_REFUND_TO_RETRY ECHOUE, un signal ; second passage du trigger sans doublon', async () => {
        const { cashout } = await cancelledRefund('refuse', 'rejected');
        assert.equal(cashout.status, 'ECHOUE', `cashout refusé (${cashout.status})`);
        const base = `ADMIN_REFUND_TO_RETRY:${cashout.id}:${Number(cashout.attempt_count)}:ECHOUE:`;
        const rows = await adminAlert('ADMIN_REFUND_TO_RETRY', base, 'refunds.manage', ['EMAIL', 'IN_APP', 'PUSH']);
        const { error } = await service.from('cashouts').update({ last_error: 'relu par le test du lot 6' }).eq('id', cashout.id);
        assert.equal(error, null, `mise à jour sans changement de statut : ${error?.message}`);
        assert.equal((await outboxRows({ type: 'ADMIN_REFUND_TO_RETRY', keyPrefix: base })).length, rows.length, 'aucune ligne de plus sans changement de statut');
        assert.equal((await signals('REFUND_TO_RETRY', String(cashout.id))).length, 1, 'un seul signal REFUND_TO_RETRY');
    });

    test('cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN', async () => {
        const { cashout } = await cancelledRefund('incertain', 'timeout-after-send');
        assert.equal(cashout.status, 'INCERTAIN', `cashout incertain (${cashout.status})`);
        const rows = await adminAlert('ADMIN_CASHOUT_UNCERTAIN', `ADMIN_CASHOUT_UNCERTAIN:${cashout.id}:${Number(cashout.attempt_count)}:`, 'refunds.manage', ['EMAIL', 'IN_APP', 'PUSH']);
        assert.equal((await signals('CASHOUT_UNCERTAIN', String(cashout.id))).length, 1, 'un signal CASHOUT_UNCERTAIN');
        const sent = await deliverFor(rows, admins['refunds.manage']);
        await assertInApp(sent, admins['refunds.manage'], 'Versement incertain', ['incertaine'], '/admin/finance');
    });

    test('créance sur un organisateur : ADMIN_FINANCE_DEBT (in-app, email) aux admins payments.read, metadata.debt_id', async () => {
        await withSettings({ 'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE', 'finance.payout_hold_enabled': false }, async () => {
            const owner = await newPartner('adm-creance');
            const ev = await createPartnerEvent(owner.partnerId, 'adm-creance', [{ name: 'Standard', price: 5_000, total: 10 }]);
            await buyConfirmed(await newBuyer('adm-creance'), ev, [['Standard', 2]]);
            const { error: wErr } = await service.from('finance_ledger').insert({
                owner_id: owner.userId, account_kind: 'ORGANISATEUR', partner_id: owner.partnerId, entry_type: 'RETRAIT',
                amount: -10_000, available_at: new Date().toISOString(), source_key: `TEST-RETRAIT-${randomUUID()}`, description: 'Retrait simulé (test du lot 6)',
            });
            assert.equal(wErr, null, `retrait simulé : ${wErr?.message}`);
            await cancelByPartner(owner, ev.eventId);
            const { data: debts, error } = await service.from('finance_debts').select('id').eq('owner_id', owner.userId);
            assert.equal(error, null, `créances : ${error?.message}`);
            assert.equal((debts ?? []).length, 1, 'une créance');
            const debtId = String(debts![0].id);
            const rows = await adminAlert('ADMIN_FINANCE_DEBT', `ADMIN_FINANCE_DEBT:${debtId}:`, 'payments.read', ['EMAIL', 'IN_APP']);
            assert.ok(rows.every((r) => r.template_data.debt_id === debtId), 'template_data.debt_id');
            const sent = await deliverFor(rows, admins['payments.read']);
            const n = await assertInApp(sent, admins['payments.read'], 'Créance sur un compte', [], '/admin/finance');
            assert.equal((n.metadata as Row).debt_id, debtId, 'metadata.debt_id (finance-annulation.test.ts)');
        });
    });
});

// ── Boîte d'envoi : échec, seuil, plafond ──────────────────────────────────

describe('6.6 Admin — notification FAILED, seuil de SMS du jour, plafond de SMS', () => {
    test('notification FAILED après refus définitif : ADMIN_NOTIFICATION_FAILED (in-app) aux admins notifications.read, un signal NOTIFICATION_FAILED', async () => {
        const nowIso = new Date().toISOString();
        const row = await insertOutboxRow({ type: 'PASSWORD_CHANGED', channel: 'SMS', recipient_phone: randomSenegalPhone('76'), due_at: nowIso, next_attempt_at: nowIso });
        getFakes().sms.rejectNext('102', 'numéro refusé par le fournisseur (test du lot 6)');
        await dispatchAt(new Date(), { ids: [row.id] });
        const [failed] = await outboxRows({ ids: [row.id] });
        assert.equal(failed.status, 'FAILED', `refus définitif : FAILED (${failed.status} ${failed.reason})`);
        assert.equal(failed.reason, 'SMS_REJECTED', `motif : ${failed.reason}`);
        const rows = await adminAlert('ADMIN_NOTIFICATION_FAILED', `ADMIN_NOTIFICATION_FAILED:${row.id}:`, 'notifications.read', ['EMAIL', 'IN_APP']); // G.49 (B97) : EMAIL déclaré
        assert.ok(rows.every((r) => r.template_data.outbox_id === row.id), 'template_data.outbox_id');
        assert.equal((await signals('NOTIFICATION_FAILED', row.id)).length, 1, 'un signal NOTIFICATION_FAILED');
        await dispatchAt(new Date(), { ids: [row.id] });
        assert.equal((await outboxRows({ type: 'ADMIN_NOTIFICATION_FAILED', keyPrefix: `ADMIN_NOTIFICATION_FAILED:${row.id}:` })).length, rows.length, 'second passage : aucune alerte de plus');
        const sent = await deliverFor(rows, admins['notifications.read']);
        await assertInApp(sent, admins['notifications.read'], 'Envoi en échec', [], `/admin/notifications/${row.id}`);
    });

    // Lot 7 (7.0 a, T2) : seuil notif.sms_daily_alert supprimé (D15) ; alerte à 80 % du budget des SMS optionnels.
    test('80 % du budget optionnel atteint (plafond 1, seuil 1) : ADMIN_SMS_OPTIONAL_80 (in-app, email) une fois pour le jour, un signal SMS_OPTIONAL_80 ; jour sans SMS : rien', async () => {
        const day = dakarDay(200 + randomInt(0, 150));
        const quietDay = dakarDay(400 + randomInt(0, 150));
        const at = dakarAt(day, '12:00');
        const atIso = at.toISOString();
        const row = await insertOutboxRow({
            type: 'FIRST_TICKET_SOLD', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channel: 'SMS', recipient_phone: randomSenegalPhone('76'),
            template_data: { title: 'TEST Seuil optionnel' }, due_at: atIso, next_attempt_at: atIso,
        });
        await withNotifSettings({ 'notif.sms_optional_daily_cap': 1 }, async () => {
            await dispatchAt(at, { ids: [row.id] });
            const [sent] = await outboxRows({ ids: [row.id] });
            assert.equal(sent.status, 'SENT', `SMS du jour simulé envoyé (${sent.status} ${sent.reason})`);
            const { data, error } = await service.rpc('notification_daily_checks', { p: { now: atIso } });
            assert.equal(error, null, `notification_daily_checks : ${error?.message} (code ${error?.code})`);
            const r = data as Row;
            assert.equal(r.ok, true, `réponse : ${JSON.stringify(r)}`);
            assert.equal(r.day, day, `jour de Dakar : ${JSON.stringify(r)}`);
            assert.ok(Number(r.sms_today) >= 1, `SMS du jour : ${JSON.stringify(r)}`);
            assert.ok(Number(r.optional_today) >= 1, `SMS optionnels du jour : ${JSON.stringify(r)}`);
            assert.equal(Number(r.optional_cap), 1, `plafond optionnel : ${JSON.stringify(r)}`);
            assert.equal(Number(r.optional_threshold), 1, `seuil de 80 % (ceil(0,8 × 1)) : ${JSON.stringify(r)}`);
            const again = await service.rpc('notification_daily_checks', { p: { now: atIso } });
            assert.equal(again.error, null, `second contrôle : ${again.error?.message}`);
            assert.equal((again.data as Row).alerted, false, `second contrôle du jour : aucune nouvelle alerte (${JSON.stringify(again.data)})`);
            const quiet = await service.rpc('notification_daily_checks', { p: { now: dakarAt(quietDay, '12:00').toISOString() } });
            assert.equal(quiet.error, null, `contrôle d'un jour sans SMS : ${quiet.error?.message}`);
            assert.equal((quiet.data as Row).alerted, false, `jour sans SMS : pas d'alerte (${JSON.stringify(quiet.data)})`);
        });
        const rows = await adminAlert('ADMIN_SMS_OPTIONAL_80', `ADMIN_SMS_OPTIONAL_80:${day}:`, 'notifications.read', ['EMAIL', 'IN_APP']);
        const perAdmin = rows.filter((r) => r.recipient_user_id === superadmin.userId);
        assert.equal(perAdmin.length, 2, 'une alerte par canal pour le jour, même après deux contrôles');
        for (const r of perAdmin) {
            assert.deepEqual({ day: r.template_data.day, cap: Number(r.template_data.cap), threshold: Number(r.template_data.threshold) }, { day, cap: 1, threshold: 1 }, `données de l'alerte : ${JSON.stringify(r.template_data)}`);
        }
        const { data: sig, error: sErr } = await service.from('admin_signals').select('id, ref_id').eq('kind', 'SMS_OPTIONAL_80').in('ref_id', rows.map((r) => r.id));
        assert.equal(sErr, null, `admin_signals : ${sErr?.message}`);
        assert.equal((sig ?? []).length, 1, `un signal SMS_OPTIONAL_80 pour le jour (référence : première ligne d'alerte) : ${JSON.stringify(sig)}`);
        assert.deepEqual(await outboxRows({ type: 'ADMIN_SMS_OPTIONAL_80', keyPrefix: `ADMIN_SMS_OPTIONAL_80:${quietDay}:` }), [], 'jour sans SMS : aucune ligne');
    });

    test('plafond de SMS (notification_admin_alert) : ADMIN_SMS_CAP_GLOBAL et _NON_OTP en in-app aux admins notifications.read, une fois par jour ; type hors liste refusé', async () => {
        // Lot 7 (7.0 d, T2) : jour futur tiré au hasard ; aucune ligne ADMIN_SMS_CAP_* du jour UTC réel n'est écrite ici.
        const day = dakarDay(600 + randomInt(0, 300));
        for (const type of ['ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP']) {
            const call = async () => service.rpc('notification_admin_alert', { p: { type, ref: day, data: { cap: 1000, limit: type === 'ADMIN_SMS_CAP_GLOBAL' ? 1000 : 700 } } });
            const first = await call();
            assert.equal(first.error, null, `notification_admin_alert ${type} : ${first.error?.message} (code ${first.error?.code})`);
            assert.equal((first.data as Row | null)?.ok, true, `réponse : ${JSON.stringify(first.data)}`);
            const rows = await adminAlert(type, `${type}:${day}:`, 'notifications.read', ['EMAIL', 'IN_APP']); // G.49 (B97) : EMAIL déclaré
            const second = await call();
            assert.equal(second.error, null, `second appel : ${second.error?.message}`);
            assert.equal((await outboxRows({ type, keyPrefix: `${type}:${day}:` })).length, rows.length, `${type} : second appel du jour sans doublon`);
        }
        const refused = await service.rpc('notification_admin_alert', { p: { type: 'PURCHASE_CONFIRMED', ref: day, data: {} } });
        const refusedOk = refused.error === null && (refused.data as Row | null)?.ok === true;
        assert.ok(!refusedOk, `type hors liste accepté : ${JSON.stringify(refused.data)}`);
        assert.deepEqual(await outboxRows({ type: 'PURCHASE_CONFIRMED', keyPrefix: `PURCHASE_CONFIRMED:${day}:` }), [], 'aucune ligne pour un type hors liste');
    });

    test('admin_signals : les quatre types du lot sont acceptés et uniques par référence (index uq_admin_signals_lot6)', async () => {
        const ref = randomUUID();
        const out = await inRolledBackTransaction(async (db) => {
            const res: Record<string, string> = {};
            for (const kind of ['NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD', 'CASHOUT_UNCERTAIN', 'REFUND_TO_RETRY']) {
                await db.query('SAVEPOINT s');
                try {
                    await db.query('INSERT INTO public.admin_signals (kind, ref_id) VALUES ($1, $2)', [kind, ref]);
                    await db.query('INSERT INTO public.admin_signals (kind, ref_id) VALUES ($1, $2)', [kind, ref]);
                    res[kind] = 'doublon accepté';
                } catch (err) {
                    res[kind] = String((err as { code?: string }).code ?? (err as Error).message);
                }
                await db.query('ROLLBACK TO SAVEPOINT s');
            }
            await db.query('SAVEPOINT t');
            let first = 'accepté';
            try {
                await db.query('INSERT INTO public.admin_signals (kind, ref_id) VALUES ($1, $2)', ['NOTIFICATION_FAILED', ref]);
            } catch (err) {
                first = String((err as { code?: string }).code ?? (err as Error).message);
            }
            await db.query('ROLLBACK TO SAVEPOINT t');
            return { res, first };
        });
        assert.equal(out.first, 'accepté', `type NOTIFICATION_FAILED accepté par le CHECK (C6) : ${out.first}`);
        assert.deepEqual(out.res, {
            NOTIFICATION_FAILED: '23505', SMS_DAILY_THRESHOLD: '23505', CASHOUT_UNCERTAIN: '23505', REFUND_TO_RETRY: '23505',
        }, 'second signal de même référence : violation d’unicité (23505), pas de refus du CHECK (23514)');
    });
});
