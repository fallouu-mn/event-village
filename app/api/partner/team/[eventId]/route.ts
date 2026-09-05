import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────
// GET /api/partner/team/[eventId]
// Liste les contrôleurs assignés à un événement (partenaire propriétaire seulement)
// ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { eventId: string } | Promise<{ eventId: string }> }) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (user.role !== 'PARTENAIRE' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();
        const resolvedParams = await Promise.resolve(params);
        const { eventId } = resolvedParams;

        if (user.role === 'PARTENAIRE') {
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
// Retire un contrôleur d'un événement
// ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: { eventId: string } | Promise<{ eventId: string }> }) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (user.role !== 'PARTENAIRE' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const resolvedParams = await Promise.resolve(params);
        const eventId = resolvedParams.eventId;

        const assignmentId = req.nextUrl.searchParams.get('assignmentId');
        if (!assignmentId) {
            return NextResponse.json({ error: 'assignmentId requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // Récupérer l'assignation avec l'event_id pour vérifier l'ownership
        const { data: assignment } = await supabase
            .from('event_controllers')
            .select('id, event_id, user_id')
            .eq('id', assignmentId)
            .maybeSingle();

        if (!assignment) {
            return NextResponse.json({ success: true, message: 'Assignation déjà retirée.' }, { status: 200 });
        }

        if (user.role === 'PARTENAIRE') {
            const { data: partnerRec } = await supabase.from('partners').select('id').eq('user_id', user.id).maybeSingle();
            const { data: event }     = await supabase.from('events').select('partner_id').eq('id', assignment.event_id).maybeSingle();
            if (!partnerRec || !event || event.partner_id !== partnerRec.id) {
                return NextResponse.json({ error: 'Non autorisé à modifier l\'équipe de cet événement.' }, { status: 403 });
            }
        }

        const { error: delErr } = await supabase
            .from('event_controllers')
            .delete()
            .eq('id', assignmentId);

        if (delErr) {
            console.error('[DELETE team/eventId] event_controllers delete:', delErr.message, delErr.details);
            return NextResponse.json({ error: 'Impossible de retirer le contrôleur.' }, { status: 500 });
        }

        // Récupérer le profil du contrôleur et les infos de l'événement pour les notifications
        const [{ data: ctrlUser }, { data: eventData }] = await Promise.all([
            supabase.from('users').select('id, phone, first_name').eq('id', assignment.user_id).maybeSingle(),
            supabase.from('events').select('id, title').eq('id', assignment.event_id).maybeSingle(),
        ]);

        const eventTitle = eventData?.title || 'Événement';

        // Notification SMS au contrôleur
        if (ctrlUser?.phone) {
            try {
                await mTargetService.sendControllerRevocationNotice(ctrlUser.phone, eventTitle);
            } catch (smsErr) {
                console.warn('[DELETE team/eventId] SMS retrait non-bloquant:', smsErr instanceof Error ? smsErr.message : smsErr);
            }
        }

        // Notification in-app au contrôleur
        try {
            await NotificationService.createNotification({
                userId: assignment.user_id,
                title: 'Accès Contrôleur Retiré',
                message: `Votre assignation en tant que contrôleur pour l'événement "${eventTitle}" a pris fin.`,
                type: 'SYSTEM',
                data: { event_id: assignment.event_id, event_title: eventTitle },
            });
        } catch (notifErr) {
            console.warn('[DELETE team/eventId] In-app notification non-bloquante:', notifErr instanceof Error ? notifErr.message : notifErr);
        }

        // Audit non-bloquant : ne pas faire échouer le DELETE si le log plante
        try {
            await AdminService.logAudit({
                userId:     user.id,
                userRole:   user.role as any,
                action:     'CONTROLLER_REMOVED',
                objectType: 'event_controllers',
                objectId:   assignmentId,
                newValue:   { event_id: assignment.event_id, controller_user_id: assignment.user_id },
                metadata:   { removed_by: user.id },
            });
        } catch (auditErr) {
            console.warn('[DELETE team/eventId] audit log non-bloquant:', auditErr instanceof Error ? auditErr.message : auditErr);
        }

        return NextResponse.json({ success: true, message: 'Contrôleur retiré de l\'événement.' });
    } catch (err: unknown) {
        console.error('[DELETE team/eventId] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
