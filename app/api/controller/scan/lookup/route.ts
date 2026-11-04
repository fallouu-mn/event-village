import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { isScanResult, SCAN_RESULT_LABELS } from '@/lib/scan/scan-result';
import { reserveQuota } from '@/lib/security/quota';
import { ticketStatusLabel } from '@/lib/tickets/ticket-status';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    manualTicketNumber: z.string().trim().min(4).max(60),
});

type LookupReply = {
    ok?: boolean;
    http?: number;
    code?: string;
    found?: boolean;
    ticket?: { ticket_number?: unknown; holder?: unknown; category?: unknown; status?: unknown; preview?: unknown };
};

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/controller/scan/lookup — saisie manuelle, premier temps (lot 7, D43, contrat 3.3) :
 * `{ eventId, manualTicketNumber }` (numéro = tickets.ticket_number, D88). Lecture sans compostage ni ligne
 * ticket_scans (RPC ticket_manual_lookup) : titulaire enregistré, catégorie, statut lisible et résultat
 * qu'aurait le scan, pour comparer avec la pièce d'identité AVANT de valider l'entrée (second temps :
 * POST /api/controller/scan avec identityVerified, même clé d'idempotence). Droit sur l'événement et
 * périmètre access.manual_entry_scope comme le scan (sinon 403 SCAN_FORBIDDEN, rien n'est révélé) ;
 * quota par contrôleur (SCAN_LOOKUP_PER_SCANNER_MIN par minute, refus 429 avant toute lecture) ; chaque
 * vérification est journalisée (audit_logs MANUAL_LOOKUP, numéro haché).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Vérification invalide : événement et numéro de billet requis.', code: 'INVALID_BODY' }, { status: 400 });
    }

    const quota = await reserveQuota(
        [{ scope: 'scan_lookup', bucket: user.id, windowSecs: 60, max: getServerEnv().SCAN_LOOKUP_PER_SCANNER_MIN }],
        'vérification de saisie manuelle');
    if (!quota.allowed) {
        if (quota.reason === 'UNAVAILABLE') {
            return NextResponse.json({ error: 'Vérification momentanément indisponible.', code: 'QUOTA_UNAVAILABLE' }, { status: 503 });
        }
        return NextResponse.json(
            { error: 'Trop de vérifications : patientez quelques secondes.', code: 'RATE_LIMITED', retry_after_seconds: quota.retryAfterSeconds },
            { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } });
    }

    try {
        const { data, error } = await rpcWithRetry<LookupReply>('ticket_manual_lookup', {
            p: { scanner_id: user.id, event_id: parsed.data.eventId, ticket_number: parsed.data.manualTicketNumber },
        });
        if (error || !data) throw new Error(`ticket_manual_lookup : ${error?.message ?? 'réponse vide'}`);
        if (data.http === 403) {
            return NextResponse.json({ error: 'Vous n’êtes pas autorisé à vérifier un billet de cet événement.', code: 'SCAN_FORBIDDEN' }, { status: 403 });
        }
        if (data.ok !== true) {
            return NextResponse.json({ error: 'Vérification invalide : événement et numéro de billet requis.', code: 'INVALID_BODY' }, { status: 400 });
        }
        if (data.found !== true) return NextResponse.json({ found: false }, { headers: NO_STORE });
        const t = data.ticket ?? {};
        if (!isScanResult(t.preview)) throw new Error(`ticket_manual_lookup : résultat prévu inconnu ${JSON.stringify(t.preview)}`);
        return NextResponse.json({
            found: true,
            ticket: {
                ticket_number: String(t.ticket_number ?? ''),
                holder: String(t.holder ?? ''),
                category: String(t.category ?? ''),
                status_label: ticketStatusLabel(t.status),
                preview: t.preview,
                preview_label: SCAN_RESULT_LABELS[t.preview],
            },
        }, { headers: NO_STORE });
    } catch (err) {
        console.error('[API /api/controller/scan/lookup] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur serveur pendant la vérification.', code: 'SERVER_ERROR' }, { status: 500 });
    }
}
