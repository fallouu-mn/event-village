/**
 * Contre-vérification du lot 11c-c — aides communes (routes des écrans des tables, contrôleur affecté, entrelacement
 * forcé de deux requêtes). Base LOCALE seulement (garde-fou tests/helpers/env.ts importé par chaque suite).
 */
import assert from 'node:assert/strict';
import { service, newBuyer, type Buyer } from '../parcours/paiement-helpers';
import { jsonRequest } from '../parcours/finance-helpers';
import { routeContext } from '../parcours/helpers';
import { tablesForSave, saveTables, createdTableType, vipType, newTablesEvent, type Reply, type Row } from '../parcours/l11c-helpers';
import type { TestPartner } from '../parcours/finance-helpers';
import { GET as reportGet } from '../../app/api/partner/events/[id]/tables/report/route';
import { POST as copyPost } from '../../app/api/partner/events/[id]/tables/copy/route';
import { GET as adminTablesGet } from '../../app/api/admin/events/[id]/tables/route';

export async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Row;
    try {
        body = (text ? JSON.parse(text) : {}) as Row;
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

export const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

/** GET …/tables/report ; `query` : paramètres ajoutés à l'adresse (tentative d'injection). */
export async function report(user: Buyer | null, eventId: string, query = '', headers: Record<string, string> = {}): Promise<Reply> {
    return reply(await reportGet(jsonRequest(`/api/partner/events/${eventId}/tables/report${query}`, 'GET', user?.accessToken ?? null, undefined, headers), routeContext({ id: eventId })));
}

export async function adminTables(user: Buyer | null, eventId: string, headers: Record<string, string> = {}): Promise<Reply> {
    return reply(await adminTablesGet(jsonRequest(`/api/admin/events/${eventId}/tables`, 'GET', user?.accessToken ?? null, undefined, headers), routeContext({ id: eventId })));
}

/** POST …/tables/copy ; `body` complet (champs en trop compris). */
export async function copyRaw(user: Buyer | null, eventId: string, body: unknown): Promise<Reply> {
    return reply(await copyPost(jsonRequest(`/api/partner/events/${eventId}/tables/copy`, 'POST', user?.accessToken ?? null, body), routeContext({ id: eventId })));
}

export const copy = (user: Buyer, eventId: string, from: unknown): Promise<Reply> => copyRaw(user, eventId, { from_event_id: from });

/** Contrôleur affecté à un événement (rôle CONTROLEUR, ligne event_controllers), comme l11cc-ecrans. */
export async function newController(label: string, eventId: string, createdBy: string): Promise<Buyer> {
    const c = await newBuyer(`ctl-${label}`, { firstName: 'Ibrahima', lastName: 'Controleurcv' });
    const { error: rErr } = await service.from('user_roles').upsert([{ user_id: c.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
    assert.equal(rErr, null, `rôle CONTROLEUR : ${rErr?.message}`);
    const { error } = await service.from('event_controllers').upsert(
        { event_id: eventId, user_id: c.userId, can_accept_cash: false, created_by: createdBy, entry_point: 'Entrée principale' },
        { onConflict: 'event_id,user_id' });
    assert.equal(error, null, `affectation du contrôleur : ${error?.message}`);
    return c;
}

/** Types et tables de table d'un événement, lus en base (sans passer par les routes). */
export async function tablesState(eventId: string): Promise<{ types: Row[]; tables: Row[]; plan: Row | null }> {
    const { data: types, error: tErr } = await service.from('ticket_categories')
        .select('id, name, total_quantity, sold_quantity, held_quantity, is_active').eq('event_id', eventId).eq('kind', 'TABLE').order('created_at');
    assert.equal(tErr, null, tErr?.message);
    const { data: tables, error: xErr } = await service.from('event_tables')
        .select('id, number, category_id, plan_x, plan_y').eq('event_id', eventId).order('number');
    assert.equal(xErr, null, xErr?.message);
    const { data: plan, error: pErr } = await service.from('event_table_plans').select('*').eq('event_id', eventId).maybeSingle();
    assert.equal(pErr, null, pErr?.message);
    return { types: (types ?? []) as Row[], tables: (tables ?? []) as Row[], plan: (plan ?? null) as Row | null };
}

/**
 * Événement source aux tables placées : un type par entrée de `types` (nom, places, nombre), numéros à partir de 10,
 * positions sur une ligne. Rend l'identifiant de l'événement.
 */
export async function sourceWithTables(owner: TestPartner, label: string, types: Array<{ name: string; seats: number; count: number }>, capacity = 120): Promise<string> {
    const src = await newTablesEvent(owner, label, { capacity });
    for (const t of types) await createdTableType(owner, src.eventId, vipType({ name: t.name, seats: t.seats, price: 60_000 }), t.count);
    const placed = (await tablesForSave(owner, src.eventId)).map((t, i) => ({ ...t, number: 10 + i, x: 10 + 12 * i, y: 30 }));
    const saved = await saveTables(owner, src.eventId, { plan_enabled: false, tables: placed, zones: [] });
    assert.equal(saved.status, 200, `plan de la source ${label} : ${JSON.stringify(saved.body)}`);
    return src.eventId;
}

// ── Entrelacement forcé ──────────────────────────────────────────────────────────────────────────────────────────
// Le client Supabase relit globalThis.fetch à chaque appel (supabase-js : `(...args) => fetch(...args)`) : une action
// peut être glissée juste AVANT l'envoi d'un appel précis du serveur (même effet que deux onglets ou deux requêtes
// simultanées, sans dépendre du hasard). Le garde-fou de tests/helpers/env.ts reste en dessous (hôte local seulement).

interface Hook { match: (url: string, body: string) => boolean; run: () => Promise<void> }
let pending: Hook | null = null;
const underlying = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const hook = pending;
    if (hook && typeof init?.body === 'string' && hook.match(url, init.body)) {
        pending = null;
        await hook.run();
    }
    return underlying(input, init);
}) as typeof fetch;

/** Avant le prochain appel de la fonction `rpc` dont le corps contient tous les `needles`, exécute `run` (une fois). */
export function beforeRpc(rpc: string, needles: string[], run: () => Promise<void>): void {
    pending = { match: (url, body) => url.includes(`/rest/v1/rpc/${rpc}`) && needles.every((n) => body.includes(n)), run };
}

export function hookPending(): boolean {
    return pending !== null;
}

export function clearHook(): void {
    pending = null;
}
