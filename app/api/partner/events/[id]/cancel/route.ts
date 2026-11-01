import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { EventLifecycleError } from '@/lib/events/event-lifecycle.service';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cancelSchema = z.object({
    publicNotice: z.string().max(2000),
    internalReason: z.string().max(2000),
    confirmTitle: z.string().max(300),
}).strict();

/**
 * POST /api/partner/events/[id]/cancel — lot 5 (contrat D6). Corps `{ publicNotice, internalReason,
 * confirmTitle }`. Annulation par le partenaire propriétaire (ou un admin) d'un événement VALIDE, PUBLIE
 * ou SUSPENDU, en une transaction (RPC event_cancel), puis envoi des remboursements. Les contrôles de
 * longueur et du titre sont faits par la RPC (codes PUBLIC_NOTICE_REQUIRED, INTERNAL_REASON_REQUIRED,
 * TITLE_MISMATCH). La réponse ne contient jamais le motif interne.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const id = params.id;
    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = cancelSchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Données invalides : avis public, motif interne et titre retapé sont obligatoires.',
            code: 'INVALID_BODY',
        }, { status: 400 });
    }

    try {
        const result = await EventCancellationService.cancelEvent(id, session.user.id, parsed.data);
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof EventLifecycleError) return NextResponse.json(err.toBody(), { status: err.status });
        console.error('[POST /api/partner/events/[id]/cancel]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Annulation impossible pour le moment.', code: 'CANCELLATION_FAILED' }, { status: 500 });
    }
}
