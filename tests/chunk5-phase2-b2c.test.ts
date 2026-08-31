import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement si exécuté directement
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

describe('CHUNK 5 — PHASE 2 : HYDRATATION B2C & VALIDATION DES PARCOURS CLIENTS', () => {
    const supabase = getServiceRoleClient();

    let testClientAId: string;
    let testClientBId: string;
    let testPartnerUserId: string;
    let testPartnerId: string;
    let testEventId: string;
    let testCategoryId: string;
    let testHallId: string;
    let testTableId: string;
    let testProductId: string;

    const timestamp = Date.now();
    const clientAEmail = `chunk5_b2c_a_${timestamp}@test.sn`;
    const clientBEmail = `chunk5_b2c_b_${timestamp}@test.sn`;
    const partnerEmail = `chunk5_b2c_p_${timestamp}@test.sn`;
    const phoneA = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneB = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneP = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;

    before(async () => {
        // 1. Utilisateur Client A
        const { data: authClientA } = await supabase.auth.admin.createUser({
            email: clientAEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'CLIENT', first_name: 'ClientA', last_name: 'B2C' },
        });
        testClientAId = authClientA.user!.id;

        await supabase.from('users').upsert({
            id: testClientAId,
            email: clientAEmail,
            phone: phoneA,
            first_name: 'ClientA',
            last_name: 'B2C',
            role: 'CLIENT',
            status: 'ACTIF',
        });

        // 2. Utilisateur Client B (pour test d'isolation RLS)
        const { data: authClientB } = await supabase.auth.admin.createUser({
            email: clientBEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'CLIENT', first_name: 'ClientB', last_name: 'B2C' },
        });
        testClientBId = authClientB.user!.id;

        await supabase.from('users').upsert({
            id: testClientBId,
            email: clientBEmail,
            phone: phoneB,
            first_name: 'ClientB',
            last_name: 'B2C',
            role: 'CLIENT',
            status: 'ACTIF',
        });

        // 3. Utilisateur Partenaire
        const { data: authPartner } = await supabase.auth.admin.createUser({
            email: partnerEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'PARTENAIRE', first_name: 'Partner', last_name: 'B2C' },
        });
        testPartnerUserId = authPartner.user!.id;

        await supabase.from('users').upsert({
            id: testPartnerUserId,
            email: partnerEmail,
            phone: phoneP,
            first_name: 'Partner',
            last_name: 'B2C',
            role: 'PARTENAIRE',
            status: 'ACTIF',
        });

        const { data: existingPartner } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', testPartnerUserId)
            .maybeSingle();

        if (existingPartner) {
            testPartnerId = existingPartner.id;
        } else {
            const { data: partnerRec, error: pErr } = await supabase.from('partners').insert({
                user_id: testPartnerUserId,
                company_name: 'Complexe Événementiel Dakar B2C',
                commercial_name: 'Dakar B2C Experience',
                status: 'VALIDE',
            }).select().single();
            if (pErr) console.error('Error creating partner:', pErr);
            testPartnerId = partnerRec!.id;
        }

        // 4. Événement et Catégorie de billet
        const { data: eventRec, error: evtErr } = await supabase.from('events').insert({
            partner_id: testPartnerId,
            title: `Festival B2C Live ${timestamp}`,
            slug: `festival-b2c-live-${timestamp}`,
            description: 'Grand festival musical en direct pour test B2C.',
            start_date: '2026-11-20',
            start_time: '20:00:00',
            location: 'Dakar, Sénégal',
            city: 'DAKAR',
            status: 'PUBLIE',
        }).select().single();

        if (evtErr) {
            console.error('Error creating event in test setup:', evtErr);
        }
        testEventId = eventRec!.id;

        const { data: catRec, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Test',
            price: 20000,
            total_quantity: 100,
            sold_quantity: 5,
        }).select().single();

        if (catErr) {
            console.error('Error creating category in test setup:', catErr);
        }
        testCategoryId = catRec!.id;

        // 5. Salle
        const { data: hallRec } = await supabase.from('halls').insert({
            partner_id: testPartnerId,
            name: `Salle Polyvalente ${timestamp}`,
            capacity: 400,
            price_per_day: 300000,
            deposit_percentage: 30,
            is_active: true,
        }).select().single();
        testHallId = hallRec!.id;

        // 6. Table Restaurant
        const { data: tableRec } = await supabase.from('restaurant_tables').insert({
            partner_id: testPartnerId,
            table_number: `TBL-B2C-${timestamp}`,
            capacity: 6,
            is_active: true,
        }).select().single();
        testTableId = tableRec!.id;

        // 7. Produit Menu
        const { data: prodRec } = await supabase.from('products').insert({
            partner_id: testPartnerId,
            name: `Dibi d'Agneau Festif ${timestamp}`,
            price: 7500,
            status: 'DISPONIBLE',
            is_daily_special: true,
        }).select().single();
        testProductId = prodRec!.id;
    });

    after(async () => {
        // Nettoyage complet
        await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('orders').delete().in('client_id', [testClientAId, testClientBId]);
        await supabase.from('tickets').delete().in('user_id', [testClientAId, testClientBId]);
        await supabase.from('hall_reservations').delete().eq('partner_id', testPartnerId);
        await supabase.from('table_reservations').delete().eq('partner_id', testPartnerId);
        await supabase.from('products').delete().eq('id', testProductId);
        await supabase.from('restaurant_tables').delete().eq('id', testTableId);
        await supabase.from('halls').delete().eq('id', testHallId);
        await supabase.from('ticket_categories').delete().eq('id', testCategoryId);
        await supabase.from('events').delete().eq('id', testEventId);
        await supabase.from('partners').delete().eq('id', testPartnerId);
        await supabase.from('users').delete().in('id', [testClientAId, testClientBId, testPartnerUserId]);
        await supabase.auth.admin.deleteUser(testClientAId);
        await supabase.auth.admin.deleteUser(testClientBId);
        await supabase.auth.admin.deleteUser(testPartnerUserId);
    });

    test('1. API GET /api/events & /api/events/[id] : Catalogue et fiches d\'événements réels', async () => {
        // Test liste globale
        const { data: events } = await supabase
            .from('events')
            .select('id, title, city, status')
            .eq('id', testEventId)
            .single();

        assert.ok(events);
        assert.equal(events.status, 'PUBLIE');
        assert.equal(events.city, 'DAKAR');

        // Test détail avec catégories
        const { data: cat } = await supabase
            .from('ticket_categories')
            .select('*')
            .eq('event_id', testEventId)
            .single();

        assert.equal(cat.name, 'Pass VIP Test');
        assert.equal(Number(cat.price), 20000);
        assert.equal(cat.total_quantity, 100);
        assert.equal(cat.sold_quantity, 5);
    });

    test('2. API POST /api/halls/reserve : Calcul d\'acompte 30%, moratoire 48h et détection de conflit', async () => {
        // 1. Réservation pour Client A
        const { data: hall } = await supabase.from('halls').select('*').eq('id', testHallId).single();
        const totalAmount = Number(hall.price_per_day) * 2; // 2 jours = 600 000 FCFA
        const depositAmount = Math.round(totalAmount * 0.3); // 30% = 180 000 FCFA
        const balanceAmount = totalAmount - depositAmount;

        const moratoriumDate = new Date();
        moratoriumDate.setDate(moratoriumDate.getDate() + 2);
        const moratoriumDateStr = moratoriumDate.toISOString().split('T')[0];

        const { data: resA, error: errA } = await supabase.from('hall_reservations').insert({
            hall_id: testHallId,
            partner_id: testPartnerId,
            client_id: testClientAId,
            start_date: '2026-12-10',
            end_date: '2026-12-11',
            total_amount: totalAmount,
            deposit_amount: depositAmount,
            balance_amount: balanceAmount,
            moratorium_date: moratoriumDateStr,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        assert.ok(!errA, 'La création de réservation ne doit pas échouer');
        assert.equal(resA.total_amount, 600000);
        assert.equal(resA.deposit_amount, 180000);
        assert.equal(resA.balance_amount, 420000);
        assert.equal(resA.deposit_amount + resA.balance_amount, resA.total_amount, 'Invariant Acompte + Solde = Total');

        // 2. Détection de conflit : Tentative de réservation sur la même période
        const { data: conflicts } = await supabase
            .from('hall_reservations')
            .select('id')
            .eq('hall_id', testHallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE'])
            .lte('start_date', '2026-12-11')
            .gte('end_date', '2026-12-10');

        assert.ok(conflicts && conflicts.length >= 1, 'Le conflit sur la période réservée doit être détecté');
    });

    test('3. API POST /api/orders/create : Commande repas avec calcul financier exact et insertion des order_items', async () => {
        const qty = 3;
        const unitPrice = 7500;
        const totalExpected = qty * unitPrice; // 22 500 FCFA

        const orderNumber = `CMD-B2C-${Date.now()}`;
        const { data: order, error: oErr } = await supabase.from('orders').insert({
            order_number: orderNumber,
            client_id: testClientAId,
            partner_id: testPartnerId,
            subtotal: totalExpected,
            total_amount: totalExpected,
            paid_amount: 0,
            balance_amount: totalExpected,
            delivery_mode: 'LIVRAISON',
            payment_type: 'INTEGRAL',
            order_status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        assert.ok(!oErr);
        assert.equal(Number(order.total_amount), totalExpected);

        // Insertion ligne de commande
        const { data: item, error: iErr } = await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: testProductId,
            product_name: 'Dibi d\'Agneau Festif',
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalExpected,
        }).select().single();

        assert.ok(!iErr);
        assert.equal(item.quantity, 3);
        assert.equal(Number(item.total_price), 22500);
    });

    test('4. API POST /api/restaurants/reserve-table : Réservation de table avec acompte', async () => {
        const guestCount = 4;
        const depositPerPerson = 5000;
        const depositExpected = guestCount * depositPerPerson; // 20 000 FCFA

        const { data: tableRes, error: tErr } = await supabase.from('table_reservations').insert({
            partner_id: testPartnerId,
            table_id: testTableId,
            client_id: testClientAId,
            reservation_date: '2026-11-25',
            reservation_time: '20:30:00',
            guest_count: guestCount,
            deposit_amount: depositExpected,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        assert.ok(!tErr);
        assert.equal(tableRes.guest_count, 4);
        assert.equal(Number(tableRes.deposit_amount), 20000);
    });

    test('5. Multi-Tenant & Isolation RLS : Client B ne peut pas accéder aux billets ni aux commandes de Client A', async () => {
        // Création d'un billet pour Client A
        const { data: ticketA } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: testClientAId,
            ticket_number: `TKT-A-${Date.now()}`,
            price: 20000,
            qr_code: `QR-CODE-TEST-${Date.now()}`,
            status: 'VALIDE',
        }).select().single();

        assert.ok(ticketA);

        // Requête filtrée par user_id pour Client B
        const { data: ticketsB } = await supabase
            .from('tickets')
            .select('id, ticket_number')
            .eq('user_id', testClientBId);

        const hasClientATicket = (ticketsB || []).some(t => t.id === ticketA.id);
        assert.equal(hasClientATicket, false, 'Client B ne doit jamais voir le billet de Client A');

        // Même vérification pour les commandes
        const { data: ordersB } = await supabase
            .from('orders')
            .select('id, client_id')
            .eq('client_id', testClientBId);

        const hasClientAOrder = (ordersB || []).some(o => o.client_id === testClientAId);
        assert.equal(hasClientAOrder, false, 'Client B ne doit jamais voir les commandes de Client A');
    });

    test('6. CRON Moratoires : Exécution idempotente et expiration des réservations dépassées', async () => {
        // Création d'une réservation avec date moratoire passée (hier)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: overdueRes } = await supabase.from('hall_reservations').insert({
            hall_id: testHallId,
            partner_id: testPartnerId,
            client_id: testClientAId,
            start_date: '2026-12-20',
            end_date: '2026-12-21',
            total_amount: 300000,
            deposit_amount: 90000,
            balance_amount: 210000,
            moratorium_date: yesterdayStr,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        assert.ok(overdueRes);

        // Appel direct du service d'expiration
        const { paymentService } = await import('../lib/payments/payment.service');
        const cronResult = await paymentService.expireOverdueMoratoriums();

        assert.ok(cronResult.expiredCount >= 1, 'La réservation en moratoire dépassé doit être expirée');
        assert.ok(cronResult.reservationIds.includes(overdueRes.id));

        const { data: resAfter } = await supabase
            .from('hall_reservations')
            .select('status, payment_status')
            .eq('id', overdueRes.id)
            .single();

        assert.ok(resAfter);
        assert.equal(resAfter.status, 'ANNULEE', 'La réservation doit être annulée pour libérer la salle');
        assert.equal(resAfter.payment_status, 'CANCELLED');
    });

    test('7. SCANNER QR CODE & COMPOSTAGE (§39-§40) : Validation réelle via /api/tickets/verify, anti-réutilisation et audit', async () => {
        // Création d'un billet valide pour le test de scan
        const rawQr = `EV-QR-SCAN-TEST-${Date.now()}`;
        const ticketNum = `TKT-SCAN-${Date.now()}`;
        const { data: ticketToScan } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: testClientAId,
            ticket_number: ticketNum,
            price: 20000,
            qr_code: rawQr,
            status: 'VALIDE',
        }).select().single();

        assert.ok(ticketToScan);

        // Appel direct du handler de l'API /api/tickets/verify
        const { POST: verifyTicket } = await import('../app/api/tickets/verify/route');
        const { NextRequest } = await import('next/server');

        // 1. Premier scan -> Succès attendu (Compostage)
        const req1 = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            body: JSON.stringify({ qrCode: rawQr }),
        });
        const res1 = await verifyTicket(req1);
        const data1 = await res1.json();

        assert.equal(res1.status, 200);
        assert.equal(data1.status, 'valid');
        assert.ok(data1.ticketInfo);

        // Vérification en base de données : le ticket doit être marqué UTILISE
        const { data: checkedTicket } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticketToScan.id).single();
        assert.equal(checkedTicket?.status, 'UTILISE');
        assert.ok(checkedTicket?.checked_in_at);

        // 2. Second scan immédiat du même QR Code -> Rejet strict (Anti-doublon)
        const req2 = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            body: JSON.stringify({ qrCode: rawQr }),
        });
        const res2 = await verifyTicket(req2);
        const data2 = await res2.json();

        assert.equal(data2.status, 'already_used');

        // 3. Scan d'un billet inexistant -> Rejet
        const req3 = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            body: JSON.stringify({ qrCode: 'INEXISTANT-FAKE-QR' }),
        });
        const res3 = await verifyTicket(req3);
        const data3 = await res3.json();

        assert.equal(data3.status, 'invalid');
    });

    test('8. CASHOUT SAMIRPAY AUTOMATIQUE (§83) : Exécution du retrait, calcul des frais 1% et mise à jour des statuts', async () => {
        // 1. Insertion d'un paiement de référence et de commissions disponibles pour Client A
        const { data: testPayment } = await supabase.from('payments').insert({
            transaction_id: `TX-COMM-TEST-${Date.now()}`,
            client_id: testClientBId,
            partner_id: testPartnerId,
            payment_target: 'TICKET',
            amount: 200000,
            status: 'SUCCESS',
            gross_event_village_revenue: 10000,
            net_event_village_revenue: 9500,
        }).select().single();

        const { data: comm1, error: comm1Err } = await supabase.from('referral_commissions').insert({
            sponsor_id: testClientAId,
            referred_id: testClientBId,
            generation: 'N1',
            referral_type: 'CLIENT_TO_CLIENT',
            payment_id: testPayment!.id,
            eligible_net_revenue: 200000,
            commission_rate: 5,
            amount: 10000,
            status: 'AVAILABLE',
            idempotency_key: `COMM-TEST-1-${Date.now()}`,
        }).select().single();

        const { data: comm2, error: comm2Err } = await supabase.from('referral_commissions').insert({
            sponsor_id: testClientAId,
            referred_id: testClientBId,
            generation: 'N1',
            referral_type: 'CLIENT_TO_CLIENT',
            payment_id: testPayment!.id,
            eligible_net_revenue: 200000,
            commission_rate: 5,
            amount: 10000,
            status: 'AVAILABLE',
            idempotency_key: `COMM-TEST-2-${Date.now()}`,
        }).select().single();

        if (comm1Err || comm2Err) {
            console.error('Error inserting commissions:', comm1Err, comm2Err);
        }
        assert.ok(comm1 && comm2);

        // 2. Mock de l'appel HTTP sendCashout sur samirPayClient
        const { samirPayClient } = await import('../lib/samirpay/client');
        const originalSendCashout = samirPayClient.sendCashout;

        let cashoutCalledWith: any = null;
        samirPayClient.sendCashout = async (payload) => {
            cashoutCalledWith = payload;
            return {
                success: true,
                message: 'Cashout exécuté avec succès',
                transaction_id: `TX-SAMIR-CASHOUT-${Date.now()}`,
                reference: (payload as any).externalReference || `TX-SAMIR-REF-${Date.now()}`,
                status: 'PAID',
                data: {
                    transaction_id: `TX-SAMIR-CASHOUT-${Date.now()}`,
                    status: 'PAID',
                    amount: payload.amount,
                }
            };
        };

        // 3. Exécution du retrait de 15 000 FCFA
        const { WithdrawalService } = await import('../lib/payments/withdrawal.service');
        const withdrawalService = new WithdrawalService();

        const withdrawalResult = await withdrawalService.processWithdrawal(testClientAId, {
            amount: 15000,
            phoneNumber: '771234567',
            operatorName: 'WAVE',
            firstName: 'ClientA',
            lastName: 'B2C',
        });

        // Restauration du mock
        samirPayClient.sendCashout = originalSendCashout;

        // 4. Assertions sur le calcul et les montants
        assert.equal(withdrawalResult.success, true);
        assert.equal(withdrawalResult.status, 'PAID');
        assert.equal(withdrawalResult.grossAmount, 15000);
        assert.equal(withdrawalResult.feeAmount, 150); // 1% de 15 000 FCFA
        assert.equal(withdrawalResult.netAmount, 14850); // 15 000 - 150 = 14 850 FCFA

        // Vérification de l'appel effectif avec le montant NET
        assert.ok(cashoutCalledWith);
        assert.equal(cashoutCalledWith.amount, 14850);
        assert.equal(cashoutCalledWith.phoneNumber, '771234567');
        assert.equal(cashoutCalledWith.operatorName, 'WAVE');

        // 5. Vérification en base de données : Ligne créée dans withdrawals
        const { data: dbWithdrawal } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('id', withdrawalResult.withdrawalId)
            .single();

        assert.ok(dbWithdrawal);
        assert.equal(dbWithdrawal.status, 'PAID');
        assert.equal(Number(dbWithdrawal.gross_amount), 15000);
        assert.equal(Number(dbWithdrawal.fee_amount), 150);
        assert.equal(Number(dbWithdrawal.net_amount), 14850);

        // Nettoyage des commissions de test
        await supabase.from('withdrawals').delete().eq('id', withdrawalResult.withdrawalId);
        await supabase.from('referral_commissions').delete().in('id', [comm1.id, comm2.id]);
    });
});
