import { NextRequest, NextResponse } from 'next/server';
import { requireRecentPassword } from '@/lib/auth/password-confirm';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/partner/shifts/[id]/validate-discrepancy';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refus de shift_discrepancy_validate → statut HTTP (texte rendu par la RPC). */
const REFUSAL_STATUS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    SHIFT_NOT_FOUND: 404,
    SHIFT_NOT_CLOSED: 409,
    NO_DISCREPANCY: 409,
    ALREADY_VALIDATED: 409,
};

/**
 * POST /api/partner/shifts/[id]/validate-discrepancy — lot 9 quater (C7 : AUD-16). L'organisatrice valide l'écart d'une
 * caisse fermée depuis SA session (onglet Caisse du pilotage, bouton « Valider l'écart »), mot de passe saisi depuis moins
 * de 10 minutes (403 PASSWORD_CONFIRMATION_REQUIRED sinon : l'écran ouvre la saisie du mot de passe). Plus aucun PIN saisi
 * sur le téléphone du contrôleur ne valide un écart. Seule la partenaire propriétaire de la caisse (compte ACTIF) valide ;
 * toute autre : 404. 200 { ok, shift_id, discrepancy, validated_at } ; 409 caisse non fermée, sans écart, déjà validée.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { id: shiftId } = await Promise.resolve(context.params);
    if (!shiftId || !UUID_RE.test(shiftId)) {
        return NextResponse.json({ error: 'Caisse introuvable.', code: 'SHIFT_NOT_FOUND' }, { status: 404 });
    }
    const recent = await requireRecentPassword(req, session.user.id);
    if (recent) return recent;

    const { data, error } = await getServiceRoleClient().rpc('shift_discrepancy_validate', {
        p: { shift_id: shiftId, actor_id: session.user.id },
    });
    if (error || !data) {
        console.error(`[${CONTEXT}]`, error?.message ?? 'réponse vide');
        return NextResponse.json({ error: 'Validation de l’écart momentanément impossible. Réessayez.', code: 'DISCREPANCY_VALIDATE_FAILED' }, { status: 500 });
    }
    const reply = data as { ok?: boolean; code?: string; message?: string };
    if (reply.ok !== true) {
        const status = REFUSAL_STATUS[String(reply.code)];
        if (!status) {
            console.error(`[${CONTEXT}] refus non répertorié :`, JSON.stringify(reply));
            return NextResponse.json({ error: 'Validation de l’écart momentanément impossible. Réessayez.', code: 'DISCREPANCY_VALIDATE_FAILED' }, { status: 500 });
        }
        return NextResponse.json({ error: reply.message ?? 'Validation refusée.', code: reply.code }, { status });
    }
    return NextResponse.json({ ...reply, message: 'Écart validé.' });
}
