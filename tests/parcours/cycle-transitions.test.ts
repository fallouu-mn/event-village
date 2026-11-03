/**
 * Lot 5, tâche 5.2 — machine à états stricte de l'événement (constats R27, events-cdc-1, events-cdc-10).
 * Contrat : sections D1 à D5 et U de la conception du lot 5.
 *  - event_status_transitions reprend mot pour mot la liste de 5.2 (16 couples statut, rôle, canal), et
 *    la table est lisible par authenticated ;
 *  - event_transition(p) { event_id, actor_id, to_status, reason? } : chaque transition permise au bon
 *    rôle passe et écrit sa ligne event_status_history (acteur, ancien, nouveau, motif, canal TRANSITION) ;
 *    un refus { ok: false, code, message } n'a aucun effet : TRANSITION_NOT_ALLOWED, UNKNOWN_STATUS,
 *    REASON_REQUIRED, SUBMIT_INCOMPLETE (missing[]), EVENT_NOT_STARTED, EVENT_ENDED ;
 *  - ANNULE et TERMINE sont terminaux pour tous les rôles : partenaire, ADMIN, SUPERADMIN et système
 *    (appel sans acteur, UPDATE direct, cron) ;
 *  - routes POST /api/partner/events/[id]/transition et /api/admin/events/[id]/transition { to, reason? } :
 *    statut inconnu → 400 UNKNOWN_STATUS, rôle manquant → 403, transition hors table → 409 ; acteur de la
 *    session journalisé ; l'ancienne route /api/partner/events/[id]/status est supprimée ;
 *  - garde D3 : un UPDATE de events.status hors transition est refusé (EV422), service_role compris ; D2 :
 *    tout INSERT est forcé à BROUILLON, avec la ligne NULL → BROUILLON (canal CREATION) ;
 *  - historique en ajout seul (UPDATE et DELETE refusés, cascade permise à la suppression d'un
 *    brouillon), lisible du partenaire propriétaire et pas du partenaire B, sans écriture par l'API ;
 *  - notifications au partenaire : refus (avec motif), validation, suspension (avec motif).
 * Rouge avant correctif :
 *  - aucune migration ne crée event_status_transitions, event_status_history ni event_transition (grep
 *    vide dans supabase/migrations) : createEventInStatus et advanceEventTo échouent sur l'appel de la RPC ;
 *  - le statut n'est écrit que par l'UPDATE sans garde de lib/events/event.service.ts:805-812, après une
 *    matrice codée en TS et trouée (l.743-802) : ANNULE n'a aucune branche (tout passe), le partenaire fait
 *    PUBLIE → TERMINE (l.786), l'admin VALIDE → SUSPENDU (l.774) et * → TERMINE (l.752, 764, 776), motifs
 *    facultatifs (« Non spécifié », l.852) ;
 *  - seul trigger sur events : trg_events_updated_at (supabase/migrations/0002_functions.sql:25), donc ni
 *    garde du statut ni INSERT forcé ;
 *  - routes /transition absentes (app/api/partner/events/[id]/ n'a que status/route.ts, qui répond 400 à
 *    toute erreur, l.38-44 ; app/api/admin/events/[id]/ n'a que cancel) ; l'ancienne route est appelée par
 *    app/partner/events/page.tsx:94 et 116.
 * La suite crée ses partenaires, son ADMIN (events.read, events.write) et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { assertLifecycleInvariants, finishOverdueEvents } from '../helpers/lifecycle-invariants';
import { disposeClients, signedInClient } from '../helpers/realtime';
import { importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    assertRpcOk, createDraftEvent, createEventInStatus, eventHistory, eventStatus, rpcCancel, rpcTransition, shiftEventDates,
    type AdvanceOptions, type DraftEvent, type DraftEventOptions, type EventHistoryRow, type EventStatus, type RpcBody,
} from './cycle-helpers';
import { flushNotifications } from './notif-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Record<string, unknown> }
type Role = 'PARTENAIRE' | 'ADMIN';

const CATS: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 50 }];
const PARTNER_ROUTE = '../../app/api/partner/events/[id]/transition/route';
const ADMIN_ROUTE = '../../app/api/admin/events/[id]/transition/route';

let owner: TestPartner;
let other: TestPartner;
let admin: Buyer;
let superadmin: string;

before(async () => {
    owner = await newPartner('cycletrans');
    other = await newPartner('cycletransb');
    admin = await newEventsAdmin('cycletrans');
    superadmin = await superadminId();
});

after(async () => {
    await assertLifecycleInvariants('cycle-transitions');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** ADMIN dédié à la suite, avec les permissions données (défaut : events.read et events.write). */
async function newEventsAdmin(label: string, permissions: string[] = ['events.read', 'events.write']): Promise<Buyer> {
    const user = await newBuyer(`adm-${label}`, { firstName: 'Ndeye', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    return user;
}

function draft(label: string, opts: DraftEventOptions = {}): Promise<DraftEvent> {
    return createDraftEvent(owner, label, CATS, { startsInHours: 48, ...opts });
}

function inStatus(label: string, target: EventStatus, opts: DraftEventOptions & AdvanceOptions = {}): Promise<DraftEvent> {
    return createEventInStatus(owner, label, CATS, target, { startsInHours: 48, ...opts });
}

/** Contexte de route compatible avec params objet (Next 14) et params promesse. */
function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function loadHandler(rel: string): Promise<Handler> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(rel);
    } catch (err) {
        assert.fail(`route ${rel} absente (contrat D4) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.POST, 'function', `${rel} : POST non exporté`);
    return mod.POST as Handler;
}

async function callRoute(handler: Handler, req: NextRequest, ctx: unknown): Promise<Reply> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

async function partnerRoute(eventId: string, who: Buyer, body: Record<string, unknown>): Promise<Reply> {
    const h = await loadHandler(PARTNER_ROUTE);
    return callRoute(h, jsonRequest(`/api/partner/events/${eventId}/transition`, 'POST', who.accessToken, body), routeCtx({ id: eventId }));
}

async function adminRoute(eventId: string, who: Buyer, body: Record<string, unknown>): Promise<Reply> {
    const h = await loadHandler(ADMIN_ROUTE);
    return callRoute(h, jsonRequest(`/api/admin/events/${eventId}/transition`, 'POST', who.accessToken, body), routeCtx({ id: eventId }));
}

async function lastHistory(eventId: string): Promise<EventHistoryRow> {
    const rows = await eventHistory(eventId);
    assert.ok(rows.length > 0, `événement ${eventId} sans historique`);
    return rows[rows.length - 1];
}

/** Refus métier de event_transition : { ok: false, code, message } sans erreur Postgres, statut et historique inchangés. */
async function expectRefused(eventId: string, actorId: string, to: string, code: string, label: string, reason?: string): Promise<RpcBody> {
    const statusBefore = await eventStatus(eventId);
    const historyBefore = (await eventHistory(eventId)).length;
    const call = await rpcTransition(eventId, actorId, to, reason);
    assert.equal(call.error, null, `${label} : refus métier attendu, pas une erreur Postgres : ${call.error?.message} (code ${call.error?.code})`);
    assert.ok(call.data, `${label} : réponse vide`);
    assert.equal(call.data.ok, false, `${label} : refus attendu, reçu ${JSON.stringify(call.data)}`);
    assert.equal(call.data.code, code, `${label} : code ${code} attendu, reçu ${JSON.stringify(call.data)}`);
    assert.ok(typeof call.data.message === 'string' && call.data.message.trim().length > 0, `${label} : message en français attendu : ${JSON.stringify(call.data)}`);
    assert.equal(await eventStatus(eventId), statusBefore, `${label} : statut inchangé`);
    assert.equal((await eventHistory(eventId)).length, historyBefore, `${label} : aucune ligne d'historique écrite`);
    return call.data;
}

/** Refus d'une route : statut HTTP et code attendus, statut de l'événement inchangé. */
async function expectRouteRefused(r: Reply, eventId: string, statusBefore: EventStatus, http: number, code: string, label: string): Promise<void> {
    assert.equal(r.status, http, `${label} : HTTP ${http} attendu, ${show(r)}`);
    assert.equal(r.body.code, code, `${label} : code ${code} attendu, ${show(r)}`);
    assert.ok(typeof r.body.error === 'string' && r.body.error.length > 0, `${label} : message d'erreur en français attendu, ${show(r)}`);
    assert.equal(await eventStatus(eventId), statusBefore, `${label} : statut inchangé`);
}

function hoursSinceDakarMidnight(): number {
    const now = new Date();
    return (now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 3600_000;
}

/** Retire les commentaires d'un source TS/TSX (les URL « http:// » sont conservées). */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function sourceFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...sourceFiles(full));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
    return out;
}

interface NotificationRow { id: string; title: string; content: string; metadata: Record<string, unknown> | null }

async function notificationsOf(userId: string): Promise<NotificationRow[]> {
    const { data, error } = await service.from('notifications').select('id, title, content, metadata').eq('user_id', userId);
    assert.equal(error, null, `notifications : ${error?.message}`);
    return (data ?? []) as NotificationRow[];
}

function mentionsEvent(n: NotificationRow, ev: DraftEvent): boolean {
    return JSON.stringify(n.metadata ?? {}).includes(ev.eventId) || `${n.title} ${n.content}`.includes(ev.title);
}

async function freshNotifications(userId: string, seen: NotificationRow[]): Promise<NotificationRow[]> {
    const ids = seen.map((n) => n.id);
    return (await notificationsOf(userId)).filter((n) => !ids.includes(n.id));
}

/**
 * Lot 6 (T) : l'in-app est écrite par l'envoyeur unique (boîte d'envoi). Passage restreint à l'événement,
 * motif « vider → photographier → agir → vider → comparer ».
 */
async function flushEvent(ev: DraftEvent): Promise<void> {
    await flushNotifications({ eventIds: [ev.eventId] });
}

// ── D1 : table de transitions ──────────────────────────────────────────────

/** Liste exacte de 5.2 : [ancien, nouveau, rôle, canal, motif obligatoire (null : non fixé par le contrat)]. */
const EXPECTED_TRANSITIONS: Array<[EventStatus, EventStatus, 'PARTENAIRE' | 'ADMIN' | 'SYSTEM', 'TRANSITION' | 'CANCELLATION' | 'CRON', boolean | null]> = [
    ['BROUILLON', 'EN_ATTENTE', 'PARTENAIRE', 'TRANSITION', false],
    ['EN_ATTENTE', 'BROUILLON', 'PARTENAIRE', 'TRANSITION', false],
    ['EN_ATTENTE', 'BROUILLON', 'ADMIN', 'TRANSITION', true],
    ['EN_ATTENTE', 'VALIDE', 'ADMIN', 'TRANSITION', false],
    ['VALIDE', 'PUBLIE', 'PARTENAIRE', 'TRANSITION', false],
    ['VALIDE', 'PUBLIE', 'ADMIN', 'TRANSITION', false],
    ['PUBLIE', 'SUSPENDU', 'ADMIN', 'TRANSITION', true],
    ['SUSPENDU', 'PUBLIE', 'ADMIN', 'TRANSITION', false],
    ['PUBLIE', 'ANNULE', 'PARTENAIRE', 'CANCELLATION', null],
    ['PUBLIE', 'ANNULE', 'ADMIN', 'CANCELLATION', null],
    ['VALIDE', 'ANNULE', 'PARTENAIRE', 'CANCELLATION', null],
    ['VALIDE', 'ANNULE', 'ADMIN', 'CANCELLATION', null],
    ['SUSPENDU', 'ANNULE', 'PARTENAIRE', 'CANCELLATION', null],
    ['SUSPENDU', 'ANNULE', 'ADMIN', 'CANCELLATION', null],
    ['PUBLIE', 'TERMINE', 'SYSTEM', 'CRON', false],
    ['PUBLIE', 'TERMINE', 'ADMIN', 'TRANSITION', false],
];

interface TransitionRow { from_status: string; to_status: string; actor_kind: string; reason_required: boolean; channel: string }

function transitionKey(from: string, to: string, actor: string, channel: string): string {
    return `${from} → ${to} par ${actor} (canal ${channel})`;
}

describe('5.2 Table de transitions (event_status_transitions)', () => {
    test('liste exacte de 5.2 : 16 couples (ancien, nouveau, rôle, canal), motif obligatoire pour le refus et la suspension', async () => {
        const { data, error } = await service.from('event_status_transitions').select('from_status, to_status, actor_kind, reason_required, channel');
        assert.equal(error, null, `event_status_transitions : ${error?.message} (code ${error?.code})`);
        const rows = (data ?? []) as TransitionRow[];
        const got = rows.map((r) => transitionKey(r.from_status, r.to_status, r.actor_kind, r.channel)).sort();
        const want = EXPECTED_TRANSITIONS.map(([f, t, a, c]) => transitionKey(f, t, a, c)).sort();
        assert.deepEqual(got, want, 'la table reprend la liste de 5.2, ni plus ni moins (aucun doublon)');
        for (const [f, t, a, c, reasonRequired] of EXPECTED_TRANSITIONS) {
            const row = rows.find((r) => r.from_status === f && r.to_status === t && r.actor_kind === a && r.channel === c);
            assert.ok(row, transitionKey(f, t, a, c));
            assert.equal(typeof row.reason_required, 'boolean', `${transitionKey(f, t, a, c)} : reason_required booléen`);
            if (reasonRequired !== null) assert.equal(row.reason_required, reasonRequired, `${transitionKey(f, t, a, c)} : motif obligatoire = ${reasonRequired}`);
        }
    });

    test('la table est lisible par un compte connecté (actions possibles des interfaces)', async () => {
        const client = await signedInClient(owner);
        try {
            const { data, error } = await client.from('event_status_transitions').select('from_status, to_status, actor_kind, channel');
            assert.equal(error, null, `lecture par authenticated : ${error?.message}`);
            assert.equal((data ?? []).length, EXPECTED_TRANSITIONS.length, `16 lignes lues par le partenaire connecté : ${JSON.stringify(data)}`);
        } finally {
            await disposeClients(client);
        }
    });
});

// ── D4 : transitions permises et historique ────────────────────────────────

describe('5.2 Transitions permises : event_transition et historique', () => {
    test('chaque transition permise au bon rôle passe et écrit sa ligne (acteur, ancien, nouveau, motif, canal)', async () => {
        const ev = await draft('chemin');
        const REFUS = 'Affiche floue : merci de la remplacer';
        const SUSPENSION = 'Vérification des autorisations préfectorales';
        const plan: Array<{ actor: string; role: Role; to: EventStatus; reason?: string; label: string; prepare?: () => Promise<unknown> }> = [
            { actor: owner.userId, role: 'PARTENAIRE', to: 'EN_ATTENTE', label: 'soumission' },
            { actor: owner.userId, role: 'PARTENAIRE', to: 'BROUILLON', label: 'retrait par le partenaire, sans motif' },
            { actor: owner.userId, role: 'PARTENAIRE', to: 'EN_ATTENTE', label: 'nouvelle soumission' },
            { actor: admin.userId, role: 'ADMIN', to: 'BROUILLON', reason: REFUS, label: 'refus motivé par un ADMIN' },
            { actor: owner.userId, role: 'PARTENAIRE', to: 'EN_ATTENTE', label: 'soumission après refus' },
            { actor: superadmin, role: 'ADMIN', to: 'VALIDE', label: 'validation par le SUPERADMIN (rôle ADMIN au journal)' },
            { actor: owner.userId, role: 'PARTENAIRE', to: 'PUBLIE', label: 'publication par le partenaire' },
            { actor: admin.userId, role: 'ADMIN', to: 'SUSPENDU', reason: SUSPENSION, label: 'suspension motivée' },
            { actor: admin.userId, role: 'ADMIN', to: 'PUBLIE', label: 'réactivation' },
            {
                actor: admin.userId, role: 'ADMIN', to: 'TERMINE', label: 'fin manuelle par l’admin, début passé',
                prepare: () => shiftEventDates(ev.eventId, { startsInHours: -3 }),
            },
        ];
        const want: Array<Record<string, unknown>> = [];
        let from: EventStatus = 'BROUILLON';
        for (const s of plan) {
            if (s.prepare) await s.prepare();
            const label: string = `${from} → ${s.to} (${s.label})`;
            assertRpcOk(await rpcTransition(ev.eventId, s.actor, s.to, s.reason), label);
            assert.equal(await eventStatus(ev.eventId), s.to, `${label} : statut relu`);
            want.push({ old: from, next: s.to, actor: s.actor, role: s.role, reason: s.reason ?? null, channel: 'TRANSITION' });
            from = s.to;
        }

        const rows = await eventHistory(ev.eventId);
        assert.equal(rows.length, plan.length + 1, `une ligne de création puis une ligne par transition : ${JSON.stringify(rows)}`);
        assert.deepEqual(
            { old: rows[0].old_status, next: rows[0].new_status, channel: rows[0].channel },
            { old: null, next: 'BROUILLON', channel: 'CREATION' },
            'première ligne NULL → BROUILLON (canal CREATION)',
        );
        const got = rows.slice(1).map((r) => ({ old: r.old_status, next: r.new_status, actor: r.actor_id, role: r.actor_role, reason: r.reason, channel: r.channel }));
        assert.deepEqual(got, want, 'historique : acteur, ancien, nouveau, motif et canal de chaque transition, dans l’ordre');
        assert.ok(rows.every((r) => r.txid !== null && r.txid !== undefined), 'txid renseigné sur chaque ligne');
    });

    test('VALIDE → PUBLIE par un admin : permis et journalisé ADMIN', async () => {
        const ev = await inStatus('pubadmin', 'VALIDE');
        assertRpcOk(await rpcTransition(ev.eventId, admin.userId, 'PUBLIE'), 'publication par un ADMIN');
        const last = await lastHistory(ev.eventId);
        assert.deepEqual(
            { old: last.old_status, next: last.new_status, actor: last.actor_id, role: last.actor_role, channel: last.channel },
            { old: 'VALIDE', next: 'PUBLIE', actor: admin.userId, role: 'ADMIN', channel: 'TRANSITION' },
        );
    });
});

// ── D4 : refus ─────────────────────────────────────────────────────────────

describe('5.2 Statuts terminaux : ANNULE et TERMINE', () => {
    test('ANNULE → PUBLIE refusé pour tous les rôles (partenaire, ADMIN, SUPERADMIN, système)', async () => {
        const ev = await inStatus('annule', 'ANNULE');
        const historyAfterCancel = (await eventHistory(ev.eventId)).length;

        await expectRefused(ev.eventId, owner.userId, 'PUBLIE', 'TRANSITION_NOT_ALLOWED', 'ANNULE → PUBLIE par le partenaire');
        await expectRefused(ev.eventId, admin.userId, 'PUBLIE', 'TRANSITION_NOT_ALLOWED', 'ANNULE → PUBLIE par un ADMIN');
        await expectRefused(ev.eventId, superadmin, 'PUBLIE', 'TRANSITION_NOT_ALLOWED', 'ANNULE → PUBLIE par le SUPERADMIN');
        for (const [to, reason] of [['VALIDE', undefined], ['SUSPENDU', 'Motif de test'], ['BROUILLON', 'Motif de test']] as Array<[EventStatus, string | undefined]>) {
            await expectRefused(ev.eventId, superadmin, to, 'TRANSITION_NOT_ALLOWED', `ANNULE → ${to} par le SUPERADMIN`, reason);
        }

        await expectRouteRefused(await partnerRoute(ev.eventId, owner, { to: 'PUBLIE' }), ev.eventId, 'ANNULE', 409, 'TRANSITION_NOT_ALLOWED', 'route partenaire ANNULE → PUBLIE');
        await expectRouteRefused(await adminRoute(ev.eventId, admin, { to: 'PUBLIE' }), ev.eventId, 'ANNULE', 409, 'TRANSITION_NOT_ALLOWED', 'route admin ANNULE → PUBLIE');

        // Système 1 : appel de la RPC sans acteur
        const sys = await service.rpc('event_transition', { p: { event_id: ev.eventId, actor_id: null, to_status: 'PUBLIE' } });
        const sysBody = (sys.data ?? null) as RpcBody | null;
        assert.ok(!(sys.error === null && sysBody?.ok === true), `ANNULE → PUBLIE sans acteur accepté : ${JSON.stringify(sys)}`);
        // Système 2 : UPDATE direct par le service_role (garde D3)
        const upd = await service.from('events').update({ status: 'PUBLIE' }).eq('id', ev.eventId).select('id');
        assert.equal(upd.error?.code, 'EV422', `UPDATE direct ANNULE → PUBLIE : ${JSON.stringify(upd)}`);
        // Système 3 : le cron ne touche pas un événement annulé, même passé
        await shiftEventDates(ev.eventId, { startsInHours: -10, durationHours: 2 });
        const cron = await finishOverdueEvents();
        assert.ok(!cron.ids.includes(ev.eventId), `le cron a terminé un événement ANNULE : ${JSON.stringify(cron)}`);

        assert.equal(await eventStatus(ev.eventId), 'ANNULE', 'toujours ANNULE');
        assert.equal((await eventHistory(ev.eventId)).length, historyAfterCancel, 'aucune ligne d’historique après l’annulation');
    });

    test('TERMINE → PUBLIE, SUSPENDU ou BROUILLON refusé, et TERMINE ne s’annule plus', async () => {
        const ev = await inStatus('termine', 'TERMINE', { finishShift: { startsInHours: -3 } });
        await expectRefused(ev.eventId, owner.userId, 'PUBLIE', 'TRANSITION_NOT_ALLOWED', 'TERMINE → PUBLIE par le partenaire');
        await expectRefused(ev.eventId, superadmin, 'PUBLIE', 'TRANSITION_NOT_ALLOWED', 'TERMINE → PUBLIE par le SUPERADMIN');
        await expectRefused(ev.eventId, superadmin, 'SUSPENDU', 'TRANSITION_NOT_ALLOWED', 'TERMINE → SUSPENDU', 'Motif de test');
        await expectRefused(ev.eventId, superadmin, 'BROUILLON', 'TRANSITION_NOT_ALLOWED', 'TERMINE → BROUILLON', 'Motif de test');
        const cancel = await rpcCancel(ev.eventId, owner.userId, {
            publicNotice: 'Annulation tardive de l’événement de test.', internalReason: 'Test lot 5', confirmTitle: ev.title,
        });
        assert.equal(cancel.error, null, `event_cancel sur TERMINE : ${cancel.error?.message}`);
        assert.equal(cancel.data?.ok, false, `event_cancel sur TERMINE refusé : ${JSON.stringify(cancel.data)}`);
        assert.equal(cancel.data?.code, 'TRANSITION_NOT_ALLOWED', JSON.stringify(cancel.data));
        assert.equal(await eventStatus(ev.eventId), 'TERMINE');
    });
});

describe('5.2 Rôles : le partenaire ne valide, ne suspend ni ne termine', () => {
    test('partenaire qui tente VALIDE ou SUSPENDU (et TERMINE) → refusé par la RPC (TRANSITION_NOT_ALLOWED) et par sa route (403)', async () => {
        const pending = await inStatus('partvalide', 'EN_ATTENTE');
        await expectRefused(pending.eventId, owner.userId, 'VALIDE', 'TRANSITION_NOT_ALLOWED', 'auto-validation EN_ATTENTE → VALIDE');
        await expectRouteRefused(await partnerRoute(pending.eventId, owner, { to: 'VALIDE' }), pending.eventId, 'EN_ATTENTE', 403, 'TRANSITION_NOT_ALLOWED', 'route partenaire → VALIDE');

        const pub = await inStatus('partsusp', 'PUBLIE');
        await expectRefused(pub.eventId, owner.userId, 'SUSPENDU', 'TRANSITION_NOT_ALLOWED', 'suspension par le partenaire', 'Je suspends mon événement');
        await expectRouteRefused(await partnerRoute(pub.eventId, owner, { to: 'SUSPENDU', reason: 'Je suspends mon événement' }), pub.eventId, 'PUBLIE', 403, 'TRANSITION_NOT_ALLOWED', 'route partenaire → SUSPENDU');

        // Ancienne matrice : PUBLIE → TERMINE permis au partenaire (event.service.ts:786) ; ici début passé, pour isoler le rôle.
        await shiftEventDates(pub.eventId, { startsInHours: -1 });
        await expectRefused(pub.eventId, owner.userId, 'TERMINE', 'TRANSITION_NOT_ALLOWED', 'fin manuelle par le partenaire');
        await expectRouteRefused(await partnerRoute(pub.eventId, owner, { to: 'TERMINE' }), pub.eventId, 'PUBLIE', 403, 'TRANSITION_NOT_ALLOWED', 'route partenaire → TERMINE');
    });

    test('route partenaire : la soumission passe et journalise le compte de la session', async () => {
        const ev = await draft('routesoumission');
        const r = await partnerRoute(ev.eventId, owner, { to: 'EN_ATTENTE' });
        assert.equal(r.status, 200, `soumission par la route : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'EN_ATTENTE');
        const last = await lastHistory(ev.eventId);
        assert.deepEqual(
            { old: last.old_status, next: last.new_status, actor: last.actor_id, role: last.actor_role, channel: last.channel },
            { old: 'BROUILLON', next: 'EN_ATTENTE', actor: owner.userId, role: 'PARTENAIRE', channel: 'TRANSITION' },
        );
    });

    test('partenaire B et client : aucune transition sur l’événement du partenaire A', async () => {
        const ev = await draft('autrui');
        await expectRefused(ev.eventId, other.userId, 'EN_ATTENTE', 'TRANSITION_NOT_ALLOWED', 'soumission par le partenaire B');
        const client = await newBuyer('cycleclient');
        await expectRefused(ev.eventId, client.userId, 'EN_ATTENTE', 'TRANSITION_NOT_ALLOWED', 'soumission par un client');
    });

    test('transitions hors table de l’ancienne matrice refusées à l’admin : VALIDE → SUSPENDU, * → TERMINE, BROUILLON → EN_ATTENTE ou VALIDE', async () => {
        const val = await inStatus('adminsusp', 'VALIDE');
        await expectRefused(val.eventId, superadmin, 'SUSPENDU', 'TRANSITION_NOT_ALLOWED', 'VALIDE → SUSPENDU (event.service.ts:774)', 'Motif de test');
        await shiftEventDates(val.eventId, { startsInHours: -1 });
        await expectRefused(val.eventId, superadmin, 'TERMINE', 'TRANSITION_NOT_ALLOWED', 'VALIDE → TERMINE (event.service.ts:776)');

        const brouillon = await draft('adminbrouillon');
        await expectRefused(brouillon.eventId, superadmin, 'EN_ATTENTE', 'TRANSITION_NOT_ALLOWED', 'soumission par l’admin pour le partenaire (hors 5.2)');
        await expectRefused(brouillon.eventId, superadmin, 'VALIDE', 'TRANSITION_NOT_ALLOWED', 'BROUILLON → VALIDE');
        await shiftEventDates(brouillon.eventId, { startsInHours: -1 });
        await expectRefused(brouillon.eventId, superadmin, 'TERMINE', 'TRANSITION_NOT_ALLOWED', 'BROUILLON → TERMINE (event.service.ts:752)');
    });
});

describe('5.2 Motifs, complétude et dates', () => {
    test('motif obligatoire (REASON_REQUIRED) pour le refus admin et la suspension ; le retrait par le partenaire s’en passe', async () => {
        const ev = await inStatus('motif', 'EN_ATTENTE');
        await expectRefused(ev.eventId, admin.userId, 'BROUILLON', 'REASON_REQUIRED', 'refus sans motif');
        await expectRefused(ev.eventId, admin.userId, 'BROUILLON', 'REASON_REQUIRED', 'refus avec un motif de 2 caractères', 'ok');
        const r = await adminRoute(ev.eventId, admin, { to: 'BROUILLON' });
        assert.ok(r.status >= 400 && r.status < 500, `route admin, refus sans motif : ${show(r)}`);
        assert.equal(r.body.code, 'REASON_REQUIRED', show(r));
        assertRpcOk(await rpcTransition(ev.eventId, owner.userId, 'BROUILLON'), 'retrait par le partenaire, sans motif');

        const pub = await inStatus('motifsusp', 'PUBLIE');
        await expectRefused(pub.eventId, admin.userId, 'SUSPENDU', 'REASON_REQUIRED', 'suspension sans motif');
        await expectRefused(pub.eventId, superadmin, 'SUSPENDU', 'REASON_REQUIRED', 'suspension avec un motif de 2 caractères', 'ab');
        const r2 = await adminRoute(pub.eventId, admin, { to: 'SUSPENDU', reason: '' });
        assert.ok(r2.status >= 400 && r2.status < 500, `route admin, suspension sans motif : ${show(r2)}`);
        assert.equal(r2.body.code, 'REASON_REQUIRED', show(r2));
        assert.equal(await eventStatus(pub.eventId), 'PUBLIE');
    });

    test('SUBMIT_INCOMPLETE : soumission sans affiche, sans catégorie active, ou sans rien (liste des manques)', async () => {
        const noPoster = await draft('sansaffiche', { imageUrl: null });
        const a = await expectRefused(noPoster.eventId, owner.userId, 'EN_ATTENTE', 'SUBMIT_INCOMPLETE', 'brouillon sans affiche');
        assert.ok(Array.isArray(a.missing) && a.missing.length >= 1, `missing[] non vide : ${JSON.stringify(a)}`);

        const inactive = await createDraftEvent(owner, 'inactive', [{ name: 'Fermée', price: 5000, total: 10, isActive: false }], { startsInHours: 48 });
        const b = await expectRefused(inactive.eventId, owner.userId, 'EN_ATTENTE', 'SUBMIT_INCOMPLETE', 'brouillon sans catégorie active');
        assert.ok(Array.isArray(b.missing) && b.missing.length >= 1, `missing[] non vide : ${JSON.stringify(b)}`);

        const empty = await createDraftEvent(owner, 'vide', [], { startsInHours: 48, imageUrl: null });
        const c = await expectRefused(empty.eventId, owner.userId, 'EN_ATTENTE', 'SUBMIT_INCOMPLETE', 'brouillon sans affiche ni catégorie');
        assert.ok(Array.isArray(c.missing), `missing[] : ${JSON.stringify(c)}`);
        const distinct = Array.from(new Set((c.missing as unknown[]).map((m) => JSON.stringify(m))));
        assert.ok(distinct.length >= 2, `deux manques distincts (affiche, catégorie active) : ${JSON.stringify(c)}`);

        // Témoin : un brouillon complet passe.
        assertRpcOk(await rpcTransition((await draft('complet')).eventId, owner.userId, 'EN_ATTENTE'), 'brouillon complet');
    });

    test('TERMINE manuel avant le début → EVENT_NOT_STARTED', async () => {
        const pub = await inStatus('pasdebut', 'PUBLIE');
        await expectRefused(pub.eventId, superadmin, 'TERMINE', 'EVENT_NOT_STARTED', 'fin manuelle d’un événement dans 48 h (SUPERADMIN)');
        await expectRefused(pub.eventId, admin.userId, 'TERMINE', 'EVENT_NOT_STARTED', 'fin manuelle d’un événement dans 48 h (ADMIN)');
    });

    test('publication d’un événement dont la fin est passée → EVENT_ENDED (fin renseignée, ou début la veille sans fin)', async () => {
        const val = await inStatus('fini', 'VALIDE');
        await shiftEventDates(val.eventId, { startsInHours: -10, durationHours: 4 });
        await expectRefused(val.eventId, owner.userId, 'PUBLIE', 'EVENT_ENDED', 'publication par le partenaire, fin passée de 6 h');
        await expectRefused(val.eventId, admin.userId, 'PUBLIE', 'EVENT_ENDED', 'publication par l’admin, fin passée de 6 h');

        const veille = await inStatus('finiveille', 'VALIDE');
        await shiftEventDates(veille.eventId, { startsInHours: -(hoursSinceDakarMidnight() + 6), durationHours: null });
        await expectRefused(veille.eventId, owner.userId, 'PUBLIE', 'EVENT_ENDED', 'sans fin, début la veille : fin la veille à 23:59 (D7)');
    });
});

describe('5.2 Routes', () => {
    test('statut inconnu → 400 UNKNOWN_STATUS par les deux routes (et refus UNKNOWN_STATUS de la RPC)', async () => {
        const ev = await inStatus('inconnu', 'EN_ATTENTE');
        const historyBefore = (await eventHistory(ev.eventId)).length;
        for (const to of ['ARCHIVE', 'publie']) {
            await expectRouteRefused(await partnerRoute(ev.eventId, owner, { to }), ev.eventId, 'EN_ATTENTE', 400, 'UNKNOWN_STATUS', `route partenaire, statut « ${to} »`);
            await expectRouteRefused(await adminRoute(ev.eventId, admin, { to }), ev.eventId, 'EN_ATTENTE', 400, 'UNKNOWN_STATUS', `route admin, statut « ${to} »`);
            await expectRefused(ev.eventId, superadmin, to, 'UNKNOWN_STATUS', `RPC, statut « ${to} »`);
        }
        assert.equal((await eventHistory(ev.eventId)).length, historyBefore, 'aucune ligne d’historique');
    });

    test('route admin : permission events.write exigée (ADMIN en lecture seule et client refusés en 403)', async () => {
        const ev = await inStatus('permission', 'EN_ATTENTE');
        const reader = await newEventsAdmin('lecteur', ['events.read']);
        const r = await adminRoute(ev.eventId, reader, { to: 'VALIDE' });
        assert.equal(r.status, 403, `ADMIN sans events.write : ${show(r)}`);
        const client = await newBuyer('cycleroute');
        const r2 = await adminRoute(ev.eventId, client, { to: 'VALIDE' });
        assert.equal(r2.status, 403, `client sur la route admin : ${show(r2)}`);
        assert.equal(await eventStatus(ev.eventId), 'EN_ATTENTE', 'statut inchangé');
    });

    test('ancienne route /api/partner/events/[id]/status supprimée, plus aucun appel dans le code', () => {
        const old = path.join('app', 'api', 'partner', 'events', '[id]', 'status', 'route.ts');
        assert.equal(fs.existsSync(old), false, `${old} existe encore`);
        const offenders: string[] = [];
        for (const dir of ['app', 'components', 'lib', 'hooks']) {
            for (const file of sourceFiles(dir)) {
                const src = stripComments(fs.readFileSync(file, 'utf8'));
                if (/\/api\/partner\/events\/(?:\$\{[^}]+\}|\[id\]|[A-Za-z0-9_-]+)\/status\b/.test(src)) offenders.push(file.replace(/\\/g, '/'));
            }
        }
        assert.deepEqual(offenders, [], `appels de l’ancienne route /status :\n${offenders.join('\n')}`);
    });
});

// ── D2, D3 : garde du statut ───────────────────────────────────────────────

describe('5.2 Garde du statut (D3) et création (D2)', () => {
    test('UPDATE direct de events.status par le service_role refusé (EV422), même pour une transition de la table', async () => {
        const ev = await draft('garde');
        const historyBefore = (await eventHistory(ev.eventId)).length;
        const upd = await service.from('events').update({ status: 'EN_ATTENTE' }).eq('id', ev.eventId).select('id, status');
        assert.ok(upd.error, `UPDATE direct BROUILLON → EN_ATTENTE accepté : ${JSON.stringify(upd.data)}`);
        assert.equal(upd.error.code, 'EV422', `code ${upd.error.code} : ${upd.error.message}`);
        assert.match(upd.error.message, /transition/i, `message de la garde : ${upd.error.message}`);
        assert.equal(await eventStatus(ev.eventId), 'BROUILLON', 'statut inchangé');
        assert.equal((await eventHistory(ev.eventId)).length, historyBefore, 'aucune ligne d’historique');

        const pub = await inStatus('gardepub', 'PUBLIE');
        const upd2 = await service.from('events').update({ status: 'SUSPENDU' }).eq('id', pub.eventId).select('id');
        assert.equal(upd2.error?.code, 'EV422', `UPDATE direct PUBLIE → SUSPENDU : ${JSON.stringify(upd2)}`);
        assert.equal(await eventStatus(pub.eventId), 'PUBLIE');

        // Garde-fou (vert avant correctif) : la garde ne vise que le changement de statut.
        const other1 = await service.from('events').update({ title: `${pub.title} (modifié)` }).eq('id', pub.eventId).select('id');
        assert.equal(other1.error, null, `UPDATE d’une autre colonne : ${other1.error?.message}`);
        const same = await service.from('events').update({ status: 'PUBLIE' }).eq('id', pub.eventId).select('id');
        assert.equal(same.error, null, `UPDATE au même statut : ${same.error?.message}`);
    });

    test('une ligne d’historique écrite dans une autre transaction ne déverrouille pas la garde', async () => {
        const ev = await createDraftEvent(owner, 'forge', [], { startsInHours: 48 });
        try {
            const forged = await service.from('event_status_history').insert({
                event_id: ev.eventId, old_status: 'BROUILLON', new_status: 'EN_ATTENTE', actor_id: owner.userId, actor_role: 'PARTENAIRE', channel: 'TRANSITION',
            }).select('id');
            const upd = await service.from('events').update({ status: 'EN_ATTENTE' }).eq('id', ev.eventId).select('id');
            assert.equal(upd.error?.code, 'EV422',
                `UPDATE après une ligne forgée (insertion ${forged.error ? `refusée : ${forged.error.message}` : 'acceptée'}) : ${JSON.stringify(upd)}`);
            assert.equal(await eventStatus(ev.eventId), 'BROUILLON', 'statut inchangé');
        } finally {
            const del = await service.from('events').delete().eq('id', ev.eventId);
            assert.equal(del.error, null, `suppression du brouillon de test : ${del.error?.message}`);
        }
    });

    test('INSERT forcé à BROUILLON, avec la seule ligne NULL → BROUILLON (canal CREATION)', async () => {
        const date = new Date(Date.now() + 40 * 24 * 3600_000).toISOString().slice(0, 10);
        for (const status of ['PUBLIE', 'TERMINE'] as const) {
            const { data, error } = await service.from('events').insert({
                partner_id: owner.partnerId, title: `TEST Cycle insertion ${status} ${Date.now()}`, start_date: date, start_time: '20:00:00',
                location: 'Salle de test, Dakar', city: 'Dakar', status,
            }).select('id, status').single();
            assert.equal(error, null, `INSERT en ${status} : ${error?.message}`);
            assert.equal(data.status, 'BROUILLON', `INSERT demandé en ${status} : statut forcé à BROUILLON`);
            const rows = await eventHistory(data.id as string);
            assert.deepEqual(
                rows.map((r) => ({ old: r.old_status, next: r.new_status, channel: r.channel })),
                [{ old: null, next: 'BROUILLON', channel: 'CREATION' }],
                `historique de l’événement inséré en ${status}`,
            );
        }
    });
});

// ── D1 : historique en ajout seul ──────────────────────────────────────────

describe('5.2 Historique des statuts (event_status_history)', () => {
    test('ajout seul : UPDATE et DELETE refusés au service_role, lignes intactes', async () => {
        const ev = await inStatus('ajoutseul', 'EN_ATTENTE');
        const rows = await eventHistory(ev.eventId);
        const last = rows[rows.length - 1];
        const upd = await service.from('event_status_history').update({ reason: 'Motif falsifié' }).eq('id', last.id).select('id');
        assert.ok(upd.error, `UPDATE de l’historique accepté : ${JSON.stringify(upd.data)}`);
        const del = await service.from('event_status_history').delete().eq('id', last.id).select('id');
        assert.ok(del.error, `DELETE de l’historique accepté : ${JSON.stringify(del.data)}`);
        assert.deepEqual(await eventHistory(ev.eventId), rows, 'historique intact');
    });

    test('lecture : le partenaire propriétaire lit son historique, le partenaire B rien ; aucune écriture par l’API', async () => {
        const ev = await inStatus('lecturehist', 'EN_ATTENTE');
        const rows = await eventHistory(ev.eventId);
        const mine = await signedInClient(owner);
        const theirs = await signedInClient(other);
        try {
            const a = await mine.from('event_status_history').select('id').eq('event_id', ev.eventId);
            assert.equal(a.error, null, `lecture par le propriétaire : ${a.error?.message}`);
            assert.equal((a.data ?? []).length, rows.length, 'le propriétaire lit toutes les lignes');
            const b = await theirs.from('event_status_history').select('id').eq('event_id', ev.eventId);
            assert.equal(b.error, null, `lecture par le partenaire B : ${b.error?.message}`);
            assert.deepEqual(b.data ?? [], [], 'le partenaire B ne lit rien');
            const ins = await mine.from('event_status_history').insert({
                event_id: ev.eventId, old_status: 'EN_ATTENTE', new_status: 'VALIDE', actor_id: owner.userId, actor_role: 'ADMIN', channel: 'TRANSITION',
            }).select('id');
            assert.ok(ins.error, `écriture de l’historique par le partenaire acceptée : ${JSON.stringify(ins.data)}`);
        } finally {
            await disposeClients(mine, theirs);
        }
        assert.equal((await eventHistory(ev.eventId)).length, rows.length, 'historique inchangé');
    });

    test('suppression d’un brouillon : l’historique part en cascade', async () => {
        const ev = await createDraftEvent(owner, 'cascade', [], { startsInHours: 48 });
        assert.equal((await eventHistory(ev.eventId)).length, 1, 'ligne de création');
        const del = await service.from('events').delete().eq('id', ev.eventId);
        assert.equal(del.error, null, `suppression du brouillon : ${del.error?.message}`);
        assert.deepEqual(await eventHistory(ev.eventId), [], 'historique supprimé avec le brouillon');
    });
});

// ── D4 : notifications ─────────────────────────────────────────────────────

describe('5.2 Notifications au partenaire (route admin)', () => {
    test('refus avec motif, validation, suspension avec motif : acteur de la session journalisé, partenaire notifié', async () => {
        const ev = await inStatus('notif', 'EN_ATTENTE');
        const REFUS = `Programme incomplet, merci de le compléter (${Date.now()})`;
        const SUSPENSION = `Contrôle des autorisations en cours (${Date.now()})`;

        await flushEvent(ev);
        let seen = await notificationsOf(owner.userId);
        const r1 = await adminRoute(ev.eventId, admin, { to: 'BROUILLON', reason: REFUS });
        assert.equal(r1.status, 200, `refus par la route admin : ${show(r1)}`);
        const refusal = await lastHistory(ev.eventId);
        assert.deepEqual(
            { old: refusal.old_status, next: refusal.new_status, actor: refusal.actor_id, role: refusal.actor_role, reason: refusal.reason },
            { old: 'EN_ATTENTE', next: 'BROUILLON', actor: admin.userId, role: 'ADMIN', reason: REFUS },
            'refus journalisé avec l’ADMIN de la session et le motif',
        );
        await flushEvent(ev);
        let fresh = await freshNotifications(owner.userId, seen);
        assert.ok(fresh.some((n) => mentionsEvent(n, ev) && `${n.title} ${n.content}`.includes(REFUS)), `notification de refus avec le motif : ${JSON.stringify(fresh)}`);

        assertRpcOk(await rpcTransition(ev.eventId, owner.userId, 'EN_ATTENTE'), 'nouvelle soumission');
        await flushEvent(ev);
        seen = await notificationsOf(owner.userId);
        const r2 = await adminRoute(ev.eventId, admin, { to: 'VALIDE' });
        assert.equal(r2.status, 200, `validation par la route admin : ${show(r2)}`);
        await flushEvent(ev);
        fresh = await freshNotifications(owner.userId, seen);
        assert.ok(fresh.some((n) => mentionsEvent(n, ev)), `notification de validation : ${JSON.stringify(fresh)}`);

        assertRpcOk(await rpcTransition(ev.eventId, owner.userId, 'PUBLIE'), 'publication par le partenaire');
        await flushEvent(ev);
        seen = await notificationsOf(owner.userId);
        const r3 = await adminRoute(ev.eventId, admin, { to: 'SUSPENDU', reason: SUSPENSION });
        assert.equal(r3.status, 200, `suspension par la route admin : ${show(r3)}`);
        assert.equal((await lastHistory(ev.eventId)).reason, SUSPENSION, 'motif de suspension journalisé');
        await flushEvent(ev);
        fresh = await freshNotifications(owner.userId, seen);
        assert.ok(fresh.some((n) => mentionsEvent(n, ev) && `${n.title} ${n.content}`.includes(SUSPENSION)), `notification de suspension avec le motif : ${JSON.stringify(fresh)}`);
    });
});
