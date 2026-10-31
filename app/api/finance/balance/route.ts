import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { ACCOUNT_KINDS, accountBalance, accountHistory, withdrawalsOf, type AccountKind } from '@/lib/finance/ledger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/balance?account=ORGANISATEUR|PARRAINAGE — solde du compte de l'utilisateur
 * connecté (lot 3.6), lu dans le grand livre : disponible, en attente (et date de disponibilité),
 * retraits en cours, créance, montant retirable, historique et derniers retraits.
 * Le compte ORGANISATEUR est réservé aux partenaires.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const account = (new URL(req.url).searchParams.get('account') ?? 'PARRAINAGE').toUpperCase() as AccountKind;
    if (!ACCOUNT_KINDS.includes(account)) {
        return NextResponse.json({ error: 'Compte inconnu (ORGANISATEUR ou PARRAINAGE).' }, { status: 400 });
    }
    if (account === 'ORGANISATEUR' && !serverIsPartner(session.user)) {
        return NextResponse.json({ error: 'Compte organisateur réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
    }
    try {
        const [balance, history, withdrawals] = await Promise.all([
            accountBalance(session.user.id, account),
            accountHistory(session.user.id, account),
            withdrawalsOf(session.user.id, account),
        ]);
        return NextResponse.json({ ...balance, history, withdrawals }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error(`[API /api/finance/balance] compte ${account} de ${session.user.id} :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Solde momentanément indisponible.' }, { status: 500 });
    }
}
