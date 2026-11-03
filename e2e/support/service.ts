/**
 * Lot 6 (contrat P3, tâche 6.12) — client service_role du processus Playwright, pour la fumée prolongée
 * seulement : création du second événement par les RPC (event_create, event_transition), lecture de la
 * boîte d'envoi. Aucun écran ne l'utilise.
 *
 * Garde-fous : `.env.e2e` chargé par e2eConfig(), qui refuse toute URL non locale ; l'URL Supabase est
 * revérifiée ici (même règle que scripts/e2e/env.mjs:requireLocalUrl) ; la clé vient de `.env.e2e`
 * (secret aléatoire du run en CI), jamais du code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { e2eConfig, LOCAL_HOSTNAMES } from './env';

let client: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
    if (client) return client;
    const config = e2eConfig();
    const url = new URL(config.supabaseUrl);
    if (!LOCAL_HOSTNAMES.has(url.hostname)) {
        throw new Error(`[e2e] Refus : client service_role vers un hôte non local (${url.hostname}).`);
    }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error(`[e2e] SUPABASE_SERVICE_ROLE_KEY absente de ${config.envFile} : la fumée prolongée lit la boîte d'envoi par le service_role.`);
    client = createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return client;
}

/** RPC `(p jsonb)` attendue `{ ok: true, … }` ; sinon erreur explicite (code et message de la base). */
export async function rpcOk(fn: string, p: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await serviceClient().rpc(fn, { p });
    if (error) throw new Error(`[e2e] ${fn} : ${error.code ?? ''} ${error.message}`);
    const body = (data ?? null) as Record<string, unknown> | null;
    if (!body || body.ok !== true) throw new Error(`[e2e] ${fn} refusée : ${JSON.stringify(data)}`);
    return body;
}

/** Identifiant du compte (public.users) d'une adresse du seed de test. */
export async function userIdByEmail(email: string): Promise<string> {
    const { data, error } = await serviceClient().from('users').select('id').eq('email', email).maybeSingle();
    if (error) throw new Error(`[e2e] compte ${email} : ${error.message}`);
    if (!data?.id) throw new Error(`[e2e] compte ${email} introuvable (seed:test non abouti ?)`);
    return String(data.id);
}

export interface PublishedEventInput {
    partnerUserId: string;
    superadminId: string;
    title: string;
    description: string;
    /** Jour et heure de Dakar (AAAA-MM-JJ, HH:MM:SS). */
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    city: string;
    capacity: number;
    /** Affiche déjà déposée par le partenaire (chemin vérifié par event_poster_path_ok). */
    imageUrl: string;
    category: { name: string; price: number; total: number };
}

/** Événement créé par event_create au nom du partenaire, soumis, validé par le SUPERADMIN puis publié. */
export async function createPublishedEvent(input: PublishedEventInput): Promise<string> {
    const created = await rpcOk('event_create', {
        actor_id: input.partnerUserId,
        event: {
            title: input.title,
            category: 'CONCERT',
            description: input.description,
            start_date: input.startDate,
            start_time: input.startTime,
            end_date: input.endDate,
            end_time: input.endTime,
            location: input.location,
            city: input.city,
            capacity: input.capacity,
            image_url: input.imageUrl,
        },
        ticket_categories: [{ name: input.category.name, price: input.category.price, total_quantity: input.category.total, max_per_order: 10 }],
    });
    const eventId = String(created.event_id ?? '');
    if (!/^[0-9a-f-]{36}$/.test(eventId)) throw new Error(`[e2e] event_create : identifiant absent (${JSON.stringify(created)})`);
    await rpcOk('event_transition', { event_id: eventId, actor_id: input.partnerUserId, to_status: 'EN_ATTENTE' });
    await rpcOk('event_transition', { event_id: eventId, actor_id: input.superadminId, to_status: 'VALIDE' });
    await rpcOk('event_transition', { event_id: eventId, actor_id: input.partnerUserId, to_status: 'PUBLIE' });
    return eventId;
}

/** Ligne de notification_outbox lue par la fumée (colonnes du contrat C2). */
export interface OutboxLine {
    id: string;
    idempotency_key: string;
    type: string;
    channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
    status: string;
    reason: string | null;
    recipient_user_id: string | null;
    recipient_phone: string | null;
    event_id: string | null;
    template_data: Record<string, unknown> | null;
    attempts: number;
    due_at: string;
}

/** Lignes de la boîte d'envoi d'un événement (types donnés), triées par type, canal puis id. */
export async function outboxOfEvent(eventId: string, types: string[]): Promise<OutboxLine[]> {
    const { data, error } = await serviceClient().from('notification_outbox')
        .select('id, idempotency_key, type, channel, status, reason, recipient_user_id, recipient_phone, event_id, template_data, attempts, due_at')
        .eq('event_id', eventId).in('type', types)
        .order('type').order('channel').order('id');
    if (error) throw new Error(`[e2e] lecture de notification_outbox (${eventId}) : ${error.message}`);
    return (data ?? []) as OutboxLine[];
}

/** Lignes de la boîte d'envoi d'un événement encore SENDING (aucune attendue après l'envoyeur). */
export async function sendingOfEvent(eventId: string): Promise<OutboxLine[]> {
    const { data, error } = await serviceClient().from('notification_outbox')
        .select('id, idempotency_key, type, channel, status, reason, recipient_user_id, recipient_phone, event_id, template_data, attempts, due_at')
        .eq('event_id', eventId).eq('status', 'SENDING');
    if (error) throw new Error(`[e2e] lecture des lignes SENDING (${eventId}) : ${error.message}`);
    return (data ?? []) as OutboxLine[];
}

/** Affiche (image_url) d'un événement : réutilisée pour le second événement du même partenaire. */
export async function eventImageUrl(eventId: string): Promise<string> {
    const { data, error } = await serviceClient().from('events').select('image_url').eq('id', eventId).maybeSingle();
    if (error) throw new Error(`[e2e] affiche de ${eventId} : ${error.message}`);
    const url = String(data?.image_url ?? '');
    if (!url) throw new Error(`[e2e] événement ${eventId} sans affiche`);
    return url;
}
