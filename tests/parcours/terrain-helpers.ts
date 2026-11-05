/**
 * Lot 7 — outils communs des suites du terrain (contrat, section 12, ligne INFRA) : réglages et
 * interrupteurs SUPERADMIN, événement et billet pour le hors ligne, téléchargement des codes, choix du code
 * d'un instant, scan avec clé d'idempotence, porteurs en masse, inscription « numéro d'abord », admin à
 * permissions.
 *
 * Règles reprises des lots précédents :
 *  - les modules du lot absents (route des codes hors ligne, route de démarrage de l'inscription) sont
 *    importés dynamiquement (importModule) : le typecheck passe aujourd'hui, l'aide échoue en nommant le
 *    module absent ;
 *  - les réglages sont posés par finance_setting_set (service_role, acteur SUPERADMIN du seed, historisé),
 *    lus avant et restaurés dans un finally ; un réglage absent de la base fait échouer l'aide en le nommant ;
 *  - aucune horloge n'est passée à une route (Conventions « Horloge ») : les événements sont placés par
 *    rapport à l'heure réelle ;
 *  - les SMS se comptent par numéro neuf ou par clé, jamais globalement (massHolders donne des numéros neufs).
 * Les invariants du lot (assertTerrainInvariants) et les aides de base (alignQuotaWindow,
 * openConcurrentClient, waitForLockWaiters) sont réexportés pour les suites.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { openConcurrentClient, type ConcurrentClient } from '../helpers/db';
import { isModuleNotFound } from '../helpers/notification-invariants';
import { BASE_URL, randomEmail, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, scan, type RouteResult } from './acces-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';

export {
    assertTerrainInvariants, assertTerrainSchema, missingTerrainSchema, terrainViolations, TERRAIN_INVARIANT_SQL,
    type TerrainViolation,
} from '../helpers/terrain-invariants';
export { alignQuotaWindow, assertSameQuotaWindow, currentQuotaWindow, dbClockMs, type QuotaWindow } from '../helpers/quota-window';
export { openConcurrentClient, waitForLockWaiters, type ConcurrentClient, type LockWaiter, type LockWaiterSelector } from '../helpers/db';

// ── Réglages SUPERADMIN (platform_settings, finance_setting_set) ───────────

/** Valeur d'un réglage (`value.value`) ; échec explicite si la clé est absente de platform_settings. */
export async function getPlatformSetting(key: string): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture du réglage ${key} : ${error?.message}`);
    assert.ok(data, `réglage ${key} absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)`);
    return (data.value as { value?: unknown }).value;
}

/** Pose un réglage par finance_setting_set (acteur SUPERADMIN du seed) ; échec explicite si la RPC refuse. */
export async function setPlatformSetting(key: string, value: unknown, reason = 'test du lot 7'): Promise<void> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    assert.equal((data as { ok?: boolean } | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
}

/**
 * Applique des réglages (n'importe quelle clé admise par finance_setting_set : access.*, notif.*, features.*,
 * finance.*) le temps de fn, puis remet, dans un finally, les valeurs lues avant (seulement celles qui ont été
 * posées). Toutes les clés sont lues avant la première écriture : une clé absente fait échouer l'aide sans
 * rien modifier.
 */
export async function withSettings<T>(overrides: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const keys = Object.keys(overrides);
    const saved = new Map<string, unknown>();
    for (const k of keys) saved.set(k, await getPlatformSetting(k));
    const applied: string[] = [];
    try {
        for (const k of keys) {
            await setPlatformSetting(k, overrides[k]);
            applied.push(k);
        }
        return await fn();
    } finally {
        for (const k of applied) await setPlatformSetting(k, saved.get(k), 'restauration après un test du lot 7');
    }
}

/** Interrupteurs SUPERADMIN du lot 7 (contrat M1, D55) et leur clé. */
export const FEATURE_FLAG_KEYS = {
    halls: 'features.halls_enabled',
    tables: 'features.tables_enabled',
    orders: 'features.orders_enabled',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAG_KEYS;

/**
 * Valeurs actuelles des trois interrupteurs lues dans platform_settings (échec explicite si une clé manque).
 * Nom distinct de getFeatureFlags() de lib/features/flags.ts (contrat 3.4), que les suites testent.
 */
export async function readFeatureFlagSettings(): Promise<Record<FeatureFlag, unknown>> {
    return {
        halls: await getPlatformSetting(FEATURE_FLAG_KEYS.halls),
        tables: await getPlatformSetting(FEATURE_FLAG_KEYS.tables),
        orders: await getPlatformSetting(FEATURE_FLAG_KEYS.orders),
    };
}

/**
 * Pose les interrupteurs donnés (`{ halls: true }` → features.halls_enabled = true) le temps de fn, puis les
 * remet (withSettings). Avant fix(7.0a) (migration 20261105000001) : échec « réglage features.… absent ».
 */
export async function withFeatureFlags<T>(flags: Partial<Record<FeatureFlag, boolean>>, fn: () => Promise<T>): Promise<T> {
    const overrides: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(flags) as Array<[FeatureFlag, boolean | undefined]>) {
        assert.ok(name in FEATURE_FLAG_KEYS, `withFeatureFlags : interrupteur inconnu « ${name} » (halls, tables, orders)`);
        if (value !== undefined) overrides[FEATURE_FLAG_KEYS[name]] = value;
    }
    return withSettings(overrides, fn);
}

// ── Événement et billet pour le hors ligne ─────────────────────────────────

/** Billet VALIDE émis directement (service_role) : gratuit par défaut, stock vendu + 1. */
export interface IssueTicketOptions {
    /** Canal de vente (défaut 'FREE') ; un billet payant passe par buyConfirmed (finance-helpers), invariant (b). */
    saleChannel?: 'FREE' | 'INVITATION' | 'ONLINE';
}

/**
 * Émet un billet VALIDE à 0 F au porteur dans la catégorie (stock vendu + 1). Les billets payants ne sont pas
 * émis ici : sans paiement SUCCESS, ils violeraient l'invariant (b) du lot 2 (utiliser buyConfirmed).
 */
export async function issueFreeTicket(eventId: string, categoryId: string, holder: Pick<Buyer, 'userId'>, opts: IssueTicketOptions = {}): Promise<string> {
    const { data, error } = await service.from('tickets').insert({
        event_id: eventId, category_id: categoryId, user_id: holder.userId, price: 0, status: 'VALIDE',
        sale_channel: opts.saleChannel ?? 'FREE',
        ticket_number: `TCK-HL-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-HL-${randomUUID()}`,
    }).select('id').single();
    assert.equal(error, null, `billet hors ligne : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity, total_quantity').eq('id', categoryId).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    assert.ok(Number(c.sold_quantity) + 1 <= Number(c.total_quantity), `catégorie ${categoryId} pleine (${c.sold_quantity}/${c.total_quantity})`);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', categoryId);
    assert.equal(uErr, null, `stock vendu : ${uErr?.message}`);
    return data.id as string;
}

export interface OfflineEventOptions {
    /** Début dans `startsInHours` heures, à l'heure réelle (défaut 2 ; négatif : déjà commencé). */
    startsInHours?: number;
    /** Durée en heures (défaut 4). */
    durationHours?: number;
    /** Statut final (défaut 'PUBLIE'), atteint par les RPC de transition du lot 5. */
    status?: string;
    /** Catégories (défaut : une catégorie « Entrée » gratuite de 50 places, la première sert au billet). */
    categories?: CategorySpec[];
    /** Partenaire propriétaire (défaut : partenaire VALIDE neuf). */
    partner?: TestPartner;
    /** Porteur du billet (défaut : acheteur neuf) ; `null` : aucun billet émis. */
    holder?: Buyer | null;
    /** Canal du billet émis (défaut 'FREE'). */
    saleChannel?: IssueTicketOptions['saleChannel'];
}

export interface OfflineEvent {
    partner: TestPartner;
    ev: SaleEvent;
    eventId: string;
    /** Catégorie du billet émis (première catégorie). */
    categoryId: string;
    /** event_start_at(event) et event_end_at(event), lus en base (même calcul que la fenêtre hors ligne). */
    startAt: Date;
    endAt: Date;
    /** Porteur et billet VALIDE (null si `holder: null`). */
    holder: Buyer | null;
    ticketId: string | null;
}

async function rpcInstant(fn: 'event_start_at' | 'event_end_at', eventId: string): Promise<Date> {
    const args = fn === 'event_start_at' ? { p_event: eventId } : { p_event_id: eventId };
    const { data, error } = await service.rpc(fn, args);
    assert.equal(error, null, `${fn}(${eventId}) : ${error?.message}`);
    const d = new Date(String(data));
    assert.ok(data !== null && !Number.isNaN(d.getTime()), `${fn}(${eventId}) : instant illisible (${JSON.stringify(data)})`);
    return d;
}

/**
 * Événement placé par rapport à l'heure réelle (createTimedEvent, lot 4), avec ses instants de début et de
 * fin lus en base, et un billet VALIDE gratuit à un porteur neuf (sauf `holder: null`). La fenêtre de
 * téléchargement se règle en déplaçant l'événement (startsInHours) et les réglages access.* (withSettings),
 * jamais l'heure (D6).
 */
export async function createOfflineEvent(label: string, opts: OfflineEventOptions = {}): Promise<OfflineEvent> {
    const partner = opts.partner ?? await newPartner(`hl-${label}`);
    const categories = opts.categories ?? [{ name: 'Entrée', price: 0, total: 50 }];
    assert.ok(categories.length > 0, 'createOfflineEvent : au moins une catégorie');
    const ev = await createTimedEvent(partner.partnerId, `hors-ligne ${label}`, categories, {
        startsInHours: opts.startsInHours ?? 2, durationHours: opts.durationHours ?? 4, status: opts.status ?? 'PUBLIE',
    });
    const categoryId = ev.categories[categories[0].name].id;
    const startAt = await rpcInstant('event_start_at', ev.eventId);
    const endAt = await rpcInstant('event_end_at', ev.eventId);
    const holder = opts.holder === undefined ? await newBuyer(`hl-${label}`) : opts.holder;
    const ticketId = holder ? await issueFreeTicket(ev.eventId, categoryId, holder, { saleChannel: opts.saleChannel }) : null;
    return { partner, ev, eventId: ev.eventId, categoryId, startAt, endAt, holder, ticketId };
}

// ── Codes hors ligne (route du contrat 3.1) ────────────────────────────────

/** Lot de codes renvoyé par GET /api/tickets/[id]/offline-codes (contrat 3.1). */
export interface OfflineLot {
    ticket_id: string;
    secret_version: number;
    prefix: string;
    step_seconds: number;
    digits: number;
    first_counter: number;
    count: number;
    codes: string;
    first_step_at: string;
    last_step_at: string;
    valid_until: string;
    expires_at: string;
    scan_opens_at: string;
    scan_closes_at: string;
    complete: boolean;
    next_from: string | null;
    refresh_after: string | null;
    server_time: string;
    ticket: Record<string, unknown>;
}

/** Réponse de la route, avec ses en-têtes et la taille du corps (brut et gzip niveau 6, contrat 3.1). */
export interface OfflineDownload extends RouteResult {
    headers: Record<string, string>;
    /** Corps brut tel que servi. */
    text: string;
    /** Taille du corps en octets (UTF-8). */
    bytes: number;
    /** Taille du corps compressé par gzip niveau 6, en octets. */
    gzipBytes: number;
}

const OFFLINE_ROUTE = '../../app/api/tickets/[id]/offline-codes/route';

/**
 * Appelle GET /api/tickets/<ticketId>/offline-codes dans le processus du test, au nom de `user` (`null` :
 * sans session). Aucune heure ni paramètre n'est transmis (la route n'en lit aucun). Avant fix(7.1s) : échec
 * explicite « route absente ».
 */
export async function downloadOfflineCodes(user: Buyer | null, ticketId: string): Promise<OfflineDownload> {
    let mod: { GET?: (req: NextRequest, ctx: unknown) => Promise<Response> };
    try {
        mod = await importModule(OFFLINE_ROUTE);
    } catch (err) {
        if (isModuleNotFound(err, OFFLINE_ROUTE)) {
            assert.fail(`route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — ${String((err as Error).message).split('\n')[0]}`);
        }
        throw err;
    }
    assert.equal(typeof mod.GET, 'function', 'app/api/tickets/[id]/offline-codes/route.ts : GET non exporté (contrat 3.1)');
    const path = `/api/tickets/${ticketId}/offline-codes`;
    const req = user ? authed(path, 'GET', user) : new NextRequest(`${BASE_URL}${path}`, { method: 'GET' });
    const res = await mod.GET!(req, routeContext({ id: ticketId }));
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text }; // corps non JSON conservé tel quel pour l'assertion du test
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { status: res.status, body, headers, text, bytes: Buffer.byteLength(text, 'utf8'), gzipBytes: gzipSync(Buffer.from(text, 'utf8'), { level: 6 }).length };
}

/** Code du lot pour un instant donné. */
export interface OfflineCodeAt {
    /** Indice du code dans le lot (0 = first_counter). */
    index: number;
    /** Compteur TOTP : floor(epoch / step_seconds). */
    counter: number;
    /** Code à `digits` chiffres. */
    code: string;
    /** Charge utile du QR : `<prefix>:<ticket_id>:<code>`. */
    payload: string;
}

/**
 * Code du lot valable à l'instant `at` (défaut : maintenant, heure réelle de Node) : compteur
 * floor(at / step), indice = compteur − first_counter, code = codes.substr(digits × indice, digits).
 * `null` si l'instant est hors du lot. Échec explicite si l'objet n'a pas la forme d'un lot (contrat 3.1).
 */
export function codeAt(lot: OfflineLot | Record<string, unknown>, at: Date | number = Date.now()): OfflineCodeAt | null {
    const l = lot as Record<string, unknown>;
    for (const [field, type] of [['ticket_id', 'string'], ['prefix', 'string'], ['codes', 'string'], ['first_counter', 'number'], ['count', 'number'], ['step_seconds', 'number'], ['digits', 'number']] as const) {
        assert.equal(typeof l[field], type, `codeAt : lot hors ligne invalide, champ ${field} (${type}) absent ou mal typé — reçu ${JSON.stringify(lot).slice(0, 300)}`);
    }
    const step = Number(l.step_seconds);
    const digits = Number(l.digits);
    const first = Number(l.first_counter);
    const count = Number(l.count);
    const codes = String(l.codes);
    assert.ok(step > 0 && digits > 0 && count > 0, `codeAt : lot incohérent (step ${step}, digits ${digits}, count ${count})`);
    assert.equal(codes.length, digits * count, `codeAt : codes.length = ${codes.length}, attendu digits × count = ${digits * count}`);
    const ms = at instanceof Date ? at.getTime() : at;
    assert.ok(Number.isFinite(ms), 'codeAt : instant invalide');
    const counter = Math.floor(ms / 1000 / step);
    const index = counter - first;
    if (index < 0 || index >= count) return null;
    const code = codes.substr(digits * index, digits);
    return { index, counter, code, payload: `${String(l.prefix)}:${String(l.ticket_id)}:${code}` };
}

// ── Scan avec clé d'idempotence (D39, contrat 3.3) ─────────────────────────

/**
 * POST /api/controller/scan avec l'en-tête Idempotency-Key = `key` (même clé : rejeu), ou sans en-tête si
 * `key` vaut `null` (400 IDEMPOTENCY_KEY_REQUIRED attendu après fix(7.2s)). Même appel que scan() (acces-helpers).
 */
export async function scanWithKey(user: Buyer, body: Record<string, unknown>, key: string | null): Promise<RouteResult> {
    return scan(user, body, { idempotencyKey: key });
}

// ── Porteurs en masse (7.0 a : 701 rappels) ────────────────────────────────

export type MassChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS';
export type MassTopic = 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY';

export interface MassHoldersOptions {
    eventId: string;
    /** Catégorie des billets (total_quantity suffisant : vérifié). */
    categoryId: string;
    /** Canal des billets à 0 F (défaut 'FREE'). Aucun billet payant (invariant (b) du lot 2). */
    saleChannel?: 'FREE' | 'INVITATION' | 'ONLINE';
    /** Canaux des préférences coupés en masse (enabled = false) pour `topics` (défaut : aucun). */
    disableChannels?: MassChannel[];
    /** Sujets concernés par disableChannels (défaut ['REMINDERS']). */
    topics?: MassTopic[];
    /** Pose users.phone_verified_at = now() (défaut : non, comme newBuyer). */
    phoneVerified?: boolean;
    /** Préfixe mobile des numéros (défaut '70' : jamais produit par randomSenegalPhone, qui tire 76, 77, 78). */
    phonePrefix?: '70' | '75';
}

export interface MassHolders {
    /** Alignés par indice : userIds[i] a le numéro phones[i] et le billet ticketIds[i]. */
    userIds: string[];
    phones: string[];
    ticketIds: string[];
}

function fillMassPhones(set: Set<string>, n: number, prefix: string): void {
    while (set.size < n) set.add(`+221${prefix}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`);
}

/**
 * `n` numéros +221<prefix>XXXXXXX distincts et libres : tirés au hasard, puis chaque numéro déjà porté par un
 * compte (auth.users ou public.users, avec ou sans « + », forme GoTrue comprise) est remplacé, jusqu'à ce
 * qu'aucun ne soit pris. Lu dans la transaction de massHolders : les suites tournent l'une après l'autre,
 * aucune autre écriture ne peut prendre le numéro entre la vérification et l'insertion. Avant : tirage sans
 * vérification, collisions au tirage dans 5 runs sur 8 (runs 77 à 87 relus, « numéro déjà attribué » dans
 * sms-plafond-optionnel et sms-veille), rattrapées par trois essais seulement.
 */
async function freshMassPhones(db: ConcurrentClient, n: number, prefix: string): Promise<string[]> {
    const set = new Set<string>();
    fillMassPhones(set, n, prefix);
    for (let round = 1; round <= 20; round++) {
        const taken = await db.query<{ phone: string }>(
            `SELECT p.phone FROM unnest($1::text[]) AS p(phone)
              WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.phone IN (p.phone, ltrim(p.phone, '+')))
                 OR EXISTS (SELECT 1 FROM public.users u WHERE u.phone IN (p.phone, ltrim(p.phone, '+')))`, [Array.from(set)]);
        if (taken.rows.length === 0) return Array.from(set);
        for (const r of taken.rows) set.delete(r.phone);
        fillMassPhones(set, n, prefix);
    }
    assert.fail(`massHolders : ${n} numéros +221${prefix} libres introuvables après 20 tirages`);
}

/**
 * `n` porteurs neufs (comptes auth.users et public.users ACTIF CLIENT créés par le trigger handle_new_user,
 * numéros +221<prefix>XXXXXXX distincts), chacun avec un billet VALIDE à 0 F de l'événement, en quelques
 * instructions SQL (generate_series / unnest) dans UNE transaction validée sur la base locale
 * (openConcurrentClient), stock vendu + n. Numéro déjà pris (23505) : tirage refait, trois essais.
 * Les comptes ne peuvent pas se connecter (aucun mot de passe) : ils servent de destinataires.
 */
export async function massHolders(n: number, opts: MassHoldersOptions): Promise<MassHolders> {
    assert.ok(Number.isInteger(n) && n > 0 && n <= 5000, `massHolders : nombre de porteurs invalide (${n}, de 1 à 5 000)`);
    const prefix = opts.phonePrefix ?? '70';
    const topics = opts.topics ?? ['REMINDERS'];
    const channels = opts.disableChannels ?? [];
    for (let attempt = 1; ; attempt++) {
        const db = await openConcurrentClient({ applicationName: 'ev-test-mass-holders', statementTimeoutMs: 120_000 });
        try {
            const phones = await freshMassPhones(db, n, prefix);
            const users = await db.query<{ id: string; phone: string }>(
                `INSERT INTO auth.users (id, instance_id, aud, role, email, phone, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
                 SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', NULL, p.phone,
                        jsonb_build_object('first_name', 'Porteur', 'last_name', 'Masse ' || p.i), '{}'::jsonb, now(), now()
                   FROM unnest($1::text[]) WITH ORDINALITY AS p(phone, i)
                 RETURNING id::text AS id, phone`, [phones]);
            assert.equal(users.rowCount, n, `massHolders : ${users.rowCount} compte(s) créé(s) sur ${n}`);
            const idByPhone = new Map(users.rows.map((r) => [r.phone, r.id]));
            const userIds = phones.map((p) => {
                const id = idByPhone.get(p);
                assert.ok(id, `massHolders : compte du numéro ${p} introuvable après insertion`);
                return id;
            });
            const profiles = await db.query<{ n: string }>(
                `SELECT count(*)::text AS n FROM public.users WHERE id = ANY($1::uuid[]) AND phone = ANY($2::text[]) AND status::text = 'ACTIF'`, [userIds, phones]);
            assert.equal(profiles.rows[0].n, String(n), `massHolders : profils public.users créés par handle_new_user (${profiles.rows[0].n}/${n})`);
            if (opts.phoneVerified) {
                await db.query(`UPDATE public.users SET phone_verified_at = now() WHERE id = ANY($1::uuid[])`, [userIds]);
            }
            const stock = await db.query<{ sold: number; total: number }>(
                `UPDATE public.ticket_categories SET sold_quantity = sold_quantity + $2
                  WHERE id = $1 AND event_id = $3 RETURNING sold_quantity AS sold, total_quantity AS total`, [opts.categoryId, n, opts.eventId]);
            assert.equal(stock.rowCount, 1, `massHolders : catégorie ${opts.categoryId} absente de l'événement ${opts.eventId}`);
            assert.ok(Number(stock.rows[0].sold) <= Number(stock.rows[0].total), `massHolders : catégorie trop petite (${stock.rows[0].sold} vendus pour ${stock.rows[0].total})`);
            const tickets = await db.query<{ id: string; user_id: string }>(
                `INSERT INTO public.tickets (event_id, category_id, user_id, price, status, sale_channel, ticket_number, qr_code)
                 SELECT $1::uuid, $2::uuid, u.id, 0, 'VALIDE', $3::text,
                        'TCK-MASS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14)),
                        'EV-QR-MASS-' || gen_random_uuid()::text
                   FROM unnest($4::uuid[]) AS u(id)
                 RETURNING id::text AS id, user_id::text AS user_id`, [opts.eventId, opts.categoryId, opts.saleChannel ?? 'FREE', userIds]);
            assert.equal(tickets.rowCount, n, `massHolders : ${tickets.rowCount} billet(s) émis sur ${n}`);
            const ticketByUser = new Map(tickets.rows.map((r) => [r.user_id, r.id]));
            const ticketIds = userIds.map((u) => ticketByUser.get(u)!);
            if (channels.length > 0) {
                await db.query(
                    `INSERT INTO public.notification_preferences (user_id, topic, channel, enabled)
                     SELECT u.id, t.topic, c.channel, false
                       FROM unnest($1::uuid[]) AS u(id) CROSS JOIN unnest($2::text[]) AS t(topic) CROSS JOIN unnest($3::text[]) AS c(channel)
                     ON CONFLICT (user_id, topic, channel) DO UPDATE SET enabled = false, updated_at = now()`, [userIds, topics, channels]);
            }
            await db.commit();
            return { userIds, phones, ticketIds };
        } catch (err) {
            if ((err as { code?: string }).code === '23505' && attempt < 3) {
                console.warn(`[massHolders] numéro déjà attribué, nouveau tirage (essai ${attempt + 1}/3) : ${(err as Error).message}`);
                continue;
            }
            throw err;
        } finally {
            await db.close();
        }
    }
}

// ── Inscription « numéro d'abord » (D1, contrat 3.6) ───────────────────────

export interface RegisterFlowFields {
    /** Défaut : numéro neuf (randomSenegalPhone('77')). */
    phone?: string;
    firstName?: string;
    lastName?: string;
    /** Défaut : STRONG_PASSWORD des parcours. */
    password?: string;
    /** Absent : aucun email envoyé (l'adresse @eventvillage.sn est dérivée par la route). */
    email?: string;
    referralCode?: string;
    /** En-têtes ajoutés aux deux requêtes (ex. x-forwarded-for pour les quotas par IP). */
    headers?: Record<string, string>;
}

export interface RegisterFlowResult {
    phone: string;
    /** Réponse de POST /api/auth/register/start. */
    start: RouteResult;
    /** Code à 6 chiffres lu dans le dernier SMS reçu par le numéro après le démarrage (null : aucun). */
    code: string | null;
    /** Réponse de POST /api/auth/register (null si le démarrage a échoué ou qu'aucun code n'est arrivé). */
    register: RouteResult | null;
    /** Compte créé (register.body.userId), null sinon. */
    userId: string | null;
}

async function postRoute(modPath: string, what: string, path: string, body: unknown, headers: Record<string, string>): Promise<RouteResult> {
    let mod: { POST?: (req: NextRequest) => Promise<Response> };
    try {
        mod = await importModule(modPath);
    } catch (err) {
        if (isModuleNotFound(err, modPath)) {
            assert.fail(`${what} absente : ${modPath.replace(/^(\.\.\/)+/, '')}.ts (contrat 3.6, fix(7.3s)) — ${String((err as Error).message).split('\n')[0]}`);
        }
        throw err;
    }
    assert.equal(typeof mod.POST, 'function', `${modPath.replace(/^(\.\.\/)+/, '')}.ts : POST non exporté`);
    const res = await mod.POST!(new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }));
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
        parsed = text ? JSON.parse(text) : {};
    } catch {
        parsed = { raw: text }; // corps non JSON conservé tel quel pour l'assertion du test
    }
    return { status: res.status, body: parsed };
}

/** POST /api/auth/register/start `{ phone }` (contrat 3.6) : envoie le code, ne crée aucun compte. */
export async function registerStart(phone: string, headers: Record<string, string> = {}): Promise<RouteResult> {
    return postRoute('../../app/api/auth/register/start/route', 'route de démarrage de l\'inscription', '/api/auth/register/start', { phone }, headers);
}

/** POST /api/auth/register `{ phone, code, firstName, lastName, password, email?, referralCode? }` (contrat 3.6). */
export async function registerSubmit(body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<RouteResult> {
    return postRoute('../../app/api/auth/register/route', 'route d\'inscription', '/api/auth/register', body, headers);
}

/** Dernier code à 6 chiffres reçu par `phone` parmi les SMS d'indice ≥ `since` (faux MTarget). */
export function lastSmsCode(phone: string, since = 0): string | null {
    const codes = getFakes().sms.messagesTo(phone).slice(since)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
    return codes.length > 0 ? codes[codes.length - 1] : null;
}

/**
 * Inscription complète selon le nouveau contrat (D1) : `start` (code envoyé par SMS, aucun compte), lecture
 * du code dans le faux SMS reçu après le démarrage, puis `register` avec ce code. Avec `expectOk` (défaut),
 * l'aide exige start 200, un code reçu et register 200 avec userId, et échoue en montrant la réponse sinon.
 * `expectOk: false` : renvoie les réponses telles quelles (register n'est tenté que si start répond 200 et
 * qu'un code est arrivé). Avant fix(7.3s) : échec « route de démarrage de l'inscription absente ».
 */
export async function registerClientFlow(fields: RegisterFlowFields = {}, opts: { expectOk?: boolean } = {}): Promise<RegisterFlowResult> {
    const expectOk = opts.expectOk ?? true;
    const phone = fields.phone ?? randomSenegalPhone('77');
    const headers = fields.headers ?? {};
    const since = getFakes().sms.messagesTo(phone).length;
    const start = await registerStart(phone, headers);
    if (expectOk) assert.equal(start.status, 200, `inscription (démarrage) : HTTP ${start.status} ${JSON.stringify(start.body).slice(0, 400)}`);
    const code = start.status === 200 ? lastSmsCode(phone, since) : null;
    if (expectOk) assert.ok(code, `inscription : aucun code à 6 chiffres reçu par SMS au ${phone} après le démarrage`);
    if (start.status !== 200 || !code) return { phone, start, code, register: null, userId: null };
    const body: Record<string, unknown> = {
        phone, code,
        firstName: fields.firstName ?? 'Aminata',
        lastName: fields.lastName ?? 'Inscrite',
        password: fields.password ?? STRONG_PASSWORD,
    };
    if (fields.email !== undefined) body.email = fields.email;
    if (fields.referralCode !== undefined) body.referralCode = fields.referralCode;
    const register = await registerSubmit(body, headers);
    if (expectOk) assert.equal(register.status, 200, `inscription (code et profil) : HTTP ${register.status} ${JSON.stringify(register.body).slice(0, 400)}`);
    const userId = typeof register.body.userId === 'string' ? register.body.userId : null;
    if (expectOk) assert.ok(userId, `inscription : userId absent de la réponse ${JSON.stringify(register.body).slice(0, 400)}`);
    return { phone, start, code, register, userId };
}

/** Adresse email neuve de test (randomEmail des parcours), pour une inscription avec email. */
export function newRegisterEmail(label = 'lot7'): string {
    return randomEmail(`inscr-${label}`);
}

// ── Administration ─────────────────────────────────────────────────────────

/**
 * Compte ADMIN neuf (défaut) ou SUPERADMIN avec exactement les permissions données (admin_permissions),
 * rôle dans user_roles (newAdmin du lot 6) ; compte ACTIF, jeton de session dans `accessToken`.
 */
export async function newAdminWith(perms: string[], opts: { role?: 'ADMIN' | 'SUPERADMIN'; label?: string } = {}): Promise<TestAdmin> {
    return newAdmin(opts.label ?? `lot7-${randomUUID().slice(0, 6)}`, perms, { role: opts.role });
}
