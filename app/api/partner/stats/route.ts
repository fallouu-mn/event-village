import { NextRequest, NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || !["PARTENAIRE", "ADMIN", "SUPERADMIN"].includes(user.role)) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;

        const supabase = getServiceRoleClient();
        const { data: partner } = await supabase
            .from("partners")
            .select("id")
            .eq("user_id", user.id)
            .single();

        if (!partner) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
        const partnerId = partner.id;

        // Événements du partenaire
        let eventsQ = supabase.from("events").select("id,status,created_at").eq("partner_id", partnerId);
        if (from) eventsQ = eventsQ.gte('created_at', from);
        if (to) eventsQ = eventsQ.lte('created_at', to);
        const eventsRes = await eventsQ;

        const events = eventsRes.data || [];
        const eventIds = events.map((e: { id: string }) => e.id);

        // Tickets vendus pour ces événements
        let ticketsRes: { data: Array<{ id: string; price: number; status: string }> | null } = { data: [] };
        if (eventIds.length > 0) {
            let tQ = supabase
                .from("tickets")
                .select("id,price,status,created_at")
                .in('event_id', eventIds);
            if (from) tQ = tQ.gte('created_at', from);
            if (to) tQ = tQ.lte('created_at', to);
            ticketsRes = await tQ;
        }

        // Réservations de salles
        let hallResQ = supabase
            .from("hall_reservations")
            .select("id,status,total_amount,deposit_amount,created_at")
            .eq("partner_id", partnerId);
        if (from) hallResQ = hallResQ.gte('created_at', from);
        if (to) hallResQ = hallResQ.lte('created_at', to);
        const hallResRes = await hallResQ;

        // Commandes
        let orderQ = supabase
            .from("orders")
            .select("id,order_status,total_amount,paid_amount,created_at")
            .eq("partner_id", partnerId);
        if (from) orderQ = orderQ.gte('created_at', from);
        if (to) orderQ = orderQ.lte('created_at', to);
        const orderRes = await orderQ;

        // Produits (non filtré par date — donne l'état actuel)
        const productsRes = await supabase
            .from("products")
            .select("id,status,price,name")
            .eq("partner_id", partnerId);

        const tickets = ticketsRes.data || [];
        const reservations = hallResRes.data || [];
        const orders = orderRes.data || [];
        const products = productsRes.data || [];

        const ticketRevenue = tickets
            .filter((t: { status: string }) => ["VALIDE", "UTILISE"].includes(t.status))
            .reduce((s: number, t: { price: number }) => s + Number(t.price || 0), 0);

        const orderRevenue = orders
            .filter((o: { order_status: string }) =>
                ["CONFIRMEE", "EN_PREPARATION", "PRETE", "EN_LIVRAISON", "LIVREE"].includes(o.order_status))
            .reduce((s: number, o: { paid_amount: number; total_amount: number }) =>
                s + Number(o.paid_amount || 0), 0);

        const hallRevenue = reservations
            .filter((r: { status: string }) => r.status === "CONFIRMEE")
            .reduce((s: number, r: { deposit_amount: number }) => s + Number(r.deposit_amount || 0), 0);

        // Répartition commandes par statut
        const ordersByStatus = orders.reduce((acc: Record<string, number>, o: { order_status: string }) => {
            acc[o.order_status] = (acc[o.order_status] || 0) + 1;
            return acc;
        }, {});

        return NextResponse.json({
            success: true,
            period: { from: from || null, to: to || null },
            stats: {
                events: {
                    total: events.length,
                    byStatus: events.reduce((acc: Record<string, number>, e: { status: string }) => {
                        acc[e.status] = (acc[e.status] || 0) + 1;
                        return acc;
                    }, {}),
                },
                tickets: {
                    total: tickets.length,
                    sold: tickets.filter((t: { status: string }) => ["VALIDE", "UTILISE"].includes(t.status)).length,
                    used: tickets.filter((t: { status: string }) => t.status === "UTILISE").length,
                    revenue: ticketRevenue,
                },
                hallReservations: {
                    total: reservations.length,
                    confirmed: reservations.filter((r: { status: string }) => r.status === "CONFIRMEE").length,
                    revenue: hallRevenue,
                },
                orders: {
                    total: orders.length,
                    completed: orders.filter((o: { order_status: string }) => o.order_status === "LIVREE").length,
                    revenue: orderRevenue,
                    avgBasket: orders.length > 0
                        ? Math.round(orders.reduce((s: number, o: { total_amount: number }) =>
                            s + Number(o.total_amount || 0), 0) / orders.length)
                        : 0,
                    byStatus: ordersByStatus,
                },
                products: {
                    total: products.length,
                    active: products.filter((p: { status: string }) => p.status === "DISPONIBLE").length,
                },
                revenue: {
                    total: ticketRevenue + orderRevenue + hallRevenue,
                    tickets: ticketRevenue,
                    orders: orderRevenue,
                    halls: hallRevenue,
                },
            },
        });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 500 });
    }
}
