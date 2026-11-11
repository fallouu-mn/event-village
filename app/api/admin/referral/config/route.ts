import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'GET /api/admin/referral/config';

/**
 * GET /api/admin/referral/config — lot 9 bis, tâche 41 (R67 ; contrat 4.4, D-txt 2) : grille du parrainage telle qu'elle
 * est en base (lignes actives de referral_config : statut du parrain, type de relation, taux de niveau 1 et 2, durée en
 * mois), pour que la page d'administration n'affiche plus de durée ni de taux écrits en dur. Permission
 * `referrals.manage`. Une lecture en échec rend 500 explicite, jamais une valeur de repli.
 * Réponse : `{ configs: [{ sponsor_status, referral_type, rate_n1, rate_n2, duration_months }] }`.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'referrals.manage' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { data, error } = await getServiceRoleClient()
            .from('referral_config')
            .select('sponsor_status, referral_type, rate_n1, rate_n2, duration_months')
            .eq('is_active', true)
            .order('sponsor_status', { ascending: true })
            .order('referral_type', { ascending: true });
        if (error) throw new Error(`lecture de referral_config impossible : ${error.message}`);

        const configs = (data ?? []).map((r) => ({
            sponsor_status: String(r.sponsor_status),
            referral_type: String(r.referral_type),
            rate_n1: Number(r.rate_n1),
            rate_n2: Number(r.rate_n2),
            duration_months: Number(r.duration_months),
        }));
        return NextResponse.json({ configs }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure(CONTEXT, err, { message: 'Impossible de charger la configuration du parrainage.', code: 'REFERRAL_CONFIG_UNAVAILABLE' });
    }
}
