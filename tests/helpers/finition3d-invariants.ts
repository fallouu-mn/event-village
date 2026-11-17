/**
 * Finition 3d (recours et suppléance de l'administration) — invariants de la finition, vérifiés à la fin de chaque suite
 * nouvelle de la finition, par une requête SQL sur TOUTE la base LOCALE (lecture seule), après les invariants des
 * livraisons précédentes (assertFinition3bInvariants, qui enchaîne 3a, finition 1, lots 9…).
 * Les règles propres à la 3d s'ajoutent ici avec les tables qui les portent ; une table absente (preuve des rouges, avant
 * la migration) ne donne aucune violation de la règle qui la lit.
 * Sortie brute `[INVARIANT-FINITION3D]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinition3bInvariants } from './finition3b-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Finition3dViolation = RecetteViolation;

/** Règles de la 3d : chacune rend ses violations ; une table absente n'en rend aucune. */
export async function finition3dViolations(): Promise<Finition3dViolation[]> {
    return inspect(async () => [] as Finition3dViolation[]);
}

export async function assertFinition3dInvariants(label: string): Promise<void> {
    await assertFinition3bInvariants(label);
    const violations = await finition3dViolations();
    console.log(`[INVARIANT-FINITION3D] ${label} : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-FINITION3D] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-FINITION3D] ${label} : violations`);
}
