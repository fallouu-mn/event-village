/**
 * Lot 1B.9 — routes de débogage et anonymisation.
 *  - Aucune route de test ou de débogage sous app/api (dont /api/test-notify-superadmins,
 *    qui envoyait SMS et emails réels aux superadmins pour tout utilisateur connecté).
 *  - L'anonymisation d'un compte brouille aussi l'email et le téléphone de connexion
 *    (auth.users) et bannit le compte : l'ancien identifiant ne permet plus de se connecter,
 *    et l'email d'origine est libéré.
 *
 * Lot 8 (8.2 v) : cas de tests/legacy/admin-anonymize.test.ts porté, vert dès l'écriture : identité de public.users
 * effacée, billets, commande et paiement conservés, équipes vidées. Écarts au legacy : par la route et un SUPERADMIN
 * réel ; statut exact SUPPRIME (le legacy admettait aussi le repli SUSPENDU, plus strict ici) ; commande à régler sur
 * place plutôt qu'une commande SUCCESS sans paiement, qui violerait l'invariant (b).
 * Suite existante sans after() : aucun contrôle d'invariants ajouté, les suites suivantes lisent toute la base.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, signInAs } from '../helpers/fixtures';
import { DELETE as adminDeleteUser } from '../../app/api/admin/users/route';
import { BASE_URL, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { paymentById } from './paiement-helpers';
import { buyConfirmed, newPartner } from './finance-helpers';
import { createCashOrderTickets, createTimedEvent, newController, ticketRow } from './acces-helpers';

function anonClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe('Routes de débogage et anonymisation', () => {
    test('aucune route de test ou de débogage sous app/api', () => {
        const apiDir = path.resolve(process.cwd(), 'app/api');
        const offenders: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                if (!e.isDirectory()) continue;
                const full = path.join(p, e.name);
                if (/^(test|debug|dev|qa)([-_].*)?$|[-_](test|debug)$/i.test(e.name)) offenders.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
                walk(full);
            }
        };
        walk(apiDir);
        assert.deepEqual(offenders, [], `routes de débogage présentes :\n${offenders.join('\n')}`);
    });

    test('compte anonymisé : email et téléphone de connexion brouillés, connexion impossible, email libéré', async () => {
        const service = getServiceRoleClient();
        const superadmin = await signInAs('SUPERADMIN');
        const email = randomEmail('anonymise');
        const phone = randomSenegalPhone('76');
        const { data: created, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
        assert.equal(error, null, `création du compte : ${error?.message}`);
        const userId = created.user!.id;

        const { error: preErr } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.equal(preErr, null, `précondition : connexion possible avant anonymisation (${preErr?.message})`);

        const res = await adminDeleteUser(new NextRequest(`${BASE_URL}/api/admin/users?userId=${userId}`, { method: 'DELETE', headers: bearer(superadmin.accessToken) }));
        const body = await res.json();
        assert.equal(res.status, 200, `anonymisation : HTTP ${res.status} ${JSON.stringify(body)}`);

        const { data: authUser, error: getErr } = await service.auth.admin.getUserById(userId);
        assert.equal(getErr, null, `lecture auth.users : ${getErr?.message}`);
        const digits = (s: string | undefined | null) => (s || '').replace(/\D/g, '');
        assert.notEqual(authUser.user?.email, email, 'auth.users.email doit être brouillé');
        assert.notEqual(digits(authUser.user?.phone), digits(phone), 'auth.users.phone doit être brouillé');
        const bannedUntil = (authUser.user as { banned_until?: string } | null)?.banned_until;
        assert.ok(bannedUntil && new Date(bannedUntil).getTime() > Date.now(), `le compte doit être banni (banned_until=${bannedUntil})`);

        const { error: loginErr } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
        assert.ok(loginErr, 'connexion avec l’email d’origine refusée après anonymisation');

        const { error: reuseErr } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
        assert.equal(reuseErr, null, `l’email d’origine doit être libéré : ${reuseErr?.message}`);
    });

    test('compte anonymisé : identité effacée, billets, commande et paiement conservés, retiré des équipes (cas porté)', async () => {
        const service = getServiceRoleClient();
        const superadmin = await signInAs('SUPERADMIN');
        const partner = await newPartner('anonymise');
        const ev = await createTimedEvent(partner.partnerId, 'anonymise', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
        const client = await newController(partner, ev.eventId, { label: 'anonymise' });
        const purchase = await buyConfirmed(client, ev, [['Standard', 1]]);
        const order = await createCashOrderTickets(client, partner, ev, 'Standard', 1);
        const ticketIds = [String(purchase.tickets[0].id), ...order.ticketIds];
        const snapshot = async () => Promise.all(ticketIds.map(async (id) => {
            const t = await ticketRow(id);
            return { id: t.id, user_id: t.user_id, price: Number(t.price), ticket_number: t.ticket_number, status: t.status };
        }));
        const ticketsBefore = await snapshot();

        const res = await adminDeleteUser(new NextRequest(`${BASE_URL}/api/admin/users?userId=${client.userId}`, { method: 'DELETE', headers: bearer(superadmin.accessToken) }));
        const body = await res.json();
        assert.equal(res.status, 200, `anonymisation : HTTP ${res.status} ${JSON.stringify(body)}`);

        const { data: user, error: userErr } = await service.from('users').select('first_name, last_name, email, phone, status').eq('id', client.userId).single();
        assert.equal(userErr, null, `la ligne public.users doit rester : ${userErr?.message}`);
        assert.deepEqual({ first_name: user.first_name, last_name: user.last_name, email: user.email, status: user.status },
            { first_name: 'Utilisateur', last_name: 'Supprimé', email: `${client.userId}@deleted.eventvillage.sn`, status: 'SUPPRIME' }, 'identité effacée');
        assert.ok(String(user.phone).startsWith('000000'), `numéro effacé : ${user.phone}`);

        assert.deepEqual(await snapshot(), ticketsBefore, 'billets conservés, toujours au nom du compte, montants intacts');
        const { data: kept, error: orderErr } = await service.from('orders').select('client_id, total_amount').eq('id', order.orderId).single();
        assert.equal(orderErr, null, `la commande doit rester : ${orderErr?.message}`);
        assert.deepEqual({ client_id: kept.client_id, total: Number(kept.total_amount) }, { client_id: client.userId, total: 5000 }, 'commande conservée, montant intact');
        const payment = await paymentById(purchase.payment.id);
        assert.deepEqual({ client_id: payment.client_id, amount: Number(payment.amount), status: payment.status },
            { client_id: client.userId, amount: Number(purchase.payment.amount), status: 'SUCCESS' }, 'paiement conservé');

        const { data: teams, error: teamErr } = await service.from('event_controllers').select('id').eq('user_id', client.userId);
        assert.equal(teamErr, null, `affectations : ${teamErr?.message}`);
        assert.deepEqual(teams ?? [], [], 'plus aucune affectation d’équipe');
        const { data: roles, error: roleErr } = await service.from('user_roles').select('role').eq('user_id', client.userId).eq('role', 'CONTROLEUR');
        assert.equal(roleErr, null, `rôles : ${roleErr?.message}`);
        assert.deepEqual(roles ?? [], [], 'rôle CONTROLEUR retiré');
    });
});
