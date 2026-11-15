/**
 * Contre-vérification de la finition 1 (équipe) — aides communes aux suites `tests/audit/cvf1-*.test.ts`.
 *
 * L'attaquant joue avec ses propres sessions (clé publique + jeton), par les vraies routes de l'application ou par la
 * REST de Supabase. Le montage passe par le service_role sur la base LOCALE, comme les suites du lot. Aucune assertion
 * n'est assouplie pour faire passer une suite : une suite verte dit que l'attaque a échoué.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BASE_URL, randomEmail, randomSenegalPhone, routeContext, STRONG_PASSWORD } from '../parcours/helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from '../parcours/paiement-helpers';
import { createTimedEvent, scan, scansOf, ticketPayload } from '../parcours/acces-helpers';
import type { TestPartner } from '../parcours/finance-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

export type Row = Record<string, unknown>;
export interface Reply { status: number; body: Row }
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

export const FREE = 'Entrée libre';
export const PAID = 'Standard';
export const CATS: CategorySpec[] = [{ name: FREE, price: 0, total: 80 }, { name: PAID, price: 2_000, total: 80 }];

const handlers = new Map<string, Handler>();

async function handlerOf(rel: string, method: string): Promise<Handler> {
    const key = `${rel}#${method}`;
    const cached = handlers.get(key);
    if (cached) return cached;
    const mod = (await import(`../../app/api/${rel}/route`)) as Record<string, unknown>;
    const h = mod[method];
    assert.equal(typeof h, 'function', `route /api/${rel} : ${method} exporté`);
    handlers.set(key, h as Handler);
    return h as Handler;
}

/**
 * Appel d'une route de l'application. `rel` : chemin du fichier sous app/api (segments entre crochets) ; `path` :
 * adresse réelle (requête comprise), par défaut `/api/${rel}` ; `params` : segments dynamiques.
 */
export async function api(method: string, rel: string, opts: {
    token?: string | null; path?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string>;
} = {}): Promise<Reply> {
    const handler = await handlerOf(rel, method);
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const req = new NextRequest(`${BASE_URL}${opts.path ?? `/api/${rel}`}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const res = await handler(req, routeContext(opts.params ?? {}));
    const text = await res.text();
    let body: Row = {};
    if (text) {
        try {
            body = JSON.parse(text) as Row;
        } catch {
            body = { raw: text.slice(0, 500) };
        }
    }
    return { status: res.status, body };
}

export function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

export function ok2xx(r: Reply): boolean {
    return r.status >= 200 && r.status < 300;
}

export function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

export function userClient(token: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

/** Lecture REST : lignes rendues (une erreur de droit compte comme « aucune ligne », elle est rendue à part). */
export async function restRows(client: SupabaseClient, table: string, filter: Record<string, string> = {}): Promise<{ rows: Row[]; error: string | null }> {
    let q = client.from(table).select('*');
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q;
    return { rows: (data ?? []) as Row[], error: error ? `${error.code ?? ''} ${error.message}` : null };
}

/** Appel RPC par la REST : `ok` vrai si PostgREST a exécuté la fonction (aucune erreur). */
export async function restRpc(client: SupabaseClient, fn: string, args: Row): Promise<{ ok: boolean; data: unknown; error: string | null }> {
    const { data, error } = await client.rpc(fn, args);
    return { ok: !error, data: data ?? null, error: error ? `${error.code ?? ''} ${error.message}` : null };
}

// ── Montage ────────────────────────────────────────────────────────────────

export async function freeEvent(partner: Pick<TestPartner, 'partnerId'>, label: string, opts: { startsInHours?: number; durationHours?: number; status?: string } = {}): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `cvf1-${label}`, CATS, opts);
}

/** Billet gratuit VALIDE émis directement (comme free_tickets_claim), stock tenu à jour (invariants). */
export async function freeTicket(ev: SaleEvent, holder: Pick<Buyer, 'userId'>): Promise<{ id: string; number: string }> {
    const cat = ev.categories[FREE];
    assert.ok(cat, `catégorie ${FREE} de l'événement ${ev.eventId}`);
    const number = `TCK-CVF1-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, price: 0, status: 'VALIDE',
        ticket_number: number, qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
    }).select('id').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock de ${FREE} : ${cErr?.message}`);
    const { error: upErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c?.sold_quantity ?? 0) + 1 }).eq('id', cat.id);
    assert.equal(upErr, null, `stock de ${FREE} : ${upErr?.message}`);
    return { id: String(data!.id), number };
}

export async function scanTicket(user: Buyer, eventId: string, ticketId: string, extra: Row = {}, idempotencyKey?: string): Promise<Reply> {
    return scan(user, { eventId, payload: await ticketPayload(ticketId), ...extra }, idempotencyKey === undefined ? {} : { idempotencyKey });
}

export async function ticketStatus(id: string): Promise<string> {
    const { data, error } = await service.from('tickets').select('status').eq('id', id).single();
    assert.equal(error, null, `billet ${id} : ${error?.message}`);
    return String(data!.status);
}

export async function acceptedScans(ticketId: string): Promise<Row[]> {
    return (await scansOf(ticketId)).filter((s) => s.accepted === true);
}

export async function setFiche(partnerId: string, status: 'VALIDE' | 'SUSPENDU' | 'EN_ATTENTE' | 'REJETE'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', partnerId);
    assert.equal(error, null, `fiche ${status} : ${error?.message}`);
}

export async function addRole(userId: string, role: string): Promise<void> {
    const { error } = await service.from('user_roles').upsert([{ user_id: userId, role }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ${role} : ${error?.message}`);
}

export async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

export async function assignmentOf(eventId: string, userId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_controllers').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    assert.equal(error, null, `affectation ${eventId}/${userId} : ${error?.message}`);
    return (data ?? null) as Row | null;
}

export async function invitationRow(id: string): Promise<Row> {
    const { data, error } = await service.from('controller_invitations').select('*').eq('id', id).single();
    assert.equal(error, null, `invitation ${id} : ${error?.message}`);
    return data as Row;
}

export async function invitationsFor(partnerId: string, userId: string): Promise<Row[]> {
    const { data, error } = await service.from('controller_invitations').select('*').eq('partner_id', partnerId).eq('user_id', userId).order('created_at');
    assert.equal(error, null, `invitations ${partnerId}/${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Invitation échue (créée il y a 4 jours, échue depuis 1 jour), sans passer par la tâche planifiée. */
export async function expireInvitation(id: string): Promise<void> {
    const now = Date.now();
    const { error } = await service.from('controller_invitations').update({
        created_at: new Date(now - 96 * 3600_000).toISOString(),
        last_sent_at: new Date(now - 96 * 3600_000).toISOString(),
        expires_at: new Date(now - 24 * 3600_000).toISOString(),
    }).eq('id', id);
    assert.equal(error, null, `invitation ${id} échue (montage) : ${error?.message}`);
}

/** Invitation d'un compte existant par la route (confirmation donnée) ; rend l'identifiant de l'invitation. */
export async function inviteExisting(partner: Pick<Buyer, 'accessToken'>, eventIds: string[], holder: Pick<Buyer, 'phoneE164'>): Promise<string> {
    const res = await api('POST', 'partner/team/invite', {
        token: partner.accessToken, body: { event_ids: eventIds, phone: holder.phoneE164, confirm_promotion: true },
    });
    assert.equal(res.status, 201, `invitation de ${holder.phoneE164} (montage) : ${show(res)}`);
    assert.equal(typeof res.body.invitation_id, 'string', `identifiant de l'invitation (montage) : ${show(res)}`);
    return String(res.body.invitation_id);
}

export async function smsCount(type: string, userId: string): Promise<number> {
    const { count, error } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
        .eq('type', type).eq('recipient_user_id', userId).eq('channel', 'SMS');
    assert.equal(error, null, `boîte d'envoi (${type}) : ${error?.message}`);
    return count ?? 0;
}

/**
 * Compte ADMIN neuf (permissions données) dont la session est ouverte chez GoTrue SANS le code administrateur ni le mot
 * de passe redemandé (contrairement à newAdmin, qui passe par stepUpTestSession).
 */
export async function adminWithoutCode(label: string, permissions: string[]): Promise<Buyer> {
    const email = randomEmail(`cvf1-${label}`);
    const phoneE164 = randomSenegalPhone('77');
    const { data, error } = await service.auth.admin.createUser({ email, phone: phoneE164, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, error?.message);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({
        phone: phoneE164, first_name: 'Sans', last_name: 'Code', status: 'ACTIF', phone_verified_at: new Date().toISOString(),
    }).eq('id', userId);
    assert.equal(upErr, null, upErr?.message);
    await addRole(userId, 'ADMIN');
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `${permission} : ${pErr?.message}`);
    }
    const { data: s, error: sErr } = await anonClient().auth.signInWithPassword({ email: await gotrueEmail(email), password: STRONG_PASSWORD });
    assert.equal(sErr, null, sErr?.message);
    return { userId, accessToken: s.session!.access_token, email, phoneE164, phone9: phoneE164.slice(4), firstName: 'Sans', lastName: 'Code' };
}

/** Client nommé (nom et numéro connus), pour chercher ces données dans les réponses. */
export async function namedBuyer(label: string, firstName: string, lastName: string): Promise<Buyer> {
    return newBuyer(`cvf1-${label}`, { firstName, lastName });
}

/** Vrai si `text` contient l'une des valeurs (numéro E.164, 9 chiffres, nom, identifiant…). */
export function leaks(text: string, values: Array<string | null | undefined>): string[] {
    return values.filter((v): v is string => typeof v === 'string' && v.length >= 4 && text.includes(v));
}

export function iso(hoursFromNow: number): string {
    return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}
