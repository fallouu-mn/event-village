/**
 * Lot 5, tâche 5.0 — sécurité urgente A1 : PATCH /api/admin/services n'écrit plus, avec le rôle de
 * service, dans la table que le corps de la requête désigne. Contrat : section A1 de la conception
 * du lot 5.
 *  - liste blanche des tables (hall_reservations, table_reservations, orders) et des statuts admis
 *    par table ; `events` est retirée de la route (les statuts passent par la machine à états, D) ;
 *  - toute autre table → 400 INVALID_SERVICE_TABLE (message français), sans aucune écriture ;
 *  - un ADMIN qui n'a que la permission `events.write` ne passe pas un paiement à SUCCESS :
 *    paiement, billets et grand livre inchangés.
 *
 * Rouge avant correctif : app/api/admin/services/route.ts:89-126. `table` vient du corps JSON sans
 * contrôle (typage TS seulement, l.89) ; hors `events`, la route exécute
 * getServiceRoleClient().from(table).update({ status, updated_at }) (l.113-125) et répond 200 :
 *  - `payments` passe à SUCCESS, et le trigger trg_payments_sale_credit crédite alors le grand livre
 *    (supabase/migrations/20261101000004_lot3_grand_livre.sql:262-300) ;
 *  - `users` passe à SUSPENDU ;
 *  - une table inconnue finit en 500 avec le message brut de PostgREST (l.143-146) ;
 *  - pour `events`, la route appelle EventService.changeEventStatus (l.104-111).
 *
 * Interprétation retenue (contrat muet sur les statuts admis par table) : le garde-fou suppose
 * hall_reservations dans la liste blanche, avec le statut ANNULEE (annulation d'une réservation de
 * salle par l'admin). Signalé au rapport.
 * Remise en état : si une écriture interdite passe (code d'avant le correctif), le test remet la ligne
 * dans son état d'origine dans un finally (paiement, écriture VENTE créée par le trigger, compte),
 * pour ne pas fausser les invariants des suites suivantes. Les lignes touchées sont toutes créées par
 * la suite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { cart, checkout, importModule, newBuyer, paymentById, service, type Buyer, type PaymentRow, type SaleEvent } from './paiement-helpers';
import { jsonRequest, ledgerOf, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, type RouteResult } from './acces-helpers';

const ROUTE = '../../app/api/admin/services/route';
const PRICE = 5000;

let partner: TestPartner;
let ev: SaleEvent;
let buyer: Buyer;
let moderator: Buyer;

before(async () => {
    partner = await newPartner('dette-services');
    ev = await createTimedEvent(partner.partnerId, 'dette-services', [{ name: 'Standard', price: PRICE, total: 30 }], { startsInHours: 72 });
    buyer = await newBuyer('svc-acheteur');
    moderator = await newEventsWriter();
});

after(async () => {
    await assertLifecycleInvariants('dette-admin-services');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Handler = (req: NextRequest) => Promise<Response>;

/** ADMIN dédié à la suite, avec la seule permission events.write. */
async function newEventsWriter(): Promise<Buyer> {
    const admin = await newBuyer('svc-moderateur', { firstName: 'Ndeye', lastName: 'Moderatrice' });
    const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(roleErr, null, `rôle ADMIN : ${roleErr?.message}`);
    const { error: permErr } = await service.from('admin_permissions').upsert(
        { user_id: admin.userId, permission: 'events.write' }, { onConflict: 'user_id,permission' });
    assert.equal(permErr, null, `permission events.write : ${permErr?.message}`);
    const { data: perms, error: readErr } = await service.from('admin_permissions').select('permission').eq('user_id', admin.userId);
    assert.equal(readErr, null, `lecture des permissions : ${readErr?.message}`);
    assert.deepEqual((perms ?? []).map((p) => p.permission), ['events.write'], 'précondition : l’ADMIN n’a que la permission events.write');
    return admin;
}

async function patchServices(user: Buyer, body: Record<string, unknown>): Promise<RouteResult> {
    const mod = await importModule(ROUTE);
    const handler = mod.PATCH as Handler | undefined;
    assert.equal(typeof handler, 'function', `${ROUTE} : gestionnaire PATCH exporté`);
    const res = await handler!(jsonRequest('/api/admin/services', 'PATCH', user.accessToken, body));
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
        parsed = text ? JSON.parse(text) : {};
    } catch {
        parsed = { raw: text };
    }
    return { status: res.status, body: parsed };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

/** Refus du contrat : 400 INVALID_SERVICE_TABLE avec un message français, jamais l'erreur brute. */
function assertInvalidTable(res: RouteResult, label: string): void {
    assert.equal(res.status, 400, `${label} : 400 attendu, reçu ${show(res)}`);
    assert.equal(res.body.code, 'INVALID_SERVICE_TABLE', `${label} : code INVALID_SERVICE_TABLE attendu : ${show(res)}`);
    assert.equal(typeof res.body.error, 'string', `${label} : message d’erreur attendu : ${show(res)}`);
    assert.doesNotMatch(String(res.body.error), /relation|schema cache|PGRST|violates|column/i, `${label} : message brut de la base renvoyé : ${show(res)}`);
}

async function ledgerOfPayment(paymentId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('finance_ledger').select('id, entry_type, amount, source_key').eq('payment_id', paymentId);
    assert.equal(error, null, `grand livre du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

async function ticketsOfPayment(paymentId: string): Promise<string[]> {
    const { data, error } = await service.from('tickets').select('id').eq('payment_id', paymentId);
    assert.equal(error, null, `billets du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []).map((t) => t.id as string);
}

async function eventStatusOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('status').eq('id', eventId).single();
    assert.equal(error, null, `statut de l’événement ${eventId} : ${error?.message}`);
    return String(data.status);
}

async function userStatusOf(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut du compte ${userId} : ${error?.message}`);
    return String(data.status);
}

/** Remet un paiement passé à tort à SUCCESS (code d'avant le correctif) : écriture VENTE retirée, statut d'origine. */
async function restorePayment(paymentId: string, original: PaymentRow): Promise<void> {
    const now = await paymentById(paymentId);
    if (now.status === original.status) return;
    const { error: ledgerErr } = await service.from('finance_ledger').delete().eq('payment_id', paymentId);
    assert.equal(ledgerErr, null, `remise en état : écritures du paiement ${paymentId} : ${ledgerErr?.message}`);
    const { error: payErr } = await service.from('payments').update({ status: original.status }).eq('id', paymentId);
    assert.equal(payErr, null, `remise en état : statut du paiement ${paymentId} : ${payErr?.message}`);
}

// ── A1 ─────────────────────────────────────────────────────────────────────

describe('A1 — PATCH /api/admin/services : liste blanche des tables', () => {
    test('ADMIN events.write qui passe un paiement à SUCCESS → 400 INVALID_SERVICE_TABLE ; paiement, billets et grand livre inchangés', async () => {
        const res0 = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(res0.status, 200, `checkout de préparation : HTTP ${res0.status} ${JSON.stringify(res0.body)}`);
        assert.ok(res0.payment, 'paiement de préparation créé par le checkout');
        const original = await paymentById(res0.payment!.id);
        assert.notEqual(original.status, 'SUCCESS', `précondition : paiement non confirmé (${original.status})`);
        const ledgerBefore = await ledgerOf(partner.userId, 'ORGANISATEUR');
        assert.deepEqual(await ledgerOfPayment(original.id), [], 'précondition : aucune écriture au grand livre pour ce paiement');
        assert.deepEqual(await ticketsOfPayment(original.id), [], 'précondition : aucun billet émis');

        try {
            const res = await patchServices(moderator, { table: 'payments', id: original.id, status: 'SUCCESS' });
            const now = await paymentById(original.id);
            assert.equal(now.status, original.status, `paiement passé à ${now.status} par la route de modération (${show(res)})`);
            assertInvalidTable(res, 'payments');
            assert.deepEqual(await ledgerOfPayment(original.id), [], 'aucune écriture VENTE créée pour ce paiement');
            assert.deepEqual(await ledgerOf(partner.userId, 'ORGANISATEUR'), ledgerBefore, 'grand livre du partenaire inchangé');
            assert.deepEqual(await ticketsOfPayment(original.id), [], 'aucun billet émis');
        } finally {
            await restorePayment(original.id, original);
        }
    });

    test('table users (statut d’un compte) → 400 INVALID_SERVICE_TABLE ; compte inchangé', async () => {
        const victim = await newBuyer('svc-victime');
        assert.equal(await userStatusOf(victim.userId), 'ACTIF', 'précondition : compte ACTIF');
        try {
            const res = await patchServices(moderator, { table: 'users', id: victim.userId, status: 'SUSPENDU' });
            assert.equal(await userStatusOf(victim.userId), 'ACTIF', `compte suspendu par la route de modération (${show(res)})`);
            assertInvalidTable(res, 'users');
        } finally {
            if (await userStatusOf(victim.userId) !== 'ACTIF') {
                const { error } = await service.from('users').update({ status: 'ACTIF' }).eq('id', victim.userId);
                assert.equal(error, null, `remise en état du compte : ${error?.message}`);
            }
        }
    });

    test('table events : retirée de la route → 400 INVALID_SERVICE_TABLE ; statut inchangé (transitions par la section D)', async () => {
        const target = await createTimedEvent(partner.partnerId, 'dette-services-evt', [{ name: 'Standard', price: PRICE, total: 5 }], { startsInHours: 72 });
        const before = await eventStatusOf(target.eventId);
        assert.equal(before, 'PUBLIE', 'précondition : événement PUBLIE');
        const res = await patchServices(moderator, { table: 'events', id: target.eventId, status: 'SUSPENDU', reason: 'Suspension par la route générique' });
        assert.equal(await eventStatusOf(target.eventId), before, `statut de l’événement changé par la route générique (${show(res)})`);
        assertInvalidTable(res, 'events');
    });

    test('table inconnue → 400 INVALID_SERVICE_TABLE (jamais un 500 avec l’erreur brute)', async () => {
        const res = await patchServices(moderator, { table: 'table_inexistante_lot5', id: randomUUID(), status: 'ACTIF' });
        assertInvalidTable(res, 'table inconnue');
    });

    test('garde-fou : annulation d’une réservation de salle (table de la liste blanche) → 200, statut ANNULEE', async () => {
        const { data: hall, error: hallErr } = await service.from('halls').insert({
            partner_id: partner.partnerId, name: `TEST Salle services ${randomUUID().slice(0, 8)}`, capacity: 80,
            price_per_day: 100000, deposit_percentage: 30, city: 'Dakar', is_active: true,
        }).select('id').single();
        assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
        const day = new Date(Date.now() + 40 * 24 * 3600_000).toISOString().slice(0, 10);
        const { data: resa, error: resaErr } = await service.from('hall_reservations').insert({
            hall_id: hall.id, client_id: buyer.userId, partner_id: partner.partnerId,
            start_date: day, end_date: day, total_amount: 100000, deposit_amount: 30000, balance_amount: 70000,
        }).select('id, status').single();
        assert.equal(resaErr, null, `réservation de salle : ${resaErr?.message}`);
        assert.equal(resa.status, 'EN_ATTENTE', 'précondition : réservation EN_ATTENTE');

        const res = await patchServices(moderator, { table: 'hall_reservations', id: resa.id, status: 'ANNULEE', reason: 'Annulation par la modération' });
        assert.equal(res.status, 200, `annulation d’une réservation de salle : ${show(res)}`);
        const { data: after, error: afterErr } = await service.from('hall_reservations').select('status').eq('id', resa.id).single();
        assert.equal(afterErr, null, `relecture de la réservation : ${afterErr?.message}`);
        assert.equal(after.status, 'ANNULEE', 'réservation annulée');
    });
});
