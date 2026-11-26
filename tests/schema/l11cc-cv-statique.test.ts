/**
 * Lot 11c-c — correctifs de la contre-vérification, contrôles STATIQUES (fichiers lus sur le disque, sans base).
 *
 *  T1. La porte suit la plage du contrôle : la route rend 409 CONTROL_CLOSED avec le message commun du contrôle
 *      (controlClosedMessage), la liste n'affiche alors plus rien de lu auparavant, et le lien « Liste des tables » du
 *      scanner n'apparaît que si le serveur dit le contrôle ouvert (scan.open), comme la liste des invités.
 *  T2, T3. La copie n'est plus qu'un appel à public.event_table_copy : plus aucune écriture enchaînée ni aucun retrait
 *      « au moindre refus » côté serveur Next.
 *  T4. Aucun texte de refus d'écriture des tables n'est écrit dans les écrans : ils affichent edit_refusal.message.
 *  T5. « Retirer » ne dépend que de deletable (lu du serveur) ; sinon la raison du serveur (delete_refusal.message).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function filesUnder(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...filesUnder(rel));
        else if (/\.(tsx?)$/.test(e.name)) out.push(rel);
    }
    return out;
}

describe('T1. Porte et plage du contrôle', () => {
    test('la route rend 409 CONTROL_CLOSED avec le message commun du contrôle', () => {
        const route = read('app/api/events/[id]/tables/door/route.ts');
        assert.match(route, /import \{ controlClosedMessage \} from '@\/lib\/scan\/control-window';/);
        assert.match(route, /reply\.code === 'CONTROL_CLOSED'/);
        assert.match(route, /controlClosedMessage\(problem, opensAt\)/);
        assert.match(route, /status: 409/);
    });

    test('la liste efface toute donnée lue quand le contrôle est fermé et dit seulement quand il ouvre', () => {
        const door = read('components/event-tables/DoorList.tsx');
        assert.match(door, /err instanceof ApiError && err\.code === 'CONTROL_CLOSED'/);
        const branch = door.slice(door.indexOf("err.code === 'CONTROL_CLOSED'"), door.indexOf('return;', door.indexOf("err.code === 'CONTROL_CLOSED'")));
        assert.match(branch, /setData\(null\)/, 'aucune liste gardée');
        assert.match(door, /if \(closed !== null\) \{\s*return \(\s*<EmptyState/);
    });

    test('scanner : le lien « Liste des tables » exige le contrôle ouvert (scan.open du serveur)', () => {
        const page = read('app/controller/scanner/page.tsx');
        const at = page.indexOf('Liste des tables');
        assert.ok(at > 0);
        const before = page.slice(Math.max(0, at - 400), at);
        assert.match(before, /\{selected\.tables_sold > 0 && selected\.scan\?\.open === true && \(/);
    });
});

describe('T2, T3. Copie en une fonction de la base', () => {
    test('copyTablesFrom n’appelle que event_table_copy ; aucune écriture enchaînée, aucun retrait', () => {
        const src = read('lib/event-tables/report.server.ts');
        const body = src.slice(src.indexOf('export async function copyTablesFrom'));
        const calls = [...body.matchAll(/callTables\('([a-z_]+)'/g)].map((m) => m[1]);
        assert.deepEqual(calls, ['event_table_copy']);
        assert.doesNotMatch(src, /event_table_type_save|event_table_type_delete|event_tables_save|rollback/);
    });
});

describe('T4. Textes des refus : seulement ceux du serveur', () => {
    test('aucun texte de refus d’écriture des tables écrit dans les écrans', () => {
        const texts = [
            'n’est pas encore ouverte sur Event Village', 'ne sont plus modifiables', 'modifie la billetterie de son événement',
            'modifie les tables de son événement', 'ne peut plus être modifiée', 'ses tables restent en lecture',
            'retirez-le de la validation', 'Retirez l’événement de la validation', 'ses tables ne se modifient plus',
            'ont déjà été vendues ou mises en paiement',
        ];
        const bad: string[] = [];
        for (const f of filesUnder('components/event-tables')) {
            const src = read(f);
            for (const t of texts) if (src.includes(t)) bad.push(`${f} : « ${t} »`);
        }
        assert.deepEqual(bad, []);
        assert.match(read('components/event-tables/TablesEditor.tsx'), /report\.edit_refusal\.message|edit_refusal\.message/);
    });
});

describe('T5. « Retirer » selon deletable', () => {
    test('le bouton ne dépend que de t.deletable ; sinon la raison du serveur', () => {
        const editor = read('components/event-tables/TablesEditor.tsx');
        const at = editor.indexOf('>Retirer</Button>');
        assert.ok(at > 0);
        const before = editor.slice(Math.max(0, at - 300), at);
        assert.match(before, /\{t\.deletable && \(/);
        assert.doesNotMatch(editor, /!t\.ever_sold && !t\.locked/);
        assert.match(editor, /\{t\.delete_refusal\.message\}/);
    });
});
