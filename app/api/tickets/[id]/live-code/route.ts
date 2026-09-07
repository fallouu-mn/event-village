import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverHasAnyRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { generateTotp, buildDynamicQrPayload, TOTP_STEP_SECONDS, deriveTicketTotpSecret } from '@/lib/security/totp';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/[id]/live-code
 * Génère le code TOTP dynamique pour l'affichage sécurisé du QR Code (Wallet Client).
 * Le secret cryptographique ne quitte JAMAIS le serveur.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const ticketId = resolvedParams?.id;
        if (!ticketId) {
            return NextResponse.json({ error: 'Identifiant de billet requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Récupération du billet
        const { data: ticket, error: tErr } = await supabase
            .from('tickets')
            .select('id, ticket_number, qr_code, status, user_id, event_id')
            .eq('id', ticketId)
            .maybeSingle();

        if (tErr || !ticket) {
            return NextResponse.json({ error: 'Billet introuvable.' }, { status: 404 });
        }

        // 2. Contrôle des droits d'accès
        const isOwner = ticket.user_id === user.id;
        const isStaff = serverHasAnyRole(user, ['ADMIN', 'SUPERADMIN', 'CONTROLEUR', 'PARTENAIRE']);
        if (!isOwner && !isStaff) {
            return NextResponse.json({ error: 'Accès non autorisé à ce billet.' }, { status: 403 });
        }

        // 3. Vérification du statut du billet
        if (ticket.status !== 'VALIDE') {
            return NextResponse.json({
                error: `Ce billet est ${ticket.status === 'UTILISE' ? 'déjà utilisé' : ticket.status}.`,
                status: ticket.status,
                is_active: false,
            }, { status: 400 });
        }

        // 4. Calcul du secret (colonne DB ou dérivation cryptographique serveur)
        const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);

        // 5. Génération du TOTP courant (fenêtre de 20 secondes)
        const { code, timeRemaining } = generateTotp(secret, undefined, TOTP_STEP_SECONDS);

        // 6. Construction du payload compact (EVT1:<qr_code>:<6_digits>)
        const qrPayload = buildDynamicQrPayload(ticket.qr_code, code);

        return NextResponse.json({
            success: true,
            ticket_id: ticket.id,
            qr_payload: qrPayload,
            totp_code: code,
            expires_in: timeRemaining,
            step_seconds: TOTP_STEP_SECONDS,
        });
    } catch (err: unknown) {
        console.error('[GET /api/tickets/[id]/live-code] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
