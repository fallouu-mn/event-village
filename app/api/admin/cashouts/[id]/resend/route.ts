import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { CashoutService } from '@/lib/payments/cashout.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cashouts/[id]/resend — « Renvoyer » un versement à reprendre (lot 9 bis, B2 à B4, contrat 4.1).
 * Permission refunds.manage, compte ACTIF (verifyAdminAuth). Corps `{ reason }` (10 à 500 caractères).
 * Renvoi seulement si rien n'est parti (B3) : refus 400 de l'opérateur, blocage levable, à envoyer jamais réservé,
 * ou INCERTAIN/ENVOYE avec identifiant dont SamirPay dit FAILED ou CANCELLED ; SamirPay dit SUCCESS → confirmé
 * d'office ; PENDING → 409 PROVIDER_PENDING ; sans identifiant → 409 NOT_RESENDABLE (B2). La décision et son
 * audit CASHOUT_RESENT sont écrits par cashout_admin_decide dans une transaction, puis un seul envoi part.
 * Réponse 200 `{ ok, status }` : `status` est le statut du versement après l'envoi (CONFIRME, ENVOYE, ECHOUE,
 * A_ENVOYER s'il est de nouveau bloqué), `ok` vrai si l'argent est parti.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> },
) {
    const auth = await verifyAdminAuth(request, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    try {
        const { id } = await Promise.resolve(params);
        const body = await readBody(request);
        const out = await CashoutService.adminDecide({ cashoutId: String(id ?? ''), actorId: auth.user.id, action: 'RESEND', reason: body.reason });
        return NextResponse.json(out);
    } catch (err) {
        return apiFailure('POST /api/admin/cashouts/[id]/resend', err, { message: 'Renvoi du versement momentanément impossible.', code: 'CASHOUT_DECISION_UNAVAILABLE' });
    }
}

/** Corps JSON objet ; vide → `{}` (la justification manquera : 400 REASON_REQUIRED) ; illisible → 400 INVALID_INPUT. */
async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
    const text = await request.text();
    if (!text.trim()) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new PublicError('Requête illisible : corps JSON attendu.', 'INVALID_INPUT', 400);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PublicError('Requête illisible : corps JSON attendu.', 'INVALID_INPUT', 400);
    return parsed as Record<string, unknown>;
}
