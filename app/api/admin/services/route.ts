import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/services?type=events|halls|tables|products|orders
 * Supervision globale des catalogues et réservations (§130)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'events.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const { searchParams } = new URL(req.url);
    const serviceType = searchParams.get('type') || 'events';

    const supabase = getServiceRoleClient();

    try {
        if (serviceType === 'events') {
            const { data: events, error } = await supabase
                .from('events')
                .select('*, partners(company_name), ticket_categories(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ success: true, events: events || [] });
        }

        if (serviceType === 'halls') {
            const { data: halls, error } = await supabase
                .from('halls')
                .select('*, partners(company_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ success: true, halls: halls || [] });
        }

        if (serviceType === 'tables') {
            const { data: tables, error } = await supabase
                .from('restaurant_tables')
                .select('*, restaurant_zones(*, partners(company_name))')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ success: true, tables: tables || [] });
        }

        if (serviceType === 'products') {
            const { data: products, error } = await supabase
                .from('products')
                .select('*, product_categories(*), partners(company_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ success: true, products: products || [] });
        }

        if (serviceType === 'orders') {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*, users(first_name, last_name, email, phone), partners(company_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ success: true, orders: orders || [] });
        }

        return NextResponse.json({ error: 'Type de service inconnu.' }, { status: 400 });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/services', err, { message: 'Catalogues momentanément indisponibles.', code: 'SERVICES_UNAVAILABLE' });
    }
}

/**
 * Lot 5 (A1) — tables que la modération admin peut changer par cette route, et transitions admises.
 * Les statuts des événements n'y passent plus (machine à états, transitions par RPC) ; aucune autre
 * table (paiements, comptes…) n'est jamais écrite ici. Seule l'annulation ou le refus d'une demande
 * encore en attente et non payée est admis : aucun mouvement d'argent n'en dépend.
 */
const MODERATION_TABLES: Record<string, { column: 'status' | 'order_status'; from: string[]; to: string[] }> = {
    hall_reservations: { column: 'status', from: ['EN_ATTENTE'], to: ['ANNULEE', 'REJETEE'] },
    table_reservations: { column: 'status', from: ['EN_ATTENTE'], to: ['ANNULEE', 'REJETEE'] },
    orders: { column: 'order_status', from: ['EN_ATTENTE'], to: ['ANNULEE', 'REJETEE'] },
};

const PatchSchema = z.object({
    table: z.string().trim().min(1).max(64),
    id: z.string().uuid('Identifiant invalide.'),
    status: z.string().trim().min(1).max(32),
    reason: z.string().trim().max(500).optional().nullable(),
});

/**
 * PATCH /api/admin/services { table, id, status, reason? }
 * Modération d'une réservation de salle, de table ou d'une commande (liste blanche ci-dessus). Toute
 * autre table → 400 INVALID_SERVICE_TABLE, sans aucune écriture.
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'events.write' });
    if (!auth.authorized) return auth.errorResponse!;

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const table = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).table : undefined;
    const rule = typeof table === 'string' && Object.prototype.hasOwnProperty.call(MODERATION_TABLES, table) ? MODERATION_TABLES[table] : null;
    if (!rule) {
        return NextResponse.json({
            error: 'Cette donnée ne peut pas être modifiée par la modération des services.',
            code: 'INVALID_SERVICE_TABLE',
        }, { status: 400 });
    }
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const { id, status, reason } = parsed.data;
    if (!rule.to.includes(status)) {
        return NextResponse.json({ error: 'Statut non admis pour cette donnée.', code: 'INVALID_SERVICE_STATUS' }, { status: 400 });
    }

    try {
        const supabase = getServiceRoleClient();
        const { data: current, error: readErr } = await supabase.from(table as string).select(`id, ${rule.column}, payment_status`).eq('id', id).maybeSingle();
        if (readErr) throw new Error(`lecture de ${table} ${id} : ${readErr.message}`);
        if (!current) return NextResponse.json({ error: 'Élément introuvable.', code: 'NOT_FOUND' }, { status: 404 });
        const row = current as unknown as Record<string, unknown>;
        const from = String(row[rule.column]);
        if (!rule.from.includes(from) || row.payment_status !== 'PENDING') {
            return NextResponse.json({ error: 'Seule une demande en attente et non payée peut être annulée ou refusée ici.', code: 'INVALID_SERVICE_TRANSITION' }, { status: 409 });
        }

        // Écriture conditionnelle : aucun changement si le statut a bougé entre-temps
        const { data: updated, error } = await supabase.from(table as string)
            .update({ [rule.column]: status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq(rule.column, from)
            .eq('payment_status', 'PENDING')
            .select(`id, ${rule.column}`);
        if (error) throw new Error(`mise à jour de ${table} ${id} : ${error.message}`);
        if (!updated || updated.length !== 1) {
            return NextResponse.json({ error: 'Cette demande vient de changer : rechargez la page.', code: 'INVALID_SERVICE_TRANSITION' }, { status: 409 });
        }

        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'UPDATE_SERVICE_STATUS',
            objectType: table as string,
            objectId: id,
            oldValue: { [rule.column]: from },
            newValue: { [rule.column]: status, reason: reason ?? null },
        });

        return NextResponse.json({ success: true, updated: updated[0], message: 'Statut mis à jour.' });
    } catch (err: unknown) {
        console.error('[API /api/admin/services PATCH] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Mise à jour momentanément impossible.', code: 'SERVICE_UPDATE_FAILED' }, { status: 500 });
    }
}
