/**
 * Contre-vérification du lot 12d — contrôles SANS base (branche lot12d/cv-rouges, jamais fusionnée).
 *
 *  T4. ORDER_ABSENCE_DECIDED_PRO exclu de la règle G.49 (email) comme « petite étape », alors qu'il annonce à la
 *      partenaire un remboursement repris sur sa part (part faciale de order_refund_payment) : même nature que
 *      ORDER_CANCELLED_PRO, qui a ses 4 canaux.
 *  S1. Aucune route ni module serveur n'appelle order_create ou order_quote_compute directement (la pause se contourne
 *      sinon) : seulement order_create_checked et order_quote.
 *  S2. Recopies : chaque fonction recopiée une seule fois dans le lot ; lignes de la dernière définition toutes gardées,
 *      sauf les 2 lignes d'order_view déclarées remplacées (téléphone du livreur, adresse de l'établissement).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const ROOT = join(__dirname, '..', '..');
const MIG = join(ROOT, 'supabase', 'migrations');
const CATALOG = NOTIFICATION_CATALOG as unknown as Record<string, { channels: readonly string[] }>;

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}

/** Corps d'une fonction (de « CREATE OR REPLACE FUNCTION nom( » jusqu'au premier « $$; » en tête de ligne). */
function fnBody(file: string, name: string): string[] {
    const lines = readFileSync(join(MIG, file), 'utf8').split(/\r?\n/);
    const start = lines.findIndex((l) => l.startsWith(`CREATE OR REPLACE FUNCTION ${name}(`));
    assert.ok(start >= 0, `${name} absente de ${file}`);
    const end = lines.findIndex((l, i) => i > start && l.startsWith('$$;'));
    return lines.slice(start, end + 1);
}

describe('T4. Règle G.49 : avis d’argent à la partenaire', () => {
    test('ORDER_ABSENCE_DECIDED_PRO (remboursement repris sur la part de la partenaire) a l’email, comme ORDER_CANCELLED_PRO', () => {
        assert.ok(CATALOG.ORDER_CANCELLED_PRO.channels.includes('EMAIL'), 'référence : ORDER_CANCELLED_PRO a l’email');
        const refund = readFileSync(join(MIG, '20261130000006_l12a_etapes.sql'), 'utf8');
        assert.match(refund, /Part de la partenaire \(prix moins commission\) rendue par la partenaire/, 'part faciale reprise sur la partenaire');
        assert.deepEqual([...CATALOG.ORDER_ABSENCE_DECIDED_PRO.channels].sort(), ['EMAIL', 'IN_APP', 'PUSH'].sort(),
            `ORDER_ABSENCE_DECIDED_PRO : ${JSON.stringify(CATALOG.ORDER_ABSENCE_DECIDED_PRO.channels)}`);
    });
});

describe('S1-S2. Contournements et recopies', () => {
    test('S1. aucune route ni module n’appelle order_create ou order_quote_compute directement', () => {
        const hits: string[] = [];
        for (const dir of ['app', 'lib', 'components']) {
            for (const f of walk(join(ROOT, dir))) {
                const src = readFileSync(f, 'utf8');
                if (/rpc\(\s*['"`](order_create|order_quote_compute)['"`]/.test(src)) hits.push(f.slice(ROOT.length + 1));
            }
        }
        assert.deepEqual(hits, []);
    });

    test('S2. six recopies, une fois chacune, aucune ligne perdue hors des deux remplacements déclarés', () => {
        const lot = readdirSync(MIG).filter((f) => f.includes('_l12d_')).sort();
        const cases: Array<[string, string, number]> = [
            ['public.order_view', '20261130000006_l12a_etapes.sql', 2],
            ['private.order_close_apply', '20261130000006_l12a_etapes.sql', 0],
            ['public.order_payable_refusal', '20261130000005_l12a_paiement.sql', 0],
            ['public.order_quote', '20261130000004_l12a_devis_commande.sql', 0],
            ['public.order_create_checked', '20261226000003_l12b_garde_prix.sql', 0],
            ['public.order_venue_menu', '20261226000002_l12b_carte_des_plats.sql', 0],
        ];
        const all = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
        for (const [name, source, replaced] of cases) {
            const defs = all.filter((f) => readFileSync(join(MIG, f), 'utf8').includes(`CREATE OR REPLACE FUNCTION ${name}(`));
            const before = defs.filter((f) => !f.includes('_l12d_'));
            assert.equal(before[before.length - 1], source, `${name} : dernière définition avant le lot`);
            const inLot = defs.filter((f) => f.includes('_l12d_'));
            assert.equal(inLot.length, 1, `${name} : une seule recopie (${inLot.join(', ')})`);
            assert.ok(lot.includes(inLot[0]));
            const copy = new Set(fnBody(inLot[0], name));
            const lost = fnBody(source, name).filter((l) => !copy.has(l));
            assert.equal(lost.length, replaced, `${name} : lignes perdues ${JSON.stringify(lost)}`);
        }
    });
});
