import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as controllerScan } from '../../app/api/controller/scan/route';

describe('ANTI-FRAUDE QR CODE DYNAMIQUE (TOTP RFC 6238 — PRE-MORTEM §1.2)', async () => {
    const supabase = getServiceRoleClient();
    const publicAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const ts = Date.now().toString().slice(-6);

    const partnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const ctrlUserId = 'fe9318ac-1f65-4e80-980f-f00626f1a003';
    const clientUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

    let partnerToken: string;
    let ctrlToken: string;
    let clientToken: string;
    let eventId: string;
    let catId: string;

    const createdTicketIds: string[] = [];

    before(async () => {
        // 1. Obtenir les jetons d'accès
        const { data: pAuthUser } = await supabase.auth.admin.getUserById(partnerUserId);
        const pEmail = pAuthUser?.user?.email || 'fallouu.dev@gmail.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'PARTENAIRE', phone: '221770006743' }).eq('id', partnerUserId);
        await supabase.from('user_roles').delete().eq('user_id', partnerUserId);
        await supabase.from('user_roles').insert({ user_id: partnerUserId, role: 'PARTENAIRE' });
        await supabase.auth.admin.updateUserById(partnerUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'PARTENAIRE' } });
        const { data: pAuth } = await publicAuth.auth.signInWithPassword({
            email: pEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        partnerToken = pAuth?.session?.access_token!;
        assert.ok(partnerToken, 'Token Partenaire obtenu');

        const { data: cAuthUser } = await supabase.auth.admin.getUserById(ctrlUserId);
        const cEmail = cAuthUser?.user?.email || 'clientB@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CONTROLEUR', phone: '221772223344' }).eq('id', ctrlUserId);
        await supabase.from('user_roles').delete().eq('user_id', ctrlUserId);
        await supabase.from('user_roles').insert({ user_id: ctrlUserId, role: 'CONTROLEUR' });
        await supabase.auth.admin.updateUserById(ctrlUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CONTROLEUR' } });
        const { data: cAuth } = await publicAuth.auth.signInWithPassword({
            email: cEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        ctrlToken = cAuth?.session?.access_token!;
        assert.ok(ctrlToken, 'Token Contrôleur obtenu');

        const { data: clAuthUser } = await supabase.auth.admin.getUserById(clientUserId);
        const clEmail = clAuthUser?.user?.email || 'clientA@test.com';
        await supabase.from('users').update({ status: 'ACTIF', role: 'CLIENT', phone: '221771234567' }).eq('id', clientUserId);
        await supabase.from('user_roles').delete().eq('user_id', clientUserId);
        await supabase.from('user_roles').insert({ user_id: clientUserId, role: 'CLIENT' });
        await supabase.auth.admin.updateUserById(clientUserId, { password: process.env.LEGACY_TEST_PASSWORD!, email_confirm: true, user_metadata: { role: 'CLIENT' } });
        const { data: clAuth } = await publicAuth.auth.signInWithPassword({
            email: clEmail,
            password: process.env.LEGACY_TEST_PASSWORD!,
        });
        clientToken = clAuth?.session?.access_token!;
        assert.ok(clientToken, 'Token Client obtenu');

        // Configurer l'utilisateur client avec nom et prénom pour test d'identité
        await supabase.from('users').update({
            first_name: 'Moussa',
            last_name: 'Diop',
            role: 'CLIENT',
            status: 'ACTIF',
        }).eq('id', clientUserId);

        // 2. Créer un événement publié de test
        const { data: event, error: evErr } = await supabase.from('events').insert({
            partner_id: partnerId,
            title: `Festival Anti-Fraude TOTP ${ts}`,
            slug: `festival-anti-fraude-${ts}`,
            start_date: '2026-12-31',
            start_time: '21:00:00',
            location: 'Esplanade Monument de la Renaissance',
            status: 'PUBLIE',
        }).select().single();
        if (evErr) throw evErr;
        eventId = event.id;

        // 3. Créer une catégorie de billets
        const { data: cat, error: catErr } = await supabase.from('ticket_categories').insert({
            event_id: eventId,
            name: `Pass Festival VIP ${ts}`,
            price: 15000,
            total_quantity: 50,
        }).select().single();
        if (catErr) throw catErr;
        catId = cat.id;

        // 4. Affecter le contrôleur à l'événement
        await supabase.from('event_controllers').insert({
            user_id: ctrlUserId,
            event_id: eventId,
            can_accept_cash: true,
            created_by: partnerUserId,
        });
    });

    after(async () => {
        // Nettoyage DB complet
        if (createdTicketIds.length > 0) {
            await supabase.from('tickets').delete().in('id', createdTicketIds);
        }
        await supabase.from('tickets').delete().eq('event_id', eventId);
        await supabase.from('event_controllers').delete().eq('event_id', eventId);
        await supabase.from('ticket_categories').delete().eq('id', catId);
        await supabase.from('events').delete().eq('id', eventId);
    });

    // Helper pour créer un billet
    async function createTestTicket(suffix: string) {
        const ticketNumber = `TCK-${ts}-${suffix}`;
        const qrCode = `EV-QR-${ts}-${suffix}`;
        const { data: ticket, error } = await supabase.from('tickets').insert({
            event_id: eventId,
            category_id: catId,
            user_id: clientUserId,
            ticket_number: ticketNumber,
            qr_code: qrCode,
            price: 15000,
            status: 'VALIDE',
        }).select().single();

        if (error || !ticket) throw new Error(`Erreur création ticket: ${error?.message}`);
        createdTicketIds.push(ticket.id);
        return ticket;
    }

    // [lot 4 — cas supprimé] 1. Scan d'un Billet avec QR Code Dynamique Valide : réponse de live-code { success, qr_payload, totp_code } et corps de scan { qr_code } → scan_result retirés (contrats { payload, step_seconds, expires_in } et { eventId, payload } → { result }) ; couvert par tests/parcours/acces-totp.test.ts (live-code accepté au scan) et tests/parcours/acces-scan.test.ts (double scan → already_used)
    // [lot 4 — cas supprimé] 2. Rejet Immédiat d'un QR Code Expiré : deriveTicketTotpSecret, generateTotp et buildDynamicQrPayload supprimés (generateTicketCode, buildTicketPayload, clé dérivée de TICKET_TOTP_MASTER_KEY et du secret du billet) ; couvert par tests/parcours/acces-totp.test.ts (code de plus de 40 s → qr_expired, non composté)
    // [lot 4 — cas supprimé] 3. Anti-Fraude Pre-Mortem §1.2 (capture WhatsApp à T+70 s) : deriveTicketTotpSecret, generateTotp, verifyTotp et buildDynamicQrPayload supprimés ; couvert par tests/parcours/acces-totp.test.ts (code de plus de 40 s → qr_expired ; code de −15 s → valid)
    // [lot 4 — cas supprimé] 4. Concurrence Réelle (R4), double scan simultané : deriveTicketTotpSecret, generateTotp et buildDynamicQrPayload supprimés ; couvert par tests/parcours/acces-scan.test.ts (double scan simultané depuis deux portes → un seul valid)
    // [lot 4 — cas supprimé] 5. Tolérance Dérive Temporelle (±1 pas) : generateTotp et verifyTotp supprimés (verifyTicketCode) ; couvert par tests/parcours/acces-totp.test.ts (pas de 20 s, tolérance ±1 pas, code de plus de 40 s refusé)

    // ─────────────────────────────────────────────────────────────
    // TEST 6 : Identifiant nu présenté à la caméra — REFUSÉ
    // [lot 4] Réécrit : le numéro de billet seul (TCK-...) était composté comme une « saisie manuelle »
    // (contournement du QR dynamique, audit scan-security-1). Contrat du lot 4 : un payload caméra qui
    // n'est pas EVT1:<UUID>:<6 chiffres> donne dynamic_qr_required et le billet reste VALIDE ; la saisie
    // manuelle a son propre corps ({ eventId, manualTicketNumber, identityVerified }) et est couverte par
    // tests/parcours/acces-qr.test.ts.
    // ─────────────────────────────────────────────────────────────
    await test('6. Identifiant nu (numéro de billet sans code dynamique) refusé, billet non composté', async () => {
        const ticket = await createTestTicket('T6');

        const scanReq = new NextRequest('http://localhost:3000/api/controller/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ctrlToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ eventId, payload: ticket.ticket_number }),
        });

        const scanRes = await controllerScan(scanReq);
        assert.equal(scanRes.status, 200);
        const scanData = await scanRes.json();

        assert.equal(scanData.result, 'dynamic_qr_required');
        assert.equal(scanData.ticket, undefined, 'aucune donnée de billet pour un identifiant nu');

        // Vérification en base : le billet n'est pas composté
        const { data: dbTicket } = await supabase.from('tickets').select('status, checked_in_at').eq('id', ticket.id).single();
        assert.equal(dbTicket?.status, 'VALIDE');
        assert.equal(dbTicket?.checked_in_at, null);
    });

    // [lot 4 — cas supprimé] 7. Route /api/tickets/verify (mode borne / partenaire) : route supprimée, voie de scan unique /api/controller/scan ; couvert par tests/parcours/acces-scan.test.ts (partenaire propriétaire valid par la même route) et tests/parcours/acces-totp.test.ts (qr_expired)
});
