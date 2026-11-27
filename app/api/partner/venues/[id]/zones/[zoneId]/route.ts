import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { removeDeliveryZone, saveDeliveryZone } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/venues/[id]/zones/[zoneId] { name?, fee?, minOrder?, isActive? } — lot 12c : modifie une zone de
 * livraison (order_delivery_zone_set) ; les commandes déjà passées gardent leurs frais figés.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'PATCH /api/partner/venues/[id]/zones/[zoneId]');
        if (ctx.response) return ctx.response;
        const { id, zoneId } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const zone = await saveDeliveryZone(ctx.user.id, id, zoneId, body);
        return NextResponse.json({ success: true, zone });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/venues/[id]/zones/[zoneId]', error, { message: 'Zone non enregistrée. Réessayez.', code: 'ZONE_SAVE_FAILED', status: 500 });
    }
}

/**
 * DELETE — retire une zone (order_delivery_zone_remove) : supprimée si elle n'a jamais servi ; désactivée si une
 * commande ouverte l'utilise (elle ne s'efface pas) ; archivée si elle n'a servi qu'à des commandes terminées.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'DELETE /api/partner/venues/[id]/zones/[zoneId]');
        if (ctx.response) return ctx.response;
        const { zoneId } = await params;
        const r = await removeDeliveryZone(ctx.user.id, zoneId);
        return NextResponse.json({ success: true, outcome: r.outcome, message: r.message });
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/venues/[id]/zones/[zoneId]', error, { message: 'Zone non retirée. Réessayez.', code: 'ZONE_DELETE_FAILED', status: 500 });
    }
}
