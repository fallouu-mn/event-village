/**
 * Lot 5, tâche 5.12 — invariant (l) : « les totaux de la page de pilotage sont égaux à la vérité en
 * base (vendus, entrées, espèces par caisse) » (contrat, sections K et U ; requête dans
 * tests/helpers/lifecycle-invariants.ts).
 *  - sur le jeu de données connu, les fonctions internes du pilotage rendent les valeurs calculées à la
 *    main : pilotage_compute_overview(event_id) → { tickets: { sold, invitations, capacity, in_payment,
 *    remaining }, entries: { total, counter }, revenue: { online, cash, refunded } } ;
 *    pilotage_compute_cash(event_id) → { shifts: [{ id, controller_id, status, cash_collected, declared,
 *    difference }] } ;
 *  - (l) : 0 violation pour l'événement du jeu et ses caisses ;
 *  - garde-fou de l'invariant : une divergence fabriquée dans une transaction annulée
 *    (tests/helpers/db.ts, inRolledBackTransaction) est détectée par la requête de (l) :
 *      a) un billet passé UTILISE sans scan accepté (entrées ≠ billets UTILISE) ;
 *      b) un paiement espèces détaché de sa caisse (espèces de la caisse ≠ paiements rattachés) ;
 *    puis, les transactions annulées, (l) revient à 0 violation pour le jeu.
 * Jeu de données et valeurs attendues (calculées à la main) : tests/parcours/pilotage-helpers.ts.
 *
 * Rouge avant correctif :
 *  - aucune fonction pilotage_compute_overview ni pilotage_compute_cash (aucune migration) : les appels
 *    directs et la requête LIFECYCLE_INVARIANT_SQL échouent (fonction absente) ;
 *  - tables event_status_history et event_status_transitions, fonction event_end_at absentes : la requête
 *    de (j)(k)(l) échoue aussi pour ces raisons ;
 *  - le jeu de données échoue avant (event_transition, sale_channel, guichet, clôture : voir
 *    pilotage-apercu-ventes.test.ts).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLifecycleInvariants, LIFECYCLE_INVARIANT_SQL, lifecycleViolations } from '../helpers/lifecycle-invariants';
import { service } from './paiement-helpers';
import { ticketRow } from './acces-helpers';
import { buildKnownDataset, EXPECTED, findItem, listAt, nullableNumber, numberAt, type KnownDataset, type Row } from './pilotage-helpers';

type Violation = Awaited<ReturnType<typeof lifecycleViolations>>[number];

let ds: KnownDataset;

before(async () => {
    ds = await buildKnownDataset('invariant');
});

after(async () => {
    await assertLifecycleInvariants('pilotage-invariant');
});

async function computeOverview(eventId: string): Promise<Row> {
    return inspect(async (db) => (await db.query<{ o: Row }>('SELECT public.pilotage_compute_overview($1::uuid) AS o', [eventId])).rows[0].o);
}

async function computeCash(eventId: string): Promise<Row> {
    return inspect(async (db) => (await db.query<{ c: Row }>('SELECT public.pilotage_compute_cash($1::uuid) AS c', [eventId])).rows[0].c);
}

/** Violations de (l) qui portent sur l'événement du jeu ou sur l'une de ses caisses. */
function lOfDataset(rows: Violation[]): Violation[] {
    const ids = new Set([ds.eventId, ds.shifts.s1, ds.shifts.s2]);
    return rows.filter((r) => r.regle === 'l' && ids.has(r.objet));
}

function print(label: string, rows: Violation[]): void {
    console.log(`[INVARIANT-CYCLE] pilotage-invariant — ${label} : ${rows.length} violation(s) (l) sur le jeu`);
    for (const r of rows) console.log(`[INVARIANT-CYCLE]   (${r.regle}) ${r.objet} : ${r.detail}`);
}

describe('5.12 (l) sur le jeu de données connu', () => {
    test('pilotage_compute_overview(événement) = valeurs calculées à la main', async () => {
        const o = await computeOverview(ds.eventId);
        const t = EXPECTED.tickets;
        assert.equal(numberAt(o, 'tickets.sold', 'vendus'), t.sold, 'vendus = billets VALIDE et UTILISE hors invitations');
        assert.equal(numberAt(o, 'tickets.invitations', 'invitations'), t.invitations, 'invitations');
        assert.equal(numberAt(o, 'tickets.capacity', 'capacité'), t.capacity, 'capacité = Σ quotas des catégories actives');
        assert.equal(numberAt(o, 'tickets.in_payment', 'en cours'), t.in_payment, 'en cours de paiement');
        assert.equal(numberAt(o, 'tickets.remaining', 'restants'), t.remaining, 'restants');
        assert.equal(numberAt(o, 'entries.total', 'entrées'), EXPECTED.entries.total, 'entrées = scans acceptés');
        assert.equal(numberAt(o, 'entries.counter', 'guichet'), EXPECTED.entries.counter, 'dont guichet');
        assert.equal(numberAt(o, 'revenue.online', 'CA en ligne'), EXPECTED.revenue.online, 'CA en ligne');
        assert.equal(numberAt(o, 'revenue.cash', 'CA espèces'), EXPECTED.revenue.cash, 'CA espèces');
        assert.equal(numberAt(o, 'revenue.refunded', 'remboursé'), EXPECTED.revenue.refunded, 'remboursé');
    });

    test('pilotage_compute_cash(événement) = valeurs calculées à la main, une entrée par caisse', async () => {
        const c = await computeCash(ds.eventId);
        const shifts = listAt(c, 'shifts', 'pilotage_compute_cash');
        assert.equal(shifts.length, 2, `deux caisses : ${JSON.stringify(shifts)}`);
        const s1 = findItem(shifts, 'id', ds.shifts.s1, 'caisse S1');
        assert.equal(s1.controller_id, ds.c1.userId, 'S1 : C1');
        assert.equal(s1.status, EXPECTED.shifts.s1.status, 'S1 : clôturée');
        assert.equal(numberAt(s1, 'cash_collected', 'S1'), EXPECTED.shifts.s1.cash_collected, 'S1 : espèces encaissées');
        assert.equal(numberAt(s1, 'declared', 'S1'), EXPECTED.shifts.s1.declared, 'S1 : déclaré');
        assert.equal(numberAt(s1, 'difference', 'S1'), EXPECTED.shifts.s1.difference, 'S1 : écart');
        const s2 = findItem(shifts, 'id', ds.shifts.s2, 'caisse S2');
        assert.equal(s2.controller_id, ds.c2.userId, 'S2 : C2');
        assert.equal(s2.status, EXPECTED.shifts.s2.status, 'S2 : ouverte');
        assert.equal(numberAt(s2, 'cash_collected', 'S2'), EXPECTED.shifts.s2.cash_collected, 'S2 : espèces encaissées');
        assert.equal(nullableNumber(s2.declared), null, 'S2 : rien de déclaré');
        assert.equal(nullableNumber(s2.difference), null, 'S2 : pas d’écart');
    });

    test('(l) : 0 violation pour l’événement du jeu et ses caisses', async () => {
        const rows = lOfDataset(await lifecycleViolations());
        print('jeu connu', rows);
        assert.deepEqual(rows, [], `(l) violé sur le jeu connu :\n${rows.map((r) => `${r.objet} : ${r.detail}`).join('\n')}`);
    });
});

describe('5.12 (l) détecte une divergence fabriquée (transaction annulée)', () => {
    test('billet passé UTILISE sans scan accepté : violation (l) sur l’événement (entrées ≠ billets UTILISE)', async () => {
        const rows = await inRolledBackTransaction(async (db) => {
            const up = await db.query("UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now() WHERE id = $1 AND status = 'VALIDE'", [ds.tickets.p1b]);
            assert.equal(up.rowCount, 1, 'garde-fou : P1-b était VALIDE');
            return lOfDataset((await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows);
        });
        print('billet UTILISE sans scan', rows);
        const onEvent = rows.filter((r) => r.objet === ds.eventId);
        assert.ok(onEvent.length >= 1, `(l) doit signaler l’événement : entrées (scans acceptés) ≠ billets UTILISE ; reçu ${JSON.stringify(rows)}`);
        assert.ok(onEvent.some((r) => /entrées/.test(r.detail)), `détail de la violation sur les entrées : ${JSON.stringify(onEvent)}`);
        assert.equal((await ticketRow(ds.tickets.p1b)).status, 'VALIDE', 'transaction annulée : P1-b toujours VALIDE');
    });

    test('paiement espèces détaché de sa caisse : violation (l) sur la caisse (espèces ≠ paiements rattachés)', async () => {
        const rows = await inRolledBackTransaction(async (db) => {
            const up = await db.query('UPDATE public.payments SET shift_id = NULL WHERE id = $1 AND shift_id = $2', [ds.payments.cashCheckin, ds.shifts.s1]);
            assert.equal(up.rowCount, 1, 'garde-fou : le paiement encaissé au scan est rattaché à S1');
            return lOfDataset((await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows);
        });
        print('paiement espèces détaché', rows);
        const onShift = rows.filter((r) => r.objet === ds.shifts.s1);
        assert.ok(onShift.length >= 1, `(l) doit signaler la caisse S1 : espèces attendues 7 000, paiements rattachés 2 000 ; reçu ${JSON.stringify(rows)}`);
        const { data, error } = await service.from('payments').select('shift_id').eq('id', ds.payments.cashCheckin).single();
        assert.equal(error, null, error?.message);
        assert.equal(data.shift_id, ds.shifts.s1, 'transaction annulée : paiement toujours rattaché à S1');
    });

    test('garde-fou : les transactions annulées, (l) revient à 0 violation pour le jeu', async () => {
        const rows = lOfDataset(await lifecycleViolations());
        print('après annulation', rows);
        assert.deepEqual(rows, [], `(l) après annulation des divergences :\n${rows.map((r) => `${r.objet} : ${r.detail}`).join('\n')}`);
    });
});
