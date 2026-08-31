import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RegisterClientSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { otpMemoryCache } from '@/lib/sms/otp-cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register
 * Enregistrement serveur robuste utilisant l'API Admin Supabase (contourne les triggers défaillants)
 */
export async function POST(req: NextRequest) {
    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        // 1. Validation des données avec Zod
        const parseResult = RegisterClientSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données d\'inscription invalides.';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const { firstName, lastName, phone, email, password, referralCode } = parseResult.data;
        const normalizedPhone = normalizePhoneNumber(phone.trim());
        const effectiveEmail = email?.trim().toLowerCase() || `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

        // Détection Superadmin — exclusivement via SUPERADMIN_PHONE (virgule-séparé), jamais de numéro en dur
        const cleanDigits = normalizedPhone.replace(/\D/g, '');
        const superadminNumbers = (process.env.SUPERADMIN_PHONE || '')
            .split(',')
            .map(n => n.replace(/\D/g, '').trim())
            .filter(n => n.length > 0);

        const isSuperadminNumber = superadminNumbers.length > 0 && superadminNumbers.some(n =>
            cleanDigits === n ||
            cleanDigits === `221${n}` ||
            `221${cleanDigits}` === n
        );

        const assignedRole: 'SUPERADMIN' | 'CLIENT' = isSuperadminNumber ? 'SUPERADMIN' : 'CLIENT';

        // 2. Générer et envoyer le SMS OTP EN PREMIER — aucun compte ne sera créé si la livraison échoue
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000;

        try {
            await mTargetService.sendOtp(normalizedPhone, otpCode);
        } catch (smsErr) {
            const smsMsg = smsErr instanceof Error ? smsErr.message : 'Échec envoi SMS';
            console.error('[API /api/auth/register] Échec envoi SMS OTP:', smsMsg);
            return NextResponse.json(
                { error: 'Impossible d\'envoyer le code de vérification SMS. Vérifiez votre numéro et réessayez.' },
                { status: 503 }
            );
        }

        // SMS envoyé avec succès — on peut maintenant stocker le code en mémoire
        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt: otpExpiresAt, attempts: 0 });

        const supabaseAdmin = getServiceRoleClient();

        // 3. Création de l'utilisateur avec Supabase Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: effectiveEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                email: effectiveEmail,
                role: assignedRole,
                referral_code: referralCode?.trim() || '',
            },
        });

        if (authError) {
            console.error('[API /api/auth/register] Erreur Supabase Admin createUser:', authError);
            if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                return NextResponse.json(
                    { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 3. Insertion / Synchronisation directe dans public.users avec droits Service Role
        try {
            const { error: profileError } = await supabaseAdmin.from('users').upsert({
                id: userId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                email: effectiveEmail,
                role: assignedRole,
                status: 'ACTIF',
                referral_status: 'STANDARD',
                updated_at: new Date().toISOString(),
            });

            if (profileError) {
                console.warn('[API /api/auth/register] Warning insertion profile users:', profileError);
            }
        } catch (profileErr) {
            console.warn('[API /api/auth/register] Exception insertion profile users:', profileErr);
        }

        // 4. Lien de parrainage : créer referral_relationships si referralCode fourni
        if (referralCode?.trim()) {
            try {
                const code = referralCode.trim().toUpperCase();
                const { data: sponsor } = await supabaseAdmin
                    .from('users')
                    .select('id, referral_status')
                    .eq('referral_code', code)
                    .neq('id', userId)
                    .maybeSingle();

                if (sponsor) {
                    const { data: config } = await supabaseAdmin
                        .from('referral_config')
                        .select('rate_n1, rate_n2, duration_months')
                        .eq('sponsor_status', sponsor.referral_status)
                        .eq('referral_type', 'CLIENT_TO_CLIENT')
                        .eq('is_active', true)
                        .maybeSingle();

                    if (config) {
                        const expiresAt = new Date();
                        expiresAt.setMonth(expiresAt.getMonth() + (config.duration_months as number));

                        await supabaseAdmin.from('referral_relationships').insert({
                            sponsor_id: sponsor.id,
                            referred_id: userId,
                            referral_type: 'CLIENT_TO_CLIENT',
                            sponsor_status_at_creation: sponsor.referral_status,
                            rate_n1_at_creation: config.rate_n1,
                            rate_n2_at_creation: config.rate_n2,
                            duration_months: config.duration_months,
                            expires_at: expiresAt.toISOString(),
                            is_active: true,
                        });
                    }
                }
            } catch (refErr) {
                console.warn('[API /api/auth/register] Erreur création relation parrainage:', refErr);
            }
        }

        // 5. Persister le code OTP en base maintenant qu'on a le userId
        try {
            await (supabaseAdmin.from('otp_codes') as any).insert({
                user_id: userId,
                phone: normalizedPhone,
                code: otpCode,
                expires_at: new Date(otpExpiresAt).toISOString(),
                verified: false,
            });
        } catch (dbErr) {
            // Non-bloquant : le cache mémoire suffit pour la vérification immédiate
            console.warn('[API /api/auth/register] Impossible de persister otp_codes en DB:', dbErr instanceof Error ? dbErr.message : 'unknown');
        }

        return NextResponse.json({
            success: true,
            userId,
            phone: normalizedPhone,
            email: effectiveEmail,
            message: `Compte créé avec succès. Un code SMS a été envoyé au ${normalizedPhone}.`,
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[API /api/auth/register] Exception inattendue:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
