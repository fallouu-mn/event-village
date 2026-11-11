/**
 * Lot 5, tâche 5.4 — passage automatique à TERMINE (events-cdc-5). Contrat : sections D7 et U.
 *  - route GET|POST /api/cron/events-finish protégée par refuseUnlessCron : 401 sans secret ou avec un
 *    faux secret, sans aucun effet ;
 *  - events_finish_overdue({ limit }) passe en TERMINE, par la transition interne (acteur SYSTEM, canal
 *    CRON), chaque PUBLIE dont event_end_at < now(), et renvoie { ok, finished, ids } ; un second passage
 *    ne fait rien ; un PUBLIE à venir et un SUSPENDU passé ne sont pas touchés ;
 *  - fonction unique event_end_at(event_id) : end_date + end_time à Dakar, sinon début + 6 h (lot 9 bis, R16) ;
 *    fin_event_end, scan_window et ticket_sale_problems l'utilisent (un événement sans fin reste en vente
 *    jusqu'à début + 6 h si la fin de vente de la catégorie le permet) ;
 *  - après TERMINE, le scan et l'ouverture de caisse restent possibles jusqu'à event_end_at +
 *    access.scan_window_after_hours, et sont refusés ensuite.
 * Fuseau : Africa/Dakar = UTC+0 toute l'année. Lot 9 bis (T43, règles changées R16 et R42) : fin absente = début + 6 h,
 * plus de dépendance à minuit ; l'ouverture de caisse passe le PIN régisseur (aide openShift, A11).
 * Rouge avant correctif :
 *  - app/api/cron/events-finish/route.ts n'existe pas (app/api/cron : payments-reconcile,
 *    stock-reservations, referral-commissions, moratoriums, ticket-transfers) ; events_finish_overdue et
 *    event_end_at n'existent pas (grep vide dans supabase/migrations) ;
 *  - scan_event_problem renvoie event_ended pour tout TERMINE (supabase/migrations/20261101000010_lot4_scan.sql:102)
 *    et shift_open exige PUBLIE (supabase/migrations/20261101000011_lot4_caisse.sql:75) ;
 *  - ticket_sale_problems clôt la vente d'un événement sans fin à son heure de début
 *    (COALESCE(end_time, start_time, 23:59:59), supabase/migrations/20261031000014_lot2_controles_avant_debit.sql:49) ;
 *  - createEventInStatus échoue avant tout (RPC event_transition absente).
 * La suite crée son partenaire, ses contrôleurs, ses acheteurs et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants, finishOverdueEvents } from '../helpers/lifecycle-invariants';
import { cronRequest, importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import {
    assignController, newController, openShift, scan, scansOf, ticketPayload, ticketRow, withAccessSettings, type RouteResult,
} from './acces-helpers';
import {
    createEventInStatus, eventHistory, eventStatus, shiftEventDates, type AdvanceOptions, type DraftEvent, type DraftEventOptions, type EventStatus,
} from './cycle-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Record<string, unknown> }

const CRON_PATH = '/api/cron/events-finish';
const CATS: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 30 }];
const FREE: CategorySpec[] = [{ name: 'Entrée libre', price: 0, total: 30 }];
const WINDOW = { 'access.scan_window_before_hours': 6, 'access.scan_window_after_hours': 6 } as const;

let owner: TestPartner;
let holder: Buyer;

before(async () => {
    owner = await newPartner('cyclecron');
    holder = await newBuyer('cyclecron');
});

after(async () => {
    await assertLifecycleInvariants('cycle-cron');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function eventIn(label: string, target: EventStatus, opts: DraftEventOptions & AdvanceOptions = {}, categories: CategorySpec[] = CATS): Promise<DraftEvent> {
    return createEventInStatus(owner, label, categories, target, { startsInHours: 48, ...opts });
}

async function cronHandlers(): Promise<{ GET: Handler; POST: Handler }> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule('../../app/api/cron/events-finish/route');
    } catch (err) {
        assert.fail(`route ${CRON_PATH} absente (contrat D7) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.GET, 'function', `${CRON_PATH} : GET non exporté`);
    assert.equal(typeof mod.POST, 'function', `${CRON_PATH} : POST non exporté`);
    return { GET: mod.GET as Handler, POST: mod.POST as Handler };
}

async function read(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: Reply | RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

/** Passage du cron par la route, avec le secret : 200 et { ok: true, finished }. */
async function runCron(): Promise<Reply> {
    const { GET } = await cronHandlers();
    const r = await read(await GET(cronRequest(CRON_PATH)));
    assert.equal(r.status, 200, `cron ${CRON_PATH} : ${show(r)}`);
    assert.equal(r.body.ok, true, `cron : ok attendu, ${show(r)}`);
    assert.ok(Number.isInteger(Number(r.body.finished)) && Number(r.body.finished) >= 0, `cron : finished, ${show(r)}`);
    return r;
}

/**
 * Lot 9 bis (R16, T43, règle changée) : la fin d'un événement sans date de fin est début + 6 h (constante, B47), et non
 * plus start_date à 23:59. Les cas de la règle de fin ne dépendent donc plus de l'heure de la journée : l'attente du
 * passage de minuit (awayFromMidnight) et l'heure écoulée depuis minuit (hoursSinceDakarMidnight) sont retirées, sans
 * qu'aucune assertion ne disparaisse ; chaque fin attendue est recalculée depuis les colonnes écrites.
 * Nombre de lignes avant le test cité par docs/recette-billetterie.md (:176) gardé.
 */
const DEFAULT_END_HOURS = 6;

/** Début (Dakar) relu dans les colonnes écrites, plus `hours` heures : fin par défaut du lot 9 bis (R16). */
function startPlus(cols: { start_date: string; start_time: string }, hours: number = DEFAULT_END_HOURS): string {
    return new Date(Date.parse(`${cols.start_date}T${cols.start_time}Z`) + hours * 3600_000).toISOString();
}

/** Événement PUBLIE gratuit (catégorie « Entrée libre »), contrôleur affecté. */
async function freeEvent(label: string, controller: Buyer, canAcceptCash = false): Promise<DraftEvent> {
    const ev = await eventIn(label, 'PUBLIE', { startsInHours: 1 }, FREE);
    await assignController(owner, controller.userId, ev.eventId, canAcceptCash);
    return ev;
}

/** Billet gratuit VALIDE émis directement (comme free_tickets_claim, sans paiement). */
async function freeTicket(ev: DraftEvent): Promise<string> {
    const cat = ev.categories['Entrée libre'];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, price: 0, status: 'VALIDE',
        ticket_number: `TCK-CRON-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
    }).select('id').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', cat.id);
    assert.equal(uErr, null, `stock vendu : ${uErr?.message}`);
    return data.id as string;
}

async function openShiftsOf(userId: string, eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('controller_shifts').select('id, status').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

async function assertFinishedByCron(eventId: string, historyBefore: number, label: string): Promise<void> {
    assert.equal(await eventStatus(eventId), 'TERMINE', `${label} : TERMINE après le cron`);
    const rows = await eventHistory(eventId);
    assert.equal(rows.length, historyBefore + 1, `${label} : une ligne d’historique de plus`);
    const last = rows[rows.length - 1];
    assert.deepEqual(
        { old: last.old_status, next: last.new_status, actor: last.actor_id, role: last.actor_role, channel: last.channel },
        { old: 'PUBLIE', next: 'TERMINE', actor: null, role: 'SYSTEM', channel: 'CRON' },
        `${label} : PUBLIE → TERMINE par le système, canal CRON`,
    );
}

// ── Route ──────────────────────────────────────────────────────────────────

describe('5.4 Route /api/cron/events-finish', () => {
    test('refusée sans CRON_SECRET ou avec un faux secret (GET et POST), sans aucun effet', async () => {
        const ev = await eventIn('cron-refus', 'PUBLIE');
        await shiftEventDates(ev.eventId, { startsInHours: -5, durationHours: 2 });
        const { GET, POST } = await cronHandlers();
        for (const [method, h] of [['GET', GET], ['POST', POST]] as Array<[string, Handler]>) {
            const none = await read(await h(cronRequest(CRON_PATH, null)));
            assert.equal(none.status, 401, `${method} sans secret : ${show(none)}`);
            const wrong = await read(await h(cronRequest(CRON_PATH, 'faux-secret')));
            assert.equal(wrong.status, 401, `${method} avec un faux secret : ${show(wrong)}`);
        }
        assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'aucun passage à TERMINE sans secret');
    });

    test('PUBLIE dont la fin est passée → TERMINE, journalisé (SYSTEM, CRON) ; second passage sans effet ; ids rendus par la RPC', async () => {
        const ev = await eventIn('cron-retard', 'PUBLIE');
        await shiftEventDates(ev.eventId, { startsInHours: -5, durationHours: 2 });
        const historyBefore = (await eventHistory(ev.eventId)).length;
        const r = await runCron();
        assert.ok(Number(r.body.finished) >= 1, `au moins un événement terminé : ${show(r)}`);
        await assertFinishedByCron(ev.eventId, historyBefore, 'fini il y a 3 h');

        await runCron();
        assert.equal((await eventHistory(ev.eventId)).length, historyBefore + 1, 'second passage : aucune ligne de plus');
        assert.equal(await eventStatus(ev.eventId), 'TERMINE');

        const ev2 = await eventIn('cron-rpc', 'PUBLIE');
        await shiftEventDates(ev2.eventId, { startsInHours: -4, durationHours: 1 });
        const out = await finishOverdueEvents();
        assert.ok(out.ids.includes(ev2.eventId), `events_finish_overdue rend l’identifiant terminé : ${JSON.stringify(out)}`);
        assert.equal(await eventStatus(ev2.eventId), 'TERMINE');
    });
});

// ── Règle de fin ───────────────────────────────────────────────────────────

describe('5.4 Fin absente : début + 6 h Africa/Dakar (lot 9 bis, R16)', () => {
    test('sans fin, commencé il y a 8 h → TERMINE ; sans fin, commencé il y a 2 h → reste PUBLIE jusqu’à début + 6 h', async () => {
        const old = await eventIn('sansfin-8h', 'PUBLIE');
        const oCols = await shiftEventDates(old.eventId, { startsInHours: -8, durationHours: null });
        const recent = await eventIn('sansfin-2h', 'PUBLIE');
        const rCols = await shiftEventDates(recent.eventId, { startsInHours: -2, durationHours: null });
        const oHistory = (await eventHistory(old.eventId)).length;
        const rHistory = (await eventHistory(recent.eventId)).length;

        const ends = await inspect(async (db) => (await db.query<{ o: Date; r: Date }>(
            'SELECT public.event_end_at($1) AS o, public.event_end_at($2) AS r', [old.eventId, recent.eventId])).rows[0]);
        assert.equal(ends.o.toISOString(), startPlus(oCols), 'commencé il y a 8 h : fin = début + 6 h (passée depuis 2 h)');
        assert.equal(ends.r.toISOString(), startPlus(rCols), 'commencé il y a 2 h : fin = début + 6 h (dans 4 h)');

        await runCron();
        await assertFinishedByCron(old.eventId, oHistory, 'sans fin, commencé il y a 8 h');
        assert.equal(await eventStatus(recent.eventId), 'PUBLIE', 'sans fin, commencé il y a 2 h : encore PUBLIE avant début + 6 h');
        assert.equal((await eventHistory(recent.eventId)).length, rHistory, 'aucune ligne d’historique pour l’événement en cours');
    });

    test('le cron ne touche ni un PUBLIE à venir, ni un SUSPENDU passé', async () => {
        const future = await eventIn('cron-avenir', 'PUBLIE');
        const suspended = await eventIn('cron-susp', 'SUSPENDU', { suspendReason: 'Vérification en cours' });
        await shiftEventDates(suspended.eventId, { startsInHours: -8, durationHours: 2 });
        const fHistory = (await eventHistory(future.eventId)).length;
        const sHistory = (await eventHistory(suspended.eventId)).length;
        await runCron();
        assert.equal(await eventStatus(future.eventId), 'PUBLIE', 'PUBLIE à venir intact');
        assert.equal(await eventStatus(suspended.eventId), 'SUSPENDU', 'SUSPENDU passé non touché');
        assert.equal((await eventHistory(future.eventId)).length, fHistory);
        assert.equal((await eventHistory(suspended.eventId)).length, sHistory);
    });

    test('event_end_at unique : fin renseignée à Dakar, sinon début + 6 h ; fin_event_end et scan_window la reprennent', async () => {
        const withEnd = await eventIn('fin-renseignee', 'PUBLIE');
        const cols = await shiftEventDates(withEnd.eventId, { startsInHours: 48, durationHours: 3 });
        const noEnd = await eventIn('fin-absente', 'PUBLIE');
        const cols2 = await shiftEventDates(noEnd.eventId, { startsInHours: 48, durationHours: null });
        const rows = await inspect(async (db) => (await db.query<{ id: string; end_at: Date; fin: Date; closes: Date; after_h: string }>(
            `SELECT e.id::text AS id, public.event_end_at(e.id) AS end_at, public.fin_event_end(e.id) AS fin,
                    (SELECT w.closes_at FROM public.scan_window(e.id) w) AS closes,
                    public.fin_setting_num('access.scan_window_after_hours')::text AS after_h
               FROM public.events e WHERE e.id = ANY($1::uuid[])`, [[withEnd.eventId, noEnd.eventId]])).rows);
        const a = rows.find((r) => r.id === withEnd.eventId);
        const b = rows.find((r) => r.id === noEnd.eventId);
        assert.ok(a && b, `deux événements lus : ${JSON.stringify(rows)}`);
        assert.equal(a.end_at.toISOString(), `${cols.end_date}T${cols.end_time}.000Z`, 'fin renseignée : end_date + end_time à Dakar');
        assert.equal(b.end_at.toISOString(), startPlus(cols2), 'fin absente : début + 6 h à Dakar (R16)');
        for (const r of [a, b]) {
            assert.equal(r.fin.getTime(), r.end_at.getTime(), 'fin_event_end = event_end_at');
            assert.equal(r.closes.getTime(), r.end_at.getTime() + Number(r.after_h) * 3600_000, 'scan_window : fermeture = event_end_at + access.scan_window_after_hours');
        }
    });

    test('même règle que ticket_sale_problems : un événement sans fin reste en vente jusqu’à début + 6 h si la fin de vente le permet, plus après', async () => {
        const closed = new Date(Date.now() - 3600_000).toISOString();
        const ev = await eventIn('vente-6h', 'PUBLIE', {}, [
            { name: 'Standard', price: 5000, total: 20 },
            { name: 'Close', price: 5000, total: 20, saleEnd: closed },
        ]);
        await shiftEventDates(ev.eventId, { startsInHours: -1, durationHours: null });
        const late = await eventIn('vente-7h', 'PUBLIE');
        await shiftEventDates(late.eventId, { startsInHours: -7, durationHours: null });
        const items = (e: DraftEvent, category: string) => JSON.stringify([{ category_id: e.categories[category].id, quantity: 1 }]);
        const problems = await inspect(async (db) => {
            const q = 'SELECT public.ticket_sale_problems($1, $2::jsonb) AS p';
            const std = (await db.query<{ p: Array<{ code: string }> }>(q, [ev.eventId, items(ev, 'Standard')])).rows[0].p;
            const close = (await db.query<{ p: Array<{ code: string }> }>(q, [ev.eventId, items(ev, 'Close')])).rows[0].p;
            const after6 = (await db.query<{ p: Array<{ code: string }> }>(q, [late.eventId, items(late, 'Standard')])).rows[0].p;
            return { std, close, after6 };
        });
        assert.deepEqual(problems.std, [], `commencé il y a une heure, sans fin : vente ouverte jusqu’à début + 6 h, reçu ${JSON.stringify(problems.std)}`);
        // Garde-fou (vert avant correctif) : la fin de vente de la catégorie s'applique toujours.
        assert.ok(problems.close.some((x) => x.code === 'SALE_CLOSED'), `catégorie dont la vente est close : SALE_CLOSED, reçu ${JSON.stringify(problems.close)}`);
        assert.ok(!problems.close.some((x) => x.code === 'EVENT_PAST'), `pas d’EVENT_PAST avant début + 6 h : ${JSON.stringify(problems.close)}`);
        assert.ok(problems.after6.some((x) => x.code === 'EVENT_PAST'),
            `commencé il y a 7 h, sans fin : fin (début + 6 h) passée, EVENT_PAST attendu (avant le correctif : ouvert jusqu’à 23:59 si le début est du jour), reçu ${JSON.stringify(problems.after6)}`);

        const buyer = await newBuyer('cron-6h');
        const purchase = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        assert.equal(purchase.tickets.length, 1, 'achat en ligne confirmé : un billet');
    });
});

// ── Scan et caisse après TERMINE ───────────────────────────────────────────

describe('5.4 Après TERMINE : scan et caisse dans la fenêtre seulement', () => {
    test('scan accepté en TERMINE dans la fenêtre (fin + access.scan_window_after_hours), refusé après', async () => {
        await withAccessSettings(WINDOW, async () => {
            const controller = await newController(owner, null, { label: 'cronscan' });
            const inWindow = await freeEvent('scan-fenetre', controller);
            await shiftEventDates(inWindow.eventId, { startsInHours: -6, durationHours: 4 });
            const late = await freeEvent('scan-tard', controller);
            await shiftEventDates(late.eventId, { startsInHours: -11, durationHours: 4 });
            const t1 = await freeTicket(inWindow);
            const t2 = await freeTicket(late);
            await runCron();
            assert.equal(await eventStatus(inWindow.eventId), 'TERMINE', 'fini il y a 2 h : TERMINE');
            assert.equal(await eventStatus(late.eventId), 'TERMINE', 'fini il y a 7 h : TERMINE');

            const ok = await scan(controller, { eventId: inWindow.eventId, payload: await ticketPayload(t1) });
            assert.equal(ok.status, 200, `scan dans la fenêtre : ${show(ok)}`);
            assert.equal(ok.body.result, 'valid', `TERMINE fini il y a 2 h, fenêtre de 6 h : entrée acceptée, ${show(ok)}`);
            assert.equal((await ticketRow(t1)).status, 'UTILISE', 'billet composté');

            const ko = await scan(controller, { eventId: late.eventId, payload: await ticketPayload(t2) });
            assert.equal(ko.status, 200, `scan après la fenêtre : ${show(ko)}`);
            assert.equal(ko.body.result, 'event_ended', `TERMINE fini il y a 7 h : event_ended, ${show(ko)}`);
            assert.equal((await ticketRow(t2)).status, 'VALIDE', 'billet non composté');
            assert.deepEqual((await scansOf(t2)).filter((s) => s.accepted === true), [], 'aucun scan accepté');
        });
    });

    test('ouverture de caisse en TERMINE dans la fenêtre, refusée après', async () => {
        await withAccessSettings(WINDOW, async () => {
            const cashier = await newController(owner, null, { label: 'croncaisse' });
            const inWindow = await freeEvent('caisse-fenetre', cashier, true);
            await shiftEventDates(inWindow.eventId, { startsInHours: -6, durationHours: 4 });
            const late = await freeEvent('caisse-tard', cashier, true);
            await shiftEventDates(late.eventId, { startsInHours: -11, durationHours: 4 });
            await runCron();
            assert.equal(await eventStatus(inWindow.eventId), 'TERMINE');
            assert.equal(await eventStatus(late.eventId), 'TERMINE');

            const opened = await openShift(cashier, inWindow.eventId);
            assert.equal(opened.status, 200, `ouverture de caisse en TERMINE dans la fenêtre : ${show(opened)}`);
            assert.equal((await openShiftsOf(cashier.userId, inWindow.eventId)).length, 1, 'une caisse OUVERT');

            const refused = await openShift(cashier, late.eventId);
            assert.notEqual(refused.status, 200, `ouverture de caisse après la fenêtre : ${show(refused)}`);
            assert.ok(refused.status < 500, `refus métier, pas une erreur serveur : ${show(refused)}`);
            assert.deepEqual(await openShiftsOf(cashier.userId, late.eventId), [], 'aucune caisse ouverte après la fenêtre');
        });
    });
});
