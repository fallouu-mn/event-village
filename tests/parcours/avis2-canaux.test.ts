/**
 * Lot « Avis », phase 2, sous-lot 2a (écarts B1 à B6, B11 à B14 de docs/avis-inventaire.md) — canaux ajoutés. Base LOCALE.
 *
 *  1. Registre = règle du 27/11 : chaque type élargi porte ses nouveaux canaux et sa règle de nuit (B1 à B6, B11 à B14) ;
 *     EVENT_SUSPENDED_HOLDER indispensable (plus de sujet), reporté la nuit ; les rappels de table restent facultatifs (D5).
 *  2. B2 : numéro changé par le profil (account_phone_finalize) → SMS à l'ancien numéro (inchangé), email, cloche et
 *     notification au compte, chacun une seule fois ; cloche « Numéro de téléphone modifié » vers le profil.
 *  3. B13 : préférence « Reprise d'un événement » coupée pour le SMS → la suspension part quand même (SMS en attente), la
 *     reprise est coupée (SKIPPED PREFERENCE_DISABLED).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { inRolledBackTransaction } from '../helpers/db';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import { outboxRows, type OutboxRow } from './notif-helpers';
import { NOTIFICATION_CATALOG, renderNotification } from '../../lib/notifications/catalog';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const channels = (rows: OutboxRow[]): string[] => rows.map((r) => r.channel).sort();

after(async () => {
    await assertNotificationInvariants('avis2-canaux');
});

/** Canaux et règle de nuit attendus après le sous-lot 2a. */
const EXPECTED: Record<string, { channels: string[]; night: 'SEND' | 'DEFER'; family?: 'ESSENTIAL' | 'OPTIONAL' }> = {
    TRANSFER_RECEIVED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    PHONE_CHANGED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    EMAIL_ADDED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    ACCOUNT_LOGIN_FAILURES: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    PAYMENT_SUCCESS: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    ORDER_COURIER_INVITED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'DEFER' },
    ADMIN_EVENT_PUBLISHED: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_EVENT_WITHDRAWN: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_EVENT_CHANGED: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_EVENT_CANCELLED: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_NOTIFICATION_FAILED: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_SMS_DAILY_THRESHOLD: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_SMS_OPTIONAL_80: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    ADMIN_SMS_FORECAST: { channels: ['EMAIL', 'IN_APP', 'PUSH'], night: 'DEFER' },
    SUPERADMIN_PROMOTED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    ADMIN_PHONE_CONFIRMED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    ADMIN_BACKUP_CODE_USED: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'SEND' },
    EVENT_SUSPENDED_HOLDER: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'DEFER', family: 'ESSENTIAL' },
    NEW_ORDER: { channels: ['IN_APP', 'PUSH'], night: 'DEFER', family: 'OPTIONAL' },
    TABLE_REMINDER: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'DEFER', family: 'OPTIONAL' },
    EVENT_TABLE_SEATS_REMINDER: { channels: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], night: 'DEFER', family: 'OPTIONAL' },
};

describe('2a.1 — registre et catalogue : canaux ajoutés, règle de nuit', () => {
    test('chaque type élargi : canaux et nuit au registre comme au catalogue ; suspension indispensable, rappels de table facultatifs', async () => {
        const { data, error } = await service.from('notification_types').select('type, family, topic, channels, night_policy').in('type', Object.keys(EXPECTED));
        assert.equal(error, null, error?.message);
        const byType = new Map((data ?? []).map((r) => [String(r.type), r]));
        const issues: string[] = [];
        for (const [type, exp] of Object.entries(EXPECTED)) {
            const r = byType.get(type);
            if (!r) { issues.push(`${type} absent du registre`); continue; }
            const regChannels = [...(r.channels as string[])].sort();
            const cat = NOTIFICATION_CATALOG[type as keyof typeof NOTIFICATION_CATALOG];
            if (JSON.stringify(regChannels) !== JSON.stringify(exp.channels)) issues.push(`${type} registre ${regChannels} ≠ ${exp.channels}`);
            if (JSON.stringify([...cat.channels].sort()) !== JSON.stringify(exp.channels)) issues.push(`${type} catalogue ${cat.channels} ≠ ${exp.channels}`);
            if (r.night_policy !== exp.night || cat.nightPolicy !== exp.night) issues.push(`${type} nuit ${r.night_policy}/${cat.nightPolicy} ≠ ${exp.night}`);
            if (exp.family && (r.family !== exp.family || cat.family !== exp.family)) issues.push(`${type} famille ${r.family}/${cat.family} ≠ ${exp.family}`);
        }
        assert.deepEqual(issues, []);
        assert.equal(byType.get('EVENT_SUSPENDED_HOLDER')!.topic, null, 'suspension : plus de sujet (aucune préférence)');
    });
});

describe('2a.2 — B2 : numéro changé par le profil', () => {
    test('SMS à l’ancien numéro, email, cloche et notification au compte, une fois chacun', async () => {
        const b = await newBuyer('avis2-numero');
        const { data: u, error } = await service.from('users').select('phone').eq('id', b.userId).single();
        assert.equal(error, null, error?.message);
        const oldPhone = String(u!.phone);
        const newPhone = randomSenegalPhone('76');
        // Comme la route (app/api/profile/phone) : le numéro de l'authentification change d'abord (invariant v des suites)
        const { error: authErr } = await service.auth.admin.updateUserById(b.userId, { phone: newPhone });
        assert.equal(authErr, null, authErr?.message);
        const { data, error: rpcErr } = await service.rpc('account_phone_finalize', {
            p: { user_id: b.userId, new_phone: newPhone, expected_phone: oldPhone, keep_session_id: randomUUID() },
        });
        assert.equal(rpcErr, null, rpcErr?.message);
        assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        const account = await outboxRows({ type: 'PHONE_CHANGED', userId: b.userId });
        assert.deepEqual(channels(account), ['EMAIL', 'IN_APP', 'PUSH'], JSON.stringify(account.map((r) => [r.channel, r.status, r.reason])));
        const oldE164 = `+${oldPhone.replace(/^\+/, '')}`;
        const sms = await outboxRows({ type: 'PHONE_CHANGED', phone: oldE164 });
        assert.deepEqual(channels(sms), ['SMS'], 'SMS à l’ancien numéro, inchangé');
        const r = renderNotification('PHONE_CHANGED', 'IN_APP', account.find((x) => x.channel === 'IN_APP')!.template_data, CTX);
        assert.deepEqual(r.channel === 'IN_APP' && [r.title, r.actionUrl], ['Numéro de téléphone modifié', '/profile']);
    });
});

describe('2a.4 — B14 : ventes groupées, une seule notification du téléphone par fenêtre de 15 minutes', () => {
    test('deux ventes dans la fenêtre : une cloche et une notification, chacune avec les deux ventes', async () => {
        const owner = await newBuyer('avis2-ventes');
        const eventId = randomUUID();
        const rows = await inRolledBackTransaction(async (db) => {
            for (const n of [2, 3]) {
                await db.query('SELECT public.notif_enqueue_grouped($1::jsonb)', [JSON.stringify({
                    type: 'NEW_ORDER', scope: `${eventId}:${owner.userId}`, window_minutes: 15, user_id: owner.userId,
                    data: { ...NOTIFICATION_CATALOG.NEW_ORDER.sample, event_id: eventId }, add: { ticket_count: n, total: n * 5_000, order_count: 1 },
                })]);
            }
            const { rows: r } = await db.query<{ channel: string; template_data: Record<string, unknown> }>(
                'SELECT channel, template_data FROM public.notification_outbox WHERE recipient_user_id = $1 AND type = $2 ORDER BY channel', [owner.userId, 'NEW_ORDER']);
            return r;
        });
        assert.deepEqual(rows.map((r) => r.channel), ['IN_APP', 'PUSH'], 'une cloche et une notification');
        for (const r of rows) assert.deepEqual([Number(r.template_data.order_count), Number(r.template_data.ticket_count)], [2, 5], `${r.channel} : les deux ventes`);
    });
});

describe('2a.3 — B13 : la suspension ne se coupe plus, la reprise si', () => {
    test('EVENT_UPDATES/SMS coupé : suspension SMS en attente, reprise SKIPPED PREFERENCE_DISABLED', async () => {
        const b = await newBuyer('avis2-pref');
        const { error } = await service.rpc('notification_preference_set', { p: { user_id: b.userId, topic: 'EVENT_UPDATES', channel: 'SMS', enabled: false } });
        assert.equal(error, null, error?.message);
        const sample = (type: 'EVENT_SUSPENDED_HOLDER' | 'EVENT_REACTIVATED_HOLDER') => NOTIFICATION_CATALOG[type].sample;
        const states = await inRolledBackTransaction(async (db) => {
            const out: Record<string, [string, string | null]> = {};
            for (const type of ['EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER'] as const) {
                const key = `${type}:${randomUUID()}`;
                await db.query('SELECT public.notif_enqueue($1::jsonb)', [JSON.stringify({ type, key, user_id: b.userId, data: sample(type), channels: ['SMS'] })]);
                const { rows } = await db.query<{ status: string; reason: string | null }>('SELECT status, reason FROM public.notification_outbox WHERE idempotency_key = $1', [`${key}:SMS`]);
                out[type] = [rows[0].status, rows[0].reason];
            }
            return out;
        });
        assert.deepEqual(states.EVENT_SUSPENDED_HOLDER, ['PENDING', null], 'suspension : indispensable');
        assert.deepEqual(states.EVENT_REACTIVATED_HOLDER, ['SKIPPED', 'PREFERENCE_DISABLED'], 'reprise : toujours réglable');
    });
});
