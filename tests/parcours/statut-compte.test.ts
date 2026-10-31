/**
 * Lot 1B.6 — statut des comptes.
 *  - Une route partenaire ne remet jamais ACTIF un compte SUSPENDU : invitation et affectations
 *    refusent explicitement (code ACCOUNT_NOT_ACTIVE) et journalisent le refus ; le retrait d'un
 *    contrôleur ne touche pas au statut.
 *  - Les routes /api/partner/* et /api/tickets/* refusent un utilisateur dont users.status n'est
 *    pas ACTIF, par un helper commun (contrôle statique de couverture inclus).
 *  - Trois routes sans contrôle d'identité, trouvées en appliquant le helper :
 *    activation d'essai partenaire, liste des billets (paramètre userId), vérification de billet.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { grantUserRoles } from '../../lib/auth/roles';
import { bearer, FIXTURE_TICKETS, loadFixtures, signInAs } from '../helpers/fixtures';
import { POST as inviteController } from '../../app/api/partner/team/invite/route';
import { PATCH as updateAssignments } from '../../app/api/partner/team/assignments/route';
import { DELETE as removeController } from '../../app/api/partner/team/controller/[controllerId]/route';
import { GET as partnerEvents } from '../../app/api/partner/events/route';
import { POST as partnerActivation } from '../../app/api/partner/activation/route';
import { GET as liveCode } from '../../app/api/tickets/[id]/live-code/route';
import { GET as listTickets } from '../../app/api/tickets/route';
import { POST as verifyTicket } from '../../app/api/tickets/verify/route';
import { BASE_URL, jsonRequest, randomEmail, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { NextRequest } from 'next/server';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

interface Account { userId: string; email: string; phone: string; token: string }

async function newAccount(label: string, opts: { roles?: ('PARTENAIRE' | 'CONTROLEUR')[]; status?: 'ACTIF' | 'SUSPENDU' } = {}): Promise<Account> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const phone = randomSenegalPhone('77');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, `création du compte ${label} : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone, status: opts.status ?? 'ACTIF' }).eq('id', userId);
    assert.equal(upErr, null, `profil ${label} : ${upErr?.message}`);
    if (opts.roles?.length) await grantUserRoles(userId, opts.roles);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: signErr } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signErr, null, `connexion ${label} : ${signErr?.message}`);
    return { userId, email, phone, token: session.session!.access_token };
}

async function statusOf(userId: string): Promise<string> {
    const { data, error } = await getServiceRoleClient().from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut : ${error?.message}`);
    return data.status as string;
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles : ${error?.message}`);
    return (data || []).map((r) => r.role as string).sort();
}

async function auditActions(objectId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('audit_logs').select('action').eq('object_id', objectId);
    assert.equal(error, null, `audit : ${error?.message}`);
    return (data || []).map((r) => r.action as string);
}

function getRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`${BASE_URL}${pathname}`, { method: 'GET', headers });
}

describe('Statut des comptes sur les routes partenaire et billets', () => {
    test('invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const target = await newAccount('susp-invite', { status: 'SUSPENDU' });

        const res = await inviteController(jsonRequest('/api/partner/team/invite', {
            phone: target.phone,
            event_ids: [fx.events.A_PUBLIE.id],
            first_name: 'Invité',
            last_name: 'Suspendu',
            confirm_promotion: true,
        }, bearer(partnerA.accessToken)));
        const body = await res.json();
        assert.equal(body.code, 'ACCOUNT_NOT_ACTIVE', `refus explicite attendu, HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.ok(res.status === 409 || res.status === 403, `HTTP ${res.status}`);
        assert.equal(await statusOf(target.userId), 'SUSPENDU');
        assert.ok(!(await rolesOf(target.userId)).includes('CONTROLEUR'), 'aucun rôle CONTROLEUR ne doit être ajouté');
        assert.ok((await auditActions(target.userId)).includes('CONTROLLER_INVITE_REFUSED_INACTIVE'), 'refus journalisé dans audit_logs');
    });

    test('affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const target = await newAccount('susp-assign', { roles: ['CONTROLEUR'], status: 'SUSPENDU' });

        const res = await updateAssignments(jsonRequest('/api/partner/team/assignments', {
            controllerId: target.userId,
            event_ids: [fx.events.A_PUBLIE.id],
            confirm_promotion: true,
        }, bearer(partnerA.accessToken), 'PATCH'));
        const body = await res.json();
        assert.equal(body.code, 'ACCOUNT_NOT_ACTIVE', `refus explicite attendu, HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(await statusOf(target.userId), 'SUSPENDU');
        const { data: assigned } = await getServiceRoleClient().from('event_controllers').select('id').eq('user_id', target.userId);
        assert.deepEqual(assigned, [], 'aucune affectation ne doit être créée');
        assert.ok((await auditActions(target.userId)).includes('CONTROLLER_ASSIGNMENT_REFUSED_INACTIVE'), 'refus journalisé dans audit_logs');
    });

    test('retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const target = await newAccount('susp-remove', { roles: ['CONTROLEUR'] });
        const service = getServiceRoleClient();
        const { error: assignErr } = await service.from('event_controllers').insert({
            event_id: fx.events.A_PUBLIE.id, user_id: target.userId, created_by: fx.users.PARTNER_A.id, can_accept_cash: false,
        });
        assert.equal(assignErr, null, `affectation : ${assignErr?.message}`);
        const { error: suspErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', target.userId);
        assert.equal(suspErr, null, `suspension : ${suspErr?.message}`);

        const res = await removeController(
            new NextRequest(`${BASE_URL}/api/partner/team/controller/${target.userId}`, { method: 'DELETE', headers: bearer(partnerA.accessToken) }),
            routeContext({ controllerId: target.userId })
        );
        const body = await res.json();
        assert.equal(res.status, 200, `retrait : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(await statusOf(target.userId), 'SUSPENDU', 'le retrait ne doit pas réactiver le compte');
        assert.ok(!(await rolesOf(target.userId)).includes('CONTROLEUR'), 'rôle CONTROLEUR retiré');
    });

    test('partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)', async () => {
        const partner = await newAccount('susp-partner', { roles: ['PARTENAIRE'], status: 'SUSPENDU' });
        const res = await partnerEvents(getRequest('/api/partner/events', bearer(partner.token)));
        const body = await res.json();
        assert.equal(res.status, 403, `HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(body.code, 'ACCOUNT_NOT_ACTIVE');
    });

    test('client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)', async () => {
        const suspended = await signInAs('SUSPENDED');
        const res = await liveCode(getRequest(`/api/tickets/${ZERO_UUID}/live-code`, bearer(suspended.accessToken)), routeContext({ id: ZERO_UUID }));
        const body = await res.json();
        assert.equal(res.status, 403, `HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(body.code, 'ACCOUNT_NOT_ACTIVE');
    });

    test('activation d’essai d’un partenaire par un autre compte → refusée', async () => {
        const fx = await loadFixtures();
        const client = await signInAs('CLIENT');
        const res = await partnerActivation(jsonRequest('/api/partner/activation', { partnerId: fx.partners.B.id }, bearer(client.accessToken)));
        const body = await res.json();
        assert.equal(res.status, 403, `HTTP ${res.status} ${JSON.stringify(body)}`);
    });

    test('liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte', async () => {
        const fx = await loadFixtures();
        const noAuth = await listTickets(getRequest(`/api/tickets?userId=${fx.users.CLIENT_BIS.id}`));
        assert.equal(noAuth.status, 401, `sans session : HTTP ${noAuth.status}`);

        const client = await signInAs('CLIENT');
        const other = await listTickets(getRequest(`/api/tickets?userId=${fx.users.CLIENT_BIS.id}`, bearer(client.accessToken)));
        const body = await other.json();
        const tickets: { ticket_number?: string }[] = body.tickets || body.data || [];
        assert.ok(
            other.status === 403 || !tickets.some((t) => t.ticket_number === FIXTURE_TICKETS.CLIENT_BIS_B_STANDARD.ticketNumber),
            `billets de CLIENT_BIS servis à CLIENT : HTTP ${other.status}`
        );
    });

    test('vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté', async () => {
        // Billet dédié (la vérification réussie le composte) sur A_PUBLIE, appartenant à CLIENT_BIS.
        const fx = await loadFixtures();
        const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
        const ticketNumber = `TCK-VERIFY-${suffix}`;
        const { error: insErr } = await getServiceRoleClient().from('tickets').insert({
            event_id: fx.events.A_PUBLIE.id,
            category_id: fx.events.A_PUBLIE.categories.Standard.id,
            user_id: fx.users.CLIENT_BIS.id,
            ticket_number: ticketNumber,
            qr_code: `EV-QR-VERIFY-${suffix}`,
            price: fx.events.A_PUBLIE.categories.Standard.price,
            status: 'VALIDE',
        });
        assert.equal(insErr, null, `billet dédié : ${insErr?.message}`);

        const client = await signInAs('CLIENT_BIS');
        const asClient = await verifyTicket(jsonRequest('/api/tickets/verify', { ticketNumber }, bearer(client.accessToken)));
        assert.equal(asClient.status, 403, `CLIENT : HTTP ${asClient.status} ${JSON.stringify(await asClient.json()).slice(0, 300)}`);

        const partnerB = await signInAs('PARTNER_B');
        const asOtherPartner = await verifyTicket(jsonRequest('/api/tickets/verify', { ticketNumber }, bearer(partnerB.accessToken)));
        assert.equal(asOtherPartner.status, 403, `partenaire B : HTTP ${asOtherPartner.status} ${JSON.stringify(await asOtherPartner.json()).slice(0, 300)}`);

        const { data: still } = await getServiceRoleClient().from('tickets').select('status').eq('ticket_number', ticketNumber).single();
        assert.equal(still?.status, 'VALIDE', 'le billet ne doit pas avoir été composté par un compte hors périmètre');

        const controller = await signInAs('CONTROLLER_A');
        const asController = await verifyTicket(jsonRequest('/api/tickets/verify', { ticketNumber }, bearer(controller.accessToken)));
        const body = await asController.json();
        assert.equal(asController.status, 200, `contrôleur affecté : HTTP ${asController.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal(body.status, 'valid');
    });

    test('toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun', () => {
        const PUBLIC_ROUTES = new Set([
            'app/api/partner/register/route.ts', // inscription publique d'un partenaire
            'app/api/partner/documents/upload/route.ts', // pièces jointes déposées pendant l'inscription publique
        ]);
        const files: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                const full = path.join(p, e.name);
                if (e.isDirectory()) walk(full);
                else if (e.name === 'route.ts') files.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
            }
        };
        walk(path.resolve(process.cwd(), 'app/api/partner'));
        walk(path.resolve(process.cwd(), 'app/api/tickets'));
        const missing = files.filter((f) => !PUBLIC_ROUTES.has(f) && !/\brequireActiveSession\s*\(/.test(fs.readFileSync(f, 'utf8')));
        assert.deepEqual(missing, [], `routes sans contrôle du statut du compte :\n${missing.join('\n')}`);
    });
});
