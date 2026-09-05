import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notifications/notification.service';

export const dynamic = 'force-dynamic';

/** GET /api/admin/promotions — Liste toutes les demandes */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'events.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from('sponsored_promotions')
        .select(`
            id, status, requested_at, reviewed_at, start_date, end_date, admin_notes,
            events(id, title, image_url, status),
            partners(id, company_name, commercial_name)
        `)
        .order('requested_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promotions: data || [] });
}

/** PATCH /api/admin/promotions — Approuver ou refuser */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'events.write' });
    if (!auth.authorized) return auth.errorResponse!;

    const body = await req.json();
    const { id, status, admin_notes, start_date, end_date } = body as {
        id: string;
        status: 'APPROUVEE' | 'REFUSEE';
        admin_notes?: string;
        start_date?: string;
        end_date?: string;
    };

    if (!id || !['APPROUVEE', 'REFUSEE'].includes(status)) {
        return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: promo, error: findErr } = await supabase
        .from('sponsored_promotions')
        .select('*, events(id, title, partner_id, partners(user_id))')
        .eq('id', id)
        .single();

    if (findErr || !promo) return NextResponse.json({ error: 'Promotion introuvable.' }, { status: 404 });

    const updatePayload: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user!.id,
        admin_notes: admin_notes || null,
    };
    if (status === 'APPROUVEE') {
        updatePayload.start_date = start_date || new Date().toISOString().split('T')[0];
        updatePayload.end_date = end_date || null;
    }

    const { error: updateErr } = await supabase
        .from('sponsored_promotions')
        .update(updatePayload)
        .eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Activer/désactiver is_featured sur l'événement
    if (status === 'APPROUVEE') {
        await supabase
            .from('events')
            .update({ is_featured: true, featured_until: end_date ? new Date(end_date).toISOString() : null })
            .eq('id', promo.event_id);
    }

    // Notification au partenaire
    const partnerUserId = (promo.events as any)?.partners?.user_id;
    const eventTitle = (promo.events as any)?.title || 'votre événement';
    if (partnerUserId) {
        await NotificationService.createNotification({
            userId: partnerUserId,
            title: status === 'APPROUVEE' ? 'Promotion approuvée !' : 'Demande de promotion refusée',
            message: status === 'APPROUVEE'
                ? `Votre demande de promotion pour "${eventTitle}" a été approuvée. Votre événement est mis en avant sur la plateforme.`
                : `Votre demande de promotion pour "${eventTitle}" a été refusée.${admin_notes ? ` Motif : ${admin_notes}` : ''}`,
            type: 'SYSTEM',
            data: { promotionId: id, eventId: promo.event_id, status },
        });
    }

    return NextResponse.json({ success: true, status });
}
