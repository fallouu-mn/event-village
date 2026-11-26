/**
 * Lot 11c-a — tables d'un événement : appels en base des routes du serveur.
 *
 * Une table d'un événement est un lot de N billets vendu par le moteur des billets (paiement de cible TICKET) ; tout
 * montant, tout nombre de places et toute règle sont lus et calculés en base (migrations 20261201000001 à …06) : le
 * navigateur n'envoie que des identifiants (type, table), l'opérateur et le numéro du payeur. Chaque fonction appelée
 * vérifie elle-même le compte, la propriété, la fiche, l'événement et l'interrupteur features.event_tables_enabled ;
 * elles sont réservées au rôle de service, les aides internes sont dans le schéma private (hors de l'API).
 *
 * Les refus de la base arrivent en { ok: false, code, message } (message en mots simples, prêt à afficher) ;
 * refusalStatus() leur donne le statut HTTP de la route.
 */
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';
import { reserveQuota } from '@/lib/security/quota';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { cashinReturnUrls, initCashinOnce, initFailureOf, recordAdoptedInit } from '@/lib/payments/cashin-init';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { formatFcfa } from '@/lib/format';
import { hashCallbackToken, PAYER_PENDING_MESSAGE, paymentView, pendingPaymentRefusal, readHoldMinutes } from '@/lib/payments/checkout.service';

export interface DbReply { ok?: boolean; code?: string; message?: string; field?: string; [key: string]: unknown }

export interface RouteOutcome { status: number; body: Record<string, unknown> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value);
}

/** Statut HTTP d'un refus de la base (code stable, message affiché tel quel). */
export function refusalStatus(code: string | undefined): number {
    switch (code) {
        case 'SERVICE_UNAVAILABLE':
        case 'EVENT_NOT_FOUND':
        case 'TABLE_TYPE_NOT_FOUND':
        case 'TABLE_NOT_FOUND':
        case 'NOT_FOUND':
            return 404;
        case 'FORBIDDEN':
        case 'ADMIN_CANNOT_EDIT':
        case 'ACCOUNT_NOT_ACTIVE':
        case 'PARTNER_SUSPENDED':
            return 403;
        case 'INVALID_INPUT':
        case 'FIELD_NOT_EDITABLE':
        case 'INVALID_PLAN':
        case 'INVALID_NUMBER':
        case 'SALE_DATES_INVALID':
        case 'SALE_END_AFTER_EVENT':
        case 'SALE_START_AFTER_EVENT':
        case 'OPERATOR_REQUIRED':
        case 'PAYMENT_MODE_UNAVAILABLE':
        case 'TABLE_CHOICE_UNAVAILABLE':
            return 400;
        case 'PAYER_PENDING_LIMIT':
            return 409;
        default:
            return 409;
    }
}

export function refusalBody(reply: DbReply): Record<string, unknown> {
    return {
        success: false,
        error: reply.message ?? 'Action refusée.',
        code: reply.code ?? 'REFUSED',
        ...(reply.field ? { field: reply.field } : {}),
    };
}

/** Appel d'une fonction `(p jsonb)` du lot ; une erreur de la base lève (la route répond 500). */
export async function callTables(fn: string, p: Record<string, unknown>): Promise<DbReply> {
    const { data, error } = await rpcWithRetry<DbReply>(fn, { p });
    if (error) throw new Error(`${fn} : ${error.code ?? ''} ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error(`${fn} : réponse illisible`);
    return data;
}

/** Réponse d'une fonction : 200 (ou okStatus) si ok, sinon statut du refus. */
export function outcomeOf(reply: DbReply, okStatus = 200): RouteOutcome {
    if (reply.ok === true) return { status: okStatus, body: { success: true, ...reply } };
    return { status: refusalStatus(reply.code), body: refusalBody(reply) };
}

// ── Organisatrice : types, tables et plan ─────────────────────────────────────────────────────────────────────────

/** Corps d'un type de table (création ou modification) : clés connues seulement, valeurs contrôlées en base. */
export const TableTypeSchema = z.object({
    name: z.string().max(200).optional(),
    seats: z.number().int().optional(),
    price: z.number().optional(),
    included_text: z.string().max(1000).nullable().optional(),
    onsite_note: z.string().max(500).nullable().optional(),
    payment_mode: z.string().max(20).optional(),
    sale_start: z.string().max(40).nullable().optional(),
    sale_end: z.string().max(40).nullable().optional(),
    is_active: z.boolean().optional(),
    scan_color: z.string().max(20).nullable().optional(),
    entry_instruction: z.string().max(300).nullable().optional(),
}).strict();

export const TableTypeCreateSchema = z.object({ type: TableTypeSchema, count: z.number().int() }).strict();

/** Corps de l'enregistrement des tables et du plan : liste complète des tables, zones du plan, plan montré. */
export const TablesSaveSchema = z.object({
    plan_enabled: z.boolean(),
    tables: z.array(z.object({
        id: z.string().uuid().nullable().optional(),
        type_id: z.string().uuid(),
        number: z.number().int(),
        zone_id: z.string().uuid().nullable().optional(),
        x: z.number().nullable().optional(),
        y: z.number().nullable().optional(),
        shape: z.enum(['RONDE', 'CARREE', 'RECTANGLE']).optional(),
        rotation: z.number().int().optional(),
    }).strict()).max(500),
    zones: z.array(z.object({
        id: z.string().uuid(),
        x: z.number().nullable(),
        y: z.number().nullable(),
        w: z.number().nullable(),
        h: z.number().nullable(),
    }).strict()).max(50).default([]),
}).strict();

// ── Client : achat d'une table ───────────────────────────────────────────────────────────────────────────────────

const CheckoutSchema = z.object({
    typeId: z.string().uuid(),
    tableId: z.string().uuid().nullable().optional(),
    operator: z.string().optional(),
    payerPhone: z.string().optional(),
    /**
     * Contre-vérification du lot 11c-b (observation « prix changé ») : total du devis AFFICHÉ par l'écran. Il ne sert qu'à
     * une comparaison : le montant du paiement vient toujours de la base ; s'il diffère, l'achat est refusé et rien n'est
     * demandé au client. Facultatif (absent : aucune comparaison, comportement d'avant).
     */
    expectedTotal: z.number().nonnegative().max(100_000_000).optional(),
}).strict();

/** Refus « prix changé » : nouveau total, en mots simples, prêt à afficher. */
function priceChanged(total: number): RouteOutcome {
    return {
        status: 409,
        body: { success: false, error: `Le prix de cette table a changé : ${formatFcfa(total)}. Vérifiez avant de payer.`, code: 'TABLE_PRICE_CHANGED', total },
    };
}

function newIdentifiers() {
    const ms = Date.now();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return { transactionId: `TX-EV-${ms}-${suffix}`, externalOrderId: `ORD-EV-${ms}-${suffix}` };
}

async function existingPayment(clientId: string, key: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await getServiceRoleClient()
        .from('payments').select('*').eq('client_id', clientId).eq('client_idempotency_key', key).maybeSingle();
    if (error) throw new Error(`Lecture du paiement existant impossible : ${error.message}`);
    return data;
}

/**
 * Achat d'une table (POST /api/events/[id]/tables/checkout) : mêmes étapes que l'achat de billets (clé d'idempotence,
 * quota par compte, garde des places, paiement et attente en base tout ou rien, cashin SamirPay, libération sur échec),
 * avec la table précise tenue par checkout_create_payment → event_table_checkout. Le montant vient de la base.
 */
export async function startTableCheckout(params: { userId: string; eventId: string; body: unknown; idempotencyKey: string | null }): Promise<RouteOutcome> {
    const env = getServerEnv();
    const key = (params.idempotencyKey ?? '').trim();
    if (!IDEMPOTENCY_KEY.test(key)) {
        return { status: 400, body: { success: false, error: 'En-tête Idempotency-Key requis (8 à 128 caractères).', code: 'IDEMPOTENCY_KEY_REQUIRED' } };
    }
    if (!isUuid(params.eventId)) return { status: 404, body: { success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' } };
    const parsed = CheckoutSchema.safeParse(params.body);
    if (!parsed.success) return { status: 400, body: { success: false, error: 'Choix de table illisible : rechargez la page et réessayez.', code: 'INVALID_INPUT' } };
    const input = parsed.data;
    const replay = await existingPayment(params.userId, key);
    if (replay) return { status: 200, body: { success: true, ...paymentView(replay, { duplicate: true }) } };

    const quota = await reserveQuota([
        { scope: 'checkout_user', bucket: params.userId, windowSecs: 15 * 60, max: env.CHECKOUT_PER_USER_15MIN },
        { scope: 'checkout_user', bucket: params.userId, windowSecs: 24 * 3600, max: env.CHECKOUT_PER_USER_DAY },
    ], 'checkout');
    if (!quota.allowed) {
        return quota.reason === 'EXCEEDED'
            ? { status: 429, body: { success: false, error: 'Trop de tentatives d’achat : réessayez plus tard.', code: 'CHECKOUT_RATE_LIMITED', retryAfterSeconds: quota.retryAfterSeconds } }
            : { status: 503, body: { success: false, error: 'Achat momentanément indisponible.', code: 'CHECKOUT_GUARD_UNAVAILABLE' } };
    }
    const operator = input.operator as SamirPayOperatorName | undefined;
    if (!operator || !SAMIRPAY_OPERATORS.includes(operator)) {
        return { status: 400, body: { success: false, error: 'Choisissez Wave ou Orange Money.', code: 'OPERATOR_REQUIRED' } };
    }
    const payerPhone = normalizePayerPhone(input.payerPhone);
    if (!payerPhone) {
        return { status: 400, body: { success: false, error: 'Numéro du payeur invalide (mobile sénégalais, 9 chiffres).', code: 'INVALID_PAYER_PHONE' } };
    }
    let holdMinutes: number;
    try {
        holdMinutes = await readHoldMinutes();
    } catch (err) {
        console.error('[tables d’un événement] durée de garde illisible :', err instanceof Error ? err.message : String(err));
        return { status: 503, body: { success: false, error: 'Achat momentanément indisponible.', code: 'CHECKOUT_GUARD_UNAVAILABLE' } };
    }

    // Prix changé depuis le devis affiché : refus avant toute attente ni paiement (devis de la base, même opérateur)
    if (input.expectedTotal !== undefined) {
        const quote = await callTables('event_table_quote', { event_id: params.eventId, type_id: input.typeId, table_id: input.tableId ?? null, operator });
        if (quote.ok === true && Number(quote.total) !== input.expectedTotal) return priceChanged(Number(quote.total));
    }

    const supabase = getServiceRoleClient();
    const { data: event, error: evErr } = await supabase.from('events').select('id, title, partner_id').eq('id', params.eventId).maybeSingle();
    if (evErr) throw new Error(`Lecture de l'événement impossible : ${evErr.message}`);
    if (!event) return { status: 404, body: { success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' } };

    const ids = newIdentifiers();
    const token = randomBytes(32).toString('base64url');
    const created = await callTables('checkout_create_payment', {
        client_id: params.userId,
        event_id: params.eventId,
        partner_id: event.partner_id,
        table: { type_id: input.typeId, table_id: input.tableId ?? null },
        operator,
        payer_phone: payerPhone,
        callback_token_hash: hashCallbackToken(token),
        client_idempotency_key: key,
        transaction_id: ids.transactionId,
        external_order_id: ids.externalOrderId,
        hold_minutes: holdMinutes,
        metadata: { target_type: 'TICKET', event_id: params.eventId, hold_minutes: holdMinutes },
    });
    if (created.ok !== true) {
        if (created.duplicate === true) {
            const dup = await existingPayment(params.userId, key);
            if (dup) return { status: 200, body: { success: true, ...paymentView(dup, { duplicate: true }) } };
        }
        if (created.code === 'PAYMENT_PENDING' && typeof created.payment_id === 'string') {
            return { status: 409, body: { success: false, ...pendingPaymentRefusal(created.payment_id) } };
        }
        if (created.code === 'PAYER_PENDING_LIMIT') return { status: 409, body: { success: false, error: PAYER_PENDING_MESSAGE, code: 'PAYER_PENDING_LIMIT' } };
        if (!created.code) throw new Error(`Achat de table refusé sans motif : ${JSON.stringify(created).slice(0, 300)}`);
        return { status: refusalStatus(created.code), body: refusalBody(created) };
    }
    const paymentId = String(created.payment_id);
    const amount = Number(created.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Montant du paiement ${paymentId} invalide : ${String(created.amount)}`);
    // Prix changé entre la comparaison ci-dessus et la création (course) : paiement annulé avant toute demande à l'opérateur,
    // table rendue ; le client voit le nouveau total et n'a rien payé
    if (input.expectedTotal !== undefined && amount !== input.expectedTotal) {
        const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: 'PRICE_CHANGED' });
        if (relErr) throw new Error(`libération du paiement ${paymentId} (prix changé) : ${relErr.message}`);
        invalidatePublicEvent(params.eventId, 'table rendue (prix changé)');
        await signalTablesChanged(params.eventId, 'table rendue (prix changé)');
        return priceChanged(amount);
    }
    // La table attendue se grise sur le plan des autres visiteurs (stock du type : signal temps réel existant)
    invalidatePublicEvent(params.eventId, 'table en attente de paiement');
    await signalTablesChanged(params.eventId, 'table en attente de paiement');

    const callBackUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`;
    try {
        const outcome = await initCashinOnce({
            amount,
            orderId: ids.externalOrderId,
            callBackUrl,
            operatorName: operator,
            telephone: payerPhone,
            description: `Table ${String(event.title ?? '')}`.slice(0, 100),
            ...cashinReturnUrls(env.NEXT_PUBLIC_APP_URL, paymentId),
        });
        if (outcome.kind === 'ADOPTED') {
            await recordAdoptedInit(paymentId, outcome.transactionId);
            return { status: 502, body: { success: false, error: 'Le service de paiement ne répond pas : réessayez.', code: 'PAYMENT_PROVIDER_UNCERTAIN', payment_id: paymentId } };
        }
        const init = outcome.init;
        const { data: updated, error: updErr } = await supabase
            .from('payments')
            .update({ external_transaction_id: init.transactionId, provider_response: { paymentUrl: init.paymentUrl, deepLinks: init.deepLinks, qrCode: init.qrCode }, provider_status: 'INIT_ACCEPTED' })
            .eq('id', paymentId)
            .eq('status', 'PENDING')
            .select('*')
            .single();
        if (updErr || !updated) throw new Error(`Enregistrement de l'identifiant SamirPay impossible : ${updErr?.message ?? 'paiement introuvable'}`);
        return { status: 200, body: { success: true, ...paymentView(updated), table: created.table, expires_at: created.expires_at } };
    } catch (err) {
        const failure = initFailureOf(err);
        const reason = failure?.reason ?? 'INIT_INTERNAL';
        const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: paymentId, p_status: 'FAILED', p_reason: reason });
        if (relErr) console.error(`[tables d’un événement] libération de l'attente du paiement ${paymentId} impossible :`, relErr.message);
        invalidatePublicEvent(params.eventId, 'table rendue');
        await signalTablesChanged(params.eventId, 'table rendue');
        console.error(`[tables d’un événement] cashin refusé pour le paiement ${paymentId} (${reason}) :`, err instanceof Error ? err.message : String(err));
        if (!failure) throw err;
        return { status: 502, body: { success: false, error: failure.message, code: failure.code, payment_id: paymentId } };
    }
}

// ── Signal « une table a changé » ────────────────────────────────────────────────────────────────────────────────

/**
 * Contre-vérification du lot 11c-b (T1) : l'onglet « Tables » ouvert relit l'offre au message temps réel des tranches
 * publiques de l'événement (public_category_stock, filtre event_id, déjà ouvert à tous). Un type de table n'a pas de
 * tranche (il n'est jamais vendu en ligne comme billet) : une table tenue ou rendue ne produisait aucun message. Ce signal
 * réécrit seulement l'heure (updated_at) des tranches DÉJÀ publiques de l'événement : aucune ligne, aucune valeur, aucun
 * stock nouveau (les règles des billets ne changent pas), aucune donnée d'un client. Un événement sans tranche publique
 * (aucune catégorie de billets en ligne) n'a pas de message : l'onglet relit alors l'offre toutes les 15 s tant que le plan
 * est ouvert et visible. Un échec est journalisé et ne défait rien (la table est tenue ou rendue en base).
 */
export async function signalTablesChanged(eventId: string, why: string): Promise<void> {
    const { error } = await getServiceRoleClient()
        .from('public_category_stock')
        .update({ updated_at: new Date().toISOString() })
        .eq('event_id', eventId);
    if (error) console.error(`[tables d’un événement] signal temps réel non envoyé (${why}) :`, error.message);
}

// ── Partage d'une table ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lien de partage WhatsApp d'une table : texte prêt à envoyer avec l'adresse publique de l'événement, sans aucun jeton
 * (la place elle-même passe par le transfert du billet, au numéro de l'invité).
 */
export function whatsappShareUrl(appUrl: string, item: { table_number?: unknown; event?: { id?: unknown; title?: unknown } }): string | null {
    const eventId = item.event?.id;
    if (!isUuid(eventId)) return null;
    const title = String(item.event?.title ?? '').slice(0, 80);
    const link = `${appUrl.replace(/\/+$/, '')}/events/${eventId}`;
    const message = `Je t’invite à ma table ${String(item.table_number ?? '')} pour « ${title} » sur Event Village. Ta place t’arrive sur ton numéro : ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

