import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { readFinanceSetting } from '@/lib/finance/engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/ticketing-rules — finition 2b (A, E-26) : règles de la billetterie que le formulaire doit connaître
 * avant d'envoyer, lues par le serveur. Aujourd'hui le seul prix minimum d'un billet payant (réglage
 * finance.min_paid_price, fin_setting : jamais de valeur inventée) ; l'écran le dit dans l'aide du prix et le contrôle dès
 * « Suivant ». Organisatrice connectée seulement (lecture : permise à une fiche suspendue). Réponse 200
 * `{ min_paid_price }`, sans cache ; réglage illisible : 503.
 */
export async function GET(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    if (!serverIsPartner(activeSession.user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    try {
        const raw = await readFinanceSetting<number>('finance.min_paid_price');
        const min = Number(raw);
        if (!Number.isInteger(min) || min < 1) throw new Error(`minimum illisible : ${String(raw)}`);
        return NextResponse.json({ min_paid_price: min }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        console.error('[API partner/ticketing-rules] prix minimum :', err instanceof Error ? err.message : String(err));
        return NextResponse.json(
            { error: 'Règles de la billetterie momentanément indisponibles.', code: 'RULES_UNAVAILABLE' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
    }
}
