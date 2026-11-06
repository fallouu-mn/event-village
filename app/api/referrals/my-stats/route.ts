import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { accountBalance } from '@/lib/finance/ledger';

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

        // 6. Commissions (lot 3.5) : statut, échéance et nature (commission ou régularisation)
        const { data: commissions, error: commErr } = await supabase
            .from('referral_commissions')
            .select('id, amount, generation, status, kind, available_at, cancellation_reason, created_at')
            .eq('sponsor_id', userId)
            .order('created_at', { ascending: false });
        if (commErr) throw new Error(`Lecture des commissions impossible : ${commErr.message}`);
        // Total gagné : commissions non annulées, régularisations (négatives) déduites
        const totalEarned = (commissions ?? [])
            .filter((c) => c.kind === 'REGULARISATION' || c.status !== 'CANCELLED')
            .reduce((acc, c) => acc + Number(c.amount), 0);

        // 7. Retraits de parrainage effectivement payés (montant brut)
        const { data: withdrawals, error: wErr } = await supabase
            .from('withdrawals')
            .select('gross_amount')
            .eq('user_id', userId)
            .eq('account_kind', 'PARRAINAGE')
            .eq('status', 'PAID');
        if (wErr) throw new Error(`Lecture des retraits impossible : ${wErr.message}`);
        const totalWithdrawn = (withdrawals ?? []).reduce((acc, w) => acc + Number(w.gross_amount), 0);

        // 8. Solde : grand livre PARRAINAGE (une commission en attente n'est pas disponible)
        const balance = await accountBalance(userId, 'PARRAINAGE');
        const availableBalance = balance.available;

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
                pendingBalance: balance.pending,
                nextAvailableAt: balance.next_available_at,
                withdrawable: balance.withdrawable,
                totalEarned: Math.round(totalEarned * 100) / 100,
                totalWithdrawn,
            },
            // Les 10 dernières lignes : montant, niveau, statut, échéance, nature
            recentCommissions: commissions?.slice(0, 10) || [],
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/referrals/my-stats', err, { message: 'Statistiques de parrainage momentanément indisponibles.', code: 'REFERRAL_STATS_UNAVAILABLE' });
    }
}
