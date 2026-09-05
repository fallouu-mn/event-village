import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { isEventEligibleForController } from '@/lib/events/event-status';

export const dynamic = 'force-dynamic';

// GET /api/partner/team/all
// Retourne tous les contrôleurs assignés aux événements de ce partenaire.
// Architecture : 3 requêtes indépendantes + merge JS pour éviter toute ambiguïté
// de FK hint PostgREST (event_controllers a 2 FK vers users: user_id et created_by).
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (user.role !== 'PARTENAIRE' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        // ── 1. Résoudre le partner_id ─────────────────────────────────────────
        let partnerId: string | null = null;
        if (user.role === 'PARTENAIRE') {
            const { data: p, error: pErr } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (pErr) {
                console.error('[team/all] partners query:', pErr.message);
                return NextResponse.json({ error: 'Erreur lors de la résolution du partenaire.' }, { status: 500 });
            }
            if (!p) {
                return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
            }
            partnerId = p.id;
        }

        // ── 2. Récupérer les événements ───────────────────────────────────────
        let eventsQuery = supabase
            .from('events')
            .select('id, title, start_date, status');
        if (partnerId) {
            eventsQuery = eventsQuery.eq('partner_id', partnerId);
        }

        const { data: events, error: evErr } = await eventsQuery;

        if (evErr) {
            console.error('[team/all] events query:', evErr.message, evErr.details);
            return NextResponse.json({ error: 'Impossible de charger les événements.' }, { status: 500 });
        }

        if (!events || events.length === 0) {
            return NextResponse.json({ success: true, controllers: [], events: [] });
        }

        const eventIds = events.map(e => e.id);

        // ── 3. Récupérer les assignations (pas de jointure — évite FK ambiguïté) ──
        const { data: rawAssignments, error: aErr } = await supabase
            .from('event_controllers')
            .select('id, event_id, user_id, can_accept_cash, created_at')
            .in('event_id', eventIds)
            .order('created_at', { ascending: false });

        if (aErr) {
            console.error('[team/all] event_controllers query:', aErr.message, aErr.details, aErr.hint);
            return NextResponse.json({ error: 'Impossible de charger les assignations.' }, { status: 500 });
        }

        if (!rawAssignments || rawAssignments.length === 0) {
            return NextResponse.json({
                success:     true,
                controllers: [],
                events:      events.map(e => ({ id: e.id, title: e.title, date: e.start_date, status: e.status })),
            });
        }

        // ── 4. Récupérer les profils utilisateurs ─────────────────────────────
        const userIds = Array.from(new Set(rawAssignments.map(a => a.user_id)));

        const { data: userProfiles, error: usersErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, status')
            .in('id', userIds);

        if (usersErr) {
            console.error('[team/all] users query:', usersErr.message, usersErr.details);
            return NextResponse.json({ error: 'Impossible de charger les profils contrôleurs.' }, { status: 500 });
        }

        // ── 5. Merge en mémoire ───────────────────────────────────────────────
        const userMap  = Object.fromEntries((userProfiles ?? []).map(u => [u.id, u]));
        const eventMap = Object.fromEntries(events.map(e => [e.id, e]));

        const controllers = rawAssignments.map(a => ({
            id:             a.id,
            event_id:       a.event_id,
            can_accept_cash: a.can_accept_cash,
            created_at:     a.created_at,
            users:  userMap[a.user_id]  ?? null,
            events: eventMap[a.event_id]
                ? {
                    id:       eventMap[a.event_id].id,
                    title:    eventMap[a.event_id].title,
                    date:     eventMap[a.event_id].start_date,
                    status:   eventMap[a.event_id].status,
                }
                : null,
        }));

        return NextResponse.json({
            success:     true,
            controllers,
            events: (events ?? [])
                .filter(e => isEventEligibleForController(e.status))
                .sort((a, b) => {
                    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                    if (dateA && dateB && dateA !== dateB) return dateA - dateB;
                    return (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
                })
                .map(e => ({ id: e.id, title: e.title, date: e.start_date, status: e.status })),
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API /api/partner/team/all] catch:', msg);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/partner/team/all?controllerId=<uuid>
// Retire un contrôleur de TOUS les événements du partenaire courant.
// Isolation Multi-Tenant garantie : ne touche pas aux événements d'autres partenaires.
// Conserve le compte utilisateur, son historique de scans et les audits.
// ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (user.role !== 'PARTENAIRE' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const controllerId = req.nextUrl.searchParams.get('controllerId');
        if (!controllerId) {
            return NextResponse.json({ error: 'controllerId requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Résoudre le partner_id
        let partnerId: string | null = null;
        if (user.role === 'PARTENAIRE') {
            const { data: p, error: pErr } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (pErr || !p) {
                return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
            }
            partnerId = p.id;
        }

        // 2. Récupérer les événements appartenant à ce partenaire
        let eventsQuery = supabase.from('events').select('id, title');
        if (partnerId) {
            eventsQuery = eventsQuery.eq('partner_id', partnerId);
        }
        const { data: partnerEvents, error: evErr } = await eventsQuery;
        if (evErr) {
            console.error('[DELETE team/all] events query error:', evErr.message);
            return NextResponse.json({ error: 'Impossible de récupérer les événements du partenaire.' }, { status: 500 });
        }

        if (!partnerEvents || partnerEvents.length === 0) {
            return NextResponse.json({ success: true, message: 'Aucun événement pour ce partenaire.' });
        }

        const partnerEventIds = partnerEvents.map(e => e.id);

        // 3. Trouver les assignations de ce contrôleur pour ces événements exclusivement
        const { data: assignmentsToDelete, error: aErr } = await supabase
            .from('event_controllers')
            .select('id, event_id')
            .eq('user_id', controllerId)
            .in('event_id', partnerEventIds);

        if (aErr) {
            console.error('[DELETE team/all] event_controllers query error:', aErr.message);
            return NextResponse.json({ error: 'Impossible de vérifier les affectations.' }, { status: 500 });
        }

        if (!assignmentsToDelete || assignmentsToDelete.length === 0) {
            return NextResponse.json({ success: true, message: 'Aucune affectation active trouvée pour ce partenaire.' });
        }

        const assignmentIds = assignmentsToDelete.map(a => a.id);
        const affectedEventIds = assignmentsToDelete.map(a => a.event_id);

        // 4. Supprimer uniquement ces assignations
        const { error: delErr } = await supabase
            .from('event_controllers')
            .delete()
            .in('id', assignmentIds);

        if (delErr) {
            console.error('[DELETE team/all] delete error:', delErr.message);
            return NextResponse.json({ error: 'Impossible de retirer les affectations.' }, { status: 500 });
        }

        // 5. Récupérer les informations du contrôleur pour les notifications
        const { data: ctrlUser } = await supabase
            .from('users')
            .select('id, phone, first_name')
            .eq('id', controllerId)
            .maybeSingle();

        // 6. SMS notification (non bloquante)
        if (ctrlUser?.phone) {
            try {
                await mTargetService.sendControllerAllEventsRevokedNotice(ctrlUser.phone);
            } catch (smsErr) {
                console.warn('[DELETE team/all] SMS non bloquant:', smsErr instanceof Error ? smsErr.message : smsErr);
            }
        }

        // 7. In-app notification
        try {
            await NotificationService.createNotification({
                userId: controllerId,
                title: 'Affectations retirées',
                message: 'Toutes vos affectations pour cet organisateur ont pris fin. Vous n\'avez plus d\'événement actif.',
                type: 'SYSTEM',
                data: {
                    partner_id: partnerId,
                    removed_event_ids: affectedEventIds,
                },
            });
        } catch (notifErr) {
            console.warn('[DELETE team/all] In-app non bloquante:', notifErr instanceof Error ? notifErr.message : notifErr);
        }

        // 8. Audit log
        try {
            await AdminService.logAudit({
                userId: user.id,
                userRole: user.role as any,
                action: 'CONTROLLER_REMOVED_ALL',
                objectType: 'event_controllers',
                objectId: controllerId,
                newValue: { removed_assignments_count: assignmentIds.length, event_ids: affectedEventIds },
                metadata: {
                    partner_id: partnerId,
                    controller_id: controllerId,
                    removed_by: user.id,
                },
            });
        } catch (auditErr) {
            console.warn('[DELETE team/all] Audit non bloquant:', auditErr instanceof Error ? auditErr.message : auditErr);
        }

        return NextResponse.json({
            success: true,
            message: `Contrôleur retiré de ${assignmentIds.length} événement(s) du partenaire.`,
            removed_count: assignmentIds.length,
        });

    } catch (err: unknown) {
        console.error('[DELETE /api/partner/team/all] catch:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
