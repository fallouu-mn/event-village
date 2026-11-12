/**
 * Lot 8, tâche 8.1 — rouge de L28 (contrat 2.5, 5.4, 5.5, AR6) : un remboursement ou un retrait créé en mode
 * simulé ne part JAMAIS en réel, et une opération réelle ne part jamais vers le faux service.
 *
 * Premier test, celui du SUPPOSÉ le plus risqué du lot (contrat 2.5, section 22) : PostgREST expose-t-il
 * request.headers sous la CLI 2.122.0 ? Le test crée sa propre sonde (une fonction temporaire, retirée dans un
 * finally), indépendante de M2 : la réponse tombe dès le run « avant ». Son message d'échec donne le verdict
 * dans les deux cas, « SUPPOSÉ RÉFUTÉ » ou « SUPPOSÉ CONFIRMÉ, rouge seulement parce que M2 n'est pas livrée ».
 * S'il est réfuté, S1 remonte à l'orchestrateur avant toute autre piste.
 *
 * Clients : `simClient` est un client REST service_role qui porte l'en-tête x-ev-simulation ; `service` n'en porte
 * pas. `asSimulationServer` ajoute l'en-tête aux appels REST du processus, le temps d'un achat réel par les
 * routes : c'est ce que ferait getServiceRoleClient sur un serveur d'essai, sans toucher aux helpers (L15).
 * `withEssaiServer` pose EV_ESSAI_SIMULATION=1 : tests/helpers/env.ts gèle EV_INTEGRATIONS, pas cette variable,
 * et SAMIRPAY_API_URL est locale en test, donc isSimulationRun() est vrai par sa seconde branche (contrat 5.2).
 *
 * Rouge aujourd'hui : M2 n'existe pas ; chaque test nomme les objets absents (`assertM2`) avant toute écriture.
 * Vert après fix(8.1s) et fix(8.2a) (CashoutService.send et resumeUnsent), section 18.2.
 *
 * Un test de M2 lit `error.code` : EV403 pour l'envoi ; marque immuable : toute erreur, ligne inchangée (le code
 * n'est pas fixé par le contrat).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PublicError } from '../../lib/api/public-error';
import { renderNotification } from '../../lib/notifications/catalog';
import { CashoutService } from '../../lib/payments/cashout.service';
import { inspect, openConcurrentClient } from '../helpers/db';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import {
    buyConfirmed, createPartnerEvent, newPartner, paymentRow, superadminId, withSettings,
    type FinanceSettingKey, type Purchase, type TestPartner,
} from './finance-helpers';
import { callsOf, fakePay, importModule, newBuyer, service, setFakeMode, sleep, type Buyer, type SaleEvent } from './paiement-helpers';

const HEADER = 'x-ev-simulation';
const PROBE = 'ev_sonde_entetes_lot8';
const PRICE = 5000;
const SIX_MINUTES = 6 * 60_000;

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

function restClient(headers: Record<string, string>): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        global: { headers },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

const simClient = restClient({ [HEADER]: '1' });

let partner: TestPartner;
let ev: SaleEvent;
let adminId: string;

before(async () => {
    partner = await newPartner('essai-simule');
    ev = await createPartnerEvent(partner.partnerId, 'essai-simule', [{ name: 'Standard', price: PRICE, total: 60 }]);
    adminId = await superadminId();
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertRecetteInvariants('essai-simule');
});

// ── Sonde de request.headers, indépendante de M2 ───────────────────────────

interface Probe { present: boolean; cles?: string[]; valeur?: string | null }

async function probeBody(client: SupabaseClient, what: string): Promise<Probe> {
    const deadline = Date.now() + 20_000;
    for (;;) {
        const { data, error } = await client.rpc(PROBE);
        if (!error) return data as Probe;
        assert.equal(error.code, 'PGRST202', `sonde ${what} : ${error.code} ${error.message}`);
        assert.ok(Date.now() < deadline, `INDÉCIS : PostgREST ne voit pas la fonction de sonde 20 s après NOTIFY pgrst (${error.message}) ; le SUPPOSÉ reste à trancher`);
        await sleep(200); // attente du rechargement du cache de schéma de PostgREST, seule attente réelle de la suite
    }
}

async function runProbe(): Promise<{ avec: Probe; sans: Probe; zero: Probe }> {
    const create = await openConcurrentClient({ applicationName: 'ev-sonde-lot8' });
    try {
        await create.query(`
            CREATE OR REPLACE FUNCTION public.${PROBE}() RETURNS jsonb
            LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $sonde$
            DECLARE
                v_raw text := current_setting('request.headers', true);
            BEGIN
                IF v_raw IS NULL OR v_raw = '' THEN
                    RETURN jsonb_build_object('present', false);
                END IF;
                -- Noms des en-têtes seulement : leurs valeurs portent les clés.
                RETURN jsonb_build_object(
                    'present', true,
                    'cles', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(v_raw::jsonb) AS k),
                    'valeur', v_raw::jsonb ->> '${HEADER}');
            END;
            $sonde$`);
        await create.query(`REVOKE ALL ON FUNCTION public.${PROBE}() FROM PUBLIC, anon, authenticated`);
        await create.query(`GRANT EXECUTE ON FUNCTION public.${PROBE}() TO service_role`);
        await create.query(`NOTIFY pgrst, 'reload schema'`);
        await create.commit();
    } finally {
        await create.close();
    }
    try {
        return {
            avec: await probeBody(simClient, 'avec l’en-tête'),
            sans: await probeBody(service, 'sans l’en-tête'),
            zero: await probeBody(restClient({ [HEADER]: '0' }), 'avec la valeur 0'),
        };
    } finally {
        const drop = await openConcurrentClient({ applicationName: 'ev-sonde-lot8' });
        try {
            await drop.query(`DROP FUNCTION IF EXISTS public.${PROBE}()`);
            await drop.query(`NOTIFY pgrst, 'reload schema'`);
            await drop.commit();
        } finally {
            await drop.close();
        }
    }
}

/** Version de PostgREST lue sur la racine de l'API, pour le rapport ; jamais de valeur de clé. */
async function postgrestVersion(): Promise<string> {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    const body = await res.json().catch((err: unknown) => ({ erreur: String(err) })) as { info?: { version?: string } };
    return body.info?.version ?? `non lue (HTTP ${res.status}, en-tête server : ${res.headers.get('server') ?? 'absent'})`;
}

// ── Contrôle de M2 : nommer les objets absents, jamais une erreur brute ────

const M2_COLUMNS: Array<[string, string]> = [['payments', 'simulated'], ['cashouts', 'simulated']];
const M2_TRIGGERS: Array<[string, string]> = [
    ['trg_payments_simulated', 'payments'],
    ['trg_payments_simulation_guard', 'payments'],
    ['trg_cashouts_simulated', 'cashouts'],
    ['trg_cashouts_simulation_guard', 'cashouts'],
];

let m2Present = false;

async function assertM2(): Promise<void> {
    if (m2Present) return;
    const missing = await inspect(async (c) => {
        const out: string[] = [];
        for (const [table, column] of M2_COLUMNS) {
            const r = await c.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]);
            if (r.rowCount === 0) out.push(`colonne public.${table}.${column}`);
        }
        const fn = await c.query(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'ev_request_simulated'`);
        if (fn.rowCount === 0) out.push('fonction public.ev_request_simulated');
        for (const [trigger, table] of M2_TRIGGERS) {
            const r = await c.query(
                `SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = $1 AND t.tgname = $2 AND NOT t.tgisinternal`, [table, trigger]);
            if (r.rowCount === 0) out.push(`trigger ${trigger} sur public.${table}`);
        }
        return out;
    });
    assert.deepEqual(missing, [], `M2 (20261106000002_lot8_essai.sql, fix(8.1s)) non appliquée, objets absents : ${missing.join(' ; ')}`);
    m2Present = true;
}

// ── Achats et retraits ─────────────────────────────────────────────────────

/** Ajoute l'en-tête de simulation aux appels REST du processus, le temps de `fn`. */
async function asSimulationServer<T>(fn: () => Promise<T>): Promise<T> {
    const previous = globalThis.fetch;
    globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.includes('/rest/v1/')) return previous(input, init);
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set(HEADER, '1');
        return previous(input, { ...init, headers });
    }) as typeof fetch;
    try {
        return await fn();
    } finally {
        globalThis.fetch = previous;
    }
}

/** Serveur d'essai dans ce processus (seconde branche de isSimulationRun), le temps de `fn`. */
async function withEssaiServer<T>(fn: () => Promise<T>): Promise<T> {
    const host = new URL(process.env.SAMIRPAY_API_URL ?? 'http://absente.invalid').hostname;
    assert.ok(host === '127.0.0.1' || host === 'localhost', `préalable : SAMIRPAY_API_URL locale en test (hôte ${host})`);
    process.env.EV_ESSAI_SIMULATION = '1';
    try {
        return await fn();
    } finally {
        delete process.env.EV_ESSAI_SIMULATION;
    }
}

interface Sale { buyer: Buyer; purchase: Purchase }

async function realSale(label: string): Promise<Sale> {
    const buyer = await newBuyer(`sim-${label}`);
    return { buyer, purchase: await buyConfirmed(buyer, ev, [['Standard', 1]]) };
}

async function simulatedSale(label: string): Promise<Sale> {
    const buyer = await newBuyer(`sim-${label}`);
    const purchase = await asSimulationServer(() => buyConfirmed(buyer, ev, [['Standard', 1]]));
    assert.equal((await paymentRow(String(purchase.payment.id))).simulated, true, 'préalable : paiement marqué simulé par l’en-tête');
    return { buyer, purchase };
}

async function requestRefund(client: SupabaseClient, paymentId: unknown): Promise<string> {
    const { data, error } = await client.rpc('refund_request', { p_payment_id: paymentId, p_reason: 'Essai du marquage simulé', p_kind: 'REFUND' });
    assert.equal(error, null, `refund_request : ${error?.message}`);
    assert.ok(data, 'refund_request doit créer un cashout');
    return String(data);
}

async function cashout(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('cashouts').select('*').eq('id', id).single();
    assert.equal(error, null, `cashout ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

async function simulatedCashout(label: string): Promise<{ id: string; row: Record<string, unknown> }> {
    const { purchase } = await simulatedSale(label);
    const id = await requestRefund(service, purchase.payment.id);
    const row = await cashout(id);
    assert.equal(row.simulated, true, 'préalable : cashout hérité du paiement marqué');
    return { id, row };
}

async function realCashout(label: string): Promise<{ id: string; row: Record<string, unknown> }> {
    const { purchase } = await realSale(label);
    const id = await requestRefund(service, purchase.payment.id);
    const row = await cashout(id);
    assert.equal(row.simulated, false, 'préalable : cashout réel');
    return { id, row };
}

function sendsTo(row: Record<string, unknown>): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === row.phone_number).length;
}

function soldeCalls(): number {
    return callsOf('getSolde').length;
}

interface FundedPartner { owner: TestPartner }

/** Partenaire neuf, solde disponible issu d'une vente (simulée ou réelle), sans délai de garde. */
async function fundedPartner(label: string, simulated: boolean): Promise<FundedPartner> {
    const owner = await newPartner(`sim-${label}`);
    const sale = await createPartnerEvent(owner.partnerId, `sim-${label}`, [{ name: 'Standard', price: 10_000, total: 5 }]);
    const buyer = await newBuyer(`sim-${label}-ach`);
    const buy = () => buyConfirmed(buyer, sale, [['Standard', 1]]);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => (simulated ? asSimulationServer(buy) : buy()));
    return { owner };
}

async function withdraw(client: SupabaseClient, owner: TestPartner): Promise<string> {
    const body = await withSettings(WITHDRAWAL_RULES, async () => {
        const { data, error } = await client.rpc('withdrawal_request', {
            p: {
                user_id: owner.userId, account_kind: 'ORGANISATEUR', gross_amount: 10_000, method: 'MOBILE_MONEY',
                operator: 'WAVE', phone_number: owner.phone9, client_key: randomUUID(),
            },
        });
        assert.equal(error, null, `withdrawal_request : ${error?.message}`);
        return data as { ok?: boolean; cashout_id?: string; code?: string };
    });
    assert.equal(body.ok, true, `withdrawal_request refusé : ${JSON.stringify(body)}`);
    assert.ok(body.cashout_id, 'retrait sans cashout');
    return body.cashout_id;
}

async function simulationModule(): Promise<{ isSimulationRun(): boolean; simulationHeaders(): Record<string, string>; SIMULATION_HEADER: string }> {
    try {
        return await importModule('../../lib/integrations/simulation');
    } catch (err) {
        assert.fail(`lib/integrations/simulation.ts absent (fix(8.1s)) : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SUPPOSÉ 2.5 : PostgREST expose request.headers sous la CLI 2.122.0', () => {
    test('sonde indépendante de M2, puis ev_request_simulated de bout en bout', async () => {
        const sonde = await runProbe();
        const version = await postgrestVersion();
        console.log(`[SONDE-REQUEST-HEADERS] postgrest=${version} avec=${JSON.stringify(sonde.avec)} sans=${JSON.stringify(sonde.sans)} zero=${JSON.stringify(sonde.zero)}`);

        assert.equal(sonde.avec.present, true,
            `SUPPOSÉ RÉFUTÉ : PostgREST (${version}, CLI 2.122.0) n'expose pas request.headers : current_setting('request.headers', true) est vide. Le marquage simulé par en-tête est muet. S1 remonte à l'orchestrateur avant toute autre piste (contrat 2.5).`);
        assert.equal(sonde.avec.valeur, '1',
            `SUPPOSÉ RÉFUTÉ EN PARTIE : request.headers est exposé (PostgREST ${version}) mais ${HEADER} n'y arrive pas (en-têtes reçus : ${JSON.stringify(sonde.avec.cles)}). Kong le filtre ou le nom change. S1 remonte à l'orchestrateur (contrat 2.5).`);
        assert.equal(sonde.sans.valeur ?? null, null, `sans l'en-tête, ${HEADER} doit être absent : ${JSON.stringify(sonde.sans)}`);
        assert.equal(sonde.zero.valeur, '0', `la valeur reçue doit être lue telle quelle : ${JSON.stringify(sonde.zero)}`);

        const verdict = `SUPPOSÉ CONFIRMÉ : PostgREST ${version} expose request.headers et ${HEADER} y arrive.`;
        const withHeader = await simClient.rpc('ev_request_simulated');
        assert.equal(withHeader.error, null, `${verdict} Rouge seulement parce que M2 n'est pas livrée : public.ev_request_simulated() ne répond pas (${withHeader.error?.code} ${withHeader.error?.message}).`);
        assert.equal(withHeader.data, true, `${verdict} Mais ev_request_simulated() rend ${String(withHeader.data)} avec l'en-tête : défaut de M2.`);
        const without = await service.rpc('ev_request_simulated');
        assert.equal(without.error, null, `ev_request_simulated sans en-tête : ${without.error?.message}`);
        assert.equal(without.data, false, 'sans en-tête : faux');
        const zero = await restClient({ [HEADER]: '0' }).rpc('ev_request_simulated');
        assert.equal(zero.data, false, 'seule la valeur 1 marque une opération');
    });
});

describe('marquage à la création, en base', () => {
    test('en-tête présent : refund_request crée un cashout simulé, sur un paiement réel', async () => {
        await assertM2();
        const { purchase } = await realSale('hdr-remb');
        assert.equal((await paymentRow(String(purchase.payment.id))).simulated, false, 'paiement réel non marqué');
        const row = await cashout(await requestRefund(simClient, purchase.payment.id));
        assert.equal(row.simulated, true);
        assert.equal(row.kind, 'REFUND');
    });

    test('en-tête présent : ticket_refund_request crée un cashout simulé', async () => {
        await assertM2();
        const { purchase } = await realSale('hdr-billet');
        const { data, error } = await simClient.rpc('ticket_refund_request', { p_ticket_id: purchase.tickets[0].id, p_actor: adminId, p_reason: 'Essai du marquage simulé' });
        assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
        const body = data as { ok?: boolean; cashout_id?: string };
        assert.equal(body.ok, true, JSON.stringify(body));
        const row = await cashout(String(body.cashout_id));
        assert.equal(row.simulated, true);
        assert.equal(row.kind, 'TICKET_REFUND');
    });

    test('en-tête présent : withdrawal_request crée un cashout simulé', async () => {
        await assertM2();
        const { owner } = await fundedPartner('hdr-retrait', false);
        const row = await cashout(await withdraw(simClient, owner));
        assert.equal(row.simulated, true);
        assert.equal(row.kind, 'WITHDRAWAL');
    });

    test('paiement marqué, cashout créé sans en-tête : hérite', async () => {
        await assertM2();
        const { row } = await simulatedCashout('herite-remb');
        assert.equal(row.simulated, true);
    });

    test('solde issu d’un paiement simulé, retrait sans en-tête : hérite', async () => {
        await assertM2();
        const { owner } = await fundedPartner('herite-retrait', true);
        assert.equal((await cashout(await withdraw(service, owner))).simulated, true);
    });

    test('témoin : solde réel, retrait sans en-tête : réel', async () => {
        await assertM2();
        const { owner } = await fundedPartner('temoin-retrait', false);
        assert.equal((await cashout(await withdraw(service, owner))).simulated, false);
    });

    test('la valeur reçue à l’INSERT est écrasée, dans les deux sens', async () => {
        await assertM2();
        const buyer = await newBuyer('sim-insert');
        const insert = async (client: SupabaseClient, simulated: boolean): Promise<Record<string, unknown>> => {
            const { data, error } = await client.from('payments').insert({
                transaction_id: `TX-ESSAI-${randomUUID()}`, client_id: buyer.userId, partner_id: partner.partnerId, payment_target: 'TICKET',
                amount: 1000, currency: 'XOF', is_platform_payment: false, offline_payment_method: 'ESPECES', aggregator: 'GUICHET_PHYSIQUE',
                status: 'PENDING', metadata: { event_id: ev.eventId, test: 'essai-simule' }, simulated,
            }).select('id, simulated').single();
            assert.equal(error, null, `INSERT payments : ${error?.message}`);
            const { error: closeErr } = await service.from('payments').update({ status: 'CANCELLED' }).eq('id', data.id);
            assert.equal(closeErr, null, `fermeture du paiement d’essai : ${closeErr?.message}`);
            return data as Record<string, unknown>;
        };
        assert.equal((await insert(service, true)).simulated, false, 'sans en-tête : jamais marqué, quelle que soit la valeur envoyée');
        assert.equal((await insert(simClient, false)).simulated, true, 'avec en-tête : toujours marqué, quelle que soit la valeur envoyée');
    });
});

describe('envoi refusé dans le code', () => {
    test('cashoutSendRefusal : les 4 cas', async () => {
        const fn = (await import('../../lib/payments/cashout.service') as unknown as { cashoutSendRefusal?: (row: { simulated: boolean }, active: boolean) => string | null }).cashoutSendRefusal;
        assert.equal(typeof fn, 'function', 'cashoutSendRefusal absente de lib/payments/cashout.service.ts : livrée par fix(8.2a)');
        assert.equal(fn!({ simulated: true }, false), 'SIMULATED');
        assert.equal(fn!({ simulated: false }, true), 'REAL_IN_SIMULATION');
        assert.equal(fn!({ simulated: false }, false), null);
        assert.equal(fn!({ simulated: true }, true), null);
    });

    test('simulationHeaders vide et isSimulationRun faux en NODE_ENV=test, malgré EV_INTEGRATIONS=fake', async () => {
        const m = await simulationModule();
        assert.equal(process.env.EV_INTEGRATIONS, 'fake', 'préalable');
        assert.equal(m.isSimulationRun(), false);
        assert.deepEqual(m.simulationHeaders(), {});
    });

    test('serveur réel, cashout simulé : ni getSolde ni sendCashout, blocked_reason = SIMULATED, skipped = SIMULATED', async () => {
        await assertM2();
        const { id, row } = await simulatedCashout('send');
        const solde = soldeCalls();
        const outcome = await CashoutService.send(id);
        assert.deepEqual(outcome, { status: 'A_ENVOYER', skipped: 'SIMULATED' });
        assert.equal(soldeCalls(), solde, 'getSolde ne doit pas être appelé');
        assert.equal(sendsTo(row), 0, 'sendCashout ne doit pas être appelé');
        const reread = await cashout(id);
        assert.equal(reread.blocked_reason, 'SIMULATED');
        assert.equal(reread.status, 'A_ENVOYER');
        assert.equal(reread.send_started_at, null, 'aucune réservation d’envoi');

        const again = await CashoutService.send(id);
        assert.ok(['SIMULATED', 'BLOCKED'].includes(String(again.skipped)), `second passage : ${JSON.stringify(again)}`);
        assert.equal(soldeCalls(), solde, 'second passage : getSolde');
        assert.equal(sendsTo(row), 0, 'second passage : sendCashout');
    });

    test('libellé du motif pour les administrateurs : clair, sans code technique', () => {
        const rendered = renderNotification('ADMIN_REFUND_TO_RETRY', 'IN_APP', { cashout_id: randomUUID(), amount: 5000, cashout_status: 'BLOQUE', blocked_reason: 'SIMULATED' }, { appUrl: 'http://127.0.0.1:3000' });
        assert.equal(rendered.channel, 'IN_APP');
        assert.match(rendered.channel === 'IN_APP' ? rendered.content : '', /opération créée en mode simulé : aucun versement/i);
    });

    test('décision « Renvoyer » d’un cashout simulé bloqué : refusée, aucun appel, reste bloqué', async () => {
        await assertM2();
        const { id, row } = await simulatedCashout('relance');
        await CashoutService.send(id);
        const solde = soldeCalls();
        await assert.rejects(
            CashoutService.adminDecide({ cashoutId: id, actorId: adminId, action: 'RESEND', reason: 'Relance d’essai (test du lot 9 ter)' }),
            (e) => e instanceof PublicError && e.code === 'NOT_RESENDABLE' && e.status === 409,
        );
        assert.equal(soldeCalls(), solde, 'getSolde ne doit pas être appelé');
        assert.equal(sendsTo(row), 0, 'sendCashout ne doit pas être appelé');
        const reread = await cashout(id);
        assert.equal(reread.blocked_reason, 'SIMULATED');
        assert.equal(reread.status, 'A_ENVOYER');
    });

    test('décision « Renvoyer » d’un cashout simulé ECHOUE : remis à envoyer puis bloqué, aucun appel', async () => {
        await assertM2();
        const { id, row } = await simulatedCashout('relance-echoue');
        const { error } = await service.from('cashouts').update({ status: 'ECHOUE' }).eq('id', id);
        assert.equal(error, null, `préparation : ${error?.message}`);
        const solde = soldeCalls();
        const result = await CashoutService.adminDecide({ cashoutId: id, actorId: adminId, action: 'RESEND', reason: 'Relance d’essai (test du lot 9 ter)' });
        assert.deepEqual(result, { ok: false, status: 'A_ENVOYER' });
        assert.equal(soldeCalls(), solde, 'getSolde ne doit pas être appelé');
        assert.equal(sendsTo(row), 0, 'sendCashout ne doit pas être appelé');
        const reread = await cashout(id);
        assert.equal(reread.status, 'A_ENVOYER');
        assert.equal(reread.blocked_reason, 'SIMULATED');
    });

    test('cron de reprise : le cashout simulé n’est pas repris, le réel l’est', async () => {
        await assertM2();
        const resume = (CashoutService as unknown as { resumeUnsent?: (limit: number) => Promise<unknown> }).resumeUnsent;
        assert.equal(typeof resume, 'function', 'CashoutService.resumeUnsent absente (lot 9 bis, B8)');
        const simulated = await simulatedCashout('reprise');
        const real = await realCashout('reprise-temoin');
        const old = new Date(Date.now() - SIX_MINUTES).toISOString();
        const { error } = await service.from('cashouts').update({ created_at: old }).in('id', [simulated.id, real.id]);
        assert.equal(error, null, `recul de created_at : ${error?.message}`);

        await resume!.call(CashoutService, 500);

        assert.equal(sendsTo(simulated.row), 0, 'cashout simulé envoyé par la reprise');
        const simulatedAfter = await cashout(simulated.id);
        assert.equal(simulatedAfter.status, 'A_ENVOYER');
        assert.equal(simulatedAfter.send_started_at, null);
        assert.equal(sendsTo(real.row), 1, 'témoin : le cashout réel est repris');
        assert.equal((await cashout(real.id)).status, 'CONFIRME');
    });

    test('confirmSent ne relit pas le statut d’un cashout simulé', async () => {
        await assertM2();
        const { id } = await simulatedCashout('confirmation');
        const transactionId = `TX-ESSAI-${randomUUID()}`;
        const { error } = await service.from('cashouts').update({ status: 'ENVOYE', samirpay_transaction_id: transactionId }).eq('id', id);
        assert.equal(error, null, `préparation : ${error?.message}`);
        await CashoutService.confirmSent(500);
        assert.equal(callsOf('checkTransactionStatus').filter((c) => c.args.transactionId === transactionId).length, 0, 'statut interrogé pour un cashout simulé');
        assert.equal((await cashout(id)).status, 'ENVOYE');
    });

    test('sendBatch : la ligne simulée sort du total et n’est pas envoyée, la réelle part', async () => {
        await assertM2();
        const simulated = await simulatedCashout('lot');
        const real = await realCashout('lot-temoin');
        // Solde égal au montant réel seul : compter la ligne simulée bloquerait tout le lot.
        fakePay().balance = Number(real.row.amount);
        const solde = soldeCalls();
        try {
            const out = await CashoutService.sendBatch([simulated.id, real.id]);
            assert.deepEqual(out[simulated.id], { status: 'A_ENVOYER', skipped: 'SIMULATED' });
            assert.equal(out[real.id]?.status, 'CONFIRME', JSON.stringify(out));
        } finally {
            fakePay().balance = 10_000_000;
        }
        assert.equal(soldeCalls(), solde + 1, 'solde vérifié une fois pour le lot');
        assert.equal(sendsTo(simulated.row), 0, 'ligne simulée envoyée');
        assert.equal(sendsTo(real.row), 1, 'ligne réelle envoyée une fois');
        assert.equal((await cashout(simulated.id)).blocked_reason, 'SIMULATED');
    });

    test('témoin : cashout sans en-tête, envoyé normalement', async () => {
        await assertM2();
        const { id, row } = await realCashout('temoin');
        const outcome = await CashoutService.send(id);
        assert.deepEqual(outcome, { status: 'CONFIRME' });
        assert.equal(sendsTo(row), 1);
        const reread = await cashout(id);
        assert.equal(reread.simulated, false);
        assert.equal(reread.blocked_reason, null);
    });

    test('serveur d’essai, ligne réelle : aucune écriture, aucun appel, skipped = REAL_IN_SIMULATION', async () => {
        await assertM2();
        const { id, row } = await realCashout('reelle-en-essai');
        const initial = await cashout(id);
        const solde = soldeCalls();
        const outcome = await withEssaiServer(() => CashoutService.send(id));
        assert.deepEqual(outcome, { status: 'A_ENVOYER', skipped: 'REAL_IN_SIMULATION' });
        assert.equal(soldeCalls(), solde, 'getSolde ne doit pas être appelé');
        assert.equal(sendsTo(row), 0, 'un vrai remboursement ne part jamais vers le faux service');
        assert.deepEqual(await cashout(id), initial, 'aucune écriture');
    });

    test('serveur d’essai, ligne simulée : envoyée au faux service, la garde en base l’accepte', async () => {
        await assertM2();
        const { id, row } = await simulatedCashout('simulee-en-essai');
        const m = await simulationModule();
        const outcome = await withEssaiServer(async () => {
            assert.equal(m.isSimulationRun(), true, 'préalable : serveur d’essai');
            assert.deepEqual(m.simulationHeaders(), { [HEADER]: '1' });
            return CashoutService.send(id);
        });
        assert.deepEqual(outcome, { status: 'CONFIRME' });
        assert.equal(sendsTo(row), 1);
        assert.equal((await cashout(id)).simulated, true);
    });
});

describe('refus en base (trg_cashouts_simulation_guard)', () => {
    async function claim(client: SupabaseClient, id: string) {
        return client.from('cashouts').update({ send_started_at: new Date().toISOString() }).eq('id', id).select('id');
    }

    test('UPDATE send_started_at direct d’un cashout simulé sans en-tête : EV403', async () => {
        await assertM2();
        const { id } = await simulatedCashout('garde-simule');
        const { error } = await claim(service, id);
        assert.equal(error?.code, 'EV403', `réservation refusée attendue : ${JSON.stringify(error)}`);
        assert.equal(error?.message, 'SIMULATION_MISMATCH');
        assert.equal((await cashout(id)).send_started_at, null, 'ligne inchangée');
    });

    test('UPDATE send_started_at d’un cashout réel avec l’en-tête : EV403', async () => {
        await assertM2();
        const { id } = await realCashout('garde-reel');
        const { error } = await claim(simClient, id);
        assert.equal(error?.code, 'EV403', `réservation refusée attendue : ${JSON.stringify(error)}`);
        assert.equal((await cashout(id)).send_started_at, null, 'ligne inchangée');
        const { error: closeErr } = await service.from('cashouts').update({ blocked_reason: 'OPERATOR_UNKNOWN' }).eq('id', id);
        assert.equal(closeErr, null, `fermeture de la ligne d’essai : ${closeErr?.message}`);
    });

    test('témoin : cashout simulé réservé avec l’en-tête', async () => {
        await assertM2();
        const { id } = await simulatedCashout('garde-temoin');
        const { data, error } = await claim(simClient, id);
        assert.equal(error, null, `même mode des deux côtés : ${error?.message}`);
        assert.equal(data?.length, 1);
        const { error: resetErr } = await service.from('cashouts').update({ send_started_at: null }).eq('id', id);
        assert.equal(resetErr, null, `remise à zéro de la réservation d’essai : ${resetErr?.message}`);
    });
});

describe('marque immuable', () => {
    async function assertImmutable(table: 'payments' | 'cashouts', id: string, value: boolean): Promise<void> {
        for (const client of [service, simClient]) {
            const { error } = await client.from(table).update({ simulated: !value }).eq('id', id);
            assert.ok(error, `UPDATE ${table}.simulated accepté (de ${value} à ${!value})`);
        }
        const { data, error } = await service.from(table).select('simulated').eq('id', id).single();
        assert.equal(error, null, `relecture : ${error?.message}`);
        assert.equal(data.simulated, value, `${table}.simulated a changé`);
    }

    test('UPDATE simulated refusé sur payments et cashouts, dans les deux sens', async () => {
        await assertM2();
        const simulated = await simulatedCashout('immuable');
        await assertImmutable('cashouts', simulated.id, true);
        await assertImmutable('payments', String(simulated.row.payment_id), true);
        const real = await realCashout('immuable-reel');
        await assertImmutable('cashouts', real.id, false);
        await assertImmutable('payments', String(real.row.payment_id), false);
    });
});
