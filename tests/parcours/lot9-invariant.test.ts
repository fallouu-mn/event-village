/**
 * Lot 9 (AR6, contrat, section 6) — garde-fous des invariants (t)(u)(v) du lot (requête LOT9_INVARIANT_SQL dans
 * tests/helpers/lot9-invariants.ts). Un invariant toujours vide ne prouverait rien : dans des transactions annulées
 * (inRolledBackTransaction, patron canaux-invariant.test.ts), chaque règle détecte une violation fabriquée exprès,
 * à côté d'un témoin conforme écrit dans la même transaction :
 *  - les triggers utilisateur de tickets, ticket_categories et ticket_transfers sont coupés dans la transaction
 *    (annulé avec elle) : sinon trg_tickets_sale_decision écraserait la décision fabriquée. Écart de patron : storage.objects
 *    et auth.users ne sont pas coupés (hors du propriétaire postgres), et ne portent aucun trigger qui gêne ;
 *  - storage.objects est écrit directement par postgres dans la transaction (contrat 6.4) ;
 *  - t5, t6 : décision d'invitation sur un billet d'un autre canal, et réciproquement ;
 *  - u1 à u6 : invitations (gratuité, porteur, attente, journal, stock) ; v1 à v6 : photo, numéro, email, SMS ;
 *  - garde de schéma : chaque objet du lot retiré dans une transaction annulée est nommé par missingLot9Schema,
 *    et assertLot9Schema et lot9Violations échouent en le citant ; jamais un faux vert ;
 *  - dernier cas : après ROLLBACK, aucune ligne fabriquée ne reste, et les triggers sont actifs.
 * Les violations sont filtrées par objet : la requête lit toute la base, et after() contrôle le reste.
 *
 * Rouge avant correctif : ni M2 ni M4 du lot ne sont livrés ; assertLot9Schema échoue dans chaque transaction en
 * nommant chaque objet manquant, jamais par une erreur Postgres brute (contrat 6.4, critère jugé après la vague S).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { FIXTURE_EVENTS, FIXTURE_USERS } from '../helpers/fixture-data';
import { assertLot9Invariants, assertLot9Schema, lot9Violations, missingLot9Schema, type Lot9Violation } from '../helpers/lot9-invariants';
import { randomSenegalPhone } from './helpers';

type Row = Record<string, unknown>;

const T5 = 'billet INVITATION dont la décision ne vient pas d\'une invitation';
const T6 = (channel: string): string => `décision INVITATION sur un billet ${channel}`;
const U1 = (price: string): string => `invitation à ${price} F ou rattachée à un paiement`;
const U2 = 'invitation sans porteur, sans transfert en attente ou échu';
const U3 = 'billet sans porteur en attente de réclamation, non verrouillé';
const U4 = (channel: string): string => `transfert sans expéditeur sur un billet ${channel}`;
const U5 = (action: string): string => `${action} : numéro en clair au journal`;
const U6 = (n: number, sold: number): string => `${n} invitations actives pour ${sold} vendus`;
const V1 = 'photo hors du dossier du compte, ou objet absent';
const V2 = 'nom d\'objet hors du format <user_id>/<uuid>.webp, ou dossier sans compte';
const V3 = (n: number): string => `plusieurs photos pour un compte (${n})`;
const V4 = 'numéro différent entre le profil et l\'authentification après un changement';
const V5 = 'changement de numéro sans SMS à l\'ancien numéro';
const V6 = 'email différent entre le profil et l\'authentification';

/** Actions journalisées lues par la règle u5 (contrat 6.3). */
const JOURNAL_ACTIONS = ['TICKET_INVITATIONS_SENT', 'TICKET_INVITATION_CANCELLED', 'ACCOUNT_PHONE_CHANGED', 'ACCOUNT_PROFILE_UPDATED'] as const;

/** Base d'une URL publique de photo (contrat, section 9.2 ; la règle v1 ne lit que le chemin). */
const AVATAR_BASE = 'http://127.0.0.1:54321/storage/v1/object/public/avatars';

/** UUID dont un segment contient 9 chiffres : faux positif de u5 si les UUID n'étaient pas retirés. */
const UUID_WITH_DIGITS = '11111111-2222-4333-8444-ab770123456c';

/** Décision d'un billet (forme du contrat 2.4). */
const decided = (source: string): Row => ({ source, sale_online: true, sale_counter: true, decided_at: '2026-11-08T12:00:00+00:00' });

/** Identifiants de toutes les lignes fabriquées (contrôle final après ROLLBACK). */
const FABRICATED = { tickets: new Set<string>(), transfers: new Set<string>(), journal: new Set<string>(), objects: new Set<string>() };

after(async () => {
    await assertLot9Invariants('lot9-invariant');
});

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

interface Scene { eventId: string; client: string; bis: string; partner: string }

/** Schéma présent (échec explicite sinon, AVANT tout DDL), triggers utilisateur coupés, puis scène lue dans la transaction. */
async function inScene<T>(label: string, fn: (db: Client, s: Scene) => Promise<T>): Promise<T> {
    return inRolledBackTransaction(async (db) => {
        await assertLot9Schema(`lot9-invariant ${label}`, db);
        for (const table of ['tickets', 'ticket_categories', 'ticket_transfers']) {
            await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
        }
        return fn(db, await scene(db));
    });
}

/** Comptes et événement du seed, lus sur la transaction (mêmes identifiants stables que loadFixtures). */
async function scene(db: Client): Promise<Scene> {
    const emails = [FIXTURE_USERS.CLIENT.email, FIXTURE_USERS.CLIENT_BIS.email, FIXTURE_USERS.PARTNER_A.email];
    const { rows: users } = await db.query<{ id: string; email: string }>('SELECT id::text AS id, email FROM public.users WHERE email = ANY($1::text[])', [emails]);
    const idOf = (email: string): string => {
        const found = users.find((u) => u.email === email);
        assert.ok(found, `fixture ${email} absente : seed de test incomplet`);
        return found.id;
    };
    const { rows: ev } = await db.query<{ id: string }>('SELECT id::text AS id FROM public.events WHERE slug = $1', [FIXTURE_EVENTS.A_PUBLIE.slug]);
    assert.equal(ev.length, 1, `fixture ${FIXTURE_EVENTS.A_PUBLIE.slug} absente : seed de test incomplet`);
    return { eventId: ev[0].id, client: idOf(FIXTURE_USERS.CLIENT.email), bis: idOf(FIXTURE_USERS.CLIENT_BIS.email), partner: idOf(FIXTURE_USERS.PARTNER_A.email) };
}

async function insertCategory(db: Client, s: Scene, sold = 0): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.ticket_categories (id, event_id, name, price, total_quantity, sold_quantity, is_active, is_visible, max_per_order)
         VALUES ($1, $2, $3, 0, 50, $4, TRUE, TRUE, 10)`,
        [id, s.eventId, `TEST Invariant lot 9 ${id.slice(0, 8)}`, sold]);
    return id;
}

interface TicketSpec {
    categoryId: string;
    channel?: 'INVITATION' | 'ONLINE' | 'COUNTER';
    /** `null` : billet sans porteur (invitation en attente). Absent : le client de la scène. */
    userId?: string | null;
    decision?: Row;
    price?: number;
    paymentId?: string;
    locked?: boolean;
    status?: 'VALIDE' | 'UTILISE' | 'ANNULE';
}

/** Billet fabriqué ; défauts : invitation gratuite, décision INVITATION, verrouillé, VALIDE. */
async function insertTicket(db: Client, s: Scene, over: TicketSpec): Promise<string> {
    const id = randomUUID();
    const row: Row = {
        id,
        event_id: s.eventId,
        category_id: over.categoryId,
        user_id: over.userId === undefined ? s.client : over.userId,
        ticket_number: `TCK-INV-LOT9-${id.slice(0, 8)}`,
        price: over.price ?? 0,
        qr_code: `EV-QR-INV-LOT9-${id}`,
        status: over.status ?? 'VALIDE',
        sale_channel: over.channel ?? 'INVITATION',
        transfer_locked: over.locked ?? true,
        sale_decision: JSON.stringify(over.decision ?? decided('INVITATION')),
        ...(over.paymentId ? { payment_id: over.paymentId } : {}),
    };
    const cols = Object.keys(row);
    const vals = cols.map((c, i) => (c === 'sale_decision' ? `$${i + 1}::jsonb` : `$${i + 1}`));
    await db.query(`INSERT INTO public.tickets (${cols.join(', ')}) VALUES (${vals.join(', ')})`, Object.values(row));
    FABRICATED.tickets.add(id);
    return id;
}

/** Transfert fabriqué : sans expéditeur par défaut (invitation en attente). */
async function insertTransfer(db: Client, ticketId: string, over: { status?: 'PENDING' | 'EXPIRED'; from?: string | null } = {}): Promise<string> {
    const id = randomUUID();
    const status = over.status ?? 'PENDING';
    await db.query(
        `INSERT INTO public.ticket_transfers (id, ticket_id, from_user_id, to_phone_or_email, status, expires_at, expired_at)
         VALUES ($1, $2, $3, $4, $5::public.ticket_transfer_status, now() + interval '1 hour', CASE WHEN $5 = 'EXPIRED' THEN now() END)`,
        [id, ticketId, over.from === undefined ? null : over.from, randomSenegalPhone('77'), status]);
    FABRICATED.transfers.add(id);
    return id;
}

/** Paiement réussi fabriqué, hors des règles (s) : partner_id et event_id nuls. */
async function insertPayment(db: Client, s: Scene): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
         VALUES ($1, $2, $3, 'TICKET', 1000, 'SUCCESS', true, 1000, 0, 0, 0, 1000)`,
        [id, `TX-INV-LOT9-${id}`, s.client]);
    return id;
}

async function insertJournal(db: Client, action: string, userId: string | null, metadata: Row, over: { oldValue?: Row; newValue?: Row } = {}): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.audit_logs (id, user_id, action, object_type, old_value, new_value, metadata)
         VALUES ($1, $2, $3, 'test-invariant', $4::jsonb, $5::jsonb, $6::jsonb)`,
        [id, userId, action, over.oldValue ? JSON.stringify(over.oldValue) : null, over.newValue ? JSON.stringify(over.newValue) : null, JSON.stringify(metadata)]);
    FABRICATED.journal.add(id);
    return id;
}

/** Objet du bucket avatars, écrit par postgres dans la transaction (contrat 6.4). */
async function insertAvatar(db: Client, name: string): Promise<string> {
    await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', $1)`, [name]);
    FABRICATED.objects.add(name);
    return name;
}

async function setAvatarUrl(db: Client, userId: string, url: string): Promise<void> {
    const { rowCount } = await db.query('UPDATE public.users SET avatar_url = $2 WHERE id = $1', [userId, url]);
    assert.equal(rowCount, 1, `compte ${userId} : avatar_url non écrite`);
}

/** Aligne numéro et email du profil et de l'authentification (formes réelles : « +221… » au profil, chiffres seuls chez GoTrue). */
async function alignIdentity(db: Client, userId: string, phone: string, email: string): Promise<void> {
    const pub = await db.query('UPDATE public.users SET phone = $2, email = $3 WHERE id = $1', [userId, phone, email]);
    assert.equal(pub.rowCount, 1, `compte ${userId} : public.users introuvable`);
    const auth = await db.query('UPDATE auth.users SET phone = $2, email = $3 WHERE id = $1', [userId, phone.replace(/\D/g, ''), email.toLowerCase()]);
    assert.equal(auth.rowCount, 1, `compte ${userId} : auth.users introuvable`);
}

function about(rows: Lot9Violation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertDetected(rows: Lot9Violation[], regle: string, objet: string, detail: string, what: string): void {
    assert.ok(rows.some((r) => r.regle === regle && r.objet === objet && r.detail === detail), `${what} : « (${regle}) ${detail} » attendu : ${about(rows, objet)}`);
}

function assertClean(rows: Lot9Violation[], objet: string, what: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet), [], `${what} : aucune violation attendue : ${about(rows, objet)}`);
}

// ── Garde de schéma : un objet retiré est nommé ────────────────────────────

interface GuardCase { what: string; needle: string; remove: (db: Client) => Promise<unknown> }

const GUARD_CASES: readonly GuardCase[] = [
    { what: 'RPC ticket_invitation_create', needle: 'ticket_invitation_create', remove: (db) => db.query('DROP FUNCTION IF EXISTS public.ticket_invitation_create(jsonb)') },
    { what: 'RPC account_phone_finalize', needle: 'account_phone_finalize', remove: (db) => db.query('DROP FUNCTION IF EXISTS public.account_phone_finalize(jsonb)') },
    { what: 'contrainte tickets_holder_or_counter', needle: 'tickets_holder_or_counter', remove: (db) => db.query('ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_holder_or_counter') },
    {
        what: 'ticket_transfers.from_user_id nullable',
        needle: 'from_user_id',
        remove: async (db) => {
            await db.query('DELETE FROM public.ticket_transfers WHERE from_user_id IS NULL');
            await db.query('SET CONSTRAINTS ALL IMMEDIATE');
            await db.query('ALTER TABLE public.ticket_transfers ALTER COLUMN from_user_id SET NOT NULL');
        },
    },
    {
        what: 'tickets_sale_decision_set sans INVITATION',
        needle: 'tickets_sale_decision_set',
        remove: async (db) => {
            const { rows } = await db.query<{ def: string }>(`SELECT pg_get_functiondef('public.tickets_sale_decision_set()'::regprocedure) AS def`);
            await db.query(rows[0].def.replace(/'INVITATION'/g, `'AUTRE'`));
        },
    },
    ...(['INVITATION_RECEIVED', 'PHONE_CHANGED'] as const).map((type): GuardCase => ({
        what: `type ${type} au registre`,
        needle: type,
        remove: async (db) => {
            await db.query('DELETE FROM public.notification_outbox WHERE type = $1', [type]);
            await db.query('DELETE FROM public.notification_types WHERE type = $1', [type]);
        },
    })),
    { what: 'bucket avatars public', needle: 'bucket avatars', remove: (db) => db.query(`UPDATE storage.buckets SET public = FALSE WHERE id = 'avatars'`) },
];

describe('Lot 9, garde de schéma : chaque objet retiré est nommé, jamais un faux vert', () => {
    for (const c of GUARD_CASES) {
        test(`${c.what} : présent, puis retiré dans une transaction annulée, la garde le nomme`, async () => {
            await inRolledBackTransaction(async (db) => {
                const before = (await missingLot9Schema(db)).filter((m) => m.includes(c.needle));
                assert.deepEqual(before, [], `${c.what} : l'objet doit exister avant la coupure (migrations M2 et M4 du lot) : ${before.join(' ; ')}`);

                await c.remove(db);

                const missing = await missingLot9Schema(db);
                assert.ok(missing.some((m) => m.includes(c.needle)), `${c.what} : la garde doit nommer l'objet retiré : ${JSON.stringify(missing)}`);
                await assert.rejects(assertLot9Schema('lot9-invariant garde', db), (err: Error) => err.message.includes(c.needle), `${c.what} : assertLot9Schema doit échouer en le citant`);
                await assert.rejects(lot9Violations(db), (err: Error) => err.message.includes(c.needle), `${c.what} : lot9Violations ne doit jamais passer sans l'objet`);
            });
        });
    }
});

// ── Violations fabriquées ──────────────────────────────────────────────────

describe('Lot 9 Invariant (t) : la décision de vente d\'une invitation', () => {
    test('t5 : billet INVITATION dont la décision ne vient pas d\'une invitation ; témoins : décisions INVITATION et REPRISE', async () => {
        const ids = { off: '', invitation: '', reprise: '' };
        const rows = await inScene('t5', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.off = await insertTicket(db, s, { categoryId, decision: decided('CATEGORIE') });
            ids.invitation = await insertTicket(db, s, { categoryId, decision: decided('INVITATION') });
            ids.reprise = await insertTicket(db, s, { categoryId, decision: { source: 'REPRISE' } });
            return lot9Violations(db);
        });
        assertDetected(rows, 't', ids.off, T5, '(t5)');
        assertClean(rows, ids.invitation, '(t5) témoin décision INVITATION');
        assertClean(rows, ids.reprise, '(t5) témoin REPRISE');
    });

    test('t6 : décision INVITATION sur un billet ONLINE, puis COUNTER ; témoin : billet INVITATION', async () => {
        const ids = { online: '', counter: '', witness: '' };
        const rows = await inScene('t6', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.online = await insertTicket(db, s, { categoryId, channel: 'ONLINE', decision: decided('INVITATION') });
            ids.counter = await insertTicket(db, s, { categoryId, channel: 'COUNTER', userId: null, decision: decided('INVITATION') });
            ids.witness = await insertTicket(db, s, { categoryId, decision: decided('INVITATION') });
            return lot9Violations(db);
        });
        assertDetected(rows, 't', ids.online, T6('ONLINE'), '(t6) ONLINE');
        assertDetected(rows, 't', ids.counter, T6('COUNTER'), '(t6) COUNTER');
        assertClean(rows, ids.witness, '(t6) témoin');
    });
});

describe('Lot 9 Invariant (u) : invitations', () => {
    test('u1 : invitation à prix non nul, ou rattachée à un paiement ; témoin : gratuite sans paiement', async () => {
        const ids = { priced: '', paid: '', witness: '' };
        const rows = await inScene('u1', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.priced = await insertTicket(db, s, { categoryId, price: 5000 });
            ids.paid = await insertTicket(db, s, { categoryId, paymentId: await insertPayment(db, s) });
            ids.witness = await insertTicket(db, s, { categoryId });
            return lot9Violations(db);
        });
        assertDetected(rows, 'u', ids.priced, U1('5000.00'), '(u1) prix');
        assertDetected(rows, 'u', ids.paid, U1('0.00'), '(u1) paiement');
        assertClean(rows, ids.witness, '(u1) témoin');
    });

    test('u2 : invitation sans porteur et sans transfert ; témoins : transfert en attente, échu, billet annulé, billet avec porteur', async () => {
        const ids = { orphan: '', pending: '', expired: '', annule: '', held: '' };
        const rows = await inScene('u2', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.orphan = await insertTicket(db, s, { categoryId, userId: null });
            ids.pending = await insertTicket(db, s, { categoryId, userId: null });
            await insertTransfer(db, ids.pending);
            ids.expired = await insertTicket(db, s, { categoryId, userId: null });
            await insertTransfer(db, ids.expired, { status: 'EXPIRED' });
            ids.annule = await insertTicket(db, s, { categoryId, userId: null, status: 'ANNULE' });
            ids.held = await insertTicket(db, s, { categoryId });
            return lot9Violations(db);
        });
        assertDetected(rows, 'u', ids.orphan, U2, '(u2)');
        assertClean(rows, ids.pending, '(u2) témoin transfert en attente');
        assertClean(rows, ids.expired, '(u2) témoin transfert échu');
        assertClean(rows, ids.annule, '(u2) témoin billet annulé');
        assertClean(rows, ids.held, '(u2) témoin billet avec porteur');
    });

    test('u3 : billet sans porteur en attente, non verrouillé ; témoin : verrouillé', async () => {
        const ids = { open: '', locked: '' };
        const rows = await inScene('u3', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.open = await insertTicket(db, s, { categoryId, userId: null, locked: false });
            await insertTransfer(db, ids.open);
            ids.locked = await insertTicket(db, s, { categoryId, userId: null, locked: true });
            await insertTransfer(db, ids.locked);
            return lot9Violations(db);
        });
        assertDetected(rows, 'u', ids.open, U3, '(u3)');
        assertClean(rows, ids.locked, '(u3) témoin');
    });

    test('u4 : transfert sans expéditeur sur un billet ONLINE ; témoins : billet INVITATION, transfert avec expéditeur', async () => {
        const ids = { online: '', invitation: '', sender: '' };
        const rows = await inScene('u4', async (db, s) => {
            const categoryId = await insertCategory(db, s);
            ids.online = await insertTransfer(db, await insertTicket(db, s, { categoryId, channel: 'ONLINE', decision: decided('CATEGORIE') }));
            ids.invitation = await insertTransfer(db, await insertTicket(db, s, { categoryId, userId: null }));
            ids.sender = await insertTransfer(db, await insertTicket(db, s, { categoryId, channel: 'ONLINE', decision: decided('CATEGORIE') }), { from: s.bis });
            return lot9Violations(db);
        });
        assertDetected(rows, 'u', ids.online, U4('ONLINE'), '(u4)');
        assertClean(rows, ids.invitation, '(u4) témoin invitation');
        assertClean(rows, ids.sender, '(u4) témoin expéditeur');
    });

    test('u5 : numéro en clair dans chaque action du journal, puis dans old_value et new_value ; témoins : numéro masqué, UUID à 9 chiffres', async () => {
        const violations: Array<[string, string]> = [];
        const witnesses: string[] = [];
        const ids = { oldValue: '', newValue: '' };
        const rows = await inScene('u5', async (db) => {
            for (const action of JOURNAL_ACTIONS) {
                violations.push([action, await insertJournal(db, action, null, { sms_queued: false, phones: [randomSenegalPhone('77')] })]);
                witnesses.push(await insertJournal(db, action, null, { sms_queued: false, phones_masked: ['+221***67'], category_id: UUID_WITH_DIGITS }));
            }
            ids.oldValue = await insertJournal(db, 'ACCOUNT_PROFILE_UPDATED', null, {}, { oldValue: { phone: randomSenegalPhone('78') } });
            ids.newValue = await insertJournal(db, 'ACCOUNT_PROFILE_UPDATED', null, {}, { newValue: { phone: randomSenegalPhone('76').replace('+', '') } });
            return lot9Violations(db);
        });
        for (const [action, id] of violations) assertDetected(rows, 'u', id, U5(action), `(u5) ${action}`);
        assertDetected(rows, 'u', ids.oldValue, U5('ACCOUNT_PROFILE_UPDATED'), '(u5) old_value');
        assertDetected(rows, 'u', ids.newValue, U5('ACCOUNT_PROFILE_UPDATED'), '(u5) new_value, sans plus');
        for (const id of witnesses) assertClean(rows, id, '(u5) témoin masqué et UUID');
    });

    test('u6 : plus d\'invitations actives que de vendus sur une catégorie passée par la RPC ; témoins : égalité, billet annulé, catégorie hors RPC', async () => {
        const ids = { over: '', equal: '', noRpc: '' };
        const rows = await inScene('u6', async (db, s) => {
            ids.over = await insertCategory(db, s, 1);
            for (let i = 0; i < 2; i++) await insertTicket(db, s, { categoryId: ids.over });
            await insertJournal(db, 'TICKET_INVITATIONS_SENT', null, { category_id: ids.over });

            ids.equal = await insertCategory(db, s, 2);
            for (let i = 0; i < 2; i++) await insertTicket(db, s, { categoryId: ids.equal });
            await insertTicket(db, s, { categoryId: ids.equal, status: 'ANNULE' });
            await insertJournal(db, 'TICKET_INVITATIONS_SENT', null, { category_id: ids.equal });

            ids.noRpc = await insertCategory(db, s, 0);
            await insertTicket(db, s, { categoryId: ids.noRpc });
            return lot9Violations(db);
        });
        assertDetected(rows, 'u', ids.over, U6(2, 1), '(u6)');
        assertClean(rows, ids.equal, '(u6) témoin égalité, billet annulé non compté');
        assertClean(rows, ids.noRpc, '(u6) témoin catégorie hors de la RPC');
    });
});

describe('Lot 9 Invariant (v) : compte', () => {
    test('v1 : photo sans objet, puis dans le dossier d\'un autre compte ; témoins : photo du compte, URL extérieure', async () => {
        const ids = { absent: '', stolen: '', own: '', external: '' };
        const rows = await inScene('v1', async (db, s) => {
            const ownerOfStolen = s.client;
            ids.absent = s.bis;
            ids.stolen = s.partner;
            ids.own = (await db.query<{ id: string }>('SELECT id::text AS id FROM public.users WHERE email = $1', [FIXTURE_USERS.ADMIN.email])).rows[0].id;
            ids.external = (await db.query<{ id: string }>('SELECT id::text AS id FROM public.users WHERE email = $1', [FIXTURE_USERS.SUPERADMIN.email])).rows[0].id;

            await setAvatarUrl(db, ids.absent, `${AVATAR_BASE}/${ids.absent}/${randomUUID()}.webp`);

            const foreign = await insertAvatar(db, `${ownerOfStolen}/${randomUUID()}.webp`);
            await setAvatarUrl(db, ids.stolen, `${AVATAR_BASE}/${foreign}`);

            const own = await insertAvatar(db, `${ids.own}/${randomUUID()}.webp`);
            await setAvatarUrl(db, ids.own, `${AVATAR_BASE}/${own}`);

            await setAvatarUrl(db, ids.external, 'https://exemple.invalid/photo.png');
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', ids.absent, V1, '(v1) objet absent');
        assertDetected(rows, 'v', ids.stolen, V1, '(v1) dossier d\'un autre compte');
        assertClean(rows, ids.own, '(v1) témoin photo du compte');
        assertClean(rows, ids.external, '(v1) témoin URL extérieure');
    });

    test('v2 : nom hors format, puis dossier sans compte ; témoin : nom conforme', async () => {
        const names = { hors: '', orphan: '', witness: '' };
        const rows = await inScene('v2', async (db, s) => {
            names.hors = await insertAvatar(db, `${s.client}/photo.jpg`);
            names.orphan = await insertAvatar(db, `${randomUUID()}/${randomUUID()}.webp`);
            names.witness = await insertAvatar(db, `${s.bis}/${randomUUID()}.webp`);
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', names.hors, V2, '(v2) nom');
        assertDetected(rows, 'v', names.orphan, V2, '(v2) dossier sans compte');
        assertClean(rows, names.witness, '(v2) témoin');
    });

    test('v3 : deux photos pour un compte ; témoin : une seule photo', async () => {
        const ids = { two: '', one: '' };
        const rows = await inScene('v3', async (db, s) => {
            ids.two = s.client;
            ids.one = s.bis;
            await insertAvatar(db, `${s.client}/${randomUUID()}.webp`);
            await insertAvatar(db, `${s.client}/${randomUUID()}.webp`);
            await insertAvatar(db, `${s.bis}/${randomUUID()}.webp`);
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', ids.two, V3(2), '(v3)');
        assertClean(rows, ids.one, '(v3) témoin');
    });

    test('v4 : numéro du profil différent de l\'authentification après un changement ; témoin : numéros identiques, formes réelles', async () => {
        const ids = { differs: '', witness: '' };
        const rows = await inScene('v4', async (db, s) => {
            ids.differs = s.client;
            ids.witness = s.bis;
            await alignIdentity(db, s.client, randomSenegalPhone('77'), `lot9-v4-${randomUUID()}@test.eventvillage.local`);
            const { rowCount } = await db.query('UPDATE public.users SET phone = $2 WHERE id = $1', [s.client, randomSenegalPhone('78')]);
            assert.equal(rowCount, 1, 'numéro du profil modifié');
            await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.client, { sms_queued: false });

            await alignIdentity(db, s.bis, randomSenegalPhone('77'), `lot9-v4-${randomUUID()}@test.eventvillage.local`);
            await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.bis, { sms_queued: false });
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', ids.differs, V4, '(v4)');
        assertClean(rows, ids.witness, '(v4) témoin');
    });

    test('v5 : changement sans SMS ; clé absente comptée comme un SMS attendu ; témoins : SMS en file, sms_queued faux', async () => {
        const ids = { missing: '', keyAbsent: '', queued: '', notQueued: '' };
        const rows = await inScene('v5', async (db, s) => {
            await alignIdentity(db, s.client, randomSenegalPhone('77'), `lot9-v5-${randomUUID()}@test.eventvillage.local`);
            await alignIdentity(db, s.bis, randomSenegalPhone('77'), `lot9-v5-${randomUUID()}@test.eventvillage.local`);
            await alignIdentity(db, s.partner, randomSenegalPhone('77'), `lot9-v5-${randomUUID()}@test.eventvillage.local`);

            ids.missing = await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.client, { sms_queued: true });
            ids.keyAbsent = await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.client, {});

            ids.queued = await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.bis, { sms_queued: true });
            await db.query(
                `INSERT INTO public.notification_outbox (idempotency_key, group_key, type, family, channel, recipient_phone, due_at, next_attempt_at)
                 VALUES ($1, $1, 'PHONE_CHANGED', 'ESSENTIAL', 'SMS', $2, now(), now())`,
                [`PHONE_CHANGED:${s.bis}:1:SMS`, randomSenegalPhone('76')]);

            ids.notQueued = await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.partner, { sms_queued: false });
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', ids.missing, V5, '(v5) sms_queued vrai');
        assertDetected(rows, 'v', ids.keyAbsent, V5, '(v5) clé absente');
        assertClean(rows, ids.queued, '(v5) témoin SMS en file');
        assertClean(rows, ids.notQueued, '(v5) témoin sms_queued faux');
    });

    test('v6 : email du profil différent de l\'authentification, après un profil ou un numéro ; témoins : même email en casse différente, compte sans changement', async () => {
        const ids = { profil: '', numero: '', casse: '', untouched: '' };
        const rows = await inScene('v6', async (db, s) => {
            ids.profil = s.client;
            ids.numero = s.bis;
            ids.casse = s.partner;
            ids.untouched = (await db.query<{ id: string }>('SELECT id::text AS id FROM public.users WHERE email = $1', [FIXTURE_USERS.ADMIN.email])).rows[0].id;

            await db.query('UPDATE public.users SET email = $2 WHERE id = $1', [s.client, `lot9-v6-profil-${randomUUID()}@test.eventvillage.local`]);
            await insertJournal(db, 'ACCOUNT_PROFILE_UPDATED', s.client, {});

            await db.query('UPDATE public.users SET email = $2 WHERE id = $1', [s.bis, `lot9-v6-numero-${randomUUID()}@test.eventvillage.local`]);
            await insertJournal(db, 'ACCOUNT_PHONE_CHANGED', s.bis, { sms_queued: false });

            const email = `lot9-v6-casse-${randomUUID()}@test.eventvillage.local`;
            await alignIdentity(db, s.partner, randomSenegalPhone('77'), email.toUpperCase());
            await insertJournal(db, 'ACCOUNT_PROFILE_UPDATED', s.partner, {});

            await db.query('UPDATE public.users SET email = $2 WHERE id = $1', [ids.untouched, `lot9-v6-sans-${randomUUID()}@test.eventvillage.local`]);
            return lot9Violations(db);
        });
        assertDetected(rows, 'v', ids.profil, V6, '(v6) après un profil');
        assertDetected(rows, 'v', ids.numero, V6, '(v6) après un numéro');
        assertClean(rows, ids.casse, '(v6) témoin casse');
        assertClean(rows, ids.untouched, '(v6) témoin compte sans changement journalisé');
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('Lot 9 Invariant sur l\'état réel', () => {
    test('schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs', async () => {
        assert.deepEqual(await missingLot9Schema(), [], 'schéma du lot 9 (contrat 6.2)');
        assert.ok(FABRICATED.tickets.size > 0 && FABRICATED.transfers.size > 0 && FABRICATED.journal.size > 0 && FABRICATED.objects.size > 0,
            `les garde-fous ci-dessus ont fabriqué des lignes (${FABRICATED.tickets.size} billets, ${FABRICATED.transfers.size} transferts, ${FABRICATED.journal.size} lignes de journal, ${FABRICATED.objects.size} objets)`);
        const left = await inspect(async (db) => {
            const tickets = await db.query<{ id: string }>('SELECT id::text AS id FROM public.tickets WHERE id = ANY($1::uuid[])', [Array.from(FABRICATED.tickets)]);
            const transfers = await db.query<{ id: string }>('SELECT id::text AS id FROM public.ticket_transfers WHERE id = ANY($1::uuid[])', [Array.from(FABRICATED.transfers)]);
            const journal = await db.query<{ id: string }>('SELECT id::text AS id FROM public.audit_logs WHERE id = ANY($1::uuid[])', [Array.from(FABRICATED.journal)]);
            const objects = await db.query<{ id: string }>(`SELECT name AS id FROM storage.objects WHERE bucket_id = 'avatars' AND name = ANY($1::text[])`, [Array.from(FABRICATED.objects)]);
            return [...tickets.rows, ...transfers.rows, ...journal.rows, ...objects.rows].map((r) => r.id);
        });
        assert.deepEqual(left, [], `lignes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);

        const disabled = await inspect(async (db) => (await db.query<{ tgname: string }>(
            `SELECT tg.tgname FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname IN ('tickets', 'ticket_categories', 'ticket_transfers')
                AND NOT tg.tgisinternal AND tg.tgenabled = 'D'`)).rows.map((r) => r.tgname));
        assert.deepEqual(disabled, [], `triggers restés coupés : ${JSON.stringify(disabled)}`);

        const fabricated = new Set([FABRICATED.tickets, FABRICATED.transfers, FABRICATED.journal, FABRICATED.objects].flatMap((ids) => Array.from(ids)));
        const leaked = (await lot9Violations()).filter((r) => fabricated.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});
