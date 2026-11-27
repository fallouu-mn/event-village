import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { invalidBody, readJson } from '@/lib/orders/booking';
import { partnerOrdersContext } from '@/lib/orders/partner-route';
import { reorderDeliveryZones, saveDeliveryZone } from '@/lib/products/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/venues/[id]/zones { name, fee, minOrder, isActive? } — lot 12c : ajoute une zone de livraison (un
 * quartier) à un établissement de la partenaire (order_delivery_zone_set : fiche VALIDE, frais entiers de 0 à
 * 100 000 F CFA, minimum entier de 0 à 10 000 000 F CFA, 50 zones au plus). Fiche SUSPENDU : refus (lecture seule).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'POST /api/partner/venues/[id]/zones');
        if (ctx.response) return ctx.response;
        const { id } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const zone = await saveDeliveryZone(ctx.user.id, id, null, body);
        return NextResponse.json({ success: true, zone }, { status: 201 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/venues/[id]/zones', error, { message: 'Zone non enregistrée. Réessayez.', code: 'ZONE_SAVE_FAILED', status: 500 });
    }
}

/** PUT { zoneIds } — ordre des zones de l'établissement (glisser-déposer de l'écran), par order_delivery_zones_reorder. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await partnerOrdersContext(await requireActiveSession(request), 'PUT /api/partner/venues/[id]/zones');
        if (ctx.response) return ctx.response;
        const { id } = await params;
        const body = await readJson(request);
        if (!body) return invalidBody();
        const zoneIds = await reorderDeliveryZones(ctx.user.id, id, body.zoneIds);
        return NextResponse.json({ success: true, zoneIds });
    } catch (error: unknown) {
        return apiFailure('PUT /api/partner/venues/[id]/zones', error, { message: 'Ordre non enregistré. Réessayez.', code: 'ZONE_ORDER_FAILED', status: 500 });
    }
}
