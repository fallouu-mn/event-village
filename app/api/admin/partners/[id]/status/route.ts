import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { permissionMissingResponse, verifyAdminAuth } from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

const UUID = z.string().uuid();
const TARGET_STATUSES = ['VALIDE', 'REJETE', 'SUSPENDU'] as const;
type TargetStatus = typeof TARGET_STATUSES[number];

/** Refus de la RPC partner_status_set → statut HTTP (contrat J2.6). */
const REFUSAL_HTTP: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    REASON_REQUIRED: 400,
    FORBIDDEN: 403,
    PARTNER_NOT_FOUND: 404,
    TRANSITION_NOT_ALLOWED: 409,
};

type StatusReply = {
    ok?: boolean;
    code?: string;
    message?: string;
    partner_id?: string;
    old_status?: string;
    status?: string;
    is_verified?: boolean;
    rejection_reason?: string | null;
    suspended_reason?: string | null;
    sessions_revoked?: number | null;
    events_suspended?: unknown;
    events_restored?: unknown;
    events_left_suspended?: unknown;
};

/**
 * PATCH /api/admin/partners/[id]/status — validation, refus, suspension ou réactivation d'un partenaire.
 *
 * Lot 6 (J2.6) : une seule transaction, la RPC partner_status_set, écrit partners.status (et le motif),
 * users.status (SUSPENDU à la suspension, ACTIF sinon), révoque les sessions à la suspension et met en
 * file l'avis au partenaire (trigger trg_partners_notify : in-app, SMS, email). Aucun envoi depuis la
 * route. Permission : partners.validate, ou partners.suspend pour une suspension. Lot 9 bis (B45) : journal d'audit
 * écrit dans la RPC (transactionnel), `audit_logged` toujours vrai (champ gardé pour la compatibilité).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { id: partnerId } = await Promise.resolve(params);
        if (!partnerId || !UUID.safeParse(partnerId).success) {
            return NextResponse.json({ error: 'Identifiant de partenaire invalide.', code: 'INVALID_INPUT' }, { status: 400 });
        }

        let body: { status?: string; reason?: string; rejectionReason?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.', code: 'INVALID_INPUT' }, { status: 400 });
        }

        const newStatus = body.status;
        if (!newStatus || !(TARGET_STATUSES as readonly string[]).includes(newStatus)) {
            return NextResponse.json({ error: 'Statut partenaire invalide.', code: 'INVALID_INPUT' }, { status: 400 });
        }
        // Priorité au champ `reason`, repli sur `rejectionReason` (écran historique)
        const effectiveReason = (body.reason ?? body.rejectionReason)?.trim() || null;

        const permission = (newStatus as TargetStatus) === 'SUSPENDU' ? 'partners.suspend' : 'partners.validate';
        // Lot 9 quater (B2 : AUD-23, G-02) : suspendre une partenaire est réservé au SUPERADMIN (rôles de user_roles)
        if ((newStatus as TargetStatus) === 'SUSPENDU' && !(auth.user?.roles ?? []).includes('SUPERADMIN')) {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut suspendre une partenaire.', code: 'SUPERADMIN_REQUIRED' },
                { status: 403 }
            );
        }
        if (!(auth.permissions ?? []).includes(permission)) {
            // Lot 9 bis (R51, B34) : 403 PERMISSION_MISSING en français, permission nommée dans le corps.
            return permissionMissingResponse(permission);
        }

        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.rpc('partner_status_set', {
            p: { partner_id: partnerId, actor_id: auth.user!.id, status: newStatus, reason: effectiveReason },
        });
        if (error || !data) {
            console.error('[API /api/admin/partners/status] partner_status_set :', error?.message ?? 'réponse vide');
            return NextResponse.json({ error: 'Mise à jour du partenaire momentanément impossible.', code: 'PARTNER_STATUS_FAILED' }, { status: 500 });
        }
        const reply = data as StatusReply;
        if (reply.ok !== true) {
            const code = String(reply.code ?? 'PARTNER_STATUS_REFUSED');
            const status = REFUSAL_HTTP[code];
            if (!status) {
                console.error('[API /api/admin/partners/status] refus inattendu :', JSON.stringify(reply));
                return NextResponse.json({ error: 'Mise à jour du partenaire momentanément impossible.', code: 'PARTNER_STATUS_FAILED' }, { status: 500 });
            }
            return NextResponse.json({ error: reply.message ?? 'Mise à jour du partenaire refusée.', code }, { status });
        }

        // Lot 9 bis (ex-10.0 c, B45) : le journal PARTNER_STATUS_SET est écrit par partner_status_set dans sa
        // transaction (M06) ; s'il ne peut pas l'être, la RPC échoue et rien n'a changé (500 ci-dessus).

        return NextResponse.json({
            success: true,
            message: 'Statut du partenaire mis à jour.',
            notification: 'QUEUED',
            audit_logged: true,
            // Lot 9 bis (R5, B16) : événements suspendus par la cascade, rétablis à la réactivation, laissés suspendus
            events_suspended: reply.events_suspended ?? [],
            events_restored: reply.events_restored ?? [],
            events_left_suspended: reply.events_left_suspended ?? [],
            partner: {
                id: partnerId,
                status: reply.status ?? newStatus,
                is_verified: reply.is_verified ?? newStatus === 'VALIDE',
                rejection_reason: reply.rejection_reason ?? null,
                suspended_reason: reply.suspended_reason ?? null,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/admin/partners/status] exception :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Mise à jour du partenaire momentanément impossible.', code: 'PARTNER_STATUS_FAILED' }, { status: 500 });
    }
}
