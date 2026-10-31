import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { parseDynamicQrPayload, verifyTotp, deriveTicketTotpSecret, TOTP_STEP_SECONDS } from '@/lib/security/totp';
import { NotificationService } from '@/lib/notifications/notification.service';
import { requireActiveSession, serverHasAnyRole, serverIsAdmin, type ServerUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type ServiceClient = ReturnType<typeof getServiceRoleClient>;

/**
 * Lot 1B.6 — périmètre de scan : un ADMIN partout, un PARTENAIRE sur ses propres événements,
 * un CONTROLEUR sur les événements auxquels il est affecté. Lève une erreur si la vérification
 * elle-même échoue (aucun accès accordé par défaut).
 */
async function canScanEvent(supabase: ServiceClient, user: ServerUser, eventId: string): Promise<boolean> {
    if (serverIsAdmin(user)) return true;
    if (user.roles.includes('PARTENAIRE')) {
        const { data: owned, error } = await supabase
            .from('events')
            .select('id, partners!inner(user_id)')
            .eq('id', eventId)
            .eq('partners.user_id', user.id)
            .maybeSingle();
        if (error) throw new Error(`vérification du propriétaire de l'événement : ${error.message}`);
        if (owned) return true;
    }
    if (user.roles.includes('CONTROLEUR')) {
        const { data: assigned, error } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) throw new Error(`vérification de l'affectation du contrôleur : ${error.message}`);
        if (assigned) return true;
    }
    return false;
}

/**
 * POST /api/tickets/verify
 * Vérification en direct d'un QR code de billet par un Contrôleur ou Partenaire
 * Supporte le QR code dynamique anti-fraude (TOTP RFC 6238) et la saisie manuelle.
 */
export async function POST(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!serverHasAnyRole(user, ['CONTROLEUR', 'PARTENAIRE', 'ADMIN', 'SUPERADMIN'])) {
            return NextResponse.json({ error: 'Vérification réservée aux contrôleurs, partenaires et administrateurs.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
        }

        let body: { qrCode?: string; ticketNumber?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawCode = body.qrCode?.trim() || body.ticketNumber?.trim();
        if (!rawCode) {
            return NextResponse.json({ error: 'Code de billet ou QR code requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 0. Décodage du QR Code dynamique (TOTP RFC 6238) ou saisie directe
        const parsed = parseDynamicQrPayload(rawCode);
        const lookupCode = parsed.identifier;

        // 1. Recherche du billet dans public.tickets avec jointures
        const ticketSelect = `
            id,
            ticket_number,
            qr_code,
            status,
            price,
            checked_in_at,
            created_at,
            event_id,
            user_id,
            users:users!tickets_user_id_fkey (id, first_name, last_name, email),
            events (id, title, start_date, location),
            ticket_categories (id, name, price)
        `;

        let ticket: any = null;
        let ticketErr: any = null;

        const { data: t1, error: e1 } = await supabase
            .from('tickets')
            .select(ticketSelect)
            .eq('ticket_number', lookupCode)
            .maybeSingle();

        if (t1) {
            ticket = t1;
            ticketErr = e1;
        } else {
            const { data: t2, error: e2 } = await supabase
                .from('tickets')
                .select(ticketSelect)
                .eq('qr_code', lookupCode)
                .maybeSingle();
            ticket = t2;
            ticketErr = e2;
        }

        if (ticketErr || !ticket) {
            return NextResponse.json({
                status: 'invalid',
                message: 'Billet inexistant ou QR Code non reconnu.',
            });
        }

        if (!(await canScanEvent(supabase, user, ticket.event_id))) {
            console.warn(`[tickets/verify] compte ${user.id} hors périmètre de l'événement ${ticket.event_id}`);
            return NextResponse.json({ error: 'Ce billet ne relève pas de vos événements.', code: 'FORBIDDEN_EVENT' }, { status: 403 });
        }

        const eventData = ticket.events as any;
        const categoryData = ticket.ticket_categories as any;
        const holderData = ticket.users as any;
        const holderName = holderData
            ? [holderData.first_name, holderData.last_name].filter(Boolean).join(' ') || holderData.email
            : 'Porteur Validé';

        // 1.1 Validation anti-fraude TOTP (rotation temporelle 20s)
        if (parsed.isDynamic) {
            if (!parsed.token) {
                return NextResponse.json({
                    status: 'invalid',
                    message: 'Format de QR code dynamique invalide (token manquant).',
                }, { status: 400 });
            }

            const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);
            const isTotpValid = verifyTotp(parsed.token, secret, {
                toleranceWindows: 1, // ±1 fenêtre (±20s)
                stepSeconds: TOTP_STEP_SECONDS,
            });

            if (!isTotpValid) {
                return NextResponse.json({
                    code: 'QR_EXPIRED',
                    status: 'qr_expired',
                    message: 'QR Code expiré. Demandez au client de rafraîchir son billet.',
                    ticketInfo: {
                        ticketNumber: ticket.ticket_number,
                        eventTitle: eventData?.title || 'Événement Event Village',
                        holderName: holderName,
                        category: categoryData?.name || 'Pass Standard',
                    },
                }, { status: 400 });
            }
        }

        // 2. Si le billet a déjà été validé / composté
        if (ticket.status === 'UTILISE') {
            const checkedTime = ticket.checked_in_at
                ? new Date(ticket.checked_in_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : 'Aujourd\'hui';

            return NextResponse.json({
                status: 'already_used',
                message: 'Billet déjà validé et utilisé précédemment.',
                ticketInfo: {
                    ticketNumber: ticket.ticket_number,
                    eventTitle: eventData?.title || 'Événement Event Village',
                    holderName: holderName,
                    category: categoryData?.name || 'Pass Standard',
                    checkedInAt: `Validé à ${checkedTime}`,
                },
            });
        }

        // 3. Si le billet a été annulé ou remboursé
        if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE') {
            return NextResponse.json({
                status: 'invalid',
                message: 'Ce billet a été annulé ou remboursé.',
            });
        }

        // 4. Validation réussie du billet (Compostage)
        const now = new Date().toISOString();
        await supabase
            .from('tickets')
            .update({
                status: 'UTILISE',
                checked_in_at: now,
                checked_in_by: user.id,
            })
            .eq('id', ticket.id);

        // 5. Journal d'audit du scan (auteur : le compte qui scanne)
        await AdminService.logAudit({
            userId: user.id,
            userRole: user.role,
            action: 'TICKET_SCAN',
            objectType: 'tickets',
            objectId: ticket.id,
            newValue: { status: 'UTILISE', scanned_at: now },
            metadata: { ticket_number: ticket.ticket_number, event_id: ticket.event_id },
        });

        // 5.5 Notification Client / Porteur (In-App + SMS + Email)
        NotificationService.sendTicketScannedSuccessNotification({
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            eventTitle: eventData?.title,
            categoryName: categoryData?.name || 'Pass Standard',
            userId: ticket.user_id,
            checkedInAt: now,
            venue: eventData?.location,
        }).catch((notifErr) => {
            console.warn('[tickets/verify] Erreur notification scan client:', notifErr);
        });

        // 6. Calcul des statistiques du jour pour cet événement
        const { data: todayScans } = await supabase
            .from('tickets')
            .select('id')
            .eq('event_id', ticket.event_id)
            .eq('status', 'UTILISE');

        const { data: totalTickets } = await supabase
            .from('tickets')
            .select('id')
            .eq('event_id', ticket.event_id)
            .neq('status', 'ANNULE');

        const checkedInCount = todayScans?.length || 1;
        const totalExpected = totalTickets?.length || 1;

        return NextResponse.json({
            status: 'valid',
            message: 'Accès autorisé ! Billet validé avec succès.',
            ticketInfo: {
                ticketNumber: ticket.ticket_number,
                eventTitle: eventData?.title || 'Événement Event Village',
                holderName: holderName,
                category: categoryData?.name || 'Pass Officiel',
                checkedInAt: 'À l’instant',
            },
            stats: {
                checkedInCount,
                totalExpected,
            },
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
