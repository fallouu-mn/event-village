/**
 * Lot 9 ter, tâche 9t.12 a (consigne 0.8, R106 a ; contrat 5.B 9t.12 (a), B.2.3 (1), (3) F18, (4) F19, (6), (7), (8),
 * 4.2 B.3, décision B-D21) — un événement VALIDE jamais publié passe à TERMINE à sa fin, par le cron, sans message au
 * public : colonne events.ended_unpublished posée par le cron seul, transition VALIDE → TERMINE (SYSTEM, CRON). Un tel
 * événement reste invisible du public (fiche 404, politique events_read_public, vue events_public_status, résumés
 * publics, Realtime) et n'est pas scannable (scan_event_problem : event_not_open), alors qu'il porte des invitations.
 *
 * Montage : partenaire neuve ; événement VALIDE avec deux invitations (route des invitations : un compte, un numéro sans
 * compte) et un contrôleur affecté ; dates déplacées par shiftEventDates (fin il y a 2 h) ; cron par
 * finishOverdueEvents (RPC events_finish_overdue du service_role, comme /api/cron/events-finish). Lecture anon par la clé
 * anon seule ; Realtime par un client anon (sentinelle PUBLIE terminée dans le même passage).
 *
 * Rouge avant correctif (S-E fix(9t.12), M07 ; délégué S-K fix(9t.12-SK), M11 ; E-B app/admin/events/[id]/page.tsx) :
 * le cron ne prend que PUBLIE (M/20261102000003:844), aucune transition VALIDE → TERMINE : l'événement reste VALIDE
 * (cas 1, 2, 4, 6 : précondition TERMINE) ; colonne ended_unpublished absente ; isPublic de la fiche admin ne la lit pas
 * (cas 7). Témoins du cas 5 verts aujourd'hui. after() : assertLot9terInvariants (x6, x7).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { finishOverdueEvents } from '../helpers/lifecycle-invariants';
import { anonClient, disposeClients, expectNothing, expectSome, subscribeCollect } from '../helpers/realtime';
import { randomSenegalPhone, routeContext } from './helpers';
import { eventTickets, importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { authed, newController, scan, scansOf, ticketPayload, ticketRow, withAccessSettings } from './acces-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, eventHistory, eventStatus, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const PUBLIC_ROUTE = '../../app/api/events/[id]/route';
const WINDOW = { 'access.scan_window_before_hours': 6, 'access.scan_window_after_hours': 6 } as const;
const ENDED_2H = { startsInHours: -6, durationHours: 4 } as const;

let partner: TestPartner;
let controller: Buyer;
let main: DraftEvent;
let cronIds: string[] = [];
let outboxBefore: string[] = [];
const clients: SupabaseClient[] = [];

async function invite(ev: DraftEvent, phone: string): Promise<void> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations');
    const res = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner,
        { category_id: ev.categories.Standard.id, phones: [phone], quantity: 1 }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `invitation : ${show(res)}`);
}

/** Événement VALIDE jamais publié, avec une invitation à un compte et une à un numéro sans compte, fini il y a 2 h. */
async function endedValidated(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, CATEGORIES, { startsInHours: 72 });
    await advanceEventTo(ev.eventId, 'VALIDE');
    await invite(ev, (await newBuyer(`${label}-invite`)).phoneE164);
    await invite(ev, randomSenegalPhone('76'));
    await shiftEventDates(ev.eventId, ENDED_2H);
    return ev;
}

async function outboxIdsOf(eventId: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('id').eq('event_id', eventId);
    assert.equal(error, null, `boîte d'envoi de l'événement : ${error?.message}`);
    return (data ?? []).map((r) => String(r.id)).sort();
}

async function eventFlags(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('status, ended_unpublished').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} (colonne ended_unpublished, migration 20261110000007) : ${error?.message}`);
    return data as Row;
}

async function publicSheet(eventId: string): Promise<{ status: number; body: Row }> {
    const handler = await routeHandler(PUBLIC_ROUTE, 'GET', 'GET /api/events/[id]');
    const params = { id: eventId };
    return invoke(handler, jsonRequest(`/api/events/${eventId}`, 'GET', null), { params: Object.assign(Promise.resolve(params), params) });
}

before(async () => {
    partner = await newPartner('fin-valide');
    main = await createDraftEvent(partner, 'fin-valide', CATEGORIES, { startsInHours: 72 });
    await advanceEventTo(main.eventId, 'VALIDE');
    await invite(main, (await newBuyer('fin-valide-invite')).phoneE164);
    await invite(main, randomSenegalPhone('76'));
    controller = await newController(partner, main.eventId, { label: 'fin-valide' });
    await shiftEventDates(main.eventId, ENDED_2H);
    outboxBefore = await outboxIdsOf(main.eventId);
    cronIds = (await finishOverdueEvents()).ids;
});

after(async () => {
    await disposeClients(...clients);
    await assertLot9terInvariants('evenements-fin-valide');
});

describe('9t.12 a (R106) : VALIDE jamais publié → TERMINE à sa fin', () => {
    test('VALIDE jamais publié fini depuis 2 h : TERMINE au cron, ended_unpublished, historique VALIDE → TERMINE (SYSTEM, CRON)', async () => {
        assert.ok(cronIds.includes(main.eventId), `le cron prend l'événement VALIDE fini (aujourd'hui PUBLIE seulement) : ${cronIds.length} id(s)`);
        assert.deepEqual(await eventFlags(main.eventId), { status: 'TERMINE', ended_unpublished: true }, 'TERMINE, terminé sans publication');
        const steps = (await eventHistory(main.eventId)).filter((h) => h.old_status === 'VALIDE' && h.new_status === 'TERMINE');
        assert.equal(steps.length, 1, 'une ligne d\'historique VALIDE → TERMINE');
        assert.deepEqual([steps[0].actor_role, steps[0].channel], ['SYSTEM', 'CRON']);
    });

    test('aucun message : le passage ne met rien en file pour cet événement', async () => {
        assert.equal(await eventStatus(main.eventId), 'TERMINE', 'précondition : TERMINE par le cron');
        assert.deepEqual(await outboxIdsOf(main.eventId), outboxBefore, 'aucune ligne nouvelle dans la boîte d\'envoi');
    });

    test('invisible du public : fiche 404, statut public NOT_PUBLIC, events illisible par anon, vue sans la ligne, aucun résumé public', async () => {
        assert.equal(await eventStatus(main.eventId), 'TERMINE', 'précondition : TERMINE par le cron');
        const sheet = await publicSheet(main.eventId);
        assert.equal(sheet.status, 404, `fiche publique : ${JSON.stringify(sheet.body).slice(0, 300)}`);
        const ps = (await importModule('../../lib/events/public-status')) as { readPublicEventStatus: (id: string) => Promise<string> };
        assert.equal(await ps.readPublicEventStatus(main.eventId), 'NOT_PUBLIC');
        const anon = anonClient();
        const { data: seen, error } = await anon.from('events').select('id').eq('id', main.eventId);
        assert.equal(error, null, `lecture anon : ${error?.message}`);
        assert.deepEqual(seen, [], 'events illisible par anon (events_read_public)');
        const { data: view, error: viewErr } = await service.from('events_public_status').select('id').eq('id', main.eventId);
        assert.equal(viewErr, null, viewErr?.message);
        assert.deepEqual(view, [], 'events_public_status sans la ligne');
        const { data: summary, error: sumErr } = await service.from('public_event_state').select('event_id').eq('event_id', main.eventId);
        assert.equal(sumErr, null, sumErr?.message);
        assert.deepEqual(summary, [], 'aucun résumé public de l\'événement');
        const { data: stock, error: stockErr } = await service.from('public_category_stock').select('event_id').eq('event_id', main.eventId);
        assert.equal(stockErr, null, stockErr?.message);
        assert.deepEqual(stock, [], 'aucune tranche publique de ses catégories');
    });

    test('non scannable : le billet d\'invitation est refusé event_not_open, rien composté', async () => {
        assert.equal(await eventStatus(main.eventId), 'TERMINE', 'précondition : TERMINE par le cron (dans la fenêtre de contrôle)');
        const tickets = await eventTickets(main.eventId);
        assert.ok(tickets.length >= 1, 'billets d\'invitation');
        const ticketId = String(tickets[0].id);
        await withAccessSettings(WINDOW, async () => {
            const res = await scan(controller, { eventId: main.eventId, payload: await ticketPayload(ticketId) });
            assert.equal(res.status, 200, show(res));
            assert.equal(res.body.result, 'event_not_open', `terminé sans publication : jamais scannable : ${show(res)}`);
        });
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet non composté');
        assert.deepEqual((await scansOf(ticketId)).filter((s) => s.accepted === true), [], 'aucun scan accepté');
    });

    test('Realtime : la sentinelle PUBLIE terminée dans le même passage est diffusée, l\'événement VALIDE terminé ne l\'est pas', async () => {
        const sentinel = await createEventInStatus(partner, 'fin-sentinelle', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const hidden = await endedValidated('fin-cache');
        await shiftEventDates(sentinel.eventId, ENDED_2H);
        const anon = anonClient();
        clients.push(anon);
        const seen = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${sentinel.eventId}` }, { label: 'anon, sentinelle' });
        const silent = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${hidden.eventId}` }, { label: 'anon, VALIDE terminé' });
        await Promise.all([seen.ready, silent.ready]);
        const ids = (await finishOverdueEvents()).ids;
        assert.ok(ids.includes(sentinel.eventId), 'sentinelle terminée par le passage');
        assert.ok(ids.includes(hidden.eventId), `VALIDE terminé par le même passage (aujourd'hui ignoré)`);
        await expectSome(seen, (e) => e.new.event_id === sentinel.eventId, undefined, 'diffusion de la sentinelle');
        await expectNothing(silent, 3_000, () => true, 'aucune diffusion d\'un événement terminé sans publication');
    });

    test('témoins : VALIDE à venir intact ; PUBLIE fini → TERMINE public ; SUSPENDU fini intact', async () => {
        const upcoming = await createEventInStatus(partner, 'fin-avenir', CATEGORIES, 'VALIDE', { startsInHours: 72 });
        const published = await createEventInStatus(partner, 'fin-publie', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const suspended = await createEventInStatus(partner, 'fin-suspendu', CATEGORIES, 'SUSPENDU', { startsInHours: 72, suspendReason: 'Test 9 ter, suspendu' });
        await shiftEventDates(published.eventId, ENDED_2H);
        await shiftEventDates(suspended.eventId, ENDED_2H);
        await finishOverdueEvents();
        assert.equal(await eventStatus(upcoming.eventId), 'VALIDE', 'VALIDE à venir intact');
        assert.equal(await eventStatus(suspended.eventId), 'SUSPENDU', 'SUSPENDU fini intact');
        assert.equal(await eventStatus(published.eventId), 'TERMINE', 'PUBLIE fini : TERMINE');
        const sheet = await publicSheet(published.eventId);
        assert.equal(sheet.status, 200, `PUBLIE terminé : fiche publique : ${JSON.stringify(sheet.body).slice(0, 300)}`);
        assert.equal((sheet.body.event as Row).status, 'TERMINE', 'fiche : statut TERMINE');
    });

    test('deux crons en même temps : une seule ligne d\'historique VALIDE → TERMINE', async () => {
        const ev = await endedValidated('fin-course');
        const call = async (): Promise<string[]> => {
            const { data, error } = await service.rpc('events_finish_overdue', { p: { limit: 1000 } });
            assert.equal(error, null, `events_finish_overdue : ${error?.message}`);
            const body = (data ?? {}) as Row;
            assert.equal(body.ok, true, JSON.stringify(body));
            return (body.ids as unknown[]).map(String);
        };
        const [a, b] = await Promise.all([call(), call()]);
        assert.equal([...a, ...b].filter((id) => id === ev.eventId).length, 1, 'l\'événement apparaît dans un seul passage');
        const steps = (await eventHistory(ev.eventId)).filter((h) => h.old_status === 'VALIDE' && h.new_status === 'TERMINE');
        assert.equal(steps.length, 1, 'une seule ligne VALIDE → TERMINE');
    });

    test('admin : pas de lien vers la page publique d\'un événement terminé sans publication (isPublic lit ended_unpublished)', () => {
        const src = fs.readFileSync(path.join(ROOT, 'app/admin/events/[id]/page.tsx'), 'utf8');
        const decl = /\bconst\s+isPublic\s*=([^;]*);/.exec(src);
        assert.ok(decl, 'déclaration de isPublic');
        assert.match(decl[1], /\bended_unpublished\b/, `isPublic exige ended_unpublished !== true (B.5 point 10) : ${decl[1].trim()}`);
    });
});
