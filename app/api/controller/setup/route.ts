import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { phoneStorageForms, toSenegaleseE164 } from '@/lib/validations/auth';
import { checkStoredOtp, consumeStoredOtp, otpFailureMessage } from '@/lib/auth/otp-store';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { AdminService } from '@/lib/admin/admin.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { addUserRole } from '@/lib/auth/roles';

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
        // Lot 1C.1 : numéro mobile sénégalais E.164 exigé, recherche en égalité exacte.
        const e164 = toSenegaleseE164(phone);
        if (!e164) {
            return NextResponse.json({ error: 'Numéro de téléphone sénégalais invalide.', code: 'INVALID_PHONE' }, { status: 400 });
        }
        const normalizedPhone = e164;
        const rateLimitKey    = `controller-setup:${normalizedPhone}`;
        const supabase        = getServiceRoleClient();

        // 0. Rate limiting — anti brute-force OTP avec fail-closed (Faille 3.1)
        const { limited, remainingSeconds } = await RateLimiter.isRateLimited(rateLimitKey, { failClosed: true });
        if (limited) {
            return NextResponse.json({
                error: `Trop de tentatives. Réessayez dans ${Math.ceil((remainingSeconds ?? 900) / 60)} minutes.`,
            }, { status: 429 });
        }

        // 1. Lot 1B.7 : vérification en base uniquement (le code est consommé en fin de parcours).
        const otpCheck = await checkStoredOtp(normalizedPhone, otp_code);
        if (!otpCheck.ok) {
            const attempt = await RateLimiter.recordFailedAttempt(rateLimitKey, { failClosed: true });
            if (otpCheck.reason !== 'INVALID') {
                const { message, status } = otpFailureMessage(otpCheck.reason);
                return NextResponse.json({ error: message }, { status });
            }
            const msg = attempt.locked
                ? `Code OTP invalide. Compte verrouillé pour 15 minutes.`
                : `Code OTP invalide ou expiré. ${attempt.remainingAttempts} tentative${attempt.remainingAttempts > 1 ? 's' : ''} restante${attempt.remainingAttempts > 1 ? 's' : ''}.`;
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 2. Récupérer l'utilisateur contrôleur
        const { data: matches, error: lookupErr } = await supabase
            .from('users')
            .select('id, role')
            .in('phone', phoneStorageForms(normalizedPhone))
            .limit(2);
        if (lookupErr) {
            console.error('[controller/setup] recherche du compte par téléphone :', lookupErr.message);
            return NextResponse.json({ error: 'Recherche du compte impossible. Réessayez.' }, { status: 500 });
        }
        if ((matches ?? []).length > 1) {
            return NextResponse.json({ error: 'Plusieurs comptes correspondent à ce numéro. Contactez le support.', code: 'AMBIGUOUS_PHONE' }, { status: 409 });
        }
        const profile = (matches ?? [])[0] ?? null;

        if (!profile) {
            return NextResponse.json({ error: 'Aucun compte associé à ce numéro.' }, { status: 404 });
        }

        // Vérifier qu'il existe au moins une assignation contrôleur pour ce compte.
        const { data: assignment } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('user_id', profile.id)
            .limit(1)
            .maybeSingle();

        if (!assignment) {
            return NextResponse.json({ error: 'Aucune invitation contrôleur trouvée pour ce numéro.' }, { status: 404 });
        }

        // Faille 1.2 : Récupérer le compte Auth Supabase et vérifier s'il s'agit d'un compte coquille
        const { data: authUserData, error: authUserErr } = await supabase.auth.admin.getUserById(profile.id);
        const authUser = authUserData?.user;

        if (authUserErr || !authUser) {
            return NextResponse.json({ error: 'Compte d\'authentification introuvable.' }, { status: 404 });
        }

        // Si le compte n'est pas un compte temporaire ("coquille") créé lors d'une première invitation,
        // c'est un compte utilisateur établi qui possède déjà ses propres identifiants.
        // /controller/setup refuse d'écraser le mot de passe existant et invite à se connecter.
        const isTemporaryShellAccount = authUser.user_metadata?.is_temporary_controller_account === true;
        if (!isTemporaryShellAccount) {
            return NextResponse.json({
                error: 'Ce compte possède déjà un mot de passe actif. Veuillez vous connecter avec vos identifiants existants.',
                code: 'ACCOUNT_ALREADY_CONFIGURED',
                redirect: '/login',
            }, { status: 400 });
        }

        // MULTI-RÔLE : s'assurer que CONTROLEUR est dans user_roles (sans écraser les autres rôles)
        const { data: existingRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);
        const hasControllerRole = (existingRoles || []).some(r => r.role === 'CONTROLEUR');
        if (!hasControllerRole) {
            const { error: roleError } = await addUserRole(profile.id, 'CONTROLEUR');
            if (roleError) {
                console.error('[setup] Ajout rôle CONTROLEUR échoué:', roleError);
                return NextResponse.json({ error: 'Erreur de configuration du compte.' }, { status: 500 });
            }
        }

        // 3. Définir le mot de passe définitif via Supabase Auth Admin et verrouiller le statut coquille
        const { error: pwdErr } = await supabase.auth.admin.updateUserById(profile.id, {
            password: new_password,
            user_metadata: {
                ...(authUser.user_metadata || {}),
                is_temporary_controller_account: false,
            },
        });

        if (pwdErr) {
            console.error('[controller/setup] updateUserById:', pwdErr.message);
            return NextResponse.json({ error: 'Impossible de définir le mot de passe.' }, { status: 500 });
        }

        // 4. Consommer l'OTP (en base) + reset rate limiter
        if (!(await consumeStoredOtp(otpCheck.id))) {
            console.warn(`[controller/setup] code OTP ${otpCheck.id} déjà consommé par une requête concurrente`);
        }
        await RateLimiter.resetAttempts(rateLimitKey);

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
