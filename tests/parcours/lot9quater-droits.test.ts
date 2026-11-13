/**
 * Lot 9 quater — droits et administration (A6 : AUD-06 ; A9 : AUD-33, AUD-34 ; B1 : AUD-22, G-01, E-08 ;
 * B2 : AUD-23, G-02, E-39 ; B3 : AUD-24 ; B4 : AUD-15 ; B5 : AUD-37 ; B6 : AUD-40 ; B7 : N-07, E-12 ; B8 : N-01, E-09).
 * Base LOCALE, faux adaptateurs. Rouge avant correctif (migration 20261111000003 absente, routes sans contrôle).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';
import { BASE_URL, randomEmail, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { assignController, authed, type RouteResult } from './acces-helpers';
import { newAdminWith } from './terrain-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

after(async () => {
    await assertLot9quaterInvariants('lot9quater-droits');
});

function anon() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

function asUser(token: string) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

async function call(modulePath: string, req: NextRequest, method = 'POST', ctx?: unknown): Promise<RouteResult> {
    const mod = await importModule(modulePath) as Record<string, Handler>;
    const res = await mod[method](req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = { raw: text.slice(0, 300) }; }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

async function bannedUntil(userId: string): Promise<string | null> {
    return inspect(async (c) => (await c.query<{ b: string | null }>('SELECT banned_until::text AS b FROM auth.users WHERE id = $1', [userId])).rows[0]?.b ?? null);
}

async function canSignIn(email: string): Promise<boolean> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    return !error && Boolean(data.session);
}

// ── A6 ─────────────────────────────────────────────────────────────────────

describe('A6 — compte suspendu : aides de droits et blocage chez GoTrue', () => {
    test('partenaire suspendue : bloquée chez GoTrue, aucune lecture des paiements ; réactivée : débloquée', async () => {
        const partner = await newPartner('q-a6');
        const ev = await createPartnerEvent(partner.partnerId, 'q a6', [{ name: 'Std', price: 1_000, total: 5 }]);
        const purchase = await buyConfirmed(await newBuyer('q-a6-acheteur'), ev, [['Std', 1]]);
        const actor = await superadminId();
        const susp = await service.rpc('partner_status_set', { p: { partner_id: partner.partnerId, actor_id: actor, status: 'SUSPENDU', reason: 'Lot 9 quater A6' } });
        assert.equal(susp.error, null, susp.error?.message);
        const until = await bannedUntil(partner.userId);
        console.log(`[A6] après suspension : banned_until=${until}`);
        assert.ok(until && new Date(until).getTime() > Date.now() + 365 * 24 * 3600 * 1000, 'compte bloqué chez GoTrue');
        assert.equal(await canSignIn(partner.email), false, 'aucune connexion');
        const pays = await asUser(partner.accessToken).from('payments').select('id').eq('id', purchase.payment.id);
        assert.equal((pays.data ?? []).length, 0, 'aucun paiement lu avec l’ancien jeton');
        const owner = await asUser(partner.accessToken).rpc('is_partner_owner', { p_partner_id: partner.partnerId });
        assert.equal(owner.data, false, 'is_partner_owner faux pour un compte suspendu');

        const back = await service.rpc('partner_status_set', { p: { partner_id: partner.partnerId, actor_id: actor, status: 'VALIDE', reason: 'Lot 9 quater A6 retour' } });
        assert.equal(back.error, null, back.error?.message);
        assert.equal(await bannedUntil(partner.userId), null, 'débloqué à la réactivation');
        assert.equal(await canSignIn(partner.email), true, 'connexion rétablie');
    });

    test('contrôleur suspendu : is_controller, has_role et auth_user_role ne donnent plus rien', async () => {
        const ctrl = await newBuyer('q-a6-ctrl');
        await service.from('user_roles').upsert([{ user_id: ctrl.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        const client = asUser(ctrl.accessToken);
        assert.equal((await client.rpc('is_controller')).data, true, 'précondition : contrôleur actif');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', ctrl.userId);
        assert.equal(error, null, error?.message);
        const [isCtrl, hasRole, role] = await Promise.all([
            client.rpc('is_controller'), client.rpc('has_role', { p_role: 'CONTROLEUR' }), client.rpc('auth_user_role'),
        ]);
        console.log(`[A6] contrôleur suspendu : is_controller=${isCtrl.data} has_role=${hasRole.data} auth_user_role=${role.data}`);
        assert.deepEqual([isCtrl.data, hasRole.data, role.data], [false, false, null]);
        assert.ok(await bannedUntil(ctrl.userId), 'bloqué chez GoTrue (écriture directe du statut comprise)');
    });
});

// ── A9 ─────────────────────────────────────────────────────────────────────

describe('A9 — journal pseudonymisé, adresse en attente', () => {
    test('AUD-33 : à l’anonymisation, numéros et noms du journal remplacés ; un autre compte de même prénom intact', async () => {
        const target = await newBuyer('q-a9-cible', { firstName: 'Ndeye', lastName: 'Pseudonyme' });
        const other = await newBuyer('q-a9-autre', { firstName: 'Ndeye', lastName: 'Temoin' });
        const rows = [
            { user_id: target.userId, user_role: 'CLIENT', action: 'Q_TEST', object_type: 'users', object_id: target.userId, metadata: { phone: target.phoneE164, name: 'Ndeye Pseudonyme' } },
            { user_id: other.userId, user_role: 'CLIENT', action: 'Q_TEST', object_type: 'users', object_id: other.userId, metadata: { invited: target.phone9, name: 'Ndeye Temoin' } },
        ];
        const { error } = await service.from('audit_logs').insert(rows);
        assert.equal(error, null, error?.message);
        const sa = await newAdminWith([], { role: 'SUPERADMIN', label: 'q-a9-sa' });
        const r = await call('../../app/api/admin/users/[id]/anonymize/route', authed(`/api/admin/users/${target.userId}/anonymize`, 'POST', sa), 'POST', { params: { id: target.userId } });
        assert.equal(r.status, 200, show(r));
        const { data } = await service.from('audit_logs').select('user_id, metadata').eq('action', 'Q_TEST').in('user_id', [target.userId, other.userId]);
        const mine = JSON.stringify((data ?? []).find((x) => x.user_id === target.userId)?.metadata);
        const theirs = JSON.stringify((data ?? []).find((x) => x.user_id === other.userId)?.metadata);
        console.log(`[A9] journal après anonymisation : cible ${mine} ; autre ${theirs}`);
        assert.ok(!mine.includes(target.phone9) && !mine.includes('Pseudonyme'), `cible : ${mine}`);
        assert.ok(!theirs.includes(target.phone9), `numéro de la cible chez un autre compte : ${theirs}`);
        assert.ok(theirs.includes('Ndeye Temoin'), `l’autre compte garde son nom : ${theirs}`);
    });

    test('AUD-34 : un autre compte valide l’adresse ; l’attente du premier reste, il est prévenu', async () => {
        const address = randomEmail('q-a9-attente').toLowerCase();
        const owner = await newBuyer('q-a9-proprio');
        const squatter = await newBuyer('q-a9-tiers');
        for (const u of [owner, squatter]) {
            const { error } = await service.from('users').update({ email_pending: address }).eq('id', u.userId);
            assert.equal(error, null, error?.message);
        }
        const token = randomBytes(24).toString('hex');
        const hash = createHash('sha256').update(token).digest('hex');
        const issued = await service.rpc('email_verification_issue', { p: { user_id: squatter.userId, token_hash: hash, account_max: 100, address_max: 100 } });
        assert.equal(issued.error, null, `lien : ${issued.error?.message} ${JSON.stringify(issued.data)}`);
        const { data: cur } = await service.from('users').select('email').eq('id', squatter.userId).single();
        const fin = await service.rpc('email_verification_finalize', { p: { token_hash: hash, expected_email: cur?.email } });
        assert.equal((fin.data as { ok?: boolean })?.ok, true, `validation : ${JSON.stringify(fin.data)} ${fin.error?.message}`);
        const { data: o } = await service.from('users').select('email_pending').eq('id', owner.userId).single();
        assert.equal(o?.email_pending, address, 'l’attente du titulaire n’est pas retirée sans sa confirmation');
        const { data: notes } = await service.from('notification_outbox').select('channel').eq('type', 'EMAIL_CLAIMED_ELSEWHERE').eq('recipient_user_id', owner.userId);
        assert.ok((notes ?? []).length > 0, 'titulaire prévenu');
    });
});

// ── B1, B2 ─────────────────────────────────────────────────────────────────

describe('B1 — route des tarifs, services en préparation', () => {
    test('un ADMIN pricing.manage n’écrit ni features.* ni une clé hors liste blanche (403, valeur inchangée)', async () => {
        const admin = await newAdminWith(['pricing.manage'], { label: 'q-b1' });
        const { data: before } = await service.from('platform_settings').select('value').eq('key', 'features.halls_enabled').single();
        for (const key of ['features.halls_enabled', 'q.cle_libre']) {
            const r = await call('../../app/api/admin/pricing/route', authed('/api/admin/pricing', 'POST', admin, { key, value: { value: true } }));
            assert.equal(r.status, 403, `${key} : ${show(r)}`);
        }
        const { data: afterRow } = await service.from('platform_settings').select('value').eq('key', 'features.halls_enabled').single();
        assert.deepEqual(afterRow?.value, before?.value, 'interrupteur inchangé');
        const ok = await call('../../app/api/admin/pricing/route', authed('/api/admin/pricing', 'POST', admin, { key: 'aggregator_fees', value: { wave: 1.5 } }));
        assert.equal(ok.status, 200, `clé tarifaire de la liste blanche : ${show(ok)}`);
    });

    test('écran : « Services en préparation », « Pas prêt pour le public », activation en tapant ACTIVER', () => {
        const page = fs.readFileSync('app/admin/finance-settings/page.tsx', 'utf8');
        assert.match(page, /title:\s*'Services en préparation'/);
        assert.match(page, /Pas prêt pour le public/);
        assert.match(page, /activationWord\.trim\(\) !== 'ACTIVER'/);
    });
});

describe('B2 — anonymiser ou suspendre un ADMIN ou une PARTENAIRE : SUPERADMIN seul', () => {
    test('un ADMIN users.write ne supprime ni un ADMIN ni une partenaire ; partners.suspend ne suspend pas une partenaire', async () => {
        const admin = await newAdminWith(['users.write', 'partners.suspend'], { label: 'q-b2' });
        const otherAdmin = await newAdminWith([], { label: 'q-b2-cible' });
        const partner = await newPartner('q-b2');
        for (const target of [otherAdmin.userId, partner.userId]) {
            const r = await call('../../app/api/admin/users/[id]/anonymize/route', authed(`/api/admin/users/${target}/anonymize`, 'POST', admin), 'POST', { params: { id: target } });
            assert.equal(r.status, 403, `anonymisation de ${target} : ${show(r)}`);
            const { data } = await service.from('users').select('status').eq('id', target).single();
            assert.equal(data?.status, 'ACTIF', 'compte intact');
        }
        const s = await call('../../app/api/admin/partners/[id]/status/route', authed(`/api/admin/partners/${partner.partnerId}/status`, 'PATCH', admin, { status: 'SUSPENDU', reason: 'essai B2' }), 'PATCH', { params: { id: partner.partnerId } });
        assert.equal(s.status, 403, `suspension d’une partenaire par un ADMIN : ${show(s)}`);
    });

    test('écran : aucun bouton « Supprimer » sur une ligne de partenaire', () => {
        const page = fs.readFileSync('app/admin/users/page.tsx', 'utf8');
        assert.match(page, /\{!isPartner && \(\s*<Button[\s\S]*?handleDeleteUser\(user\)/, 'bouton Supprimer sous !isPartner');
    });
});

// ── B3, B8 ─────────────────────────────────────────────────────────────────

describe('B3, B8 — équipe de contrôle', () => {
    async function teamOf(label: string): Promise<{ partner: TestPartner; eventId: string; ctrl: Buyer; assignmentId: string }> {
        const partner = await newPartner(label);
        const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Std', price: 1_000, total: 5 }]);
        const ctrl = await newBuyer(`${label}-ctrl`);
        await service.from('user_roles').upsert([{ user_id: ctrl.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        await assignController(partner, ctrl.userId, ev.eventId, false);
        const { data } = await service.from('event_controllers').select('id').eq('event_id', ev.eventId).eq('user_id', ctrl.userId).single();
        return { partner, eventId: ev.eventId, ctrl, assignmentId: String(data!.id) };
    }

    test('B3 : un ADMIN qui porte aussi le rôle PARTENAIRE, sans events.write, ne touche pas l’équipe d’une autre fiche', async () => {
        const other = await teamOf('q-b3');
        const adminPartner = await newPartner('q-b3-ap');
        await service.from('user_roles').upsert([{ user_id: adminPartner.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
        const r = await call('../../app/api/partner/team/[eventId]/route',
            authed(`/api/partner/team/${other.eventId}?assignmentId=${other.assignmentId}`, 'DELETE', adminPartner), 'DELETE', { params: { eventId: other.eventId } });
        assert.equal(r.status, 403, show(r));
        const { data } = await service.from('event_controllers').select('id').eq('id', other.assignmentId);
        assert.equal((data ?? []).length, 1, 'affectation intacte');
    });

    test('B8 : un admin sans partnerId → 400, rien supprimé ; avec partnerId → seulement cet organisateur', async () => {
        const a = await teamOf('q-b8-a');
        const b = await teamOf('q-b8-b');
        await assignController(b.partner, a.ctrl.userId, b.eventId, false);
        const admin = await newAdminWith(['events.write'], { label: 'q-b8' });
        const none = await call('../../app/api/partner/team/all/route', authed(`/api/partner/team/all?controllerId=${a.ctrl.userId}`, 'DELETE', admin), 'DELETE');
        assert.equal(none.status, 400, show(none));
        assert.equal(none.body.error, 'Choisissez l’organisateur dont vous gérez l’équipe.');
        const count = async () => (await service.from('event_controllers').select('id').eq('user_id', a.ctrl.userId)).data?.length ?? 0;
        assert.equal(await count(), 2, 'aucune affectation supprimée');
        const scoped = await call('../../app/api/partner/team/all/route', authed(`/api/partner/team/all?controllerId=${a.ctrl.userId}&partnerId=${a.partner.partnerId}`, 'DELETE', admin), 'DELETE');
        assert.equal(scoped.status, 200, show(scoped));
        const { data: left } = await service.from('event_controllers').select('event_id').eq('user_id', a.ctrl.userId);
        assert.deepEqual((left ?? []).map((x) => x.event_id), [b.eventId], 'seule l’affectation de l’autre organisateur reste');
    });
});

// ── B4, B5, B6, B7 ─────────────────────────────────────────────────────────

describe('B4 — access.operate pour scanner et tenir une caisse', () => {
    test('un ADMIN sans la permission ne scanne ni ne tient de caisse ; avec, il peut', async () => {
        const partner = await newPartner('q-b4');
        const ev = await createPartnerEvent(partner.partnerId, 'q b4', [{ name: 'Std', price: 1_000, total: 5 }]);
        const bare = await newAdminWith([], { label: 'q-b4-sans' });
        const op = await newAdminWith(['access.operate'], { label: 'q-b4-avec' });
        const res = await inspect(async (c) => {
            const q = async (fn: string, u: string) => (await c.query<{ ok: boolean }>(`SELECT public.${fn}($1, $2) AS ok`, [u, ev.eventId])).rows[0].ok;
            return {
                scanBare: await q('scan_scanner_authorized', bare.userId), cashBare: await q('shift_can_handle_cash', bare.userId),
                scanOp: await q('scan_scanner_authorized', op.userId), cashOp: await q('shift_can_handle_cash', op.userId),
            };
        });
        console.log(`[B4] ${JSON.stringify(res)}`);
        assert.deepEqual(res, { scanBare: false, cashBare: false, scanOp: true, cashOp: true });
    });

    test('libellés français des nouvelles permissions', async () => {
        const { permissionLabel } = await import('../../lib/admin/permission-labels');
        assert.equal(permissionLabel('access.operate'), 'Contrôler les entrées et tenir une caisse');
        assert.equal(permissionLabel('settings.read'), 'Lire les réglages');
    });
});

describe('B5 — lectures d’administration', () => {
    test('sans settings.read : réglages et tarifs refusés ; permissions d’un autre admin : SUPERADMIN seul', async () => {
        const bare = await newAdminWith([], { label: 'q-b5-sans' });
        const reader = await newAdminWith(['settings.read'], { label: 'q-b5-avec' });
        for (const [path, mod] of [['/api/admin/finance-settings', '../../app/api/admin/finance-settings/route'], ['/api/admin/pricing', '../../app/api/admin/pricing/route']] as const) {
            const no = await call(mod, authed(path, 'GET', bare), 'GET');
            const yes = await call(mod, authed(path, 'GET', reader), 'GET');
            assert.equal(no.status, 403, `${path} sans permission : ${show(no)}`);
            assert.equal(yes.status, 200, `${path} avec settings.read : ${show(yes)}`);
        }
        const other = await call('../../app/api/admin/permissions/route', authed(`/api/admin/permissions?adminId=${bare.userId}`, 'GET', reader), 'GET');
        assert.equal(other.status, 403, show(other));
        const own = await call('../../app/api/admin/permissions/route', authed(`/api/admin/permissions?adminId=${reader.userId}`, 'GET', reader), 'GET');
        assert.equal(own.status, 200, show(own));
    });
});

describe('B6 — réglages de la plateforme', () => {
    test('un visiteur ne lit plus platform_settings ; la vue publique n’a que les 6 réglages d’affichage', async () => {
        const direct = await anon().from('platform_settings').select('key');
        assert.ok(direct.error || (direct.data ?? []).length === 0, `lecture anonyme : ${JSON.stringify(direct.data)?.slice(0, 200)}`);
        const view = await anon().from('platform_settings_public').select('key');
        assert.equal(view.error, null, view.error?.message);
        const keys = (view.data ?? []).map((r) => r.key as string).sort();
        assert.deepEqual(keys.filter((k) => !['access.low_stock_threshold', 'features.halls_enabled', 'features.orders_enabled', 'features.tables_enabled', 'finance.min_paid_price', 'finance.service_fee_rate'].includes(k)), []);
        assert.ok(!keys.includes('access.refusal_alert_threshold'), 'aucun seuil anti-abus');
    });
});

describe('B7 — fenêtre des droits d’un ADMIN', () => {
    test('grille vidée et « Chargement… » avant la lecture, réponse périmée ignorée, échec : « Droits illisibles : fermez et rouvrez. » et Enregistrer inactif', () => {
        const page = fs.readFileSync('app/admin/users/page.tsx', 'utf8');
        const open = page.slice(page.indexOf('const handleOpenPermissions'), page.indexOf('// Sauvegarde des permissions'));
        assert.ok(open.indexOf('setAdminPermissions([])') > -1 && open.indexOf('setAdminPermissions([])') < open.indexOf('await fetch('),
            'la grille est vidée avant la lecture (jamais les cases de l’admin précédent)');
        assert.match(open, /permsRequestFor\.current !== adminUser\.id\) return/, 'réponse d’un autre admin ignorée');
        assert.match(page, /Chargement…/);
        assert.match(page, /Droits illisibles : fermez et rouvrez\./);
        assert.match(page, /disabled=\{permsState !== 'ready'\}/);
    });
});

void BASE_URL;
