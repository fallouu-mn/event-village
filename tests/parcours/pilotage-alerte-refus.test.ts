/**
 * Lot 9 ter, tâche 9t.18 (consigne 4 : « alerte quand une porte enregistre beaucoup de refus ») — trigger
 * trg_ticket_scans_refusal_alert (F44) : au plus une alerte SCAN_REFUSALS_ALERT par porte et par tranche de durée, à la
 * propriétaire seule (cloche, push, email ; aucun SMS), réglages access.refusal_alert_threshold (défaut 10) et
 * access.refusal_alert_minutes (défaut 5), SUPERADMIN seul (contrat 5.D, D.0, D.1.2 (2), (3), (7), (9), D.1.5, D.1.6 T2 ;
 * arbitrage 21 ; X8 ; rectifications 1, 2 et 5 de D).
 *
 * Montage A : événement à zones, une zone ENTRÉE (toutes catégories) avec « Porte A » et « Porte B » ; trois contrôleurs
 * à la Porte A, un à la Porte B ; seuil 3 en 5 minutes par withAccessSettings (clés ajoutées par R0, acces-helpers) ;
 * refus = charges TCK-ALERTE-<n> (refus invalid ou dynamic_qr_required, patron scan-controleur-stats:289-292) ; lignes de
 * notification_outbox lues en service_role, filtrées sur le type et l'événement.
 * Le cas « le tableau de bord montre la porte en alerte » suit les deux premiers (même fenêtre de 5 minutes) : l'ordre
 * des cas dans le fichier diffère de la numérotation du contrat, les titres sont ceux du contrat.
 *
 * Rouge avant correctif (S-P fix(9t.reglages) M02, fix(9t.18) M10 ; S-M fix(9t.registre) M04 ; C : M09) : réglages
 * absents (withAccessSettings échoue en nommant la clé), route des zones absente (createZonedEvent la nomme), aucun
 * trigger ni type au registre, scan_log_at absente. Le cas « refus qui ne comptent pas » et le cas « bornes » ne passent
 * qu'avec les réglages de M02 (sans eux : clé absente, UNKNOWN_KEY).
 * Aucune violation laissée en base : le compte suspendu (X8) vit dans une transaction annulée.
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { inRolledBackTransaction } from '../helpers/db';
import { signInAs } from '../helpers/fixtures';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    authed, createTimedEvent, newController, scan, ticketPayload, withAccessSettings, type AccessSettingKey, type RouteResult,
} from './acces-helpers';
import { newAdminWith } from './terrain-helpers';
import { invoke, listAt, pilotageOk, routeHandler, show, type Row } from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, scanAtGate, type ZonedEvent, type ZoneSpec } from './zones-helpers';

const TYPE = 'SCAN_REFUSALS_ALERT';
const SIMPLE = 'SIMPLE';
const CATEGORIES: CategorySpec[] = [{ name: SIMPLE, price: 5_000, total: 20 }];
const ZONE = 'Entrée principale';
const ZONES: ZoneSpec[] = [{ name: ZONE, kind: 'ENTREE', admits: [SIMPLE], gates: ['Porte A', 'Porte B'] }];
const ALERT: Partial<Record<AccessSettingKey, unknown>> = { 'access.refusal_alert_threshold': 3, 'access.refusal_alert_minutes': 5 };
const REFUSALS = ['invalid', 'dynamic_qr_required'];
const MARK = randomUUID().slice(0, 8).toUpperCase();

let partner: TestPartner;
let counter = 0;

interface MontageA { ev: ZonedEvent; a: Buyer[]; b: Buyer }
let montageAP: Promise<MontageA> | null = null;

before(async () => {
    partner = await newPartner('pil9ter-alerte');
});

after(async () => {
    await assertLot9terInvariants('pilotage-alerte-refus');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function controllerAt(ev: ZonedEvent, gate: string, label: string): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { label });
    const res = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, gate));
    assert.equal(res.status, 200, `porte ${gate} attribuée à ${label} (PATCH /api/partner/team/gate) : ${show(res)}`);
    return ctrl;
}

function montageA(): Promise<MontageA> {
    montageAP ??= (async () => {
        const ev = await createZonedEvent(partner, 'pil9ter-alerte-A', CATEGORIES, ZONES);
        const a = [await controllerAt(ev, 'Porte A', 'alerte-a1'), await controllerAt(ev, 'Porte A', 'alerte-a2'), await controllerAt(ev, 'Porte A', 'alerte-a3')];
        const b = await controllerAt(ev, 'Porte B', 'alerte-b1');
        return { ev, a, b };
    })();
    return montageAP;
}

function nextCharge(): string {
    counter += 1;
    return `TCK-ALERTE-${MARK}-${counter}`;
}

/** Un refus compté pour l'alerte : charge illisible présentée à une porte ; le verdict du scan reste le sien. */
async function refuseAt(user: Buyer, ev: ZonedEvent, gate: string, what: string): Promise<void> {
    const res = await scanAtGate(user, { eventId: ev.eventId, payload: nextCharge() }, gateOf(ev, gate));
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
    assert.ok(REFUSALS.includes(String(res.body.result)), `${what} : refus ${REFUSALS.join(' ou ')} attendu, ${show(res)}`);
}

async function alertRows(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox')
        .select('channel, status, reason, recipient_user_id, recipient_phone, template_data, idempotency_key')
        .eq('type', TYPE).eq('event_id', eventId).order('created_at').order('channel');
    assert.equal(error, null, `notification_outbox (${TYPE}) : ${error?.message}`);
    return (data ?? []) as Row[];
}

function channels(rows: Row[]): string[] {
    return rows.map((r) => String(r.channel)).sort();
}

function dataOf(row: Row): Row {
    return (row.template_data ?? {}) as Row;
}

async function settingsCall(key: string, value: unknown, actor: string): Promise<Row> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: actor, p_reason: 'bornes de l’alerte de refus (test du lot 9 ter)' });
    assert.equal(error, null, `finance_setting_set(${key}, ${JSON.stringify(value)}) : ${error?.message}`);
    return (data ?? {}) as Row;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('9t.18 T2 — alerte de refus en série à une porte', () => {
    test('seuil 3 en 5 minutes : deux refus ne donnent rien, le troisième donne une alerte par canal à la propriétaire, les suivants rien de plus', async () => {
        await withAccessSettings(ALERT, async () => {
            const { ev, a } = await montageA();
            await refuseAt(a[0], ev, 'Porte A', 'refus 1 à la Porte A');
            await refuseAt(a[1], ev, 'Porte A', 'refus 2 à la Porte A');
            assert.deepEqual(await alertRows(ev.eventId), [], 'deux refus : aucune alerte');
            await refuseAt(a[2], ev, 'Porte A', 'refus 3 à la Porte A');
            const rows = await alertRows(ev.eventId);
            assert.deepEqual(channels(rows), ['EMAIL', 'IN_APP', 'PUSH'], `une ligne par canal, aucun SMS : ${JSON.stringify(rows)}`);
            for (const r of rows) {
                assert.equal(r.recipient_user_id, partner.userId, `destinataire : la propriétaire seule (${r.channel})`);
                assert.equal(r.recipient_phone, null, `aucun numéro (${r.channel})`);
                const d = dataOf(r);
                assert.deepEqual(
                    { gate_name: d.gate_name, zone_name: d.zone_name, refused_count: d.refused_count, window_minutes: d.window_minutes, threshold: d.threshold },
                    { gate_name: 'Porte A', zone_name: ZONE, refused_count: 3, window_minutes: 5, threshold: 3 }, `données de l’alerte (${r.channel})`);
            }
            await refuseAt(a[0], ev, 'Porte A', 'refus 4 à la Porte A');
            await refuseAt(a[1], ev, 'Porte A', 'refus 5 à la Porte A');
            assert.equal((await alertRows(ev.eventId)).length, 3, 'au plus une alerte par porte et par durée');
        });
    });

    test('porte B : alerte distincte', async () => {
        await withAccessSettings(ALERT, async () => {
            const { ev, b } = await montageA();
            const before0 = await alertRows(ev.eventId);
            assert.equal(before0.length, 3, `garde-fou : l’alerte de la Porte A du cas précédent (${before0.length} ligne(s))`);
            for (let i = 1; i <= 3; i++) await refuseAt(b, ev, 'Porte B', `refus ${i} à la Porte B`);
            const rows = await alertRows(ev.eventId);
            assert.equal(rows.length, 6, 'trois lignes de plus');
            const added = rows.filter((r) => dataOf(r).gate_name === 'Porte B');
            assert.deepEqual(channels(added), ['EMAIL', 'IN_APP', 'PUSH'], 'une ligne par canal pour la Porte B');
            const keysA = new Set(before0.map((r) => String(r.idempotency_key)));
            for (const r of added) assert.ok(!keysA.has(String(r.idempotency_key)), `clé distincte de celle de la Porte A : ${String(r.idempotency_key)}`);
        });
    });

    test('le tableau de bord montre la porte en alerte', async () => {
        await withAccessSettings(ALERT, async () => {
            const { ev } = await montageA();
            const body = await pilotageOk(partner, ev.eventId, 'entries', 'la partenaire propriétaire');
            const alerts = listAt(body, 'alerts', 'portes en alerte');
            const porteA = alerts.find((x) => x.name === 'Porte A');
            assert.ok(porteA, `Porte A en alerte : ${JSON.stringify(alerts)}`);
            assert.deepEqual(
                { name: porteA.name, zone_name: porteA.zone_name, refused: Number(porteA.refused), threshold: Number(porteA.threshold), window_minutes: Number(porteA.window_minutes) },
                { name: 'Porte A', zone_name: ZONE, refused: 5, threshold: 3, window_minutes: 5 }, 'ligne de la Porte A');
            assert.deepEqual(body.alert_settings, { threshold: 3, minutes: 5 }, 'réglages servis');
        });
    });

    test('refus qui ne comptent pas : scanneur non autorisé, contrôle pas encore ouvert', async () => {
        await withAccessSettings(ALERT, async () => {
            const ev = await createTimedEvent(partner.partnerId, 'pil9ter-alerte-pas-ouvert', CATEGORIES, { startsInHours: 72 });
            const ctrl = await newController(partner, ev.eventId, { label: 'alerte-pas-ouvert' });
            const stranger = await newController(partner, null, { label: 'alerte-non-affecte' });
            const { tickets } = await buyConfirmed(await newBuyer('pil9ter-alerte-pas-ouvert'), ev, [[SIMPLE, 1]]);
            const ticketId = String(tickets[0].id);
            for (let i = 1; i <= 4; i++) {
                const res = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
                assert.equal(res.status, 200, `scan ${i} trop tôt : ${show(res)}`);
                assert.equal(res.body.result, 'event_not_open', `scan ${i} : contrôle pas encore ouvert, ${show(res)}`);
            }
            for (let i = 1; i <= 4; i++) {
                const res = await scan(stranger, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
                assert.equal(res.status, 403, `scan ${i} d’un compte non affecté : ${show(res)}`);
            }
            const { data, error } = await service.from('ticket_scans').select('result').eq('event_id', ev.eventId);
            assert.equal(error, null, `ticket_scans : ${error?.message}`);
            assert.deepEqual((data ?? []).map((r) => String(r.result)).sort(), [...Array(4).fill('event_not_open'), ...Array(4).fill('forbidden')],
                'garde-fou : huit refus journalisés (au-dessus du seuil 3)');
            assert.deepEqual(await alertRows(ev.eventId), [], 'aucune alerte : ni les droits du contrôleur, ni les horaires ne comptent');
        });
    });

    test('concurrence : six refus simultanés à la même porte par trois contrôleurs donnent une seule alerte', async () => {
        await withAccessSettings(ALERT, async () => {
            const ev = await createZonedEvent(partner, 'pil9ter-alerte-course', CATEGORIES, ZONES);
            const ctrls = [await controllerAt(ev, 'Porte A', 'course-1'), await controllerAt(ev, 'Porte A', 'course-2'), await controllerAt(ev, 'Porte A', 'course-3')];
            const settled = await Promise.allSettled(ctrls.flatMap((c) => [0, 1].map(() =>
                scanAtGate(c, { eventId: ev.eventId, payload: nextCharge() }, gateOf(ev, 'Porte A')))));
            for (const s of settled) {
                assert.equal(s.status, 'fulfilled', `appel rejeté : ${s.status === 'rejected' ? String(s.reason) : ''}`);
                const r = (s as PromiseFulfilledResult<RouteResult>).value;
                assert.equal(r.status, 200, show(r));
                assert.ok(REFUSALS.includes(String(r.body.result)), `refus attendu : ${show(r)}`);
            }
            assert.deepEqual(channels(await alertRows(ev.eventId)), ['EMAIL', 'IN_APP', 'PUSH'], 'exactement une alerte (une ligne par canal)');
        });
    });

    test('événement sans zone : la porte de l’alerte est le point d’entrée de l’affectation', async () => {
        await withAccessSettings(ALERT, async () => {
            const ev = await createTimedEvent(partner.partnerId, 'pil9ter-alerte-sans-zone', CATEGORIES);
            const ctrl = await newController(partner, ev.eventId, { label: 'alerte-est' });
            const handler = await routeHandler('../../app/api/partner/team/entry-point/route', 'PATCH', 'PATCH /api/partner/team/entry-point');
            const set = await invoke(handler, authed('/api/partner/team/entry-point', 'PATCH', partner, { eventId: ev.eventId, controllerId: ctrl.userId, entryPoint: 'Entrée Est' }));
            assert.equal(set.status, 200, `point d’entrée « Entrée Est » : ${show(set)}`);
            for (let i = 1; i <= 3; i++) {
                const res = await scan(ctrl, { eventId: ev.eventId, payload: nextCharge() });
                assert.equal(res.status, 200, `refus ${i} : ${show(res)}`);
                assert.ok(REFUSALS.includes(String(res.body.result)), `refus ${i} : ${show(res)}`);
            }
            const rows = await alertRows(ev.eventId);
            assert.deepEqual(channels(rows), ['EMAIL', 'IN_APP', 'PUSH'], 'une alerte');
            for (const r of rows) {
                assert.deepEqual({ gate_name: dataOf(r).gate_name, zone_name: dataOf(r).zone_name }, { gate_name: 'Entrée Est', zone_name: null }, `porte = point d’entrée (${r.channel})`);
            }
        });
    });

    test('réglages : bornes et SUPERADMIN seul', async () => {
        const sa = await superadminId();
        for (const bad of [2, 501, 2.5, '10']) {
            const r = await settingsCall('access.refusal_alert_threshold', bad, sa);
            assert.deepEqual({ ok: r.ok, code: r.code }, { ok: false, code: 'INVALID_VALUE' }, `seuil ${JSON.stringify(bad)} : ${JSON.stringify(r)}`);
        }
        for (const bad of [0, 61]) {
            const r = await settingsCall('access.refusal_alert_minutes', bad, sa);
            assert.deepEqual({ ok: r.ok, code: r.code }, { ok: false, code: 'INVALID_VALUE' }, `durée ${bad} : ${JSON.stringify(r)}`);
        }
        const admin = await newAdminWith(['events.read'], { label: 'pil9ter-reglage' });
        const denied = await settingsCall('access.refusal_alert_threshold', 12, admin.userId);
        assert.deepEqual({ ok: denied.ok, code: denied.code }, { ok: false, code: 'FORBIDDEN' }, `acteur ADMIN : ${JSON.stringify(denied)}`);

        const { data: stored, error } = await service.from('platform_settings').select('key, value')
            .in('key', ['access.refusal_alert_threshold', 'access.refusal_alert_minutes']).order('key');
        assert.equal(error, null, `platform_settings : ${error?.message}`);
        assert.deepEqual((stored ?? []).map((r) => ({ key: r.key, value: r.value })), [
            { key: 'access.refusal_alert_minutes', value: { value: 5 } },
            { key: 'access.refusal_alert_threshold', value: { value: 10 } },
        ], 'valeurs par défaut stockées (aucun refus n’a rien écrit)');
        const s = await signInAs('SUPERADMIN');
        const { GET } = await importModule('../../app/api/admin/finance-settings/route');
        const res: Response = await GET(jsonRequest('/api/admin/finance-settings', 'GET', s.accessToken));
        const body = (await res.json()) as { settings?: Array<{ key: string; value: unknown }> };
        assert.equal(res.status, 200, `GET /api/admin/finance-settings (SUPERADMIN) : HTTP ${res.status}`);
        const served = Object.fromEntries((body.settings ?? []).filter((x) => x.key.startsWith('access.refusal_alert_')).map((x) => [x.key, x.value]));
        assert.deepEqual(served, { 'access.refusal_alert_threshold': 10, 'access.refusal_alert_minutes': 5 }, 'les deux clés servies par la route');
    });

    test('compte de la partenaire suspendu : l’alerte est gardée sans être envoyée', async () => {
        await withAccessSettings(ALERT, async () => {
            const ev = await createZonedEvent(partner, 'pil9ter-alerte-suspendue', CATEGORIES, ZONES);
            const ctrl = await controllerAt(ev, 'Porte A', 'alerte-suspendue');
            const gate = gateOf(ev, 'Porte A');
            const zone = ev.zones[ZONE].id;
            const inside = await inRolledBackTransaction(async (db) => {
                await db.query(`UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1`, [partner.userId]);
                for (let i = 0; i < 3; i++) {
                    await db.query(
                        `SELECT public.scan_log_at(NULL, $1::uuid, $2::uuid, 'invalid', NULL, FALSE, 'QR', FALSE, $3, NULL, NULL, NULL, $4::uuid, $5::uuid)`,
                        [ev.eventId, ctrl.userId, randomBytes(32).toString('hex'), gate, zone]);
                }
                return (await db.query<{ channel: string; status: string; reason: string | null }>(
                    `SELECT channel, status, reason FROM public.notification_outbox WHERE type = $1 AND event_id = $2 ORDER BY channel`, [TYPE, ev.eventId])).rows;
            });
            assert.deepEqual(inside.map((r) => ({ channel: r.channel, status: r.status, reason: r.reason })), [
                { channel: 'EMAIL', status: 'SKIPPED', reason: 'ACCOUNT_SUSPENDED' },
                { channel: 'IN_APP', status: 'SKIPPED', reason: 'ACCOUNT_SUSPENDED' },
                { channel: 'PUSH', status: 'SKIPPED', reason: 'ACCOUNT_SUSPENDED' },
            ], 'trois lignes gardées, aucune envoyée (notif_account_blocked lit users.status)');
            assert.deepEqual(await alertRows(ev.eventId), [], 'ROLLBACK : aucune ligne ne reste');
        });
    });
});
