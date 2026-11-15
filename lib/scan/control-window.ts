/**
 * Finition 1 (complément 10) — message d'un contrôle fermé, le même partout (état du contrôle, scanner, recherche
 * d'invités, caisse) : « Cet événement est terminé : le contrôle est fermé. » ou « Le contrôle ouvre le … à … ». La
 * règle elle-même est celle de la base (scan_window, scan_event_problem) ; ce module ne décide rien, il met en mots.
 */
import { formatDate, formatTime } from '@/lib/format';

export const CONTROL_ENDED_MESSAGE = 'Cet événement est terminé : le contrôle est fermé.';

export function controlClosedMessage(problem: string | null | undefined, opensAt?: string | Date | null): string | null {
    if (!problem) return null;
    switch (problem) {
        case 'event_ended':
            return CONTROL_ENDED_MESSAGE;
        case 'event_cancelled':
            return 'Cet événement est annulé : le contrôle est fermé.';
        case 'event_suspended':
            return 'Cet événement est suspendu : le contrôle est fermé.';
        case 'event_not_open': {
            const at = opensAt ? new Date(opensAt) : null;
            if (at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now()) {
                return `Le contrôle ouvre le ${formatDate(at)} à ${formatTime(at)}.`;
            }
            return 'Le contrôle ouvrira quand l’événement sera publié.';
        }
        default:
            return 'Le contrôle n’est pas ouvert sur cet événement.';
    }
}
