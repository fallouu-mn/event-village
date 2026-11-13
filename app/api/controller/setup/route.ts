import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { phoneStorageForms, toSenegaleseE164 } from '@/lib/validations/auth';
import { ServerPasswordSchema } from '@/lib/auth/password-policy.server'; // lot 9 quinquies (A7)
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { CONTROLLER_ACTIVATION_KEY, isControllerActivationPending } from '@/lib/auth/controller-activation';
import { otpFailureMessage, verifyStoredOtp } from '@/lib/auth/otp-store';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { AdminService } from '@/lib/admin/admin.service';
import { addUserRole } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

// Lot 9 quater (A5 : G-31) : l'activation applique la règle commune du mot de passe (StrongPasswordSchema)
const SetupSchema = z.object({
    phone:        z.string().min(8, 'Numéro de téléphone requis.'),
    otp_code:     z.string().length(6, 'Le code doit comporter 6 chiffres.'),
    new_password: z.string().max(200, 'Mot de passe trop long.').pipe(ServerPasswordSchema),
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
        const supabase        = getServiceRoleClient();

        // 0. Lot 4.8 : anti-force brute en base (CONTROLLER_SETUP_PER_PHONE_HOUR), réservé avant la
        //    vérification du code : chaque tentative compte, et la garde indisponible refuse (503).
        const quota = await reserveQuota(
            [{ scope: 'controller_setup_phone', bucket: normalizedPhone, windowSecs: 3600, max: getServerEnv().CONTROLLER_SETUP_PER_PHONE_HOUR }],
            'activation contrôleur'
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives d’activation pour ce numéro. Réessayez plus tard.',
                code: 'CONTROLLER_SETUP_RATE_LIMITED',
            });
        }

        // 1. Lot 7 (D22) : le code est vérifié ET consommé en une seule transaction (otp_check, verrou de la
        //    ligne du code), avant toute autre étape et avant la pose du mot de passe. Deux activations
        //    simultanées avec le même code : une seule obtient le code, l'autre reçoit un refus (le code
        //    n'est plus en attente). Le code n'accepte que 5 essais (OTP_MAX_ATTEMPTS, lib/auth/otp-store.ts).
        //    Un échec après ce point laisse le code consommé : une nouvelle invitation émet un nouveau code
        //    tant que le compte est temporaire (app/api/partner/team/invite/route.ts).
        const otpCheck = await verifyStoredOtp(normalizedPhone, otp_code, 'CONTROLLER_SETUP');
        if (!otpCheck.ok) {
            const { message, status } = otpFailureMessage(otpCheck.reason);
            return NextResponse.json({ error: message }, { status });
        }

        // 2. Récupérer l'utilisateur contrôleur
        const { data: matches, error: lookupErr } = await supabase
            .from('users')
            .select('id, role, status')
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

        // Lot 9 bis (R102, B43) : après la vérification du code (le statut n'est jamais dit avant), un compte non ACTIF
        // n'est pas activé : ni mot de passe, ni rôle, ni avis. Le code reste consommé.
        if (profile.status !== 'ACTIF') {
            return NextResponse.json({
                error: 'Ce compte est suspendu : l’activation est impossible. Contactez l’organisateur ou le support.',
                code: 'ACCOUNT_NOT_ACTIVE',
            }, { status: 403 });
        }

        // Vérifier qu'il existe au moins une assignation contrôleur pour ce compte.
        const { data: assignment, error: assignmentErr } = await supabase
            .from('event_controllers')
            .select('id')
            .eq('user_id', profile.id)
            .limit(1)
            .maybeSingle();
        if (assignmentErr) {
            console.error('[controller/setup] lecture des affectations :', assignmentErr.message);
            return NextResponse.json({ error: 'Recherche de l’invitation impossible. Réessayez.' }, { status: 500 });
        }

        if (!assignment) {
            return NextResponse.json({ error: 'Aucune invitation contrôleur trouvée pour ce numéro.' }, { status: 404 });
        }

        // Faille 1.2 : Récupérer le compte Auth Supabase et vérifier s'il s'agit d'un compte coquille
        const { data: authUserData, error: authUserErr } = await supabase.auth.admin.getUserById(profile.id);
        const authUser = authUserData?.user;

        if (authUserErr || !authUser) {
            if (authUserErr) console.error('[controller/setup] getUserById :', authUserErr.message);
            return NextResponse.json({ error: 'Compte d\'authentification introuvable.' }, { status: 404 });
        }

        // Si le compte n'est pas un compte temporaire ("coquille") créé lors d'une première invitation,
        // c'est un compte utilisateur établi qui possède déjà ses propres identifiants.
        // /controller/setup refuse d'écraser le mot de passe existant et invite à se connecter.
        // Lot 9 quater (A3 : AUD-02) : marque lue dans app_metadata (service_role seul), jamais dans user_metadata
        const isTemporaryShellAccount = isControllerActivationPending(authUser);
        if (!isTemporaryShellAccount) {
            return NextResponse.json({
                error: 'Ce compte possède déjà un mot de passe actif. Veuillez vous connecter avec vos identifiants existants.',
                code: 'ACCOUNT_ALREADY_CONFIGURED',
                redirect: '/login',
            }, { status: 400 });
        }

        // MULTI-RÔLE : s'assurer que CONTROLEUR est dans user_roles (sans écraser les autres rôles)
        const { data: existingRoles, error: rolesErr } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);
        if (rolesErr) {
            console.error('[controller/setup] lecture des rôles :', rolesErr.message);
            return NextResponse.json({ error: 'Erreur de configuration du compte.' }, { status: 500 });
        }
        const hasControllerRole = (existingRoles || []).some(r => r.role === 'CONTROLEUR');
        if (!hasControllerRole) {
            const { error: roleError } = await addUserRole(profile.id, 'CONTROLEUR');
            if (roleError) {
                console.error('[setup] Ajout rôle CONTROLEUR échoué:', roleError);
                return NextResponse.json({ error: 'Erreur de configuration du compte.' }, { status: 500 });
            }
        }

        // 3. Définir le mot de passe définitif via Supabase Auth Admin, puis verrouiller le statut coquille.
        //    Lot 9 bis (R29, reste S3) : deux appels, le mot de passe d'abord, pendant que le compte est encore marqué
        //    coquille : le trigger notif_on_password_changed (M09) n'émet pas PASSWORD_CHANGED pour cette activation.
        //    Un échec du second appel laisse le compte coquille (une nouvelle activation reste possible) et est dit.
        //    Lot 9 quater (A3) : permis PASSWORD posé avant (la base refuse tout changement de mot de passe sans lui) ;
        //    marque retirée de app_metadata (service_role seul).
        try {
            await grantAuthWritePermit(profile.id, 'PASSWORD');
        } catch (permitErr) {
            console.error(`[controller/setup] permis du mot de passe (code ${otpCheck.id} déjà consommé) :`, permitErr instanceof Error ? permitErr.message : String(permitErr));
            return NextResponse.json({
                error: 'Impossible de définir le mot de passe. Demandez une nouvelle invitation à votre organisateur.',
                code: 'PASSWORD_SET_FAILED',
            }, { status: 500 });
        }
        const { error: pwdErr } = await supabase.auth.admin.updateUserById(profile.id, { password: new_password })
            .then(async (first) => first.error ? first : supabase.auth.admin.updateUserById(profile.id, {
                app_metadata: { [CONTROLLER_ACTIVATION_KEY]: false },
            }));

        if (pwdErr) {
            console.error(`[controller/setup] updateUserById (code ${otpCheck.id} déjà consommé) :`, pwdErr.message);
            return NextResponse.json({
                error: 'Impossible de définir le mot de passe. Demandez une nouvelle invitation à votre organisateur.',
                code: 'PASSWORD_SET_FAILED',
            }, { status: 500 });
        }

        // 4. Code déjà consommé à l'étape 1 (lot 7, D22).

        // 4 bis. Lot 6 (B1) : le code reçu par SMS prouve la possession du numéro. Première date
        //        conservée (aucune écriture si elle est déjà posée) ; une erreur n'est jamais avalée.
        const { error: verifyErr } = await supabase
            .from('users')
            .update({ phone_verified_at: new Date().toISOString() })
            .eq('id', profile.id)
            .is('phone_verified_at', null);
        if (verifyErr) {
            console.error('[controller/setup] phone_verified_at :', verifyErr.message);
            return NextResponse.json({
                error: 'Vérification momentanément impossible. Demandez un nouveau code.',
                code: 'PHONE_VERIFY_FAILED',
            }, { status: 503 });
        }

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

        // 6. Lot 6 (J2.12) : avis d'activation (in-app, SMS) mis en file par la boîte d'envoi, une fois par
        //    compte (clé CONTROLLER_ACTIVATED:<compte>). Le mot de passe est déjà posé (GoTrue, hors
        //    transaction) : un échec de mise en file est journalisé et rendu explicite dans la réponse.
        let activationNotice: 'QUEUED' | 'FAILED' = 'QUEUED';
        const { data: notice, error: noticeErr } = await supabase.rpc('notification_controller_activated', { p: { user_id: profile.id } });
        const noticeReply = (notice ?? null) as { ok?: boolean; code?: string } | null;
        if (noticeErr || noticeReply?.ok !== true) {
            activationNotice = 'FAILED';
            console.error('[controller/setup] avis d’activation non mis en file :', noticeErr?.message ?? noticeReply?.code ?? 'réponse vide');
        }

        return NextResponse.json({
            success: true,
            message: 'Mot de passe défini. Vous pouvez maintenant vous connecter.',
            activation_notice: activationNotice,
        });

    } catch (err: unknown) {
        console.error('[API /api/controller/setup]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
