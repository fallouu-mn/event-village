/**
 * Lot 9 bis, tâche 7 — R106 (partie argent) : une commission de parrainage née d'un billet n'est disponible que
 * 7 jours après la FIN de l'événement, jamais avant (consigne A.7 ; contrat 5.7, B12 ; découverte
 * 9bis/discovery-9bis-versements.md section 4). Faux SamirPay de tests/fakes, un parrain et un filleul neufs par cas.
 *  1. un filleul achète pour un événement dans 30 jours : available_at = fin de l'événement + 7 jours, écriture
 *     COMMISSION du grand livre à la même date, solde PARRAINAGE disponible à 0 ;
 *  2. commission vieillie AVAILABLE d'un événement non terminé : referral_commissions_realign(p_event) la repasse
 *     PENDING à fin + 7 jours, écriture COMM-<id> déplacée, audit REFERRAL_COMMISSION_DEFERRED (commission_id,
 *     event_id, old_available_at, new_available_at, old_status, regle) ; un second appel ne change rien ;
 *  3. la fin de l'événement reculée d'un jour (trigger trg_events_referral_realign) : commission repoussée d'un jour ;
 *  4. témoins : paiement d'abonnement sans événement (confirmation + 7 jours, règle inchangée) ; ligne déjà retirée
 *     en partie (paid_amount > 0) inchangée par le réalignement.
 *
 * Rouge aujourd'hui : 1 et 3 parce que calculate_referral_commissions pose confirmation + 7 jours
 * (supabase/migrations/20261106000004_lot8_commissions.sql:69) ; 2 et 4 (seconde moitié) parce que
 * referral_commissions_realign n'existe pas (PGRST202, M07). Vert dès l'écriture (signalé) : le témoin d'abonnement
 * de 4 (règle inchangée) ; son garde-fou est le cas 1, même calcul pour un billet.
 * L'événement de test a une date ET une heure de fin saisies (createPartnerEvent : J+30, 23:00) : la fin ne dépend
 * pas de la règle R16 (début + 6 h). Le réalignement est toujours appelé sur l'événement du cas (base partagée).
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { balanceOf, buyConfirmed, createPartnerEvent, getSetting, ledgerOf, newPartner, type TestPartner } from './finance-helpers';
import { fakePay, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';

type Row = Record<string, unknown>;

const DAY_MS = 24 * 3600 * 1000;
/** Tolérance sur une date posée par le serveur (now() de la transaction contre l'horloge du test). */
const TOLERANCE_MS = 60_000;
const ms = (x: unknown): number => Date.parse(String(x));

let partner: TestPartner;
let delayDays: number;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    partner = await newPartner('9bis-commissions');
    delayDays = Number(await getSetting('finance.referral_availability_days'));
    assert.equal(delayDays, 7, 'précondition : délai de disponibilité par défaut de 7 jours (B12)');
});

after(async () => {
    await assertLot9bisInvariants('commissions-fin-evenement');
});

// ── Montage ────────────────────────────────────────────────────────────────

interface Chain { sponsor: Buyer; filleul: Buyer }

/** Parrain → filleul, grille STANDARD client à client (5 %), comme l'inscription ; un couple neuf par cas. */
async function chain(label: string): Promise<Chain> {
    const sponsor = await newBuyer(`9bis-com-${label}-p`, { firstName: 'Ibrahima', lastName: 'Parrain' });
    const filleul = await newBuyer(`9bis-com-${label}-f`, { firstName: 'Khady', lastName: 'Filleule' });
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsor.userId, referred_id: filleul.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12,
        expires_at: new Date(Date.now() + 365 * DAY_MS).toISOString(), is_active: true,
    });
    assert.equal(error, null, `relation de parrainage : ${error?.message}`);
    return { sponsor, filleul };
}

async function saleEvent(label: string): Promise<SaleEvent> {
    return createPartnerEvent(partner.partnerId, `9bis commissions ${label}`, [{ name: 'Standard', price: 1000, total: 20 }], { daysFromNow: 30 });
}

/** Fin de l'événement telle que saisie (date et heure de fin, heure de Dakar = UTC). */
async function eventEndMs(eventId: string): Promise<number> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    assert.ok(data.end_date && data.end_time, `précondition : date et heure de fin saisies (${JSON.stringify(data)})`);
    const t = String(data.end_time);
    return Date.parse(`${String(data.end_date)}T${t.length === 5 ? `${t}:00` : t}Z`);
}

async function commissionOf(paymentId: string, sponsorId: string): Promise<Row> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('payment_id', paymentId).eq('sponsor_id', sponsorId).eq('generation', 'N1');
    assert.equal(error, null, `commission du paiement ${paymentId} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une commission N1 pour le paiement ${paymentId} : ${JSON.stringify(data)}`);
    return (data ?? [])[0] as Row;
}

async function commissionById(id: string): Promise<Row> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('id', id).single();
    assert.equal(error, null, `commission ${id} : ${error?.message}`);
    return data as Row;
}

/** Écriture COMMISSION du grand livre de cette commission (source COMM-<id>). */
async function creditOf(sponsor: Buyer, commissionId: string): Promise<Row> {
    const rows = (await ledgerOf(sponsor.userId, 'PARRAINAGE')).filter((e) => e.commission_id === commissionId && e.entry_type === 'COMMISSION');
    assert.equal(rows.length, 1, `une écriture COMMISSION pour la commission ${commissionId} : ${JSON.stringify(rows)}`);
    return rows[0];
}

async function deferAudits(commissionId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', 'REFERRAL_COMMISSION_DEFERRED').eq('metadata->>commission_id', commissionId).order('created_at');
    assert.equal(error, null, `journal REFERRAL_COMMISSION_DEFERRED : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** RPC du contrat 3.2 (M07), appelée sur l'événement du cas seulement. */
async function realign(eventId: string): Promise<void> {
    const { error } = await service.rpc('referral_commissions_realign', { p_event: eventId });
    assert.equal(error, null, `referral_commissions_realign(p_event) absente ou en échec (contrat 3.2, M07, fix(9b.7)) : ${error?.message} (code ${error?.code})`);
}

/** Commission « vieillie » comme le ferait l'ancienne règle : disponible depuis une minute, écriture comprise. */
async function ageToAvailable(c: Row, extra: Row = {}): Promise<string> {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error } = await service.from('referral_commissions').update({ status: 'AVAILABLE', available_at: past, ...extra }).eq('id', c.id);
    assert.equal(error, null, `commission ${String(c.id)} vieillie : ${error?.message}`);
    const { error: lErr } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', c.id).eq('entry_type', 'COMMISSION');
    assert.equal(lErr, null, `écriture COMMISSION vieillie : ${lErr?.message}`);
    return past;
}

// ── 1. Disponibilité après la fin ──────────────────────────────────────────

describe('Tâche 7 — commission d’un billet disponible 7 jours après la fin de l’événement (R106, B12)', () => {
    test('1. achat pour un événement dans 30 jours : available_at = fin + 7 jours, crédit COMMISSION à la même date, rien de disponible', async () => {
        const ev = await saleEvent('fin');
        const { sponsor, filleul } = await chain('fin');
        const p = await buyConfirmed(filleul, ev, [['Standard', 1]]);
        const c = await commissionOf(p.payment.id, sponsor.userId);
        const due = (await eventEndMs(ev.eventId)) + delayDays * DAY_MS;
        assert.equal(c.status, 'PENDING', 'commission en attente');
        assert.ok(Math.abs(ms(c.available_at) - due) <= TOLERANCE_MS,
            `available_at ${String(c.available_at)} attendu à la fin de l’événement + ${delayDays} j (${new Date(due).toISOString()}), pas à la confirmation ${String(p.payment.paid_at)} + ${delayDays} j`);
        const credit = await creditOf(sponsor, String(c.id));
        assert.ok(Math.abs(ms(credit.available_at) - ms(c.available_at)) <= 1000, `crédit COMMISSION disponible à la même date que la commission : ${String(credit.available_at)}`);
        const b = await balanceOf(sponsor.userId, 'PARRAINAGE');
        assert.deepEqual([b.available, Math.round(b.pending * 100)], [0, Math.round(Number(c.amount) * 100)], 'solde PARRAINAGE : rien de disponible avant fin + 7 jours');
    });
});

// ── 2. Réalignement des commissions déjà disponibles ───────────────────────

describe('Tâche 7 — referral_commissions_realign : une commission disponible trop tôt repasse en attente (B12)', () => {
    test('2. commission AVAILABLE d’un événement non terminé : PENDING à fin + 7 jours, écriture déplacée, audit, second appel sans effet', async () => {
        const ev = await saleEvent('realign');
        const { sponsor, filleul } = await chain('realign');
        const p = await buyConfirmed(filleul, ev, [['Standard', 1]]);
        const c = await commissionOf(p.payment.id, sponsor.userId);
        const old = await ageToAvailable(c);
        const due = (await eventEndMs(ev.eventId)) + delayDays * DAY_MS;

        await realign(ev.eventId);
        const moved = await commissionById(String(c.id));
        assert.equal(moved.status, 'PENDING', 'la commission repasse en attente');
        assert.ok(Math.abs(ms(moved.available_at) - due) <= TOLERANCE_MS, `nouvelle date ${String(moved.available_at)} = fin + ${delayDays} j (${new Date(due).toISOString()})`);
        assert.ok(Math.abs(ms((await creditOf(sponsor, String(c.id))).available_at) - ms(moved.available_at)) <= 1000, 'écriture COMM-<id> déplacée à la même date');
        assert.equal((await balanceOf(sponsor.userId, 'PARRAINAGE')).available, 0, 'plus rien de disponible au parrain');

        const audits = await deferAudits(String(c.id));
        assert.equal(audits.length, 1, `un audit REFERRAL_COMMISSION_DEFERRED par ligne déplacée : ${JSON.stringify(audits)}`);
        const m = (audits[0].metadata ?? {}) as Row;
        assert.deepEqual(
            { commission_id: m.commission_id, event_id: m.event_id, old_status: m.old_status, old: ms(m.old_available_at), moved: ms(m.new_available_at) === ms(moved.available_at), regle: typeof m.regle === 'string' && String(m.regle).length > 0 },
            { commission_id: c.id, event_id: ev.eventId, old_status: 'AVAILABLE', old: ms(old), moved: true, regle: true },
            `journal explicite (contrat 5.7) : ${JSON.stringify(m)}`);
        assert.equal(audits[0].user_role, 'SYSTEM', 'décision du système, pas d’un compte');

        await realign(ev.eventId);
        const again = await commissionById(String(c.id));
        assert.deepEqual([again.status, ms(again.available_at)], [moved.status, ms(moved.available_at)], 'second appel : rien ne bouge');
        assert.equal((await deferAudits(String(c.id))).length, 1, 'second appel : aucun nouvel audit (IS DISTINCT FROM)');
    });

    test('3. fin de l’événement reculée d’un jour : la commission en attente est repoussée d’un jour (trg_events_referral_realign)', async () => {
        const ev = await saleEvent('recul');
        const { sponsor, filleul } = await chain('recul');
        const p = await buyConfirmed(filleul, ev, [['Standard', 1]]);
        const c = await commissionOf(p.payment.id, sponsor.userId);
        const end = await eventEndMs(ev.eventId);
        const { data: dates, error: dErr } = await service.from('events').select('end_date').eq('id', ev.eventId).single();
        assert.equal(dErr, null, `date de fin : ${dErr?.message}`);
        const later = new Date(Date.parse(`${String(dates.end_date)}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
        const { error } = await service.from('events').update({ end_date: later }).eq('id', ev.eventId);
        assert.equal(error, null, `fin reculée d’un jour : ${error?.message}`);
        assert.equal(await eventEndMs(ev.eventId), end + DAY_MS, 'précondition : fin reculée de 24 h');

        const pushed = await commissionById(String(c.id));
        const due = end + DAY_MS + delayDays * DAY_MS;
        assert.ok(Math.abs(ms(pushed.available_at) - due) <= TOLERANCE_MS, `commission repoussée à la nouvelle fin + ${delayDays} j (${new Date(due).toISOString()}) : ${String(pushed.available_at)}`);
        assert.equal(pushed.status, 'PENDING', 'toujours en attente');
        assert.ok(Math.abs(ms((await creditOf(sponsor, String(c.id))).available_at) - ms(pushed.available_at)) <= 1000, 'écriture COMMISSION repoussée avec elle');
    });
});

// ── 4. Témoins ─────────────────────────────────────────────────────────────

describe('Tâche 7 — témoins : abonnement et ligne déjà retirée inchangés (B12)', () => {
    test('4 a. paiement d’abonnement sans événement : disponible à la confirmation + 7 jours, règle inchangée', async () => {
        const { sponsor, filleul } = await chain('abonnement');
        const { data: pay, error } = await service.from('payments').insert({
            transaction_id: `TX-9BIS-COM-${randomUUID()}`, client_id: filleul.userId, payment_target: 'SUBSCRIPTION', event_id: null,
            amount: 10_000, facial_amount: 10_000, service_fee: 0, aggregator_fee: 150, partner_payout_amount: 0,
            gross_event_village_revenue: 10_000, net_event_village_revenue: 9_850, currency: 'XOF', is_platform_payment: true,
            status: 'SUCCESS', operator: 'WAVE', paid_at: new Date().toISOString(),
        }).select('id').single();
        assert.equal(error, null, `paiement d’abonnement de test : ${error?.message}`);
        const before0 = Date.now();
        const { error: cErr } = await service.rpc('calculate_referral_commissions', { p_payment_id: pay.id });
        assert.equal(cErr, null, `calculate_referral_commissions : ${cErr?.message}`);
        const c = await commissionOf(String(pay.id), sponsor.userId);
        assert.ok(Math.abs(ms(c.available_at) - (before0 + delayDays * DAY_MS)) <= TOLERANCE_MS, `abonnement : confirmation + ${delayDays} j (${String(c.available_at)})`);
    });

    test('4 b. ligne déjà retirée en partie (paid_amount > 0) : le réalignement ne la touche pas, aucun audit', async () => {
        const ev = await saleEvent('retiree');
        const { sponsor, filleul } = await chain('retiree');
        const p = await buyConfirmed(filleul, ev, [['Standard', 1]]);
        const c = await commissionOf(p.payment.id, sponsor.userId);
        const half = Math.round(Number(c.amount) * 50) / 100;
        const old = await ageToAvailable(c, { paid_amount: half });

        await realign(ev.eventId);
        const kept = await commissionById(String(c.id));
        assert.deepEqual([kept.status, ms(kept.available_at), Number(kept.paid_amount)], ['AVAILABLE', ms(old), half], 'ligne déjà retirée en partie : inchangée');
        assert.deepEqual(await deferAudits(String(c.id)), [], 'aucun audit pour une ligne inchangée');
    });
});
