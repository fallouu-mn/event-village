/**
 * Finition 3a (E-30, E-31, E-06) — règles de la page Finance sans base :
 *  - période unique calculée par le serveur en heure de Dakar (lib/finance/period.ts) : bornes [début, fin[ exactes pour
 *    « Aujourd'hui », « 7 derniers jours », « 30 derniers jours », « Ce mois-ci », « Mois dernier » et des dates libres
 *    (bornes comprises), phrase des dates (« du 1er au 16 novembre 2026 »), refus en français ;
 *  - statuts de paiement en français, sans capitales ni code brut, même mot dans le filtre et le badge
 *    (lib/finance/payment-labels.ts), StatusBadge inchangé ;
 *  - « Retirable par Event Village » jamais négatif, en centimes entiers, manque rendu à part, aucun chiffre sans solde
 *    (lib/finance/admin-summary.ts) ;
 *  - lignes du détail en mots, numéro masqué (lib/finance/admin-lists.ts).
 * Sans base : vert dès que les modules existent ; aucune écriture, donc aucun appel d'invariants (écart signalé).
 * Rouge avant correctif : les modules n'existent pas (import en échec).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { currentMonth, resolvePeriod, type FinancePeriod } from '../../lib/finance/period';
import { PAYMENT_STATUS_FILTER, paymentStatusLabel } from '../../lib/finance/payment-labels';
import { withdrawableAmount } from '../../lib/finance/admin-summary';
import { debtLine, owedLine, parsePage, refundToPayLine } from '../../lib/finance/admin-lists';

function period(input: { period?: string; from?: string; to?: string }, now: string): FinancePeriod {
    const r = resolvePeriod(input, new Date(now));
    assert.ok(r.ok, `période refusée : ${JSON.stringify(input)} → ${r.ok ? '' : r.error}`);
    return r.period;
}

function refused(input: { period?: string; from?: string; to?: string }, now: string): string {
    const r = resolvePeriod(input, new Date(now));
    assert.equal(r.ok, false, `période acceptée à tort : ${JSON.stringify(input)}`);
    return r.ok ? '' : r.error;
}

const NOW = '2026-11-16T14:30:00Z';

describe('E-30 — période unique, en heure de Dakar', () => {
    test('aujourd’hui : du minuit de Dakar au minuit suivant', () => {
        const p = period({ period: 'today' }, NOW);
        assert.deepEqual([p.from, p.to, p.firstDay, p.lastDay], ['2026-11-16T00:00:00.000Z', '2026-11-17T00:00:00.000Z', '2026-11-16', '2026-11-16']);
        assert.equal(p.label, 'Aujourd’hui');
        assert.equal(p.range, 'le 16 novembre 2026');
    });

    test('7 et 30 derniers jours : aujourd’hui compris', () => {
        const w = period({ period: '7d' }, NOW);
        assert.deepEqual([w.from, w.to], ['2026-11-10T00:00:00.000Z', '2026-11-17T00:00:00.000Z']);
        assert.equal(w.range, 'du 10 au 16 novembre 2026');
        const m = period({ period: '30d' }, NOW);
        assert.deepEqual([m.from, m.to], ['2026-10-18T00:00:00.000Z', '2026-11-17T00:00:00.000Z']);
        assert.equal(m.range, 'du 18 octobre au 16 novembre 2026');
    });

    test('ce mois-ci (par défaut) et mois dernier, passage d’année compris', () => {
        const d = period({}, NOW);
        assert.equal(d.key, 'month', 'période par défaut');
        assert.deepEqual([d.from, d.to, d.range], ['2026-11-01T00:00:00.000Z', '2026-11-17T00:00:00.000Z', 'du 1er au 16 novembre 2026']);
        const prev = period({ period: 'prev-month' }, NOW);
        assert.deepEqual([prev.from, prev.to, prev.range], ['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 'du 1er au 31 octobre 2026']);
        const jan = period({ period: 'prev-month' }, '2027-01-05T08:00:00Z');
        assert.deepEqual([jan.from, jan.to, jan.label], ['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', 'Mois dernier']);
        assert.deepEqual([currentMonth(new Date(NOW)).from, currentMonth(new Date(NOW)).label], ['2026-11-01T00:00:00.000Z', 'Ce mois-ci']);
    });

    test('minuit pile à Dakar : le jour qui commence', () => {
        const p = period({ period: 'today' }, '2026-11-17T00:00:00Z');
        assert.equal(p.firstDay, '2026-11-17');
    });

    test('dates libres : bornes comprises, phrase des dates', () => {
        const p = period({ period: 'custom', from: '2026-11-03', to: '2026-11-12' }, NOW);
        assert.deepEqual([p.from, p.to], ['2026-11-03T00:00:00.000Z', '2026-11-13T00:00:00.000Z']);
        assert.equal(p.range, 'du 3 au 12 novembre 2026');
        assert.equal(p.label, 'Du 3 au 12 novembre 2026');
        const one = period({ period: 'custom', from: '2026-02-01', to: '2026-02-01' }, NOW);
        assert.equal(one.range, 'le 1er février 2026');
    });

    test('refus en français : inconnue, inversée, dans le futur, date impossible, trop longue, trop ancienne', () => {
        assert.match(refused({ period: 'semaine' }, NOW), /Période inconnue/);
        assert.match(refused({ period: 'custom', from: '2026-11-12', to: '2026-11-03' }, NOW), /précéder/);
        assert.match(refused({ period: 'custom', from: '2026-11-10', to: '2026-11-17' }, NOW), /aujourd’hui/);
        assert.match(refused({ period: 'custom', from: '2026-02-30', to: '2026-03-02' }, NOW), /dates valables/);
        assert.match(refused({ period: 'custom', from: '2025-01-01', to: '2026-11-16' }, NOW), /366 jours/);
        assert.match(refused({ period: 'custom', from: '2019-12-31', to: '2020-01-02' }, NOW), /2020/);
        assert.match(refused({ period: 'custom' }, NOW), /dates valables/);
    });
});

describe('E-31 — statuts de paiement en français, propres aux paiements', () => {
    test('Payé, Remboursé en partie, Remboursement en cours, Remboursé ; inconnu : « Statut inconnu », jamais le code', () => {
        assert.equal(paymentStatusLabel('SUCCESS').label, 'Payé');
        assert.equal(paymentStatusLabel('PARTIAL').label, 'Remboursé en partie');
        assert.equal(paymentStatusLabel('REFUND_PENDING').label, 'Remboursement en cours');
        assert.equal(paymentStatusLabel('REFUNDED').label, 'Remboursé');
        assert.equal(paymentStatusLabel('BIZARRE').label, 'Statut inconnu');
        for (const s of ['SUCCESS', 'PARTIAL', 'REFUND_PENDING', 'REFUNDED']) {
            const l = paymentStatusLabel(s).label;
            assert.notEqual(l, l.toUpperCase(), `${s} : libellé en capitales (${l})`);
            assert.doesNotMatch(l, /_/, `${s} : code brut (${l})`);
        }
    });

    test('le filtre emploie les mêmes mots que les badges', () => {
        const labels = PAYMENT_STATUS_FILTER.filter((o) => o.value !== 'ALL').map((o) => o.label);
        assert.deepEqual(labels, ['Payé', 'Remboursé en partie', 'Remboursement en cours', 'Remboursé']);
        assert.equal(PAYMENT_STATUS_FILTER[0].value, 'ALL');
    });

    test('StatusBadge partagé inchangé (il garde ses libellés pour les autres écrans)', () => {
        const badge = fs.readFileSync(path.join(process.cwd(), 'components/ui/Badge.tsx'), 'utf8');
        assert.match(badge, /label = 'PAYÉ'/, 'components/ui/Badge.tsx modifié');
    });
});

describe('E-06 — « Retirable par Event Village » : jamais négatif, aucun chiffre sans solde', () => {
    test('solde 30 000, dû 22 500 → 7 500', () => {
        assert.deepEqual(withdrawableAmount({ balance: 30_000, owedPartners: 22_500, owedReferrers: 0, refundsToPay: 0, reserve: 0 }), { amount: 7_500, shortfall: 0 });
    });

    test('tout est soustrait : dû aux partenaires et aux parrains, remboursements à verser, réserve', () => {
        assert.deepEqual(withdrawableAmount({ balance: 100_000, owedPartners: 40_000, owedReferrers: 1_234.56, refundsToPay: 10_500, reserve: 21_000 }),
            { amount: 27_265.44, shortfall: 0 });
    });

    test('compte insuffisant : 0, et le manque à part', () => {
        assert.deepEqual(withdrawableAmount({ balance: 10_000, owedPartners: 12_000, owedReferrers: 0, refundsToPay: 500, reserve: 0 }), { amount: 0, shortfall: 2_500 });
    });

    test('centimes exacts (pas d’erreur de virgule flottante)', () => {
        assert.deepEqual(withdrawableAmount({ balance: 0.3, owedPartners: 0.1, owedReferrers: 0.2, refundsToPay: 0, reserve: 0 }), { amount: 0, shortfall: 0 });
    });

    test('solde illisible : aucun chiffre', () => {
        assert.deepEqual(withdrawableAmount({ balance: null, owedPartners: 1, owedReferrers: 0, refundsToPay: 0, reserve: 0 }), { amount: null, shortfall: null });
    });
});

describe('détail de la page Finance : lignes en mots, numéro masqué', () => {
    test('créance : qui (raison sociale ou « Prénom N. »), pourquoi en mots, jamais le code', () => {
        const p = debtLine({ id: 'd1', account_kind: 'ORGANISATEUR', company_name: 'Salle Sahel', first_name: 'Awa', last_name: 'Ndiaye', nature: 'FRAIS_REMBOURSEMENT', amount: 120, remaining: 80, created_at: '2026-11-01T10:00:00Z', event_title: 'Concert' });
        assert.deepEqual([p.who, p.whoKind, p.reason, p.remaining], ['Salle Sahel', 'Partenaire', 'Frais SamirPay d’un remboursement', 80]);
        const s = debtLine({ id: 'd2', account_kind: 'PARRAINAGE', first_name: 'Moussa', last_name: 'diop', nature: 'COMMISSION', amount: 10, remaining: 10, created_at: '2026-11-01T10:00:00Z' });
        assert.deepEqual([s.who, s.whoKind, s.reason], ['Moussa D.', 'Parrain', 'Commission de parrainage reprise après un remboursement']);
        assert.equal(debtLine({ id: 'd3', account_kind: 'ORGANISATEUR', nature: 'XYZ', amount: 1, remaining: 1, created_at: 'x' }).reason, 'Autre somme due');
    });

    test('remboursement à verser : état en mots, numéro masqué, action signalée', () => {
        const r = refundToPayLine({ id: 'c1', kind: 'TICKET_REFUND', status: 'ECHOUE', not_sent: false, amount: 10_500, first_name: 'Fatou', last_name: 'Diallo', phone_number: '771234534', created_at: '2026-11-15T10:00:00Z' });
        assert.deepEqual([r.kind, r.state, r.needsAction, r.beneficiary], ['Remboursement d’un billet', 'Refusé par l’opérateur : à renvoyer', true, 'Fatou D. · 77*****34']);
        assert.doesNotMatch(JSON.stringify(r), /771234534/, 'numéro complet dans la ligne');
        assert.equal(refundToPayLine({ id: 'c2', kind: 'REFUND', status: 'A_ENVOYER', blocked_reason: null, amount: 1, created_at: 'x' }).state, 'En attente d’envoi');
        assert.equal(refundToPayLine({ id: 'c3', kind: 'REFUND', status: 'A_ENVOYER', blocked_reason: 'SOLDE_INSUFFISANT', amount: 1, created_at: 'x' }).needsAction, true);
        assert.equal(refundToPayLine({ id: 'c4', kind: 'REFUND', status: 'ECHOUE', not_sent: true, amount: 1, created_at: 'x' }).state, 'Non versé (constaté avec le support SamirPay)');
    });

    test('dû par compte : raison sociale d’une partenaire, nom d’un parrain', () => {
        assert.equal(owedLine({ owner_id: 'u1', company_name: 'Salle Sahel', total: 5, withdrawable_now: 4, pending: 1, frozen: 0, withdrawals_in_progress: 0 }, 'ORGANISATEUR').who, 'Salle Sahel');
        assert.equal(owedLine({ owner_id: 'u2', company_name: 'X', first_name: 'Awa', last_name: 'Sow', total: 5 }, 'PARRAINAGE').who, 'Awa S.');
    });

    test('numéro de page : 1 par défaut, entier de 1 à 10 000, sinon refus', () => {
        assert.deepEqual([parsePage(null), parsePage(''), parsePage('3'), parsePage('0'), parsePage('-1'), parsePage('2.5'), parsePage('10001'), parsePage('abc')],
            [1, 1, 3, null, null, null, null, null]);
    });
});

describe('E-30 — ligne de la liste des paiements, préparée par le serveur', () => {
    test('référence, objet en mots, part pour Event Village en centimes exacts, écart', async () => {
        const { paymentLine } = await import('../../lib/finance/admin-lists');
        const p = paymentLine({
            id: 'p1', reference: 'TX-ABC', target: 'TICKET', event_title: 'Concert', encashed_at: '2026-11-05T10:00:00Z', amount: 21_000,
            service_fee: 1_000, net_revenue: 685, refunded_net: 342.5, duplicate_withheld: 0, commissions: 17.13, status: 'PARTIAL', discrepancy: 0,
        });
        assert.deepEqual([p.transactionReference, p.target, p.eventTitle, p.evNet, p.status, p.discrepancy], ['TX-ABC', 'Billets', 'Concert', 325.37, 'PARTIAL', 0]);
        const d = paymentLine({ id: 'p2', reference: null, target: 'XYZ', amount: 10_500, net_revenue: 342.5, refunded_net: 500, duplicate_withheld: 157.5, commissions: 0, status: 'REFUNDED', discrepancy: 0.01 });
        assert.deepEqual([d.transactionReference, d.target, d.evNet, d.discrepancy], ['p2', 'Autre', 0, 0.01]);
    });
});
