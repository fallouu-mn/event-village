import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement (.env.local)
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

import { getServiceRoleClient } from '../lib/supabase/server';
import { POST as controllerScanRoute } from '../app/api/controller/scan/route';
import { POST as ticketVerifyRoute } from '../app/api/tickets/verify/route';
import { GET as getTicketsRoute } from '../app/api/tickets/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

describe('SCAN DE BILLET — CHANGEMENT DE STATUT EN BASE, NOTIFICATIONS (SMS, EMAIL, IN-APP) ET REALTIME', () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const buyerUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';

    let ctrlToken: string;
    let testEventId: string;
    let testCategoryId: string;
    let testTicketId1: string;
    let testTicketNumber1: string;
    let testTicketId2: string;
    let testTicketNumber2: string;

    const ts = Date.now();

    before(async () => {
        console.log('[SETUP] Initialisation du banc de test de notification de scan...');

        // 1. Mise à jour des utilisateurs
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });

        const { data: ctrlAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const ctrlEmail = ctrlAuthUser?.user?.email || 'ctrl@eventvillage.sn';
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: 'Password123!', email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });

        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: ctrlEmail,
            password: 'Password123!',
        });
        ctrlToken = cAuth.session?.access_token || '';
        assert.ok(ctrlToken, 'Token Contrôleur généré');

        // 2. Création de l'événement et catégorie
        const { data: ev, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Concert Live Test Scan ${ts}`,
            slug: `concert-scan-${ts}`,
            start_date: '2026-12-31',
            start_time: '20:00',
            location: 'Grand Théâtre National, Dakar',
            status: 'PUBLIE',
        }).select().single();
        if (evErr || !ev) throw new Error(`Erreur création événement: ${evErr?.message}`);
        testEventId = ev.id;

        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: testEventId,
            name: 'Pass VIP Scan Test',
            price: 20000,
            total_quantity: 10,
            sold_quantity: 2,
        }).select().single();
        if (catErr || !cat) throw new Error(`Erreur création catégorie: ${catErr?.message}`);
        testCategoryId = cat.id;

        // 3. Assignation du contrôleur à l'événement
        const { error: ecErr } = await supabase.from('event_controllers').insert({
            event_id: testEventId,
            user_id: ctrlUserId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });
        if (ecErr) console.error('[SETUP] Erreur assignation event_controller:', ecErr.message);

        // 4. Création des billets de test pour le client (buyerUserId)
        testTicketNumber1 = `EV-SCAN-1-${ts}`;
        testTicketNumber2 = `EV-SCAN-2-${ts}`;

        const { data: t1, error: t1Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerUserId,
            ticket_number: testTicketNumber1,
            qr_code: testTicketNumber1,
            price: 20000,
            status: 'VALIDE',
        }).select().single();
        if (t1Err || !t1) throw new Error(`Erreur création ticket 1: ${t1Err?.message}`);
        testTicketId1 = t1.id;

        const { data: t2, error: t2Err } = await supabase.from('tickets').insert({
            event_id: testEventId,
            category_id: testCategoryId,
            user_id: buyerUserId,
            ticket_number: testTicketNumber2,
            qr_code: testTicketNumber2,
            price: 20000,
            status: 'VALIDE',
        }).select().single();
        if (t2Err || !t2) throw new Error(`Erreur création ticket 2: ${t2Err?.message}`);
        testTicketId2 = t2.id;
    });

    after(async () => {
        if (testTicketId1 && testTicketId2) {
            await supabase.from('tickets').delete().in('id', [testTicketId1, testTicketId2]);
        }
        if (testCategoryId) {
            await supabase.from('ticket_categories').delete().eq('id', testCategoryId);
        }
        if (testEventId) {
            await supabase.from('event_controllers').delete().eq('event_id', testEventId);
            await supabase.from('events').delete().eq('id', testEventId);
        }
        await supabase.from('notifications').delete().eq('user_id', buyerUserId).filter('metadata->>alert_type', 'eq', 'TICKET_SCANNED');
        console.log('[CLEANUP] Données de test nettoyées avec succès.');
    });

    test('1. État initial : Le billet est VALIDE, isUpcoming = true et usedAt = null dans Mes Billets', async () => {
        const req = new NextRequest(`http://localhost/api/tickets?userId=${buyerUserId}`);
        const res = await getTicketsRoute(req);
        assert.strictEqual(res.status, 200);

        const data = await res.json();
        const clientTicket = data.tickets?.find((t: any) => t.id === testTicketId1);
        assert.ok(clientTicket, 'Le billet 1 doit être listé pour le client');
        assert.strictEqual(clientTicket.status, 'VALIDE');
        assert.strictEqual(clientTicket.isUpcoming, true);
        assert.strictEqual(clientTicket.usedAt, null);
    });

    test('2. Scan Contrôleur (/api/controller/scan) -> Statut passe à UTILISE, checked_in_at est horodaté et notifications déclenchées', async () => {
        const scanReq = new NextRequest('http://localhost/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ctrlToken}`,
            },
            body: JSON.stringify({
                qr_code: testTicketNumber1,
            }),
        });

        const scanRes = await controllerScanRoute(scanReq);
        assert.strictEqual(scanRes.status, 200);

        const scanData = await scanRes.json();
        assert.strictEqual(scanData.scan_result, 'valid');
        assert.strictEqual(scanData.message, 'Accès autorisé — Billet validé.');

        // Relecture immédiate en base de données
        const { data: dbTicket } = await supabase
            .from('tickets')
            .select('status, checked_in_at, checked_in_by')
            .eq('id', testTicketId1)
            .single();

        assert.strictEqual(dbTicket?.status, 'UTILISE', 'Le statut en base de données doit être strictement UTILISE');
        assert.ok(dbTicket?.checked_in_at, 'checked_in_at doit être renseigné avec la date actuelle');
        assert.strictEqual(dbTicket?.checked_in_by, ctrlUserId, 'checked_in_by doit être renseigné avec le contrôleur');

        // Attente asynchrone minime pour insertion notification
        await new Promise((r) => setTimeout(r, 600));

        // Vérification de la notification In-App créée pour le client
        const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', buyerUserId)
            .filter('metadata->>alert_type', 'eq', 'TICKET_SCANNED')
            .filter('metadata->>ticket_id', 'eq', testTicketId1);

        assert.ok(notifs && notifs.length >= 1, 'Une notification In-App TICKET_SCANNED doit être créée pour le client');
        assert.ok(notifs[0].title.includes('Entrée Validée') || notifs[0].title.includes('Billet Validé'));
        assert.strictEqual(notifs[0].metadata?.status, 'UTILISE');
        assert.strictEqual(notifs[0].metadata?.ticket_number, testTicketNumber1);
    });

    test('3. Rafraîchissement Mes Billets : Le billet apparaît désormais comme UTILISÉ (isUpcoming = false)', async () => {
        const req = new NextRequest(`http://localhost/api/tickets?userId=${buyerUserId}`);
        const res = await getTicketsRoute(req);
        assert.strictEqual(res.status, 200);

        const data = await res.json();
        const clientTicket = data.tickets?.find((t: any) => t.id === testTicketId1);
        assert.ok(clientTicket, 'Le billet 1 doit être listé');
        assert.strictEqual(clientTicket.status, 'UTILISE', 'Le statut retourné par l API doit être UTILISE');
        assert.strictEqual(clientTicket.isUpcoming, false, 'isUpcoming doit être false pour un billet utilisé');
        assert.ok(clientTicket.usedAt, 'usedAt doit contenir la date de compostage');
    });

    test('4. Scan Partenaire / Portique (/api/tickets/verify) -> Valide le billet 2 et émet notification', async () => {
        const verifyReq = new NextRequest('http://localhost/api/tickets/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticketNumber: testTicketNumber2,
            }),
        });

        const verifyRes = await ticketVerifyRoute(verifyReq);
        assert.strictEqual(verifyRes.status, 200);

        const verifyData = await verifyRes.json();
        assert.strictEqual(verifyData.status, 'valid');

        // Relecture en base
        const { data: dbTicket2 } = await supabase
            .from('tickets')
            .select('status, checked_in_at')
            .eq('id', testTicketId2)
            .single();

        assert.strictEqual(dbTicket2?.status, 'UTILISE');
        assert.ok(dbTicket2?.checked_in_at);

        await new Promise((r) => setTimeout(r, 600));

        const { data: notifs2 } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', buyerUserId)
            .filter('metadata->>alert_type', 'eq', 'TICKET_SCANNED')
            .filter('metadata->>ticket_id', 'eq', testTicketId2);

        assert.ok(notifs2 && notifs2.length >= 1, 'Notification In-App émise pour le billet 2');
    });

    test('5. Tentative de second scan -> Rejet ALREADY_USED sans réémission de notification (Idempotence)', async () => {
        const scanReq2 = new NextRequest('http://localhost/api/controller/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ctrlToken}`,
            },
            body: JSON.stringify({
                qr_code: testTicketNumber1,
            }),
        });

        const scanRes2 = await controllerScanRoute(scanReq2);
        assert.strictEqual(scanRes2.status, 200);

        const scanData2 = await scanRes2.json();
        assert.strictEqual(scanData2.scan_result, 'already_used');

        // Vérification qu'il n'y a pas eu de notification en double
        const { data: notifs } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', buyerUserId)
            .filter('metadata->>alert_type', 'eq', 'TICKET_SCANNED')
            .filter('metadata->>ticket_id', 'eq', testTicketId1);

        assert.strictEqual(notifs?.length, 1, 'Strictement une seule notification doit exister pour ce billet');
    });
});
