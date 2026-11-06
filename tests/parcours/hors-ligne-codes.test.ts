/**
 * Lot 7, tâche 7.1 — route GET /api/tickets/[id]/offline-codes (contrat 3.1, section 5.1
 * « hors-ligne-codes », M4.5 à M4.8, D29 à D31, D37, D38 ; écrivain W5).
 *
 *  1. 401 sans session ; 403 compte SUSPENDU ; 404 billet d'un autre, UUID inconnu, id non UUID (même corps) ;
 *  2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING ;
 *  3. fenêtre à l'heure réelle : début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec
 *     available_from ; fin passée avec access.scan_window_after_hours = 0 → 409 (témoin à 6 h : 200) ;
 *  4. bornes à la seconde par ticket_offline_grant avec p.now (jamais la route) : début − 24 h − 1 s refusé,
 *     début − 24 h admis, fin + after admis, + 1 s refusé ; now passé → INVALID_NOW ;
 *  5. contenu : codes.length = 6 × count, first_counter = floor(first_step_at / 20 s), count ≤ 8 641, champs
 *     dérivés (last_step_at, valid_until, expires_at, scan_*), 30 indices au hasard égaux au code calculé et
 *     vérifiés par verifyTicketCode à leur instant ; le code de l'indice courant scanné par la route → valid ;
 *  6. aucun secret : ni totp_secret, ni 64 hexadécimaux, ni le secret lu en base ; Cache-Control: no-store ;
 *  7. taille : événement de 3 jours, before = after = 48 : 8 640 codes, complete = false,
 *     next_from = valid_until, refresh_after = valid_until − 24 h, gzip < 40 000 octets ; soirée par défaut :
 *     complete = true ; tailles imprimées [HORS-LIGNE-TAILLE] ;
 *  8. quotas (rafale alignée sur une fenêtre de 3 600 s) : par billet (3) et par compte (3), 4ᵉ → 429
 *     RATE_LIMITED + Retry-After, aucune ligne de journal pour le refus ;
 *  9. journal ticket_offline_downloads : une ligne par 200 (porteur, billet, événement, version, heure,
 *     plage, instantané complet), aucune pour 404 et 409 ; aucune colonne ne contient un code servi ;
 * 10. statique : la route ne lit ni searchParams ni en-tête, n'appelle issueOfflineCodes qu'avec
 *     { ticketId, userId } ; le service ne transmet aucun now à la RPC ;
 * 11. GET /api/tickets : offline { secret_version, available, available_from, available_until, reason } ;
 * 12. ticket_secret_versions et ticket_offline_downloads : RLS activée, aucune politique, aucun privilège
 *     pour anon et authenticated ; lecture et écriture refusées par REST avec la clé anon (anonyme et porteur).
 *
 * Lot 8, tâche 8.2 x (contrat 3.7, section 12.3, T18) : compression gzip dans la route (next start 14.2.35 ne compresse
 * aucune route API). Le test 7 garde son seuil : il mesure un gzip calculé par le test, pas le réseau.
 * 13. avec Accept-Encoding: gzip : corps gzip, Content-Encoding, Vary, no-store, type JSON ; décompressé, il est
 *     exactement le JSON de la route ;
 * 14. sans gzip accepté : JSON brut, aucun Content-Encoding (témoin, vert aujourd'hui, garde-fou de la non-régression) ;
 * 15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON, [HORS-LIGNE-TRANSFERE].
 * Rouges jusqu'à fix(8.2x) : 13 et 15, la route ne lit pas Accept-Encoding et sert 52 Ko de JSON.
 *
 * Rouge aujourd'hui : la route n'existe pas (downloadOfflineCodes échoue « route des codes hors ligne
 * absente ») ; ticket_offline_grant, ticket_offline_downloads, ticket_secret_versions (M4) n'existent pas ;
 * GET /api/tickets ne renvoie aucun champ offline (app/api/tickets/route.ts:95-118). Aucun cas n'est vert.
 * Fin de suite : assertTerrainInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { advanceEventTo } from './cycle-helpers';
import { routeContext } from './helpers';
import { withEnv } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { authed, newController, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import {
    alignQuotaWindow, assertSameQuotaWindow, assertTerrainInvariants, codeAt, createOfflineEvent, downloadOfflineCodes,
    getPlatformSetting, issueFreeTicket, withSettings as withPlatformSettings, type OfflineDownload, type OfflineLot,
} from './terrain-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const HOUR = 3600_000;
const STEP_MS = 20_000;
const ROUTE_FILE = 'app/api/tickets/[id]/offline-codes/route.ts';
const SERVICE_FILE = 'lib/tickets/offline-codes.service.ts';
const ROUTE_MODULE = '../../app/api/tickets/[id]/offline-codes/route';

after(async () => {
    await assertTerrainInvariants('hors-ligne-codes');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult | OfflineDownload): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

function ms(v: unknown, what: string): number {
    const t = Date.parse(String(v));
    assert.ok(Number.isFinite(t), `${what} : date ISO attendue, reçu ${JSON.stringify(v)}`);
    return t;
}

async function lotOf(user: Buyer, ticketId: string, label: string): Promise<OfflineLot> {
    const r = await downloadOfflineCodes(user, ticketId);
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    return r.body as unknown as OfflineLot;
}

async function expectRefusal(r: OfflineDownload, status: number, code: string, label: string): Promise<void> {
    assert.equal(r.status, status, `${label} : ${show(r)}`);
    assert.equal(r.body.code, code, `${label} : code ${code} attendu, ${show(r)}`);
    assert.equal(typeof r.body.error, 'string', `${label} : message d'erreur en français attendu, ${show(r)}`);
    assert.ok(!('codes' in r.body), `${label} : aucun code dans un refus`);
}

async function accessHours(): Promise<{ before: number; after: number }> {
    return {
        before: Number(await getPlatformSetting('access.scan_window_before_hours')),
        after: Number(await getPlatformSetting('access.scan_window_after_hours')),
    };
}

async function downloadsOf(ticketId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_offline_downloads').select('*').eq('ticket_id', ticketId).order('downloaded_at');
    assert.equal(error, null, `journal ticket_offline_downloads (contrat M4.5, fix(7.1s)) : ${error?.code} ${error?.message}`);
    return (data ?? []) as Row[];
}

async function grant(p: Row): Promise<Row> {
    const { data, error } = await service.rpc('ticket_offline_grant', { p });
    assert.equal(error, null, `ticket_offline_grant (contrat M4.7, fix(7.1s)) : ${error?.code} ${error?.message}`);
    return (data ?? {}) as Row;
}

async function initiateTransfer(ticketId: string, owner: Buyer): Promise<string> {
    const recipient = await newBuyer('hl-codes-dest');
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: owner.userId, recipient: recipient.phoneE164, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `transfert refusé : ${JSON.stringify(data)}`);
    return String((data as Row).transfer_id);
}

function read(rel: string): string {
    const abs = path.resolve(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (contrat 5.1, fix(7.1s))`);
    return fs.readFileSync(abs, 'utf8');
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Toutes les chaînes d'une valeur JSON (récursif). */
function strings(v: unknown, out: string[] = []): string[] {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
    else if (v && typeof v === 'object') Object.values(v as Row).forEach((x) => strings(x, out));
    else if (typeof v === 'number') out.push(String(v));
    return out;
}

// ── 1. Accès ───────────────────────────────────────────────────────────────

describe('7.1 GET /api/tickets/[id]/offline-codes : accès', () => {
    test('1. 401 sans session ; 403 compte SUSPENDU ; 404 même corps pour le billet d’un autre, un UUID inconnu et un id non UUID', async () => {
        const off = await createOfflineEvent('acces');
        const ticketId = off.ticketId!;
        const anonymous = await downloadOfflineCodes(null, ticketId);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);

        const suspended = await createOfflineEvent('acces-suspendu');
        const { error: sErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.holder!.userId);
        assert.equal(sErr, null, `suspension : ${sErr?.message}`);
        const refused = await downloadOfflineCodes(suspended.holder!, suspended.ticketId!);
        assert.equal(refused.status, 403, `compte SUSPENDU : ${show(refused)}`);
        assert.equal(refused.body.code, 'ACCOUNT_NOT_ACTIVE', show(refused));

        const other = await newBuyer('hl-codes-autre');
        const notMine = await downloadOfflineCodes(other, ticketId);
        const unknown = await downloadOfflineCodes(other, '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01');
        const notUuid = await downloadOfflineCodes(other, 'pas-un-uuid');
        for (const [label, r] of [['billet d’un autre', notMine], ['UUID inconnu', unknown], ['id non UUID', notUuid]] as const) {
            await expectRefusal(r, 404, 'TICKET_NOT_FOUND', label);
        }
        assert.deepEqual(notMine.body, unknown.body, 'même corps pour le billet d’un autre et un UUID inconnu (aucun oracle)');
        assert.deepEqual(notUuid.body, unknown.body, 'même corps pour un id non UUID');
        assert.equal((await downloadsOf(ticketId)).length, 0, 'aucun téléchargement journalisé pour ces refus');
    });

    test('2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING', async () => {
        const used = await createOfflineEvent('utilise');
        const controller = await newController(used.partner, used.eventId, { label: 'hl-codes' });
        const s = await scan(controller, { eventId: used.eventId, payload: await ticketPayload(used.ticketId!) });
        assert.equal(s.body.result, 'valid', `compostage préalable : ${show(s)}`);
        await expectRefusal(await downloadOfflineCodes(used.holder!, used.ticketId!), 409, 'TICKET_NOT_VALID', 'billet UTILISE');

        const cancelled = await createOfflineEvent('annule');
        const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: cancelled.ticketId, p_actor: cancelled.partner.userId, p_reason: 'Annulation du billet gratuit (lot 7)' });
        assert.equal(error, null, `annulation du billet : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
        assert.equal((await ticketRow(cancelled.ticketId!)).status, 'ANNULE', 'billet gratuit ANNULE');
        await expectRefusal(await downloadOfflineCodes(cancelled.holder!, cancelled.ticketId!), 409, 'TICKET_NOT_VALID', 'billet ANNULE');

        const suspendedEvent = await createOfflineEvent('evt-suspendu');
        await advanceEventTo(suspendedEvent.eventId, 'SUSPENDU');
        await expectRefusal(await downloadOfflineCodes(suspendedEvent.holder!, suspendedEvent.ticketId!), 409, 'EVENT_NOT_PUBLISHED', 'événement SUSPENDU');

        // Terminé il y a une heure : encore dans la fenêtre [début − 24 h ; fin + 6 h], refusé pour le statut (D30)
        const finished = await createOfflineEvent('evt-termine', { startsInHours: -3, durationHours: 2, status: 'TERMINE' });
        await expectRefusal(await downloadOfflineCodes(finished.holder!, finished.ticketId!), 409, 'EVENT_NOT_PUBLISHED', 'événement TERMINE');

        const pending = await createOfflineEvent('transfert-attente');
        await initiateTransfer(pending.ticketId!, pending.holder!);
        await expectRefusal(await downloadOfflineCodes(pending.holder!, pending.ticketId!), 409, 'TRANSFER_PENDING', 'transfert en attente (D29)');

        for (const off of [used, cancelled, suspendedEvent, finished, pending]) {
            assert.equal((await downloadsOf(off.ticketId!)).length, 0, `aucune ligne de journal pour un refus 409 (D38) : ${off.ticketId}`);
        }
    });
});

// ── 3 et 4. Fenêtre ────────────────────────────────────────────────────────

describe('7.1 Fenêtre de téléchargement [début − 24 h ; fin + access.scan_window_after_hours]', () => {
    test('3. début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec available_from ; fin passée, after = 0 → 409 (témoin after = 6 : 200)', async () => {
        const { after: afterHours } = await accessHours();
        const open = await createOfflineEvent('fenetre-ouverte', { startsInHours: 23.9 });
        const ok = await downloadOfflineCodes(open.holder!, open.ticketId!);
        assert.equal(ok.status, 200, `début dans 23,9 h : ${show(ok)}`);

        const early = await createOfflineEvent('fenetre-pas-encore', { startsInHours: 24.1 });
        const closed = await downloadOfflineCodes(early.holder!, early.ticketId!);
        await expectRefusal(closed, 409, 'OFFLINE_WINDOW_CLOSED', 'début dans 24,1 h');
        assert.equal(ms(closed.body.available_from, 'available_from'), early.startAt.getTime() - 24 * HOUR, `available_from = début − 24 h : ${show(closed)}`);
        assert.equal(ms(closed.body.available_until, 'available_until'), early.endAt.getTime() + afterHours * HOUR, `available_until = fin + ${afterHours} h : ${show(closed)}`);

        const ended = await createOfflineEvent('fenetre-finie', { startsInHours: -3, durationHours: 2 });
        await withPlatformSettings({ 'access.scan_window_after_hours': 6 }, async () => {
            const witness = await downloadOfflineCodes(ended.holder!, ended.ticketId!);
            assert.equal(witness.status, 200, `témoin : fin il y a 1 h, after = 6 h : ${show(witness)}`);
        });
        await withPlatformSettings({ 'access.scan_window_after_hours': 0 }, async () => {
            const late = await downloadOfflineCodes(ended.holder!, ended.ticketId!);
            await expectRefusal(late, 409, 'OFFLINE_WINDOW_CLOSED', 'fin passée, after = 0');
            assert.equal(ms(late.body.available_until, 'available_until'), ended.endAt.getTime(), `available_until = fin : ${show(late)}`);
        });
    });

    test('4. bornes à la seconde (ticket_offline_grant, p.now) : début − 24 h − 1 s refusé, début − 24 h admis, fin + after admis, + 1 s refusé ; now passé → INVALID_NOW', async () => {
        const { after: afterHours } = await accessHours();
        const off = await createOfflineEvent('bornes', { startsInHours: 30, durationHours: 4 });
        const opens = off.startAt.getTime() - 24 * HOUR;
        const closes = off.endAt.getTime() + afterHours * HOUR;
        const at = (t: number) => ({ ticket_id: off.ticketId, user_id: off.holder!.userId, now: new Date(t).toISOString() });

        const tooEarly = await grant(at(opens - 1000));
        assert.deepEqual({ ok: tooEarly.ok, http: tooEarly.http, code: tooEarly.code }, { ok: false, http: 409, code: 'OFFLINE_WINDOW_CLOSED' }, `début − 24 h − 1 s : ${JSON.stringify(tooEarly)}`);
        assert.equal(ms(tooEarly.available_from, 'available_from'), opens, 'available_from = début − 24 h');
        assert.equal(ms(tooEarly.available_until, 'available_until'), closes, `available_until = fin + ${afterHours} h`);

        const first = await grant(at(opens));
        assert.equal(first.ok, true, `début − 24 h admis : ${JSON.stringify(first)}`);
        assert.match(String(first.totp_secret), /^[0-9a-f]{64}$/, 'la RPC rend le secret à Node (jamais au navigateur)');
        assert.equal(first.secret_version, 1, 'version du secret');

        const last = await grant(at(closes));
        assert.equal(last.ok, true, `fin + ${afterHours} h admis : ${JSON.stringify(last)}`);
        assert.ok(Number(last.count) >= 1, `au moins un code à la dernière seconde : ${JSON.stringify(last)}`);

        const tooLate = await grant(at(closes + 1000));
        assert.deepEqual({ ok: tooLate.ok, http: tooLate.http, code: tooLate.code }, { ok: false, http: 409, code: 'OFFLINE_WINDOW_CLOSED' }, `fin + after + 1 s : ${JSON.stringify(tooLate)}`);

        const past = await grant(at(Date.now() - 5 * 60_000));
        assert.deepEqual({ ok: past.ok, code: past.code }, { ok: false, code: 'INVALID_NOW' }, `heure dans le passé : ${JSON.stringify(past)}`);
        assert.equal((await downloadsOf(off.ticketId!)).length, 2, 'deux téléchargements journalisés (les deux admis), aucun pour les refus');
    });
});

// ── 5 à 7. Contenu, secret, taille ─────────────────────────────────────────

describe('7.1 Contenu du lot (contrat 3.1)', () => {
    test('5. format compact, champs dérivés, 30 codes au hasard égaux au code calculé ; le code courant est accepté au scan', async () => {
        const { before: beforeHours, after: afterHours } = await accessHours();
        const off = await createOfflineEvent('contenu');
        const ticketId = off.ticketId!;
        const t0 = Date.now();
        const lot = await lotOf(off.holder!, ticketId, 'téléchargement');
        const t1 = Date.now();
        const t = await ticketRow(ticketId);
        const secret = String(t.totp_secret);

        assert.deepEqual({ ticket_id: lot.ticket_id, secret_version: lot.secret_version, prefix: lot.prefix, step_seconds: lot.step_seconds, digits: lot.digits },
            { ticket_id: ticketId, secret_version: Number(t.security_version), prefix: 'EVT1', step_seconds: 20, digits: 6 }, 'en-tête du lot');
        assert.ok(Number.isInteger(lot.count) && lot.count >= 1 && lot.count <= 8641, `count entre 1 et 8 641 : ${lot.count}`);
        assert.match(lot.codes, /^\d+$/, 'codes : chaîne de chiffres');
        assert.equal(lot.codes.length, 6 * lot.count, 'codes.length = 6 × count');
        const firstStep = ms(lot.first_step_at, 'first_step_at');
        assert.equal(firstStep % STEP_MS, 0, 'first_step_at aligné sur un pas de 20 s');
        assert.equal(lot.first_counter, firstStep / STEP_MS, 'first_counter = floor(first_step_at / 20 s)');
        assert.equal(ms(lot.last_step_at, 'last_step_at'), firstStep + (lot.count - 1) * STEP_MS, 'last_step_at = first_step_at + (count − 1) × 20 s');
        const validUntil = ms(lot.valid_until, 'valid_until');
        assert.equal(validUntil, ms(lot.last_step_at, 'last_step_at') + STEP_MS, 'valid_until = last_step_at + 20 s');
        const scanOpens = off.startAt.getTime() - beforeHours * HOUR;
        const scanCloses = off.endAt.getTime() + afterHours * HOUR;
        assert.equal(ms(lot.scan_opens_at, 'scan_opens_at'), scanOpens, `scan_opens_at = début − ${beforeHours} h`);
        assert.equal(ms(lot.scan_closes_at, 'scan_closes_at'), scanCloses, `scan_closes_at = fin + ${afterHours} h`);
        assert.equal(ms(lot.expires_at, 'expires_at'), Math.min(scanCloses, validUntil), 'expires_at = min(scan_closes_at, valid_until)');
        // v_first = floor(max(scan_opens_at, maintenant − 20 s) / 20 s) × 20 s (contrat M4.7, étape 7), à 1 s près entre Node et la base
        assert.ok(firstStep <= Math.max(scanOpens, t1) + 1000 && firstStep >= Math.max(scanOpens, t0 - 20_000) - STEP_MS - 1000,
            `le lot commence au pas de max(scan_opens_at, maintenant − 20 s) (first_step_at ${lot.first_step_at})`);
        assert.equal(lot.complete, true, 'soirée de 4 h : lot complet');
        assert.equal(lot.next_from, null, 'next_from null pour un lot complet');
        assert.equal(lot.refresh_after, null, 'refresh_after null pour un lot complet');
        const serverTime = ms(lot.server_time, 'server_time');
        assert.ok(serverTime >= t0 - 1000 && serverTime <= t1 + 1000, `server_time = heure de Node à l'envoi (${lot.server_time})`);
        assert.deepEqual({ ticket_number: lot.ticket.ticket_number, event_start_at: ms(lot.ticket.event_start_at, 'ticket.event_start_at') },
            { ticket_number: t.ticket_number, event_start_at: off.startAt.getTime() }, `métadonnées d'affichage : ${JSON.stringify(lot.ticket)}`);
        for (const k of ['category', 'event_title', 'location', 'city']) assert.equal(typeof lot.ticket[k], 'string', `ticket.${k}`);

        const totp = await importModule('../../lib/security/totp');
        const picks = new Set<number>([0, lot.count - 1]);
        while (picks.size < Math.min(30, lot.count)) picks.add(randomInt(0, lot.count));
        for (const i of Array.from(picks)) {
            const code = lot.codes.substr(6 * i, 6);
            const atI = new Date((lot.first_counter + i) * STEP_MS + 10_000);
            assert.equal(code, totp.generateTicketCode(ticketId, secret, atI), `indice ${i} : code du compteur first_counter + ${i}`);
            assert.equal(totp.verifyTicketCode(ticketId, secret, code, atI), true, `indice ${i} : verifyTicketCode à son instant`);
        }

        const controller = await newController(off.partner, off.eventId, { label: 'hl-contenu' });
        const current = codeAt(lot);
        assert.ok(current, 'le lot couvre l’instant présent');
        const r = await scan(controller, { eventId: off.eventId, payload: current.payload });
        assert.equal(r.body.result, 'valid', `code du pas courant pris dans le lot : ${show(r)}`);
    });

    test('6. aucun secret dans la réponse ; Cache-Control: no-store', async () => {
        const off = await createOfflineEvent('secret');
        const r = await downloadOfflineCodes(off.holder!, off.ticketId!);
        assert.equal(r.status, 200, show(r));
        const secret = String((await ticketRow(off.ticketId!)).totp_secret);
        assert.ok(!r.text.includes(secret), 'le secret du billet n’est jamais envoyé au navigateur');
        assert.doesNotMatch(r.text, /totp_secret/i, 'aucun champ totp_secret');
        // La chaîne `codes` n'est faite que de chiffres (donc d'hexadécimaux) : elle est vérifiée à part ; le reste du corps
        // ne contient aucune suite de 64 hexadécimaux (forme d'un secret).
        const { codes, ...rest } = r.body as Row;
        assert.match(String(codes), /^\d+$/, 'codes : chiffres seulement');
        assert.doesNotMatch(JSON.stringify(rest), /[0-9a-f]{64}/i, 'aucune suite de 64 hexadécimaux hors de la chaîne des codes');
        assert.match(r.headers['cache-control'] ?? '', /no-store/, `Cache-Control: no-store (reçu ${r.headers['cache-control']})`);
    });

    test('7. taille : 3 jours avec before = after = 48 → 8 640 codes, lot glissant incomplet, gzip < 40 000 octets ; soirée par défaut complète', async () => {
        await withPlatformSettings({ 'access.scan_window_before_hours': 48, 'access.scan_window_after_hours': 48 }, async () => {
            const off = await createOfflineEvent('taille-3-jours', { startsInHours: 2, durationHours: 72 });
            const r = await downloadOfflineCodes(off.holder!, off.ticketId!);
            assert.equal(r.status, 200, show(r));
            const lot = r.body as unknown as OfflineLot;
            console.log(`[HORS-LIGNE-TAILLE] 3 jours, before = after = 48 h : ${lot.count} codes, ${r.bytes} octets bruts, ${r.gzipBytes} octets gzip (niveau 6)`);
            assert.equal(lot.count, 8640, 'lot glissant de 48 h : 8 640 codes (D31)');
            assert.equal(lot.complete, false, 'lot incomplet : la fermeture du scan est au-delà de 48 h');
            const validUntil = ms(lot.valid_until, 'valid_until');
            assert.equal(ms(lot.next_from, 'next_from'), validUntil, 'next_from = valid_until');
            assert.equal(ms(lot.refresh_after, 'refresh_after'), validUntil - 24 * HOUR, 'refresh_after = valid_until − 24 h');
            assert.ok(r.gzipBytes < 40_000, `corps compressé (gzip 6) sous 40 000 octets : ${r.gzipBytes}`);
        });
        const evening = await createOfflineEvent('taille-soiree');
        const r = await downloadOfflineCodes(evening.holder!, evening.ticketId!);
        assert.equal(r.status, 200, show(r));
        const lot = r.body as unknown as OfflineLot;
        console.log(`[HORS-LIGNE-TAILLE] soirée de 4 h, réglages courants : ${lot.count} codes, ${r.bytes} octets bruts, ${r.gzipBytes} octets gzip (niveau 6)`);
        assert.equal(lot.complete, true, 'soirée : lot complet');
        assert.ok(r.gzipBytes < 40_000, `soirée : ${r.gzipBytes} octets gzip`);
    });
});

// ── 8 et 9. Quotas et journal ──────────────────────────────────────────────

describe('7.1 Quotas et journal des téléchargements', () => {
    test('8. quota par billet puis par compte (3 par heure) : 4ᵉ → 429 RATE_LIMITED + Retry-After, refus non journalisé', async () => {
        const perTicket = await createOfflineEvent('quota-billet');
        await withEnv({ OFFLINE_CODES_PER_TICKET_HOUR: '3' }, async () => {
            const win = await alignQuotaWindow(3600, 60_000);
            const out: OfflineDownload[] = [];
            for (let i = 0; i < 4; i++) out.push(await downloadOfflineCodes(perTicket.holder!, perTicket.ticketId!));
            await assertSameQuotaWindow(win, 'rafale de téléchargements (billet)');
            out.slice(0, 3).forEach((r, i) => assert.equal(r.status, 200, `téléchargement ${i + 1}/3 : ${show(r)}`));
            await expectRefusal(out[3], 429, 'RATE_LIMITED', '4ᵉ téléchargement du même billet');
            const retry = Number(out[3].headers['retry-after']);
            assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= 3600, `Retry-After en secondes (reçu ${out[3].headers['retry-after']})`);
        });
        assert.equal((await downloadsOf(perTicket.ticketId!)).length, 3, 'trois lignes de journal : le 429 n’est pas journalisé (D38)');

        const perUser = await createOfflineEvent('quota-compte');
        const holder = perUser.holder!;
        const tickets = [perUser.ticketId!];
        for (let i = 0; i < 3; i++) tickets.push(await issueFreeTicket(perUser.eventId, perUser.categoryId, holder));
        await withEnv({ OFFLINE_CODES_PER_USER_HOUR: '3' }, async () => {
            const win = await alignQuotaWindow(3600, 60_000);
            const out: OfflineDownload[] = [];
            for (const id of tickets) out.push(await downloadOfflineCodes(holder, id));
            await assertSameQuotaWindow(win, 'rafale de téléchargements (compte)');
            out.slice(0, 3).forEach((r, i) => assert.equal(r.status, 200, `billet ${i + 1}/3 du compte : ${show(r)}`));
            await expectRefusal(out[3], 429, 'RATE_LIMITED', '4ᵉ billet du même compte');
            assert.ok(Number(out[3].headers['retry-after']) >= 1, `Retry-After (reçu ${out[3].headers['retry-after']})`);
        });
        assert.equal((await downloadsOf(tickets[3])).length, 0, 'aucune ligne de journal pour le billet refusé par le quota du compte');
    });

    test('9. une ligne par 200 avec l’instantané de décision, aucune pour 404 et 409 ; aucune colonne ne contient un code servi', async () => {
        const { before: beforeHours, after: afterHours } = await accessHours();
        const off = await createOfflineEvent('journal');
        const ticketId = off.ticketId!;
        const holder = off.holder!;
        const other = await newBuyer('hl-journal-autre');
        await expectRefusal(await downloadOfflineCodes(other, ticketId), 404, 'TICKET_NOT_FOUND', 'autre compte');
        const t0 = Date.now();
        const lot = await lotOf(holder, ticketId, 'porteur');
        const t1 = Date.now();
        await initiateTransfer(ticketId, holder);
        await expectRefusal(await downloadOfflineCodes(holder, ticketId), 409, 'TRANSFER_PENDING', 'transfert en attente');

        const rows = await downloadsOf(ticketId);
        assert.equal(rows.length, 1, `une seule ligne (le 200) : ${JSON.stringify(rows)}`);
        const row = rows[0];
        assert.deepEqual(
            { ticket_id: row.ticket_id, user_id: row.user_id, event_id: row.event_id, secret_version: row.secret_version, codes_count: row.codes_count },
            { ticket_id: ticketId, user_id: holder.userId, event_id: off.eventId, secret_version: lot.secret_version, codes_count: lot.count }, 'ligne du journal');
        const downloadedAt = ms(row.downloaded_at, 'downloaded_at');
        assert.ok(downloadedAt >= t0 - 5000 && downloadedAt <= t1 + 5000, `downloaded_at à l'heure du téléchargement (${row.downloaded_at})`);
        assert.equal(ms(row.first_step_at, 'first_step_at'), ms(lot.first_step_at, 'lot.first_step_at'), 'first_step_at = celui du lot');
        assert.equal(ms(row.last_step_at, 'last_step_at'), ms(lot.last_step_at, 'lot.last_step_at'), 'last_step_at = celui du lot');

        const d = (row.decision ?? {}) as Row;
        assert.deepEqual(
            { holder_user_id: d.holder_user_id, ticket_status: d.ticket_status, event_status: d.event_status, transfer_locked: d.transfer_locked,
              after_hours: Number(d.after_hours), before_hours: Number(d.before_hours) },
            { holder_user_id: holder.userId, ticket_status: 'VALIDE', event_status: 'PUBLIE', transfer_locked: false, after_hours: afterHours, before_hours: beforeHours },
            `instantané de décision : ${JSON.stringify(d)}`);
        const instants: Array<[string, number]> = [
            ['event_start_at', off.startAt.getTime()], ['event_end_at', off.endAt.getTime()],
            ['window_opens_at', off.startAt.getTime() - 24 * HOUR], ['window_closes_at', off.endAt.getTime() + afterHours * HOUR],
            ['scan_opens_at', off.startAt.getTime() - beforeHours * HOUR], ['scan_closes_at', off.endAt.getTime() + afterHours * HOUR],
        ];
        for (const [k, expected] of instants) assert.equal(ms(d[k], `decision.${k}`), expected, `decision.${k}`);

        const columns = Object.keys(row);
        const suspicious = columns.filter((c) => /code|secret|totp/i.test(c) && !['secret_version', 'codes_count'].includes(c));
        assert.deepEqual(suspicious, [], `aucune colonne de code ni de secret : ${columns.join(', ')}`);
        const served = new Set<string>();
        for (let i = 0; i < lot.count; i++) served.add(lot.codes.substr(6 * i, 6));
        const leaked = strings(row).filter((s) => served.has(s) || s.includes(lot.codes.slice(0, 60)) || /^\d{6,}$/.test(s));
        assert.deepEqual(leaked, [], 'aucune valeur du journal ne contient un code servi');
    });
});

// ── 10 à 12 ────────────────────────────────────────────────────────────────

describe('7.1 Contrôles statiques, liste des billets, RLS', () => {
    test('10. statique : la route ne lit ni paramètre ni en-tête d’heure ; issueOfflineCodes({ ticketId, userId }) seulement ; aucun now transmis', () => {
        const route = stripComments(read(ROUTE_FILE));
        assert.doesNotMatch(route, /searchParams|nextUrl/, 'la route ne lit aucun paramètre de requête');
        // Lot 8, consigne x (T39) : seul Accept-Encoding est admis, une seule fois, pour la compression du contrat 3.7.
        // Tout autre en-tête reste refusé : aucune heure ni session n'en vient.
        const acceptEncoding = /\breq\.headers\.get\('accept-encoding'\)/g;
        assert.ok((route.match(acceptEncoding) ?? []).length <= 1, 'Accept-Encoding lu au plus une fois');
        assert.doesNotMatch(route.replace(acceptEncoding, ''), /\.headers\s*\.\s*(get|has|entries|forEach)\s*\(|\bheaders\s*\(\s*\)/, 'la route ne lit aucun autre en-tête (la session est lue par requireActiveSession)');
        assert.match(route, /requireActiveSession\s*\(/, 'session par requireActiveSession');
        assert.match(route, /export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\b/, 'GET exporté');
        const calls = Array.from(route.matchAll(/issueOfflineCodes\s*\(\s*\{([^}]*)\}\s*\)/g));
        assert.equal(calls.length, 1, `un seul appel issueOfflineCodes({ … }) dans la route (trouvé ${calls.length})`);
        const keys = calls[0][1].split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean).sort();
        assert.deepEqual(keys, ['ticketId', 'userId'], `issueOfflineCodes appelé avec { ticketId, userId } seulement (reçu { ${calls[0][1].trim()} })`);
        assert.doesNotMatch(route, /(?<!Date\.)\bnow\b/, 'aucun now dans la route (seul Date.now() est admis, pour server_time)');

        const svc = stripComments(read(SERVICE_FILE));
        assert.match(svc, /export\s+(async\s+)?function\s+issueOfflineCodes\s*\(/, 'issueOfflineCodes exporté par le service');
        assert.match(svc, /ticket_offline_grant/, 'le service appelle ticket_offline_grant');
        assert.doesNotMatch(svc, /['"]?\bnow\b['"]?\s*:/, 'aucun now transmis à la RPC (bornes de test par la RPC seule)');
        const signature = /function\s+issueOfflineCodes\s*\(([^)]*)\)/.exec(svc);
        assert.ok(signature, 'signature de issueOfflineCodes lisible');
        assert.doesNotMatch(signature[1], /\bnow\b/, `issueOfflineCodes n'accepte aucun paramètre now (reçu ${signature[1]})`);
        const totp = stripComments(read('lib/security/totp.ts'));
        assert.match(totp, /export\s+function\s+generateTicketCodes\s*\(/, 'generateTicketCodes(ticketId, secret, firstCounter, count) exporté');
    });

    test('11. GET /api/tickets : champ offline par billet (dans la fenêtre, pas encore ouverte, transfert en attente)', async () => {
        const { after: afterHours } = await accessHours();
        const open = await createOfflineEvent('liste-ouverte');
        const holder = open.holder!;
        const later = await createOfflineEvent('liste-plus-tard', { startsInHours: 30, holder });
        const locked = await createOfflineEvent('liste-transfert', { holder });
        await initiateTransfer(locked.ticketId!, holder);
        const { GET } = await importModule('../../app/api/tickets/route');
        const res: Response = await GET(authed('/api/tickets', 'GET', holder));
        const body = (await res.json()) as { tickets?: Row[] };
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
        const byId = new Map((body.tickets ?? []).map((t) => [String(t.id), t]));
        const offlineOf = (id: string, label: string): Row => {
            const t = byId.get(id);
            assert.ok(t, `${label} : billet absent de la liste`);
            assert.ok(t.offline && typeof t.offline === 'object', `${label} : champ offline absent (contrat 3.2, fix(7.1s)) : ${JSON.stringify(t).slice(0, 300)}`);
            return t.offline as Row;
        };
        const a = offlineOf(open.ticketId!, 'dans la fenêtre');
        assert.deepEqual({ secret_version: a.secret_version, available: a.available, reason: a.reason }, { secret_version: 1, available: true, reason: null }, JSON.stringify(a));
        assert.equal(ms(a.available_from, 'available_from'), open.startAt.getTime() - 24 * HOUR, 'available_from = début − 24 h');
        assert.equal(ms(a.available_until, 'available_until'), open.endAt.getTime() + afterHours * HOUR, `available_until = fin + ${afterHours} h`);
        const b = offlineOf(later.ticketId!, 'fenêtre pas encore ouverte');
        assert.deepEqual({ available: b.available, reason: b.reason }, { available: false, reason: 'NOT_YET' }, JSON.stringify(b));
        assert.equal(ms(b.available_from, 'available_from'), later.startAt.getTime() - 24 * HOUR, 'available_from du billet de plus tard');
        const c = offlineOf(locked.ticketId!, 'transfert en attente');
        assert.deepEqual({ available: c.available, reason: c.reason }, { available: false, reason: 'TRANSFER_PENDING' }, JSON.stringify(c));
    });

    test('12. ticket_secret_versions et ticket_offline_downloads : RLS activée, aucune politique, aucun accès anon ni authenticated (clé anon)', async () => {
        const tables = ['ticket_secret_versions', 'ticket_offline_downloads'];
        const catalog = await inspect(async (db) => (await db.query<{ name: string; rls: boolean | null; policies: number; anon: boolean | null; auth: boolean | null }>(
            `SELECT t.name, c.relrowsecurity AS rls,
                    (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.name) AS policies,
                    CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') END AS anon,
                    CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') END AS auth
               FROM unnest($1::text[]) AS t(name)
               LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || t.name)
              ORDER BY t.name`, [tables])).rows);
        for (const row of catalog) {
            assert.notEqual(row.rls, null, `table public.${row.name} absente (contrat M4, migration 20261105000004, fix(7.1s))`);
            assert.deepEqual({ rls: row.rls, policies: row.policies, anon: row.anon, auth: row.auth },
                { rls: true, policies: 0, anon: false, auth: false }, `public.${row.name} : RLS activée, aucune politique, aucun privilège pour anon et authenticated`);
        }

        const off = await createOfflineEvent('rls');
        const lot = await lotOf(off.holder!, off.ticketId!, 'porteur');
        assert.equal((await downloadsOf(off.ticketId!)).length, 1, 'précondition : une ligne de journal');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const opts = { auth: { persistSession: false, autoRefreshToken: false } };
        const clients: Array<[string, SupabaseClient]> = [
            ['anonyme', createClient(url, anonKey, opts)],
            ['porteur connecté', createClient(url, anonKey, { ...opts, global: { headers: { Authorization: `Bearer ${off.holder!.accessToken}` } } })],
        ];
        for (const [who, client] of clients) {
            for (const table of tables) {
                const sel = await client.from(table).select('*').eq('ticket_id', off.ticketId!);
                assert.ok(sel.error || (sel.data ?? []).length === 0, `${who} lit ${table} : ${JSON.stringify(sel.data).slice(0, 200)}`);
            }
            const ins = await client.from('ticket_offline_downloads').insert({
                ticket_id: off.ticketId, user_id: off.holder!.userId, event_id: off.eventId, secret_version: 1,
                first_step_at: lot.first_step_at, last_step_at: lot.last_step_at, codes_count: 1, decision: {},
            }).select('id');
            assert.ok(ins.error, `${who} écrit dans ticket_offline_downloads : ${JSON.stringify(ins.data)}`);
            const insV = await client.from('ticket_secret_versions').insert({ ticket_id: off.ticketId, version: 99, holder_user_id: off.holder!.userId, reason: 'REGENERATE' }).select('id');
            assert.ok(insV.error, `${who} écrit dans ticket_secret_versions : ${JSON.stringify(insV.data)}`);
        }
        assert.equal((await downloadsOf(off.ticketId!)).length, 1, 'journal inchangé après les tentatives');
    });
});

// ── 13 à 15. Compression du lot (8.2 x) ────────────────────────────────────

describe('8.2 x Compression du lot hors ligne dans la route (contrat 3.7)', () => {
    interface RawDownload { status: number; headers: Record<string, string>; raw: Buffer }

    /** Appel direct de la route : le corps est lu tel que servi, sans décompression par un client HTTP. */
    async function rawDownload(user: Buyer, ticketId: string, acceptEncoding: string | null): Promise<RawDownload> {
        const { GET } = await importModule(ROUTE_MODULE);
        const path = `/api/tickets/${ticketId}/offline-codes`;
        const res: Response = await GET(authed(path, 'GET', user, undefined, acceptEncoding === null ? {} : { 'accept-encoding': acceptEncoding }), routeContext({ id: ticketId }));
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        return { status: res.status, headers, raw: Buffer.from(await res.arrayBuffer()) };
    }

    function assertCompressed(r: RawDownload, label: string): string {
        assert.equal(r.status, 200, `${label} : HTTP ${r.status}`);
        assert.equal(r.headers['content-encoding'], 'gzip', `${label} : Content-Encoding: gzip attendu (contrat 3.7, fix(8.2x)), en-têtes reçus ${JSON.stringify(r.headers)}`);
        assert.match(r.headers.vary ?? '', /accept-encoding/i, `${label} : Vary: Accept-Encoding attendu (reçu ${r.headers.vary})`);
        assert.match(r.headers['cache-control'] ?? '', /no-store/, `${label} : no-store conservé (reçu ${r.headers['cache-control']})`);
        assert.match(r.headers['content-type'] ?? '', /application\/json/, `${label} : réponse JSON (reçu ${r.headers['content-type']})`);
        assert.deepEqual([r.raw[0], r.raw[1]], [0x1f, 0x8b], `${label} : le corps servi est au format gzip`);
        return gunzipSync(r.raw).toString('utf8');
    }

    /** Champs qui ne dépendent pas du pas de 20 s ni de l'heure d'envoi. */
    function stableFields(lot: OfflineLot): Row {
        const { ticket_id, secret_version, prefix, step_seconds, digits, scan_opens_at, scan_closes_at, complete, ticket } = lot;
        return { ticket_id, secret_version, prefix, step_seconds, digits, scan_opens_at, scan_closes_at, complete, ticket };
    }

    test('13. Accept-Encoding: gzip → corps gzip, Vary, no-store ; décompressé, c’est le JSON de la route', async () => {
        const off = await createOfflineEvent('gzip');
        const ticketId = off.ticketId!;
        const plain = await rawDownload(off.holder!, ticketId, null);
        assert.equal(plain.status, 200, `téléchargement sans compression : HTTP ${plain.status}`);
        const packed = await rawDownload(off.holder!, ticketId, 'gzip, deflate, br, zstd');
        const text = assertCompressed(packed, 'navigateur');
        const lot = JSON.parse(text) as OfflineLot;
        assert.equal(text, JSON.stringify(lot), 'le corps décompressé est du JSON compact, sans enveloppe');
        const plainLot = JSON.parse(plain.raw.toString('utf8')) as OfflineLot;
        assert.deepEqual(Object.keys(lot).sort(), Object.keys(plainLot).sort(), 'mêmes champs que la réponse non compressée');
        assert.deepEqual(stableFields(lot), stableFields(plainLot), 'mêmes valeurs que la réponse non compressée');
        assert.equal(lot.codes.length, 6 * lot.count, 'codes.length = 6 × count');
        const totp = await importModule('../../lib/security/totp');
        const secret = String((await ticketRow(ticketId)).totp_secret);
        assert.equal(lot.codes.slice(0, 6), totp.generateTicketCode(ticketId, secret, new Date(lot.first_counter * STEP_MS + 10_000)), 'premier code du lot décompressé = code calculé');
    });

    test('14. sans gzip accepté (en-tête absent, identity, br seul) → JSON brut, aucun Content-Encoding, no-store (témoin)', async () => {
        const off = await createOfflineEvent('sans-gzip');
        for (const [label, header] of [['en-tête absent', null], ['identity', 'identity'], ['br seul', 'br']] as Array<[string, string | null]>) {
            const r = await rawDownload(off.holder!, off.ticketId!, header);
            assert.equal(r.status, 200, `${label} : HTTP ${r.status}`);
            assert.equal(r.headers['content-encoding'], undefined, `${label} : aucune compression (reçu ${r.headers['content-encoding']})`);
            assert.match(r.headers['cache-control'] ?? '', /no-store/, `${label} : no-store conservé`);
            assert.match(r.headers['content-type'] ?? '', /application\/json/, `${label} : réponse JSON`);
            const lot = JSON.parse(r.raw.toString('utf8')) as OfflineLot;
            assert.equal(lot.ticket_id, off.ticketId, `${label} : JSON brut lisible`);
            assert.equal(lot.codes.length, 6 * lot.count, `${label} : codes.length = 6 × count`);
        }
    });

    test('15. lot de 48 h : corps réellement servi sous 40 000 octets, plus petit que le JSON', async () => {
        await withPlatformSettings({ 'access.scan_window_before_hours': 48, 'access.scan_window_after_hours': 48 }, async () => {
            const off = await createOfflineEvent('gzip-3-jours', { startsInHours: 2, durationHours: 72 });
            const r = await rawDownload(off.holder!, off.ticketId!, 'gzip');
            const text = assertCompressed(r, 'lot de 48 h');
            const lot = JSON.parse(text) as OfflineLot;
            const decoded = Buffer.byteLength(text, 'utf8');
            console.log(`[HORS-LIGNE-TRANSFERE] 3 jours, before = after = 48 h : ${lot.count} codes, ${decoded} octets de JSON, ${r.raw.length} octets servis`);
            assert.equal(lot.count, 8640, 'lot glissant de 48 h : 8 640 codes (D31)');
            assert.ok(r.raw.length < 40_000, `corps servi sous 40 000 octets : ${r.raw.length}`);
            assert.ok(r.raw.length < decoded, `corps servi (${r.raw.length}) plus petit que le JSON (${decoded})`);
        });
    });
});
