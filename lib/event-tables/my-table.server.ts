/**
 * Lot 11c-b — champs d'écran de « Ma table » ajoutés par le serveur à chaque table de event_table_mine :
 *  - `whatsapp_url` : lien de partage sans jeton (whatsappShareUrl, lot 11c-a) ;
 *  - `invite_left` : places que le titulaire peut encore envoyer à des invités = places « à envoyer » moins la sienne,
 *    même règle que le rappel en base (event_table_seats_reminders : seats_left = à envoyer − 1). L'écran l'affiche tel
 *    quel (« Envoyez vos 5 places ») : aucun nombre de places n'est calculé dans le navigateur.
 */
import { whatsappShareUrl } from './event-tables.server';

export function withScreenFields(appUrl: string, item: Record<string, unknown>): Record<string, unknown> {
    const counts = (item.counts ?? null) as { to_send?: unknown } | null;
    const toSend = Number(counts?.to_send ?? 0);
    return {
        ...item,
        whatsapp_url: whatsappShareUrl(appUrl, item),
        invite_left: Number.isFinite(toSend) ? Math.max(0, toSend - 1) : 0,
    };
}
