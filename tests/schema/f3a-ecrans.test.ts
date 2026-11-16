/**
 * Finition 3a (E-06, E-07, E-30, E-31, E-38) — écrans, contrôle statique (sans base) :
 *  - /admin/finance : une seule période en tête (PeriodPicker), les trois chiffres et les créances (MoneyFigure), le
 *    détail de chacun avec son ancre (#versements-a-reprendre, #remboursements-a-verser, #creances, #detail-gagne,
 *    #du-aux-partenaires, #calcul-retirable, #paiements), défilement vers l'ancre de l'adresse, textes exacts de la
 *    consigne, liste des paiements paginée par le serveur avec ses statuts en français (sans StatusBadge), plus aucun
 *    appel au rapprochement ni code HTTP à l'écran ;
 *  - accueil : « Argent qui attend » en haut, avant « À traiter », liens directs vers les ancres ; un seul revenu,
 *    « Gagné par Event Village » ;
 *  - réglages : la réserve de prudence expliquée ;
 *  - nouveaux fichiers d'écran dans la liste du système de design (tests/helpers/design-files.ts).
 * Sans base : vert dès que les écrans existent ; aucune écriture, donc aucun appel d'invariants (écart signalé).
 * Rouge avant correctif : composants absents, ancienne page (rapprochement, « Revenu net de la plateforme »).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';

const ROOT = process.cwd();
const read = (rel: string): string => {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    return fs.readFileSync(file, 'utf8');
};
/** Code sans commentaires (les commentaires peuvent citer d'anciens textes). */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PAGE = 'app/admin/finance/page.tsx';
const DIR = 'components/admin/finance';
const COMPONENTS = ['MoneyFigure', 'PeriodPicker', 'EarnedDetail', 'OwedDetail', 'DebtsList', 'RefundsToPayList', 'WithdrawableDetail', 'MoneyWaiting'];
const all = (): string => [PAGE, ...COMPONENTS.map((c) => `${DIR}/${c}.tsx`)].map(code).join('\n');

describe('E-06, E-30, E-38 — /admin/finance', () => {
    test('période unique en tête, les trois chiffres et les créances, le détail de chacun', () => {
        const page = code(PAGE);
        for (const c of ['MoneyFigure', 'PeriodPicker', 'EarnedDetail', 'OwedDetail', 'DebtsList', 'RefundsToPayList', 'WithdrawableDetail', 'RefundsToRetry']) {
            assert.match(page, new RegExp(`<${c}\\b`), `${PAGE} ne rend pas <${c}>`);
        }
        assert.equal((page.match(/<PeriodPicker\b/g) ?? []).length, 1, 'une seule période pour toute la page');
        for (const title of ['Gagné par Event Village', 'Dû aux partenaires', 'Retirable par Event Village', 'Créances']) {
            assert.ok(page.includes(title), `${PAGE} : chiffre « ${title} » absent`);
        }
    });

    test('ancres de chaque liste et de chaque détail ; défilement vers l’ancre de l’adresse', () => {
        const text = all();
        for (const anchor of ['versements-a-reprendre', 'remboursements-a-verser', 'creances', 'detail-gagne', 'du-aux-partenaires', 'calcul-retirable', 'paiements']) {
            assert.ok(text.includes(`id="${anchor}"`), `ancre #${anchor} absente`);
        }
        assert.match(code(PAGE), /useHashScroll\(/, `${PAGE} : pas de défilement vers l’ancre de l’adresse`);
        assert.match(code('hooks/useHashScroll.ts'), /scrollIntoView/, 'hooks/useHashScroll.ts : défilement absent');
    });

    test('textes exacts de la consigne', () => {
        const text = all();
        for (const t of [
            'Rien n’est retirable pour le moment : l’argent du compte est dû aux partenaires et aux clients.',
            'Solde SamirPay illisible pour le moment',
            'En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte.',
        ]) assert.ok(text.includes(t), `texte absent : « ${t} »`);
    });

    test('routes de la finition seulement ; plus de rapprochement ni de code HTTP à l’écran', () => {
        const page = code(PAGE);
        assert.match(page, /\/api\/admin\/finance\/summary/, 'synthèse non lue');
        assert.match(page, /\/api\/admin\/finance\/payments/, 'liste des paiements non lue');
        assert.doesNotMatch(page, /\/api\/admin\/finance\/reconciliation/, 'ancien rapprochement encore lu (tous les paiements chargés)');
        assert.doesNotMatch(all(), /\(erreur \$\{/, 'code HTTP montré à l’écran');
    });

    test('statuts de paiement en français propres aux paiements (pas de StatusBadge), même mot dans le filtre', () => {
        const page = code(PAGE);
        assert.doesNotMatch(page, /\bStatusBadge\b/, `${PAGE} emploie encore StatusBadge`);
        assert.match(page, /paymentStatusLabel\(/, 'libellé des paiements absent');
        assert.match(page, /PAYMENT_STATUS_FILTER/, 'filtre de statut sans les libellés des badges');
        assert.match(page, /<Pagination\b/, 'liste des paiements non paginée');
    });
});

describe('E-07 — accueil de l’administration', () => {
    test('« Argent qui attend » en haut, avant « À traiter », avec un lien direct vers chaque liste', () => {
        const dash = code('app/admin/dashboard/page.tsx');
        const block = dash.indexOf('<MoneyWaiting');
        const todo = dash.indexOf('À traiter');
        assert.ok(block >= 0, 'bloc « Argent qui attend » absent de l’accueil');
        assert.ok(todo < 0 || block < todo, '« Argent qui attend » doit précéder « À traiter »');
        const waiting = code(`${DIR}/MoneyWaiting.tsx`);
        for (const href of ['/admin/finance#versements-a-reprendre', '/admin/finance#remboursements-a-verser', '/admin/finance#creances']) {
            assert.ok(waiting.includes(href), `lien ${href} absent`);
        }
        assert.ok(waiting.includes('Compteur indisponible'), 'compteur illisible sans texte (jamais 0)');
    });

    test('un seul revenu : « Gagné par Event Village », plus « Revenu net de la plateforme »', () => {
        const dash = code('app/admin/dashboard/page.tsx');
        assert.ok(dash.includes('Gagné par Event Village'), 'accueil sans « Gagné par Event Village »');
        assert.ok(!dash.includes('Revenu net de la plateforme'), 'second revenu encore affiché');
        assert.match(dash, /earnedMonth/, 'accueil sans le gagné du mois servi par le serveur');
    });
});

describe('réglages et système de design', () => {
    test('la réserve de prudence est expliquée dans les réglages', () => {
        const settings = code('app/admin/finance-settings/page.tsx');
        for (const k of ["'finance.safety_reserve_mode'", "'finance.safety_reserve_amount'"]) assert.ok(settings.includes(k), `réglage ${k} sans libellé`);
        assert.ok(settings.includes('En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte.'), 'réserve non expliquée');
    });

    test('nouveaux fichiers d’écran dans la liste du système de design', () => {
        for (const f of [PAGE, ...COMPONENTS.map((c) => `${DIR}/${c}.tsx`)]) {
            assert.ok(MIGRATED_DESIGN_FILES.includes(f), `${f} absent de tests/helpers/design-files.ts`);
        }
    });
});
