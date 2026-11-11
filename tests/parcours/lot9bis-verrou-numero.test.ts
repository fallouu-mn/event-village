/**
 * Lot 9 bis, tâche 9 (ex-10.0 a ; contrat 5.9, B26, B15, 4.1) — retraits bloqués 24 h après un changement de numéro.
 * Règle unique fin_withdrawal_check (appelée par withdrawal_request sous verrou et par withdrawal_quote) : si la
 * dernière ligne audit_logs ACCOUNT_PHONE_CHANGED du compte (object_type 'users', object_id = compte, écrite par
 * account_phone_finalize dans sa transaction) a moins de 24 h, refus WITHDRAWAL_LOCKED_PHONE_CHANGE avec `unlock_at`
 * (= cette ligne + 24 h), pour les deux comptes (ORGANISATEUR et PARRAINAGE) ; la route du code répond 423, sans SMS
 * ni code enregistré.
 *
 * Rouge avant correctif : aucun contrôle dans withdrawal_request (M/20261101000014:12-137, point ouvert AR1 du lot 9) :
 * le retrait est accepté juste après le changement ; la route du code envoie le code au nouveau numéro.
 * Le cas « vraie route du profil » passe par confirmPassword (R57) : rouge aussi jusqu'à fix(9b.13), qui crée la route
 * POST /api/account/password-confirm (l'aide le dit dans son message).
 * Le retrait accepté une fois la ligne d'audit vieillie à 25 h serait vrai aujourd'hui (aucun verrou) : le même test
 * exige d'abord le refus juste après le changement, il est donc rouge pour la bonne raison jusqu'au correctif.
 * Chaque test crée sa partenaire (ventes de 100 000 F disponibles tout de suite) et son filleul (commission de
 * parrainage rendue disponible, patron finance-retraits.test.ts:188-212). Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { getFakes } from '../fakes';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { STRONG_PASSWORD, confirmPassword, randomSenegalPhone } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import {
    buyConfirmed, confirmCashouts, createPartnerEvent, jsonRequest, newPartner, withSettings,
    type AccountKind, type FinanceSettingKey, type TestPartner,
} from './finance-helpers';
import { authed, type RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

after(async () => {
    await assertLot9bisInvariants('lot9bis-verrou-numero');
});

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const LOCKED = 'WITHDRAWAL_LOCKED_PHONE_CHANGE';
const OTP_ROUTE = '../../app/api/withdrawals/otp/route';
const PHONE_START_ROUTE = '../../app/api/account/phone/start/route';
const PHONE_CONFIRM_ROUTE = '../../app/api/account/phone/confirm/route';
const LOCKED_TEXT = /^Retrait impossible pendant 24 h après un changement de numéro\. Réessayez après le .+\.$/;

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

// ── Partenaire approvisionnée sur ses deux comptes ─────────────────────────

interface Funded {
    partner: TestPartner;
    /** Montant retirable du compte PARRAINAGE (commission arrondie au FCFA inférieur). */
    referral: number;
}

async function fundedPartner(label: string): Promise<Funded> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 100_000, total: 5 }]);
    const filleul = await newBuyer(`${label}-filleul`);
    const { error: relErr } = await service.from('referral_relationships').insert({
        sponsor_id: partner.userId, referred_id: filleul.userId, referral_type: 'CLIENT_TO_CLIENT',
        sponsor_status_at_creation: 'STANDARD', rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12,
        expires_at: new Date(Date.now() + 365 * 24 * HOUR).toISOString(), is_active: true,
    });
    assert.equal(relErr, null, `relation de parrainage : ${relErr?.message}`);
    const purchase = await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(filleul, ev, [['Standard', 1]]));

    const { data: comms, error } = await service.from('referral_commissions').select('id, amount')
        .eq('payment_id', purchase.payment.id).eq('sponsor_id', partner.userId).eq('generation', 'N1');
    assert.equal(error, null, `commission : ${error?.message}`);
    assert.equal((comms ?? []).length, 1, `une commission N1 de la partenaire marraine : ${JSON.stringify(comms)}`);
    const commission = comms![0];
    // Délai de disponibilité écoulé (§102), puis libération par la RPC du cron. R106 (w18) : la commission d'un billet
    // n'est disponible qu'après la fin de l'événement + le délai réglé (14 j au plus) ; l'événement propre à cette
    // préparation est donc fini depuis 16 jours, après l'achat (la reprise des échéances ne les avance jamais).
    const endedDay = new Date(Date.now() - 16 * 86_400_000).toISOString().slice(0, 10);
    const { error: dErr } = await service.from('events')
        .update({ start_date: endedDay, start_time: '20:00:00', end_date: endedDay, end_time: '23:00:00' }).eq('id', ev.eventId);
    assert.equal(dErr, null, `événement fini depuis 16 jours : ${dErr?.message}`);
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error: cErr } = await service.from('referral_commissions').update({ available_at: past }).eq('id', commission.id);
    assert.equal(cErr, null, `échéance de la commission : ${cErr?.message}`);
    const { error: lErr } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', commission.id);
    assert.equal(lErr, null, `échéance de l'écriture COMMISSION : ${lErr?.message}`);
    const { error: relErr2 } = await service.rpc('referral_commissions_release');
    assert.equal(relErr2, null, `referral_commissions_release : ${relErr2?.message}`);

    const referral = Math.floor(Number(commission.amount));
    assert.ok(referral >= 1, `commission suffisante pour un retrait de parrainage (${commission.amount})`);
    const org = await balance(partner.userId, 'ORGANISATEUR');
    assert.equal(Number(org.available), 100_000, `fonds organisateur disponibles : ${JSON.stringify(org)}`);
    return { partner, referral };
}

async function balance(ownerId: string, kind: AccountKind): Promise<Row> {
    const { data, error } = await service.rpc('finance_account_balance', { p_owner: ownerId, p_kind: kind });
    assert.equal(error, null, `finance_account_balance : ${error?.message}`);
    return (data ?? {}) as Row;
}

// ── Changement de numéro ───────────────────────────────────────────────────

/** Identifiant de session du jeton d'accès (revendication session_id de GoTrue) : la session gardée. */
function sessionIdOf(accessToken: string): string {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as Row;
    assert.equal(typeof payload.session_id, 'string', `session_id absent du jeton : ${JSON.stringify(Object.keys(payload))}`);
    return String(payload.session_id);
}

/**
 * account_phone_finalize (même RPC que POST /api/account/phone/confirm) ; rend le nouveau numéro.
 * Ordre de la route (AR2) : l'API d'authentification d'abord, puis la RPC (patron email-regle-envoi.test.ts:192).
 * Sans cet alignement, le profil et auth.users divergent et l'invariant (v) du lot 9 tombe dans toutes les suites
 * suivantes (triage du run 118, cause A).
 */
async function finalizePhone(user: Buyer): Promise<string> {
    const { data: current, error: curErr } = await service.from('users').select('phone').eq('id', user.userId).single();
    assert.equal(curErr, null, `numéro actuel : ${curErr?.message}`);
    const next = randomSenegalPhone('78');
    const { error: authErr } = await service.auth.admin.updateUserById(user.userId, { phone: next, phone_confirm: true });
    assert.equal(authErr, null, `numéro d’authentification : ${authErr?.message}`);
    const { data, error } = await service.rpc('account_phone_finalize', {
        p: { user_id: user.userId, new_phone: next, expected_phone: current.phone, keep_session_id: sessionIdOf(user.accessToken) },
    });
    assert.equal(error, null, `account_phone_finalize : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `changement de numéro : ${JSON.stringify(data)}`);
    return next;
}

async function phoneChangeAudits(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('id, created_at').eq('action', 'ACCOUNT_PHONE_CHANGED')
        .eq('object_type', 'users').eq('object_id', userId).order('created_at', { ascending: false });
    assert.equal(error, null, `journal ACCOUNT_PHONE_CHANGED : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Échéance attendue du verrou : dernière ligne d'audit du changement + 24 h. */
async function expectedUnlock(userId: string): Promise<number> {
    const rows = await phoneChangeAudits(userId);
    assert.ok(rows.length >= 1, 'une ligne d’audit ACCOUNT_PHONE_CHANGED (account_phone_finalize)');
    return Date.parse(String(rows[0].created_at)) + 24 * HOUR;
}

function assertUnlockAt(value: unknown, expected: number, what: string): void {
    assert.ok(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${what} : unlock_at absent ou illisible (${JSON.stringify(value)})`);
    assert.ok(Math.abs(Date.parse(value) - expected) <= 1_000, `${what} : unlock_at ${value}, attendu ${new Date(expected).toISOString()} (changement + 24 h)`);
}

// ── Retraits ───────────────────────────────────────────────────────────────

async function rpcWithdraw(user: Buyer, gross: number, kind: AccountKind = 'ORGANISATEUR'): Promise<Row> {
    const { data, error } = await service.rpc('withdrawal_request', {
        p: {
            user_id: user.userId, account_kind: kind, gross_amount: gross, method: 'MOBILE_MONEY', operator: 'WAVE',
            phone_number: user.phone9, client_key: randomUUID(),
        },
    });
    assert.equal(error, null, `withdrawal_request : ${error?.message}`);
    return (data ?? {}) as Row;
}

async function withdrawalsOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('withdrawals').select('id, account_kind, status').eq('user_id', userId);
    assert.equal(error, null, `retraits de ${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Retrait accepté (rouge d'aujourd'hui ou témoin) : versement envoyé puis confirmé, rien laissé en attente. */
async function settle(out: Row): Promise<void> {
    if (out.ok !== true || typeof out.cashout_id !== 'string') return;
    await CashoutService.send(out.cashout_id);
    await confirmCashouts();
}

/** Refus du verrou, sur les deux comptes, sans retrait créé. */
async function assertLocked(f: Funded, label: string): Promise<void> {
    const expected = await expectedUnlock(f.partner.userId);
    const org = await withSettings(WITHDRAWAL_RULES, () => rpcWithdraw(f.partner, 5_000));
    await settle(org);
    assert.equal(org.ok, false, `${label} : retrait ORGANISATEUR accepté juste après un changement de numéro : ${JSON.stringify(org)}`);
    assert.equal(org.code, LOCKED, `${label} : ${JSON.stringify(org)}`);
    assertUnlockAt(org.unlock_at, expected, `${label} (ORGANISATEUR)`);

    const parr = await withSettings({ ...WITHDRAWAL_RULES, 'finance.withdrawal_min_amount': 0 }, () => rpcWithdraw(f.partner, f.referral, 'PARRAINAGE'));
    await settle(parr);
    assert.equal(parr.code, LOCKED, `${label} : même refus pour le compte PARRAINAGE : ${JSON.stringify(parr)}`);
    assertUnlockAt(parr.unlock_at, expected, `${label} (PARRAINAGE)`);

    assert.deepEqual(await withdrawalsOf(f.partner.userId), [], `${label} : aucun retrait créé`);
}

function codesTo(phone: string): number {
    return getFakes().sms.messagesTo(phone).filter((m) => /\b\d{6}\b/.test(m.message)).length;
}

async function withdrawalOtpRows(phones: string[]): Promise<number> {
    const { data, error } = await service.from('otp_codes').select('id').in('phone', phones).eq('purpose', 'WITHDRAWAL');
    assert.equal(error, null, `codes de retrait : ${error?.message}`);
    return (data ?? []).length;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('ex-10.0 a — retraits bloqués 24 h après un changement de numéro', () => {
    test('reproduit : account_phone_finalize puis withdrawal_request → WITHDRAWAL_LOCKED_PHONE_CHANGE et unlock_at (changement + 24 h) ; PARRAINAGE : même refus ; aucun retrait', async () => {
        const f = await fundedPartner('verrou-rpc');
        await finalizePhone(f.partner);
        await assertLocked(f, 'changement par la RPC');
        assert.equal(Number((await balance(f.partner.userId, 'ORGANISATEUR')).available), 100_000, 'solde organisateur intact');
    });

    test('route du code : POST /api/withdrawals/otp → 423 WITHDRAWAL_LOCKED_PHONE_CHANGE (texte, unlock_at), aucun SMS ni code, à l’ancien comme au nouveau numéro', async () => {
        const f = await fundedPartner('verrou-route');
        const oldPhone = f.partner.phoneE164;
        const next = await finalizePhone(f.partner);
        const expected = await expectedUnlock(f.partner.userId);
        const sms0 = { old: codesTo(oldPhone), next: codesTo(next) };
        const otp0 = await withdrawalOtpRows([oldPhone, next]);

        const handler = await routeHandler(OTP_ROUTE, 'POST', 'POST /api/withdrawals/otp');
        const res = await withSettings(WITHDRAWAL_RULES, () => invoke(handler,
            jsonRequest('/api/withdrawals/otp', 'POST', f.partner.accessToken, { account: 'ORGANISATEUR', amount: 5_000 })));
        assert.equal(res.status, 423, `code de retrait demandé juste après un changement de numéro : ${show(res)}`);
        assert.equal(res.body.code, LOCKED, show(res));
        assert.match(String(res.body.error ?? ''), LOCKED_TEXT, `texte du refus (contrat 4.1) : ${show(res)}`);
        assertUnlockAt(res.body.unlock_at, expected, 'route du code');

        assert.equal(codesTo(next), sms0.next, 'aucun code envoyé au nouveau numéro');
        assert.equal(codesTo(oldPhone), sms0.old, 'aucun code envoyé à l’ancien numéro');
        assert.equal(await withdrawalOtpRows([oldPhone, next]), otp0, 'aucun code de retrait enregistré');
    });

    test('ligne d’audit vieillie à 25 h : retraits ORGANISATEUR et PARRAINAGE acceptés, après le refus exigé juste après le changement', async () => {
        const f = await fundedPartner('verrou-vieilli');
        await finalizePhone(f.partner);
        await assertLocked(f, 'avant le vieillissement');

        const audits = await phoneChangeAudits(f.partner.userId);
        const { error } = await service.from('audit_logs').update({ created_at: new Date(Date.now() - 25 * HOUR).toISOString() })
            .in('id', audits.map((a) => String(a.id)));
        assert.equal(error, null, `vieillissement du journal : ${error?.message}`);

        const org = await withSettings(WITHDRAWAL_RULES, () => rpcWithdraw(f.partner, 5_000));
        await settle(org);
        assert.equal(org.ok, true, `retrait ORGANISATEUR 25 h après le changement : ${JSON.stringify(org)}`);
        const parr = await withSettings({ ...WITHDRAWAL_RULES, 'finance.withdrawal_min_amount': 0 }, () => rpcWithdraw(f.partner, f.referral, 'PARRAINAGE'));
        await settle(parr);
        assert.equal(parr.ok, true, `retrait PARRAINAGE 25 h après le changement : ${JSON.stringify(parr)}`);
    });

    test('garde-fou : changement par les vraies routes du profil (mot de passe confirmé, phone/start puis phone/confirm) → retrait refusé WITHDRAWAL_LOCKED_PHONE_CHANGE', async () => {
        const f = await fundedPartner('verrou-profil');
        await confirmPassword(f.partner, STRONG_PASSWORD);
        const next = randomSenegalPhone('78');
        const sent0 = getFakes().sms.messagesTo(next).length;

        const start = await routeHandler(PHONE_START_ROUTE, 'POST', 'POST /api/account/phone/start');
        const started: RouteResult = await invoke(start, authed('/api/account/phone/start', 'POST', f.partner, { phone: next }));
        assert.equal(started.status, 200, `démarrage du changement : ${show(started)}`);
        const codes = getFakes().sms.messagesTo(next).slice(sent0)
            .map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
        assert.equal(codes.length, 1, `un code reçu au nouveau numéro (${codes.length})`);

        const confirm = await routeHandler(PHONE_CONFIRM_ROUTE, 'POST', 'POST /api/account/phone/confirm');
        const confirmed = await invoke(confirm, authed('/api/account/phone/confirm', 'POST', f.partner, { phone: next, code: codes[0] }));
        assert.equal(confirmed.status, 200, `confirmation du changement : ${show(confirmed)}`);
        const { data: row, error } = await service.from('users').select('phone').eq('id', f.partner.userId).single();
        assert.equal(error, null, error?.message);
        assert.equal(row.phone, next, 'numéro changé');

        await assertLocked(f, 'changement par les routes du profil');
    });
});
