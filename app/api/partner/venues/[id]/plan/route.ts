import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { jsonBody, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/partner/venues/[id]/plan { enabled, tables[{id, x, y, shape?, rotation?}], zones[{id, x, y, w, h}] } — plan de
 * salle facultatif (positions en % du plan). Lot 11b (point 2) : venue_plan_set en base (propriétaire, compte ACTIF,
 * fiche VALIDE ; tables et zones de cet établissement seulement ; journal). Service fermé : 404.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'PUT /api/partner/venues/[id]/plan');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const r = await TableService.setPlan(session.user.id, id, await jsonBody(request));
        return NextResponse.json({ success: true, plan: { enabled: r.enabled === true, placed: Number(r.placed ?? 0) } });
    } catch (error: unknown) {
        return tableFailure('PUT /api/partner/venues/[id]/plan', error, { message: 'Plan non enregistré. Réessayez.', code: 'PLAN_SAVE_FAILED', status: 400 });
    }
}
