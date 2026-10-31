/**
 * Lot 4, tâche 4.0 — sécurité urgente.
 *
 * 1. Création de commande, de réservation de salle et de réservation de table : session ACTIVE
 *    obligatoire (requireActiveSession), client = compte de la session, `clientId` du corps ignoré.
 *    Rouge avant correctif : les trois routes prennent `userId || body.clientId`, sans session ni
 *    statut (app/api/orders/create/route.ts:13-38, app/api/halls/reserve/route.ts:13-38,
 *    app/api/restaurants/reserve-table/route.ts:13-41) : sans jeton, ou avec un jeton invalide, la
 *    cible est créée au nom du `clientId` reçu ; un compte SUSPENDU crée la sienne.
 * 2. Statut ambassadeur (users.referral_status) : seul le SUPERADMIN le change par
 *    PATCH /api/admin/users, et seulement en STANDARD ou AMBASSADEUR.
 *    Rouge avant correctif : tout ADMIN qui a `users.write` l'écrit, sur un tiers comme sur lui-même
 *    (app/api/admin/users/route.ts:197, :266) ; une valeur hors énumération finit en 500 (erreur SQL).
 *
 * Interprétation retenue (contrat muet) : quand un compte envoie le `clientId` d'un autre, la route
 * crée la cible à son propre nom ou refuse (4xx) ; elle ne crée jamais rien au nom de l'autre.
 * Les routes réécrites sont importées dynamiquement (typecheck de la CI avant les tests).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { bearer, signInAs } from '../helpers/fixtures';
import { jsonRequest } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';

type Handler = (req: NextRequest) => Promise<Response>;

interface Reply { status: number; body: Record<string, unknown> }

async function callRoute(modulePath: string, method: 'POST' | 'PATCH', req: NextRequest): Promise<Reply> {
    const mod = await importModule(modulePath);
    const handler = mod[method] as Handler | undefined;
    assert.equal(typeof handler, 'function', `${modulePath} n'exporte pas ${method}`);
    const res = await handler!(req);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

// ── Contexte : un partenaire avec un plat, une salle et une table ──────────

let partner: TestPartner;
let attacker: Buyer;
let victim: Buyer;
let suspended: Buyer;
let productId: string;
let hallId: string;

before(async () => {
    partner = await newPartner('urgence');
    attacker = await newBuyer('urg-attaquant');
    victim = await newBuyer('urg-victime');
    suspended = await newBuyer('urg-suspendu');
    const { error: suspErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
    assert.equal(suspErr, null, `suspension du compte : ${suspErr?.message}`);

    const { data: product, error: prodErr } = await service.from('products').insert({
        partner_id: partner.partnerId, name: `TEST Plat urgence ${randomUUID().slice(0, 8)}`, price: 5000, status: 'DISPONIBLE',
    }).select('id').single();
    assert.equal(prodErr, null, `produit : ${prodErr?.message}`);
    productId = product.id;

    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: partner.partnerId, name: `TEST Salle urgence ${randomUUID().slice(0, 8)}`, capacity: 100,
        price_per_day: 100000, deposit_percentage: 30, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    hallId = hall.id;

    const { error: tableErr } = await service.from('restaurant_tables').insert({
        partner_id: partner.partnerId, table_number: `T-${randomUUID().slice(0, 8)}`, capacity: 6, is_active: true,
    });
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);
});

after(async () => {
    await assertAccessInvariants('acces-securite-urgente');
});

// ── Les trois cibles ───────────────────────────────────────────────────────

let hallDayOffset = 150;

/** Dates distinctes à chaque appel : aucune réservation de salle ne chevauche une autre. */
function nextHallStart(): string {
    hallDayOffset += 4;
    return new Date(Date.now() + hallDayOffset * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function futureDate(days: number): string {
    return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Target {
    label: string;
    path: string;
    module: string;
    table: 'orders' | 'hall_reservations' | 'table_reservations';
    body: (clientId: string) => Record<string, unknown>;
    createdId: (body: Record<string, unknown>) => string | undefined;
}

const TARGETS: Target[] = [
    {
        label: 'commande (POST /api/orders/create)',
        path: '/api/orders/create',
        module: '../../app/api/orders/create/route',
        table: 'orders',
        body: (clientId) => ({ partnerId: partner.partnerId, items: [{ id: productId, quantity: 1 }], deliveryMode: 'RETRAIT', clientId }),
        createdId: (b) => (b.order as { id?: string } | undefined)?.id,
    },
    {
        label: 'réservation de salle (POST /api/halls/reserve)',
        path: '/api/halls/reserve',
        module: '../../app/api/halls/reserve/route',
        table: 'hall_reservations',
        body: (clientId) => ({ hallId, startDate: nextHallStart(), durationDays: 1, clientId }),
        createdId: (b) => (b.reservation as { id?: string } | undefined)?.id,
    },
    {
        label: 'réservation de table (POST /api/restaurants/reserve-table)',
        path: '/api/restaurants/reserve-table',
        module: '../../app/api/restaurants/reserve-table/route',
        table: 'table_reservations',
        body: (clientId) => ({
            partnerId: partner.partnerId, reservationDate: futureDate(60), reservationTime: '20:00',
            guestCount: 2, isPlatformPayment: true, clientId,
        }),
        createdId: (b) => (b.reservation as { id?: string } | undefined)?.id,
    },
];

async function rowsOf(table: Target['table'], clientId: string): Promise<Array<{ id: string; client_id: string }>> {
    const { data, error } = await service.from(table).select('id, client_id').eq('client_id', clientId);
    assert.equal(error, null, `${table} de ${clientId} : ${error?.message}`);
    return (data ?? []) as Array<{ id: string; client_id: string }>;
}

describe('4.0 — commandes et réservations : client = session ACTIVE, clientId ignoré', () => {
    for (const t of TARGETS) {
        test(`${t.label} : le clientId d'un autre compte n'est jamais utilisé`, async () => {
            const res = await callRoute(t.module, 'POST', jsonRequest(t.path, t.body(victim.userId), bearer(attacker.accessToken)));
            assert.deepEqual(await rowsOf(t.table, victim.userId), [], `${t.table} créée au nom de la victime : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            if (res.status < 300) {
                const id = t.createdId(res.body);
                assert.ok(id, `identifiant de la cible absent de la réponse : ${JSON.stringify(res.body)}`);
                const { data, error } = await service.from(t.table).select('client_id').eq('id', id!).single();
                assert.equal(error, null, `${t.table} ${id} : ${error?.message}`);
                assert.equal(data.client_id, attacker.userId, 'la cible appartient au compte de la session');
            } else {
                assert.ok(res.status >= 400 && res.status < 500, `refus attendu en 4xx : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            }
        });

        test(`${t.label} : sans session (clientId seul) → 401, rien n'est créé`, async () => {
            const res = await callRoute(t.module, 'POST', jsonRequest(t.path, t.body(victim.userId)));
            assert.equal(res.status, 401, `sans session : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.deepEqual(await rowsOf(t.table, victim.userId), [], `${t.table} créée sans session au nom de la victime`);
        });

        test(`${t.label} : jeton invalide et clientId d'un autre → 401, rien n'est créé`, async () => {
            const res = await callRoute(t.module, 'POST', jsonRequest(t.path, t.body(victim.userId), bearer(`jeton-invalide-${randomUUID()}`)));
            assert.equal(res.status, 401, `jeton invalide : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.deepEqual(await rowsOf(t.table, victim.userId), [], `${t.table} créée avec un jeton invalide au nom de la victime`);
        });

        test(`${t.label} : compte SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, rien n'est créé`, async () => {
            const res = await callRoute(t.module, 'POST', jsonRequest(t.path, t.body(suspended.userId), bearer(suspended.accessToken)));
            assert.equal(res.status, 403, `compte SUSPENDU : HTTP ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(res.body.code, 'ACCOUNT_NOT_ACTIVE', `code de refus : ${JSON.stringify(res.body)}`);
            assert.deepEqual(await rowsOf(t.table, suspended.userId), [], `${t.table} créée par un compte SUSPENDU`);
        });
    }
});

// ── Statut ambassadeur ─────────────────────────────────────────────────────

const ADMIN_USERS_ROUTE = '../../app/api/admin/users/route';

async function referralStatusOf(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('referral_status').eq('id', userId).single();
    assert.equal(error, null, `referral_status de ${userId} : ${error?.message}`);
    return data.referral_status as string;
}

async function patchUser(token: string, body: Record<string, unknown>): Promise<Reply> {
    return callRoute(ADMIN_USERS_ROUTE, 'PATCH', jsonRequest('/api/admin/users', body, bearer(token), 'PATCH'));
}

/** ADMIN dédié à la suite, avec la permission users.write. */
async function newWriterAdmin(): Promise<Buyer> {
    const admin = await newBuyer('urg-admin', { firstName: 'Fatou', lastName: 'Administratrice' });
    const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(roleErr, null, `rôle ADMIN : ${roleErr?.message}`);
    const { error: permErr } = await service.from('admin_permissions').upsert(
        { user_id: admin.userId, permission: 'users.write' }, { onConflict: 'user_id,permission' });
    assert.equal(permErr, null, `permission users.write : ${permErr?.message}`);
    return admin;
}

describe('4.0 — statut ambassadeur réservé au SUPERADMIN', () => {
    test('un ADMIN qui a users.write ne change pas referral_status (tiers ni lui-même) ; valeur inchangée', async () => {
        const admin = await newWriterAdmin();
        const target = await newBuyer('urg-cible-admin');

        // Témoin : la permission users.write est bien effective pour ce compte.
        const control = await patchUser(admin.accessToken, { userId: target.userId, status: 'ACTIF' });
        assert.equal(control.status, 200, `témoin (status ACTIF par un ADMIN users.write) : HTTP ${control.status} ${JSON.stringify(control.body)}`);

        const onTarget = await patchUser(admin.accessToken, { userId: target.userId, referralStatus: 'AMBASSADEUR' });
        assert.equal(onTarget.status, 403, `ADMIN → AMBASSADEUR sur un tiers : HTTP ${onTarget.status} ${JSON.stringify(onTarget.body)}`);
        assert.equal(await referralStatusOf(target.userId), 'STANDARD', 'statut du tiers inchangé');

        const onSelf = await patchUser(admin.accessToken, { userId: admin.userId, referralStatus: 'AMBASSADEUR' });
        assert.equal(onSelf.status, 403, `ADMIN → AMBASSADEUR sur lui-même : HTTP ${onSelf.status} ${JSON.stringify(onSelf.body)}`);
        assert.equal(await referralStatusOf(admin.userId), 'STANDARD', 'statut de l’ADMIN inchangé');
    });

    test('le SUPERADMIN attribue puis retire le statut ambassadeur', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const target = await newBuyer('urg-cible-super');

        const grant = await patchUser(superadmin.accessToken, { userId: target.userId, referralStatus: 'AMBASSADEUR' });
        assert.equal(grant.status, 200, `SUPERADMIN → AMBASSADEUR : HTTP ${grant.status} ${JSON.stringify(grant.body)}`);
        assert.equal(await referralStatusOf(target.userId), 'AMBASSADEUR');

        const revoke = await patchUser(superadmin.accessToken, { userId: target.userId, referralStatus: 'STANDARD' });
        assert.equal(revoke.status, 200, `SUPERADMIN → STANDARD : HTTP ${revoke.status} ${JSON.stringify(revoke.body)}`);
        assert.equal(await referralStatusOf(target.userId), 'STANDARD');
    });

    test('une valeur hors STANDARD / AMBASSADEUR → 400, valeur inchangée', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const target = await newBuyer('urg-cible-valeur');
        for (const value of ['VIP', 'ambassadeur', 42]) {
            const res = await patchUser(superadmin.accessToken, { userId: target.userId, referralStatus: value });
            assert.equal(res.status, 400, `referralStatus ${JSON.stringify(value)} : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        }
        assert.equal(await referralStatusOf(target.userId), 'STANDARD', 'statut inchangé après les valeurs refusées');
    });
});
