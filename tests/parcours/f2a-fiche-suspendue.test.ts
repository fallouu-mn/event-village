/**
 * Finition 2a, 1a (sécurité) — fiche partenaire SUSPENDU : ses événements passent en lecture seule pour elle, quel que
 * soit leur statut, route ET base. Message « Votre compte organisateur est suspendu : vos événements ne sont plus
 * modifiables. Contactez le support. » suivi du contact. L'admin muni de events.write garde ses actions ; les contrôleurs
 * gardent le scan (règle A9 du lot 9 quinquies).
 *  a. Routes : chaque route d'écriture de /api/partner/events (toutes les méthodes autres que GET, liste tirée du disque)
 *     et le dépôt d'image → 403 PARTNER_SUSPENDED, texte exact puis contact ; rien ne change (événement, catégories,
 *     zones, invitations, code du régisseur, brouillon).
 *  b. Base : event_create, event_update, ticket_category_create/update/delete, event_zones_save, event_transition,
 *     event_cancel, ticket_invitation_create/cancel/guest_name_set, event_cash_refund_mark, ticket_refund_request
 *     appelées avec la partenaire suspendue pour auteur → PARTNER_SUSPENDED ; suppression du brouillon et code du
 *     régisseur écrits directement → refusés.
 *  c. Lectures gardées : fiche, zones, pilotage, export des participants.
 *  d. L'admin events.write modifie l'événement ; le contrôleur affecté scanne.
 * Rouge avant le correctif : une fiche SUSPENDU modifiait tout (la garde la laissait passer, les fonctions aussi).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController } from './acces-helpers';
import { createDraftEvent } from './cycle-helpers';
import { newAdmin } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, freeTicket, scanTicket, setFiche, show, type Reply, type Row } from '../audit/cvf1-helpers';
import { randomSenegalPhone } from './helpers';

const SUSPENDED_TEXT = 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.';
const CONTACT = /^ (Support : .+\. Aide : |Aide et contact : )https?:\/\/\S+\/aide$/;
const ROOT = path.join(process.cwd(), 'app', 'api', 'partner');
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
/** Écriture qui n'en est pas une : l'export des participants est une lecture (POST pour son corps). */
const READ_POSTS = new Set(['POST events/[id]/participants-export']);
const CATS = [{ name: 'Standard', price: 0, total: 50 }];

let P: TestPartner;
let evPub: SaleEvent;
let evDraftId: string;
let categoryId: string;
let invitationTicketId: string;
let controller: Buyer;

before(async () => {
    P = await newPartner('f2a-susp');
    evPub = await createTimedEvent(P.partnerId, 'f2a-susp-pub', CATS, { startsInHours: 1 });
    categoryId = evPub.categories.Standard.id;
    evDraftId = (await createDraftEvent(P, 'f2a-susp-draft', CATS, { startsInHours: 72 })).eventId;
    // Une invitation créée avant la suspension (pour les fonctions d'annulation et de nom de l'invité)
    const inv = await api('POST', 'partner/events/[id]/invitations', {
        token: P.accessToken, path: `/api/partner/events/${evPub.eventId}/invitations`, params: { id: evPub.eventId },
        body: { category_id: categoryId, phones: [randomSenegalPhone('77')], quantity: 1 },
    });
    assert.ok(inv.status < 300, `invitation (montage) : ${show(inv)}`);
    const { data: t } = await service.from('tickets').select('id').eq('event_id', evPub.eventId).eq('origin', 'INVITATION').limit(1).single();
    invitationTicketId = String(t!.id);
    controller = await newController(P, evPub.eventId, { label: 'f2a-susp' });
    await setFiche(P.partnerId, 'SUSPENDU');
});

after(async () => {
    await setFiche(P.partnerId, 'VALIDE');
    await assertFinition1Invariants('f2a-fiche-suspendue');
});

function writeRoutes(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name === 'route.ts') out.push(path.relative(ROOT, dir).split(path.sep).join('/'));
        }
    };
    walk(path.join(ROOT, 'events'));
    out.push('upload');
    return out.sort();
}

function concrete(rel: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const segs = rel.split('/').map((s) => {
        const m = /^\[(\w+)\]$/.exec(s);
        if (!m) return s;
        const value = m[1] === 'id' ? evPub.eventId : m[1] === 'categoryId' ? categoryId : m[1] === 'ticketId' ? invitationTicketId : randomUUID();
        params[m[1]] = value;
        return value;
    });
    return { url: `/api/partner/${segs.join('/')}`, params };
}

async function snapshot(): Promise<string> {
    const [ev, cats, zones, tickets, pin, draft] = await Promise.all([
        service.from('events').select('title, status, updated_at, image_url, latitude, longitude').eq('id', evPub.eventId).single(),
        service.from('ticket_categories').select('id, name, total_quantity, is_active').eq('event_id', evPub.eventId).order('id'),
        service.from('event_zones').select('id, name').eq('event_id', evPub.eventId).order('id'),
        service.from('tickets').select('id, status, guest_name').eq('event_id', evPub.eventId).order('id'),
        service.from('event_regisseur_pins').select('event_id').eq('event_id', evPub.eventId),
        service.from('events').select('id, status').eq('id', evDraftId).maybeSingle(),
    ]);
    return JSON.stringify([ev.data, cats.data, zones.data, tickets.data, pin.data, draft.data]);
}

function assertSuspended(r: Reply, what: string): void {
    assert.equal(r.status, 403, `${what} : statut (${show(r)})`);
    assert.equal(r.body.code, 'PARTNER_SUSPENDED', `${what} : code (${show(r)})`);
    const text = String(r.body.error ?? '');
    assert.ok(text.startsWith(SUSPENDED_TEXT), `${what} : texte (${show(r)})`);
    assert.match(text.slice(SUSPENDED_TEXT.length), CONTACT, `${what} : contact du support (${show(r)})`);
}

async function versionOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `version de ${eventId} : ${error?.message}`);
    return String(data!.updated_at);
}

async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return (data ?? {}) as Row;
}

function assertRpcSuspended(reply: Row, what: string): void {
    assert.equal(reply.ok, false, `${what} : accepté pour une fiche suspendue (${JSON.stringify(reply).slice(0, 300)})`);
    assert.equal(reply.code, 'PARTNER_SUSPENDED', `${what} : ${JSON.stringify(reply).slice(0, 300)}`);
    assert.equal(reply.message, SUSPENDED_TEXT, `${what} : texte`);
}

describe('1a. fiche SUSPENDU : routes d’écriture', () => {
    test('chaque route d’écriture de l’événement et le dépôt d’image : 403 PARTNER_SUSPENDED, rien ne change', async () => {
        const before = await snapshot();
        let calls = 0;
        for (const rel of writeRoutes()) {
            const mod = (await import(`../../app/api/partner/${rel}/route`)) as Record<string, unknown>;
            for (const method of WRITE_METHODS) {
                if (typeof mod[method] !== 'function' || READ_POSTS.has(`${method} ${rel}`)) continue;
                const { url, params } = concrete(rel);
                const r = await api(method, `partner/${rel}`, { token: P.accessToken, path: url, params, body: { title: 'Titre changé', to: 'EN_ATTENTE' } });
                console.log(`[F2A-1A] ${method} /api/partner/${rel} → ${show(r).slice(0, 160)}`);
                assertSuspended(r, `${method} ${rel}`);
                calls++;
            }
        }
        assert.ok(calls >= 15, `routes d'écriture trouvées : ${calls}`);
        assert.equal(await snapshot(), before, 'une route a modifié l’événement, ses billets, ses zones ou son brouillon');
    });
});

describe('1a. fiche SUSPENDU : la base refuse aussi', () => {
    test('fonctions d’écriture appelées avec la partenaire suspendue pour auteur : PARTNER_SUSPENDED', async () => {
        const before = await snapshot();
        const actor = P.userId;
        assertRpcSuspended(await rpc('event_update', { event_id: evPub.eventId, actor_id: actor, patch: { title: 'Titre changé' }, expected_updated_at: await versionOf(evPub.eventId) }), 'event_update');
        assertRpcSuspended(await rpc('ticket_category_create', { event_id: evPub.eventId, actor_id: actor, category: { name: 'Nouvelle', price: 0, total_quantity: 10 } }), 'ticket_category_create');
        assertRpcSuspended(await rpc('ticket_category_update', { event_id: evPub.eventId, actor_id: actor, category_id: categoryId, patch: { total_quantity: 99 } }), 'ticket_category_update');
        assertRpcSuspended(await rpc('ticket_category_delete', { event_id: evPub.eventId, actor_id: actor, category_id: categoryId }), 'ticket_category_delete');
        assertRpcSuspended(await rpc('event_zones_save', { event_id: evPub.eventId, actor_id: actor, zones: [] }), 'event_zones_save');
        assertRpcSuspended(await rpc('event_transition', { event_id: evDraftId, actor_id: actor, to_status: 'EN_ATTENTE' }), 'event_transition (brouillon)');
        assertRpcSuspended(await rpc('event_transition', { event_id: evPub.eventId, actor_id: actor, to_status: 'VALIDE' }), 'event_transition (publié)');
        assertRpcSuspended(await rpc('event_cancel', { event_id: evPub.eventId, actor_id: actor, confirm_title: 'x', public_notice: 'Annulé.', internal_reason: 'essai' }), 'event_cancel');
        assertRpcSuspended(await rpc('ticket_invitation_create', { event_id: evPub.eventId, actor_id: actor, category_id: categoryId, quantity: 1 }), 'ticket_invitation_create');
        assertRpcSuspended(await rpc('ticket_invitation_cancel', { event_id: evPub.eventId, actor_id: actor, ticket_id: invitationTicketId }), 'ticket_invitation_cancel');
        assertRpcSuspended(await rpc('ticket_invitation_guest_name_set', { event_id: evPub.eventId, actor_id: actor, ticket_id: invitationTicketId, guest_name: 'Nom changé' }), 'ticket_invitation_guest_name_set');
        assertRpcSuspended(await rpc('event_cash_refund_mark', { event_id: evPub.eventId, actor_id: actor, payment_id: randomUUID(), note: 'essai' }), 'event_cash_refund_mark');
        assertRpcSuspended(await rpc('event_create', { actor_id: actor, event: { title: 'Nouveau', category: 'Concert' } }), 'event_create');
        const { data: refund, error: refundErr } = await service.rpc('ticket_refund_request', { p_ticket_id: invitationTicketId, p_actor: actor, p_reason: 'essai' });
        assert.equal(refundErr, null, refundErr?.message);
        assertRpcSuspended((refund ?? {}) as Row, 'ticket_refund_request');

        const { error: delErr } = await service.from('events').delete().eq('id', evDraftId);
        console.log(`[F2A-1A] suppression directe du brouillon → ${delErr ? `refus ${delErr.code} ${delErr.message}` : 'ACCEPTÉE'}`);
        assert.ok(delErr, 'brouillon d’une fiche suspendue supprimé');
        assert.ok(delErr.message.startsWith(SUSPENDED_TEXT), delErr.message);
        const { error: pinErr } = await service.from('event_regisseur_pins').upsert({ event_id: evPub.eventId, pin_hash: 'x', pin_salt: 'y' }, { onConflict: 'event_id' });
        console.log(`[F2A-1A] code du régisseur écrit directement → ${pinErr ? `refus ${pinErr.code} ${pinErr.message}` : 'ACCEPTÉ'}`);
        assert.ok(pinErr, 'code du régisseur écrit pour une fiche suspendue');
        assert.ok(pinErr.message.startsWith(SUSPENDED_TEXT), pinErr.message);
        assert.equal(await snapshot(), before, 'la base a modifié l’événement, ses billets, ses zones ou son brouillon');
    });
});

describe('1a. fiche SUSPENDU : lecture gardée, admin et contrôleurs inchangés', () => {
    test('la partenaire lit sa fiche, ses zones, son pilotage et exporte ses participants', async () => {
        const reads: Array<[string, string, string, Row | undefined]> = [
            ['GET', 'partner/events/[id]', `/api/partner/events/${evPub.eventId}`, undefined],
            ['GET', 'partner/events/[id]/zones', `/api/partner/events/${evPub.eventId}/zones`, undefined],
            ['GET', 'partner/events/[id]/pilotage/overview', `/api/partner/events/${evPub.eventId}/pilotage/overview`, undefined],
            ['POST', 'partner/events/[id]/participants-export', `/api/partner/events/${evPub.eventId}/participants-export`, { includeContacts: false }],
        ];
        for (const [method, rel, url, body] of reads) {
            const r = await api(method, rel, { token: P.accessToken, path: url, params: { id: evPub.eventId }, body });
            assert.notEqual(r.body.code, 'PARTNER_SUSPENDED', `${method} ${rel} refusée : ${show(r)}`);
            assert.ok(r.status < 400, `${method} ${rel} : ${show(r)}`);
        }
    });

    test('l’admin events.write modifie l’événement ; le contrôleur affecté scanne', async () => {
        const admin = await newAdmin('f2a-susp-admin', ['events.write']);
        const reply = await rpc('event_update', { event_id: evPub.eventId, actor_id: admin.userId, patch: { title: 'Titre corrigé par l’administration' }, expected_updated_at: await versionOf(evPub.eventId) });
        assert.equal(reply.ok, true, `admin events.write refusé : ${JSON.stringify(reply).slice(0, 300)}`);
        const holder = await newBuyer('f2a-susp-porteur');
        const t = await freeTicket(evPub, holder);
        const sc = await scanTicket(controller, evPub.eventId, t.id);
        assert.equal(sc.status, 200, `scan du contrôleur : ${show(sc)}`);
        assert.equal(sc.body.result, 'valid', `scan du contrôleur : ${show(sc)}`);
    });
});
