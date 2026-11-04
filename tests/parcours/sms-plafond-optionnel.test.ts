/**
 * Lot 7, tâche 7.0 a — plafond des SMS optionnels (contrat, section 4.1 ; M1, M2.4 à M2.6 ; D12 à D15).
 * Règle : les SMS indispensables (famille ESSENTIAL du registre) ne sont jamais refusés par un plafond
 * journalier ; les SMS optionnels ont un budget SUPERADMIN notif.sms_optional_daily_cap (défaut 700),
 * appliqué dans la réservation de la boîte d'envoi (notification_outbox_claim), compté au jour de Dakar de
 * l'horloge de l'envoyeur ; au-delà : SKIPPED SMS_OPTIONAL_CAP. Alerte des admins à 80 %, une fois par jour.
 *
 * Isolation : chaque cas travaille sur un jour de Dakar futur tiré au hasard (le budget se compte au jour de
 * l'horloge simulée de l'envoyeur, jamais au jour réel), sur un événement neuf et des porteurs neufs
 * (massHolders : numéros +22170XXXXXXX que randomSenegalPhone ne produit jamais). Horloge : seulement `now`
 * de scheduleAt / dispatchAt / des RPC, jamais dans le passé. Les SMS se comptent par numéro neuf.
 * Vitesse (signalé) : les préférences IN_APP, PUSH et EMAIL des 701 porteurs sont coupées en masse pour le
 * sujet REMINDERS ; seules leurs lignes SMS partent à l'envoyeur. Leurs billets sont à 0 F (aucun paiement
 * sans SUCCESS, invariant (b)) : notif.free_ticket_reminder_sms = SAME_AS_PAID le temps des cas (7.0 b).
 *
 *  1. réglages : notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ;
 *     bornes 0 et 1 000 000 admises, −1, 1 000 001, 2,5 refusées (INVALID_VALUE) ; notif.sms_daily_alert
 *     supprimée (historisée « suppression ») et refusée (UNKNOWN_KEY) ;
 *  2. 701 rappels J-1 optionnels du même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages du
 *     faux MTarget vers ces numéros, instantané decision.sms_budget { day, cap, used_before } ;
 *  3. puis une confirmation d'achat (ESSENTIAL) au même jour simulé → SENT, hors budget ;
 *  4. même scénario sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 % : part non
 *     OTP 700 = budget) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP, et l'achat part ensuite ;
 *  5. contrôles du jour (notification_daily_checks) deux fois : une seule alerte ADMIN_SMS_OPTIONAL_80 par
 *     admin notifications.read, un seul signal SMS_OPTIONAL_80 ; à 559 (seuil 560) aucune alerte (transaction
 *     annulée) ;
 *  6. plafond 0 : tout optionnel SKIPPED SMS_OPTIONAL_CAP, aucune alerte ni prévision ;
 *  7. garde anti-abus gardée pour les optionnels (D14) : sous SMS_GLOBAL_DAILY_CAP = 1, PASSWORD_CHANGED
 *     (essentiel) SENT, REMINDER_J1 (optionnel) SKIPPED SMS_DAILY_CAP ;
 *  8. réglage supprimé (transaction annulée) : optionnel SKIPPED SETTING_MISSING, essentiel réservé.
 *
 * Rouge avant correctif (fix(7.0a)) : les deux clés n'existent pas et notif.sms_daily_alert existe encore ;
 * notification_outbox_claim n'applique aucun budget (701 SENT) ; la garde refuse aussi les indispensables
 * (SMS_DAILY_CAP) ; notification_daily_checks ne connaît que le seuil notif.sms_daily_alert ; les types
 * ADMIN_SMS_OPTIONAL_80 et le signal SMS_OPTIONAL_80 n'existent pas. withNotifSettings échoue d'abord
 * « réglage notif.sms_optional_daily_cap absent ».
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { inRolledBackTransaction } from '../helpers/db';
import { getFakes } from '../fakes';
import { randomSenegalPhone } from './helpers';
import { service, type CategorySpec } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    createReminderEvent, dakarAt, dakarDay, dispatchAt, getNotifSetting, insertOutboxRow, newAdmin, outboxRows,
    scheduleAt, smsMark, smsTo, withEnv, withNotifSettings, type DispatchRunReport, type NotifSettingKey, type OutboxRow,
    type ReminderEvent, type TestAdmin,
} from './notif-helpers';
import { assertTerrainInvariants, massHolders, type MassHolders } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('sms-plafond-optionnel');
});

type Row = Record<string, unknown>;

const CAP = 700;
const THRESHOLD = 560; // ceil(0,8 × 700)
const FREE_CATEGORY = 'Entree libre';
const PASSWORD_SMS = "Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.";

/** Réglages des rappels et du budget au défaut du contrat, billets à 0 F traités comme payants (7.0 b). */
const BUDGET_SETTINGS: Partial<Record<NotifSettingKey, unknown>> = {
    'notif.reminder_j1_enabled': true,
    'notif.reminder_j1_hour': 10,
    'notif.j1_sms': 'ALWAYS',
    'notif.sms_quiet_start': 22,
    'notif.sms_quiet_end': 8,
    'notif.sms_optional_daily_cap': CAP,
    'notif.free_ticket_reminder_sms': 'SAME_AS_PAID',
};

let partner: TestPartner;
let admin: TestAdmin;

before(async () => {
    partner = await newPartner('plafond-optionnel');
    admin = await newAdmin('plafond-optionnel', ['notifications.read']);
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Jours de Dakar futurs distincts, tirés au hasard entre J+120 et J+1 800 (aucune autre suite ne les vise). */
const usedOffsets = new Set<number>();
function randomFutureDay(): string {
    for (;;) {
        const offset = 120 + randomInt(0, 1680);
        if (usedOffsets.has(offset) || usedOffsets.has(offset - 1) || usedOffsets.has(offset + 1)) continue;
        usedOffsets.add(offset);
        return dakarDay(offset);
    }
}

function addSeconds(d: Date, s: number): Date {
    return new Date(d.getTime() + s * 1000);
}

/** Jour de Dakar `day` décalé de `n` jours. */
function dayPlus(day: string, n: number): string {
    return dakarDay(n, new Date(`${day}T12:00:00.000Z`));
}

function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(3).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

interface MassEvent { ev: ReminderEvent; holders: MassHolders; eve: string }

/** Événement PUBLIE le jour `day` à 12:00 (Dakar) avec `n` porteurs neufs d'un billet à 0 F (préférences IN_APP, PUSH, EMAIL coupées). */
async function massEvent(label: string, day: string, n: number): Promise<MassEvent> {
    const categories: CategorySpec[] = [{ name: FREE_CATEGORY, price: 0, total: n + 20 }];
    const ev = await createReminderEvent(partner, `plafond-${label}`, {
        startDate: day, startTime: '12:00', categories, title: shortTitle('Plafond'), location: 'Salle Sorano', city: 'Dakar',
    });
    const holders = await massHolders(n, {
        eventId: ev.eventId, categoryId: ev.categories[FREE_CATEGORY].id, saleChannel: 'FREE',
        disableChannels: ['IN_APP', 'PUSH', 'EMAIL'], topics: ['REMINDERS'], phoneVerified: true,
    });
    return { ev, holders, eve: dayPlus(day, -1) };
}

/** Passages de l'envoyeur à `at`, filtrés sur l'événement, jusqu'à ce qu'il ne réserve plus rien (10 au plus). */
async function drain(at: Date, eventId: string): Promise<DispatchRunReport[]> {
    const reports: DispatchRunReport[] = [];
    for (let i = 0; i < 10; i++) {
        const r = await dispatchAt(at, { eventIds: [eventId], limit: 500, rounds: 10 });
        reports.push(r);
        if (r.claimed === 0) return reports;
    }
    assert.fail(`envoyeur : encore des lignes réservées après 10 passages (${JSON.stringify(reports.map((r) => r.claimed))})`);
}

/** Lignes SMS du rappel J-1 de l'événement (une par porteur). */
async function j1Sms(eventId: string): Promise<OutboxRow[]> {
    return outboxRows({ type: 'REMINDER_J1', eventId, channel: 'SMS' });
}

function budgetOf(r: OutboxRow): Row | null {
    const b = (r.decision ?? {})['sms_budget'];
    return b && typeof b === 'object' ? (b as Row) : null;
}

/** Messages remis par le faux MTarget à chacun des numéros (repères pris avant l'envoi). */
function deliveredTo(phones: string[], marks: Map<string, number>): number[] {
    return phones.map((p) => smsTo(p, marks.get(p) ?? 0).length);
}

async function rpcData(fn: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(fn, { p });
    assert.equal(error, null, `${fn} : ${error?.message} (code ${error?.code})`);
    assert.ok(data && typeof data === 'object', `${fn} : réponse vide`);
    const r = data as Row;
    assert.equal(r.ok, true, `${fn} refusé : ${JSON.stringify(r)}`);
    return r;
}

function purchaseData(title: string, startAt: Date): Row {
    return {
        event_id: randomUUID(), title, start_at: startAt.toISOString(), location: 'Grand Théâtre', city: 'Dakar',
        payment_id: randomUUID(), ticket_count: 2, service_fee: 300, total: 10_300,
    };
}

/** PURCHASE_CONFIRMED (ESSENTIAL) mis en file par notif_enqueue au numéro `phone`, canal SMS seul, à l'heure `at`. */
async function enqueuePurchase(phone: string, at: Date): Promise<OutboxRow> {
    const key = `TEST-LOT7-ACHAT:${randomUUID()}`;
    const { data, error } = await service.rpc('notif_enqueue', {
        p: { type: 'PURCHASE_CONFIRMED', key, phone, channels: ['SMS'], data: purchaseData('TEST Achat budget', new Date(at.getTime() + 7 * 24 * 3600_000)), due_at: at.toISOString(), now: at.toISOString() },
    });
    assert.equal(error, null, `notif_enqueue PURCHASE_CONFIRMED : ${error?.message} (code ${error?.code})`);
    assert.equal(Number(data), 1, `notif_enqueue : une ligne SMS attendue (${JSON.stringify(data)})`);
    const rows = await outboxRows({ type: 'PURCHASE_CONFIRMED', keyPrefix: `${key}:` });
    assert.equal(rows.length, 1, `ligne SMS de l'achat : ${JSON.stringify(rows.map((r) => r.idempotency_key))}`);
    assert.equal(rows[0].family, 'ESSENTIAL', 'PURCHASE_CONFIRMED : famille ESSENTIAL (registre)');
    return rows[0];
}

async function rowOf(id: string): Promise<OutboxRow> {
    const rows = await outboxRows({ ids: [id] });
    assert.equal(rows.length, 1, `ligne ${id} introuvable`);
    return rows[0];
}

function brief(r: OutboxRow): string {
    return JSON.stringify({ type: r.type, status: r.status, reason: r.reason, sms_budget: budgetOf(r) });
}

/**
 * Lot de 701 rappels du même jour simulé : planification à la veille 10:00:30, envoyeur à 10:01 jusqu'à
 * épuisement. Renvoie l'événement, les lignes SMS après envoi et les messages reçus par numéro.
 */
async function run701(label: string): Promise<{ me: MassEvent; rows: OutboxRow[]; delivered: number[]; reports: DispatchRunReport[]; at: Date }> {
    const me = await massEvent(label, randomFutureDay(), CAP + 1);
    await scheduleAt(dakarAt(me.eve, '10:00:30'), [me.ev.eventId]);
    const pending = await j1Sms(me.ev.eventId);
    assert.equal(pending.length, CAP + 1, `planification : une ligne SMS J-1 par porteur (${pending.length})`);
    assert.ok(pending.every((r) => r.status === 'PENDING'), `lignes SMS en attente avant l'envoi : ${JSON.stringify(Array.from(new Set(pending.map((r) => `${r.status}:${r.reason}`))))}`);
    const marks = new Map(me.holders.phones.map((p) => [p, smsMark(p)]));
    const at = dakarAt(me.eve, '10:01');
    const reports = await drain(at, me.ev.eventId);
    const rows = await j1Sms(me.ev.eventId);
    return { me, rows, delivered: deliveredTo(me.holders.phones, marks), reports, at };
}

function assertBudgetOutcome(rows: OutboxRow[], delivered: number[], day: string, what: string): void {
    const byStatus = new Map<string, number>();
    for (const r of rows) byStatus.set(`${r.status}:${r.reason ?? ''}`, (byStatus.get(`${r.status}:${r.reason ?? ''}`) ?? 0) + 1);
    const summary = JSON.stringify(Object.fromEntries(byStatus));
    const sent = rows.filter((r) => r.status === 'SENT');
    const capped = rows.filter((r) => r.status === 'SKIPPED' && r.reason === 'SMS_OPTIONAL_CAP');
    assert.equal(sent.length, CAP, `${what} : ${CAP} SMS SENT attendus (${summary})`);
    assert.equal(capped.length, 1, `${what} : 1 SMS SKIPPED SMS_OPTIONAL_CAP attendu (${summary})`);
    assert.equal(rows.length, CAP + 1, `${what} : ${CAP + 1} lignes SMS au total (${summary})`);
    assert.equal(delivered.reduce((s, n) => s + n, 0), CAP, `${what} : ${CAP} messages du faux MTarget vers ces numéros`);
    assert.ok(delivered.every((n) => n <= 1), `${what} : au plus un SMS par porteur`);
    assert.equal(delivered.filter((n) => n === 0).length, 1, `${what} : un seul porteur sans SMS`);
    for (const r of rows) {
        const b = budgetOf(r);
        assert.ok(b, `${what} : decision.sms_budget absent de ${brief(r)}`);
        assert.equal(b.day, day, `${what} : sms_budget.day = jour de Dakar de l'envoyeur (${brief(r)})`);
        assert.equal(Number(b.cap), CAP, `${what} : sms_budget.cap (${brief(r)})`);
    }
    assert.equal(Number(budgetOf(capped[0])!.used_before), CAP, `${what} : la ligne refusée voit le budget plein (${brief(capped[0])})`);
    const usedBefore = sent.map((r) => Number(budgetOf(r)!.used_before)).sort((a, b) => a - b);
    assert.deepEqual(usedBefore, Array.from({ length: CAP }, (_, i) => i), `${what} : chaque SMS envoyé a réservé une place distincte du budget (0 à ${CAP - 1})`);
}

// ── 1. Réglages ────────────────────────────────────────────────────────────

describe('7.0 a Réglages du budget SMS optionnel (M1, D15)', () => {
    test('notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ; bornes ; notif.sms_daily_alert supprimée et refusée', async () => {
        const { data, error } = await service.from('platform_settings').select('key, value, description')
            .in('key', ['notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms', 'notif.sms_daily_alert']);
        assert.equal(error, null, `platform_settings : ${error?.message}`);
        const rows = (data ?? []) as Array<{ key: string; value: Row; description: string | null }>;
        const byKey = new Map(rows.map((r) => [r.key, r]));
        assert.deepEqual(rows.map((r) => r.key).sort(), ['notif.free_ticket_reminder_sms', 'notif.sms_optional_daily_cap'],
            `clés en base : ${JSON.stringify(rows.map((r) => r.key))} (migration 20261105000001 : deux clés créées, notif.sms_daily_alert supprimée)`);
        assert.deepEqual(byKey.get('notif.sms_optional_daily_cap')!.value, { value: 700 }, 'défaut du budget optionnel');
        assert.deepEqual(byKey.get('notif.free_ticket_reminder_sms')!.value, { value: 'NEVER' }, 'défaut des rappels de billets gratuits');
        for (const r of rows) assert.ok(typeof r.description === 'string' && r.description.trim().length >= 10, `${r.key} : description française`);

        const { data: hist, error: hErr } = await service.from('platform_settings_history').select('key, old_value, new_value, reason')
            .eq('key', 'notif.sms_daily_alert').is('new_value', null);
        assert.equal(hErr, null, `historique : ${hErr?.message}`);
        assert.ok((hist ?? []).some((h) => h.reason === 'suppression'), `suppression de notif.sms_daily_alert historisée (trg_platform_settings_audit) : ${JSON.stringify(hist)}`);

        const actor = await superadminId();
        const set = async (key: string, value: unknown) => {
            const { data: d, error: e } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: actor, p_reason: 'test des bornes, lot 7' });
            assert.equal(e, null, `finance_setting_set(${key}) : ${e?.message}`);
            return d as Row;
        };
        const saved = await getNotifSetting('notif.sms_optional_daily_cap');
        try {
            for (const v of [0, 1_000_000]) {
                const r = await set('notif.sms_optional_daily_cap', v);
                assert.equal(r.ok, true, `notif.sms_optional_daily_cap = ${v} refusé : ${JSON.stringify(r)}`);
                assert.equal(await getNotifSetting('notif.sms_optional_daily_cap'), v, `${v} appliqué`);
            }
            await set('notif.sms_optional_daily_cap', saved);
            for (const v of [-1, 1_000_001, 2.5, '700', null, true]) {
                const r = await set('notif.sms_optional_daily_cap', v);
                assert.equal(r.ok, false, `notif.sms_optional_daily_cap = ${JSON.stringify(v)} accepté : ${JSON.stringify(r)}`);
                assert.equal(r.code, 'INVALID_VALUE', `notif.sms_optional_daily_cap = ${JSON.stringify(v)} : code ${String(r.code)}`);
            }
            assert.equal(await getNotifSetting('notif.sms_optional_daily_cap'), saved, 'valeur inchangée après les refus');
        } finally {
            if (await getNotifSetting('notif.sms_optional_daily_cap') !== saved) await set('notif.sms_optional_daily_cap', saved);
        }

        const retired = await set('notif.sms_daily_alert', 2000);
        assert.equal(retired.ok, false, `notif.sms_daily_alert encore acceptée : ${JSON.stringify(retired)}`);
        assert.equal(retired.code, 'UNKNOWN_KEY', `notif.sms_daily_alert : code ${String(retired.code)} (liste blanche de finance_setting_set)`);
        const { data: back, error: bErr } = await service.from('platform_settings').select('key').eq('key', 'notif.sms_daily_alert');
        assert.equal(bErr, null, `relecture : ${bErr?.message}`);
        assert.deepEqual(back ?? [], [], 'notif.sms_daily_alert non recréée');
    });
});

// ── 2 à 4. 701 rappels du même jour ────────────────────────────────────────

describe('7.0 a Budget des SMS optionnels dans la réservation (M2.5, D13)', () => {
    let first: { me: MassEvent; rows: OutboxRow[]; delivered: number[]; at: Date } | null = null;

    test('701 rappels J-1 optionnels le même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages, decision.sms_budget', async () => {
        await withNotifSettings(BUDGET_SETTINGS, async () => {
            const r = await run701('701');
            first = r;
            assertBudgetOutcome(r.rows, r.delivered, r.me.eve, '701 rappels');
            const one = r.rows.find((x) => x.status === 'SENT')!;
            const phone = r.me.holders.phones[r.me.holders.userIds.indexOf(String(one.recipient_user_id))];
            assert.ok(phone, 'numéro du porteur de la ligne envoyée');
            const msgs = smsTo(phone).map((m) => m.message);
            assert.equal(msgs.length, 1, `un SMS pour ${phone}`);
            assert.match(msgs[0], new RegExp(`^Event Village : rappel, ${r.me.ev.title} demain à 12:00, Salle Sorano\\. Vos billets : `), `texte du J-1 : ${msgs[0]}`);
        });
    });

    test('puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget', async () => {
        assert.ok(first, 'précondition : le cas des 701 rappels a tourné');
        const capped = first.rows.filter((r) => r.status === 'SKIPPED' && r.reason === 'SMS_OPTIONAL_CAP');
        assert.equal(capped.length, 1, `précondition : budget du ${first.me.eve} épuisé (${JSON.stringify(Array.from(new Set(first.rows.map((r) => `${r.status}:${r.reason}`))))})`);
        await withNotifSettings(BUDGET_SETTINGS, async () => {
            const phone = randomSenegalPhone('76');
            const at = dakarAt(first!.me.eve, '10:05');
            const row = await enqueuePurchase(phone, at);
            const mark = smsMark(phone);
            await dispatchAt(addSeconds(at, 30), { ids: [row.id] });
            const done = await rowOf(row.id);
            assert.equal(done.status, 'SENT', `achat après épuisement du budget optionnel : ${brief(done)}`);
            assert.equal(budgetOf(done), null, `un SMS indispensable ne touche pas au budget optionnel : ${brief(done)}`);
            const sms = smsTo(phone, mark);
            assert.equal(sms.length, 1, 'un SMS de confirmation remis');
            assert.match(sms[0].message, /^Event Village : achat confirmé, 2 billets /, `texte de la confirmation : ${sms[0].message}`);
            const checks = await rpcData('notification_daily_checks', { now: addSeconds(at, 60).toISOString() });
            assert.equal(Number(checks.optional_today), CAP, `budget optionnel du jour inchangé par l'achat : ${JSON.stringify(checks)}`);
        });
    });

    test('sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 %) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP ; l’achat part ensuite', async () => {
        await withEnv({ SMS_GLOBAL_DAILY_CAP: '1000', SMS_GLOBAL_OTP_RESERVED_PERCENT: '30' }, async () => {
            // Compteurs globaux du jour réel remis à zéro (base locale, comme acces-limiteurs) : la part non OTP
            // (700) est entière au début du cas ; elle égale le budget, d'où le piège de l'ordre des règles.
            const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
            const { error: resetErr } = await service.from('quota_counters').delete().like('scope', 'sms%').eq('bucket', 'all').gte('window_start', dayStart);
            assert.equal(resetErr, null, `remise à zéro des compteurs globaux : ${resetErr?.message}`);
            await withNotifSettings(BUDGET_SETTINGS, async () => {
                const r = await run701('defauts');
                const reasons = Array.from(new Set(r.rows.filter((x) => x.status !== 'SENT').map((x) => `${x.status}:${x.reason}`)));
                assert.ok(!r.rows.some((x) => x.reason === 'SMS_DAILY_CAP'), `aucun rappel refusé par la garde anti-abus (motifs : ${JSON.stringify(reasons)})`);
                assertBudgetOutcome(r.rows, r.delivered, r.me.eve, '701 rappels sous les défauts de la garde');
                const phone = randomSenegalPhone('76');
                const at = dakarAt(r.me.eve, '10:05');
                const row = await enqueuePurchase(phone, at);
                const mark = smsMark(phone);
                await dispatchAt(addSeconds(at, 30), { ids: [row.id] });
                const done = await rowOf(row.id);
                assert.equal(done.status, 'SENT', `achat après 700 SMS optionnels sous les défauts de la garde : ${brief(done)}`);
                assert.equal(smsTo(phone, mark).length, 1, 'un SMS de confirmation remis');
            });
        });
    });
});

// ── 5. Alerte à 80 % ───────────────────────────────────────────────────────

/** Alertes ADMIN_SMS_OPTIONAL_80 du jour pour l'admin de la suite. */
async function optional80(day: string): Promise<{ all: OutboxRow[]; mine: OutboxRow[] }> {
    const all = await outboxRows({ type: 'ADMIN_SMS_OPTIONAL_80', keyPrefix: `ADMIN_SMS_OPTIONAL_80:${day}:` });
    return { all, mine: all.filter((r) => r.recipient_user_id === admin.userId) };
}

describe('7.0 a Alerte à 80 % du budget optionnel, une fois par jour (M2.6, D15)', () => {
    test('notification_daily_checks deux fois au jour des 701 rappels : une ligne ADMIN_SMS_OPTIONAL_80 par canal pour l’admin, un signal SMS_OPTIONAL_80', async () => {
        await withNotifSettings(BUDGET_SETTINGS, async () => {
            const me = await massEvent('alerte', randomFutureDay(), CAP + 1);
            await scheduleAt(dakarAt(me.eve, '10:00:30'), [me.ev.eventId]);
            await drain(dakarAt(me.eve, '10:01'), me.ev.eventId);
            const c1 = await rpcData('notification_daily_checks', { now: dakarAt(me.eve, '11:00').toISOString() });
            const c2 = await rpcData('notification_daily_checks', { now: dakarAt(me.eve, '11:05').toISOString() });
            for (const c of [c1, c2]) {
                assert.equal(c.day, me.eve, `jour de Dakar : ${JSON.stringify(c)}`);
                assert.equal(Number(c.optional_today), CAP, `SMS optionnels du jour : ${JSON.stringify(c)}`);
                assert.equal(Number(c.optional_cap), CAP, `plafond : ${JSON.stringify(c)}`);
                assert.equal(Number(c.optional_threshold), THRESHOLD, `seuil de 80 % : ${JSON.stringify(c)}`);
                assert.ok(!('threshold' in c), `réponse sans l'ancien seuil notif.sms_daily_alert : ${JSON.stringify(c)}`);
            }
            assert.equal(c2.alerted, false, `second contrôle du jour : aucune nouvelle alerte (${JSON.stringify(c2)})`);
            const { all, mine } = await optional80(me.eve);
            assert.deepEqual(mine.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP'], `une alerte par canal pour l'admin notifications.read : ${JSON.stringify(mine.map((r) => r.idempotency_key))}`);
            for (const r of mine) {
                assert.equal(r.idempotency_key, `ADMIN_SMS_OPTIONAL_80:${me.eve}:${admin.userId}:${r.channel}`, 'clé par jour et par admin');
                assert.equal(r.family, 'ESSENTIAL', 'alerte admin : famille ESSENTIAL');
                const d = r.template_data;
                const used = Number(d.used);
                assert.equal(d.day, me.eve, `données : jour (${JSON.stringify(d)})`);
                assert.equal(Number(d.cap), CAP, `données : plafond (${JSON.stringify(d)})`);
                assert.equal(Number(d.threshold), THRESHOLD, `données : seuil (${JSON.stringify(d)})`);
                assert.ok(used >= THRESHOLD && used <= CAP, `données : SMS optionnels comptés (${JSON.stringify(d)})`);
                assert.equal(Number(d.percent), Math.floor((100 * used) / CAP), `données : pourcentage (${JSON.stringify(d)})`);
            }
            assert.ok(all.every((r) => r.channel !== 'SMS'), 'aucune alerte admin par SMS');
            const { data: sig, error } = await service.from('admin_signals').select('id, ref_id').eq('kind', 'SMS_OPTIONAL_80').in('ref_id', all.map((r) => r.id));
            assert.equal(error, null, `admin_signals : ${error?.message}`);
            assert.equal((sig ?? []).length, 1, `un seul signal SMS_OPTIONAL_80 pour le jour : ${JSON.stringify(sig)}`);
        });
    });

    test('559 SMS optionnels (seuil 560) : aucune alerte ; le 560ᵉ déclenche l’alerte (transaction annulée, rien ne reste)', async () => {
        const day = randomFutureDay();
        const at = dakarAt(day, '12:00');
        const out = await inRolledBackTransaction(async (db) => {
            const insert = async (from: number, to: number) => db.query(
                `INSERT INTO public.notification_outbox (idempotency_key, group_key, type, family, topic, channel, origin, recipient_phone,
                        template_data, status, attempts, max_attempts, due_at, next_attempt_at, claimed_at, sent_at, finished_at, decision)
                 SELECT 'TEST-LOT7-80:' || $1 || ':' || i || ':SMS', 'TEST-LOT7-80:' || $1 || ':' || i, 'FIRST_TICKET_SOLD', 'OPTIONAL', 'PRO_ACTIVITY',
                        'SMS', 'OUTBOX', '+22170' || lpad(((($4::int) + i) % 10000000)::text, 7, '0'),
                        '{"title":"TEST Seuil 80"}'::jsonb, 'SENT', 1, 5, $2::timestamptz, $2::timestamptz, $2::timestamptz, $2::timestamptz, $2::timestamptz,
                        jsonb_build_object('stage', 'CLAIM', 'outcome', 'SEND', 'family', 'OPTIONAL', 'topic', 'PRO_ACTIVITY',
                                           'preference', jsonb_build_object('topic', 'PRO_ACTIVITY', 'channel', 'SMS', 'enabled', true),
                                           'quiet', jsonb_build_object('start', 22, 'end', 8, 'hour', 12, 'in_quiet', false))
                   FROM generate_series($3::int, $5::int) AS i`,
                [day, at.toISOString(), from, randomInt(0, 9_000_000), to]);
            const checks = async (min: number) => (await db.query<{ r: Row }>('SELECT public.notification_daily_checks($1::jsonb) AS r',
                [JSON.stringify({ now: new Date(at.getTime() + min * 60_000).toISOString() })])).rows[0].r;
            const alerts = async () => Number((await db.query<{ n: string }>(
                `SELECT count(*)::text AS n FROM public.notification_outbox WHERE type = 'ADMIN_SMS_OPTIONAL_80' AND idempotency_key LIKE $1`,
                [`ADMIN_SMS_OPTIONAL_80:${day}:%`])).rows[0].n);
            await insert(1, THRESHOLD - 1);
            const below = await checks(1);
            const alertsBelow = await alerts();
            await insert(THRESHOLD, THRESHOLD);
            const reached = await checks(2);
            const alertsReached = await alerts();
            const mineReached = Number((await db.query<{ n: string }>(
                `SELECT count(*)::text AS n FROM public.notification_outbox WHERE idempotency_key LIKE $1`,
                [`ADMIN_SMS_OPTIONAL_80:${day}:${admin.userId}:%`])).rows[0].n);
            return { below, alertsBelow, reached, alertsReached, mineReached };
        });
        assert.equal(out.below.ok, true, `contrôle à 559 : ${JSON.stringify(out.below)}`);
        assert.equal(Number(out.below.optional_today), THRESHOLD - 1, `SMS optionnels comptés : ${JSON.stringify(out.below)}`);
        assert.equal(Number(out.below.optional_threshold), THRESHOLD, `seuil : ${JSON.stringify(out.below)}`);
        assert.equal(out.below.alerted, false, `559 : aucune alerte (${JSON.stringify(out.below)})`);
        assert.equal(out.alertsBelow, 0, '559 : aucune ligne ADMIN_SMS_OPTIONAL_80');
        assert.equal(out.reached.alerted, true, `560 : alerte (${JSON.stringify(out.reached)})`);
        assert.ok(out.alertsReached > 0, '560 : lignes ADMIN_SMS_OPTIONAL_80 créées');
        assert.equal(out.mineReached, 2, '560 : in-app et email pour l’admin de la suite');
        assert.deepEqual((await optional80(day)).all, [], 'transaction annulée : aucune alerte ne reste');
    });
});

// ── 6. Plafond 0 ───────────────────────────────────────────────────────────

describe('7.0 a Plafond 0 : aucun SMS optionnel, aucune alerte ni prévision (D15)', () => {
    test('notif.sms_optional_daily_cap = 0 : chaque rappel SKIPPED SMS_OPTIONAL_CAP, aucun SMS ; ni ADMIN_SMS_OPTIONAL_80 ni ADMIN_SMS_FORECAST', async () => {
        await withNotifSettings({ ...BUDGET_SETTINGS, 'notif.sms_optional_daily_cap': 0 }, async () => {
            const day = randomFutureDay();
            const me = await massEvent('zero', day, 3);
            const dayBefore = dayPlus(day, -2);
            const plan = await rpcData('notification_reminders_schedule', { now: dakarAt(dayBefore, '12:00').toISOString(), only_event_ids: [me.ev.eventId] });
            const forecast = plan.forecast as Row | undefined;
            assert.ok(!forecast || forecast.alerted !== true, `plafond 0 : aucune prévision d'alerte (${JSON.stringify(plan)})`);
            assert.deepEqual(await outboxRows({ type: 'ADMIN_SMS_FORECAST', keyPrefix: `ADMIN_SMS_FORECAST:${me.eve}:` }), [], 'plafond 0 : aucune alerte de la veille');

            await scheduleAt(dakarAt(me.eve, '10:00:30'), [me.ev.eventId]);
            const marks = new Map(me.holders.phones.map((p) => [p, smsMark(p)]));
            await drain(dakarAt(me.eve, '10:01'), me.ev.eventId);
            const rows = await j1Sms(me.ev.eventId);
            assert.equal(rows.length, 3, 'une ligne SMS par porteur');
            assert.deepEqual(rows.map((r) => `${r.status}:${r.reason}`), ['SKIPPED:SMS_OPTIONAL_CAP', 'SKIPPED:SMS_OPTIONAL_CAP', 'SKIPPED:SMS_OPTIONAL_CAP'], `plafond 0 : ${JSON.stringify(rows.map(brief))}`);
            assert.deepEqual(deliveredTo(me.holders.phones, marks), [0, 0, 0], 'aucun SMS remis');
            const c = await rpcData('notification_daily_checks', { now: dakarAt(me.eve, '11:00').toISOString() });
            assert.equal(Number(c.optional_cap), 0, `plafond lu : ${JSON.stringify(c)}`);
            assert.equal(c.optional_threshold ?? null, null, `plafond 0 : aucun seuil (${JSON.stringify(c)})`);
            assert.equal(c.alerted, false, `plafond 0 : aucune alerte (${JSON.stringify(c)})`);
            assert.deepEqual((await optional80(me.eve)).all, [], 'plafond 0 : aucune ligne ADMIN_SMS_OPTIONAL_80');
        });
    });
});

// ── 7. Garde anti-abus : indispensable contre optionnel ────────────────────

describe('7.0 a Garde anti-abus : les indispensables ne sont plus soumis au plafond global (D14)', () => {
    test('SMS_GLOBAL_DAILY_CAP = 1 : PASSWORD_CHANGED (ESSENTIAL) SENT au texte exact ; REMINDER_J1 (OPTIONAL) SKIPPED SMS_DAILY_CAP, sans relance', async () => {
        const day = randomFutureDay();
        const ev = await createReminderEvent(partner, 'plafond-garde', {
            startDate: dayPlus(day, 1), startTime: '20:00', categories: [{ name: FREE_CATEGORY, price: 0, total: 5 }],
            title: shortTitle('Garde'), location: 'Salle Sorano', city: 'Dakar',
        });
        const holder = await massHolders(1, { eventId: ev.eventId, categoryId: ev.categories[FREE_CATEGORY].id, phoneVerified: true });
        const t = dakarAt(day, '12:00');
        const due = new Date(Date.now() - 1000).toISOString();
        const essential = await insertOutboxRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'SMS', recipient_phone: randomSenegalPhone('76'), due_at: due, next_attempt_at: due });
        const optional = await insertOutboxRow({
            type: 'REMINDER_J1', family: 'OPTIONAL', topic: 'REMINDERS', channel: 'SMS', recipient_user_id: holder.userIds[0], event_id: ev.eventId,
            template_data: { sms_policy: 'ALWAYS' }, due_at: due, next_attempt_at: due,
        });
        const essentialPhone = String(essential.recipient_phone);
        const marks = [smsMark(essentialPhone), smsMark(holder.phones[0])];
        await withNotifSettings(BUDGET_SETTINGS, () => withEnv({ SMS_GLOBAL_DAILY_CAP: '1' }, async () => {
            await dispatchAt(t, { ids: [essential.id, optional.id] });
        }));
        const e = await rowOf(essential.id);
        assert.equal(e.status, 'SENT', `indispensable sous le plafond global : ${brief(e)}`);
        assert.deepEqual(smsTo(essentialPhone, marks[0]).map((m) => m.message), [PASSWORD_SMS], 'SMS indispensable remis, texte exact');
        const o = await rowOf(optional.id);
        assert.equal(o.status, 'SKIPPED', `optionnel sous le plafond global : ${brief(o)}`);
        assert.equal(o.reason, 'SMS_DAILY_CAP', `optionnel : garde anti-abus gardée (${brief(o)})`);
        assert.equal(getFakes().sms.messagesTo(holder.phones[0]).length - marks[1], 0, 'aucun SMS optionnel tenté');
        const later = await dispatchAt(new Date(t.getTime() + 24 * 3600_000 - 3600_000), { ids: [optional.id] });
        assert.equal(later.claimed, 0, 'SKIPPED est final : pas de relance');
    });
});

// ── 8. Réglage absent ──────────────────────────────────────────────────────

describe('7.0 a Réglage du budget absent : les optionnels ne partent pas, les indispensables si (décision 25 du lot 6)', () => {
    test('notif.sms_optional_daily_cap supprimé (transaction annulée) : optionnel SKIPPED SETTING_MISSING, essentiel réservé pour l’envoi', async () => {
        const at = dakarAt(randomFutureDay(), '12:00');
        const out = await inRolledBackTransaction(async (db) => {
            const del = await db.query(`DELETE FROM public.platform_settings WHERE key = 'notif.sms_optional_daily_cap'`);
            const ins = async (type: string, family: string, topic: string | null, data: Row) => (await db.query<{ id: string }>(
                `INSERT INTO public.notification_outbox (idempotency_key, group_key, type, family, topic, channel, recipient_phone, template_data, status, due_at, next_attempt_at)
                 VALUES ($1 || ':SMS', $1, $2, $3, $4, 'SMS', $5, $6::jsonb, 'PENDING', $7::timestamptz, $7::timestamptz) RETURNING id::text AS id`,
                [`TEST-LOT7-SANS-REGLAGE:${randomUUID()}`, type, family, topic, randomSenegalPhone('76'), JSON.stringify(data), at.toISOString()])).rows[0].id;
            const optionalId = await ins('FIRST_TICKET_SOLD', 'OPTIONAL', 'PRO_ACTIVITY', { title: 'TEST Réglage absent' });
            const essentialId = await ins('PASSWORD_CHANGED', 'ESSENTIAL', null, {});
            const claim = (await db.query<{ r: Row }>('SELECT public.notification_outbox_claim($1::jsonb) AS r',
                [JSON.stringify({ now: at.toISOString(), only_ids: [optionalId, essentialId] })])).rows[0].r;
            const rows = (await db.query<{ id: string; status: string; reason: string | null }>(
                'SELECT id::text AS id, status, reason FROM public.notification_outbox WHERE id = ANY($1::uuid[])', [[optionalId, essentialId]])).rows;
            return { deleted: del.rowCount, claim, rows, optionalId, essentialId };
        });
        assert.equal(out.deleted, 1, 'précondition : la clé notif.sms_optional_daily_cap existait (migration 20261105000001)');
        assert.equal(out.claim.ok, true, `réservation : ${JSON.stringify(out.claim)}`);
        const byId = new Map(out.rows.map((r) => [r.id, r]));
        assert.deepEqual(byId.get(out.optionalId), { id: out.optionalId, status: 'SKIPPED', reason: 'SETTING_MISSING' }, `optionnel sans réglage du budget : ${JSON.stringify(byId.get(out.optionalId))}`);
        assert.equal(byId.get(out.essentialId)?.status, 'SENDING', `essentiel réservé pour l'envoi malgré le réglage absent : ${JSON.stringify(byId.get(out.essentialId))}`);
        const claimed = (out.claim.claimed as Row[] | undefined) ?? [];
        assert.deepEqual(claimed.map((c) => c.id), [out.essentialId], 'seul l’essentiel est remis à l’envoyeur');
        assert.ok((await getNotifSetting('notif.sms_optional_daily_cap')) !== undefined, 'transaction annulée : le réglage existe toujours');
    });
});

