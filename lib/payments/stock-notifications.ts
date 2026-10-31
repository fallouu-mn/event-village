/**
 * Notifications d'épuisement après émission de billets (catégorie épuisée, événement complet).
 * Reprise du comportement de l'ancienne émission applicative (EventService.reserveTicketsAtomic,
 * supprimée au lot 2) : appelée après la confirmation d'un paiement et après l'émission de billets
 * gratuits. NotificationService garantit un seul envoi par catégorie et par événement.
 */
import { NotificationService } from '@/lib/notifications/notification.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export async function notifyStockMilestones(categoryIds: string[]): Promise<void> {
    if (!categoryIds.length) return;
    const supabase = getServiceRoleClient();
    const { data: cats, error } = await supabase
        .from('ticket_categories')
        .select('id, name, event_id, total_quantity, sold_quantity')
        .in('id', Array.from(new Set(categoryIds)));
    if (error) {
        console.error('[stock] lecture des catégories pour les notifications d’épuisement impossible :', error.message);
        return;
    }
    const soldOutEvents = new Set<string>();
    for (const c of cats ?? []) {
        if (Number(c.sold_quantity) < Number(c.total_quantity)) continue;
        soldOutEvents.add(c.event_id);
        try {
            await NotificationService.sendTicketCategorySoldOutNotification({
                eventId: c.event_id, categoryId: c.id, categoryName: c.name, totalQuantity: Number(c.total_quantity),
            });
        } catch (err) {
            console.error(`[stock] notification « catégorie épuisée » (${c.id}) en échec :`, err instanceof Error ? err.message : String(err));
        }
    }
    for (const eventId of Array.from(soldOutEvents)) {
        const { data: all, error: allErr } = await supabase
            .from('ticket_categories')
            .select('total_quantity, sold_quantity, is_active, events(title)')
            .eq('event_id', eventId);
        if (allErr || !all?.length) {
            if (allErr) console.error(`[stock] lecture des catégories de l'événement ${eventId} impossible :`, allErr.message);
            continue;
        }
        const full = all.every((c) => Number(c.sold_quantity) >= Number(c.total_quantity) || c.is_active === false);
        if (!full) continue;
        const ev = (all[0] as { events?: { title?: string } | Array<{ title?: string }> }).events;
        const title = (Array.isArray(ev) ? ev[0]?.title : ev?.title) ?? 'Événement';
        try {
            await NotificationService.sendEventFullySoldOutNotification({
                eventId, eventTitle: title, totalTicketsSold: all.reduce((s, c) => s + Number(c.sold_quantity), 0),
            });
        } catch (err) {
            console.error(`[stock] notification « événement complet » (${eventId}) en échec :`, err instanceof Error ? err.message : String(err));
        }
    }
}
