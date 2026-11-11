/**
 * Lot 9 bis, tâche I1 (contrat 3.2, 4.7, 5.63, X13, B108 ; D-ree 1) — garde des comptes de démonstration dans
 * l'envoyeur, sur la base LOCALE.
 *
 * Sous NODE_ENV=test, isSimulationRun() est faux (lib/integrations/simulation.ts:32-35) : la garde est active dans
 * cette suite, comme en réel et en production. Elle porte sur le compte (users.demo_account), le numéro (9 derniers
 * chiffres), l'adresse (celle d'un compte de démonstration, ou le domaine du seed) et l'événement d'une partenaire de
 * démonstration. Une ligne SMS, EMAIL ou PUSH retenue passe SKIPPED `DEMO_ACCOUNT` sans aucun appel aux faux
 * adaptateurs ; l'in-app part ; un compte ordinaire reçoit tout.
 *
 * Lignes écrites par insertOutboxRow (dues maintenant) et envoyées par dispatchAt(…, { ids }) : jamais de passage
 * global. Comptage par numéro, adresse ou appareil neufs, jamais global. Adresses vérifiées (markEmailVerified, M10) :
 * sinon EMAIL_NOT_VERIFIED masquerait le cas testé. Le compte de démonstration est marqué AVANT toute ligne envoyée :
 * aucune ligne SENT antérieure ne tombe sous (w15).
 *
 * Reprise de M12 : la migration est rejouée dans une transaction annulée sur trois comptes ordinaires, dont deux
 * reçoivent dans la transaction la marque du seed (`is_essai_fixture`) ou une adresse du domaine du seed : rien ne
 * reste dans le domaine après la suite (tests/parcours/essai-seed-dev.test.ts compte ses six comptes par domaine).
 * `runSeedDev → demo_account = true` est prouvé par essai-seed-dev.test.ts (T63), pas ici : deux passages du seed
 * dans deux suites se marcheraient dessus (écart signalé).
 *
 * Rouge aujourd'hui : users.demo_account et notification_demo_recipients absents (M12), garde absente de l'envoyeur
 * (dispatcher.ts, fix(9b.I1-SG)) ; chaque cas échoue d'abord en nommant la colonne ou la migration.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { createDraftEvent } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { randomSenegalPhone } from './helpers';
import {
    dispatchAt, fakeBrowserSubscription, insertOutboxRow, markEmailVerified, outboxRows, withVapid,
    type OutboxChannel, type OutboxInsert, type OutboxRow,
} from './notif-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';

const M12 = 'migration 20261109000012_lot9bis_mode_reel';
const M12_FILE = path.join(process.cwd(), 'supabase', 'migrations', '20261109000012_lot9bis_mode_reel.sql');
const SEED_DOMAIN = 'essai.eventvillage.invalid';

after(async () => {
    await assertLot9bisInvariants('essai-comptes-demo');
});

// ── Outils ─────────────────────────────────────────────────────────────────

/** Marque un compte de démonstration (service_role seul l'écrit, B108). */
async function markDemo(userId: string): Promise<void> {
    const { data, error } = await service.from('users').update({ demo_account: true }).eq('id', userId).select('id');
    assert.equal(error, null, `users.demo_account : ${error?.message} (code ${error?.code}) — colonne absente, ${M12} (I1)`);
    assert.equal((data ?? []).length, 1, `compte ${userId} introuvable`);
}

async function dueRow(over: OutboxInsert): Promise<OutboxRow> {
    const due = new Date(Date.now() - 1000).toISOString();
    return insertOutboxRow({ due_at: due, next_attempt_at: due, ...over });
}

async function rowOf(id: string): Promise<OutboxRow> {
    const rows = await outboxRows({ ids: [id] });
    assert.equal(rows.length, 1, `ligne ${id} introuvable dans notification_outbox`);
    return rows[0];
}

function brief(r: OutboxRow): string {
    return JSON.stringify({ channel: r.channel, status: r.status, reason: r.reason, detail: r.reason_detail, attempts: r.attempts });
}

/** Message indispensable déclaré sur les quatre canaux (catalogue : REFUND_PAID). */
function refundPaid(group: string): OutboxInsert {
    return {
        type: 'REFUND_PAID', family: 'ESSENTIAL', group_key: group,
        template_data: {
            event_id: randomUUID(), title: 'Gala Dakar', start_at: '2026-11-14T20:00:00.000Z', location: 'CICAD', city: 'Diamniadio',
            cashout_id: randomUUID(), amount: 5000, operator: 'WAVE',
        },
    };
}

async function assertRetained(id: string, what: string): Promise<void> {
    const done = await rowOf(id);
    assert.equal(done.status, 'SKIPPED', `${what} : ${brief(done)}`);
    assert.equal(done.reason, 'DEMO_ACCOUNT', `${what} : ${brief(done)}`);
}

async function assertSent(id: string, what: string): Promise<void> {
    const done = await rowOf(id);
    assert.equal(done.status, 'SENT', `${what} : ${brief(done)}`);
}

async function addSubscription(userId: string, keyId: string): Promise<string> {
    const sub = fakeBrowserSubscription();
    const { error } = await service.from('push_subscriptions')
        .insert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, vapid_key_id: keyId, user_agent: 'Navigateur de test' });
    assert.equal(error, null, `abonnement push : ${error?.message}`);
    return sub.endpoint;
}

const smsCount = (phone: string): number => getFakes().sms.messagesTo(phone).length;
const emailCount = (address: string): number => getFakes().email.messagesTo(address).length;
const pushCount = (endpoint: string): number => getFakes().push.messagesTo(endpoint).length;

// ── Envoyeur ───────────────────────────────────────────────────────────────

describe('I1 : envoyeur, compte de démonstration contre compte ordinaire', () => {
    test('compte de démonstration : SMS, EMAIL et PUSH SKIPPED DEMO_ACCOUNT, aucun appel aux faux adaptateurs, IN_APP envoyé ; compte ordinaire : les quatre partent', async () => {
        const demo = await newBuyer('demo-canaux');
        await markDemo(demo.userId);
        await markEmailVerified(demo.userId);
        const plain = await newBuyer('demo-temoin');
        await markEmailVerified(plain.userId);

        await withVapid(async (keys) => {
            const demoDevice = await addSubscription(demo.userId, keys.keyId);
            const plainDevice = await addSubscription(plain.userId, keys.keyId);
            const channels: OutboxChannel[] = ['SMS', 'EMAIL', 'PUSH', 'IN_APP'];
            const demoGroup = `REFUND_PAID:${randomUUID()}`;
            const plainGroup = `REFUND_PAID:${randomUUID()}`;
            const demoRows = new Map<OutboxChannel, OutboxRow>();
            const plainRows = new Map<OutboxChannel, OutboxRow>();
            for (const channel of channels) {
                demoRows.set(channel, await dueRow({ ...refundPaid(demoGroup), channel, recipient_user_id: demo.userId }));
                plainRows.set(channel, await dueRow({ ...refundPaid(plainGroup), channel, recipient_user_id: plain.userId }));
            }
            const marks = {
                demoSms: smsCount(demo.phoneE164), demoEmail: emailCount(demo.email), demoPush: pushCount(demoDevice),
                plainSms: smsCount(plain.phoneE164), plainEmail: emailCount(plain.email), plainPush: pushCount(plainDevice),
            };
            await dispatchAt(new Date(), { ids: Array.from(demoRows.values()).concat(Array.from(plainRows.values())).map((r) => r.id) });

            for (const channel of ['SMS', 'EMAIL', 'PUSH'] as const) await assertRetained(demoRows.get(channel)!.id, `démonstration, ${channel}`);
            await assertSent(demoRows.get('IN_APP')!.id, 'démonstration, IN_APP (la garde ne vise que SMS, email et push)');
            assert.equal(smsCount(demo.phoneE164) - marks.demoSms, 0, 'aucun SMS au faux MTarget pour le compte de démonstration');
            assert.equal(emailCount(demo.email) - marks.demoEmail, 0, 'aucun email au faux Resend pour le compte de démonstration');
            assert.equal(pushCount(demoDevice) - marks.demoPush, 0, 'aucun push pour le compte de démonstration');

            for (const channel of channels) await assertSent(plainRows.get(channel)!.id, `compte ordinaire, ${channel}`);
            assert.equal(smsCount(plain.phoneE164) - marks.plainSms, 1, 'compte ordinaire : un SMS');
            assert.equal(emailCount(plain.email) - marks.plainEmail, 1, 'compte ordinaire : un email');
            assert.equal(pushCount(plainDevice) - marks.plainPush, 1, 'compte ordinaire : un push');
        });
    });

    test('ligne sans compte vers le numéro d\'un compte de démonstration : SKIPPED, aucun SMS ; un numéro quelconque part', async () => {
        const demo = await newBuyer('demo-numero');
        await markDemo(demo.userId);
        const other = randomSenegalPhone('76');
        const retained = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_phone: demo.phoneE164 });
        const sent = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_phone: other });
        const marks = { demo: smsCount(demo.phoneE164), other: smsCount(other) };
        await dispatchAt(new Date(), { ids: [retained.id, sent.id] });
        await assertRetained(retained.id, 'numéro d\'un compte de démonstration');
        assert.equal(smsCount(demo.phoneE164) - marks.demo, 0, 'aucun SMS vers le numéro de démonstration');
        await assertSent(sent.id, 'numéro quelconque');
        assert.equal(smsCount(other) - marks.other, 1, 'un SMS vers le numéro quelconque');
    });

    test('compte de démonstration dont le numéro a changé (essai 8.15) : retenu par le compte et par le nouveau numéro', async () => {
        const demo = await newBuyer('demo-change');
        await markDemo(demo.userId);
        const changed = randomSenegalPhone('76');
        const { error } = await service.from('users').update({ phone: changed }).eq('id', demo.userId);
        assert.equal(error, null, `changement de numéro : ${error?.message}`);
        const byAccount = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_user_id: demo.userId });
        const byNumber = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_phone: changed });
        const mark = smsCount(changed);
        await dispatchAt(new Date(), { ids: [byAccount.id, byNumber.id] });
        await assertRetained(byAccount.id, 'ligne du compte, numéro changé');
        await assertRetained(byNumber.id, 'ligne sans compte vers le nouveau numéro');
        assert.equal(smsCount(changed) - mark, 0, 'aucun SMS vers le nouveau numéro du compte de démonstration');
    });
});

// ── Événement d'une partenaire de démonstration, RPC de garde ──────────────

interface Stage { demo: Buyer; plain: Buyer; demoPartner: TestPartner; demoEvent: string; plainEvent: string }

let stage: Promise<Stage> | undefined;

/** Partenaire de démonstration marquée AVANT la création de son événement (aucune ligne SENT antérieure). */
function demoStage(): Promise<Stage> {
    stage ??= (async () => {
        const demo = await newBuyer('demo-rpc');
        await markDemo(demo.userId);
        await markEmailVerified(demo.userId); // adresse portée par users.email (modèle « adresse en attente », A17)
        const plain = await newBuyer('demo-rpc-temoin');
        await markEmailVerified(plain.userId);
        const demoPartner = await newPartner('demo-orga');
        await markDemo(demoPartner.userId);
        const plainPartner = await newPartner('demo-orga-temoin');
        const demoEvent = (await createDraftEvent(demoPartner, 'demo-orga', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 })).eventId;
        const plainEvent = (await createDraftEvent(plainPartner, 'demo-orga-temoin', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 })).eventId;
        return { demo, plain, demoPartner, demoEvent, plainEvent };
    })();
    return stage;
}

describe('I1 : événement d\'une partenaire de démonstration (règle d) et RPC notification_demo_recipients', () => {
    test('numéro quelconque sur l\'événement d\'une partenaire de démonstration : SKIPPED ; même cas sur l\'événement d\'une partenaire ordinaire : SENT', async () => {
        const s = await demoStage();
        const invited = randomSenegalPhone('76');
        const witness = randomSenegalPhone('76');
        const retained = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_phone: invited, event_id: s.demoEvent });
        const sent = await dueRow({ ...refundPaid(`REFUND_PAID:${randomUUID()}`), channel: 'SMS', recipient_phone: witness, event_id: s.plainEvent });
        const marks = { invited: smsCount(invited), witness: smsCount(witness) };
        await dispatchAt(new Date(), { ids: [retained.id, sent.id] });
        await assertRetained(retained.id, 'événement d\'une partenaire de démonstration');
        assert.equal(smsCount(invited) - marks.invited, 0, 'aucun SMS pour l\'événement du seed');
        await assertSent(sent.id, 'événement d\'une partenaire ordinaire');
        assert.equal(smsCount(witness) - marks.witness, 1, 'un SMS pour l\'événement ordinaire');
    });

    test('RPC : compte, numéro sous trois écritures (+221…, 7…, 00221…), adresse (casse ignorée), domaine du seed, événement ; témoins ordinaires jamais bloqués', async () => {
        const s = await demoStage();
        const items = [
            { key: 'compte', user_id: s.demo.userId },
            { key: 'numero-e164', phone: s.demo.phoneE164 },
            { key: 'numero-local', phone: s.demo.phone9 },
            { key: 'numero-00221', phone: `00221${s.demo.phone9}` },
            { key: 'adresse', email: s.demo.email.toUpperCase() },
            { key: 'domaine-seed', email: `essai-${randomUUID().slice(0, 8)}@${SEED_DOMAIN}` },
            { key: 'evenement', phone: randomSenegalPhone('76'), event_id: s.demoEvent },
            { key: 'temoin-compte', user_id: s.plain.userId },
            { key: 'temoin-numero', phone: s.plain.phoneE164 },
            { key: 'temoin-adresse', email: s.plain.email },
            { key: 'temoin-evenement', phone: randomSenegalPhone('76'), event_id: s.plainEvent },
            { key: 'temoin-domaine-voisin', email: `essai@x${SEED_DOMAIN}` },
        ];
        const { data, error } = await service.rpc('notification_demo_recipients', { p: { items } });
        assert.equal(error, null, `notification_demo_recipients : ${error?.message} (code ${error?.code}) — ${M12} (I1)`);
        const reply = data as { ok?: boolean; blocked?: unknown };
        assert.equal(reply?.ok, true, JSON.stringify(reply));
        assert.ok(Array.isArray(reply.blocked), `blocked : liste attendue, ${JSON.stringify(reply)}`);
        assert.deepEqual([...(reply.blocked as string[])].sort(),
            ['adresse', 'compte', 'domaine-seed', 'evenement', 'numero-00221', 'numero-e164', 'numero-local'],
            `clés bloquées : ${JSON.stringify(reply.blocked)}`);
    });
});

// ── Reprise de M12 (transaction annulée) ───────────────────────────────────

describe('I1 : reprise de M12 sur les comptes du seed', () => {
    test('marque is_essai_fixture → demo_account vrai ; adresse du domaine du seed → vrai ; compte ordinaire → faux ; rien ne reste', async () => {
        const marked = await newBuyer('reprise-marque');
        const seedMail = await newBuyer('reprise-domaine');
        const plain = await newBuyer('reprise-ordinaire');
        const ids = [marked.userId, seedMail.userId, plain.userId];
        assert.ok(fs.existsSync(M12_FILE), `supabase/migrations/20261109000012_lot9bis_mode_reel.sql absente — ${M12} (I1)`);
        const sql = fs.readFileSync(M12_FILE, 'utf8');

        const flags = await inRolledBackTransaction(async (db) => {
            await db.query(`UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_essai_fixture": true}'::jsonb WHERE id = $1`, [marked.userId]);
            await db.query('UPDATE auth.users SET email = $2 WHERE id = $1', [seedMail.userId, `reprise-${randomUUID().slice(0, 8)}@${SEED_DOMAIN}`]);
            await db.query(sql);
            const { rows } = await db.query<{ id: string; demo_account: boolean }>('SELECT id::text AS id, demo_account FROM public.users WHERE id = ANY($1::uuid[])', [ids]);
            return new Map(rows.map((r) => [r.id, r.demo_account]));
        });
        assert.deepEqual(
            { marque: flags.get(marked.userId), domaine: flags.get(seedMail.userId), ordinaire: flags.get(plain.userId) },
            { marque: true, domaine: true, ordinaire: false },
        );

        const { data, error } = await service.from('users').select('id, email').in('id', ids);
        assert.equal(error, null, `relecture : ${error?.message}`);
        assert.ok((data ?? []).every((u) => !String(u.email ?? '').toLowerCase().endsWith(`@${SEED_DOMAIN}`)), 'aucun compte laissé dans le domaine du seed');
    });
});
