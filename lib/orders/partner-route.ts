/**
 * Lot 12c — début commun des routes de la partenaire du service des commandes (catalogue, zones, suppléments, journée) :
 * session active (401/403), puis interrupteur features.orders_enabled (404 si le service est fermé : lot 7, D56), puis
 * rôle partenaire (403). La garde de la fiche (lecture seule d'une fiche SUSPENDU) est appliquée par
 * requireActiveSession à toutes les routes /api/partner/* (lib/auth/partner-fiche-guard.ts) ; les fonctions en base
 * refusent aussi une fiche non VALIDE.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner, type ServerUser } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';

export async function partnerOrdersContext(request: NextRequest, where: string): Promise<{ user: ServerUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return { response: activeSession.response };
    const closed = await guardFeature('orders', where);
    if (closed) return { response: closed };
    const user = activeSession.user;
    if (!user || !serverIsPartner(user)) {
        return { response: NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 }) };
    }
    return { user };
}

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;
