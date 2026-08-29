import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referrals/my-stats
 * Fournit les métriques et commissions de parrainage réelles de l'utilisateur connecté (0 mock)
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();

        // 1. Extraction du token / user authentifié
        const authHeader = req.headers.get('authorization');
        let token: string | undefined;
        if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
        else token = req.cookies.get('sb-access-token')?.value || req.cookies.get('sb-auth-token')?.value;

        let userId = req.headers.get('x-user-id') || undefined;

        if (!userId && token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        if (!userId) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        // 2. Profil utilisateur
        const { data: profile, error: uErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, role, referral_status')
            .eq('id', userId)
            .maybeSingle();

        if (uErr || !profile) {
            return NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 404 });
        }

        const isAmbassador = profile.referral_status === 'AMBASSADEUR';
        const cleanPhone = (profile.phone || '').replace(/\D/g, '');
        const referralCode = `EV-${cleanPhone.slice(-6) || profile.id.slice(0, 6).toUpperCase()}`;

        // 3. Filleuls N1 et N2
        const { data: relationships } = await supabase
            .from('referral_relationships')
            .select('id, referred_id, level, created_at')
            .eq('referrer_id', userId);

        const n1Count = relationships?.filter(r => r.level === 1).length || 0;
        const n2Count = relationships?.filter(r => r.level === 2).length || 0;

        // 4. Commissions de parrainage réelles
        const { data: commissions } = await supabase
            .from('referral_commissions')
            .select('id, commission_amount, level, status, created_at')
            .eq('referrer_id', userId)
            .order('created_at', { ascending: false });

        const totalEarned = commissions?.reduce((acc, c) => acc + (Number(c.commission_amount) || 0), 0) || 0;

        // 5. Retraits de fonds effectués
        const { data: withdrawals } = await supabase
            .from('withdrawals')
            .select('id, amount, status')
            .eq('user_id', userId)
            .neq('status', 'REJECTED');

        const totalWithdrawn = withdrawals?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0;
        const availableBalance = Math.max(0, totalEarned - totalWithdrawn);

        // Taux en vigueur selon le statut
        const rateN1 = isAmbassador ? 7.0 : 4.0;
        const rateN2 = isAmbassador ? 2.0 : 1.5;

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
            recentCommissions: commissions?.slice(0, 10) || [],
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
