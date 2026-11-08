/**
 * Lot 9, tâche 9.3, A39 (contrat 5.4, L43) — le PDF de clôture s'intitule « Rapport de clôture » : plus aucun
 * « certifié », « certificat », « document comptable » ni « document officiel » (L43 : ce dernier n'est pas cité par la
 * consigne, retiré au plus prudent), à l'écran comme dans le PDF. La référence CLOTURE- est gardée.
 *
 * Le PDF n'est pas compressé : le texte se lit en latin1 (legacy-exports-partenaire.test.ts:140-142). `ô` y vaut \xF4,
 * par escapePdfText (WinAnsi).
 *
 * Rouge avant correctif : le service écrit encore les quatre libellés (lib/partner/partner-dashboard.service.ts:918, 921,
 * 1069, 1072). after() : assertLot9Invariants, rouge jusqu'à M2 et M4.
 * Verts dès l'écriture (signalés) : la référence CLOTURE- dans le PDF ; aucun de ces mots à l'écran (aucun écran ne les porte
 * aujourd'hui, le test garde cet état). legacy-exports-partenaire reste inchangé.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GET as closingPdfRoute } from '../../app/api/partner/reports/closing/pdf/route';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { newBuyer } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';

const FORBIDDEN = /certifi|certificat|document comptable|document officiel/i;
const SERVICE_FILE = 'lib/partner/partner-dashboard.service.ts';
const SCREENS = ['components/partner/ClosingReportModal.tsx', 'components/partner/pilotage/ClosingTab.tsx'];
const WALKED_DIRS = ['app', 'components', 'hooks', 'lib'];

let partner: TestPartner;
let ev: DraftEvent;
let pdfText: string;

before(async () => {
    partner = await newPartner('cloture-vocabulaire');
    ev = await createDraftEvent(partner, 'cloture-vocabulaire', [{ name: 'Standard', price: 5000, total: 10 }], {
        title: `Festival Clôture ${randomBytes(3).toString('hex')}`, startsInHours: 72,
    });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    const client = await newBuyer('cloture-vocabulaire-client');
    await buyConfirmed(client, ev, [['Standard', 1]]);
    const res = await closingPdfRoute(jsonRequest(`/api/partner/reports/closing/pdf?eventId=${ev.eventId}`, 'GET', partner.accessToken));
    assert.equal(res.status, 200, `rapport de clôture : HTTP ${res.status}`);
    pdfText = Buffer.from(await res.arrayBuffer()).toString('latin1');
});

after(async () => {
    await assertLot9Invariants('cloture-vocabulaire');
});

function walk(dir: string, out: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
}

describe('A39 — vocabulaire du rapport de clôture', () => {
    test('PDF : aucun « certifié », « certificat », « document comptable » ni « document officiel »', () => {
        const hits = pdfText.split('\n').filter((line) => FORBIDDEN.test(line));
        assert.deepEqual(hits, [], `mentions interdites dans le PDF :\n${hits.join('\n')}`);
    });

    test('PDF : le titre est « Rapport de clôture », avec ô en WinAnsi', () => {
        assert.ok(pdfText.includes('Rapport de cl\xF4ture'), 'titre « Rapport de clôture » absent du PDF');
    });

    test('PDF : témoin, la référence CLOTURE- de l’événement reste (vert dès l’écriture)', () => {
        assert.ok(pdfText.includes(`CLOTURE-${ev.eventId.slice(0, 8).toUpperCase()}`), 'référence CLOTURE- absente du PDF');
    });

    test('statique : le service n’écrit plus ces libellés', () => {
        const text = fs.readFileSync(path.join(process.cwd(), ...SERVICE_FILE.split('/')), 'utf8');
        const hits = text.split('\n').filter((line) => FORBIDDEN.test(line));
        assert.deepEqual(hits, [], `${SERVICE_FILE} :\n${hits.join('\n')}`);
    });

    test('statique : témoin, les écrans de clôture n’emploient aucun de ces mots (vert dès l’écriture)', () => {
        for (const rel of SCREENS) {
            const full = path.join(process.cwd(), ...rel.split('/'));
            assert.ok(fs.existsSync(full), `${rel} introuvable : le contrôle ne prouverait rien`);
            assert.doesNotMatch(fs.readFileSync(full, 'utf8'), FORBIDDEN, `${rel} : mention interdite`);
        }
    });

    test('statique : aucun fichier de app, components, hooks, lib (hors service, contrôlé ci-dessus) n’emploie ces mots (vert dès l’écriture)', () => {
        const files: string[] = [];
        for (const dir of WALKED_DIRS) walk(path.join(process.cwd(), dir), files);
        assert.ok(files.length > 100, `parcours trop court : ${files.length} fichiers`);
        const offenders = files
            .filter((f) => path.relative(process.cwd(), f).split(path.sep).join('/') !== SERVICE_FILE)
            .filter((f) => FORBIDDEN.test(fs.readFileSync(f, 'utf8')))
            .map((f) => path.relative(process.cwd(), f));
        assert.deepEqual(offenders, [], `mentions interdites dans :\n${offenders.join('\n')}`);
    });
});
