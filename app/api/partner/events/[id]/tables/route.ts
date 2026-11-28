import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';
import { callTables, isUuid, outcomeOf, TablesSaveSchema } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Lot 11c-a — tables d'un événement, vues et enregistrées par l'organisatrice.
 *
 * GET : tous les types (en vente ou non), toutes les tables avec leur état (VENDUE, EN_ATTENTE, LIBRE), zones d'accès et
 * leur rectangle sur le plan, jauge en places, ventes (event_table_config : propriétaire ou administration).
 * PUT : liste COMPLÈTE des tables, zones du plan et plan montré, enregistrés tout ou rien (event_tables_save : table
 * vendue ou en attente jamais retirée, renumérotée ni changée de type ; jauge en places ; garde de la billetterie :
 * fiche ou compte suspendu, événement terminé, annulé, suspendu ou en attente de validation ; service fermé → 404).
 * La garde des fiches (middleware, partnerEventWrite) refuse déjà toute écriture d'une fiche SUSPENDU.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    if (!serverIsPartner(session.user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    try {
        const outcome = outcomeOf(await callTables('event_table_config', { event_id: eventId, actor_id: session.user.id }));
        return NextResponse.json(outcome.body, { status: outcome.status, headers: NO_STORE });
    } catch (err) {
        console.error('[API partner tables GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Lecture des tables impossible pour le moment.', code: 'TABLES_UNAVAILABLE' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    if (!serverIsPartner(session.user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Demande illisible. Rechargez la page, puis réessayez.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = TablesSaveSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Plan illisible : rechargez la page et réessayez.', code: 'INVALID_PLAN' }, { status: 400 });
    }
    try {
        const outcome = outcomeOf(await callTables('event_tables_save', { event_id: eventId, actor_id: session.user.id, ...parsed.data }));
        if (outcome.status === 200) invalidatePublicEvent(eventId, 'tables enregistrées');
        return NextResponse.json(outcome.body, { status: outcome.status, headers: NO_STORE });
    } catch (err) {
        console.error('[API partner tables PUT]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Enregistrement des tables impossible pour le moment.', code: 'TABLES_SAVE_FAILED' }, { status: 500 });
    }
}
