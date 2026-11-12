/**
 * Lot 9 ter, tâche 9t.18 (consigne 4, tableau de bord en direct d'une grande soirée) — volume : 5 000 entrées et 500 refus,
 * pilotage_entries en moins de 1 500 ms ; un refus inséré avec le trigger d'alerte actif en moins de 50 ms en moyenne
 * (contrat 5.D, D.1.6 T6). Seuils SUPPOSÉS, lus au run « avant » ; un dépassement est remonté à l'orchestrateur, jamais
 * relevé en silence.
 *
 * Montage : partenaire et événement PUBLIE à 3 catégories créés par les aides (données ordinaires, conservées) ; tout le
 * volume vit dans inRolledBackTransaction (tests/helpers/db.ts:61) : rien ne reste en base. Insertion en masse les
 * triggers utilisateur de tickets et ticket_scans coupés dans la transaction (ALTER TABLE … DISABLE TRIGGER USER, patron
 * des suites d'invariants) au lieu de `SET LOCAL session_replication_role = replica` du contrat : ce réglage exige un
 * superutilisateur, que le rôle postgres de la base locale Supabase n'est pas (écart signalé) ; même effet sur les
 * triggers, contraintes et clés étrangères gardées. Les triggers sont rétablis (ENABLE TRIGGER USER) avant la mesure
 * des 50 refus un à un. generate_series est permis hors de tests/parcours (ordre-suites, règle 2).
 *
 * Rouge avant correctif (S-P fix(9t.18), migration 20261110000010) : pilotage_compute_entries, scan_refusal_alert et le
 * trigger trg_ticket_scans_refusal_alert absents (échec qui les nomme avant toute insertion), puis clés du lot absentes.
 * after() : assertLot9terInvariants (la suite écrit le partenaire et l'événement).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createEventInStatus, type DraftEvent } from '../parcours/cycle-helpers';

const ENTRIES = 5_000;
const REFUSALS = 500;
const SINGLE_REFUSALS = 50;
const MAX_ENTRIES_MS = 1_500;
const MAX_REFUSAL_MS = 50;

let partner: TestPartner;
let ev: DraftEvent;

before(async () => {
    partner = await newPartner('pil9ter-volume');
    ev = await createEventInStatus(partner, 'pilotage-volume', [
        { name: 'Standard', price: 5_000, total: 3_000 },
        { name: 'VIP', price: 15_000, total: 2_000 },
        { name: 'Étudiant', price: 2_000, total: 1_000 },
    ], 'PUBLIE', { startsInHours: 2 });
});

after(async () => {
    await assertLot9terInvariants('pilotage-volume');
});

async function clockMs(db: Client): Promise<number> {
    const { rows: [r] } = await db.query<{ ms: number }>('SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms');
    return Number(r.ms);
}

describe('9t.18 T6 — volume du tableau de bord des entrées', () => {
    test('5 000 entrées et 500 refus : pilotage_entries en moins de 1 500 ms, un refus avec trigger d’alerte en moins de 50 ms en moyenne', async () => {
        const categories = Object.values(ev.categories).map((c) => c.id);
        assert.equal(categories.length, 3, 'trois catégories');
        const mark = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
        const outcome = await inRolledBackTransaction(async (db) => {
            const missing: string[] = [];
            for (const s of ['pilotage_compute_entries(uuid,boolean)', 'scan_refusal_alert()']) {
                const { rows: [f] } = await db.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [`public.${s}`]);
                if (!f.ok) missing.push(`fonction public.${s}`);
            }
            const { rows: [t] } = await db.query<{ ok: boolean }>(
                `SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.ticket_scans'::regclass AND tgname = 'trg_ticket_scans_refusal_alert') AS ok`);
            if (!t.ok) missing.push('trigger trg_ticket_scans_refusal_alert');
            assert.deepEqual(missing, [], `objets de la migration 20261110000010 absents : ${missing.join(', ')}`);

            await db.query('ALTER TABLE public.tickets DISABLE TRIGGER USER');
            await db.query('ALTER TABLE public.ticket_scans DISABLE TRIGGER USER');
            await db.query(
                `INSERT INTO public.tickets (event_id, category_id, user_id, price, status, sale_channel, ticket_number, qr_code)
                 SELECT $1::uuid, ($2::uuid[])[1 + g % 3], $3::uuid, 5000, 'UTILISE', 'ONLINE', 'TCK-VOL-' || $4 || '-' || g, 'EV-QR-VOL-' || $4 || '-' || g
                   FROM generate_series(1, $5::int) g`, [ev.eventId, categories, partner.userId, mark, ENTRIES]);
            await db.query(
                `INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, category_id, entry_point)
                 SELECT k.id, k.event_id, $2::uuid, 'valid', TRUE, 'QR', FALSE, encode(sha256(convert_to(k.id::text, 'UTF8')), 'hex'), k.category_id,
                        'Porte ' || (1 + (row_number() OVER (ORDER BY k.id)) % 3)
                   FROM public.tickets k WHERE k.event_id = $1::uuid`, [ev.eventId, partner.userId]);
            await db.query(
                `INSERT INTO public.ticket_scans (event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, entry_point)
                 SELECT $1::uuid, $2::uuid, 'invalid', FALSE, 'QR', FALSE, encode(sha256(convert_to($3 || '-refus-' || g, 'UTF8')), 'hex'), 'Porte ' || (1 + g % 3)
                   FROM generate_series(1, $4::int) g`, [ev.eventId, partner.userId, mark, REFUSALS]);

            const t0 = await clockMs(db);
            const { rows: [res] } = await db.query<{ body: Record<string, unknown> }>(
                `SELECT public.pilotage_entries(jsonb_build_object('event_id', $1::uuid, 'actor_id', $2::uuid)) AS body`, [ev.eventId, partner.userId]);
            const entriesMs = (await clockMs(db)) - t0;

            await db.query('ALTER TABLE public.ticket_scans ENABLE TRIGGER USER');
            const t1 = await clockMs(db);
            for (let i = 0; i < SINGLE_REFUSALS; i++) {
                await db.query(
                    `INSERT INTO public.ticket_scans (event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, entry_point)
                     VALUES ($1::uuid, $2::uuid, 'invalid', FALSE, 'QR', FALSE, encode(sha256(convert_to($3, 'UTF8')), 'hex'), 'Porte 1')`,
                    [ev.eventId, partner.userId, `${mark}-un-a-un-${i}`]);
            }
            const refusalMs = ((await clockMs(db)) - t1) / SINGLE_REFUSALS;
            const { rows: alerts } = await db.query<{ channel: string }>(
                `SELECT channel FROM public.notification_outbox WHERE type = 'SCAN_REFUSALS_ALERT' AND event_id = $1 ORDER BY channel`, [ev.eventId]);
            return { body: res.body, entriesMs, refusalMs, alertChannels: alerts.map((a) => a.channel) };
        });

        console.log(`[VOLUME-9T18] pilotage_entries : ${outcome.entriesMs.toFixed(1)} ms (seuil ${MAX_ENTRIES_MS}) ; refus un à un : ${outcome.refusalMs.toFixed(2)} ms en moyenne (seuil ${MAX_REFUSAL_MS})`);
        const body = outcome.body;
        assert.notEqual(body.ok, false, `pilotage_entries refusé : ${JSON.stringify(body).slice(0, 400)}`);
        assert.equal(Number(body.total), ENTRIES, 'total = 5 000 entrées');
        assert.equal(Number(body.refused), REFUSALS, 'refus = 500');
        assert.equal(body.configured, false, 'événement sans zone');
        const zones = Array.isArray(body.by_zone) ? (body.by_zone as Array<Record<string, unknown>>) : [];
        assert.deepEqual(zones.map((z) => [z.name, Number(z.entered), Number(z.refused)]), [['Entrée', ENTRIES, REFUSALS]], `zone implicite : ${JSON.stringify(body.by_zone)}`);
        const gates = Array.isArray(body.by_gate) ? (body.by_gate as Array<Record<string, unknown>>) : [];
        assert.equal(gates.reduce((s, g) => s + Number(g.accepted), 0), ENTRIES, 'Σ by_gate.accepted = 5 000');
        assert.ok(outcome.entriesMs < MAX_ENTRIES_MS, `pilotage_entries en ${outcome.entriesMs.toFixed(1)} ms (seuil SUPPOSÉ ${MAX_ENTRIES_MS} ms, à remonter)`);
        assert.deepEqual(outcome.alertChannels, ['EMAIL', 'IN_APP', 'PUSH'], 'une alerte pour la Porte 1 (cloche, push, email ; aucun SMS)');
        assert.ok(outcome.refusalMs < MAX_REFUSAL_MS, `refus avec trigger d’alerte : ${outcome.refusalMs.toFixed(2)} ms en moyenne (seuil SUPPOSÉ ${MAX_REFUSAL_MS} ms, à remonter)`);
    });
});
