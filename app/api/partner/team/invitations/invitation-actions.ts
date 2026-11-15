/**
 * Finition 1 (E-19, E-17) — actions de l'organisateur sur une invitation de contrôleur : « Renvoyer », « Annuler »,
 * « Effacer ». Module serveur partagé par les trois routes de /api/partner/team/invitations/[id] (pas une route).
 *
 * Droits : la RPC vérifie le propriétaire de la fiche de l'invitation, ou un admin muni de events.write (motif exigé,
 * journalisé) ; un tiers ou une invitation inconnue → 404 sans indice. La route refuse d'abord un admin sans la
 * permission (adminTeamRefusal) et une fiche non validée (requireActiveSession).
 * « Renvoyer » : droit et état vérifiés sans effet (check_only), PUIS quotas réservés (par organisateur et par heure :
 * INVITE_PER_PARTNER_HOUR ; par numéro et par jour : INVITE_PER_PHONE_DAY, le même compteur que l'invitation), PUIS
 * renvoi ; un renvoi qui n'aboutit pas rend l'unité du numéro. Aucun quota d'un numéro n'est consommé pour un appelant
 * sans droit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { serverIsPartner, type ServerUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { releaseQuota, reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { toSenegaleseE164 } from '@/lib/validations/auth';
import { adminTeamRefusal, optionalJsonBody } from '../team-access';

export type InvitationAction = 'resend' | 'cancel' | 'clear';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_WINDOW_SECS = 86_400;

/** Refus des RPC : statut HTTP (le texte vient de la RPC, rédigé pour l'écran). */
const REFUSAL_STATUS: Record<string, number> = {
    INVITATION_NOT_FOUND: 404,
    PERMISSION_MISSING: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    REASON_REQUIRED: 400,
    INVITATION_NOT_PENDING: 409,
    INVITATION_STILL_PENDING: 409,
};

const RPC: Record<InvitationAction, string> = {
    resend: 'controller_invitation_resend',
    cancel: 'controller_invitation_cancel',
    clear: 'controller_invitation_clear',
};

type Reply = Record<string, unknown> & { ok?: boolean; code?: string; message?: string };

async function callRpc(action: InvitationAction, p: Record<string, unknown>): Promise<Reply> {
    const { data, error } = await getServiceRoleClient().rpc(RPC[action], { p });
    if (error) throw new Error(`${RPC[action]} : ${error.code ?? ''} ${error.message}`);
    const reply = data as Reply | null;
    if (!reply || typeof reply !== 'object') throw new Error(`${RPC[action]} : réponse vide`);
    if (reply.ok !== true) {
        const status = REFUSAL_STATUS[String(reply.code)];
        if (!status || typeof reply.message !== 'string') throw new Error(`${RPC[action]} : refus non répertorié ${JSON.stringify(reply)}`);
        throw new PublicError(reply.message, String(reply.code), status);
    }
    return reply;
}

/** `user` : session active déjà vérifiée par la route (requireActiveSession, garde de la fiche partenaire comprise). */
export async function handleInvitationAction(action: InvitationAction, req: NextRequest, id: string, user: ServerUser): Promise<NextResponse> {
    const context = `${req.method} /api/partner/team/invitations/[id]${action === 'clear' ? '' : `/${action}`}`;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const denied = await adminTeamRefusal(user, 'events.write');
    if (denied) return denied;
    let phoneBucket: string | null = null;
    let phoneUsed = false;
    try {
        if (!UUID_RE.test(id)) throw new PublicError('Invitation introuvable.', 'INVITATION_NOT_FOUND', 404);
        const body = await optionalJsonBody(req);
        if (body === null) throw new PublicError('Demande illisible.', 'INVALID_BODY', 400);
        const p: Record<string, unknown> = { actor_id: user.id, invitation_id: id, reason: typeof body.reason === 'string' ? body.reason : null };

        if (action !== 'resend') {
            await callRpc(action, p);
            return NextResponse.json({
                ok: true,
                message: action === 'cancel' ? 'Invitation annulée : le lien du SMS ne mène plus à rien.' : 'Invitation effacée.',
            });
        }

        // Renvoyer : droit et état d'abord, sans effet
        const check = await callRpc('resend', { ...p, check_only: true });
        const phone = toSenegaleseE164(String(check.phone ?? ''));
        if (!phone) throw new Error(`controller_invitation_resend : numéro du titulaire illisible pour l'invitation ${id}`);
        const env = getServerEnv();
        const partnerQuota = await reserveQuota([
            { scope: 'invite_partner', bucket: user.id, windowSecs: 3600, max: env.INVITE_PER_PARTNER_HOUR },
        ], 'renvoi d’invitation de contrôleur');
        if (!partnerQuota.allowed) {
            return quotaRefusalResponse(partnerQuota, { error: `Limite d'invitations atteinte : maximum ${env.INVITE_PER_PARTNER_HOUR} par heure. Réessayez plus tard.`, code: 'PARTNER_INVITE_RATE_LIMIT' });
        }
        const phoneQuota = await reserveQuota([
            { scope: 'invite_phone', bucket: phone, windowSecs: PHONE_WINDOW_SECS, max: env.INVITE_PER_PHONE_DAY },
        ], 'renvoi d’invitation de contrôleur (numéro)');
        if (!phoneQuota.allowed) {
            return quotaRefusalResponse(phoneQuota, { error: `Trop d'invitations envoyées à ce numéro aujourd'hui (maximum ${env.INVITE_PER_PHONE_DAY} par jour). Réessayez demain.`, code: 'PHONE_INVITE_RATE_LIMIT' });
        }
        phoneBucket = phone;
        const sent = await callRpc('resend', p);
        phoneUsed = true;
        const expiresAt = String(sent.expires_at ?? '');
        return NextResponse.json({
            ok: true,
            expires_at: expiresAt,
            message: `Invitation renvoyée par SMS : réponse attendue avant le ${formatDateTime(expiresAt)}.`,
        });
    } catch (err) {
        return apiFailure(context, err, { message: 'Action momentanément impossible. Réessayez.', code: 'INVITATION_ACTION_FAILED' });
    } finally {
        if (phoneBucket && !phoneUsed) {
            const released = await releaseQuota(
                [{ scope: 'invite_phone', bucket: phoneBucket, windowSecs: PHONE_WINDOW_SECS }],
                'renvoi d’invitation de contrôleur (numéro), aucun message parti',
            );
            if (!released.ok) console.error(`[${context}] unité invite_phone non rendue : ${released.message}`);
        }
    }
}
