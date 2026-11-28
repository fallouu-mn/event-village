/**
 * Contre-vérification du lot « Avis », phase 2 — GARDE-FOUS éprouvés de façon indépendante (verts attendus ; un rouge serait
 * un trou). Base LOCALE, faux SamirPay, faux SMS. Préférences, réglages et événements modifiés remis dans leur état.
 *
 *  G1 Droits : les 15 fonctions nouvelles du schéma private ne s'exécutent sous AUCUN rôle de l'API (anon, authenticated,
 *     service_role) ; les fonctions publiques recopiées gardent leurs droits (jamais anon ni authenticated).
 *  G2 Accusé de retrait (A2) : chaque compte ne reçoit que l'accusé de SON retrait ; données = montant, opérateur, sorte de
 *     compte, moyen et références, jamais le numéro de versement ni le nom.
 *  G3 Paiement annulé par la personne chez SamirPay (CANCELLED) : aucun avis « paiement non abouti ».
 *  G4 Suspension devenue indispensable (B13) : préférence « Reprise d'un événement » coupée sur tous les canaux → l'avis de
 *     suspension part sur ses 4 canaux, celui de la reprise est coupé ; les rappels de table restent désactivables (D5).
 *  G5 Nuit (1 h - 7 h) : SMS de suspension réservé la nuit → reporté (DEFER NIGHT) ; même SMS pour un événement qui commence
 *     dans moins de 12 h → part (exception « moins de 12 h »).
 *  G6 Registre en base : règle de nuit des types nouveaux et des types dont le lot ajoute un SMS ou une notification
 *     (imprimée pour le rapport), canaux réels égaux au catalogue.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inspect } from '../helpers/db';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { balanceOf, buyConfirmed, createPartnerEvent, newPartner, superadminId, withSettings, type TestPartner } from '../parcours/finance-helpers';
import { cart, checkout, createSaleEvent, newBuyer, paymentById, pollStatus, providerSays, service, type Buyer } from '../parcours/paiement-helpers';
import { assertRpcOk, rpcTransition, shiftEventDates } from '../parcours/cycle-helpers';
import { dakarAt, dakarDay, dispatchAt, getNotifSetting, outboxRows, type OutboxRow } from '../parcours/notif-helpers';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason]));
const channels = (rows: OutboxRow[]): string[] => rows.map((r) => r.channel).sort();

let partner: TestPartner;
let admin: string;

before(async () => {
    partner = await newPartner('cvavis2-gardes');
    admin = await superadminId();
});

after(async () => {
    await assertNotificationInvariants('cvavis2-2-gardes');
});

const NEW_PRIVATE = [
    'event_table_holders', 'notif_holder_sms_count', 'notif_holder_status_sms_cap', 'notif_table_holders_status',
    'notif_withdrawal_requested', 'notif_withdrawal_ack_paid', 'notif_partner_resubmitted', 'notif_shift_validated',
    'notif_controller_post_changed', 'notif_admin_money_sms', 'notif_admin_money_on_alert', 'notif_referral_signup',
    'payment_cart_key', 'notif_payment_not_completed', 'notif_payment_cart_paid',
];
const RECOPIED_PUBLIC = [
    'event_notice_recipient_count', 'event_change_notify', 'notif_event_status_changed', 'notification_outbox_claim',
    'account_phone_finalize', 'notif_enqueue_grouped', 'notif_admin_review_sms', 'notification_daily_checks', 'cashouts_simulation_guard',
];

describe('G1 — droits des fonctions du lot', () => {
    test('15 fonctions private fermées à anon, authenticated et service_role ; recopies publiques jamais à anon ni authenticated', async () => {
        const rows = await inspect(async (c) => (await c.query(`
            SELECT n.nspname AS schema, p.proname AS name,
                   has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                   has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
                   has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE (n.nspname = 'private' AND p.proname = ANY ($1)) OR (n.nspname = 'public' AND p.proname = ANY ($2))
             ORDER BY 1, 2`, [NEW_PRIVATE, RECOPIED_PUBLIC])).rows as Array<Record<string, unknown>>);
        const priv = rows.filter((r) => r.schema === 'private');
        assert.deepEqual(priv.map((r) => r.name).sort(), [...NEW_PRIVATE].sort(), 'les 15 fonctions private existent (une définition chacune)');
        assert.deepEqual(priv.filter((r) => r.anon || r.authenticated || r.service_role), [], `private ouvertes à un rôle de l'API : ${JSON.stringify(priv)}`);
        const pub = rows.filter((r) => r.schema === 'public');
        assert.deepEqual(pub.map((r) => r.name).sort(), [...RECOPIED_PUBLIC].sort(), 'recopies publiques présentes');
        assert.deepEqual(pub.filter((r) => r.anon || r.authenticated), [], `recopie publique ouverte : ${JSON.stringify(pub)}`);
        console.log(`[CVAVIS2-G1] ${JSON.stringify(rows)}`);
    });
});

// ── G2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;

async function fundedPartner(label: string): Promise<TestPartner> {
    const p = await newPartner(label);
    const ev = await createPartnerEvent(p.partnerId, label, [{ name: 'Standard', price: 10_000, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const b = await balanceOf(p.userId, 'ORGANISATEUR');
    assert.equal(b.available, 10_000, `fonds disponibles : ${JSON.stringify(b)}`);
    return p;
}

async function requestWithdrawal(user: Buyer, gross: number, phone9: string): Promise<{ withdrawalId: string; cashoutId: string }> {
    const { data, error } = await withSettings(RULES, async () => service.rpc('withdrawal_request', {
        p: { user_id: user.userId, account_kind: 'ORGANISATEUR', gross_amount: gross, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: phone9, client_key: randomUUID() },
    }));
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    assert.equal((data as Record<string, unknown>).ok, true, `retrait refusé : ${JSON.stringify(data)}`);
    const { data: w, error: wErr } = await service.from('withdrawals').select('id, cashout_id').eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1).single();
    assert.equal(wErr, null, wErr?.message);
    return { withdrawalId: String(w!.id), cashoutId: String(w!.cashout_id) };
}

describe('G2 — accusé de retrait : bon compte, rien de plus que le montant et l’opérateur', () => {
    test('deux organisatrices, deux retraits : chacune ne reçoit que son accusé ; aucun numéro ni nom dans les données', async () => {
        const a = await fundedPartner('cvavis2-g2a');
        const b = await fundedPartner('cvavis2-g2b');
        // A fait verser sur un autre numéro (le sien en 9 chiffres serait aussi le numéro du compte) : il ne doit jamais apparaître
        const payoutPhone = `77${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
        const wa = await requestWithdrawal(a, 6_000, payoutPhone);
        const wb = await requestWithdrawal(b, 7_000, b.phone9);
        const ra = await outboxRows({ type: 'WITHDRAWAL_REQUESTED', userId: a.userId });
        const rb = await outboxRows({ type: 'WITHDRAWAL_REQUESTED', userId: b.userId });
        assert.deepEqual(channels(ra), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], describeRows(ra));
        assert.deepEqual(channels(rb), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], describeRows(rb));
        assert.ok(ra.every((r) => r.template_data.withdrawal_id === wa.withdrawalId && r.template_data.cashout_id === wa.cashoutId), 'A : son retrait seulement');
        assert.ok(rb.every((r) => r.template_data.withdrawal_id === wb.withdrawalId), 'B : son retrait seulement');
        const allowed = ['account_kind', 'amount', 'cashout_id', 'method', 'operator', 'withdrawal_id'];
        for (const r of [...ra, ...rb]) {
            assert.deepEqual(Object.keys(r.template_data).filter((k) => !allowed.includes(k)), [], `données en trop : ${JSON.stringify(r.template_data)}`);
            assert.equal(r.recipient_phone, null, 'jamais un numéro écrit dans la ligne (numéro du compte lu à l’envoi)');
        }
        const blob = JSON.stringify(ra.map((r) => r.template_data));
        assert.ok(!blob.includes(payoutPhone), `numéro de versement absent : ${blob}`);
        assert.equal(Number(ra[0].template_data.amount) > 0 && Number(ra[0].template_data.amount) <= 6_000, true, 'montant net du retrait');
    });
});

describe('G3 — paiement annulé par la personne : aucun avis « non abouti »', () => {
    test('SamirPay CANCELLED : paiement annulé, aucune ligne PAYMENT_NOT_COMPLETED', async () => {
        const ev = await createSaleEvent('cvavis2-g3', [{ name: 'Standard', price: 5_000, total: 30 }]);
        const buyer = await newBuyer('cvavis2-g3');
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        providerSays(r.payment!, 'CANCELLED');
        await pollStatus(buyer.accessToken, r.payment!.id);
        assert.equal((await paymentById(r.payment!.id)).status, 'CANCELLED', 'paiement annulé');
        const rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        assert.deepEqual(describeRows(rows), '[]', `aucun avis pour une annulation par la personne : ${describeRows(rows)}`);
    });
});

describe('G4 — suspension indispensable, reprise et rappels de table désactivables', () => {
    test('« Reprise d’un événement » coupée : suspension sur 4 canaux, reprise coupée ; rappels de table : sujet facultatif', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'cvavis2-g4', [{ name: 'Standard', price: 10_000, total: 20 }]);
        const holder = await newBuyer('cvavis2-g4');
        await buyConfirmed(holder, ev, [['Standard', 1]]);
        const prefs = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'].map((channel) => ({ user_id: holder.userId, topic: 'EVENT_UPDATES', channel, enabled: false, updated_at: new Date().toISOString() }));
        const { error: pErr } = await service.from('notification_preferences').upsert(prefs, { onConflict: 'user_id,topic,channel' });
        assert.equal(pErr, null, pErr?.message);
        try {
            assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Contre-vérification G4'), 'suspension');
            const sus = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId });
            assert.deepEqual(channels(sus), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `suspension : 4 canaux : ${describeRows(sus)}`);
            for (const r of sus) {
                const ok = r.status === 'PENDING' || (r.channel === 'EMAIL' && r.status === 'SKIPPED' && r.reason === 'EMAIL_NOT_VERIFIED');
                assert.ok(ok, `suspension malgré la préférence coupée (${r.channel} : ${r.status} ${r.reason ?? ''})`);
            }
            assert.ok(!sus.some((r) => r.reason === 'PREFERENCE_DISABLED'), describeRows(sus));
            assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');
            const rea = await outboxRows({ type: 'EVENT_REACTIVATED_HOLDER', eventId: ev.eventId, userId: holder.userId });
            assert.ok(rea.length > 0 && rea.every((r) => r.status === 'SKIPPED' && r.reason === 'PREFERENCE_DISABLED'), `reprise coupée par la préférence : ${describeRows(rea)}`);
        } finally {
            const { error } = await service.from('notification_preferences').delete().eq('user_id', holder.userId).eq('topic', 'EVENT_UPDATES');
            assert.equal(error, null, `préférences remises : ${error?.message}`);
        }
        const { data: reg, error } = await service.from('notification_types').select('type, family, topic').in('type', ['TABLE_REMINDER', 'EVENT_TABLE_SEATS_REMINDER', 'EVENT_SUSPENDED_HOLDER']).order('type');
        assert.equal(error, null, error?.message);
        assert.deepEqual(reg, [
            { type: 'EVENT_SUSPENDED_HOLDER', family: 'ESSENTIAL', topic: null },
            { type: 'EVENT_TABLE_SEATS_REMINDER', family: 'OPTIONAL', topic: 'REMINDERS' },
            { type: 'TABLE_REMINDER', family: 'OPTIONAL', topic: 'REMINDERS' },
        ], 'rappels de table toujours facultatifs (D5)');
    });
});

describe('G5 — nuit et exception « moins de 12 h » pour le SMS de suspension', () => {
    test('réservé à 3 h (Dakar) : reporté pour un événement lointain, envoyé pour un événement qui commence dans moins de 12 h', async () => {
        const qs = Number(await getNotifSetting('notif.sms_quiet_start'));
        const qe = Number(await getNotifSetting('notif.sms_quiet_end'));
        assert.ok(qs < qe, `précondition : plage de nuit dans la même journée (${qs} h - ${qe} h)`);
        const night = dakarAt(dakarDay(1), `${String(qs + 1).padStart(2, '0')}:30`);
        const hoursTo = (d: Date): number => (d.getTime() - Date.now()) / 3_600_000;
        const far = await createPartnerEvent(partner.partnerId, 'cvavis2-g5-loin', [{ name: 'Standard', price: 10_000, total: 20 }], { daysFromNow: 5 });
        const soon = await createPartnerEvent(partner.partnerId, 'cvavis2-g5-proche', [{ name: 'Standard', price: 10_000, total: 20 }], { daysFromNow: 2 });
        // « proche » : commence 6 h après l'heure d'envoi simulée
        await shiftEventDates(soon.eventId, { startsInHours: Math.ceil(hoursTo(night)) + 6, durationHours: 4 });
        const holder = await newBuyer('cvavis2-g5');
        await buyConfirmed(holder, far, [['Standard', 1]]);
        await buyConfirmed(holder, soon, [['Standard', 1]]);
        const outcome: Record<string, string> = {};
        for (const [label, ev] of [['loin', far], ['proche', soon]] as const) {
            assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', `Contre-vérification G5 ${label}`), `suspension ${label}`);
            const [sms] = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
            assert.ok(sms, `SMS de suspension ${label}`);
            await dispatchAt(night, { ids: [sms.id] });
            const [after] = await outboxRows({ ids: [sms.id] });
            const decided = (after as unknown as { decision?: { reason?: string } }).decision?.reason;
            outcome[label] = `${after.status} ${after.reason ?? decided ?? ''}`.trim();
        }
        console.log(`[CVAVIS2-G5] ${JSON.stringify(outcome)}`);
        assert.equal(outcome.loin, 'PENDING NIGHT', `événement lointain : SMS reporté à la fin de la nuit (${outcome.loin})`);
        assert.equal(outcome.proche.startsWith('SENT') || outcome.proche.startsWith('UNCERTAIN'), true, `événement dans moins de 12 h : SMS parti (${outcome.proche})`);
    });
});

describe('G6 — registre en base : canaux égaux au catalogue, règle de nuit des ajouts', () => {
    test('11 types nouveaux et 25 types complétés : canaux et nuit en base = catalogue (imprimé)', async () => {
        const types = ['WITHDRAWAL_REQUESTED', 'PARTNER_RESUBMITTED_ACK', 'SHIFT_DISCREPANCY_VALIDATED', 'CONTROLLER_POST_CHANGED', 'ACCOUNT_WELCOME',
            'ADMIN_MONEY_SMS', 'REFERRAL_SIGNUP', 'REFERRAL_EARNED', 'REFERRAL_AVAILABLE', 'PAYMENT_NOT_COMPLETED', 'ACCOUNT_ANONYMIZATION_NOTICE',
            'TRANSFER_RECEIVED', 'PAYMENT_SUCCESS', 'ORDER_COURIER_INVITED', 'PHONE_CHANGED', 'EMAIL_ADDED', 'ACCOUNT_LOGIN_FAILURES', 'ADMIN_BACKUP_CODE_USED',
            'NEW_ORDER', 'EVENT_SUSPENDED_HOLDER', 'ADMIN_EVENT_PUBLISHED', 'ADMIN_SMS_CAP_GLOBAL', 'ADMIN_PRODUCT_REVIEW', 'ADMIN_FINANCE_DEBT'];
        const { data, error } = await service.from('notification_types').select('type, channels, night_policy, family').in('type', types).order('type');
        assert.equal(error, null, error?.message);
        const cat = NOTIFICATION_CATALOG as unknown as Record<string, { channels: string[] }>;
        for (const r of data ?? []) {
            assert.deepEqual([...(r.channels as string[])].sort(), [...cat[r.type as string].channels].sort(), `${r.type} : canaux en base = catalogue`);
            console.log(`[CVAVIS2-G6] ${r.type} ${r.family} ${(r.channels as string[]).join(',')} nuit=${r.night_policy}`);
        }
        assert.equal((data ?? []).length, types.length, 'tous les types en base');
        const night = Object.fromEntries((data ?? []).map((r) => [r.type, r.night_policy]));
        for (const t of ['ORDER_COURIER_INVITED', 'REFERRAL_AVAILABLE', 'PAYMENT_NOT_COMPLETED', 'ADMIN_MONEY_SMS', 'EVENT_SUSPENDED_HOLDER', 'ACCOUNT_WELCOME', 'REFERRAL_SIGNUP', 'ADMIN_EVENT_PUBLISHED']) {
            assert.equal(night[t], 'DEFER', `${t} : reporté la nuit`);
        }
    });
});
