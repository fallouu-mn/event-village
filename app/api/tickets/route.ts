import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { eventEndAt } from '@/lib/events/event-end';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Lot 7 (7.1, contrat 3.2) : disponibilité hors ligne d'un billet, servie par ticket_offline_info. */
interface OfflineInfo {
    secret_version: number;
    available: boolean;
    available_from: string | null;
    available_until: string | null;
    reason: null | 'NOT_YET' | 'CLOSED' | 'TICKET_NOT_VALID' | 'EVENT_NOT_PUBLISHED' | 'TRANSFER_PENDING';
}

/** Lot 9 bis (R25, R66, contrat 4.1 et 5.24) : état de la carte d'un billet, servi par ticket_card_states. */
interface CardState {
    ticket_id: string;
    event_status: string;
    event_status_label: string;
    price: number | string | null;
    service_fee: number | string | null;
    sale_channel: string | null;
    code_visible: boolean;
    transfer_allowed: boolean;
    notice: string | null;
}

/**
 * GET /api/tickets
 * Récupère tous les billets réels de l'utilisateur connecté avec QR code et informations d'événement.
 * L'utilisateur est celui de la session (lot 1B.6) : le paramètre historique `userId` n'est
 * accepté que s'il désigne ce même compte.
 */
export async function GET(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const effectiveUserId = activeSession.user.id;

        const queryUserId = new URL(req.url).searchParams.get('userId');
        if (queryUserId && queryUserId !== effectiveUserId) {
            console.warn(`[API /api/tickets] userId ${queryUserId} demandé par le compte ${effectiveUserId} : refusé`);
            return NextResponse.json({ error: 'Vous ne pouvez consulter que vos propres billets.', code: 'FORBIDDEN_OTHER_USER' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        // Lot 9 bis (R44, B56) : un transfert échu que le cron horaire n'a pas encore traité est expiré à la lecture
        // (EXPIRED, verrou levé, avis TRANSFER_EXPIRED à la même clé que le cron), avant de lire les billets.
        const { data: lockedRows, error: lockedErr } = await supabase
            .from('tickets')
            .select('id')
            .eq('user_id', effectiveUserId)
            .eq('transfer_locked', true);
        if (lockedErr) throw new Error(`billets en cours de transfert : ${lockedErr.message}`);
        if ((lockedRows ?? []).length > 0) {
            const { data: expired, error: expireErr } = await supabase.rpc('ticket_transfers_expire', {
                p: { ticket_ids: (lockedRows ?? []).map((r: { id: string }) => r.id) },
            });
            if (expireErr) throw new Error(`ticket_transfers_expire : ${expireErr.code ?? ''} ${expireErr.message}`);
            if ((expired as { ok?: unknown } | null)?.ok !== true) throw new Error(`ticket_transfers_expire : réponse inattendue ${JSON.stringify(expired)}`);
        }

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                price,
                status,
                checked_in_at,
                transfer_locked,
                created_at,
                event_id,
                events(id, title, location, city, start_date, start_time, end_date, end_time, image_url, partners(company_name, commercial_name)),
                category_id,
                ticket_categories(id, name, price)
            `)
            .eq('user_id', effectiveUserId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[API /api/tickets] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger vos billets.' }, { status: 500 });
        }

        // Récupérer les transferts actifs en attente pour ces billets
        const ticketIds = (tickets || []).map((t: any) => t.id);
        const pendingTransfersMap: Record<string, { id: string; recipient: string; expires_at: string }> = {};

        if (ticketIds.length > 0) {
            const nowIso = new Date().toISOString();
            const { data: pendingTransfers, error: transfersErr } = await supabase
                .from('ticket_transfers')
                .select('id, ticket_id, to_phone_or_email, expires_at, status')
                .in('ticket_id', ticketIds)
                .eq('status', 'PENDING')
                .gt('expires_at', nowIso);
            // Lot 5 (C1) : une panne ne fait plus passer un billet engagé pour un billet libre
            if (transfersErr) {
                console.error('[API /api/tickets] lecture des transferts en attente :', transfersErr.message);
                return NextResponse.json({ error: 'Impossible de charger vos billets.' }, { status: 500 });
            }

            (pendingTransfers || []).forEach((tr: any) => {
                const target = tr.to_phone_or_email || '';
                let masked = '***';
                if (target.includes('@')) {
                    const [local, domain] = target.split('@');
                    const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local.charAt(0)}***`;
                    masked = `${maskedLocal}@${domain || '***'}`;
                } else if (target.length >= 8) {
                    masked = `${target.slice(0, 4)}***${target.slice(-2)}`;
                }
                pendingTransfersMap[tr.ticket_id] = {
                    id: tr.id,
                    recipient: masked,
                    expires_at: tr.expires_at,
                };
            });
        }

        // Lot 7 (7.1, contrat 3.2) : disponibilité hors ligne calculée par le serveur (ticket_offline_info,
        // même fenêtre et même ordre de contrôle que le téléchargement) ; le navigateur ne calcule rien.
        const offlineMap = new Map<string, OfflineInfo>();
        if (ticketIds.length > 0) {
            const { data: info, error: infoErr } = await supabase.rpc('ticket_offline_info', { p: { user_id: effectiveUserId } });
            const infoBody = (info ?? null) as { ok?: unknown; tickets?: unknown } | null;
            if (infoErr || infoBody?.ok !== true || !Array.isArray(infoBody.tickets)) {
                console.error('[API /api/tickets] disponibilité hors ligne illisible :', infoErr ? `${infoErr.code ?? ''} ${infoErr.message}` : JSON.stringify(info).slice(0, 200));
                return NextResponse.json({ error: 'Impossible de charger vos billets.' }, { status: 500 });
            }
            for (const row of infoBody.tickets as Array<Record<string, unknown>>) {
                offlineMap.set(String(row.ticket_id), {
                    secret_version: Number(row.secret_version),
                    available: row.available === true,
                    available_from: typeof row.available_from === 'string' ? new Date(row.available_from).toISOString() : null,
                    available_until: typeof row.available_until === 'string' ? new Date(row.available_until).toISOString() : null,
                    reason: typeof row.reason === 'string' ? row.reason as OfflineInfo['reason'] : null,
                });
            }
        }

        // Lot 9 bis (R25, R66, B58) : ce que la carte peut montrer, décidé par le serveur (ticket_card_states) :
        // état de l'événement, prix, frais, canal, QR (scan accepté) et « Transférer » (transfert accepté).
        const cardMap = new Map<string, CardState>();
        if (ticketIds.length > 0) {
            const { data: cards, error: cardsErr } = await supabase.rpc('ticket_card_states', { p: { user_id: effectiveUserId } });
            const cardsBody = (cards ?? null) as { ok?: unknown; tickets?: unknown } | null;
            if (cardsErr) throw new Error(`ticket_card_states : ${cardsErr.code ?? ''} ${cardsErr.message}`);
            if (cardsBody?.ok !== true || !Array.isArray(cardsBody.tickets)) throw new Error(`ticket_card_states : réponse inattendue ${JSON.stringify(cards).slice(0, 200)}`);
            for (const row of cardsBody.tickets as CardState[]) cardMap.set(String(row.ticket_id), row);
        }

        const formatted = (tickets || []).map((t: any) => {
            const cardState = cardMap.get(t.id);
            if (!cardState) throw new Error(`ticket_card_states : billet ${t.id} absent de la réponse`);
            const startDate = t.events?.start_date ? new Date(t.events.start_date) : new Date();
            const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
            const monthShort = months[startDate.getMonth()] || 'SEP';
            const dayNumber = String(startDate.getDate()).padStart(2, '0');
            const timeFormatted = t.events?.start_time ? t.events.start_time.substring(0, 5) : '20:00';
            const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;
            // Lot 5 : à venir tant que l'événement n'est pas fini (fin, ou début + 6 h, lot 9 bis : event_end_at) ; un
            // billet pour ce soir n'est plus classé dans l'historique dès minuit UTC du jour.
            const isUpcoming = t.status === 'VALIDE' && Boolean(t.events?.start_date) && eventEndAt(t.events).getTime() >= Date.now();
            const activeTransfer = pendingTransfersMap[t.id] || null;
            const isTransferLocked = Boolean(t.transfer_locked) || Boolean(activeTransfer);

            return {
                id: t.id,
                eventId: t.event_id,
                ticketNumber: t.ticket_number,
                eventTitle: t.events?.title || 'Événement',
                eventSubtitle: t.events?.partners?.commercial_name || t.events?.partners?.company_name || 'Organisateur',
                eventImageUrl: t.events?.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                dateFormatted,
                timeFormatted,
                rawStartDate: t.events?.start_date || null,
                venue: t.events?.location || 'Dakar, Sénégal',
                seat: t.ticket_categories?.name || 'Pass Standard',
                status: t.status,
                usedAt: t.checked_in_at,
                isUpcoming,
                isTransferLocked,
                activeTransfer,
                offline: offlineMap.get(t.id) ?? null,
                price: Number(cardState.price ?? 0),
                serviceFee: Number(cardState.service_fee ?? 0),
                saleChannel: cardState.sale_channel ?? null,
                eventStatus: cardState.event_status,
                eventStatusLabel: cardState.event_status_label,
                codeVisible: cardState.code_visible === true,
                transferAllowed: cardState.transfer_allowed === true,
                eventNotice: cardState.notice ?? null,
            };
        });

        return NextResponse.json({ tickets: formatted });
    } catch (err: unknown) {
        return apiFailure('GET /api/tickets', err, { message: 'Impossible de charger vos billets.', code: 'TICKETS_UNAVAILABLE' });
    }
}
