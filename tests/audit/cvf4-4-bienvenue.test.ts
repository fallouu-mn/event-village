/**
 * Contre-vérification de la finition 4 — point 5 : bienvenue et merci.
 *
 * Attendu (consigne) : une seule bienvenue par spectateur et par événement, même avec plusieurs billets et plusieurs portes ;
 * pas de merci pour un événement annulé (cvf4-1-nuit G1) ni pour quelqu'un qui n'est pas entré.
 *
 *  G6 (garde-fou) : deux billets du même porteur validés au même instant à deux portes (deux transactions concurrentes,
 *     VALIDE → UTILISE, trigger trg_tickets_scanned_notify) : une bienvenue par canal, un merci par canal, et « Entrée
 *     validée » (TICKET_SCANNED) pour le second billet seulement. La seconde transaction attend la première sur la clé
 *     ENTRY_WELCOME:<compte>:<événement> (ON CONFLICT DO NOTHING de notif_enqueue) au lieu d'échouer ou d'en créer une
 *     seconde.
 *  G7 (garde-fou) : un porteur dont aucun billet n'est passé n'a ni bienvenue ni merci (le merci n'est mis en file qu'avec
 *     la bienvenue, 20261125000004_f4_spectateur.sql:41-57 ; aucune instruction ne repasse un billet UTILISE à VALIDE).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newBuyer, type Buyer } from '../parcours/paiement-helpers';
import { outboxRows } from '../parcours/notif-helpers';

type SaleEvent = Awaited<ReturnType<typeof createPartnerEvent>>;

let partner: TestPartner;
let ev: SaleEvent;
let holder: Buyer;
let absent: Buyer;
let tickets: string[];

before(async () => {
    partner = await newPartner('cvf4bnv');
    ev = await createPartnerEvent(partner.partnerId, 'cvf4-bienvenue', [{ name: 'Standard', price: 5_000, total: 20 }]);
    holder = await newBuyer('cvf4-spectateur');
    absent = await newBuyer('cvf4-absent');
    tickets = (await buyConfirmed(holder, ev, [['Standard', 2]])).tickets.map((t) => String(t.id));
    await buyConfirmed(absent, ev, [['Standard', 1]]);
});

const byChannel = (rows: Array<{ channel: string }>): Record<string, number> =>
    rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.channel]: (m[r.channel] ?? 0) + 1 }), {});

describe('cvf4 point 5 — bienvenue et merci', () => {
    test('G6 : deux billets du même porteur à deux portes au même instant → une bienvenue, un merci', async () => {
        assert.equal(tickets.length, 2, 'précondition : deux billets');
        const doorA = await openConcurrentClient({ applicationName: 'cvf4-porte-a' });
        const doorB = await openConcurrentClient({ applicationName: 'cvf4-porte-b' });
        const scan = "UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now() WHERE id = $1 AND status = 'VALIDE'";
        try {
            assert.equal((await doorA.query(scan, [tickets[0]])).rowCount, 1);
            const pb = doorB.query(scan, [tickets[1]]);
            await waitForLockWaiters([doorB.pid]);
            await doorA.commit();
            assert.equal((await pb).rowCount, 1);
            await doorB.commit();
        } finally {
            await doorA.close();
            await doorB.close();
        }
        const welcome = await outboxRows({ type: 'ENTRY_WELCOME', userId: holder.userId, eventId: ev.eventId });
        const thanks = await outboxRows({ type: 'ENTRY_THANKS', userId: holder.userId, eventId: ev.eventId });
        assert.deepEqual(byChannel(welcome), { IN_APP: 1, SMS: 1, EMAIL: 1, PUSH: 1 }, 'une bienvenue par canal');
        assert.deepEqual(byChannel(thanks), { IN_APP: 1, SMS: 1, EMAIL: 1, PUSH: 1 }, 'un merci par canal');
        assert.equal(String(welcome[0].template_data.ticket_id), tickets[0], 'bienvenue du premier billet passé');
        assert.deepEqual(await outboxRows({ keyPrefix: `TICKET_SCANNED:${tickets[0]}:` }), [], 'pas d’« Entrée validée » en plus de la bienvenue');
        assert.ok((await outboxRows({ keyPrefix: `TICKET_SCANNED:${tickets[1]}:` })).length > 0, '« Entrée validée » pour le second billet');
    });

    test('G7 : porteur jamais entré → ni bienvenue ni merci', async () => {
        assert.deepEqual(await outboxRows({ type: ['ENTRY_WELCOME', 'ENTRY_THANKS'], userId: absent.userId, eventId: ev.eventId }), []);
    });
});
