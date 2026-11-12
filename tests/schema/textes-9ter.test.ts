/**
 * Lot 9 ter, tâche 9t.13 (consigne 0.9 ; contrat 5.B 9t.13, B.5 points 10 et 12, décision B-D24) — textes faux, contrôle
 * statique :
 *  1. onglet Invitations du pilotage : l'annulation d'une invitation prévient l'invité (ticket_invitation_cancel met
 *     TICKET_CANCELLED en file, M/20261109000009:1059-1073) ; plus de « sans SMS » ni « aucun SMS n’est envoyé » ;
 *     « l’invité est prévenu par SMS » dans la description et dans la fenêtre de confirmation (deux fois) ;
 *  2. fiche admin d'un événement : le champ de la fenêtre de clôture d'un suspendu s'intitule « Motif de la clôture »
 *     (aujourd'hui « Motif du refus »).
 * Comparaison après la normalisation de textes-techniques-9bis.test.ts:58 (X1, EC8 : apostrophes et espaces insécables
 * ramenés à leur forme simple), commentaires exclus.
 *
 * Rouge avant correctif (E-C fix(9t.13-EC) : InvitationsTab.tsx:441, :449 ; E-B : app/admin/events/[id]/page.tsx:791).
 * Suite sans base et sans écriture : aucune aide d'invariants en after() (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVITATIONS_TAB = 'components/partner/pilotage/InvitationsTab.tsx';
const ADMIN_EVENT = 'app/admin/events/[id]/page.tsx';

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

/** Apostrophes et espaces insécables ramenés à leur forme simple (textes-techniques-9bis.test.ts:58). */
function norm(s: string): string {
    return s.replace(/[’‘]/g, '\'').replace(/[  ]/g, ' ');
}

function read(rel: string): string {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    return norm(stripComments(fs.readFileSync(file, 'utf8')));
}

function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('9t.13 (0.9) : textes de l\'application', () => {
    test('InvitationsTab : plus de « sans SMS » ni « aucun SMS n’est envoyé », « l’invité est prévenu par SMS » deux fois', () => {
        const src = read(INVITATIONS_TAB);
        assert.equal(count(src, 'sans SMS'), 0, `${INVITATIONS_TAB} : « sans SMS » faux (TICKET_CANCELLED part à l'invité)`);
        assert.equal(count(src, 'aucun SMS n\'est envoyé'), 0, `${INVITATIONS_TAB} : « aucun SMS n’est envoyé » faux`);
        assert.equal(count(src, 'l\'invité est prévenu par SMS'), 2, `${INVITATIONS_TAB} : « l’invité est prévenu par SMS » dans la description et dans la confirmation`);
        assert.ok(src.includes('Les numéros sont masqués. Une invitation non scannée peut être annulée : la place revient au stock et l\'invité est prévenu par SMS.'),
            'description de l\'historique, texte exact de B.5 point 12');
        assert.ok(src.includes('ne sera plus valable. La place revient au stock et l\'invité est prévenu par SMS.'),
            'message de la fenêtre de confirmation, texte exact de B.5 point 12');
    });

    test('fenêtre de clôture de l\'admin : le champ s\'intitule « Motif de la clôture »', () => {
        const src = read(ADMIN_EVENT);
        assert.match(src, /to\s*===\s*'TERMINE'\s*\?\s*'Motif de la clôture'/, `${ADMIN_EVENT} : libellé « Motif de la clôture » pour la clôture (aujourd'hui « Motif du refus », :791)`);
        assert.match(src, /to\s*===\s*'SUSPENDU'\s*\?\s*'Motif de la suspension'/, 'libellé de la suspension inchangé');
    });
});
