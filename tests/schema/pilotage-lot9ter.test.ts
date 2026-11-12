/**
 * Lot 9 ter, tâche 9t.18 (consigne 4) — catalogue et appels directs des fonctions du pilotage et des réglages de
 * l'alerte : privilèges, trigger d'alerte, règle d'origine R50 (ticket_origin), règle de refus (scan_is_refusal),
 * refus comptés pour l'alerte (scan_alert_refusal), libellés, réglages et aucune surcharge (contrat 5.D, D.0, D.1.2,
 * D.1.6 T5 ; 3.4 F3 à F6, F40 à F54 ; arbitrage 21 ; rectification 5 de D).
 *
 * Connexion directe à la base locale, transactions READ ONLY (inspect) : aucune écriture, donc aucun appel aux
 * invariants (écart signalé).
 *
 * Rouge avant correctif (S-P fix(9t.reglages) M02, fix(9t.18) M10) : fonctions ticket_origin, scan_is_refusal,
 * ticket_origin_label, scan_alert_refusal, scan_refusal_alert_settings, pilotage_compute_entries et trigger
 * trg_ticket_scans_refusal_alert absents ; réglages access.refusal_alert_* absents ; libellés des motifs de zone absents.
 * Cas vert dès l'écriture, signalé : « aucune surcharge » (une seule définition de chaque fonction recopiée aujourd'hui ;
 * garde-fou contre une recopie à signature changée, PGRST203).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from '../helpers/db';

/** Fonctions nouvelles du lot (service_role seul), signatures du contrat 3.4. */
const NEW_FUNCTIONS = [
    'ticket_origin(text,numeric,boolean)',
    'scan_is_refusal(boolean,text,text,timestamp with time zone)',
    'ticket_origin_label(text)',
    'scan_alert_refusal(text,text)',
    'scan_refusal_alert_settings()',
    'pilotage_compute_entries(uuid,boolean)',
];

/** Les 17 résultats du CHECK ticket_scans_result_check (M/20261109000008:172-176). */
const RESULTS = [
    'valid', 'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'event_cancelled', 'event_ended',
    'event_suspended', 'event_not_open', 'payment_required', 'cash_required', 'qr_expired', 'dynamic_qr_required',
    'manual_entry_refused', 'forbidden', 'transfer_pending',
];

/** Libellés actuels de pilotage_scan_result_label (M/20261109000008:1763-1779), à l'octet. */
const LABELS: Record<string, string> = {
    valid: 'Entrée validée',
    already_used: 'Billet déjà utilisé',
    invalid: 'Billet invalide',
    cancelled: 'Billet annulé',
    refunded: 'Billet remboursé',
    wrong_event: 'Billet d’un autre événement',
    event_cancelled: 'Événement annulé',
    event_ended: 'Événement terminé',
    event_suspended: 'Événement suspendu',
    event_not_open: 'Contrôle pas encore ouvert',
    payment_required: 'Paiement requis',
    cash_required: 'Encaissement requis',
    qr_expired: 'QR expiré',
    dynamic_qr_required: 'QR dynamique requis',
    manual_entry_refused: 'Saisie manuelle refusée',
    forbidden: 'Scanneur non autorisé sur cet événement',
    transfer_pending: 'Transfert en cours',
};

async function requireFunctions(db: Client, signatures: string[]): Promise<void> {
    const missing: string[] = [];
    for (const s of signatures) {
        const { rows } = await db.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [`public.${s}`]);
        if (!rows[0].ok) missing.push(s);
    }
    assert.deepEqual(missing, [], `fonctions du lot 9 ter absentes (migrations 20261110000002 et 20261110000010) : ${missing.join(', ')}`);
}

describe('9t.18 T5 — fonctions et réglages du pilotage du lot 9 ter', () => {
    test('fonctions du lot : service_role seul, SECURITY DEFINER, search_path posé', async () => {
        await inspect(async (db) => {
            await requireFunctions(db, NEW_FUNCTIONS);
            for (const s of NEW_FUNCTIONS) {
                const { rows: [r] } = await db.query<{ anon: boolean; auth: boolean; svc: boolean; secdef: boolean; config: string[] | null }>(
                    `SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                            has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                            p.prosecdef AS secdef, p.proconfig AS config
                       FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [`public.${s}`]);
                assert.deepEqual({ anon: r.anon, auth: r.auth, svc: r.svc, secdef: r.secdef }, { anon: false, auth: false, svc: true, secdef: true }, `${s} : privilèges et SECURITY DEFINER`);
                assert.ok((r.config ?? []).includes('search_path=public'), `${s} : search_path=public posé (${JSON.stringify(r.config)})`);
            }
        });
    });

    test('trigger d’alerte : après insertion, par ligne, sur les seuls refus', async () => {
        await inspect(async (db) => {
            const { rows } = await db.query<{ def: string }>(
                `SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
                  WHERE t.tgrelid = 'public.ticket_scans'::regclass AND t.tgname = 'trg_ticket_scans_refusal_alert' AND NOT t.tgisinternal`);
            assert.equal(rows.length, 1, 'trigger trg_ticket_scans_refusal_alert absent de public.ticket_scans (migration 20261110000010)');
            const flat = rows[0].def.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
            assert.ok(flat.includes('AFTER INSERT ON public.ticket_scans FOR EACH ROW WHEN NOT new.accepted AND new.event_id IS NOT NULL'),
                `définition attendue « AFTER INSERT ON public.ticket_scans FOR EACH ROW WHEN ((NOT new.accepted) AND (new.event_id IS NOT NULL)) », reçu : ${rows[0].def}`);
            assert.match(rows[0].def, /EXECUTE FUNCTION (public\.)?scan_refusal_alert\(\)/, `fonction scan_refusal_alert : ${rows[0].def}`);
        });
    });

    test('ticket_origin suit la règle R50 sur ses 16 cas', async () => {
        await inspect(async (db) => {
            await requireFunctions(db, ['ticket_origin(text,numeric,boolean)']);
            for (const channel of ['ONLINE', 'FREE', 'INVITATION', 'COUNTER']) {
                for (const price of [0, 5000]) {
                    for (const offline of [false, true]) {
                        const expected = channel === 'INVITATION' ? 'INVITATION'
                            : offline || channel === 'COUNTER' ? 'COUNTER'
                                : price === 0 ? 'FREE' : 'ONLINE';
                        const { rows: [r] } = await db.query<{ o: string }>('SELECT public.ticket_origin($1, $2::numeric, $3) AS o', [channel, price, offline]);
                        assert.equal(r.o, expected, `ticket_origin(${channel}, ${price}, ${offline})`);
                    }
                }
            }
        });
    });

    test('scan_is_refusal égale l’expression du lot 5 pour les 17 résultats ; zone_ok n’est pas un refus', async () => {
        await inspect(async (db) => {
            await requireFunctions(db, ['scan_is_refusal(boolean,text,text,timestamp with time zone)']);
            const { rows } = await db.query<{ result: string; consumed: boolean; got: boolean; lot5: boolean }>(
                `SELECT r AS result, c IS NOT NULL AS consumed,
                        public.scan_is_refusal(r = 'valid', r, NULL, c) AS got,
                        (NOT (r = 'valid') AND NOT (r = 'cash_required' AND c IS NOT NULL)) AS lot5
                   FROM unnest($1::text[]) r CROSS JOIN (VALUES (NULL::timestamptz), (now())) v(c)`, [RESULTS]);
            assert.equal(rows.length, 34, '17 résultats × consumed_at NULL ou posé');
            const diff = rows.filter((x) => x.got !== x.lot5);
            assert.deepEqual(diff, [], 'scan_is_refusal = NOT accepted AND NOT (cash_required consommé) (M/20261102000005:252)');
            const { rows: [z] } = await db.query<{ zone_ok: boolean; wrong: boolean; notin: boolean }>(
                `SELECT public.scan_is_refusal(FALSE, NULL, 'zone_ok', NULL) AS zone_ok,
                        public.scan_is_refusal(FALSE, NULL, 'wrong_zone', NULL) AS wrong,
                        public.scan_is_refusal(FALSE, NULL, 'not_entered', NULL) AS notin`);
            assert.deepEqual({ zone_ok: z.zone_ok, wrong: z.wrong, notin: z.notin }, { zone_ok: false, wrong: true, notin: true }, 'zone_ok ni entrée ni refus ; wrong_zone et not_entered refus');
        });
    });

    test('scan_alert_refusal : refus du billet et de la zone seulement', async () => {
        await inspect(async (db) => {
            await requireFunctions(db, ['scan_alert_refusal(text,text)']);
            const counted: Array<[string | null, string | null]> = [
                ...['already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'payment_required', 'qr_expired', 'dynamic_qr_required', 'transfer_pending']
                    .map((r): [string | null, string | null] => [r, null]),
                [null, 'wrong_zone'], [null, 'not_entered'],
            ];
            const ignored: Array<[string | null, string | null]> = [
                ...['valid', 'forbidden', 'manual_entry_refused', 'cash_required', 'event_cancelled', 'event_ended', 'event_suspended', 'event_not_open']
                    .map((r): [string | null, string | null] => [r, null]),
                [null, 'zone_ok'], [null, null],
            ];
            for (const [list, expected] of [[counted, true], [ignored, false]] as Array<[Array<[string | null, string | null]>, boolean]>) {
                for (const [result, zone] of list) {
                    const { rows: [r] } = await db.query<{ v: boolean }>('SELECT public.scan_alert_refusal($1, $2) AS v', [result, zone]);
                    assert.equal(r.v, expected, `scan_alert_refusal(${result}, ${zone})`);
                }
            }
        });
    });

    test('libellés : origines et motifs nouveaux, anciens inchangés', async () => {
        await inspect(async (db) => {
            await requireFunctions(db, ['ticket_origin_label(text)']);
            const { rows: origins } = await db.query<{ o: string; l: string | null }>(
                `SELECT o, public.ticket_origin_label(o) AS l FROM unnest(ARRAY['ONLINE', 'COUNTER', 'FREE', 'INVITATION', 'AUTRE']) o`);
            assert.deepEqual(Object.fromEntries(origins.map((x) => [x.o, x.l])),
                { ONLINE: 'En ligne', COUNTER: 'Guichet', FREE: 'Gratuit', INVITATION: 'Invitation', AUTRE: null }, 'libellés des origines');
            const { rows } = await db.query<{ r: string; l: string }>(
                'SELECT r, public.pilotage_scan_result_label(r) AS l FROM unnest($1::text[]) r', [[...RESULTS, 'wrong_zone', 'not_entered', 'zone_ok']]);
            const got = Object.fromEntries(rows.map((x) => [x.r, x.l]));
            assert.deepEqual(got, { ...LABELS, wrong_zone: 'Mauvaise zone', not_entered: 'Pas encore entré', zone_ok: 'Accès autorisé' },
                'libellés des 17 résultats inchangés, 3 motifs de zone ajoutés');
        });
    });

    test('réglages access.refusal_alert_* : valeurs par défaut et bornes', async () => {
        await inspect(async (db) => {
            const { rows: stored } = await db.query<{ key: string; value: unknown }>(
                `SELECT key, value FROM public.platform_settings WHERE key IN ('access.refusal_alert_threshold', 'access.refusal_alert_minutes') ORDER BY key`);
            assert.deepEqual(stored.map((r) => ({ key: r.key, value: r.value })), [
                { key: 'access.refusal_alert_minutes', value: { value: 5 } },
                { key: 'access.refusal_alert_threshold', value: { value: 10 } },
            ], 'réglages posés par la migration 20261110000002');
            const cases: Array<[string, unknown, boolean]> = [
                ['access.refusal_alert_threshold', 3, true], ['access.refusal_alert_threshold', 500, true],
                ['access.refusal_alert_threshold', 2, false], ['access.refusal_alert_threshold', 501, false],
                ['access.refusal_alert_threshold', 2.5, false], ['access.refusal_alert_threshold', '10', false],
                ['access.refusal_alert_minutes', 1, true], ['access.refusal_alert_minutes', 60, true],
                ['access.refusal_alert_minutes', 0, false], ['access.refusal_alert_minutes', 61, false],
            ];
            for (const [key, value, ok] of cases) {
                const { rows: [r] } = await db.query<{ v: boolean }>('SELECT public.fin_setting_valid($1, $2::jsonb) AS v', [key, JSON.stringify({ value })]);
                assert.equal(r.v, ok, `fin_setting_valid(${key}, ${JSON.stringify(value)})`);
            }
            await requireFunctions(db, ['scan_refusal_alert_settings()']);
            const { rows: [s] } = await db.query<{ threshold: number; minutes: number }>('SELECT threshold, minutes FROM public.scan_refusal_alert_settings()');
            assert.deepEqual({ threshold: Number(s.threshold), minutes: Number(s.minutes) }, { threshold: 10, minutes: 5 }, 'scan_refusal_alert_settings() = (10, 5)');
        });
    });

    test('aucune surcharge : une seule signature par fonction recopiée', async () => {
        const names = [
            'fin_setting_valid', 'finance_setting_set', 'pilotage_compute_overview', 'pilotage_entries', 'pilotage_closing', 'participants_export',
            'pilotage_scan_result_label', 'public_event_state_sync', 'public_category_stock_sync', 'low_stock_threshold_resync',
            'ticket_category_create', 'ticket_category_update',
        ];
        await inspect(async (db) => {
            const { rows } = await db.query<{ proname: string; n: number }>(
                `SELECT p.proname, count(*)::int AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
                  WHERE ns.nspname = 'public' AND p.proname = ANY($1::text[]) GROUP BY p.proname ORDER BY p.proname`, [names]);
            assert.deepEqual(Object.fromEntries(rows.map((r) => [r.proname, r.n])), Object.fromEntries([...names].sort().map((n) => [n, 1])),
                'F3, F4, F45 à F54 : exactement une définition chacune');
        });
    });
});
