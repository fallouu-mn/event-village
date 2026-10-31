import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { otpFailureMessage, verifyStoredOtp } from '@/lib/auth/otp-store';

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

        // 1-2. Lot 1B.7 : vérification en base uniquement (otp_codes), indépendante de l'instance
        //      qui a émis le code. Une erreur de lecture ou d'écriture est une erreur serveur.
        const check = await verifyStoredOtp(normalizedPhone, otpCode);
        if (!check.ok) {
            await RateLimiter.recordFailedAttempt(`otp_verify_${normalizedPhone}`);
            const { message, status } = otpFailureMessage(check.reason);
            return NextResponse.json({ error: message }, { status });
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
