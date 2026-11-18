/**
 * Design 1a (point 4) — un seul système de toasts (components/ui/Toast.tsx), règles de docs/design/direction.md, section 6.
 *
 *  a. Durées : réussite et information 4 s, action annulable 6 s ; erreur générale qui RESTE (aucune minuterie) ;
 *     trois toasts au plus.
 *  b. Boutons : « Annuler » (onUndo) et « Réessayer » (onRetry), cibles de 44 px ; bouton Fermer étiqueté.
 *  c. Lecteurs d'écran : role status (réussite, information) et alert (erreur, attention).
 *  d. Place : en bas sur téléphone (au-dessus de la barre du bas), en haut à droite sur ordinateur.
 *  e. Jamais de code technique : humanToastMessage remplace CODE_EN_CAPITALES, « HTTP 500 », « Error: », JSON, balise.
 *  f. Un seul système : aucune bibliothèque de toasts, aucun autre fournisseur, aucun `alert()` dans app/ et components/.
 * Sortie brute `[DESIGN-TOASTS]`.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GENERIC_ERROR, humanToastMessage, MAX_TOASTS, TOAST_DURATIONS } from '../../components/ui/Toast';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');

function files(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) files(rel, out);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
    }
    return out;
}

describe('design 1a — toasts', () => {
    test('a. durées et nombre : 4 s, 6 s pour une action annulable, erreur sans minuterie, 3 au plus', () => {
        assert.equal(TOAST_DURATIONS.success, 4000);
        assert.equal(TOAST_DURATIONS.info, 4000);
        assert.equal(TOAST_DURATIONS.undoable, 6000);
        assert.equal(MAX_TOASTS, 3);
        const src = read('components/ui/Toast.tsx') + read('components/ui/ToastCard.tsx');
        assert.match(src, /type === 'error'[^?]*\?\s*null/, 'une erreur générale doit rester (durée null)');
        assert.match(src, /slice\(-\(MAX_TOASTS - 1\)\)/, 'au plus MAX_TOASTS toasts à la fois');
    });

    test('b et c. boutons « Annuler » et « Réessayer » de 44 px, Fermer étiqueté ; rôles status et alert', () => {
        const src = read('components/ui/Toast.tsx') + read('components/ui/ToastCard.tsx');
        assert.match(src, /label: 'Annuler'/);
        assert.match(src, /label: 'Réessayer'/);
        assert.match(src, /min-h-11[^"']*px-3/, 'bouton d\'action d\'au moins 44 px');
        assert.match(src, /aria-label="Fermer le message"/);
        for (const [type, role] of [['success', 'status'], ['info', 'status'], ['error', 'alert'], ['warning', 'alert']]) {
            assert.match(src, new RegExp(`${type}: \\{[^}]*role: '${role}'`), `${type} : role ${role}`);
        }
    });

    test('d. en bas sur téléphone, en haut à droite sur ordinateur', () => {
        const src = read('components/ui/Toast.tsx') + read('components/ui/ToastCard.tsx');
        assert.match(src, /fixed inset-x-4 bottom-24[^"]*sm:right-5[^"]*lg:bottom-auto lg:top-20/);
    });

    test('e. jamais de code technique dans un toast', () => {
        const technical = ['INVALID_CODE', 'Échec : HTTP 500', 'TypeError: x is undefined', '{"error":"x"}', 'Erreur <b>gras</b>',
            'at handler (route.ts:12)', 'PAYMENT_NOT_FOUND : vente introuvable'];
        const plain = ['Billet transféré.', 'Le SMS est parti.', 'Code incorrect.', 'Réessayez dans un instant.', 'Réservation enregistrée pour 2 personnes.'];
        const leaked = technical.filter((m) => humanToastMessage(m) !== GENERIC_ERROR);
        const changed = plain.filter((m) => humanToastMessage(m) !== m);
        console.log(`[DESIGN-TOASTS] messages techniques remplacés : ${technical.length - leaked.length}/${technical.length} ; phrases simples gardées : ${plain.length - changed.length}/${plain.length}`);
        assert.deepEqual(leaked, []);
        assert.deepEqual(changed, []);
        // Fusion de la finition 3d : coupure réseau (message brut de fetch) remplacée par une phrase sur la connexion
        for (const raw of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
            assert.equal(humanToastMessage(raw), 'Connexion impossible. Vérifiez votre réseau, puis réessayez.', raw);
        }
    });

    test('f. un seul système : ni bibliothèque de toasts, ni autre fournisseur, ni alert()', () => {
        const pkg = read('package.json');
        assert.doesNotMatch(pkg, /"(react-hot-toast|sonner|react-toastify|notistack)"/);
        const faults: string[] = [];
        // Écrans seulement (app/, components/) : lib/ a des fonctions serveur nommées alert (alertes internes), pas la boîte du navigateur
        for (const f of [...files('app'), ...files('components')]) {
            const text = read(f);
            if (/(^|[^\w.])(?<!function )(window\.)?alert\(/.test(text)) faults.push(`${f} : alert()`);
            if (f !== 'components/ui/Toast.tsx' && /createContext[^;]*Toast|ToastProvider\s*[:=]/.test(text)) faults.push(`${f} : autre fournisseur de toasts`);
        }
        assert.deepEqual(faults, []);
    });
});
