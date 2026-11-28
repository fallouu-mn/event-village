/**
 * Lot « Avis », phase 2 (étape 7) — règle de nuit de CHAQUE type nouveau du lot, à l'envoi réel (notification_outbox_claim).
 * Base LOCALE. Réglage de nuit par défaut (1 h - 7 h, heure de Dakar).
 *
 * Pour chaque type nouveau : une ligne (SMS si le type en a un, sinon notification du téléphone) due à 02:00, envoyeur passé à
 * 02:00 : un type « reporté la nuit » (DEFER) reste en attente, décision DEFER, motif NIGHT ; un type urgent (SEND) n'est pas
 * reporté. Registre = catalogue pour la règle de nuit. Exception des 12 h : un changement de poste (CONTROLLER_POST_CHANGED)
 * pour un événement qui commence à 05:00 part tout de suite, même à 02:00.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { shiftEventDates } from './cycle-helpers';
import { dakarAt, dakarDay, dispatchAt, insertOutboxRow, outboxRows, type OutboxRow } from './notif-helpers';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

/** Types nouveaux du lot et règle de nuit attendue (règle du 27/11). */
const NEW_TYPES: Record<string, 'SEND' | 'DEFER'> = {
    WITHDRAWAL_REQUESTED: 'SEND', // sécurité : part la nuit
    PARTNER_RESUBMITTED_ACK: 'DEFER',
    SHIFT_DISCREPANCY_VALIDATED: 'DEFER',
    CONTROLLER_POST_CHANGED: 'DEFER', // sauf événement à moins de 12 h
    ACCOUNT_WELCOME: 'DEFER',
    ADMIN_MONEY_SMS: 'DEFER',
    REFERRAL_SIGNUP: 'DEFER',
    REFERRAL_EARNED: 'DEFER',
    REFERRAL_AVAILABLE: 'DEFER',
    PAYMENT_NOT_COMPLETED: 'DEFER',
    ACCOUNT_ANONYMIZATION_NOTICE: 'SEND', // juste avant l'effacement : tout de suite
};

type Tpl = { channels: readonly string[]; family: string; topic: string | null; nightPolicy: string; sample: Record<string, unknown> };
const tpl = (type: string): Tpl => (NOTIFICATION_CATALOG as unknown as Record<string, Tpl>)[type];

let buyer: Buyer;
let partner: TestPartner;
const day = dakarDay(3);
const at = dakarAt(day, '02:00');

before(async () => {
    buyer = await newBuyer('avis2-nuit');
    partner = await newPartner('avis2-nuit');
});

after(async () => {
    await assertNotificationInvariants('avis2-nuit');
});

const decision = (r: OutboxRow): { outcome?: string; reason?: string } => (r.decision ?? {}) as { outcome?: string; reason?: string };

async function nightRow(type: string, data: Record<string, unknown>, eventId?: string): Promise<OutboxRow> {
    const t = tpl(type);
    const channel = t.channels.includes('SMS') ? 'SMS' : 'PUSH';
    const row = await insertOutboxRow({
        type, family: t.family as 'ESSENTIAL' | 'OPTIONAL', topic: t.topic, channel, recipient_user_id: buyer.userId,
        ...(channel === 'SMS' ? { recipient_phone: buyer.phoneE164 } : {}),
        event_id: eventId ?? null, template_data: data, due_at: at.toISOString(), next_attempt_at: at.toISOString(),
    });
    await dispatchAt(at, { ids: [row.id] });
    return (await outboxRows({ ids: [row.id] }))[0];
}

describe('étape 7 — règle de nuit de chaque type nouveau', () => {
    test('registre = catalogue = règle attendue', async () => {
        const { data, error } = await service.from('notification_types').select('type, night_policy').in('type', Object.keys(NEW_TYPES));
        assert.equal(error, null, error?.message);
        const got = Object.fromEntries((data ?? []).map((r) => [String(r.type), String(r.night_policy)]));
        assert.deepEqual(got, NEW_TYPES, 'registre');
        for (const [type, night] of Object.entries(NEW_TYPES)) assert.equal(tpl(type).nightPolicy, night, `${type} au catalogue`);
    });

    for (const [type, night] of Object.entries(NEW_TYPES)) {
        test(`${type} préparé à 02:00 : ${night === 'DEFER' ? 'reporté à la fin de la nuit' : 'jamais reporté'}`, async () => {
            const r = await nightRow(type, tpl(type).sample);
            if (night === 'DEFER') {
                assert.equal(r.status, 'PENDING', `${type} : toujours en attente (${r.status} ${r.reason ?? ''})`);
                assert.deepEqual([decision(r).outcome, decision(r).reason], ['DEFER', 'NIGHT'], `${type} : décision ${JSON.stringify(r.decision)}`);
            } else {
                assert.notEqual(decision(r).outcome, 'DEFER', `${type} : jamais reporté la nuit (${JSON.stringify(r.decision)})`);
                assert.notEqual(r.status, 'PENDING', `${type} : traité à 02:00 (${r.status} ${r.reason ?? ''})`);
            }
        });
    }

    test('CONTROLLER_POST_CHANGED pour un événement qui commence à 05:00 : pas de report à 02:00 (règle des 12 h)', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'avis2-nuit-proche', [{ name: 'Standard', price: 5_000, total: 20 }]);
        const hours = (dakarAt(day, '05:00').getTime() - Date.now()) / 3_600_000;
        await shiftEventDates(ev.eventId, { startsInHours: hours, durationHours: 4 });
        const r = await nightRow('CONTROLLER_POST_CHANGED', { ...tpl('CONTROLLER_POST_CHANGED').sample, event_id: ev.eventId }, ev.eventId);
        assert.notEqual(decision(r).outcome, 'DEFER', `événement proche : pas de report (${JSON.stringify(r.decision)})`);
    });
});
