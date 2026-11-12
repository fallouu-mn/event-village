import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { PASSWORD_CONFIRMATION_REQUIRED_TEXT, requireRecentPassword } from '@/lib/auth/password-confirm';
import { CashoutService } from '@/lib/payments/cashout.service';
import { getAuthenticatedSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cashouts/[id]/not-sent — « Constater non versé » (lot 9 ter, consigne 0.3, contrat A.2.3, 4.1).
 * Un versement INCERTAIN sans identifiant SamirPay (délai dépassé au transfert) que le support SamirPay déclare non
 * parti passe ECHOUE : un remboursement pourra être renvoyé par « Renvoyer » (nouvel envoi, jamais automatique) ; un
 * retrait est refusé et son montant rendu au bénéficiaire.
 * Gardes, dans cet ordre : permission refunds.manage et compte ACTIF (verifyAdminAuth) ; rôle SUPERADMIN contrôlé ici
 * avec un code (403 SUPERADMIN_ONLY) ; mot de passe saisi dans cette session depuis moins de 10 minutes
 * (requireRecentPassword, puis revérifié par la RPC avec l'identifiant de session). Corps `{ reference, reason }` :
 * référence du support SamirPay de 1 à 100 caractères, motif de 10 à 500 ; aucune heure acceptée. La RPC
 * cashout_admin_not_sent verrouille le versement et écrit le constat, ses effets et l'audit CASHOUT_NOT_SENT dans une
 * transaction. Réponse 200 `{ ok: true, status: 'ECHOUE', kind }`.
 * Refus (liste blanche) : INVALID_INPUT, REASON_REQUIRED, SUPPORT_REFERENCE_REQUIRED (400) ; PERMISSION_MISSING,
 * ACCOUNT_NOT_ACTIVE, SUPERADMIN_ONLY, PASSWORD_CONFIRMATION_REQUIRED (403) ; CASHOUT_NOT_FOUND (404) ; NOT_UNCERTAIN,
 * PROVIDER_ID_KNOWN (409) ; panne : 500 CASHOUT_DECISION_UNAVAILABLE.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> },
) {
    const auth = await verifyAdminAuth(request, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    if (!auth.user.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Seul un superadmin peut constater qu’un versement n’est pas parti.', code: 'SUPERADMIN_ONLY' }, { status: 403 });
    }
    const passwordRefusal = await requireRecentPassword(request, auth.user.id);
    if (passwordRefusal) return passwordRefusal;
    try {
        const session = await getAuthenticatedSession(request);
        if (!session || session.userId !== auth.user.id) {
            return NextResponse.json({ error: PASSWORD_CONFIRMATION_REQUIRED_TEXT, code: 'PASSWORD_CONFIRMATION_REQUIRED' }, { status: 403 });
        }
        const { id } = await Promise.resolve(params);
        const body = await readBody(request);
        const out = await CashoutService.adminNotSent({
            cashoutId: String(id ?? ''), actorId: auth.user.id, sessionId: session.sessionId, reference: body.reference, reason: body.reason,
        });
        return NextResponse.json(out);
    } catch (err) {
        return apiFailure('POST /api/admin/cashouts/[id]/not-sent', err, { message: 'Constat momentanément impossible.', code: 'CASHOUT_DECISION_UNAVAILABLE' });
    }
}

/** Corps JSON objet ; vide → `{}` (référence et motif manqueront : 400) ; illisible → 400 INVALID_INPUT. */
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
