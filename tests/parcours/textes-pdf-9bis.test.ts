/**
 * Lot 9 bis, tâche 41 (R77 ; contrat 5.41 ; découverte D-txt 2, R77) — accents des PDF.
 *  - billet (GET /api/tickets/[id]/pdf) : « Total payé », « CATÉGORIE », « NUMÉRO DE BILLET » ;
 *  - rapport de clôture (GET /api/partner/reports/closing/pdf) : « Édité le », « Capacité ».
 * Les PDF ne sont pas compressés : le texte se lit en latin1 (WinAnsi), où é vaut \xE9 et É \xC9
 * (cloture-vocabulaire.test.ts, legacy-exports-partenaire.test.ts:140-142). Témoin de lisibilité dans chaque document
 * (numéro du billet, référence CLOTURE-) : la recherche a un sens.
 *
 * Rouge avant correctif (fix(9b.41-R77) de S-E, route du billet par S-C `fix(9b.41-SC)`) : textes fixes écrits sans
 * accent (app/api/tickets/[id]/pdf/route.ts:119 « Total paye », lib/tickets/ticket-pdf.service.ts:178 « CATEGORIE /
 * FORMULE », :204 « NUMERO DE BILLET », lib/partner/partner-dashboard.service.ts:930 « Edite le: », :945 « Capacite: »).
 * after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { GET as ticketPdfRoute } from '../../app/api/tickets/[id]/pdf/route';
import { GET as closingPdfRoute } from '../../app/api/partner/reports/closing/pdf/route';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';

let partner: TestPartner;
let ev: DraftEvent;
let holder: Buyer;
let ticketId: string;
let ticketNumber: string;

before(async () => {
    partner = await newPartner('textes-pdf');
    ev = await createDraftEvent(partner, 'textes-pdf', [{ name: 'Standard', price: 5000, total: 10 }], {
        title: `Festival Accents ${randomBytes(3).toString('hex')}`, startsInHours: 72,
    });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    holder = await newBuyer('textes-pdf-porteur');
    const { tickets } = await buyConfirmed(holder, ev, [['Standard', 1]]);
    ticketId = String(tickets[0].id);
    const { data, error } = await service.from('tickets').select('ticket_number').eq('id', ticketId).single();
    assert.equal(error, null, `billet : ${error?.message}`);
    ticketNumber = String(data.ticket_number);
});

after(async () => {
    await assertLot9bisInvariants('textes-pdf-9bis');
});

async function pdfText(res: Response, what: string): Promise<string> {
    assert.equal(res.status, 200, `${what} : HTTP ${res.status}`);
    assert.match(res.headers.get('content-type') ?? '', /application\/pdf/, `${what} : PDF attendu`);
    return Buffer.from(await res.arrayBuffer()).toString('latin1');
}

describe('R77 — PDF du billet : textes fixes accentués (WinAnsi)', () => {
    test('« Total payé », « CATÉGORIE », « NUMÉRO DE BILLET »', async () => {
        const res = await ticketPdfRoute(jsonRequest(`/api/tickets/${ticketId}/pdf`, 'GET', holder.accessToken), routeContext({ id: ticketId }));
        const text = await pdfText(res, 'PDF du billet');
        assert.ok(text.includes(ticketNumber), 'témoin : le numéro du billet se lit dans le PDF, la recherche a un sens');
        const missing = ['Total pay\xE9', 'CAT\xC9GORIE', 'NUM\xC9RO DE BILLET'].filter((t) => !text.includes(t));
        assert.deepEqual(missing, [], 'textes accentués absents (aujourd’hui « Total paye », « CATEGORIE / FORMULE », « NUMERO DE BILLET »)');
        assert.ok(!text.includes('Total paye :'), 'ancien texte « Total paye : » encore présent');
    });
});

describe('R77 — rapport de clôture : textes fixes accentués (WinAnsi)', () => {
    test('« Édité le », « Capacité »', async () => {
        const res = await closingPdfRoute(jsonRequest(`/api/partner/reports/closing/pdf?eventId=${ev.eventId}`, 'GET', partner.accessToken));
        const text = await pdfText(res, 'rapport de clôture');
        assert.ok(text.includes(`CLOTURE-${ev.eventId.slice(0, 8).toUpperCase()}`), 'témoin : la référence CLOTURE- se lit dans le PDF');
        const missing = ['\xC9dit\xE9 le', 'Capacit\xE9'].filter((t) => !text.includes(t));
        assert.deepEqual(missing, [], 'textes accentués absents (aujourd’hui « Edite le: », « Capacite: »)');
        assert.ok(!text.includes('Edite le:') && !text.includes('Capacite:'), 'anciens textes sans accent encore présents');
    });
});
