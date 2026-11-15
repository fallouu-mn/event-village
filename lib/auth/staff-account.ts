/**
 * cvf1 (migration 20261115000013) : un compte d'administration (ADMIN, SUPERADMIN) ne reçoit jamais d'affectation de
 * contrôleur. La garde de la table event_controllers (trigger trg_event_controllers_staff_guard) refuse toute nouvelle
 * affectation d'un tel compte, quel que soit le chemin, avec le SQLSTATE CT409 et le texte neutre de la route. Les routes
 * qui écrivent une affectation traduisent ce refus en leur refus NOT_INVITABLE au lieu d'une erreur 500. Module serveur.
 */
export const NOT_INVITABLE_SQLSTATE = 'CT409';

/** Erreur PostgREST (écriture directe ou fonction) levée par la garde de la table event_controllers. */
export function isNotInvitableDbError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === NOT_INVITABLE_SQLSTATE;
}

/**
 * Migration 20261115000014 : confirmation avant de promouvoir en administrateur un compte qui contrôle les entrées
 * d'organisatrices (décision de l'utilisateur ; accord au singulier).
 */
export function staffPromotionConfirmText(organizers: number): string {
    return organizers === 1
        ? 'Cette personne contrôle les entrées pour 1 organisateur. En devenant administrateur, elle sera retirée de son équipe.'
        : `Cette personne contrôle les entrées pour ${organizers} organisateurs. En devenant administrateur, elle sera retirée de leurs équipes.`;
}
