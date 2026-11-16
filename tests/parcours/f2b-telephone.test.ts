/**
 * Finition 2b (C) — confort sur téléphone. Sans base : lecture des fichiers.
 *  a. Nom de chaque étape visible à toutes les tailles (pas seulement 1 à 5), écran « Vérifier » dans le pas à pas.
 *  b. Barre du bas fixe « Précédent / Suivant » sous 1024 px, à sa place au-delà ; marge de la zone sûre (barre des gestes) ;
 *     la barre « Navigation rapide » de l'application est masquée sur le formulaire (deux barres fixes ne s'empilent pas) ;
 *     le bas de la page laisse la place à la barre.
 * Rouge avant le correctif : noms cachés sous 640 px (« hidden … sm:inline »), barre dans le flux, navigation rapide
 * affichée. Suite sans base ni écriture : aucun appel d'invariants (comme les suites statiques).
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
    test('libellé de chaque étape sans « hidden … sm:inline » ; six cases (5 étapes et « Vérifier »)', () => {
        assert.doesNotMatch(form, /className="hidden truncate sm:inline">\{s\.label\}/, 'libellé caché sous 640 px');
        assert.match(form, /\{s\.label\}/);
        assert.match(form, /grid-cols-3 gap-2 sm:grid-cols-6/);
        assert.match(form, /label: 'Vérifier', heading: 'Vérifier avant d’envoyer'/);
    });
});

describe('b. barre du bas fixe « Précédent / Suivant »', () => {
    test('fixe sous 1024 px, à sa place au-delà, marge de la zone sûre', () => {
        assert.match(form, /form-action-bar fixed inset-x-0 bottom-0 z-40 [^"]*lg:static/);
        const css = read('app/globals.css');
        assert.match(css, /\.form-action-bar \{\s*padding-bottom: max\(0\.75rem, env\(safe-area-inset-bottom, 0px\)\);/);
        assert.match(form, /pb-40 pt-6 lg:pb-10/, 'bas de page dégagé pour la barre');
    });
    test('« Navigation rapide » masquée sur le formulaire d’un événement (création, modification)', () => {
        const layout = read('components/layout/AppLayout.tsx');
        const m = /const EVENT_FORM_ROUTE = (\/.+\/);/.exec(layout);
        assert.ok(m, 'EVENT_FORM_ROUTE absente d’AppLayout');
        const re = new RegExp(m[1].slice(1, -1));
        for (const p of ['/partner/events/new', '/partner/events/0a1b2c3d-0000-4000-8000-000000000000/edit']) assert.ok(re.test(p), p);
        for (const p of ['/partner/events', '/partner/events/0a1b2c3d-0000-4000-8000-000000000000', '/partner/team']) assert.ok(!re.test(p), p);
        assert.match(layout, /!EVENT_FORM_ROUTE\.test\(pathname \?\? ''\) && \(\s*<nav aria-label="Navigation rapide"/);
    });
});
