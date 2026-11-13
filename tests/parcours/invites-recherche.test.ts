/**
 * Lot 9 ter, tâche 9t.17 (consigne 3 ; consigne 6 : « recherche hors de l'événement impossible ») — recherche dans
 * la liste des invités par le contrôleur (contrat 5.C, C.3.3 F21, C.3.4, C.3.6, 11.3 ; x12).
 *  1. 4 derniers chiffres et numéro complet sous trois formes : un groupe nom, catégorie, nombre, identifiants triés ;
 *  2. exclus : invitation réclamée, utilisée, annulée, refusée, billet acheté puis transféré vers ce numéro ;
 *  3. deux numéros de même suffixe : deux groupes ; onze invités : dix groupes et truncated ;
 *  4. recherche hors de l'événement impossible : 403 SCAN_FORBIDDEN { error, code } ; numéro invité ailleurs : rien ;
 *     propriétaire avec le périmètre par défaut (ASSIGNED_CONTROLLER) : 403 ;
 *  5. réponse sans numéro (ni complet, ni 9 chiffres, ni « +221 », ni masque) ;
 *  6. 31ᵉ recherche de l'heure : 429, texte exact, Retry-After ; un autre contrôleur n'est pas touché ;
 *  7. saisie invalide : 400 sans quota consommé ;
 *  8. audit GUEST_LIST_SEARCH sans chiffres : metadata { query_kind, groups, tickets, truncated } exactement.
 *
 * Numéros : randomSenegalPhone, sauf les invités de même suffixe du cas 3 (préfixe 75, jamais émis par
 * randomSenegalPhone ni par massHolders, suffixe tiré d'un randomSenegalPhone : aucune collision avec une autre suite).
 *
 * Rouge avant correctif (fix(9t.17), migration 20261110000008, chore(9t.17) pour la variable) : route
 * app/api/controller/scan/guests/route.ts absente (guestSearch la nomme), RPC ticket_guest_list_search absente.
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { alignQuotaWindow, assertSameQuotaWindow } from '../helpers/quota-window';
import { BASE_URL, confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, ticketRow, type RouteResult } from './acces-helpers';
import { markPhoneVerified } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { guestAdmit, guestSearch, sendInvitations } from './zones-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const SIMPLE = 'SIMPLE';
const CATEGORIES: CategorySpec[] = [
    { name: VIP, price: 20_000, total: 60, maxPerOrder: 10 },
    { name: SIMPLE, price: 5_000, total: 30, maxPerOrder: 10 },
];
const INVALID_QUERY = 'Saisissez les 4 derniers chiffres ou le numéro complet de l’invité.';

let partner: TestPartner;
let partnerB: TestPartner;

before(async () => {
    partner = await newPartner('invites-recherche');
    partnerB = await newPartner('invites-recherche-b');
});

after(async () => {
    await assertLot9terInvariants('invites-recherche');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function newEvent(owner: TestPartner, label: string): Promise<SaleEvent> {
    return createTimedEvent(owner.partnerId, `invites-recherche ${label}`, CATEGORIES);
}

async function invite(owner: TestPartner, ev: SaleEvent, phones: string[], quantity: number, names: Array<string | null>, category = VIP): Promise<void> {
    const r = await sendInvitations(owner, ev.eventId, { category_id: ev.categories[category].id, phones, quantity, guest_names: names });
    assert.equal(r.status, 200, `invitations : ${show(r)}`);
}

async function pendingTicketIds(phone: string, eventId: string): Promise<string[]> {
    const { data, error } = await service.from('ticket_transfers').select('ticket_id, tickets!inner(event_id)')
        .eq('to_phone_or_email', phone).is('from_user_id', null).eq('tickets.event_id', eventId);
    assert.equal(error, null, `transferts : ${error?.message}`);
    return (data ?? []).map((t) => String(t.ticket_id)).sort();
}

/** « 77 123 45 67 » à partir de « +221771234567 ». */
function spaced(e164: string): string {
    const d = e164.slice(4);
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

function items(r: RouteResult, what: string): Row[] {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.ok(Array.isArray(r.body.items), `${what} : items : ${show(r)}`);
    return r.body.items as Row[];
}

async function searchQuotaHits(scannerId: string): Promise<number> {
    const { data, error } = await service.from('quota_counters').select('hits').eq('scope', 'guest_list_search').eq('bucket', scannerId);
    assert.equal(error, null, `quota_counters : ${error?.message}`);
    return (data ?? []).reduce((sum, r) => sum + Number(r.hits), 0);
}

/** Appel direct de la route (en-têtes lus : Retry-After). */
async function rawSearch(user: Buyer, eventId: string, query: string): Promise<{ status: number; body: Row; retryAfter: string | null }> {
    let mod: Record<string, unknown>;
    try {
        mod = (await importModule('../../app/api/controller/scan/guests/route')) as Record<string, unknown>;
    } catch (err) {
        assert.fail(`POST /api/controller/scan/guests : route absente (9t.17) : ${err instanceof Error ? err.message : String(err)}`);
    }
    const POST = mod.POST as (req: NextRequest) => Promise<Response>;
    const res = await POST(new NextRequest(`${BASE_URL}/api/controller/scan/guests`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${user.accessToken}` }, body: JSON.stringify({ eventId, query }),
    }));
    return { status: res.status, body: (await res.json()) as Row, retryAfter: res.headers.get('retry-after') };
}

// ── 1 à 3. Résultats ───────────────────────────────────────────────────────

describe('9t.17 Liste des invités : recherche', () => {
    test('1. 4 derniers chiffres et numéro complet sous trois formes : un groupe nom, catégorie, nombre, identifiants', async () => {
        const ev = await newEvent(partner, 'formes');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-formes' });
        const phone = randomSenegalPhone('76');
        await invite(partner, ev, [phone], 2, ['Awa Diop']);
        const ids = await pendingTicketIds(phone, ev.eventId);
        assert.equal(ids.length, 2, 'deux billets en attente');
        for (const query of [phone.slice(-4), phone.slice(4), phone, spaced(phone)]) {
            const r = await guestSearch(ctrl, ev.eventId, query);
            assert.deepEqual(items(r, `recherche « ${query} »`), [{ guest_name: 'Awa Diop', category: VIP, ticket_count: 2, ticket_ids: ids }], show(r));
            assert.equal(r.body.truncated, false, show(r));
        }
    });

    test('2. exclus : invitation réclamée, utilisée, annulée, refusée, billet acheté puis transféré vers ce numéro', async () => {
        const ev = await newEvent(partner, 'exclus');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-exclus' });

        const claimedAccount = await newBuyer('rech-reclame', { firstName: 'Fatou', lastName: 'Reclamante', phoneVerified: false });
        await markPhoneVerified(claimedAccount.userId);
        await invite(partner, ev, [claimedAccount.phoneE164], 1, ['Fatou Reclamante']);

        const usedPhone = randomSenegalPhone('76');
        await invite(partner, ev, [usedPhone], 1, ['Invité entré']);
        const [usedId] = await pendingTicketIds(usedPhone, ev.eventId);
        const admitted = await guestAdmit(ctrl, ev.eventId, usedId);
        assert.equal(admitted.body.result, 'valid', `précondition : invitation utilisée : ${show(admitted)}`);

        const cancelledPhone = randomSenegalPhone('76');
        await invite(partner, ev, [cancelledPhone], 1, ['Invité annulé']);
        const [cancelledId] = await pendingTicketIds(cancelledPhone, ev.eventId);
        const cancel = await routeHandler('../../app/api/partner/events/[id]/invitations/[ticketId]/cancel/route', 'POST', 'annulation d’une invitation');
        const c = await invoke(cancel, authed(`/api/partner/events/${ev.eventId}/invitations/${cancelledId}/cancel`, 'POST', partner), routeContext({ id: ev.eventId, ticketId: cancelledId }));
        assert.equal(c.status, 200, `annulation : ${show(c)}`);

        const declining = await newBuyer('rech-refus', { firstName: 'Awa', lastName: 'Refus', phoneVerified: false });
        await invite(partner, ev, [declining.phoneE164], 1, ['Invité refusant']);
        await markPhoneVerified(declining.userId);
        const { data: tr, error: trErr } = await service.from('ticket_transfers').select('id').eq('to_phone_or_email', declining.phoneE164).eq('status', 'PENDING').single();
        assert.equal(trErr, null, `transfert à refuser : ${trErr?.message}`);
        const decline = await routeHandler('../../app/api/tickets/transfers/[id]/decline/route', 'POST', 'refus d’un transfert');
        const d = await invoke(decline, authed(`/api/tickets/transfers/${tr.id}/decline`, 'POST', declining), routeContext({ id: String(tr.id) }));
        assert.equal(d.status, 200, `refus : ${show(d)}`);

        const holder = await newBuyer('rech-porteur');
        const [paid] = (await buyConfirmed(holder, ev, [[VIP, 1]])).tickets;
        const transferPhone = randomSenegalPhone('76');
        await confirmPassword(holder, STRONG_PASSWORD);
        const transfer = await routeHandler('../../app/api/tickets/[id]/transfer/route', 'POST', 'transfert d’un billet acheté');
        const t = await invoke(transfer, authed(`/api/tickets/${paid.id}/transfer`, 'POST', holder, { recipient: transferPhone }), routeContext({ id: String(paid.id) }));
        assert.equal(t.status, 200, `transfert : ${show(t)}`);

        for (const [label, phone] of [['réclamée', claimedAccount.phoneE164], ['utilisée', usedPhone], ['annulée', cancelledPhone],
            ['refusée', declining.phoneE164], ['achetée puis transférée', transferPhone]] as Array<[string, string]>) {
            assert.deepEqual(items(await guestSearch(ctrl, ev.eventId, phone), label), [], `invitation ${label} : exclue de la liste`);
        }
        const pending = randomSenegalPhone('76');
        await invite(partner, ev, [pending], 1, ['Invité attendu']);
        assert.equal(items(await guestSearch(ctrl, ev.eventId, pending), 'témoin').length, 1, 'témoin : une invitation en attente est trouvée');
    });

    test('3. deux numéros de même suffixe : deux groupes ; onze invités : dix groupes et truncated', async () => {
        const ev = await newEvent(partner, 'suffixe');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-suffixe' });
        const suffix = randomSenegalPhone('78').slice(-4);
        const sameSuffix = (i: number): string => `+22175${String(100 + i).padStart(3, '0')}${suffix}`;
        await invite(partner, ev, [sameSuffix(0), sameSuffix(1)], 1, ['Awa Diop', 'Binta Diop']);
        const two = items(await guestSearch(ctrl, ev.eventId, suffix), 'deux numéros');
        assert.deepEqual(two.map((g) => g.guest_name), ['Awa Diop', 'Binta Diop'], `deux groupes triés par nom : ${JSON.stringify(two)}`);

        const more = Array.from({ length: 9 }, (_, i) => sameSuffix(2 + i));
        await invite(partner, ev, more, 1, more.map((_, i) => `Invité ${String.fromCharCode(67 + i)}`));
        const r = await guestSearch(ctrl, ev.eventId, suffix);
        assert.equal(items(r, 'onze invités').length, 10, show(r));
        assert.equal(r.body.truncated, true, show(r));
    });
});

// ── 4 et 5. Périmètre et confidentialité ───────────────────────────────────

describe('9t.17 Liste des invités : périmètre et confidentialité', () => {
    test('4. recherche hors de l’événement impossible (consigne 6)', async () => {
        const evA = await newEvent(partner, 'perimetre-a');
        const evB = await newEvent(partnerB, 'perimetre-b');
        const ctrlA = await newController(partner, evA.eventId, { label: 'rech-a' });
        const phoneB = randomSenegalPhone('76');
        await invite(partnerB, evB, [phoneB], 1, ['Invité de B']);

        const out = await guestSearch(ctrlA, evB.eventId, phoneB);
        assert.equal(out.status, 403, show(out));
        assert.deepEqual(out.body, { error: 'Vous n’êtes pas autorisé à consulter la liste des invités de cet événement.', code: 'SCAN_FORBIDDEN' }, show(out));
        assert.deepEqual(items(await guestSearch(ctrlA, evA.eventId, phoneB), 'numéro invité à B cherché dans A'), [], 'aucune donnée d’un autre événement');
        const owner = await guestSearch(partner, evA.eventId, phoneB.slice(-4));
        assert.equal(owner.status, 403, `propriétaire, périmètre par défaut ASSIGNED_CONTROLLER : ${show(owner)}`);
        assert.equal(owner.body.code, 'SCAN_FORBIDDEN', show(owner));
    });

    test('5. réponse sans numéro', async () => {
        const ev = await newEvent(partner, 'sans-numero');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-numero' });
        const phone = randomSenegalPhone('76');
        await invite(partner, ev, [phone], 1, ['Awa Diop']);
        for (const query of [phone.slice(-4), phone]) {
            const r = await guestSearch(ctrl, ev.eventId, query);
            assert.equal(items(r, `recherche « ${query} »`).length, 1, show(r));
            const raw = JSON.stringify(r.body);
            for (const leak of [phone, phone.slice(4), '+221', '***']) assert.ok(!raw.includes(leak), `« ${leak} » dans la réponse : ${raw}`);
        }
    });
});

// ── 6 à 8. Quota, saisie, audit ────────────────────────────────────────────

describe('9t.17 Liste des invités : quota, saisie, audit', () => {
    test('6. 31ᵉ recherche de l’heure : 429 et Retry-After ; un autre contrôleur n’est pas touché', async () => {
        const ev = await newEvent(partner, 'quota');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-quota' });
        const other = await newController(partner, ev.eventId, { label: 'rech-quota-autre' });
        const phone = randomSenegalPhone('76');
        await invite(partner, ev, [phone], 1, ['Awa Diop']);
        const win = await alignQuotaWindow(3600, 120_000);
        for (let i = 1; i <= 30; i++) {
            const r = await guestSearch(ctrl, ev.eventId, phone.slice(-4));
            assert.equal(r.status, 200, `recherche ${i} : ${show(r)}`);
        }
        const refused = await rawSearch(ctrl, ev.eventId, phone.slice(-4));
        await assertSameQuotaWindow(win, '31 recherches dans la même heure');
        assert.equal(refused.status, 429, JSON.stringify(refused.body));
        assert.equal(refused.body.code, 'GUEST_LIST_RATE_LIMITED', JSON.stringify(refused.body));
        const seconds = Number(refused.body.retry_after_seconds);
        assert.ok(Number.isInteger(seconds) && seconds > 0 && seconds <= 3600, `retry_after_seconds : ${JSON.stringify(refused.body)}`);
        assert.equal(refused.body.error, `Trop de recherches dans l’heure : réessayez dans ${Math.ceil(seconds / 60)} min.`, JSON.stringify(refused.body));
        assert.equal(refused.retryAfter, String(seconds), 'en-tête Retry-After');
        assert.equal((await guestSearch(other, ev.eventId, phone.slice(-4))).status, 200, 'un autre contrôleur n’est pas touché');
    });

    test('7. saisie invalide : 400 sans quota consommé', async () => {
        const ev = await newEvent(partner, 'saisie');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-saisie' });
        for (const query of ['123', '12345', 'abcd']) {
            const r = await guestSearch(ctrl, ev.eventId, query);
            assert.equal(r.status, 400, `« ${query} » : ${show(r)}`);
            assert.deepEqual({ code: r.body.code, error: r.body.error }, { code: 'INVALID_INPUT', error: INVALID_QUERY }, `« ${query} » : ${show(r)}`);
        }
        assert.equal(await searchQuotaHits(ctrl.userId), 0, 'aucune recherche comptée');
    });

    test('8. audit GUEST_LIST_SEARCH sans chiffres', async () => {
        const ev = await newEvent(partner, 'audit');
        const ctrl = await newController(partner, ev.eventId, { label: 'rech-audit' });
        const phone = randomSenegalPhone('76');
        await invite(partner, ev, [phone], 2, ['Awa Diop']);
        const r = await guestSearch(ctrl, ev.eventId, phone.slice(-4));
        assert.equal(items(r, 'recherche').length, 1, show(r));
        assert.equal(items(await guestSearch(ctrl, ev.eventId, phone), 'numéro complet').length, 1);
        const { data, error } = await service.from('audit_logs').select('*').eq('user_id', ctrl.userId).eq('action', 'GUEST_LIST_SEARCH').order('created_at');
        assert.equal(error, null, `audit : ${error?.message}`);
        const rows = (data ?? []) as Row[];
        assert.deepEqual(rows.map((a) => [a.user_role, a.object_type, a.object_id, a.metadata]), [
            ['CONTROLE', 'events', ev.eventId, { query_kind: 'LAST4', groups: 1, tickets: 2, truncated: false }],
            ['CONTROLE', 'events', ev.eventId, { query_kind: 'FULL', groups: 1, tickets: 2, truncated: false }],
        ], JSON.stringify(rows));
        const text = JSON.stringify(rows.map((a) => a.metadata));
        for (const leak of [phone.slice(-4), phone.slice(4), 'Awa']) assert.ok(!text.includes(leak), `audit sans « ${leak} » : ${text}`);
        assert.equal((await ticketRow((await pendingTicketIds(phone, ev.eventId))[0])).status, 'VALIDE', 'une recherche ne touche aucun billet');
    });
});
