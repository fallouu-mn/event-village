/**
 * Lot 10b — pages des salles de fête dans les phases « captures » (e2e/captures.spec.ts) et « responsive »
 * (e2e/responsive.spec.ts) : interrupteur SUPERADMIN features.halls_enabled ouvert le temps de leurs tests, puis remis à
 * sa valeur d'origine. Les layouts app/halls et app/partner/halls répondent 404 tant qu'il est fermé (fermé par défaut).
 *
 * Pourquoi un verrou entre les workers : les deux phases tournent en parallèle (fullyParallel ; 2 workers en CI pour les
 * captures, projets mobile et desktop ensemble ; 3 pour le contrôle responsive) et l'interrupteur est global. Ouvert, il
 * change aussi les autres pages (entrées « Salles de fête » et « Commandes » des menus, section des salles de l'accueil) et
 * casse les écrans qui attendent sa fermeture (page-masquee-salles : /halls en 404 ; page-masquee-commandes : /orders en
 * 404, ouvert dès qu'un des trois services l'est ; admin-services-desactive : « Service désactivé »). Il ne peut donc pas
 * rester ouvert pour toute la phase, et un bloc « serial » de Playwright n'arrête pas les tests des autres workers.
 *
 * Verrou de fichier entre les workers de la phase (.e2e-captures/verrou-salles/<phase>/) à deux groupes :
 *  - « salles » : les tests des pages des salles (interrupteur ouvert) ; « autres » : tous les autres tests de la phase ;
 *  - plusieurs tests d'un même groupe tournent ensemble, jamais deux groupes à la fois ;
 *  - file d'attente dans l'ordre d'arrivée : un test entre si aucun test de l'autre groupe ne tourne ni ne le précède dans la
 *    file (aucune famine : dès qu'un groupe attend, l'autre groupe n'admet plus de nouveaux tests) ;
 *  - le premier test « salles » qui entre lit la valeur d'origine et ouvre l'interrupteur ; le dernier qui sort la remet
 *    (finance_setting_set par le SUPERADMIN du seed de test, comme la recette : historique et motif) ;
 *  - libération dans la fixture `hallsLock` (e2e/support/fixtures.ts), jouée aussi après un dépassement du délai du test ;
 *    l'attente du verrou est ajoutée au délai du test (plafond : 20 min, puis échec explicite) ;
 *  - entrée d'un processus disparu (worker arrêté) retirée par les autres, et l'interrupteur remis si c'était le dernier test
 *    « salles » ; un worker ne joue qu'un test à la fois : ses entrées d'un test précédent sont retirées à l'entrée suivante.
 *
 * Accueil : « / » est régénéré au plus toutes les 60 s et lit l'interrupteur sous unstable_cache (app/_accueil/data.server.ts).
 * Un préchargement de « / » pendant que l'interrupteur est ouvert (lien « Accueil » des menus) garderait la section des salles
 * et son lien vers /halls (404 une fois refermé) dans l'accueil des tests suivants : keepHomeOutOfHallsWindow répond 204 aux
 * préchargements de « / » des pages des salles, sans toucher à la page contrôlée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { FIXTURE_USERS } from '../../tests/helpers/fixture-data';
import { E2E_OUTPUT_DIR } from './demo-ids';
import { APP_URL } from './env';
import { serviceClient, userIdByEmail } from './service';

export const HALLS_SWITCH_KEY = 'features.halls_enabled';

/** « salles » : page des salles, interrupteur ouvert ; « autres » : tout autre test de la phase, interrupteur d'origine. */
export type HallsGroup = 'salles' | 'autres';

interface LockEntry { id: string; pid: number; group: HallsGroup; title: string; since: number }
interface LockState { holders: LockEntry[]; queue: LockEntry[]; original: boolean | null }

const POLL_MS = 250;
const MUTEX_STALE_MS = 60_000;
const MAX_WAIT_MS = 20 * 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

function lockDir(): string {
    const phase = (process.env.E2E_PHASE || 'complet').replace(/[^a-z0-9-]/gi, '');
    return path.join(E2E_OUTPUT_DIR, 'verrou-salles', phase);
}

function readState(file: string): LockState {
    if (!fs.existsSync(file)) return { holders: [], queue: [], original: null };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LockState>;
    return {
        holders: Array.isArray(parsed.holders) ? parsed.holders : [],
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        original: typeof parsed.original === 'boolean' ? parsed.original : null,
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
            console.warn(`[e2e] verrou des salles : section critique tenue depuis ${Math.round(age / 1000)} s (processus arrêté ?), reprise`);
            fs.rmSync(mutex, { recursive: true, force: true });
            continue;
        }
        if (Date.now() - started > MAX_WAIT_MS) throw new Error(`[e2e] verrou des salles : section critique ${mutex} jamais libérée en ${MAX_WAIT_MS / 60_000} min`);
        await sleep(10 + Math.floor(Math.random() * 30));
    }
    try {
        const state = readState(file);
        try {
            return await fn(state);
        } finally {
            // État toujours réécrit (même après une erreur de la base : une entrée retirée ne doit jamais revenir)
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

// ── Interrupteur (base locale, clé de service de .env.e2e) ──────────────────

let superadminId: string | null = null;

async function readHallsSwitch(): Promise<boolean> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', HALLS_SWITCH_KEY).maybeSingle();
    if (error) throw new Error(`[e2e] lecture de ${HALLS_SWITCH_KEY} : ${error.message}`);
    return (data?.value as { value?: unknown } | null | undefined)?.value === true;
}

async function writeHallsSwitch(value: boolean, reason: string): Promise<void> {
    superadminId ??= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    const { data, error } = await serviceClient().rpc('finance_setting_set', {
        p_key: HALLS_SWITCH_KEY, p_value: { value }, p_actor: superadminId, p_reason: reason,
    });
    if (error) throw new Error(`[e2e] finance_setting_set ${HALLS_SWITCH_KEY} = ${String(value)} : ${error.code ?? ''} ${error.message}`);
    if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[e2e] finance_setting_set ${HALLS_SWITCH_KEY} = ${String(value)} refusé : ${JSON.stringify(data)}`);
}

/** Dernier test « salles » sorti : valeur d'origine remise (rien à écrire si elle était déjà ouverte). */
async function restoreSwitch(state: LockState): Promise<void> {
    const original = state.original;
    state.original = null;
    if (original === true) return;
    await writeHallsSwitch(false, 'Remise en état après les pages des salles de fête de l’e2e (interrupteur fermé, sa valeur d’origine).');
}

/** Entrées des processus disparus retirées ; celles d'un test précédent du même worker aussi (un test à la fois par worker). */
async function purge(state: LockState, me: LockEntry): Promise<void> {
    const stale = (e: LockEntry) => (e.pid === process.pid ? e.id !== me.id : !alive(e.pid));
    const hadSalles = state.holders.some((e) => e.group === 'salles');
    const gone = [...state.holders, ...state.queue].filter(stale);
    if (gone.length === 0) return;
    console.warn(`[e2e] verrou des salles : entrées abandonnées retirées (${gone.map((e) => `${e.group} « ${e.title} », processus ${e.pid}`).join(' ; ')})`);
    state.holders = state.holders.filter((e) => !stale(e));
    state.queue = state.queue.filter((e) => !stale(e));
    if (hadSalles && !state.holders.some((e) => e.group === 'salles')) await restoreSwitch(state);
}

/**
 * Verrou d'un test (fixture `hallsLock`) : `enter` au début du test, `leave` à la fin (fixture, même après un dépassement du
 * délai). Un test « salles » trouve l'interrupteur ouvert pendant tout son déroulement ; un test « autres » le trouve à sa
 * valeur d'origine.
 */
export class HallsLock {
    private entry: LockEntry | null = null;
    /** Attente du verrou du test (ms), pour les notes de l'index. */
    waitedMs = 0;

    constructor(private readonly testInfo: TestInfo) {}

    async enter(group: HallsGroup): Promise<void> {
        if (this.entry) throw new Error('[e2e] verrou des salles : déjà pris par ce test');
        const me: LockEntry = { id: randomUUID(), pid: process.pid, group, title: this.testInfo.title.slice(0, 120), since: Date.now() };
        this.entry = me;
        const started = Date.now();
        let last = started;
        for (;;) {
            const entered = await withMutex(async (state) => {
                await purge(state, me);
                if (!state.queue.some((e) => e.id === me.id)) state.queue.push(me);
                const position = state.queue.findIndex((e) => e.id === me.id);
                if (state.holders.some((e) => e.group !== group)) return false;
                if (state.queue.slice(0, position).some((e) => e.group !== group)) return false;
                if (group === 'salles' && !state.holders.some((e) => e.group === 'salles')) {
                    const original = await readHallsSwitch();
                    if (!original) await writeHallsSwitch(true, 'Pages des salles de fête contrôlées par l’e2e : interrupteur ouvert le temps de leurs tests.');
                    state.original = original;
                }
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
                throw new Error(`[e2e] verrou des salles : test du groupe « ${group} » en attente depuis plus de ${MAX_WAIT_MS / 60_000} min (${lockDir()}/etat.json)`);
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
            const held = state.holders.some((e) => e.id === me.id);
            state.queue = state.queue.filter((e) => e.id !== me.id);
            state.holders = state.holders.filter((e) => e.id !== me.id);
            if (held && me.group === 'salles' && !state.holders.some((e) => e.group === 'salles')) await restoreSwitch(state);
        });
    }
}

/**
 * Page des salles : préchargements de l'accueil (« / ») servis par une réponse vide (204), jamais par le serveur, pendant que
 * l'interrupteur est ouvert (voir l'en-tête). Le routeur Next traite une réponse qui n'est pas un flux RSC comme une
 * navigation complète à faire plus tard : aucune erreur, aucun effet sur la page contrôlée. Une navigation vers « / »
 * (document) passe normalement.
 */
export async function keepHomeOutOfHallsWindow(page: Page): Promise<void> {
    const appHost = new URL(APP_URL).host;
    await page.route((url) => url.host === appHost && url.pathname === '/', async (route) => {
        if (route.request().resourceType() === 'document') {
            await route.fallback();
            return;
        }
        await route.fulfill({ status: 204, body: '' });
    });
}
