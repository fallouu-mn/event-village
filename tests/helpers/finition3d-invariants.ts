/**
 * Finition 3d (recours et suppléance de l'administration) — invariants de la finition, vérifiés à la fin de chaque suite
 * nouvelle de la finition, par une requête SQL sur TOUTE la base LOCALE (lecture seule), après les invariants des
 * livraisons précédentes (assertFinition3bInvariants, qui enchaîne 3a, finition 1, lots 9…).
 *
 *  (i1) Espèces marquées rendues par un admin (marque dont l'auteur n'est pas la propriétaire de l'événement) : motif non
 *       vide, journal CASH_REFUND_MARKED « par un admin » (by_admin) et avis CASH_REFUND_MARKED_BY_ADMIN à l'organisatrice
 *       en file, tous trois présents.
 *
 * Les règles propres à la 3d s'ajoutent ici avec les tables qui les portent ; une table absente (preuve des rouges, avant
 * la migration) ne donne aucune violation de la règle qui la lit.
 * Sortie brute `[INVARIANT-FINITION3D]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinition3bInvariants } from './finition3b-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Finition3dViolation = RecetteViolation;

const I1_SQL = `
SELECT 'i1'::text AS regle, m.payment_id::text AS objet,
       concat_ws(' ; ',
           CASE WHEN NULLIF(btrim(COALESCE(m.note, '')), '') IS NULL THEN 'motif absent' END,
           CASE WHEN NOT EXISTS (SELECT 1 FROM public.audit_logs a
                                  WHERE a.action = 'CASH_REFUND_MARKED' AND a.object_id::text = m.payment_id::text
                                    AND (a.metadata->>'by_admin')::boolean IS TRUE) THEN 'journal « par un admin » absent' END,
           CASE WHEN NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                                  WHERE o.group_key = 'CASH_REFUND_MARKED_BY_ADMIN:' || m.payment_id::text) THEN 'avis à l''organisatrice absent' END
       ) AS detail
  FROM public.event_cash_refund_marks m
  JOIN public.events e ON e.id = m.event_id
  JOIN public.partners pa ON pa.id = e.partner_id
 WHERE m.marked_by IS DISTINCT FROM pa.user_id
   AND (NULLIF(btrim(COALESCE(m.note, '')), '') IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.audit_logs a
                        WHERE a.action = 'CASH_REFUND_MARKED' AND a.object_id::text = m.payment_id::text
                          AND (a.metadata->>'by_admin')::boolean IS TRUE)
        OR NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.group_key = 'CASH_REFUND_MARKED_BY_ADMIN:' || m.payment_id::text))
 ORDER BY 2`;

/** Règles de la 3d : chacune rend ses violations ; une table absente n'en rend aucune. */
export async function finition3dViolations(): Promise<Finition3dViolation[]> {
    return inspect(async (c) => {
        const out: Finition3dViolation[] = [];
        const { rows: i1 } = await c.query<Finition3dViolation>(I1_SQL);
        out.push(...i1);
        return out;
    });
}

export async function assertFinition3dInvariants(label: string): Promise<void> {
    await assertFinition3bInvariants(label);
    const violations = await finition3dViolations();
    console.log(`[INVARIANT-FINITION3D] ${label} — (i1) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-FINITION3D] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-FINITION3D] ${label} : violations`);
}
