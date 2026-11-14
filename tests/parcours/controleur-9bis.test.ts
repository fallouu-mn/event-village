/**
 * Lot 9 bis, tâche 18 (R102, R103 ; contrat 5.18, B43, B44, 4.2) — contrôleur.
 *  - R102, activation : un compte coquille SUSPENDU avec un code valide → POST /api/controller/setup → 403
 *    ACCOUNT_NOT_ACTIVE « Ce compte est suspendu : l’activation est impossible. Contactez l’organisateur ou le support. »
 *    (après la vérification du code), mot de passe et rôles inchangés ;
 *  - R102, affectations en une seule opération : contrainte d'essai `CHECK … NOT VALID` sur event_controllers qui refuse
 *    l'insertion pour ce contrôleur ; PATCH /api/partner/team/assignments (retrait de A, ajout de B) → échec et RIEN de
 *    changé (A toujours affecté, B non) ;
 *  - R103 : transfert vers son propre numéro (formes +221… et 221…) → SELF_TRANSFER dès l'initiation, en base
 *    (ticket_transfer_initiate) et par la route (400), sans transfert, sans verrou, sans SMS.
 * La contrainte d'essai est posée par une connexion locale (tests/helpers/db.ts), nommée par la suite et retirée dans
 * un finally ; elle ne vise que le contrôleur de la suite.
 *
 * Rouge avant correctif (fix(9b.18), fix(9b.18-SC)) : setup ne lit pas le statut (app/api/controller/setup/route.ts:71-75)
 * et active le compte ; team/assignments fait trois instructions séparées (route.ts:186-238) et ignore le format
 * assignments[] (R41) ; ticket_transfer_initiate ne compare jamais le destinataire au porteur (M/20261103000005:78-170).
 * La partie « route » du transfert passe d'abord par confirmPassword (R57) : rouge aujourd'hui sur la route de
 * confirmation absente, puis sur SELF_TRANSFER.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getFakes } from '../fakes';
import { openConcurrentClient } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { confirmPassword, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, type RouteResult } from './acces-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

after(async () => {
    await assertLot9bisInvariants('controleur-9bis');
});

type Row = Record<string, unknown>;

const SUSPENDED_TEXT = 'Ce compte est suspendu : l’activation est impossible. Contactez l’organisateur ou le support.';
const SELF_TEXT = 'Vous ne pouvez pas transférer un billet à votre propre numéro.';

let partner: TestPartner;
let evA: DraftEvent;
let evB: DraftEvent;

before(async () => {
    partner = await newPartner('r102');
    const cats = [{ name: 'Standard', price: 3_000, total: 30 }];
    evA = await createEventInStatus(partner, 'r102-a', cats, 'PUBLIE', { startsInHours: 72 });
    evB = await createEventInStatus(partner, 'r102-b', cats, 'PUBLIE', { startsInHours: 96 });
});

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

function freshIp(): Record<string, string> {
    const hex = randomBytes(4).toString('hex');
    return { 'x-forwarded-for': `2001:db8:${hex.slice(0, 4)}:${hex.slice(4)}::7` };
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, error?.message);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function assignment(eventId: string, userId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_controllers').select('id, can_accept_cash').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    assert.equal(error, null, error?.message);
    return (data as Row | null) ?? null;
}

describe('R102 — activation refusée à un compte suspendu', () => {
    test('compte coquille SUSPENDU, code valide → 403 ACCOUNT_NOT_ACTIVE, mot de passe et rôles inchangés', async () => {
        const phone = randomSenegalPhone('76');
        const since = getFakes().sms.messagesTo(phone).length;
        const invite = await invoke(await routeHandler('../../app/api/partner/team/invite/route', 'POST', 'POST /api/partner/team/invite'),
            jsonRequest('/api/partner/team/invite', 'POST', partner.accessToken, { event_ids: [evA.eventId], phone, first_name: 'Modou', last_name: 'Coquille' }));
        assert.ok(invite.status < 300, `invitation d’un numéro sans compte : ${show(invite)}`);
        const code = getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c)).pop();
        assert.ok(code, 'code d’activation reçu par SMS');
        const { data: shell, error } = await service.from('users').select('id').in('phone', [phone, phone.replace(/^\+/, '')]).single();
        assert.equal(error, null, `compte coquille : ${error?.message}`);
        const shellId = String(shell.id);
        const { error: susErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', shellId);
        assert.equal(susErr, null, `suspension du compte coquille : ${susErr?.message}`);
        const rolesBefore = await rolesOf(shellId);

        const newPassword = `${STRONG_PASSWORD}-active`;
        const res = await invoke(await routeHandler('../../app/api/controller/setup/route', 'POST', 'POST /api/controller/setup'),
            jsonRequest('/api/controller/setup', 'POST', null, { phone, otp_code: code, new_password: newPassword }, freshIp()));
        assert.equal(res.status, 403, `R102 : activation d’un compte suspendu : ${show(res)}`);
        assert.equal(res.body.code, 'ACCOUNT_NOT_ACTIVE', show(res));
        assert.equal(sameQuotes(res.body.error), sameQuotes(SUSPENDED_TEXT), show(res));
        assert.deepEqual(await rolesOf(shellId), rolesBefore, 'rôles inchangés');
        const { data: auth, error: aErr } = await service.auth.admin.getUserById(shellId);
        assert.equal(aErr, null, aErr?.message);
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: signErr } = await anon.auth.signInWithPassword({ email: await gotrueEmail(String(auth.user?.email)), password: newPassword });
        assert.ok(signErr, 'mot de passe non posé : la connexion avec le mot de passe proposé échoue');
    });
});

describe('R102 — affectations en une seule opération', () => {
    test('insertion refusée par une contrainte d’essai : échec et rien de changé (A toujours affecté, B non)', async () => {
        const ctrl = await newController(partner, evA.eventId, { label: 'r102-sync' });
        const name = `essai_r102_${randomBytes(4).toString('hex')}`;
        const ddl = await openConcurrentClient({ applicationName: 'ev-test-r102' });
        try {
            await ddl.query(`ALTER TABLE public.event_controllers ADD CONSTRAINT ${name} CHECK (user_id <> '${ctrl.userId}'::uuid) NOT VALID`);
            await ddl.commit();
        } finally {
            await ddl.close();
        }
        let res: RouteResult | null = null;
        try {
            res = await invoke(await routeHandler('../../app/api/partner/team/assignments/route', 'PATCH', 'PATCH /api/partner/team/assignments'),
                jsonRequest('/api/partner/team/assignments', 'PATCH', partner.accessToken, {
                    controller_id: ctrl.userId, assignments: [{ event_id: evB.eventId, can_accept_cash: false }],
                }));
        } finally {
            const drop = await openConcurrentClient({ applicationName: 'ev-test-r102' });
            try {
                await drop.query(`ALTER TABLE public.event_controllers DROP CONSTRAINT IF EXISTS ${name}`);
                await drop.commit();
            } finally {
                await drop.close();
            }
        }
        assert.ok(res, 'appel de la route fait');
        assert.ok(res.status >= 400, `R102 : une affectation refusée par la base doit faire échouer l’opération : ${show(res)}`);
        assert.ok(await assignment(evA.eventId, ctrl.userId), 'R102 : retrait de A non appliqué (aucun état partiel)');
        assert.equal(await assignment(evB.eventId, ctrl.userId), null, 'B non affecté');
    });
});

describe('R103 — transfert vers son propre numéro refusé dès l’initiation', () => {
    async function holder(label: string): Promise<{ buyer: Buyer; ticketId: string }> {
        const buyer = await newBuyer(label);
        const { tickets } = await buyConfirmed(buyer, evA, [['Standard', 1]]);
        return { buyer, ticketId: String(tickets[0].id) };
    }

    async function transferState(ticketId: string): Promise<{ transfers: number; locked: unknown }> {
        const { count, error } = await service.from('ticket_transfers').select('id', { count: 'exact', head: true }).eq('ticket_id', ticketId);
        assert.equal(error, null, error?.message);
        const { data, error: tErr } = await service.from('tickets').select('transfer_locked').eq('id', ticketId).single();
        assert.equal(tErr, null, tErr?.message);
        return { transfers: count ?? 0, locked: data.transfer_locked };
    }

    test('ticket_transfer_initiate : SELF_TRANSFER pour +221… et 221…, sans transfert ni verrou', async () => {
        const { buyer, ticketId } = await holder('r103-rpc');
        const before = await transferState(ticketId);
        for (const recipient of [buyer.phoneE164, buyer.phoneE164.slice(1)]) {
            const { data, error } = await service.rpc('ticket_transfer_initiate', {
                p: { ticket_id: ticketId, actor_id: buyer.userId, recipient, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() },
            });
            assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
            assert.equal((data as Row).ok, false, `R103 : transfert vers son propre numéro (${recipient}) accepté à l’initiation : ${JSON.stringify(data)}`);
            assert.equal((data as Row).code, 'SELF_TRANSFER', JSON.stringify(data));
            assert.deepEqual(await transferState(ticketId), before, 'ni transfert ni verrou');
        }
    });

    test('POST /api/tickets/[id]/transfer vers son propre numéro → 400 SELF_TRANSFER, aucun SMS au numéro', async () => {
        const { buyer, ticketId } = await holder('r103-route');
        await confirmPassword(buyer, STRONG_PASSWORD);
        const before = await transferState(ticketId);
        const sms = getFakes().sms.messagesTo(buyer.phoneE164).length;
        const handler = await routeHandler('../../app/api/tickets/[id]/transfer/route', 'POST', 'POST /api/tickets/[id]/transfer');
        for (const recipient of [buyer.phoneE164, buyer.phoneE164.slice(1)]) {
            const res = await invoke(handler, jsonRequest(`/api/tickets/${ticketId}/transfer`, 'POST', buyer.accessToken, { recipient }), ctx({ id: ticketId }));
            assert.equal(res.status, 400, `R103 : transfert vers ${recipient} : ${show(res)}`);
            assert.equal(res.body.code, 'SELF_TRANSFER', show(res));
            assert.equal(sameQuotes(res.body.error), sameQuotes(SELF_TEXT), show(res));
        }
        assert.deepEqual(await transferState(ticketId), before, 'ni transfert ni verrou');
        assert.equal(getFakes().sms.messagesTo(buyer.phoneE164).length, sms, 'aucun SMS envoyé à soi-même');
    });
});
