/**
 * Lot 7, tâche 7.0 a — alerte de la veille (contrat, section 4.1 ; M2.7 « prévision » ; D16).
 * Quand la planification des rappels voit que les SMS de rappel prévus pour le lendemain (jour de Dakar)
 * dépassent le budget optionnel restant de ce lendemain, elle met en file ADMIN_SMS_FORECAST pour les admins
 * notifications.read (in-app et email) et écrit un signal SMS_FORECAST, une seule fois par jour ; la réponse
 * de notification_reminders_schedule porte `forecast: { day, planned, cap, remaining, alerted }`.
 * La prévision est faite au pire (IF_NO_PUSH compté comme SMS) et exclut les porteurs qui ne recevront pas
 * de SMS : billets gratuits seulement avec notif.free_ticket_reminder_sms = NEVER, heure du J-1 dans la
 * plage de silence, etc. Elle est filtrée par only_event_ids (isolation des suites, D16).
 *
 * « La veille de la veille » : événement le jour D à 20:00 (Dakar) ; son J-1 est dû le jour D-1 à 10:00 ;
 * la planification tourne le jour D-2 à 12:00 (horloge simulée, jamais dans le passé) et prévoit D-1. Le H-3
 * (D à 17:00) tombe le jour D : il n'entre pas dans la prévision de D-1. Chaque cas a son propre jour D tiré
 * au hasard (l'alerte est quotidienne) et ses porteurs neufs (massHolders, billets à 0 F).
 * La RPC est appelée directement (service_role, p.now) : la réponse `forecast` est lue telle quelle.
 *
 *  1. 701 porteurs (SAME_AS_PAID), plafond 700 : deux planifications → une seule ligne ADMIN_SMS_FORECAST
 *     par canal pour l'admin, données { day, planned: 701, cap: 700, remaining: 700 }, un signal SMS_FORECAST ;
 *  2. 700 porteurs : aucune alerte ;
 *  3. porteurs de billets gratuits avec NEVER : non comptés (témoin SAME_AS_PAID compté) ;
 *  4. plage de silence couvrant l'heure du J-1 : J-1 non comptés (témoin hors plage compté).
 *
 * Rouge avant correctif (fix(7.0a)) : notification_reminders_schedule ne prévoit rien (aucun champ
 * `forecast`), le type ADMIN_SMS_FORECAST et le signal SMS_FORECAST n'existent pas ; withNotifSettings échoue
 * d'abord « réglage notif.sms_optional_daily_cap absent ».
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import {
    createReminderEvent, dakarAt, dakarDay, newAdmin, outboxRows, withNotifSettings, type NotifSettingKey, type OutboxRow,
    type ReminderEvent, type TestAdmin,
} from './notif-helpers';
import { assertTerrainInvariants, massHolders } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('sms-veille');
});

type Row = Record<string, unknown>;

const FREE_CATEGORY = 'Entree libre';

/** Réglages des rappels au défaut du contrat ; budget et politique des billets gratuits posés par cas. */
const BASE_SETTINGS: Partial<Record<NotifSettingKey, unknown>> = {
    'notif.reminder_j1_enabled': true,
    'notif.reminder_j1_hour': 10,
    'notif.j1_sms': 'ALWAYS',
    'notif.reminder_h3_enabled': true,
    'notif.reminder_h3_hours': 3,
    'notif.h3_sms': 'IF_NO_PUSH',
    'notif.sms_quiet_start': 22,
    'notif.sms_quiet_end': 8,
};

let partner: TestPartner;
let admin: TestAdmin;

before(async () => {
    partner = await newPartner('sms-veille');
    admin = await newAdmin('sms-veille', ['notifications.read']);
});

// ── Outils locaux ──────────────────────────────────────────────────────────

const usedOffsets = new Set<number>();
/** Jour D futur tiré au hasard (J+2 000 à J+3 680, hors des jours tirés par les autres suites), distinct des autres cas à ±2 jours près. */
function randomEventDay(): string {
    for (;;) {
        const offset = 2000 + randomInt(0, 1680);
        if ([-2, -1, 0, 1, 2].some((d) => usedOffsets.has(offset + d))) continue;
        usedOffsets.add(offset);
        return dakarDay(offset);
    }
}

function dayPlus(day: string, n: number): string {
    return dakarDay(n, new Date(`${day}T12:00:00.000Z`));
}

function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(3).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

interface VeilleEvent { ev: ReminderEvent; day: string; tomorrow: string; planningDay: string }

/** Événement PUBLIE le jour D à 20:00 (Dakar) et `n` porteurs neufs d'un billet à 0 F (numéros neufs, comptes ACTIF). */
async function veilleEvent(label: string, n: number): Promise<VeilleEvent> {
    const day = randomEventDay();
    const ev = await createReminderEvent(partner, `veille-${label}`, {
        startDate: day, startTime: '20:00', categories: [{ name: FREE_CATEGORY, price: 0, total: n + 20 }],
        title: shortTitle('Veille'), location: 'Salle Sorano', city: 'Dakar',
    });
    await massHolders(n, { eventId: ev.eventId, categoryId: ev.categories[FREE_CATEGORY].id, saleChannel: 'FREE', phoneVerified: true });
    return { ev, day, tomorrow: dayPlus(day, -1), planningDay: dayPlus(day, -2) };
}

/** notification_reminders_schedule au jour D-2 (Dakar) à `hhmm`, filtrée sur l'événement ; réponse brute. */
async function planEve(v: VeilleEvent, hhmm = '12:00'): Promise<Row> {
    const { data, error } = await service.rpc('notification_reminders_schedule', {
        p: { now: dakarAt(v.planningDay, hhmm).toISOString(), only_event_ids: [v.ev.eventId] },
    });
    assert.equal(error, null, `notification_reminders_schedule : ${error?.message} (code ${error?.code})`);
    const r = (data ?? {}) as Row;
    assert.equal(r.ok, true, `planification refusée : ${JSON.stringify(r)}`);
    return r;
}

function forecastOf(r: Row, what: string): Row {
    const f = r.forecast;
    assert.ok(f && typeof f === 'object', `${what} : champ « forecast » absent de la réponse de la planification (${JSON.stringify(r)})`);
    return f as Row;
}

async function forecastRows(day: string): Promise<OutboxRow[]> {
    return outboxRows({ type: 'ADMIN_SMS_FORECAST', keyPrefix: `ADMIN_SMS_FORECAST:${day}:` });
}

async function forecastSignals(rows: OutboxRow[]): Promise<Row[]> {
    if (rows.length === 0) return [];
    const { data, error } = await service.from('admin_signals').select('id, kind, ref_id').eq('kind', 'SMS_FORECAST').in('ref_id', rows.map((r) => r.id));
    assert.equal(error, null, `admin_signals : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Prévision sans alerte : `planned` attendu, alerted faux, aucune ligne ni signal pour le lendemain. */
async function assertNoAlert(v: VeilleEvent, r: Row, planned: number, cap: number, what: string): Promise<void> {
    const f = forecastOf(r, what);
    assert.equal(f.day, v.tomorrow, `${what} : jour prévu (${JSON.stringify(f)})`);
    assert.equal(Number(f.planned), planned, `${what} : SMS de rappel prévus (${JSON.stringify(f)})`);
    assert.equal(Number(f.cap), cap, `${what} : plafond (${JSON.stringify(f)})`);
    assert.equal(f.alerted, false, `${what} : aucune alerte (${JSON.stringify(f)})`);
    assert.deepEqual(await forecastRows(v.tomorrow), [], `${what} : aucune ligne ADMIN_SMS_FORECAST pour le ${v.tomorrow}`);
}

/** Prévision avec alerte : réponse, lignes de l'admin (in-app et email, clé du jour), données, un signal. */
async function assertAlert(v: VeilleEvent, r: Row, exp: { planned: number; cap: number; remaining: number }, what: string): Promise<OutboxRow[]> {
    const f = forecastOf(r, what);
    assert.deepEqual({ day: f.day, planned: Number(f.planned), cap: Number(f.cap), remaining: Number(f.remaining), alerted: f.alerted },
        { day: v.tomorrow, ...exp, alerted: true }, `${what} : prévision (${JSON.stringify(f)})`);
    const rows = await forecastRows(v.tomorrow);
    const mine = rows.filter((x) => x.recipient_user_id === admin.userId);
    assert.deepEqual(mine.map((x) => x.channel).sort(), ['EMAIL', 'IN_APP'], `${what} : une alerte par canal pour l'admin notifications.read (${JSON.stringify(mine.map((x) => x.idempotency_key))})`);
    for (const x of mine) {
        assert.equal(x.idempotency_key, `ADMIN_SMS_FORECAST:${v.tomorrow}:${admin.userId}:${x.channel}`, `${what} : clé par jour et par admin`);
        assert.equal(x.family, 'ESSENTIAL', `${what} : famille ESSENTIAL`);
        assert.deepEqual({ day: x.template_data.day, planned: Number(x.template_data.planned), cap: Number(x.template_data.cap), remaining: Number(x.template_data.remaining) },
            { day: v.tomorrow, ...exp }, `${what} : données de l'alerte (${JSON.stringify(x.template_data)})`);
    }
    assert.ok(rows.every((x) => x.channel !== 'SMS'), `${what} : aucune alerte admin par SMS`);
    assert.equal((await forecastSignals(rows)).length, 1, `${what} : un signal SMS_FORECAST pour le jour`);
    return rows;
}

// ── 1 et 2. Prévision contre budget ────────────────────────────────────────

describe('7.0 a Alerte de la veille : rappels SMS prévus pour demain au-delà du budget (M2.7, D16)', () => {
    test('701 porteurs, plafond 700 : deux planifications → une seule alerte ADMIN_SMS_FORECAST par canal, { planned: 701, cap: 700, remaining: 700 }, un signal', async () => {
        await withNotifSettings({ ...BASE_SETTINGS, 'notif.sms_optional_daily_cap': 700, 'notif.free_ticket_reminder_sms': 'SAME_AS_PAID' }, async () => {
            const v = await veilleEvent('701', 701);
            const first = await planEve(v, '12:00');
            const rows = await assertAlert(v, first, { planned: 701, cap: 700, remaining: 700 }, 'première planification');
            const second = await planEve(v, '12:05');
            const f2 = second.forecast as Row | undefined;
            assert.ok(!f2 || f2.alerted === false, `seconde planification du jour : aucune nouvelle alerte (${JSON.stringify(second)})`);
            const again = await forecastRows(v.tomorrow);
            assert.deepEqual(again.map((x) => x.id).sort(), rows.map((x) => x.id).sort(), 'seconde planification : aucune ligne de plus');
            assert.equal((await forecastSignals(again)).length, 1, 'seconde planification : toujours un seul signal');
            const created = second.created as Row | undefined;
            assert.equal(Number(created?.REMINDER_J1 ?? 0), 0, `la veille de la veille : aucun rappel créé (${JSON.stringify(second)})`);
        });
    });

    test('700 porteurs, plafond 700 : prévision égale au budget restant, aucune alerte', async () => {
        await withNotifSettings({ ...BASE_SETTINGS, 'notif.sms_optional_daily_cap': 700, 'notif.free_ticket_reminder_sms': 'SAME_AS_PAID' }, async () => {
            const v = await veilleEvent('700', 700);
            await assertNoAlert(v, await planEve(v), 700, 700, '700 porteurs');
        });
    });
});

// ── 3 et 4. Porteurs exclus de la prévision ────────────────────────────────

describe('7.0 a Alerte de la veille : porteurs sans SMS exclus de la prévision (D16, D17)', () => {
    test('billets gratuits seulement avec NEVER : non comptés ; témoin SAME_AS_PAID : comptés et alerte', async () => {
        await withNotifSettings({ ...BASE_SETTINGS, 'notif.sms_optional_daily_cap': 5, 'notif.free_ticket_reminder_sms': 'NEVER' }, async () => {
            const v = await veilleEvent('gratuits-never', 6);
            await assertNoAlert(v, await planEve(v), 0, 5, 'porteurs gratuits avec NEVER');
        });
        await withNotifSettings({ ...BASE_SETTINGS, 'notif.sms_optional_daily_cap': 5, 'notif.free_ticket_reminder_sms': 'SAME_AS_PAID' }, async () => {
            const v = await veilleEvent('gratuits-temoin', 6);
            await assertAlert(v, await planEve(v), { planned: 6, cap: 5, remaining: 5 }, 'témoin SAME_AS_PAID');
        });
    });

    test('plage de silence couvrant l’heure du J-1 (9 h - 11 h, J-1 à 10 h) : J-1 non comptés ; témoin J-1 à 12 h : comptés et alerte', async () => {
        const quiet = { 'notif.sms_quiet_start': 9, 'notif.sms_quiet_end': 11 };
        await withNotifSettings({ ...BASE_SETTINGS, ...quiet, 'notif.reminder_j1_hour': 10, 'notif.sms_optional_daily_cap': 5, 'notif.free_ticket_reminder_sms': 'SAME_AS_PAID' }, async () => {
            const v = await veilleEvent('silence', 6);
            await assertNoAlert(v, await planEve(v), 0, 5, 'J-1 dans la plage de silence');
        });
        await withNotifSettings({ ...BASE_SETTINGS, ...quiet, 'notif.reminder_j1_hour': 12, 'notif.sms_optional_daily_cap': 5, 'notif.free_ticket_reminder_sms': 'SAME_AS_PAID' }, async () => {
            const v = await veilleEvent('silence-temoin', 6);
            await assertAlert(v, await planEve(v), { planned: 6, cap: 5, remaining: 5 }, 'témoin J-1 hors plage');
        });
    });
});
