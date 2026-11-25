/**
 * Contre-vérification du lot 11c-a (tables d'un événement) — aides communes aux suites cv11c-*.
 * Base LOCALE seulement, faux SamirPay ; mise en place par les aides du lot (tests/parcours/l11c-helpers.ts) et des lots
 * précédents ; aucune aide ne corrige quoi que ce soit.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { service, type Buyer } from '../parcours/paiement-helpers';
import { buyConfirmed, type Purchase, type TestPartner } from '../parcours/finance-helpers';
import { rpcCancel } from '../parcours/cycle-helpers';
import type { Row } from '../parcours/l11c-helpers';

export const n = (v: unknown): number => Number(v);

/** Client REST avec la clé anon et, si donné, le jeton de l'attaquant (jamais la clé de service). */
export function restClient(token?: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    });
}

/** Achat confirmé de `qty` billets ordinaires d'une catégorie (route /api/checkout, faux SamirPay, webhook). */
export async function buyTickets(buyer: Buyer, eventId: string, category: { id: string; price: number; total: number }, qty: number): Promise<Purchase> {
    return buyConfirmed(buyer, { eventId, categories: { C: category } }, [['C', qty]]);
}

/** Places occupées d'un événement : billets ordinaires VALIDE ou UTILISE + places des ventes de tables actives. */
export async function seatsTaken(eventId: string): Promise<{ tickets: number; tableSeats: number; capacity: number | null }> {
    const { count, error } = await service.from('tickets').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).is('event_table_booking_id', null).in('status', ['VALIDE', 'UTILISE']);
    assert.equal(error, null, `billets de ${eventId} : ${error?.message}`);
    const { data: b, error: bErr } = await service.from('event_table_bookings').select('seats').eq('event_id', eventId).eq('status', 'ACTIVE');
    assert.equal(bErr, null, `ventes de tables de ${eventId} : ${bErr?.message}`);
    const { data: ev, error: eErr } = await service.from('events').select('capacity').eq('id', eventId).single();
    assert.equal(eErr, null, `capacité de ${eventId} : ${eErr?.message}`);
    return { tickets: count ?? 0, tableSeats: ((b ?? []) as Row[]).reduce((s, r) => s + n(r.seats), 0), capacity: ev!.capacity === null ? null : n(ev!.capacity) };
}

/**
 * Nettoyage après la preuve d'un trou de jauge : l'événement est annulé (tout est remboursé, les ventes de tables closes),
 * pour que les invariants communs et ceux du lot restent justes après la suite.
 */
export async function cancelEvent(owner: TestPartner, eventId: string, title: string): Promise<void> {
    const call = await rpcCancel(eventId, owner.userId, {
        publicNotice: 'Soirée annulée : vos places vous sont remboursées en entier.',
        internalReason: 'Contre-vérification du lot 11c-a : nettoyage',
        confirmTitle: title,
    });
    assert.equal(call.error, null, `annulation de nettoyage : ${call.error?.message}`);
    assert.equal(call.data?.ok, true, `annulation de nettoyage : ${JSON.stringify(call.data)}`);
}

/** Lignes de la boîte d'envoi d'un destinataire (toutes). */
export async function outboxOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox').select('id, type, channel, event_id, created_at, template_data')
        .eq('recipient_user_id', userId).order('created_at');
    assert.equal(error, null, `boîte d'envoi de ${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}
