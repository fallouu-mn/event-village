/**
 * Lot « Avis », phase 2, sous-lot 2c (écarts A2, A5, A8, A9, A10 de docs/avis-inventaire.md) — avis nouveaux simples.
 * Base LOCALE, faux SamirPay, faux SMS.
 *
 *  A2. Demande de retrait : cloche, notification et email tout de suite ; SMS dû 2 minutes plus tard, texte exact (aide),
 *      lien vers la page du retrait ; retrait versé dans les 2 minutes → le SMS d'accusé est annulé (SUPERSEDED) : UN seul
 *      SMS reçu, celui du versement (test « une fois »).
 *  A5. Dossier complété (date de dépôt posée) : accusé à la partenaire, cloche et notification seulement.
 *  A8. Écart de caisse validé par l'organisatrice : avis au contrôleur, « L'organisateur a validé votre caisse ».
 *  A9. Droit d'encaisser donné puis porte changée par l'organisatrice : un avis chacun au contrôleur (CASH, GATE) ; porte
 *      choisie par le contrôleur lui-même : aucun avis.
 *  A10. Inscription par la route : bienvenue (cloche et notification), une seule.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { newBuyer, service, setFakeMode, type Buyer } from './paiement-helpers';
import { balanceOf, buyConfirmed, createPartnerEvent, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { openShift } from './acces-helpers';
import { dispatchAt, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { registerClientFlow } from './terrain-helpers';
import { api, show, type Row } from '../audit/cvf1-helpers';
import { mount, type Mount } from '../audit/cvf2a-helpers';
import { renderNotification } from '../../lib/notifications/catalog';
import { smsAmount } from '../../lib/notifications/sms-format';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const channels = (rows: OutboxRow[]): string[] => rows.map((r) => r.channel).sort();
const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.due_at]));

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertFinanceInvariants('avis2-nouveaux-simples');
    await assertNotificationInvariants('avis2-nouveaux-simples');
});

// ── A2 : demande de retrait ─────────────────────────────────────────────────────────────────────────────────────────

const RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;

/** Partenaire neuve dont une vente en ligne (sans délai de garde) est tout de suite disponible. */
async function fundedPartner(label: string, price = 10_000): Promise<TestPartner> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    const b = await balanceOf(partner.userId, 'ORGANISATEUR');
    assert.equal(b.available, price, `fonds disponibles : ${JSON.stringify(b)}`);
    return partner;
}

async function requestWithdrawal(user: Buyer, gross: number): Promise<{ withdrawalId: string; cashoutId: string }> {
    const { data, error } = await withSettings(RULES, async () => service.rpc('withdrawal_request', {
        p: { user_id: user.userId, account_kind: 'ORGANISATEUR', gross_amount: gross, method: 'MOBILE_MONEY', operator: 'ORANGE_MONEY', phone_number: user.phone9, client_key: randomUUID() },
    }));
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    const body = (data ?? {}) as Row;
    assert.equal(body.ok, true, `retrait refusé : ${JSON.stringify(body)}`);
    const { data: w, error: wErr } = await service.from('withdrawals').select('id, cashout_id').eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1).single();
    assert.equal(wErr, null, wErr?.message);
    assert.ok(w!.cashout_id, 'versement rattaché au retrait');
    return { withdrawalId: String(w!.id), cashoutId: String(w!.cashout_id) };
}

describe('A2 — accusé d’une demande de retrait', () => {
    test('non versé : 3 canaux tout de suite, SMS à 2 minutes, texte exact et lien vers le retrait', async () => {
        const partner = await fundedPartner('avis2-retrait');
        const { withdrawalId, cashoutId } = await requestWithdrawal(partner, 6_000);
        const rows = await outboxRows({ type: 'WITHDRAWAL_REQUESTED', userId: partner.userId });
        assert.deepEqual(channels(rows), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `une ligne par canal : ${describeRows(rows)}`);
        for (const r of rows) assert.equal(r.template_data.withdrawal_id, withdrawalId);
        const sms = rows.find((r) => r.channel === 'SMS')!;
        const app = rows.find((r) => r.channel === 'IN_APP')!;
        const delay = Date.parse(sms.due_at) - Date.parse(app.due_at);
        assert.ok(delay >= 115_000 && delay <= 125_000, `SMS dû 2 minutes après la cloche (${delay} ms) : ${describeRows(rows)}`);
        const rendered = renderNotification('WITHDRAWAL_REQUESTED', 'SMS', sms.template_data, CTX);
        assert.equal(rendered.channel === 'SMS' && rendered.text,
            `Event Village : demande de retrait de ${smsAmount(Number(sms.template_data.amount))} vers Orange Money enregistrée. Pas vous ? Ouvrez l'aide : https://app.eventvillage.sn/aide`);
        const inApp = renderNotification('WITHDRAWAL_REQUESTED', 'IN_APP', app.template_data, CTX);
        assert.equal(inApp.channel === 'IN_APP' && inApp.actionUrl, `/partner/finance/retraits/${cashoutId}`, 'lien vers la page du retrait');

        const mark = smsMark(partner.phoneE164);
        await dispatchAt(new Date(Date.parse(sms.due_at) + 1_000), { ids: [sms.id] });
        const [sent] = await outboxRows({ ids: [sms.id] });
        assert.equal(sent.status, 'SENT', `${sent.status} ${sent.reason ?? ''}`);
        const got = smsTo(partner.phoneE164, mark);
        assert.equal(got.length, 1);
        assert.match(got[0].message, /Pas vous \? Ouvrez l'aide : https?:\/\/\S+\/aide$/, got[0].message);
    });

    test('versé dans les 2 minutes : le SMS d’accusé est annulé, un seul SMS reçu (celui du versement)', async () => {
        setFakeMode('cashoutMode', 'success');
        const partner = await fundedPartner('avis2-verse');
        const { cashoutId } = await requestWithdrawal(partner, 6_000);
        await CashoutService.send(cashoutId);
        await CashoutService.confirmSent(200);
        const { data: c, error } = await service.from('cashouts').select('status').eq('id', cashoutId).single();
        assert.equal(error, null, error?.message);
        assert.equal(c!.status, 'CONFIRME', 'précondition : retrait versé');
        const ack = await outboxRows({ type: 'WITHDRAWAL_REQUESTED', userId: partner.userId, channel: 'SMS' });
        assert.deepEqual(ack.map((r) => [r.status, r.reason]), [['CANCELLED', 'SUPERSEDED']], `SMS d'accusé annulé : ${describeRows(ack)}`);
        const paid = await outboxRows({ type: 'WITHDRAWAL_PAID', userId: partner.userId, channel: 'SMS' });
        assert.equal(paid.length, 1, `SMS du versement : ${describeRows(paid)}`);
        const mark = smsMark(partner.phoneE164);
        await dispatchAt(new Date(Date.now() + 3 * 60_000), { ids: [...ack, ...paid].map((r) => r.id) });
        const got = smsTo(partner.phoneE164, mark);
        assert.equal(got.length, 1, `un seul SMS : ${JSON.stringify(got.map((m) => m.message))}`);
        assert.match(got[0].message, /a été versé/);
    });
});

// ── A5 : dossier complété ───────────────────────────────────────────────────────────────────────────────────────────

describe('A5 — dossier complété : accusé à la partenaire', () => {
    test('date de dépôt posée : cloche et notification « Dossier envoyé », lien vers le tableau de bord', async () => {
        const partner = await newPartner('avis2-dossier');
        const at = new Date().toISOString();
        const { error } = await service.from('partners').update({ resubmitted_at: at }).eq('id', partner.partnerId);
        assert.equal(error, null, error?.message);
        const rows = await outboxRows({ type: 'PARTNER_RESUBMITTED_ACK', userId: partner.userId });
        assert.deepEqual(channels(rows), ['IN_APP', 'PUSH'], describeRows(rows));
        const r = renderNotification('PARTNER_RESUBMITTED_ACK', 'IN_APP', rows[0].template_data, CTX);
        assert.deepEqual(r.channel === 'IN_APP' && [r.title, r.actionUrl], ['Dossier envoyé', '/partner/dashboard']);
        // Même date relue : aucun second avis
        const { error: again } = await service.from('partners').update({ resubmitted_at: at }).eq('id', partner.partnerId);
        assert.equal(again, null, again?.message);
        assert.equal((await outboxRows({ type: 'PARTNER_RESUBMITTED_ACK', userId: partner.userId })).length, 2, 'aucun second avis');
    });
});

// ── A8 et A9 : contrôleur ───────────────────────────────────────────────────────────────────────────────────────────

describe('A8 et A9 — caisse validée, poste changé', () => {
    let M: Mount;
    before(async () => {
        M = await mount('avis2-poste', { canAcceptCash: false });
    });

    test('A9 : encaissement donné puis porte changée par l’organisatrice → un avis chacun ; porte choisie par le contrôleur → rien', async () => {
        const before0 = (await outboxRows({ type: 'CONTROLLER_POST_CHANGED', userId: M.ctrl.userId, channel: 'IN_APP' })).length;
        const cash = await service.rpc('event_controller_set_cash', { p: { assignment_id: M.assignmentId, actor_id: M.P.userId, can_accept_cash: true } });
        assert.equal(cash.error, null, cash.error?.message);
        assert.equal((cash.data as Row).ok, true, JSON.stringify(cash.data));
        let rows = (await outboxRows({ type: 'CONTROLLER_POST_CHANGED', userId: M.ctrl.userId, channel: 'IN_APP' })).slice(before0);
        assert.equal(rows.length, 1, `un avis pour l'encaissement : ${describeRows(rows)}`);
        assert.deepEqual(rows[0].template_data.changes, ['CASH']);
        const r1 = renderNotification('CONTROLLER_POST_CHANGED', 'IN_APP', rows[0].template_data, CTX);
        assert.match(r1.channel === 'IN_APP' ? r1.content : '', /vous pouvez maintenant encaisser en espèces\.$/);

        const gate = await service.rpc('event_controller_gate_set', {
            p: { actor_id: M.P.userId, event_id: M.ev.eventId, controller_id: M.ctrl.userId, gate_id: M.gate2, gate_change_allowed: true },
        });
        assert.equal(gate.error, null, gate.error?.message);
        assert.equal((gate.data as Row).ok, true, JSON.stringify(gate.data));
        rows = (await outboxRows({ type: 'CONTROLLER_POST_CHANGED', userId: M.ctrl.userId, channel: 'IN_APP' })).slice(before0);
        assert.equal(rows.length, 2, `un avis pour la porte : ${describeRows(rows)}`);
        assert.deepEqual(rows[1].template_data.changes, ['GATE']);
        const r2 = renderNotification('CONTROLLER_POST_CHANGED', 'IN_APP', rows[1].template_data, CTX);
        assert.match(r2.channel === 'IN_APP' ? r2.content : '', /votre porte est maintenant « Porte 2 »\.$/);
        assert.equal(r2.channel === 'IN_APP' && r2.actionUrl, '/controller/scanner');

        const self = await service.rpc('controller_gate_select', { p: { actor_id: M.ctrl.userId, event_id: M.ev.eventId, gate_id: M.gate1 } });
        assert.equal(self.error, null, self.error?.message);
        assert.equal((self.data as Row).ok, true, JSON.stringify(self.data));
        rows = (await outboxRows({ type: 'CONTROLLER_POST_CHANGED', userId: M.ctrl.userId, channel: 'IN_APP' })).slice(before0);
        assert.equal(rows.length, 2, `porte choisie par le contrôleur lui-même : aucun avis : ${describeRows(rows)}`);
    });

    test('A8 : écart validé par l’organisatrice → avis au contrôleur, une fois', async () => {
        const cash = await service.rpc('event_controller_set_cash', { p: { assignment_id: M.assignmentId, actor_id: M.P.userId, can_accept_cash: true } });
        assert.equal(cash.error, null, cash.error?.message);
        const opened = await openShift(M.ctrl, M.ev.eventId, 0);
        assert.equal(opened.status, 200, JSON.stringify(opened.body).slice(0, 300));
        const shiftId = String((opened.body.shift as { id?: string } | undefined)?.id ?? opened.body.shift_id ?? opened.body.id);
        const closed = await api('POST', 'controller/shifts/close', {
            token: M.ctrl.accessToken, body: { shiftId, declaredCashTotal: 500, justification: 'Monnaie rendue en trop (avis 2c)' },
        });
        assert.equal(closed.status, 200, show(closed));
        const { data, error } = await service.rpc('shift_discrepancy_validate', { p: { shift_id: shiftId, actor_id: M.P.userId } });
        assert.equal(error, null, error?.message);
        assert.equal((data as Row).ok, true, JSON.stringify(data));
        const rows = await outboxRows({ type: 'SHIFT_DISCREPANCY_VALIDATED', userId: M.ctrl.userId });
        assert.deepEqual(channels(rows), ['IN_APP', 'PUSH'], describeRows(rows));
        const r = renderNotification('SHIFT_DISCREPANCY_VALIDATED', 'IN_APP', rows[0].template_data, CTX);
        assert.match(r.channel === 'IN_APP' ? r.content : '', /^L'organisateur a validé votre caisse de « .+ »\.$/);
    });
});

// ── A10 : bienvenue ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('A10 — bienvenue après l’inscription par la route', () => {
    test('cloche et notification « Bienvenue sur Event Village », une seule', async () => {
        const flow = await registerClientFlow();
        assert.ok(flow.userId, 'inscription réussie');
        const rows = await outboxRows({ type: 'ACCOUNT_WELCOME', userId: flow.userId! });
        assert.deepEqual(channels(rows), ['IN_APP', 'PUSH'], describeRows(rows));
        const r = renderNotification('ACCOUNT_WELCOME', 'IN_APP', rows[0].template_data, CTX);
        assert.deepEqual(r.channel === 'IN_APP' && [r.title, r.actionUrl], ['Bienvenue sur Event Village', '/']);
    });
});
