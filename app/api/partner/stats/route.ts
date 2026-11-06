import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
    EMPTY_BUCKET, LEDGER_SALES_COLUMNS, LEDGER_SALES_TYPES, fetchAllRows, splitLedgerRows, ticketsOfEvents,
    type LedgerSalesRow,
} from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/stats?from&to — statistiques du partenaire sur une période (lot 3, contrat G).
 * Revenus = net organisateur des ventes en ligne de la période, lu dans le grand livre
 * (finance_ledger : écritures VENTE et REMBOURSEMENT datées de la période) ; les ventes espèces
 * (is_platform_payment = false) et les invitations n'y figurent pas. Comptages (événements, billets,
 * réservations, commandes, produits) : toutes les lignes, sans troncature.
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;

        const supabase = getServiceRoleClient();
        const { data: partner, error: pErr } = await supabase
            .from("partners")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
        if (pErr) throw new Error(`Lecture impossible (profil partenaire) : ${pErr.message}`);
        if (!partner) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
        const partnerId = partner.id;

        const period = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q): Q => {
            let out = q;
            if (from) out = out.gte('created_at', from);
            if (to) out = out.lte('created_at', to);
            return out;
        };

        const [events, reservations, orders, products, ledgerRows] = await Promise.all([
            fetchAllRows<{ id: string; status: string }>('événements', (f, t) => period(supabase
                .from("events").select("id,status,created_at").eq("partner_id", partnerId))
                .order('id', { ascending: true }).range(f, t)),
            fetchAllRows<{ id: string; status: string }>('réservations de salle', (f, t) => period(supabase
                .from("hall_reservations").select("id,status,created_at").eq("partner_id", partnerId))
                .order('id', { ascending: true }).range(f, t)),
            fetchAllRows<{ id: string; order_status: string; total_amount: number }>('commandes', (f, t) => period(supabase
                .from("orders").select("id,order_status,total_amount,created_at").eq("partner_id", partnerId))
                .order('id', { ascending: true }).range(f, t)),
            fetchAllRows<{ id: string; status: string }>('produits', (f, t) => supabase
                .from("products").select("id,status").eq("partner_id", partnerId)
                .order('id', { ascending: true }).range(f, t)),
            fetchAllRows<LedgerSalesRow>('grand livre', (f, t) => period(supabase
                .from('finance_ledger')
                .select(LEDGER_SALES_COLUMNS)
                .eq('partner_id', partnerId)
                .eq('account_kind', 'ORGANISATEUR')
                .in('entry_type', LEDGER_SALES_TYPES))
                .order('id', { ascending: true }).range(f, t)),
        ]);

        const tickets = await ticketsOfEvents<{ id: string; status: string }>(events.map((e) => e.id), 'id,status,created_at', { from, to });

        // Net organisateur des ventes en ligne de la période, par activité
        const split = splitLedgerRows(ledgerRows);
        const net = (key: string) => (split.byTarget[key] ?? EMPTY_BUCKET).net;
        const ticketRevenue = net('TICKET');
        const orderRevenue = net('ORDER');
        const hallRevenue = net('HALL_RESERVATION');
        const tableRevenue = net('TABLE_RESERVATION');

        const ordersByStatus = orders.reduce((acc: Record<string, number>, o) => {
            acc[o.order_status] = (acc[o.order_status] || 0) + 1;
            return acc;
        }, {});

        return NextResponse.json({
            success: true,
            period: { from: from || null, to: to || null },
            stats: {
                events: {
                    total: events.length,
                    byStatus: events.reduce((acc: Record<string, number>, e) => {
                        acc[e.status] = (acc[e.status] || 0) + 1;
                        return acc;
                    }, {}),
                },
                tickets: {
                    total: tickets.length,
                    sold: tickets.filter((t) => ["VALIDE", "UTILISE"].includes(t.status)).length,
                    used: tickets.filter((t) => t.status === "UTILISE").length,
                    revenue: ticketRevenue,
                },
                hallReservations: {
                    total: reservations.length,
                    confirmed: reservations.filter((r) => r.status === "CONFIRMEE").length,
                    revenue: hallRevenue,
                },
                orders: {
                    total: orders.length,
                    completed: orders.filter((o) => o.order_status === "LIVREE").length,
                    revenue: orderRevenue,
                    avgBasket: orders.length > 0
                        ? Math.round(orders.reduce((s, o) => s + Number(o.total_amount || 0), 0) / orders.length)
                        : 0,
                    byStatus: ordersByStatus,
                },
                products: {
                    total: products.length,
                    active: products.filter((p) => p.status === "DISPONIBLE").length,
                },
                revenue: {
                    total: ticketRevenue + orderRevenue + hallRevenue + tableRevenue,
                    tickets: ticketRevenue,
                    orders: orderRevenue,
                    halls: hallRevenue,
                    tables: tableRevenue,
                },
            },
        });
    } catch (e: unknown) {
        return apiFailure('GET /api/partner/stats', e, { message: 'Statistiques momentanément indisponibles.', code: 'STATS_UNAVAILABLE', status: 500 });
    }
}
