import { getServiceRoleClient } from '@/lib/supabase/server';
import { FinancialCalculatorService } from '@/lib/payments/financial-calculator.service';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES & TYPES DU DASHBOARD PARTENAIRE & RAPPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PartnerKPIs {
    grossRevenue: number;
    netRevenue: number;
    commissionAmount: number;
    ticketsSold: number;
    ticketsCheckedIn: number;
    ticketsCancelled: number;
    totalEvents: number;
    activeEvents: number;
    ordersCount: number;
    ordersRevenue: number;
    soldeDisponible: number;
    totalWithdrawn: number;
    pendingWithdrawals: number;
}

export interface PartnerEventBreakdown {
    id: string;
    title: string;
    startDate: string;
    startTime: string;
    location: string;
    city: string;
    status: string;
    capacity: number;
    ticketsSold: number;
    ticketsAvailable: number;
    ticketsCheckedIn: number;
    fillRatePercent: number;
    checkInRatePercent: number;
    grossRevenue: number;
    commissionAmount: number;
    netRevenue: number;
}

export interface PartnerActivityItem {
    id: string;
    type: 'SALE' | 'CHECKIN' | 'ORDER' | 'WITHDRAWAL';
    title: string;
    description: string;
    amount?: number;
    status: string;
    createdAt: string;
}

export interface PartnerDashboardData {
    partner: {
        id: string;
        companyName: string;
        commercialName: string;
        phone?: string;
        email?: string;
        status: string;
        isVerified: boolean;
    };
    kpis: PartnerKPIs;
    events: PartnerEventBreakdown[];
    recentActivity: PartnerActivityItem[];
}

export interface CategorySalesSummary {
    categoryId: string;
    name: string;
    unitPrice: number;
    totalAllocated: number;
    soldQuantity: number;
    checkedInQuantity: number;
    remainingQuantity: number;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
}

export interface ClosingReportData {
    reportId: string;
    generatedAt: string;
    event: {
        id: string;
        title: string;
        category: string;
        startDate: string;
        startTime: string;
        venue: string;
        city: string;
        status: string;
        capacity: number;
    };
    partner: {
        id: string;
        companyName: string;
        commercialName: string;
        phone: string;
        email: string;
    };
    salesByCategory: CategorySalesSummary[];
    paymentsSummary: {
        confirmedCount: number;
        confirmedGross: number;
        pendingCount: number;
        pendingGross: number;
        refundedCount: number;
        refundedGross: number;
    };
    ticketsSummary: {
        totalAllocated: number;
        sold: number;
        checkedIn: number;
        cancelled: number;
        refunded: number;
        remaining: number;
        checkInRatePercent: number;
        fillRatePercent: number;
    };
    financialSummary: {
        totalGross: number;
        totalCommission: number;
        totalRefunded: number;
        totalNet: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER D'ÉCHAPPEMENT TEXTE PDF (WINANSI & CARACTÈRES ACCENTUÉS)
// ─────────────────────────────────────────────────────────────────────────────
function escapePdfText(str: string): string {
    if (!str) return '';
    const clean = str
        .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    return clean
        .replace(/é/g, '\xE9')
        .replace(/è/g, '\xE8')
        .replace(/ê/g, '\xEA')
        .replace(/ë/g, '\xEB')
        .replace(/à/g, '\xE0')
        .replace(/â/g, '\xE2')
        .replace(/ä/g, '\xE4')
        .replace(/î/g, '\xEE')
        .replace(/ï/g, '\xEF')
        .replace(/ô/g, '\xF4')
        .replace(/ö/g, '\xF6')
        .replace(/ù/g, '\xF9')
        .replace(/û/g, '\xFB')
        .replace(/ü/g, '\xFC')
        .replace(/ç/g, '\xE7')
        .replace(/É/g, '\xC9')
        .replace(/È/g, '\xC8')
        .replace(/Ê/g, '\xCA')
        .replace(/À/g, '\xC0')
        .replace(/Ç/g, '\xC7')
        .replace(/’/g, "'")
        .replace(/–/g, '-')
        .replace(/—/g, '--')
        .replace(/«/g, '"')
        .replace(/»/g, '"');
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PRINCIPAL : PARTNER DASHBOARD & EXPORTS COMPTABLES
// ─────────────────────────────────────────────────────────────────────────────

export class PartnerDashboardService {

    /**
     * Résout le profil partenaire à partir du user_id de la session.
     * Garantit l'isolation multi-tenant stricte.
     */
    public static async resolvePartner(userId: string) {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id, user_id, company_name, commercial_name, phone, email, status, is_verified')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !partner) {
            throw new Error('PROFIL_PARTENAIRE_INTROUVABLE');
        }
        return partner;
    }

    /**
     * Calcule l'intégralité des KPIs et métriques du Dashboard pour un partenaire.
     */
    public static async getDashboardData(userId: string): Promise<PartnerDashboardData> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);
        const partnerId = partner.id;

        // 1. Récupération concurrente des événements, commandes, configurations et retraits
        const [
            eventsRes,
            ordersRes,
            withdrawalsRes,
            orderConfigRes,
            ticketConfigRes,
        ] = await Promise.all([
            supabase.from('events').select('*').eq('partner_id', partnerId).order('start_date', { ascending: false }),
            supabase.from('orders').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
            supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('platform_settings').select('value').eq('key', 'order_commission_config').maybeSingle(),
            supabase.from('platform_settings').select('value').eq('key', 'ticketing_fee_config').maybeSingle(),
        ]);

        const events = eventsRes.data || [];
        const orders = ordersRes.data || [];
        const withdrawals = withdrawalsRes.data || [];

        const orderCommissionRate = Number(orderConfigRes.data?.value?.commission_rate || 5.0);
        const ticketServiceFeeRate = Number(ticketConfigRes.data?.value?.service_fee_rate || 5.0);
        const ticketAggregatorFeeRate = Number(ticketConfigRes.data?.value?.aggregator_fee_rate || 1.5);

        const eventIds = events.map(e => e.id);

        // 2. Récupération des catégories et billets pour tous les événements du partenaire
        let tickets: any[] = [];
        let categories: any[] = [];

        if (eventIds.length > 0) {
            const [ticketsQuery, categoriesQuery] = await Promise.all([
                supabase.from('tickets').select('id, event_id, category_id, price, status, checked_in_at, created_at').in('event_id', eventIds),
                supabase.from('ticket_categories').select('id, event_id, name, price, total_quantity, sold_quantity').in('event_id', eventIds),
            ]);
            tickets = ticketsQuery.data || [];
            categories = categoriesQuery.data || [];
        }

        // 3. Calculs des KPIs Billetterie
        const validTickets = tickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE');
        const checkedInTickets = tickets.filter(t => t.status === 'UTILISE');
        const cancelledTickets = tickets.filter(t => t.status === 'ANNULE');

        const totalTicketFacialRevenue = validTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

        const ticketingCalc = FinancialCalculatorService.calculateTicketingFinancials({
            ticketFacialPrice: totalTicketFacialRevenue,
            serviceFeeRatePercent: ticketServiceFeeRate,
            aggregatorFeeRatePercent: ticketAggregatorFeeRate,
        });

        // 4. Calculs des KPIs Commandes & Restauration
        const validOrders = orders.filter(o => !['ANNULEE', 'REJETEE'].includes(o.order_status));
        const totalOrderRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

        const orderCalc = FinancialCalculatorService.calculateOrderFinancials({
            orderTotalAmount: totalOrderRevenue,
            commissionRatePercent: orderCommissionRate,
            aggregatorFeeRatePercent: ticketAggregatorFeeRate,
        });

        // 5. Synthèse financière consolidée
        const totalGrossRevenue = totalTicketFacialRevenue + totalOrderRevenue;
        const totalNetRevenue = ticketingCalc.partnerPayout + orderCalc.partnerPayout;
        const totalCommission = totalGrossRevenue - totalNetRevenue;

        // Retraits
        const paidWithdrawals = withdrawals.filter(w => w.status === 'PAID');
        const pendingWithdrawalsList = withdrawals.filter(w => ['PENDING', 'PROCESSING'].includes(w.status));

        const totalWithdrawn = paidWithdrawals.reduce((sum, w) => sum + (Number(w.net_amount) || 0), 0);
        const pendingWithdrawalsAmount = pendingWithdrawalsList.reduce((sum, w) => sum + (Number(w.gross_amount) || 0), 0);

        const soldeDisponible = Math.max(0, totalNetRevenue - totalWithdrawn - pendingWithdrawalsAmount);

        // 6. Découpage par événement
        const eventBreakdowns: PartnerEventBreakdown[] = events.map(ev => {
            const evTickets = tickets.filter(t => t.event_id === ev.id);
            const evValidTickets = evTickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE');
            const evCheckedIn = evTickets.filter(t => t.status === 'UTILISE').length;
            const evSold = evValidTickets.length;
            const evCapacity = Number(ev.capacity) || 1;
            const evAvailable = Math.max(0, evCapacity - evSold);

            const evGross = evValidTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
            const evCalc = FinancialCalculatorService.calculateTicketingFinancials({
                ticketFacialPrice: evGross,
                serviceFeeRatePercent: ticketServiceFeeRate,
                aggregatorFeeRatePercent: ticketAggregatorFeeRate,
            });

            return {
                id: ev.id,
                title: ev.title,
                startDate: ev.start_date,
                startTime: ev.start_time,
                location: ev.location,
                city: ev.city,
                status: ev.status,
                capacity: evCapacity,
                ticketsSold: evSold,
                ticketsAvailable: evAvailable,
                ticketsCheckedIn: evCheckedIn,
                fillRatePercent: Math.min(100, Math.round((evSold / evCapacity) * 100)),
                checkInRatePercent: evSold > 0 ? Math.min(100, Math.round((evCheckedIn / evSold) * 100)) : 0,
                grossRevenue: evGross,
                commissionAmount: 0,
                netRevenue: evCalc.partnerPayout,
            };
        });

        // 7. Flux d'activité récent unifié (Ventes, Scans, Commandes, Retraits)
        const recentActivity: PartnerActivityItem[] = [];

        // Ventes de billets récentes
        validTickets.slice(0, 8).forEach(t => {
            const ev = events.find(e => e.id === t.event_id);
            recentActivity.push({
                id: `sale-${t.id}`,
                type: 'SALE',
                title: `Billet Vendu — ${ev?.title || 'Événement'}`,
                description: `Billet N° ${t.id.slice(0, 8)} • ${Number(t.price).toLocaleString('fr-FR')} FCFA`,
                amount: Number(t.price),
                status: t.status,
                createdAt: t.created_at,
            });
        });

        // Scans de billets récents
        checkedInTickets.filter(t => t.checked_in_at).slice(0, 5).forEach(t => {
            const ev = events.find(e => e.id === t.event_id);
            recentActivity.push({
                id: `scan-${t.id}`,
                type: 'CHECKIN',
                title: `Billet Composté aux Portes`,
                description: `${ev?.title || 'Événement'} • Contrôle validé`,
                status: 'UTILISE',
                createdAt: t.checked_in_at,
            });
        });

        // Commandes récentes
        orders.slice(0, 5).forEach(o => {
            recentActivity.push({
                id: `order-${o.id}`,
                type: 'ORDER',
                title: `Commande ${o.order_number}`,
                description: `Mode: ${o.delivery_mode} • ${Number(o.total_amount).toLocaleString('fr-FR')} FCFA`,
                amount: Number(o.total_amount),
                status: o.order_status,
                createdAt: o.created_at,
            });
        });

        // Retraits récents
        withdrawals.slice(0, 3).forEach(w => {
            recentActivity.push({
                id: `w-${w.id}`,
                type: 'WITHDRAWAL',
                title: `Demande de Retrait`,
                description: `${w.withdrawal_method} • ${Number(w.gross_amount).toLocaleString('fr-FR')} FCFA`,
                amount: Number(w.net_amount),
                status: w.status,
                createdAt: w.created_at,
            });
        });

        // Trier l'activité par date décroissante
        recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            partner: {
                id: partner.id,
                companyName: partner.company_name,
                commercialName: partner.commercial_name || partner.company_name,
                phone: partner.phone,
                email: partner.email,
                status: partner.status,
                isVerified: partner.is_verified,
            },
            kpis: {
                grossRevenue: totalGrossRevenue,
                netRevenue: totalNetRevenue,
                commissionAmount: totalCommission,
                ticketsSold: validTickets.length,
                ticketsCheckedIn: checkedInTickets.length,
                ticketsCancelled: cancelledTickets.length,
                totalEvents: events.length,
                activeEvents: events.filter(e => e.status === 'PUBLIE').length,
                ordersCount: validOrders.length,
                ordersRevenue: totalOrderRevenue,
                soldeDisponible,
                totalWithdrawn,
                pendingWithdrawals: pendingWithdrawalsAmount,
            },
            events: eventBreakdowns,
            recentActivity: recentActivity.slice(0, 15),
        };
    }

    /**
     * Génère les données déterministes du Rapport de Clôture (Z de Caisse / Clôture Événement).
     */
    public static async getClosingReportData(userId: string, eventId: string): Promise<ClosingReportData> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);

        if (!eventId) {
            throw new Error('EVENT_ID_REQUIS');
        }

        // 1. Récupération de l'événement et vérification stricte de propriété multi-tenant
        const { data: event, error: evErr } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .maybeSingle();

        if (evErr || !event) {
            throw new Error('EVENEMENT_INTROUVABLE');
        }

        if (event.partner_id !== partner.id) {
            throw new Error('ACCES_REFUSE_AUTRE_TENANT');
        }

        // 2. Récupération concurrente des catégories, billets et paiements de cet événement
        const [categoriesRes, ticketsRes, paymentsRes] = await Promise.all([
            supabase.from('ticket_categories').select('*').eq('event_id', eventId).order('price', { ascending: true }),
            supabase.from('tickets').select('*').eq('event_id', eventId),
            supabase.from('payments').select('*').eq('partner_id', partner.id),
        ]);

        const categories = categoriesRes.data || [];
        const tickets = ticketsRes.data || [];
        const allPartnerPayments = paymentsRes.data || [];

        // Filtrer les paiements associés à cet événement
        const eventPayments = allPartnerPayments.filter(p => {
            if (p.metadata?.event_id === eventId) return true;
            if (p.payment_target === 'TICKET' && tickets.some(t => t.id === p.ticket_id)) return true;
            return false;
        });

        // 3. Répartition des ventes par catégorie
        const salesByCategory: CategorySalesSummary[] = categories.map(cat => {
            const catTickets = tickets.filter(t => t.category_id === cat.id);
            const soldTickets = catTickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE');
            const checkedIn = catTickets.filter(t => t.status === 'UTILISE').length;
            const soldQty = soldTickets.length;
            const totalAllocated = Number(cat.total_quantity) || 0;
            const remainingQty = Math.max(0, totalAllocated - soldQty);

            const unitPrice = Number(cat.price) || 0;
            const grossAmount = soldQty * unitPrice;
            const commissionAmount = 0;
            const netAmount = grossAmount - commissionAmount;

            return {
                categoryId: cat.id,
                name: cat.name,
                unitPrice,
                totalAllocated,
                soldQuantity: soldQty,
                checkedInQuantity: checkedIn,
                remainingQuantity: remainingQty,
                grossAmount,
                commissionAmount,
                netAmount,
            };
        });

        // 4. Synthèse des Billets
        const totalAllocated = categories.reduce((s, c) => s + (Number(c.total_quantity) || 0), 0);
        const totalSold = tickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE').length;
        const totalCheckedIn = tickets.filter(t => t.status === 'UTILISE').length;
        const totalCancelled = tickets.filter(t => t.status === 'ANNULE').length;
        const totalRefunded = tickets.filter(t => t.status === 'REMBOURSE').length;
        const totalRemaining = Math.max(0, (event.capacity || totalAllocated) - totalSold);

        const checkInRatePercent = totalSold > 0 ? Math.min(100, Math.round((totalCheckedIn / totalSold) * 100)) : 0;
        const fillRatePercent = event.capacity > 0 ? Math.min(100, Math.round((totalSold / event.capacity) * 100)) : 0;

        // 5. Synthèse des Paiements
        const confirmedPayments = eventPayments.filter(p => p.status === 'SUCCESS');
        const pendingPayments = eventPayments.filter(p => p.status === 'PENDING');
        const refundedPayments = eventPayments.filter(p => p.status === 'REFUNDED');

        const confirmedGross = confirmedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const pendingGross = pendingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const refundedGross = refundedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

        // 6. Synthèse Financière Consolidée
        const totalGross = salesByCategory.reduce((s, c) => s + c.grossAmount, 0);
        const totalCommission = salesByCategory.reduce((s, c) => s + c.commissionAmount, 0);
        const totalRefundedAmount = refundedGross;
        const totalNet = totalGross - totalCommission - totalRefundedAmount;

        const dateSuffix = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const reportId = `CLOTURE-${eventId.slice(0, 8).toUpperCase()}-${dateSuffix}`;

        return {
            reportId,
            generatedAt: new Date().toISOString(),
            event: {
                id: event.id,
                title: event.title,
                category: event.category || 'Événement',
                startDate: event.start_date,
                startTime: event.start_time,
                venue: event.location,
                city: event.city,
                status: event.status,
                capacity: event.capacity || totalAllocated,
            },
            partner: {
                id: partner.id,
                companyName: partner.company_name,
                commercialName: partner.commercial_name || partner.company_name,
                phone: partner.phone || '',
                email: partner.email || '',
            },
            salesByCategory,
            paymentsSummary: {
                confirmedCount: confirmedPayments.length,
                confirmedGross,
                pendingCount: pendingPayments.length,
                pendingGross,
                refundedCount: refundedPayments.length,
                refundedGross,
            },
            ticketsSummary: {
                totalAllocated: event.capacity || totalAllocated,
                sold: totalSold,
                checkedIn: totalCheckedIn,
                cancelled: totalCancelled,
                refunded: totalRefunded,
                remaining: totalRemaining,
                checkInRatePercent,
                fillRatePercent,
            },
            financialSummary: {
                totalGross,
                totalCommission,
                totalRefunded: totalRefundedAmount,
                totalNet,
            },
        };
    }

    /**
     * Génère un document PDF vectoriel officiel pour le Rapport de Clôture (Z de Caisse).
     */
    public static async generateClosingReportPdf(data: ClosingReportData): Promise<Buffer> {
        const pageWidth = 595.28; // A4 portrait (points)
        const pageHeight = 841.89;

        let stream = '';

        // 1. Fond neutre haute définition
        stream += 'q\n';
        stream += '0.98 0.98 0.99 rg\n';
        stream += `0 0 ${pageWidth} ${pageHeight} re f\n`;

        // 2. En-tête Sunset Coral Event Village
        const headerY = pageHeight - 90;
        stream += '1 0.34 0.13 rg\n'; // #FF5722 Sunset Coral
        stream += `36 ${headerY} ${pageWidth - 72} 70 re f\n`;

        // Accent Gradient Bar
        stream += '1 0.24 0.41 rg\n'; // #FF3D68
        stream += `36 ${headerY} ${pageWidth - 72} 4 re f\n`;

        // Titres Header
        stream += 'BT\n/F2 16 Tf\n1 1 1 rg\n';
        stream += `52 ${headerY + 44} Td\n(EVENT VILLAGE -- RAPPORT DE CLOTURE DE SESSION) Tj\nET\n`;

        stream += 'BT\n/F1 9 Tf\n1 1 1 rg\n';
        stream += `52 ${headerY + 28} Td\n(DOCUMENT OFFICIEL DE SYNTHESE COMPTABLE & DE BILLETTERIE) Tj\nET\n`;

        stream += 'BT\n/F2 9 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 210} ${headerY + 44} Td\n(ID: ${escapePdfText(data.reportId)}) Tj\nET\n`;

        const genDateFormatted = new Date(data.generatedAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        stream += 'BT\n/F1 8 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 210} ${headerY + 28} Td\n(Edite le: ${escapePdfText(genDateFormatted)}) Tj\nET\n`;

        // 3. Carte Résumé Événement & Partenaire (2 Colonnes)
        const infoY = headerY - 70;
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `36 ${infoY} ${pageWidth - 72} 58 re B\n`;

        // Colonne 1 : Événement
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `50 ${infoY + 40} Td\n(${escapePdfText(data.event.title.slice(0, 42))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `50 ${infoY + 26} Td\n(Date: ${escapePdfText(data.event.startDate)} a ${escapePdfText(data.event.startTime)} -- Lieu: ${escapePdfText(data.event.venue)}, ${escapePdfText(data.event.city)}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `50 ${infoY + 12} Td\n(Statut: ${escapePdfText(data.event.status)} -- Capacite: ${data.event.capacity} places) Tj\nET\n`;

        // Colonne 2 : Organisateur / Partenaire
        stream += 'BT\n/F2 10 Tf\n1 0.34 0.13 rg\n';
        stream += `${pageWidth - 230} ${infoY + 40} Td\n(Organisateur: ${escapePdfText(data.partner.commercialName.slice(0, 28))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${pageWidth - 230} ${infoY + 26} Td\n(Societe: ${escapePdfText(data.partner.companyName.slice(0, 30))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${pageWidth - 230} ${infoY + 12} Td\n(Contact: ${escapePdfText(data.partner.phone || data.partner.email || 'support@event-village.sn')}) Tj\nET\n`;

        // 4. Section : VENTES PAR CATÉGORIE (Tableau Vectoriel)
        const tableY = infoY - 26;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${tableY} Td\n(1. VENTILATION DES VENTES PAR FORMULE / CATEGORIE) Tj\nET\n`;

        // En-tête du tableau
        const theadY = tableY - 22;
        stream += '0.94 0.96 0.98 rg\n';
        stream += `36 ${theadY} ${pageWidth - 72} 20 re f\n`;

        stream += 'BT\n/F2 8.5 Tf\n0.20 0.25 0.35 rg\n';
        stream += `44 ${theadY + 6} Td\n(CATEGORIE) Tj\n`;
        stream += `160 0 Td\n(PRIX UNIT.) Tj\n`;
        stream += `80 0 Td\n(VENDUS) Tj\n`;
        stream += `70 0 Td\n(COMPOSTES) Tj\n`;
        stream += `70 0 Td\n(RESTANTS) Tj\n`;
        stream += `70 0 Td\n(TOTAL BRUT) Tj\n`;
        stream += 'ET\n';

        // Lignes du tableau
        let rowY = theadY - 18;
        data.salesByCategory.forEach((cat, idx) => {
            const bg = idx % 2 === 0 ? '1 1 1' : '0.98 0.98 0.99';
            stream += `${bg} rg\n`;
            stream += `36 ${rowY} ${pageWidth - 72} 18 re f\n`;

            stream += '0.88 0.90 0.94 RG\n0.5 w\n';
            stream += `36 ${rowY} m ${pageWidth - 36} ${rowY} l S\n`;

            stream += 'BT\n/F1 8.5 Tf\n0.06 0.09 0.16 rg\n';
            stream += `44 ${rowY + 5} Td\n(${escapePdfText(cat.name.slice(0, 22))}) Tj\n`;
            stream += `160 0 Td\n(${cat.unitPrice.toLocaleString('fr-FR')} F) Tj\n`;
            stream += `80 0 Td\n(${cat.soldQuantity}) Tj\n`;
            stream += `70 0 Td\n(${cat.checkedInQuantity}) Tj\n`;
            stream += `70 0 Td\n(${cat.remainingQuantity}) Tj\n`;
            stream += 'ET\n';

            stream += 'BT\n/F2 8.5 Tf\n0.06 0.09 0.16 rg\n';
            stream += `${pageWidth - 110} ${rowY + 5} Td\n(${cat.grossAmount.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;

            rowY -= 18;
        });

        // 5. Section : SYNTHÈSE DE BILLETTERIE & CONTRÔLE D'ACCÈS
        const summaryBoxY = rowY - 14;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${summaryBoxY} Td\n(2. STATISTIQUES D'ACCES & RECONCILIATION) Tj\nET\n`;

        const statGridY = summaryBoxY - 58;
        const boxWidth = (pageWidth - 72 - 20) / 3;

        // Box 1 : Billets Vendus / Capacité
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `36 ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `46 ${statGridY + 34} Td\n(BILLETS VENDUS / CAPACITE) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `46 ${statGridY + 16} Td\n(${data.ticketsSummary.sold} / ${data.ticketsSummary.totalAllocated} (${data.ticketsSummary.fillRatePercent}%)) Tj\nET\n`;

        // Box 2 : Billets Compostés aux Portes
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `${36 + boxWidth + 10} ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${46 + boxWidth + 10} ${statGridY + 34} Td\n(ENTREES VALIDEES / SCAN) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.10 0.60 0.30 rg\n';
        stream += `${46 + boxWidth + 10} ${statGridY + 16} Td\n(${data.ticketsSummary.checkedIn} entr\xE9es (${data.ticketsSummary.checkInRatePercent}%)) Tj\nET\n`;

        // Box 3 : Annulations & Remboursements
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `${36 + (boxWidth + 10) * 2} ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${46 + (boxWidth + 10) * 2} ${statGridY + 34} Td\n(ANNULES / REMBOURSES) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.80 0.20 0.20 rg\n';
        stream += `${46 + (boxWidth + 10) * 2} ${statGridY + 16} Td\n(${data.ticketsSummary.cancelled} annule(s)) Tj\nET\n`;

        // 6. Section : SYNTHÈSE COMPTABLE & VERSEMENTS (Encadré Premium)
        const finSectionY = statGridY - 26;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${finSectionY} Td\n(3. RECAPITULATIF FINANCIER & REVERSEMENT NET) Tj\nET\n`;

        const finBoxY = finSectionY - 110;
        stream += '0.96 0.97 0.99 rg\n0.80 0.85 0.90 RG\n1.5 w\n';
        stream += `36 ${finBoxY} ${pageWidth - 72} 98 re B\n`;

        // Ligne 1 : Chiffre d'affaires Brut
        stream += 'BT\n/F1 10 Tf\n0.20 0.25 0.35 rg\n';
        stream += `52 ${finBoxY + 74} Td\n(Chiffre d'affaires brut encaisse) Tj\nET\n`;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `${pageWidth - 180} ${finBoxY + 74} Td\n(${data.financialSummary.totalGross.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;

        // Ligne 2 : Frais & Commissions Event Village
        stream += 'BT\n/F1 10 Tf\n0.20 0.25 0.35 rg\n';
        stream += `52 ${finBoxY + 54} Td\n(Frais de billetterie & commissions de service) Tj\nET\n`;
        stream += 'BT\n/F2 11 Tf\n0.80 0.20 0.20 rg\n';
        stream += `${pageWidth - 180} ${finBoxY + 54} Td\n(- ${data.financialSummary.totalCommission.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;

        // Ligne 3 : Remboursements clients
        stream += 'BT\n/F1 10 Tf\n0.20 0.25 0.35 rg\n';
        stream += `52 ${finBoxY + 34} Td\n(Remboursements & retours valides) Tj\nET\n`;
        stream += 'BT\n/F2 11 Tf\n0.80 0.20 0.20 rg\n';
        stream += `${pageWidth - 180} ${finBoxY + 34} Td\n(- ${data.financialSummary.totalRefunded.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;

        // Ligne 4 : NET PARTENAIRE (Surbrillance Orange)
        stream += '1 0.34 0.13 rg\n';
        stream += `36 ${finBoxY} ${pageWidth - 72} 26 re f\n`;

        stream += 'BT\n/F2 11 Tf\n1 1 1 rg\n';
        stream += `52 ${finBoxY + 8} Td\n(MONTANT TOTAL NET A REVERSER AU PARTENAIRE) Tj\nET\n`;
        stream += 'BT\n/F2 13 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 190} ${finBoxY + 7} Td\n(${data.financialSummary.totalNet.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;

        // 7. Footer & Sceau d'authenticité
        const footerY = 30;
        stream += '0.85 0.88 0.92 RG\n0.75 w\n';
        stream += `36 ${footerY + 22} m ${pageWidth - 36} ${footerY + 22} l S\n`;

        stream += 'BT\n/F1 7.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `36 ${footerY + 10} Td\n(Document comptable certifie genere automatiquement par Event Village Senegal -- contact@event-village.sn) Tj\nET\n`;

        stream += 'BT\n/F2 7.5 Tf\n0.35 0.40 0.50 rg\n';
        stream += `36 ${footerY} Td\n(Certificat de cloture : ${escapePdfText(data.reportId)} -- Conforme CDC V3.0) Tj\nET\n`;

        stream += 'Q\n';

        // 8. Structure PDF-1.4 standard
        const streamLength = Buffer.byteLength(stream, 'latin1');
        const objects = [];
        objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj';
        objects[2] = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
        objects[3] = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`;
        objects[4] = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj`;
        objects[5] = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj';
        objects[6] = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj';

        let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        const xrefOffsets = [0];

        for (let i = 1; i <= 6; i++) {
            xrefOffsets[i] = Buffer.byteLength(body, 'latin1');
            body += objects[i] + '\n';
        }

        const startXref = Buffer.byteLength(body, 'latin1');
        body += 'xref\n0 7\n0000000000 65535 f \n';
        for (let i = 1; i <= 6; i++) {
            const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
            body += `${offsetStr} 00000 n \n`;
        }

        body += 'trailer\n<< /Size 7 /Root 1 0 R >>\n';
        body += `startxref\n${startXref}\n%%EOF\n`;

        return Buffer.from(body, 'latin1');
    }

    /**
     * Génère un fichier export comptable structuré (CSV / XLSX standard avec UTF-8 BOM).
     */
    public static async generateAccountingExport(
        userId: string,
        eventId?: string,
        format: 'xlsx' | 'csv' = 'csv'
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);

        // 1. Récupération des événements du partenaire
        let eventsQuery = supabase.from('events').select('id, title, start_date').eq('partner_id', partner.id);
        if (eventId) {
            eventsQuery = eventsQuery.eq('id', eventId);
        }
        const { data: events, error: evErr } = await eventsQuery;
        if (evErr || !events || events.length === 0) {
            if (eventId) throw new Error('EVENEMENT_INTROUVABLE');
        }

        const eventIds = (events || []).map(e => e.id);

        // 2. Récupération des transactions de billetterie et paiements
        const [ticketsRes, paymentsRes, categoriesRes] = await Promise.all([
            eventIds.length > 0
                ? supabase.from('tickets').select('id, event_id, category_id, ticket_number, price, status, created_at').in('event_id', eventIds)
                : Promise.resolve({ data: [] }),
            supabase.from('payments').select('id, external_order_id, transaction_id, payment_target, amount, status, partner_payout_amount, service_fee, aggregator_fee, created_at, metadata').eq('partner_id', partner.id),
            eventIds.length > 0
                ? supabase.from('ticket_categories').select('id, name, price').in('event_id', eventIds)
                : Promise.resolve({ data: [] }),
        ]);

        const tickets = ticketsRes.data || [];
        const payments = paymentsRes.data || [];
        const categories = categoriesRes.data || [];

        // 3. Construction des lignes comptables
        const headers = [
            'Date',
            'Evenement',
            'Reference Transaction',
            'Type Operation',
            'Billet / Commande',
            'Categorie',
            'Quantite',
            'Montant Brut (FCFA)',
            'Frais (FCFA)',
            'Commission (FCFA)',
            'Remboursement (FCFA)',
            'Montant Net (FCFA)',
            'Statut Paiement'
        ];

        const rows: string[][] = [];

        // Lignes de billetterie
        tickets.forEach(t => {
            const ev = (events || []).find(e => e.id === t.event_id);
            const cat = categories.find(c => c.id === t.category_id);
            const dateStr = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
            const price = Number(t.price) || 0;
            const isRefunded = t.status === 'REMBOURSE';
            const isCancelled = t.status === 'ANNULE';

            const brut = (isCancelled || isRefunded) ? 0 : price;
            const refund = isRefunded ? price : 0;
            const net = (isCancelled || isRefunded) ? 0 : price;

            rows.push([
                dateStr,
                `"${(ev?.title || 'Evenement').replace(/"/g, '""')}"`,
                `"TICK-${t.id.slice(0, 8)}"`,
                'BILLETTERIE',
                `"${t.ticket_number || t.id}"`,
                `"${(cat?.name || 'Standard').replace(/"/g, '""')}"`,
                '1',
                String(brut),
                '0',
                '0',
                String(refund),
                String(net),
                t.status
            ]);
        });

        // 4. Assemblage du contenu CSV avec séparateur point-virgule et UTF-8 BOM pour Excel
        const csvLines = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ];

        const csvContent = '\uFEFF' + csvLines.join('\r\n');
        const buffer = Buffer.from(csvContent, 'utf8');

        const prefix = eventId ? `Cloture-${eventId.slice(0, 8)}` : `Comptabilite-${partner.company_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const dateTag = new Date().toISOString().split('T')[0];
        const ext = format === 'xlsx' ? 'csv' : 'csv';
        const filename = `EventVillage-${prefix}-${dateTag}.${ext}`;
        const contentType = 'text/csv; charset=utf-8';

        return {
            buffer,
            contentType,
            filename,
        };
    }
}
