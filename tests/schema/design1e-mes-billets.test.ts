/**
 * Design 1e (point B, décision du 21/11) — Mes billets rapide quel que soit le nombre de billets :
 *  - premier affichage : les billets À VENIR seulement (même règle que l'onglet : valable et pas encore terminé), servis
 *    par le serveur dans la même réponse ; « Tous mes billets » et « Historique » (billets passés) chargés à leur
 *    ouverture seulement (GET /api/tickets complet) ;
 *  - portefeuille affiché par 10 billets, la suite au défilement (et par un bouton, pour le clavier) ;
 *  - hors ligne INCHANGÉ : la synchronisation en arrière-plan lit toujours la liste complète et enregistre tous les
 *    billets ; la réconciliation de Mes billets (qui efface les billets absents de la liste) ne tourne qu'avec la liste
 *    COMPLÈTE, jamais avec la liste des billets à venir (sinon les billets passés enregistrés seraient effacés).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

describe('design 1e — Mes billets par période', () => {
    test('règle « à venir » commune : valable ET pas encore terminé', async () => {
        const { isActiveUpcoming, upcomingOnly, TICKETS_UPCOMING_PARAM } = await import('../../lib/tickets/periode');
        assert.equal(TICKETS_UPCOMING_PARAM, 'periode=a-venir');
        const list = [
            { id: 'a', status: 'VALIDE', isUpcoming: true },
            { id: 'b', status: 'VALIDE', isUpcoming: false },
            { id: 'c', status: 'UTILISE', isUpcoming: false },
            { id: 'd', status: 'REMBOURSE', isUpcoming: true },
            { id: 'e', status: 'VALIDE', isUpcoming: true },
        ];
        assert.deepEqual(upcomingOnly(list).map((t) => t.id), ['a', 'e']);
        assert.equal(isActiveUpcoming({ status: 'VALIDE', isUpcoming: true }), true);
        assert.equal(isActiveUpcoming({ status: 'ANNULE', isUpcoming: true }), false);
    });

    test('API : ?periode=a-venir filtre APRÈS les mêmes contrôles de session (sous-ensemble des billets du compte)', () => {
        const src = read('app/api/tickets/route.ts');
        assert.match(src, /searchParams\.get\('periode'\) === 'a-venir' \? upcomingOnly\(formatted\) : formatted/);
        const guard = src.indexOf('FORBIDDEN_OTHER_USER');
        const filter = src.indexOf("searchParams.get('periode')");
        assert.ok(guard > 0 && filter > guard, 'le filtre vient après le contrôle du compte');
    });

    test('page : à venir seulement au premier affichage (onglet par défaut), liste complète si un autre onglet est demandé', () => {
        const page = read('app/tickets/page.tsx');
        assert.match(page, /complete: !upcoming/);
        assert.match(page, /upcoming \? upcomingOnly\(list\) : list/);
        const view = read('app/tickets/TicketsView.tsx');
        assert.match(view, /if \(tab === 'a-venir' \|\| complete\) return undefined;/, 'liste complète chargée à l’ouverture d’un autre onglet');
        assert.match(view, /fetch\(`\/api\/tickets\$\{scope === 'a-venir' \? `\?\$\{TICKETS_UPCOMING_PARAM\}` : ''\}`/);
    });

    test('hors ligne : réconciliation de Mes billets avec la liste COMPLÈTE seulement ; synchronisation de fond inchangée', () => {
        const view = read('app/tickets/TicketsView.tsx');
        assert.match(view, /if \(phase !== 'ready' \|\| !userId \|\| !complete\) return;\n\s*void reconcileWithServerTickets\(userId, tickets\);/);
        const sync = read('components/tickets/OfflineTicketsSync.tsx');
        assert.match(sync, /res = await fetch\('\/api\/tickets', \{ cache: 'no-store', credentials: 'same-origin' \}\);/, 'la synchronisation lit toujours la liste complète');
        assert.doesNotMatch(sync, /periode/);
    });

    test('portefeuille par 10, la suite au défilement ou par un bouton', () => {
        const view = read('app/tickets/TicketsView.tsx');
        assert.match(view, /const WALLET_PAGE = 10;/);
        assert.match(view, /shown\.slice\(0, limit\)/);
        assert.match(view, /onEndReached=\{more\}/);
        assert.match(view, /Afficher les billets suivants/);
        const wallet = read('components/tickets/TicketWallet.tsx');
        assert.match(wallet, /onEndReached\?: \(\) => void/);
        assert.match(wallet, /`Billet \$\{index \+ 1\} sur \$\{total \?\? count\}`/);
    });
});
