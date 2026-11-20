/**
 * Design 1c bis (points 1 et 2) — migration 20261124000001_d1cbis_restes : recopies exactes, seuls changements voulus.
 *  1. partner_events_overview = 20261102000005_lot5_pilotage.sql + brut (Σ VENTE) et remboursements (−Σ REMBOURSEMENT),
 *     même convention que pilotage_compute_overview ; revenue_online (net) inchangée ;
 *  2. finance_setting_set = 20261123000101_l11a_reglages.sql, seul le message du refus FORBIDDEN change.
 * Preuve en base : tests/parcours/finance-remboursement-billet (brut, remboursements, net) et notif-reglages (message).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
const MIG = 'supabase/migrations/20261124000001_d1cbis_restes.sql';

function fn(sql: string, name: string): string {
    const m = new RegExp(String.raw`^CREATE OR REPLACE FUNCTION public\.${name}\(.*?^\$\$;\n`, 'ms').exec(sql);
    assert.ok(m, `${name} introuvable`);
    return m[0];
}

describe('migration 20261124000001 — design 1c bis', () => {
    const mig = read(MIG);

    test('dernière migration du dépôt, après toutes celles d’avant le lot', () => {
        const all = fs.readdirSync(path.join(process.cwd(), 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
        assert.ok(all.includes('20261124000001_d1cbis_restes.sql'));
        assert.ok(all.indexOf('20261124000001_d1cbis_restes.sql') > all.indexOf('20261123000113_l11a_cv_acceptation.sql'));
    });

    test('finance_setting_set : recopie exacte de 20261123000101, seul le message du refus change', () => {
        const before = fn(read('supabase/migrations/20261123000101_l11a_reglages.sql'), 'finance_setting_set');
        const after = fn(mig, 'finance_setting_set');
        assert.equal(after, before.replace("'Seul un SUPERADMIN actif modifie les réglages de la plateforme.'", "'Seul un super-administrateur actif peut modifier les réglages.'"));
        assert.doesNotMatch(after, /SUPERADMIN actif modifie/);
    });

    test('partner_events_overview : recopie de 20261102000005 plus brut et remboursements, net inchangé', () => {
        const before = fn(read('supabase/migrations/20261102000005_lot5_pilotage.sql'), 'partner_events_overview');
        const after = fn(mig, 'partner_events_overview');
        assert.match(after, /COALESCE\(sum\(l\.amount\) FILTER \(WHERE l\.entry_type = 'VENTE'\), 0\),\n\s+COALESCE\(-sum\(l\.amount\) FILTER \(WHERE l\.entry_type = 'REMBOURSEMENT'\), 0\),\n\s+COALESCE\(sum\(l\.amount\), 0\)\n\s+INTO v_gross, v_refunded, v_online/);
        assert.match(after, /'revenue_online', v_online,\n\s+'revenue_online_gross', v_gross,\n\s+'revenue_online_refunded', v_refunded,/);
        // Hors des ajouts, rien ne change (droits, vérifications, compteurs, espèces)
        const strip = (sql: string) => sql
            .replace(/\n\s+v_gross numeric;\n\s+v_refunded numeric;/, '')
            .replace(/\n\s+'revenue_online_gross', v_gross,\n\s+'revenue_online_refunded', v_refunded,/, '')
            .replace(/\n[ \t]+-- Design 1c bis[^\n]*\n[ \t]+--[^\n]*/, '')
            .replace(/SELECT COALESCE\(sum\(l\.amount\) FILTER[\s\S]*?INTO v_gross, v_refunded, v_online/, 'SELECT COALESCE(sum(l.amount), 0) INTO v_online');
        assert.equal(strip(after), before);
    });

    test('« Mes événements » affiche brut → remboursements → recettes nettes', () => {
        const page = read('app/partner/events/page.tsx');
        const i = page.indexOf('label="Ventes en ligne (brut)"');
        const j = page.indexOf('label="Recettes nettes"');
        assert.ok(i > 0 && j > i, 'brut avant recettes nettes');
        assert.match(page, /totals\?\.revenue_online_gross/);
        assert.match(page, /hint=\{`Ventes en ligne moins \$\{formatFcfa\(totals\?\.revenue_online_refunded \?\? 0\)\} de remboursements\.`\}/);
    });
});
