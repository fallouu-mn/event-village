/**
 * Lot 8 — invariants (r)(s)(t) de la recette (contrat, section 14), extension des invariants des lots 2 à 7,
 * vérifiés à la fin de chaque suite nouvelle du lot 8, du seed de démonstration et de chaque parcours de
 * recette, par une requête SQL sur TOUTE la base LOCALE (lecture seule) :
 *  (r) pour chaque paiement, les commissions de parrainage non annulées ne dépassent pas le revenu net
 *      d'Event Village (r1 : brut, net NULL = violation ; r2 : commissions restantes ≤ net effectif, après
 *      remboursements). Un paiement sans commission n'est pas comparé (L39) ;
 *  (s) aucun paiement réussi en double conservé pour un même panier (s1, oracle écrit à part : la fonction
 *      payment_duplicate_of n'est jamais appelée ici) ; tout paiement marqué `duplicate_of` est remboursé
 *      en entier, sans billet et sans crédit au grand livre (s2) ; lot 9 quater (C1) : ou du total moins la retenue
 *      enregistrée (duplicate_fee_withheld), au plus les frais de l'opérateur du paiement. Un cashout ECHOUE n'est pas une violation :
 *      il a son alerte et sa relance (L40) ;
 *  (t) aucun billet sans décision de vente (t0) ; aucun billet ONLINE ou FREE d'une catégorie non vendue en
 *      ligne au moment de l'achat (t1, FREE compris : L9) ; aucun billet COUNTER d'une catégorie non vendue
 *      au guichet (t2) ; is_visible reste le miroir de sale_online (t3) ; un billet payé en ligne porte la
 *      décision de sa réservation (t4). Seule t3 lit les réglages courants de la catégorie : vendre, couper
 *      le canal, puis 0 violation.
 *
 * Ordre de assertRecetteInvariants(label) : (a) à (q) par assertTerrainInvariants (passage de l'envoyeur
 * compris : aucun after() ne compte de SMS), contrôle du schéma du lot 8 (échec explicite qui nomme chaque
 * colonne, trigger ou fonction absent ; jamais d'erreur Postgres brute, jamais de faux vert), puis (r)(s)(t).
 * La sortie brute est imprimée (`[INVARIANT-RECETTE]`, recopiée par le rapport du lot 8, section 4).
 *
 * tests/helpers/terrain-invariants.ts ne change pas (AR2, L41) : les 26 suites qui l'appellent gardent leur
 * comportement au run « avant ». Une suite annoncée verte dès l'écriture appelle assertTerrainInvariants :
 * assertRecetteInvariants échoue tant que le schéma du lot n'est pas livré.
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertTerrainInvariants } from './terrain-invariants';

/** Requête des invariants (contrat 14.2) : lignes `{ regle, objet, detail }`, triées par règle puis objet. */
export const RECETTE_INVARIANT_SQL = `
WITH cm AS (
    SELECT payment_id,
           sum(amount) FILTER (WHERE kind = 'COMMISSION' AND status <> 'CANCELLED') AS brut,
           sum(amount) FILTER (WHERE status <> 'CANCELLED') AS effectif
      FROM public.referral_commissions GROUP BY payment_id
),
r1 AS (
    SELECT 'r'::text AS regle, cm.payment_id::text AS objet,
           format('commissions %s > revenu net %s', cm.brut, p.net_event_village_revenue) AS detail
      FROM cm LEFT JOIN public.payments p ON p.id = cm.payment_id
     WHERE cm.brut > 0 AND (p.id IS NULL OR p.net_event_village_revenue IS NULL
                            OR cm.brut > p.net_event_village_revenue)
),
r2 AS (
    SELECT 'r', cm.payment_id::text,
           format('commissions restantes %s > net effectif %s', cm.effectif, p.net_event_village_revenue - p.refunded_net_revenue)
      FROM cm JOIN public.payments p ON p.id = cm.payment_id
     WHERE cm.effectif > GREATEST(p.net_event_village_revenue - p.refunded_net_revenue, 0)
),
paniers AS (
    SELECT payment_id, array_agg(category_id::text || ':' || quantity ORDER BY category_id::text) AS panier
      FROM public.stock_reservations GROUP BY payment_id
),
gardes AS (
    SELECT p.id, p.client_id, p.event_id, p.created_at, p.paid_at, c.panier
      FROM public.payments p JOIN paniers c ON c.payment_id = p.id
     WHERE p.payment_target = 'TICKET' AND p.is_platform_payment AND p.status IN ('SUCCESS', 'PARTIAL')
),
s1 AS (
    SELECT 's', a.id::text || '/' || b.id::text, 'deux paiements conservés pour le même panier'
      FROM gardes a JOIN gardes b
        ON a.id < b.id AND a.client_id = b.client_id AND a.event_id = b.event_id AND a.panier = b.panier
     WHERE a.created_at < b.paid_at AND b.created_at < a.paid_at
),
doubles AS (SELECT * FROM public.payments WHERE metadata ? 'duplicate_of'),
s2 AS (
    SELECT 's', d.id::text, 'paiement en double au statut ' || d.status FROM doubles d
     WHERE d.status NOT IN ('REFUND_PENDING', 'REFUNDED')
    UNION ALL SELECT 's', d.id::text, 'paiement en double avec billets' FROM doubles d
     WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = d.id)
    UNION ALL SELECT 's', d.id::text, 'paiement en double sans remboursement du total' FROM doubles d
     WHERE NOT EXISTS (SELECT 1 FROM public.refunds r JOIN public.cashouts c ON c.refund_id = r.id
                        WHERE r.payment_id = d.id AND r.settlement = 'PLATEFORME'
                          -- Lot 9 quater (C1 : AUD-20, décision du prompt) : au-delà de 2 doublons du compte sur 30 jours,
                          -- remboursement du total moins la retenue enregistrée, jamais plus que les frais de l'opérateur.
                          AND r.amount = d.amount - COALESCE((d.metadata->>'duplicate_fee_withheld')::numeric, 0)
                          AND COALESCE((d.metadata->>'duplicate_fee_withheld')::numeric, 0)
                              BETWEEN 0 AND COALESCE(d.aggregator_fee, 0))
    UNION ALL SELECT 's', d.id::text, 'paiement en double crédité' FROM doubles d
     WHERE EXISTS (SELECT 1 FROM public.finance_ledger l WHERE l.source_key = 'VENTE-' || d.id::text)
        OR EXISTS (SELECT 1 FROM public.referral_commissions c WHERE c.payment_id = d.id AND c.status <> 'CANCELLED')
),
t AS (SELECT * FROM public.tickets),
t0 AS (
    SELECT 't'::text, t.id::text, 'billet sans décision de vente' FROM t WHERE t.sale_decision->>'source' = 'SANS_DECISION'
),
t1 AS (
    SELECT 't', t.id::text, 'billet ' || t.sale_channel || ' d''une catégorie non vendue en ligne au moment de l''achat'
      FROM t WHERE t.sale_channel IN ('ONLINE', 'FREE') AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_online')::boolean, FALSE) IS NOT TRUE
),
t2 AS (
    SELECT 't', t.id::text, 'billet COUNTER d''une catégorie non vendue au guichet au moment de la vente'
      FROM t WHERE t.sale_channel = 'COUNTER' AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_counter')::boolean, FALSE) IS NOT TRUE
),
t3 AS (
    SELECT 't', c.id::text, 'is_visible et sale_online divergent'
      FROM public.ticket_categories c WHERE c.is_visible IS DISTINCT FROM c.sale_online
),
t4 AS (
    SELECT 't', t.id::text, 'billet payé en ligne dont la décision ne vient pas de sa réservation'
      FROM t JOIN public.stock_reservations r ON r.payment_id = t.payment_id AND r.category_id = t.category_id
     WHERE t.sale_channel = 'ONLINE' AND t.sale_decision->>'source' <> 'REPRISE'
       AND (t.sale_decision->>'sale_online')::boolean IS DISTINCT FROM r.sale_online_at_checkout
)
SELECT * FROM r1 UNION ALL SELECT * FROM r2 UNION ALL SELECT * FROM s1 UNION ALL SELECT * FROM s2
UNION ALL SELECT * FROM t0 UNION ALL SELECT * FROM t1 UNION ALL SELECT * FROM t2 UNION ALL SELECT * FROM t3
UNION ALL SELECT * FROM t4 ORDER BY 1, 2`;

/** Ligne de violation renvoyée par RECETTE_INVARIANT_SQL. */
export interface RecetteViolation { regle: string; objet: string; detail: string }

/** Colonnes du lot lues par la requête, par table (contrat 2.4, 2.7, 14.1). */
const REQUIRED_COLUMNS: ReadonlyArray<[string, readonly string[], string]> = [
    ['ticket_categories', ['sale_online', 'sale_counter'], 'canaux de vente (contrat 2.4, migration 20261106000001)'],
    ['tickets', ['sale_decision'], 'instantané de la décision de vente (contrat 2.4, migration 20261106000001)'],
    ['stock_reservations', ['sale_online_at_checkout'], 'instantané au checkout (contrat 2.4, migration 20261106000001)'],
    ['referral_commissions', ['uncapped_amount'], 'trace du plafond des commissions (contrat 2.7, migration 20261106000004)'],
];

/** Triggers qui posent l'instantané (contrat 2.4) : sans eux, (t) ne dit pas la vérité. */
const REQUIRED_TRIGGERS: ReadonlyArray<[string, string]> = [
    ['trg_tickets_sale_decision', 'tickets'],
    ['trg_stock_reservations_sale_online', 'stock_reservations'],
];

/** Fonctions du lot sans lesquelles (s) n'a aucun sens (contrat 6.1, migration 20261106000003). */
const REQUIRED_FUNCTIONS = ['payment_duplicate_of'] as const;

/**
 * Objets du lot 8 absents de la base locale, décrits en clair (liste vide : schéma complet pour (r)(s)(t)).
 * Avec `db` : sur ce client (dans sa transaction) ; sans `db` : transaction READ ONLY sur une connexion neuve.
 */
export async function missingRecetteSchema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];
        for (const [table, wanted, what] of REQUIRED_COLUMNS) {
            const r = await client.query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
            const present = new Set(r.rows.map((row) => row.column_name));
            if (present.size === 0) {
                missing.push(`table public.${table} absente — ${what}`);
                continue;
            }
            for (const c of wanted) if (!present.has(c)) missing.push(`colonne public.${table}.${c} absente — ${what}`);
        }
        const t = await client.query<{ tgname: string; relname: string }>(
            `SELECT tg.tgname, c.relname FROM pg_trigger tg
               JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND NOT tg.tgisinternal AND tg.tgname = ANY($1::text[])`,
            [REQUIRED_TRIGGERS.map(([name]) => name)]);
        const triggers = new Set(t.rows.map((row) => `${row.relname}.${row.tgname}`));
        for (const [name, table] of REQUIRED_TRIGGERS) {
            if (!triggers.has(`${table}.${name}`)) missing.push(`trigger ${name} absent de public.${table} — instantané de la vente (contrat 2.4, migration 20261106000001)`);
        }
        const f = await client.query<{ proname: string }>(
            `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [REQUIRED_FUNCTIONS]);
        const functions = new Set(f.rows.map((row) => row.proname));
        for (const name of REQUIRED_FUNCTIONS) {
            if (!functions.has(name)) missing.push(`fonction public.${name} absente — paiement en double (contrat 6.1, migration 20261106000003)`);
        }
        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 8 n'est pas en place. */
export async function assertRecetteSchema(label: string, db?: Client): Promise<void> {
    const missing = await missingRecetteSchema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-RECETTE] ${label} — schéma du lot 8 incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-RECETTE]   ${m}`);
    }
    assert.deepEqual(missing, [], `schéma du lot 8 incomplet (${label}) : invariants (r)(s)(t) impossibles à vérifier :\n${missing.join('\n')}`);
}

/**
 * Violations de (r)(s)(t) sur toute la base. Avec `db` : la requête s'exécute sur ce client, dans sa
 * transaction (garde-fous de recette-invariant.test.ts et canaux-invariant.test.ts, violation fabriquée dans
 * inRolledBackTransaction) ; sans `db` : transaction READ ONLY sur une connexion neuve. Le schéma est
 * contrôlé d'abord (échec explicite s'il manque).
 */
export async function recetteViolations(db?: Client): Promise<RecetteViolation[]> {
    await assertRecetteSchema('recetteViolations', db);
    if (db) return (await db.query<RecetteViolation>(RECETTE_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<RecetteViolation>(RECETTE_INVARIANT_SQL)).rows);
}

/**
 * À appeler dans after() de chaque suite nouvelle du lot 8 qui écrit, à la fin de tests/seed/seed-demo.ts
 * (fix(8.0-seed)) et par scripts/e2e/invariants-run.ts : (a) à (q) par assertTerrainInvariants (envoyeur
 * compris), schéma du lot 8, puis (r)(s)(t).
 */
export async function assertRecetteInvariants(label: string): Promise<void> {
    await assertTerrainInvariants(label);
    await assertRecetteSchema(label);
    const rows = await recetteViolations();
    console.log(`[INVARIANT-RECETTE] ${label} — (r)(s)(t) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-RECETTE]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (r)(s)(t) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
