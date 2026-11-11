/**
 * Lot 5, tâche 5.10 — page de pilotage, onglet Clôture et export des participants (contrat, section I ;
 * décision de l'utilisateur du 31/10 : finalités en liste fermée).
 *  - GET /api/partner/events/[id]/pilotage/closing (RPC pilotage_closing) :
 *    - absents : le nombre en direct (billets VALIDE) ; la liste nominative seulement après la fin ;
 *    - Z de caisse par caisse : déclaré hors fonds, attendu, écart, détail par source (SCAN / GUICHET) et
 *      par catégorie ;
 *    - montant net (finance_partner_summary) et plage de disponibilité des fonds (min et max des
 *      available_at des crédits VENTE de l'événement) ;
 *  - POST /api/partner/events/[id]/participants-export { includeContacts, purpose? } (RPC
 *    participants_export) : CSV UTF-8 avec BOM, en-têtes français ; colonnes nom, catégorie, statut du
 *    billet (libellé), heure d'entrée (Dakar) ; AUCUNE donnée de paiement ni numéro de billet ; téléphone
 *    et email seulement avec includeContacts ET une finalité de la liste fermée (URGENT_EVENT_INFO,
 *    SAFETY_AND_RECEPTION), sinon 400 PURPOSE_REQUIRED ; chaque export journalisé dans
 *    participant_exports (acteur, contacts, finalité, nombre de lignes) — exigences de la consigne
 *    « export journalisé et sans données de paiement ».
 * Interprétations (contrat muet), fixées par cette suite :
 *  - participants = billets VALIDE et UTILISE, invitations comprises (les billets remboursés en sont exclus) ;
 *  - séparateur « ; » et fins de ligne CRLF ou LF, comme l'export comptable existant
 *    (lib/partner/partner-dashboard.service.ts:1002-1003) ;
 *  - en-têtes : « Nom », « Catégorie », « Statut » ou « Statut du billet », « Heure d’entrée », puis
 *    « Téléphone » et « E-mail » (ou « Email », « Courriel ») avec les contacts ;
 *  - « après la fin » : fin dépassée ET événement TERMINE (les deux sont réunis par le test).
 * Jeu de données et valeurs attendues (calculées à la main) : tests/parcours/pilotage-helpers.ts.
 *
 * Rouge avant correctif :
 *  - aucune route app/api/partner/events/[id]/pilotage/closing ni …/participants-export, aucune RPC
 *    pilotage_closing ni participants_export, aucune table participant_exports (aucune migration) ;
 *  - aucun export des participants n'existe ; l'export comptable n'est pas journalisé et contient la
 *    référence de transaction (lib/partner/partner-dashboard.service.ts:953, :975) ;
 *  - le rapport de clôture actuel ne donne ni absents, ni Z de caisse, ni date de disponibilité
 *    (lib/partner/partner-dashboard.service.ts:582-700, :694-695) et refuse l'admin (:597) ;
 *  - le jeu de données échoue avant (event_transition, sale_channel, guichet, clôture de caisse : voir
 *    pilotage-apercu-ventes.test.ts).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';
import { service, type Buyer } from './paiement-helpers';
import { advanceEventTo, eventStatus } from './cycle-helpers';
import {
    buildKnownDataset, dateOf, ETUDIANT, eventTicketRows, EXPECTED, findItem, fullName, listAt, numberAt, participantsExport,
    PAYOUT_DELAY_HOURS, pilotageOk, S1_DECLARED, S1_OPENING_FLOAT, showExport, STANDARD, VIP, type ExportResult, type KnownDataset, type Row,
} from './pilotage-helpers';

let ds: KnownDataset;
/** Lot 9 bis (R2, T30) : l'admin qui exporte est un admin events.read (la fixture ADMIN n'a aucune permission). */
let admin: TestAdmin;

before(async () => {
    ds = await buildKnownDataset('cloture');
    admin = await newAdminWith(['events.read'], { label: 'cloture-lecture' });
});

after(async () => {
    await assertLifecycleInvariants('pilotage-cloture-export');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** CSV à séparateur « ; », champs entre guillemets possibles ("" pour un guillemet), CRLF ou LF. */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"' && cell === '') {
            quoted = true;
        } else if (ch === ';') {
            row.push(cell);
            cell = '';
        } else if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

interface Csv { header: string[]; rows: string[][] }

function assertCsv(res: ExportResult, what: string): Csv {
    assert.equal(res.status, 200, `${what} : ${showExport(res)}`);
    assert.match(res.contentType, /text\/csv/i, `${what} : Content-Type text/csv (reçu ${res.contentType})`);
    assert.match(res.contentType, /charset=utf-8/i, `${what} : encodage UTF-8 déclaré (reçu ${res.contentType})`);
    assert.match(res.disposition, /attachment/i, `${what} : téléchargement (Content-Disposition : ${res.disposition})`);
    assert.deepEqual(Array.from(res.bytes.slice(0, 3)), [0xef, 0xbb, 0xbf], `${what} : BOM UTF-8 en tête du fichier`);
    const all = parseCsv(res.text);
    assert.ok(all.length >= 1, `${what} : ligne d’en-têtes attendue`);
    const [header, ...rows] = all;
    for (const r of rows) assert.equal(r.length, header.length, `${what} : ligne de ${r.length} colonnes pour ${header.length} en-têtes : ${JSON.stringify(r)}`);
    return { header: header.map((h) => h.trim()), rows };
}

const HEADER_PATTERNS = {
    name: /^Nom( et prénom| du participant)?$/,
    category: /^Catégorie$/,
    status: /^Statut( du billet)?$/,
    entry: /^Heure d['’]entrée$/,
    phone: /^Téléphone$/,
    email: /^(E-mail|Email|Courriel|Adresse e-mail)$/,
};
const PAYMENT_HEADER = /prix|montant|paiement|transaction|op[ée]rateur|r[ée]f[ée]rence|frais|wave|orange|esp[èe]ces|num[ée]ro|billet n/i;

function columnIndex(header: string[], re: RegExp, what: string): number {
    const i = header.findIndex((h) => re.test(h));
    assert.ok(i >= 0, `${what} : colonne ${re} absente des en-têtes ${JSON.stringify(header)}`);
    return i;
}

function rowsOf(csv: Csv, nameCol: number, who: Pick<Buyer, 'firstName' | 'lastName'>): string[][] {
    return csv.rows.filter((r) => r[nameCol].includes(who.firstName) && r[nameCol].includes(who.lastName));
}

/** Aucune donnée de paiement ni numéro de billet dans le fichier (en-têtes et contenu). */
async function assertNoPaymentData(csv: Csv, res: ExportResult, what: string): Promise<void> {
    for (const h of csv.header) assert.ok(!PAYMENT_HEADER.test(h), `${what} : colonne de paiement ou de numéro de billet interdite (${h})`);
    const tickets = await eventTicketRows(ds.eventId);
    for (const t of tickets) {
        assert.ok(!res.text.includes(String(t.ticket_number)), `${what} : numéro de billet ${t.ticket_number} présent dans l’export`);
        assert.ok(!res.text.includes(String(t.qr_code)), `${what} : code QR présent dans l’export`);
    }
    const { data: pays, error } = await service.from('payments').select('id, transaction_id, external_order_id, external_transaction_id').eq('event_id', ds.eventId);
    assert.equal(error, null, `paiements de l’événement : ${error?.message}`);
    for (const p of (pays ?? []) as Row[]) {
        for (const v of [p.id, p.transaction_id, p.external_order_id, p.external_transaction_id]) {
            if (v) assert.ok(!res.text.includes(String(v)), `${what} : donnée de paiement ${v} présente dans l’export`);
        }
    }
    const prices = new Set(['5000', '5 000', '15000', '15 000', '2000', '2 000', '0']);
    for (const r of csv.rows) {
        for (const cell of r) {
            const bare = cell.replace(/[\s  ]/g, ' ').replace(/\s*(F CFA|FCFA|F|XOF)$/i, '').trim();
            assert.ok(!prices.has(bare), `${what} : montant « ${cell} » présent dans l’export`);
        }
    }
}

function participants(): Array<{ who: Buyer; category: string; entered: boolean }> {
    const b = ds.buyers;
    return [
        { who: b.b1, category: STANDARD, entered: true }, { who: b.b1, category: STANDARD, entered: false },
        { who: b.b2, category: VIP, entered: true },
        { who: b.b3, category: ETUDIANT, entered: false }, { who: b.b3, category: ETUDIANT, entered: false },
        { who: b.invitee, category: VIP, entered: true },
        { who: b.b6, category: STANDARD, entered: true }, { who: b.b6, category: STANDARD, entered: false },
    ];
}

async function exportsOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('participant_exports').select('*').eq('event_id', eventId).order('created_at');
    assert.equal(error, null, `participant_exports (contrat I) : ${error?.message}`);
    return (data ?? []) as Row[];
}

function expectedFundsDate(): number {
    return ds.originalEnd.getTime() + PAYOUT_DELAY_HOURS * 3600_000;
}

// ── Clôture, avant la fin ──────────────────────────────────────────────────

describe('5.10 Clôture avant la fin de l’événement : GET …/pilotage/closing', () => {
    test('absents : nombre en direct (billets VALIDE), aucune liste nominative avant la fin', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'closing', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'absents.count', 'absents'), EXPECTED.absents, 'absents = P1-b, P3-a, P3-b et le billet à régler sur place impayé');
        const list = (body.absents as Row | undefined)?.list;
        assert.ok(list === undefined || list === null || (Array.isArray(list) && list.length === 0),
            `liste nominative des absents réservée à l’après-fin : ${JSON.stringify(list)}`);
        const json = JSON.stringify(body);
        for (const name of [ds.buyers.b1.lastName, ds.buyers.b3.lastName, ds.buyers.b6.firstName]) {
            assert.ok(!json.includes(name), `aucune donnée nominative d’absent avant la fin (${name}) : ${json.slice(0, 600)}`);
        }
    });

    test('Z de caisse de S1 : déclaré hors fonds, attendu, écart, détail SCAN / GUICHET et par catégorie', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'closing', 'le partenaire propriétaire');
        const z = listAt(body, 'z', 'Z de caisse');
        const s1 = findItem(z, 'shift_id', ds.shifts.s1, 'Z de la caisse S1');
        assert.equal(s1.status, 'CLOTURE', 'Z de S1 : caisse clôturée');
        assert.equal(numberAt(s1, 'opening_float', 'Z S1 : fonds'), S1_OPENING_FLOAT, 'Z de S1 : fonds de caisse, à part');
        assert.equal(numberAt(s1, 'expected', 'Z S1 : attendu'), EXPECTED.shifts.s1.cash_collected, 'Z de S1 : attendu = espèces encaissées hors fonds');
        assert.equal(numberAt(s1, 'declared', 'Z S1 : déclaré'), S1_DECLARED, 'Z de S1 : déclaré hors fonds');
        assert.equal(numberAt(s1, 'difference', 'Z S1 : écart'), EXPECTED.shifts.s1.difference, 'Z de S1 : écart −500');
        const sources = listAt(s1, 'by_source', 'Z de S1 par source');
        for (const [source, exp] of Object.entries(EXPECTED.zS1.bySource)) {
            const row = findItem(sources, 'source', source, `Z de S1, source ${source}`);
            assert.equal(numberAt(row, 'count', `${source} : opérations`), exp.count, `Z de S1, ${source} : nombre d’opérations`);
            assert.equal(numberAt(row, 'amount', `${source} : montant`), exp.amount, `Z de S1, ${source} : montant`);
        }
        const cats = listAt(s1, 'by_category', 'Z de S1 par catégorie');
        for (const [name, exp] of Object.entries(EXPECTED.zS1.byCategory)) {
            const row = findItem(cats, 'category_id', ds.categoryIds[name], `Z de S1, catégorie ${name}`);
            assert.equal(numberAt(row, 'count', `${name} : billets`), exp.count, `Z de S1, ${name} : billets`);
            assert.equal(numberAt(row, 'amount', `${name} : montant`), exp.amount, `Z de S1, ${name} : montant`);
        }
        assert.ok(!cats.some((c) => c.category_id === ds.categoryIds[VIP]), 'Z de S1 : aucune vente VIP en espèces');
    });

    test('montant net et plage de disponibilité des fonds (min et max des crédits VENTE de l’événement)', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'closing', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'finance.organizer_net', 'net organisateur'), EXPECTED.organizerNet, 'net = ventes en ligne non remboursées (29 000)');
        const expected = expectedFundsDate();
        for (const key of ['funds_available_from', 'funds_available_to']) {
            const d = dateOf((body.finance as Row | undefined)?.[key], `finance.${key}`).getTime();
            assert.ok(Math.abs(d - expected) < 1_000,
                `finance.${key} = fin de l’événement + ${PAYOUT_DELAY_HOURS} h (${new Date(expected).toISOString()}), reçu ${JSON.stringify(body.finance)}`);
        }
    });
});

// ── Export des participants ────────────────────────────────────────────────

describe('5.10 Export des participants : POST …/participants-export', () => {
    test('sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email', async () => {
        const res = await participantsExport(ds.partner, ds.eventId, { includeContacts: false });
        const csv = assertCsv(res, 'export sans contacts');
        assert.equal(csv.header.length, 5, `cinq colonnes sans les contacts (Canal ajouté, lot 9) : ${JSON.stringify(csv.header)}`);
        const nameCol = columnIndex(csv.header, HEADER_PATTERNS.name, 'export');
        const catCol = columnIndex(csv.header, HEADER_PATTERNS.category, 'export');
        const statusCol = columnIndex(csv.header, HEADER_PATTERNS.status, 'export');
        const entryCol = columnIndex(csv.header, HEADER_PATTERNS.entry, 'export');
        assert.equal(csv.rows.length, EXPECTED.exportRows, `une ligne par billet VALIDE ou UTILISE, invitation comprise : ${csv.rows.length} ligne(s)`);

        const statusEntered = new Set<string>();
        const statusAbsent = new Set<string>();
        for (const p of participants()) {
            const rows = rowsOf(csv, nameCol, p.who).filter((r) => r[catCol] === p.category && (r[entryCol].trim() !== '') === p.entered);
            assert.ok(rows.length >= 1, `participant ${fullName(p.who)} (${p.category}, ${p.entered ? 'entré' : 'absent'}) absent de l’export : ${JSON.stringify(csv.rows)}`);
            for (const r of rows) (p.entered ? statusEntered : statusAbsent).add(r[statusCol]);
        }
        assert.equal(rowsOf(csv, nameCol, ds.buyers.b1).length, 2, 'Awa Diop : deux billets');
        assert.equal(rowsOf(csv, nameCol, ds.buyers.b3).length, 2, 'Khady Sow : deux billets');
        assert.equal(rowsOf(csv, nameCol, ds.buyers.b4).length, 0, 'billet remboursé exclu de la liste des participants');
        assert.equal(rowsOf(csv, nameCol, ds.buyers.b5).length, 0, 'panier en cours de paiement : aucun participant');
        for (const s of Array.from(statusEntered).concat(Array.from(statusAbsent))) {
            assert.ok(s.trim().length > 0 && !/^[A-Z_]+$/.test(s), `statut du billet en libellé, pas en enum brut : « ${s} »`);
        }
        assert.equal(statusEntered.size, 1, `un seul libellé pour les billets utilisés : ${JSON.stringify(Array.from(statusEntered))}`);
        assert.equal(statusAbsent.size, 1, `un seul libellé pour les billets valides : ${JSON.stringify(Array.from(statusAbsent))}`);
        assert.notDeepEqual(Array.from(statusEntered), Array.from(statusAbsent), 'libellés différents pour un billet utilisé et un billet valide');

        // Heure d'entrée à Dakar (UTC+0) : celle du compostage de P2
        const p2 = (await eventTicketRows(ds.eventId)).find((t) => t.id === ds.tickets.p2);
        const hhmm = new Date(String(p2?.checked_in_at)).toISOString().slice(11, 16);
        const p2Row = rowsOf(csv, nameCol, ds.buyers.b2)[0];
        assert.ok(p2Row[entryCol].replace('h', ':').includes(hhmm), `heure d’entrée de P2 à Dakar (${hhmm}) : « ${p2Row[entryCol]} »`);

        // Ventes au guichet : billets compostés, jamais au nom du vendeur
        const counterRows = csv.rows.filter((r) => !participants().some((p) => r[nameCol].includes(p.who.firstName) && r[nameCol].includes(p.who.lastName)));
        assert.equal(counterRows.length, 3, `trois billets vendus au guichet : ${JSON.stringify(counterRows)}`);
        for (const r of counterRows) {
            assert.ok(r[entryCol].trim() !== '', `billet vendu au guichet : heure d’entrée renseignée ${JSON.stringify(r)}`);
            for (const seller of [ds.c1, ds.c2]) assert.ok(!r[nameCol].includes(seller.lastName), `billet du guichet au nom du vendeur ${fullName(seller)} : ${JSON.stringify(r)}`);
        }

        await assertNoPaymentData(csv, res, 'export sans contacts');
        for (const b of Object.values(ds.buyers)) {
            assert.ok(!res.text.includes(b.email), `email de ${fullName(b)} présent sans la case de finalité`);
            assert.ok(!res.text.includes(b.phone9) && !res.text.includes(b.phoneE164), `téléphone de ${fullName(b)} présent sans la case de finalité`);
        }
    });

    test('contacts sans finalité, ou finalité hors de la liste fermée : 400 PURPOSE_REQUIRED, aucun fichier', async () => {
        for (const [label, body] of [
            ['sans finalité', { includeContacts: true }],
            ['finalité hors liste', { includeContacts: true, purpose: 'MARKETING' }],
            ['finalité en texte libre', { includeContacts: true, purpose: 'Relance commerciale' }],
        ] as Array<[string, Record<string, unknown>]>) {
            const res = await participantsExport(ds.partner, ds.eventId, body);
            assert.equal(res.status, 400, `${label} : 400 attendu, ${showExport(res)}`);
            assert.equal(res.json?.code, 'PURPOSE_REQUIRED', `${label} : code PURPOSE_REQUIRED, ${showExport(res)}`);
            assert.equal(typeof res.json?.error, 'string', `${label} : message d’erreur en français, ${showExport(res)}`);
            assert.ok(!res.text.includes(ds.buyers.b1.email) && !res.text.includes(ds.buyers.b1.lastName), `${label} : aucune donnée de participant`);
        }
    });

    test('contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement', async () => {
        for (const purpose of ['URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION']) {
            const res = await participantsExport(ds.partner, ds.eventId, { includeContacts: true, purpose });
            const csv = assertCsv(res, `export avec contacts (${purpose})`);
            assert.equal(csv.header.length, 7, `${purpose} : sept colonnes avec téléphone et email (Canal ajouté, lot 9) : ${JSON.stringify(csv.header)}`);
            const nameCol = columnIndex(csv.header, HEADER_PATTERNS.name, purpose);
            const phoneCol = columnIndex(csv.header, HEADER_PATTERNS.phone, purpose);
            const emailCol = columnIndex(csv.header, HEADER_PATTERNS.email, purpose);
            assert.equal(csv.rows.length, EXPECTED.exportRows, `${purpose} : même liste de participants`);
            for (const who of [ds.buyers.b1, ds.buyers.b2, ds.buyers.invitee]) {
                const row = rowsOf(csv, nameCol, who)[0];
                assert.ok(row, `${purpose} : ligne de ${fullName(who)}`);
                assert.ok(row[phoneCol].replace(/\D/g, '').endsWith(who.phone9), `${purpose} : téléphone de ${fullName(who)} (${who.phoneE164}), reçu « ${row[phoneCol]} »`);
                assert.equal(row[emailCol].trim(), who.email, `${purpose} : email de ${fullName(who)}`);
            }
            await assertNoPaymentData(csv, res, `export avec contacts (${purpose})`);
        }
    });

    test('chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin events.read aussi', async () => {
        const res = await participantsExport(admin, ds.eventId, { includeContacts: false });
        assertCsv(res, 'export par l’admin');
        const rows = await exportsOf(ds.eventId);
        const find = (actor: string, contacts: boolean, purpose: string | null) =>
            rows.filter((r) => r.actor_id === actor && r.include_contacts === contacts && (r.purpose ?? null) === purpose);
        for (const [label, actor, contacts, purpose] of [
            ['propriétaire sans contacts', ds.partner.userId, false, null],
            ['propriétaire, URGENT_EVENT_INFO', ds.partner.userId, true, 'URGENT_EVENT_INFO'],
            ['propriétaire, SAFETY_AND_RECEPTION', ds.partner.userId, true, 'SAFETY_AND_RECEPTION'],
            ['admin sans contacts', admin.userId, false, null],
        ] as Array<[string, string, boolean, string | null]>) {
            const hits = find(actor, contacts, purpose);
            assert.ok(hits.length >= 1, `export journalisé (${label}) : ${JSON.stringify(rows)}`);
            for (const h of hits) {
                assert.equal(Number(h.row_count), EXPECTED.exportRows, `${label} : nombre de lignes exportées journalisé`);
                assert.ok(h.created_at, `${label} : horodatage`);
            }
        }
        const json = JSON.stringify(rows);
        for (const b of Object.values(ds.buyers)) {
            assert.ok(!json.includes(b.email) && !json.includes(b.lastName), `journal sans donnée de participant (${fullName(b)})`);
        }
    });
});

// ── Clôture, après la fin ──────────────────────────────────────────────────

describe('5.10 Clôture après la fin de l’événement', () => {
    test('après la fin : liste nominative des absents (nom, catégorie), même nombre ; fonds inchangés', async () => {
        await advanceEventTo(ds.eventId, 'TERMINE', { finishShift: await endAfterOwnerRefund() }); // lot 9 bis (R11, w20) : fin passée, mais après le remboursement de P4
        assert.equal(await eventStatus(ds.eventId), 'TERMINE', 'garde-fou : événement terminé');

        const body = await pilotageOk(ds.partner, ds.eventId, 'closing', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'absents.count', 'absents'), EXPECTED.absents, 'absents après la fin : même nombre');
        const list = listAt(body, 'absents.list', 'liste nominative des absents');
        assert.equal(list.length, EXPECTED.absents, `quatre absents nommés : ${JSON.stringify(list)}`);
        const expected = [
            [fullName(ds.buyers.b1), STANDARD],
            [fullName(ds.buyers.b3), ETUDIANT],
            [fullName(ds.buyers.b3), ETUDIANT],
            [fullName(ds.buyers.b6), STANDARD],
        ].map(([n, c]) => `${n} | ${c}`).sort();
        const got = list.map((a) => `${String(a.name ?? '').trim()} | ${String(a.category ?? '').trim()}`).sort();
        assert.deepEqual(got, expected, `absents (nom et catégorie) : ${JSON.stringify(list)}`);
        assert.ok(!JSON.stringify(list).includes(fullName(ds.buyers.b2)), 'un participant entré n’est pas absent');

        const expectedFunds = expectedFundsDate();
        const from = dateOf((body.finance as Row | undefined)?.funds_available_from, 'finance.funds_available_from').getTime();
        assert.ok(Math.abs(from - expectedFunds) < 1_000, `fin avancée : disponibilité des fonds jamais avancée (${new Date(expectedFunds).toISOString()}), reçu ${JSON.stringify(body.finance)}`);
    });
});

/**
 * Lot 9 bis (R11, invariant w20) : la fin avancée tombe entre le remboursement du billet de P4, demandé par l'organisateur
 * pendant la construction du jeu, et maintenant. Une fin à « maintenant − 4 h » placerait ce remboursement après la fin,
 * ce que ticket_refund_request refuse à l'organisateur (REFUND_CLOSED_AFTER_EVENT) : un historique impossible.
 */
async function endAfterOwnerRefund(): Promise<{ startsInHours: number; durationHours: number }> {
    const { data, error } = await service.from('audit_logs').select('created_at').eq('action', 'TICKET_REFUND_REQUESTED')
        .eq('metadata->>event_id', ds.eventId).order('created_at', { ascending: false }).limit(1);
    assert.equal(error, null, `journal TICKET_REFUND_REQUESTED : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'remboursement du billet de P4 journalisé (pilotage-helpers)');
    const endAt = new Date(String((data as Row[])[0].created_at)).getTime() + 500;
    // Le remboursement vient d'être fait (buildKnownDataset) : on attend que la fin choisie soit passée d'au moins 1 s
    while (Date.now() < endAt + 1_000) await new Promise((resolve) => { setTimeout(resolve, 100); });
    assert.ok(endAt < Date.now(), `fin placée entre le remboursement et maintenant (${new Date(endAt).toISOString()})`);
    return { startsInHours: (endAt - Date.now()) / 3600_000 - 4, durationHours: 4 };
}
