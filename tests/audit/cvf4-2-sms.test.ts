/**
 * Contre-vérification de la finition 4 — point 3 : SMS.
 *
 * Attendu (consigne) : un compte ne peut pas faire envoyer des SMS en masse à des numéros saisis ; les plafonds par numéro
 * tiennent ; chaque SMS tient en un segment au pire cas.
 *
 *  T3 (trou) : la limite par numéro (SMS_PER_PHONE_DAY, 30 par jour en production, lib/env.ts:62) est un seul compteur pour
 *     les SMS facultatifs et indispensables d'un même numéro (lib/sms/sms-guard.ts:117). La finition 4 ajoute à
 *     l'organisatrice un SMS de ventes toutes les 30 minutes par événement (SALES_UPDATE_SMS, facultatif) : de 07:00 à
 *     21:30, une journée de ventes d'un seul événement fait 30 SMS. Le soir, l'alerte « refus en série à une porte »
 *     (SCAN_REFUSALS_ALERT, indispensable) est refusée par la garde et la ligne passe SKIPPED (lib/notifications/
 *     dispatcher.ts:332-333) : perdue, jamais retentée.
 *  G3 (garde-fou, sans base) : SMS nouveaux ou élargis par la finition 4, valeurs extrêmes réalistes (titre de 60
 *     caractères, porte de 34, 12 345 billets, 123 456 789 F CFA, 1 234 refus sur la durée maximale réglable de 60 min,
 *     caractères hors GSM-7 dans les saisies) : un segment GSM-7 ; nom masqué (Ou*** B***) gardé tel quel.
 *
 * Mass SMS vers des numéros saisis : bloqué en amont (transferts 3 par billet et 10 par compte et par jour,
 * app/api/tickets/[id]/transfer/route.ts:70-86 ; invitations 50 par compte et par jour et 3 par numéro,
 * lib/tickets/invitation.service.ts:117) ; vérifié par lecture, couvert par les suites des lots 9 et 9 quater.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeLocal } from '../helpers/db';
import { getFakes } from '../fakes';
import { createPartnerEvent, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { dakarAt, dakarDay, dispatchAt, insertOutboxRow, outboxRows, withEnv } from '../parcours/notif-helpers';
import { NOTIFICATION_CATALOG, renderNotification } from '../../lib/notifications/catalog';

type Any = Record<string, unknown>;
const CAT = NOTIFICATION_CATALOG as unknown as Record<string, { sample: Any; channels: readonly string[] }>;
const CTX = { appUrl: 'https://app.eventvillage.sn' };

describe('cvf4 point 3 — limite par numéro partagée entre facultatifs et indispensables', () => {
    let partner: TestPartner;
    let eventId: string;
    let data: Any;

    before(async () => {
        partner = await newPartner('cvf4sms');
        eventId = (await createPartnerEvent(partner.partnerId, 'cvf4-t3', [{ name: 'Standard', price: 5_000, total: 500 }])).eventId;
        data = await writeLocal(async (c) => (await c.query<{ d: Any }>('SELECT public.notif_event_data($1::uuid) AS d', [eventId])).rows[0].d);
    });

    test('T3 : 30 SMS de ventes (07:00 → 21:30) puis l’alerte de porte du soir → l’alerte doit partir', async () => {
        await withEnv({ SMS_PER_PHONE_DAY: '30' }, async () => {
            const day = dakarDay(6);
            const sales: string[] = [];
            for (let k = 0; k < 30; k++) {
                const at = new Date(dakarAt(day, '07:00').getTime() + k * 30 * 60_000);
                sales.push((await insertOutboxRow({
                    type: 'SALES_UPDATE_SMS', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channel: 'SMS',
                    recipient_user_id: partner.userId, event_id: eventId,
                    template_data: { ...data, ticket_count: 3, total: 15_000, since: new Date(at.getTime() - 30 * 60_000).toISOString() },
                    due_at: at.toISOString(), next_attempt_at: at.toISOString(),
                })).id);
            }
            await dispatchAt(dakarAt(day, '21:45'), { ids: sales, limit: 100 });
            const salesRows = await outboxRows({ ids: sales });
            const sentSales = salesRows.filter((r) => r.status === 'SENT').length;
            assert.equal(sentSales, 30, `précondition : 30 SMS de ventes envoyés (${salesRows.map((r) => `${r.status}:${r.reason ?? ''}`).join(', ')})`);

            const alert = await insertOutboxRow({
                type: 'SCAN_REFUSALS_ALERT', family: 'ESSENTIAL', channel: 'SMS', recipient_user_id: partner.userId, event_id: eventId,
                template_data: { ...CAT.SCAN_REFUSALS_ALERT.sample, ...data },
                due_at: dakarAt(day, '22:00').toISOString(), next_attempt_at: dakarAt(day, '22:00').toISOString(),
            });
            const before = getFakes().sms.messagesTo(partner.phoneE164).length;
            await dispatchAt(dakarAt(day, '22:00'), { ids: [alert.id] });
            const r = (await outboxRows({ ids: [alert.id] }))[0];
            const after = getFakes().sms.messagesTo(partner.phoneE164).length;
            assert.equal(r.status, 'SENT',
                `SCAN_REFUSALS_ALERT (indispensable) ${r.status} ${r.reason ?? ''} — ${r.reason_detail ?? ''} ; SMS reçus par l'organisatrice : ${before} avant, ${after} après`);
        });
    });
});

// ── G3 : un segment au pire cas réaliste, nom masqué gardé (sans base) ─────

const GSM_BASIC = new Set([
    ...'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
]);
const sms = (type: string, over: Any): string =>
    (renderNotification(type as never, 'SMS' as never, { ...CAT[type].sample, ...over }, CTX) as unknown as { text: string }).text;

describe('cvf4 point 3 — un segment au pire cas', () => {
    const T = 'Fête de l’Indépendance — Côte d’Ivoire & Sénégal [VIP] 2026 🎉';
    const G = 'Porte principale côté parking Est';
    const cases: Array<[string, Any]> = [
        ['SALES_UPDATE_SMS', { title: T, ticket_count: 12_345, total: 123_456_789 }],
        ['PARTNER_DAILY_SUMMARY', { title: T, event_count: 1, sold_count: 12_345, sold_amount: 123_456_789, refund_count: 1_234, refund_amount: 12_345_678, entry_count: 12_345 }],
        ['PARTNER_DAILY_SUMMARY', { title: undefined, event_count: 12, sold_count: 12_345, sold_amount: 123_456_789, refund_count: 1_234, refund_amount: 12_345_678, entry_count: 12_345 }],
        ['PARTNER_REFUND_REQUESTS', { title: T, ticket_count: 1_234, amount: 12_345_678 }],
        ['SCAN_REFUSALS_ALERT', { title: T, gate_name: G, refused_count: 1_234, window_minutes: 60 }],
        ['REFUND_REQUESTED', { title: T, by: 'ADMIN', operator: 'ORANGE_MONEY', amount: 12_345_678 }],
        ['ENTRY_WELCOME', { title: T, organizer: 'Association culturelle des jeunes de Pikine & Guédiawaye' }],
        ['ENTRY_THANKS', { title: T, organizer: 'Association culturelle des jeunes de Pikine & Guédiawaye' }],
        ['CASH_REFUND_MARKED_BY_ADMIN', { title: T, amount: 12_345_678 }],
        ['SHIFT_CLOSED_BY_OTHER', { title: T, closed_by: 'ADMIN', declared: 123_456_789 }],
        ['CONTROLLER_INVITATION_DECLINED', { controller_name: 'Ou*** B***' }],
        ['CONTROLLER_INVITATION_EXPIRED', { controller_name: 'Kh*** S***' }],
    ];
    for (const [type, over] of cases) {
        test(`G3 : ${type} ${JSON.stringify(over).slice(0, 80)}`, () => {
            const text = sms(type, over);
            const bad = [...text].filter((c) => !GSM_BASIC.has(c));
            assert.deepEqual(bad, [], `caractères hors GSM-7 de base dans « ${text} »`);
            assert.ok(text.length <= 160, `${text.length} caractères : « ${text} »`);
            if (typeof over.controller_name === 'string') assert.ok(text.includes(over.controller_name), `nom masqué perdu : « ${text} »`);
        });
    }
});
