/**
 * Lot 5 — outils des tests temps réel (contrat O4), factorisés à partir du schéma du lot 4
 * (tests/parcours/acces-pilotage.test.ts, tests/parcours/realtime-scanner.test.ts) : vrais comptes,
 * connexion Realtime de l'instance LOCALE, abonnement postgres_changes, collecte des messages reçus,
 * attente d'un message attendu et preuve de non-réception.
 *
 * Règles d'usage :
 *  - l'état SUBSCRIBED peut précéder l'activation de l'abonnement côté serveur : produceUntilReceived
 *    répète une action reproductible (par exemple toucher updated_at d'une ligne visible) jusqu'à la
 *    première réception, comme au lot 4 ;
 *  - une preuve de non-réception (expectNothing) n'a de valeur qu'avec un témoin : un abonné autorisé
 *    qui reçoit, dans le même test, le changement que l'intrus ne doit pas recevoir. Realtime délivre
 *    dans l'ordre du journal : une sentinelle reçue par le témoin après le changement, puis un court
 *    délai, suffisent ;
 *  - expectNothing exige un abonnement établi : un refus d'abonnement (table hors publication,
 *    CHANNEL_ERROR) se lit dans `outcome`, jamais comme une absence de message ;
 *  - chaque test ferme ses abonnements et ses clients dans un finally (close, disposeClients).
 *
 * Ce module n'importe aucun client service_role : il est utilisable par tests/security (clé anon et
 * signInWithPassword seulement). Les comptes du seed viennent de fixture-data.ts (données pures
 * réexportées par fixtures.ts, mot de passe TEST_PASSWORD) ; les comptes créés par newBuyer et
 * newPartner (tests/parcours) se connectent avec STRONG_PASSWORD.
 */
import './env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
    createClient,
    type REALTIME_SUBSCRIBE_STATES,
    type RealtimeChannel,
    type RealtimePostgresChangesFilter,
    type RealtimePostgresChangesPayload,
    type RealtimeRemoveChannelResponse,
    type SupabaseClient,
} from '@supabase/supabase-js';
import { FIXTURE_USERS, TEST_PASSWORD, type FixtureUserKey } from './fixture-data';
import { STRONG_PASSWORD } from '../parcours/helpers';

/** Délai d'abonnement, d'attente d'un message et pas de scrutation (valeurs du lot 4). */
export const SUBSCRIBE_TIMEOUT_MS = 20_000;
export const RECEIVE_TIMEOUT_MS = 20_000;
const POLL_MS = 100;

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Clients ────────────────────────────────────────────────────────────────

function newClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

/** Client non authentifié (clé anon seule). */
export function anonClient(): SupabaseClient {
    return newClient();
}

/** Identifiants d'un compte créé par un test ; sans mot de passe : STRONG_PASSWORD (newBuyer, newPartner). */
export interface Credentials {
    email: string;
    password?: string;
}

/**
 * Client connecté par signInWithPassword : compte du seed (clé de FIXTURE_USERS, mot de passe
 * TEST_PASSWORD) ou compte créé par le test (Buyer, TestPartner ou { email, password }).
 * La session est transmise à Realtime par supabase-js au moment de l'abonnement.
 */
export async function signedInClient(who: FixtureUserKey | Credentials): Promise<SupabaseClient> {
    const email = typeof who === 'string' ? FIXTURE_USERS[who].email : who.email;
    const password = typeof who === 'string' ? TEST_PASSWORD : (who.password ?? STRONG_PASSWORD);
    const client = newClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert.equal(error, null, `connexion de ${email} : ${error?.message}`);
    assert.ok(data.session, `connexion de ${email} : session absente`);
    return client;
}

/** Ferme tous les canaux des clients puis leur connexion Realtime ; renvoie l'état de chaque fermeture de canal. */
export async function disposeClients(...clients: SupabaseClient[]): Promise<RealtimeRemoveChannelResponse[]> {
    const results: RealtimeRemoveChannelResponse[] = [];
    for (const client of clients) {
        results.push(...await client.removeAllChannels());
        await client.realtime.disconnect();
    }
    return results;
}

// ── Abonnement et collecte ─────────────────────────────────────────────────

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeTarget {
    table: string;
    /** Filtre postgres_changes, par exemple `event_id=eq.${eventId}` ; sans filtre : toute la table. */
    filter?: string;
    /** Type de changement écouté (défaut : '*'). */
    event?: ChangeEvent;
    /** Schéma (défaut : public). */
    schema?: string;
}

export interface ReceivedChange {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    /** Ligne après le changement (vide pour un DELETE). */
    new: Record<string, unknown>;
    /** Ligne avant le changement (clé primaire seulement, sauf REPLICA IDENTITY FULL). */
    old: Record<string, unknown>;
    commitTimestamp: string;
    receivedAt: number;
}

export interface SubscribeOutcome {
    status: `${REALTIME_SUBSCRIBE_STATES}`;
    /** Raison donnée par le serveur ou le client, null si l'abonnement est établi. */
    error: string | null;
}

export interface Collector {
    readonly label: string;
    readonly target: RealtimeTarget;
    /** Messages reçus, dans l'ordre d'arrivée. */
    readonly events: ReceivedChange[];
    /** États successifs du canal (SUBSCRIBED, CHANNEL_ERROR : raison, CLOSED…). */
    readonly states: string[];
    /** Premier état décisif de l'abonnement ; ne rejette jamais (pour les tests de refus d'abonnement). */
    readonly outcome: Promise<SubscribeOutcome>;
    /** Résolue à SUBSCRIBED ; rejetée avec la raison sinon. */
    readonly ready: Promise<void>;
    /** Vide la liste des messages reçus (avant l'action dont on veut observer l'effet). */
    clear(): void;
    /** Ferme le canal ; renvoie l'état de la fermeture ('ok', 'timed out' ou 'error'). */
    close(): Promise<RealtimeRemoveChannelResponse>;
}

function describeTarget(target: RealtimeTarget): string {
    return `${target.schema ?? 'public'}.${target.table}${target.filter ? ` [${target.filter}]` : ''} (${target.event ?? '*'})`;
}

/**
 * Abonne le client aux changements de la table et collecte les messages reçus. Le canal est ouvert
 * aussitôt ; attendre `ready` (ou lire `outcome`) avant de déclencher le changement observé.
 */
export function subscribeCollect(client: SupabaseClient, target: RealtimeTarget, opts: { label?: string; timeoutMs?: number } = {}): Collector {
    const label = opts.label ?? describeTarget(target);
    const timeoutMs = opts.timeoutMs ?? SUBSCRIBE_TIMEOUT_MS;
    const events: ReceivedChange[] = [];
    const states: string[] = [];
    const filter: RealtimePostgresChangesFilter<ChangeEvent> = {
        event: target.event ?? '*',
        schema: target.schema ?? 'public',
        table: target.table,
    };
    if (target.filter) filter.filter = target.filter;

    const channel: RealtimeChannel = client
        .channel(`ev-test-${target.table}-${randomBytes(4).toString('hex')}`)
        .on('postgres_changes', filter, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            events.push({
                eventType: payload.eventType,
                table: payload.table,
                new: payload.new as Record<string, unknown>,
                old: payload.old as Record<string, unknown>,
                commitTimestamp: payload.commit_timestamp,
                receivedAt: Date.now(),
            });
        });

    const outcome = new Promise<SubscribeOutcome>((resolve) => {
        let settled = false;
        const settle = (o: SubscribeOutcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(o);
        };
        const timer = setTimeout(() => settle({ status: 'TIMED_OUT', error: `abonnement non confirmé en ${timeoutMs} ms` }), timeoutMs);
        channel.subscribe((status, err) => {
            states.push(err ? `${status} : ${err.message}` : status);
            settle({ status, error: status === 'SUBSCRIBED' ? null : (err?.message ?? `état ${status}`) });
        });
    });

    return {
        label,
        target,
        events,
        states,
        outcome,
        // Promesse créée à la lecture : un test qui ne lit que `outcome` ne laisse aucun rejet non traité.
        get ready(): Promise<void> {
            return outcome.then((o) => {
                if (o.status !== 'SUBSCRIBED') throw new Error(`abonnement Realtime ${label} : ${o.status} ${o.error ?? ''}`.trim());
            });
        },
        clear() {
            events.length = 0;
        },
        close() {
            return client.removeChannel(channel);
        },
    };
}

/**
 * Messages reçus, pour un message d'échec : type, table, instant de validation en base (commit_timestamp),
 * instant de réception et retard de diffusion (lot 7, runs 83 à 87 : distinguer un retard d'une perte).
 */
function summarize(events: ReceivedChange[]): string {
    return events.slice(0, 10).map((e) => {
        const commit = Date.parse(e.commitTimestamp);
        const lag = Number.isFinite(commit) ? ` retard=${e.receivedAt - commit} ms` : '';
        return `  ${e.eventType} ${e.table} commit=${e.commitTimestamp} reçu=${new Date(e.receivedAt).toISOString()}${lag} ${JSON.stringify(e.new)}`;
    }).join('\n');
}

/** États successifs du canal et heure de l'échec, pour un message d'échec (rejointe ou erreur du canal). */
function channelTrace(collector: Collector): string {
    return `états du canal : ${collector.states.join(' → ') || 'aucun'} ; échec à ${new Date().toISOString()}`;
}

/** Attend un message qui satisfait le prédicat et le renvoie ; échoue après timeoutMs avec les messages reçus. */
export async function waitForEvent(
    collector: Collector,
    predicate: (e: ReceivedChange) => boolean,
    timeoutMs: number = RECEIVE_TIMEOUT_MS,
    what = `message attendu sur ${collector.label}`,
): Promise<ReceivedChange> {
    await collector.ready;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const hit = collector.events.find(predicate);
        if (hit) return hit;
        if (Date.now() >= deadline) {
            throw new Error(`délai dépassé (${timeoutMs} ms) : ${what} — ${collector.events.length} message(s) reçu(s) sur ${collector.label} (${channelTrace(collector)})\n${summarize(collector.events)}`);
        }
        await sleep(POLL_MS);
    }
}

/** Comme waitForEvent, puis renvoie tous les messages reçus qui satisfont le prédicat. */
export async function expectSome(
    collector: Collector,
    predicate: (e: ReceivedChange) => boolean,
    timeoutMs: number = RECEIVE_TIMEOUT_MS,
    what?: string,
): Promise<ReceivedChange[]> {
    await waitForEvent(collector, predicate, timeoutMs, what);
    return collector.events.filter(predicate);
}

/**
 * Preuve de non-réception : abonnement établi, puis aucun message (satisfaisant le prédicat) pendant ms.
 * À combiner avec un témoin autorisé qui a reçu le même changement (voir l'en-tête).
 */
export async function expectNothing(
    collector: Collector,
    ms: number,
    predicate: (e: ReceivedChange) => boolean = () => true,
    what = `aucun message attendu sur ${collector.label}`,
): Promise<void> {
    await collector.ready;
    await sleep(ms);
    const leaked = collector.events.filter(predicate);
    assert.deepEqual(leaked, [], `${what} : ${leaked.length} message(s) reçu(s)\n${summarize(leaked)}`);
}

/**
 * Répète `produce` (action reproductible) jusqu'à la réception d'un message qui satisfait le prédicat,
 * et le renvoie : vivacité de l'abonnement avant le vrai test (schéma du lot 4).
 */
export async function produceUntilReceived(
    collector: Collector,
    produce: () => Promise<unknown>,
    predicate: (e: ReceivedChange) => boolean = () => true,
    opts: { timeoutMs?: number; intervalMs?: number; what?: string } = {},
): Promise<ReceivedChange> {
    await collector.ready;
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const intervalMs = opts.intervalMs ?? 1_500;
    const what = opts.what ?? `réception sur ${collector.label}`;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
        await produce();
        attempts += 1;
        const stepEnd = Math.min(Date.now() + intervalMs, deadline);
        while (Date.now() < stepEnd) {
            const hit = collector.events.find(predicate);
            if (hit) return hit;
            await sleep(POLL_MS);
        }
    }
    const hit = collector.events.find(predicate);
    if (hit) return hit;
    throw new Error(`délai dépassé (${timeoutMs} ms, ${attempts} action(s)) : ${what} — ${collector.events.length} message(s) reçu(s) (${channelTrace(collector)})\n${summarize(collector.events)}`);
}
