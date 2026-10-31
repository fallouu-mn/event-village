/**
 * Lot 4, tâche 4.10 — invariant du contrôle d'accès (g)(h)(i).
 * Garde-fou : dans une transaction annulée, chaque règle détecte une violation fabriquée exprès
 * (sinon un invariant toujours vide ne prouverait rien). L'invariant complet (lots 2 à 4) est ensuite
 * vérifié sur l'état réel de la base à la fin de la suite.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inRolledBackTransaction } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { ACCESS_INVARIANT_SQL, assertAccessInvariants } from '../helpers/access-invariants';

interface Violation { regle: string; objet: string; detail: string }

describe('Invariant du contrôle (g)(h)(i)', () => {
    after(async () => {
        await assertAccessInvariants('acces-invariant');
    });

    test('chaque règle détecte une violation fabriquée (transaction annulée)', async () => {
        const fx = await loadFixtures();
        const ev = fx.events.A_PUBLIE;
        const category = Object.values(ev.categories)[0];
        const ticketId = randomUUID();
        const shiftId = randomUUID();
        const offlineId = randomUUID();

        const rows = await inRolledBackTransaction(async (db) => {
            // (g) billet UTILISE sans aucun scan accepté
            await db.query(
                `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'UTILISE')`,
                [ticketId, ev.id, category.id, fx.users.CLIENT.id, `TCK-INV-G-${Date.now()}`, category.price, `EV-QR-INV-G-${randomUUID()}`]);
            // (h) caisse dont le total attendu ne correspond à aucun encaissement
            await db.query(
                `INSERT INTO public.controller_shifts (id, controller_id, event_id, partner_id, status, expected_cash_total)
                 VALUES ($1, $2, $3, $4, 'OUVERT', 1000)`,
                [shiftId, fx.users.CONTROLLER_A.id, ev.id, ev.partnerId]);
            // (i) paiement hors plateforme avec des frais de service
            await db.query(
                `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                              facial_amount, service_fee, partner_payout_amount)
                 VALUES ($1, $2, $3, 'TICKET', 1050, 'SUCCESS', false, 1000, 50, 0)`,
                [offlineId, `TX-INV-I-${Date.now()}`, fx.users.CLIENT.id]);
            return (await db.query<Violation>(ACCESS_INVARIANT_SQL)).rows;
        });

        assert.ok(rows.some((r) => r.regle === 'g' && r.objet === ticketId), `(g) détecte le billet composté sans scan : ${JSON.stringify(rows)}`);
        assert.ok(rows.some((r) => r.regle === 'h' && r.objet === shiftId), `(h) détecte la caisse incohérente : ${JSON.stringify(rows)}`);
        assert.ok(rows.some((r) => r.regle === 'i' && r.objet === offlineId), `(i) détecte les frais sur un paiement hors plateforme : ${JSON.stringify(rows)}`);
    });
});
