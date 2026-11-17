/**
 * Finition 3d (recours et suppléance) — écrans, sans base (lecture des fichiers et fonctions pures). Aucune écriture,
 * donc aucun appel d'invariants (même règle que f3b-ecrans).
 *
 * 4b. Page Équipe d'un admin : la liste avec recherche (OrganizerPicker) remplace « ?partnerId= » tapé à la main ; lien
 *     « Équipe de cet événement » sur la fiche admin d'un événement (onglet Équipe du pilotage).
 * 4c. Écart de caisse : la route et la base laissent valider un admin events.write depuis la 2a, mais l'écran cachait la
 *     section « Écarts à valider » à tout admin (run 291) : elle s'affiche désormais pour la propriétaire, le SUPERADMIN et
 *     un admin events.write (même règle que « Fermer cette caisse »).
 * 5. Accueil (décision 12 de la 3b) : « Argent qui attend » garde le détail ; « À faire aujourd'hui » n'a plus qu'une
 *    ligne pour l'argent : « Argent qui attend : {n} versements à reprendre, {n} créances », qui mène au bloc
 *    (#argent-qui-attend). Composition dans une fonction pure (todoMoneyLine, lib/admin/todo.ts) : seules les parties
 *    ouvertes aux droits de l'administrateur ; un compteur illisible le dit, jamais 0 ; tout à zéro → groupe « À jour ».
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

interface MoneyPart { key: 'to_resume' | 'debts'; count: number | null; amount: number | null; unavailable: boolean }
interface MoneyLine { due: boolean; title: string; parts: MoneyPart[] }
type Reply = { lines: Array<Record<string, unknown>>; upToDate: string[]; allowed: string[]; partial: boolean; computedAt: string | null };

async function moneyLineFn(): Promise<(reply: Reply) => MoneyLine | null> {
    const mod = (await import('../../lib/admin/todo')) as Record<string, unknown>;
    assert.equal(typeof mod.todoMoneyLine, 'function', 'todoMoneyLine absente de lib/admin/todo.ts');
    return mod.todoMoneyLine as (reply: Reply) => MoneyLine | null;
}

const reply = (allowed: string[], lines: Array<Record<string, unknown>>, upToDate: string[]): Reply =>
    ({ lines, upToDate, allowed, partial: false, computedAt: null });

describe('4b. Équipe d’un admin : choix de l’organisatrice et lien depuis la fiche d’un événement', () => {
    test('page Équipe : un admin sans organisatrice choisie voit la liste avec recherche (plus de « ?partnerId= » à taper)', () => {
        const page = read('app/partner/team/page.tsx');
        assert.match(page, /<OrganizerPicker\b/, 'la page Équipe doit proposer OrganizerPicker à un admin');
        assert.match(page, /Changer d’organisatrice/, 'un admin doit pouvoir revenir à la liste');
        const picker = read('components/partner/team/OrganizerPicker.tsx');
        assert.match(picker, /[`'"]\/api\/partner\/team\/organizers/, 'la liste doit lire GET /api/partner/team/organizers');
        assert.match(picker, /type="search"|inputMode="search"/, 'champ de recherche absent');
        assert.match(picker, /Aucune organisatrice ne correspond/, 'état vide de la recherche absent');
    });

    test('fiche admin d’un événement : lien « Équipe de cet événement » vers l’onglet Équipe du pilotage', () => {
        const sheet = read('app/admin/events/[id]/page.tsx');
        assert.match(sheet, /\/partner\/events\/\$\{event\.id\}\?tab=equipe/, 'lien vers l’onglet Équipe absent');
        assert.match(sheet, /Équipe de cet événement/);
    });
});

describe('4c. écart de caisse : « Valider l’écart » à l’écran d’un admin events.write', () => {
    test('la section « Écarts à valider » s’affiche pour la propriétaire, le SUPERADMIN et un admin events.write', () => {
        const cash = read('components/partner/pilotage/CashTab.tsx');
        // Avant la 3d : {!hasAnyRole(['ADMIN', 'SUPERADMIN']) && <DiscrepancyValidation …/>} : cachée à tout admin, alors que la
        // route et la base laissent valider un admin events.write depuis la 2a.
        assert.doesNotMatch(cash, /!hasAnyRole\(\['ADMIN', 'SUPERADMIN'\]\) && <DiscrepancyValidation/, 'section cachée à tout administrateur');
        const render = /\{(\w+) && <DiscrepancyValidation\b/.exec(cash);
        assert.ok(render, 'la section doit dépendre d’un seul booléen nommé');
        const decl = new RegExp(`const ${render[1]} = ([^;]+);`).exec(cash);
        assert.ok(decl, `déclaration de ${render[1]} absente`);
        assert.match(decl[1], /!hasAnyRole\(\['ADMIN', 'SUPERADMIN'\]\)/, 'la propriétaire (compte non admin) doit garder la section');
        assert.match(decl[1], /hasRole\('SUPERADMIN'\)/, 'le SUPERADMIN doit voir la section');
        assert.match(decl[1], /hasPermission\('events\.write'\)/, 'un admin events.write doit voir la section');
        const start = cash.indexOf('function DiscrepancyValidation');
        const end = cash.indexOf('\nfunction ', start + 10);
        assert.match(cash.slice(start, end === -1 ? undefined : end), /Valider l’écart/);
        assert.match(read('app/partner/events/[id]/page.tsx'), /\{ id: 'caisse', label: 'Caisse' \}/, 'onglet Caisse proposé à tous');
    });
});

describe('5. accueil : une seule ligne pour l’argent dans « À faire aujourd’hui »', () => {
    test('versements et créances : « Argent qui attend : 2 versements à reprendre, 3 créances »', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'events_to_validate', 'debts'],
            [{ key: 'to_resume', count: 2, amount: 17_850 }, { key: 'debts', count: 3, amount: 12_450 }], ['events_to_validate']));
        assert.ok(line);
        assert.equal(line.due, true);
        assert.equal(line.title, 'Argent qui attend : 2 versements à reprendre, 3 créances');
    });

    test('un versement, aucune créance : singulier et « aucune créance »', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [{ key: 'to_resume', count: 1, amount: 5_000 }], ['debts']));
        assert.equal(line?.title, 'Argent qui attend : 1 versement à reprendre, aucune créance');
        assert.equal(line?.due, true);
    });

    test('seulement le droit de lire les créances : la partie des versements n’apparaît pas', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['debts'], [{ key: 'debts', count: 1, amount: 900 }], []));
        assert.equal(line?.title, 'Argent qui attend : 1 créance');
    });

    test('tout à zéro : ligne « À jour », jamais une carte', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [], ['to_resume', 'debts']));
        assert.equal(line?.due, false);
        assert.equal(line?.title, 'Argent qui attend : aucun versement à reprendre, aucune créance');
    });

    test('compteur illisible : dit, jamais 0, et la carte reste affichée', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [{ key: 'to_resume', unavailable: true }], ['debts']));
        assert.equal(line?.due, true);
        assert.equal(line?.title, 'Argent qui attend : versements à reprendre (compteur indisponible), aucune créance');
    });

    test('aucun des deux droits : pas de ligne pour l’argent', async () => {
        const fn = await moneyLineFn();
        assert.equal(fn(reply(['events_to_validate'], [], ['events_to_validate'])), null);
    });

    test('TodoToday : une seule carte pour l’argent, qui mène au bloc « Argent qui attend »', () => {
        const src = read('components/admin/TodoToday.tsx');
        assert.match(src, /todoMoneyLine\(/, 'TodoToday doit composer la ligne de l’argent par todoMoneyLine');
        assert.match(src, /MONEY_KEYS/, 'les lignes to_resume et debts doivent sortir de la liste des cartes');
        assert.match(src, /["']#argent-qui-attend["']/, 'le bouton doit mener au bloc « Argent qui attend »');
        assert.match(src, /Voir l’argent qui attend/);
    });
});
