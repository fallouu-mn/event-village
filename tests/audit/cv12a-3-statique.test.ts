/**
 * Contre-vérification du lot 12a — contrôles sans base (lecture des fichiers et rendu du catalogue).
 *
 *  S1 (point 9) Les 9 fonctions communes recopiées par le lot gardent tout le code de leur dernière définition de main
 *     (dernier fichier de supabase/migrations antérieur à 20261130 ; main n'a aucune migration absente de cette branche) :
 *     chaque ligne (commentaires et blancs retirés, espaces réduits) est dans la recopie du lot, sauf les lignes élargies
 *     aux commandes, listées une à une avec leur remplaçante (qui doit y être).
 *  S2 (point 8) Chaque SMS des avis ORDER_* et chaque envoi immédiat du code tient en un segment GSM-7 au pire cas :
 *     nom d'établissement de 120 caractères avec ç, ’, guillemets, émoji et autre écriture ; zone et table longues ;
 *     montants de 999 999 999 F CFA ; 2 970 articles ; chaque mode, origine et mode de paiement.
 *  S3 (point 8) Aucun texte de la cloche, du push ni de l'email d'un avis ORDER_* ne contient un code de remise : un
 *     code glissé dans les données du rendu n'apparaît dans aucun canal en file.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOTIFICATION_CATALOG, renderNotification, renderSyncSms } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const FIRST_12A = '20261130000001';

const RECOPIED = [
    'finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults', 'fin_payout_available_at', 'calculate_referral_commissions',
    'finance_admin_earned', 'finance_admin_payments', 'notif_cashouts_notify', 'notification_sync_log',
] as const;

/** Lignes de main élargies par le lot : ligne d'origine → lignes qui la remplacent (même sens, commandes en plus). */
const REPLACED: Record<string, Record<string, string[]>> = {
    finance_setting_set: {
        "'halls.max_pending_per_client') THEN": ["'halls.max_pending_per_client',",
            "'orders.contact_retention_days', 'orders.code_max_attempts', 'orders.code_resend_max', 'orders.prep_minutes_default') THEN"],
    },
    platform_settings_defaults: {
        "WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables)\\.'": ["WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables|orders)\\.'"],
    },
    fin_payout_available_at: { table_reservation_id: ['table_reservation_id, order_id'] },
    finance_admin_earned: {
        "COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')":
            ["COALESCE(sum(CASE WHEN p.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER')"],
    },
    finance_admin_payments: {
        "'commission', CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')":
            ["'commission', CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER')"],
        "+ CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION') AND py.facial_amount IS NOT NULL THEN":
            ["+ CASE WHEN py.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER') AND py.facial_amount IS NOT NULL THEN"],
    },
};

function definitions(name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, 'g');
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
        const text = readFileSync(join(MIGRATIONS, file), 'utf8');
        for (const m of text.matchAll(head)) {
            const as = text.indexOf('AS $', m.index!);
            const tag = text.slice(as + 3, text.indexOf('$', as + 4) + 1);
            const start = as + 3 + tag.length;
            out.push({ file, body: text.slice(start, text.indexOf(tag, start)) });
        }
    }
    return out;
}
const lines = (body: string): string[] => body.split(/\r?\n/).map((l) => l.replace(/--.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);

describe('cv12a — contrôles sans base', () => {
    test('S1 — les 9 recopies gardent chaque ligne de leur dernière définition de main (lignes élargies déclarées)', () => {
        const report: string[] = [];
        for (const name of RECOPIED) {
            const defs = definitions(name);
            const mainDef = defs.filter((d) => d.file < FIRST_12A).at(-1);
            const lotDefs = defs.filter((d) => d.file >= FIRST_12A);
            assert.ok(mainDef, `${name} : aucune définition de main`);
            assert.equal(lotDefs.length, 1, `${name} : une seule recopie dans le lot (${lotDefs.map((d) => d.file).join(', ')})`);
            const lot = new Map<string, number>();
            for (const l of lines(lotDefs[0].body)) lot.set(l, (lot.get(l) ?? 0) + 1);
            for (const l of lines(mainDef.body)) {
                if ((lot.get(l) ?? 0) > 0) {
                    lot.set(l, lot.get(l)! - 1);
                    continue;
                }
                const repl = REPLACED[name]?.[l];
                if (repl && repl.every((r) => (lot.get(r) ?? 0) > 0)) continue;
                report.push(`${name} (${mainDef.file} → ${lotDefs[0].file}) : ligne perdue ${JSON.stringify(l)}`);
            }
        }
        assert.deepEqual(report, []);
    });

    test('S2 — SMS des commandes : un segment GSM-7 au pire cas (nom de 120 caractères, montants de 999 999 999 F, 2 970 articles)', () => {
        const name = 'Chez Françoise’s « Le Grand Thiéboudienne » 🍲 مطعم — cuisine sénégalaise, grillades, pâtisseries et jus naturels du terroir';
        const big = 999_999_999;
        const worst = {
            venue_name: name, partner_name: name, zone_name: 'Zone ’Almadies — Ngor — Ouakam — Mamelles — Virage — Yoff — Plage — Corniche',
            onsite_label: 'Terrasse « bord de mer » n°12 côté piscine', items_count: 2_970, goods_total: big, paid_amount: big, balance_due: big,
            refund_amount: big, amount: big, operator: 'ORANGE_MONEY', reason: 'x'.repeat(300),
        };
        const bad: string[] = [];
        let rendered = 0;
        for (const [type, tpl] of Object.entries(NOTIFICATION_CATALOG) as Array<[string, { syncOnly?: boolean; channels: readonly string[]; sample: object }]>) {
            if (!type.startsWith('ORDER_') || tpl.syncOnly || !tpl.channels.includes('SMS')) continue;
            for (const mode of ['LIVRAISON', 'RETRAIT', 'SUR_PLACE']) {
                for (const origin of [null, 'CLIENT', 'PARTENAIRE', 'EVENT_VILLAGE', 'REFUSEE', 'SANS_REPONSE', 'EXPIREE', 'NON_RETIREE']) {
                    for (const payment of ['INTEGRAL', 'ACOMPTE', 'DIFFERE']) {
                        const data = { ...tpl.sample, ...worst, mode, payment_type: payment, ...(origin ? { origin } : {}) };
                        const r = renderNotification(type, 'SMS', data, { appUrl: 'https://eventvillage.sn' });
                        rendered += 1;
                        if (r.channel !== 'SMS' || r.measure.encoding !== 'GSM7' || r.measure.segments !== 1) {
                            bad.push(`${type}/${mode}/${origin}/${payment} : ${JSON.stringify(r.channel === 'SMS' ? r.measure : r.channel)} « ${r.channel === 'SMS' ? r.text : ''} »`);
                        }
                    }
                }
            }
        }
        for (const step of ['RETRAIT', 'LIVRAISON', 'NOUVEAU'] as const) {
            const text = renderSyncSms('ORDER_HANDOVER_CODE', { code: '9999', orderNumber: 'CMD-261205-A1B2C3', step });
            const m = smsSegments(text);
            if (m.encoding !== 'GSM7' || m.segments !== 1) bad.push(`ORDER_HANDOVER_CODE/${step} : ${JSON.stringify(m)} « ${text} »`);
        }
        assert.ok(rendered >= 15 * 3 * 8 * 3, `15 types avec SMS × 72 variantes au moins : ${rendered} rendus`);
        assert.deepEqual(bad, []);
    });

    test('S3 — cloche, push et email des avis ORDER_* : jamais un code de remise, même glissé dans les données', () => {
        const leaks: string[] = [];
        for (const [type, tpl] of Object.entries(NOTIFICATION_CATALOG) as Array<[string, { syncOnly?: boolean; channels: readonly string[]; sample: object }]>) {
            if (!type.startsWith('ORDER_') || tpl.syncOnly) continue;
            for (const channel of ['IN_APP', 'PUSH', 'EMAIL'] as const) {
                if (!tpl.channels.includes(channel)) continue;
                const data = { ...tpl.sample, code: '7351', handover_code: '7351', mode: 'RETRAIT' };
                const text = JSON.stringify(renderNotification(type, channel, data, { appUrl: 'https://eventvillage.sn' }));
                if (text.includes('7351')) leaks.push(`${type}/${channel}`);
            }
        }
        assert.deepEqual(leaks, []);
    });
});
