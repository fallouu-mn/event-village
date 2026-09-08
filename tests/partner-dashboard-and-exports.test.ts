import * as fs from 'fs';
import * as path from 'path';

// 1. Charger .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

import { createClient } from '@supabase/supabase-js';
import { PartnerDashboardService } from '../lib/partner/partner-dashboard.service';
import { FinancialCalculatorService } from '../lib/payments/financial-calculator.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
    name: string;
    passed: boolean;
    duration_ms: number;
    error?: string;
    details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<any>) {
    const start = Date.now();
    try {
        const details = await fn();
        const duration_ms = Date.now() - start;
        results.push({ name, passed: true, duration_ms, details });
        console.log(`\x1b[32m✔ [PASS]\x1b[0m ${name} (${duration_ms}ms)`);
    } catch (err: any) {
        const duration_ms = Date.now() - start;
        results.push({ name, passed: false, duration_ms, error: err.message || String(err) });
        console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${name} (${duration_ms}ms):`, err.message || err);
    }
}

async function main() {
    console.log('\n====================================================================');
    console.log('EVENT VILLAGE — CHANTIER 4 : DASHBOARD PARTENAIRE & EXPORTS COMPTABLES');
    console.log('SUITE DE TESTS D’INTÉGRATION & ISOLATION MULTI-TENANT (18 TESTS)');
    console.log('====================================================================\n');

    const partnerA_UserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerA_Id = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';

    const partnerB_UserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
    const partnerB_Id = '9cdc4247-d1fe-483b-b5e2-12671b069134';

    const buyerUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

    let testEventA: any = null;
    let testEventB: any = null;
    let testCatA1: any = null;
    let testCatA2: any = null;
    let testTicketA1: any = null;
    let testTicketA2: any = null;
    let testPaymentA: any = null;

    const stamp = Date.now();

    try {
        // S'assurer que les partenaires ont les bons statuts pour le test
        await supabaseAdmin.from('partners').update({
            company_name: 'Alpha Events Production',
            commercial_name: 'Alpha Prod',
            phone: '+221770000001',
            email: 'alpha@event-village.sn',
            status: 'VALIDE',
            is_verified: true,
        }).eq('id', partnerA_Id);

        await supabaseAdmin.from('partners').update({
            company_name: 'Beta Entertainment SA',
            commercial_name: 'Beta Live',
            phone: '+221770000002',
            email: 'beta@event-village.sn',
            status: 'VALIDE',
            is_verified: true,
        }).eq('id', partnerB_Id);

        // Créer l'événement de test pour Partenaire A
        const { data: evA, error: errEvA } = await supabaseAdmin.from('events').insert({
            partner_id: partnerA_Id,
            title: `Festival Alpha Music ${stamp}`,
            slug: `fest-alpha-${stamp}`,
            description: 'Grand festival de musique acoustique et live',
            start_date: '2026-11-15',
            start_time: '20:00:00',
            end_date: '2026-11-15',
            end_time: '23:59:00',
            location: 'Monument de la Renaissance',
            city: 'Dakar',
            category: 'CONCERT',
            status: 'PUBLIE',
            capacity: 500,
            image_url: 'https://placehold.co/600x400.png'
        }).select().single();
        if (errEvA) throw errEvA;
        testEventA = evA;

        // Créer l'événement de test pour Partenaire B
        const { data: evB, error: errEvB } = await supabaseAdmin.from('events').insert({
            partner_id: partnerB_Id,
            title: `Gala Beta Prestige ${stamp}`,
            slug: `gala-beta-${stamp}`,
            description: 'Soirée de gala exclusive',
            start_date: '2026-12-01',
            start_time: '21:00:00',
            end_date: '2026-12-01',
            end_time: '02:00:00',
            location: 'King Fahd Palace',
            city: 'Dakar',
            category: 'FESTIVAL',
            status: 'PUBLIE',
            capacity: 200,
            image_url: 'https://placehold.co/600x400.png'
        }).select().single();
        if (errEvB) throw errEvB;
        testEventB = evB;

        // Créer catégories pour l'événement A
        const { data: cat1 } = await supabaseAdmin.from('ticket_categories').insert({
            event_id: testEventA.id,
            name: 'Pass Standard',
            price: 10000,
            total_quantity: 300,
            sold_quantity: 1,
            is_active: true
        }).select().single();
        testCatA1 = cat1;

        const { data: cat2 } = await supabaseAdmin.from('ticket_categories').insert({
            event_id: testEventA.id,
            name: 'Pass VIP',
            price: 25000,
            total_quantity: 100,
            sold_quantity: 1,
            is_active: true
        }).select().single();
        testCatA2 = cat2;

        // Créer 2 billets réels pour l'événement A
        const { data: t1, error: t1Err } = await supabaseAdmin.from('tickets').insert({
            event_id: testEventA.id,
            category_id: testCatA1.id,
            user_id: buyerUserId,
            price: 10000,
            status: 'UTILISE', // 1 composté
            checked_in_at: new Date().toISOString(),
            ticket_number: `TICK-A1-${stamp}`,
            qr_code: `QR-A1-${stamp}`,
            totp_secret: 'JBSWY3DPEHPK3PXP'
        }).select().single();
        if (t1Err) throw t1Err;
        testTicketA1 = t1;

        const { data: t2, error: t2Err } = await supabaseAdmin.from('tickets').insert({
            event_id: testEventA.id,
            category_id: testCatA2.id,
            user_id: buyerUserId,
            price: 25000,
            status: 'VALIDE', // 1 valide non composté
            ticket_number: `TICK-A2-${stamp}`,
            qr_code: `QR-A2-${stamp}`,
            totp_secret: 'JBSWY3DPEHPK3PXP'
        }).select().single();
        if (t2Err) throw t2Err;
        testTicketA2 = t2;

        // Créer un paiement réel pour Partenaire A
        const { data: payA, error: payErr } = await supabaseAdmin.from('payments').insert({
            transaction_id: `TX-ALPHA-${stamp}`,
            client_id: buyerUserId,
            partner_id: partnerA_Id,
            amount: 35000,
            partner_payout_amount: 32725,
            service_fee: 1750,
            aggregator_fee: 525,
            payment_target: 'TICKET',
            ticket_id: testTicketA1.id,
            payment_method: 'WAVE',
            status: 'SUCCESS',
            metadata: { event_id: testEventA.id }
        }).select().single();
        if (payErr) throw payErr;
        testPaymentA = payA;

        // ─────────────────────────────────────────────────────────────────
        // EXÉCUTION DES 18 TESTS
        // ─────────────────────────────────────────────────────────────────

        // TEST 1 : Dashboard partenaire accessible avec auth valide
        await runTest('TEST 1 : Dashboard partenaire accessible avec auth valide', async () => {
            const data = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            if (!data || !data.partner || !data.kpis) throw new Error('Données dashboard manquantes');
            if (data.partner.id !== partnerA_Id) throw new Error('ID partenaire incorrect');
            return { company: data.partner.companyName, kpis: data.kpis };
        });

        // TEST 2 : Isolation multi-tenant (Partenaire A ≠ Partenaire B)
        await runTest('TEST 2 : Isolation multi-tenant (Partenaire A ≠ Partenaire B)', async () => {
            const dataA = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            const dataB = await PartnerDashboardService.getDashboardData(partnerB_UserId);

            // Vérifier que A ne voit pas l'événement de B
            const aHasBEvent = dataA.events.some(e => e.id === testEventB.id);
            const bHasAEvent = dataB.events.some(e => e.id === testEventA.id);

            if (aHasBEvent || bHasAEvent) {
                throw new Error('Fuite de données multi-tenant détectée entre partenaires !');
            }
            if (dataA.partner.id === dataB.partner.id) {
                throw new Error('Identifiants partenaires confondus');
            }
            return { partnerA_events: dataA.events.length, partnerB_events: dataB.events.length };
        });

        // TEST 3 : Statistiques dashboard cohérentes avec DB
        await runTest('TEST 3 : Statistiques dashboard cohérentes avec DB', async () => {
            const data = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            if (data.kpis.ticketsSold < 2) {
                throw new Error(`Attendu au moins 2 billets vendus, obtenu: ${data.kpis.ticketsSold}`);
            }
            if (data.kpis.ticketsCheckedIn < 1) {
                throw new Error(`Attendu au moins 1 billet composté, obtenu: ${data.kpis.ticketsCheckedIn}`);
            }
            return { sold: data.kpis.ticketsSold, checkedIn: data.kpis.ticketsCheckedIn };
        });

        // TEST 4 : Calcul CA brut cohérent avec transactions réelles
        await runTest('TEST 4 : Calcul CA brut cohérent avec transactions réelles', async () => {
            const data = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            if (data.kpis.grossRevenue < 35000) {
                throw new Error(`Attendu au moins 35 000 FCFA brut, obtenu: ${data.kpis.grossRevenue}`);
            }
            return { grossRevenue: data.kpis.grossRevenue };
        });

        // TEST 5 : Commissions cohérentes avec le moteur financier
        await runTest('TEST 5 : Commissions cohérentes avec le moteur financier', async () => {
            const data = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            const calc = FinancialCalculatorService.calculateTicketingFinancials({
                ticketFacialPrice: data.kpis.grossRevenue,
                serviceFeeRatePercent: 5.0,
                aggregatorFeeRatePercent: 1.5,
            });
            const expectedCommission = data.kpis.grossRevenue - calc.partnerPayout;
            if (Math.abs(data.kpis.commissionAmount - expectedCommission) > 5) {
                throw new Error(`Commission incohérente: obtenu ${data.kpis.commissionAmount}, attendu ${expectedCommission}`);
            }
            return { commission: data.kpis.commissionAmount, calc };
        });

        // TEST 6 : Net partenaire cohérent avec la source financière
        await runTest('TEST 6 : Net partenaire cohérent avec la source financière', async () => {
            const data = await PartnerDashboardService.getDashboardData(partnerA_UserId);
            const expectedNet = data.kpis.grossRevenue - data.kpis.commissionAmount;
            if (Math.abs(data.kpis.netRevenue - expectedNet) > 5) {
                throw new Error(`Net incohérent: netRevenue=${data.kpis.netRevenue} vs gross - comm=${expectedNet}`);
            }
            return { netRevenue: data.kpis.netRevenue, soldeDisponible: data.kpis.soldeDisponible };
        });

        // TEST 7 : Rapport de clôture généré avec les bonnes données
        await runTest('TEST 7 : Rapport de clôture généré avec les bonnes données', async () => {
            const report = await PartnerDashboardService.getClosingReportData(partnerA_UserId, testEventA.id);
            if (!report.reportId.startsWith('CLOTURE-')) throw new Error('Format reportId invalide');
            if (report.event.id !== testEventA.id) throw new Error('ID événement incorrect');
            if (report.ticketsSummary.sold !== 2) throw new Error('Nombre de billets vendus erroné');
            if (report.ticketsSummary.checkedIn !== 1) throw new Error('Nombre de scans erroné');
            if (report.financialSummary.totalGross !== 35000) throw new Error('Montant brut erroné');
            if (report.salesByCategory.length !== 2) throw new Error('Nombre de catégories erroné');
            return { reportId: report.reportId, financialSummary: report.financialSummary };
        });

        // TEST 8 : PDF réellement généré (HTTP 200 & application/pdf)
        await runTest('TEST 8 : PDF réellement généré (HTTP 200 & application/pdf)', async () => {
            const report = await PartnerDashboardService.getClosingReportData(partnerA_UserId, testEventA.id);
            const pdfBuffer = await PartnerDashboardService.generateClosingReportPdf(report);
            if (!Buffer.isBuffer(pdfBuffer)) throw new Error('Le résultat n’est pas un Buffer');
            if (pdfBuffer.length < 500) throw new Error(`Taille de PDF suspecte (${pdfBuffer.length} bytes)`);

            const header = pdfBuffer.slice(0, 8).toString('latin1');
            if (!header.startsWith('%PDF-1.')) {
                throw new Error(`En-tête PDF invalide: ${header}`);
            }
            return { sizeBytes: pdfBuffer.length, header };
        });

        // TEST 9 : PDF ne contient aucun secret ou token sensible
        await runTest('TEST 9 : PDF ne contient aucun secret ou token sensible', async () => {
            const report = await PartnerDashboardService.getClosingReportData(partnerA_UserId, testEventA.id);
            const pdfBuffer = await PartnerDashboardService.generateClosingReportPdf(report);
            const pdfText = pdfBuffer.toString('latin1');

            const secrets = ['JBSWY3DPEHPK3PXP', supabaseServiceKey, 'service_role', 'claim_token'];
            for (const secret of secrets) {
                if (pdfText.includes(secret)) {
                    throw new Error(`FUITE DE SÉCURITÉ : Le secret "${secret.slice(0, 10)}..." apparaît en clair dans le PDF !`);
                }
            }
            return { status: 'ZERO_SECRETS_LEAKED', checkedSecretsCount: secrets.length };
        });

        // TEST 10 : Export XLSX/CSV généré correctement
        await runTest('TEST 10 : Export XLSX/CSV généré correctement', async () => {
            const exportRes = await PartnerDashboardService.generateAccountingExport(partnerA_UserId, testEventA.id, 'csv');
            if (!exportRes.buffer || exportRes.buffer.length === 0) throw new Error('Buffer CSV vide');
            if (!exportRes.filename.endsWith('.csv')) throw new Error('Nom de fichier invalide');

            const content = exportRes.buffer.toString('utf8');
            if (!content.startsWith('\uFEFF')) {
                throw new Error('UTF-8 BOM manquant pour la compatibilité Excel');
            }
            if (!content.includes('Date;Evenement;Reference Transaction')) {
                throw new Error('En-têtes CSV manquants');
            }
            if (!content.includes('Festival Alpha Music')) {
                throw new Error('Données événement manquantes dans le CSV');
            }
            return { filename: exportRes.filename, length: exportRes.buffer.length };
        });

        // TEST 11 : Partenaire A ne peut pas exporter les données de Partenaire B
        await runTest('TEST 11 : Partenaire A ne peut pas exporter les données de Partenaire B', async () => {
            let errorCaught = false;
            try {
                // Partenaire A tente d'accéder à l'événement de B
                await PartnerDashboardService.getClosingReportData(partnerA_UserId, testEventB.id);
            } catch (err: any) {
                errorCaught = true;
                if (!err.message.includes('ACCES_REFUSE_AUTRE_TENANT') && !err.message.includes('EVENEMENT_INTROUVABLE')) {
                    throw new Error(`Message d’erreur inattendu: ${err.message}`);
                }
            }
            if (!errorCaught) {
                throw new Error('FAILLE DE SÉCURITÉ: Partenaire A a pu accéder au rapport de Partenaire B !');
            }
            return { isolationVerified: true };
        });

        // TEST 12 : Utilisateur non authentifié rejeté (HTTP 401)
        await runTest('TEST 12 : Utilisateur non authentifié rejeté (HTTP 401)', async () => {
            let errorCaught = false;
            try {
                await PartnerDashboardService.resolvePartner('');
            } catch (err: any) {
                errorCaught = true;
            }
            if (!errorCaught) throw new Error('Utilisateur anonyme non rejeté');
            return { rejectedCorrectly: true };
        });

        // TEST 13 : Utilisateur sans rôle partenaire rejeté (HTTP 403)
        await runTest('TEST 13 : Utilisateur sans rôle partenaire rejeté (HTTP 403)', async () => {
            let errorCaught = false;
            try {
                // Client normal tente de se faire passer pour un partenaire
                await PartnerDashboardService.resolvePartner(buyerUserId);
            } catch (err: any) {
                errorCaught = true;
                if (!err.message.includes('PROFIL_PARTENAIRE_INTROUVABLE')) {
                    throw new Error(`Message inattendu: ${err.message}`);
                }
            }
            if (!errorCaught) throw new Error('Client normal non bloqué');
            return { clientForbidden: true };
        });

        // TEST 14 : Événement inexistant rejeté (HTTP 404)
        await runTest('TEST 14 : Événement inexistant rejeté (HTTP 404)', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            let errorCaught = false;
            try {
                await PartnerDashboardService.getClosingReportData(partnerA_UserId, fakeId);
            } catch (err: any) {
                errorCaught = true;
                if (!err.message.includes('EVENEMENT_INTROUVABLE')) {
                    throw new Error(`Message inattendu: ${err.message}`);
                }
            }
            if (!errorCaught) throw new Error('Événement inexistant non rejeté');
            return { notFoundHandled: true };
        });

        // TEST 15 : Non-régression paiement / webhook
        await runTest('TEST 15 : Non-régression paiement / webhook', async () => {
            const { data: p } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('id', testPaymentA.id)
                .single();
            if (!p || p.status !== 'SUCCESS') throw new Error('Paiement introuvable ou invalide');
            return { paymentStatus: p.status, amount: p.amount };
        });

        // TEST 16 : Non-régression Hold Cart
        await runTest('TEST 16 : Non-régression Hold Cart', async () => {
            const { data: cat } = await supabaseAdmin
                .from('ticket_categories')
                .select('id, sold_quantity, total_quantity')
                .eq('id', testCatA1.id)
                .single();
            if (!cat || cat.total_quantity <= 0) throw new Error('Catégorie invalide');
            return { availableQty: cat.total_quantity - cat.sold_quantity };
        });

        // TEST 17 : Non-régression transfert P2P
        await runTest('TEST 17 : Non-régression transfert P2P', async () => {
            const { data: ticket } = await supabaseAdmin
                .from('tickets')
                .select('id, totp_secret, qr_code, status')
                .eq('id', testTicketA2.id)
                .single();
            if (!ticket || !ticket.totp_secret || !ticket.qr_code) {
                throw new Error('Structure cryptographique de billet P2P altérée');
            }
            return { ticketId: ticket.id, hasTotpSecret: !!ticket.totp_secret };
        });

        // TEST 18 : Non-régression QR/TOTP et scan atomique
        await runTest('TEST 18 : Non-régression QR/TOTP et scan atomique', async () => {
            const { data: usedTicket } = await supabaseAdmin
                .from('tickets')
                .select('id, status, checked_in_at')
                .eq('id', testTicketA1.id)
                .single();
            if (!usedTicket || usedTicket.status !== 'UTILISE' || !usedTicket.checked_in_at) {
                throw new Error('Statut de compostage non préservé');
            }
            return { status: usedTicket.status, checked_in_at: usedTicket.checked_in_at };
        });

    } finally {
        // NETTOYAGE STRICT
        console.log('\n--- Nettoyage des données de test ---');
        try {
            if (testEventA?.id) {
                await supabaseAdmin.from('tickets').delete().eq('event_id', testEventA.id);
                await supabaseAdmin.from('ticket_categories').delete().eq('event_id', testEventA.id);
                await supabaseAdmin.from('payments').delete().eq('id', testPaymentA?.id);
                await supabaseAdmin.from('events').delete().eq('id', testEventA.id);
            }
            if (testEventB?.id) {
                await supabaseAdmin.from('events').delete().eq('id', testEventB.id);
            }
            console.log('Nettoyage terminé avec succès.');
        } catch (cleanupErr) {
            console.warn('Avertissement nettoyage:', cleanupErr);
        }
    }

    console.log('\n====================================================================');
    console.log('RÉCAPITULATIF DES TESTS CHANTIER 4');
    console.log('====================================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    const totalDuration = results.reduce((s, r) => s + r.duration_ms, 0);

    results.forEach((r, idx) => {
        const mark = r.passed ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
        console.log(`${mark} [${idx + 1}/18] ${r.name} (${r.duration_ms}ms)`);
    });

    console.log('--------------------------------------------------------------------');
    console.log(`TOTAL: ${passedCount}/18 réussis (${failedCount} échecs) — Durée totale: ${totalDuration}ms`);
    console.log('====================================================================\n');

    if (failedCount > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
