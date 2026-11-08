/**
 * Lot 7, tâche 7.1 — version du secret du billet et codes déjà téléchargés (contrat section 5.1,
 * « hors-ligne-rotation », D3, D27, D28, D32 ; M4 ; M5 étapes 5 et ticket_cash_checkin ; écrivain W5).
 *
 * Règle de la consigne : un transfert, une annulation ou une régénération du secret rend les codes déjà
 * téléchargés invalides ; le scan d'un code d'une ancienne version donne le résultat existant d'un QR dont
 * le code ne se vérifie pas (qr_expired, D3), sauf billet ou événement annulé ou remboursé, dont le statut
 * est contrôlé avant la version (event_cancelled, cancelled, refunded).
 *
 *  1. lot téléchargé, puis transfert accepté : le code du pas courant de l'ancien lot → qr_expired, billet
 *     non composté, historique (version 2, TRANSFER, nouveau porteur) ; le lot du nouveau porteur passe ;
 *  2. lot, puis event_cancel : ancien code → event_cancelled, version + 1 (CANCEL) ;
 *  3. lot, puis ticket_refund_request (billet payé) : ancien code → refunded, version + 1 (REFUND) ;
 *  4. lot, puis ticket_secret_rotate : ancien code → qr_expired, version + 1 (REGENERATE), nouveau lot accepté ;
 *  5. ticket_scan appelé directement avec totp_ok = true : secret_version = ancienne version → qr_expired ;
 *     sans secret_version → qr_expired (D32, fail-closed) ; témoin : version courante → valid ;
 *  6. COURSE RÉELLE (premier test rouge du groupe) : la connexion A tient ticket_transfer_accept sans COMMIT ;
 *     la route de scan lit le secret sans verrou (ancien secret, A n'a pas validé), vérifie le code en Node,
 *     puis attend le verrou du billet dans ticket_scan (attente constatée dans pg_stat_activity, bloquée par A) ;
 *     COMMIT de A ; attendu : qr_expired, billet non composté, ligne de scan en version 1 ;
 *  7. VALIDE → UTILISE ne fait pas tourner la version : second scan du même code → already_used ;
 *  8. trigger : UPDATE de totp_secret → version + 1 (secret posé gardé) ; security_version + 2 → TK409 ;
 *     security_version + 1 → nouveau secret tiré ;
 * 10. reprise : chaque billet de la base a une ligne d'historique de sa version courante.
 *
 * Pourquoi rouge aujourd'hui :
 *  - 1 à 4 : la route GET /api/tickets/[id]/offline-codes n'existe pas (échec « route des codes hors ligne
 *    absente ») ; ensuite ticket_secret_versions (M4) est absente, aucun trigger ne fait tourner la version à
 *    l'annulation ni au remboursement, ticket_secret_rotate n'existe pas ;
 *  - 5 : ticket_scan (20261102000002_lot5_dette.sql:811-814) ne regarde que totp_ok : les deux appels
 *    composteraient le billet (valid) ;
 *  - 6 : app/api/controller/scan/route.ts:109-111 lit totp_secret sans verrou et n'envoie que totp_ok ;
 *    ticket_scan verrouille ensuite le billet (:798), le trouve VALIDE et l'accepte avec un code de
 *    l'ancienne version (violation de (p)) ;
 *  - 8 : aucun trigger sur tickets ; 10 : table d'historique absente ;
 *  - 7 : VERT dès l'écriture (couverture ajoutée) : garde-fou qui détecte un trigger qui tournerait au
 *    compostage (le second scan donnerait qr_expired au lieu de already_used).
 * Fin de suite : assertTerrainInvariants (rouge tant que M4 et M5 manquent, objets nommés).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { inspect } from '../helpers/db';
import { markPhoneVerified } from './notif-helpers';
import { advanceEventTo } from './cycle-helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed } from './finance-helpers';
import {
    newController, newScanKey, scan, scansOf, ticketPayload, ticketRow,
    type RouteResult,
} from './acces-helpers';
import {
    assertTerrainInvariants, codeAt, createOfflineEvent, downloadOfflineCodes, issueFreeTicket, openConcurrentClient,
    waitForLockWaiters, type OfflineEvent, type OfflineLot,
} from './terrain-helpers';

type Row = Record<string, unknown>;

after(async () => {
    await assertTerrainInvariants('hors-ligne-rotation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

/** Lot de codes du porteur, téléchargé par la route (200 exigé). */
async function downloadLot(user: Buyer, ticketId: string, label: string): Promise<OfflineLot> {
    const r = await downloadOfflineCodes(user, ticketId);
    assert.equal(r.status, 200, `${label} : téléchargement des codes hors ligne ${show(r)}`);
    return r.body as unknown as OfflineLot;
}

/** Charge utile du QR du pas courant, prise dans le lot (le lot doit couvrir l'instant présent). */
function currentPayload(lot: OfflineLot, label: string, at: number = Date.now()): string {
    const c = codeAt(lot, at);
    assert.ok(c, `${label} : le lot ne couvre pas l'instant présent (premier pas ${lot.first_step_at}, dernier ${lot.last_step_at})`);
    return c.payload;
}

async function securityVersion(ticketId: string): Promise<number> {
    return Number((await ticketRow(ticketId)).security_version);
}

interface HistoryRow { version: number; holder_user_id: string | null; reason: string }

/** Historique des versions du secret (M4) ; table absente : échec nommé, jamais une erreur Postgres brute. */
async function historyOf(ticketId: string): Promise<HistoryRow[]> {
    try {
        return await inspect(async (db) => (await db.query<HistoryRow>(
            `SELECT version, holder_user_id::text AS holder_user_id, reason
               FROM public.ticket_secret_versions WHERE ticket_id = $1 ORDER BY version`, [ticketId])).rows);
    } catch (err) {
        if ((err as { code?: string }).code === '42P01') {
            assert.fail('table public.ticket_secret_versions absente (contrat M4, migration 20261105000004, fix(7.1s))');
        }
        throw err;
    }
}

/** Dernière ligne de l'historique : version, porteur et motif attendus. */
async function assertRotated(ticketId: string, version: number, reason: string, holder: string | null, label: string): Promise<void> {
    assert.equal(await securityVersion(ticketId), version, `${label} : tickets.security_version = ${version}`);
    const rows = await historyOf(ticketId);
    const last = rows[rows.length - 1];
    assert.ok(last, `${label} : aucune ligne dans ticket_secret_versions`);
    assert.deepEqual({ version: Number(last.version), reason: last.reason, holder: last.holder_user_id },
        { version, reason, holder }, `${label} : dernière ligne de l'historique (${JSON.stringify(rows)})`);
    assert.deepEqual(rows.map((r) => Number(r.version)), Array.from({ length: version }, (_, i) => i + 1),
        `${label} : une ligne par version, sans trou (${JSON.stringify(rows)})`);
}

async function assertNotConsumed(ticketId: string, status: string, label: string): Promise<void> {
    const t = await ticketRow(ticketId);
    assert.equal(t.status, status, `${label} : statut du billet ${t.status}, attendu ${status}`);
    assert.equal(t.checked_in_at, null, `${label} : billet non composté`);
    const accepted = (await scansOf(ticketId)).filter((s) => s.accepted === true);
    assert.deepEqual(accepted, [], `${label} : aucune ligne ticket_scans acceptée`);
}

/** Transfert PENDING initié par la RPC (contrat B6 du lot 6) vers le numéro vérifié du destinataire. */
async function initiateTransfer(ticketId: string, owner: Buyer, recipient: Buyer): Promise<string> {
    await markPhoneVerified(recipient.userId);
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: owner.userId, recipient: recipient.phoneE164, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    const r = (data ?? {}) as Row;
    assert.equal(r.ok, true, `transfert refusé : ${JSON.stringify(r)}`);
    return String(r.transfer_id);
}

async function acceptTransfer(transferId: string, recipient: Buyer): Promise<void> {
    const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: recipient.userId } });
    assert.equal(error, null, `ticket_transfer_accept : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `acceptation refusée : ${JSON.stringify(data)}`);
}

/** Transfert complet (initiation puis acceptation) vers un destinataire neuf ; renvoie le destinataire. */
async function transferTo(ticketId: string, owner: Buyer, label: string): Promise<Buyer> {
    const recipient = await newBuyer(`hl-dest-${label}`, { firstName: 'Mariama', lastName: 'Destinataire' });
    await acceptTransfer(await initiateTransfer(ticketId, owner, recipient), recipient);
    return recipient;
}

/** Événement à venir (scan ouvert), billet gratuit d'un porteur neuf, contrôleur affecté. */
async function scannable(label: string, opts: Parameters<typeof createOfflineEvent>[1] = {}): Promise<OfflineEvent & { controller: Buyer }> {
    const off = await createOfflineEvent(label, opts);
    const controller = await newController(off.partner, off.eventId, { label: `hl-${label}` });
    return { ...off, controller };
}

function camera(controller: Buyer, eventId: string, payload: string): Promise<RouteResult> {
    return scan(controller, { eventId, payload });
}

/** Appel direct de ticket_scan (service_role), comme la route après la vérification du code en Node. */
async function directScan(p: Row): Promise<Row> {
    const { data, error } = await service.rpc('ticket_scan', { p });
    assert.equal(error, null, `ticket_scan : ${error?.message}`);
    return (data ?? {}) as Row;
}

function payloadHash(): string {
    return randomBytes(32).toString('hex');
}

// ── 1 à 4 : rotation après téléchargement ─────────────────────────────────

describe('7.1 Codes téléchargés invalidés par la rotation de la version du secret', () => {
    test('1. lot téléchargé puis transfert accepté : code courant de l’ancien lot → qr_expired, billet non composté, historique TRANSFER ; lot du nouveau porteur accepté', async () => {
        const off = await scannable('transfert');
        const ticketId = off.ticketId!;
        const holder = off.holder!;
        const totp = await importModule('../../lib/security/totp');
        const oldSecret = String((await ticketRow(ticketId)).totp_secret);
        const lot = await downloadLot(holder, ticketId, 'porteur avant transfert');
        assert.equal(lot.secret_version, 1, `lot de la version 1 : ${JSON.stringify({ secret_version: lot.secret_version })}`);
        const at = Date.now();
        const c = codeAt(lot, at);
        assert.ok(c, 'le lot couvre l’instant présent');
        assert.equal(c.code, totp.generateTicketCode(ticketId, oldSecret, new Date(at)), 'le lot porte les codes du secret courant');

        const recipient = await transferTo(ticketId, holder, 'transfert');
        const r = await camera(off.controller, off.eventId, currentPayload(lot, 'ancien lot'));
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'qr_expired', `code de l’ancien lot après le transfert : ${show(r)}`);
        await assertNotConsumed(ticketId, 'VALIDE', 'ancien lot après transfert');
        assert.equal((await ticketRow(ticketId)).user_id, recipient.userId, 'le billet est au destinataire');
        await assertRotated(ticketId, 2, 'TRANSFER', recipient.userId, 'transfert');

        const fresh = await downloadLot(recipient, ticketId, 'nouveau porteur');
        assert.equal(fresh.secret_version, 2, 'lot du nouveau porteur en version 2');
        const ok = await camera(off.controller, off.eventId, currentPayload(fresh, 'nouveau lot'));
        assert.equal(ok.body.result, 'valid', `code du lot du nouveau porteur : ${show(ok)}`);
    });

    test('2. lot téléchargé puis event_cancel : ancien code → event_cancelled, version + 1 (CANCEL)', async () => {
        const off = await scannable('annulation');
        const ticketId = off.ticketId!;
        const lot = await downloadLot(off.holder!, ticketId, 'avant annulation');
        await advanceEventTo(off.eventId, 'ANNULE');
        assert.equal((await ticketRow(ticketId)).status, 'ANNULE', 'billet gratuit annulé par event_cancel');
        await assertRotated(ticketId, 2, 'CANCEL', off.holder!.userId, 'annulation de l’événement');
        const r = await camera(off.controller, off.eventId, currentPayload(lot, 'lot avant annulation'));
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'event_cancelled', `statut contrôlé avant la version (D3) : ${show(r)}`);
        await assertNotConsumed(ticketId, 'ANNULE', 'événement annulé');
    });

    test('3. lot téléchargé puis ticket_refund_request (billet payé) : ancien code → refunded, version + 1 (REFUND)', async () => {
        const off = await scannable('remboursement', { categories: [{ name: 'Payant', price: 3000, total: 20 }], holder: null });
        const buyer = await newBuyer('hl-rembourse');
        const purchase = await buyConfirmed(buyer, off.ev, [['Payant', 1]]);
        assert.equal(purchase.tickets.length, 1, 'un billet payé émis');
        const ticketId = String(purchase.tickets[0].id);
        const lot = await downloadLot(buyer, ticketId, 'billet payé');
        const { data, error } = await service.rpc('ticket_refund_request', {
            p_ticket_id: ticketId, p_actor: off.partner.userId, p_reason: 'Remboursement après téléchargement des codes (lot 7)',
        });
        assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, `remboursement refusé : ${JSON.stringify(data)}`);
        const status = String((await ticketRow(ticketId)).status);
        assert.ok(['REMBOURSEMENT_EN_COURS', 'REMBOURSE'].includes(status), `billet en remboursement (${status})`);
        await assertRotated(ticketId, 2, 'REFUND', buyer.userId, 'remboursement');
        const r = await camera(off.controller, off.eventId, currentPayload(lot, 'lot avant remboursement'));
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'refunded', `statut contrôlé avant la version (D3) : ${show(r)}`);
        await assertNotConsumed(ticketId, status, 'billet remboursé');
    });

    test('4. lot téléchargé puis ticket_secret_rotate : ancien code → qr_expired, version + 1 (REGENERATE), nouveau lot accepté', async () => {
        const off = await scannable('regeneration');
        const ticketId = off.ticketId!;
        const holder = off.holder!;
        const oldSecret = String((await ticketRow(ticketId)).totp_secret);
        const lot = await downloadLot(holder, ticketId, 'avant régénération');
        const { data, error } = await service.rpc('ticket_secret_rotate', { p: { ticket_id: ticketId, reason: 'REGENERATE' } });
        assert.equal(error, null, `ticket_secret_rotate (contrat M4.4, D28, fix(7.1s)) : ${error?.code} ${error?.message}`);
        assert.deepEqual({ ok: (data as Row | null)?.ok, secret_version: (data as Row | null)?.secret_version }, { ok: true, secret_version: 2 },
            `réponse de ticket_secret_rotate : ${JSON.stringify(data)}`);
        assert.notEqual(String((await ticketRow(ticketId)).totp_secret), oldSecret, 'nouveau secret tiré');
        await assertRotated(ticketId, 2, 'REGENERATE', holder.userId, 'régénération');
        const r = await camera(off.controller, off.eventId, currentPayload(lot, 'lot avant régénération'));
        assert.equal(r.body.result, 'qr_expired', `ancien code après régénération : ${show(r)}`);
        await assertNotConsumed(ticketId, 'VALIDE', 'régénération');
        const fresh = await downloadLot(holder, ticketId, 'après régénération');
        assert.equal(fresh.secret_version, 2, 'nouveau lot en version 2');
        const ok = await camera(off.controller, off.eventId, currentPayload(fresh, 'nouveau lot'));
        assert.equal(ok.body.result, 'valid', `code du nouveau lot : ${show(ok)}`);
    });

    test('4 bis. ticket_secret_rotate : billet inconnu → TICKET_NOT_FOUND ; billet non VALIDE → TICKET_NOT_VALID, version inchangée', async () => {
        const off = await scannable('regeneration-refus');
        const ticketId = off.ticketId!;
        const unknown = await service.rpc('ticket_secret_rotate', { p: { ticket_id: '00000000-0000-4000-8000-000000000000' } });
        assert.equal(unknown.error, null, `ticket_secret_rotate (contrat M4.4) : ${unknown.error?.code} ${unknown.error?.message}`);
        assert.deepEqual({ ok: (unknown.data as Row).ok, code: (unknown.data as Row).code }, { ok: false, code: 'TICKET_NOT_FOUND' }, JSON.stringify(unknown.data));
        const used = await camera(off.controller, off.eventId, await ticketPayload(ticketId));
        assert.equal(used.body.result, 'valid', show(used));
        const refused = await service.rpc('ticket_secret_rotate', { p: { ticket_id: ticketId } });
        assert.equal(refused.error, null, `ticket_secret_rotate : ${refused.error?.message}`);
        assert.deepEqual({ ok: (refused.data as Row).ok, code: (refused.data as Row).code }, { ok: false, code: 'TICKET_NOT_VALID' }, JSON.stringify(refused.data));
        assert.equal(await securityVersion(ticketId), 1, 'billet UTILISE : version inchangée');
    });
});

// ── 5 : appel direct de ticket_scan ───────────────────────────────────────

describe('7.1 ticket_scan contrôle la version sous verrou (M5 étape 5, D32)', () => {
    test('5. totp_ok = true avec secret_version ancienne → qr_expired ; sans secret_version → qr_expired ; témoin : version courante → valid', async () => {
        const off = await scannable('appel-direct');
        const holder = off.holder!;
        const rotated = off.ticketId!;
        const missing = await issueFreeTicket(off.eventId, off.categoryId, holder);
        const witness = await issueFreeTicket(off.eventId, off.categoryId, holder);
        await transferTo(rotated, holder, 'appel-direct');
        assert.equal(await securityVersion(rotated), 2, 'précondition : billet transféré en version 2');
        const base = { scanner_id: off.controller.userId, event_id: off.eventId, method: 'QR', totp_ok: true };

        const old = await directScan({ ...base, ticket_id: rotated, secret_version: 1, payload_hash: payloadHash(), client_key: newScanKey() });
        assert.equal(old.result, 'qr_expired', `secret_version 1 sur un billet en version 2 : ${JSON.stringify(old)}`);
        await assertNotConsumed(rotated, 'VALIDE', 'ancienne version');

        const none = await directScan({ ...base, ticket_id: missing, payload_hash: payloadHash(), client_key: newScanKey() });
        assert.equal(none.result, 'qr_expired', `secret_version absent (fail-closed, D32) : ${JSON.stringify(none)}`);
        await assertNotConsumed(missing, 'VALIDE', 'version absente');

        const ok = await directScan({ ...base, ticket_id: witness, secret_version: 1, payload_hash: payloadHash(), client_key: newScanKey() });
        assert.equal(ok.result, 'valid', `témoin : version courante (1) : ${JSON.stringify(ok)}`);
    });
});

// ── 6 : course réelle entre la lecture du secret et le verrou du billet ───

describe('7.1 Course : la route lit le secret sans verrou, le transfert est validé avant le verrou de ticket_scan', () => {
    test('6. A tient ticket_transfer_accept ; le scan d’un code de l’ancienne version attend le verrou du billet ; après le COMMIT de A → qr_expired, billet non composté', async () => {
        const off = await scannable('course');
        const ticketId = off.ticketId!;
        const holder = off.holder!;
        const recipient = await newBuyer('hl-dest-course', { firstName: 'Mariama', lastName: 'Destinataire' });
        const transferId = await initiateTransfer(ticketId, holder, recipient);
        assert.equal(await securityVersion(ticketId), 1, 'précondition : version 1');
        const payload = await ticketPayload(ticketId);

        const a = await openConcurrentClient({ applicationName: 'ev-test-hl-course' });
        let pending: Promise<RouteResult> | null = null;
        let failure: unknown = null;
        try {
            const acc = await a.query<{ r: Row }>('SELECT public.ticket_transfer_accept($1::jsonb) AS r',
                [JSON.stringify({ transfer_id: transferId, actor_id: recipient.userId })]);
            assert.equal(acc.rows[0]?.r?.ok, true, `acceptation tenue par A : ${JSON.stringify(acc.rows[0]?.r)}`);
            // La route lit le secret validé (ancien, A n'a pas validé) puis attend le verrou du billet dans ticket_scan.
            pending = camera(off.controller, off.eventId, payload);
            const waiters = await waitForLockWaiters({ queryLike: 'ticket_scan' }, 15_000);
            const blocked = await inspect(async (db) => (await db.query<{ pid: number }>(
                'SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [a.pid])).rows.map((r) => Number(r.pid)));
            assert.ok(waiters.some((w) => blocked.includes(w.pid)),
                `ticket_scan doit attendre le verrou tenu par A (pid ${a.pid}) : attentes ${JSON.stringify(waiters)}, bloqués par A ${JSON.stringify(blocked)}`);
            await a.commit();
        } catch (err) {
            failure = err;
        } finally {
            await a.close();
        }
        const r = pending ? await pending : null;
        if (failure) throw failure;
        assert.ok(r, 'scan lancé');
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'qr_expired',
            `code de la version 1 vérifié par la route avant la rotation, billet en version 2 sous le verrou : ${show(r)} (violation de (p) si accepté)`);
        await assertNotConsumed(ticketId, 'VALIDE', 'course transfert et scan');
        const t = await ticketRow(ticketId);
        assert.equal(t.user_id, recipient.userId, 'le transfert est validé');
        assert.equal(Number(t.security_version), 2, 'version 2 après le transfert');
        const scans = await scansOf(ticketId);
        const last = scans[scans.length - 1];
        assert.ok(last, 'ligne ticket_scans du refus');
        assert.equal(last.result, 'qr_expired', `ligne du refus : ${JSON.stringify(last)}`);
        assert.equal(last.secret_version, 1, `ticket_scans.secret_version = version présentée (1) (contrat M5.3) : ${JSON.stringify(last)}`);
    });
});

// ── 7 à 10 ─────────────────────────────────────────────────────────────────

describe('7.1 Trigger de rotation et reprise (M4.2, M4.3)', () => {
    test('7. VALIDE → UTILISE ne fait pas tourner la version : second scan du même code → already_used', async () => {
        const off = await scannable('compostage');
        const ticketId = off.ticketId!;
        const before = await ticketRow(ticketId);
        const payload = await ticketPayload(ticketId);
        const first = await camera(off.controller, off.eventId, payload);
        assert.equal(first.body.result, 'valid', show(first));
        const second = await camera(off.controller, off.eventId, payload);
        assert.equal(second.body.result, 'already_used', `second scan du même code : ${show(second)}`);
        const afterRow = await ticketRow(ticketId);
        assert.equal(Number(afterRow.security_version), Number(before.security_version), 'version inchangée au compostage');
        assert.equal(afterRow.totp_secret, before.totp_secret, 'secret inchangé au compostage');
    });

    test('8. UPDATE de totp_secret → version + 1 (secret posé gardé) ; security_version + 2 → TK409 ; security_version + 1 → nouveau secret', async () => {
        const off = await createOfflineEvent('trigger');
        const ticketId = off.ticketId!;
        const posed = randomBytes(32).toString('hex');
        const upd = await service.from('tickets').update({ totp_secret: posed }).eq('id', ticketId).select('security_version, totp_secret').single();
        assert.equal(upd.error, null, `UPDATE totp_secret : ${upd.error?.message}`);
        assert.equal(Number(upd.data!.security_version), 2, `changement direct du secret → version + 1 (trigger trg_tickets_secret_guard) : ${JSON.stringify(upd.data)}`);
        assert.equal(upd.data!.totp_secret, posed, 'le secret posé est gardé');
        await assertRotated(ticketId, 2, 'REGENERATE', off.holder!.userId, 'changement du secret');

        const jump = await service.from('tickets').update({ security_version: 4 }).eq('id', ticketId).select('security_version');
        assert.ok(jump.error, `security_version + 2 accepté : ${JSON.stringify(jump.data)}`);
        assert.match(String(jump.error.message), /TK409/, `refus TK409 attendu : ${jump.error.message}`);
        assert.equal(await securityVersion(ticketId), 2, 'version inchangée après le refus');

        const step = await service.from('tickets').update({ security_version: 3 }).eq('id', ticketId).select('security_version, totp_secret').single();
        assert.equal(step.error, null, `security_version + 1 : ${step.error?.message}`);
        assert.equal(Number(step.data!.security_version), 3, 'version 3');
        assert.match(String(step.data!.totp_secret), /^[0-9a-f]{64}$/, 'secret de 64 hexadécimaux');
        assert.notEqual(step.data!.totp_secret, posed, 'nouveau secret tiré quand seule la version avance');
        await assertRotated(ticketId, 3, 'REGENERATE', off.holder!.userId, 'version avancée');
    });

    test('10. reprise : chaque billet a une ligne d’historique de sa version courante', async () => {
        const off = await createOfflineEvent('reprise');
        assert.deepEqual((await historyOf(off.ticketId!)).map((r) => ({ version: Number(r.version), reason: r.reason, holder: r.holder_user_id })),
            [{ version: 1, reason: 'ISSUE', holder: off.holder!.userId }], 'billet émis : ligne ISSUE de la version 1');
        const missing = await inspect(async (db) => (await db.query<{ id: string; security_version: number }>(
            `SELECT t.id::text AS id, t.security_version FROM public.tickets t
              WHERE NOT EXISTS (SELECT 1 FROM public.ticket_secret_versions h WHERE h.ticket_id = t.id AND h.version = t.security_version)
              ORDER BY t.id LIMIT 20`)).rows);
        assert.deepEqual(missing, [], `billets sans ligne d’historique pour leur version courante : ${JSON.stringify(missing)}`);
    });
});
