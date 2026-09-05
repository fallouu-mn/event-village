import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { otpMemoryCache } from '@/lib/sms/otp-cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-otp
 * Vérifie la validité d'un code OTP transmis par un utilisateur et génère un token de session si connexion
 */
export async function POST(req: NextRequest) {
    try {
        let body: { phone?: string; otpCode?: string; isLogin?: boolean };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawPhone = body.phone?.trim();
        const otpCode = body.otpCode?.trim();
        const isLogin = !!body.isLogin;

        if (!rawPhone || !otpCode) {
            return NextResponse.json(
                { error: 'Numéro de téléphone et code OTP requis.' },
                { status: 400 }
            );
        }

        const normalizedPhone = normalizePhoneNumber(rawPhone);

        // Protection Anti-Force Brute serveur (Rate Limiting)
        const { RateLimiter } = await import('@/lib/security/rate-limiter');
        const limitCheck = await RateLimiter.isRateLimited(`otp_verify_${normalizedPhone}`);
        if (limitCheck.limited) {
            return NextResponse.json(
                {
                    error: `Trop de tentatives de vérification. Veuillez patienter ${limitCheck.remainingSeconds || 60} secondes.`,
                    remainingSeconds: limitCheck.remainingSeconds || 60,
                },
                { status: 429 }
            );
        }

        // 1. Vérification dans le cache mémoire
        let isValid = false;
        const cached = otpMemoryCache.get(normalizedPhone);

        if (cached) {
            if (Date.now() > cached.expiresAt) {
                otpMemoryCache.delete(normalizedPhone);
                return NextResponse.json(
                    { error: 'Le code OTP a expiré. Veuillez en demander un nouveau.' },
                    { status: 400 }
                );
            }

            if (cached.code === otpCode) {
                isValid = true;
                otpMemoryCache.delete(normalizedPhone);
            } else {
                cached.attempts += 1;
                if (cached.attempts >= 5) {
                    otpMemoryCache.delete(normalizedPhone);
                    return NextResponse.json(
                        { error: 'Trop de tentatives infructueuses. Veuillez demander un nouveau code.' },
                        { status: 429 }
                    );
                }
            }
        }

        // 2. Vérification de secours dans la table PostgreSQL otp_codes si présent
        if (!isValid) {
            try {
                const supabase = getServiceRoleClient();
                const { data: record } = await (supabase.from('otp_codes') as any)
                    .select('*')
                    .eq('phone', normalizedPhone)
                    .eq('code', otpCode)
                    .eq('verified', false)
                    .gt('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (record) {
                    isValid = true;
                    await (supabase.from('otp_codes') as any)
                        .update({ verified: true })
                        .eq('id', record.id);
                }
            } catch {
                // Pas de table otp_codes
            }
        }

        if (!isValid) {
            await RateLimiter.recordFailedAttempt(`otp_verify_${normalizedPhone}`);
            return NextResponse.json(
                { error: 'Code de vérification incorrect ou expiré.' },
                { status: 400 }
            );
        }

        await RateLimiter.resetAttempts(`otp_verify_${normalizedPhone}`);

        // 3. Récupération du profil utilisateur et génération de session
        const supabase = getServiceRoleClient();
        const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (isLogin && !userProfile) {
            return NextResponse.json(
                { error: 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.' },
                { status: 404 }
            );
        }

        // Confirmer le téléphone dans auth.users si pas encore fait (H3: partenaire OTP)
        if (userProfile?.id) {
            try {
                await supabase.auth.admin.updateUserById(userProfile.id, { phone_confirm: true });
            } catch (confirmErr) {
                console.warn('[API verify-otp] Impossible de confirmer phone_confirm:', confirmErr);
            }
        }

        let tokenHash: string | undefined;
        const targetEmail = userProfile?.email || `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

        if (userProfile) {
            try {
                const { data: linkData } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: targetEmail,
                });
                tokenHash = linkData?.properties?.hashed_token;
            } catch (linkErr) {
                console.warn('[API verify-otp] Notice generateLink:', linkErr);
            }
        }

        return NextResponse.json({
            success: true,
            verified: true,
            user: userProfile,
            token_hash: tokenHash,
            email: targetEmail,
            phone: normalizedPhone,
            message: 'Numéro de téléphone vérifié avec succès.',
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[API verify-otp] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
