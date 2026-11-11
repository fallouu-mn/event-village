/**
 * Lot 9 bis, tâche 22 (R17, R43, R42 ; contrat 5.22, 4.3, B49, B50, B51, 11.1 N8) — caisses :
 *  1. R17 : une caisse ouverte reste visible au contrôleur dont le droit d'encaisser est retiré (`open_shift` par
 *     affectation dans GET /api/controller/assignments ; onglet Caisse du scanner conditionné à `open_shift`).
 *  2. R17 : la partenaire et l'admin `events.write` ferment une caisse depuis l'onglet Caisse du pilotage (CashTab :
 *     « Fermer cette caisse », CloseShiftModal) ; un admin sans `events.write` est refusé (403 PERMISSION_MISSING).
 *  3. R43 : au passage à TERMINE avec une caisse ouverte, `SHIFT_OPEN_AT_END` à la partenaire (SMS exact) ; sans
 *     caisse ouverte, aucun.
 *  4. R42 : PIN régisseur obligatoire à l'ouverture (400 PIN_REQUIRED, aucune caisse ; `shift_open` direct avec
 *     `pin_verified: false` refusé PIN_REQUIRED) ; PIN jamais généré : 409 PIN_NOT_SET au texte du contrat.
 * Rouge avant correctif : `open_shift` absent (route assignments `:38-49`) ; onglet Caisse lié au seul
 * `can_accept_cash` (scanner `:830`) ; CashTab sans clôture ; tout ADMIN ferme une caisse
 * (M/20261103000006:198-204) ; aucun avis à TERMINE (M/20261103000005:1320) ; PIN facultatif
 * (lib/shifts/shift.service.ts:324-328, `shift_open` M/20261102000003:991) ; texte PIN_NOT_SET différent (`:297`).
 * Verts dès l'écriture (témoins, signalés) : la partenaire et l'admin `events.write` ferment une caisse sans écart ;
 * aucun SHIFT_OPEN_AT_END sans caisse ouverte.
 * Les caisses s'ouvrent par l'aide openShift (PIN posé le temps de l'ouverture, A11). Fin de suite :
 * assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { finishOverdueEvents } from '../helpers/lifecycle-invariants';
import { service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, openShift, shiftRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, eventStatus, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { dispatchAt, outboxRows, smsMark, smsTo } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];
const ASSIGNMENTS_ROUTE = '../../app/api/controller/assignments/route';
const CLOSE_ROUTE = '../../app/api/controller/shifts/close/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const SCANNER_PAGE = path.join('app', 'controller', 'scanner', 'page.tsx');
const CASH_TAB = path.join('components', 'partner', 'pilotage', 'CashTab.tsx');
const SHIFT_MODALS = path.join('components', 'shifts', 'ShiftModals.tsx');

let partner: TestPartner;
let appUrl: string;

before(async () => {
    partner = await newPartner('caisse-9bis');
    appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie (.env.test)');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-caisse');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let seq = 0;

/** Titre court et GSM-7 (≤ 25 caractères) : cité sans troncature par le SMS SHIFT_OPEN_AT_END. */
function shortTitle(): string {
    seq += 1;
    return `Caisse ${String(Date.now() % 100_000).padStart(5, '0')}${seq}`.slice(0, 25);
}

/** Événement PUBLIE dans 1 h (fenêtre de scan ouverte : caisse possible). */
async function publishedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, CATEGORIES, { title: shortTitle(), startsInHours: 1, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

/** Caisse OUVERT du contrôleur (aide openShift, PIN passé) ; rend son identifiant. */
async function openedShift(ctrl: Buyer, eventId: string, label: string): Promise<string> {
    const res = await openShift(ctrl, eventId);
    assert.equal(res.status, 200, `ouverture de la caisse (${label}) : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', ctrl.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une caisse OUVERT (${label})`);
    return String(data![0].id);
}

async function openShiftsOf(userId: string, eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses ouvertes : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function assignmentsOf(user: { accessToken: string }): Promise<Row[]> {
    const handler = await routeHandler(ASSIGNMENTS_ROUTE, 'GET', 'GET /api/controller/assignments');
    const res = await invoke(handler, jsonRequest('/api/controller/assignments', 'GET', user.accessToken));
    assert.equal(res.status, 200, `affectations : ${show(res)}`);
    return (res.body.assignments ?? []) as Row[];
}

function assignmentFor(list: Row[], eventId: string): Row {
    const a = list.find((x) => (x.events as Row | null)?.id === eventId);
    assert.ok(a, `affectation à l'événement ${eventId} : ${JSON.stringify(list).slice(0, 300)}`);
    return a;
}

async function closeShift(caller: { accessToken: string }, shiftId: string): Promise<RouteResult> {
    const s = await shiftRow(shiftId);
    const handler = await routeHandler(CLOSE_ROUTE, 'POST', 'POST /api/controller/shifts/close');
    return invoke(handler, jsonRequest('/api/controller/shifts/close', 'POST', caller.accessToken,
        { shiftId, declaredCashTotal: Number(s.expected_cash_total ?? 0) }));
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function code(file: string): string {
    assert.ok(fs.existsSync(file), `${file} absent`);
    return stripComments(fs.readFileSync(file, 'utf8'));
}

// ── 1. R17 : caisse ouverte visible sans droit d'encaisser ────────────────

describe('R17 — caisse ouverte d’un contrôleur dont le droit d’encaisser est retiré', () => {
    test('open_shift servi par affectation (identifiant de la caisse ouverte, null sans caisse)', async () => {
        const ev = await publishedEvent('caisse-retrait-droit');
        const cashier = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'caisse-droit' });
        const plain = await newController(partner, ev.eventId, { canAcceptCash: false, label: 'caisse-sans' });
        const shiftId = await openedShift(cashier, ev.eventId, 'droit retiré ensuite');
        const { error } = await service.from('event_controllers').update({ can_accept_cash: false }).eq('event_id', ev.eventId).eq('user_id', cashier.userId);
        assert.equal(error, null, `droit d'encaisser retiré : ${error?.message}`);

        const mine = assignmentFor(await assignmentsOf(cashier), ev.eventId);
        assert.equal(mine.can_accept_cash, false, 'précondition : droit d’encaisser retiré');
        assert.ok('open_shift' in mine, `champ open_shift servi par affectation (contrat 4.3), reçu ${JSON.stringify(mine).slice(0, 300)}`);
        assert.equal(mine.open_shift, shiftId, `la caisse encore ouverte reste joignable : ${JSON.stringify(mine.open_shift)}`);
        const other = assignmentFor(await assignmentsOf(plain), ev.eventId);
        assert.ok('open_shift' in other && other.open_shift === null, `sans caisse ouverte : open_shift null, reçu ${JSON.stringify(other).slice(0, 300)}`);
    });

    test('statique : l’onglet Caisse du scanner suit can_accept_cash OU open_shift', () => {
        const src = code(SCANNER_PAGE);
        const tab = src.match(/\.\.\.\(\s*([A-Za-z_$][\w$]*)\s*\?\s*\[\s*\{\s*id:\s*'caisse'/);
        assert.ok(tab, 'onglet Caisse conditionné par une variable');
        const decl = src.match(new RegExp(`const\\s+${tab[1]}\\s*=\\s*([^;]+);`));
        assert.ok(decl, `définition de ${tab[1]}`);
        assert.match(decl[1], /open_shift/, `onglet Caisse : ${tab[1]} = ${decl[1].trim()} doit tenir compte de open_shift (aujourd’hui can_accept_cash seul)`);
        assert.match(decl[1], /can_accept_cash|canCash/, `${tab[1]} garde le droit d’encaisser`);
    });
});

// ── 2. R17 : clôture depuis le pilotage ────────────────────────────────────

describe('R17 — clôture d’une caisse par la partenaire ou un admin events.write', () => {
    test('statique : CashTab propose « Fermer cette caisse » par ligne ouverte, avec CloseShiftModal (route de clôture)', () => {
        const src = code(CASH_TAB);
        assert.match(src, /Fermer cette caisse/, 'bouton « Fermer cette caisse » (aujourd’hui CashTab n’a que le PIN)');
        assert.match(src, /CloseShiftModal/, 'fenêtre de clôture CloseShiftModal réutilisée');
        assert.match(code(SHIFT_MODALS), /\/api\/controller\/shifts\/close/, 'CloseShiftModal appelle POST /api/controller/shifts/close');
    });

    test('la partenaire propriétaire ferme une caisse sans écart → 200 (témoin) ; admin events.write → 200 (témoin)', async () => {
        const ev = await publishedEvent('caisse-cloture-ok');
        const a = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'cloture-par-part' });
        const b = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'cloture-par-adm' });
        const shiftA = await openedShift(a, ev.eventId, 'fermée par la partenaire');
        const shiftB = await openedShift(b, ev.eventId, 'fermée par un admin events.write');
        const byPartner = await closeShift(partner, shiftA);
        assert.equal(byPartner.status, 200, `clôture par la partenaire : ${show(byPartner)}`);
        assert.notEqual((await shiftRow(shiftA)).status, 'OUVERT', 'caisse fermée par la partenaire');
        const writer = await newAdminWith(['events.read', 'events.write'], { label: 'caisse-ecrit' });
        const byWriter = await closeShift(writer, shiftB);
        assert.equal(byWriter.status, 200, `clôture par un admin events.write : ${show(byWriter)}`);
        assert.notEqual((await shiftRow(shiftB)).status, 'OUVERT', 'caisse fermée par l’admin');
    });

    test('admin sans events.write → 403 PERMISSION_MISSING, caisse toujours OUVERT', async () => {
        const ev = await publishedEvent('caisse-cloture-refus');
        const c = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'cloture-refus' });
        const shiftId = await openedShift(c, ev.eventId, 'admin sans permission');
        const reader = await newAdminWith(['events.read'], { label: 'caisse-lit' });
        const res = await closeShift(reader, shiftId);
        assert.equal(res.status, 403, `admin events.read seul : 403 attendu (aujourd’hui tout admin ferme), ${show(res)}`);
        assert.equal(res.body.code, 'PERMISSION_MISSING', show(res));
        assert.equal((await shiftRow(shiftId)).status, 'OUVERT', 'refus : caisse toujours ouverte');
    });
});

// ── 3. R43 : caisse ouverte à la fin ───────────────────────────────────────

describe('R43 — passage à TERMINE avec une caisse ouverte : SHIFT_OPEN_AT_END à la partenaire', () => {
    test('caisse ouverte → un SMS et un in-app SHIFT_OPEN_AT_END, texte exact ; sans caisse ouverte → aucun (témoin)', async () => {
        const withShift = await publishedEvent('caisse-fin-ouverte');
        const without = await publishedEvent('caisse-fin-fermee');
        const c = await newController(partner, withShift.eventId, { canAcceptCash: true, label: 'fin-ouverte' });
        await openedShift(c, withShift.eventId, 'laissée ouverte à la fin');
        await shiftEventDates(withShift.eventId, { startsInHours: -6, durationHours: 4 });
        await shiftEventDates(without.eventId, { startsInHours: -6, durationHours: 4 });
        await finishOverdueEvents();
        assert.equal(await eventStatus(withShift.eventId), 'TERMINE', 'précondition : TERMINE par le cron');
        assert.equal(await eventStatus(without.eventId), 'TERMINE', 'précondition : TERMINE par le cron');

        const sms = await outboxRows({ type: 'SHIFT_OPEN_AT_END', eventId: withShift.eventId, userId: partner.userId, channel: 'SMS' });
        assert.equal(sms.length, 1, `un SMS SHIFT_OPEN_AT_END à la partenaire (aujourd’hui aucun avis) : ${JSON.stringify(sms.map((r) => r.status))}`);
        const inApp = await outboxRows({ type: 'SHIFT_OPEN_AT_END', eventId: withShift.eventId, userId: partner.userId, channel: 'IN_APP' });
        assert.equal(inApp.length, 1, 'un avis in-app SHIFT_OPEN_AT_END');
        assert.deepEqual(await outboxRows({ type: 'SHIFT_OPEN_AT_END', eventId: without.eventId }), [], 'sans caisse ouverte : aucun avis de caisse');

        const mark = smsMark(partner.phoneE164);
        await dispatchAt(new Date(), { ids: [sms[0].id] });
        assert.deepEqual(smsTo(partner.phoneE164, mark).map((m) => m.message),
            [`Event Village : ${withShift.title} est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : ${appUrl}/partner/events`],
            'texte exact (11.1 N8, une caisse)');
    });
});

// ── 4. R42 : PIN obligatoire ───────────────────────────────────────────────

describe('R42 — PIN régisseur obligatoire à l’ouverture d’une caisse', () => {
    test('route sans PIN → 400 PIN_REQUIRED « Saisissez le code PIN du régisseur. », aucune caisse', async () => {
        const ev = await publishedEvent('caisse-sans-pin');
        const c = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'sans-pin' });
        const res = await openShift(c, ev.eventId, 0, null);
        assert.equal(res.status, 400, `ouverture sans PIN : 400 attendu (aujourd’hui 200, PIN facultatif), ${show(res)}`);
        assert.equal(res.body.code, 'PIN_REQUIRED', show(res));
        assert.equal(res.body.error, 'Saisissez le code PIN du régisseur.', show(res));
        assert.deepEqual(await openShiftsOf(c.userId, ev.eventId), [], 'aucune caisse ouverte');
    });

    test('shift_open direct avec pin_verified: false → PIN_REQUIRED, aucune caisse', async () => {
        const ev = await publishedEvent('caisse-rpc-sans-pin');
        const c = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'rpc-sans-pin' });
        const { data, error } = await service.rpc('shift_open', { p: { user_id: c.userId, event_id: ev.eventId, opening_float: 0, pin_verified: false } });
        assert.equal(error, null, `shift_open : ${error?.message}`);
        const body = (data ?? {}) as Row;
        assert.equal(body.ok, false, `shift_open sans PIN vérifié refusé (aujourd’hui ouvert) : ${JSON.stringify(body)}`);
        assert.equal(body.code, 'PIN_REQUIRED', JSON.stringify(body));
        assert.deepEqual(await openShiftsOf(c.userId, ev.eventId), [], 'aucune caisse ouverte');
    });

    test('PIN saisi pour un événement sans PIN généré → 409 PIN_NOT_SET au texte du contrat, aucune caisse', async () => {
        const ev = await publishedEvent('caisse-pin-absent');
        const c = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'pin-absent' });
        const handler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
        const res = await invoke(handler, jsonRequest('/api/controller/shifts/open', 'POST', c.accessToken,
            { eventId: ev.eventId, openingFloat: 0, regisseurPin: '135790' }));
        assert.equal(res.status, 409, show(res));
        assert.equal(res.body.code, 'PIN_NOT_SET', show(res));
        assert.equal(res.body.error, 'Aucun code PIN régisseur pour cet événement : l’organisateur le génère dans l’onglet Caisse du pilotage.',
            `texte du contrat 4.3 (aujourd’hui « … n’a été généré par l’organisateur … ») : ${show(res)}`);
        assert.deepEqual(await openShiftsOf(c.userId, ev.eventId), [], 'aucune caisse ouverte');
    });
});
