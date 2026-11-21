/**
 * Lot 10b, généralisé au lot 11b — pages des services (salles de fête et tables) dans les phases « captures »
 * (e2e/captures.spec.ts) et « responsive » (e2e/responsive.spec.ts) : interrupteurs SUPERADMIN features.halls_enabled ET
 * features.tables_enabled ouverts le temps de leurs tests, puis remis à leur valeur d'origine. Les layouts app/halls,
 * app/partner/halls, app/tables/(catalogue), app/partner/tables/edition et app/restaurants/[id]/tables répondent 404 tant
 * que l'interrupteur de leur service est fermé (fermés par défaut).
 * Lot 11b : ancien e2e/support/halls-switch.ts (HallsLock, groupe « salles »), renommé ; un seul groupe « services » ouvre
 * les deux interrupteurs à la fois (captures cohérentes : menus, « Commandes » et accueil identiques sur toutes les pages
 * des deux services) ; mêmes garanties qu'avant, dossier du verrou .e2e-captures/verrou-services/.
 *
 * Pourquoi un verrou entre les workers : les deux phases tournent en parallèle (fullyParallel ; 2 workers en CI pour les
 * captures, projets mobile et desktop ensemble ; 3 pour le contrôle responsive) et les interrupteurs sont globaux. Ouverts,
 * ils changent aussi les autres pages (entrées « Salles de fête », « Restaurants et tables », « Tables » et « Commandes » des
 * menus, section des salles de l'accueil) et cassent les écrans qui attendent leur fermeture (page-masquee-salles : /halls en
 * 404 ; page-masquee-commandes : /orders en 404, ouvert dès qu'un des trois services l'est ; admin-services-desactive :
 * « Service désactivé »). Ils ne peuvent donc pas rester ouverts pour toute la phase, et un bloc « serial » de Playwright
 * n'arrête pas les tests des autres workers.
 *
 * Verrou de fichier entre les workers de la phase (.e2e-captures/verrou-services/<phase>/) à deux groupes :
 *  - « services » : les tests des pages des salles et des tables (interrupteurs ouverts) ; « autres » : tous les autres
 *    tests de la phase (interrupteurs à leur valeur d'origine) ;
 *  - plusieurs tests d'un même groupe tournent ensemble, jamais deux groupes à la fois ;
 *  - file d'attente dans l'ordre d'arrivée : un test entre si aucun test de l'autre groupe ne tourne ni ne le précède dans la
 *    file (aucune famine : dès qu'un groupe attend, l'autre groupe n'admet plus de nouveaux tests) ;
 *  - le premier test « services » qui entre lit la valeur d'origine de chaque interrupteur et ouvre ceux qui sont fermés
 *    (valeurs d'origine notées une à une dans l'état, avant chaque ouverture) ; le dernier qui sort remet chacun à sa
 *    valeur d'origine (finance_setting_set par le SUPERADMIN du seed de test, comme la recette : historique et motif) ;
 *  - libération dans la fixture `servicesLock` (e2e/support/fixtures.ts), jouée aussi après un dépassement du délai du
 *    test ; l'attente du verrou est ajoutée au délai du test (plafond : 20 min, puis échec explicite) ;
 *  - entrée d'un processus disparu (worker arrêté) retirée par les autres, et les interrupteurs remis si c'était le dernier
 *    test « services » ; un worker ne joue qu'un test à la fois : ses entrées d'un test précédent sont retirées à l'entrée
 *    suivante ;
 *  - reprise : des valeurs d'origine encore notées sans aucun test « services » en cours (ouverture interrompue par une
 *    erreur de la base, remise en échec) sont remises par le prochain test qui entre ou qui sort, avant toute admission.
 *
 * Accueil : « / » est régénéré au plus toutes les 60 s et lit l'interrupteur des salles sous unstable_cache
 * (app/_accueil/data.server.ts). Un préchargement de « / » pendant que les interrupteurs sont ouverts (lien « Accueil » des
 * menus) garderait la section des salles et son lien vers /halls (404 une fois refermé) dans l'accueil des tests suivants :
 * keepHomeOutOfServicesWindow répond 204 aux préchargements de « / » des pages des services, sans toucher à la page
 * contrôlée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { FIXTURE_USERS } from '../../tests/helpers/fixture-data';
import { E2E_OUTPUT_DIR } from './demo-ids';
import { APP_URL } from './env';
import { serviceClient, userIdByEmail } from './service';

/** Interrupteurs ouverts ensemble pour le groupe « services » (ordre d'ouverture et de remise). */
export const SERVICES_SWITCH_KEYS = ['features.halls_enabled', 'features.tables_enabled'] as const;
export type ServicesSwitchKey = typeof SERVICES_SWITCH_KEYS[number];

/** « services » : page des salles ou des tables, interrupteurs ouverts ; « autres » : tout autre test, valeurs d'origine. */
export type ServicesGroup = 'services' | 'autres';

type Originals = Partial<Record<ServicesSwitchKey, boolean>>;

interface LockEntry { id: string; pid: number; group: ServicesGroup; title: string; since: number }
interface LockState { holders: LockEntry[]; queue: LockEntry[]; original: Originals | null }

const POLL_MS = 250;
const MUTEX_STALE_MS = 60_000;
const MAX_WAIT_MS = 20 * 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

function lockDir(): string {
    const phase = (process.env.E2E_PHASE || 'complet').replace(/[^a-z0-9-]/gi, '');
    return path.join(E2E_OUTPUT_DIR, 'verrou-services', phase);
}

function readOriginals(value: unknown): Originals | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const out: Originals = {};
    for (const key of SERVICES_SWITCH_KEYS) {
        const v = (value as Record<string, unknown>)[key];
        if (typeof v === 'boolean') out[key] = v;
    }
    return out;
}

function readState(file: string): LockState {
    if (!fs.existsSync(file)) return { holders: [], queue: [], original: null };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LockState>;
    return {
        holders: Array.isArray(parsed.holders) ? parsed.holders : [],
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        original: readOriginals(parsed.original),
    };
}

function writeState(file: string, state: LockState): void {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 1)}\n`, 'utf8');
    fs.renameSync(tmp, file);
}

/** Section critique entre les processus : répertoire créé de façon atomique (mkdir), état relu et réécrit à chaque fois. */
async function withMutex<T>(fn: (state: LockState) => Promise<T>): Promise<T> {
    const dir = lockDir();
    fs.mkdirSync(dir, { recursive: true });
    const mutex = path.join(dir, 'mutex');
    const file = path.join(dir, 'etat.json');
    const started = Date.now();
    for (;;) {
        try {
            fs.mkdirSync(mutex);
            break;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        }
        let age = 0;
        try {
            age = Date.now() - fs.statSync(mutex).mtimeMs;
        } catch (err) {
            // Rendu entre-temps par son détenteur : nouvel essai tout de suite
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
            throw err;
        }
        if (age > MUTEX_STALE_MS) {
            console.warn(`[e2e] verrou des services : section critique tenue depuis ${Math.round(age / 1000)} s (processus arrêté ?), reprise`);
            fs.rmSync(mutex, { recursive: true, force: true });
            continue;
        }
        if (Date.now() - started > MAX_WAIT_MS) throw new Error(`[e2e] verrou des services : section critique ${mutex} jamais libérée en ${MAX_WAIT_MS / 60_000} min`);
        await sleep(10 + Math.floor(Math.random() * 30));
    }
    try {
        const state = readState(file);
        try {
            return await fn(state);
        } finally {
            // État toujours réécrit (même après une erreur de la base : une entrée retirée ne doit jamais revenir, une
            // valeur d'origine notée avant l'erreur reste à remettre)
            writeState(file, state);
        }
    } finally {
        fs.rmSync(mutex, { recursive: true, force: true });
    }
}

function alive(pid: number): boolean {
    if (pid === process.pid) return true;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

// ── Interrupteurs (base locale, clé de service de .env.e2e) ─────────────────

let superadminId: string | null = null;

async function readSwitch(key: ServicesSwitchKey): Promise<boolean> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error(`[e2e] lecture de ${key} : ${error.message}`);
    return (data?.value as { value?: unknown } | null | undefined)?.value === true;
}

async function writeSwitch(key: ServicesSwitchKey, value: boolean, reason: string): Promise<void> {
    superadminId ??= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    const { data, error } = await serviceClient().rpc('finance_setting_set', {
        p_key: key, p_value: { value }, p_actor: superadminId, p_reason: reason,
    });
    if (error) throw new Error(`[e2e] finance_setting_set ${key} = ${String(value)} : ${error.code ?? ''} ${error.message}`);
    if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[e2e] finance_setting_set ${key} = ${String(value)} refusé : ${JSON.stringify(data)}`);
}

/**
 * Premier test « services » : valeur d'origine de chaque interrupteur notée AVANT son ouverture (une erreur au milieu
 * laisse dans l'état ce qui a déjà été ouvert, remis par la reprise de `settle`).
 */
async function openSwitches(state: LockState): Promise<void> {
    const original: Originals = {};
    state.original = original;
    for (const key of SERVICES_SWITCH_KEYS) {
        const value = await readSwitch(key);
        original[key] = value;
        if (!value) await writeSwitch(key, true, 'Pages des salles de fête et des tables contrôlées par l’e2e : interrupteurs ouverts le temps de leurs tests.');
    }
}

/**
 * Dernier test « services » sorti : chaque interrupteur remis à sa valeur d'origine (rien à écrire s'il était ouvert) ;
 * une valeur n'est oubliée qu'une fois remise (une erreur de la base laisse les suivantes à remettre).
 */
async function restoreSwitches(state: LockState): Promise<void> {
    const original = state.original ?? {};
    for (const key of SERVICES_SWITCH_KEYS) {
        if (original[key] === false) {
            await writeSwitch(key, false, 'Remise en état après les pages des salles de fête et des tables de l’e2e (interrupteur fermé, sa valeur d’origine).');
        }
        delete original[key];
    }
    state.original = null;
}

/** Valeurs d'origine encore notées alors qu'aucun test « services » ne tourne : remises avant toute admission. */
async function settle(state: LockState): Promise<void> {
    if (state.original && !state.holders.some((e) => e.group === 'services')) await restoreSwitches(state);
}

/** Entrées des processus disparus retirées ; celles d'un test précédent du même worker aussi (un test à la fois par worker). */
function purge(state: LockState, me: LockEntry): void {
    const stale = (e: LockEntry) => (e.pid === process.pid ? e.id !== me.id : !alive(e.pid));
    const gone = [...state.holders, ...state.queue].filter(stale);
    if (gone.length === 0) return;
    console.warn(`[e2e] verrou des services : entrées abandonnées retirées (${gone.map((e) => `${e.group} « ${e.title} », processus ${e.pid}`).join(' ; ')})`);
    state.holders = state.holders.filter((e) => !stale(e));
    state.queue = state.queue.filter((e) => !stale(e));
}

/**
 * Verrou d'un test (fixture `servicesLock`) : `enter` au début du test, `leave` à la fin (fixture, même après un
 * dépassement du délai). Un test « services » trouve les deux interrupteurs ouverts pendant tout son déroulement ; un test
 * « autres » les trouve à leur valeur d'origine.
 */
export class ServicesLock {
    private entry: LockEntry | null = null;
    /** Attente du verrou du test (ms), pour les notes de l'index. */
    waitedMs = 0;

    constructor(private readonly testInfo: TestInfo) {}

    async enter(group: ServicesGroup): Promise<void> {
        if (this.entry) throw new Error('[e2e] verrou des services : déjà pris par ce test');
        const me: LockEntry = { id: randomUUID(), pid: process.pid, group, title: this.testInfo.title.slice(0, 120), since: Date.now() };
        this.entry = me;
        const started = Date.now();
        let last = started;
        for (;;) {
            const entered = await withMutex(async (state) => {
                purge(state, me);
                // Dernier test « services » disparu, ou ouverture et remise interrompues : interrupteurs remis d'abord
                await settle(state);
                if (!state.queue.some((e) => e.id === me.id)) state.queue.push(me);
                const position = state.queue.findIndex((e) => e.id === me.id);
                if (state.holders.some((e) => e.group !== group)) return false;
                if (state.queue.slice(0, position).some((e) => e.group !== group)) return false;
                if (group === 'services' && !state.holders.some((e) => e.group === 'services')) await openSwitches(state);
                state.queue.splice(position, 1);
                state.holders.push(me);
                return true;
            });
            if (entered) break;
            const now = Date.now();
            // Attente ajoutée au délai du test : le temps passé derrière l'autre groupe ne compte pas contre lui
            if (this.testInfo.timeout > 0) this.testInfo.setTimeout(this.testInfo.timeout + (now - last));
            last = now;
            if (now - started > MAX_WAIT_MS) {
                throw new Error(`[e2e] verrou des services : test du groupe « ${group} » en attente depuis plus de ${MAX_WAIT_MS / 60_000} min (${lockDir()}/etat.json)`);
            }
            await sleep(POLL_MS);
        }
        this.waitedMs = Date.now() - started;
    }

    async leave(): Promise<void> {
        const me = this.entry;
        if (!me) return;
        this.entry = null;
        await withMutex(async (state) => {
            state.queue = state.queue.filter((e) => e.id !== me.id);
            state.holders = state.holders.filter((e) => e.id !== me.id);
            // Dernier test « services » sorti (ou ouverture interrompue par une erreur) : valeurs d'origine remises
            await settle(state);
        });
    }
}

/**
 * Page des services : préchargements de l'accueil (« / ») servis par une réponse vide (204), jamais par le serveur, pendant
 * que les interrupteurs sont ouverts (voir l'en-tête). Le routeur Next traite une réponse qui n'est pas un flux RSC comme
 * une navigation complète à faire plus tard : aucune erreur, aucun effet sur la page contrôlée. Une navigation vers « / »
 * (document) passe normalement.
 */
export async function keepHomeOutOfServicesWindow(page: Page): Promise<void> {
    const appHost = new URL(APP_URL).host;
    await page.route((url) => url.host === appHost && url.pathname === '/', async (route) => {
        if (route.request().resourceType() === 'document') {
            await route.fallback();
            return;
        }
        await route.fulfill({ status: 204, body: '' });
    });
}
