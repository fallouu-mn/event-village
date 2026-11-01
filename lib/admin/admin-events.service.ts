/**
 * Lot 5 (5.7) — fiche complète d'un événement pour l'admin, avant validation : affiche, dates, lieu,
 * programme, infos pratiques, catégories et prix (masquées et inactives comprises), organisateur et
 * contact, historique des statuts (motifs de refus et de suspension compris), actions possibles
 * (event_actions, contrat D5) et annulation éventuelle. Lecture par le service_role, après le contrôle
 * verifyAdminAuth(events.read) de la route. Toute erreur de lecture remonte (500 explicite).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { PilotageError } from '@/lib/events/pilotage.service';

type Row = Record<string, unknown>;

function displayName(u: Row | undefined): string | null {
    if (!u) return null;
    const name = `${String(u.first_name ?? '')} ${String(u.last_name ?? '')}`.trim();
    return name || null;
}

function failed(what: string, message: string): Error {
    console.error(`[AdminEventsService] ${what} : ${message}`);
    return new Error('Lecture de la fiche de l’événement impossible pour le moment.');
}

export class AdminEventsService {
    static async getEventSheet(eventId: string, adminId: string): Promise<Row> {
        const supabase = getServiceRoleClient();

        const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
        if (evErr) throw failed(`événement ${eventId}`, evErr.message);
        if (!event) throw new PilotageError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');

        const [cats, partner, history, cancellation, actions] = await Promise.all([
            supabase.from('ticket_categories').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
            supabase.from('partners').select('id, user_id, company_name, commercial_name, phone, email, city, status').eq('id', event.partner_id).maybeSingle(),
            supabase.from('event_status_history').select('id, old_status, new_status, actor_id, actor_role, reason, channel, created_at')
                .eq('event_id', eventId).order('created_at', { ascending: true }).order('txid', { ascending: true }).order('id', { ascending: true }),
            supabase.from('event_cancellations').select('public_notice, internal_reason, cancelled_at, cancelled_by').eq('event_id', eventId).maybeSingle(),
            supabase.rpc('event_actions', { p: { event_id: eventId, actor_id: adminId } }),
        ]);
        if (cats.error) throw failed('catégories', cats.error.message);
        if (partner.error) throw failed('organisateur', partner.error.message);
        if (history.error) throw failed('historique des statuts', history.error.message);
        if (cancellation.error) throw failed('annulation', cancellation.error.message);
        if (actions.error) throw failed('event_actions', actions.error.message);
        const actionsBody = (actions.data ?? null) as Row | null;
        if (!actionsBody || actionsBody.ok !== true) {
            throw failed('event_actions', `refus inattendu ${JSON.stringify(actionsBody)}`);
        }

        const historyRows = (history.data ?? []) as Row[];
        const userIds = new Set<string>();
        for (const h of historyRows) if (typeof h.actor_id === 'string') userIds.add(h.actor_id);
        const partnerRow = (partner.data ?? null) as Row | null;
        if (partnerRow && typeof partnerRow.user_id === 'string') userIds.add(partnerRow.user_id);
        const users = new Map<string, Row>();
        if (userIds.size > 0) {
            const { data: rows, error } = await supabase.from('users').select('id, first_name, last_name, phone, email').in('id', Array.from(userIds));
            if (error) throw failed('comptes', error.message);
            for (const u of (rows ?? []) as Row[]) users.set(String(u.id), u);
        }

        const owner = partnerRow && typeof partnerRow.user_id === 'string' ? users.get(partnerRow.user_id) : undefined;
        return {
            event,
            categories: (cats.data ?? []) as Row[],
            organizer: partnerRow ? {
                id: partnerRow.id,
                company_name: partnerRow.company_name,
                commercial_name: partnerRow.commercial_name ?? null,
                phone: partnerRow.phone ?? null,
                email: partnerRow.email ?? null,
                city: partnerRow.city ?? null,
                status: partnerRow.status,
                contact_name: displayName(owner),
                contact_phone: owner?.phone ?? null,
                contact_email: owner?.email ?? null,
            } : null,
            history: historyRows.map((h) => ({
                ...h,
                actor_name: typeof h.actor_id === 'string' ? displayName(users.get(h.actor_id)) : null,
            })),
            actions: {
                status: actionsBody.status,
                actions: Array.isArray(actionsBody.actions) ? actionsBody.actions : [],
                can_edit: actionsBody.can_edit === true,
                can_cancel: actionsBody.can_cancel === true,
                last_reason: actionsBody.last_reason ?? null,
            },
            cancellation: cancellation.data ?? null,
        };
    }
}
