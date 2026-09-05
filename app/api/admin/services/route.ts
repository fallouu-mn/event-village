import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { EventService } from '@/lib/events/event.service';

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
        const msg = err instanceof Error ? err.message : 'Erreur lors de la récupération des services';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/services
 * Modification du statut d'un service (Publication, Suspension, Validation)
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'events.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { table: 'events' | 'halls' | 'products'; id: string; status: string; isActive?: boolean; reason?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { table, id, status, isActive, reason } = body;
        if (!table || !id) {
            return NextResponse.json({ error: 'Table et id requis.' }, { status: 400 });
        }

        let updated: any;

        // Pour les événements : passer par EventService pour déclencher les notifications
        if (table === 'events' && status) {
            updated = await EventService.changeEventStatus(
                id,
                auth.user!.id,
                status as any,
                auth.user!.role,
                reason
            );
        } else {
            const supabase = getServiceRoleClient();
            const updatePayload: any = { updated_at: new Date().toISOString() };
            if (status) updatePayload.status = status;
            if (isActive !== undefined) updatePayload.is_active = isActive;

            const { data, error } = await (supabase.from(table) as any)
                .update(updatePayload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            updated = data;
        }

        // Journalisation d'audit
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'UPDATE_SERVICE_STATUS',
            objectType: table,
            objectId: id,
            newValue: { status, reason },
        });

        return NextResponse.json({
            success: true,
            updated,
            message: `Service ${id} mis à jour dans ${table}.`,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
