import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { otpMemoryCache } from '@/lib/sms/otp-cache';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { AdminService } from '@/lib/admin/admin.service';
import { mTargetService } from '@/lib/sms/mtarget.service';

export const dynamic = 'force-dynamic';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const SetupSchema = z.object({
    phone:        z.string().min(8, 'Numéro de téléphone requis.'),
    otp_code:     z.string().length(6, 'Le code doit comporter 6 chiffres.'),
    new_password: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères.')
        .regex(PASSWORD_REGEX, 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.'),
});

// POST /api/controller/setup
// Vérifie l'OTP d'activation et définit le mot de passe définitif du contrôleur
export async function POST(req: NextRequest) {
    try {
        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = SetupSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        const { phone, otp_code, new_password } = parse.data;
        const normalizedPhone = normalizePhoneNumber(phone.trim());
        const rateLimitKey    = `controller-setup:${normalizedPhone}`;
        const supabase        = getServiceRoleClient();

        // 0. Rate limiting — anti brute-force OTP
        const { limited, remainingSeconds } = await RateLimiter.isRateLimited(rateLimitKey);
        if (limited) {
            return NextResponse.json({
                error: `Trop de tentatives. Réessayez dans ${Math.ceil((remainingSeconds ?? 900) / 60)} minutes.`,
            }, { status: 429 });
        }

        // 1. Vérification OTP (mémoire cache puis fallback DB)
        let otpValid = false;
        const cached = otpMemoryCache.get(normalizedPhone);

        if (cached && cached.code === otp_code && Date.now() < cached.expiresAt) {
            otpValid = true;
        } else {
            const { data: dbOtp } = await (supabase.from('otp_codes') as any)
                .select('code, expires_at')
                .eq('phone', normalizedPhone)
                .eq('code', otp_code)
                .eq('verified', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (dbOtp && new Date(dbOtp.expires_at).getTime() > Date.now()) {
                otpValid = true;
            }
        }

        if (!otpValid) {
            const attempt = await RateLimiter.recordFailedAttempt(rateLimitKey);
            const msg = attempt.locked
                ? `Code OTP invalide. Compte verrouillé pour 15 minutes.`
                : `Code OTP invalide ou expiré. ${attempt.remainingAttempts} tentative${attempt.remainingAttempts > 1 ? 's' : ''} restante${attempt.remainingAttempts > 1 ? 's' : ''}.`;
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 2. Récupérer l'utilisateur contrôleur
        const { data: profile } = await supabase
            .from('users')
            .select('id, role')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (!profile) {
            return NextResponse.json({ error: 'Aucun compte associé à ce numéro.' }, { status: 404 });
        }

        // Vérifier qu'il existe au moins une assignation contrôleur pour ce compte.
        // On vérifie l'assignation (source de vérité) plutôt que le rôle seul,
        // car le trigger handle_new_user pouvait créer le compte en CLIENT avant
        // que le rôle soit promu — l'invitation est la preuve d'intention.
        const { data: assignment } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('user_id', profile.id)
            .limit(1)
            .maybeSingle();

        if (!assignment) {
            return NextResponse.json({ error: 'Aucune invitation contrôleur trouvée pour ce numéro.' }, { status: 404 });
        }

        // Auto-réparation : si le trigger a créé le compte en CLIENT malgré l'invitation,
        // corriger maintenant les deux sources de vérité avant de définir le mot de passe.
        if (profile.role !== 'CONTROLEUR') {
            const [{ error: dbRepairErr }, { error: authRepairErr }] = await Promise.all([
                supabase.from('users')
                    .update({ role: 'CONTROLEUR', updated_at: new Date().toISOString() })
                    .eq('id', profile.id),
                supabase.auth.admin.updateUserById(profile.id, {
                    user_metadata: { role: 'CONTROLEUR' },
                }),
            ]);
            if (dbRepairErr || authRepairErr) {
                console.error('[setup] Auto-réparation rôle échouée:', dbRepairErr?.message || authRepairErr?.message);
                return NextResponse.json({ error: 'Erreur de configuration du compte.' }, { status: 500 });
            }
        }

        // 3. Définir le mot de passe définitif via Supabase Auth Admin
        const { error: pwdErr } = await supabase.auth.admin.updateUserById(profile.id, {
            password: new_password,
        });

        if (pwdErr) {
            console.error('[controller/setup] updateUserById:', pwdErr.message);
            return NextResponse.json({ error: 'Impossible de définir le mot de passe.' }, { status: 500 });
        }

        // 4. Invalider l'OTP + reset rate limiter
        otpMemoryCache.set(normalizedPhone, { code: '', expiresAt: 0, attempts: 99 });
        await Promise.all([
            (supabase.from('otp_codes') as any)
                .update({ verified: true })
                .eq('phone', normalizedPhone)
                .eq('code', otp_code),
            RateLimiter.resetAttempts(rateLimitKey),
        ]);

        // 5. Audit
        await AdminService.logAudit({
            userId: profile.id,
            userRole: 'CONTROLEUR',
            action: 'CONTROLLER_ACCOUNT_ACTIVATED',
            objectType: 'users',
            objectId: profile.id,
            newValue: { phone: normalizedPhone },
            metadata: { source: 'controller-setup' },
        });

        // 6. SMS de confirmation d'activation
        try {
            await mTargetService.sendControllerActivationConfirmation(normalizedPhone);
        } catch (smsErr) {
            console.warn('[controller/setup] SMS confirmation non bloquant:', smsErr instanceof Error ? smsErr.message : smsErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Mot de passe défini. Vous pouvez maintenant vous connecter.',
        });

    } catch (err: unknown) {
        console.error('[API /api/controller/setup]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
