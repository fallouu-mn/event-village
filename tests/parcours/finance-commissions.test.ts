/**
 * Lot 3.5 — commissions de parrainage. Contrat : conception du lot 3, sections A (délai), B (base),
 * C (grand livre), D (remboursements) et E (commissions). Références : CDC §95-§97, §102, §103,
 * Annexes A et C ; constats R24, ticketing-finance-6, data-model-5, data-model-10.
 *
 * Défauts visés (suite ROUGE avant correctif) :
 *  - grille : 0011_referral_codes.sql L117-126 (4 / 1,5 / 24 et 7 / 2 / 36, aucune ligne PRESTATAIRE) ;
 *    seed.sql est conforme, mais seul `db reset` le joue, jamais `db push` (deploiement-projet-neuf.md L40) ;
 *  - commission créée AVAILABLE avec available_at = now() (0002_functions.sql L169-171 et L210-212),
 *    sur une base de 35 F au lieu de 34,25 F (lib/payments/fees.ts L32-38) ;
 *  - aucun cron de disponibilité ; aucune régularisation au remboursement : le trigger ne réagit
 *    qu'à SUCCESS (0002 L222-235), et CHECK amount >= 0 (0001 L609) empêche une ligne négative ;
 *  - /api/referrals/my-stats lit la colonne withdrawals.amount, qui n'existe pas (L97-103), et
 *    additionne tous les statuts (L94).
 *
 * Chaque test crée sa chaîne parrain N2 → parrain N1 → filleul. Les relations sont insérées comme le
 * fait l'inscription (app/api/auth/register/route.ts L126-160). Le partenaire et l'événement sont dédiés.
 * Taux par défaut supposés : service 5 %, agrégateur Wave 1,5 %, délai de disponibilité 7 jours.
 * Le remboursement passe par la route partenaire, puis le cashout est envoyé et confirmé.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { GET as myStatsRoute } from '../../app/api/referrals/my-stats/route';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { routeContext } from './helpers';
import {
    balanceOf, buyConfirmed, cashoutsByKey, confirmCashouts, createPartnerEvent, getSetting, jsonRequest, ledgerOf,
    newPartner, paymentRow, setSetting, superadminId, withSettings, type Purchase, type TestPartner,
} from './finance-helpers';
import { cronRequest, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const DAY_MS = 24 * 3600 * 1000;
const DELAY_KEY = 'finance.referral_availability_days' as const;
/** Colonne inconnue : PostgreSQL (42703) ou cache de schéma PostgREST (PGRST204). */
const MISSING_COLUMN = ['42703', 'PGRST204'];

const cents = (x: unknown): number => Math.round(Number(x) * 100);
const ms = (x: unknown): number => Date.parse(String(x));
const kindOf = (c: Row): string => String(c.kind ?? 'COMMISSION');
const pastIso = (): string => new Date(Date.now() - 60_000).toISOString();
const brief = (c: Row) => ({ id: c.id, gen: c.generation, sponsor: c.sponsor_id, kind: c.kind, status: c.status, amount: c.amount, reason: c.cancellation_reason });

let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    partner = await newPartner('parrainage');
    ev = await createPartnerEvent(partner.partnerId, 'parrainage', [{ name: 'Standard', price: 1000, total: 60 }]);
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertFinanceInvariants('finance-commissions');
});

// ── Chaîne de parrainage ───────────────────────────────────────────────────

interface Chain { n2: Buyer; n1: Buyer; filleul: Buyer }

/** Reproduit app/api/auth/register/route.ts L126-160 : grille du statut du parrain, taux et durée figés. */
async function linkAsAtRegistration(sponsor: Buyer, referred: Buyer): Promise<void> {
    const { data: sp, error: spErr } = await service.from('users').select('referral_status').eq('id', sponsor.userId).single();
    assert.equal(spErr, null, `statut de parrainage : ${spErr?.message}`);
    const { data: cfg, error: cfgErr } = await service.from('referral_config')
        .select('rate_n1, rate_n2, duration_months')
        .eq('sponsor_status', sp!.referral_status)
        .eq('referral_type', 'CLIENT_TO_CLIENT')
        .eq('is_active', true)
        .single();
    assert.equal(cfgErr, null, `referral_config ${sp!.referral_status}/CLIENT_TO_CLIENT : ${cfgErr?.message}`);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + Number(cfg!.duration_months));
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsor.userId,
        referred_id: referred.userId,
        referral_type: 'CLIENT_TO_CLIENT',
        sponsor_status_at_creation: sp!.referral_status,
        rate_n1_at_creation: cfg!.rate_n1,
        rate_n2_at_creation: cfg!.rate_n2,
        duration_months: cfg!.duration_months,
        expires_at: expiresAt.toISOString(),
        is_active: true,
    });
    assert.equal(error, null, `relation de parrainage : ${error?.message}`);
}

async function sponsorChain(label: string): Promise<Chain> {
    const n2 = await newBuyer(`${label}-n2`, { firstName: 'Aminata', lastName: 'ParrainDeux' });
    const n1 = await newBuyer(`${label}-n1`, { firstName: 'Ibrahima', lastName: 'ParrainUn' });
    const filleul = await newBuyer(`${label}-f`, { firstName: 'Khady', lastName: 'Filleule' });
    await linkAsAtRegistration(n2, n1);
    await linkAsAtRegistration(n1, filleul);
    return { n2, n1, filleul };
}

// ── Commissions ────────────────────────────────────────────────────────────

async function commissionsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `commissions du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function only(rows: Row[], pred: (c: Row) => boolean, what: string): Row {
    const found = rows.filter(pred);
    assert.equal(found.length, 1, `${what} : ${found.length} ligne(s) trouvée(s) — ${JSON.stringify(rows.map(brief))}`);
    return found[0];
}

/** Commissions N1 (parrain direct) et N2 (parrain du parrain) nées de la confirmation du paiement. */
async function initialCommissions(p: Purchase, chain: Chain): Promise<{ n1: Row; n2: Row }> {
    const rows = await commissionsOf(p.payment.id);
    return {
        n1: only(rows, (c) => c.generation === 'N1' && c.sponsor_id === chain.n1.userId && kindOf(c) === 'COMMISSION', 'commission N1'),
        n2: only(rows, (c) => c.generation === 'N2' && c.sponsor_id === chain.n2.userId && kindOf(c) === 'COMMISSION', 'commission N2'),
    };
}

async function commissionById(id: string): Promise<Row> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('id', id).single();
    assert.equal(error, null, `commission ${id} : ${error?.message}`);
    return data as Row;
}

/** Table inconnue : PostgreSQL (42P01) ou cache de schéma PostgREST (PGRST205). */
const MISSING_TABLE = ['42P01', 'PGRST205'];

/**
 * Simule la fin du délai de disponibilité (§102) : échéance passée sur la commission et sur son
 * écriture COMMISSION du grand livre, comme sept jours plus tard. Avant correctif, le grand livre
 * n'existe pas : seule la commission est modifiée, et le test échoue plus loin sur le défaut visé.
 */
async function ageCommission(c: Row, extra: Row = {}): Promise<void> {
    const past = pastIso();
    const { error } = await service.from('referral_commissions').update({ available_at: past, ...extra }).eq('id', c.id);
    assert.equal(error, null, `échéance de la commission ${c.id} : ${error?.message}`);
    const { error: lErr } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', c.id).eq('entry_type', 'COMMISSION');
    if (lErr && MISSING_TABLE.includes(lErr.code)) return;
    assert.equal(lErr, null, `échéance de l'écriture COMMISSION ${c.id} : ${lErr?.message}`);
}

/** Mise à jour par la clé de service ; les colonnes du lot 3 sont retirées si elles n'existent pas encore. */
async function softUpdate(table: string, id: string, fields: Row, lot3Fields: Row): Promise<void> {
    let { error } = await service.from(table).update({ ...fields, ...lot3Fields }).eq('id', id);
    if (error && MISSING_COLUMN.includes(error.code)) ({ error } = await service.from(table).update(fields).eq('id', id));
    assert.equal(error, null, `mise à jour ${table} ${id} : ${error?.message}`);
}

/** Retrait inséré par la clé de service. Renvoie false si les colonnes du lot 3 (account_kind…) n'existent pas encore. */
async function insertWithdrawal(user: Buyer, gross: number, status: 'PAID' | 'REJECTED', account: 'PARRAINAGE' | 'ORGANISATEUR'): Promise<boolean> {
    const fee = Math.ceil(gross / 100);
    const base = {
        user_id: user.userId,
        gross_amount: gross,
        fee_rate: 1,
        fee_amount: fee,
        net_amount: gross - fee,
        withdrawal_method: 'MOBILE_MONEY',
        payment_details: { phoneNumber: user.phone9, operatorName: 'WAVE', source: 'test du lot 3' },
        status,
        processed_at: new Date().toISOString(),
        rejection_reason: status === 'REJECTED' ? 'refus simulé (test)' : null,
    };
    const lot3 = { account_kind: account, operator: 'WAVE', phone_number: user.phone9, client_idempotency_key: randomUUID() };
    let { error } = await service.from('withdrawals').insert({ ...base, ...lot3 });
    if (error && MISSING_COLUMN.includes(error.code)) {
        ({ error } = await service.from('withdrawals').insert(base));
        assert.equal(error, null, `retrait de test : ${error?.message}`);
        return false;
    }
    assert.equal(error, null, `retrait de test : ${error?.message}`);
    return true;
}

// ── Remboursement d'un billet (route partenaire, puis cashout envoyé et confirmé) ──

let refundRoute: Handler | null = null;

async function refundTicket(ticketId: string, paymentId: string): Promise<void> {
    if (!refundRoute) {
        const mod = (await importModule('../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route')) as { POST?: Handler };
        assert.ok(mod.POST, 'route POST /api/partner/events/[id]/tickets/[ticketId]/refund absente');
        refundRoute = mod.POST;
    }
    const res = await refundRoute(
        jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken, { reason: 'Remboursement demandé (test parrainage)' }),
        routeContext({ id: ev.eventId, ticketId }),
    );
    const body = await res.json().catch(() => ({}));
    assert.ok(res.status >= 200 && res.status < 300, `remboursement du billet ${ticketId} : HTTP ${res.status} ${JSON.stringify(body)}`);
    // Envoi du cashout (clé REFUND-TKT-<ticketId>) s'il n'est pas déjà parti, puis confirmation.
    const byKey = await cashoutsByKey(`REFUND-TKT-${ticketId}`);
    const { data: byPayment, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId).eq('status', 'A_ENVOYER');
    assert.equal(error, null, `cashouts du paiement : ${error?.message}`);
    const pending = [...byKey, ...((byPayment ?? []) as Row[])]
        .filter((c) => c.status === 'A_ENVOYER')
        .map((c) => String(c.id))
        .filter((id, i, all) => all.indexOf(id) === i);
    for (const id of pending) await CashoutService.send(id);
    await confirmCashouts();
}

// ── Grille du CDC (Annexe A) ───────────────────────────────────────────────

const CDC_GRID = [
    { status: 'STANDARD', type: 'CLIENT_TO_CLIENT', n1: 5, n2: 2, months: 12 },
    { status: 'STANDARD', type: 'CLIENT_TO_PRESTATAIRE', n1: 7, n2: 2, months: 24 },
    { status: 'AMBASSADEUR', type: 'CLIENT_TO_CLIENT', n1: 7, n2: 2, months: 24 },
    { status: 'AMBASSADEUR', type: 'CLIENT_TO_PRESTATAIRE', n1: 10, n2: 3, months: 36 },
] as const;

const INSERT_CONFIG = /INSERT\s+INTO\s+(?:public\.)?referral_config/i;

describe('Commissions de parrainage (lot 3.5)', () => {
    test('grille referral_config : les quatre lignes de l’Annexe A (§95-§97), écrites par une migration', async () => {
        const { data, error } = await service.from('referral_config').select('sponsor_status, referral_type, rate_n1, rate_n2, duration_months, is_active');
        assert.equal(error, null, `referral_config : ${error?.message}`);
        const got = ((data ?? []) as Row[])
            .map((r) => `${r.sponsor_status}/${r.referral_type} ${Number(r.rate_n1)} % / ${Number(r.rate_n2)} % / ${r.duration_months} mois${r.is_active ? '' : ' (inactive)'}`)
            .sort();
        const want = CDC_GRID.map((g) => `${g.status}/${g.type} ${g.n1} % / ${g.n2} % / ${g.months} mois`).sort();
        assert.deepEqual(got, want, 'grille en base');

        // La production applique les migrations (`db push`), jamais seed.sql : si seed.sql écrit encore
        // la grille, la dernière migration qui l'écrit doit contenir les quatre lignes du CDC, avec mise à jour.
        const root = process.cwd();
        const seed = fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8');
        if (!INSERT_CONFIG.test(seed)) return;
        const dir = path.join(root, 'supabase/migrations');
        const writers = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
            .filter((f) => INSERT_CONFIG.test(fs.readFileSync(path.join(dir, f), 'utf8')));
        const last = writers[writers.length - 1];
        assert.ok(last, 'aucune migration n’écrit referral_config');
        const sql = fs.readFileSync(path.join(dir, last), 'utf8');
        const statements = (sql.match(/INSERT\s+INTO\s+(?:public\.)?referral_config[\s\S]*?;/gi) ?? []).join('\n');
        const cast = "(?:::[a-z_.]+)?";
        const missing = CDC_GRID.filter((g) => !new RegExp(
            `'${g.status}'${cast}\\s*,\\s*'${g.type}'${cast}\\s*,\\s*${g.n1}(?:\\.0+)?\\s*,\\s*${g.n2}(?:\\.0+)?\\s*,\\s*${g.months}\\b`, 'i',
        ).test(statements)).map((g) => `${g.status}/${g.type} ${g.n1}/${g.n2}/${g.months}`);
        assert.deepEqual(missing, [], `dernière migration qui écrit referral_config (${last}) : lignes du CDC absentes — seule seed.sql (non jouée en production) les contient`);
        assert.ok(!/DO\s+NOTHING/i.test(statements), `${last} : ON CONFLICT DO NOTHING laisserait en production les taux de 0011 (DO UPDATE attendu)`);
    });

    test('achat d’un billet de 1 000 F par un filleul : N1 1,71 F et N2 0,69 F sur 34,25 F, EN ATTENTE jusqu’à la fin de l’événement + 7 jours, crédit PARRAINAGE en attente', async () => {
        const chain = await sponsorChain('base');
        const p = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        // Annexe C : 1 000 + 50 = 1 050 ; agrégateur 1,5 % × 1 050 = 15,75 ; revenu net EV 34,25
        assert.equal(cents(p.payment.net_event_village_revenue), 3425, `revenu net EV (base du parrainage) : ${p.payment.net_event_village_revenue}`);
        const { n1, n2 } = await initialCommissions(p, chain);
        assert.deepEqual([cents(n1.eligible_net_revenue), Number(n1.commission_rate), cents(n1.amount)], [3425, 5, 171], `N1 : ${JSON.stringify(brief(n1))}`);
        assert.deepEqual([cents(n2.eligible_net_revenue), Number(n2.commission_rate), cents(n2.amount)], [3425, 2, 69], `N2 : ${JSON.stringify(brief(n2))}`);
        assert.deepEqual([n1.status, n2.status], ['PENDING', 'PENDING'], 'commissions EN ATTENTE (§102)');

        const days = Number(await getSetting(DELAY_KEY));
        assert.equal(days, 7, 'délai de disponibilité par défaut');
        const due = (await eventEndMs(ev.eventId)) + days * DAY_MS; // lot 9 bis (R106, B12, T21) : fin de l'événement + 7 j
        for (const c of [n1, n2]) {
            assert.ok(Math.abs(ms(c.available_at) - due) <= 60_000, `available_at ${c.available_at} ≈ fin de l’événement ${new Date(due - days * DAY_MS).toISOString()} + ${days} j (et non la confirmation ${p.payment.paid_at})`);
        }

        for (const [who, c] of [[chain.n1, n1], [chain.n2, n2]] as const) {
            const credit = (await ledgerOf(who.userId, 'PARRAINAGE')).filter((e) => e.commission_id === c.id && e.entry_type === 'COMMISSION');
            assert.equal(credit.length, 1, `écriture COMMISSION au grand livre pour ${c.generation}`);
            assert.equal(cents(credit[0].amount), cents(c.amount), `crédit ${c.generation} = commission`);
            assert.ok(Math.abs(ms(credit[0].available_at) - ms(c.available_at)) <= 1000, `crédit ${c.generation} disponible à la même date que la commission`);
            const b = await balanceOf(who.userId, 'PARRAINAGE');
            assert.deepEqual([cents(b.available), cents(b.pending)], [0, cents(c.amount)], `solde PARRAINAGE ${c.generation} : rien de disponible, tout en attente`);
            assert.ok(b.next_available_at && Math.abs(ms(b.next_available_at) - ms(c.available_at)) <= 1000, `prochaine disponibilité ${b.next_available_at}`);
        }
    });

    test('délai réglable de 7 à 14 jours (finance.referral_availability_days), compté depuis la fin de l’événement, recopié sur la commission à sa naissance (non rétroactif)', async () => {
        const saved = await getSetting(DELAY_KEY);
        const actor = await superadminId();
        try {
            for (const bad of [6, 15, 7.5]) {
                const { data, error } = await service.rpc('finance_setting_set', { p_key: DELAY_KEY, p_value: { value: bad }, p_actor: actor, p_reason: 'borne (test du lot 3)' });
                assert.equal(error, null, `finance_setting_set(${bad}) : ${error?.message}`);
                const r = (data ?? {}) as Row;
                assert.deepEqual([r.ok, r.code], [false, 'INVALID_VALUE'], `délai de ${bad} j refusé (7 ≤ x ≤ 14, entier)`);
            }
        } finally {
            if (JSON.stringify(await getSetting(DELAY_KEY)) !== JSON.stringify(saved)) await setSetting(DELAY_KEY, saved, 'restauration après un test du lot 3');
        }

        const chain = await sponsorChain('delai');
        const p7 = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        const { n1: c7 } = await initialCommissions(p7, chain);
        assert.ok(Math.abs(ms(c7.available_at) - ((await eventEndMs(ev.eventId)) + 7 * DAY_MS)) <= 60_000, `délai de 7 j après la fin de l’événement (R106) : ${c7.available_at}`);

        await withSettings({ [DELAY_KEY]: 10 }, async () => {
            const p10 = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
            const { n1: c10 } = await initialCommissions(p10, chain);
            assert.equal(c10.status, 'PENDING');
            assert.ok(Math.abs(ms(c10.available_at) - ((await eventEndMs(ev.eventId)) + 10 * DAY_MS)) <= 60_000, `délai de 10 j après la fin de l’événement (R106) : ${c10.available_at}`);
        });

        const { data: again, error } = await service.from('referral_commissions').select('available_at').eq('id', c7.id).single();
        assert.equal(error, null);
        assert.equal(ms(again!.available_at), ms(c7.available_at), 'la commission née avant le changement garde son échéance');
    });

    test('cron /api/cron/referral-commissions : 401 sans CRON_SECRET ; les commissions échues deviennent DISPONIBLES, les autres restent EN ATTENTE', async () => {
        const mod = (await importModule('../../app/api/cron/referral-commissions/route').catch((err: unknown) => {
            assert.fail(`route /api/cron/referral-commissions absente : ${err instanceof Error ? err.message : String(err)}`);
        })) as { GET?: Handler };
        const cron = mod.GET;
        assert.ok(cron, 'GET /api/cron/referral-commissions');
        assert.equal((await cron(cronRequest('/api/cron/referral-commissions', null))).status, 401, 'sans secret');
        assert.equal((await cron(cronRequest('/api/cron/referral-commissions', 'faux-secret'))).status, 401, 'mauvais secret');

        const chain = await sponsorChain('cron');
        const evCron = await createPartnerEvent(partner.partnerId, 'parrainage-cron', [{ name: 'Standard', price: 1000, total: 5 }]); const p = await buyConfirmed(chain.filleul, evCron, [['Standard', 1]]);
        const { n1, n2 } = await initialCommissions(p, chain);
        assert.deepEqual([n1.status, n2.status], ['PENDING', 'PENDING']);
        { const day = new Date(Date.now() - 16 * 86_400_000).toISOString().slice(0, 10); const { error: dErr } = await service.from('events').update({ start_date: day, start_time: '20:00:00', end_date: day, end_time: '23:00:00' }).eq('id', evCron.eventId); assert.equal(dErr, null, `événement fini depuis 16 jours : ${dErr?.message}`); } // lot 9 bis (R106, w18) : événement propre, fini depuis plus que le délai (14 j au plus) ; N1 échue depuis une minute ; N2 garde son échéance (jamais avancée).
        await ageCommission(n1);

        for (const pass of [1, 2]) {
            const res = await cron(cronRequest('/api/cron/referral-commissions'));
            const body = (await res.json()) as Row;
            assert.equal(res.status, 200, `passage ${pass} : ${JSON.stringify(body)}`);
            assert.equal(typeof body.released, 'number', `passage ${pass} : nombre de commissions libérées (${JSON.stringify(body)})`);
            if (pass === 1) assert.ok(Number(body.released) >= 1, `passage 1 : au moins N1 libérée (${JSON.stringify(body)})`);
            const rows = await commissionsOf(p.payment.id);
            assert.deepEqual(
                [rows.find((r) => r.id === n1.id)?.status, rows.find((r) => r.id === n2.id)?.status],
                ['AVAILABLE', 'PENDING'],
                `passage ${pass} : N1 échue disponible, N2 non échue en attente`,
            );
        }
    });

    test('remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE', async () => {
        const chain = await sponsorChain('total');
        const p = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        const { n1, n2 } = await initialCommissions(p, chain);
        // N2 déjà DISPONIBLE (délai écoulé, passage du cron), N1 encore EN ATTENTE.
        await ageCommission(n2, { status: 'AVAILABLE' });

        await refundTicket(String(p.tickets[0].id), p.payment.id);

        const rows = await commissionsOf(p.payment.id);
        for (const [who, c] of [[chain.n1, n1], [chain.n2, n2]] as const) {
            const now = rows.find((r) => r.id === c.id);
            assert.ok(now, `${c.generation} : ligne conservée (jamais supprimée)`);
            assert.equal(now.status, 'CANCELLED', `${c.generation} annulée : ${JSON.stringify(brief(now))}`);
            assert.ok(String(now.cancellation_reason ?? '').trim().length > 0, `${c.generation} : motif d’annulation`);
            assert.ok(now.cancelled_at, `${c.generation} : date d’annulation`);
            assert.equal(cents(now.amount), cents(c.amount), `${c.generation} : montant historique inchangé`);
            const active = rows.filter((r) => r.sponsor_id === who.userId && kindOf(r) === 'COMMISSION' && r.status !== 'CANCELLED');
            assert.deepEqual(active.map(brief), [], `${c.generation} : aucune commission active après remboursement total`);

            const debit = (await ledgerOf(who.userId, 'PARRAINAGE')).filter((e) => e.commission_id === c.id && e.entry_type === 'COMMISSION_ANNULEE');
            assert.equal(debit.length, 1, `${c.generation} : écriture COMMISSION_ANNULEE au grand livre`);
            assert.equal(cents(debit[0].amount), -cents(c.amount), `${c.generation} : débit = − commission`);
            const b = await balanceOf(who.userId, 'PARRAINAGE');
            assert.deepEqual([cents(b.available), cents(b.pending)], [0, 0], `${c.generation} : solde PARRAINAGE nul`);
        }
        assert.equal((await paymentRow(p.payment.id)).status, 'REFUNDED', 'paiement entièrement remboursé');
    });

    test('remboursement partiel d’un panier de 2 billets : commission recalculée au prorata (ancienne CANCELLED RECALCUL_PRORATA, nouvelle ligne)', async () => {
        const chain = await sponsorChain('partiel');
        const p = await buyConfirmed(chain.filleul, ev, [['Standard', 2]]);
        // 2 × 1 000 : service 2 × 50 = 100 ; total 2 100 ; agrégateur 31,50 ; net 68,50 → N1 3,43 (3,425) ; N2 1,37
        assert.equal(cents(p.payment.net_event_village_revenue), 6850, `revenu net EV : ${p.payment.net_event_village_revenue}`);
        const { n1, n2 } = await initialCommissions(p, chain);
        assert.deepEqual([cents(n1.amount), cents(n2.amount)], [343, 137], 'commissions avant remboursement');

        // Billet remboursé : 1 000 + 50 = 1 050 sur 2 100 → nouveau montant = round2(montant × (1 − 1 050 / 2 100))
        await refundTicket(String(p.tickets[0].id), p.payment.id);

        const rows = await commissionsOf(p.payment.id);
        for (const [who, c, expected] of [[chain.n1, n1, 172], [chain.n2, n2, 69]] as const) {
            const old = rows.find((r) => r.id === c.id);
            assert.ok(old, `${c.generation} : ancienne ligne conservée`);
            assert.equal(old.status, 'CANCELLED', `${c.generation} : ancienne commission annulée (${JSON.stringify(brief(old))})`);
            assert.match(String(old.cancellation_reason ?? ''), /RECALCUL_PRORATA/, `${c.generation} : motif`);
            const fresh = only(rows, (r) => r.sponsor_id === who.userId && r.generation === c.generation && kindOf(r) === 'COMMISSION' && r.id !== c.id, `${c.generation} : nouvelle commission`);
            assert.equal(cents(fresh.amount), expected, `${c.generation} : round2(${c.amount} × 1/2)`);
            assert.notEqual(fresh.status, 'CANCELLED', `${c.generation} : nouvelle commission active`);
            const b = await balanceOf(who.userId, 'PARRAINAGE');
            assert.equal(cents(b.available) + cents(b.pending), expected, `${c.generation} : solde PARRAINAGE = commission recalculée`);
        }
        assert.equal((await paymentRow(p.payment.id)).status, 'PARTIAL', 'paiement partiellement remboursé');
    });

    test('commission déjà versée par un retrait de parrainage, puis remboursements : REGULARISATION négative, créance déduite des gains futurs (§103), ligne d’origine conservée', async () => {
        const chain = await sponsorChain('versee');
        const parrain = chain.n1.userId;
        const p = await buyConfirmed(chain.filleul, ev, [['Standard', 2]]);
        const { n1 } = await initialCommissions(p, chain);
        assert.equal(cents(n1.amount), 343, 'N1 avant remboursement (2 billets : net 68,50 × 5 %)');

        // Délai écoulé, puis retrait de parrainage de 3 F (entier, ≤ solde disponible 3,43 arrondi au FCFA inférieur) :
        // N1 est versée en partie (3 F sur 3,43).
        await ageCommission(n1, { status: 'AVAILABLE' });
        const w = await withSettings({ 'finance.withdrawal_min_amount': 0 }, async () => {
            const { data, error } = await service.rpc('withdrawal_request', {
                p: {
                    user_id: parrain, account_kind: 'PARRAINAGE', gross_amount: 3, method: 'MOBILE_MONEY',
                    operator: 'WAVE', phone_number: chain.n1.phone9, client_key: randomUUID(),
                },
            });
            assert.equal(error, null, `withdrawal_request : ${error?.message}`);
            assert.equal((data as Row | null)?.ok, true, `retrait de parrainage de 3 F : ${JSON.stringify(data)}`);
            return data as Row;
        });
        if (w.cashout_id) await CashoutService.send(String(w.cashout_id));
        assert.equal(cents((await commissionById(String(n1.id))).paid_amount), 300, 'N1 versée à hauteur de 3 F');

        const regulsOf = (rows: Row[]) => rows.filter((r) => kindOf(r) === 'REGULARISATION' && r.regularizes_id === n1.id);
        const sum = (xs: Row[]) => xs.reduce((s, x) => s + cents(x.amount), 0);
        const entries = async (type: string) => sum((await ledgerOf(parrain, 'PARRAINAGE')).filter((e) => e.entry_type === type));
        const openDebt = async () => {
            const { data, error } = await service.from('finance_debts').select('remaining').eq('owner_id', parrain).eq('account_kind', 'PARRAINAGE');
            assert.equal(error, null, `créances : ${error?.message}`);
            return ((data ?? []) as Row[]).reduce((s, d) => s + cents(d.remaining), 0);
        };
        const assertOriginalKept = (rows: Row[], when: string) => {
            const orig = rows.find((r) => r.id === n1.id);
            assert.ok(orig, `${when} : ligne d’origine conservée`);
            assert.deepEqual([kindOf(orig), cents(orig.amount), cents(orig.paid_amount)], ['COMMISSION', 343, 300], `${when} : ligne d’origine inchangée`);
            assert.notEqual(orig.status, 'CANCELLED', `${when} : une commission versée n’est pas annulée`);
            assert.equal(rows.filter((r) => r.sponsor_id === parrain && kindOf(r) === 'COMMISSION').length, 1, `${when} : ni nouvelle commission ni recalcul par annulation`);
        };

        // 1) Premier billet : montant recalculé 1,72 → REGULARISATION −(3,43 − 1,72) = −1,71.
        //    Compte du parrain : 3,43 − 3 = 0,43 → débit de 0,43, créance de 1,28 sur les gains futurs.
        await refundTicket(String(p.tickets[0].id), p.payment.id);
        let rows = await commissionsOf(p.payment.id);
        let reguls = regulsOf(rows);
        assert.deepEqual(reguls.map((r) => cents(r.amount)), [-171], `régularisation après remboursement partiel : ${JSON.stringify(rows.map(brief))}`);
        assert.deepEqual([reguls[0].sponsor_id, reguls[0].generation], [parrain, 'N1'], 'régularisation au compte du parrain N1');
        assertOriginalKept(rows, 'remboursement partiel');
        assert.equal(await entries('REGULARISATION'), -43, 'débit REGULARISATION limité au solde (0,43)');
        assert.equal(await openDebt(), 128, 'créance PARRAINAGE pour le reste (1,28)');

        // 2) Second billet : montant 0 → REGULARISATION du reste (−1,72) ; compte vide → créance +1,72.
        await refundTicket(String(p.tickets[1].id), p.payment.id);
        rows = await commissionsOf(p.payment.id);
        reguls = regulsOf(rows);
        assert.equal(reguls.length, 2, `deux régularisations : ${JSON.stringify(rows.map(brief))}`);
        assert.equal(sum(reguls), -343, 'somme des régularisations = − montant de la commission');
        assertOriginalKept(rows, 'remboursement total');
        assert.equal(await entries('REGULARISATION'), -43, 'aucun débit sur un compte vide');
        assert.equal(await openDebt(), 300, 'créance totale 3,00 (le montant déjà versé)');
        const n2Active = rows.filter((r) => r.generation === 'N2' && kindOf(r) === 'COMMISSION' && r.status !== 'CANCELLED');
        assert.deepEqual(n2Active.map(brief), [], 'N2 (jamais versée) : plus aucune commission active');
        assert.equal((await paymentRow(p.payment.id)).status, 'REFUNDED');

        // 3) Gains futurs : la commission suivante du parrain compense d'abord la créance (§103).
        const p3 = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        const { n1: next } = await initialCommissions(p3, chain);
        assert.equal(cents(next.amount), 171);
        assert.equal(await entries('COMPENSATION_CREANCE'), -171, 'compensation de la créance par la nouvelle commission');
        assert.equal(await openDebt(), 129, 'créance restante 3,00 − 1,71');
        const b = await balanceOf(parrain, 'PARRAINAGE');
        assert.deepEqual([cents(b.available), cents(b.pending)], [0, 0], `commission absorbée par la créance : ${JSON.stringify(b)}`);
    });

    test('/api/referrals/my-stats : total retiré = retraits de parrainage payés, solde disponible sans commission en attente, statuts distincts', async () => {
        const chain = await sponsorChain('stats');
        const p1 = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        const p2 = await buyConfirmed(chain.filleul, ev, [['Standard', 1]]);
        const { n1: live } = await initialCommissions(p1, chain);
        const { n1: dead } = await initialCommissions(p2, chain);
        await softUpdate('referral_commissions', String(dead.id), { status: 'CANCELLED', cancellation_reason: 'TEST_STATUT' }, { cancelled_at: new Date().toISOString() });
        const lot3Columns = await insertWithdrawal(chain.n1, 5000, 'PAID', 'PARRAINAGE');
        await insertWithdrawal(chain.n1, 7000, 'REJECTED', 'PARRAINAGE');
        if (lot3Columns) await insertWithdrawal(chain.n1, 9000, 'PAID', 'ORGANISATEUR');

        const res = await myStatsRoute(jsonRequest('/api/referrals/my-stats', 'GET', chain.n1.accessToken));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, JSON.stringify(body));
        const fin = body.finances as Row | undefined;
        assert.ok(fin, `finances : ${JSON.stringify(body)}`);
        assert.equal(cents(fin.totalWithdrawn), 500_000, `total retiré = retraits PARRAINAGE payés, bruts (ni refusé, ni ORGANISATEUR) : ${JSON.stringify(fin)}`);

        const { data: mine, error } = await service.from('referral_commissions').select('*').eq('sponsor_id', chain.n1.userId);
        assert.equal(error, null);
        const earned = ((mine ?? []) as Row[])
            .filter((c) => (kindOf(c) === 'COMMISSION' && c.status !== 'CANCELLED') || kindOf(c) === 'REGULARISATION')
            .reduce((s, c) => s + cents(c.amount), 0);
        assert.equal(cents(fin.totalEarned), earned, `total gagné sans les commissions annulées : ${JSON.stringify(fin)}`);
        assert.equal(cents(fin.availableBalance), 0, `solde disponible : la seule commission active est EN ATTENTE (${JSON.stringify(fin)})`);

        const recent = (body.recentCommissions ?? []) as Row[];
        const rLive = recent.find((r) => r.id === live.id);
        const rDead = recent.find((r) => r.id === dead.id);
        assert.ok(rLive && rDead, `historique : ${JSON.stringify(recent)}`);
        assert.equal(rDead.status, 'CANCELLED', 'commission annulée affichée comme telle');
        assert.equal(rLive.status, 'PENDING', 'commission en attente affichée comme telle');
        assert.ok(rLive.available_at && Math.abs(ms(rLive.available_at) - ms(live.available_at)) <= 1000, `date de disponibilité exposée : ${JSON.stringify(rLive)}`);
    });
});

// ── Lot 9 bis (R106, B12, T21) ─────────────────────────────────────────────

/**
 * Fin de l'événement des achats de la suite : date et heure de fin saisies (createPartnerEvent, heure de Dakar = UTC).
 * Règle changée par la consigne (A.7) : une commission de billet est disponible 7 jours après la fin de l'événement,
 * plus 7 jours après la confirmation. Rouge jusqu'à fix(9b.7) (calculate_referral_commissions, M07). Aide placée en
 * fin de fichier : les lignes citées par docs/recette-billetterie.md ne bougent pas.
 */
async function eventEndMs(eventId: string): Promise<number> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    assert.ok(data!.end_date && data!.end_time, `précondition : date et heure de fin saisies (${JSON.stringify(data)})`);
    const t = String(data!.end_time);
    return Date.parse(`${String(data!.end_date)}T${t.length === 5 ? `${t}:00` : t}Z`);
}
