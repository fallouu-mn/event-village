/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrages 1 à 4, D3 ; contrat 5.A, A.1.5 suite 4, invariant x2) — les
 * écritures REST des autres services (salles, tables, commandes, produits, paiements, retraits) sont fermées à tous,
 * et un administrateur suspendu perd ses écritures et ses lectures REST.
 *  1. client : PATCH des montants, du paiement, du statut ou du partenaire de sa réservation de salle → 42501 ;
 *  2. client : PATCH de sa réservation de table → 42501 ;
 *  3. client : ajout d'une ligne à sa commande → 42501, aucune ligne ;
 *  4. partenaire en attente, partenaire suspendue : PATCH de commande (payée, montant, client) → 42501 ;
 *  5. partenaire en attente, partenaire suspendue : création de salle, produit, zone, table, catégorie de produits,
 *     activité → 42501, aucune ligne ;
 *  6. ADMIN suspendu (nouvelle connexion) : valider une fiche, écrire paiements, retraits et remboursements → 42501 ;
 *  7. D3 : un ADMIN suspendu ne lit plus les comptes, les fiches en attente ni les pièces ; un SUPERADMIN suspendu
 *     ne lit plus le journal ; témoins actifs.
 *
 * Acteurs testés : clients créés par la clé anon et connectés par mot de passe (nouvelle connexion, précondition
 * explicite qu'elle réussit) ; montage par le client serveur seulement (patrons dette-publication-reservations et
 * finance-cibles : colonnes NOT NULL, valeurs de test). Chaque cas s'arrête à la première écriture acceptée ; les
 * écritures d'argent et d'administration visent un identifiant inexistant (ZERO_UUID) : aucun effet au run « avant ».
 *
 * Rouge avant correctif (fix(9t.1), migration 20261110000001_lot9ter_rls) :
 *  - 1 : hall_reservations_update (M/0003_rls.sql:187-192) ; 2 : table_reservations_update (:220-225) ;
 *  - 3 : order_items_insert (:264-268) ; 4 : orders_update (:253-257) ;
 *  - 5 : partner_activities_manage, halls_partner_manage, restaurant_zones_manage, restaurant_tables_manage,
 *    product_categories_manage, products_manage (is_partner_owner ignore l'état de la fiche, M/0003_rls.sql:33-40) ;
 *  - 6 : partners_update_owner, payments_admin_update, refunds_admin_manage, withdrawals_admin_manage (is_admin()
 *    ignore users.status, M/20260906000004:208-211) ;
 *  - 7 : is_admin() et is_superadmin() ignorent users.status (M/20260906000004:202-211).
 * Fin de suite : pièce retirée du seau, puis assertLot9terInvariants (rouge tant que le schéma du lot 9 ter n'est pas
 * complet).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { MINIMAL_PDF, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { newAdminWith } from './terrain-helpers';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const SUSPEND_REASON = 'Test du lot 9 ter';

type Row = Record<string, unknown>;

interface Signed {
    client: SupabaseClient;
    userId: string;
}

let client: Buyer;
let pEA: TestPartner;
let pSU: TestPartner;
let p2: TestPartner;
let hallReservationId: string;
let tableReservationId: string;
let orderEA: string;
let orderSU: string;
let productEA: { id: string; name: string };
let piecePath: string | null = null;

after(async () => {
    try {
        if (piecePath) {
            const { error } = await service.storage.from('partner_documents').remove([piecePath]);
            if (error) throw new Error(`retrait de la pièce de test ${piecePath} : ${error.message}`);
        }
    } finally {
        await assertLot9terInvariants('securite-ecritures-services-9ter');
    }
});

/** Nouvelle connexion par mot de passe avec la clé anon seule : précondition explicite qu'elle réussit. */
async function signIn(user: Pick<Buyer, 'email' | 'userId'>, who: string): Promise<Signed> {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `précondition : nouvelle connexion de ${who} réussie : ${error?.message}`);
    assert.ok(data.session, `précondition : session ouverte pour ${who}`);
    return { client: c, userId: user.userId };
}

function assertDenied42501(error: { code?: string; message?: string } | null, what: string): void {
    assert.equal(error?.code, '42501', `${what} : refus 42501 attendu, obtenu ${error ? `code=${error.code} ${error.message}` : 'aucune erreur (écriture REST acceptée)'}`);
}

async function rowOf(table: string, id: string): Promise<Row> {
    const { data, error } = await service.from(table).select('*').eq('id', id).single();
    assert.equal(error, null, `relecture ${table} ${id} : ${error?.message}`);
    return data as Row;
}

async function countWhere(table: string, filters: Record<string, string>): Promise<number> {
    let q = service.from(table).select('id', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { count, error } = await q;
    assert.equal(error, null, `${table} : ${error?.message}`);
    return count ?? 0;
}

async function statusSet(partner: TestPartner, status: string, reason?: string): Promise<void> {
    const p: Row = { partner_id: partner.partnerId, actor_id: await superadminId(), status };
    if (reason) p.reason = reason;
    const { data, error } = await service.rpc('partner_status_set', { p });
    assert.equal(error, null, `partner_status_set ${status} : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `partner_status_set ${status} refusé : ${JSON.stringify(data)}`);
}

async function suspendAccount(userId: string): Promise<void> {
    const { data, error } = await service.rpc('admin_user_status_set', {
        p: { user_id: userId, actor_id: await superadminId(), status: 'SUSPENDU', reason: SUSPEND_REASON },
    });
    assert.equal(error, null, `admin_user_status_set : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `suspension du compte refusée : ${JSON.stringify(data)}`);
    const { data: u, error: uErr } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(uErr, null, uErr?.message);
    assert.equal(u.status, 'SUSPENDU', 'précondition : compte SUSPENDU');
}

/** Salle et table neuves à chaque montage : aucune réservation concurrente, un décalage fixe suffit. */
let dayOffset = 400;
function futureDate(): string {
    dayOffset += 1;
    return new Date(Date.now() + dayOffset * 24 * 3600_000).toISOString().slice(0, 10);
}

async function createOrder(partner: TestPartner): Promise<string> {
    const { data, error } = await service.from('orders').insert({
        order_number: `CMD-9TER-${randomUUID()}`,
        client_id: client.userId, partner_id: partner.partnerId,
        subtotal: 3000, total_amount: 3000, paid_amount: 0, balance_amount: 3000,
        payment_type: 'INTEGRAL', delivery_mode: 'RETRAIT', order_status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `commande : ${error?.message}`);
    return String(data.id);
}

before(async () => {
    client = await newBuyer('9t1-svc-client');
    pEA = await newPartner('9t1-svc-ea');
    {
        const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', pEA.partnerId);
        assert.equal(error, null, `fiche EN_ATTENTE : ${error?.message}`);
        const { error: uErr } = await service.from('users').update({ status: 'EN_ATTENTE' }).eq('id', pEA.userId);
        assert.equal(uErr, null, `compte EN_ATTENTE : ${uErr?.message}`);
    }
    pSU = await newPartner('9t1-svc-su');
    await statusSet(pSU, 'SUSPENDU', 'Suspension de test du lot 9 ter');
    p2 = await newPartner('9t1-svc-p2');

    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: p2.partnerId, name: `TEST Salle 9 ter ${randomUUID().slice(0, 8)}`, capacity: 100,
        price_per_day: 50_000, deposit_percentage: 100, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    const day = futureDate();
    const { data: hr, error: hrErr } = await service.from('hall_reservations').insert({
        hall_id: hall.id, client_id: client.userId, partner_id: p2.partnerId,
        start_date: day, end_date: day, total_amount: 50_000, deposit_amount: 50_000, balance_amount: 0,
        status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(hrErr, null, `réservation de salle : ${hrErr?.message}`);
    hallReservationId = String(hr.id);

    const { data: table, error: tableErr } = await service.from('restaurant_tables').insert({
        partner_id: p2.partnerId, table_number: `T-${randomUUID().slice(0, 8)}`, capacity: 4, is_active: true,
    }).select('id').single();
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);
    const { data: tr, error: trErr } = await service.from('table_reservations').insert({
        partner_id: p2.partnerId, table_id: table.id, client_id: client.userId,
        reservation_date: futureDate(), reservation_time: '20:00:00', guest_count: 2,
        deposit_amount: 10_000, is_platform_payment: true, status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(trErr, null, `réservation de table : ${trErr?.message}`);
    tableReservationId = String(tr.id);

    const { data: product, error: prodErr } = await service.from('products').insert({
        partner_id: pEA.partnerId, name: `TEST Plat 9 ter ${randomUUID().slice(0, 8)}`, price: 3000, status: 'DISPONIBLE',
    }).select('id, name').single();
    assert.equal(prodErr, null, `produit : ${prodErr?.message}`);
    productEA = { id: String(product.id), name: String(product.name) };
    orderEA = await createOrder(pEA);
    orderSU = await createOrder(pSU);

    piecePath = `${pEA.userId}/piece-9ter.pdf`;
    const { error: upErr } = await service.storage.from('partner_documents').upload(piecePath, MINIMAL_PDF, { contentType: 'application/pdf', upsert: true });
    assert.equal(upErr, null, `pièce de test : ${upErr?.message}`);
});

describe('9t.1 — écritures REST des services : refusées à tous', () => {
    test('client : PATCH des montants, du paiement, du statut ou du partenaire de sa réservation de salle → 42501, ligne identique', async () => {
        const c = await signIn(client, 'la cliente');
        const snapshot = await rowOf('hall_reservations', hallReservationId);
        for (const patch of [{ deposit_amount: 100, balance_amount: 0 }, { payment_status: 'SUCCESS', status: 'CONFIRMEE' }, { partner_id: pEA.partnerId }]) {
            const { error } = await c.client.from('hall_reservations').update(patch).eq('id', hallReservationId);
            assertDenied42501(error, `client : PATCH hall_reservations ${JSON.stringify(patch)}`);
        }
        assert.deepEqual(await rowOf('hall_reservations', hallReservationId), snapshot, 'réservation de salle inchangée');
    });

    test('client : PATCH de sa réservation de table → 42501', async () => {
        const c = await signIn(client, 'la cliente');
        const snapshot = await rowOf('table_reservations', tableReservationId);
        for (const patch of [{ deposit_amount: 0 }, { payment_status: 'SUCCESS' }]) {
            const { error } = await c.client.from('table_reservations').update(patch).eq('id', tableReservationId);
            assertDenied42501(error, `client : PATCH table_reservations ${JSON.stringify(patch)}`);
        }
        assert.deepEqual(await rowOf('table_reservations', tableReservationId), snapshot, 'réservation de table inchangée');
    });

    test('client : ajout d’une ligne à sa commande → 42501, aucune ligne', async () => {
        const c = await signIn(client, 'la cliente');
        const { error } = await c.client.from('order_items').insert({
            order_id: orderEA, product_id: productEA.id, product_name: productEA.name, quantity: 10, unit_price: 0, total_price: 0,
        });
        assertDenied42501(error, 'client : POST order_items');
        assert.equal(await countWhere('order_items', { order_id: orderEA }), 0, 'aucune ligne de commande');
    });

    test('partenaire en attente, partenaire suspendue : PATCH de commande (payée, montant, client) → 42501', async () => {
        for (const [who, partner, orderId] of [['partenaire en attente', pEA, orderEA], ['partenaire suspendue', pSU, orderSU]] as const) {
            const s = await signIn(partner, who);
            const snapshot = await rowOf('orders', orderId);
            for (const patch of [{ payment_status: 'SUCCESS', paid_amount: 3000, balance_amount: 0 }, { total_amount: 1 }, { client_id: partner.userId }]) {
                const { error } = await s.client.from('orders').update(patch).eq('id', orderId);
                assertDenied42501(error, `${who} : PATCH orders ${JSON.stringify(patch)}`);
            }
            assert.deepEqual(await rowOf('orders', orderId), snapshot, `${who} : commande inchangée`);
        }
    });

    test('partenaire en attente, partenaire suspendue : création de salle, produit, zone, table, catégorie de produits, activité → 42501, aucune ligne', async () => {
        for (const [who, partner] of [['partenaire en attente', pEA], ['partenaire suspendue', pSU]] as const) {
            const s = await signIn(partner, who);
            const tag = `REST 9 ter ${randomUUID().slice(0, 8)}`;
            const attempts: Array<[string, Row, Record<string, string>]> = [
                ['halls', { partner_id: partner.partnerId, name: tag, capacity: 10, price_per_day: 0 }, { partner_id: partner.partnerId, name: tag }],
                ['products', { partner_id: partner.partnerId, name: tag, price: 0 }, { partner_id: partner.partnerId, name: tag }],
                ['restaurant_zones', { partner_id: partner.partnerId, name: tag }, { partner_id: partner.partnerId, name: tag }],
                ['restaurant_tables', { partner_id: partner.partnerId, table_number: tag, capacity: 2 }, { partner_id: partner.partnerId, table_number: tag }],
                ['product_categories', { partner_id: partner.partnerId, name: tag }, { partner_id: partner.partnerId, name: tag }],
                ['partner_activities', { partner_id: partner.partnerId, activity_type: 'SALLE' }, { partner_id: partner.partnerId, activity_type: 'SALLE' }],
            ];
            for (const [table, row, lookup] of attempts) {
                const { error } = await s.client.from(table).insert(row);
                assertDenied42501(error, `${who} : POST ${table}`);
                assert.equal(await countWhere(table, lookup), 0, `${who} : aucune ligne ${table}`);
            }
        }
    });

    test('ADMIN suspendu (nouvelle connexion) : valider une fiche, écrire paiements, retraits et remboursements par REST → 42501', async () => {
        const admin = await newAdminWith([], { label: '9t1-adm-susp' });
        await suspendAccount(admin.userId);
        const a = await signIn(admin, 'l’ADMIN suspendu');

        const { error: pErr } = await a.client.from('partners').update({ status: 'VALIDE' }).eq('id', pEA.partnerId);
        assertDenied42501(pErr, 'ADMIN suspendu : PATCH partners.status = VALIDE');
        assert.equal((await rowOf('partners', pEA.partnerId)).status, 'EN_ATTENTE', 'fiche toujours EN_ATTENTE');

        const pay = await a.client.from('payments').update({ status: 'SUCCESS', partner_payout_amount: 1 }).eq('id', ZERO_UUID);
        assertDenied42501(pay.error, 'ADMIN suspendu : PATCH payments');
        const wd = await a.client.from('withdrawals').update({ status: 'PAID' }).eq('id', ZERO_UUID);
        assertDenied42501(wd.error, 'ADMIN suspendu : PATCH withdrawals');
        const rf = await a.client.from('refunds').delete().eq('id', ZERO_UUID);
        assertDenied42501(rf.error, 'ADMIN suspendu : DELETE refunds');
    });

    test('D3 : un ADMIN suspendu ne lit plus les comptes, les fiches en attente ni les pièces ; un SUPERADMIN suspendu ne lit plus le journal ; témoins actifs', async () => {
        const admin = await newAdminWith([], { label: '9t1-adm-d3' });
        const reads = async (s: Signed): Promise<{ users: number; partners: number; piece: boolean }> => {
            const u = await s.client.from('users').select('id').eq('id', client.userId);
            assert.equal(u.error, null, `lecture users : ${u.error?.message}`);
            const p = await s.client.from('partners').select('id').eq('id', pEA.partnerId);
            assert.equal(p.error, null, `lecture partners : ${p.error?.message}`);
            const d = await s.client.storage.from('partner_documents').download(piecePath!);
            return { users: (u.data ?? []).length, partners: (p.data ?? []).length, piece: d.error === null && d.data !== null };
        };
        assert.deepEqual(await reads(await signIn(admin, 'l’ADMIN actif')), { users: 1, partners: 1, piece: true },
            'témoin : un ADMIN actif lit le compte, la fiche en attente et la pièce');
        await suspendAccount(admin.userId);
        assert.deepEqual(await reads(await signIn(admin, 'l’ADMIN suspendu')), { users: 0, partners: 0, piece: false },
            'D3 : un ADMIN suspendu ne lit plus ni le compte, ni la fiche en attente, ni la pièce');

        const superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: '9t1-sup-d3' });
        const journal = async (s: Signed): Promise<number> => {
            const r = await s.client.from('audit_logs').select('id').eq('object_id', pEA.partnerId);
            assert.equal(r.error, null, `lecture audit_logs : ${r.error?.message}`);
            return (r.data ?? []).length;
        };
        const active = await journal(await signIn(superadmin, 'le SUPERADMIN actif'));
        assert.ok(active >= 1, `témoin : un SUPERADMIN actif lit le journal de la fiche (${active} ligne(s))`);
        await suspendAccount(superadmin.userId);
        assert.equal(await journal(await signIn(superadmin, 'le SUPERADMIN suspendu')), 0, 'D3 : un SUPERADMIN suspendu ne lit plus le journal');
    });
});
