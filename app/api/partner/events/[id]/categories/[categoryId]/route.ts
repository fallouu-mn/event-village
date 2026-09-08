import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ success: false, error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id: eventId, categoryId } = await params;
        const body = await request.json();

        const updatedCategory = await EventService.updateCategoryStockAndStatus(
            user.id,
            eventId,
            categoryId,
            {
                total_quantity: body.total_quantity !== undefined ? Number(body.total_quantity) : undefined,
                is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
                is_visible: body.is_visible !== undefined ? Boolean(body.is_visible) : undefined,
                price: body.price !== undefined ? Number(body.price) : undefined,
                description: body.description !== undefined ? String(body.description) : undefined,
            }
        );

        return NextResponse.json({ success: true, category: updatedCategory });
    } catch (error: unknown) {
        console.error('[API partner categories PATCH] Erreur:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour de la catégorie.' },
            { status: 400 }
        );
    }
}
