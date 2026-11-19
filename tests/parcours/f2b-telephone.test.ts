/**
 * Finition 2b (C) — confort sur téléphone. Sans base : lecture des fichiers.
 *  a. Nom de chaque étape visible à toutes les tailles (pas seulement 1 à 5), écran « Vérifier » dans le pas à pas.
 *  b. Barre du bas fixe « Précédent / Suivant » sous 1024 px, à sa place au-delà ; marge de la zone sûre (barre des gestes) ;
 *     la barre « Navigation rapide » de l'application est masquée tant que la barre du formulaire est affichée (deux
 *     barres fixes ne s'empilent pas) : attribut posé sur body par le formulaire, règle CSS, tous navigateurs ; rien
 *     dans le JavaScript de chaque page (budgets) ; le bas de la page laisse la place à la barre.
 *  c. Carte de l'étape Accès : bloc isolé, le bouton « Déplacer la carte » (z-[500]) passe sous la barre fixe en
 *     défilant (« Suivant » jamais recouvert).
 * Rouge avant le correctif : noms cachés sous 640 px (« hidden … sm:inline »), barre dans le flux, navigation rapide
 * affichée. Rouge sur f47921b77 (run complet 275, poids JavaScript dépassé : test d'adresse dans AppLayout, chargé par
 * chaque page) : attribut et règle absents ; bloc de la carte non isolé (relecture du correctif). Suite sans base ni
 * écriture : aucun appel d'invariants (comme les suites statiques).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const form = read('components/events/EventForm.tsx');

describe('a. nom de l’étape visible sur téléphone', () => {
    // Design 1c (stepper numéroté, consigne du lot) : sous 640 px, six pastilles de 48 px (le nom de chaque étape n'y tient
    // pas en 14 px) ; le nom de l'étape COURANTE est écrit en toutes lettres au-dessus (« Étape n sur 5 — {titre} »), le nom
    // de chaque étape est lu par les lecteurs d'écran (bouton) et s'affiche sous sa pastille à partir de 640 px, entier
    // (jamais tronqué). Remplace l'exigence de la finition 2b (C) « nom de chaque étape visible sur téléphone » (trois
    // colonnes de cases), décision signalée au compte rendu du design 1c.
    test('nom de l’étape courante écrit sur téléphone, nom de chaque étape lu et affiché dès 640 px ; six cases (5 étapes et « Vérifier »)', () => {
        assert.doesNotMatch(form, /className="hidden truncate sm:inline">\{s\.label\}/, 'libellé tronqué');
        assert.match(form, /`Étape \$\{stepIndex \+ 1\} sur \$\{STEPS\.length\} — \$\{currentStep\.heading\}`/, 'étape courante en toutes lettres');
        assert.match(form, /\{s\.label\}/);
        assert.match(form, /'hidden max-w-full break-words text-center text-sm leading-tight sm:block'/, 'nom sous la pastille dès 640 px, entier');
        assert.match(form, /<span className="sr-only">\s*\{`\$\{s\.id === 'verifier' \? s\.heading : `Étape \$\{i \+ 1\} : \$\{s\.heading\}`\}/, 'nom lu par les lecteurs d’écran');
        assert.match(form, /<ol className="mt-3 flex items-start">\s*\{SCREENS\.map/, 'une case par écran (SCREENS : 5 étapes et « Vérifier »)');
        assert.match(form, /label: 'Vérifier', heading: 'Vérifier avant d’envoyer'/);
    });
});

describe('b. barre du bas fixe « Précédent / Suivant »', () => {
    test('fixe sous 1024 px, à sa place au-delà, marge de la zone sûre', () => {
        assert.match(form, /form-action-bar fixed inset-x-0 bottom-0 z-40 [^"]*lg:static/);
        const css = read('app/globals.css');
        assert.match(css, /\.form-action-bar \{\s*padding-bottom: max\(0\.75rem, env\(safe-area-inset-bottom, 0px\)\);/);
        // Design 1c : sur l'écran « Vérifier », la barre porte en plus le grand bouton (56 px) : bas de page plus grand
        assert.match(form, /'mx-auto w-full max-w-4xl pt-6 lg:pb-10', onReview && canSend \? 'pb-64' : 'pb-40'/, 'bas de page dégagé pour la barre');
    });
    test('« Navigation rapide » masquée tant que la barre du formulaire est affichée (attribut sur body, règle CSS)', () => {
        const css = read('app/globals.css');
        assert.match(css, /body\[data-form-action-bar\] nav\[aria-label="Navigation rapide"\] \{\s*display: none;\s*\}/);
        // Relecture du correctif : avec :has(), un navigateur ancien gardait la navigation PAR-DESSUS la barre (page isolée
        // par .ev-page-enter : aucun z-index de la barre ne passe au-dessus) ; l'attribut vaut pour tous les navigateurs
        assert.doesNotMatch(css, /:has\(\.form-action-bar\)/);
        assert.match(form, /function QuickNavHidden\(\) \{\s*useLayoutEffect\(\(\) => \{\s*document\.body\.setAttribute\('data-form-action-bar', ''\);\s*return \(\) => document\.body\.removeAttribute\('data-form-action-bar'\);\s*\}, \[\]\);\s*return null;\s*\}/);
        assert.match(form, /<div className="form-action-bar [^"]*">\s*<QuickNavHidden \/>/, 'attribut posé tant que la barre est rendue');
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /<nav aria-label="Navigation rapide" className="safe-bottom fixed inset-x-0 bottom-0 z-40 /, 'libellé visé par la règle CSS');
        // Run complet 275 : AppLayout est chargé par chaque page ; aucun code de la finition 2b n'y entre (budgets de
        // scripts/js-budget.json). Contrôle dans un vrai navigateur : captures partenaire-creation-* (e2e/support/screens.ts).
        assert.doesNotMatch(layout, /EVENT_FORM_ROUTE|form-action-bar/);
    });
});

describe('c. carte de l’étape Accès sous la barre fixe', () => {
    test('bloc de la carte isolé : « Déplacer la carte » (z-[500]) au-dessus de la carte, sous la barre d’actions', () => {
        const picker = read('components/ui/MapPicker.tsx');
        assert.match(picker, /<div className="relative isolate">\s*<div\s+ref=\{mapRef\}[\s\S]*?className="absolute right-2 top-2 z-\[500\] shadow-md"/);
        // Contrôle dans un vrai navigateur : capture partenaire-creation-acces (e2e/support/screens.ts), vues téléphone
    });
});
