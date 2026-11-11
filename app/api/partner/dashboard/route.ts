import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { PartnerDashboardService } from '@/lib/partner/partner-dashboard.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/dashboard — tableau de bord du partenaire connecté : indicateurs lus au grand livre,
 * événements, activité récente, et (lot 7, contrat 3.8) `onboarding` (étapes de la première utilisation,
 * cochées ici) et `trial` (durée, début, fin de l'essai). Aucun chiffre n'est laissé au navigateur.
 * Réponse : `{ success, dashboard, data, partner }` (`data` : alias historique).
 * Lot 9 bis (R7, B39) : ouvert aussi au compte EN_ATTENTE ; `partner.status` dit l'état du dossier (bandeau « Compte en
 * cours de vérification » de l'écran).
 */
export async function GET(req: NextRequest) {
    const activeSession = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!user) {
        return NextResponse.json({ error: 'Authentification requise.', code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    try {
        // Fiche partenaire du compte (ou rôle partenaire) : seule condition d'accès.
        const supabase = getServiceRoleClient();
        const { data: partnerRecord, error: partnerErr } = await supabase
            .from('partners')
            .select('id, status')
            .eq('user_id', user.id)
            .maybeSingle();
        if (partnerErr) {
            console.error(`[GET /api/partner/dashboard] fiche partenaire de ${user.id} :`, partnerErr.message);
            return NextResponse.json({ error: 'Tableau de bord momentanément indisponible.', code: 'DASHBOARD_UNAVAILABLE' }, { status: 500 });
        }
        if (!partnerRecord && !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'NOT_PARTNER' }, { status: 403 });
        }

        const data = await PartnerDashboardService.getDashboardData(user.id);
        const partner = partnerRecord ? { id: partnerRecord.id, status: partnerRecord.status } : null;
        return NextResponse.json({ success: true, dashboard: data, data, partner }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'PROFIL_PARTENAIRE_INTROUVABLE') {
            return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
        }
        console.error(`[GET /api/partner/dashboard] compte ${user.id} :`, message);
        return NextResponse.json({ error: 'Tableau de bord momentanément indisponible.', code: 'DASHBOARD_UNAVAILABLE' }, { status: 500 });
    }
}
