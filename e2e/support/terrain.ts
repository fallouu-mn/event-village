/**
 * Lot 7 (contrat, sections 11.1 et 11.5) — outils du projet Playwright « terrain » :
 *  - terrainSetup() : appel de scripts/e2e/terrain-setup.ts par `node --import tsx` (jamais d'import du dépôt
 *    dans le processus Playwright : alias @/ non résolu en CI, PROUVÉ run 71) ;
 *  - installScanProbe() : script d'initialisation du contrôleur : caméra simulée (flux d'un canvas, flux
 *    enregistrés pour vérifier leur arrêt), faux BarcodeDetector, `navigator.vibrate` simulé (motifs
 *    enregistrés), journal des POST /api/controller/scan (fetch enveloppé sans rien changer : heure, statut,
 *    début de la réponse), et sonde de temps côté test : lecture (le détecteur rend le payload), état d'attente
 *    (`[data-scan-state=pending|slow]`) et résultat (premier changement des éléments `[data-scan-result]`).
 *    Le QR est TENU devant la caméra jusqu'à ce que l'écran envoie la lecture (premier POST du scan) ou affiche
 *    un résultat, comme un billet présenté au contrôleur : une lecture ignorée par l'écran est relue à
 *    l'image suivante (run 72, test 5 : une lecture unique ignorée laissait l'écran sans résultat). Le nombre
 *    de lectures est compté (> 1 : l'écran a ignoré une lecture). La sonde ne dépend pas des marques de
 *    l'application : elle donne le chiffre « avant » (écran du lot 6) et un recoupement « après » ;
 *  - openScanner(), presentPayload(), livePayload(), computedPayload() ; statistiques (médiane, p95) et
 *    écriture des TSV.
 * Aucune horloge n'est installée dans un contexte de contrôleur ou de mesure (marques factices sinon).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_OUTPUT_DIR } from './demo-ids';
import { e2eConfig } from './env';

export const PERF_DIR = path.join(E2E_OUTPUT_DIR, 'perf');

// ── Script de préparation ──────────────────────────────────────────────────

const SETUP_SCRIPT = path.join('scripts', 'e2e', 'terrain-setup.ts');

export interface TerrainTicket { id: string; number: string }
export interface TerrainEvent {
    eventId: string;
    title: string;
    startAt: string;
    endAt: string;
    categoryId: string;
    holder: 'client' | 'client-bis';
    holderUserId: string;
    controllerUserId: string;
    tickets: TerrainTicket[];
    setting: { key: string; previous: unknown; applied: unknown } | null;
}
export interface TicketScans {
    ticket: { id: string; status: string; checked_in_at: string | null };
    scans: Array<{ result: string; accepted: boolean; method: string; scanner_id: string; created_at: string }>;
}

function runSetup<T>(args: string[]): T {
    e2eConfig(); // .env.e2e chargé et URL locales vérifiées avant de lancer le script
    const r = spawnSync(process.execPath, ['--import', 'tsx', SETUP_SCRIPT, ...args], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120_000 });
    if (r.error) throw new Error(`[e2e][terrain] ${SETUP_SCRIPT} ${args[0]} : ${r.error.message}`);
    const out = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
    const last = out[out.length - 1] ?? '';
    if (r.status !== 0) {
        throw new Error(`[e2e][terrain] ${SETUP_SCRIPT} ${args[0]} : code ${r.status}\n${(r.stderr ?? '').slice(-2000)}\n${out.slice(-5).join('\n')}`);
    }
    try {
        return JSON.parse(last) as T;
    } catch (err) {
        throw new Error(`[e2e][terrain] ${SETUP_SCRIPT} ${args[0]} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${last.slice(0, 300)}`);
    }
}

/**
 * Événement à ≈ 20 h (heure réelle), billets gratuits du porteur, contrôleur A affecté, et
 * `access.scan_window_before_hours = 24` (D6) : l'appelant DOIT appeler `restoreTerrainSetting` dans un finally.
 */
export function prepareTerrainEvent(label: string, holder: 'client' | 'client-bis', tickets: number, opts: { priceFcfa?: number } = {}): TerrainEvent {
    const price = opts.priceFcfa !== undefined ? ['--price', String(opts.priceFcfa)] : [];
    const ev = runSetup<TerrainEvent>(['prepare', '--label', label, '--holder', holder, '--tickets', String(tickets), ...price, '--start-in-hours', '20', '--before-hours', '24']);
    console.log(`[e2e][terrain] ${label} : événement ${ev.eventId} (début ${ev.startAt}), ${ev.tickets.length} billet(s) gratuit(s) de ${holder}, `
        + `${ev.setting ? `${ev.setting.key} ${JSON.stringify(ev.setting.previous)} → ${JSON.stringify(ev.setting.applied)}` : 'aucun réglage posé'}`);
    return ev;
}

/** Remet la valeur lue avant `prepareTerrainEvent` (aucune action si rien n'a été posé). */
export function restoreTerrainSetting(ev: TerrainEvent | null): void {
    if (!ev?.setting) return;
    runSetup<{ key: string; restored: unknown }>(['restore-setting', '--key', ev.setting.key, '--value', JSON.stringify(ev.setting.previous)]);
    console.log(`[e2e][terrain] ${ev.setting.key} remis à ${JSON.stringify(ev.setting.previous)}`);
}

/** Lot 7 (fumée prolongée) : numéro du porteur marqué vérifié (destinataire d'un transfert, onglet « Reçus »). */
export function verifyHolderPhone(holder: 'client' | 'client-bis'): { userId: string; phone: string; verifiedAt: string; changed: boolean } {
    return runSetup<{ userId: string; phone: string; verifiedAt: string; changed: boolean }>(['verify-phone', '--holder', holder]);
}

export function ticketScans(ticketId: string): TicketScans {
    return runSetup<TicketScans>(['scans', '--ticket', ticketId]);
}

export interface ComputedPayload {
    ticket_id: string;
    status: string;
    secret_version: number | null;
    step_seconds: number;
    counter: number;
    code: string;
    payload: string;
    computed_at: string;
    next_step_in_ms: number;
    waited_ms: number;
}

/**
 * QR du pas courant d'un billet, quel que soit son statut (billet composté compris : la route live-code du
 * porteur le refuse par un 409, run 72), calculé par scripts/e2e/terrain-setup.ts `payload` avec
 * lib/security/totp.ts et le secret lu sur la base locale. `notCode` : code à éviter (lecture précédente du
 * même billet) ; le script attend alors réellement le pas suivant (20 s au plus).
 */
export function computedPayload(ticketId: string, notCode?: string): ComputedPayload {
    const args = ['payload', '--ticket', ticketId];
    if (notCode !== undefined) args.push('--not-code', notCode);
    const out = runSetup<ComputedPayload>(args);
    if (out.ticket_id !== ticketId.toLowerCase() || !out.payload.endsWith(`:${out.code}`)) {
        throw new Error(`[e2e][terrain] payload calculé incohérent pour ${ticketId} : ${JSON.stringify({ ...out, payload: out.payload.slice(0, 80) })}`);
    }
    return out;
}

/** Code à 6 chiffres d'un payload « <préfixe>:<billet>:<code> ». */
export function codeOf(payload: string): string {
    const m = /:(\d{6})$/.exec(payload);
    if (!m) throw new Error(`payload sans code à 6 chiffres : « ${payload.slice(0, 120)} »`);
    return m[1];
}

// ── Sonde du scanner (script d'initialisation, sérialisé : aucune référence extérieure) ──

export interface ProbeRecord {
    payload: string;
    /** QR tenu jusqu'au premier POST du scan ou au premier résultat (false : rendu une seule fois). */
    hold: boolean;
    armedAt: number;
    /** Première lecture (le détecteur rend le payload). */
    readAt: number | null;
    /** Dernière lecture avant le retrait du QR (celle que l'écran a envoyée si reads > 1). */
    lastReadAt: number | null;
    reads: number;
    /** Premier POST /api/controller/scan pendant que ce QR était présenté. */
    postAt: number | null;
    pendingAt: number | null;
    resultAt: number | null;
    result: string | null;
    withdrawnAt: number | null;
}
export interface ProbeVibration { at: number; pattern: number[] }
export interface ProbePost {
    at: number;
    /** Indice de la lecture présentée au moment de l'envoi (-1 : aucune). */
    record: number;
    payloadInBody: boolean;
    status: number | null;
    error: string | null;
    response: string | null;
    doneAt: number | null;
}

export function installScanProbe(): void {
    const w = window as unknown as Record<string, unknown>;
    const records: ProbeRecord[] = [];
    const vibrations: ProbeVibration[] = [];
    const posts: ProbePost[] = [];
    const streams: MediaStream[] = [];
    let armed: ProbeRecord | null = null;
    const ids = new WeakMap<Element, number>();
    let nextId = 1;
    const withdraw = (r: ProbeRecord): void => {
        if (armed === r) armed = null;
        if (r.withdrawnAt === null) r.withdrawnAt = performance.now();
    };

    // Journal des POST du scan : fetch enveloppé (mêmes arguments, même réponse), statut et début du corps
    const originalFetch = window.fetch;
    window.fetch = function probeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        let path = '';
        let method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        try {
            path = new URL(input instanceof Request ? input.url : String(input), window.location.href).pathname;
        } catch (err) {
            console.warn(`[e2e][sonde] URL de fetch illisible : ${err instanceof Error ? err.message : String(err)}`);
            method = '';
        }
        const promise = originalFetch.call(window, input, init);
        if (method !== 'POST' || path !== '/api/controller/scan') return promise;
        const held = armed;
        const body = typeof init?.body === 'string' ? init.body : '';
        const entry: ProbePost = {
            at: performance.now(), record: held ? records.indexOf(held) : -1, payloadInBody: held !== null && body.includes(held.payload),
            status: null, error: null, response: null, doneAt: null,
        };
        posts.push(entry);
        if (held && held.readAt !== null) {
            if (held.postAt === null) held.postAt = entry.at;
            withdraw(held); // l'écran a envoyé la lecture : le QR est retiré
        }
        return promise.then((res) => {
            entry.status = res.status;
            entry.doneAt = performance.now();
            try {
                res.clone().text().then((t) => { entry.response = t.slice(0, 300); }, (err: unknown) => { entry.response = `corps illisible : ${err instanceof Error ? err.message : String(err)}`; });
            } catch (err) {
                entry.response = `corps non copié : ${err instanceof Error ? err.message : String(err)}`;
            }
            return res;
        }, (err: unknown) => {
            entry.error = err instanceof Error ? `${err.name} : ${err.message}` : String(err);
            entry.doneAt = performance.now();
            throw err;
        });
    };

    const signature = (): string[] => Array.from(document.querySelectorAll('[data-scan-result]')).map((el) => {
        let id = ids.get(el);
        if (id === undefined) {
            id = nextId++;
            ids.set(el, id);
        }
        return `${id}|${el.getAttribute('data-scan-result') ?? ''}|${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)}`;
    });

    const watch = (r: ProbeRecord, before: string[]): void => {
        const old = new Set(before);
        const tick = (): void => {
            const now = performance.now();
            if (r.pendingAt === null && document.querySelector('[data-scan-state="pending"], [data-scan-state="slow"]')) r.pendingAt = now;
            const fresh = signature().filter((line) => !old.has(line));
            if (fresh.length > 0) {
                r.resultAt = now;
                r.result = fresh[0].split('|')[1] || null;
                withdraw(r);
                return;
            }
            if (r.lastReadAt !== null && now - r.lastReadAt > 60_000) return;
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    // navigator.vibrate simulé : motifs enregistrés (aucune vibration réelle en tête sans écran)
    try {
        Object.defineProperty(Navigator.prototype, 'vibrate', {
            configurable: true,
            writable: true,
            value: (pattern: VibratePattern): boolean => {
                vibrations.push({ at: performance.now(), pattern: Array.isArray(pattern) ? pattern.map(Number) : [Number(pattern)] });
                return true;
            },
        });
    } catch (err) {
        console.warn(`[e2e][sonde] navigator.vibrate non simulé : ${err instanceof Error ? err.message : String(err)}`);
    }

    // Caméra simulée : flux d'un canvas peint en continu (readyState ≥ 2), chaque flux est enregistré
    const devices = navigator.mediaDevices;
    if (devices) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        window.setInterval(() => {
            if (!ctx) return;
            frame += 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#111111';
            ctx.fillText(`e2e ${frame}`, 20, 40);
        }, 66);
        const fakeDevice = {
            deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée (projet terrain)',
            toJSON() { return { deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée' }; },
        } as unknown as MediaDeviceInfo;
        devices.getUserMedia = async () => {
            const stream = canvas.captureStream(15);
            streams.push(stream);
            return stream;
        };
        devices.enumerateDevices = async () => [fakeDevice];
    }

    class ProbeBarcodeDetector {
        static async getSupportedFormats(): Promise<string[]> { return ['qr_code']; }
        async detect(): Promise<Array<{ rawValue: string; format: string; cornerPoints: unknown[]; boundingBox: DOMRectReadOnly }>> {
            const r = armed;
            if (!r) return [];
            const now = performance.now();
            r.reads += 1;
            r.lastReadAt = now;
            if (r.readAt === null) {
                r.readAt = now;
                watch(r, signature());
            }
            if (!r.hold) withdraw(r);
            return [{ rawValue: r.payload, format: 'qr_code', cornerPoints: [], boundingBox: new DOMRectReadOnly(0, 0, 1, 1) }];
        }
    }
    w.BarcodeDetector = ProbeBarcodeDetector;

    w.__evScanProbe = {
        records,
        vibrations,
        posts,
        /**
         * Présente un QR. hold = true : rendu à chaque appel de detect() jusqu'au premier POST du scan ou au
         * premier résultat (QR tenu devant la caméra) ; hold = false : rendu une seule fois.
         */
        present(payload: string, hold: boolean): number {
            if (armed) withdraw(armed);
            const r: ProbeRecord = {
                payload, hold, armedAt: performance.now(), readAt: null, lastReadAt: null, reads: 0, postAt: null,
                pendingAt: null, resultAt: null, result: null, withdrawnAt: null,
            };
            records.push(r);
            armed = r;
            return records.length - 1;
        },
        withdraw(index: number): void {
            const r = records[index];
            if (r) withdraw(r);
        },
        state(): { asleep: boolean; videoPlaying: boolean; results: string[]; scanStates: string[] } {
            const text = (document.body?.innerText ?? '').toLowerCase();
            return {
                asleep: text.includes('en veille'),
                videoPlaying: Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2 && !v.paused),
                results: Array.from(document.querySelectorAll('[data-scan-result]')).map((el) => el.getAttribute('data-scan-result') ?? ''),
                scanStates: Array.from(document.querySelectorAll('[data-scan-state]')).map((el) => el.getAttribute('data-scan-state') ?? ''),
            };
        },
        tracks(): Array<{ kind: string; readyState: string }> {
            return streams.flatMap((s) => s.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState })));
        },
    };
}

interface ProbeHandle {
    records: ProbeRecord[];
    vibrations: ProbeVibration[];
    posts: ProbePost[];
    present(payload: string, hold: boolean): number;
    withdraw(index: number): void;
    state(): { asleep: boolean; videoPlaying: boolean; results: string[]; scanStates: string[] };
    tracks(): Array<{ kind: string; readyState: string }>;
}

async function presentOnPage(page: Page, payload: string, hold: boolean): Promise<number> {
    return page.evaluate(({ p, h }) => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
        return probe.present(p, h);
    }, { p: payload, h: hold });
}

function ms(v: number | null, origin: number): string {
    return v === null ? '—' : `+${Math.round(v - origin)} ms`;
}

/**
 * Diagnostic d'une lecture (messages d'échec) : heures relatives à la présentation du QR, POST du scan
 * observés depuis la présentation (statut, erreur, début de la réponse), état de l'écran et vibrations.
 */
export async function describeProbe(page: Page, index: number): Promise<string> {
    const d = await page.evaluate((i) => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) return null;
        const r = probe.records[i];
        if (!r) return null;
        return {
            record: { ...r },
            posts: probe.posts.filter((p) => p.at >= r.armedAt).map((p) => ({ ...p })),
            vibrations: probe.vibrations.filter((v) => v.at >= r.armedAt).map((v) => ({ at: v.at, pattern: [...v.pattern] })),
            state: probe.state(),
        };
    }, index);
    if (!d) return 'sonde du scanner absente de la page (rechargée ?)';
    const r = d.record;
    const o = r.armedAt;
    const posts = d.posts.length === 0 ? 'aucun'
        : d.posts.map((p) => `[${ms(p.at, o)} lecture ${p.record}${p.payloadInBody ? ' (payload présenté)' : ''} → ${p.status ?? (p.error ? `erreur ${p.error}` : 'sans réponse')}${p.doneAt !== null ? ` à ${ms(p.doneAt, o)}` : ''}${p.response ? ` ${p.response.replace(/\s+/g, ' ').slice(0, 160)}` : ''}]`).join(' ');
    return `sonde : readAt ${ms(r.readAt, o)}, lectures ${r.reads}, dernière lecture ${ms(r.lastReadAt, o)}, POST ${ms(r.postAt, o)}, `
        + `pendingAt ${ms(r.pendingAt, o)}, résultat ${ms(r.resultAt, o)} « ${r.result ?? '—'} », retiré ${ms(r.withdrawnAt, o)} ; `
        + `POST /api/controller/scan depuis la présentation : ${posts} ; `
        + `écran : en veille ${d.state.asleep ? 'oui' : 'non'}, vidéo en lecture ${d.state.videoPlaying ? 'oui' : 'non'}, `
        + `data-scan-result ${JSON.stringify(d.state.results)}, data-scan-state ${JSON.stringify(d.state.scanStates)} ; `
        + `vibrations ${JSON.stringify(d.vibrations.map((v) => v.pattern))}`;
}

/** Attend qu'un champ de la lecture soit renseigné ; sinon échec avec le diagnostic complet de la sonde. */
async function waitProbe(page: Page, index: number, field: 'readAt' | 'resultAt', timeoutMs: number, failure: string): Promise<ProbeRecord> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const r = await probeRecord(page, index);
        if (r[field] !== null) return r;
        if (Date.now() > deadline) {
            const detail = await describeProbe(page, index);
            await page.evaluate((i) => (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe?.withdraw(i), index);
            throw new Error(`${failure} (${Math.round(timeoutMs / 1000)} s) — ${detail}`);
        }
        await page.waitForTimeout(200);
    }
}

/**
 * Présente un payload au scanner (QR tenu jusqu'à l'envoi de la lecture ou au résultat) et attend sa lecture
 * puis le changement de résultat (sonde). En cas d'échec, le message donne readAt, les lectures, les POST
 * du scan observés et l'état de l'écran.
 */
export async function presentPayload(page: Page, payload: string, what: string, timeoutMs = 45_000): Promise<{ index: number; record: ProbeRecord }> {
    const index = await presentOnPage(page, payload, true);
    await waitProbe(page, index, 'readAt', timeoutMs, `${what} : le scanner n'a pas lu le QR présenté (caméra en pause, en veille, ou détection arrêtée)`);
    const record = await waitProbe(page, index, 'resultAt', timeoutMs, `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`);
    return { index, record };
}

/** Présente un payload une seule fois, sans attendre de résultat (lecture hors ligne : écran technique attendu). */
export async function presentPayloadNoResult(page: Page, payload: string, what: string): Promise<{ index: number; record: ProbeRecord }> {
    const index = await presentOnPage(page, payload, false);
    const record = await waitProbe(page, index, 'readAt', 30_000, `${what} : le scanner n'a pas lu le QR présenté`);
    return { index, record };
}

export async function probeRecord(page: Page, index: number): Promise<ProbeRecord> {
    return page.evaluate((i) => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page');
        const r = probe.records[i];
        if (!r) throw new Error(`lecture ${i} inconnue de la sonde`);
        return { ...r };
    }, index);
}

export async function probeVibrations(page: Page): Promise<ProbeVibration[]> {
    return page.evaluate(() => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page');
        return probe.vibrations.map((v) => ({ at: v.at, pattern: [...v.pattern] }));
    });
}

export async function probeTracks(page: Page): Promise<Array<{ kind: string; readyState: string }>> {
    return page.evaluate(() => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page');
        return probe.tracks();
    });
}

/** Marques de l'application (`performance.mark('ev-scan:read'|'ev-scan:pending'|'ev-scan:result')`). */
export async function scanMarks(page: Page): Promise<Array<{ name: string; startTime: number }>> {
    return page.evaluate(() => performance.getEntriesByType('mark')
        .filter((m) => m.name.startsWith('ev-scan:'))
        .map((m) => ({ name: m.name, startTime: m.startTime })));
}

// ── Écran du contrôleur ────────────────────────────────────────────────────

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ouvre /controller/scanner sur l'écran « Commencer le contrôle » (ScannerStartScreen, D49, écran committé par
 * fix(7.2e)) : bouton radio de l'événement (nom accessible = titre, date, lieu), puis « Commencer le contrôle »,
 * mode caméra (aria-pressed), titre de l'événement dans la barre d'état, flux vidéo en lecture. Les replis du lot 6
 * (liste déroulante, bouton d'événement) sont retirés : l'écran réel est exigé.
 */
export async function openScanner(page: Page, eventTitle: string): Promise<void> {
    await page.goto('/controller/scanner');
    await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i }),
        'scanner : écran « Commencer le contrôle » (D49)').toBeVisible({ timeout: 45_000 });
    const radio = page.getByRole('radio', { name: new RegExp(escapeRe(eventTitle)) });
    await expect(radio, `scanner : l'événement « ${eventTitle} » est proposé sur l'écran de départ`).toHaveCount(1, { timeout: 45_000 });
    await radio.check();
    await expect(radio, `scanner : événement « ${eventTitle} » choisi`).toBeChecked();
    await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
    const camera = page.getByRole('button', { name: /^caméra$/i });
    await expect(camera, 'scanner : bascule « Caméra / Saisie manuelle » affichée après le départ').toBeVisible({ timeout: 30_000 });
    if ((await camera.getAttribute('aria-pressed')) !== 'true') await camera.click();
    await expect(camera, 'scanner : mode caméra').toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
        .catch((err: unknown) => {
            throw new Error(`scanner : aucun flux vidéo en lecture après le choix de l'événement (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
        });
}

/** Payload du QR dynamique courant d'un billet, lu par la route du porteur depuis sa page (cookies de session). */
export async function livePayload(holderPage: Page, ticketId: string): Promise<string> {
    const out = await holderPage.evaluate(async (id) => {
        const res = await fetch(`/api/tickets/${id}/live-code`, { cache: 'no-store' });
        const text = await res.text();
        return { status: res.status, text };
    }, ticketId);
    if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
    let payload = '';
    try {
        payload = String((JSON.parse(out.text) as { payload?: unknown }).payload ?? '');
    } catch (err) {
        throw new Error(`live-code du billet ${ticketId} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${out.text.slice(0, 200)}`);
    }
    if (!payload.includes(ticketId)) throw new Error(`live-code du billet ${ticketId} : payload inattendu « ${payload.slice(0, 120)} »`);
    return payload;
}

/** Payload dont le code ne se vérifie pas (même billet, même préfixe) : refus attendu (qr_expired / invalid). */
export function forgedPayload(payload: string): string {
    const m = /^(.*:)(\d{6})$/.exec(payload);
    if (!m) throw new Error(`payload sans code à 6 chiffres : « ${payload.slice(0, 120)} »`);
    const forged = String((Number(m[2]) + 500_001) % 1_000_000).padStart(6, '0');
    return `${m[1]}${forged}`;
}

// ── Statistiques et fichiers de mesure ─────────────────────────────────────

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Centile par rang (nearest-rank) : p95 de 10 valeurs = la plus grande. */
export function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((p / 100) * s.length));
    return s[rank - 1];
}

export function fmtMs(v: number | null): string {
    return v === null ? '—' : String(Math.round(v));
}

/** Écrit un TSV dans .e2e-captures/perf/ (remplace le fichier). */
export function writePerfFile(name: string, content: string): string {
    fs.mkdirSync(PERF_DIR, { recursive: true });
    const file = path.join(PERF_DIR, name);
    fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    return file;
}

/** Ajoute des lignes à un fichier de .e2e-captures/perf/ ; l'en-tête n'est écrit qu'à la création. */
export function appendPerfFile(name: string, header: string | null, lines: string[]): string {
    fs.mkdirSync(PERF_DIR, { recursive: true });
    const file = path.join(PERF_DIR, name);
    const prefix = !fs.existsSync(file) && header ? `${header}\n` : '';
    fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, 'utf8');
    return file;
}
