import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notifications/notification.service';

export const dynamic = 'force-dynamic';

/** POST /api/partner/events/[id]/promotion — Soumettre une demande de promotion */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getServerSessionUser(req);
    if (!user || user.role !== 'PARTENAIRE') {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const { id: eventId } = await params;
    const supabase = getServiceRoleClient();

    // Vérifier que l'événement appartient au partenaire
    const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!partner) return NextResponse.json({ error: 'Partenaire introuvable.' }, { status: 404 });

    const { data: event } = await supabase
        .from('events')
        .select('id, title, partner_id, status')
        .eq('id', eventId)
        .eq('partner_id', partner.id)
        .single();

    if (!event) return NextResponse.json({ error: 'Événement introuvable ou accès refusé.' }, { status: 404 });

    if (!['VALIDE', 'PUBLIE'].includes(event.status)) {
        return NextResponse.json({ error: 'La promotion ne peut être demandée que pour un événement validé ou publié.' }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas déjà une demande EN_ATTENTE ou APPROUVEE
    const { data: existing } = await supabase
        .from('sponsored_promotions')
        .select('id, status')
        .eq('event_id', eventId)
        .in('status', ['EN_ATTENTE', 'APPROUVEE'])
        .maybeSingle();

    if (existing) {
        return NextResponse.json({
            error: existing.status === 'EN_ATTENTE'
                ? 'Une demande de promotion est déjà en attente de validation.'
                : 'Une promotion est déjà active pour cet événement.',
        }, { status: 409 });
    }

    // Créer la demande
    const { data: promo, error: insertErr } = await supabase
        .from('sponsored_promotions')
        .insert({ event_id: eventId, partner_id: partner.id, status: 'EN_ATTENTE' })
        .select()
        .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Notifier les admins
    await NotificationService.notifySuperadmins({
        title: 'Demande de promotion sponsorisée',
        content: `Le partenaire a soumis une demande de promotion pour l'événement "${event.title}".`,
        type: 'SYSTEM',
        metadata: { promotionId: promo.id, eventId },
    });

    // Notifier le partenaire
    await NotificationService.createNotification({
        userId: user.id,
        title: 'Demande de promotion envoyée',
        message: `Votre demande de promotion pour "${event.title}" est en attente de validation par l'équipe Event Village.`,
        type: 'SYSTEM',
        data: { promotionId: promo.id, eventId },
    });

    return NextResponse.json({ success: true, promotion: promo });
}

/** GET /api/partner/events/[id]/promotion — Statut de la demande */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getServerSessionUser(req);
    if (!user || user.role !== 'PARTENAIRE') {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const { id: eventId } = await params;
    const supabase = getServiceRoleClient();

    const { data } = await supabase
        .from('sponsored_promotions')
        .select('id, status, requested_at, reviewed_at, admin_notes, start_date, end_date')
        .eq('event_id', eventId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return NextResponse.json({ promotion: data || null });
}
