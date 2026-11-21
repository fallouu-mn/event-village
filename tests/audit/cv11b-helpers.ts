/**
 * Contre-vérification du lot 11b (tables : écrans, plan de salle, fermetures, absences) — aides communes aux suites
 * tests/audit/cv11b-*. Aucune aide ne corrige quoi que ce soit : elles montent comptes, établissements et réservations
 * par les aides du lot 11a (tests/parcours/l11a-helpers.ts, via cv11a-helpers), appellent les routes réelles de
 * l'application (gestionnaires importés, session par jeton) et lisent la base LOCALE (tests/helpers/db : hôte vérifié).
 * Faux SamirPay : aucun appel réel. Attaques REST : clé anon et jeton de l'attaquant, jamais la clé de service.
 *
 * Le temps qui passe est simulé comme dans les suites du lot (shiftReservation : écriture locale avec le drapeau des
 * fonctions en base), jamais l'horloge.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
    api, dayFromNow, newTable, payConfirmed, reservation, reserveRpc, routeId, service, sql,
    type Buyer, type Reply, type Row, type TestPartner,
} from './cv11a-helpers';

export * from './cv11a-helpers';

/** Adresse d'une photo « déposée » (nom réencodé) dans le dossier des établissements d'une partenaire. */
export function photoOf(partnerId: string): string {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/public-images/venues/${partnerId}/${Date.now()}_${randomBytes(4).toString('hex')}.webp`;
}

export async function setFiche(partnerId: string, status: 'VALIDE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', partnerId);
    assert.equal(error, null, `fiche ${partnerId} → ${status} : ${error?.message}`);
}

/** Trace d'une attaque dans la sortie brute (lue au rapport). */
export function trace(tag: string, what: unknown): void {
    console.log(`[CV11B] ${tag} : ${typeof what === 'string' ? what : JSON.stringify(what)}`);
}

/** Aperçu d'une fermeture par la route de l'établissement. */
export function closurePreview(partner: Pick<TestPartner, 'accessToken'>, venue: string, body: Row): Promise<Reply> {
    return api('POST', 'partner/venues/[id]/closures', { token: partner.accessToken, params: { id: venue }, path: `/api/partner/venues/${venue}/closures?preview=1`, body });
}

/** Fermeture confirmée par la route de l'établissement (nombre de réservations vu à l'aperçu). */
export function closureCreate(partner: Pick<TestPartner, 'accessToken'>, venue: string, body: Row): Promise<Reply> {
    return api('POST', 'partner/venues/[id]/closures', { token: partner.accessToken, params: { id: venue }, body });
}

export const partnerPatch = (id: string, partner: Pick<TestPartner, 'accessToken'>, body: Row): Promise<Reply> =>
    routeId('PATCH', 'partner/tables/reservations/[id]', id, partner.accessToken, body);

/** Lien court par la route réelle (segment [code]). */
export function linkRoute(code: string, token: string | null): Promise<Reply> {
    return api('GET', 'tables/link/[code]', { token, params: { code }, path: `/api/tables/link/${code}` });
}

/** Réservation confirmée et payée (acompte), sur une table neuve de l'établissement ; rend son identifiant. */
export async function paidOn(partner: TestPartner, venue: string, client: Buyer, day: number, time = '20:00', label = 'T'): Promise<{ id: string; table: string }> {
    const table = await newTable(partner, venue, 4, { number: `${label}${randomBytes(2).toString('hex')}` });
    const r = await reserveRpc(client, venue, { date: dayFromNow(day), time, guests: 4, tableId: table });
    assert.equal(r.ok, true, `réservation : ${JSON.stringify(r)}`);
    const id = String(r.reservation_id);
    await payConfirmed(client, id);
    assert.equal((await reservation(id)).booking_state, 'CONFIRMEE', 'réservation payée confirmée');
    return { id, table };
}

/** Remboursements (cashouts) d'une réservation de table. */
export async function cashoutsOf(reservationId: string): Promise<Row[]> {
    return sql(`SELECT c.id, c.amount, c.status, c.idempotency_key FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id
                 WHERE p.table_reservation_id = $1 ORDER BY c.created_at`, [reservationId]);
}
