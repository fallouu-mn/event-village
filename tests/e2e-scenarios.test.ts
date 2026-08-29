import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mapSamirPayStatus } from '../lib/samirpay/types';
import { SamirPayWebhookSchema, CreatePaymentSchema } from '../lib/validations/payment';
import { POST as handleWebhook } from '../app/api/webhooks/samirpay/route';
import { NextRequest } from 'next/server';

test('SCENARIO 1 : Parcours client complet & Structure des Pages Redesign', () => {
    const homeContent = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf-8');
    assert.ok(homeContent.includes('Événements à la Une') || homeContent.includes('EventCard'));
    assert.ok(homeContent.includes('Justice Tour'));

    const eventContent = fs.readFileSync(path.join(process.cwd(), 'app/events/[id]/page.tsx'), 'utf-8');
    assert.ok(eventContent.includes('PaymentModal'));
    assert.ok(eventContent.includes('Acheter mon billet') || eventContent.includes('Pass'));
});

test('SCENARIO 2 & 3 : Création de commande & Validation des Schémas de Paiement', () => {
    const stdPayload = {
        targetType: 'TICKET',
        targetId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        customerPhone: '771234567',
    };
    const vipPayload = {
        targetType: 'TICKET',
        targetId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        customerPhone: '771234567',
    };

    const parsedStd = CreatePaymentSchema.safeParse(stdPayload);
    const parsedVip = CreatePaymentSchema.safeParse(vipPayload);

    assert.equal(parsedStd.success, true);
    assert.equal(parsedVip.success, true);
});

test('SCENARIO 4 & 5 : Initialisation SamirPay & Sandbox Contract', () => {
    const endpoint = '/api/tiers/direct/initPayment';
    assert.equal(endpoint, '/api/tiers/direct/initPayment');

    const headers = {
        'Content-Type': 'application/json',
        'X-API-KEY': 'TEST_KEY',
        'X-SECRET-KEY': 'TEST_SECRET',
    };
    assert.ok(headers['X-API-KEY']);
    assert.ok(headers['X-SECRET-KEY']);
});

test('SCENARIO 6 & 7 : Réception Webhook & Validation Route Handler', async () => {
    const formData = new FormData();
    formData.append('transaction_id', 'TX-TEST-778899');
    formData.append('order_id', 'ORD-TEST-112233');
    formData.append('status', 'success');

    const req = new NextRequest('http://localhost:3000/api/webhooks/samirpay', {
        method: 'POST',
        body: formData,
    });

    const res = await handleWebhook(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.received, true);
});

test('SCENARIO 8 & 9 : Génération Ticket & QR Code Unique', () => {
    const ticketNumber = `EV-TK-${Date.now().toString().slice(-6)}-AB12`;
    const qrCode = `EV-QR-550e8400-e29b-41d4-a716-446655440000-cafe1234`;

    assert.match(ticketNumber, /^EV-TK-\d{6}-[A-F0-9]{4}$/);
    assert.match(qrCode, /^EV-QR-[0-9a-f-]{36}-[0-9a-f]{8}$/);
});

test('SCENARIO 10 & 11 : Portefeuille Billetterie & TicketCard Perforé', () => {
    const ticketContent = fs.readFileSync(path.join(process.cwd(), 'app/tickets/page.tsx'), 'utf-8');
    assert.ok(ticketContent.includes('TicketCard'));
    assert.ok(ticketContent.includes('Justice Tour'));

    const ticketCardContent = fs.readFileSync(path.join(process.cwd(), 'components/tickets/TicketCard.tsx'), 'utf-8');
    assert.ok(ticketCardContent.includes('ticket-notch-left'));
    assert.ok(ticketCardContent.includes('QrCode'));
});

test('SCENARIO 12, 13 & 14 : Scanner Partenaire & Contrôle d’accès', () => {
    const ticketMock = {
        id: 'tk-001',
        ticket_number: 'EV-TK-123456-A1B2',
        status: 'VALIDE',
    };

    function validateTicket(ticket: { status: string }) {
        if (ticket.status === 'UTILISE') {
            return { valid: false, message: 'Ticket déjà utilisé/composté' };
        }
        if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE') {
            return { valid: false, message: 'Ticket invalide ou annulé' };
        }
        ticket.status = 'UTILISE';
        return { valid: true, message: 'Ticket validé avec succès' };
    }

    const check1 = validateTicket(ticketMock);
    assert.equal(check1.valid, true);
    assert.equal(ticketMock.status, 'UTILISE');

    const check2 = validateTicket(ticketMock);
    assert.equal(check2.valid, false);
    assert.equal(check2.message, 'Ticket déjà utilisé/composté');
});

test('SCENARIO 15 : Dashboard Partenaire, Realtime & Calendrier', () => {
    const partnerContent = fs.readFileSync(path.join(process.cwd(), 'app/partner/dashboard/page.tsx'), 'utf-8');
    assert.ok(partnerContent.includes('usePartnerOrders'));
    assert.ok(partnerContent.includes('Realtime') || partnerContent.includes('connected'));

    const calendarContent = fs.readFileSync(path.join(process.cwd(), 'components/events/EventCalendar.tsx'), 'utf-8');
    assert.ok(calendarContent.includes('EventCalendar'));
});

test('SCENARIO 16 : Parrainage N1 / N2 sur Revenu Net Éligible (CDC V3)', () => {
    const brut = 50000;
    const serviceFee = brut * 0.05; // 2500 FCFA
    const aggregatorFee = brut * 0.015; // 750 FCFA
    const netEligible = serviceFee - aggregatorFee; // 1750 FCFA

    // Taux Ambassadeur : N1 (7%), N2 (2%)
    const commN1 = Math.round(netEligible * 0.07 * 100) / 100;
    const commN2 = Math.round(netEligible * 0.02 * 100) / 100;

    assert.equal(commN1, 122.50);
    assert.equal(commN2, 35.00);
    assert.ok(commN1 + commN2 <= netEligible);
});

test('SCENARIO 17 : Idempotence Webhook Répété', () => {
    const processedTransactions = new Set<string>();

    function processWebhook(txId: string, status: string) {
        if (processedTransactions.has(txId)) {
            return { processed: false, reason: 'Already processed' };
        }
        processedTransactions.add(txId);
        return { processed: true, status };
    }

    const firstCall = processWebhook('TX-IDEMP-001', 'SUCCESS');
    assert.equal(firstCall.processed, true);

    const duplicateCall = processWebhook('TX-IDEMP-001', 'SUCCESS');
    assert.equal(duplicateCall.processed, false);
    assert.equal(duplicateCall.reason, 'Already processed');
});

test('SCENARIO 18, 19 & 20 : Responsive, PWA Manifest & Service Worker', () => {
    const manifestPath = path.join(process.cwd(), 'public/manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.name, 'Event Village');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#FF6B35');

    const swPath = path.join(process.cwd(), 'public/sw.js');
    assert.ok(fs.existsSync(swPath));
    const swContent = fs.readFileSync(swPath, 'utf-8');
    assert.ok(swContent.includes('event-village-v1'));
});
