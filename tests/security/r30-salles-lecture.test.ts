/**
 * R30 — Lot 10a (C3) : données personnelles des réservations de salle et visibilité des salles, par la REST avec le
 * jeton de chacun (clé anon + jeton de session), jamais la clé de service.
 *  - réservations : le client voit les siennes ; la salle celles de ses salles ; un autre client, une autre salle,
 *    un visiteur et un administrateur sans le code administrateur ne voient rien ; un administrateur avec le code voit ;
 *  - salles : un visiteur ne voit que les salles actives, validées, d'une partenaire validée ; la propriétaire voit les
 *    siennes en attente ;
 *  - aucune écriture REST (insertion, mise à jour) sur halls ni hall_reservations.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import { service } from '../parcours/paiement-helpers';
import { decideHall, newBuyer, newHall, newPartner, openHallsService, reserveRpc, type Buyer, type TestPartner } from '../parcours/l10a-helpers';

function clientOf(token: string | null): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

async function visibleReservations(token: string | null, ids: string[]): Promise<string[]> {
    const { data, error } = await clientOf(token).from('hall_reservations').select('id').in('id', ids);
    if (error) return [];
    return (data ?? []).map((r) => String(r.id)).sort();
}

async function visibleHalls(token: string | null, ids: string[]): Promise<string[]> {
    const { data, error } = await clientOf(token).from('halls').select('id').in('id', ids);
    if (error) return [];
    return (data ?? []).map((r) => String(r.id)).sort();
}

let restore: () => Promise<void>;
let owner: TestPartner;
let otherPartner: TestPartner;
let alice: Buyer;
let bob: Buyer;
let aliceRes: string;
let bobRes: string;
let validated: string;
let pending: string;
let refused: string;

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('r30-salle');
    otherPartner = await newPartner('r30-autre');
    alice = await newBuyer('r30-alice');
    bob = await newBuyer('r30-bob');
    validated = await newHall(owner);
    pending = await newHall(owner, { validate: false });
    refused = await newHall(owner, { validate: false });
    await decideHall(refused, 'REFUSER', 'Photos manquantes.');
    aliceRes = String((await reserveRpc(alice, validated, { startInDays: 70 })).reservation_id);
    bobRes = String((await reserveRpc(bob, validated, { startInDays: 71 })).reservation_id);
});

after(async () => {
    await restore();
    await assertLot10aInvariants('r30-salles-lecture');
});

describe('R30 — réservations de salle : chacun ne lit que ce qui le regarde', () => {
    test('le client voit la sienne seulement', async () => {
        assert.deepEqual(await visibleReservations(alice.accessToken, [aliceRes, bobRes]), [aliceRes]);
        assert.deepEqual(await visibleReservations(bob.accessToken, [aliceRes, bobRes]), [bobRes]);
    });
    test('la salle voit celles de ses salles ; une autre salle ne voit rien', async () => {
        assert.deepEqual(await visibleReservations(owner.accessToken, [aliceRes, bobRes]), [aliceRes, bobRes].sort());
        assert.deepEqual(await visibleReservations(otherPartner.accessToken, [aliceRes, bobRes]), []);
    });
    test('un visiteur ne voit rien', async () => {
        assert.deepEqual(await visibleReservations(null, [aliceRes, bobRes]), []);
    });
    test('un administrateur sans le code administrateur ne voit rien ; avec le code, il voit', async () => {
        const admin = await newAdmin('r30-admin', ['events.read']);
        assert.deepEqual(await visibleReservations(admin.accessToken, [aliceRes, bobRes]), [aliceRes, bobRes].sort(), 'avec le code');
        const bare = await newBuyer('r30-admin-sans-code');
        const { error } = await service.from('user_roles').upsert([{ user_id: bare.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, error?.message);
        // Les sessions de test passent le code administrateur par défaut (newBuyer) : code retiré pour ce compte
        const { error: delErr } = await service.from('admin_session_codes').delete().eq('user_id', bare.userId);
        assert.equal(delErr, null, delErr?.message);
        assert.deepEqual(await visibleReservations(bare.accessToken, [aliceRes, bobRes]), [], 'sans le code administrateur');
    });
});

describe('R30 — salles : visibles du public seulement validées', () => {
    test('un visiteur et un client ne voient que la salle validée', async () => {
        assert.deepEqual(await visibleHalls(null, [validated, pending, refused]), [validated]);
        assert.deepEqual(await visibleHalls(alice.accessToken, [validated, pending, refused]), [validated]);
    });
    test('la propriétaire voit aussi ses salles en attente ou refusées', async () => {
        assert.deepEqual(await visibleHalls(owner.accessToken, [validated, pending, refused]), [validated, pending, refused].sort());
    });
});

describe('R30 — aucune écriture REST sur les salles ni les réservations', () => {
    test('insertion et mise à jour refusées, même par la propriétaire ou le client', async () => {
        const ins = await clientOf(alice.accessToken).from('hall_reservations').insert({
            hall_id: validated, client_id: alice.userId, partner_id: owner.partnerId, start_date: '2030-01-01', end_date: '2030-01-01', total_amount: 1,
        });
        assert.ok(ins.error, 'insertion d’une réservation acceptée');
        const upd = await clientOf(owner.accessToken).from('hall_reservations').update({ booking_state: 'PAYEE', paid_amount: 1 }).eq('id', aliceRes).select('id');
        assert.ok(upd.error || (upd.data ?? []).length === 0, 'mise à jour d’une réservation acceptée');
        const hallUpd = await clientOf(owner.accessToken).from('halls').update({ validation_status: 'VALIDEE' }).eq('id', pending).select('id');
        assert.ok(hallUpd.error || (hallUpd.data ?? []).length === 0, 'validation de sa propre salle acceptée');
    });
});
