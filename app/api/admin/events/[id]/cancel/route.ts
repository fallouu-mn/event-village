import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
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
 * POST /api/admin/events/[id]/cancel — lot 5 (contrat D6). Admin avec la permission events.write, compte
 * ACTIF (requireActiveSession puis verifyAdminAuth). Même corps et même transaction que la route du
 * partenaire : `{ publicNotice, internalReason, confirmTitle }`.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(request, { requiredPermission: 'events.write' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
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
        const result = await EventCancellationService.cancelEvent(id, auth.user.id, parsed.data);
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof EventLifecycleError) return NextResponse.json(err.toBody(), { status: err.status });
        console.error('[POST /api/admin/events/[id]/cancel]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Annulation impossible pour le moment.', code: 'CANCELLATION_FAILED' }, { status: 500 });
    }
}
