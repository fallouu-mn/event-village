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
import { execFileSync } from 'node:child_process';
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
import { gotrueEmail } from './gotrue-email';
import { stepUpTestSession } from './admin-step-up';

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
 * Lot 9 quinquies, correctifs de la contre-vérification (point 1 ; aide modifiée, signalée au rapport) : la session vaut
 * une session dont le titulaire a passé le code administrateur (stepUpTestSession, comme signInAs), sauf `stepUp: false`
 * (compte admin qui n'a PAS passé le code) ; sans effet pour un compte qui n'est pas admin.
 */
export async function signedInClient(who: FixtureUserKey | Credentials, opts: { liftBan?: boolean; stepUp?: boolean } = {}): Promise<SupabaseClient> {
    const email = typeof who === 'string' ? FIXTURE_USERS[who].email : who.email;
    const password = typeof who === 'string' ? TEST_PASSWORD : (who.password ?? STRONG_PASSWORD);
    const client = newClient();
    let { data, error } = await client.auth.signInWithPassword({ email: await gotrueEmail(email), password });
    if (error && opts.liftBan && /banned/i.test(error.message)) {
        // Lot 9 quater (A6 : AUD-06) : GoTrue refuse maintenant toute connexion d'un compte suspendu (constaté ici). Pour
        // éprouver la RLS du temps réel avec un jeton encore valable (session ouverte avant la suspension), le blocage
        // est levé le temps de la connexion puis reposé ; users.status reste SUSPENDU. Modification signalée au rapport.
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: found, error: findErr } = await admin.from('users').select('id').eq('email', email).single();
        assert.equal(findErr, null, `compte de ${email} : ${findErr?.message}`);
        const { error: liftErr } = await admin.auth.admin.updateUserById(String(found.id), { ban_duration: 'none' });
        assert.equal(liftErr, null, `déblocage temporaire de ${email} : ${liftErr?.message}`);
        try {
            ({ data, error } = await client.auth.signInWithPassword({ email: await gotrueEmail(email), password }));
        } finally {
            const { error: banErr } = await admin.auth.admin.updateUserById(String(found.id), { ban_duration: '876000h' });
            assert.equal(banErr, null, `blocage reposé de ${email} : ${banErr?.message}`);
        }
    }
    assert.equal(error, null, `connexion de ${email} : ${error?.message}`);
    assert.ok(data.session, `connexion de ${email} : session absente`);
    if (opts.stepUp !== false) await stepUpTestSession(data.session.access_token);
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
                if (o.status !== 'SUBSCRIBED') throw new Error(`abonnement Realtime ${label} : ${o.status}${o.error ? ` ${o.error}` : ''} (${channelTrace({ states })})`);
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

/**
 * Statut du conteneur realtime de l'instance locale, pour un message d'échec (lot 8, contrat 7.3, L48) :
 * distinguer un conteneur tombé ou redémarré d'un message perdu. Appel bloquant de 3 s au plus, fait
 * seulement à l'échec. Docker absent, en échec ou muet : la ligne le dit, jamais d'exception, pour ne pas
 * remplacer l'échec d'origine.
 */
export function realtimeDiagnostics(): string {
    try {
        const status = execFileSync(
            'docker',
            ['inspect', '-f', '{{.State.Status}} démarré={{.State.StartedAt}} redémarrages={{.RestartCount}}', 'supabase_realtime_event-village'],
            { timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ).trim();
        return `conteneur realtime : ${status || 'indisponible (sortie vide)'}`;
    } catch (err) {
        const failure = err as Error & { stderr?: string };
        const reason = failure.stderr?.trim() || failure.message || String(err);
        return `conteneur realtime : indisponible (${reason.replace(/\s+/g, ' ')})`;
    }
}

/** États successifs du canal, heure de l'échec et statut du conteneur, pour un message d'échec (rejointe ou erreur du canal). */
function channelTrace(collector: Pick<Collector, 'states'>): string {
    return `états du canal : ${collector.states.join(' → ') || 'aucun'} ; échec à ${new Date().toISOString()} ; ${realtimeDiagnostics()}`;
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
