/**
 * Finition 3b (administration claire) — écrans, contrôle statique (sans base). Grandit avec chaque point de la finition.
 *  1. Accueil (E-29) : « À faire aujourd'hui » en tête, avant « Argent qui attend » (ancre #argent-qui-attend), lu par
 *     GET /api/admin/todo ; textes exacts « Rien d'urgent aujourd'hui. » et « Vous n'avez encore aucun droit : demandez-les
 *     au super-administrateur. » ; une phrase et un bouton par ligne ; « Compteur indisponible », jamais 0 ; plus de bloc
 *     « À traiter » ; onglets des candidatures comptés par GET /api/admin/partners (plus par les indicateurs) ; indicateurs
 *     seulement avec statistics.read, sinon le refus nomme la permission (plus « Vérifiez votre connexion »).
 * Sans base : aucune écriture, donc aucun appel d'invariants (écart signalé).
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
/** Texte d'écran normalisé : apostrophe typographique. */
const norm = (s: string): string => s.replace(/'/g, '’');

const DASHBOARD = 'app/admin/dashboard/page.tsx';
const TODO = 'components/admin/TodoToday.tsx';

describe('1. E-29 — « À faire aujourd’hui » en tête de l’accueil', () => {
    test('rendu en tête, avant « Argent qui attend » (ancre), plus de bloc « À traiter »', () => {
        const dash = code(DASHBOARD);
        const todo = dash.indexOf('<TodoToday');
        const money = dash.indexOf('<MoneyWaiting');
        assert.ok(todo > 0, `${DASHBOARD} ne rend pas <TodoToday>`);
        assert.ok(money < 0 || todo < money, '« À faire aujourd’hui » doit précéder « Argent qui attend »');
        assert.match(dash, /id="argent-qui-attend"/, 'ancre #argent-qui-attend absente');
        assert.doesNotMatch(dash, />\s*À traiter\s*</, 'bloc « À traiter » encore rendu');
    });

    test('une seule route serveur, textes exacts de la consigne, jamais 0 pour un compteur illisible', () => {
        const c = code(TODO);
        assert.match(c, /'\/api\/admin\/todo'/, 'GET /api/admin/todo non lu');
        assert.ok(norm(c).includes(norm("Rien d'urgent aujourd'hui.")), '« Rien d’urgent aujourd’hui. » absent');
        assert.ok(norm(c).includes(norm("Vous n'avez encore aucun droit : demandez-les au super-administrateur.")), 'texte « aucun droit » absent');
        assert.ok(c.includes('Compteur indisponible pour le moment.'), '« Compteur indisponible » absent');
        assert.match(c, /\/admin\/mes-droits/, 'lien « Voir mes droits » absent');
        for (const key of ['to_resume', 'events_to_validate', 'partners_to_validate', 'events_suspended', 'cash_discrepancies', 'failed_sends', 'sms_cap', 'debts']) {
            assert.match(c, new RegExp(`\\b${key}: \\{`), `ligne ${key} sans texte ni bouton`);
        }
        assert.match(c, /#argent-qui-attend/, 'versements à reprendre : lien vers « Argent qui attend » absent');
    });

    test('candidatures comptées sans statistics.read ; indicateurs seulement avec statistics.read', () => {
        const dash = code(DASHBOARD);
        assert.doesNotMatch(dash, /count: kpis\?\.(pending|validated|rejected|total)Partners/, 'onglets des candidatures encore comptés par les indicateurs');
        assert.match(dash, /partnerCounts\?\.EN_ATTENTE/, 'onglets des candidatures : nombre lu par GET /api/admin/partners');
        assert.match(dash, /hasPermission\('statistics\.read'\)/, 'indicateurs lus sans tester statistics.read');
        assert.match(dash, /permissionMissingMessage\('statistics\.read'\)/, 'refus des indicateurs sans nommer la permission');
        assert.doesNotMatch(dash, /indicateurs de la plateforme\. Vérifiez votre connexion/, 'refus de droit des indicateurs présenté comme une panne de réseau');
    });

    test('nouveau composant dans la liste du système de design', () => {
        assert.ok(MIGRATED_DESIGN_FILES.includes(TODO), `${TODO} absent de tests/helpers/design-files.ts`);
    });
});
