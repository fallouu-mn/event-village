/**
 * Correctif du run 414 de main (run 417, démarré à 21 h 53 UTC) — D1 : aucun SMS aux admins (ADMIN_REVIEW_SMS) de 22 h à
 * 8 h (Dakar), y compris quand le SMS a été mis en file juste avant 22 h. La plage de nuit est revérifiée AU MOMENT
 * D'ENVOYER (notification_outbox_claim, migration 20261123000002) : un SMS réservé dans la plage est reporté à 8 h, reste
 * en attente (jamais perdu ni envoyé), puis part au premier passage après 8 h.
 *
 * Indépendant de l'heure réelle du run : horloge simulée future (notif_admin_review_sms et l'envoyeur reçoivent `now`),
 * sur les seules lignes de la suite. Deux runs simulés :
 *  1. run qui démarre à 21:55 : SMS mis en file à 21:55 (dû tout de suite), envoyeur à 22:00 → rien, reporté à 8 h ;
 *     envoyeur à 07:59 → rien ; envoyeur à 08:00 → un SMS ;
 *  2. run qui démarre à 07:55 : SMS mis en file à 07:55 (dû à 8 h), envoyeur à 07:56 → rien ; 08:00 → un SMS ;
 *  témoin : à midi, mis en file et envoyé dans la minute (comportement inchangé).
 * Invariants du lot 9 quinquies (p1 à p3) vérifiés à la fin.
 *
 * Rouge avant correctif : à 22:00 simulé, l'envoyeur envoyait le SMS dû à 21:55 (SMS aux admins envoyé la nuit).
 *
 * Finition 4 (décision du client du 19/11, modification signalée au rapport) : plage par défaut 01:00 → 07:00 (réglage) ;
 * le report de nuit est commun à tous les messages non urgents (motif NIGHT au lieu d'ADMIN_NIGHT). Les deux runs simulés
 * sont décalés sur la nouvelle plage : 00:55 → 01:00 (reporté) → 06:59 → 07:00 ; 06:55 (dû à 07:00) → 06:56 → 07:00.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { addMinutes, dakarAt, dakarDay, dispatchAt, newAdmin, outboxRows, type OutboxRow, type TestAdmin } from './notif-helpers';

let admin: TestAdmin;

before(async () => {
    admin = await newAdmin('nuit-sms', ['partners.validate', 'partners.read']);
});

after(async () => {
    await assertLot9quinquiesInvariants('main414-nuit-sms-admins');
});

/** Candidature simulée pour le seul admin de la suite ; rend la référence. */
async function addReview(now: Date): Promise<string> {
    const ref = randomUUID();
    await writeLocal(async (c) => {
        await c.query('SELECT public.notif_admin_review_sms($1::jsonb)', [JSON.stringify({
            kind: 'PARTNER_NEW', ref, company: `Nuit ${ref.slice(0, 6)}`, now: now.toISOString(), only_admin_ids: [admin.userId],
        })]);
    });
    return ref;
}

/** La ligne ADMIN_REVIEW_SMS de l'admin qui porte cette référence. */
async function rowOf(ref: string): Promise<OutboxRow> {
    const rows = (await outboxRows({ type: 'ADMIN_REVIEW_SMS', userId: admin.userId }))
        .filter((r) => Array.isArray((r.template_data as { refs?: unknown }).refs) && ((r.template_data as { refs: string[] }).refs).includes(ref));
    assert.equal(rows.length, 1, `une ligne ADMIN_REVIEW_SMS porte la référence ${ref} (${rows.length})`);
    return rows[0];
}

async function dispatchRow(ref: string, now: Date): Promise<void> {
    await dispatchAt(now, { ids: [(await rowOf(ref)).id] });
}

const smsCount = (): number => getFakes().sms.messagesTo(admin.phoneE164).length;
const hourDakar = (iso: string | null): number => new Date(String(iso)).getUTCHours(); // Dakar = UTC toute l'année

describe('D1 — plage de nuit des SMS aux admins revérifiée à l’envoi (heure simulée)', () => {
    test('run simulé qui démarre à 00:55 : mis en file à 00:55, rien à 01:00 ni à 06:59, un SMS à 07:00', async () => {
        const day = dakarDay(3);
        const next = day;
        const sms0 = smsCount();
        const ref = await addReview(dakarAt(day, '00:55'));
        const queued = await rowOf(ref);
        assert.equal(queued.status, 'PENDING');
        assert.equal(Date.parse(queued.due_at), dakarAt(day, '00:55').getTime(), 'dû tout de suite (avant la nuit)');

        await dispatchRow(ref, dakarAt(day, '01:00'));
        const deferred = await rowOf(ref);
        assert.equal(deferred.status, 'PENDING', 'à 01:00 : toujours en attente, jamais envoyé ni perdu');
        assert.equal(smsCount(), sms0, 'à 01:00 : aucun SMS');
        assert.equal(Date.parse(String(deferred.next_attempt_at)), dakarAt(next, '07:00').getTime(), 'reporté à 7 h');
        assert.equal(Date.parse(deferred.due_at), dakarAt(next, '07:00').getTime(), 'échéance reportée à 7 h');
        const decision = deferred.decision as { outcome?: string; reason?: string } | null;
        assert.equal(decision?.outcome, 'DEFER');
        assert.equal(decision?.reason, 'NIGHT');
        assert.equal(Number(deferred.attempts), Number(queued.attempts), 'aucune tentative consommée');

        await dispatchRow(ref, dakarAt(next, '06:59'));
        assert.equal((await rowOf(ref)).status, 'PENDING', 'à 06:59 : toujours en attente');
        assert.equal(smsCount(), sms0, 'à 06:59 : aucun SMS');

        await dispatchRow(ref, dakarAt(next, '07:00'));
        const sent = await rowOf(ref);
        assert.equal(sent.status, 'SENT', 'à 07:00 : envoyé');
        assert.equal(hourDakar(sent.sent_at), 7, 'envoyé à 7 h');
        assert.equal(smsCount(), sms0 + 1, 'un seul SMS');
    });

    test('run simulé qui démarre à 06:55 : mis en file à 06:55 (dû à 7 h), rien à 06:56, un SMS à 07:00', async () => {
        const day = dakarDay(6);
        const sms0 = smsCount();
        const ref = await addReview(dakarAt(day, '06:55'));
        assert.equal(Date.parse((await rowOf(ref)).due_at), dakarAt(day, '07:00').getTime(), 'dû à 7 h');

        await dispatchRow(ref, dakarAt(day, '06:56'));
        assert.equal((await rowOf(ref)).status, 'PENDING', 'à 06:56 : en attente');
        assert.equal(smsCount(), sms0, 'à 06:56 : aucun SMS');

        await dispatchRow(ref, dakarAt(day, '07:00'));
        const sent = await rowOf(ref);
        assert.equal(sent.status, 'SENT');
        assert.equal(hourDakar(sent.sent_at), 7);
        assert.equal(smsCount(), sms0 + 1);
    });

    test('décision du 19/11 : la plage suit le réglage (aucune heure en dur) ; 22-8 aujourd’hui, 01:00-07:00 à la finition 4', async () => {
        const day = dakarDay(10);
        const ends = await writeLocal(async (c) => {
            const q = async (at: string, s: number | null, e: number | null): Promise<string> =>
                new Date((await c.query<{ t: Date }>('SELECT public.notif_quiet_end_at($1::timestamptz, $2::int, $3::int) AS t', [at, s, e])).rows[0].t).toISOString();
            const settings = (await c.query<{ s: number; e: number }>(
                "SELECT public.notif_setting_int('notif.sms_quiet_start') AS s, public.notif_setting_int('notif.sms_quiet_end') AS e")).rows[0];
            const due = async (at: string): Promise<string> =>
                new Date((await c.query<{ t: Date }>('SELECT public.notif_admin_review_due($1::timestamptz) AS t', [at])).rows[0].t).toISOString();
            return {
                settings,
                n2200: await q(`${day}T22:30:00Z`, 22, 8), n0300: await q(`${day}T03:00:00Z`, 22, 8), n1200: await q(`${day}T12:00:00Z`, 22, 8),
                f0030: await q(`${day}T00:30:00Z`, 1, 7), f0300: await q(`${day}T03:00:00Z`, 1, 7), f2330: await q(`${day}T23:30:00Z`, 1, 7),
                none: await q(`${day}T03:00:00Z`, null, 8),
                dueNow: await due(`${day}T23:00:00Z`),
                dueExpected: await q(`${day}T23:00:00Z`, Number(settings.s), Number(settings.e)),
            };
        });
        const next = dakarDay(11);
        assert.equal(ends.n2200, `${next}T08:00:00.000Z`, '22-8 : 22:30 → lendemain 08:00');
        assert.equal(ends.n0300, `${day}T08:00:00.000Z`, '22-8 : 03:00 → 08:00');
        assert.equal(ends.n1200, `${day}T12:00:00.000Z`, '22-8 : midi hors plage');
        assert.equal(ends.f0030, `${day}T00:30:00.000Z`, '01-07 : 00:30 hors plage');
        assert.equal(ends.f0300, `${day}T07:00:00.000Z`, '01-07 : 03:00 → 07:00');
        assert.equal(ends.f2330, `${day}T23:30:00.000Z`, '01-07 : 23:30 hors plage');
        assert.equal(ends.none, `${day}T03:00:00.000Z`, 'réglage absent : aucune plage');
        // L'échéance des SMS aux admins est celle du réglage courant, quel qu'il soit
        assert.equal(ends.dueNow, ends.dueExpected, `notif_admin_review_due suit le réglage (${ends.settings.s}-${ends.settings.e})`);
    });

    test('témoin : à midi, mis en file et envoyé dans la minute (inchangé)', async () => {
        const day = dakarDay(8);
        const sms0 = smsCount();
        const ref = await addReview(dakarAt(day, '12:00'));
        await dispatchRow(ref, addMinutes(dakarAt(day, '12:00'), 1));
        const sent = await rowOf(ref);
        assert.equal(sent.status, 'SENT');
        assert.equal(hourDakar(sent.sent_at), 12);
        assert.equal(smsCount(), sms0 + 1);
    });
});
