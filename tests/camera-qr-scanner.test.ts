import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement
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

import { detectScannerSupport } from '../lib/scanner/support';
import { getServiceRoleClient } from '../lib/supabase/server';

describe('SCANNER QR CAMÉRA — DÉTECTION CASCADE & INTÉGRATION PIPELINE (§39-§40)', () => {
    const supabase = getServiceRoleClient();
    let testEventId: string;
    let testCategoryId: string;
    let testPartnerId: string;
    let testPartnerUserId: string;
    let testClientId: string;

    before(async () => {
        const timestamp = Date.now();
        testPartnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        testPartnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
        testClientId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

        // 1. Événement
        const { data: event, error: evErr } = await supabase.from('events').insert({
            partner_id: testPartnerId,
            title: 'Soirée Contrôle Caméra',
            slug: `soiree-camera-${timestamp}`,
            start_date: '2026-12-31',
            start_time: '21:00:00',
            location: 'Dakar Arena',
            status: 'PUBLIE',
        }).select().single();
        if (evErr || !event) throw new Error(`Échec création event: ${evErr?.message}`);
        testEventId = event.id;

        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass Caméra VIP',
            price: 25000,
            total_quantity: 50,
            sold_quantity: 0,
        }).select().single();
        if (catErr || !cat) throw new Error(`Échec création category: ${catErr?.message}`);
        testCategoryId = cat.id;
    });

    after(async () => {
        if (testEventId) {
            await supabase.from('tickets').delete().eq('event_id', testEventId);
            await supabase.from('ticket_categories').delete().eq('id', testCategoryId);
            await supabase.from('events').delete().eq('id', testEventId);
        }
    });

    // 1. Tests de la logique de cascade
    test('1.1 Cascade CAS 1 : Contexte sécurisé + getUserMedia + BarcodeDetector -> Mode "native"', () => {
        const mockWindow = {
            isSecureContext: true,
            location: { protocol: 'https:', hostname: 'eventvillage.sn' },
            navigator: {
                mediaDevices: {
                    getUserMedia: () => Promise.resolve({}),
                },
            },
            BarcodeDetector: class MockBarcodeDetector {},
        };

        const result = detectScannerSupport(mockWindow);
        assert.equal(result.mode, 'native');
        assert.equal(result.hasGetUserMedia, true);
        assert.equal(result.hasBarcodeDetector, true);
        assert.equal(result.isSecureContext, true);
    });

    test('1.2 Cascade CAS 2 : Contexte sécurisé + getUserMedia SANS BarcodeDetector (Safari/Firefox) -> Mode "zxing"', () => {
        const mockWindow = {
            isSecureContext: true,
            location: { protocol: 'https:', hostname: 'eventvillage.sn' },
            navigator: {
                mediaDevices: {
                    getUserMedia: () => Promise.resolve({}),
                },
            },
            BarcodeDetector: undefined,
        };

        const result = detectScannerSupport(mockWindow);
        assert.equal(result.mode, 'zxing');
        assert.equal(result.hasGetUserMedia, true);
        assert.equal(result.hasBarcodeDetector, false);
        assert.equal(result.isSecureContext, true);
    });

    test('1.3 Cascade CAS 3 : Contexte NON sécurisé (HTTP) ou SANS getUserMedia -> Mode "manual_only"', () => {
        // Sous-cas A : Insecure context
        const mockInsecureWindow = {
            isSecureContext: false,
            location: { protocol: 'http:', hostname: '192.168.1.50' },
            navigator: {
                mediaDevices: {
                    getUserMedia: () => Promise.resolve({}),
                },
            },
        };
        const resA = detectScannerSupport(mockInsecureWindow);
        assert.equal(resA.mode, 'manual_only');
        assert.equal(resA.isSecureContext, false);

        // Sous-cas B : Pas de mediaDevices
        const mockNoMediaWindow = {
            isSecureContext: true,
            location: { protocol: 'https:', hostname: 'eventvillage.sn' },
            navigator: {},
        };
        const resB = detectScannerSupport(mockNoMediaWindow);
        assert.equal(resB.mode, 'manual_only');
        assert.equal(resB.hasGetUserMedia, false);
    });

    // 2. Test d'intégration du pipeline unifié post-détection
    test('2. Pipeline Unifié : Code QR scanné transmis à /api/tickets/verify -> Compostage et audit', async () => {
        const testQr = `EV-QR-CAMERA-${Date.now()}`;
        const ticketNum = `TKT-CAM-${Date.now()}`;

        // Insertion d'un billet valide
        const { data: ticket } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: testClientId,
            ticket_number: ticketNum,
            price: 25000,
            qr_code: testQr,
            status: 'VALIDE',
        }).select().single();

        assert.ok(ticket);

        // Simulation de la détection de la caméra alimentant /api/tickets/verify
        const { POST: verifyTicket } = await import('../app/api/tickets/verify/route');
        const { NextRequest } = await import('next/server');

        const req = new NextRequest('http://localhost:3000/api/tickets/verify', {
            method: 'POST',
            body: JSON.stringify({ qrCode: testQr }),
        });

        const res = await verifyTicket(req);
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.status, 'valid');
        assert.equal(data.ticketInfo?.ticketNumber, ticketNum);
        assert.equal(data.ticketInfo?.category, 'Pass Caméra VIP');

        // Vérification de la mutation réelle en base
        const { data: updatedTicket } = await supabase
            .from('tickets')
            .select('status, checked_in_at')
            .eq('id', ticket.id)
            .single();

        assert.equal(updatedTicket?.status, 'UTILISE');
        assert.ok(updatedTicket?.checked_in_at);
    });
});
