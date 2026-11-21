import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';
import { sendTableRefunds } from '@/lib/tables/refunds';
import { jsonBody, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/venues/[id]/closures?preview=1 { start_date, end_date?, start_time?, end_time?, reason } — aperçu
 * d'une fermeture exceptionnelle : réservations touchées (heure, personnes, table, prénom du client) et montant rendu.
 * POST /api/partner/venues/[id]/closures { …, expected_count, expected_hash } — fermeture confirmée : l'établissement
 * n'est plus réservable sur la période ; chaque réservation touchée est annulée par l'établissement et remboursée en
 * entier, le client prévenu (motif « Fermeture exceptionnelle : … »).
 * Lot 11b (point 2) : venue_closure_preview, venue_closure_create en base (propriétaire, compte ACTIF, fiche VALIDE ;
 * sous le verrou de l'établissement, la liste doit être celle de l'aperçu, sinon refus PREVIEW_CHANGED). Contre-
 * vérification (T1) : l'aperçu rend l'empreinte de sa liste (fingerprint), la confirmation la renvoie (expected_hash) et
 * la base la recalcule ; sans empreinte, seul un aperçu vide se confirme. Les
 * remboursements créés sont envoyés tout de suite (repris sinon par la tâche des versements). Service fermé : 404.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('tables', 'POST /api/partner/venues/[id]/closures');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const preview = request.nextUrl.searchParams.get('preview') === '1';
        const r = await TableService.closure(session.user.id, id, await jsonBody(request), preview ? 'preview' : 'create');
        if (preview) {
            return NextResponse.json({
                success: true,
                preview: { startsAt: r.starts_at, endsAt: r.ends_at, reason: r.reason, count: Number(r.count ?? 0), refundTotal: Number(r.refund_total ?? 0), reservations: r.reservations ?? [], fingerprint: r.fingerprint },
            });
        }
        await sendTableRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            closure: { id: r.closure_id, startsAt: r.starts_at, endsAt: r.ends_at, cancelled: Number(r.cancelled ?? 0), refundTotal: Number(r.refund_total ?? 0) },
        }, { status: 201 });
    } catch (error: unknown) {
        return tableFailure('POST /api/partner/venues/[id]/closures', error, { message: 'Fermeture non enregistrée. Réessayez.', code: 'CLOSURE_SAVE_FAILED' });
    }
}
