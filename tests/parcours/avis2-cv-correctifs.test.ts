/**
 * Lot « Avis », phase 2 — correctifs après la contre-vérification (docs/audit-avis-phase2.md). Un test par correctif, en plus
 * des suites de l'audit (tests/audit/cvavis2-*.test.ts). Base LOCALE, faux SamirPay, faux SMS ; commissions, écritures du
 * grand livre et événements modifiés remis dans leur état.
 *
 *  T1 Première suspension jamais plafonnée : deux SMS de report partis dans l'heure ne comptent pas (avant : sautée).
 *  T2 Échec devenu définitif (fin du délai de grâce de SamirPay) : le SMS « paiement non abouti » part, une seule fois (second
 *     échec du même panier compris), avec le même lien que la cloche.
 *  T3 Commissions disponibles : montant annoncé borné par le retirable du compte de parrainage à l'heure du contrôle.
 *  T4 Anonymisation : avis envoyé après l'anonymisation du compte de connexion ; lignes en attente annulées (ACCOUNT_ANONYMIZED),
 *     numéro et adresse retirés ; la garde refuse toujours tout autre changement ; la fonction refuse un compte non anonymisé.
 *  T5 Garde de l'adresse : exemption du tunnel seulement pour l'adresse exacte du tunnel, https://<nom>.trycloudflare.com.
 *  Observations : 2. porte A → B → A dans une transaction : aucun avis (A → B : un) ; 3. SMS des validations « A, B et C » ;
 *  4. même lien pour la cloche et le SMS du paiement non abouti, pour chaque achat ; 5. notification des alertes d'argent et
 *  des plafonds de SMS reportée la nuit.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { buyConfirmed, createPartnerEvent, newPartner, superadminId } from './finance-helpers';
import { cart, checkout, createSaleEvent, newBuyer, paymentById, pollStatus, providerSays, service } from './paiement-helpers';
import { assertRpcOk, rpcTransition } from './cycle-helpers';
import { postpone } from './l11c-helpers';
import { addMinutes, dakarAt, dakarDay, dispatchAt, getNotifSetting, markEmailVerified, nowOutsideNight, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { mount } from '../audit/cvf2a-helpers';
import { NOTIFICATION_CATALOG, renderNotification } from '../../lib/notifications/catalog';
import { appUrlStartupProblem } from '../../lib/notifications/app-url-guard';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.due_at]));

after(async () => {
    await assertFinanceInvariants('avis2-cv-correctifs');
    await assertNotificationInvariants('avis2-cv-correctifs');
});

/** Première heure hors de la nuit (réglage notif.sms_quiet_*) à partir de `d`. */
async function outsideNightFrom(d: Date): Promise<Date> {
    const start = Number(await getNotifSetting('notif.sms_quiet_start'));
    const end = Number(await getNotifSetting('notif.sms_quiet_end'));
    const h = d.getUTCHours(); // Dakar = UTC
    const inNight = start === end ? false : start < end ? h >= start && h < end : h >= start || h < end;
    if (!inNight) return d;
    const day = start > end && h >= start ? dakarDay(1, d) : dakarDay(0, d);
    return addMinutes(dakarAt(day, `${String(end).padStart(2, '0')}:00`), 1);
}

// ── T1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T1 — la première suspension n’est jamais plafonnée', () => {
    test('deux SMS de report partis dans l’heure, puis suspension : le SMS de suspension part (en attente)', async () => {
        const partner = await newPartner('avis2cv-t1');
        const admin = await superadminId();
        const ev = await createPartnerEvent(partner.partnerId, 'avis2cv-t1', [{ name: 'Standard', price: 10_000, total: 20 }], { daysFromNow: 10 });
        const holder = await newBuyer('avis2cv-t1');
        await buyConfirmed(holder, ev, [['Standard', 1]]);
        for (const hours of [48, 24]) {
            await postpone(partner, ev.eventId, hours);
            const pending = (await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' })).filter((r) => r.status === 'PENDING');
            assert.equal(pending.length, 1, `report de ${hours} h : un SMS en attente : ${describeRows(pending)}`);
            const at = await outsideNightFrom(new Date(Math.max(Date.parse(pending[0].due_at), (await nowOutsideNight()).getTime())));
            await dispatchAt(at, { ids: [pending[0].id] });
            const [sent] = await outboxRows({ ids: [pending[0].id] });
            assert.equal(sent.status, 'SENT', `report de ${hours} h : SMS parti (${sent.status} ${sent.reason ?? ''})`);
        }
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Correctif T1'), 'suspension');
        const sus = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
        assert.equal(sus.length, 1, describeRows(sus));
        assert.deepEqual([sus[0].status, sus[0].reason], ['PENDING', null], `première suspension jamais plafonnée par les reports : ${describeRows(sus)}`);
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise (remise en état)');
    });
});

// ── T2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T2 — échec devenu définitif : le SMS part, une seule fois, avec le lien de la cloche', () => {
    test('échec SamirPay, fin du délai de grâce : SMS envoyé ; second échec du même panier : aucun second SMS', async () => {
        const ev = await createSaleEvent('avis2cv-t2', [{ name: 'Standard', price: 5_000, total: 30 }]);
        const buyer = await newBuyer('avis2cv-t2');
        const items: Array<[string, number]> = [[ev.categories.Standard.id, 1]];
        const fail = async (): Promise<void> => {
            const r = await checkout(buyer, cart(ev.eventId, items, buyer));
            assert.equal(r.status, 200, JSON.stringify(r.body));
            providerSays(r.payment!, 'FAILED');
            await pollStatus(buyer.accessToken, r.payment!.id);
            assert.equal((await paymentById(r.payment!.id)).status, 'FAILED', 'paiement en échec');
        };
        await fail();
        const rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        const sms = rows.find((r) => r.channel === 'SMS')!;
        assert.ok(sms, describeRows(rows));
        const mark = smsMark(buyer.phoneE164);
        // Fin du délai de grâce (2 h après la création du paiement) : l'échec est définitif, l'avis part
        const at = await outsideNightFrom(addMinutes(new Date(Date.parse(sms.due_at)), 1));
        await dispatchAt(at, { ids: rows.map((r) => r.id) });
        const [smsRow] = await outboxRows({ ids: [sms.id] });
        assert.equal(smsRow.status, 'SENT', `SMS parti à la fin du délai de grâce (${smsRow.status} ${smsRow.reason ?? ''})`);
        await fail();
        assert.equal((await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId })).length, rows.length, 'second échec du panier : aucune ligne de plus');
        await dispatchAt(addMinutes(at, 5), { ids: rows.map((r) => r.id) });
        const got = smsTo(buyer.phoneE164, mark).filter((m) => /paiement non abouti/.test(m.message));
        assert.equal(got.length, 1, `une seule fois : ${JSON.stringify(got.map((m) => m.message))}`);
        const bell = renderNotification('PAYMENT_NOT_COMPLETED', 'IN_APP', rows.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        const link = bell.channel === 'IN_APP' ? bell.actionUrl : '';
        assert.equal(link, `/events/${ev.eventId}`, 'la cloche mène à l’événement');
        assert.ok(got[0].message.endsWith(link), `même lien que la cloche (${link}) : « ${got[0].message} »`);
        assert.match(got[0].message, /^Event Village : paiement non abouti, rien n'a été débité\. Réessayez : /);
    });
});

// ── T3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T3 — commissions disponibles : montant borné par le retirable', () => {
    test('deux commissions devenues disponibles, une seule retirable au grand livre : seul son montant est annoncé', async () => {
        const sponsor = await newBuyer('avis2cv-t3-parrain');
        const referred = await newBuyer('avis2cv-t3-filleul');
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 10, rate_n2_at_creation: 5, duration_months: 12, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        });
        assert.equal(error, null, error?.message);
        const partner = await newPartner('avis2cv-t3');
        const ev = await createPartnerEvent(partner.partnerId, 'avis2cv-t3', [{ name: 'Standard', price: 20_000, total: 20 }]);
        await buyConfirmed(referred, ev, [['Standard', 1]]);
        await buyConfirmed(referred, ev, [['Standard', 1]]);
        const { data: comms, error: cErr } = await service.from('referral_commissions').select('id, amount, available_at').eq('sponsor_id', sponsor.userId).eq('kind', 'COMMISSION');
        assert.equal(cErr, null, cErr?.message);
        assert.equal((comms ?? []).length, 2, JSON.stringify(comms));
        const { data: ledger, error: lErr } = await service.from('finance_ledger').select('id, amount, available_at').eq('owner_id', sponsor.userId).eq('account_kind', 'PARRAINAGE').order('created_at');
        assert.equal(lErr, null, lErr?.message);
        assert.equal((ledger ?? []).length, 2, JSON.stringify(ledger));
        const inWindow = new Date(dakarAt(dakarDay(0), '09:00').getTime() + 3_600_000).toISOString();
        try {
            for (const c of comms!) {
                const { error: e } = await service.from('referral_commissions').update({ available_at: inWindow }).eq('id', c.id);
                assert.equal(e, null, e?.message);
            }
            const { error: e1 } = await service.from('finance_ledger').update({ available_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', ledger![0].id);
            assert.equal(e1, null, e1?.message);
            const { data, error: dErr } = await service.rpc('notification_daily_checks', { p: { now: dakarAt(dakarDay(1), '10:00').toISOString() } });
            assert.equal(dErr, null, dErr?.message);
            assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        } finally {
            for (const c of comms!) {
                const { error: e } = await service.from('referral_commissions').update({ available_at: c.available_at }).eq('id', c.id);
                assert.equal(e, null, `commission remise : ${e?.message}`);
            }
            for (const l of ledger!) {
                const { error: e } = await service.from('finance_ledger').update({ available_at: l.available_at }).eq('id', l.id);
                assert.equal(e, null, `grand livre remis : ${e?.message}`);
            }
        }
        const rows = await outboxRows({ type: 'REFERRAL_AVAILABLE', userId: sponsor.userId });
        assert.ok(rows.length > 0, 'commissions annoncées');
        const total = comms!.reduce((a, c) => a + Number(c.amount), 0);
        for (const r of rows) {
            assert.equal(Number(r.template_data.amount), Number(ledger![0].amount), `montant retirable seulement (${r.template_data.amount} sur ${total}) : ${describeRows(rows)}`);
        }
    });
});

// ── T4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T4 — anonymisation : avis après la dernière étape qui peut échouer, boîte d’envoi nettoyée', () => {
    test('avis après l’anonymisation du compte de connexion ; ligne en attente annulée ; numéro et adresse retirés', async () => {
        const { AdminService } = await import('../../lib/admin/admin.service');
        const target = await newBuyer('avis2cv-t4');
        const email = `avis2cv-${randomUUID().slice(0, 8)}@exemple-reel.sn`;
        const { error: eErr } = await service.from('users').update({ email }).eq('id', target.userId);
        assert.equal(eErr, null, eErr?.message);
        await markEmailVerified(target.userId);
        const key = `REFERRAL_SIGNUP:avis2cv-t4:${randomUUID()}`;
        const { error: qErr } = await service.rpc('notif_enqueue', { p: { type: 'REFERRAL_SIGNUP', key, user_id: target.userId, data: {}, due_at: new Date(Date.now() + 86_400_000).toISOString() } });
        assert.equal(qErr, null, qErr?.message);
        assert.ok((await outboxRows({ keyPrefix: `${key}:` })).every((r) => r.status === 'PENDING'), 'ligne en attente avant l’anonymisation');

        await AdminService.anonymizeUser(target.userId, { id: await superadminId(), role: 'SUPERADMIN' });
        const pending = await outboxRows({ keyPrefix: `${key}:` });
        assert.ok(pending.length > 0 && pending.every((r) => r.status === 'CANCELLED' && r.reason === 'ACCOUNT_ANONYMIZED'), `ligne en attente annulée : ${describeRows(pending)}`);
        const notice = await outboxRows({ type: 'ACCOUNT_ANONYMIZATION_NOTICE', userId: target.userId });
        assert.deepEqual(notice.map((r) => [r.channel, r.status]).sort(), [['EMAIL', 'SENT'], ['SMS', 'SENT']], describeRows(notice));
        const { data: all, error } = await service.from('notification_outbox').select('recipient_phone, recipient_email').eq('recipient_user_id', target.userId);
        assert.equal(error, null, error?.message);
        assert.deepEqual((all ?? []).filter((r) => r.recipient_phone !== null || r.recipient_email !== null), [], 'numéro et adresse retirés de toutes les lignes du compte');
        // L'avis est mis en file après l'anonymisation du compte de connexion (étape qui peut échouer)
        const authUpdated = await inspect(async (c) => (await c.query<{ updated_at: Date }>('SELECT updated_at FROM auth.users WHERE id = $1', [target.userId])).rows[0].updated_at);
        for (const r of notice) assert.ok(Date.parse(r.created_at) >= new Date(authUpdated).getTime(), `avis après le compte de connexion (${r.created_at} ≥ ${new Date(authUpdated).toISOString()})`);

        // La garde refuse toujours de changer le destinataire d'une ligne terminée
        const { error: gErr } = await service.from('notification_outbox').update({ recipient_phone: target.phoneE164 }).eq('id', notice[0].id);
        assert.ok(gErr && /Une notification terminée ne change plus/.test(gErr.message), `garde : ${gErr?.message}`);
    });

    test('notification_outbox_anonymize refuse un compte qui n’est pas anonymisé, sans rien changer', async () => {
        const other = await newBuyer('avis2cv-t4b');
        const key = `REFERRAL_SIGNUP:avis2cv-t4b:${randomUUID()}`;
        const { error: qErr } = await service.rpc('notif_enqueue', { p: { type: 'REFERRAL_SIGNUP', key, user_id: other.userId, data: {}, due_at: new Date(Date.now() + 86_400_000).toISOString() } });
        assert.equal(qErr, null, qErr?.message);
        const { data, error } = await service.rpc('notification_outbox_anonymize', { p_user: other.userId });
        assert.equal(error, null, error?.message);
        assert.deepEqual(data, { ok: false, reason: 'NOT_ANONYMIZED' });
        assert.ok((await outboxRows({ keyPrefix: `${key}:` })).every((r) => r.status === 'PENDING'), 'lignes inchangées');
    });
});

// ── T5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T5 — exemption du tunnel bornée', () => {
    test('adresse exacte du tunnel https://<nom>.trycloudflare.com : admise ; toute autre valeur : refus', () => {
        const tunnel = 'https://event-village-essai.trycloudflare.com';
        assert.equal(appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: tunnel, EV_DEV_TUNNEL_URL: `${tunnel}/` }), null, 'tunnel déclaré, même adresse');
        const refused: Array<Record<string, string>> = [
            { NEXT_PUBLIC_APP_URL: tunnel },                                                               // tunnel non déclaré
            { NEXT_PUBLIC_APP_URL: tunnel, EV_DEV_TUNNEL_URL: 'oui' },                                    // valeur quelconque
            { NEXT_PUBLIC_APP_URL: 'https://billetterie.event-village-senegal.com', EV_DEV_TUNNEL_URL: tunnel }, // autre adresse
            { NEXT_PUBLIC_APP_URL: 'http://event-village-essai.trycloudflare.com', EV_DEV_TUNNEL_URL: 'http://event-village-essai.trycloudflare.com' }, // sans https
            { NEXT_PUBLIC_APP_URL: 'https://a.b.trycloudflare.com', EV_DEV_TUNNEL_URL: 'https://a.b.trycloudflare.com' },                         // pas un seul nom
        ];
        for (const env of refused) assert.ok(appUrlStartupProblem({ NODE_ENV: 'production', ...env }), `refus attendu : ${JSON.stringify(env)}`);
    });
});

// ── Observations ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Observation 2 — poste revenu à l’état de départ dans la même transaction', () => {
    test('porte A → B → A : aucun avis ; A → B : un avis', async () => {
        const M = await mount('avis2cv-poste', { canAcceptCash: false });
        const count = async (gates: string[]): Promise<number> => inRolledBackTransaction(async (c) => {
            for (const g of gates) await c.query('UPDATE public.event_controllers SET gate_id = $1 WHERE id = $2', [g, M.assignmentId]);
            await c.query('SET CONSTRAINTS ALL IMMEDIATE');
            const { rows } = await c.query<{ n: number }>(
                `SELECT count(DISTINCT group_key)::integer AS n FROM public.notification_outbox
                  WHERE type = 'CONTROLLER_POST_CHANGED' AND template_data->>'assignment_id' = $1 AND created_at >= now()`, [M.assignmentId]);
            return rows[0].n;
        });
        assert.equal(await count([M.gate2, M.gate1]), 0, 'porte A → B → A : rien n’a changé, aucun avis');
        assert.equal(await count([M.gate2]), 1, 'porte A → B : un avis (témoin)');
    });
});

describe('Observations 3, 4, 5 — textes, liens et nuit', () => {
    test('3. SMS des validations : « A, B et C », jamais deux « et »', () => {
        const t = NOTIFICATION_CATALOG.ADMIN_REVIEW_SMS as unknown as { sms: (d: Record<string, unknown>, c: typeof CTX) => string; sample: Record<string, unknown> };
        const text = t.sms({ ...t.sample, partner_count: 1, event_count: 2, venue_count: 0, hall_count: 0, hall_changed_count: 0, product_count: 3, company: null }, CTX);
        assert.equal(text, 'Event Village : 1 demande(s) de partenaire, 2 événement(s) et 3 produit(s) attendent votre validation : https://app.eventvillage.sn/admin/dashboard');
    });

    test('4. paiement non abouti : même lien pour la cloche et le SMS, pour chaque achat', () => {
        const t = NOTIFICATION_CATALOG.PAYMENT_NOT_COMPLETED as unknown as { sample: Record<string, unknown> };
        for (const target of ['TICKET', 'ORDER', 'HALL_RESERVATION', 'TABLE_RESERVATION', 'SUBSCRIPTION']) {
            const d = { ...t.sample, target, order_id: randomUUID(), order_number: 'CMD-261205-A1B2', reservation_id: randomUUID() };
            const bell = renderNotification('PAYMENT_NOT_COMPLETED', 'IN_APP', d, CTX);
            const sms = renderNotification('PAYMENT_NOT_COMPLETED', 'SMS', d, CTX);
            const link = bell.channel === 'IN_APP' ? bell.actionUrl : '';
            assert.ok(sms.channel === 'SMS' && sms.text.endsWith(`${CTX.appUrl}${link}`), `${target} : « ${sms.channel === 'SMS' ? sms.text : ''} » finit par ${link}`);
        }
    });

    test('5. alertes d’argent et plafonds de SMS : notification reportée la nuit, comme les autres alertes d’administration', () => {
        const cat = NOTIFICATION_CATALOG as unknown as Record<string, { nightPolicy: string; channels: readonly string[] }>;
        for (const type of ['ADMIN_WITHDRAWAL_REJECTED', 'ADMIN_FINANCE_DEBT', 'ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP', 'ADMIN_SMS_CAP_NEW_NUMBERS', 'ADMIN_EVENT_PUBLISHED']) {
            assert.ok(cat[type].channels.includes('PUSH'), `${type} : notification`);
            assert.equal(cat[type].nightPolicy, 'DEFER', `${type} : reportée la nuit`);
        }
    });
});
