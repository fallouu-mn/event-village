/**
 * Lot 11a — préparation d'une réservation de table pour les suites qui ne testent pas la réservation elle-même
 * (publication temps réel, interrupteurs, cibles de paiement, écritures REST). Base LOCALE seulement.
 *
 * Depuis le lot 11a, une réservation de table ne s'écrit plus directement (garde trg_0_table_reservations_guard) : la
 * préparation passe par une connexion locale qui pose le drapeau des fonctions en base, dans sa transaction. Les
 * montants suivent les règles du lot (acompte = acompte par personne × personnes, frais 5 % arrondis au franc
 * supérieur) : les invariants t1 à t6 restent vrais. L'établissement et la table sont créés à chaque appel.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { openConcurrentClient } from './db';

function service() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

export interface TableFixture {
    venueId: string;
    tableId: string;
    reservationId: string;
    /** Acompte + frais (0 sans acompte). */
    totalAmount: number;
}

export async function tableReservationFixture(opts: {
    partnerId: string;
    clientId: string;
    date: string;
    time?: string;
    guests?: number;
    /** Acompte par personne en F CFA (vide : réservation gratuite, confirmée). */
    depositPerPerson?: number | null;
}): Promise<TableFixture> {
    const db = service();
    const { data: venue, error: venueErr } = await db.from('venues').insert({
        partner_id: opts.partnerId, name: `TEST Restaurant ${randomUUID().slice(0, 8)}`, city: 'Dakar',
        deposit_per_person: opts.depositPerPerson ?? null,
    }).select('id').single();
    assert.equal(venueErr, null, `établissement : ${venueErr?.message}`);
    const { data: table, error: tableErr } = await db.from('restaurant_tables').insert({
        partner_id: opts.partnerId, venue_id: venue!.id, table_number: `T-${randomUUID().slice(0, 8)}`, capacity: 6, is_active: true,
    }).select('id').single();
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);

    const guests = opts.guests ?? 2;
    const perPerson = opts.depositPerPerson ?? null;
    const deposit = perPerson ? perPerson * guests : 0;
    const fee = perPerson ? Math.ceil((deposit * 5) / 100) : 0;
    const c = await openConcurrentClient({ applicationName: 'ev-test-table-fixture' });
    try {
        await c.query(`SELECT set_config('event_village.table_booking', 'on', true)`);
        const { rows } = await c.query<{ id: string }>(
            `INSERT INTO public.table_reservations (
                 partner_id, venue_id, table_id, client_id, reservation_date, reservation_time, guest_count, slot_minutes,
                 booking_state, confirmation_mode, deposit_per_person, deposit_amount, service_fee_rate, service_fee_amount,
                 total_amount, commission_rate, is_platform_payment, payment_status, hold_expires_at, confirmed_at)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, $6::time, $7::int, 120,
                     $8::text, 'AUTO', $9::numeric, $10::numeric, CASE WHEN $10::numeric > 0 THEN 5 END, $11::numeric,
                     $10::numeric + $11::numeric, CASE WHEN $10::numeric > 0 THEN 0 END, $10::numeric > 0, 'PENDING',
                     CASE WHEN $10::numeric > 0 THEN now() + interval '15 minutes' END, CASE WHEN $10::numeric = 0 THEN now() END)
             RETURNING id`,
            [opts.partnerId, venue!.id, table!.id, opts.clientId, opts.date, opts.time ?? '20:00', guests,
             deposit > 0 ? 'EN_ATTENTE_PAIEMENT' : 'CONFIRMEE', perPerson, deposit, fee]);
        await c.commit();
        return { venueId: String(venue!.id), tableId: String(table!.id), reservationId: String(rows[0].id), totalAmount: deposit + fee };
    } finally {
        await c.close();
    }
}
