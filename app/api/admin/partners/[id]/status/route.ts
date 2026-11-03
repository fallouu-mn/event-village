import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

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
};

/**
 * PATCH /api/admin/partners/[id]/status — validation, refus, suspension ou réactivation d'un partenaire.
 *
 * Lot 6 (J2.6) : une seule transaction, la RPC partner_status_set, écrit partners.status (et le motif),
 * users.status (SUSPENDU à la suspension, ACTIF sinon), révoque les sessions à la suspension et met en
 * file l'avis au partenaire (trigger trg_partners_notify : in-app, SMS, email). Aucun envoi depuis la
 * route. Permission : partners.validate, ou partners.suspend pour une suspension. Journal d'audit gardé.
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
        if (!(auth.permissions ?? []).includes(permission)) {
            return NextResponse.json({ error: `Permission manquante : ${permission}`, code: 'FORBIDDEN' }, { status: 403 });
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

        // Journal d'audit (la transition est acquise : un échec d'écriture est journalisé et signalé)
        const { error: auditErr } = await supabase.from('audit_logs').insert({
            user_id: auth.user!.id,
            user_role: auth.user!.role,
            action: 'STATUS_CHANGE',
            object_type: 'partners',
            object_id: partnerId,
            old_value: { status: reply.old_status ?? null },
            new_value: { status: reply.status ?? newStatus, is_verified: reply.is_verified ?? newStatus === 'VALIDE' },
            metadata: {
                reason: effectiveReason,
                old_status: reply.old_status ?? null,
                updated_by: auth.user!.role,
                sessions_revoked: reply.sessions_revoked ?? null,
            },
        });
        if (auditErr) console.error('[API /api/admin/partners/status] journal d’audit :', auditErr.message);

        return NextResponse.json({
            success: true,
            message: 'Statut du partenaire mis à jour.',
            notification: 'QUEUED',
            audit_logged: !auditErr,
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
