/**
 * Lot 9 ter, tâche 9t.18 (consigne 4) — écrans du tableau de bord des entrées : onglet Entrées rechargé toutes les 60 s,
 * un seul composant EntriesBreakdown pour les vues figées (onglet et clôture), textes exacts, aucun agrégat calculé dans
 * le navigateur, réglages de l'alerte à l'écran de l'administration, description de l'export à jour (contrat 5.D,
 * D.1.4 (1) à (5), D.1.6 T4 ; X1, X10, X21, ED3).
 *
 * Suite SANS BASE (lecture des sources) : aucune écriture, donc aucun appel aux invariants (écart signalé).
 * Les sources sont comparées après la normalisation de tests/schema/textes-techniques-9bis.test.ts:58 (apostrophes et
 * espaces insécables ramenées à leur forme simple), commentaires retirés.
 *
 * Rouge avant correctif (E-D fix(9t.18e), E-B fix(9t.12e) et fix(9t.18-EB)) : components/partner/pilotage/EntriesBreakdown.tsx
 * et ClosingReportSummary.tsx absents ; EntriesTab.tsx sans rechargement ni textes ; finance-settings sans les deux clés ;
 * ClosingTab.tsx:225 décrit encore l'export à 5 colonnes.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PILOTAGE = 'components/partner/pilotage';
const ENTRIES_TAB = `${PILOTAGE}/EntriesTab.tsx`;
const BREAKDOWN = `${PILOTAGE}/EntriesBreakdown.tsx`;
const SUMMARY = `${PILOTAGE}/ClosingReportSummary.tsx`;
const CLOSING_TAB = `${PILOTAGE}/ClosingTab.tsx`;
const SETTINGS_PAGE = 'app/admin/finance-settings/page.tsx';

/** Apostrophes et espaces insécables ramenés à leur forme simple (textes-techniques-9bis.test.ts:58). */
function norm(s: string): string {
    return s.replace(/[’‘]/g, '\'').replace(/[  ]/g, ' ');
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

function source(rel: string, what: string): string {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent (${what})`);
    return norm(stripComments(fs.readFileSync(file, 'utf8')));
}

function assertTexts(src: string, rel: string, texts: string[]): void {
    const missing = texts.map(norm).filter((t) => !src.includes(t));
    assert.deepEqual(missing, [], `${rel} : textes exacts du contrat absents`);
}

const BREAKDOWN_TEXTS = [
    'Par zone',
    'Entrés sur attendus. Les attendus sont les billets des catégories admises dans la zone : une catégorie admise dans deux zones compte dans les deux.',
    '(contrôle de zone)',
    ' entrés sur ',
    ' contrôlés sur ',
    'Zone non précisée',
    'Entrées enregistrées avant la création des zones',
    'Par porte',
    'Par point d’entrée',
    'Entrées par porte',
    'Point d’entrée non précisé',
    'Aucune entrée pour le moment.',
    'Par catégorie',
    'Aucune catégorie.',
    'Par origine',
    'Flux par quart d’heure',
    'Refus par motif',
    'Validations par la liste des invités',
    'Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée.',
    'Aucune entrée validée par la liste des invités.',
];

const TAB_TEXTS = [
    'Liste des invités',
    'Entrées validées par la liste, pièce vérifiée',
    'Débit',
    'Moyenne des 5 dernières minutes',
    'Contrôleurs actifs',
    'Un scan dans les 10 dernières minutes',
    'Mis à jour à',
    'Beaucoup de refus à',
    'Vérifiez avec le contrôleur : faux billets, mauvaise porte ou billets déjà utilisés.',
    'Débit par minute',
    'Entrées de chaque minute sur les 30 dernières minutes, heure de Dakar.',
    'Aucun passage pour le moment.',
];

describe('9t.18 T4 — écrans du tableau de bord des entrées', () => {
    test('l’onglet Entrées se recharge toutes les 60 s et nettoie son intervalle', () => {
        const src = source(ENTRIES_TAB, 'onglet Entrées');
        assert.match(src, /setInterval\s*\([\s\S]{0,200}?60_?000/, `${ENTRIES_TAB} : setInterval(…, 60_000)`);
        assert.match(src, /clearInterval\s*\(/, `${ENTRIES_TAB} : clearInterval au démontage`);
    });

    test('un seul composant pour les vues figées', () => {
        const importRe = /import\s+(?:\{[^}]*\bEntriesBreakdown\b[^}]*\}|EntriesBreakdown\b)[^;]*from\s+['"](?:\.\/EntriesBreakdown|@\/components\/partner\/pilotage\/EntriesBreakdown)['"]/;
        source(BREAKDOWN, 'composant EntriesBreakdown, déclaré par R0 (8.3)');
        for (const rel of [ENTRIES_TAB, SUMMARY]) {
            assert.match(source(rel, 'rendu des vues des entrées'), importRe, `${rel} importe ./EntriesBreakdown`);
        }
    });

    test('textes exacts du tableau de bord', () => {
        const breakdown = source(BREAKDOWN, 'composant EntriesBreakdown');
        const tab = source(ENTRIES_TAB, 'onglet Entrées');
        const both = `${breakdown}\n${tab}`;
        assertTexts(both, `${BREAKDOWN} ou ${ENTRIES_TAB}`, BREAKDOWN_TEXTS);
        assertTexts(both, `${ENTRIES_TAB} ou ${BREAKDOWN}`, TAB_TEXTS);
        assert.ok(!/Beaucoup de refus à\s*:/.test(both), 'aucun « : » après « Beaucoup de refus à » (titre « Beaucoup de refus à {porte} »)');
    });

    test('aucun calcul d’agrégat dans EntriesBreakdown', () => {
        const src = source(BREAKDOWN, 'composant EntriesBreakdown');
        const filterLength = /\.filter\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*\.length\b/;
        assert.ok(!/\.reduce\s*\(/.test(src), `${BREAKDOWN} : reduce (les totaux viennent de pilotage_compute_entries)`);
        assert.ok(!filterLength.test(src), `${BREAKDOWN} : filter(…).length (comptage côté client)`);
    });

    test('réglages de l’alerte à l’écran de l’administration', () => {
        const src = source(SETTINGS_PAGE, 'réglages de la plateforme');
        assertTexts(src, SETTINGS_PAGE, [
            '\'access.refusal_alert_threshold\'',
            '\'access.refusal_alert_minutes\'',
            'Alerte de refus à une porte : nombre de refus',
            'Alerte de refus à une porte : durée observée',
            'Quand une porte enregistre ce nombre de refus ou plus pendant la durée observée, l’organisateur reçoit une alerte, au plus une fois par porte et par durée.',
            'Entier de 3 à 500.',
            'Durée pendant laquelle les refus d’une même porte sont comptés pour l’alerte. Entier de 1 à 60.',
            'Fenêtre de scan, saisie manuelle des numéros de billet, vente au guichet, seuil de stock affiché au public et alerte de refus à une porte.',
        ]);
    });

    test('description de l’export à jour', () => {
        const src = source(CLOSING_TAB, 'onglet Clôture');
        assertTexts(src, CLOSING_TAB, ['Fichier CSV : nom, catégorie, origine, statut du billet, heure d’entrée, zone et porte. Aucune donnée de paiement ni numéro de billet.']);
        assert.ok(!src.includes(norm('statut du billet et heure d’entrée.')), `${CLOSING_TAB} : ancienne description de l’export (5 colonnes)`);
    });
});
