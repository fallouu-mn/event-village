/**
 * Finition 3d (point 1) — âge de la dernière saisie de la personne, joint à chaque appel /api/ par la fenêtre de sécurité
 * de l'administration (components/admin/AdminStepUpGate.tsx), lu par le serveur (lib/admin/step-up.ts).
 *
 * Un appel fait sans aucune saisie depuis plus de AUTOMATIC_INPUT_AGE_SECS secondes est une relecture automatique (« À
 * faire aujourd'hui » toutes les 60 s, équipe relue en fond…) : il est servi, mais il ne compte pas comme une activité.
 * Une page laissée ouverte ne garde donc plus la session d'administration éveillée : après 30 minutes sans saisie, le
 * serveur redemande le mot de passe. Sans l'en-tête (client par jeton, autre écran), l'appel compte comme avant.
 * Module sans dépendance serveur : importable par un composant client.
 */
export const INPUT_AGE_HEADER = 'x-ev-input-age';
export const AUTOMATIC_INPUT_AGE_SECS = 60;

/** Vrai si la valeur de l'en-tête dit « aucune saisie depuis plus d'une minute ». Valeur absente ou illisible : faux. */
export function isAutomaticInputAge(value: string | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    const trimmed = value.trim();
    if (!/^\d{1,9}$/.test(trimmed)) return false;
    return Number(trimmed) > AUTOMATIC_INPUT_AGE_SECS;
}
