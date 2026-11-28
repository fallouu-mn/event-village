/**
 * Contre-vérification du lot « Avis », phase 2 — TROUS (rouge = trou, vert = attaque bloquée). Base LOCALE, faux SamirPay,
 * faux SMS. Branche avis/cv-rouges, jamais fusionnée. Fiches, commissions et événements modifiés remis dans leur état.
 *
 *  T1 Plafond de 2 SMS par heure étendu par le lot (20261230000001) aux avis d'état : des SMS qui partaient AVANT le lot sont
 *     maintenant sautés (LAST_HOUR_CAP). Règle du 27/11 : « aucun avis existant ne perd un canal ».
 *     a. suspension puis reprise (2 SMS partis), puis REPORT de l'événement dans l'heure : le SMS du report (qui annonce
 *        le remboursement possible) est sauté ; avant le lot, le plafond ne comptait que les reports.
 *     b. suspension, reprise, nouvelle suspension, puis CLÔTURE par l'administration : le SMS de clôture (EVENT_CLOSED_HOLDER,
 *        indispensable, SMS depuis le lot 9 bis, jamais plafonné avant) est sauté.
 *  T2 Paiement non abouti (D1) : un échec SamirPay n'est définitif qu'après 2 h (succès tardif possible, confirmation.service
 *     PROVIDER_FAILED_GRACE_MS) ; l'avis part 10 minutes après l'échec et dit « Rien n'a été débité. Réessayez ». Succès tardif
 *     du même paiement : la personne a été débitée, et on l'a invitée à payer une seconde fois.
 *  T3 Commissions annoncées disponibles (REFERRAL_AVAILABLE, D2) : une commission déjà retirée (PAID) ou gelée par la
 *     suspension de son événement (fin_frozen_amount) est annoncée « peuvent maintenant être retirés ».
 *  T4 Anonymisation (D8) : le numéro effacé du compte reste écrit dans la boîte d'envoi (recipient_phone de l'avis), où une
 *     reprise l'utiliserait encore ; l'anonymisation ne l'efface pas.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { buyConfirmed, createPartnerEvent, newPartner, superadminId, type TestPartner } from '../parcours/finance-helpers';
import { cart, checkout, createSaleEvent, newBuyer, paymentById, pollStatus, providerSays, service } from '../parcours/paiement-helpers';
import { assertRpcOk, rpcTransition, shiftEventDates } from '../parcours/cycle-helpers';
import { postpone } from '../parcours/l11c-helpers';
import { addMinutes, dakarAt, dakarDay, dispatchAt, markEmailVerified, nowOutsideNight, outboxRows, smsMark, smsTo, type OutboxRow } from '../parcours/notif-helpers';

const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason]));

let partner: TestPartner;
let admin: string;

before(async () => {
    partner = await newPartner('cvavis2-trous');
    admin = await superadminId();
});

after(async () => {
    await assertFinanceInvariants('cvavis2-1-trous');
    await assertNotificationInvariants('cvavis2-1-trous');
});

/** Événement publié et un détenteur d'un billet confirmé. */
async function eventWithHolder(label: string) {
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 10_000, total: 20 }]);
    const holder = await newBuyer(label);
    await buyConfirmed(holder, ev, [['Standard', 1]]);
    return { ev, holder };
}

/** Envoie tout de suite (hors de la nuit) les SMS de ce type pour ce détenteur ; exige qu'ils partent. */
async function sendSms(type: string, eventId: string, userId: string): Promise<void> {
    const rows = (await outboxRows({ type, eventId, userId, channel: 'SMS' })).filter((r) => r.status === 'PENDING');
    assert.equal(rows.length, 1, `${type} : un SMS en attente : ${describeRows(rows)}`);
    await dispatchAt(await nowOutsideNight(), { ids: rows.map((r) => r.id) });
    const [sent] = await outboxRows({ ids: [rows[0].id] });
    assert.equal(sent.status, 'SENT', `${type} : SMS parti (${sent.status} ${sent.reason ?? ''})`);
}

describe('T1 — plafond de 2 SMS par heure étendu aux avis d’état : des SMS qui partaient avant le lot sont sautés', () => {
    test('a. suspension et reprise prévenues par SMS, puis report de 48 h dans l’heure : le SMS du report doit partir', async () => {
        const { ev, holder } = await eventWithHolder('cvavis2-t1a');
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Contre-vérification T1a'), 'suspension');
        await sendSms('EVENT_SUSPENDED_HOLDER', ev.eventId, holder.userId);
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');
        await sendSms('EVENT_REACTIVATED_HOLDER', ev.eventId, holder.userId);
        await postpone(partner, ev.eventId, 48);
        const changed = await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
        assert.equal(changed.length, 1, `une ligne SMS du report : ${describeRows(changed)}`);
        // Avant le lot (20261121000006, plafond des seuls EVENT_CHANGED) : aucun report dans l'heure → SMS en attente
        assert.equal(changed[0].status, 'PENDING',
            `TROU : le SMS du report (remboursement possible) est sauté à cause des SMS de suspension et de reprise : ${describeRows(changed)}`);
    });

    test('b. suspension, reprise, nouvelle suspension, puis clôture par l’administration : le SMS de clôture doit partir', async () => {
        const { ev, holder } = await eventWithHolder('cvavis2-t1b');
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Contre-vérification T1b'), 'suspension');
        await sendSms('EVENT_SUSPENDED_HOLDER', ev.eventId, holder.userId);
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');
        await sendSms('EVENT_REACTIVATED_HOLDER', ev.eventId, holder.userId);
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Contre-vérification T1b, seconde'), 'nouvelle suspension');
        await shiftEventDates(ev.eventId, { startsInHours: -6, durationHours: 4 });
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'TERMINE', 'Clôture (contre-vérification T1b)'), 'clôture');
        const closed = await outboxRows({ type: 'EVENT_CLOSED_HOLDER', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
        assert.equal(closed.length, 1, `une ligne SMS de la clôture : ${describeRows(closed)}`);
        // Avant le lot (notif_event_status_changed de 20261109000009) : aucun plafond sur la clôture → SMS en attente
        assert.equal(closed[0].status, 'PENDING',
            `TROU : le SMS indispensable de la clôture est sauté (plafond des avis) : ${describeRows(closed)}`);
    });
});

describe('T2 — paiement non abouti annoncé avant que l’échec soit définitif', () => {
    test('échec SamirPay non définitif, avis envoyé à 10 min (« Rien n’a été débité »), puis succès tardif du même paiement', async () => {
        const ev = await createSaleEvent('cvavis2-t2', [{ name: 'Standard', price: 5_000, total: 30 }]);
        const buyer = await newBuyer('cvavis2-t2');
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        providerSays(r.payment!, 'FAILED');
        await pollStatus(buyer.accessToken, r.payment!.id);
        const failed = await paymentById(r.payment!.id) as unknown as Record<string, unknown>;
        assert.equal(failed.status, 'FAILED', 'paiement en échec');
        assert.notEqual(failed.provider_final, true, 'précondition : échec NON définitif (moins de 2 h, succès tardif possible)');

        const rows = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        const sms = rows.find((x) => x.channel === 'SMS');
        assert.ok(sms, `avis mis en file : ${describeRows(rows)}`);
        const mark = smsMark(buyer.phoneE164);
        // Correctif T2 (lignes 111 à 114 changées avec l'accord du 28/11, signalé au rapport du lot et à « Corrections ») :
        // l'échéance du SMS tombe au plus tôt 2 h après la création du paiement (fin du délai de grâce de SamirPay) ; l'envoyeur
        // passe 11 minutes après l'échec. La ligne n'est pas encore due : l'envoyeur ne la lit pas, la règle de nuit n'y joue
        // aucun rôle (même quand la suite tourne la nuit).
        assert.ok(Date.parse(sms!.due_at) >= Date.parse(String(failed.created_at)) + 2 * 3_600_000 - 1_000,
            `échéance du SMS au plus tôt 2 h après la création du paiement (${sms!.due_at}, paiement créé ${String(failed.created_at)})`);
        await dispatchAt(addMinutes(new Date(), 11), { ids: rows.map((x) => x.id) });
        const [smsRow] = await outboxRows({ ids: [sms!.id] });
        assert.equal(smsRow.status, 'PENDING', `l'avis n'est pas parti à 10 minutes (${smsRow.status} ${smsRow.reason ?? ''})`);
        const sent = smsTo(buyer.phoneE164, mark).filter((m) => /paiement non abouti/.test(m.message));

        // 30 minutes après l'échec, SamirPay confirme le même paiement (succès tardif, lot 9 bis H1)
        providerSays(r.payment!, 'SUCCESS');
        // Temps écoulé depuis la dernière relecture (la route ne relit SamirPay qu'une fois par STATUS_POLL_RECONCILE_SECONDS ;
        // le cron des succès tardifs repasse après 15 minutes) : relecture remise une heure en arrière
        const { error: rErr } = await service.from('payments').update({ last_reconciled_at: new Date(Date.now() - 3_600_000).toISOString() }).eq('id', r.payment!.id);
        assert.equal(rErr, null, rErr?.message);
        await pollStatus(buyer.accessToken, r.payment!.id);
        const late = await paymentById(r.payment!.id);
        // Débité : confirmé, ou à rembourser si les places sont parties entre-temps (dans les deux cas l'argent a été pris)
        assert.ok(['SUCCESS', 'PARTIAL', 'REFUND_PENDING', 'REFUNDED'].includes(late.status), `succès tardif enregistré (${late.status})`);
        // Correctif T2 (ajout convenu le 28/11) : après le succès tardif, toutes les lignes PAYMENT_NOT_COMPLETED sont annulées
        const afterLate = await outboxRows({ type: 'PAYMENT_NOT_COMPLETED', userId: buyer.userId });
        assert.ok(afterLate.length > 0 && afterLate.every((x) => x.status === 'CANCELLED'),
            `avis annulés après le succès tardif : ${describeRows(afterLate)}`);
        assert.deepEqual(sent.map((m) => m.message), [],
            `TROU : SMS « Rien n'a été débité. Réessayez » envoyé pour un paiement finalement débité : ${JSON.stringify(sent.map((m) => m.message))}`);
    });
});

describe('T3 — commissions annoncées disponibles alors qu’elles ne sont pas retirables', () => {
    async function sponsorWithCommission(label: string) {
        const sponsor = await newBuyer(`${label}-parrain`);
        const referred = await newBuyer(`${label}-filleul`);
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 10, rate_n2_at_creation: 5, duration_months: 12, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        });
        assert.equal(error, null, `parrainage : ${error?.message}`);
        const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 20_000, total: 20 }]);
        await buyConfirmed(referred, ev, [['Standard', 1]]);
        const { data, error: cErr } = await service.from('referral_commissions')
            .select('id, amount, available_at, status, paid_amount, paid_at').eq('sponsor_id', sponsor.userId).eq('kind', 'COMMISSION');
        assert.equal(cErr, null, cErr?.message);
        assert.equal((data ?? []).length, 1, `une commission : ${JSON.stringify(data)}`);
        return { sponsor, ev, commission: data![0] as Record<string, unknown> };
    }
    const now = (): Date => dakarAt(dakarDay(1), '10:00');           // contrôle de demain 10 h (Dakar)
    const inWindow = (): string => new Date(dakarAt(dakarDay(0), '09:00').getTime() + 3_600_000).toISOString(); // aujourd'hui 10 h

    test('a. commission devenue disponible puis déjà retirée (PAID) : jamais annoncée « disponible »', async () => {
        const { sponsor, commission: c } = await sponsorWithCommission('cvavis2-t3a');
        try {
            const { error } = await service.from('referral_commissions').update({
                available_at: inWindow(), status: 'PAID', paid_amount: c.amount, paid_at: new Date().toISOString(),
            }).eq('id', c.id);
            assert.equal(error, null, error?.message);
            const { data, error: dErr } = await service.rpc('notification_daily_checks', { p: { now: now().toISOString() } });
            assert.equal(dErr, null, dErr?.message);
            assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        } finally {
            const { error } = await service.from('referral_commissions').update({
                available_at: c.available_at, status: c.status, paid_amount: c.paid_amount, paid_at: c.paid_at,
            }).eq('id', c.id);
            assert.equal(error, null, `commission remise : ${error?.message}`);
        }
        const rows = await outboxRows({ type: 'REFERRAL_AVAILABLE', userId: sponsor.userId });
        assert.deepEqual(describeRows(rows), '[]',
            `TROU : commission déjà retirée annoncée « peuvent maintenant être retirés » (${rows[0]?.template_data.amount} F) : ${describeRows(rows)}`);
    });

    test('b. commission d’un événement suspendu (gelée, fin_frozen_amount) : jamais annoncée « disponible »', async () => {
        const { sponsor, ev, commission: c } = await sponsorWithCommission('cvavis2-t3b');
        let suspended = false;
        // Écritures du grand livre du parrain (même date de disponibilité que la commission, comme à la création) : remises à la fin
        const { data: ledger, error: lErr } = await service.from('finance_ledger').select('id, available_at')
            .eq('owner_id', sponsor.userId).eq('account_kind', 'PARRAINAGE');
        assert.equal(lErr, null, lErr?.message);
        assert.ok((ledger ?? []).length > 0, 'écriture de la commission au grand livre');
        try {
            const { error } = await service.from('referral_commissions').update({ available_at: inWindow() }).eq('id', c.id);
            assert.equal(error, null, error?.message);
            for (const l of ledger ?? []) {
                const { error: e } = await service.from('finance_ledger').update({ available_at: inWindow() }).eq('id', l.id);
                assert.equal(e, null, e?.message);
            }
            assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Contre-vérification T3b'), 'suspension');
            suspended = true;
            const { data: frozen, error: fErr } = await service.rpc('fin_frozen_amount', { p_owner: sponsor.userId, p_kind: 'PARRAINAGE', p_at: now().toISOString() });
            assert.equal(fErr, null, fErr?.message);
            console.log(`[CVAVIS2-T3b] fonds de parrainage gelés à l'heure du contrôle : ${frozen}`);
            assert.ok(Number(frozen) > 0, `précondition : commission gelée par la suspension (${frozen})`);
            const { data, error: dErr } = await service.rpc('notification_daily_checks', { p: { now: now().toISOString() } });
            assert.equal(dErr, null, dErr?.message);
            assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        } finally {
            const { error } = await service.from('referral_commissions').update({ available_at: c.available_at }).eq('id', c.id);
            assert.equal(error, null, `commission remise : ${error?.message}`);
            for (const l of ledger ?? []) {
                const { error: e } = await service.from('finance_ledger').update({ available_at: l.available_at }).eq('id', l.id);
                assert.equal(e, null, `grand livre remis : ${e?.message}`);
            }
            if (suspended) assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise (remise en état)');
        }
        const rows = await outboxRows({ type: 'REFERRAL_AVAILABLE', userId: sponsor.userId });
        assert.deepEqual(describeRows(rows), '[]',
            `TROU : commission gelée (événement suspendu) annoncée « peuvent maintenant être retirés » : ${describeRows(rows)}`);
    });
});

describe('T4 — anonymisation : le numéro effacé reste dans la boîte d’envoi', () => {
    test('après anonymizeUser, aucune ligne de la boîte d’envoi ne garde l’ancien numéro ni l’ancienne adresse', async () => {
        const { AdminService } = await import('../../lib/admin/admin.service');
        const target = await newBuyer('cvavis2-t4');
        const email = `cvavis2-${randomUUID().slice(0, 8)}@exemple-reel.sn`;
        const { error: eErr } = await service.from('users').update({ email }).eq('id', target.userId);
        assert.equal(eErr, null, eErr?.message);
        await markEmailVerified(target.userId);
        await AdminService.anonymizeUser(target.userId, { id: admin, role: 'SUPERADMIN' });
        const { data: u } = await service.from('users').select('phone, email, status').eq('id', target.userId).single();
        assert.notEqual(u!.phone, target.phoneE164, 'précondition : numéro effacé du compte');
        const nine = target.phoneE164.slice(-9);
        const { data: kept, error } = await service.from('notification_outbox')
            .select('type, channel, status, recipient_phone, recipient_email')
            .or(`recipient_phone.ilike.%${nine},recipient_email.eq.${email}`);
        assert.equal(error, null, error?.message);
        assert.deepEqual(kept, [],
            `TROU : donnée effacée par l'anonymisation encore écrite dans la boîte d'envoi : ${JSON.stringify(kept)}`);
    });
});
