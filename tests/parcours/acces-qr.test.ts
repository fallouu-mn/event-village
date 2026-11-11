/**
 * Lot 4.1 (contrats C et D) — format du QR, saisie manuelle encadrée, PDF sans QR, partage sans
 * numéro, régénération des identifiants au transfert P2P.
 *  - caméra : tout payload qui n'est pas EVT1:<UUID du billet>:<6 chiffres> (numéro TCK-…, ancien QR
 *    statique EV-QR-…, UUID seul, ancien format sans préfixe) → dynamic_qr_required, billet non composté ;
 *  - parseTicketPayload : EVT1 + UUID + 6 chiffres, rien d'autre ;
 *  - saisie manuelle (corps { eventId, manualTicketNumber, identityVerified }) : identityVerified !== true
 *    → manual_entry_refused ; contrôleur non affecté → 403 SCAN_FORBIDDEN (étape 2 du contrat, avant
 *    toute lecture du billet) ; scanneur hors du périmètre réglé (access.manual_entry_scope) →
 *    manual_entry_refused ; saisie valide → valid, marquée MANUAL dans la réponse et dans ticket_scans ;
 *  - transfert P2P : ticket_number, qr_code et totp_secret régénérés ; l'ancien QR et l'ancien numéro
 *    sont refusés, le QR du nouveau porteur passe ;
 *  - PDF : aucun QR (ni image, ni matrice de modules dessinés), numéro du billet et mention de la
 *    pièce d'identité ;
 *  - carte billet : partage WhatsApp / copie sans numéro de billet, avec le lien de l'événement ; QR
 *    affiché = payload du code dynamique, jamais un QR statique.
 * Rouge avant correctif : lib/security/totp.ts:139-154 accepte l'identifiant nu et le format sans
 * préfixe, parseTicketPayload n'existe pas ; app/api/controller/scan/route.ts:14-16 n'accepte que
 * { qr_code } (400 pour le corps du contrat), L401 déduit is_manual_entry du format, aucune table
 * ticket_scans ; lib/tickets/ticket-transfer.service.ts:707-739 ne régénère pas ticket_number ;
 * app/api/tickets/[id]/pdf/route.ts:136 et lib/tickets/ticket-pdf.service.ts:74-75,235-244 dessinent
 * le qr_code statique ; components/tickets/TicketCard.tsx:71,122-140,313-320 (QR statique par défaut,
 * numéro partagé sur WhatsApp et copié).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { confirmPassword, routeContext, STRONG_PASSWORD } from './helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { markPhoneVerified } from './notif-helpers';
import {
    authed, createTimedEvent, newController, scan, scansOf, ticketPayload, ticketRow, withAccessSettings, type RouteResult,
} from './acces-helpers';

type Row = Record<string, unknown>;

const CATEGORY = `Pelouse-${randomUUID().slice(0, 6)}`;

let partner: TestPartner;
let ev: SaleEvent;
let controller: Buyer;
let outsider: Buyer;
let buyer: Buyer;
let tickets: Row[] = [];

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

function camera(user: Buyer, payload: string): Promise<RouteResult> {
    return scan(user, { eventId: ev.eventId, payload });
}

function manual(user: Buyer, ticketNumber: string, identityVerified?: unknown): Promise<RouteResult> {
    const body: Record<string, unknown> = { eventId: ev.eventId, manualTicketNumber: ticketNumber };
    if (identityVerified !== undefined) body.identityVerified = identityVerified;
    return scan(user, body);
}

async function assertNotConsumed(ticketId: string, label: string): Promise<void> {
    const t = await ticketRow(ticketId);
    assert.equal(t.status, 'VALIDE', `${label} : le billet ne doit pas être composté (statut ${t.status})`);
    assert.equal(t.checked_in_at, null, `${label} : checked_in_at doit rester vide`);
    const accepted = (await scansOf(ticketId)).filter((s) => s.accepted === true);
    assert.deepEqual(accepted, [], `${label} : aucune ligne ticket_scans acceptée attendue`);
}

function isManual(body: Row): boolean {
    const ticket = (body.ticket ?? {}) as Row;
    return body.method === 'MANUAL' || body.is_manual_entry === true || ticket.method === 'MANUAL' || ticket.is_manual_entry === true;
}

async function scanRow(scanId: unknown): Promise<Row> {
    assert.equal(typeof scanId, 'string', `scan_id attendu dans la réponse (reçu ${JSON.stringify(scanId)})`);
    const { data, error } = await service.from('ticket_scans').select('*').eq('id', scanId as string).single();
    assert.equal(error, null, `ticket_scans ${scanId} : ${error?.message}`);
    return data as Row;
}

/**
 * Transfert P2P complet par les routes : initiation par le porteur vers le numéro vérifié du destinataire,
 * réclamation par le destinataire (lot 6, contrat B6 avec l'amendement 2 : plus de jeton, transfert vers un
 * numéro seulement ; réclamation par l'identifiant du transfert).
 */
async function transferTicket(owner: Buyer, recipient: Buyer, ticketId: string): Promise<void> {
    await markPhoneVerified(recipient.userId);
    const { POST: initiate } = await importModule('../../app/api/tickets/[id]/transfer/route');
    await confirmPassword(owner, STRONG_PASSWORD); const initRes: Response = await initiate(authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: recipient.phoneE164 }), routeContext({ id: ticketId }));
    const initBody = (await initRes.json()) as Row;
    assert.equal(initRes.status, 200, `initiation du transfert : HTTP ${initRes.status} ${JSON.stringify(initBody)}`);
    const transferId = String(((initBody.transfer ?? {}) as Row).transfer_id ?? '');
    assert.ok(transferId, `identifiant du transfert absent de la réponse : ${JSON.stringify(initBody)}`);
    const { POST: claim } = await importModule('../../app/api/tickets/transfers/[id]/claim/route');
    const claimRes: Response = await claim(authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', recipient, {}), routeContext({ id: transferId }));
    const claimBody = (await claimRes.json()) as Row;
    assert.equal(claimRes.status, 200, `réclamation du transfert : HTTP ${claimRes.status} ${JSON.stringify(claimBody)}`);
}

before(async () => {
    partner = await newPartner('accesqr');
    ev = await createTimedEvent(partner.partnerId, 'qr', [{ name: CATEGORY, price: 2000, total: 30 }]);
    controller = await newController(partner, ev.eventId, { label: 'qr' });
    outsider = await newController(partner, null, { label: 'qrnon' });
    buyer = await newBuyer('accesqr');
    tickets = (await buyConfirmed(buyer, ev, [[CATEGORY, 6]])).tickets;
    assert.equal(tickets.length, 6, 'six billets émis par le checkout');
});

after(async () => {
    await assertAccessInvariants('acces-qr');
});

describe('4.1 Format du QR caméra', () => {
    test('caméra : identifiant nu (numéro TCK-…, QR statique EV-QR-…, UUID seul, ancien format) → dynamic_qr_required, billet non composté', async () => {
        const t = tickets[0];
        const id = String(t.id);
        const payloads = [String(t.ticket_number), String(t.qr_code), id, `${id}:123456`, `EVT1:${t.ticket_number}:123456`, `EVT1:${t.qr_code}:123456`];
        for (const payload of payloads) {
            const r = await camera(controller, payload);
            assert.equal(r.status, 200, `payload « ${payload} » : ${show(r)}`);
            assert.equal(r.body.result, 'dynamic_qr_required', `payload « ${payload} » : ${show(r)}`);
        }
        await assertNotConsumed(id, 'identifiants nus');
    });

    test('parseTicketPayload : EVT1 + UUID du billet + 6 chiffres, rien d’autre ; buildTicketPayload produit ce format', async () => {
        const totp = await importModule('../../lib/security/totp');
        assert.equal(typeof totp.parseTicketPayload, 'function', 'lib/security/totp.ts doit exporter parseTicketPayload');
        const id = randomUUID();
        assert.equal(totp.buildTicketPayload(id, '123456'), `EVT1:${id}:123456`);
        assert.deepEqual(totp.parseTicketPayload(`EVT1:${id}:123456`), { ticketId: id, code: '123456' });
        const refused = [
            'TCK-20261101-ABCDEF1234', 'EV-QR-0123456789abcdef', id, `${id}:123456`, `EVT1:TCK-X:123456`,
            `EVT1:${id}:12345`, `EVT1:${id}:1234567`, `EVT1:${id}:12345a`, `EVT1:${id}:123456:extra`, `EVT2:${id}:123456`,
            `EVT1:${id.slice(0, 35)}:123456`, `EVT1::123456`, '',
        ];
        for (const raw of refused) {
            assert.equal(totp.parseTicketPayload(raw), null, `« ${raw} » doit être refusé par parseTicketPayload`);
        }
    });
});

describe('4.1 Saisie manuelle', () => {
    test('sans pièce d’identité vérifiée (absente, false, "true") → manual_entry_refused, billet non composté', async () => {
        const t = tickets[1];
        for (const identityVerified of [undefined, false, 'true', 1]) {
            const r = await manual(controller, String(t.ticket_number), identityVerified);
            assert.equal(r.status, 200, `identityVerified=${JSON.stringify(identityVerified)} : ${show(r)}`);
            assert.equal(r.body.result, 'manual_entry_refused', `identityVerified=${JSON.stringify(identityVerified)} : ${show(r)}`);
        }
        await assertNotConsumed(String(t.id), 'saisie manuelle sans identité');
    });

    test('contrôleur non affecté (identité cochée) → 403 SCAN_FORBIDDEN, aucune donnée du billet, billet non composté', async () => {
        const t = tickets[1];
        const r = await manual(outsider, String(t.ticket_number), true);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.code, 'SCAN_FORBIDDEN', show(r));
        assert.equal(r.body.ticket, undefined, `aucune donnée de billet : ${show(r)}`);
        const json = JSON.stringify(r.body);
        for (const leak of [String(t.id), buyer.lastName, CATEGORY]) {
            assert.ok(!json.includes(leak), `la réponse ne doit pas contenir « ${leak} » : ${json}`);
        }
        await assertNotConsumed(String(t.id), 'saisie par un contrôleur non affecté');
    });

    test('périmètre réglé : partenaire propriétaire refusé en ASSIGNED_CONTROLLER (manual_entry_refused), accepté en STAFF', async () => {
        const t = tickets[2];
        await withAccessSettings({ 'access.manual_entry_scope': 'ASSIGNED_CONTROLLER' }, async () => {
            const r = await manual(partner, String(t.ticket_number), true);
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.result, 'manual_entry_refused', `partenaire hors périmètre ASSIGNED_CONTROLLER : ${show(r)}`);
        });
        await assertNotConsumed(String(t.id), 'saisie du partenaire en ASSIGNED_CONTROLLER');
        await withAccessSettings({ 'access.manual_entry_scope': 'STAFF' }, async () => {
            const r = await manual(partner, String(t.ticket_number), true);
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.result, 'valid', `partenaire propriétaire en STAFF : ${show(r)}`);
            const row = await scanRow(r.body.scan_id);
            assert.equal(row.method, 'MANUAL');
            assert.equal(row.scanner_id, partner.userId);
        });
        assert.equal((await ticketRow(String(t.id))).status, 'UTILISE');
    });

    test('saisie valide (contrôleur affecté, identité vérifiée) → valid, marquée MANUAL dans la réponse et dans ticket_scans', async () => {
        const t = tickets[3];
        const r = await manual(controller, String(t.ticket_number), true);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'valid', show(r));
        assert.ok(isManual(r.body), `la réponse doit indiquer une saisie manuelle (method MANUAL ou is_manual_entry) : ${show(r)}`);
        const row = await scanRow(r.body.scan_id);
        assert.equal(row.method, 'MANUAL', 'ticket_scans.method');
        assert.equal(row.identity_verified, true, 'ticket_scans.identity_verified');
        assert.equal(row.accepted, true, 'ticket_scans.accepted');
        assert.equal(row.ticket_id, t.id);
        assert.equal(row.event_id, ev.eventId);
        assert.equal(row.scanner_id, controller.userId);
        assert.equal((await ticketRow(String(t.id))).status, 'UTILISE');
    });
});

describe('4.1 Transfert P2P', () => {
    test('identifiants régénérés ; ancien QR et ancien numéro refusés ; le QR du nouveau porteur passe', async () => {
        const t = tickets[4];
        const id = String(t.id);
        const prior = await ticketRow(id);
        const oldPayload = await ticketPayload(id);
        const recipient = await newBuyer('accesqrdest');
        await transferTicket(buyer, recipient, id);

        const moved = await ticketRow(id);
        assert.equal(moved.user_id, recipient.userId, 'nouveau propriétaire');
        assert.notEqual(moved.ticket_number, prior.ticket_number, 'ticket_number régénéré au transfert');
        assert.notEqual(moved.qr_code, prior.qr_code, 'qr_code régénéré au transfert');
        assert.notEqual(moved.totp_secret, prior.totp_secret, 'totp_secret régénéré au transfert');

        const byOldQr = await camera(controller, oldPayload);
        assert.equal(byOldQr.status, 200, show(byOldQr));
        assert.equal(byOldQr.body.result, 'qr_expired', `QR calculé avec l’ancien secret : ${show(byOldQr)}`);
        const byOldNumber = await manual(controller, String(prior.ticket_number), true);
        assert.equal(byOldNumber.status, 200, show(byOldNumber));
        assert.equal(byOldNumber.body.result, 'invalid', `ancien numéro de billet : ${show(byOldNumber)}`);
        await assertNotConsumed(id, 'ancien porteur après transfert');

        const byNewQr = await camera(controller, await ticketPayload(id));
        assert.equal(byNewQr.body.result, 'valid', `QR du nouveau porteur : ${show(byNewQr)}`);
        assert.equal((await ticketRow(id)).status, 'UTILISE');
    });
});

// ── PDF ────────────────────────────────────────────────────────────────────

function unescapePdf(s: string): string {
    return s.replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8))).replace(/\\(.)/g, '$1');
}

/** Texte affiché du PDF : chaînes des opérateurs Tj et TJ, mises bout à bout. */
function pdfText(pdf: string): string {
    const parts: string[] = [];
    for (const m of Array.from(pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g))) parts.push(unescapePdf(m[1]));
    for (const m of Array.from(pdf.matchAll(/\[((?:\\.|[^\]\\])*)\]\s*TJ/g))) {
        for (const s of Array.from(m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g))) parts.push(unescapePdf(s[1]));
    }
    return parts.join(' ');
}

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

describe('4.1 PDF du billet', () => {
    test('aucun QR (ni image ni matrice de modules), numéro du billet et mention « pièce d’identité »', async () => {
        const t = tickets[5];
        const { GET } = await importModule('../../app/api/tickets/[id]/pdf/route');
        const res: Response = await GET(authed(`/api/tickets/${t.id}/pdf`, 'GET', buyer), routeContext({ id: String(t.id) }));
        assert.equal(res.status, 200, `PDF : HTTP ${res.status}`);
        const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
        assert.ok(pdf.startsWith('%PDF-'), 'document PDF');

        // Le QR actuel est une matrice de modules dessinés un par un (« x y w h re f ») : des centaines
        // de rectangles pleins. La mise en page seule en compte une dizaine.
        const filledRects = (pdf.match(/\bre\s+f\*?(?=\s)/g) ?? []).length;
        assert.ok(filledRects < 40, `le PDF ne doit plus dessiner de QR : ${filledRects} rectangles pleins (modules d’une matrice)`);
        assert.ok(!/\/Subtype\s*\/Image/.test(pdf), 'aucune image (XObject Image) dans le PDF');
        assert.ok(!/\/[A-Za-z0-9_.]+\s+Do\b/.test(pdf), 'aucun XObject dessiné (opérateur Do)');
        assert.ok(!pdf.includes(String(t.qr_code)), 'le qr_code statique ne figure plus dans le PDF');
        assert.ok(!pdf.includes('EVT1'), 'aucun payload de code dynamique dans le PDF');

        const text = normalize(pdfText(pdf));
        assert.ok(text.includes(normalize(String(t.ticket_number))), 'le numéro du billet est imprimé');
        assert.ok(text.includes('piecedidentite'), 'mention « présentez une pièce d’identité au contrôle » attendue');
    });
});

// ── Carte billet (contrôle statique) ───────────────────────────────────────

const TICKET_CARD = path.resolve(process.cwd(), 'components/tickets/TicketCard.tsx');

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

interface Block { start: number; end: number; text: string }

/** Corps des fonctions du fichier (const f = (...) => { … }, function f(...) { … }, useCallback(() => { … })). */
function functionBlocks(src: string): Block[] {
    const out: Block[] = [];
    const heads = /(?:=>\s*\{)|(?:function\s*\w*\s*\([^)]*\)\s*(?::[^{]+)?\{)/g;
    for (const m of Array.from(src.matchAll(heads))) {
        const open = (m.index ?? 0) + m[0].length - 1;
        let depth = 0;
        let i = open;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') {
                depth--;
                if (depth === 0) break;
            }
        }
        const start = src.lastIndexOf('\n', m.index ?? 0) + 1;
        out.push({ start, end: i + 1, text: src.slice(start, i + 1) });
    }
    return out;
}

/** Plus petit corps de fonction contenant la position, complété par les définitions `const x = …` qu'il utilise. */
function enclosingCode(src: string, index: number, blocks: Block[]): string {
    const inner = blocks.filter((b) => b.start <= index && index < b.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    const own = inner ? inner.text : src.slice(src.lastIndexOf('\n', index) + 1, src.indexOf('\n', index) === -1 ? src.length : src.indexOf('\n', index));
    const defs: string[] = [];
    for (const id of Array.from(new Set(own.match(/\b[A-Za-z_]\w*\b/g) ?? []))) {
        if (new RegExp(`const\\s+${id}\\s*=`).test(own)) continue; // défini dans la fonction elle-même
        const def = new RegExp(`const\\s+${id}\\s*=[^;]*;`).exec(src);
        if (def) defs.push(def[0]);
    }
    return [own, ...defs].join('\n');
}

describe('4.1 Carte billet (contrôle statique)', () => {
    test('partage WhatsApp et copie : lien de l’événement, jamais le numéro du billet ni le QR', () => {
        const src = stripComments(fs.readFileSync(TICKET_CARD, 'utf8'));
        const blocks = functionBlocks(src);
        const sites = Array.from(src.matchAll(/navigator\.share\s*\(|navigator\.clipboard\.writeText\s*\(|wa\.me|api\.whatsapp\.com/g)).map((m) => m.index ?? 0);
        assert.ok(sites.some((i) => /wa\.me|whatsapp/.test(src.slice(i, i + 20))), 'le partage WhatsApp du billet est attendu (lien de l’événement)');
        for (const i of sites) {
            const code = enclosingCode(src, i, blocks);
            const line = src.slice(0, i).split('\n').length;
            assert.ok(!/\bticketNumber\b|\bticket_number\b|\bqrCodeValue\b|\bdynamicQr\b|\bqr_payload\b|\bpayload\b/.test(code),
                `TicketCard.tsx:${line} : le partage ne doit diffuser ni le numéro du billet ni le QR :\n${code.slice(0, 600)}`);
            assert.ok(/\/events\//.test(code), `TicketCard.tsx:${line} : le partage doit pointer vers la page de l’événement (/events/…) :\n${code.slice(0, 600)}`);
        }
    });

    test('QR affiché = payload du code dynamique (live-code), rafraîchi selon expires_in, jamais un QR statique par défaut', () => {
        const src = stripComments(fs.readFileSync(TICKET_CARD, 'utf8'));
        assert.ok(!/useState(?:<[^>]*>)?\(\s*(?:qrCodeValue|ticketNumber)\b/.test(src), 'le QR ne doit pas être initialisé avec le qr_code statique ou le numéro');
        const qrElements = Array.from(src.matchAll(/<QRCode\w*[\s\S]*?\/>/g)).map((m) => m[0]);
        for (const el of qrElements) {
            assert.ok(!/\bqrCodeValue\b|\bticketNumber\b/.test(el), `le QR affiché ne doit jamais retomber sur un identifiant statique : ${el}`);
        }
        assert.ok(/\.payload\b/.test(src), 'le payload du code dynamique vient du champ payload de /api/tickets/[id]/live-code');
        assert.ok(!/qr_payload/.test(src), 'ancien champ qr_payload abandonné');
        assert.ok(/expires_in/.test(src), 'le rafraîchissement suit expires_in renvoyé par le serveur');
        assert.ok(!/return\s+20\s*;/.test(src), 'le compte à rebours ne repart pas sur une valeur fixe de 20 s');
    });
});
