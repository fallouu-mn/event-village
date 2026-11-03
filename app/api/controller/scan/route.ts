import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { isScanResult, SCAN_RESULT_LABELS, type ScanResult } from '@/lib/scan/scan-result';
import { reserveQuota } from '@/lib/security/quota';
import { logServerScanIncident, type ServerIncidentKind } from '@/lib/scan/scan-incidents';
import { parseTicketPayload, verifyTicketCode } from '@/lib/security/totp';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CameraSchema = z.object({ eventId: z.string().uuid(), payload: z.string().trim().min(1).max(500) });
const ManualSchema = z.object({
    eventId: z.string().uuid(),
    manualTicketNumber: z.string().trim().min(4).max(60),
    // Contrat : seule la valeur true vaut « pièce vérifiée » ; toute autre valeur donne manual_entry_refused
    identityVerified: z.unknown().optional(),
});
const CashSchema = z.object({ scanId: z.string().uuid(), eventId: z.string().uuid() });

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Rpc = Record<string, unknown> & { result?: string; http?: number; code?: string };

/** Réponse d'un résultat de scan (HTTP 200) : résultat de l'union partagée, jamais d'erreur technique déguisée. */
function scanResponse(data: Rpc): NextResponse {
    const result = data.result;
    if (!isScanResult(result)) throw new Error(`résultat de scan inconnu : ${JSON.stringify(data)}`);
    return NextResponse.json({ ...data, result, message: SCAN_RESULT_LABELS[result as ScanResult] }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Quota par scanneur. Un refus (429) ou une garde indisponible (503) est compté dans scan_incidents
 * (source SERVER, événement lu dans le corps s'il est lisible), sans toucher ticket_scans.
 */
async function scanQuota(userId: string, eventId: string | null, label: string, scope: string, windowSecs: number, max: number): Promise<NextResponse | null> {
    const q = await reserveQuota([{ scope, bucket: userId, windowSecs, max }], label);
    if (q.allowed) return null;
    if (q.reason === 'UNAVAILABLE') {
        const logged = await logServerScanIncident(userId, eventId, 'GUARD_UNAVAILABLE');
        return NextResponse.json({ error: 'Contrôle momentanément indisponible.', result: 'server_error', incident_logged: logged }, { status: 503 });
    }
    const logged = await logServerScanIncident(userId, eventId, 'RATE_LIMITED');
    return NextResponse.json(
        { error: SCAN_RESULT_LABELS.rate_limited, result: 'rate_limited', retry_after_seconds: q.retryAfterSeconds, incident_logged: logged },
        { status: 429, headers: { 'Retry-After': String(q.retryAfterSeconds) } });
}

/** Corps JSON lu avant le quota (pour connaître l'événement d'un incident) ; null s'il est illisible. */
async function readBody(req: NextRequest): Promise<{ body: unknown; eventId: string | null } | null> {
    const raw = await req.text();
    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        return null;
    }
    const candidate = body && typeof body === 'object' ? (body as Record<string, unknown>).eventId : undefined;
    const eventId = typeof candidate === 'string' && z.string().uuid().safeParse(candidate).success ? candidate : null;
    return { body, eventId };
}

/** Erreur serveur (500) : comptée dans scan_incidents (SERVER_ERROR), réponse générique. */
async function serverError(userId: string, eventId: string | null, message: string, kind: ServerIncidentKind = 'SERVER_ERROR'): Promise<NextResponse> {
    const logged = await logServerScanIncident(userId, eventId, kind);
    return NextResponse.json({ error: message, result: 'server_error', incident_logged: logged }, { status: 500 });
}

/**
 * POST /api/controller/scan — voie unique de contrôle d'un billet (lot 4.1 à 4.4, 4.9).
 * Contrôleur affecté, partenaire propriétaire ou admin ; session ACTIF ; quota par scanneur en base.
 * Caméra : `{ eventId, payload }`, payload « EVT1:<UUID>:<code> » uniquement (identifiant nu refusé).
 * Saisie manuelle : `{ eventId, manualTicketNumber, identityVerified }` (périmètre réglé, pièce
 * d'identité vérifiée obligatoire). Toute la décision est prise en base par ticket_scan, sous verrou,
 * dans l'ordre : droit sur l'événement (sinon 403 sans aucune donnée), billet de l'événement, code
 * dynamique, statut et fenêtre de l'événement, statut du billet, paiement, compostage.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    const env = getServerEnv();
    // Lot 5 (C8) : corps lu AVANT le quota, pour rattacher un incident à son événement
    const read = await readBody(req);
    const limited = await scanQuota(user.id, read?.eventId ?? null, 'scan', 'scan_scanner', 10, env.SCAN_PER_SCANNER_10S);
    if (limited) return limited;
    if (!read) return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    const body = read.body;
    const camera = CameraSchema.safeParse(body);
    const manual = camera.success ? null : ManualSchema.safeParse(body);
    if (!camera.success && !manual?.success) {
        return NextResponse.json({ error: 'Scan invalide : eventId et payload (ou manualTicketNumber) requis.' }, { status: 400 });
    }

    const p: Record<string, unknown> = { scanner_id: user.id };
    try {
        if (camera.success) {
            p.event_id = camera.data.eventId;
            p.method = 'QR';
            p.payload_hash = sha256(camera.data.payload);
            const parsed = parseTicketPayload(camera.data.payload);
            if (!parsed) {
                p.pre_result = 'dynamic_qr_required';
            } else {
                p.ticket_id = parsed.ticketId;
                const { data: t, error } = await getServiceRoleClient().from('tickets').select('id, totp_secret').eq('id', parsed.ticketId).maybeSingle();
                if (error) throw new Error(`lecture du billet : ${error.message}`);
                p.totp_ok = t ? verifyTicketCode(t.id as string, String(t.totp_secret), parsed.code) : false;
            }
        } else {
            const m = manual!.data!;
            p.event_id = m.eventId;
            p.method = 'MANUAL';
            p.ticket_number = m.manualTicketNumber;
            p.identity_verified = m.identityVerified === true;
            p.payload_hash = sha256(m.manualTicketNumber.toUpperCase());
        }
        const { data, error } = await rpcWithRetry<Rpc>('ticket_scan', { p });
        if (error || !data) throw new Error(`ticket_scan : ${error?.message ?? 'réponse vide'}`);
        if (data.http === 403) {
            return NextResponse.json({ error: 'Vous n’êtes pas autorisé à contrôler cet événement.', code: data.code }, { status: 403 });
        }
        // Lot 6 (J1.4) : l'avis « entrée validée » au porteur est mis en file par le trigger
        // trg_tickets_scanned_notify, dans la transaction du compostage.
        return scanResponse(data);
    } catch (err) {
        console.error('[API /api/controller/scan] erreur :', err instanceof Error ? err.message : String(err));
        return serverError(user.id, typeof p.event_id === 'string' ? p.event_id : null, 'Erreur serveur pendant le contrôle.');
    }
}

/**
 * PUT /api/controller/scan — encaissement espèces d'un billet « à régler sur place » puis compostage,
 * tout ou rien (ticket_cash_checkin) : `{ scanId, eventId }` d'un scan cash_required de moins de
 * 5 minutes ; caisse ouverte obligatoire pour tous les rôles ; montant = prix facial du billet.
 */
export async function PUT(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    const read = await readBody(req);
    const limited = await scanQuota(user.id, read?.eventId ?? null, 'encaissement', 'cash_collect', 60, getServerEnv().CASH_COLLECT_PER_SCANNER_MIN);
    if (limited) return limited;
    if (!read) return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    const parsed = CashSchema.safeParse(read.body);
    if (!parsed.success) return NextResponse.json({ error: 'scanId et eventId requis.' }, { status: 400 });
    try {
        const { data, error } = await rpcWithRetry<Rpc>('ticket_cash_checkin', {
            p: { scan_id: parsed.data.scanId, scanner_id: user.id, event_id: parsed.data.eventId },
        });
        if (error || !data) throw new Error(`ticket_cash_checkin : ${error?.message ?? 'réponse vide'}`);
        if (data.result !== 'valid') {
            // Refus du serveur : pas de compostage ; l'écran garde l'erreur et propose une action explicite
            return NextResponse.json({ ...data, message: SCAN_RESULT_LABELS[(isScanResult(data.result) ? data.result : 'invalid') as ScanResult] }, { status: 409 });
        }
        return scanResponse(data);
    } catch (err) {
        console.error('[API /api/controller/scan PUT] erreur :', err instanceof Error ? err.message : String(err));
        return serverError(user.id, parsed.data.eventId, 'Erreur serveur pendant l’encaissement.');
    }
}
