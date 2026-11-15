/**
 * Finition 1 (équipe) — l'écran, lu sur le disque (sans base) : E-14, E-15, E-16, E-17 et la règle « aucun mot technique ».
 *  - E-14 : un seul composant de liste, components/partner/team/TeamPanel.tsx, utilisé par /partner/team (portée « tous
 *    les événements ») et par l'onglet Équipe du pilotage (portée « un événement ») ; les deux écrans lisent la même
 *    route GET /api/partner/team, et plus GET /api/partner/team/all ni GET …/pilotage/team pour la liste.
 *  - E-15 : « Appeler » (tel:+221…) et « WhatsApp » (https://wa.me/221…), écrits en toutes lettres.
 *  - E-16 : « Retirer de l’équipe » remplace « Retirer de tous » et « Supprimer » ; aucune icône seule pour un retrait.
 *  - Sur téléphone, des cartes (liste) ; sur ordinateur, un tableau (md:).
 *  - Aucun mot technique dans les textes de l'équipe : ni « affectation », ni « statut », ni code d'erreur en majuscules.
 *  - Fichiers de l'équipe inscrits au système de design (tests/helpers/design-files.ts) : jetons seulement.
 * Rouge avant la finition : TeamPanel absent ; la page lit /api/partner/team/all, l'onglet …/pilotage/team.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';

const ROOT = process.cwd();
const PANEL = 'components/partner/team/TeamPanel.tsx';
const TEAM_DIR = 'components/partner/team';
const PAGE = 'app/partner/team/page.tsx';
const TAB = 'components/partner/pilotage/TeamTab.tsx';

function read(rel: string): string {
    const full = path.join(ROOT, rel);
    assert.ok(fs.existsSync(full), `${rel} absent`);
    return fs.readFileSync(full, 'utf8');
}

/** Code sans commentaires (blocs, lignes) : seuls les textes et le code comptent. */
function code(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function teamFiles(): string[] {
    const dir = path.join(ROOT, TEAM_DIR);
    assert.ok(fs.existsSync(dir), `${TEAM_DIR} absent`);
    return fs.readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts')).map((f) => `${TEAM_DIR}/${f}`);
}

describe('Finition 1 — écran de l’équipe', () => {
    test('E-14 : un seul composant, utilisé par la page et par l’onglet, une seule route de lecture', () => {
        const panel = read(PANEL);
        assert.match(panel, /\/api\/partner\/team\?|\/api\/partner\/team`|'\/api\/partner\/team'/, 'TeamPanel lit GET /api/partner/team');
        for (const rel of [PAGE, TAB]) {
            const src = code(read(rel));
            assert.match(src, /from '@\/components\/partner\/team\/TeamPanel'/, `${rel} n'utilise pas TeamPanel`);
            assert.ok(!src.includes('/api/partner/team/all'), `${rel} lit encore /api/partner/team/all`);
            assert.ok(!src.includes('/pilotage/team'), `${rel} lit encore …/pilotage/team pour la liste`);
        }
        assert.match(code(read(PAGE)), /scope="all"|scope=\{'all'\}/, 'page : portée « tous les événements »');
        assert.match(code(read(TAB)), /scope="event"|scope=\{'event'\}/, 'onglet : portée « un événement »');
    });

    test('E-15 : Appeler et WhatsApp en toutes lettres', () => {
        const all = teamFiles().map((f) => code(read(f))).join('\n');
        assert.match(all, /tel:\+221|`tel:\$\{/, 'lien tel:');
        assert.match(all, /https:\/\/wa\.me\//, 'lien wa.me');
        assert.match(all, />\s*Appeler\s*</, 'libellé « Appeler »');
        assert.match(all, />\s*WhatsApp\s*</, 'libellé « WhatsApp »');
    });

    test('E-16 : « Retirer de l’équipe » remplace « Retirer de tous » et « Supprimer »', () => {
        const all = [PAGE, TAB, ...teamFiles()].map((f) => code(read(f))).join('\n');
        assert.match(all, /Retirer de l’équipe/, 'action « Retirer de l’équipe »');
        assert.ok(!/Retirer de tous/.test(all), '« Retirer de tous » encore présent');
        assert.ok(!/>\s*Supprimer\s*</.test(all) && !/'Supprimer'/.test(all), '« Supprimer » encore présent');
        assert.ok(!/<IconButton[^>]*(Trash2|UserMinus)/.test(all), 'icône seule pour un retrait');
    });

    // Le système de design impose DataList pour un tableau (cartes sous md, tableau à partir de md :
    // tests/parcours/design-systeme.test.ts) ; la liste passe par lui, avec une carte sur mesure (ajusté, signalé).
    test('cartes sur téléphone, tableau sur ordinateur (DataList avec carte sur mesure)', () => {
        const panel = code(read(PANEL));
        assert.match(panel, /<DataList[\s\S]*renderCard=/, 'DataList avec une carte sur mesure');
        const dataList = code(read('components/ui/DataList.tsx'));
        assert.match(dataList, /md:hidden/, 'cartes masquées à partir de md');
        assert.match(dataList, /hidden md:block/, 'tableau à partir de md');
    });

    test('aucun mot technique dans les textes de l’équipe', () => {
        for (const rel of teamFiles()) {
            const src = code(read(rel));
            const strings = src.match(/'[^'\n]*'|`[^`]*`|>[^<>{}\n]+</g) ?? [];
            const bad = strings.filter((s) => /affectation|statut|\bassignment\b/i.test(s) && !/^'[a-z_.\/@-]+'$/i.test(s));
            assert.deepEqual(bad, [], `${rel} : mots techniques à l'écran`);
            const codes = strings.filter((s) => /^>[^<]*\b[A-Z]{3,}_[A-Z_]{3,}\b/.test(s));
            assert.deepEqual(codes, [], `${rel} : code d'erreur affiché`);
        }
    });

    test('fichiers de l’équipe inscrits au système de design', () => {
        for (const rel of [...teamFiles().filter((f) => f.endsWith('.tsx')), PAGE, TAB]) {
            assert.ok(MIGRATED_DESIGN_FILES.includes(rel), `${rel} absent de tests/helpers/design-files.ts`);
        }
    });
});
