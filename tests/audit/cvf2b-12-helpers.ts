/**
 * Contre-vérification de la finition 2b (création d'un événement) — aides communes aux suites
 * `tests/audit/cvf2b-1-zones-creation.test.ts` et `tests/audit/cvf2b-2-couleur-prix.test.ts`.
 *
 * L'attaquante joue avec sa propre session (clé publique + jeton), par les vraies routes de l'application et par la REST
 * de Supabase. Le montage passe par le service_role sur la base LOCALE, comme les suites du lot. Les appels « base »
 * (service_role, auteur = l'attaquante) rejouent ce que le serveur enverrait si le schéma de la route laissait passer la
 * valeur : ils éprouvent le dernier rempart (la fonction en base), comme le bloc « b » de cvf2a-1-fiche. Aucune assertion
 * n'est assouplie pour faire passer une suite : une suite verte dit que l'attaque a échoué.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { service } from '../parcours/paiement-helpers';
import { api, restRpc, show, userClient, type Reply, type Row } from './cvf1-helpers';

export type { Reply, Row };
export { api, show, userClient, restRpc };

const ROOT = process.cwd();

/** Marque courte et unique (lettres et chiffres) : elle entre dans les titres, les noms de catégorie, de zone et de porte. */
export function mark(): string {
    return `k${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

/** Début dans 90 minutes (fenêtre de contrôle ouverte, début dans le futur), heure de Dakar (UTC). */
export function soon(): { start_date: string; start_time: string } {
    const d = new Date(Date.now() + 90 * 60_000);
    return { start_date: d.toISOString().slice(0, 10), start_time: d.toISOString().slice(11, 16) };
}

/** Date dans `offset` jours (AAAA-MM-JJ). */
export function day(offset: number): string {
    return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

/** Corps de POST /api/partner/events (affiche réellement déposée, position à Dakar). */
export function eventBody(title: string, poster: string, categories: Row[], extra: Row = {}, opts: { soon?: boolean } = {}): Row {
    const dates = opts.soon ? soon() : { start_date: day(12), start_time: '20:00', end_date: day(12), end_time: '23:30' };
    return {
        title, category: 'CONCERT', ...dates, location: 'Esplanade de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441,
        image_url: poster, capacity: 500, ticket_categories: categories, ...extra,
    };
}

/** Objet `event` de la RPC event_create (sans affiche : event_poster_path_ok admet l'absence). */
export function rpcEvent(title: string): Row {
    return { title, category: 'CONCERT', start_date: day(12), start_time: '20:00', location: 'Salle de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441 };
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function postEvent(token: string, body: unknown): Promise<Reply> {
    return api('POST', 'partner/events', { token, body });
}

export function postCategory(token: string, eventId: string, body: unknown): Promise<Reply> {
    return api('POST', 'partner/events/[id]/categories', { token, path: `/api/partner/events/${eventId}/categories`, params: { id: eventId }, body });
}

export function patchCategory(token: string, eventId: string, categoryId: string, body: unknown): Promise<Reply> {
    return api('PATCH', 'partner/events/[id]/categories/[categoryId]', {
        token, path: `/api/partner/events/${eventId}/categories/${categoryId}`, params: { id: eventId, categoryId }, body,
    });
}

export function is2xx(r: Reply): boolean {
    return r.status >= 200 && r.status < 300;
}

// ── Base ───────────────────────────────────────────────────────────────────

export interface BaseReply { ok: boolean; data: Row | null; error: string | null }

/** Fonction en base appelée comme le serveur l'appelle (service_role), l'attaquante pour auteur. */
export async function asServer(fn: string, p: Row): Promise<BaseReply> {
    const { data, error } = await service.rpc(fn, { p });
    const body = (data ?? null) as Row | null;
    return { ok: !error && body?.ok === true, data: body, error: error ? `${error.code ?? ''} ${error.message}` : null };
}

export function showBase(r: BaseReply): string {
    return r.error ? `erreur ${r.error}` : JSON.stringify(r.data).slice(0, 500);
}

/** Fonction appelée par la REST avec la session de l'attaquante (clé publique + jeton). */
export async function asAttacker(token: string, fn: string, args: Row): Promise<{ ok: boolean; data: unknown; error: string | null }> {
    return restRpc(userClient(token), fn, args);
}

// ── Traces écrites ─────────────────────────────────────────────────────────

export interface Traces { events: number; categories: number; zones: number; gates: number; audits: number }

async function countLike(table: string, column: string, m: string): Promise<number> {
    const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).ilike(column, `%${m}%`);
    assert.equal(error, null, `lecture de ${table} : ${error?.message}`);
    return count ?? 0;
}

/**
 * Lignes portant la marque `m` (titre de l'événement, nom de catégorie, de zone, de porte) et lignes d'audit de création
 * de l'auteur (EVENT_CREATED, EVENT_ZONES_UPDATED, CATEGORY_CREATED, CATEGORY_UPDATED).
 */
export async function traces(m: string, actorId: string): Promise<Traces> {
    const { count: audits, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true })
        .eq('user_id', actorId).in('action', ['EVENT_CREATED', 'EVENT_ZONES_UPDATED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED']);
    assert.equal(error, null, `journal d'audit : ${error?.message}`);
    return {
        events: await countLike('events', 'title', m),
        categories: await countLike('ticket_categories', 'name', m),
        zones: await countLike('event_zones', 'name', m),
        gates: await countLike('event_gates', 'name', m),
        audits: audits ?? 0,
    };
}

/** Rien d'écrit entre deux relevés (aucune ligne marquée, aucun audit de création en plus). */
export function nothingWritten(before: Traces, after: Traces): boolean {
    return after.events === 0 && after.categories === 0 && after.zones === 0 && after.gates === 0 && after.audits === before.audits;
}

/** Ligne d'une catégorie (colonnes qu'une attaque pourrait changer). */
export async function categoryRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_categories')
        .select('id, event_id, name, price, scan_color, entry_instruction, total_quantity, is_active, updated_at').eq('id', id).single();
    assert.equal(error, null, `catégorie ${id} : ${error?.message}`);
    return data as Row;
}

/** Catégories d'un événement, par nom. */
export async function categoriesOf(eventId: string): Promise<Record<string, Row>> {
    const { data, error } = await service.from('ticket_categories')
        .select('id, name, price, scan_color, entry_instruction').eq('event_id', eventId);
    assert.equal(error, null, `catégories de ${eventId} : ${error?.message}`);
    return Object.fromEntries((data ?? []).map((r) => [String(r.name), r as Row]));
}

/** Réglage finance.min_paid_price (lu en base). */
export async function minPaidPrice(): Promise<number> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', 'finance.min_paid_price').single();
    assert.equal(error, null, `réglage finance.min_paid_price : ${error?.message}`);
    const min = Number((data!.value as Row).value);
    assert.ok(Number.isInteger(min) && min >= 2, `réglage finance.min_paid_price lisible et ≥ 2 : ${JSON.stringify(data!.value)}`);
    return min;
}

/** Représentation lisible d'une valeur d'attaque (caractères invisibles rendus en \uXXXX). */
export function lit(v: unknown): string {
    const s = JSON.stringify(v) ?? String(v);
    return s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

// ── Écart de couleur perçu (CIEDE2000), jetons « r g b » d'app/globals.css ──

export function cssToken(name: string): [number, number, number] {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    const m = new RegExp(`--${name}:[ ]*([0-9]+)[ ]+([0-9]+)[ ]+([0-9]+)[ ]*;`).exec(css);
    assert.ok(m, `jeton --${name} absent d'app/globals.css`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function lab([r8, g8, b8]: [number, number, number]): [number, number, number] {
    const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [lin(r8), lin(g8), lin(b8)];
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Écart CIEDE2000 (même formule que tests/parcours/f2b-couleur-auto.test.ts). */
export function deltaE00(c1: [number, number, number], c2: [number, number, number]): number {
    const [L1, a1, b1] = lab(c1);
    const [L2, a2, b2] = lab(c2);
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1);
    const C2p = Math.hypot(a2p, b2);
    const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360;
    const h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
    const dLp = L2 - L1;
    const dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2);
    const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/** Liste des manquements, une ligne chacun (message d'assertion). */
export function list(lines: string[]): string {
    return lines.map((l) => `  - ${l}`).join('\n');
}
