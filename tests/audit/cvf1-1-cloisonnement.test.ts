/**
 * Contre-vérification de la finition 1, attaque 1 — cloisonnement entre deux partenaires.
 *
 * La partenaire A (fiche VALIDE, session valable) vise l'équipe, les invitations, les portes et les événements de la
 * partenaire B :
 *  a. lectures par les routes (GET team, team/all, team/[eventId]) ;
 *  b. écritures d'équipe : réglages, porte, point d'entrée, droit d'encaisser, affectations, renvoi, annulation,
 *     effacement d'invitation, « Retirer de cet événement », « Retirer de l'équipe », retrait par la liste, invitation sur
 *     un événement de B ; puis une porte de B posée sur un événement de A ;
 *  c. guichet, devis, caisse, scan « Toutes les portes », recherche d'invités et saisie manuelle sur l'événement de B ;
 *  d. REST de Supabase (event_controllers, controller_invitations, partner_controllers, controller_shifts, users) et
 *     fonctions RPC appelées avec le jeton de A puis sans jeton (anon).
 * Une attaque réussie = un 2xx qui rend une donnée de B, ou un effet chez B. Chaque essai est écrit en sortie brute
 * `[CVF1-1]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newController } from '../parcours/acces-helpers';
import { createZonedEvent, type ZonedEvent } from '../parcours/zones-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    FREE, PAID, CATS, anonClient, api, assignmentOf, freeEvent, freeTicket, invitationRow, inviteExisting, leaks, ok2xx,
    restRows, restRpc, rolesOf, scanTicket, show, smsCount, ticketStatus, userClient, type Reply, type Row,
} from './cvf1-helpers';

let A: TestPartner;
let B: TestPartner;
let evA: SaleEvent;
let evAz: ZonedEvent;
let evB: ZonedEvent;
let gateB: string;
let gateA: string;
let cA: Buyer;
let cB: Buyer;
let hB: Buyer;
let invB: string;
let assignB: Row;
let ticketB: { id: string; number: string };

before(async () => {
    A = await newPartner('cvf1-iso-a');
    B = await newPartner('cvf1-iso-b');
    evA = await freeEvent(A, 'iso-a', { startsInHours: 1 });
    evAz = await createZonedEvent(A, 'cvf1-iso-az', CATS, [{ name: 'Pelouse', kind: 'ENTREE', admits: [FREE, PAID], gates: ['Porte A1'] }], { startsInHours: 1 });
    evB = await createZonedEvent(B, 'cvf1-iso-b', CATS, [{ name: 'Carré', kind: 'ENTREE', admits: [FREE, PAID], gates: ['Porte B1'] }], { startsInHours: 1 });
    gateA = evAz.zones['Pelouse'].gates['Porte A1'];
    gateB = evB.zones['Carré'].gates['Porte B1'];
    cA = await newController(A, evAz.eventId, { label: 'cvf1-iso-ca' });
    const { error: gA } = await service.from('event_controllers').update({ gate_id: gateA, entry_point: 'Porte A1' }).eq('event_id', evAz.eventId).eq('user_id', cA.userId);
    assert.equal(gA, null, `porte de cA (montage) : ${gA?.message}`);
    cB = await newController(B, evB.eventId, { canAcceptCash: true, label: 'cvf1-iso-cb' });
    const { error: gB } = await service.from('event_controllers').update({ gate_id: gateB, entry_point: 'Porte B1' }).eq('event_id', evB.eventId).eq('user_id', cB.userId);
    assert.equal(gB, null, `porte de cB (montage) : ${gB?.message}`);
    assignB = (await assignmentOf(evB.eventId, cB.userId))!;
    hB = await newBuyer('cvf1-iso-hb', { firstName: 'Khady', lastName: 'Sarr' });
    invB = await inviteExisting(B, [evB.eventId], hB);
    const buyer = await newBuyer('cvf1-iso-acheteur', { firstName: 'Mariama', lastName: 'Diop' });
    ticketB = await freeTicket(evB, buyer);
});

after(async () => {
    await assertFinition1Invariants('cvf1-1-cloisonnement');
});

/** Données de B qui ne doivent jamais sortir chez A. */
function bSecrets(): string[] {
    return [evB.eventId, gateB, cB.userId, cB.phoneE164, cB.phone9, hB.userId, hB.phoneE164, hB.phone9, invB, String(assignB.id), B.partnerId];
}

async function assertBUnchanged(where: string): Promise<void> {
    const now = await assignmentOf(evB.eventId, cB.userId);
    assert.ok(now, `${where} : l'affectation de cB chez B a disparu`);
    for (const k of ['gate_id', 'entry_point', 'can_accept_cash', 'gate_change_allowed']) {
        assert.deepEqual(now[k], assignB[k], `${where} : ${k} de cB chez B modifié (${JSON.stringify(assignB[k])} → ${JSON.stringify(now[k])})`);
    }
    assert.ok((await rolesOf(cB.userId)).includes('CONTROLEUR'), `${where} : rôle CONTROLEUR de cB retiré`);
    const inv = await invitationRow(invB);
    assert.equal(inv.status, 'PENDING', `${where} : invitation de B passée à ${String(inv.status)}`);
    assert.equal(Number(inv.send_count), 1, `${where} : invitation de B renvoyée (send_count ${String(inv.send_count)})`);
    assert.equal(inv.cleared_at, null, `${where} : invitation de B effacée`);
    assert.equal(await smsCount('CONTROLLER_INVITATION', hB.userId), 1, `${where} : SMS d'invitation de plus vers le titulaire de B`);
}

function record(breaches: string[], what: string, r: Reply, secrets: string[] = bSecrets()): void {
    const found = leaks(JSON.stringify(r.body), secrets);
    const line = `${what} → ${show(r)}${found.length ? ` ; données de B : ${found.join(', ')}` : ''}`;
    console.log(`[CVF1-1] ${line}`);
    if (ok2xx(r) && found.length > 0) breaches.push(line);
}

function recordWrite(breaches: string[], what: string, r: Reply): void {
    console.log(`[CVF1-1] ${what} → ${show(r)}`);
    if (ok2xx(r)) breaches.push(`${what} → ${show(r)}`);
}

describe('a. lectures de l’équipe de B par les routes', () => {
    test('GET team (eventId, partnerId), team/all, team/[eventId] : aucune donnée de B', async () => {
        const breaches: string[] = [];
        const t = A.accessToken;
        record(breaches, 'GET /api/partner/team?eventId=<B>', await api('GET', 'partner/team', { token: t, path: `/api/partner/team?eventId=${evB.eventId}` }));
        record(breaches, 'GET /api/partner/team?partnerId=<B>', await api('GET', 'partner/team', { token: t, path: `/api/partner/team?partnerId=${B.partnerId}` }), bSecrets().filter((s) => s !== B.partnerId));
        record(breaches, 'GET /api/partner/team/all?partnerId=<B>', await api('GET', 'partner/team/all', { token: t, path: `/api/partner/team/all?partnerId=${B.partnerId}` }), bSecrets().filter((s) => s !== B.partnerId));
        record(breaches, 'GET /api/partner/team/[eventId=B]', await api('GET', 'partner/team/[eventId]', { token: t, path: `/api/partner/team/${evB.eventId}`, params: { eventId: evB.eventId } }));
        record(breaches, 'GET /api/partner/team/[eventId=B]?partnerId=<B>', await api('GET', 'partner/team/[eventId]', { token: t, path: `/api/partner/team/${evB.eventId}?partnerId=${B.partnerId}`, params: { eventId: evB.eventId } }));
        assert.deepEqual(breaches, [], `A lit des données de l'équipe de B :\n${breaches.join('\n')}`);
    });
});

describe('b. écritures sur l’équipe et les invitations de B', () => {
    test('réglages, porte, point d’entrée, espèces, affectations, invitations, retraits : refusés, rien ne change chez B', async () => {
        const breaches: string[] = [];
        const t = A.accessToken;
        recordWrite(breaches, 'PATCH settings (événement de B, contrôleur de B)', await api('PATCH', 'partner/team/settings', {
            token: t, body: { eventId: evB.eventId, controllerId: cB.userId, gateId: null, canAcceptCash: false },
        }));
        recordWrite(breaches, 'PATCH settings (événement de A, contrôleur de B)', await api('PATCH', 'partner/team/settings', {
            token: t, body: { eventId: evA.eventId, controllerId: cB.userId, entryPoint: 'Porte A', canAcceptCash: true },
        }));
        recordWrite(breaches, 'PATCH gate (événement de B)', await api('PATCH', 'partner/team/gate', {
            token: t, body: { eventId: evB.eventId, controllerId: cB.userId, gateId: null },
        }));
        recordWrite(breaches, 'PATCH entry-point (événement de B)', await api('PATCH', 'partner/team/entry-point', {
            token: t, body: { eventId: evB.eventId, controllerId: cB.userId, entryPoint: 'Sortie' },
        }));
        recordWrite(breaches, 'PATCH assignments/[id] (affectation de B)', await api('PATCH', 'partner/team/assignments/[id]', {
            token: t, path: `/api/partner/team/assignments/${String(assignB.id)}`, params: { id: String(assignB.id) }, body: { canAcceptCash: false },
        }));
        recordWrite(breaches, 'PATCH assignments (contrôleur de B sur l’événement de B)', await api('PATCH', 'partner/team/assignments', {
            token: t, body: { controllerId: cB.userId, eventIds: [evB.eventId] },
        }));
        // Liste vide : « synchroniser » le contrôleur de B à aucun événement de A ne doit pas toucher à ses affectations chez B
        const sync = await api('PATCH', 'partner/team/assignments', { token: t, body: { controllerId: cB.userId, eventIds: [] } });
        console.log(`[CVF1-1] PATCH assignments (contrôleur de B, liste vide) → ${show(sync)}`);
        for (const [route, method, path] of [
            ['partner/team/invitations/[id]/resend', 'POST', `/api/partner/team/invitations/${invB}/resend`],
            ['partner/team/invitations/[id]/cancel', 'POST', `/api/partner/team/invitations/${invB}/cancel`],
            ['partner/team/invitations/[id]', 'DELETE', `/api/partner/team/invitations/${invB}`],
        ] as const) {
            recordWrite(breaches, `${method} ${path} (invitation de B)`, await api(method, route, {
                token: t, path, params: { id: invB }, body: { actor_id: B.userId, partner_id: B.partnerId, reason: 'Essai de la partenaire A' },
            }));
        }
        recordWrite(breaches, 'DELETE team/controller/[cB]?partnerId=<B>', await api('DELETE', 'partner/team/controller/[controllerId]', {
            token: t, path: `/api/partner/team/controller/${cB.userId}?partnerId=${B.partnerId}`, params: { controllerId: cB.userId },
        }));
        recordWrite(breaches, 'DELETE team/controller/[cB]', await api('DELETE', 'partner/team/controller/[controllerId]', {
            token: t, path: `/api/partner/team/controller/${cB.userId}`, params: { controllerId: cB.userId },
        }));
        recordWrite(breaches, 'DELETE team/[evB]?assignmentId=<B>', await api('DELETE', 'partner/team/[eventId]', {
            token: t, path: `/api/partner/team/${evB.eventId}?assignmentId=${String(assignB.id)}`, params: { eventId: evB.eventId },
        }));
        const viaList = await api('DELETE', 'partner/team/all', { token: t, path: `/api/partner/team/all?controllerId=${cB.userId}&partnerId=${B.partnerId}` });
        console.log(`[CVF1-1] DELETE team/all?controllerId=<cB>&partnerId=<B> → ${show(viaList)}`);
        const fresh = await newBuyer('cvf1-iso-neuf');
        recordWrite(breaches, 'POST invite (événement de B)', await api('POST', 'partner/team/invite', {
            token: t, body: { event_ids: [evB.eventId], phone: fresh.phoneE164, confirm_promotion: true },
        }));
        recordWrite(breaches, 'POST invite (événements de A et de B)', await api('POST', 'partner/team/invite', {
            token: t, body: { event_ids: [evA.eventId, evB.eventId], phone: fresh.phoneE164, confirm_promotion: true },
        }));
        const { data: foreignInv } = await service.from('controller_invitations').select('id, partner_id, assignments').eq('user_id', fresh.userId);
        console.log(`[CVF1-1] invitations créées pour le numéro neuf : ${JSON.stringify(foreignInv ?? [])}`);
        if ((foreignInv ?? []).length > 0) breaches.push(`invitation créée sur un événement de B : ${JSON.stringify(foreignInv)}`);
        if (await assignmentOf(evB.eventId, fresh.userId)) breaches.push('compte affecté à un événement de B par A');
        if (await assignmentOf(evA.eventId, cB.userId)) breaches.push('contrôleur de B affecté à un événement de A sans son accord');
        assert.deepEqual(breaches, [], `écritures de A acceptées chez B :\n${breaches.join('\n')}`);
        await assertBUnchanged('après les écritures de A');
        // Le contrôleur de B n'a pas été déconnecté par A
        const still = await api('GET', 'controller/assignments', { token: cB.accessToken });
        assert.equal(still.status, 200, `session de cB révoquée par une action de A : ${show(still)}`);
    });

    test('une porte de B posée sur un événement de A : refusée, la porte de cA ne change pas', async () => {
        const r = await api('PATCH', 'partner/team/settings', {
            token: A.accessToken, body: { eventId: evAz.eventId, controllerId: cA.userId, gateId: gateB, canAcceptCash: false },
        });
        console.log(`[CVF1-1] PATCH settings (porte de B sur l'événement de A) → ${show(r)}`);
        assert.ok(!ok2xx(r), `porte d'un autre événement acceptée : ${show(r)}`);
        const now = await assignmentOf(evAz.eventId, cA.userId);
        assert.equal(now?.gate_id, gateA, `porte de cA modifiée : ${JSON.stringify(now)}`);
        const g = await api('PATCH', 'partner/team/gate', { token: A.accessToken, body: { eventId: evAz.eventId, controllerId: cA.userId, gateId: gateB } });
        console.log(`[CVF1-1] PATCH gate (porte de B sur l'événement de A) → ${show(g)}`);
        assert.ok(!ok2xx(g), `porte d'un autre événement acceptée par /gate : ${show(g)}`);
        assert.equal((await assignmentOf(evAz.eventId, cA.userId))?.gate_id, gateA, 'porte de cA modifiée par /gate');
    });
});

describe('c. guichet, caisse et scan sur l’événement de B', () => {
    test('guichet, devis, vente, caisse, scan « Toutes les portes », invités, saisie manuelle : rien chez B', async () => {
        const breaches: string[] = [];
        const t = A.accessToken;
        const items = [{ categoryId: evB.categories[PAID].id, quantity: 1 }];
        record(breaches, 'GET counter-sale (B)', await api('GET', 'controller/counter-sale', { token: t, path: `/api/controller/counter-sale?event_id=${evB.eventId}` }), bSecrets());
        const quote = await api('POST', 'controller/counter-sale/quote', { token: t, body: { eventId: evB.eventId, items } });
        recordWrite(breaches, 'POST counter-sale/quote (B)', quote);
        recordWrite(breaches, 'POST counter-sale (B)', await api('POST', 'controller/counter-sale', {
            token: t, body: { eventId: evB.eventId, items }, headers: { 'idempotency-key': randomUUID() },
        }));
        recordWrite(breaches, 'POST shifts/open (B)', await api('POST', 'controller/shifts/open', {
            token: t, body: { eventId: evB.eventId, openingFloat: 0, regisseurPin: '246813' },
        }));
        const sc = await scanTicket(A, evB.eventId, ticketB.id, { gateId: null });
        console.log(`[CVF1-1] scan « Toutes les portes » (B) → ${show(sc)}`);
        if (sc.body.result === 'valid') breaches.push(`scan accepté chez B : ${show(sc)}`);
        recordWrite(breaches, 'POST scan/guests (B)', await api('POST', 'controller/scan/guests', { token: t, body: { eventId: evB.eventId, query: '1234' } }));
        recordWrite(breaches, 'POST scan/lookup (B)', await api('POST', 'controller/scan/lookup', { token: t, body: { eventId: evB.eventId, manualTicketNumber: ticketB.number, gateId: null } }));
        const manual = await api('POST', 'controller/scan', {
            token: t, body: { eventId: evB.eventId, manualTicketNumber: ticketB.number, identityVerified: true, gateId: null }, headers: { 'idempotency-key': randomUUID() },
        });
        console.log(`[CVF1-1] saisie manuelle (B) → ${show(manual)}`);
        if (manual.body.result === 'valid') breaches.push(`saisie manuelle acceptée chez B : ${show(manual)}`);
        assert.equal(await ticketStatus(ticketB.id), 'VALIDE', 'billet de B composté par A');
        const { data: pays } = await service.from('payments').select('id').eq('event_id', evB.eventId);
        if ((pays ?? []).length > 0) breaches.push(`vente enregistrée chez B : ${JSON.stringify(pays)}`);
        const { data: shifts } = await service.from('controller_shifts').select('id').eq('event_id', evB.eventId).eq('controller_id', A.userId);
        if ((shifts ?? []).length > 0) breaches.push(`caisse ouverte par A chez B : ${JSON.stringify(shifts)}`);
        assert.deepEqual(breaches, [], `A agit sur l'événement de B :\n${breaches.join('\n')}`);
    });
});

describe('d. REST de Supabase et fonctions RPC, avec le jeton de A puis anonyme', () => {
    test('tables de l’équipe : aucune ligne de B', async () => {
        const breaches: string[] = [];
        for (const [label, client] of [['jeton de A', userClient(A.accessToken)], ['anon', anonClient()]] as const) {
            for (const [table, filter] of [
                ['event_controllers', { event_id: evB.eventId }],
                ['controller_invitations', { partner_id: B.partnerId }],
                ['partner_controllers', { partner_id: B.partnerId }],
                ['controller_shifts', { event_id: evB.eventId }],
                ['users', { id: cB.userId }],
                ['event_regisseur_pins', { event_id: evB.eventId }],
            ] as const) {
                const r = await restRows(client, table, filter);
                console.log(`[CVF1-1] REST ${label} ${table} ${JSON.stringify(filter)} → ${r.rows.length} ligne(s)${r.error ? ` ; refus ${r.error}` : ''}`);
                if (r.rows.length > 0) breaches.push(`${label} lit ${r.rows.length} ligne(s) de ${table} chez B : ${JSON.stringify(r.rows).slice(0, 300)}`);
            }
        }
        assert.deepEqual(breaches, [], `lectures REST de l'équipe de B :\n${breaches.join('\n')}`);
    });

    test('fonctions de la finition appelées par la REST : jamais exécutées, aucun effet chez B', async () => {
        const breaches: string[] = [];
        const calls: Array<[string, Row]> = [
            ['partner_team_view', { p: { partner_id: B.partnerId } }],
            ['controller_invitation_cancel', { p: { actor_id: B.userId, invitation_id: invB } }],
            ['controller_invitation_resend', { p: { actor_id: B.userId, invitation_id: invB } }],
            ['controller_invitation_clear', { p: { actor_id: B.userId, invitation_id: invB } }],
            ['controller_invitation_respond', { p: { actor_id: hB.userId, invitation_id: invB, accept: true } }],
            ['controller_invitation_create', { p: { actor_id: A.userId, partner_id: B.partnerId, user_id: hB.userId, assignments: [{ event_id: evB.eventId }] } }],
            ['event_controller_settings_set', { p: { actor_id: B.userId, event_id: evB.eventId, controller_id: cB.userId, can_accept_cash: false } }],
            ['controller_evenings', { p: { user_id: cB.userId } }],
            ['controller_scanner_status', { p: { user_id: cB.userId } }],
            ['controller_invitations_expire_due', {}],
            ['ticket_guest_list_search', { p: { scanner_id: B.userId, event_id: evB.eventId, query: '1234', limits: { per_scanner_hour: 30 } } }],
            ['counter_sale_quote', { p: { seller_id: B.userId, event_id: evB.eventId, items: [{ category_id: evB.categories[PAID].id, quantity: 1 }] } }],
            ['controller_evening_figures', { p_user: cB.userId, p_event: evB.eventId }],
            ['team_gate_categories', { p_gate: gateB }],
            ['scan_gate_context', { p_scanner: B.userId, p_event: evB.eventId, p_claimed: null, p_claimed_given: true }],
            ['scan_scanner_authorized', { p_scanner: B.userId, p_event: evB.eventId }],
        ];
        for (const [label, client] of [['jeton de A', userClient(A.accessToken)], ['anon', anonClient()]] as const) {
            for (const [fn, args] of calls) {
                const r = await restRpc(client, fn, args);
                console.log(`[CVF1-1] RPC ${label} ${fn} → ${r.ok ? `EXÉCUTÉE ${JSON.stringify(r.data).slice(0, 200)}` : `refus ${r.error}`}`);
                if (r.ok) breaches.push(`${label} exécute ${fn} : ${JSON.stringify(r.data).slice(0, 200)}`);
            }
        }
        assert.deepEqual(breaches, [], `fonctions exécutables par la REST :\n${breaches.join('\n')}`);
        await assertBUnchanged('après les appels RPC');
    });
});
