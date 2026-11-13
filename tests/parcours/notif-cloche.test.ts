/**
 * Lot 6, tâche 6.10 — cloche et centre de notifications (contrat N, F1 second temps, G1 pour les libellés
 * des types et le lien interne ; S2 « Cloche et admin »).
 *  - la liste et le compteur portent sur le même ensemble (toutes les notifications du compte) : 25 non
 *    lues et 5 lues → la cloche (`?limit=20`) montre 20 non lues, badge 25, total 30 ; l'onglet « Non
 *    lues » (`filter=unread`) en a 25 sur 2 pages de 20 ; non lues d'abord, puis date décroissante ;
 *    pagination servie par le serveur ; catégorie (`category=`) traduite en types par le serveur, compteur
 *    inchangé, catégorie inconnue refusée ;
 *  - « Tout marquer comme lu » (PATCH /api/notifications : `updated`) et une seule
 *    (PATCH /api/notifications/[id]/read) ; la ligne d'un autre compte → 404, intacte ;
 *  - RPC notifications_page et notifications_mark_read (N1) : même ensemble, compteur sans filtre de type,
 *    aucune écriture sur la ligne d'un autre compte ;
 *  - `actionUrl` (internalActionUrl, G1 et N2) : chemin interne seulement ; externe, `//`, `\`,
 *    `javascript:` → null, dans le module partagé et dans la réponse de la route ;
 *  - canal toujours IN_APP : colonne texte à défaut IN_APP, CHECK notifications_channel_in_app (PUSH et SMS
 *    refusés, transaction annulée), aucune ligne d'un autre canal ; `channel` n'est plus renvoyé ;
 *  - statut du compte (N2) : SUSPENDU → 403, EN_ATTENTE admis ;
 *  - temps réel : une notification livrée par l'envoyeur (ligne IN_APP de la boîte d'envoi, marquage
 *    E2) arrive au destinataire abonné, au texte du catalogue (G4), et à personne d'autre ; elle est en
 *    tête de la cloche ;
 *  - libellés humains : chaque `inAppType` du catalogue a un libellé dans NOTIFICATION_TYPE_META, dont les
 *    11 nouveaux de G1 ;
 *  - contrôles statiques : chaînes figées de la cloche et de la page conservées
 *    (tests/notifications-and-documents.test.ts:58-74), onglet « Non lues » chargé par le serveur, plus de
 *    TYPE_ICONS ni de filtrage local, lien vers les préférences, pagination serveur.
 *
 * Rouge avant correctif : le compteur ne porte que sur le canal PUSH et la liste est tronquée et triée par
 * date seule (app/api/notifications/route.ts:24-44), ni `page`, ni `filter`, ni `category`, ni `total`,
 * ni `actionUrl` ; PATCH [id]/read répond 500 (`.single()` sans ligne) au lieu de 404, et lit `params`
 * sans l'attendre ; aucun contrôle du statut du compte (getAuthenticatedUser) ; notifications.channel est
 * l'énumération du lot 5 (PUSH accepté, IN_APP refusé) ; notifications_page, notifications_mark_read,
 * lib/notifications/action-url.ts, la boîte d'envoi et l'envoyeur n'existent pas ; la cloche garde
 * TYPE_ICONS et filtre localement.
 * Le jeu de test est écrit en IN_APP ; tant que la colonne est l'énumération du lot 5 (qui ne connaît pas
 * IN_APP), il est écrit en PUSH et le fait est journalisé : les cas restent rouges sur le comportement,
 * pas sur le montage.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import {
    RECEIVE_TIMEOUT_MS, disposeClients, expectNothing, produceUntilReceived, signedInClient, subscribeCollect, waitForEvent,
    type ReceivedChange,
} from '../helpers/realtime';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import { authed } from './acces-helpers';
import {
    assertNotificationInvariants, flushNotifications, insertOutboxRow, loadLotModule, lotFunction, outboxRows,
} from './notif-helpers';
import { NOTIFICATION_TYPE_META } from '../../lib/notifications/notification-types';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface RouteResult { status: number; body: Row }

const LIST_ROUTE = '../../app/api/notifications/route';
const READ_ROUTE = '../../app/api/notifications/[id]/read/route';
const ACTION_URL_MODULE = '../../lib/notifications/action-url';
const CATALOG_MODULE = '../../lib/notifications/catalog';
const SETTLE_MS = 1_500;
const MIN = 60_000;

/** Libellés des nouveaux `inAppType` (contrat G1), apostrophes normalisées à la comparaison. */
const NEW_IN_APP_TYPES: Array<[string, string, string]> = [
    ['TICKET_TRANSFER', 'Transfert de billet', 'ticket'],
    ['REMINDER', 'Rappel', 'event'],
    ['SALES', 'Ventes', 'event'],
    ['REFUND_PROGRESS', "Remboursements de l'annulation", 'payment'],
    ['WITHDRAWAL_PENDING_CHECK', 'Retrait en vérification', 'payment'],
    ['TRIAL', "Période d'essai", 'account'],
    ['CONTROLLER', "Contrôle d'accès", 'event'],
    ['ADMIN_REVIEW', 'À valider', 'alert'],
    ['NOTIFICATION_ALERT', 'Envoi en échec', 'alert'],
    ['SMS_DAILY_THRESHOLD', 'Volume de SMS', 'alert'],
    ['PROMOTION', 'Mise en avant', 'event'],
];

after(async () => {
    await assertNotificationInvariants('notif-cloche');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function handler(relPath: string, method: string, what: string): Promise<Handler> {
    return lotFunction<Handler>(relPath, method, what);
}

async function call(h: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await h(req, ctx);
    const text = await res.text();
    let body: Row = {};
    if (text) {
        try {
            body = JSON.parse(text) as Row;
        } catch (err) {
            body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
        }
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

async function getList(user: Buyer, query: string): Promise<RouteResult> {
    const GET = await handler(LIST_ROUTE, 'GET', 'GET /api/notifications (contrat N2)');
    return call(GET, authed(`/api/notifications${query}`, 'GET', user));
}

async function markAll(user: Buyer): Promise<RouteResult> {
    const PATCH = await handler(LIST_ROUTE, 'PATCH', 'PATCH /api/notifications (contrat N2)');
    return call(PATCH, authed('/api/notifications', 'PATCH', user));
}

async function markOne(user: Buyer, id: string): Promise<RouteResult> {
    const PATCH = await handler(READ_ROUTE, 'PATCH', 'PATCH /api/notifications/[id]/read (contrat N2)');
    return call(PATCH, authed(`/api/notifications/${id}/read`, 'PATCH', user), routeContext({ id }));
}

function items(r: RouteResult, what: string): Row[] {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.ok(Array.isArray(r.body.notifications), `${what} : liste « notifications » attendue, ${show(r)}`);
    return r.body.notifications as Row[];
}

function ids(list: Row[]): string[] {
    return list.map((n) => String(n.id));
}

interface SeedSpec {
    title: string;
    type: string;
    read: boolean;
    createdAt: Date;
    actionUrl?: string;
}

let enumFallbackLogged = false;

/**
 * Écrit des notifications du compte (service_role), canal IN_APP (contrat F1). Tant que la colonne est
 * l'énumération du lot 5 (22P02 sur notification_channel_enum), le même jeu est écrit en PUSH et le fait
 * est journalisé ; toute autre erreur échoue. Renvoie les ids dans l'ordre des specs.
 */
async function seedNotifications(userId: string, specs: SeedSpec[]): Promise<string[]> {
    const build = (channel: string) => specs.map((s) => ({
        user_id: userId,
        type: s.type,
        title: s.title,
        content: `Contenu de test de la cloche (lot 6) : ${s.title}`,
        channel,
        status: s.read ? 'READ' : 'SENT',
        sent_at: s.createdAt.toISOString(),
        read_at: s.read ? new Date(s.createdAt.getTime() + 1000).toISOString() : null,
        created_at: s.createdAt.toISOString(),
        metadata: s.actionUrl === undefined ? { source: 'tests-lot6-cloche' } : { source: 'tests-lot6-cloche', actionUrl: s.actionUrl },
    }));
    let res = await service.from('notifications').insert(build('IN_APP')).select('id, title');
    if (res.error && res.error.code === '22P02' && /notification_channel_enum/.test(res.error.message)) {
        if (!enumFallbackLogged) {
            console.log('[notif-cloche] notifications.channel est encore l’énumération du lot 5 (IN_APP inconnu, contrat F1 non appliqué) : jeu de test écrit en PUSH');
            enumFallbackLogged = true;
        }
        res = await service.from('notifications').insert(build('PUSH')).select('id, title');
    }
    assert.equal(res.error, null, `notifications de test : ${res.error?.message} (code ${res.error?.code})`);
    const byTitle = new Map((res.data ?? []).map((r) => [String(r.title), String(r.id)]));
    return specs.map((s) => {
        const id = byTitle.get(s.title);
        assert.ok(id, `notification de test « ${s.title} » non écrite`);
        return id;
    });
}

interface Inbox {
    user: Buyer;
    /** Non lues, de la plus ancienne (0) à la plus récente (24). */
    unread: string[];
    /** Lues, de la plus ancienne (0) à la plus récente (4), toutes plus récentes que les non lues. */
    read: string[];
    /** Non lues de type TICKET (catégorie « ticket ») : les 10 plus anciennes. */
    ticketUnread: string[];
}

/** Liens posés sur les non lues (index → metadata.actionUrl) et lien attendu dans la réponse. */
const LINKS: Record<number, { raw: string; expected: string | null }> = {
    24: { raw: '/tickets?tab=recus', expected: '/tickets?tab=recus' },
    23: { raw: 'https://evil.example/hameconnage', expected: null },
    22: { raw: '//evil.example/x', expected: null },
    21: { raw: 'javascript:alert(1)', expected: null },
    20: { raw: '/\\evil.example', expected: null },
    18: { raw: '/events/7f0c2c1e-0000-4000-8000-000000000001', expected: '/events/7f0c2c1e-0000-4000-8000-000000000001' },
};

/**
 * Compte neuf avec 25 notifications non lues (10 TICKET puis 15 EVENT_STATUS) et 5 lues (PAYMENT_SUCCESS)
 * plus récentes que toutes les non lues : un tri par date seule mettrait les lues en tête.
 */
async function seedInbox(label: string): Promise<Inbox> {
    const user = await newBuyer(`cloche-${label}`);
    const base = Date.now() - 3 * 60 * MIN;
    const tag = randomUUID().slice(0, 8);
    const specs: SeedSpec[] = [];
    for (let i = 0; i < 25; i += 1) {
        specs.push({
            title: `TEST cloche ${label} ${tag} non lue ${String(i).padStart(2, '0')}`,
            type: i < 10 ? 'TICKET' : 'EVENT_STATUS',
            read: false,
            createdAt: new Date(base + i * MIN),
            actionUrl: LINKS[i]?.raw,
        });
    }
    for (let j = 0; j < 5; j += 1) {
        specs.push({
            title: `TEST cloche ${label} ${tag} lue ${j}`,
            type: 'PAYMENT_SUCCESS',
            read: true,
            createdAt: new Date(base + (60 + j) * MIN),
        });
    }
    const all = await seedNotifications(user.userId, specs);
    return { user, unread: all.slice(0, 25), read: all.slice(25), ticketUnread: all.slice(0, 10) };
}

/** Ordre attendu de « toutes » : non lues de la plus récente à la plus ancienne, puis lues de même. */
function expectedAllOrder(box: Inbox): string[] {
    return [...box.unread].reverse().concat([...box.read].reverse());
}

async function notificationRow(id: string): Promise<Row> {
    const { data, error } = await service.from('notifications').select('*').eq('id', id).single();
    assert.equal(error, null, `notification ${id} : ${error?.message}`);
    return data as Row;
}

// ── Même ensemble pour la liste et le compteur ─────────────────────────────

describe('6.10 Liste et compteur : même ensemble, non lues d’abord, pagination serveur (N1, N2)', () => {
    let box: Inbox;

    before(async () => {
        box = await seedInbox('liste');
    });

    test('cloche (?limit=20) : 20 non lues en tête, badge 25, total 30, sans canal', async () => {
        const r = await getList(box.user, '?limit=20');
        const list = items(r, 'GET ?limit=20');
        const expected = expectedAllOrder(box).slice(0, 20);
        assert.equal(list.length, 20, `20 notifications attendues, ${list.length} reçues`);
        assert.deepEqual(ids(list), expected, 'ordre : non lues d’abord (les 20 plus récentes), jamais les lues plus récentes en tête');
        assert.ok(list.every((n) => n.isRead === false), `les 20 premières sont non lues : ${JSON.stringify(list.map((n) => n.isRead))}`);
        assert.equal(r.body.unreadCount, 25, `badge : 25 non lues (même ensemble que la liste), reçu ${JSON.stringify(r.body.unreadCount)}`);
        assert.equal(r.body.total, 30, `total : 30 notifications du compte, reçu ${JSON.stringify(r.body.total)}`);
        assert.equal(r.body.page, 1, `page 1 (limit = pageSize de la page 1), reçu ${JSON.stringify(r.body.page)}`);
        assert.equal(r.body.pageSize, 20, `pageSize 20, reçu ${JSON.stringify(r.body.pageSize)}`);
        const withChannel = list.filter((n) => Object.prototype.hasOwnProperty.call(n, 'channel'));
        assert.equal(withChannel.length, 0, '`channel` n’est plus renvoyé (contrat N2)');
        for (const n of list) {
            for (const k of ['id', 'userId', 'type', 'title', 'content', 'status', 'isRead', 'readAt', 'createdAt', 'actionUrl', 'metadata']) {
                assert.ok(Object.prototype.hasOwnProperty.call(n, k), `champ ${k} attendu dans ${JSON.stringify(n).slice(0, 300)}`);
            }
        }
    });

    test('onglet « Non lues » : 25 non lues sur 2 pages de 20, sans recouvrement ni lue', async () => {
        const p1 = await getList(box.user, '?page=1&pageSize=20&filter=unread');
        const p2 = await getList(box.user, '?page=2&pageSize=20&filter=unread');
        const p3 = await getList(box.user, '?page=3&pageSize=20&filter=unread');
        const l1 = items(p1, 'non lues, page 1');
        const l2 = items(p2, 'non lues, page 2');
        const l3 = items(p3, 'non lues, page 3');
        const newestFirst = [...box.unread].reverse();
        assert.deepEqual(ids(l1), newestFirst.slice(0, 20), 'page 1 : les 20 non lues les plus récentes');
        assert.deepEqual(ids(l2), newestFirst.slice(20), 'page 2 : les 5 non lues restantes');
        assert.equal(l3.length, 0, 'page 3 : vide');
        for (const r of [p1, p2]) {
            assert.equal(r.body.total, 25, `total du filtre « non lues » : 25, ${show(r)}`);
            assert.equal(r.body.unreadCount, 25, `compteur : 25, ${show(r)}`);
        }
        assert.equal(p2.body.page, 2, `page 2 renvoyée, ${show(p2)}`);
    });

    test('« Toutes », page 2 : les 5 non lues les plus anciennes puis les 5 lues', async () => {
        const r = await getList(box.user, '?page=2&pageSize=20&filter=all');
        const list = items(r, 'toutes, page 2');
        assert.deepEqual(ids(list), expectedAllOrder(box).slice(20), 'page 2 : fin des non lues, puis les lues par date décroissante');
        assert.deepEqual(list.map((n) => n.isRead), [false, false, false, false, false, true, true, true, true, true]);
        assert.equal(r.body.total, 30, `total : 30, ${show(r)}`);
        assert.equal(r.body.unreadCount, 25, `compteur : 25, ${show(r)}`);
    });

    test('catégorie (?category=ticket) : types traduits par le serveur, compteur sans filtre de type ; catégorie inconnue → 400', async () => {
        const r = await getList(box.user, '?page=1&pageSize=20&filter=all&category=ticket');
        const list = items(r, 'catégorie ticket');
        assert.deepEqual(ids(list), [...box.ticketUnread].reverse(), 'les 10 notifications TICKET seulement, non lues d’abord');
        assert.ok(list.every((n) => n.type === 'TICKET'), `types reçus : ${JSON.stringify(list.map((n) => n.type))}`);
        assert.equal(r.body.total, 10, `total de la catégorie : 10, ${show(r)}`);
        assert.equal(r.body.unreadCount, 25, `compteur de la cloche inchangé par la catégorie (même ensemble), ${show(r)}`);

        const bad = await getList(box.user, '?page=1&pageSize=20&category=categorie-inconnue');
        assert.equal(bad.status, 400, `catégorie inconnue refusée : ${show(bad)}`);
    });

    test('actionUrl : chemin interne seulement ; externe, //, \\ et javascript: → null', async () => {
        const r = await getList(box.user, '?page=1&pageSize=20&filter=unread');
        const list = items(r, 'liens');
        const byId = new Map(list.map((n) => [String(n.id), n]));
        for (const [idx, link] of Object.entries(LINKS)) {
            const n = byId.get(box.unread[Number(idx)]);
            assert.ok(n, `notification non lue ${idx} présente en page 1`);
            assert.equal(n.actionUrl, link.expected, `actionUrl de « ${link.raw} » : ${JSON.stringify(link.expected)} attendu, reçu ${JSON.stringify(n.actionUrl)}`);
        }
        const plain = byId.get(box.unread[19]);
        assert.ok(plain, 'notification sans lien présente');
        assert.equal(plain.actionUrl, null, 'sans metadata.actionUrl : actionUrl null');
    });
});

// ── Marquage ───────────────────────────────────────────────────────────────

describe('6.10 « Tout marquer comme lu » et une seule (N1, N2)', () => {
    let box: Inbox;
    let other: Inbox;

    before(async () => {
        box = await seedInbox('marquage');
        other = await seedInbox('marquage-autre');
    });

    test('une seule : PATCH [id]/read → lue, compteur 24 ; la ligne d’un autre compte → 404 et intacte ; id inconnu → 404', async () => {
        const target = box.unread[24];
        const ok = await markOne(box.user, target);
        assert.equal(ok.status, 200, `marquage d’une notification : ${show(ok)}`);
        assert.equal(ok.body.success, true, `réponse { success } : ${show(ok)}`);
        const row = await notificationRow(target);
        assert.equal(row.status, 'READ', 'statut READ en base');
        assert.ok(row.read_at, 'read_at posé');
        const after1 = await getList(box.user, '?limit=20');
        assert.equal(after1.body.unreadCount, 24, `compteur après une lecture : 24, ${show(after1)}`);
        assert.ok(!ids(items(after1, 'cloche après lecture')).includes(target), 'la notification lue quitte la tête de liste (non lues d’abord)');

        const foreign = other.unread[0];
        const refused = await markOne(box.user, foreign);
        assert.equal(refused.status, 404, `notification d’un autre compte : 404 attendu, ${show(refused)}`);
        const foreignRow = await notificationRow(foreign);
        assert.equal(foreignRow.status, 'SENT', 'la notification de l’autre compte reste non lue');
        assert.equal(foreignRow.read_at, null, 'read_at de l’autre compte inchangé');

        const unknown = await markOne(box.user, randomUUID());
        assert.equal(unknown.status, 404, `notification inconnue : 404 attendu, ${show(unknown)}`);
    });

    test('toutes : PATCH /api/notifications → updated 24, compteur 0, total inchangé ; l’autre compte intact', async () => {
        const r = await markAll(box.user);
        assert.equal(r.status, 200, `tout marquer comme lu : ${show(r)}`);
        assert.equal(r.body.success, true, `réponse { success } : ${show(r)}`);
        assert.equal(r.body.updated, 24, `24 notifications passées à lues (une l’était déjà), reçu ${JSON.stringify(r.body.updated)}`);
        const after1 = await getList(box.user, '?limit=20');
        assert.equal(after1.body.unreadCount, 0, `compteur après « Tout marquer comme lu » : 0, ${show(after1)}`);
        assert.equal(after1.body.total, 30, `total inchangé : 30, ${show(after1)}`);
        const { data, error } = await service.from('notifications').select('status').eq('user_id', box.user.userId);
        assert.equal(error, null, error?.message);
        assert.ok((data ?? []).every((n) => n.status === 'READ'), 'toutes les lignes du compte sont READ');
        const witness = await getList(other.user, '?limit=20');
        assert.equal(witness.body.unreadCount, 25, `l’autre compte garde ses 25 non lues, ${show(witness)}`);
        const again = await markAll(box.user);
        assert.equal(again.body.updated, 0, `second passage : rien à marquer, ${show(again)}`);
    });
});

// ── RPC (N1) ───────────────────────────────────────────────────────────────

describe('6.10 RPC notifications_page et notifications_mark_read (N1)', () => {
    let box: Inbox;
    let other: Inbox;

    before(async () => {
        box = await seedInbox('rpc');
        other = await seedInbox('rpc-autre');
    });

    test('notifications_page : filtre de types sur la liste, unread_count sur tout le compte', async () => {
        const { data, error } = await service.rpc('notifications_page', {
            p: { user_id: box.user.userId, page: 1, page_size: 5, filter: 'all', types: ['TICKET'] },
        });
        assert.equal(error, null, `notifications_page : ${error?.message} (code ${error?.code}) — RPC du contrat N1, migration 20261103000007`);
        const body = data as Row;
        assert.equal(body.ok, true, `notifications_page : ${JSON.stringify(body)}`);
        const list = body.items as Row[];
        assert.deepEqual(list.map((n) => String(n.id)), [...box.ticketUnread].reverse().slice(0, 5), '5 TICKET non lues les plus récentes');
        assert.equal(body.total, 10, 'total des types demandés : 10');
        assert.equal(body.unread_count, 25, 'unread_count : même ensemble, sans filtre de type');
        assert.equal(body.page, 1);
        assert.equal(body.page_size, 5);
    });

    test('notifications_mark_read : la ligne d’un autre compte n’est pas touchée (updated 0) ; toutes : updated 25', async () => {
        const foreign = await service.rpc('notifications_mark_read', { p: { user_id: box.user.userId, id: other.unread[3] } });
        assert.equal(foreign.error, null, `notifications_mark_read : ${foreign.error?.message} (code ${foreign.error?.code})`);
        assert.equal((foreign.data as Row).ok, true, JSON.stringify(foreign.data));
        assert.equal((foreign.data as Row).updated, 0, `ligne d’un autre compte : aucune mise à jour, ${JSON.stringify(foreign.data)}`);
        assert.equal((await notificationRow(other.unread[3])).status, 'SENT', 'la ligne de l’autre compte reste non lue');

        const all = await service.rpc('notifications_mark_read', { p: { user_id: box.user.userId } });
        assert.equal(all.error, null, all.error?.message);
        assert.equal((all.data as Row).updated, 25, `toutes les non lues du compte : 25, ${JSON.stringify(all.data)}`);
        const { count, error } = await service.from('notifications').select('id', { count: 'exact', head: true })
            .eq('user_id', other.user.userId).neq('status', 'READ');
        assert.equal(error, null, error?.message);
        assert.equal(count, 25, 'l’autre compte garde ses 25 non lues');
    });
});

// ── Lien interne (G1) ──────────────────────────────────────────────────────

describe('6.10 internalActionUrl (lib/notifications/action-url.ts, G1 et N2)', () => {
    test('chemin interne gardé ; schéma, //, \\, relatif, vide ou non textuel → null', async () => {
        const internalActionUrl = await lotFunction<(v: unknown) => string | null>(ACTION_URL_MODULE, 'internalActionUrl', 'lien interne partagé (contrat G1)');
        const cases: Array<[unknown, string | null]> = [
            ['/tickets', '/tickets'],
            ['/tickets?tab=recus', '/tickets?tab=recus'],
            ['/partner/events/42?tab=ventes', '/partner/events/42?tab=ventes'],
            ['https://evil.example/x', null],
            ['http://127.0.0.1:3000/tickets', null],
            ['//evil.example/x', null],
            ['/\\evil.example', null],
            ['\\\\evil.example', null],
            ['javascript:alert(1)', null],
            ['data:text/html,x', null],
            ['tickets', null],
            ['', null],
            [null, null],
            [undefined, null],
            [42, null],
            [{ actionUrl: '/tickets' }, null],
        ];
        for (const [input, expected] of cases) {
            assert.equal(internalActionUrl(input), expected, `internalActionUrl(${JSON.stringify(input)}) : ${JSON.stringify(expected)} attendu`);
        }
    });
});

// ── Canal IN_APP (F1) ──────────────────────────────────────────────────────

describe('6.10 Canal toujours IN_APP (F1, migration 20261103000007)', () => {
    test('colonne texte à défaut IN_APP, CHECK notifications_channel_in_app : PUSH et SMS refusés, IN_APP accepté (transaction annulée)', async () => {
        const user = await newBuyer('cloche-canal');
        const outcome = await inRolledBackTransaction(async (db) => {
            const col = await db.query<{ data_type: string; column_default: string | null }>(
                `SELECT data_type, column_default FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'channel'`);
            const check = await db.query<{ conname: string; def: string }>(
                `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
                  WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_channel_in_app'`);
            const attempt = async (channel: string): Promise<string | null> => {
                await db.query('SAVEPOINT s');
                try {
                    await db.query(
                        `INSERT INTO public.notifications (user_id, type, title, content, channel, status)
                         VALUES ($1, 'SYSTEM', 'Essai de canal', 'Essai de canal (lot 6)', $2, 'SENT')`, [user.userId, channel]);
                    await db.query('RELEASE SAVEPOINT s');
                    return null;
                } catch (err) {
                    await db.query('ROLLBACK TO SAVEPOINT s');
                    return String((err as { code?: string }).code ?? (err as Error).message);
                }
            };
            return { col: col.rows[0], check: check.rows, push: await attempt('PUSH'), sms: await attempt('SMS'), inApp: await attempt('IN_APP') };
        });
        console.log('[notif-cloche] canal :', JSON.stringify(outcome));
        assert.ok(outcome.col, 'colonne notifications.channel présente');
        assert.equal(outcome.col.data_type, 'text', `notifications.channel en texte (contrat F1), type ${outcome.col.data_type}`);
        assert.match(String(outcome.col.column_default), /'IN_APP'/, `défaut IN_APP, reçu ${outcome.col.column_default}`);
        assert.equal(outcome.check.length, 1, 'contrainte notifications_channel_in_app présente');
        assert.equal(outcome.push, '23514', `canal PUSH refusé par le CHECK (23514), reçu ${outcome.push}`);
        assert.equal(outcome.sms, '23514', `canal SMS refusé par le CHECK (23514), reçu ${outcome.sms}`);
        assert.equal(outcome.inApp, null, `canal IN_APP accepté, reçu ${outcome.inApp}`);
    });

    test('aucune notification d’un autre canal en base', async () => {
        const rows = await inspect(async (db) => (await db.query<{ channel: string; n: string }>(
            `SELECT channel::text AS channel, count(*)::text AS n FROM public.notifications WHERE channel::text <> 'IN_APP' GROUP BY 1 ORDER BY 1`)).rows);
        assert.deepEqual(rows, [], `notifications hors IN_APP : ${JSON.stringify(rows)}`);
    });
});

// ── Statut du compte (N2) ──────────────────────────────────────────────────

describe('6.10 Statut du compte (N2 : ACTIF et EN_ATTENTE admis)', () => {
    test('SUSPENDU → 403 ACCOUNT_NOT_ACTIVE sur la liste et le marquage ; EN_ATTENTE → 200 ; sans session → 401', async () => {
        const suspended = await seedInbox('suspendu');
        const pending = await seedInbox('en-attente');
        for (const [u, status] of [[suspended.user, 'SUSPENDU'], [pending.user, 'EN_ATTENTE']] as Array<[Buyer, string]>) {
            const { error } = await service.from('users').update({ status }).eq('id', u.userId);
            assert.equal(error, null, `statut ${status} : ${error?.message}`);
        }
        const list = await getList(suspended.user, '?limit=20');
        assert.equal(list.status, 403, `compte suspendu : liste refusée, ${show(list)}`);
        assert.equal(list.body.code, 'ACCOUNT_NOT_ACTIVE', show(list));
        const all = await markAll(suspended.user);
        assert.equal(all.status, 403, `compte suspendu : « Tout marquer comme lu » refusé, ${show(all)}`);
        const one = await markOne(suspended.user, suspended.unread[0]);
        assert.equal(one.status, 403, `compte suspendu : marquage refusé, ${show(one)}`);
        assert.equal((await notificationRow(suspended.unread[0])).status, 'SENT', 'aucune écriture pour le compte suspendu');

        const ok = await getList(pending.user, '?limit=20');
        assert.equal(ok.status, 200, `compte EN_ATTENTE admis : ${show(ok)}`);
        assert.equal(ok.body.unreadCount, 25, show(ok));

        const GET = await handler(LIST_ROUTE, 'GET', 'GET /api/notifications');
        const anon = await call(GET, jsonRequest('/api/notifications?limit=20', 'GET', null));
        assert.equal(anon.status, 401, `sans session : 401, ${show(anon)}`);
    });
});

// ── Temps réel : livrée par l'envoyeur ─────────────────────────────────────

describe('6.10 Temps réel : une notification livrée par l’envoyeur arrive au destinataire seul (N3, E2)', () => {
    test('ligne IN_APP PASSWORD_CHANGED → INSERT reçu par le destinataire, au texte du catalogue ; rien chez un autre compte ; en tête de la cloche', async () => {
        const recipient = await newBuyer('cloche-rt');
        const other = await newBuyer('cloche-rt-autre');
        const rc = await signedInClient({ email: recipient.email });
        const oc = await signedInClient({ email: other.email });
        const carriesData = (e: ReceivedChange) => Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
        const touch = async () => {
            const tag = randomUUID().slice(0, 8);
            await seedNotifications(recipient.userId, [{ title: `TEST cloche vivacité ${tag}`, type: 'SYSTEM', read: true, createdAt: new Date(Date.now() - 10 * MIN) }]);
        };
        try {
            const mine = subscribeCollect(rc, { table: 'notifications', filter: `user_id=eq.${recipient.userId}` }, { label: 'destinataire notifications' });
            const spy = subscribeCollect(oc, { table: 'notifications', filter: `user_id=eq.${recipient.userId}` }, { label: 'autre compte (filtre du destinataire)' });
            const spyAll = subscribeCollect(oc, { table: 'notifications' }, { label: 'autre compte (sans filtre)' });
            await Promise.all([mine.ready, spy.ready, spyAll.ready]);
            await produceUntilReceived(mine, touch, (e) => e.new.user_id === recipient.userId, { what: 'vivacité : notification reçue par son destinataire' });

            const nowIso = new Date().toISOString();
            const row = await insertOutboxRow({
                type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'IN_APP', recipient_user_id: recipient.userId,
                due_at: nowIso, next_attempt_at: nowIso, template_data: {},
            });
            const report = await flushNotifications({ ids: [row.id] });
            assert.ok(report.claimed >= 1, `envoyeur : la ligne ${row.id} est réservée (${JSON.stringify(report)})`);
            const got = await waitForEvent(mine,
                (e) => e.eventType === 'INSERT' && (e.new.metadata as Row | undefined)?.outbox_id === row.id, RECEIVE_TIMEOUT_MS,
                'notification livrée par l’envoyeur reçue par son destinataire, sans recharger');
            assert.equal(got.new.type, 'SECURITY', `type in-app du catalogue (G2), reçu ${JSON.stringify(got.new.type)}`);
            assert.equal(got.new.title, 'Mot de passe modifié', 'titre du catalogue (G4)');
            assert.equal(got.new.content, "Le mot de passe de votre compte a été modifié. Si ce n'est pas vous : utilisez « Mot de passe oublié » sur la page de connexion, puis ouvrez la page Aide pour joindre le support.", 'contenu du catalogue (G4, lot 9 quinquies B1)');
            assert.equal(got.new.channel, 'IN_APP', 'canal IN_APP');
            assert.equal((got.new.metadata as Row).actionUrl, '/profile', 'lien du catalogue dans metadata.actionUrl');

            const [delivered] = await outboxRows({ ids: [row.id] });
            assert.equal(delivered.status, 'SENT', `ligne de la boîte d’envoi SENT, reçu ${delivered.status}`);
            assert.equal(delivered.notification_id, got.new.id, 'notification_id = ligne de la cloche');

            const sentinelTag = randomUUID().slice(0, 8);
            await seedNotifications(recipient.userId, [{ title: `TEST cloche sentinelle ${sentinelTag}`, type: 'SYSTEM', read: true, createdAt: new Date(Date.now() - 10 * MIN) }]);
            await waitForEvent(mine, (e) => e.new.title === `TEST cloche sentinelle ${sentinelTag}`, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par le destinataire');
            await expectNothing(spy, SETTLE_MS, carriesData, 'autre compte abonné avec le filtre du destinataire : rien');
            await expectNothing(spyAll, 0, carriesData, 'autre compte abonné sans filtre : rien');

            const bell = await getList(recipient, '?limit=20');
            const list = items(bell, 'cloche du destinataire');
            assert.equal(list[0]?.id, got.new.id, 'la notification livrée est en tête de la cloche (seule non lue)');
            assert.equal(list[0]?.actionUrl, '/profile', 'actionUrl interne renvoyé par la route');
            assert.equal(bell.body.unreadCount, 1, `badge : 1 non lue, ${show(bell)}`);
        } finally {
            await disposeClients(rc, oc);
        }
    });
});

// ── Libellés humains (G1) ──────────────────────────────────────────────────

function normApostrophe(s: string): string {
    return s.replace(/[’‘]/g, "'");
}

describe('6.10 Libellés humains des types (G1, NOTIFICATION_TYPE_META)', () => {
    test('les 11 nouveaux inAppType ont leur libellé et leur catégorie', () => {
        const missing: string[] = [];
        for (const [type, label, category] of NEW_IN_APP_TYPES) {
            const meta = Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPE_META, type) ? NOTIFICATION_TYPE_META[type] : undefined;
            if (!meta) {
                missing.push(type);
                continue;
            }
            assert.equal(normApostrophe(meta.label), label, `libellé de ${type}`);
            assert.equal(meta.category, category, `catégorie de ${type}`);
        }
        assert.deepEqual(missing, [], `types sans libellé dans lib/notifications/notification-types.ts : ${missing.join(', ')}`);
    });

    test('chaque inAppType du catalogue a un libellé (jamais « Information » par défaut ni le code brut)', async () => {
        const mod = await loadLotModule(CATALOG_MODULE, 'catalogue des modèles (contrat G1)');
        const catalog = mod.NOTIFICATION_CATALOG as Record<string, { channels?: readonly string[]; inAppType?: string }> | undefined;
        assert.ok(catalog && typeof catalog === 'object', 'NOTIFICATION_CATALOG exporté');
        const inAppTypes = Array.from(new Set(Object.values(catalog)
            .filter((t) => (t.channels ?? []).includes('IN_APP'))
            .map((t) => String(t.inAppType))));
        assert.ok(inAppTypes.length >= 20, `au moins 20 inAppType distincts au catalogue, ${inAppTypes.length}`);
        const unlabeled = inAppTypes.filter((t) => !Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPE_META, t));
        assert.deepEqual(unlabeled, [], `inAppType sans libellé : ${unlabeled.join(', ')}`);
        for (const t of inAppTypes) {
            const label = NOTIFICATION_TYPE_META[t].label;
            assert.ok(!/[A-Z]{2,}_[A-Z]/.test(label) && label !== t, `libellé humain pour ${t} : « ${label} »`);
        }
    });
});

// ── Contrôles statiques (N3) ───────────────────────────────────────────────

describe('6.10 Cloche et page : chaînes figées et chargement par le serveur (N3)', () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

    test('NotificationBell : chaînes figées conservées, « Non lues » par le serveur, libellés partagés, lien vers les préférences', () => {
        const src = read('components/notifications/NotificationBell.tsx');
        assert.ok(src.includes("fetch('/api/notifications?limit=20')"), "fetch('/api/notifications?limit=20') conservé (notifications-and-documents.test.ts)");
        assert.ok(src.includes('unreadCount'), 'unreadCount conservé');
        assert.ok(src.includes('handleMarkAllAsRead'), 'handleMarkAllAsRead conservé');
        assert.match(src, /\/api\/notifications\?limit=20&filter=unread/, 'onglet « Non lues » chargé par ?limit=20&filter=unread');
        assert.doesNotMatch(src, /\.filter\(\s*\(?\s*\w+\s*\)?\s*=>\s*!\s*\w+\.isRead\s*\)/, 'plus de filtrage local des non lues');
        assert.doesNotMatch(src, /\bTYPE_ICONS\b/, 'plus de TYPE_ICONS : libellés par notificationTypeMeta');
        assert.match(src, /\bnotificationTypeMeta\b/, 'libellés et catégories par notificationTypeMeta (comme la page)');
        assert.doesNotMatch(src, /metadata\??\.actionUrl/, 'le lien vient de `actionUrl` (filtré par le serveur), jamais de metadata.actionUrl');
        assert.ok(src.includes('Voir toutes les notifications'), 'pied « Voir toutes les notifications »');
        assert.ok(src.includes('/profile/notifications'), 'pied « Préférences » vers /profile/notifications');
        assert.match(src, /useRealtimeRefresh/, 'temps réel par useRealtimeRefresh');
    });

    test('page /notifications : chaînes figées conservées, pagination et onglets servis par le serveur', () => {
        const src = read('app/notifications/page.tsx');
        assert.ok(src.includes("fetch('/api/notifications") || src.includes('fetch(`/api/notifications'), 'appel de /api/notifications conservé');
        assert.ok(src.includes('fetch(`/api/notifications/${id}/read`'), 'appel de /api/notifications/[id]/read conservé');
        assert.ok(src.includes('Tout marquer comme lu'), '« Tout marquer comme lu »');
        assert.ok(src.includes('Réessayer'), 'état d’erreur avec « Réessayer »');
        assert.ok(src.includes('Voir le détail'), 'lien « Voir le détail »');
        assert.match(src, /\bPagination\b/, 'composant Pagination (pagination serveur)');
        assert.match(src, /filter=unread/, 'onglet « Non lues » servi par le serveur (filter=unread)');
        assert.match(src, /category=/, 'onglets de catégorie servis par le serveur (category=)');
        assert.doesNotMatch(src, /limit=50/, 'plus de liste tronquée à 50 filtrée localement');
        assert.ok(src.includes('/profile/notifications'), 'lien vers les préférences');
        assert.match(src, /useRealtimeRefresh/, 'temps réel par useRealtimeRefresh');
    });
});
