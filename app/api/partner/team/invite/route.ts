import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomInt } from 'crypto';
import crypto from 'crypto';
import { requireActiveSession, serverIsPartner, serverHasRole, serverHasAnyRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { INVALID_SN_PHONE_MESSAGE, phoneStorageForms, toSenegaleseE164 } from '@/lib/validations/auth';
import { maskPersonName } from '@/lib/security/mask';
import { maskPhone } from '@/lib/payments/payer-phone';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { AdminService } from '@/lib/admin/admin.service';
import { isEventEligibleForController, INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '@/lib/events/event-status';
import { getServerEnv } from '@/lib/env';
import { releaseQuota, reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { addUserRole, grantUserRoles } from '@/lib/auth/roles';
import { refuseInactiveAccount } from '@/lib/auth/account-status';
import { createControllerInvitation } from '../controller-invitation';
import { adminTeamRefusal } from '../team-access';
import { newTechnicalEmail } from '@/lib/auth/technical-email';
import { CONTROLLER_ACTIVATION_KEY, isControllerActivationPending } from '@/lib/auth/controller-activation';
import { contactSupport } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

/** Fenêtre du quota INVITE_PER_PHONE_DAY (une journée), la même à la réservation et au rendu. */
const PHONE_WINDOW_SECS = 86_400;

/**
 * Lot 9 bis (R75, D-txt 2) : raison d'un SMS d'activation non parti, dite en mots ; le code reste dans `sms_refusal`
 * et au journal, jamais dans le message montré au partenaire.
 */
function smsRefusalReason(code: string | null): string {
    switch (code) {
        case 'SMS_RATE_LIMITED': return 'trop d’envois vers ce numéro aujourd’hui';
        case 'SMS_ACCOUNT_LIMIT_REACHED': return 'limite d’envois de votre compte atteinte pour aujourd’hui';
        case 'SMS_DAILY_CAP_REACHED': return 'limite d’envois de la plateforme atteinte pour aujourd’hui';
        default: return 'le service SMS n’a pas confirmé l’envoi';
    }
}

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
    // Lot 9 bis (R98, fix(9b.43-SC)) : unité INVITE_PER_PHONE_DAY réservée (numéro) et consommée par un message parti
    let phoneUnitBucket: string | null = null;
    let phoneUnitUsed = false;
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
        // Lot 9 bis (R2, B31) : un admin invite un contrôleur avec events.write (avant le quota et tout effet)
        const denied = await adminTeamRefusal(user, 'events.write');
        if (denied) return denied;

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
                error: INVALID_SN_PHONE_MESSAGE,
                code: 'INVALID_PHONE',
            }, { status: 400 });
        }
        const normalizedPhone = e164;

        // Lot 9 quater (A9 : AUD-35) : quota du partenaire, propriété et éligibilité des événements AVANT toute lecture du
        // compte invité : aucune réponse qui dépend de ce compte (ALREADY_ACTIVATED, EXISTING_ACCOUNT…) n'est donnée à un
        // appelant hors quota ou sur des événements qui ne sont pas les siens. Les réponses elles-mêmes sont inchangées.
        // 0. Lot 4.8 : quota en base par partenaire (INVITE_PER_PARTNER_HOUR), réservé à chaque tentative avant
        //    tout autre contrôle. Garde indisponible : refus (503). Les SMS envoyés sont en plus comptés sur le
        //    compte du partenaire (SMS_PER_ACCOUNT_DAY, lib/sms/sms-guard.ts).
        //    Lot 9 bis (R98, B90, fix(9b.43-SC)) : le quota par numéro (INVITE_PER_PHONE_DAY) n'est plus réservé ici ;
        //    il l'est plus bas, seulement si un message part au numéro (voir 1 bis).
        const env = getServerEnv();
        const quota = await reserveQuota([
            { scope: 'invite_partner', bucket: user.id, windowSecs: 3600, max: env.INVITE_PER_PARTNER_HOUR },
        ], 'invitation contrôleur');
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, { error: `Limite d'invitations atteinte : maximum ${env.INVITE_PER_PARTNER_HOUR} par heure. Réessayez plus tard.`, code: 'PARTNER_INVITE_RATE_LIMIT' });
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

        // 0 bis. Lot 9 bis (R38, B63) : compte du numéro lu avant le quota. « Renvoyer le SMS » vers un compte déjà
        //    activé (ou établi) n'enverrait rien : refus 409 ALREADY_ACTIVATED sans rien consommer.
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
            // Lot 9 quater (A9 : AUD-33) : numéro masqué dans le journal
            console.error(`[invite-controller] plusieurs comptes portent le numéro ${maskPhone(normalizedPhone)}`);
            return NextResponse.json({
                error: `Plusieurs comptes correspondent à ce numéro. ${contactSupport()}`,
                code: 'AMBIGUOUS_PHONE',
            }, { status: 409 });
        }
        const existingProfile = (matches ?? [])[0] ?? null;
        // Lot 7 (D22) : compte existant encore temporaire (créé par une invitation, jamais activé)
        let isPendingActivation = false;
        let alreadyController = false;
        if (existingProfile) {
            // Lot 7 (D22) : un compte créé par une invitation et jamais activé (aucun mot de passe choisi)
            // reçoit un nouveau code d'activation ; un compte établi garde ses identifiants (lot 1C.1).
            const { data: existingAuth, error: existingAuthErr } = await supabase.auth.admin.getUserById(existingProfile.id);
            if (existingAuthErr || !existingAuth?.user) {
                console.error('[invite-controller] lecture du compte d’authentification :', existingAuthErr?.message ?? 'compte absent');
                return NextResponse.json({ error: 'Recherche du compte impossible. Réessayez.' }, { status: 500 });
            }
            // Lot 9 quater (A3 : AUD-02) : marque lue dans app_metadata (service_role seul), jamais dans user_metadata
            isPendingActivation = isControllerActivationPending(existingAuth.user);

            // Vérifier si l'utilisateur possède déjà le rôle CONTROLEUR via user_roles
            const { data: existingRoles, error: existingRolesErr } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', existingProfile.id);
            if (existingRolesErr) {
                console.error('[invite-controller] lecture des rôles :', existingRolesErr.message);
                return NextResponse.json({ error: 'Recherche du compte impossible. Réessayez.' }, { status: 500 });
            }
            const currentRoles = (existingRoles || []).map(r => r.role as string);
            alreadyController =
                currentRoles.includes('CONTROLEUR') ||
                currentRoles.includes('ADMIN') ||
                currentRoles.includes('SUPERADMIN') ||
                existingProfile.role === 'CONTROLEUR' ||
                existingProfile.role === 'ADMIN' ||
                existingProfile.role === 'SUPERADMIN';
        }
        // Reste S3 (R38, lot 1C.1) : le refus vise un contrôleur déjà activé (son texte le dit). Un compte établi qui
        // n'est pas encore contrôleur suit le chemin de l'invitation : « resend » ne contourne pas la confirmation
        // (invitation-identite:127, requires_confirmation), aucun rôle sans son accord.
        if (parse.data.resend && existingProfile && !isPendingActivation && alreadyController) {
            return NextResponse.json({
                error: 'Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé.',
                code: 'ALREADY_ACTIVATED',
            }, { status: 409 });
        }

        // 1 ter. Lot 9 ter (0.5, B-D6, B-D8) : un contrôleur déjà établi (compte non temporaire) qu'une partenaire des
        //    événements demandés n'a jamais eu dans son équipe (aucun lien partner_controllers) consent d'abord :
        //    confirmation, puis invitation à accepter (R37), jamais d'affectation directe. Admin agissant : la
        //    partenaire de chaque événement demandé. La RPC controller_assignments_sync applique la même règle.
        let needsConsent = false;
        if (existingProfile && alreadyController && !isPendingActivation) {
            const partnerIds = Array.from(new Set(partnerEvents.map((ev) => ev.partner_id as string | null)));
            for (const partnerId of partnerIds) {
                const { data: known, error: knownErr } = await supabase.rpc('partner_controller_known', {
                    p_partner: partnerId, p_user: existingProfile.id,
                });
                if (knownErr) {
                    console.error('[invite-controller] lien partenaire–contrôleur :', knownErr.message);
                    return NextResponse.json({ error: 'Recherche du compte impossible. Réessayez.' }, { status: 500 });
                }
                if (known !== true) {
                    needsConsent = true;
                    break;
                }
            }
        }

        // 1 bis. Lot 9 bis (R98, B90, fix(9b.43-SC)) : une unité INVITE_PER_PHONE_DAY n'est réservée que si un message
        //    part au numéro : SMS d'activation (numéro neuf ou compte encore temporaire) ou invitation à accepter
        //    (compte établi, après la confirmation ; lot 9 ter : contrôleur inconnu de la partenaire compris). L'étape de
        //    confirmation, l'affectation d'un contrôleur déjà connu et un compte non ACTIF (refusé plus bas) ne consomment
        //    rien. Si aucun message ne part finalement (SMS refusé, invitation refusée, erreur), l'unité est rendue
        //    (finally, releaseQuota).
        const willMessage = !existingProfile
            || (existingProfile.status === 'ACTIF'
                && (isPendingActivation ? (alreadyController || confirm_promotion) : ((!alreadyController || needsConsent) && confirm_promotion)));
        if (willMessage) {
            const phoneQuota = await reserveQuota([
                { scope: 'invite_phone', bucket: normalizedPhone, windowSecs: PHONE_WINDOW_SECS, max: env.INVITE_PER_PHONE_DAY },
            ], 'invitation contrôleur (numéro)');
            if (!phoneQuota.allowed) {
                return quotaRefusalResponse(phoneQuota, { error: `Trop d'invitations envoyées à ce numéro aujourd'hui (maximum ${env.INVITE_PER_PHONE_DAY} par jour).`, code: 'PHONE_INVITE_RATE_LIMIT' });
            }
            phoneUnitBucket = normalizedPhone;
        }

        // 2. Trouver ou créer le compte contrôleur (compte du numéro lu en 0 bis)
        let controllerUserId: string;
        let isNewUser = false;

        if (existingProfile) {
            // Lot 1B.6 : un compte non ACTIF (SUSPENDU, SUPPRIME…) n'est jamais réactivé par une invitation.
            if (existingProfile.status !== 'ACTIF') {
                return refuseInactiveAccount({
                    actor: user,
                    targetId: existingProfile.id,
                    targetStatus: existingProfile.status,
                    action: 'CONTROLLER_INVITE_REFUSED_INACTIVE',
                    context: { event_ids: targetEventIds, phone: maskPhone(normalizedPhone) },
                });
            }
            controllerUserId = existingProfile.id;

            if (!alreadyController || needsConsent) {
                // Lot 1C.1 : confirmation explicite obligatoire (« resend » ne la contourne plus).
                // Le partenaire ne voit que le nom masqué du titulaire : ni identifiant, ni rôles.
                // Lot 9 ter (0.5) : un contrôleur établi inconnu de la partenaire suit le même chemin (invitation R37).
                const displayName = maskPersonName(existingProfile.first_name, existingProfile.last_name);
                if (!confirm_promotion) {
                    return NextResponse.json({
                        requires_confirmation: true,
                        code: 'EXISTING_ACCOUNT',
                        existing_user: { display_name: displayName, phone: normalizedPhone },
                        message: needsConsent
                            ? `Ce numéro appartient déjà à un compte Event Village (${displayName}). Ce titulaire n’a jamais contrôlé vos événements : il doit accepter votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ?`
                            : `Ce numéro appartient déjà à un compte Event Village (${displayName}). Confirmez-vous l'affectation de ce titulaire comme contrôleur de vos événements ? Son identité et ses identifiants ne seront pas modifiés.`,
                    }, { status: 200 });
                }

                // Lot 9 bis (R37, B62) : un compte établi devient contrôleur seulement s'il accepte lui-même :
                // invitation (72 h) et CONTROLLER_INVITATION mis en file par la RPC, aucun rôle ni affectation ici.
                // Un compte encore temporaire (créé par une invitation, jamais activé) consent à l'activation : il
                // garde le chemin du code d'activation ci-dessous.
                if (!isPendingActivation) {
                    const ownPartner = serverHasRole(user, 'PARTENAIRE');
                    const invited = await createControllerInvitation(supabase, {
                        actorId: user.id,
                        actorRole: ownPartner ? 'PARTENAIRE' : 'ADMIN',
                        partnerId: ownPartner ? String(partnerEvents[0].partner_id) : null,
                        userId: existingProfile.id,
                        assignments: targetEventIds.map((evId) => ({ event_id: evId, can_accept_cash })),
                    });
                    if (invited.response) return invited.response;
                    phoneUnitUsed = true; // CONTROLLER_INVITATION mis en file par la RPC
                    return NextResponse.json({
                        success: true,
                        assignments: [],
                        assignment: null,
                        is_new_user: false,
                        invitation_id: invited.invitationId,
                        invitation_expires_at: invited.expiresAt,
                        notification: 'QUEUED',
                        message: `Invitation envoyée : ${displayName} doit l’accepter dans l’application avant d’être affecté.`,
                    }, { status: 201 });
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
            // Lot 1C.1 : email de connexion synthétique, jamais choisi par le partenaire (sinon le partenaire pourrait
            // réinitialiser le mot de passe du contrôleur par email). Lot 9 quater (A4 : AUD-19) : adresse technique
            // aléatoire sous .invalid, plus jamais tirée du numéro.
            const contactEmail = newTechnicalEmail();
            const cleanFirstName = (first_name || 'Contrôleur').trim();
            const cleanLastName = (last_name || '').trim();

            // Stratégie résiliente : Vérifier si l'utilisateur existe déjà dans auth.users
            const { data: authUsersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const matchingAuthUser = authUsersList?.users?.find(
                u => u.phone === normalizedPhone || u.phone === normalizedPhone.replace('+', '')
            );

            if (matchingAuthUser) {
                // Lot 1B.6 : un compte d'authentification existe déjà pour cet email ou ce numéro.
                // La route le réécrivait (email, téléphone, mot de passe) et le remettait ACTIF :
                // prise de contrôle d'un compte tiers et réactivation. Refus explicite.
                console.warn(`[invite-controller] compte d'authentification existant ${matchingAuthUser.id} : invitation refusée`);
                return NextResponse.json({
                    error: `Un compte existe déjà avec cet email ou ce numéro. Invitez-le par le numéro de téléphone de son profil, ou ${contactSupport(false)}`,
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
                    },
                    // Lot 9 quater (A3, A5) : marque « à activer » écrite par le service_role seul
                    app_metadata: { [CONTROLLER_ACTIVATION_KEY]: true },
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

        // 3. Traiter les assignations pour chaque événement sélectionné. Lot 6 (J2.4) : les nouvelles
        //    affectations sont insérées en une seule instruction ; le trigger trg_event_controllers_notify
        //    met en file leurs avis (in-app et push par affectation, un seul SMS regroupé par requête).
        const ASSIGNMENT_COLUMNS = 'id, event_id, user_id, can_accept_cash, created_at';
        const finalAssignments: any[] = [];
        let anyNewlyAssigned = false;

        const { data: existingAssignments, error: existingErr } = await supabase
            .from('event_controllers')
            .select(ASSIGNMENT_COLUMNS)
            .eq('user_id', controllerUserId)
            .in('event_id', targetEventIds);
        if (existingErr) {
            console.error('[invite-controller] lecture des affectations existantes :', existingErr.message);
            return NextResponse.json({ error: 'Lecture des affectations impossible. Réessayez.' }, { status: 500 });
        }
        const existingByEvent = new Map((existingAssignments ?? []).map((a) => [a.event_id as string, a]));

        for (const evId of targetEventIds) {
            const alreadyAssigned = existingByEvent.get(evId);
            if (!alreadyAssigned) continue;
            let updatedAssignment = alreadyAssigned;
            if (can_accept_cash !== undefined && can_accept_cash !== alreadyAssigned.can_accept_cash) {
                const { data: updated, error: updateErr } = await supabase
                    .from('event_controllers')
                    .update({ can_accept_cash })
                    .eq('id', alreadyAssigned.id)
                    .select(ASSIGNMENT_COLUMNS)
                    .single();
                if (updateErr || !updated) {
                    console.error('[invite-controller] mise à jour de la permission espèces :', updateErr?.message ?? 'aucune ligne');
                    return NextResponse.json({ error: 'Mise à jour de la permission espèces impossible. Réessayez.' }, { status: 500 });
                }
                updatedAssignment = updated;
            }
            finalAssignments.push(updatedAssignment);
        }

        const toInsert = targetEventIds.filter((evId) => !existingByEvent.has(evId));
        if (toInsert.length > 0) {
            anyNewlyAssigned = true;
            const { data: inserted, error: insertErr } = await supabase
                .from('event_controllers')
                .insert(toInsert.map((evId) => ({ event_id: evId, user_id: controllerUserId, can_accept_cash, created_by: user.id })))
                .select(ASSIGNMENT_COLUMNS);
            if (insertErr || !inserted) {
                console.error('[invite-controller] Insert event_controllers error:', insertErr?.message ?? 'réponse vide');
                return NextResponse.json({ error: 'Impossible d\'enregistrer les affectations. Réessayez.' }, { status: 500 });
            }
            for (const assignment of inserted) {
                finalAssignments.push(assignment);
                const evTitle = partnerEvents.find(e => e.id === assignment.event_id)?.title || 'Événement';
                await AdminService.logAudit({
                    userId: user.id,
                    userRole: user.role as any,
                    action: 'CONTROLLER_INVITED',
                    objectType: 'event_controllers',
                    objectId: assignment.id,
                    newValue: {
                        event_id: assignment.event_id, controller_user_id: controllerUserId,
                        can_accept_cash, is_new_user: isNewUser,
                    },
                    metadata: { invited_by: user.id, event_title: evTitle },
                });
            }
        }

        // 4. Code d'activation (24 h) : pour un compte créé par cette invitation et, depuis le lot 7 (D22),
        //    pour un compte encore temporaire (jamais activé) dont le code a pu expirer, être épuisé ou être
        //    consommé par une activation échouée. Un compte établi garde ses identifiants ; aucun code n'est
        //    émis sur son numéro (lot 1C.1 : un code émis remplaçait le code en attente du titulaire).
        const issueActivationCode = isNewUser || isPendingActivation;
        const otpCode   = randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        let otpId: string | null = null;
        if (issueActivationCode) {
            // Lot 1B.7 : code d'activation en base uniquement (vérifié par /api/controller/setup).
            try {
                otpId = await storeOtp(normalizedPhone, otpCode, new Date(expiresAt), 'CONTROLLER_SETUP');
            } catch (storeErr) {
                console.error('[invite-controller]', storeErr instanceof Error ? storeErr.message : storeErr);
                return NextResponse.json({ error: 'Impossible de préparer le code d\'activation. Réessayez.' }, { status: 500 });
            }
            // Lot 7 (D22) : les codes précédents encore en attente pour ce numéro sont échus tout de suite ;
            // seul le dernier code envoyé active le compte, quel que soit l'ordre des essais.
            const { error: supersedeErr } = await supabase
                .from('otp_codes')
                .update({ expires_at: new Date().toISOString() })
                .eq('phone', normalizedPhone)
                .eq('purpose', 'CONTROLLER_SETUP')
                .eq('verified', false)
                .neq('id', otpId);
            if (supersedeErr) {
                console.error('[invite-controller] codes d’activation précédents non échus :', supersedeErr.message);
                return NextResponse.json({ error: 'Impossible de préparer le code d\'activation. Réessayez.' }, { status: 500 });
            }
        }

        // Lot 8 (L26) : lu à l'exécution ; `process.env.NEXT_PUBLIC_APP_URL` serait figé au build (adresse d'un tunnel)
        const setupLink = `${env.NEXT_PUBLIC_APP_URL}/controller/setup?phone=${encodeURIComponent(normalizedPhone)}`;

        // Lot 6 (E7) : seul un compte à activer (nouveau ou, depuis le lot 7, encore temporaire) reçoit un
        // SMS synchrone (code d'activation et lien), journalisé dans la boîte d'envoi sans le code ni le lien.
        // Un compte établi n'a pas de SMS direct : ses affectations sont annoncées par la boîte d'envoi
        // (trigger, J2.4).
        let smsSent = false;
        let smsRefusal: string | null = null;
        if (issueActivationCode) {
            try {
                const smsRes = await mTargetService.sendControllerInvite(
                    normalizedPhone,
                    otpCode,
                    setupLink,
                    first_name && first_name !== 'Contrôleur' ? first_name : undefined,
                    { actorId: user.id, log: { type: 'CONTROLLER_INVITE', ref: otpId!, userId: controllerUserId, actorId: user.id } }
                );
                smsSent = smsRes.success;
                phoneUnitUsed = smsSent;
                if (!smsRes.success) {
                    smsRefusal = smsRes.code ?? 'SMS_NOT_DELIVERED';
                    console.warn('[invite-controller] SMS mTarget non délivré:', smsRes.error);
                }
            } catch (smsErr) {
                smsRefusal = 'SMS_NOT_DELIVERED';
                console.error('[invite-controller] SMS d\'invitation en échec :', smsErr instanceof Error ? smsErr.message : smsErr);
            }
        }

        const countEvents = targetEventIds.length;
        const msgSuffix = countEvents > 1 ? `sur ${countEvents} événements` : `sur l'événement`;
        const baseMsg = isNewUser
            ? `Contrôleur créé et assigné ${msgSuffix}.`
            : anyNewlyAssigned
                ? `Contrôleur assigné avec succès ${msgSuffix}.`
                : `Droits mis à jour ${msgSuffix}.`;
        // Lot 4.8 : le partenaire sait si le SMS est parti (refus de la garde anti-abus compris).
        // Lot 9 bis (R38) : un SMS n'est annoncé que s'il part (affectation nouvelle d'un compte établi, par le trigger).
        const actionMsg = !issueActivationCode
            ? (anyNewlyAssigned
                ? `${baseMsg} Le contrôleur est prévenu dans l'application et par SMS.`
                : `${baseMsg} Aucune nouvelle affectation : aucun SMS n'est envoyé.`)
            : smsSent
                ? `${baseMsg} SMS avec code d'activation envoyé.`
                : `${baseMsg} SMS non envoyé : ${smsRefusalReason(smsRefusal)}. Renvoyez l’invitation plus tard.`;

        return NextResponse.json({
            success:      true,
            assignments:  finalAssignments,
            assignment:   finalAssignments[0] || null,
            is_new_user:  isNewUser,
            sms_sent:     smsSent,
            sms_refusal:  smsRefusal,
            ...(isNewUser ? {} : { notification: 'QUEUED' }),
            message:      actionMsg,
            // Lot 1C.1 : le code d'activation n'est jamais renvoyé au partenaire (il part par SMS).
        }, { status: anyNewlyAssigned || isNewUser ? 201 : 200 });

    } catch (err: unknown) {
        console.error('[API /api/partner/team/invite]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    } finally {
        // Lot 9 bis (R98, fix(9b.43-SC)) : unité du numéro rendue quand aucun message n'est parti. L'invitation
        // (affectations, compte) n'est jamais défaite pour autant ; un rendu impossible est journalisé.
        if (phoneUnitBucket && !phoneUnitUsed) {
            const released = await releaseQuota(
                [{ scope: 'invite_phone', bucket: phoneUnitBucket, windowSecs: PHONE_WINDOW_SECS }],
                'invitation contrôleur (numéro), aucun message parti',
            );
            if (!released.ok) console.error(`[invite-controller] unité invite_phone du numéro non rendue : ${released.message}`);
        }
    }
}
