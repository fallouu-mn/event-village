import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession, serverIsAdmin, serverIsPartner } from '@/lib/auth/session';
import { AdminPermissionsUnavailable, adminAuthUnavailableResponse, loadAdminPermissions, permissionMissingResponse } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { ownPartnerId } from './team-access';

export const dynamic = 'force-dynamic';

const CONTEXT = 'GET /api/partner/team';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Refus de partner_team_view : statut et texte affiché. */
const REFUSALS: Record<string, [number, string]> = {
    INVALID_INPUT: [400, 'Demande invalide.'],
    PARTNER_NOT_FOUND: [404, 'Organisateur introuvable.'],
    EVENT_NOT_FOUND: [404, 'Événement introuvable.'],
};

/**
 * GET /api/partner/team?eventId=&partnerId= — finition 1 (E-13, E-17) : la seule lecture de l'équipe, pour /partner/team
 * (sans eventId : tous les événements de l'organisateur) et l'onglet Équipe du pilotage (eventId : cet événement).
 *  - Partenaire : sa propre équipe ; un eventId d'une autre fiche → 404 ; un partnerId d'une autre fiche est ignoré.
 *  - Admin (ou admin-partenaire hors de sa fiche) : events.read exigé ; organisateur nommé par partnerId, ou déduit de
 *    eventId ; sans l'un ni l'autre → 400 PARTNER_SCOPE_REQUIRED « Choisissez l’organisateur dont vous gérez l’équipe. »
 *  - can_manage : propriétaire, ou admin muni de events.write ; les boutons d'action ne s'affichent que s'il est vrai.
 * Réponse : corps de la RPC partner_team_view + can_manage + acts_as_admin (admin hors de sa fiche : motif demandé).
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    try {
        const eventParam = req.nextUrl.searchParams.get('eventId');
        const partnerParam = req.nextUrl.searchParams.get('partnerId');
        if ((eventParam !== null && !UUID_RE.test(eventParam)) || (partnerParam !== null && partnerParam !== '' && !UUID_RE.test(partnerParam))) {
            throw new PublicError('Demande invalide.', 'INVALID_REQUEST', 400);
        }
        const supabase = getServiceRoleClient();
        const own = await ownPartnerId(user);

        let eventPartner: string | null = null;
        if (eventParam) {
            const { data: ev, error } = await supabase.from('events').select('partner_id').eq('id', eventParam).maybeSingle();
            if (error) throw new Error(`lecture de l'événement : ${error.message}`);
            if (!ev) throw new PublicError(REFUSALS.EVENT_NOT_FOUND[1], 'EVENT_NOT_FOUND', 404);
            eventPartner = String(ev.partner_id);
        }

        let partnerId: string;
        let canManage: boolean;
        const ownScope = own !== null && (eventParam ? eventPartner === own : (!partnerParam || partnerParam === own || !serverIsAdmin(user)));
        if (ownScope && own) {
            partnerId = own;
            canManage = true;
        } else if (!serverIsAdmin(user)) {
            // Partenaire sur l'événement d'une autre fiche : rien, aucun indice
            if (eventParam) throw new PublicError(REFUSALS.EVENT_NOT_FOUND[1], 'EVENT_NOT_FOUND', 404);
            throw new PublicError('Profil partenaire introuvable.', 'PARTNER_NOT_FOUND', 404);
        } else {
            let permissions: string[];
            try {
                permissions = await loadAdminPermissions(user.id, user.roles);
            } catch (err) {
                if (err instanceof AdminPermissionsUnavailable) {
                    console.error(`[${CONTEXT}]`, err.message);
                    return adminAuthUnavailableResponse();
                }
                throw err;
            }
            if (!permissions.includes('events.read')) return permissionMissingResponse('events.read');
            const scoped = eventPartner ?? (partnerParam || null);
            if (!scoped) {
                throw new PublicError('Choisissez l’organisateur dont vous gérez l’équipe.', 'PARTNER_SCOPE_REQUIRED', 400);
            }
            partnerId = scoped;
            canManage = permissions.includes('events.write');
        }

        const { data, error } = await supabase.rpc('partner_team_view', { p: { partner_id: partnerId, event_id: eventParam } });
        if (error) throw new Error(`partner_team_view : ${error.code ?? ''} ${error.message}`);
        const reply = data as (Record<string, unknown> & { ok?: boolean; code?: string }) | null;
        if (!reply) throw new Error('partner_team_view : réponse vide');
        if (reply.ok !== true) {
            const refusal = REFUSALS[String(reply.code)];
            if (!refusal) throw new Error(`partner_team_view : refus inattendu ${JSON.stringify(reply)}`);
            throw new PublicError(refusal[1], String(reply.code), refusal[0]);
        }
        // acts_as_admin : l'écran demande un motif avant chaque action (E-17)
        return NextResponse.json({ ...reply, can_manage: canManage, acts_as_admin: !ownScope }, { headers: NO_STORE });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Équipe momentanément indisponible. Réessayez.', code: 'TEAM_READ_FAILED' });
    }
}
