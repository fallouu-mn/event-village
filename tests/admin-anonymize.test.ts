import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { AdminService } from '../lib/admin/admin.service';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

test('1. ANONYMISATION RGPD SUPERADMIN : Soft delete avec intégrité financière et libération auth', async () => {
    if (!supabaseUrl || !serviceRoleKey) {
        console.warn('Variables Supabase manquantes pour le test.');
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = Date.now().toString().slice(-6);
    const superadminId = crypto.randomUUID();
    const clientPhone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const clientEmail = `client.rgpd.${suffix}@eventvillage.sn`;
    const partnerPhone = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const partnerEmail = `partner.rgpd.${suffix}@eventvillage.sn`;

    let clientUserId = '';
    let partnerUserId = '';
    let partnerId = '';
    let eventId = '';
    let categoryId = '';
    let orderId = '';
    let ticketId = '';
    let clientAuthCreated = false;
    let partnerAuthCreated = false;

    try {
        // ── 1. Résolution de l'utilisateur Client ──
        let authClientUser: any = null;
        try {
            const { data: authClient } = await adminClient.auth.admin.createUser({
                email: clientEmail,
                password: 'Password123!',
                email_confirm: true,
                phone: clientPhone,
                phone_confirm: true,
                user_metadata: { first_name: 'Moussa', last_name: 'Diop', role: 'CLIENT', phone: clientPhone },
            });
            if (authClient?.user) {
                clientUserId = authClient.user.id;
                clientAuthCreated = true;
                authClientUser = authClient.user;
            }
        } catch {}

        if (!clientUserId) {
            // Sélection d'un client actif existant pour le test
            const { data: existingClient } = await adminClient
                .from('users')
                .select('id, email, phone')
                .eq('role', 'CLIENT')
                .limit(1)
                .single();

            if (existingClient) {
                clientUserId = existingClient.id;
                clientAuthCreated = true;
            } else {
                clientUserId = crypto.randomUUID();
            }
        }

        await adminClient.from('users').upsert({
            id: clientUserId,
            first_name: 'Moussa',
            last_name: 'Diop',
            phone: clientPhone,
            email: clientEmail,
            role: 'CLIENT',
            status: 'ACTIF',
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        });

        // ── 2. Résolution du Partenaire ──
        const { data: existingPartner } = await adminClient
            .from('partners')
            .select('id, user_id')
            .limit(1)
            .maybeSingle();

        if (existingPartner) {
            partnerId = existingPartner.id;
            partnerUserId = existingPartner.user_id;
        } else {
            partnerUserId = crypto.randomUUID();
            const { data: partnerRec } = await adminClient.from('partners').insert({
                user_id: partnerUserId,
                company_name: `Prod RGPD ${suffix}`,
                commercial_name: `Prod RGPD ${suffix}`,
                status: 'VALIDE',
                is_verified: true,
            }).select('id').single();
            partnerId = partnerRec?.id || '';
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: eventRec, error: evErr } = await adminClient.from('events').insert({
            partner_id: partnerId,
            title: `Festival RGPD ${suffix}`,
            slug: `festival-rgpd-${suffix}`,
            start_date: todayStr,
            start_time: '00:00:00',
            end_date: todayStr,
            end_time: '23:59:59',
            location: 'Dakar',
            status: 'PUBLIE',
        }).select('id').single();
        if (evErr || !eventRec) throw new Error(`Création event échouée: ${evErr?.message}`);
        eventId = eventRec.id;

        const { data: catRec, error: catErr } = await adminClient.from('ticket_categories').insert({
            event_id: eventId,
            name: 'Pass VIP',
            price: 25000,
            total_quantity: 100,
        }).select('id').single();
        if (catErr || !catRec) throw new Error(`Création catégorie échouée: ${catErr?.message}`);
        categoryId = catRec.id;

        // ── 3. Création d'une commande et d'un billet liés au client ──
        const { data: orderRec, error: ordErr } = await adminClient.from('orders').insert({
            order_number: `CMD-RGPD-${suffix}`,
            client_id: clientUserId,
            partner_id: partnerId,
            subtotal: 25000,
            total_amount: 25000,
            paid_amount: 25000,
            balance_amount: 0,
            delivery_mode: 'SUR_PLACE',
            order_status: 'CONFIRMEE',
            payment_status: 'SUCCESS',
        }).select('id').single();
        if (ordErr || !orderRec) throw new Error(`Création commande échouée: ${ordErr?.message}`);
        orderId = orderRec.id;

        const { data: ticketRec, error: tErr } = await adminClient.from('tickets').insert({
            event_id: eventId,
            category_id: categoryId,
            user_id: clientUserId,
            order_id: orderId,
            ticket_number: `TKT-RGPD-${suffix}`,
            price: 25000,
            qr_code: `QR-RGPD-${suffix}`,
            status: 'VALIDE',
        }).select('id').single();
        if (tErr || !ticketRec) throw new Error(`Création ticket échouée: ${tErr?.message}`);
        ticketId = ticketRec.id;

        // ── 4. Affectation de l'utilisateur comme Contrôleur de l'événement ──
        await adminClient.from('event_controllers').insert({
            event_id: eventId,
            user_id: clientUserId,
            created_by: partnerUserId,
            can_accept_cash: true,
        });

        const { count: ctrlCountBefore } = await adminClient
            .from('event_controllers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', clientUserId);
        assert.strictEqual(ctrlCountBefore, 1, 'Le client doit être affecté comme contrôleur avant anonymisation.');

        // ── 5. EXÉCUTION DE L'ANONYMISATION SUPERADMIN ──
        console.log(`\nExécution de AdminService.anonymizeUser pour ${clientUserId}...`);
        const result = await AdminService.anonymizeUser(clientUserId, {
            id: superadminId,
            role: 'SUPERADMIN',
        });
        assert.strictEqual(result.success, true, 'L\'anonymisation doit réussir.');

        // ── 6. VÉRIFICATION 1 : Table users UPDATE RGPD ──
        const { data: anonymizedUser } = await adminClient
            .from('users')
            .select('id, first_name, last_name, email, phone, status')
            .eq('id', clientUserId)
            .single();

        assert.ok(anonymizedUser, 'La ligne de l\'utilisateur doit toujours exister dans public.users');
        assert.strictEqual(anonymizedUser.first_name, 'Utilisateur', 'first_name doit être Utilisateur');
        assert.strictEqual(anonymizedUser.last_name, 'Supprimé', 'last_name doit être Supprimé');
        assert.strictEqual(anonymizedUser.email, `${clientUserId}@deleted.eventvillage.sn`, 'email doit être @deleted.eventvillage.sn');
        assert.strictEqual(anonymizedUser.phone, '000000000', 'phone doit être 000000000 dans public.users');
        assert.ok(
            anonymizedUser.status === 'SUPPRIME' || anonymizedUser.status === 'SUSPENDU',
            `Le statut doit être SUPPRIME ou SUSPENDU (actuel: ${anonymizedUser.status})`
        );
        console.log('✓ Vérification 1 réussie : Identité public.users anonymisée.');

        // ── 7. VÉRIFICATION 2 (CRITIQUE) : Intégrité financière préservée ──
        const { data: preservedTicket } = await adminClient
            .from('tickets')
            .select('id, user_id, price, ticket_number, status')
            .eq('id', ticketId)
            .maybeSingle();

        assert.ok(preservedTicket, 'CRITIQUE : Le billet DOIT TOUJOURS EXISTER dans la table tickets');
        assert.strictEqual(preservedTicket.user_id, clientUserId, 'Le billet doit toujours référencer le user_id');
        assert.strictEqual(Number(preservedTicket.price), 25000, 'Le montant financier du billet reste intact');

        const { data: preservedOrder } = await adminClient
            .from('orders')
            .select('id, client_id, total_amount, payment_status')
            .eq('id', orderId)
            .maybeSingle();

        assert.ok(preservedOrder, 'CRITIQUE : La commande DOIT TOUJOURS EXISTER dans la table orders');
        assert.strictEqual(preservedOrder.client_id, clientUserId, 'La commande doit toujours référencer client_id');
        assert.strictEqual(Number(preservedOrder.total_amount), 25000, 'Le total de la commande reste intact');
        console.log('✓ Vérification 2 réussie : Commandes et billets préservés (0 perte financière).');

        // ── 8. VÉRIFICATION 3 : Droit à l'oubli opérationnel (event_controllers purgé) ──
        const { count: ctrlCountAfter } = await adminClient
            .from('event_controllers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', clientUserId);

        assert.strictEqual(ctrlCountAfter, 0, 'L\'utilisateur doit être retiré de event_controllers.');
        console.log('✓ Vérification 3 réussie : Retiré de la liste d\'équipe des partenaires.');

        // ── 9. VÉRIFICATION 4 : Supabase Auth ban & libération téléphone ──
        if (clientAuthCreated) {
            const { data: authUserRecord } = await adminClient.auth.admin.getUserById(clientUserId);
            if (authUserRecord?.user) {
                assert.strictEqual(authUserRecord.user.email, `${clientUserId}@deleted.eventvillage.sn`, 'Auth email brouillé');
                assert.ok(
                    !authUserRecord.user.phone || authUserRecord.user.phone === '',
                    'Le numéro de téléphone a été libéré côté auth.'
                );
                assert.ok(
                    Boolean(authUserRecord.user.banned_until),
                    'Le compte doit être banni côté Auth Supabase.'
                );
                console.log('✓ Vérification 4 réussie : Auth Supabase banni et numéro libéré.');
            }
        }

    } finally {
        // Nettoyage complet des données créées pour le test
        if (ticketId) await adminClient.from('tickets').delete().eq('id', ticketId);
        if (orderId) await adminClient.from('orders').delete().eq('id', orderId);
        if (categoryId) await adminClient.from('ticket_categories').delete().eq('id', categoryId);
        if (eventId) {
            await adminClient.from('event_controllers').delete().eq('event_id', eventId);
            await adminClient.from('events').delete().eq('id', eventId);
        }
        if (partnerAuthCreated && partnerId) {
            await adminClient.from('partners').delete().eq('id', partnerId);
            await adminClient.from('users').delete().eq('id', partnerUserId);
            try { await adminClient.auth.admin.deleteUser(partnerUserId); } catch {}
        }
    }
});