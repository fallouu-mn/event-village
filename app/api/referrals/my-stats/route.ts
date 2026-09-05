import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referrals/my-stats
 * Fournit les métriques et commissions de parrainage réelles de l'utilisateur connecté (0 mock)
 * Toutes les colonnes sont alignées sur le schéma réel de la DB (0001_initial_schema.sql)
 */
export async function GET(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const userId = authUser.id;

        // 2. Profil utilisateur réel
        const { data: profile, error: uErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, role, referral_status')
            .eq('id', userId)
            .maybeSingle();

        if (uErr || !profile) {
            return NextResponse.json({
                success: false,
                error: 'Profil utilisateur introuvable.',
                referralCode: '',
                referralLink: '',
                isAmbassador: false,
                rates: { level1: 5.0, level2: 2.0 },
                network: { level1Count: 0, level2Count: 0, totalReferred: 0 },
                finances: { availableBalance: 0, totalEarned: 0, totalWithdrawn: 0 },
                recentCommissions: [],
            }, { status: 200 });
        }

        const isAmbassador = profile.referral_status === 'AMBASSADEUR';

        // Code de parrainage dynamique
        const cleanPhone = (profile.phone || '').replace(/\D/g, '');
        const referralCode: string =
            `EV-${cleanPhone.slice(-6) || profile.id.slice(0, 6).toUpperCase()}`;

        // 3. Taux dynamiques depuis referral_config
        let rateN1 = isAmbassador ? 7.0 : 5.0;
        let rateN2 = isAmbassador ? 2.0 : 2.0;

        try {
            const { data: rateConfig } = await supabase
                .from('referral_config')
                .select('rate_n1, rate_n2')
                .eq('sponsor_status', profile.referral_status || 'STANDARD')
                .eq('referral_type', 'CLIENT_TO_CLIENT')
                .eq('is_active', true)
                .maybeSingle();

            if (rateConfig) {
                rateN1 = Number(rateConfig.rate_n1) || rateN1;
                rateN2 = Number(rateConfig.rate_n2) || rateN2;
            }
        } catch {}

        // 4. Filleuls N1 directs (sponsor_id = userId dans referral_relationships)
        const { data: n1Relationships } = await supabase
            .from('referral_relationships')
            .select('id, referred_id, created_at')
            .eq('sponsor_id', userId);

        const n1Count = n1Relationships?.length || 0;
        const n1FilleulIds = n1Relationships?.map((r: { referred_id: string }) => r.referred_id) || [];

        // 5. Filleuls N2 (sous-filleuls : filleuls des filleuls N1)
        let n2Count = 0;
        if (n1FilleulIds.length > 0) {
            const { data: n2Relationships } = await supabase
                .from('referral_relationships')
                .select('id, referred_id, created_at')
                .in('sponsor_id', n1FilleulIds);
            n2Count = n2Relationships?.length || 0;
        }

        // 6. Commissions réelles (colonnes : sponsor_id, amount, generation, status)
        const { data: commissions } = await supabase
            .from('referral_commissions')
            .select('id, amount, generation, status, created_at')
            .eq('sponsor_id', userId)
            .order('created_at', { ascending: false });

        const totalEarned = commissions?.reduce((acc: number, c: { amount: unknown }) => acc + (Number(c.amount) || 0), 0) || 0;

        // 7. Retraits effectués (statuts non REJECTED)
        const { data: withdrawals } = await supabase
            .from('withdrawals')
            .select('id, amount, status')
            .eq('user_id', userId)
            .neq('status', 'REJECTED');

        const totalWithdrawn = withdrawals?.reduce((acc: number, w: { amount: unknown }) => acc + (Number(w.amount) || 0), 0) || 0;
        const availableBalance = Math.max(0, totalEarned - totalWithdrawn);

        return NextResponse.json({
            success: true,
            referralCode,
            referralLink: `https://eventvillage.sn/r/${referralCode}`,
            isAmbassador,
            rates: {
                level1: rateN1,
                level2: rateN2,
            },
            network: {
                level1Count: n1Count,
                level2Count: n2Count,
                totalReferred: n1Count + n2Count,
            },
            finances: {
                availableBalance,
                totalEarned,
                totalWithdrawn,
            },
            // Les 10 dernières commissions — champs réels : amount, generation ('N1'|'N2')
            recentCommissions: commissions?.slice(0, 10) || [],
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
