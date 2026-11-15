/**
 * Finition 1 (équipe) — invariants du lot, vérifiés à la fin de chaque suite nouvelle de la finition et de
 * migration-finition1-rejouable, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Après les invariants des
 * lots précédents (assertLot9quinquiesInvariants), règles (f1) et suivantes :
 *  (f1) une invitation de contrôleur annulée (CANCELLED) porte sa date de réponse (responded_at) ;
 *  (f2) au plus une invitation de contrôleur en attente et non échue par organisateur et par compte ;
 *  (f3) une invitation effacée par l'organisateur (cleared_at) n'est jamais une invitation en attente non échue ;
 *  (f4) aucune politique de lecture de event_controllers ne repose sur le créateur de la ligne (created_by) : la
 *       lecture suit la propriété actuelle de l'événement et le statut du compte (S1).
 * Sortie brute `[INVARIANT-FINITION1]`. Échec explicite qui nomme chaque objet de la finition absent (jamais d'erreur
 * Postgres brute, jamais de faux vert).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLot9quinquiesInvariants } from './lot9quinquies-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Finition1Violation = RecetteViolation;

export const FINITION1_INVARIANT_SQL = `
SELECT * FROM (
    SELECT 'f1'::text AS regle, 'controller_invitations.' || ci.id::text AS objet,
           'invitation annulée sans date de réponse' AS detail
      FROM public.controller_invitations ci
     WHERE ci.status = 'CANCELLED' AND ci.responded_at IS NULL
    UNION ALL
    SELECT 'f2', 'controller_invitations.' || min(ci.id::text),
           count(*)::text || ' invitations en attente pour le même organisateur et le même compte'
      FROM public.controller_invitations ci
     WHERE ci.status = 'PENDING' AND ci.expires_at > now()
     GROUP BY ci.partner_id, ci.user_id HAVING count(*) > 1
    UNION ALL
    SELECT 'f3', 'controller_invitations.' || ci.id::text, 'invitation effacée encore en attente et non échue'
      FROM public.controller_invitations ci
     WHERE ci.cleared_at IS NOT NULL AND ci.status = 'PENDING' AND ci.expires_at > now()
    UNION ALL
    SELECT 'f4', 'pg_policies.' || p.policyname, 'lecture de event_controllers fondée sur created_by'
      FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'event_controllers'
       AND p.cmd IN ('SELECT', 'ALL') AND COALESCE(p.qual, '') ~ 'created_by'
) v
ORDER BY regle, objet`;

/** Objets de la finition absents (colonnes et fonctions) ; [] si tout est là. */
export async function missingFinition1Schema(db?: Client): Promise<string[]> {
    const run = async (c: Client): Promise<string[]> => {
        const { rows } = await c.query<{ objet: string }>(`
            SELECT x.objet FROM (VALUES
                ('controller_invitations.phone_entered'), ('controller_invitations.cleared_at'),
                ('controller_invitations.last_sent_at'), ('controller_invitations.send_count'),
                ('controller_invitations.cancelled_by')) AS x(objet)
             WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                                WHERE c.table_schema = 'public'
                                  AND c.table_name = split_part(x.objet, '.', 1)
                                  AND c.column_name = split_part(x.objet, '.', 2))
            UNION ALL
            SELECT f.objet FROM (VALUES
                ('partner_team_view'), ('controller_invitation_cancel'), ('controller_invitation_clear'),
                ('controller_invitation_resend'), ('controller_invitations_expire_due'),
                ('event_controller_settings_set')) AS f(objet)
             WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                WHERE n.nspname = 'public' AND p.proname = f.objet)`);
        return rows.map((r) => r.objet);
    };
    return db ? run(db) : inspect(run);
}

export async function finition1Violations(db?: Client): Promise<Finition1Violation[]> {
    const run = async (c: Client): Promise<Finition1Violation[]> => (await c.query<Finition1Violation>(FINITION1_INVARIANT_SQL)).rows;
    return db ? run(db) : inspect(run);
}

/** Invariants des lots précédents puis (f1) à (f4) ; échec explicite listant chaque violation. */
export async function assertFinition1Invariants(label: string): Promise<void> {
    await assertLot9quinquiesInvariants(label);
    const missing = await missingFinition1Schema();
    assert.deepEqual(missing, [], `objets de la finition 1 absents (migration 20261115000001 non appliquée ?) : ${missing.join(', ')}`);
    const violations = await finition1Violations();
    console.log(`[INVARIANT-FINITION1] ${label} — (f) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-FINITION1]   (${v.regle}) ${v.objet} : ${v.detail}`);
    assert.equal(violations.length, 0, `invariants (f) violés (${label}) :\n${violations.map((v) => `(${v.regle}) ${v.objet} : ${v.detail}`).join('\n')}`);
}
