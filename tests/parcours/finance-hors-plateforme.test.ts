/**
 * Lot 3.3 (contrats B et G) — paiements hors plateforme (CDC §55, §76) : ni frais, ni revenu Event
 * Village, ni solde organisateur ; tous les agrégats « revenu / volume Event Village » ne retiennent
 * que is_platform_payment = true, et le revenu EV = Σ (net − part remboursée).
 *  - fin_offline : répartition nulle ;
 *  - une vente en ligne de 1 000 F augmente le volume admin de 1 050 et le revenu EV de 34,25 ;
 *  - une vente en espèces de 1 000 F (paiement is_platform_payment = false et billet, créés par le
 *    service_role comme le ferait la caisse) ne crée aucune écriture au grand livre et ne change ni
 *    /api/admin/metrics, ni le tableau de bord et les métriques du partenaire, ni le net du rapport
 *    de clôture ; la réconciliation admin liste la vente en ligne et pas la vente en espèces ;
 *  - code : chaque agrégat relevé à la découverte filtre is_platform_payment (directement, par une
 *    fonction SQL qui le filtre, ou par le grand livre qui ne contient que des ventes plateforme).
 * Rouge avant correctif : app/api/admin/metrics/route.ts:22,58,60 additionne tous les paiements SUCCESS
 * et applique 6,5 % ; lib/admin/admin.service.ts:73 sélectionne une colonne inexistante (target_id),
 * la réconciliation est vide ; tableau de bord, métriques et rapport de clôture additionnent
 * tickets.price sans regarder le paiement (lib/partner/partner-dashboard.service.ts:239-243,453 ;
 * app/api/partner/metrics/route.ts:65-71) ; aucun grand livre.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { signInAs } from '../helpers/fixtures';
import { GET as adminMetricsRoute } from '../../app/api/admin/metrics/route';
import { GET as reconciliationRoute } from '../../app/api/admin/finance/reconciliation/route';
import { GET as partnerDashboardRoute } from '../../app/api/partner/dashboard/route';
import { GET as partnerMetricsRoute } from '../../app/api/partner/metrics/route';
import { PartnerDashboardService } from '../../lib/partner/partner-dashboard.service';
import { balanceOf, buyConfirmed, createPartnerEvent, jsonRequest, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { categoryState, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';

type Handler = (req: NextRequest) => Promise<Response>;

let partner: TestPartner;
let ev: SaleEvent;
let buyer: Buyer;
let superToken: string;
let platformPaymentId: string | undefined;
let cashPaymentId: string | undefined;

before(async () => {
    partner = await newPartner('horsplat');
    ev = await createPartnerEvent(partner.partnerId, 'horsplat', [{ name: 'Standard', price: 1000, total: 20 }]);
    buyer = await newBuyer('horsplat');
    superToken = (await signInAs('SUPERADMIN')).accessToken;
});

after(async () => {
    await assertFinanceInvariants('finance-hors-plateforme');
});

async function getJson(route: Handler, path: string, token: string): Promise<Record<string, unknown>> {
    const res = await route(jsonRequest(path, 'GET', token));
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 200, `${path} : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    return body;
}

interface Snapshot {
    adminVolume: number;
    adminNetRevenue: number;
    dashboard: Record<string, number>;
    partnerMetrics: Record<string, number>;
    closingNet: number;
}

async function snapshot(): Promise<Snapshot> {
    const admin = await getJson(adminMetricsRoute, '/api/admin/metrics', superToken);
    const kpis = (admin.kpis ?? {}) as Record<string, unknown>;
    const dash = await getJson(partnerDashboardRoute, '/api/partner/dashboard', partner.accessToken);
    const dk = (((dash.dashboard ?? dash.data) as Record<string, unknown> | undefined)?.kpis ?? {}) as Record<string, unknown>;
    const pm = await getJson(partnerMetricsRoute, '/api/partner/metrics', partner.accessToken);
    const mk = (pm.metrics ?? {}) as Record<string, unknown>;
    const closing = (await PartnerDashboardService.getClosingReportData(partner.userId, ev.eventId)) as unknown as { financialSummary?: { totalNet?: unknown } };
    return {
        adminVolume: Number(kpis.totalVolume),
        adminNetRevenue: Number(kpis.netRevenue),
        dashboard: {
            grossRevenue: Number(dk.grossRevenue),
            netRevenue: Number(dk.netRevenue),
            soldeDisponible: Number(dk.soldeDisponible),
        },
        partnerMetrics: { grossRevenue: Number(mk.grossRevenue), netRevenue: Number(mk.netRevenue) },
        closingNet: Number(closing.financialSummary?.totalNet),
    };
}

/** Vente au guichet en espèces, telle que la caisse l'enregistre : paiement hors plateforme, billet, stock. */
async function cashSale(amount: number): Promise<{ paymentId: string; ticketId: string }> {
    const cat = ev.categories.Standard;
    const { data: pay, error } = await service.from('payments').insert({
        transaction_id: `TX-CASH-LOT3-${randomUUID()}`,
        client_id: buyer.userId,
        partner_id: partner.partnerId,
        payment_target: 'TICKET',
        amount,
        currency: 'XOF',
        is_platform_payment: false,
        offline_payment_method: 'ESPECES',
        aggregator: 'GUICHET',
        status: 'PENDING',
        metadata: { event_id: ev.eventId, source: 'caisse (test lot 3)' },
    }).select('id').single();
    assert.equal(error, null, `paiement espèces : ${error?.message}`);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const { data: ticket, error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, payment_id: pay.id,
        ticket_number: `TCK-CASH-${suffix}`, price: amount, qr_code: `EV-QR-CASH-${suffix}`, status: 'VALIDE',
    }).select('id').single();
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const state = await categoryState(cat.id);
    const { error: sErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(sErr, null, `stock : ${sErr?.message}`);
    const { error: okErr } = await service.from('payments').update({ status: 'SUCCESS', paid_at: new Date().toISOString() }).eq('id', pay.id);
    assert.equal(okErr, null, `encaissement espèces : ${okErr?.message}`);
    return { paymentId: pay.id as string, ticketId: ticket.id as string };
}

describe('Paiements hors plateforme : ni frais ni revenu Event Village', () => {
    test('fin_offline : répartition nulle (frais, agrégateur, reversement, revenu brut et net)', async () => {
        const { data, error } = await service.rpc('fin_offline');
        assert.equal(error, null, `fin_offline : ${error?.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        for (const k of ['service_fee', 'aggregator_fee', 'partner_payout_amount', 'gross_event_village_revenue', 'net_event_village_revenue']) {
            assert.equal(Number(r[k]), 0, `fin_offline.${k} = ${JSON.stringify(r[k])}`);
        }
    });

    test('vente en ligne de 1 000 F : volume admin + 1 050, revenu EV + 34,25 (net des paiements plateforme)', async () => {
        const s0 = await snapshot();
        const { payment } = await buyConfirmed(buyer, ev, [['Standard', 1]], 'WAVE');
        platformPaymentId = payment.id;
        const s1 = await snapshot();
        assert.equal(s1.adminVolume - s0.adminVolume, 1050, `volume admin : +${s1.adminVolume - s0.adminVolume}`);
        const dNet = s1.adminNetRevenue - s0.adminNetRevenue;
        assert.ok(Math.abs(dNet - 34.25) < 0.005, `revenu EV admin : +${dNet} (attendu 34,25 = service 50 − agrégateur 15,75, et non 6,5 % du volume)`);
    });

    test('vente en espèces de 1 000 F : aucune écriture au grand livre, revenu EV 0, agrégats inchangés', async () => {
        const s1 = await snapshot();
        const ledger0 = await balanceOf(partner.userId, 'ORGANISATEUR');
        const cash = await cashSale(1000);
        cashPaymentId = cash.paymentId;

        const row = await paymentRow(cash.paymentId);
        assert.equal(row.status, 'SUCCESS');
        assert.equal(row.is_platform_payment, false);
        for (const k of ['service_fee', 'aggregator_fee', 'gross_event_village_revenue', 'net_event_village_revenue']) {
            assert.equal(Number(row[k]), 0, `espèces : ${k} = ${JSON.stringify(row[k])}`);
        }
        const { data: entries, error } = await service.from('finance_ledger').select('id, entry_type, amount').eq('payment_id', cash.paymentId);
        assert.equal(error, null, `grand livre : ${error?.message}`);
        assert.deepEqual(entries ?? [], [], 'aucune écriture au grand livre pour une vente en espèces');
        assert.deepEqual(await balanceOf(partner.userId, 'ORGANISATEUR'), ledger0, 'solde organisateur inchangé');

        const s2 = await snapshot();
        assert.equal(s2.adminVolume, s1.adminVolume, 'volume Event Village (admin) inchangé par la vente en espèces');
        assert.equal(s2.adminNetRevenue, s1.adminNetRevenue, 'revenu Event Village (admin) inchangé');
        assert.deepEqual(s2.dashboard, s1.dashboard, 'tableau de bord partenaire : montants inchangés');
        assert.deepEqual(s2.partnerMetrics, s1.partnerMetrics, 'métriques partenaire : montants inchangés');
        assert.equal(s2.closingNet, s1.closingNet, 'rapport de clôture : net organisateur inchangé');
    });

    test('réconciliation admin : la vente en ligne y figure, la vente en espèces non', async () => {
        assert.ok(platformPaymentId && cashPaymentId, 'ventes des tests précédents absentes');
        const body = await getJson(reconciliationRoute, '/api/admin/finance/reconciliation', superToken);
        const items = (body.items ?? []) as Array<Record<string, unknown>>;
        const ids = new Set(items.map((i) => String(i.paymentId ?? i.payment_id ?? i.id)));
        assert.ok(ids.has(platformPaymentId), `paiement plateforme ${platformPaymentId} absent de la réconciliation (${items.length} ligne(s))`);
        assert.ok(!ids.has(cashPaymentId), 'paiement en espèces compté dans la réconciliation Event Village');
    });
});

// ── Contrôle statique ──────────────────────────────────────────────────────

const MIGRATIONS = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
    .map((f) => fs.readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');

/** Dernière définition SQL (fonction ou vue) d'un objet, du CREATE au CREATE suivant. */
function sqlDefinition(name: string): string | null {
    const re = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?(FUNCTION|VIEW)\\s+(public\\.)?${name}\\b`, 'gi');
    let last = -1;
    for (let m = re.exec(MIGRATIONS); m; m = re.exec(MIGRATIONS)) last = m.index;
    if (last < 0) return null;
    const rest = MIGRATIONS.slice(last + 6);
    const next = rest.search(/\nCREATE\s/i);
    return next < 0 ? rest : rest.slice(0, next);
}

/** Corps d'une méthode de classe (de sa déclaration à la méthode statique suivante). */
function methodBody(src: string, name: string): string {
    const start = src.search(new RegExp(`static\\s+async\\s+${name}\\s*\\(`));
    assert.ok(start >= 0, `méthode ${name} introuvable`);
    const rest = src.slice(start + 1);
    const next = rest.search(/\n\s{4}(public\s+|private\s+)?static\s/);
    return next < 0 ? rest : rest.slice(0, next);
}

/** Le code filtre is_platform_payment lui-même, ou passe par une fonction / vue SQL qui le filtre. */
function filtersPlatform(code: string, ledgerAccepted: boolean): boolean {
    if (code.includes('is_platform_payment')) return true;
    if (ledgerAccepted && /finance_ledger|finance_account_balance/.test(code)) return true;
    const names = Array.from(code.matchAll(/\.(rpc|from)\(\s*['"]([a-z0-9_]+)['"]/g)).map((m) => m[2]);
    return names.some((n) => sqlDefinition(n)?.includes('is_platform_payment') ?? false);
}

/** Agrégats « revenu / volume » relevés à la découverte du lot 3 (fichier:ligne avant correctif). */
const AGGREGATES: Array<{ file: string; method?: string; ledger: boolean; where: string }> = [
    { file: 'app/api/admin/metrics/route.ts', ledger: false, where: 'volume et revenu EV admin (L22, L58-60)' },
    { file: 'lib/admin/admin.service.ts', method: 'getFinancialReconciliation', ledger: false, where: 'rapprochement financier (L66-90)' },
    { file: 'lib/partner/partner-dashboard.service.ts', method: 'getDashboardData', ledger: true, where: 'tableau de bord partenaire (L239-263)' },
    { file: 'lib/partner/partner-dashboard.service.ts', method: 'getClosingReportData', ledger: true, where: 'rapport de clôture / Z (L430-496)' },
    { file: 'lib/partner/partner-dashboard.service.ts', method: 'generateAccountingExport', ledger: true, where: 'export comptable (L797-849)' },
    { file: 'app/api/partner/metrics/route.ts', ledger: true, where: 'métriques partenaire (L62-111)' },
    { file: 'app/api/partner/finance/route.ts', ledger: true, where: 'finance partenaire (L61-123)' },
    { file: 'app/api/partner/stats/route.ts', ledger: true, where: 'statistiques partenaire (L54-79)' },
];

describe('Code : agrégats limités aux paiements plateforme', () => {
    test('chaque agrégat de revenu ou de volume filtre is_platform_payment', () => {
        const offenders: string[] = [];
        for (const a of AGGREGATES) {
            const src = fs.readFileSync(a.file, 'utf8');
            const code = a.method ? methodBody(src, a.method) : src;
            if (!filtersPlatform(code, a.ledger)) offenders.push(`${a.file}${a.method ? `#${a.method}` : ''} : ${a.where}`);
        }
        assert.deepEqual(offenders, [], `agrégats sans filtre is_platform_payment :\n${offenders.join('\n')}`);
    });
});
