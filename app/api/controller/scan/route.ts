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
/** Lot 8 (contrat 3.5) : un renvoi n'exige que l'événement ; payload et numéro, s'ils sont là, ne sont jamais lus. */
const ReplaySchema = z.object({ eventId: z.string().uuid() });

/** Lot 7 (D39, contrat 3.3) : clé d'idempotence d'une lecture, même motif que la vente au guichet. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** Lot 8 (contrat 3.5) : phrase complète de la réponse ; SCAN_RESULT_LABELS garde le libellé court de l'écran (7.1). */
const NOT_PROCESSED_MESSAGE = 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Rpc = Record<string, unknown> & { result?: string; http?: number; code?: string; replayed?: unknown };

/**
 * Réponse d'un résultat de scan (HTTP 200) : résultat de l'union partagée, jamais d'erreur technique déguisée.
 * `replayed` est toujours un booléen (vrai seulement pour le rejeu d'une clé déjà traitée, D40).
 */
function scanResponse(data: Rpc): NextResponse {
    const result = data.result;
    if (!isScanResult(result)) throw new Error(`résultat de scan inconnu : ${JSON.stringify(data)}`);
    const message = result === 'not_processed' ? NOT_PROCESSED_MESSAGE : SCAN_RESULT_LABELS[result as ScanResult];
    return NextResponse.json({ ...data, result, replayed: data.replayed === true, message }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Lot 8 (contrat 3.5, L44) : indicateur de renvoi, lu sur le corps brut car les schémas retirent les clés inconnues.
 * Seuls `replayOnly: true` et `replayOnly: false` (ou son absence) sont admis : toute autre valeur, ou la clé
 * `replay_only`, serait sinon ignorée et une reprise repartirait en compostage réel.
 */
function replayFlagOf(body: unknown): 'replay' | 'normal' | 'invalid' {
    if (!body || typeof body !== 'object') return 'normal';
    if ('replay_only' in body) return 'invalid';
    if (!('replayOnly' in body)) return 'normal';
    const flag = (body as { replayOnly: unknown }).replayOnly;
    if (flag === true) return 'replay';
    return flag === false ? 'normal' : 'invalid';
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
 * dynamique et version du secret, statut et fenêtre de l'événement, statut du billet, paiement, compostage.
 * Lot 7 (D39, D40, contrat 3.3) : en-tête Idempotency-Key obligatoire (une clé par lecture) ; la même clé
 * rejouée par le même scanneur rend le verdict d'origine (`replayed: true`), sans nouvelle ligne, même si
 * le code a expiré entre-temps. La version du secret lue ici sans verrou est recontrôlée par ticket_scan
 * sous le verrou du billet : une rotation validée entre les deux donne un refus (invariant (p)).
 * Lot 8 (8.2 e, contrat 3.5) : `{ eventId, replayOnly: true }` est un renvoi après une sortie de l'application.
 * Aucune lecture du billet ni du code : ticket_scan rend le verdict de la ligne de cette clé sur cet événement,
 * ou `not_processed`, et n'écrit jamais rien. Le quota reste consommé.
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
    const clientKey = req.headers.get('idempotency-key')?.trim() ?? '';
    if (!IDEMPOTENCY_KEY.test(clientKey)) {
        return NextResponse.json({ error: 'Clé d’idempotence manquante ou invalide.', code: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }
    const body = read.body;
    const replayFlag = replayFlagOf(body);
    if (replayFlag === 'invalid') {
        return NextResponse.json({ error: 'Indicateur de renvoi invalide.', code: 'INVALID_REPLAY_FLAG' }, { status: 400 });
    }
    const replay = replayFlag === 'replay' ? ReplaySchema.safeParse(body) : null;
    if (replay && !replay.success) {
        return NextResponse.json({ error: 'Scan invalide : eventId requis.', code: 'INVALID_EVENT_ID' }, { status: 400 });
    }
    const camera = replay ? null : CameraSchema.safeParse(body);
    const manual = replay || camera?.success ? null : ManualSchema.safeParse(body);
    if (!replay && !camera?.success && !manual?.success) {
        return NextResponse.json({ error: 'Scan invalide : eventId et payload (ou manualTicketNumber) requis.' }, { status: 400 });
    }

    const p: Record<string, unknown> = { scanner_id: user.id, client_key: clientKey };
    try {
        if (replay?.success) {
            p.event_id = replay.data.eventId;
            p.replay_only = true;
        } else if (camera?.success) {
            p.event_id = camera.data.eventId;
            p.method = 'QR';
            p.payload_hash = sha256(camera.data.payload);
            const parsed = parseTicketPayload(camera.data.payload);
            if (!parsed) {
                p.pre_result = 'dynamic_qr_required';
            } else {
                p.ticket_id = parsed.ticketId;
                const { data: t, error } = await getServiceRoleClient().from('tickets')
                    .select('id, totp_secret, security_version').eq('id', parsed.ticketId).maybeSingle();
                if (error) throw new Error(`lecture du billet : ${error.message}`);
                p.totp_ok = t ? verifyTicketCode(t.id as string, String(t.totp_secret), parsed.code) : false;
                // Version du secret avec lequel le code a été vérifié : recontrôlée sous verrou par ticket_scan
                if (t) p.secret_version = Number(t.security_version);
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
        if (data.http === 400) {
            return NextResponse.json({ error: 'Clé d’idempotence manquante ou invalide.', code: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
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
 * Lot 7 (D40) : idempotent par sa clé naturelle scanId ; rejoué par le même scanneur après un encaissement
 * fait, il rend le verdict d'origine (200 `valid`, `replayed: true`, même paiement), sans aucune écriture.
 * Version du secret changée depuis le scan : 409 CASH_QR_OUTDATED (statut d'annulation dit avant la version).
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
