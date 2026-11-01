import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

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
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode !== 'number') {
            console.error('[GET /api/tickets/claim/[token]] erreur :', err instanceof Error ? err.message : String(err));
            return NextResponse.json({ error: 'Consultation du transfert momentanément impossible. Réessayez.', code: 'CLAIM_INFO_FAILED' }, { status: 500 });
        }
        return NextResponse.json({
            error: refusal.message,
            expired: refusal.expired === true,
            already_claimed: refusal.already_claimed === true,
            cancelled: refusal.cancelled === true,
        }, { status: refusal.statusCode });
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
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
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
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode !== 'number') {
            console.error('[POST /api/tickets/claim/[token]] erreur :', err instanceof Error ? err.message : String(err));
            return NextResponse.json({ error: 'Réclamation momentanément impossible. Réessayez.', code: 'CLAIM_FAILED' }, { status: 500 });
        }
        return NextResponse.json({ error: refusal.message }, { status: refusal.statusCode });
    }
}
