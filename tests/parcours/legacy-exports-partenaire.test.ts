/**
 * Lot 8, tâche 8.2 v — rapport de clôture PDF et export comptable CSV, par les ROUTES (0 test moderne avant ce lot).
 * Cas portés de tests/legacy/partner-dashboard-and-exports.test.ts (tableau 12.1, ligne 17 : T8 à T11, T14 ; T12 et
 * T13 y appelaient le service, ils passent ici par la route) :
 *  - GET /api/partner/reports/closing/pdf?eventId= ;
 *  - GET /api/partner/reports/accounting[?eventId=].
 *  1. T8 : PDF réel (200, application/pdf, attachment, no-store, %PDF-1., longueur annoncée, identifiant du rapport) ;
 *  2. T9 : aucun secret dans le PDF ni dans le CSV (le PDF n'est pas compressé : la recherche porte sur le texte
 *     réel, prouvé par la présence de l'identifiant du rapport) ;
 *  3. T10 : CSV (BOM, en-têtes, une ligne par billet avec ses colonnes, synthèse du grand livre) ;
 *  4. T11 : partenaire A sur l'événement de B : PDF 403, CSV 404, aucune donnée de B ; export complet de A sans
 *     aucune ligne de B ;
 *  5. T12 : sans session 401 ; T13 : client 403, contrôleur affecté 403 ;
 *  6. T14 : événement inconnu 404 ; PDF sans eventId 400.
 *
 * Écart au legacy : T11 attendait une exception du service, la route rend 403 pour le PDF et 404 pour le CSV (filtre
 * sur partner_id) ; les deux statuts sont figés tels quels, aucun ne révèle l'événement de B.
 *
 * Annoncée verte dès l'écriture (port, section 12.1) : tout rouge est une anomalie à instruire (8.3 d). Suite verte
 * à l'écriture : assertTerrainInvariants, pas assertRecetteInvariants (Conventions).
 *
 * Exception à cette annonce : le dernier describe (anomalie A23, 8.3 d) est rouge jusqu'au correctif : csvField
 * (lib/partner/partner-dashboard.service.ts:558) ne neutralise pas les cellules de texte commençant par =, +, -, @,
 * tabulation ou retour chariot (injection de formule à l'ouverture du CSV dans un tableur). Les colonnes numériques
 * restent des nombres : seul le texte est préfixé d'une apostrophe.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { GET as accountingRoute } from '../../app/api/partner/reports/accounting/route';
import { GET as closingPdfRoute } from '../../app/api/partner/reports/closing/pdf/route';
import { newBuyer, type Buyer } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, ticketRow } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

interface Download { status: number; headers: Headers; bytes: Buffer; json: Row }

const PRICE = 5000;
/** Colonnes du CSV (lib/partner/partner-dashboard.service.ts, generateAccountingExport). */
const COL = { event: 1, channel: 3, ticket: 4, category: 5, price: 7, net: 10, status: 11 } as const;

let partnerA: TestPartner;
let partnerB: TestPartner;
let evA: DraftEvent;
let evB: DraftEvent;
let ticketsA: Row[] = [];
let ticketsB: Row[] = [];
let client: Buyer;

async function publishedEvent(owner: TestPartner, label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(owner, `exports-${label}`, [{ name: 'Standard', price: PRICE, total: 20 }], {
        title: `Festival ${label} ${randomBytes(3).toString('hex')}`, startsInHours: 72,
    });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: owner.userId });
    return ev;
}

before(async () => {
    partnerA = await newPartner('legacy-exports-a');
    partnerB = await newPartner('legacy-exports-b');
    evA = await publishedEvent(partnerA, 'Alpha');
    evB = await publishedEvent(partnerB, 'Beta');
    client = await newBuyer('legacy-exports-client');
    ticketsA = (await buyConfirmed(client, evA, [['Standard', 2]])).tickets;
    ticketsB = (await buyConfirmed(client, evB, [['Standard', 1]])).tickets;
    assert.equal(ticketsA.length, 2, 'deux billets sur l’événement de A');
    assert.equal(ticketsB.length, 1, 'un billet sur l’événement de B');
});

after(async () => {
    await assertTerrainInvariants('legacy-exports-partenaire');
});

async function download(handler: Handler, path: string, token: string | null): Promise<Download> {
    const res = await handler(jsonRequest(path, 'GET', token));
    const bytes = Buffer.from(await res.arrayBuffer());
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    return { status: res.status, headers: res.headers, bytes, json: isJson ? JSON.parse(bytes.toString('utf8')) as Row : {} };
}

const closingPdf = (token: string | null, eventId: string): Promise<Download> => download(closingPdfRoute, `/api/partner/reports/closing/pdf?eventId=${eventId}`, token);
const accounting = (token: string | null, eventId?: string): Promise<Download> => download(accountingRoute, `/api/partner/reports/accounting${eventId ? `?eventId=${eventId}` : ''}`, token);

function show(r: Download): string {
    return `HTTP ${r.status} ${r.headers.get('content-type')} ${JSON.stringify(r.json).slice(0, 300)}`;
}

function assertRefused(r: Download, status: number, label: string): void {
    assert.equal(r.status, status, `${label} : ${show(r)}`);
    assert.equal(typeof r.json.error, 'string', `${label} : message d'erreur attendu, ${show(r)}`);
    assert.doesNotMatch(String(r.json.error), /ACCES_REFUSE|EVENEMENT_INTROUVABLE|PROFIL_PARTENAIRE/, `${label} : aucun code interne affiché, ${show(r)}`);
    assert.notEqual(r.headers.get('content-disposition')?.startsWith('attachment'), true, `${label} : aucun fichier ne doit partir`);
}

function csvLines(r: Download): string[][] {
    const text = r.bytes.toString('utf8');
    assert.equal(text.charCodeAt(0), 0xFEFF, 'BOM UTF-8 en tête du fichier (compatibilité Excel)');
    return text.slice(1).split('\r\n').map((line) => line.split(';'));
}

async function secretsOf(tickets: Row[]): Promise<string[]> {
    const out = ['service_role', 'claim_token', 'totp_secret'];
    for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'SAMIRPAY_API_KEY']) {
        const value = process.env[key];
        if (value) out.push(value);
    }
    for (const t of tickets) {
        const row = await ticketRow(String(t.id));
        out.push(String(row.totp_secret), String(row.qr_code));
    }
    return out;
}

describe('8.2 v — rapport de clôture PDF par la route (T8, T9)', () => {
    test('T8 : 200, application/pdf en pièce jointe, no-store, en-tête %PDF-1., longueur annoncée, identifiant du rapport', async () => {
        const r = await closingPdf(partnerA.accessToken, evA.eventId);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.headers.get('content-type'), 'application/pdf', show(r));
        assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename="Rapport-Cloture-[^"]+\.pdf"$/, 'pièce jointe nommée');
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'aucun cache');
        assert.equal(r.bytes.subarray(0, 7).toString('latin1'), '%PDF-1.', 'en-tête PDF');
        assert.ok(r.bytes.length > 500, `taille de PDF suspecte : ${r.bytes.length} octets`);
        assert.equal(Number(r.headers.get('content-length')), r.bytes.length, 'longueur annoncée = longueur reçue');
        assert.ok(r.bytes.toString('latin1').includes(`CLOTURE-${evA.eventId.slice(0, 8).toUpperCase()}`), 'identifiant du rapport dans le document');
    });

    test('T9 : aucun secret dans le PDF ni dans le CSV', async () => {
        const secrets = await secretsOf(ticketsA);
        const pdf = await closingPdf(partnerA.accessToken, evA.eventId);
        assert.equal(pdf.status, 200, show(pdf));
        const csv = await accounting(partnerA.accessToken, evA.eventId);
        assert.equal(csv.status, 200, show(csv));
        const pdfText = pdf.bytes.toString('latin1');
        const csvText = csv.bytes.toString('utf8');
        assert.ok(pdfText.includes(`CLOTURE-${evA.eventId.slice(0, 8).toUpperCase()}`), 'témoin : le texte du PDF est lisible, la recherche a un sens');
        for (const secret of secrets) {
            assert.ok(!pdfText.includes(secret), `secret de ${secret.length} caractères présent dans le PDF`);
            assert.ok(!csvText.includes(secret), `secret de ${secret.length} caractères présent dans le CSV`);
        }
    });
});

describe('8.2 v — export comptable CSV par la route (T10)', () => {
    test('T10 : BOM, en-têtes, une ligne par billet (canal, catégorie, prix, net, statut), synthèse du grand livre', async () => {
        const r = await accounting(partnerA.accessToken, evA.eventId);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.headers.get('content-type'), 'text/csv; charset=utf-8', show(r));
        assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename="EventVillage-Cloture-[^"]+\.csv"$/, 'pièce jointe nommée');
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'aucun cache');
        const lines = csvLines(r);
        assert.deepEqual(lines[0].slice(0, 3), ['Date', 'Evenement', 'Reference Transaction'], 'en-têtes du fichier');
        for (const t of ticketsA) {
            const mine = lines.filter((l) => l[COL.ticket] === String(t.ticket_number));
            assert.equal(mine.length, 1, `une ligne pour le billet ${t.ticket_number}`);
            const [line] = mine;
            assert.deepEqual(
                { event: line[COL.event], channel: line[COL.channel], category: line[COL.category], price: line[COL.price], net: line[COL.net], status: line[COL.status] },
                { event: evA.title, channel: 'EN_LIGNE', category: 'Standard', price: String(PRICE), net: String(PRICE), status: 'VALIDE' },
                `colonnes du billet ${t.ticket_number}`);
        }
        const net = lines.find((l) => l[COL.event] === 'NET ORGANISATEUR (ventes en ligne)');
        assert.ok(net, 'ligne de synthèse du net organisateur');
        assert.equal(net[COL.net], String(2 * PRICE), 'net organisateur = prix faciaux des deux billets');
    });
});

describe('8.2 v — isolement et droits des exports (T11 à T14)', () => {
    test('T11 : partenaire A sur l’événement de B → PDF 403, CSV 404, aucune donnée de B', async () => {
        const pdf = await closingPdf(partnerA.accessToken, evB.eventId);
        assertRefused(pdf, 403, 'PDF de l’événement de B');
        const csv = await accounting(partnerA.accessToken, evB.eventId);
        assertRefused(csv, 404, 'CSV de l’événement de B');
        for (const r of [pdf, csv]) assert.ok(!r.bytes.toString('utf8').includes(evB.title), `titre de l’événement de B divulgué : ${show(r)}`);
    });

    test('T11 : export complet de chaque partenaire, sans aucune ligne de l’autre', async () => {
        const a = await accounting(partnerA.accessToken);
        assert.equal(a.status, 200, show(a));
        assert.match(a.headers.get('content-disposition') ?? '', /filename="EventVillage-Comptabilite-/, 'export complet nommé');
        const textA = a.bytes.toString('utf8');
        for (const t of ticketsA) assert.ok(textA.includes(String(t.ticket_number)), `billet ${t.ticket_number} de A dans son export`);
        for (const t of ticketsB) assert.ok(!textA.includes(String(t.ticket_number)), `billet ${t.ticket_number} de B dans l’export de A`);
        assert.ok(!textA.includes(evB.title), 'titre de l’événement de B dans l’export de A');

        const b = await accounting(partnerB.accessToken);
        assert.equal(b.status, 200, show(b));
        const textB = b.bytes.toString('utf8');
        for (const t of ticketsB) assert.ok(textB.includes(String(t.ticket_number)), `billet ${t.ticket_number} de B dans son export`);
        for (const t of ticketsA) assert.ok(!textB.includes(String(t.ticket_number)), `billet ${t.ticket_number} de A dans l’export de B`);
    });

    test('T12 : sans session → 401 sur les deux routes', async () => {
        assertRefused(await closingPdf(null, evA.eventId), 401, 'PDF sans session');
        assertRefused(await accounting(null, evA.eventId), 401, 'CSV sans session');
    });

    test('T13 : client et contrôleur affecté → 403 sur les deux routes', async () => {
        const controller = await newController(partnerA, evA.eventId, { label: 'exports' });
        for (const [label, user] of [['client', client], ['contrôleur affecté', controller]] as Array<[string, Buyer]>) {
            assertRefused(await closingPdf(user.accessToken, evA.eventId), 403, `PDF, ${label}`);
            assertRefused(await accounting(user.accessToken, evA.eventId), 403, `CSV, ${label}`);
        }
    });

    test('T14 : événement inconnu → 404 sur les deux routes ; PDF sans eventId → 400', async () => {
        const unknown = randomUUID();
        assertRefused(await closingPdf(partnerA.accessToken, unknown), 404, 'PDF, événement inconnu');
        assertRefused(await accounting(partnerA.accessToken, unknown), 404, 'CSV, événement inconnu');
        assertRefused(await download(closingPdfRoute, '/api/partner/reports/closing/pdf', partnerA.accessToken), 400, 'PDF sans eventId');
    });
});

describe('8.3 d, A23 — injection de formule dans l’export CSV', () => {
    test('titre et catégorie commençant par = ou @ : cellule de texte préfixée d’une apostrophe, montants toujours numériques', async () => {
        const title = `=1+1 Festival ${randomBytes(3).toString('hex')}`;
        const category = '@Presse';
        const ev = await createDraftEvent(partnerA, 'exports-formule', [{ name: category, price: PRICE, total: 5 }], { title, startsInHours: 72 });
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partnerA.userId });
        const { tickets } = await buyConfirmed(client, ev, [[category, 1]]);
        assert.equal(tickets.length, 1, 'un billet vendu');

        const r = await accounting(partnerA.accessToken, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const line = csvLines(r).find((l) => l[COL.ticket] === String(tickets[0].ticket_number));
        assert.ok(line, 'ligne du billet');
        assert.equal(line[COL.event], `'${title}`, 'titre neutralisé : le tableur ne doit pas l’évaluer');
        assert.equal(line[COL.category], `'${category}`, 'catégorie neutralisée');
        assert.equal(line[COL.price], String(PRICE), 'le prix reste un nombre');
        assert.equal(line[COL.net], String(PRICE), 'le net reste un nombre');
    });
});
