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
    test('run simulé qui démarre à 21:55 : mis en file à 21:55, rien à 22:00 ni à 07:59, un SMS à 08:00', async () => {
        const day = dakarDay(3);
        const next = dakarDay(4);
        const sms0 = smsCount();
        const ref = await addReview(dakarAt(day, '21:55'));
        const queued = await rowOf(ref);
        assert.equal(queued.status, 'PENDING');
        assert.equal(Date.parse(queued.due_at), dakarAt(day, '21:55').getTime(), 'dû tout de suite (avant la nuit)');

        await dispatchRow(ref, dakarAt(day, '22:00'));
        const deferred = await rowOf(ref);
        assert.equal(deferred.status, 'PENDING', 'à 22:00 : toujours en attente, jamais envoyé ni perdu');
        assert.equal(smsCount(), sms0, 'à 22:00 : aucun SMS');
        assert.equal(Date.parse(String(deferred.next_attempt_at)), dakarAt(next, '08:00').getTime(), 'reporté à 8 h');
        assert.equal(Date.parse(deferred.due_at), dakarAt(next, '08:00').getTime(), 'échéance reportée à 8 h');
        const decision = deferred.decision as { outcome?: string; reason?: string } | null;
        assert.equal(decision?.outcome, 'DEFER');
        assert.equal(decision?.reason, 'ADMIN_NIGHT');
        assert.equal(Number(deferred.attempts), Number(queued.attempts), 'aucune tentative consommée');

        await dispatchRow(ref, dakarAt(next, '07:59'));
        assert.equal((await rowOf(ref)).status, 'PENDING', 'à 07:59 : toujours en attente');
        assert.equal(smsCount(), sms0, 'à 07:59 : aucun SMS');

        await dispatchRow(ref, dakarAt(next, '08:00'));
        const sent = await rowOf(ref);
        assert.equal(sent.status, 'SENT', 'à 08:00 : envoyé');
        assert.equal(hourDakar(sent.sent_at), 8, 'envoyé à 8 h');
        assert.equal(smsCount(), sms0 + 1, 'un seul SMS');
    });

    test('run simulé qui démarre à 07:55 : mis en file à 07:55 (dû à 8 h), rien à 07:56, un SMS à 08:00', async () => {
        const day = dakarDay(6);
        const sms0 = smsCount();
        const ref = await addReview(dakarAt(day, '07:55'));
        assert.equal(Date.parse((await rowOf(ref)).due_at), dakarAt(day, '08:00').getTime(), 'dû à 8 h');

        await dispatchRow(ref, dakarAt(day, '07:56'));
        assert.equal((await rowOf(ref)).status, 'PENDING', 'à 07:56 : en attente');
        assert.equal(smsCount(), sms0, 'à 07:56 : aucun SMS');

        await dispatchRow(ref, dakarAt(day, '08:00'));
        const sent = await rowOf(ref);
        assert.equal(sent.status, 'SENT');
        assert.equal(hourDakar(sent.sent_at), 8);
        assert.equal(smsCount(), sms0 + 1);
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
