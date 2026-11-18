/**
 * Correctifs de la contre-vérification de la finition 2b, 2c — consigne d'entrée : caractères de contrôle et contrôles
 * bidirectionnels refusés, dans le schéma et en base (ticket_category_normalize, ticket_category_update), comme les noms
 * de zone et de porte. Sans base : schéma et lecture des migrations ; les six chemins d'écriture (routes et base) sont
 * éprouvés par tests/audit/cvf2b-2-couleur-prix (bloc c).
 *  a. Schéma : chaque caractère interdit refusé à la création et à la modification d'une catégorie (champ
 *     entry_instruction, texte « caractère invisible ou de contrôle ») ; une consigne ordinaire acceptée.
 *  b. Base : la dernière définition de ticket_category_normalize et de ticket_category_update refuse la même liste, sur le
 *     texte reçu, avec le même texte.
 * Rouge avant le correctif : consignes « Entrée\u0007 VIP », « VIP \u202ePIV » acceptées. Sortie brute `[CVF2B-2C]`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MESSAGE = 'La consigne d’entrée contient un caractère invisible ou de contrôle : retirez-le.';
const SQL_CLASS = String.raw`'[\u0001-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]'`;
/** Un représentant de chaque plage interdite, et les cas du rapport d'audit. */
const FORBIDDEN = [
    '\u0001', '\u0007', '\u0008', '\u0009', '\u000a', '\u000d', '\u001b', '\u001f', '\u007f', '\u0080', '\u0085', '\u009f',
    '\u061c', '\u200e', '\u200f', '\u202a', '\u202b', '\u202c', '\u202d', '\u202e', '\u2066', '\u2067', '\u2068', '\u2069',
];

interface Parsed { success: boolean; data?: Record<string, unknown>; error?: { issues: Array<{ path: Array<string | number>; message: string }> } }
interface ValidationModule {
    createTicketCategorySchema(ctx: { eventEnd: Date | null }): { safeParse(v: unknown): Parsed };
    updateTicketCategorySchema(ctx: { eventEnd: Date | null; current: Record<string, unknown> }): { safeParse(v: unknown): Parsed };
}

async function validation(): Promise<ValidationModule> {
    const target = '../../lib/validations/event';
    return (await import(target)) as ValidationModule;
}

function hex(s: string): string {
    return [...s].map((c) => (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) > 0x7e ? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}` : c)).join('');
}

describe('a. schéma des catégories', () => {
    test('caractère de contrôle ou de sens d’écriture dans la consigne : refusé à la création et à la modification', async () => {
        const v = await validation();
        const create = v.createTicketCategorySchema({ eventEnd: null });
        const update = v.updateTicketCategorySchema({ eventEnd: null, current: { sale_start: null, sale_end: null } });
        const base = { name: 'VIP', price: 0, total_quantity: 10 };
        const accepted: string[] = [];
        const values = [...FORBIDDEN.map((c) => `Entrée${c} VIP`), 'Bracelet \u001b[31mrouge\u001b[0m', 'VIP \u202ePIV ecnartne\u202c', 'Carré \u2066\u2067B\u2069\u2069'];
        for (const value of values) {
            for (const [label, r] of [['création', create.safeParse({ ...base, entry_instruction: value })], ['modification', update.safeParse({ entry_instruction: value })]] as const) {
                const ok = !r.success && (r.error?.issues ?? []).some((i) => i.path.join('.') === 'entry_instruction' && i.message === MESSAGE);
                if (!ok) accepted.push(`${label} « ${hex(value)} » : ${JSON.stringify(r.success ? r.data : r.error?.issues)}`);
            }
        }
        console.log(`[CVF2B-2C] ${values.length} consignes × 2 schémas, non refusées : ${accepted.length}`);
        assert.deepEqual(accepted, [], `consignes non refusées :\n${accepted.join('\n')}`);
        const fine = create.safeParse({ ...base, entry_instruction: '  Bracelet doré — carré VIP  ' });
        assert.equal(fine.success, true, JSON.stringify(fine.error?.issues));
        assert.equal(fine.data?.entry_instruction, 'Bracelet doré — carré VIP');
        assert.equal(update.safeParse({ entry_instruction: 'Tampon rose, porte B' }).success, true);
    });
});

/** Corps de la DERNIÈRE définition d'une fonction dans les migrations (ordre des noms de fichier). */
function lastDefinition(fn: string): { file: string; body: string } {
    const dir = path.join(ROOT, 'supabase/migrations');
    let found: { file: string; body: string } | null = null;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        const at = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
        if (at < 0) continue;
        const end = sql.indexOf('\n$$;', at);
        found = { file, body: sql.slice(at, end < 0 ? undefined : end) };
    }
    assert.ok(found, `fonction ${fn} introuvable dans les migrations`);
    return found;
}

describe('b. base', () => {
    test('ticket_category_normalize et ticket_category_update : même liste, sur le texte reçu, même texte', () => {
        for (const [fn, source] of [['ticket_category_normalize', "p_cat->>'entry_instruction'"], ['ticket_category_update', "v_patch->>'entry_instruction'"]] as const) {
            const def = lastDefinition(fn);
            console.log(`[CVF2B-2C] ${fn} : ${def.file}`);
            assert.ok(def.body.includes(`(${source}) ~ ${SQL_CLASS} THEN`), `${fn} (${def.file}) : liste des caractères refusés sur le texte reçu`);
            assert.ok(def.body.includes(`'${MESSAGE}'`), `${fn} (${def.file}) : texte du refus`);
            // Aucun caractère invisible écrit tel quel dans la migration (la liste est en échappements \uXXXX)
            assert.ok(![...def.body].some((c) => FORBIDDEN.includes(c) && !'\t\n\r'.includes(c)), `${fn} (${def.file}) : caractère invisible littéral`);
        }
    });
});
