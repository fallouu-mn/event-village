import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { TicketPdfService } from '@/lib/tickets/ticket-pdf.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/[id]/pdf
 * Génère et télécharge le PDF officiel haute-fidélité d'un billet valide.
 * 
 * Règles de sécurité strictes :
 * 1. Authentification obligatoire (401 si anonyme).
 * 2. Vérification d'appartenance : seul le propriétaire actuel du billet (ou un ADMIN) peut télécharger (403 si tiers).
 * 3. Rejet si le billet est ANNULE, REMBOURSE ou inexistant (404 / 400).
 * 4. Zéro secret TOTP, claim_token ou hash dans le document généré.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        // 1. Authentification
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json(
                { error: 'Authentification requise pour télécharger votre billet.' },
                { status: 401 }
            );
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const ticketId = resolvedParams?.id;

        if (!ticketId) {
            return NextResponse.json(
                { error: 'Identifiant de billet manquant.' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        // 2. Récupération directe du billet
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .maybeSingle();

        if (ticketErr || !ticket) {
            return NextResponse.json(
                { error: 'Billet introuvable.' },
                { status: 404 }
            );
        }

        // 3. Contrôle d'accès & Propriété stricte
        const isOwner = ticket.user_id === user.id;
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

        if (!isOwner && !isAdmin) {
            return NextResponse.json(
                { error: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce billet.' },
                { status: 403 }
            );
        }

        // 4. Contrôle de validité du billet
        if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE') {
            return NextResponse.json(
                { error: `Ce billet n'est plus valide (statut: ${ticket.status}) et ne peut pas être téléchargé.` },
                { status: 400 }
            );
        }

        if (ticket.transfer_locked === true) {
            return NextResponse.json(
                { error: 'Ce billet est actuellement engagé dans un transfert en attente et son accès est verrouillé.' },
                { status: 400 }
            );
        }

        // 5. Récupération des informations associées
        const [{ data: eventData }, { data: categoryData }, { data: userData }] = await Promise.all([
            ticket.event_id ? supabase.from('events').select('id, title, location, city, start_date, start_time, image_url, partner_id').eq('id', ticket.event_id).maybeSingle() : Promise.resolve({ data: null }),
            ticket.category_id ? supabase.from('ticket_categories').select('id, name, price').eq('id', ticket.category_id).maybeSingle() : Promise.resolve({ data: null }),
            ticket.user_id ? supabase.from('users').select('id, first_name, last_name, phone, email').eq('id', ticket.user_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        let organizerName = 'Organisateur Officiel';
        if (eventData?.partner_id) {
            const { data: partnerData } = await supabase.from('partners').select('company_name, commercial_name').eq('id', eventData.partner_id).maybeSingle();
            if (partnerData) {
                organizerName = partnerData.commercial_name || partnerData.company_name || organizerName;
            }
        }

        // 6. Préparation des données d'affichage
        const startDate = eventData?.start_date ? new Date(eventData.start_date) : new Date();
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const dateFormatted = `${startDate.getDate()} ${months[startDate.getMonth()]} ${startDate.getFullYear()}`;
        const timeFormatted = eventData?.start_time ? eventData.start_time.substring(0, 5) : '20:00';

        const ownerFirstName = userData?.first_name || '';
        const ownerLastName = userData?.last_name || '';
        const ownerName = (ownerFirstName || ownerLastName)
            ? `${ownerFirstName} ${ownerLastName}`.trim()
            : 'Titulaire Event Village';

        const price = ticket.price ?? categoryData?.price ?? 0;
        const priceFormatted = price > 0 ? `${price.toLocaleString('fr-FR')} FCFA` : 'Gratuit';

        // 6. Génération du PDF vectoriel
        const pdfBuffer = await TicketPdfService.generateTicketPdf({
            ticketNumber: ticket.ticket_number,
            eventTitle: eventData?.title || 'Événement Event Village',
            eventSubtitle: organizerName || 'Spectacle & Événement',
            organizerName,
            categoryName: categoryData?.name || 'Pass Standard',
            priceFormatted,
            dateFormatted,
            timeFormatted,
            venue: eventData?.location || 'Dakar Arena',
            city: eventData?.city || 'Dakar',
            ownerName,
            ownerPhoneOrEmail: userData?.phone || userData?.email || '',
            qrPayload: ticket.qr_code || ticket.ticket_number,
            status: ticket.status,
            securityVersion: ticket.security_version || 1,
        });

        // 7. Retour du flux binaire PDF
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

    } catch (err: any) {
        console.error('[GET /api/tickets/[id]/pdf] Exception:', err);
        return NextResponse.json(
            { error: 'Erreur serveur lors de la génération du document PDF.' },
            { status: 500 }
        );
    }
}
