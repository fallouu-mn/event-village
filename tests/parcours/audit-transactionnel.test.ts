/**
 * Lot 9 bis, tâche 19 (ex-10.0 c ; contrat 5.19, B45) — journal d'audit transactionnel pour l'argent, les rôles et les
 * permissions : si l'écriture du journal échoue, l'action échoue et rien n'est changé.
 * Méthode : une contrainte d'essai `CHECK (…) NOT VALID` est posée sur audit_logs par une connexion locale
 * (tests/helpers/db.ts), nommée par la suite, puis retirée dans un finally. Elle refuse le journal de l'action visée :
 *  - rôles : toute ligne d'audit sur le compte cible qui ne vient pas d'un déclencheur ligne à ligne (actions INSERT,
 *    UPDATE, DELETE de audit_log_changes) → PATCH /api/admin/users (rôles) échoue, rôles inchangés ;
 *  - statut d'une partenaire : idem sur la fiche et son compte → PATCH /api/admin/partners/[id]/status échoue, statut
 *    inchangé ;
 *  - permissions : idem sur l'admin cible → admin_permissions_set échoue (témoin, déjà transactionnel) ;
 *  - argent : toute ligne d'audit d'un versement de remboursement du billet (object_type cashouts, clé REFUND-TKT-…)
 *    → le remboursement échoue, aucun versement, billet VALIDE (trigger trg_audit_cashouts, B45) ;
 *  - affectations : action CONTROLLER_ASSIGNMENTS_UPDATED → PATCH /api/partner/team/assignments échoue, rien de changé ;
 *  - décision admin sur un versement : action CASHOUT_MARKED_PAID → POST /api/admin/cashouts/[id]/mark-paid échoue, le
 *    versement reste INCERTAIN.
 * SUPPOSÉ (signalé) : l'audit écrit par user_roles_set et partner_status_set porte l'identifiant du compte ou de la fiche
 * dans object_id, comme les journaux actuels des routes.
 *
 * Rouge avant correctif (fix(9b.19), fix(9b.15-SA), fix(9b.1), fix(9b.18-SC)) : AdminService.logAudit ne lit pas
 * l'erreur (lib/admin/admin.service.ts:283-297) et la route du statut rend `audit_logged: false` en 200 ; aucun
 * déclencheur d'audit sur cashouts ; l'audit des affectations est non bloquant ; la route mark-paid n'existe pas.
 * Vert dès l'écriture (témoin, signalé) : admin_permissions_set (audit dans la RPC, M/20261108000001:614).
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { openConcurrentClient } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, setFakeMode } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, createPartnerEvent, jsonRequest, newPartner } from './finance-helpers';
import { newController, type RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9bisInvariants('audit-transactionnel');
});

type Row = Record<string, unknown>;

const REASON = 'Test lot 9 bis : journal d’audit transactionnel';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function ddl(sql: string): Promise<void> {
    const db = await openConcurrentClient({ applicationName: 'ev-test-audit-9bis' });
    try {
        await db.query(sql);
        await db.commit();
    } finally {
        await db.close();
    }
}

/** Contrainte d'essai sur audit_logs le temps de fn, retirée dans un finally. */
async function withAuditRefused<T>(check: string, fn: () => Promise<T>): Promise<T> {
    const name = `essai_audit_${randomBytes(4).toString('hex')}`;
    await ddl(`ALTER TABLE public.audit_logs ADD CONSTRAINT ${name} CHECK (${check}) NOT VALID`);
    try {
        return await fn();
    } finally {
        await ddl(`ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS ${name}`);
    }
}

/** Refuse toute ligne d'audit sur ces objets, sauf celles des déclencheurs ligne à ligne (audit_log_changes). */
function noAuditAbout(ids: string[]): string {
    for (const id of ids) assert.match(id, UUID, 'identifiant attendu');
    return `object_id IS NULL OR object_id NOT IN (${ids.map((id) => `'${id}'::uuid`).join(', ')}) OR action IN ('INSERT', 'UPDATE', 'DELETE')`;
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, error?.message);
    return (data ?? []).map((r) => String(r.role)).sort();
}

describe('ex-10.0 c — rôles, statuts et permissions', () => {
    test('PATCH /api/admin/users (rôles) : journal refusé → échec, rôles inchangés', async () => {
        const superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'audit-roles' });
        const target = await newBuyer('audit-roles-cible');
        const before = await rolesOf(target.userId);
        const res = await withAuditRefused(noAuditAbout([target.userId]), async () => invoke(
            await routeHandler('../../app/api/admin/users/route', 'PATCH', 'PATCH /api/admin/users'),
            jsonRequest('/api/admin/users', 'PATCH', superadmin.accessToken, { userId: target.userId, roles: ['CLIENT', 'CONTROLEUR'] })));
        assert.ok(res.status >= 500, `ex-10.0 c : changement de rôles sans journal accepté : ${show(res)}`);
        assert.deepEqual(await rolesOf(target.userId), before, 'rôles inchangés');
    });

    test('PATCH /api/admin/partners/[id]/status (suspension) : journal refusé → échec, fiche et compte inchangés', async () => {
        const admin = await newAdminWith(['partners.suspend', 'partners.validate'], { label: 'audit-statut' });
        const p = await newPartner('audit-statut');
        const res = await withAuditRefused(noAuditAbout([p.partnerId, p.userId]), async () => invoke(
            await routeHandler('../../app/api/admin/partners/[id]/status/route', 'PATCH', 'PATCH /api/admin/partners/[id]/status'),
            jsonRequest(`/api/admin/partners/${p.partnerId}/status`, 'PATCH', admin.accessToken, { status: 'SUSPENDU', reason: REASON }),
            ctx({ id: p.partnerId })));
        assert.ok(res.status >= 500, `ex-10.0 c : suspension sans journal acceptée (audit_logged : ${String(res.body.audit_logged)}) : ${show(res)}`);
        const { data: partner, error } = await service.from('partners').select('status').eq('id', p.partnerId).single();
        assert.equal(error, null, error?.message);
        assert.equal(partner.status, 'VALIDE', 'fiche toujours VALIDE');
        const { data: user, error: uErr } = await service.from('users').select('status').eq('id', p.userId).single();
        assert.equal(uErr, null, uErr?.message);
        assert.equal(user.status, 'ACTIF', 'compte toujours ACTIF');
    });

    test('témoin (vert dès l’écriture) : admin_permissions_set, journal refusé → échec, permissions inchangées', async () => {
        const superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'audit-perms' });
        const target = await newAdminWith(['events.read'], { label: 'audit-perms-cible' });
        const res = await withAuditRefused(noAuditAbout([target.userId]), async () => invoke(
            await routeHandler('../../app/api/admin/permissions/route', 'POST', 'POST /api/admin/permissions'),
            jsonRequest('/api/admin/permissions', 'POST', superadmin.accessToken, { adminId: target.userId, permissions: ['events.read', 'events.write'] })));
        assert.ok(res.status >= 400, `permissions sans journal acceptées : ${show(res)}`);
        const { data, error } = await service.from('admin_permissions').select('permission').eq('user_id', target.userId);
        assert.equal(error, null, error?.message);
        assert.deepEqual((data ?? []).map((r) => String(r.permission)).sort(), ['events.read'], 'permissions inchangées');
    });
});

describe('ex-10.0 c — argent et affectations', () => {
    test('remboursement d’un billet : journal du versement refusé → échec, aucun versement, billet VALIDE', async () => {
        const partner = await newPartner('audit-argent');
        const ev = await createPartnerEvent(partner.partnerId, 'audit-argent', [{ name: 'Standard', price: 4_000, total: 10 }]);
        const buyer = await newBuyer('audit-argent');
        const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const ticketId = String(tickets[0].id);
        const key = `REFUND-TKT-${ticketId}`;
        const check = `object_type IS DISTINCT FROM 'cashouts' OR COALESCE(new_value->>'idempotency_key', old_value->>'idempotency_key', '') NOT LIKE '${key}%'`;
        const res = await withAuditRefused(check, async () => invoke(
            await routeHandler('../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route', 'POST', 'POST …/tickets/[ticketId]/refund'),
            jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken, { reason: REASON }),
            ctx({ id: ev.eventId, ticketId })));
        const cashouts = await cashoutsByKey(key);
        if (cashouts.length > 0) {
            for (const c of cashouts) await CashoutService.send(String(c.id));
            await confirmCashouts();
        }
        assert.ok(res.status >= 500, `ex-10.0 c : versement créé sans journal (aucun audit sur cashouts) : ${show(res)}`);
        assert.equal(cashouts.length, 0, 'aucun versement');
        const { data, error } = await service.from('tickets').select('status').eq('id', ticketId).single();
        assert.equal(error, null, error?.message);
        assert.equal(data.status, 'VALIDE', 'billet toujours VALIDE');
    });

    test('affectations : journal CONTROLLER_ASSIGNMENTS_UPDATED refusé → échec, affectations inchangées', async () => {
        const partner = await newPartner('audit-equipe');
        const evA = await createPartnerEvent(partner.partnerId, 'audit-equipe-a', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const evB = await createPartnerEvent(partner.partnerId, 'audit-equipe-b', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const ctrl = await newController(partner, evA.eventId, { label: 'audit-equipe' });
        const res = await withAuditRefused(`action IS DISTINCT FROM 'CONTROLLER_ASSIGNMENTS_UPDATED'`, async () => invoke(
            await routeHandler('../../app/api/partner/team/assignments/route', 'PATCH', 'PATCH /api/partner/team/assignments'),
            jsonRequest('/api/partner/team/assignments', 'PATCH', partner.accessToken, {
                controller_id: ctrl.userId,
                assignments: [{ event_id: evA.eventId, can_accept_cash: false }, { event_id: evB.eventId, can_accept_cash: false }],
            })));
        assert.ok(res.status >= 500, `ex-10.0 c : affectations sans journal acceptées : ${show(res)}`);
        const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', ctrl.userId);
        assert.equal(error, null, error?.message);
        assert.deepEqual((data ?? []).map((r) => String(r.event_id)), [evA.eventId], 'affectations inchangées (A seul)');
    });

    test('« Marquer versé » (cashout_admin_decide) : journal CASHOUT_MARKED_PAID refusé → échec, versement toujours INCERTAIN', async () => {
        const partner = await newPartner('audit-decision');
        const ev = await createPartnerEvent(partner.partnerId, 'audit-decision', [{ name: 'Standard', price: 4_000, total: 10 }]);
        const buyer = await newBuyer('audit-decision');
        const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const ticketId = String(tickets[0].id);
        setFakeMode('cashoutMode', 'timeout');
        let refund: RouteResult | null = null;
        try {
            refund = await invoke(await routeHandler('../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route', 'POST', 'POST …/tickets/[ticketId]/refund'),
                jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken, { reason: REASON }), ctx({ id: ev.eventId, ticketId }));
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.ok(refund, 'appel de la route fait');
        assert.equal(refund.status, 200, `remboursement (versement à l’issue incertaine) : ${show(refund)}`);
        const [cashout] = await cashoutsByKey(`REFUND-TKT-${ticketId}`);
        assert.ok(cashout, 'versement créé');
        assert.equal(cashout.status, 'INCERTAIN', `précondition : versement INCERTAIN (${String(cashout.status)})`);
        const cashoutId = String(cashout.id);

        const admin = await newAdminWith(['refunds.manage'], { label: 'audit-decision' });
        const markPaid = async (): Promise<RouteResult> => invoke(
            await routeHandler('../../app/api/admin/cashouts/[id]/mark-paid/route', 'POST', 'POST /api/admin/cashouts/[id]/mark-paid (B4)'),
            jsonRequest(`/api/admin/cashouts/${cashoutId}/mark-paid`, 'POST', admin.accessToken, { reason: REASON, reference: `TX${randomBytes(4).toString('hex').toUpperCase()}` }),
            ctx({ id: cashoutId }));
        const res = await withAuditRefused(`action IS DISTINCT FROM 'CASHOUT_MARKED_PAID'`, markPaid);
        assert.ok(res.status >= 500, `ex-10.0 c : décision sans journal acceptée : ${show(res)}`);
        const { data, error } = await service.from('cashouts').select('status').eq('id', cashoutId).single();
        assert.equal(error, null, error?.message);
        assert.equal(data.status, 'INCERTAIN', 'versement toujours INCERTAIN');

        const settled = await markPaid();
        assert.equal(settled.status, 200, `témoin : « Marquer versé » avec son journal : ${show(settled)}`);
    });
});
