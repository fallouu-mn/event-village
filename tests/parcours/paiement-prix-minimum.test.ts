/**
 * Lot 9 bis, tâche H8 — montant minimum d'encaissement (consigne H8 ; contrat 5.61, 4.3, 4.5, 12, B107 ; découverte
 * 9bis/discovery-9bis-samirpay.md section 9). Une erreur 500 de SamirPay à l'initialisation peut venir d'un montant
 * sous le minimum du compte : message clair au client, et prix minimum d'une catégorie payante réglable
 * (finance.min_paid_price, 100 F par défaut), appliqué par trigger à toute catégorie payante créée ou dont le prix change.
 *  1. catégorie payante à 50 F → 400 PRICE_BELOW_MINIMUM, texte exact, rien de créé ;
 *  2. 0 F (gratuit) et 100 F → acceptés ;
 *  3. le SUPERADMIN règle 500 F : une catégorie à 300 F (créée avant) passée à 400 F → refusée ; sa quantité seule
 *     changée → acceptée (le prix ne change pas) ;
 *  4. SamirPay répond 500 à l'initialisation (faux « internal-error ») : 502 PAYMENT_PROVIDER_INTERNAL, texte exact,
 *     paiement FAILED non définitif (provider_final faux), un seul appel (aucune relance sur une erreur 5xx, H4).
 *
 * Rouge aujourd'hui : aucun minimum (lib/validations/event.ts:287-288, CHECK price >= 0), clé finance.min_paid_price
 * absente ; un 500 devient UNCERTAIN, 502 « Le service de paiement ne répond pas : réessayez. »
 * (checkout.service.ts:285-288). Vert dès l'écriture (signalé) : 2 ; son garde-fou est 1.
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { routeContext } from './helpers';
import { cart, checkout, createSaleEvent, importModule, initCalls, newBuyer, paymentByOrder, service, setFakeMode } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, type DraftEvent } from './cycle-helpers';
import { withSettings } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Result { status: number; body: Row }

const CATEGORIES_ROUTE = '../../app/api/partner/events/[id]/categories/route';
const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';
/** Texte du contrat 4.3 pour un minimum de {min} F CFA. */
const belowMinimum = (min: string): string => `Le prix d’un billet payant est d’au moins ${min} F CFA. Pour un billet gratuit, indiquez 0.`;
/** Texte du contrat 4.5 (500 SamirPay à l'initialisation). */
const PROVIDER_INTERNAL_TEXT = 'Le paiement n’a pas pu être lancé. Réessayez dans quelques minutes ; si le problème continue, contactez le support.';

let partner: TestPartner;
let draft: DraftEvent;

before(async () => {
    setFakeMode('initMode', 'success');
    partner = await newPartner('prix-minimum');
    draft = await createDraftEvent(partner, 'prix-minimum', [{ name: 'Base', price: 2_000, total: 10 }], { capacity: 500, startsInHours: 10 * 24 });
});

after(async () => {
    setFakeMode('initMode', 'success');
    await assertLot9bisInvariants('paiement-prix-minimum');
});

async function invoke(path: string, method: string, ctxParams: Record<string, string>, mod: string, body: Row): Promise<Result> {
    const m = await importModule(mod);
    assert.equal(typeof m[method], 'function', `${mod} : ${method} exporté`);
    const res = await (m[method] as Handler)(jsonRequest(path, method, partner.accessToken, body), routeContext(ctxParams));
    const text = await res.text();
    let parsed: Row = {};
    try {
        parsed = text ? JSON.parse(text) as Row : {};
    } catch (err) {
        parsed = { raw: text.slice(0, 2000), parseError: (err as Error).message };
    }
    return { status: res.status, body: parsed };
}

const createCategory = (name: string, price: number): Promise<Result> =>
    invoke(`/api/partner/events/${draft.eventId}/categories`, 'POST', { id: draft.eventId }, CATEGORIES_ROUTE, { name, price, total_quantity: 10, max_per_order: 2 });

const updateCategory = (categoryId: string, body: Row): Promise<Result> =>
    invoke(`/api/partner/events/${draft.eventId}/categories/${categoryId}`, 'PATCH', { id: draft.eventId, categoryId }, CATEGORY_ROUTE, body);

async function categoryByName(name: string): Promise<Row | null> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('event_id', draft.eventId).eq('name', name).maybeSingle();
    assert.equal(error, null, `catégorie ${name} : ${error?.message}`);
    return data as Row | null;
}

function brief(r: Result): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

describe('H8 — prix minimum d’une catégorie payante (finance.min_paid_price, B107)', () => {
    test('1. catégorie payante à 50 F → 400 PRICE_BELOW_MINIMUM (100 F par défaut), rien de créé', async () => {
        const r = await createCategory('Sous le minimum', 50);
        assert.equal(r.status, 400, `catégorie à 50 F (aujourd’hui acceptée) : ${brief(r)}`);
        assert.deepEqual({ code: r.body.code, error: r.body.error }, { code: 'PRICE_BELOW_MINIMUM', error: belowMinimum('100') }, brief(r));
        assert.equal(await categoryByName('Sous le minimum'), null, 'aucune catégorie créée');
    });

    test('2. 0 F (gratuit) et 100 F tout juste → acceptés', async () => {
        for (const [name, price] of [['Gratuite', 0], ['Au minimum', 100]] as const) {
            const r = await createCategory(name, price);
            assert.ok(r.status === 200 || r.status === 201, `${name} (${price} F) : ${brief(r)}`);
            assert.equal(Number((await categoryByName(name))?.price), price, `${name} créée au prix demandé`);
        }
    });

    test('3. minimum réglé à 500 F : 300 → 400 F refusé ; quantité seule changée sur une catégorie à 300 F acceptée', async () => {
        const created = await createCategory('Trois cents', 300);
        assert.ok(created.status === 200 || created.status === 201, `précondition : catégorie à 300 F sous l’ancien minimum : ${brief(created)}`);
        const cat = await categoryByName('Trois cents');
        assert.ok(cat, 'précondition : catégorie à 300 F');
        await withSettings({ 'finance.min_paid_price': 500 }, async () => {
            const raised = await updateCategory(String(cat!.id), { price: 400 });
            assert.equal(raised.status, 400, `prix passé à 400 F sous le minimum de 500 F : ${brief(raised)}`);
            assert.deepEqual({ code: raised.body.code, error: raised.body.error }, { code: 'PRICE_BELOW_MINIMUM', error: belowMinimum('500') }, brief(raised));
            assert.equal(Number((await categoryByName('Trois cents'))?.price), 300, 'prix inchangé');
            const quantity = await updateCategory(String(cat!.id), { total_quantity: 12 });
            assert.equal(quantity.status, 200, `quantité seule, prix inchangé : acceptée (les catégories anciennes ne sont pas touchées) : ${brief(quantity)}`);
            assert.equal(Number((await categoryByName('Trois cents'))?.total_quantity), 12, 'quantité changée');
        });
    });
});

describe('H8 — erreur 500 de SamirPay à l’initialisation : message clair (B107, contrat 4.5)', () => {
    test('4. faux « internal-error » : 502 PAYMENT_PROVIDER_INTERNAL, texte exact, paiement FAILED non définitif, un seul appel', async () => {
        const ev = await createSaleEvent('prix-minimum-500', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const buyer = await newBuyer('prix-minimum-500');
        const before0 = initCalls().length;
        setFakeMode('initMode', 'internal-error');
        let r: Awaited<ReturnType<typeof checkout>>;
        try {
            r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        } finally {
            setFakeMode('initMode', 'success');
        }
        assert.equal(r.status, 502, `HTTP : ${JSON.stringify(r.body)}`);
        assert.deepEqual({ code: r.body.code, error: r.body.error }, { code: 'PAYMENT_PROVIDER_INTERNAL', error: PROVIDER_INTERNAL_TEXT }, `message clair au client (aujourd’hui « ne répond pas ») : ${JSON.stringify(r.body)}`);
        const calls = initCalls().slice(before0).filter((c) => c.args.telephone === buyer.phone9);
        assert.equal(calls.length, 1, 'aucune relance sur une erreur 5xx (H4)');
        const p = await paymentByOrder(calls[0].orderId);
        assert.deepEqual({ status: p?.status, final: p?.provider_final }, { status: 'FAILED', final: false }, 'paiement FAILED, jamais définitif (adoption H4 possible)');
    });
});
