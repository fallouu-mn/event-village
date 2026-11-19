/**
 * Lot 10b (point 3) : textes des trois règles d'annulation pour les pages serveur de la salle (création, modification,
 * fiche). Lecture par policyTexts (lib/halls/policies.server.ts) ; en cas d'échec, null : le formulaire montre alors
 * les noms des règles et invite à recharger, sans bloquer la page. À n'importer que depuis une page serveur.
 * Lot 10b (correctifs, vraies valeurs) : réglages réels des salles (hallDefaults : acompte par défaut, durée de garde,
 * échéance du solde) ; une valeur illisible devient null et l'écran retombe sur une phrase sans chiffre.
 */
import { hallDefaults, policyTexts } from '@/lib/halls/policies.server';
import type { HallDefaults, PolicyKey } from './hall-api';

export async function readPolicyTexts(): Promise<Record<PolicyKey, string> | null> {
    try {
        return await policyTexts();
    } catch (err) {
        console.error('[salles] textes des règles d’annulation illisibles :', err instanceof Error ? err.message : String(err));
        return null;
    }
}

/** Nombre fini et positif, sinon null (réglage absent ou illisible). */
function positiveOrNull(n: number): number | null {
    return Number.isFinite(n) && n > 0 ? n : null;
}

export async function readHallDefaults(): Promise<HallDefaults> {
    try {
        const d = await hallDefaults();
        return {
            depositDefaultPercent: positiveOrNull(d.depositDefaultPercent),
            holdMinutes: positiveOrNull(d.holdMinutes),
            balanceDueDays: positiveOrNull(d.balanceDueDays),
        };
    } catch (err) {
        console.error('[salles] réglages des salles illisibles :', err instanceof Error ? err.message : String(err));
        return { depositDefaultPercent: null, holdMinutes: null, balanceDueDays: null };
    }
}
