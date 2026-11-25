/**
 * Contre-vérification du lot 11c-a — point 10 : les 7 fonctions recopiées n'ont perdu aucune ligne de leur dernière
 * définition sur main (fichiers de migration lus sur le disque, sans base).
 *
 * Règle : chaque ligne non vide de la dernière définition de main (blancs repliés) se retrouve, dans le même ordre, dans la
 * recopie du lot ; seules les lignes de jauge remplacées (somme des quotas devenue somme de places) sont admises en moins,
 * listées une à une ci-dessous.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'supabase', 'migrations');

const RECOPIES: Array<{ fn: string; main: string; lot: string; replaced: string[] }> = [
    { fn: 'ticket_category_create', main: '20261119000002_f2b_couleur_consigne.sql', lot: '20261201000003_l11c_configuration.sql', replaced: [
        'SELECT COALESCE(sum(c.total_quantity), 0)::int INTO v_sum',
        'FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;',
    ] },
    { fn: 'ticket_category_update', main: '20261121000008_cvf2b_consigne_controle.sql', lot: '20261201000003_l11c_configuration.sql', replaced: [
        'SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum',
        'FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;',
    ] },
    { fn: 'event_update', main: '20261121000005_cvf2b_avis_en_cours_envoi.sql', lot: '20261201000003_l11c_configuration.sql', replaced: [
        'SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,',
        'COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int',
    ] },
    { fn: 'checkout_create_payment', main: '20261111000005_lot9quater_argent.sql', lot: '20261201000004_l11c_vente.sql', replaced: [] },
    { fn: 'payment_confirm', main: '20261125000003_f4_ventes.sql', lot: '20261201000004_l11c_vente.sql', replaced: [] },
    { fn: 'ticket_refund_request', main: '20261116000001_f2a_fiche_suspendue.sql', lot: '20261201000005_l11c_remboursement.sql', replaced: [] },
    { fn: 'ticket_postponement_refund_open', main: '20261109000006_lot9bis_argent.sql', lot: '20261201000005_l11c_remboursement.sql', replaced: [] },
];

const norm = (l: string): string => l.replace(/\s+/g, ' ').trim();

/** Dernière définition de public.<fn> dans un fichier : de CREATE OR REPLACE à la ligne « $$; ». */
function lastDefinition(file: string, fn: string): string[] {
    const lines = readFileSync(path.join(DIR, file), 'utf8').split(/\r?\n/);
    const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`);
    let start = -1;
    lines.forEach((l, i) => { if (head.test(l)) start = i; });
    assert.ok(start >= 0, `${fn} absente de ${file}`);
    const end = lines.findIndex((l, i) => i > start && l.trim() === '$$;');
    assert.ok(end > start, `${fn} sans fin dans ${file}`);
    return lines.slice(start, end + 1).map(norm).filter((l) => l.length > 0);
}

describe('Point 10 — recopies du lot 11c-a', () => {
    for (const r of RECOPIES) {
        test(`${r.fn} : aucune ligne de ${r.main} perdue dans ${r.lot}`, () => {
            const before = lastDefinition(r.main, r.fn);
            const after = lastDefinition(r.lot, r.fn);
            const replaced = new Set(r.replaced.map(norm));
            for (const l of replaced) assert.ok(before.includes(l), `ligne remplacée déclarée mais absente de main : ${l}`);
            const kept = before.filter((l) => !replaced.has(l));
            let j = 0;
            const lost: string[] = [];
            for (const line of kept) {
                const k = after.indexOf(line, j);
                if (k < 0) lost.push(line);
                else j = k + 1;
            }
            assert.deepEqual(lost, [], `${r.fn} : lignes de main absentes (ou déplacées) dans la recopie`);
        });
    }
});
