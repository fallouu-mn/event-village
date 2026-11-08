/**
 * Lot 9, tâche 9.2 (contrat 4.3, 5.3 ; L33 ; AR13 ; D-cpt 3) — Mes paiements : GET /api/account/payments?page=.
 *  - un client ne voit que ses paiements, le filtre vient de la session, jamais de la requête ;
 *  - 20 par page, décalage, tri created_at DESC puis id DESC, totaux calculés sur tout le filtre ;
 *  - total_paid = SUCCESS, PARTIAL, REFUNDED, REFUND_PENDING ; total_refunded = somme de refunded_amount ;
 *  - montant 0 absent, vente au guichet absente, paiements simulés masqués hors simulation ;
 *  - libellés faits côté serveur, jamais de statut brut, aucun identifiant technique dans la réponse ;
 *  - /paiement/[id] sait afficher PARTIAL (AR13) ; écran Mes paiements.
 *
 * Rouge avant correctif : la route app/api/account/payments et la RPC client_payments_list n'existent pas (import
 * dynamique et rpc() réel, l'échec les nomme), ni l'écran ; `case 'PARTIAL'` absent de /paiement/[id] ; après les tests,
 * assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés.
 *
 * Verts dès l'écriture, signalés : les deux cas du middleware (règle générale des /api/*).
 *
 * Fabrication : les paiements sont insérés par le service_role, is_platform_payment faux, sans frais ni reversement :
 * les invariants (a)(d)(e) ne s'appliquent qu'aux paiements plateforme confirmés, et (i) tient avec des frais nuls. Les
 * lignes plateforme de la suite (opérateur absent) restent PENDING. Le paiement simulé passe par l'en-tête du mode
 * d'essai (la colonne `simulated` est posée par trigger, immuable). Chaque test a son acheteur neuf.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { authed } from './acces-helpers';
import { createPartnerEvent, newPartner } from './finance-helpers';
import { BASE_URL, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';

after(async () => {
    await assertLot9Invariants('compte-paiements');
});

const PAYMENTS_PATH = '/api/account/payments';
const SENTINEL = 'SENTINELLE_PAIEMENT';
const ITEM_KEYS = ['amount', 'created_at', 'event_title', 'id', 'operator_label', 'refunded_amount', 'status_label', 'target_label'];

interface Reply { status: number; body: Record<string, unknown>; text: string; headers: Headers }

interface Item {
    id: string;
    created_at: string;
    amount: number;
    refunded_amount: number;
    operator_label: string;
    status_label: string;
    target_label: string;
    event_title: string | null;
}

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, body, text, headers: res.headers };
}

async function route(): Promise<(req: NextRequest) => Promise<Response>> {
    const mod = await importModule('../../app/api/account/payments/route');
    assert.equal(typeof mod.GET, 'function', 'app/api/account/payments/route doit exporter GET (contrat 4.3)');
    return mod.GET;
}

async function list(user: Buyer, query = ''): Promise<Reply> {
    return reply(await (await route())(authed(`${PAYMENTS_PATH}${query}`, 'GET', user)));
}

function items(r: Reply): Item[] {
    assert.equal(r.status, 200, r.text);
    assert.ok(Array.isArray(r.body.items), `items absent : ${r.text.slice(0, 300)}`);
    return r.body.items as Item[];
}

interface PaymentSpec {
    status?: string;
    amount?: number;
    refunded?: number;
    target?: string;
    operator?: string | null;
    platform?: boolean;
    eventId?: string | null;
    createdAt?: string;
    clientId?: string | null;
    extra?: Record<string, unknown>;
}

function paymentRow(buyer: Buyer | null, spec: PaymentSpec): Record<string, unknown> {
    return {
        transaction_id: `TX-COMPTE-${randomUUID()}`,
        client_id: spec.clientId === undefined ? buyer?.userId ?? null : spec.clientId,
        payment_target: spec.target ?? 'OTHER',
        amount: spec.amount ?? 1_000,
        refunded_amount: spec.refunded ?? 0,
        currency: 'XOF',
        is_platform_payment: spec.platform ?? false,
        status: spec.status ?? 'SUCCESS',
        operator: spec.operator === undefined ? 'WAVE' : spec.operator,
        event_id: spec.eventId ?? null,
        // Insertion par lot : PostgREST complète les clés absentes par NULL, created_at est donc toujours fourni
        created_at: spec.createdAt ?? new Date().toISOString(),
        ...(spec.extra ?? {}),
    };
}

async function insertPayment(buyer: Buyer | null, spec: PaymentSpec = {}): Promise<string> {
    const { data, error } = await service.from('payments').insert(paymentRow(buyer, spec)).select('id').single();
    assert.equal(error, null, `paiement de test : ${error?.message}`);
    return data.id as string;
}

async function insertPayments(buyer: Buyer, specs: PaymentSpec[]): Promise<void> {
    const { error } = await service.from('payments').insert(specs.map((s) => paymentRow(buyer, s)));
    assert.equal(error, null, `paiements de test : ${error?.message}`);
}

/** Dates espacées d'une minute, de la plus ancienne à la plus récente. */
function minutesAgo(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

describe('GET /api/account/payments — droits', () => {
    test('A ne voit jamais les paiements de B', async () => {
        const a = await newBuyer('pay-a');
        const b = await newBuyer('pay-b');
        const mine = await insertPayment(a, { amount: 3_000 });
        const theirs = await insertPayment(b, { amount: 7_000 });
        const r = await list(a);
        assert.deepEqual(items(r).map((i) => i.id), [mine]);
        assert.equal(r.text.includes(theirs), false, 'paiement de B dans la réponse de A');
        assert.equal(r.body.total_count, 1);
        assert.equal(r.body.total_paid, 3_000);
    });

    test('user_id, client_id et id en paramètre sont ignorés', async () => {
        const a = await newBuyer('pay-param-a');
        const b = await newBuyer('pay-param-b');
        const mine = await insertPayment(a);
        await insertPayment(b);
        const r = await list(a, `?user_id=${b.userId}&client_id=${b.userId}&id=${b.userId}`);
        assert.deepEqual(items(r).map((i) => i.id), [mine]);
    });

    test('sans session : 401 AUTH_REQUIRED', async () => {
        const r = await reply(await (await route())(new NextRequest(`${BASE_URL}${PAYMENTS_PATH}`)));
        assert.equal(r.status, 401, r.text);
        assert.equal(r.body.code, 'AUTH_REQUIRED', r.text);
    });

    test('compte suspendu : 403 ACCOUNT_NOT_ACTIVE', async () => {
        const a = await newBuyer('pay-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', a.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await list(a);
        assert.equal(r.status, 403, r.text);
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', r.text);
    });

    test('middleware : 401 sans session (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(PAYMENTS_PATH, []);
        assert.equal(result.status, 401, JSON.stringify(result));
        assert.equal(result.passedThrough, false);
    });

    test('middleware : une session passe (déjà vrai, garde-fou)', async () => {
        const a = await newBuyer('pay-mw');
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await client.auth.signInWithPassword({ email: a.email, password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion : ${error?.message}`);
        const result = await callMiddleware(PAYMENTS_PATH, await sessionCookies(client));
        assert.equal(result.passedThrough, true, JSON.stringify(result));
    });
});

describe('GET /api/account/payments — pagination', () => {
    test('25 paiements : page 1 = 20, page 2 = 5, page 3 vide, sans doublon ni trou, ordre exact', async () => {
        const a = await newBuyer('pay-pages');
        await insertPayments(a, Array.from({ length: 25 }, (_, i) => ({ amount: 100 + i, createdAt: minutesAgo(100 - i) })));
        const { data, error } = await service.from('payments').select('id, created_at').eq('client_id', a.userId);
        assert.equal(error, null, `relecture : ${error?.message}`);
        const expected = (data as Array<{ id: string; created_at: string }>)
            .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))
            .map((p) => p.id);

        const first = await list(a, '?page=1');
        const second = await list(a, '?page=2');
        const third = await list(a, '?page=3');
        assert.equal(items(first).length, 20);
        assert.equal(items(second).length, 5);
        assert.deepEqual(items(third), [], 'au-delà de la dernière page : liste vide');
        assert.deepEqual([...items(first), ...items(second)].map((i) => i.id), expected, 'ordre exact, sans doublon ni trou');
        assert.equal(first.body.page, 1);
        assert.equal(second.body.page, 2);
        assert.equal(first.body.page_size, 20);
        assert.equal(first.body.total_count, 25);
        assert.equal(third.body.total_count, 25);
    });

    test('page absente : page 1 ; même date : départage par id décroissant', async () => {
        const a = await newBuyer('pay-depart');
        const at = minutesAgo(10);
        const ids = [await insertPayment(a, { createdAt: at }), await insertPayment(a, { createdAt: at }), await insertPayment(a, { createdAt: at })];
        const r = await list(a);
        assert.equal(r.body.page, 1);
        assert.deepEqual(items(r).map((i) => i.id), [...ids].sort().reverse());
    });

    test('page 0, négative, décimale, texte : 400 INVALID_FIELD', async () => {
        const a = await newBuyer('pay-400');
        for (const page of ['0', '-1', '1.5', 'abc']) {
            const r = await list(a, `?page=${page}`);
            assert.equal(r.status, 400, `page=${page} : ${r.text}`);
            assert.equal(r.body.code, 'INVALID_FIELD', `page=${page} : ${r.text}`);
        }
    });

    test('réponse sans cache', async () => {
        const a = await newBuyer('pay-cache');
        assert.match((await list(a)).headers.get('cache-control') ?? '', /no-store/);
    });
});

describe('GET /api/account/payments — totaux (L33)', () => {
    test('chaque statut : PENDING, FAILED, EXPIRED, CANCELLED hors du total payé, totaux égaux sur toutes les pages', async () => {
        const a = await newBuyer('pay-totaux');
        await insertPayments(a, [
            { status: 'SUCCESS', amount: 1_000 },
            { status: 'PARTIAL', amount: 2_000, refunded: 500 },
            { status: 'REFUNDED', amount: 4_000, refunded: 4_000 },
            { status: 'REFUND_PENDING', amount: 8_000 },
            { status: 'PENDING', amount: 16_000 },
            { status: 'FAILED', amount: 32_000 },
            { status: 'EXPIRED', amount: 64_000 },
            { status: 'CANCELLED', amount: 128_000 },
            ...Array.from({ length: 20 }, (_, i) => ({ status: 'SUCCESS', amount: 10, createdAt: minutesAgo(500 + i) })),
        ]);
        const pages = [await list(a, '?page=1'), await list(a, '?page=2')];
        for (const r of pages) {
            assert.equal(r.status, 200, r.text);
            assert.equal(r.body.total_paid, 1_000 + 2_000 + 4_000 + 8_000 + 20 * 10, `total payé : ${r.text.slice(0, 300)}`);
            assert.equal(r.body.total_refunded, 500 + 4_000, `total remboursé : ${r.text.slice(0, 300)}`);
            assert.equal(r.body.total_count, 28);
        }
    });

    test('PARTIAL : remboursé partiel compté ; REFUND_PENDING : payé, 0 remboursé', async () => {
        const a = await newBuyer('pay-partiel');
        await insertPayments(a, [{ status: 'PARTIAL', amount: 5_000, refunded: 1_500 }, { status: 'REFUND_PENDING', amount: 3_000 }]);
        const r = await list(a);
        assert.equal(r.body.total_paid, 8_000);
        assert.equal(r.body.total_refunded, 1_500);
        const partial = items(r).find((i) => i.amount === 5_000);
        assert.equal(partial?.refunded_amount, 1_500);
        assert.equal(partial?.status_label, 'Remboursé en partie');
    });

    test('compte sans paiement : liste vide et totaux à zéro', async () => {
        const a = await newBuyer('pay-vide');
        const r = await list(a);
        assert.deepEqual(items(r), []);
        assert.equal(r.body.total_count, 0);
        assert.equal(r.body.total_paid, 0);
        assert.equal(r.body.total_refunded, 0);
    });
});

describe('GET /api/account/payments — ce qui est exclu', () => {
    test('montant 0 : absent de la liste et du compte', async () => {
        const a = await newBuyer('pay-zero');
        await insertPayment(a, { amount: 0 });
        const kept = await insertPayment(a, { amount: 500 });
        const r = await list(a);
        assert.deepEqual(items(r).map((i) => i.id), [kept]);
        assert.equal(r.body.total_count, 1);
    });

    test('vente au guichet sans client, même payée avec le numéro de A : absente', async () => {
        const a = await newBuyer('pay-guichet');
        const sale = await insertPayment(null, { clientId: null, extra: { payer_phone: a.phone9 } });
        const r = await list(a);
        assert.deepEqual(items(r), []);
        assert.equal(r.text.includes(sale), false);
        assert.equal(r.body.total_paid, 0);
    });

    test('paiement simulé : absent hors simulation, exclu des totaux ; la RPC ne sert que le mode demandé', async () => {
        const a = await newBuyer('pay-simule');
        const simulatedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { 'x-ev-simulation': '1' } },
        });
        const { data, error } = await simulatedClient.from('payments').insert(paymentRow(a, { amount: 9_000 })).select('id, simulated').single();
        assert.equal(error, null, `paiement simulé : ${error?.message}`);
        assert.equal(data.simulated, true, 'précondition : la ligne est marquée simulée');
        const real = await insertPayment(a, { amount: 1_000 });

        const r = await list(a);
        assert.deepEqual(items(r).map((i) => i.id), [real]);
        assert.equal(r.body.total_paid, 1_000);
        assert.equal(r.body.total_count, 1);

        const direct = await service.rpc('client_payments_list', { p: { user_id: a.userId, page: 1, page_size: 20, include_simulated: true } });
        assert.equal(direct.error, null, `client_payments_list : ${direct.error?.message} (code ${direct.error?.code})`);
        const rows = direct.data as { items: Array<{ id: string }>; total_paid: number };
        assert.deepEqual(rows.items.map((i) => i.id), [data.id], 'mode d’essai : les seuls paiements simulés');
        assert.equal(rows.total_paid, 9_000);
    });
});

describe('GET /api/account/payments — contenu des lignes', () => {
    test('clés exactes, aucun identifiant technique, aucun statut brut', async () => {
        const a = await newBuyer('pay-cles');
        const hash = `${SENTINEL.toLowerCase().replace(/[^a-f0-9]/g, 'a')}`.padEnd(64, 'a').slice(0, 64);
        await insertPayment(a, {
            status: 'SUCCESS',
            extra: {
                external_transaction_id: `EXT-${SENTINEL}-${randomUUID()}`,
                external_order_id: `ORD-${SENTINEL}-${randomUUID()}`,
                idempotency_key: `IDEM-${SENTINEL}-${randomUUID()}`,
                callback_token_hash: hash,
                provider_response: { secret: SENTINEL },
                metadata: { secret: SENTINEL },
            },
        });
        const r = await list(a);
        const [item] = items(r);
        assert.deepEqual(Object.keys(item).sort(), ITEM_KEYS, `clés de la ligne : ${JSON.stringify(item)}`);
        for (const forbidden of [SENTINEL, hash, 'external_transaction_id', 'callback_token_hash', 'idempotency_key', 'provider_response', 'transaction_id', 'client_id']) {
            assert.equal(r.text.includes(forbidden), false, `« ${forbidden} » présent dans la réponse : ${r.text.slice(0, 400)}`);
        }
        assert.equal(/\bSUCCESS\b|\bWAVE\b|\bOTHER\b/.test(r.text), false, `valeur brute dans la réponse : ${r.text.slice(0, 400)}`);
    });

    test('libellé de chaque statut (D-cpt 3)', async () => {
        const a = await newBuyer('pay-statuts');
        const labels: Record<string, string> = {
            SUCCESS: 'Confirmé', PENDING: 'En attente', FAILED: 'Échoué', CANCELLED: 'Annulé', EXPIRED: 'Expiré',
            REFUND_PENDING: 'Remboursement en cours', REFUNDED: 'Remboursé', PARTIAL: 'Remboursé en partie',
        };
        const specs = Object.keys(labels).map((status, i) => ({ status, amount: 1_000 + i }));
        await insertPayments(a, specs);
        const r = await list(a);
        specs.forEach((spec, i) => {
            const item = items(r).find((p) => p.amount === 1_000 + i);
            assert.equal(item?.status_label, labels[spec.status], `statut ${spec.status}`);
        });
    });

    test('opérateurs : Wave, Orange Money ; absent : Mobile Money sur la plateforme, tiret hors plateforme', async () => {
        const a = await newBuyer('pay-op');
        await insertPayments(a, [
            { amount: 1, operator: 'WAVE' },
            { amount: 2, operator: 'ORANGE_MONEY' },
            { amount: 3, operator: null, platform: true, status: 'PENDING' },
            { amount: 4, operator: null, platform: false },
        ]);
        const byAmount = new Map(items(await list(a)).map((i) => [i.amount, i.operator_label]));
        assert.equal(byAmount.get(1), 'Wave');
        assert.equal(byAmount.get(2), 'Orange Money');
        assert.equal(byAmount.get(3), 'Mobile Money');
        assert.match(String(byAmount.get(4)), /^[—–-]$/, 'tiret hors plateforme');
    });

    test('cibles hors billetterie : libellé de la cible, sans titre d’événement', async () => {
        const a = await newBuyer('pay-cibles');
        const labels: Record<string, string> = {
            SUBSCRIPTION: 'Abonnement', ORDER: 'Commande', HALL_RESERVATION: 'Réservation de salle',
            TABLE_RESERVATION: 'Réservation de table', OTHER: 'Autre paiement',
        };
        const specs = Object.keys(labels).map((target, i) => ({ target, amount: 2_000 + i }));
        await insertPayments(a, specs);
        const r = await list(a);
        specs.forEach((spec, i) => {
            const item = items(r).find((p) => p.amount === 2_000 + i);
            assert.equal(item?.target_label, labels[spec.target], `cible ${spec.target}`);
            assert.equal(item?.event_title, null, `cible ${spec.target} : aucun événement`);
        });
    });

    test('billet : titre de l’événement ; événement supprimé (event_id NULL) : « Événement »', async () => {
        const a = await newBuyer('pay-billet');
        const partner = await newPartner('pay-billet-pro');
        const ev = await createPartnerEvent(partner.partnerId, 'mes-paiements', [{ name: 'Entrée', price: 1_000, total: 10 }]);
        const { data: row, error } = await service.from('events').select('title').eq('id', ev.eventId).single();
        assert.equal(error, null, `événement : ${error?.message}`);
        await insertPayments(a, [
            { target: 'TICKET', amount: 11, eventId: ev.eventId },
            { target: 'TICKET', amount: 22, eventId: null },
        ]);
        const byAmount = new Map(items(await list(a)).map((i) => [i.amount, i]));
        const titleOf = (i: Item | undefined): string | null | undefined => i?.event_title ?? i?.target_label;
        assert.equal(byAmount.get(11)?.event_title, row.title, 'titre de l’événement');
        assert.equal(titleOf(byAmount.get(22)), 'Événement', 'événement supprimé');
    });

    test('date du paiement et identifiant de lien présents', async () => {
        const a = await newBuyer('pay-lien');
        const at = minutesAgo(3);
        const id = await insertPayment(a, { createdAt: at });
        const [item] = items(await list(a));
        assert.equal(item.id, id, 'identifiant pour le lien vers /paiement/<id>');
        assert.equal(Date.parse(item.created_at), Date.parse(at));
    });
});

describe('GET /api/account/payments — panne', () => {
    test('RPC en panne : 500 PAYMENTS_UNAVAILABLE en français, journalisée, sans texte de la base', async () => {
        const a = await newBuyer('pay-panne');
        const handler = await route();
        const previousFetch = globalThis.fetch;
        const previousError = console.error;
        const logged: string[] = [];
        let hits = 0;
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
            const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (new URL(href).pathname !== '/rest/v1/rpc/client_payments_list') return previousFetch(input, init);
            hits += 1;
            return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01' }), { status: 500, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch;
        console.error = (...args: unknown[]): void => { logged.push(args.map(String).join(' ')); };
        let r: Reply;
        try {
            r = await reply(await handler(authed(PAYMENTS_PATH, 'GET', a)));
        } finally {
            globalThis.fetch = previousFetch;
            console.error = previousError;
        }
        assert.ok(hits >= 1, 'panne simulée non atteinte');
        assert.equal(r.status, 500, r.text);
        assert.equal(r.body.code, 'PAYMENTS_UNAVAILABLE', r.text);
        assert.equal(r.text.includes(SENTINEL), false, `texte de la base renvoyé : ${r.text}`);
        assert.equal(r.body.items, undefined, 'une panne n’est pas une liste vide');
        assert.ok(logged.length >= 1, 'panne journalisée');
    });
});

describe('Écrans (contrat 5.3, AR13)', () => {
    function read(rel: string): string {
        const abs = path.resolve(process.cwd(), rel);
        assert.ok(fs.existsSync(abs), `${rel} absent (contrat 5.3, fix(9.2e))`);
        return fs.readFileSync(abs, 'utf8');
    }

    test('/paiement/[id] : cas PARTIAL, badge Confirmé, puce « Remboursé en partie », plus de « Statut inconnu » pour lui', () => {
        const src = read('app/paiement/[id]/page.tsx');
        const block = /case 'PARTIAL':([\s\S]*?)(?=case '|default:)/.exec(src);
        assert.ok(block, 'case \'PARTIAL\' absent de describeStatus (D-cpt C7, AR13)');
        assert.match(block[1], /badge:\s*'Confirmé'/, block[1]);
        assert.match(block[1], /chip:\s*'Remboursé en partie'/, block[1]);
    });

    test('page Mes paiements : titre, route, lien vers le statut, totaux, pagination, aucun champ technique', () => {
        const src = read('app/profile/payments/page.tsx');
        assert.match(src, /Mes paiements/, 'titre figé pour l’e2e');
        assert.match(src, /\/api\/account\/payments/, 'la page lit la route');
        assert.match(src, /\/paiement\//, 'lien vers la page de statut');
        assert.match(src, /Total payé/);
        assert.match(src, /Total remboursé/);
        assert.match(src, /Pagination/, 'pagination côté serveur (composant commun)');
        for (const forbidden of ['external_transaction_id', 'callback_token_hash', 'idempotency_key', 'provider_response']) {
            assert.equal(src.includes(forbidden), false, `${forbidden} dans la page`);
        }
        assert.ok(fs.existsSync(path.resolve(process.cwd(), 'app/profile/payments/loading.tsx')), 'loading.tsx absent (contrat 5.3)');
    });

    test('/profile : lien vers Mes paiements', () => {
        assert.match(read('app/profile/page.tsx'), /\/profile\/payments/, 'raccourci Mes paiements absent');
    });
});
