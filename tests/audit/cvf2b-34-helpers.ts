/**
 * Contre-vérification de la finition 2b (création d'un événement) — aides communes aux suites
 * `tests/audit/cvf2b-3-soumission.test.ts` (soumission depuis le formulaire) et `tests/audit/cvf2b-4-avis-cadence.test.ts`
 * (avis de changement de date et de lieu aux détenteurs de billets, cadence, fenêtre « Prévenir »).
 *
 * L'attaquante joue avec sa propre session (clé publique + jeton), par les vraies routes de l'application (handlers
 * importés) et par la REST de Supabase. Le montage passe par le service_role sur la base LOCALE, comme les suites du lot.
 * Aucune assertion n'est assouplie pour faire passer une suite : une suite verte dit que l'attaque a échoué.
 *
 * Comptage des SMS : par la boîte d'envoi (lignes EVENT_CHANGED / SMS du détenteur, statuts PENDING, SENDING, SENT ou
 * UNCERTAIN = mis en file ou partis), jamais par un total global. Le faux MTarget de ce processus n'est qu'un témoin
 * imprimé : une ligne due tout de suite peut être envoyée par l'envoyeur d'une autre suite (base partagée), son SMS
 * n'apparaît alors pas dans ce faux, mais sa ligne SENT est bien dans la base.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { createTimedEvent } from '../parcours/acces-helpers';
import type { TestPartner } from '../parcours/finance-helpers';
import { FREE, api, freeTicket, show, type Reply, type Row } from './cvf1-helpers';

export { FREE, api, show, type Reply, type Row };

/** Repère des événements de test (Dakar, comme TEST_EVENT_POSITION). */
export const DAKAR = { latitude: 14.6928, longitude: -17.4467 } as const;

/** Statuts d'une ligne SMS mise en file ou partie (même liste que le plafond de la dernière heure en base). */
export const LIVE = ['PENDING', 'SENDING', 'SENT', 'UNCERTAIN'];

/** Marque courte en lettres seules (lieux, titres : aucun chiffre qui ressemblerait à un numéro). */
export function letters(n = 6): string {
    const hex = randomUUID().replace(/-/g, '');
    return Array.from(hex.slice(0, n)).map((c) => String.fromCharCode(97 + (parseInt(c, 16) % 26))).join('');
}

export async function versionOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `version de ${eventId} : ${error?.message}`);
    return String(data!.updated_at);
}

/** PUT /api/partner/events/[id] avec une version donnée (deux onglets ouverts sur la même version). */
export function putVersioned(token: string, eventId: string, patch: Row, version: string, extra: Row = {}): Promise<Reply> {
    return api('PUT', 'partner/events/[id]', {
        token, path: `/api/partner/events/${eventId}`, params: { id: eventId },
        body: { patch, expected_updated_at: version, ...extra },
    });
}

/** PUT avec la version relue juste avant (un onglet qui recharge). */
export async function putFresh(token: string, eventId: string, patch: Row): Promise<Reply> {
    return putVersioned(token, eventId, patch, await versionOf(eventId));
}

/**
 * Onglet obstiné : recharge la version et recommence tant que la réponse est 409 EDIT_CONFLICT (au plus `tries` fois).
 * `make` fabrique le patch à chaque essai (une fin décalée se calcule depuis la valeur du moment).
 */
export async function putRetry(token: string, eventId: string, make: () => Promise<Row> | Row, tries = 40): Promise<{ reply: Reply; attempts: number; patch: Row }> {
    let last: Reply = { status: 0, body: {} };
    let patch: Row = {};
    for (let i = 1; i <= tries; i++) {
        patch = await make();
        last = await putFresh(token, eventId, patch);
        if (!(last.status === 409 && last.body.code === 'EDIT_CONFLICT')) return { reply: last, attempts: i, patch };
        await sleep(5 + Math.floor(Math.random() * 40));
    }
    return { reply: last, attempts: tries, patch };
}

/** POST /api/partner/events/[id]/transition (soumission depuis le formulaire ou la liste). */
export function transition(token: string, eventId: string, to: string, reason?: string): Promise<Reply> {
    return api('POST', 'partner/events/[id]/transition', {
        token, path: `/api/partner/events/${eventId}/transition`, params: { id: eventId },
        body: reason === undefined ? { to } : { to, reason },
    });
}

export function preview(token: string, eventId: string, patch: Row, version: string): Promise<Reply> {
    return api('POST', 'partner/events/[id]/notice-preview', {
        token, path: `/api/partner/events/${eventId}/notice-preview`, params: { id: eventId },
        body: { patch, expected_updated_at: version },
    });
}

/** Fin de l'événement décalée de `minutes` (date et heure de Dakar = UTC), depuis la valeur en base. */
export async function endPatch(eventId: string, minutes: number): Promise<Row> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    const end = new Date(`${data!.end_date}T${String(data!.end_time).slice(0, 8)}Z`).getTime() + minutes * 60_000;
    const iso = new Date(end).toISOString();
    return { end_date: iso.slice(0, 10), end_time: iso.slice(11, 16) };
}

/** Début de l'événement (instant), depuis la base. */
export async function startOf(eventId: string): Promise<number> {
    const { data, error } = await service.from('events').select('start_date, start_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    return new Date(`${data!.start_date}T${String(data!.start_time).slice(0, 8)}Z`).getTime();
}

/** Patch de début à un instant donné (minute de Dakar). */
export function startPatch(at: number): Row {
    const iso = new Date(at).toISOString();
    return { start_date: iso.slice(0, 10), start_time: iso.slice(11, 16) };
}

/**
 * Événement publié de la partenaire (début dans `startsInHours` heures, 4 h), repère à Dakar, `holders` détenteurs
 * neufs (numéros tirés au hasard) avec chacun un billet gratuit VALIDE.
 */
export async function published(P: TestPartner, label: string, startsInHours: number, holders = 1): Promise<{ ev: SaleEvent; holders: Buyer[] }> {
    const ev = await createTimedEvent(P.partnerId, `cvf2b-${label}`, [{ name: FREE, price: 0, total: 40 }], { startsInHours, durationHours: 4, status: 'PUBLIE' });
    const { error } = await service.from('events').update(DAKAR).eq('id', ev.eventId);
    assert.equal(error, null, `repère (montage) : ${error?.message}`);
    const out: Buyer[] = [];
    for (let i = 0; i < holders; i++) {
        const h = await newBuyer(`cvf2b-${label}-detenteur${i}`);
        await freeTicket(ev, h);
        out.push(h);
    }
    return { ev, holders: out };
}

export interface SmsRow {
    id: string;
    status: string;
    reason: string | null;
    due_at: string;
    sent_at: string | null;
    created_at: string;
    template_data: Row;
}

/** Lignes SMS EVENT_CHANGED d'un détenteur pour un événement (boîte d'envoi), dans l'ordre de création. */
export async function holderSms(eventId: string, userId: string): Promise<SmsRow[]> {
    const { data, error } = await service.from('notification_outbox')
        .select('id, status, reason, due_at, sent_at, created_at, template_data')
        .eq('event_id', eventId).eq('recipient_user_id', userId).eq('type', 'EVENT_CHANGED').eq('channel', 'SMS')
        .order('created_at').order('id');
    assert.equal(error, null, `boîte d'envoi (${eventId}/${userId}) : ${error?.message}`);
    return (data ?? []) as SmsRow[];
}

export function live(rows: SmsRow[]): SmsRow[] {
    return rows.filter((r) => LIVE.includes(r.status));
}

export function sentTimes(rows: SmsRow[]): number[] {
    return rows.filter((r) => r.status === 'SENT' || r.status === 'UNCERTAIN').map((r) => Date.parse(String(r.sent_at ?? r.created_at))).sort((a, b) => a - b);
}

/** Plus grand nombre de SMS partis dans une même heure glissante (fenêtre [t, t + 1 h[ ouverte à chaque envoi). */
export function maxPerSlidingHour(times: number[]): number {
    let best = 0;
    for (let i = 0; i < times.length; i++) {
        let n = 0;
        for (let j = i; j < times.length && times[j] - times[i] < 3_600_000; j++) n++;
        best = Math.max(best, n);
    }
    return best;
}

export function brief(rows: SmsRow[]): string {
    return rows.map((r) => `${r.status}${r.reason ? `(${r.reason})` : ''} créée ${r.created_at} due ${r.due_at} partie ${r.sent_at ?? '-'} ${JSON.stringify(r.template_data.changed_fields ?? [])}`).join(' | ') || '(aucune ligne)';
}

/** Instantané écrit d'un événement : ligne, catégories, historique des statuts, boîte d'envoi (nombre de lignes). */
export async function eventSnapshot(eventId: string): Promise<string> {
    const [ev, cats, hist, outbox] = await Promise.all([
        service.from('events').select('status, updated_at, image_url, latitude, longitude, start_date, start_time, end_date, end_time, location, city').eq('id', eventId).single(),
        service.from('ticket_categories').select('id, name, is_active, sale_start, sale_end, total_quantity').eq('event_id', eventId).order('id'),
        service.from('event_status_history').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        service.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]);
    for (const r of [ev, cats, hist, outbox]) assert.equal(r.error, null, `instantané de ${eventId} : ${r.error?.message}`);
    return JSON.stringify({ ev: ev.data, cats: cats.data, history: hist.count, outbox: outbox.count });
}

export async function statusOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('status').eq('id', eventId).single();
    assert.equal(error, null, `statut de ${eventId} : ${error?.message}`);
    return String(data!.status);
}

/**
 * Manques de la règle de soumission (mêmes règles que event_transition → EN_ATTENTE), relus en base : sert à vérifier
 * qu'un événement EN_ATTENTE n'en a aucun.
 */
export async function missingInBase(eventId: string): Promise<string[]> {
    const { data: e, error } = await service.from('events')
        .select('image_url, latitude, longitude, start_date, start_time, end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    const { data: cats, error: cErr } = await service.from('ticket_categories').select('name, is_active, sale_start, sale_end').eq('event_id', eventId);
    assert.equal(cErr, null, cErr?.message);
    const out: string[] = [];
    if (!e!.image_url || String(e!.image_url).trim() === '') out.push('image_url');
    if (e!.latitude === null || e!.longitude === null) out.push('latitude');
    const active = (cats ?? []).filter((c) => c.is_active === true);
    if (active.length === 0) out.push('ticket_categories');
    const start = new Date(`${e!.start_date}T${String(e!.start_time ?? '00:00:00').slice(0, 8)}Z`).getTime();
    if (start <= Date.now()) out.push('start_date');
    return out;
}
