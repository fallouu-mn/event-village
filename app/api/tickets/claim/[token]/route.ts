import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { TicketTransferService } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/claim/[token]
 * Consultation publique et protégée d'un transfert de billet en attente.
 * Ne retourne AUCUN secret sensible (pas de hash, pas de totp_secret, pas de qr_code).
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ token: string }> | { token: string } }
) {
    try {
        const resolvedParams = await Promise.resolve(context?.params);
        const token = resolvedParams?.token;

        if (!token) {
            return NextResponse.json({ error: 'Jeton de réclamation manquant.' }, { status: 400 });
        }

        const info = await TicketTransferService.getClaimTransferInfo(token);
        return NextResponse.json({
            success: true,
            transfer: info,
        });
    } catch (err: any) {
        const status = err?.statusCode || 500;
        return NextResponse.json({
            error: err?.message || 'Erreur lors de la consultation du transfert.',
            expired: err?.expired || false,
            already_claimed: err?.already_claimed || false,
            cancelled: err?.cancelled || false,
        }, { status });
    }
}

/**
 * POST /api/tickets/claim/[token]
 * Réclamation atomique d'un billet par le destinataire authentifié.
 * Vérifie l'identité du compte connecté vs to_phone_or_email,
 * change le propriétaire, effectue la rotation cryptographique du secret TOTP & QR,
 * et incrémente la version de sécurité.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ token: string }> | { token: string } }
) {
    try {
        // 1. Authentification
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({
                error: 'Authentification requise. Veuillez vous connecter pour réclamer ce billet.',
            }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const token = resolvedParams?.token;

        if (!token) {
            return NextResponse.json({ error: 'Jeton de réclamation manquant.' }, { status: 400 });
        }

        // 2. Exécution de la réclamation atomique
        const result = await TicketTransferService.claimTransfer(user.id, token);

        return NextResponse.json({
            success: true,
            message: result.message,
            claim: result,
        });
    } catch (err: any) {
        console.error('[POST /api/tickets/claim/[token]] Erreur:', err?.message || err);
        const status = err?.statusCode || 500;
        return NextResponse.json({
            error: err?.message || 'Erreur interne lors de la réclamation du billet.',
        }, { status });
    }
}
