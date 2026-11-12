/**
 * Lot 6 (contrat P3, tâche 6.12) — client service_role du processus Playwright, pour la fumée prolongée
 * seulement : création du second événement par les RPC (event_create, event_transition), lecture de la
 * boîte d'envoi. Aucun écran ne l'utilise.
 *
 * Garde-fous : `.env.e2e` chargé par e2eConfig(), qui refuse toute URL non locale ; l'URL Supabase est
 * revérifiée ici (même règle que scripts/e2e/env.mjs:requireLocalUrl) ; la clé vient de `.env.e2e`
 * (secret aléatoire du run en CI), jamais du code.
 */
import { randomInt } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEST_PASSWORD } from '../../tests/helpers/fixture-data';
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

/**
 * Lot 9 bis (R87, contrat 7.1 acte 2, T10) : identifiant du compte (public.users) d'un numéro, au format +221… ou 221….
 * Un compte inscrit à l'écran porte l'adresse technique dans users.email : l'adresse saisie attend sa vérification
 * (users.email_pending), la lecture se fait donc par le numéro, unique.
 */
export async function userIdByPhone(phone: string): Promise<string> {
    const digits = phone.replace(/^\+/, '');
    const { data, error } = await serviceClient().from('users').select('id').in('phone', [`+${digits}`, digits]);
    if (error) throw new Error(`[e2e] compte du numéro ${phone} : ${error.message}`);
    if ((data ?? []).length !== 1) throw new Error(`[e2e] compte du numéro ${phone} : ${(data ?? []).length} compte(s) au lieu d'un`);
    return String(data![0].id);
}

/**
 * Lot 9 bis (R57, B35) : saisies récentes du mot de passe d'un compte effacées (table password_confirmations, base
 * LOCALE) : l'action sensible qui suit demande le mot de passe quelle que soit l'heure de la connexion du rôle
 * (la connexion par mot de passe compte comme une saisie pendant 10 minutes). Préparation, jamais une route.
 */
export async function clearPasswordConfirmations(userId: string): Promise<void> {
    const { error } = await serviceClient().from('password_confirmations').delete().eq('user_id', userId);
    if (error) throw new Error(`[e2e] saisies récentes du mot de passe de ${userId} : ${error.message}`);
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
    /** maxPerOrder : limite par compte (défaut 10 ; contrainte 1 à 50). */
    category?: PublishedCategoryInput;
    /** Lot 9 ter (D.3.3, amendement 4 de D) : plusieurs catégories, prioritaires sur `category`. */
    categories?: PublishedCategoryInput[];
}

export interface PublishedCategoryInput { name: string; price: number; total: number; maxPerOrder?: number }

/** Événement créé par event_create au nom du partenaire, soumis, validé par le SUPERADMIN puis publié. */
export async function createPublishedEvent(input: PublishedEventInput): Promise<string> {
    const categories = input.categories ?? (input.category ? [input.category] : []);
    if (categories.length === 0) throw new Error(`[e2e] createPublishedEvent « ${input.title} » : aucune catégorie`);
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
        ticket_categories: categories.map((c) => ({ name: c.name, price: c.price, total_quantity: c.total, max_per_order: c.maxPerOrder ?? 10 })),
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

/**
 * Lot 9 ter (D.3.3) : affiche déjà déposée par la partenaire d'un compte (chemin admis par event_poster_path_ok), la plus
 * ancienne de ses événements ; même règle que scripts/e2e/terrain-setup.ts.
 */
export async function partnerPosterOf(partnerUserId: string): Promise<string> {
    const { data: partner, error: partnerErr } = await serviceClient().from('partners').select('id').eq('user_id', partnerUserId).maybeSingle();
    if (partnerErr) throw new Error(`[e2e] partenaire du compte ${partnerUserId} : ${partnerErr.message}`);
    if (!partner?.id) throw new Error(`[e2e] aucun partenaire pour le compte ${partnerUserId} (seed:test non abouti ?)`);
    const { data, error } = await serviceClient().from('events').select('image_url')
        .eq('partner_id', String(partner.id)).not('image_url', 'is', null)
        .order('created_at', { ascending: true }).limit(1);
    if (error) throw new Error(`[e2e] affiche du partenaire ${String(partner.id)} : ${error.message}`);
    const url = String(data?.[0]?.image_url ?? '');
    if (!url) throw new Error(`[e2e] aucun événement du partenaire ${String(partner.id)} n'a d'affiche (seed:test non abouti ?)`);
    return url;
}

/** Affiche (image_url) d'un événement : réutilisée pour le second événement du même partenaire. */
export async function eventImageUrl(eventId: string): Promise<string> {
    const { data, error } = await serviceClient().from('events').select('image_url').eq('id', eventId).maybeSingle();
    if (error) throw new Error(`[e2e] affiche de ${eventId} : ${error.message}`);
    const url = String(data?.image_url ?? '');
    if (!url) throw new Error(`[e2e] événement ${eventId} sans affiche`);
    return url;
}

// ── Lot 7 (D81, fumée prolongée) : identification des SMS du faux MTarget par la boîte d'envoi ─────────────

/** Ligne de notification_outbox jointe à un SMS du faux MTarget (provider_message_id = ticket du faux MTarget). */
export interface SentSmsLine {
    id: string;
    idempotency_key: string;
    type: string;
    status: string;
    event_id: string | null;
    recipient_user_id: string | null;
    recipient_phone: string | null;
    provider_message_id: string;
}

/** Lignes de la boîte d'envoi dont provider_message_id est l'un des tickets donnés (par paquets de 50). */
export async function outboxByProviderIds(ids: readonly string[]): Promise<SentSmsLine[]> {
    const out: SentSmsLine[] = [];
    for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { data, error } = await serviceClient().from('notification_outbox')
            .select('id, idempotency_key, type, status, event_id, recipient_user_id, recipient_phone, provider_message_id')
            .eq('channel', 'SMS').in('provider_message_id', chunk);
        if (error) throw new Error(`[e2e] lecture de notification_outbox par provider_message_id : ${error.message}`);
        out.push(...((data ?? []) as SentSmsLine[]));
    }
    return out;
}

/** Événements des lignes SMS encore PENDING d'un destinataire (compte ou numéro), hors lignes sans événement. */
export async function pendingSmsEventsOf(userId: string, phone: string): Promise<string[]> {
    const events = new Set<string>();
    for (const [column, value] of [['recipient_user_id', userId], ['recipient_phone', phone]] as const) {
        const { data, error } = await serviceClient().from('notification_outbox').select('event_id')
            .eq('channel', 'SMS').eq('status', 'PENDING').eq(column, value).not('event_id', 'is', null);
        if (error) throw new Error(`[e2e] lignes SMS en attente (${column}) : ${error.message}`);
        for (const r of data ?? []) events.add(String(r.event_id));
    }
    return Array.from(events).sort();
}

/** Numéro de chaque billet (tickets.ticket_number), dans l'ordre des identifiants donnés. */
export async function ticketNumbers(ticketIds: readonly string[]): Promise<string[]> {
    const { data, error } = await serviceClient().from('tickets').select('id, ticket_number').in('id', [...ticketIds]);
    if (error) throw new Error(`[e2e] numéros des billets : ${error.message}`);
    const byId = new Map((data ?? []).map((r) => [String(r.id), String(r.ticket_number)]));
    return ticketIds.map((id) => {
        const n = byId.get(id);
        if (!n) throw new Error(`[e2e] billet ${id} introuvable`);
        return n;
    });
}

// ── Lot 9 ter (D.3.3, amendement 4 de D) : comptes de l'acte 10 de la recette ──────────────────────────────

/** Préfixes mobiles admis par la validation des numéros (`^\+2217[05678]\d{7}$`). */
export type MobilePrefix = '70' | '75' | '76' | '77' | '78';

/** Numéro mobile (+221…) qu'aucun compte ne porte encore (forme +221… ou 221…), tiré au hasard ; cinq essais au plus. */
export async function unusedPhone(prefix: MobilePrefix): Promise<string> {
    for (let i = 0; i < 5; i++) {
        const phone = `+221${prefix}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
        const { data, error } = await serviceClient().from('users').select('id').in('phone', [phone, phone.slice(1)]);
        if (error) throw new Error(`[e2e] numéro libre (${prefix}) : ${error.message}`);
        if ((data ?? []).length === 0) return phone;
    }
    throw new Error(`[e2e] aucun numéro libre trouvé en 5 essais (préfixe ${prefix})`);
}

export interface ControllerAccount { userId: string; email: string; phone: string; local: string; firstName: string; lastName: string }

/**
 * Compte contrôleur établi (rôles CLIENT et CONTROLEUR, ACTIF, numéro vérifié, mot de passe de test), sans aucune affectation
 * ni lien avec une partenaire : c'est l'organisatrice qui l'invite à l'écran, et lui qui accepte (0.5, x5 ; jamais d'insertion
 * dans event_controllers ni dans partner_controllers). Préparation de données de la base LOCALE, jamais une route.
 */
export async function createControllerAccount(label: string): Promise<ControllerAccount> {
    if (!/^[a-z0-9-]{1,40}$/.test(label)) throw new Error(`[e2e] createControllerAccount : libellé attendu en minuscules et tirets, reçu « ${label} »`);
    const phone = await unusedPhone('76');
    const local = phone.replace(/^\+221/, '');
    const firstName = 'Ndiaga';
    const lastName = 'Diagne';
    const email = `k2.${label}.${local}@recette.eventvillage.local`;
    const admin = serviceClient();
    const { data, error } = await admin.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true, phone, phone_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, phone },
    });
    if (error || !data.user) throw new Error(`[e2e] compte contrôleur ${label} : ${error?.message ?? 'utilisateur absent'}`);
    const userId = data.user.id;
    const now = new Date().toISOString();
    const { error: profileErr } = await admin.from('users').upsert({
        id: userId, first_name: firstName, last_name: lastName, phone, email, role: 'CONTROLEUR', status: 'ACTIF',
        referral_status: 'STANDARD', phone_verified_at: now, updated_at: now,
    }, { onConflict: 'id' });
    if (profileErr) throw new Error(`[e2e] profil du contrôleur ${label} : ${profileErr.message}`);
    const { error: rolesErr } = await admin.from('user_roles').upsert(
        ['CLIENT', 'CONTROLEUR'].map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role' });
    if (rolesErr) throw new Error(`[e2e] rôles du contrôleur ${label} : ${rolesErr.message}`);
    return { userId, email, phone, local, firstName, lastName };
}
