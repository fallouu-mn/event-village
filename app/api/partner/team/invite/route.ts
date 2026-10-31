import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomInt } from 'crypto';
import crypto from 'crypto';
import { requireActiveSession, serverIsPartner, serverHasRole, serverHasAnyRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { phoneStorageForms, toSenegaleseE164 } from '@/lib/validations/auth';
import { maskPersonName } from '@/lib/security/mask';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { AdminService } from '@/lib/admin/admin.service';
import { isEventEligibleForController, INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '@/lib/events/event-status';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { addUserRole, grantUserRoles } from '@/lib/auth/roles';
import { refuseInactiveAccount } from '@/lib/auth/account-status';

export const dynamic = 'force-dynamic';

const InviteSchema = z.object({
    event_id:        z.string().uuid('ID événement invalide.').optional(),
    eventId:         z.string().uuid('ID événement invalide.').optional(),
    event_ids:       z.array(z.string().uuid('ID événement invalide.')).optional(),
    eventIds:        z.array(z.string().uuid('ID événement invalide.')).optional(),
    phone:           z.string().min(8, 'Numéro de téléphone requis.'),
    first_name:      z.string().trim().optional(),
    firstName:       z.string().trim().optional(),
    last_name:       z.string().trim().optional(),
    lastName:        z.string().trim().optional(),
    email:           z.string().email('Format email invalide.').optional().or(z.literal('')),
    can_accept_cash:   z.boolean().optional(),
    canAcceptCash:     z.boolean().optional(),
    resend:            z.boolean().optional().default(false),
    confirm_promotion: z.boolean().optional().default(false),
    confirmPromotion:  z.boolean().optional().default(false),
}).transform(data => ({
    event_id:          data.event_id || data.eventId,
    event_ids:         data.event_ids || data.eventIds,
    phone:             data.phone,
    first_name:        data.first_name || data.firstName || 'Contrôleur',
    last_name:         data.last_name || data.lastName || '',
    email:             data.email,
    can_accept_cash:   data.can_accept_cash ?? data.canAcceptCash ?? false,
    resend:            data.resend ?? false,
    confirm_promotion: Boolean(data.confirm_promotion || data.confirmPromotion),
}));

export async function POST(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = InviteSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        // Lot 1C.1 : `email` et les noms saisis ne s'appliquent jamais à un compte existant, et un
        // compte créé par invitation reçoit l'email de connexion synthétique lié au numéro.
        const { event_id, event_ids, phone, first_name, last_name, can_accept_cash, confirm_promotion } = parse.data;
        const targetEventIds = (event_ids && event_ids.length > 0)
            ? Array.from(new Set(event_ids))
            : (event_id ? [event_id] : []);

        if (targetEventIds.length === 0) {
            return NextResponse.json({ error: 'Veuillez sélectionner au moins un événement.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();
        // Lot 1C.1 : numéro mobile sénégalais E.164 exigé (plus de recherche par suffixe)
        const e164 = toSenegaleseE164(phone);
        if (!e164) {
            return NextResponse.json({
                error: 'Numéro de téléphone sénégalais invalide (ex : 77 123 45 67).',
                code: 'INVALID_PHONE',
            }, { status: 400 });
        }
        const normalizedPhone = e164;

        // 0. Rate limiting (Faille 2.2 & Hardening) — invitations SMS (20/24h et 20/h par partenaire, 3/jour par numéro cible)
        const partnerDailyRateKey  = `sms_daily_quota_partner:${user.id}`;
        const partnerHourlyRateKey = `sms_invite_partner:${user.id}`;
        const phoneRateKey         = `sms_invite_phone:${normalizedPhone}`;

        const [partnerDailyLimit, partnerHourlyLimit, phoneLimit] = await Promise.all([
            RateLimiter.isRateLimited(partnerDailyRateKey, { maxAttempts: 20, windowSeconds: 86400, lockoutSeconds: 86400, failClosed: true }),
            RateLimiter.isRateLimited(partnerHourlyRateKey, { maxAttempts: 20, windowSeconds: 3600, lockoutSeconds: 3600 }),
            RateLimiter.isRateLimited(phoneRateKey, { maxAttempts: 3, windowSeconds: 86400, lockoutSeconds: 86400 }),
        ]);

        if (partnerDailyLimit.limited) {
            return NextResponse.json({
                error: 'Quota SMS journalier atteint : maximum 20 invitations par 24h par partenaire. Contactez le support pour augmenter votre quota.',
                code: 'PARTNER_DAILY_SMS_QUOTA_EXCEEDED',
            }, { status: 429 });
        }

        if (partnerHourlyLimit.limited) {
            return NextResponse.json({
                error: 'Limite d\'envoi atteinte : maximum 20 invitations par heure par partenaire. Réessayez plus tard.',
                code: 'PARTNER_INVITE_RATE_LIMIT',
            }, { status: 429 });
        }

        if (phoneLimit.limited) {
            return NextResponse.json({
                error: 'Trop d\'invitations envoyées à ce numéro aujourd\'hui (maximum 3 par 24h).',
                code: 'PHONE_INVITE_RATE_LIMIT',
            }, { status: 429 });
        }

        // 1. Vérifier que les événements appartiennent bien au partenaire et sont éligibles
        const { data: partnerEvents, error: evErr } = await supabase
            .from('events')
            .select('id, title, partner_id, status')
            .in('id', targetEventIds);

        if (evErr || !partnerEvents || partnerEvents.length !== targetEventIds.length) {
            return NextResponse.json({ error: 'Un ou plusieurs événements sélectionnés sont introuvables.' }, { status: 404 });
        }

        if (serverHasRole(user, 'PARTENAIRE')) {
            const { data: partnerRec } = await supabase
                .from('partners').select('id').eq('user_id', user.id).maybeSingle();
            const hasUnauthorized = partnerEvents.some(ev => ev.partner_id !== partnerRec?.id);
            if (!partnerRec || hasUnauthorized) {
                return NextResponse.json({ error: 'Vous n\'êtes pas propriétaire de tous les événements sélectionnés.' }, { status: 403 });
            }
        }

        // Vérification stricte de l'éligibilité opérationnelle des événements
        const ineligibleEvent = partnerEvents.find(ev => !isEventEligibleForController(ev.status));
        if (ineligibleEvent) {
            return NextResponse.json({
                error: INELIGIBLE_EVENT_ASSIGNMENT_ERROR,
                details: `L'événement "${ineligibleEvent.title}" est en statut ${ineligibleEvent.status}. Seuls les événements confirmés (VALIDÉ ou PUBLIÉ) peuvent être affectés.`,
            }, { status: 400 });
        }

        // 2. Trouver ou créer le compte contrôleur
        let controllerUserId: string;
        let isNewUser = false;

        // Lot 1C.1 : égalité exacte sur les deux formes stockées du même numéro (+221… et 221…)
        const { data: matches, error: lookupErr } = await supabase
            .from('users')
            .select('id, role, status, first_name, last_name')
            .in('phone', phoneStorageForms(normalizedPhone))
            .limit(2);
        if (lookupErr) {
            console.error('[invite-controller] recherche du compte par téléphone :', lookupErr.message);
            return NextResponse.json({ error: 'Recherche du compte impossible. Réessayez.' }, { status: 500 });
        }
        if ((matches ?? []).length > 1) {
            console.error(`[invite-controller] plusieurs comptes portent le numéro ${normalizedPhone}`);
            return NextResponse.json({
                error: 'Plusieurs comptes correspondent à ce numéro. Contactez le support.',
                code: 'AMBIGUOUS_PHONE',
            }, { status: 409 });
        }
        const existingProfile = (matches ?? [])[0] ?? null;

        if (existingProfile) {
            // Lot 1B.6 : un compte non ACTIF (SUSPENDU, SUPPRIME…) n'est jamais réactivé par une invitation.
            if (existingProfile.status !== 'ACTIF') {
                return refuseInactiveAccount({
                    actor: user,
                    targetId: existingProfile.id,
                    targetStatus: existingProfile.status,
                    action: 'CONTROLLER_INVITE_REFUSED_INACTIVE',
                    context: { event_ids: targetEventIds, phone: normalizedPhone },
                });
            }
            controllerUserId = existingProfile.id;

            // Vérifier si l'utilisateur possède déjà le rôle CONTROLEUR via user_roles
            const { data: existingRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', existingProfile.id);
            const currentRoles = (existingRoles || []).map(r => r.role as string);
            const alreadyController =
                currentRoles.includes('CONTROLEUR') ||
                currentRoles.includes('ADMIN') ||
                currentRoles.includes('SUPERADMIN') ||
                existingProfile.role === 'CONTROLEUR' ||
                existingProfile.role === 'ADMIN' ||
                existingProfile.role === 'SUPERADMIN';

            if (!alreadyController) {
                // Lot 1C.1 : confirmation explicite obligatoire (« resend » ne la contourne plus).
                // Le partenaire ne voit que le nom masqué du titulaire : ni identifiant, ni rôles.
                if (!confirm_promotion) {
                    const displayName = maskPersonName(existingProfile.first_name, existingProfile.last_name);
                    return NextResponse.json({
                        requires_confirmation: true,
                        code: 'EXISTING_ACCOUNT',
                        existing_user: { display_name: displayName, phone: normalizedPhone },
                        message: `Ce numéro appartient déjà à un compte Event Village (${displayName}). Confirmez-vous l'affectation de ce titulaire comme contrôleur de vos événements ? Son identité et ses identifiants ne seront pas modifiés.`,
                    }, { status: 200 });
                }

                // MULTI-RÔLE : ajout de CONTROLEUR sans toucher au compte (ni nom, ni email,
                // ni téléphone, ni mot de passe, ni statut). users.role est recalculé par le trigger.
                const { error: roleError } = await addUserRole(existingProfile.id, 'CONTROLEUR');
                if (roleError) {
                    console.error('[invite] Ajout rôle CONTROLEUR échoué:', roleError);
                    return NextResponse.json({
                        error: 'Impossible d\'ajouter le rôle Contrôleur. Réessayez.',
                    }, { status: 500 });
                }
            }
        } else {
            isNewUser = true;
            const tempPassword = crypto.randomUUID();
            // Lot 1C.1 : email de connexion synthétique lié au numéro, jamais choisi par le partenaire
            // (sinon le partenaire pourrait réinitialiser le mot de passe du contrôleur par email).
            const contactEmail = `${normalizedPhone.replace('+', '')}@eventvillage.sn`;
            const cleanFirstName = (first_name || 'Contrôleur').trim();
            const cleanLastName = (last_name || '').trim();

            // Stratégie résiliente : Vérifier si l'utilisateur existe déjà dans auth.users
            const { data: authUsersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const matchingAuthUser = authUsersList?.users?.find(
                u => u.phone === normalizedPhone || u.email === contactEmail || u.phone === normalizedPhone.replace('+', '')
            );

            if (matchingAuthUser) {
                // Lot 1B.6 : un compte d'authentification existe déjà pour cet email ou ce numéro.
                // La route le réécrivait (email, téléphone, mot de passe) et le remettait ACTIF :
                // prise de contrôle d'un compte tiers et réactivation. Refus explicite.
                console.warn(`[invite-controller] compte d'authentification existant ${matchingAuthUser.id} : invitation refusée`);
                return NextResponse.json({
                    error: 'Un compte existe déjà avec cet email ou ce numéro. Invitez-le par le numéro de téléphone de son profil, ou contactez le support.',
                    code: 'ACCOUNT_ALREADY_EXISTS',
                }, { status: 409 });
            } else {
                // Tentative de création standard d'un compte contrôleur temporaire
                const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                    email:          contactEmail,
                    email_confirm:  true,
                    phone:          normalizedPhone,
                    phone_confirm:  true,
                    password:       tempPassword,
                    user_metadata:  {
                        phone: normalizedPhone,
                        first_name: cleanFirstName,
                        last_name: cleanLastName,
                        is_temporary_controller_account: true,
                    },
                });

                // Faille 1.3 : Zéro recyclage de compte orphelin — échec explicite et propre
                if (authErr || !authData?.user) {
                    console.error('[invite-controller] Échec création auth compte contrôleur:', authErr?.message);
                    return NextResponse.json({
                        error: 'Impossible de créer le compte contrôleur. Vérifiez le numéro et réessayez.',
                    }, { status: 500 });
                }

                controllerUserId = authData.user.id;
            }

            // Insertion garantie dans public.users avec rôle legacy CONTROLEUR
            const { error: upsertErr } = await supabase.from('users').upsert({
                id:              controllerUserId,
                role:            'CONTROLEUR',
                status:          'ACTIF',
                referral_status: 'STANDARD',
                first_name:      cleanFirstName,
                last_name:       cleanLastName,
                phone:           normalizedPhone,
                email:           contactEmail,
                updated_at:      new Date().toISOString(),
            });

            if (upsertErr) {
                console.error('[invite-controller] users upsert échoué:', upsertErr.message);
                return NextResponse.json({
                    error: 'Impossible de configurer le profil contrôleur.',
                }, { status: 500 });
            }

            // MULTI-RÔLE : CLIENT + CONTROLEUR dans user_roles (erreur remontée, pas ignorée)
            try {
                await grantUserRoles(controllerUserId, ['CONTROLEUR']);
            } catch (roleErr) {
                console.error('[invite-controller]', roleErr instanceof Error ? roleErr.message : roleErr);
                return NextResponse.json({ error: 'Impossible d\'attribuer le rôle Contrôleur.' }, { status: 500 });
            }
        }

        // 3. Traiter les assignations pour chaque événement sélectionné
        const finalAssignments: any[] = [];
        let anyNewlyAssigned = false;

        for (const evId of targetEventIds) {
            const { data: alreadyAssigned } = await supabase
                .from('event_controllers')
                .select('id, event_id, user_id, can_accept_cash, created_at')
                .eq('event_id', evId)
                .eq('user_id', controllerUserId)
                .maybeSingle();

            if (alreadyAssigned) {
                let updatedAssignment = alreadyAssigned;
                if (can_accept_cash !== undefined && can_accept_cash !== alreadyAssigned.can_accept_cash) {
                    const { data: updated, error: updateErr } = await supabase
                        .from('event_controllers')
                        .update({ can_accept_cash })
                        .eq('id', alreadyAssigned.id)
                        .select('id, event_id, user_id, can_accept_cash, created_at')
                        .single();
                    if (!updateErr && updated) {
                        updatedAssignment = updated;
                    }
                }
                finalAssignments.push(updatedAssignment);
            } else {
                anyNewlyAssigned = true;
                const { data: assignment, error: insertErr } = await supabase
                    .from('event_controllers')
                    .insert({ event_id: evId, user_id: controllerUserId, can_accept_cash, created_by: user.id })
                    .select('id, event_id, user_id, can_accept_cash, created_at')
                    .single();

                if (insertErr) {
                    console.error('[invite-controller] Insert event_controllers error:', insertErr.message);
                } else if (assignment) {
                    finalAssignments.push(assignment);
                    // Audit log par assignation
                    const evTitle = partnerEvents.find(e => e.id === evId)?.title || 'Événement';
                    await AdminService.logAudit({
                        userId: user.id,
                        userRole: user.role as any,
                        action: 'CONTROLLER_INVITED',
                        objectType: 'event_controllers',
                        objectId: assignment.id,
                        newValue: {
                            event_id: evId, controller_user_id: controllerUserId,
                            can_accept_cash, is_new_user: isNewUser,
                        },
                        metadata: { invited_by: user.id, event_title: evTitle },
                    });
                }
            }
        }

        // 4. Code d'activation (24 h) : seulement pour un compte créé par cette invitation. Un compte
        //    existant garde ses identifiants ; aucun code n'est émis sur son numéro (lot 1C.1 :
        //    un code émis remplaçait le code en attente du titulaire).
        const otpCode   = randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        if (isNewUser) {
            // Lot 1B.7 : code d'activation en base uniquement (vérifié par /api/controller/setup).
            try {
                await storeOtp(normalizedPhone, otpCode, new Date(expiresAt));
            } catch (storeErr) {
                console.error('[invite-controller]', storeErr instanceof Error ? storeErr.message : storeErr);
                return NextResponse.json({ error: 'Impossible de préparer le code d\'activation. Réessayez.' }, { status: 500 });
            }
        }

        const baseUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const setupLink = `${baseUrl}/controller/setup?phone=${encodeURIComponent(normalizedPhone)}`;

        let smsSent = false;
        try {
            if (isNewUser) {
                const smsRes = await mTargetService.sendControllerInvite(
                    normalizedPhone,
                    otpCode,
                    setupLink,
                    first_name && first_name !== 'Contrôleur' ? first_name : undefined
                );
                smsSent = smsRes.success;
                if (!smsRes.success) {
                    console.warn('[invite-controller] SMS mTarget non délivré:', smsRes.error);
                }
            } else {
                // Compte client existant : possède déjà son propre mot de passe ; le SMS le salue par
                // le prénom de son profil, jamais par un nom saisi par le partenaire.
                const name = existingProfile?.first_name || '';
                const greeting = name.trim() ? `Bonjour ${name.trim()}, ` : '';
                const countEv = targetEventIds.length;
                const evSuffix = countEv > 1 ? `pour ${countEv} événements` : `pour l'événement`;
                const loginLink = `${baseUrl}/login`;
                const smsMsg = `Event Village : ${greeting}vous avez été désigné comme contrôleur ${evSuffix}. Connectez-vous avec vos identifiants habituels : ${loginLink}`;
                const smsRes = await mTargetService.sendNotification(normalizedPhone, smsMsg);
                smsSent = smsRes.success;
                if (!smsRes.success) {
                    console.warn('[invite-controller] SMS notification non délivré:', smsRes.error);
                }
            }
        } catch (smsErr) {
            console.warn('[invite-controller] SMS non bloquant:', smsErr instanceof Error ? smsErr.message : smsErr);
        }

        // Enregistrer la tentative pour le rate limiting (Faille 2.2 & Hardening)
        await Promise.all([
            RateLimiter.recordAttempt(partnerDailyRateKey),
            RateLimiter.recordAttempt(partnerHourlyRateKey),
            RateLimiter.recordAttempt(phoneRateKey),
        ]);

        const countEvents = targetEventIds.length;
        const msgSuffix = countEvents > 1 ? `sur ${countEvents} événements` : `sur l'événement`;
        const actionMsg = isNewUser
            ? `Contrôleur créé et assigné ${msgSuffix}. SMS avec code d'activation envoyé.`
            : anyNewlyAssigned
                ? `Contrôleur assigné avec succès ${msgSuffix}. SMS envoyé.`
                : `Droits mis à jour ${msgSuffix}. Nouveau SMS d'accès envoyé.`;

        return NextResponse.json({
            success:      true,
            assignments:  finalAssignments,
            assignment:   finalAssignments[0] || null,
            is_new_user:  isNewUser,
            message:      actionMsg,
            // Lot 1C.1 : le code d'activation n'est jamais renvoyé au partenaire (il part par SMS).
        }, { status: anyNewlyAssigned || isNewUser ? 201 : 200 });

    } catch (err: unknown) {
        console.error('[API /api/partner/team/invite]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
