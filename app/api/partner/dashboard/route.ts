import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner } from '@/lib/auth/session';
import { PartnerDashboardService } from '@/lib/partner/partner-dashboard.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        // Vérifier si l'utilisateur a une fiche partenaire ou un rôle partenaire/admin
        const supabase = getServiceRoleClient();
        const { data: partnerRecord } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!partnerRecord && !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé. Rôle Partenaire requis.' }, { status: 403 });
        }

        const data = await PartnerDashboardService.getDashboardData(user.id);
        return NextResponse.json({ success: true, dashboard: data, data });
    } catch (err: any) {
        if (err.message === 'PROFIL_PARTENAIRE_INTROUVABLE') {
            return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
        }
        console.error('[GET /api/partner/dashboard] Erreur:', err);
        return NextResponse.json({ error: err.message || 'Erreur serveur.' }, { status: 500 });
    }
}
