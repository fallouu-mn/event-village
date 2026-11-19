/**
 * Lot 10b (point 3) : textes des trois règles d'annulation pour les pages serveur de la salle (création, modification,
 * fiche). Lecture par policyTexts (lib/halls/policies.server.ts) ; en cas d'échec, null : le formulaire montre alors
 * les noms des règles et invite à recharger, sans bloquer la page. À n'importer que depuis une page serveur.
 */
import { policyTexts } from '@/lib/halls/policies.server';
import type { PolicyKey } from './hall-api';

export async function readPolicyTexts(): Promise<Record<PolicyKey, string> | null> {
    try {
        return await policyTexts();
    } catch (err) {
        console.error('[salles] textes des règles d’annulation illisibles :', err instanceof Error ? err.message : String(err));
        return null;
    }
}
