import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { controllerRemovalConflict, isControllerRemovalBlocked } from '@/lib/shifts/shift.service';
import { adminTeamRefusal } from '../team-access';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────
// GET /api/partner/team/[eventId]
// Liste les contrôleurs assignés à un événement (partenaire propriétaire seulement)
// ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { eventId: string } | Promise<{ eventId: string }> }) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        // Lot 9 bis (R2, B31) : un admin lit l'équipe avec events.read
        const denied = await adminTeamRefusal(user, 'events.read');
        if (denied) return denied;

        const supabase = getServiceRoleClient();
        const resolvedParams = await Promise.resolve(params);
        const { eventId } = resolvedParams;

        if (serverHasRole(user, 'PARTENAIRE')) {
            const { data: partnerRec } = await supabase.from('partners').select('id').eq('user_id', user.id).maybeSingle();
            const { data: event }     = await supabase.from('events').select('partner_id').eq('id', eventId).maybeSingle();
            if (!partnerRec || !event || event.partner_id !== partnerRec.id) {
                return NextResponse.json({ error: 'Accès non autorisé à cet événement.' }, { status: 403 });
            }
        }

        // Deux requêtes séparées pour éviter l'ambiguïté FK (user_id et created_by
        // référencent tous les deux la table users)
        const { data: rawCtrl, error } = await supabase
            .from('event_controllers')
            .select('id, user_id, can_accept_cash, created_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GET team/eventId] event_controllers:', error.message, error.hint);
            return NextResponse.json({ error: 'Impossible de charger les contrôleurs.' }, { status: 500 });
        }

        if (!rawCtrl || rawCtrl.length === 0) {
            return NextResponse.json({ success: true, controllers: [] });
        }

        const userIds = Array.from(new Set(rawCtrl.map(c => c.user_id)));
        const { data: profiles, error: pErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, status')
            .in('id', userIds);

        if (pErr) {
            console.error('[GET team/eventId] users:', pErr.message);
            return NextResponse.json({ error: 'Impossible de charger les profils.' }, { status: 500 });
        }

        const userMap = Object.fromEntries((profiles ?? []).map(u => [u.id, u]));
        const controllers = rawCtrl.map(c => ({
            id:              c.id,
            can_accept_cash: c.can_accept_cash,
            created_at:      c.created_at,
            users:           userMap[c.user_id] ?? null,
        }));

        return NextResponse.json({ success: true, controllers });
    } catch (err: unknown) {
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/partner/team/[eventId]?assignmentId=<uuid>
// Retire un contrôleur d'un événement (lot 5, C5) : l'affectation doit appartenir à l'événement de
// l'URL, sinon 404 ASSIGNMENT_NOT_FOUND (sans dire si elle existe ailleurs) ; une affectation absente
// donne aussi 404 ; toute panne de lecture ou d'écriture donne 500.
// ──────────────────────────────────────────────────────────
const UUID = z.string().uuid();

function assignmentNotFound(): NextResponse {
    return NextResponse.json({ error: 'Affectation introuvable pour cet événement.', code: 'ASSIGNMENT_NOT_FOUND' }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: { eventId: string } | Promise<{ eventId: string }> }) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès non autorisé.', code: 'FORBIDDEN' }, { status: 403 });
    }
    // Lot 9 bis (R2, B31) : un admin retire un contrôleur avec events.write
    const denied = await adminTeamRefusal(user, 'events.write');
    if (denied) return denied;

    const { eventId } = await Promise.resolve(params);
    const assignmentId = req.nextUrl.searchParams.get('assignmentId');
    if (!UUID.safeParse(eventId).success || !assignmentId || !UUID.safeParse(assignmentId).success) {
        return NextResponse.json({ error: 'Événement et affectation (assignmentId) requis.', code: 'INVALID_REQUEST' }, { status: 400 });
    }

    try {
        const supabase = getServiceRoleClient();

        // 1. Affectation de CET événement (jamais par son seul identifiant)
        const { data: assignment, error: readErr } = await supabase
            .from('event_controllers')
            .select('id, event_id, user_id')
            .eq('id', assignmentId)
            .eq('event_id', eventId)
            .maybeSingle();
        if (readErr) throw new Error(`lecture de l'affectation : ${readErr.message}`);
        if (!assignment) return assignmentNotFound();

        // 2. Propriété de l'événement de l'URL (un admin gère toutes les équipes)
        const { data: event, error: eventErr } = await supabase.from('events').select('id, title, partner_id').eq('id', eventId).maybeSingle();
        if (eventErr) throw new Error(`lecture de l'événement : ${eventErr.message}`);
        if (!event) return assignmentNotFound();
        if (!serverIsAdmin(user)) {
            const { data: partnerRec, error: partnerErr } = await supabase.from('partners').select('id').eq('user_id', user.id).maybeSingle();
            if (partnerErr) throw new Error(`lecture du profil partenaire : ${partnerErr.message}`);
            if (!partnerRec || event.partner_id !== partnerRec.id) {
                return NextResponse.json({ error: 'Non autorisé à modifier l’équipe de cet événement.', code: 'FORBIDDEN' }, { status: 403 });
            }
        }

        // 3. Retrait (le trigger controller_removal_guard refuse une affectation à caisse ouverte)
        const { data: deleted, error: delErr } = await supabase
            .from('event_controllers')
            .delete()
            .eq('id', assignmentId)
            .eq('event_id', eventId)
            .select('id');
        if (isControllerRemovalBlocked(delErr)) {
            return NextResponse.json(controllerRemovalConflict(), { status: 409 });
        }
        if (delErr) throw new Error(`retrait de l'affectation : ${delErr.message}`);
        if ((deleted ?? []).length === 0) return assignmentNotFound(); // retrait concurrent

        // 4. Lot 6 (J2.4) : l'avis de retrait au contrôleur (in-app, push, SMS) est mis en file par le
        //    trigger trg_event_controllers_notify dans la transaction de la suppression. Journal.
        await AdminService.logAudit({
            userId: user.id,
            userRole: String(user.role),
            action: 'CONTROLLER_REMOVED',
            objectType: 'event_controllers',
            objectId: assignmentId,
            newValue: { event_id: eventId, controller_user_id: assignment.user_id },
            metadata: { removed_by: user.id },
        });

        return NextResponse.json({ success: true, message: 'Contrôleur retiré de l’événement.', notification: 'QUEUED' });
    } catch (err: unknown) {
        console.error('[DELETE team/eventId] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Retrait du contrôleur momentanément impossible.', code: 'REMOVAL_FAILED' }, { status: 500 });
    }
}
