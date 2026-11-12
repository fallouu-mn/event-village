/**
 * Lot 9 ter, tâche 9t.10 (consigne 0.8, R95 reste ; contrat 5.B 9t.10, B.2.2 (4) F13 et (5) F14, 11.1 et 11.2 N2, N3, M1,
 * décisions B-D10 à B-D12) — cloche aux admins events.read :
 *  - publication VALIDE → PUBLIE par l'organisatrice : ADMIN_EVENT_PUBLISHED (in-app et email, aucun SMS), clé
 *    `ADMIN_EVENT_PUBLISHED:<historique>:<admin>` ; retrait de la validation EN_ATTENTE → BROUILLON par l'organisatrice :
 *    ADMIN_EVENT_WITHDRAWN ; rien quand c'est un admin qui agit ;
 *  - prix, vente en ligne ou au guichet changés après validation (VALIDE, PUBLIE, SUSPENDU) : ADMIN_EVENT_CHANGED parties
 *    PRICE et CHANNELS, une alerte par enregistrement, clé `…:catupd<catégorie>:tx<txid>` distincte de celle de l'ajout
 *    `…:cat<catégorie>` ; rien pour un brouillon, une quantité seule ou une vente.
 * Destinataires : SUPERADMIN et ADMIN actifs munis de events.read (notif_enqueue_admins) ; un admin sans la permission ne
 * reçoit rien. Lignes lues par destinataire et par événement ; contenus vérifiés sur la notification in-app écrite par
 * l'envoyeur (lignes de l'admin seulement), espaces insécables et apostrophes ramenés à leur forme simple.
 *
 * Rouge avant correctif (S-M : M04 registre, M06 F13 et F14, catalogue adminChangeList) : aucune branche ne prévient les
 * admins d'une publication ou d'un retrait par la partenaire (M/20261109000009:149-169) ; aucun trigger sur price,
 * sale_online, sale_counter (seul l'ajout alerte, :1090-1179) : cas 1, 3, 4, 5, 7 échouent sur l'absence de ligne.
 * Témoins 2 et 6 verts aujourd'hui. after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { formatFcfa } from '../../lib/format';
import { routeContext } from './helpers';
import { newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, eventHistory, rpcTransition, type DraftEvent } from './cycle-helpers';
import { flushNotifications, outboxRows, type OutboxRow, type TestAdmin } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';
import type { RouteResult } from './acces-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const CATEGORIES: CategorySpec[] = [{ name: VIP, price: 10_000, total: 40 }];
const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';
const CATEGORIES_ROUTE = '../../app/api/partner/events/[id]/categories/route';

let partner: TestPartner;
let company: string;
let reader: TestAdmin;
let bare: TestAdmin;
let superadmin: string;

before(async () => {
    partner = await newPartner('msg-admin9t');
    const { data, error } = await service.from('partners').select('company_name').eq('id', partner.partnerId).single();
    assert.equal(error, null, `société de la partenaire : ${error?.message}`);
    company = String(data.company_name);
    reader = await newAdminWith(['events.read'], { label: 'adm9t-lecteur' });
    bare = await newAdminWith([], { label: 'adm9t-sansperm' });
    superadmin = await superadminId();
});

after(async () => {
    await assertLot9terInvariants('messages-admin-9ter');
});

// ── Outils ─────────────────────────────────────────────────────────────────

function shortTitle(prefix: string): string {
    return `${prefix} ${randomBytes(3).toString('hex')}`;
}

async function draft(label: string): Promise<DraftEvent> {
    return createDraftEvent(partner, `adm9t ${label}`, CATEGORIES, { title: shortTitle(label), startsInHours: 96 });
}

function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

function brief(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.recipient_user_id, r.group_key, r.status]));
}

async function rowsFor(type: string, userId: string, eventId: string): Promise<OutboxRow[]> {
    return outboxRows({ type, userId, eventId });
}

/** Envoie les lignes in-app données puis rend le titre et le contenu de la notification écrite (contenu normalisé). */
async function deliveredInApp(rows: OutboxRow[], userId: string, title: string): Promise<Array<{ title: string; content: string }>> {
    const inApp = rows.filter((r) => r.channel === 'IN_APP');
    assert.ok(inApp.length > 0, `ligne in-app : ${brief(rows)}`);
    await flushNotifications({ ids: inApp.map((r) => r.id) });
    const { data, error } = await service.from('notifications').select('title, content').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return ((data ?? []) as Row[]).map((n) => ({ title: norm(String(n.title)), content: norm(String(n.content)) }))
        .filter((n) => n.content.includes(`« ${title} »`));
}

async function patchCategory(eventId: string, categoryId: string, body: Row): Promise<RouteResult> {
    const handler = await routeHandler(CATEGORY_ROUTE, 'PATCH', 'PATCH /api/partner/events/[id]/categories/[categoryId]');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/categories/${categoryId}`, 'PATCH', partner.accessToken, body),
        routeContext({ id: eventId, categoryId }));
}

async function patchOk(eventId: string, categoryId: string, body: Row, what: string): Promise<void> {
    const res = await patchCategory(eventId, categoryId, body);
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
}

function money(n: number): string {
    return norm(formatFcfa(n));
}

/** Clés d'alerte distinctes (une par enregistrement et par admin). */
function groups(rows: OutboxRow[]): string[] {
    return Array.from(new Set(rows.map((r) => r.group_key))).sort();
}

describe('9t.10 (R95) : publication et retrait par l\'organisatrice', () => {
    test('publication par l\'organisatrice : ADMIN_EVENT_PUBLISHED au lecteur et au SUPERADMIN (in-app, email), rien à l\'admin sans permission, aucun SMS', async () => {
        const ev = await draft('Publie');
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const step = (await eventHistory(ev.eventId)).find((h) => h.old_status === 'VALIDE' && h.new_status === 'PUBLIE');
        assert.ok(step, 'historique VALIDE → PUBLIE');
        assert.equal(step.actor_role, 'PARTENAIRE', 'publication par la partenaire');

        const mine = await rowsFor('ADMIN_EVENT_PUBLISHED', reader.userId, ev.eventId);
        assert.deepEqual(mine.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP'], `lecteur events.read : in-app et email : ${brief(mine)}`);
        assert.ok(mine.every((r) => r.group_key === `ADMIN_EVENT_PUBLISHED:${step.id}:${reader.userId}`), `clé <type>:<historique>:<admin> : ${brief(mine)}`);
        const sa = await rowsFor('ADMIN_EVENT_PUBLISHED', superadmin, ev.eventId);
        assert.deepEqual(sa.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP'], `SUPERADMIN : ${brief(sa)}`);
        assert.deepEqual(await rowsFor('ADMIN_EVENT_PUBLISHED', bare.userId, ev.eventId), [], 'admin sans events.read : rien');
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_PUBLISHED', eventId: ev.eventId, channel: 'SMS' }), [], 'aucun SMS');

        assert.deepEqual(await deliveredInApp(mine, reader.userId, ev.title), [{
            title: 'Événement publié par l\'organisateur',
            content: `« ${ev.title} » de ${company} est publié par l'organisateur : sa page publique est en ligne.`,
        }], 'contenu exact (11.2 N2)');
    });

    test('témoin : publication par un admin : aucune ADMIN_EVENT_PUBLISHED, EVENT_PUBLISHED_BY_ADMIN inchangé', async () => {
        const ev = await draft('Publie admin');
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId, publishedBy: 'ADMIN' });
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_PUBLISHED', eventId: ev.eventId }), [], 'aucune alerte de publication par l\'organisatrice');
        const own = await outboxRows({ type: 'EVENT_PUBLISHED_BY_ADMIN', eventId: ev.eventId, userId: partner.userId });
        assert.ok(own.length > 0, `EVENT_PUBLISHED_BY_ADMIN à la propriétaire : ${brief(own)}`);
    });

    test('retrait de la validation par l\'organisatrice : ADMIN_EVENT_WITHDRAWN ; témoin : refus par l\'admin → EVENT_REJECTED seul', async () => {
        const ev = await draft('Retire');
        assertRpcOk(await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE'), 'soumission');
        assertRpcOk(await rpcTransition(ev.eventId, partner.userId, 'BROUILLON'), 'retrait de la validation par la partenaire');
        const mine = await rowsFor('ADMIN_EVENT_WITHDRAWN', reader.userId, ev.eventId);
        assert.deepEqual(mine.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP'], `lecteur events.read : ${brief(mine)}`);
        assert.deepEqual(await rowsFor('ADMIN_EVENT_WITHDRAWN', bare.userId, ev.eventId), [], 'admin sans events.read : rien');
        assert.deepEqual(await deliveredInApp(mine, reader.userId, ev.title), [{
            title: 'Soumission retirée par l\'organisateur',
            content: `« ${ev.title} » de ${company} est retiré de la validation par l'organisateur : il n'attend plus votre examen.`,
        }], 'contenu exact (11.2 N3)');

        const refused = await draft('Refuse');
        assertRpcOk(await rpcTransition(refused.eventId, partner.userId, 'EN_ATTENTE'), 'soumission');
        assertRpcOk(await rpcTransition(refused.eventId, superadmin, 'BROUILLON', 'Affiche illisible, test 9 ter'), 'refus par l\'admin');
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_WITHDRAWN', eventId: refused.eventId }), [], 'refus par l\'admin : aucune ADMIN_EVENT_WITHDRAWN');
        const rejected = await outboxRows({ type: 'EVENT_REJECTED', eventId: refused.eventId, userId: partner.userId });
        assert.ok(rejected.length > 0, `EVENT_REJECTED à la propriétaire : ${brief(rejected)}`);
    });
});

describe('9t.10 (R95) : prix et canaux changés après validation', () => {
    test('prix changé sur un PUBLIE : une alerte ADMIN_EVENT_CHANGED partie PRICE par admin, données et contenu exacts', async () => {
        const ev = await draft('Prix');
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const cat = ev.categories[VIP].id;
        await patchOk(ev.eventId, cat, { price: 15_000 }, 'prix de 10 000 à 15 000');

        const mine = (await rowsFor('ADMIN_EVENT_CHANGED', reader.userId, ev.eventId)).filter((r) => r.group_key.includes(`:catupd${cat}:tx`));
        assert.equal(groups(mine).length, 1, `une alerte (clé …:catupd<catégorie>:tx<txid>) : ${brief(mine)}`);
        assert.deepEqual(mine.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP'], brief(mine));
        const d = mine[0].template_data;
        assert.deepEqual({ changes: d.changes, category: d.category, old_price: Number(d.old_price), new_price: Number(d.new_price) },
            { changes: ['PRICE'], category: VIP, old_price: 10_000, new_price: 15_000 }, `données de l'alerte : ${JSON.stringify(d)}`);
        assert.deepEqual(await rowsFor('ADMIN_EVENT_CHANGED', bare.userId, ev.eventId), [], 'admin sans events.read : rien');
        assert.deepEqual(await deliveredInApp(mine, reader.userId, ev.title), [{
            title: 'Événement modifié après validation',
            content: `« ${ev.title} » de ${company} : nouveau prix pour « ${VIP} » (${money(15_000)} au lieu de ${money(10_000)}) après validation. Vérifiez la fiche.`,
        }], 'contenu exact (11.2 M1, partie PRICE)');
    });

    test('canaux changés sur un VALIDE : partie CHANNELS ; prix et vente en ligne dans la même requête : une alerte, deux parties', async () => {
        const ev = await draft('Canaux');
        await advanceEventTo(ev.eventId, 'VALIDE');
        const cat = ev.categories[VIP].id;
        await patchOk(ev.eventId, cat, { sale_counter: false }, 'vente au guichet arrêtée');
        const first = (await rowsFor('ADMIN_EVENT_CHANGED', reader.userId, ev.eventId)).filter((r) => r.group_key.includes(`:catupd${cat}:tx`));
        assert.equal(groups(first).length, 1, `une alerte : ${brief(first)}`);
        assert.deepEqual(first[0].template_data.changes, ['CHANNELS'], JSON.stringify(first[0].template_data));
        assert.deepEqual([first[0].template_data.sale_online, first[0].template_data.sale_counter], [true, false], JSON.stringify(first[0].template_data));
        assert.deepEqual(await deliveredInApp(first, reader.userId, ev.title), [{
            title: 'Événement modifié après validation',
            content: `« ${ev.title} » de ${company} : canaux de vente de « ${VIP} » changés (en ligne seulement) après validation. Vérifiez la fiche.`,
        }], 'contenu exact (partie CHANNELS)');

        await patchOk(ev.eventId, cat, { price: 12_000, sale_online: false }, 'prix et vente en ligne ensemble');
        const all = (await rowsFor('ADMIN_EVENT_CHANGED', reader.userId, ev.eventId)).filter((r) => r.group_key.includes(`:catupd${cat}:tx`));
        const second = all.filter((r) => !groups(first).includes(r.group_key));
        assert.equal(groups(second).length, 1, `une seule alerte pour la requête : ${brief(second)}`);
        assert.deepEqual(second[0].template_data.changes, ['PRICE', 'CHANNELS'], JSON.stringify(second[0].template_data));
        assert.deepEqual([Number(second[0].template_data.old_price), Number(second[0].template_data.new_price)], [10_000, 12_000], JSON.stringify(second[0].template_data));
    });

    test('témoins : prix d\'un BROUILLON, quantité seule d\'un PUBLIE, une vente : aucune alerte', async () => {
        const brouillon = await draft('Brouillon prix');
        await patchOk(brouillon.eventId, brouillon.categories[VIP].id, { price: 11_000 }, 'prix d\'un brouillon');
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_CHANGED', eventId: brouillon.eventId }), [], 'brouillon : aucune alerte');

        const pub = await draft('Quantite');
        await advanceEventTo(pub.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        await patchOk(pub.eventId, pub.categories[VIP].id, { total_quantity: 45 }, 'quantité seule');
        await buyConfirmed(await newBuyer('adm9t-vente'), pub, [[VIP, 1]]);
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_CHANGED', eventId: pub.eventId }), [], 'quantité seule et vente : aucune alerte');
    });

    test('catégorie ajoutée puis son prix changé : deux alertes, clés distinctes (…:cat<id> puis …:catupd<id>:tx<txid>)', async () => {
        const ev = await draft('Ajout prix');
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const create = await routeHandler(CATEGORIES_ROUTE, 'POST', 'POST /api/partner/events/[id]/categories');
        const created = await invoke(create, jsonRequest(`/api/partner/events/${ev.eventId}/categories`, 'POST', partner.accessToken,
            { name: 'Carre or', price: 5_000, total_quantity: 10, max_per_order: 4 }), routeContext({ id: ev.eventId }));
        assert.equal(created.status, 201, `création de la catégorie : ${show(created)}`);
        const { data, error } = await service.from('ticket_categories').select('id').eq('event_id', ev.eventId).eq('name', 'Carre or').single();
        assert.equal(error, null, `catégorie créée : ${error?.message}`);
        const cat = String(data.id);
        await patchOk(ev.eventId, cat, { price: 6_000 }, 'prix de la catégorie ajoutée');

        const mine = await rowsFor('ADMIN_EVENT_CHANGED', reader.userId, ev.eventId);
        const keys = groups(mine);
        const added = keys.filter((k) => k === `ADMIN_EVENT_CHANGED:${ev.eventId}:cat${cat}:${reader.userId}`);
        const updated = keys.filter((k) => k.startsWith(`ADMIN_EVENT_CHANGED:${ev.eventId}:catupd${cat}:tx`) && k.endsWith(`:${reader.userId}`));
        assert.deepEqual([added.length, updated.length], [1, 1], `deux alertes, clés distinctes : ${JSON.stringify(keys)}`);
    });
});
