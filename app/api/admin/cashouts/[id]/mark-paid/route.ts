import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { CashoutService } from '@/lib/payments/cashout.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cashouts/[id]/mark-paid — « Marquer versé » (lot 9 bis, B2, B4, contrat 4.1) : le versement est
 * parti hors de l'envoi automatique (constaté auprès du support SamirPay). Permission refunds.manage, compte ACTIF.
 * Corps `{ reason, reference, fees? }` : justification de 10 à 500 caractères, référence SamirPay `^TX[A-Za-z0-9]{8}$`
 * ou UUID de la transaction, frais réels facultatifs (≥ 0). Versement INCERTAIN ou ENVOYE avec identifiant : refusé
 * si SamirPay dit FAILED ou CANCELLED (409 PROVIDER_SAYS_FAILED). cashout_admin_decide pose CONFIRME,
 * provider_status MANUEL, la référence, applique les effets (cashout_finalize) et écrit l'audit CASHOUT_MARKED_PAID
 * dans la même transaction : sans journal, rien n'est fait (500). Réponse 200 `{ ok: true, status: 'CONFIRME' }`.
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
        const out = await CashoutService.adminDecide({
            cashoutId: String(id ?? ''), actorId: auth.user.id, action: 'MARK_PAID', reason: body.reason, reference: body.reference, fees: body.fees,
        });
        return NextResponse.json(out);
    } catch (err) {
        return apiFailure('POST /api/admin/cashouts/[id]/mark-paid', err, { message: 'Marquage du versement momentanément impossible.', code: 'CASHOUT_DECISION_UNAVAILABLE' });
    }
}

/** Corps JSON objet ; vide → `{}` (justification et référence manqueront : 400) ; illisible → 400 INVALID_INPUT. */
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
