/**
 * Contre-vérification de la finition 4 — points 1 (argent) et 4 (données).
 *
 *  G4 (garde-fou) : deux confirmations simultanées d'un même paiement (webhook et relève), puis deux rejeux : une seule
 *     émission (billets, grand livre), un seul avis d'achat par canal, une seule commande comptée dans la cloche groupée de
 *     l'organisatrice (NEW_ORDER, order_count) et dans le SMS groupé.
 *  G5 (garde-fou) : aucune ligne de la boîte d'envoi destinée à l'organisatrice (cloche groupée, SMS groupé, premier billet,
 *     complet…) ni aucun SMS qu'elle reçoit ne contient le nom, le prénom, le numéro ou l'email d'un acheteur.
 *
 * Recopies de payment_confirm et notif_cashouts_notify : comparées ligne à ligne à leur dernière définition de main (sortie
 * brute au rapport docs/audit-finition-4.md, § 1) ; seules les mises en file d'avis changent.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openConcurrentClient, waitForLockWaiters, writeLocal } from '../helpers/db';
import { getFakes } from '../fakes';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { cart, checkout, deliverWebhook, newBuyer, paymentById, providerSays, type Buyer } from '../parcours/paiement-helpers';
import { dispatchAt, outboxRows } from '../parcours/notif-helpers';

type SaleEvent = Awaited<ReturnType<typeof createPartnerEvent>>;

let partner: TestPartner;
let ev: SaleEvent;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('cvf4arg');
    ev = await createPartnerEvent(partner.partnerId, 'cvf4-argent', [{ name: 'Standard', price: 5_000, total: 4 }]);
    buyer = await newBuyer('cvf4-acheteur', { firstName: 'Ndeye', lastName: 'Cvfquatre' });
});

const count = async (sql: string, params: unknown[]): Promise<number> =>
    writeLocal(async (c) => Number((await c.query<{ n: string }>(sql, params)).rows[0].n));

describe('cvf4 point 1 — un paiement confirmé deux fois', () => {
    test('G4 : confirmations simultanées puis rejeux → une émission, un avis, une commande comptée', async () => {
        // premier achat confirmé (premier billet vendu : la cloche et le SMS groupé commencent après lui)
        await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const bellsBefore = (await outboxRows({ type: 'NEW_ORDER', eventId: ev.eventId, channel: 'IN_APP' }))
            .reduce((s, r) => s + Number(r.template_data.order_count ?? 0), 0);

        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer));
        assert.equal(res.status, 200, `checkout : ${res.status} ${JSON.stringify(res.body)}`);
        const paymentId = res.payment!.id;

        const a = await openConcurrentClient({ applicationName: 'cvf4-confirm-a' });
        const b = await openConcurrentClient({ applicationName: 'cvf4-confirm-b' });
        let ra: string;
        let rb: string;
        try {
            ra = String((await a.query<{ r: { result: string } }>("SELECT public.payment_confirm($1::uuid, 'WEBHOOK') AS r", [paymentId])).rows[0].r.result);
            const pb = b.query<{ r: { result: string } }>("SELECT public.payment_confirm($1::uuid, 'POLL') AS r", [paymentId]);
            await waitForLockWaiters([b.pid]);
            await a.commit();
            rb = String((await pb).rows[0].r.result);
            await b.commit();
        } finally {
            await a.close();
            await b.close();
        }
        assert.deepEqual([ra, rb], ['CONFIRMED', 'ALREADY_CONFIRMED']);
        const ledger = await count('SELECT count(*) AS n FROM public.finance_ledger WHERE payment_id = $1', [paymentId]);

        // rejeux : RPC et webhook
        const again = await writeLocal(async (c) => (await c.query<{ r: { result: string } }>("SELECT public.payment_confirm($1::uuid, 'WEBHOOK') AS r", [paymentId])).rows[0].r.result);
        assert.equal(again, 'ALREADY_CONFIRMED');
        const pay = await paymentById(paymentId);
        providerSays(pay, 'SUCCESS');
        const hook = await deliverWebhook(pay);
        assert.equal(hook.status, 200, 'webhook rejoué accepté');

        assert.equal(await count('SELECT count(*) AS n FROM public.tickets WHERE payment_id = $1', [paymentId]), 2, 'deux billets, pas quatre');
        const purchase = await outboxRows({ keyPrefix: `PURCHASE_CONFIRMED:${paymentId}:` });
        const perChannel = new Map<string, number>();
        for (const r of purchase) perChannel.set(r.channel, (perChannel.get(r.channel) ?? 0) + 1);
        assert.ok(purchase.length > 0 && [...perChannel.values()].every((n) => n === 1), `un avis d'achat par canal : ${JSON.stringify([...perChannel])}`);

        const bellsAfter = (await outboxRows({ type: 'NEW_ORDER', eventId: ev.eventId, channel: 'IN_APP' }))
            .reduce((s, r) => s + Number(r.template_data.order_count ?? 0), 0);
        assert.equal(bellsAfter - bellsBefore, 1, 'une seule commande ajoutée à la cloche groupée');
        const salesSms = (await outboxRows({ type: 'SALES_UPDATE_SMS', eventId: ev.eventId, channel: 'SMS' }))
            .reduce((s, r) => s + Number(r.template_data.ticket_count ?? 0), 0);
        assert.equal(salesSms, 2, 'deux billets comptés dans le SMS groupé, pas quatre');
        assert.equal(await count('SELECT count(*) AS n FROM public.finance_ledger WHERE payment_id = $1', [paymentId]), ledger, 'grand livre inchangé par les rejeux');
    });
});

describe('cvf4 point 4 — aucune donnée d’acheteur dans les avis de l’organisatrice', () => {
    test('G5 : boîte d’envoi et SMS de l’organisatrice sans nom, numéro ni email d’acheteur', async () => {
        // achats jusqu'à l'épuisement (4 places : 1 + 2 au test précédent, 1 ici → « complet »)
        await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const rows = await outboxRows({ userId: partner.userId });
        assert.ok(rows.some((r) => r.type === 'NEW_ORDER'), `précondition : cloche des ventes présente (${[...new Set(rows.map((r) => r.type))].join(', ')})`);
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id), limit: 200 });
        const secrets = [buyer.phoneE164, buyer.phone9, buyer.email.toLowerCase(), buyer.firstName.toLowerCase(), buyer.lastName.toLowerCase()];
        const leaks: string[] = [];
        for (const r of await outboxRows({ userId: partner.userId })) {
            const blob = JSON.stringify(r.template_data).toLowerCase();
            for (const s of secrets) if (blob.includes(s)) leaks.push(`${r.type}/${r.channel} template_data contient « ${s} »`);
        }
        for (const m of getFakes().sms.messagesTo(partner.phoneE164)) {
            const t = m.message.toLowerCase();
            for (const s of secrets) if (t.includes(s)) leaks.push(`SMS « ${m.message} » contient « ${s} »`);
        }
        assert.deepEqual(leaks, []);
    });
});
