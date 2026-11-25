/**
 * Correctifs de la contre-vérification du lot Carte B — T2, T3, T4 (invalidation des pages publiques), sans base :
 *  - T4 : règle du passage par zéro (lib/events/stock-watch.server.ts, fonctions pures) et regroupement (au plus une
 *    invalidation par événement toutes les 5 s) ; chaque écriture du stock lit les places restantes avant et après, puis
 *    invalide : réservation du panier et billets gratuits (checkout), billets gratuits (route), guichet, confirmation,
 *    remise en stock d'un paiement, réservations échues (deux tâches planifiées) ;
 *  - T2 : fin par la tâche planifiée, fiches des événements passés à TERMINE (même en cas d'échec d'une ronde suivante) ;
 *  - T3 : profil de la partenaire, seulement quand un champ affiché change (raison sociale, nom commercial, logo).
 * La preuve de bout en bout de T2 et T3 est dans e2e/cvcb.responsive.spec.ts (contre-vérification).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { eventsCrossingZero, STOCK_INVALIDATION_WINDOW_MS, throttleStockEvents, type StockSnapshot } from '../../lib/events/stock-watch.server';

const ROOT = process.cwd();
const code = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

const snap = (rows: Array<[string, string, number]>): StockSnapshot => new Map(rows.map(([id, eventId, remaining]) => [id, { eventId, remaining }]));

describe('T4 — passage par zéro', () => {
    test('épuisée ou repartie de zéro : l’événement est désigné ; sinon rien', () => {
        const before = snap([['c1', 'E1', 3], ['c2', 'E1', 10], ['c3', 'E2', 0], ['c4', 'E3', 5], ['c5', 'E4', 0]]);
        const after = snap([['c1', 'E1', 0], ['c2', 'E1', 9], ['c3', 'E2', 2], ['c4', 'E3', 4], ['c5', 'E4', 0]]);
        assert.deepEqual(eventsCrossingZero(before, after).sort(), ['E1', 'E2']);
        // Survente impossible en base, mais une lecture négative compte comme épuisée
        assert.deepEqual(eventsCrossingZero(snap([['c', 'E', 1]]), snap([['c', 'E', -1]])), ['E']);
        // Catégorie apparue entre les deux lectures : ignorée
        assert.deepEqual(eventsCrossingZero(snap([]), snap([['c', 'E', 0]])), []);
    });

    test('regroupement : au plus une invalidation par événement toutes les 5 s', () => {
        const t0 = 1_000_000_000;
        assert.deepEqual(throttleStockEvents(['A', 'B'], t0), ['A', 'B']);
        assert.deepEqual(throttleStockEvents(['A', 'C'], t0 + 1_000), ['C']);
        assert.deepEqual(throttleStockEvents(['A'], t0 + STOCK_INVALIDATION_WINDOW_MS - 1), []);
        assert.deepEqual(throttleStockEvents(['A', 'B'], t0 + STOCK_INVALIDATION_WINDOW_MS), ['A', 'B']);
    });

    for (const [rel, labels] of [
        ['lib/payments/checkout.service.ts', ['stock : billets gratuits', 'stock : places réservées']],
        ['app/api/tickets/claim-free/route.ts', ['stock : billets gratuits']],
        ['app/api/controller/counter-sale/route.ts', ['stock : vente au guichet']],
        ['lib/payments/confirmation.service.ts', ['stock : vente confirmée', 'stock : réservation rendue']],
        ['app/api/cron/stock-reservations/route.ts', ['stock : réservations échues']],
        ['app/api/cron/payments-reconcile/route.ts', ['stock : réservations échues']],
    ] as const) {
        test(`${rel} : places lues avant l’écriture, invalidation après (${labels.join(', ')})`, () => {
            const src = code(rel);
            assert.match(src, /import \{ invalidatePublicEvent \} from '@\/lib\/events\/public-cache\.server';/);
            for (const label of labels) {
                const at = src.indexOf(`invalidatePublicEvent(eventId, '${label}')`);
                assert.ok(at > 0, `${label} : invalidation absente`);
                assert.match(src.slice(Math.max(0, at - 160), at), /for \(const eventId of await stockCrossedZero\(/, `${label} : par stockCrossedZero`);
            }
            const snapAt = src.search(/stockSnapshot\(/);
            const rpcAt = src.search(/rpcWithRetry[^(]*\('(checkout_create_payment|free_tickets_claim|counter_sale|payment_confirm|payment_release|stock_reservations_expire)'|rpcWithRetry<[^>]*>\(rpc,/);
            assert.ok(snapAt > 0 && rpcAt > 0 && snapAt < rpcAt, `${rel} : lecture des places avant l’écriture`);
        });
    }
});

describe('T2 — fin par la tâche planifiée', () => {
    test('fiches des événements passés à TERMINE invalidées, aussi quand une ronde suivante échoue', () => {
        const src = code('app/api/cron/events-finish/route.ts');
        assert.match(src, /for \(const id of ids\.slice\(0, FICHES_MAX\)\) invalidatePublicEvent\(id, 'fin planifiée'\);/);
        assert.equal((src.match(/invalidateFinished\(ids\);/g) ?? []).length, 2, 'après la boucle et dans le chemin d’échec');
    });
});

describe('T3 — profil de la partenaire', () => {
    test('invalidation seulement si la raison sociale, le nom commercial ou le logo font partie de la modification', () => {
        const src = code('app/api/partner/profile/route.ts');
        assert.match(src, /PUBLIC_PROFILE_FIELDS = \['company_name', 'commercial_name', 'logo_url'\] as const/);
        assert.match(src, /if \(PUBLIC_PROFILE_FIELDS\.some\(\(key\) => key in update\)\) invalidatePublicEvent\(null, 'profil de la partenaire'\);/);
        assert.ok(src.indexOf("'partner_profile_update'") < src.indexOf("invalidatePublicEvent(null, 'profil de la partenaire')"), 'après l’écriture');
    });
});
