import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ success: false, error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id: eventId } = await params;
        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ success: false, error: 'Le nom du pass ou billet est obligatoire.' }, { status: 400 });
        }
        if (body.price === undefined || Number(body.price) < 0) {
            return NextResponse.json({ success: false, error: 'Le prix doit être positif ou nul.' }, { status: 400 });
        }
        if (!body.total_quantity || Number(body.total_quantity) <= 0) {
            return NextResponse.json({ success: false, error: 'La quantité totale doit être supérieure à 0.' }, { status: 400 });
        }

        const newCategory = await EventService.addTicketCategory(user.id, eventId, {
            name: String(body.name),
            description: body.description ? String(body.description) : undefined,
            price: Number(body.price),
            total_quantity: Number(body.total_quantity),
            sale_start: body.sale_start || null,
            sale_end: body.sale_end || null,
            max_per_order: body.max_per_order ? Number(body.max_per_order) : 10,
            is_visible: body.is_visible !== false,
        });

        return NextResponse.json({ success: true, category: newCategory }, { status: 201 });
    } catch (error: unknown) {
        console.error('[API partner categories POST] Erreur:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de la catégorie.' },
            { status: 400 }
        );
    }
}
