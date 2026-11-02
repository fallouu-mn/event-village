/**
 * Lot 6, tâche 6.0 b — suppression d'un événement refusée en base hors brouillon (contrat A2, S2 groupe Dette).
 *  - service_role : DELETE d'un événement PUBLIE sans vente, VALIDE, EN_ATTENTE, SUSPENDU, ANNULE et TERMINE →
 *    refus EV423 (message exact du trigger events_delete_guard), événement, historique des statuts et ligne
 *    event_cancellations intacts (plus aucune cascade) ;
 *  - brouillon soumis puis refusé par l'admin (historique au-delà de la ligne CREATION) → EV423 (second
 *    message du trigger), historique conservé ;
 *  - garde-fou (vert aujourd'hui) : un brouillon neuf (seule la ligne CREATION) reste supprimable par le
 *    service_role et par la route, son historique part avec lui ;
 *  - TRUNCATE public.events refusé (EV423, trigger events_truncate_guard), essayé par connexion directe dans
 *    une transaction toujours annulée. TRUNCATE sans CASCADE échoue déjà sur les clés étrangères avant tout
 *    trigger (PostgreSQL vérifie les références avant les triggers BEFORE TRUNCATE) : seul TRUNCATE … CASCADE
 *    atteint le trigger, et la transaction annulée ne laisse rien ;
 *  - route DELETE /api/partner/events/[id] : 409 { code: 'EVENT_NOT_DELETABLE', error: <message du trigger> }
 *    pour un événement publié et pour un brouillon refusé ; 200 pour un brouillon neuf.
 *
 * Rouge avant correctif :
 *  - aucun trigger DELETE ni TRUNCATE sur events (triggers existants : force_draft, log_creation,
 *    status_guard, public_summary_sync, updated_at ; discovery-6-temps-reel-rls.md §2.2) : le service_role
 *    supprime l'événement et l'historique part en cascade (event_status_history ON DELETE CASCADE,
 *    20261102000003_lot5_cycle.sql:78 ; event_cancellations CASCADE, 20260910000001_…:20) ;
 *  - TRUNCATE … CASCADE est accepté (puis annulé par la transaction du test) ;
 *  - la route répond 400 « Seuls les événements en statut BROUILLON… » pour un événement publié
 *    (lib/events/event.service.ts:436-438, app/api/partner/events/[id]/route.ts:94-97) et supprime le
 *    brouillon refusé (200).
 * Fin de suite : assertNotificationInvariants (contrat Conventions) ; avant le correctif 6.1, elle échoue en
 * nommant la boîte d'envoi absente.
 * La suite crée son partenaire et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { inRolledBackTransaction } from '../helpers/db';
import { assertNotificationInvariants } from './notif-helpers';
import { importModule, service, type CategorySpec } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, type RouteResult } from './acces-helpers';
import {
    advanceEventTo, assertRpcOk, createDraftEvent, createEventInStatus, eventHistory, eventStatus, rpcTransition,
    type EventHistoryRow, type EventStatus,
} from './cycle-helpers';
import { routeContext } from './helpers';

/** Messages exacts du contrat A2. */
const OUT_OF_DRAFT = 'Un événement sorti du brouillon ne peut pas être supprimé : annulez-le ou laissez-le se terminer.';
const SUBMITTED_DRAFT = 'Ce brouillon a déjà été soumis : son historique est conservé, il ne peut pas être supprimé.';
const TRUNCATE_REFUSED = 'La table des événements ne se vide pas.';
const DELETE_REFUSED_CODE = 'EV423';

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3000, total: 20 }];
const PARTNER_EVENT_ROUTE = '../../app/api/partner/events/[id]/route';

let owner: TestPartner;

before(async () => {
    owner = await newPartner('dette-suppression');
});

after(async () => {
    await assertNotificationInvariants('dette-suppression-evenement');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface EventSnapshot {
    status: string;
    history: EventHistoryRow[];
    cancellations: Row[];
    categories: number;
}

/** État de l'événement et de ce qu'une cascade emporterait ; null si l'événement n'existe plus. */
async function snapshot(eventId: string): Promise<EventSnapshot | null> {
    const { data: ev, error } = await service.from('events').select('id, status').eq('id', eventId).maybeSingle();
    assert.equal(error, null, `lecture de l'événement ${eventId} : ${error?.message}`);
    if (!ev) return null;
    const { data: cancellations, error: cErr } = await service.from('event_cancellations').select('id, event_id, cancelled_at, internal_reason').eq('event_id', eventId);
    assert.equal(cErr, null, `annulations de l'événement ${eventId} : ${cErr?.message}`);
    const { data: cats, error: catErr } = await service.from('ticket_categories').select('id').eq('event_id', eventId);
    assert.equal(catErr, null, `catégories de l'événement ${eventId} : ${catErr?.message}`);
    return {
        status: String(ev.status),
        history: await eventHistory(eventId),
        cancellations: (cancellations ?? []) as Row[],
        categories: (cats ?? []).length,
    };
}

async function serviceDelete(eventId: string): Promise<{ error: { code: string; message: string } | null; deleted: number }> {
    const { data, error } = await service.from('events').delete().eq('id', eventId).select('id');
    return { error: error ? { code: error.code, message: error.message } : null, deleted: (data ?? []).length };
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body)}`;
}

async function deleteByRoute(eventId: string): Promise<RouteResult> {
    const { DELETE } = await importModule(PARTNER_EVENT_ROUTE);
    return invoke(DELETE as Handler, authed(`/api/partner/events/${eventId}`, 'DELETE', owner), routeContext({ id: eventId }));
}

/** Refus attendu du trigger : l'événement est toujours là, avec exactement le même historique et la même annulation. */
function assertRefusedAndIntact(
    what: string,
    res: { error: { code: string; message: string } | null; deleted: number },
    prior: EventSnapshot,
    later: EventSnapshot | null,
    message: string,
): void {
    assert.ok(later, `${what} : événement SUPPRIMÉ (historique de ${prior.history.length} ligne(s), ${prior.cancellations.length} annulation(s) et ${prior.categories} catégorie(s) emportés par cascade) — erreur ${JSON.stringify(res.error)}, ${res.deleted} ligne(s) supprimée(s)`);
    assert.ok(res.error, `${what} : aucune erreur renvoyée par la base`);
    assert.equal(res.error.code, DELETE_REFUSED_CODE, `${what} : code ${res.error.code} (${res.error.message}), attendu ${DELETE_REFUSED_CODE}`);
    assert.equal(res.error.message, message, `${what} : message du trigger`);
    assert.equal(res.deleted, 0, `${what} : lignes supprimées`);
    assert.equal(later.status, prior.status, `${what} : statut changé`);
    assert.deepEqual(later.history.map((h) => h.id), prior.history.map((h) => h.id), `${what} : historique des statuts modifié`);
    assert.deepEqual(later.cancellations, prior.cancellations, `${what} : ligne event_cancellations modifiée`);
    assert.equal(later.categories, prior.categories, `${what} : catégories supprimées`);
}

/** Brouillon soumis par le partenaire puis refusé par l'admin (EN_ATTENTE → BROUILLON, motif). */
async function refusedDraft(label: string): Promise<string> {
    const draft = await createDraftEvent(owner, label, CATEGORIES, { startsInHours: 72 });
    await advanceEventTo(draft.eventId, 'EN_ATTENTE', { partnerUserId: owner.userId });
    assertRpcOk(await rpcTransition(draft.eventId, await superadminId(), 'BROUILLON', 'Affiche illisible : refus de test du lot 6'),
        `refus du brouillon ${draft.eventId} par l'admin`);
    assert.equal(await eventStatus(draft.eventId), 'BROUILLON', 'précondition : brouillon refusé');
    const history = await eventHistory(draft.eventId);
    assert.deepEqual(history.map((h) => `${h.old_status ?? '∅'}→${h.new_status}:${h.channel}`),
        ['∅→BROUILLON:CREATION', 'BROUILLON→EN_ATTENTE:TRANSITION', 'EN_ATTENTE→BROUILLON:TRANSITION'],
        'précondition : historique de création, soumission et refus');
    return draft.eventId;
}

// ── Service_role ───────────────────────────────────────────────────────────

describe('6.0 b — DELETE par le service_role refusé hors brouillon (trigger events_delete_guard, EV423)', () => {
    const statuses: EventStatus[] = ['PUBLIE', 'VALIDE', 'EN_ATTENTE', 'SUSPENDU', 'ANNULE', 'TERMINE'];
    for (const target of statuses) {
        test(`événement ${target} sans vente : DELETE refusé (EV423), historique${target === 'ANNULE' ? ' et annulation' : ''} intacts`, async () => {
            const ev = await createEventInStatus(owner, `suppr-${target.toLowerCase()}`, CATEGORIES, target, {
                startsInHours: 72,
                ...(target === 'TERMINE' ? { finishShift: { startsInHours: -3, durationHours: 1 } } : {}),
            });
            const prior = await snapshot(ev.eventId);
            assert.ok(prior, 'précondition : événement créé');
            assert.equal(prior.status, target, `précondition : statut ${prior.status}`);
            assert.ok(prior.history.length >= 2, `précondition : historique au-delà de la création (${prior.history.length} ligne(s))`);
            if (target === 'ANNULE') assert.equal(prior.cancellations.length, 1, 'précondition : une ligne event_cancellations');

            const res = await serviceDelete(ev.eventId);
            assertRefusedAndIntact(`DELETE service_role d'un événement ${target}`, res, prior, await snapshot(ev.eventId), OUT_OF_DRAFT);
        });
    }

    test('brouillon soumis puis refusé : DELETE refusé (EV423, historique conservé)', async () => {
        const eventId = await refusedDraft('suppr-refuse');
        const prior = await snapshot(eventId);
        assert.ok(prior, 'précondition : brouillon refusé présent');
        const res = await serviceDelete(eventId);
        assertRefusedAndIntact('DELETE service_role d’un brouillon refusé', res, prior, await snapshot(eventId), SUBMITTED_DRAFT);
    });

    test('garde-fou : un brouillon neuf (seule la ligne CREATION) reste supprimable, son historique et ses catégories partent avec lui', async () => {
        const draft = await createDraftEvent(owner, 'suppr-neuf', CATEGORIES, { startsInHours: 72 });
        const prior = await snapshot(draft.eventId);
        assert.ok(prior, 'précondition : brouillon créé');
        assert.deepEqual(prior.history.map((h) => h.channel), ['CREATION'], 'précondition : seule la ligne de création');
        const res = await serviceDelete(draft.eventId);
        assert.equal(res.error, null, `suppression du brouillon neuf : ${JSON.stringify(res.error)}`);
        assert.equal(res.deleted, 1, 'une ligne supprimée');
        assert.equal(await snapshot(draft.eventId), null, 'brouillon toujours présent');
        assert.deepEqual(await eventHistory(draft.eventId), [], 'historique du brouillon neuf supprimé avec lui');
    });
});

// ── TRUNCATE ───────────────────────────────────────────────────────────────

describe('6.0 b — TRUNCATE de events refusé (trigger events_truncate_guard)', () => {
    test('TRUNCATE public.events CASCADE (transaction annulée) → EV423 « La table des événements ne se vide pas. »', async () => {
        const outcome = await inRolledBackTransaction(async (db) => {
            await db.query("SET LOCAL lock_timeout = '10s'");
            try {
                await db.query('TRUNCATE public.events CASCADE');
                return { accepted: true, code: null as string | null, message: null as string | null };
            } catch (err) {
                const e = err as { code?: string; message?: string };
                return { accepted: false, code: e.code ?? null, message: e.message ?? null };
            }
        });
        assert.equal(outcome.accepted, false, 'TRUNCATE public.events CASCADE accepté (annulé par la transaction du test) : aucun trigger BEFORE TRUNCATE');
        assert.equal(outcome.code, DELETE_REFUSED_CODE, `TRUNCATE refusé avec le code ${outcome.code} (${outcome.message}), attendu ${DELETE_REFUSED_CODE}`);
        assert.equal(outcome.message, TRUNCATE_REFUSED, 'message du trigger events_truncate_guard');
    });
});

// ── Route du partenaire ────────────────────────────────────────────────────

describe('6.0 b — DELETE /api/partner/events/[id] : 409 EVENT_NOT_DELETABLE hors brouillon neuf', () => {
    test('événement PUBLIE : 409 EVENT_NOT_DELETABLE avec le message du trigger, événement et historique intacts', async () => {
        const ev = await createEventInStatus(owner, 'suppr-route-publie', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const prior = await snapshot(ev.eventId);
        assert.ok(prior, 'précondition : événement publié');
        const res = await deleteByRoute(ev.eventId);
        const later = await snapshot(ev.eventId);
        assert.ok(later, `événement publié supprimé par la route (${show(res)})`);
        assert.equal(res.status, 409, show(res));
        assert.equal(res.body.code, 'EVENT_NOT_DELETABLE', show(res));
        assert.equal(res.body.error, OUT_OF_DRAFT, show(res));
        assert.deepEqual(later.history.map((h) => h.id), prior.history.map((h) => h.id), 'historique modifié');
    });

    test('brouillon refusé : 409 EVENT_NOT_DELETABLE avec le second message du trigger, historique conservé', async () => {
        const eventId = await refusedDraft('suppr-route-refuse');
        const prior = await snapshot(eventId);
        assert.ok(prior, 'précondition : brouillon refusé présent');
        const res = await deleteByRoute(eventId);
        const later = await snapshot(eventId);
        assert.ok(later, `brouillon refusé supprimé par la route, historique de ${prior.history.length} ligne(s) perdu (${show(res)})`);
        assert.equal(res.status, 409, show(res));
        assert.equal(res.body.code, 'EVENT_NOT_DELETABLE', show(res));
        assert.equal(res.body.error, SUBMITTED_DRAFT, show(res));
        assert.deepEqual(later.history.map((h) => h.id), prior.history.map((h) => h.id), 'historique modifié');
    });

    test('garde-fou : brouillon neuf supprimé par la route (200), plus rien en base', async () => {
        const draft = await createDraftEvent(owner, 'suppr-route-neuf', CATEGORIES, { startsInHours: 72 });
        const res = await deleteByRoute(draft.eventId);
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.success, true, show(res));
        assert.equal(await snapshot(draft.eventId), null, 'brouillon neuf toujours présent après la route');
        assert.deepEqual(await eventHistory(draft.eventId), [], 'historique du brouillon neuf supprimé avec lui');
    });
});
