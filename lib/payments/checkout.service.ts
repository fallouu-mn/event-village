/**
 * Lot 2 — démarrage d'un achat de billets (checkout), seul chemin d'initiation d'un paiement de
 * billetterie (/api/checkout et /api/payments/create pour un billet).
 *
 * Ordre, sans débit tant qu'un contrôle échoue :
 *  1. clé d'idempotence fournie par le client (en-tête Idempotency-Key) obligatoire ; une double
 *     soumission renvoie le paiement déjà créé ;
 *  2. quota de checkout par compte (compteurs en base, fail-closed) ;
 *  3. contrôles partagés ticket_sale_problems (catégorie active et vendue en ligne, événement PUBLIE et non
 *     passé, fenêtre de vente, max_per_order, stock moins réservations) → 400 / 409 explicites ;
 *  4. panier entièrement gratuit : billets émis tout de suite (free_tickets_claim) ;
 *     sinon opérateur (Wave ou Orange Money) et téléphone payeur (9 chiffres) obligatoires ;
 *  5. checkout_create_payment : paiement PENDING + réservations de TOUT le panier, tout ou rien ;
 *  6. cashin direct SamirPay (callBackUrl portant un jeton propre au paiement) ; tout échec libère
 *     les réservations (payment_release).
 * Lot 3 : les montants sont calculés en base par le moteur financier unique (checkout_create_payment
 * appelle finance_compute : prix lus sous verrou, frais de service par billet à la charge de
 * l'acheteur) ; SamirPay reçoit exactement le total enregistré sur le paiement.
 */
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { initCashinOnce, initFailureOf, recordAdoptedInit } from './cashin-init';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';
import { readFinanceSetting } from '@/lib/finance/engine';
import { reserveQuota } from '@/lib/security/quota';
import { normalizePayerPhone } from './payer-phone';
import { rpcWithRetry } from './rpc';

/** Plafond absolu d'une ligne de panier, aligné sur la borne de max_per_order (CHECK 1..50). */
export const MAX_PER_ORDER_CAP = 50;

const CheckoutBodySchema = z.object({
    eventId: z.string().uuid(),
    items: z.array(z.object({
        categoryId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_PER_ORDER_CAP),
    })).min(1).max(20),
    operator: z.string().optional(),
    payerPhone: z.string().optional(),
});

export interface CheckoutOutcome {
    status: number;
    body: Record<string, unknown>;
}

interface SaleProblem { category_id: string | null; code: string; message: string }

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

function problemsOutcome(problems: SaleProblem[]): CheckoutOutcome {
    const onlyStock = problems.every((p) => p.code === 'INSUFFICIENT_STOCK');
    return onlyStock
        ? { status: 409, body: { error: problems[0]?.message ?? 'Stock insuffisant.', code: 'INSUFFICIENT_STOCK', problems } }
        : { status: 400, body: { error: problems.map((p) => p.message).join(' '), code: 'SALE_CHECK_FAILED', problems } };
}

function newIdentifiers() {
    const ms = Date.now();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return { transactionId: `TX-EV-${ms}-${suffix}`, externalOrderId: `ORD-EV-${ms}-${suffix}` };
}

export function hashCallbackToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function statusPageUrl(paymentId: string): string {
    return `/paiement/${paymentId}`;
}

/** Réponse renvoyée à l'interface pour un paiement existant (création ou double soumission). */
export function paymentView(p: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const provider = (p.provider_response ?? {}) as { paymentUrl?: string | null; deepLinks?: { wave?: string | null; orange?: string | null }; qrCode?: string | null };
    const operator = p.operator as SamirPayOperatorName | null;
    return {
        payment_id: p.id,
        status: p.status,
        amount: Number(p.amount),
        facial_amount: p.facial_amount === null || p.facial_amount === undefined ? null : Number(p.facial_amount),
        service_fee: Number(p.service_fee ?? 0),
        currency: p.currency ?? 'XOF',
        operator,
        expires_at: p.held_expires_at ?? null,
        payment_url: provider.paymentUrl ?? null,
        deep_link: operator === 'ORANGE_MONEY' ? provider.deepLinks?.orange ?? null : operator === 'WAVE' ? provider.deepLinks?.wave ?? null : null,
        qr_code: provider.qrCode ?? null,
        status_page_url: statusPageUrl(String(p.id)),
        ...extra,
    };
}

/**
 * Lot 9 bis (H2) : validité d'un paiement chez SamirPay (v1.2 : une heure après sa création, puis FAILED). La page
 * d'attente suit le paiement jusqu'à cette échéance, au-delà de la garde des places.
 */
export const PAYMENT_VALIDITY_MINUTES = 60;

/** Lot 9 bis (H2, B103) : durée de garde des places, réglage SUPERADMIN finance.payment_hold_minutes (5 à 60). */
export async function readHoldMinutes(): Promise<number> {
    const value = Number(await readFinanceSetting<number>('finance.payment_hold_minutes'));
    if (!Number.isInteger(value) || value < 5 || value > PAYMENT_VALIDITY_MINUTES) {
        throw new Error(`Réglage finance.payment_hold_minutes hors bornes : ${String(value)}`);
    }
    return value;
}

/**
 * Lot 9 bis (H2) : minutes de garde d'un paiement de billets, telles qu'appliquées à sa création (metadata.hold_minutes
 * depuis le lot 9 bis, sinon écart entre la fin de garde et la création) ; null si inconnues.
 */
export function holdMinutesOf(p: { created_at?: unknown; held_expires_at?: unknown; metadata?: unknown }): number | null {
    const recorded = Number((p.metadata as { hold_minutes?: unknown } | null)?.hold_minutes);
    if (Number.isInteger(recorded) && recorded > 0) return recorded;
    const created = Date.parse(String(p.created_at ?? ''));
    const held = Date.parse(String(p.held_expires_at ?? ''));
    if (!Number.isFinite(created) || !Number.isFinite(held) || held <= created) return null;
    return Math.round((held - created) / 60_000);
}

/** Lot 9 bis (H2) : échéance de validité du paiement chez SamirPay (création + 60 minutes), ou null. */
export function paymentDeadlineOf(p: { created_at?: unknown }): string | null {
    const created = Date.parse(String(p.created_at ?? ''));
    return Number.isFinite(created) ? new Date(created + PAYMENT_VALIDITY_MINUTES * 60_000).toISOString() : null;
}

export const PAYMENT_PENDING_MESSAGE = 'Un paiement est déjà en attente pour cet événement.';

/** Lot 7 (D4, contrat 3.5) : corps du refus 409 d'un second paiement en attente. */
export function pendingPaymentRefusal(paymentId: string): Record<string, unknown> {
    return { error: PAYMENT_PENDING_MESSAGE, code: 'PAYMENT_PENDING', payment_id: paymentId, status_page_url: statusPageUrl(paymentId) };
}

export interface PendingTicketPayment {
    payment_id: string;
    amount: number;
    operator: string | null;
    expires_at: string;
    status_page_url: string;
}

/**
 * Lot 7 (contrat 3.5, GET /api/checkout/pending) : paiement de billets PENDING non échu du compte pour cet
 * événement (même règle que la garde de checkout_create_payment), ou null. Erreur de lecture levée.
 */
export async function findPendingTicketPayment(clientId: string, eventId: string): Promise<PendingTicketPayment | null> {
    const { data, error } = await getServiceRoleClient()
        .from('payments')
        .select('id, amount, operator, held_expires_at')
        .eq('client_id', clientId)
        .eq('event_id', eventId)
        .eq('payment_target', 'TICKET')
        .eq('status', 'PENDING')
        .gt('held_expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Lecture du paiement en attente impossible : ${error.message}`);
    if (!data) return null;
    return {
        payment_id: String(data.id),
        amount: Number(data.amount),
        operator: (data.operator as string | null) ?? null,
        expires_at: String(data.held_expires_at),
        status_page_url: statusPageUrl(String(data.id)),
    };
}

async function existingPayment(clientId: string, key: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await getServiceRoleClient()
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .eq('client_idempotency_key', key)
        .maybeSingle();
    if (error) throw new Error(`Lecture du paiement existant impossible : ${error.message}`);
    return data;
}

export async function startTicketCheckout(params: {
    userId: string;
    body: unknown;
    idempotencyKey: string | null;
}): Promise<CheckoutOutcome> {
    const supabase = getServiceRoleClient();
    const env = getServerEnv();

    // 1. Clé d'idempotence
    const key = (params.idempotencyKey ?? '').trim();
    if (!IDEMPOTENCY_KEY.test(key)) {
        return { status: 400, body: { error: 'En-tête Idempotency-Key requis (8 à 128 caractères).', code: 'IDEMPOTENCY_KEY_REQUIRED' } };
    }
    const parsed = CheckoutBodySchema.safeParse(params.body);
    if (!parsed.success) {
        return { status: 400, body: { error: 'Panier invalide.', code: 'INVALID_CHECKOUT', details: parsed.error.flatten().fieldErrors } };
    }
    const input = parsed.data;
    const replay = await existingPayment(params.userId, key);
    if (replay) return { status: 200, body: paymentView(replay, { duplicate: true }) };

    // 2. Quota par compte
    const quota = await reserveQuota([
        { scope: 'checkout_user', bucket: params.userId, windowSecs: 15 * 60, max: env.CHECKOUT_PER_USER_15MIN },
        { scope: 'checkout_user', bucket: params.userId, windowSecs: 24 * 3600, max: env.CHECKOUT_PER_USER_DAY },
    ], 'checkout');
    if (!quota.allowed) {
        return quota.reason === 'EXCEEDED'
            ? { status: 429, body: { error: 'Trop de tentatives d’achat : réessayez plus tard.', code: 'CHECKOUT_RATE_LIMITED', retryAfterSeconds: quota.retryAfterSeconds } }
            : { status: 503, body: { error: 'Achat momentanément indisponible.', code: 'CHECKOUT_GUARD_UNAVAILABLE' } };
    }

    // 3. Contrôles partagés (avant tout débit)
    const items = input.items.map((i) => ({ category_id: i.categoryId, quantity: i.quantity }));
    const { data: problems, error: checkErr } = await rpcWithRetry<SaleProblem[]>('ticket_sale_problems', { p_event_id: input.eventId, p_items: items });
    if (checkErr) throw new Error(`Contrôle de vente impossible : ${checkErr.message}`);
    if (problems && problems.length > 0) return problemsOutcome(problems);

    const { data: event, error: evErr } = await supabase.from('events').select('id, title, partner_id').eq('id', input.eventId).single();
    if (evErr || !event) throw new Error(`Lecture de l'événement impossible : ${evErr?.message ?? 'introuvable'}`);
    const { data: cats, error: catErr } = await supabase.from('ticket_categories').select('id, price').in('id', items.map((i) => i.category_id));
    if (catErr || !cats) throw new Error(`Lecture des catégories impossible : ${catErr?.message}`);
    const priceOf = new Map(cats.map((c) => [c.id as string, Number(c.price)]));
    const priced = items.map((i) => ({ ...i, unit_price: priceOf.get(i.category_id) ?? 0 }));
    const payable = priced.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    // 4. Panier entièrement gratuit
    if (payable === 0) {
        const { data: free, error: freeErr } = await rpcWithRetry<{ ok: boolean; code?: string; message?: string; problems?: SaleProblem[]; ticket_ids?: string[] }>('free_tickets_claim', { p_user_id: params.userId, p_event_id: input.eventId, p_items: items });
        if (freeErr || !free) throw new Error(`Émission des billets gratuits impossible : ${freeErr?.message}`);
        if (!free.ok) {
            if (free.problems?.length) return problemsOutcome(free.problems);
            return { status: 409, body: { error: free.message ?? 'Billets gratuits refusés.', code: free.code } };
        }
        // Lot 6 (J1.2, J1.5) : confirmation et épuisement mis en file par free_tickets_claim et ses triggers.
        return { status: 200, body: { free: true, status: 'SUCCESS', ticket_ids: free.ticket_ids ?? [] } };
    }

    const operator = input.operator as SamirPayOperatorName | undefined;
    if (!operator || !SAMIRPAY_OPERATORS.includes(operator)) {
        return { status: 400, body: { error: 'Choisissez Wave ou Orange Money.', code: 'OPERATOR_REQUIRED' } };
    }
    const payerPhone = normalizePayerPhone(input.payerPhone);
    if (!payerPhone) {
        return { status: 400, body: { error: 'Numéro du payeur invalide (mobile sénégalais, 9 chiffres).', code: 'INVALID_PAYER_PHONE' } };
    }

    // 5. Paiement + réservations, tout ou rien. Lot 9 bis (H2, B103) : durée de garde des places lue au réglage
    //    SUPERADMIN finance.payment_hold_minutes (entier de 5 à 60), en échec fermé : sans réglage lisible, aucun achat.
    let holdMinutes: number;
    try {
        holdMinutes = await readHoldMinutes();
    } catch (err) {
        console.error('[checkout] durée de garde des places illisible :', err instanceof Error ? err.message : String(err));
        return { status: 503, body: { error: 'Achat momentanément indisponible.', code: 'CHECKOUT_GUARD_UNAVAILABLE' } };
    }
    const ids = newIdentifiers();
    const token = randomBytes(32).toString('base64url');
    const { data: created, error: createErr } = await rpcWithRetry<{ ok: boolean; duplicate?: boolean; code?: string; payment_id?: string; problems?: SaleProblem[]; expires_at?: string; amount?: number }>('checkout_create_payment', {
        p: {
            client_id: params.userId,
            event_id: input.eventId,
            partner_id: event.partner_id,
            items: priced,
            operator,
            payer_phone: payerPhone,
            callback_token_hash: hashCallbackToken(token),
            client_idempotency_key: key,
            transaction_id: ids.transactionId,
            external_order_id: ids.externalOrderId,
            hold_minutes: holdMinutes,
            metadata: { target_type: 'TICKET', event_id: input.eventId, checkout_items: priced, hold_minutes: holdMinutes },
        },
    });
    if (createErr) {
        // Dernier filet : la contrainte sold + held <= total (concurrence extrême)
        if (createErr.code === '23514') return { status: 409, body: { error: 'Plus assez de places disponibles.', code: 'INSUFFICIENT_STOCK' } };
        throw new Error(`Création du paiement impossible : ${createErr.message}`);
    }
    if (!created?.ok) {
        if (created?.duplicate && created.payment_id) {
            const dup = await existingPayment(params.userId, key);
            if (dup) return { status: 200, body: paymentView(dup, { duplicate: true }) };
        }
        // Lot 7 (D4, M6) : un paiement de billets est déjà en attente pour ce compte et cet événement ; rien
        // n'est créé ni réservé, SamirPay n'est pas appelé, l'interface conduit vers le suivi du premier.
        if (created?.code === 'PAYMENT_PENDING' && created.payment_id) {
            return { status: 409, body: pendingPaymentRefusal(created.payment_id) };
        }
        if (!created?.problems?.length) {
            throw new Error(`Création du paiement refusée sans motif exploitable : ${JSON.stringify(created).slice(0, 300)}`);
        }
        return problemsOutcome(created.problems);
    }
    const paymentId = created.payment_id!;
    const amount = Number(created.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Montant du paiement ${paymentId} invalide : ${created.amount}`);

    // 6. Cashin direct SamirPay
    const callBackUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`;
    try {
        // Lot 9 bis (H4) : une seule relance au même orderId sur un délai dépassé ; 409 porteur de l'identifiant →
        // transaction adoptée, paiement rendu et surveillé, aucun lien pour le client.
        const outcome = await initCashinOnce({
            amount,
            orderId: ids.externalOrderId,
            callBackUrl,
            operatorName: operator,
            telephone: payerPhone,
            description: `Billets ${String(event.title ?? '')}`.slice(0, 100),
        });
        if (outcome.kind === 'ADOPTED') {
            await recordAdoptedInit(paymentId, outcome.transactionId);
            return { status: 502, body: { error: 'Le service de paiement ne répond pas : réessayez.', code: 'PAYMENT_PROVIDER_UNCERTAIN', payment_id: paymentId } };
        }
        const init = outcome.init;
        const providerResponse = { paymentUrl: init.paymentUrl, deepLinks: init.deepLinks, qrCode: init.qrCode };
        const { data: updated, error: updErr } = await supabase
            .from('payments')
            .update({ external_transaction_id: init.transactionId, provider_response: providerResponse, provider_status: 'INIT_ACCEPTED' })
            .eq('id', paymentId)
            .eq('status', 'PENDING')
            .select('*')
            .single();
        if (updErr || !updated) throw new Error(`Enregistrement de l'identifiant SamirPay impossible : ${updErr?.message ?? 'paiement introuvable'}`);
        return { status: 200, body: paymentView(updated) };
    } catch (err) {
        // Lot 9 bis (H8) : un 5xx de SamirPay donne PAYMENT_PROVIDER_INTERNAL ; seul un refus explicite est définitif.
        const failure = initFailureOf(err);
        const reason = failure?.reason ?? 'INIT_INTERNAL';
        const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: paymentId, p_status: 'FAILED', p_reason: reason });
        if (relErr) console.error(`[checkout] libération des réservations du paiement ${paymentId} impossible :`, relErr.message);
        console.error(`[checkout] cashin refusé pour le paiement ${paymentId} (${reason}) :`, err instanceof Error ? err.message : String(err));
        if (!failure) throw err;
        return { status: 502, body: { error: failure.message, code: failure.code, payment_id: paymentId } };
    }
}
