import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { formatDate, formatTime } from '@/lib/format';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { TicketPdfService } from '@/lib/tickets/ticket-pdf.service';

export const dynamic = 'force-dynamic';

const UNAVAILABLE_MESSAGE = 'Billet momentanément indisponible : réessayez dans un instant.';
const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)/;

/**
 * GET /api/tickets/[id]/pdf
 * Génère et télécharge le PDF officiel d'un billet valide.
 *
 * Règles de sécurité strictes :
 * 1. Authentification obligatoire (401 si anonyme).
 * 2. Vérification d'appartenance : seul le propriétaire actuel du billet (ou un ADMIN) peut télécharger (403 si tiers).
 * 3. Rejet si le billet est ANNULE, REMBOURSE, en cours de remboursement ou inexistant (404 / 400).
 * 4. Lot 4 : aucun QR code dans le document (ni qr_code statique, ni secret) ; numéro du billet et
 *    mention « Entrée sans téléphone : présentez une pièce d'identité au contrôle ».
 * 5. Lot 9 bis (R69, B67, contrat 4.3) : aucune valeur inventée. Chaque lecture contrôle son erreur ; l'événement
 *    ou la catégorie illisible ou absent → 503 TICKET_PDF_UNAVAILABLE (journalisé) ; organisateur absent → ligne
 *    omise ; nom du titulaire absent → son numéro seul ; date et heure de l'événement par lib/format (Dakar).
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;

    const resolvedParams = await Promise.resolve(context?.params);
    const ticketId = resolvedParams?.id;
    try {
        if (!ticketId) throw new PublicError('Identifiant de billet manquant.', 'TICKET_ID_REQUIRED', 400);

        const supabase = getServiceRoleClient();

        // 2. Récupération directe du billet
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select('id, ticket_number, status, price, service_fee, user_id, event_id, category_id, transfer_locked, security_version')
            .eq('id', ticketId)
            .maybeSingle();
        if (ticketErr) throw new Error(`lecture du billet ${ticketId} : ${ticketErr.message}`);
        if (!ticket) throw new PublicError('Billet introuvable.', 'TICKET_NOT_FOUND', 404);

        // 3. Contrôle d'accès & Propriété stricte
        if (ticket.user_id !== user.id && !serverIsAdmin(user)) {
            throw new PublicError('Accès refusé. Vous n’êtes pas le propriétaire de ce billet.', 'FORBIDDEN', 403);
        }

        // 4. Contrôle de validité du billet
        if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE' || ticket.status === 'REMBOURSEMENT_EN_COURS') {
            throw new PublicError('Ce billet n’est plus valide et ne peut pas être téléchargé.', 'TICKET_NOT_VALID', 400);
        }
        if (ticket.transfer_locked === true) {
            throw new PublicError('Ce billet est actuellement engagé dans un transfert en attente et son accès est verrouillé.', 'TRANSFER_PENDING', 400);
        }

        // 5. Informations associées : chaque lecture contrôle son erreur, aucune valeur de repli
        const { data: eventData, error: eventErr } = await supabase
            .from('events')
            .select('id, title, location, city, start_date, start_time, partner_id')
            .eq('id', ticket.event_id)
            .maybeSingle();
        if (eventErr) throw new Error(`lecture de l'événement ${ticket.event_id} : ${eventErr.message}`);
        if (!eventData) throw new Error(`événement ${ticket.event_id} du billet ${ticket.id} absent`);

        const { data: categoryData, error: categoryErr } = await supabase
            .from('ticket_categories')
            .select('id, name, price')
            .eq('id', ticket.category_id)
            .maybeSingle();
        if (categoryErr) throw new Error(`lecture de la catégorie ${ticket.category_id} : ${categoryErr.message}`);
        if (!categoryData) throw new Error(`catégorie ${ticket.category_id} du billet ${ticket.id} absente`);

        let holder: { first_name: string | null; last_name: string | null; phone: string | null; email: string | null } | null = null;
        if (ticket.user_id) {
            const { data: userData, error: userErr } = await supabase
                .from('users')
                .select('first_name, last_name, phone, email')
                .eq('id', ticket.user_id)
                .maybeSingle();
            if (userErr) throw new Error(`lecture du titulaire ${ticket.user_id} : ${userErr.message}`);
            holder = userData;
        }

        let organizerName: string | undefined;
        if (eventData.partner_id) {
            const { data: partnerData, error: partnerErr } = await supabase
                .from('partners')
                .select('company_name, commercial_name')
                .eq('id', eventData.partner_id)
                .maybeSingle();
            if (partnerErr) throw new Error(`lecture de l'organisateur ${eventData.partner_id} : ${partnerErr.message}`);
            organizerName = (partnerData?.commercial_name || partnerData?.company_name || '').trim() || undefined;
        }

        // 6. Préparation des données d'affichage (heure de Dakar)
        const clock = CLOCK_RE.exec(String(eventData.start_time ?? ''));
        const timeFormatted = clock ? formatTime(`${eventData.start_date}T${clock[1]}:${clock[2]}:00Z`) : '';
        const dateFormatted = formatDate(eventData.start_date);

        const holderName = `${holder?.first_name ?? ''} ${holder?.last_name ?? ''}`.trim();
        const holderContact = holder?.phone || holder?.email || '';
        const ownerName = holderName || holderContact;

        const price = Number(ticket.price ?? categoryData.price ?? 0);
        const priceFormatted = price > 0 ? `${price.toLocaleString('fr-FR')} FCFA` : 'Gratuit';
        // Lot 3.2 : frais de service du billet (payés par l'acheteur) et total payé
        const serviceFee = Number(ticket.service_fee ?? 0);
        const feesFormatted = price > 0
            ? `Frais de service : ${serviceFee.toLocaleString('fr-FR')} FCFA - Total paye : ${(price + serviceFee).toLocaleString('fr-FR')} FCFA`
            : undefined;

        // 7. Génération du PDF vectoriel
        const pdfBuffer = await TicketPdfService.generateTicketPdf({
            ticketNumber: ticket.ticket_number,
            eventTitle: eventData.title,
            eventSubtitle: organizerName,
            organizerName,
            categoryName: categoryData.name,
            priceFormatted,
            feesFormatted,
            dateFormatted,
            timeFormatted,
            venue: eventData.location ?? '',
            city: eventData.city ?? '',
            ownerName,
            ownerPhoneOrEmail: holderName ? holderContact : '',
            status: ticket.status,
            securityVersion: typeof ticket.security_version === 'number' ? ticket.security_version : undefined,
        });

        // 8. Retour du flux binaire PDF
        const filename = `Billet-EventVillage-${ticket.ticket_number}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.byteLength.toString(),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
    } catch (err: unknown) {
        return apiFailure(`GET /api/tickets/${ticketId ?? ''}/pdf`, err, {
            message: UNAVAILABLE_MESSAGE,
            code: 'TICKET_PDF_UNAVAILABLE',
            status: 503,
        });
    }
}
