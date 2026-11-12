/**
 * Lot 9 ter, tâche 9t.18 (consigne 4 : « Le rapport de clôture et l'export reprennent les mêmes vues (zone, porte,
 * heure d'entrée, catégorie, origine) ») — la clôture reprend les vues figées du tableau de bord (pilotage_closing.entries
 * = pilotage_compute_entries sans nom d'invité), l'export des participants gagne « Origine », « Zone » et « Porte », le PDF
 * de clôture ajoute les entrées par zone, par origine et par porte (contrat 5.D, D.1.2 (8) et (10), D.1.3, D.1.6 T3 ;
 * X9, ED4 ; rectification 4 de D).
 *
 * Montage Z : copie locale de celui de pilotage-tableau-entrees (contrat D.1.6, jamais importé d'une suite). Jeu sans zone :
 * buildKnownDataset('9ter-export') (pilotage-helpers), qui sert aussi au cas PDF sans zone (le contrat le nomme
 * « 9ter-pdf » : un seul jeu suffit, aucune assertion n'en dépend).
 *
 * Rouge avant correctif (S-P fix(9t.18), migration 20261110000010 ; PDF : lib/partner/partner-dashboard.service.ts, X9) :
 *  - cas 1, 2, 5 (zones) : route des zones absente (9t.15), puis `closing.entries` absent, export à 5 colonnes, PDF sans
 *    tableaux d'entrées ;
 *  - cas 3, 4 : en-tête « Canal » sans « Zone » ni « Porte » (lib/events/pilotage.service.ts:198, participants_export
 *    M/20261109000004:243-244) ;
 *  - cas 5 sans zone : tableau « Entrées par zone » absent du PDF.
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, ticketPayload, type RouteResult } from './acces-helpers';
import { issueFreeTicket } from './terrain-helpers';
import {
    EXPECTED, buildKnownDataset, eventScans, eventTicketRows, fullName, listAt, participantsExport, pilotageOk, routeHandler, show, showExport,
    type ExportResult, type KnownDataset, type Row,
} from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, guestAdmit, guestSearch, scanAtGate, sendInvitations, type ZonedEvent, type ZoneSpec } from './zones-helpers';

// ── Montage Z (copie locale, contrat D.1.6) ────────────────────────────────

const SIMPLE = 'SIMPLE';
const VIP = 'VIP';
const VVIP = 'VVIP';
const GRATUIT = 'GRATUIT';
const Z_CATEGORIES: CategorySpec[] = [
    { name: SIMPLE, price: 5_000, total: 10 },
    { name: VIP, price: 15_000, total: 10 },
    { name: VVIP, price: 30_000, total: 5 },
    { name: GRATUIT, price: 0, total: 10 },
];
const Z_ZONES: ZoneSpec[] = [
    { name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE, GRATUIT], gates: ['Porte Nord', 'Porte Sud'] },
    { name: 'Entrée VIP', kind: 'ENTREE', admits: [VIP, VVIP], gates: ['Porte VIP'] },
    { name: 'Carré VVIP', kind: 'CONTROLE', admits: [VVIP], gates: ['Accès carré'] },
];
const GUEST_NAME = 'Awa Diop';

interface ZMontage {
    partner: TestPartner;
    ev: ZonedEvent;
    buyers: { b1: Buyer; b2: Buyer; holder: Buyer };
    tickets: { simple1: string; simple2: string; vip: string; vvip: string; gratuit: string; invitation: string };
}

function ticketOfCategory(tickets: Row[], ev: ZonedEvent, category: string, what: string): string[] {
    const ids = tickets.filter((t) => t.category_id === ev.categories[category].id).map((t) => String(t.id));
    assert.ok(ids.length > 0, `${what} : billet ${category} émis (${JSON.stringify(tickets.map((t) => t.category_id))})`);
    return ids;
}

async function scanExpect(user: Buyer, ev: ZonedEvent, payload: string, gate: string, expected: string | string[], what: string): Promise<RouteResult> {
    const res = await scanAtGate(user, { eventId: ev.eventId, payload }, gateOf(ev, gate));
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
    const allowed = Array.isArray(expected) ? expected : [expected];
    assert.ok(allowed.includes(String(res.body.result)), `${what} : résultat ${allowed.join(' ou ')} attendu, ${show(res)}`);
    return res;
}

async function controllerAt(partner: TestPartner, ev: ZonedEvent, gate: string, label: string): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { label });
    const res = await assignGate(partner, ev.eventId, ctrl.userId, gateOf(ev, gate));
    assert.equal(res.status, 200, `porte ${gate} attribuée à ${label} (PATCH /api/partner/team/gate) : ${show(res)}`);
    return ctrl;
}

async function buildZ(label: string): Promise<ZMontage> {
    const partner = await newPartner(`pil9ter-${label}`);
    const ev = await createZonedEvent(partner, `pil9ter-${label}`, Z_CATEGORIES, Z_ZONES);
    const nord = await controllerAt(partner, ev, 'Porte Nord', `${label}-nord`);
    const sud = await controllerAt(partner, ev, 'Porte Sud', `${label}-sud`);
    const vipCtrl = await controllerAt(partner, ev, 'Porte VIP', `${label}-vip`);
    const carre = await controllerAt(partner, ev, 'Accès carré', `${label}-carre`);
    const b1 = await newBuyer(`pil9ter-${label}-1`, { firstName: 'Moussa', lastName: 'Sarr' });
    const b2 = await newBuyer(`pil9ter-${label}-2`, { firstName: 'Khady', lastName: 'Ndiaye' });
    const holder = await newBuyer(`pil9ter-${label}-g`, { firstName: 'Fatou', lastName: 'Gaye' });
    const p1 = await buyConfirmed(b1, ev, [[SIMPLE, 2]]);
    const p2 = await buyConfirmed(b2, ev, [[VIP, 1], [VVIP, 1]]);
    const [simple1, simple2] = ticketOfCategory(p1.tickets, ev, SIMPLE, 'acheteur 1');
    assert.ok(simple2, 'acheteur 1 : deux billets SIMPLE');
    const [vip] = ticketOfCategory(p2.tickets, ev, VIP, 'acheteur 2');
    const [vvip] = ticketOfCategory(p2.tickets, ev, VVIP, 'acheteur 2');
    const gratuit = await issueFreeTicket(ev.eventId, ev.categories[GRATUIT].id, holder);

    const guestPhone = randomSenegalPhone('78');
    const sent = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[VIP].id, phones: [guestPhone], quantity: 1, guest_names: [GUEST_NAME] });
    assert.equal(sent.status, 200, `invitation VIP nommée « ${GUEST_NAME} » (POST …/invitations, 9t.17) : ${show(sent)}`);

    await scanExpect(nord, ev, await ticketPayload(simple1), 'Porte Nord', 'valid', 'SIMPLE#1 à la Porte Nord');
    await scanExpect(sud, ev, await ticketPayload(simple1), 'Porte Sud', 'already_used', 'SIMPLE#1 à la Porte Sud');
    await scanExpect(vipCtrl, ev, await ticketPayload(simple2), 'Porte VIP', 'wrong_zone', 'SIMPLE#2 à la Porte VIP');
    await scanExpect(carre, ev, await ticketPayload(vvip), 'Accès carré', 'not_entered', 'VVIP au carré avant l’entrée');
    await scanExpect(vipCtrl, ev, await ticketPayload(vip), 'Porte VIP', 'valid', 'VIP à la Porte VIP');
    await scanExpect(vipCtrl, ev, await ticketPayload(vvip), 'Porte VIP', 'valid', 'VVIP à la Porte VIP');
    await scanExpect(carre, ev, await ticketPayload(vvip), 'Accès carré', 'zone_ok', 'VVIP au carré après l’entrée');
    await scanExpect(sud, ev, await ticketPayload(gratuit), 'Porte Sud', 'valid', 'GRATUIT à la Porte Sud');
    await scanExpect(sud, ev, 'TCK-INVALIDE-1', 'Porte Sud', ['invalid', 'dynamic_qr_required'], 'charge invalide à la Porte Sud');

    const found = await guestSearch(vipCtrl, ev.eventId, guestPhone.slice(4));
    assert.equal(found.status, 200, `recherche de l’invitée dans la liste (9t.17) : ${show(found)}`);
    const items = Array.isArray(found.body.items) ? (found.body.items as Row[]) : [];
    assert.equal(items.length, 1, `un groupe pour le numéro invité : ${show(found)}`);
    const ids = Array.isArray(items[0].ticket_ids) ? (items[0].ticket_ids as unknown[]).map(String) : [];
    assert.equal(ids.length, 1, `un billet d’invitation : ${show(found)}`);
    const admitted = await guestAdmit(vipCtrl, ev.eventId, ids[0], { gateId: gateOf(ev, 'Porte VIP') });
    assert.equal(admitted.status, 200, `validation par la liste à la Porte VIP : ${show(admitted)}`);
    assert.equal(admitted.body.result, 'valid', `invitée entrée par la liste : ${show(admitted)}`);

    return { partner, ev, buyers: { b1, b2, holder }, tickets: { simple1, simple2, vip, vvip, gratuit, invitation: ids[0] } };
}

let known: KnownDataset;
let zMain: Promise<ZMontage> | null = null;

function montageZ(): Promise<ZMontage> {
    zMain ??= buildZ('t3');
    return zMain;
}

before(async () => {
    known = await buildKnownDataset('9ter-export');
});

after(async () => {
    await assertLot9terInvariants('pilotage-cloture-entrees');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

const HEADER = ['Nom', 'Catégorie', 'Origine', 'Statut du billet', 'Heure d’entrée', 'Zone', 'Porte'];
const PDF_ROUTE = '../../app/api/partner/reports/closing/pdf/route';

/** Lecteur CSV du contrat (séparateur « ; », guillemets doublés, CRLF ou LF, BOM retiré par participantsExport). */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ';') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function csvOf(res: ExportResult, what: string): { header: string[]; rows: string[][] } {
    assert.equal(res.status, 200, `${what} : ${showExport(res)}`);
    const [header, ...rows] = parseCsv(res.text.replace(/^﻿/, ''));
    assert.ok(header, `${what} : en-têtes attendus`);
    return { header: header.map((h) => h.trim()), rows };
}

function col(header: string[], name: string): number {
    const i = header.indexOf(name);
    assert.ok(i >= 0, `colonne « ${name} » absente de ${JSON.stringify(header)}`);
    return i;
}

function withoutLive(rows: unknown): unknown {
    return (Array.isArray(rows) ? rows : []).map((r) => Object.fromEntries(Object.entries(r as Row).filter(([k]) => k !== 'rate_per_minute' && k !== 'controllers_active')));
}

async function closingPdfText(caller: { accessToken: string }, eventId: string): Promise<string> {
    const handler = await routeHandler(PDF_ROUTE, 'GET', 'GET /api/partner/reports/closing/pdf');
    const res = await handler(jsonRequest(`/api/partner/reports/closing/pdf?eventId=${eventId}`, 'GET', caller.accessToken));
    assert.equal(res.status, 200, `PDF de clôture : HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString('latin1');
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('9t.18 T3 — clôture, export et PDF reprennent les vues des entrées', () => {
    test('la clôture reprend les vues figées du tableau de bord, sans nom d’invité', async () => {
        const z = await montageZ();
        const entries = await pilotageOk(z.partner, z.ev.eventId, 'entries', 'la partenaire propriétaire');
        const closing = await pilotageOk(z.partner, z.ev.eventId, 'closing', 'la partenaire propriétaire');
        const frozen = closing.entries as Row | undefined;
        assert.ok(frozen && typeof frozen === 'object', `closing.entries servi (F47) : clés ${Object.keys(closing).join(', ')}`);
        for (const key of ['configured', 'by_zone', 'by_category', 'by_origin', 'by_quarter', 'refusals_by_reason']) {
            assert.deepEqual(frozen[key], entries[key], `closing.entries.${key} = pilotage_entries.${key}`);
        }
        assert.deepEqual(withoutLive(frozen.by_gate), withoutLive(entries.by_gate), 'by_gate égal, débit et contrôleurs actifs retirés');
        assert.equal(Number((frozen.guest_list as Row | undefined)?.count), Number((entries.guest_list as Row | undefined)?.count), 'guest_list.count égal');
        const items = listAt(frozen, 'guest_list.items', 'validations figées');
        assert.equal(items.length, 1, 'une validation par la liste');
        for (const it of items) assert.equal(it.guest_name, null, 'aucun nom d’invité dans la clôture, même pour la propriétaire');
        for (const live of ['rate', 'controllers', 'alerts', 'alert_settings']) assert.equal(frozen[live], undefined, `aucune clé « en direct » ${live} dans closing.entries`);
        assert.ok(!JSON.stringify(closing).includes(GUEST_NAME), 'aucun nom d’invité dans la clôture');
    });

    test('export d’un événement à zones : colonnes Origine, Zone et Porte ; entré → zone et porte de son entrée ; jamais entré → vides', async () => {
        const z = await montageZ();
        const res = await participantsExport(z.partner, z.ev.eventId, { includeContacts: false });
        const { header, rows } = csvOf(res, 'export à zones');
        assert.deepEqual(header, HEADER, 'en-tête du contrat D.1.3');
        const [name, , origin, , entry, zone, gate] = [0, 1, 2, 3, 4, 5, 6];
        const b1 = rows.filter((r) => r[name].includes(z.buyers.b1.firstName) && r[name].includes(z.buyers.b1.lastName));
        assert.equal(b1.length, 2, `deux billets SIMPLE de ${fullName(z.buyers.b1)} : ${JSON.stringify(rows)}`);
        const entered = b1.find((r) => r[entry].trim() !== '');
        const notEntered = b1.find((r) => r[entry].trim() === '');
        assert.deepEqual(entered && [entered[origin], entered[zone], entered[gate]], ['En ligne', 'Entrée générale', 'Porte Nord'], 'SIMPLE#1 entré à la Porte Nord');
        assert.deepEqual(notEntered && [notEntered[zone], notEntered[gate]], ['', ''], 'SIMPLE#2 (refusé en mauvaise zone) : zone et porte vides');
        const free = rows.find((r) => r[name].includes(z.buyers.holder.lastName));
        assert.deepEqual(free && [free[origin], free[zone], free[gate]], ['Gratuit', 'Entrée générale', 'Porte Sud'], 'GRATUIT : origine « Gratuit »');
        const guest = rows.find((r) => r[name] === 'Invité, entré par la liste');
        assert.ok(guest, `invitation validée par la liste : « Invité, entré par la liste » (rectification 4) : ${JSON.stringify(rows)}`);
        assert.deepEqual([guest[origin], guest[zone], guest[gate]], ['Invitation', 'Entrée VIP', 'Porte VIP'], 'invitation : origine, zone et porte');
        assert.ok(!res.text.includes(GUEST_NAME), 'le nom de l’invitée n’est jamais exporté (x12)');
    });

    test('export d’un événement sans zone : zone « Entrée », porte = point d’entrée de l’entrée', async () => {
        const res = await participantsExport(known.partner, known.eventId, { includeContacts: false });
        const { header, rows } = csvOf(res, 'export sans zone');
        assert.deepEqual(header, HEADER, 'en-tête du contrat D.1.3');
        assert.equal(rows.length, EXPECTED.exportRows, 'une ligne par billet VALIDE ou UTILISE');
        const entry = col(header, 'Heure d’entrée');
        const zone = col(header, 'Zone');
        const gate = col(header, 'Porte');
        const origin = col(header, 'Origine');
        const name = col(header, 'Nom');
        const scans = await eventScans(known.eventId);
        const expectedGates = scans.filter((s) => s.accepted === true).map((s) => String(s.entry_point)).sort();
        const entered = rows.filter((r) => r[entry].trim() !== '');
        const absent = rows.filter((r) => r[entry].trim() === '');
        assert.equal(entered.length, EXPECTED.entries.total, 'billets entrés');
        for (const r of entered) assert.equal(r[zone], 'Entrée', `billet entré sans zone : zone « Entrée » ${JSON.stringify(r)}`);
        assert.deepEqual(entered.map((r) => r[gate]).sort(), expectedGates, 'porte = point d’entrée de la ligne acceptée');
        for (const r of absent) assert.deepEqual([r[zone], r[gate]], ['', ''], `billet VALIDE : zone et porte vides ${JSON.stringify(r)}`);
        const cash = rows.find((r) => r[name].includes(known.buyers.b6.firstName) && r[name].includes(known.buyers.b6.lastName) && r[entry].trim() !== '');
        assert.equal(cash?.[origin], 'Guichet', 'encaissement historique au scan : origine « Guichet »');
        const tickets = await eventTicketRows(known.eventId);
        assert.equal(tickets.filter((t) => t.status === 'UTILISE').length, entered.length, 'garde-fou : billets UTILISE en base');
    });

    test('avec contacts : neuf colonnes, toujours sans paiement', async () => {
        const res = await participantsExport(known.partner, known.eventId, { includeContacts: true, purpose: 'SAFETY_AND_RECEPTION' });
        const { header } = csvOf(res, 'export avec contacts');
        assert.deepEqual(header, [...HEADER, 'Téléphone', 'E-mail'], 'neuf colonnes, les deux dernières « Téléphone », « E-mail »');
        for (const h of header) assert.ok(!/prix|montant|paiement|transaction|op[ée]rateur|frais/i.test(h), `colonne de paiement interdite : ${h}`);
    });

    test('PDF de clôture : entrées par zone, par origine et par porte', async () => {
        const z = await montageZ();
        const text = await closingPdfText(z.partner, z.ev.eventId);
        for (const label of ['Entr\xE9es par zone', 'Entr\xE9es par origine', 'Entr\xE9es par porte', 'Entr\xE9e g\xE9n\xE9rale', 'Porte Nord']) {
            assert.ok(text.includes(label), `PDF de l’événement à zones : « ${label} » absent (X9)`);
        }
        assert.ok(!text.includes(GUEST_NAME), 'aucun nom d’invité dans le PDF');
        const plain = await closingPdfText(known.partner, known.eventId);
        const start = plain.indexOf('Entr\xE9es par zone');
        assert.ok(start >= 0, 'PDF sans zone : tableau « Entrées par zone » absent');
        const end = plain.indexOf('Entr\xE9es par origine', start);
        assert.ok(end > start, 'PDF sans zone : tableau « Entrées par origine » après celui des zones');
        assert.ok(plain.slice(start + 'Entr\xE9es par zone'.length, end).includes('Entr\xE9e'), 'PDF sans zone : une ligne « Entrée » dans le tableau par zone');
    });
});
