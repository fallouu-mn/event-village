/**
 * Lot 7 (contrat, sections 11.1 et 11.5) — outils du projet Playwright « terrain » :
 *  - terrainSetup() : appel de scripts/e2e/terrain-setup.ts par `node --import tsx` (jamais d'import du dépôt
 *    dans le processus Playwright : alias @/ non résolu en CI, PROUVÉ run 71) ;
 *  - installScanProbe() : script d'initialisation du contrôleur : caméra simulée (flux d'un canvas, flux
 *    enregistrés pour vérifier leur arrêt), faux BarcodeDetector qui ne rend un payload qu'UNE fois (le QR est
 *    présenté puis retiré), `navigator.vibrate` simulé (motifs enregistrés), et sonde de temps côté test :
 *    lecture (le détecteur rend le payload), état d'attente (`[data-scan-state=pending|slow]`) et résultat
 *    (premier changement des éléments `[data-scan-result]`). La sonde ne dépend pas des marques de
 *    l'application : elle donne le chiffre « avant » (écran du lot 6) et un recoupement « après » ;
 *  - openScanner(), presentPayload(), livePayload() ; statistiques (médiane, p95) et écriture des TSV.
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
export function prepareTerrainEvent(label: string, holder: 'client' | 'client-bis', tickets: number): TerrainEvent {
    const ev = runSetup<TerrainEvent>(['prepare', '--label', label, '--holder', holder, '--tickets', String(tickets), '--start-in-hours', '20', '--before-hours', '24']);
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

export function ticketScans(ticketId: string): TicketScans {
    return runSetup<TicketScans>(['scans', '--ticket', ticketId]);
}

// ── Sonde du scanner (script d'initialisation, sérialisé : aucune référence extérieure) ──

export interface ProbeRecord {
    payload: string;
    armedAt: number;
    readAt: number | null;
    pendingAt: number | null;
    resultAt: number | null;
    result: string | null;
}
export interface ProbeVibration { at: number; pattern: number[] }

export function installScanProbe(): void {
    const w = window as unknown as Record<string, unknown>;
    const records: ProbeRecord[] = [];
    const vibrations: ProbeVibration[] = [];
    const streams: MediaStream[] = [];
    let armed: ProbeRecord | null = null;
    const ids = new WeakMap<Element, number>();
    let nextId = 1;

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
                return;
            }
            if (r.readAt !== null && now - r.readAt > 60_000) return;
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
            armed = null;
            r.readAt = performance.now();
            watch(r, signature());
            return [{ rawValue: r.payload, format: 'qr_code', cornerPoints: [], boundingBox: new DOMRectReadOnly(0, 0, 1, 1) }];
        }
    }
    w.BarcodeDetector = ProbeBarcodeDetector;

    w.__evScanProbe = {
        records,
        vibrations,
        /** Présente un QR : rendu une seule fois au prochain appel de detect() par l'application. */
        present(payload: string): number {
            const r: ProbeRecord = { payload, armedAt: performance.now(), readAt: null, pendingAt: null, resultAt: null, result: null };
            records.push(r);
            armed = r;
            return records.length - 1;
        },
        tracks(): Array<{ kind: string; readyState: string }> {
            return streams.flatMap((s) => s.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState })));
        },
    };
}

interface ProbeHandle {
    records: ProbeRecord[];
    vibrations: ProbeVibration[];
    present(payload: string): number;
    tracks(): Array<{ kind: string; readyState: string }>;
}

/** Présente un payload au scanner et attend sa lecture puis le changement de résultat (sonde). */
export async function presentPayload(page: Page, payload: string, what: string, timeoutMs = 45_000): Promise<{ index: number; record: ProbeRecord }> {
    const index = await page.evaluate((p) => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
        return probe.present(p);
    }, payload);
    await expect.poll(async () => (await probeRecord(page, index)).readAt, {
        message: `${what} : le scanner n'a pas lu le QR présenté (caméra en pause, en veille, ou détection arrêtée)`, timeout: timeoutMs,
    }).not.toBeNull();
    await expect.poll(async () => (await probeRecord(page, index)).resultAt, {
        message: `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`, timeout: timeoutMs,
    }).not.toBeNull();
    return { index, record: await probeRecord(page, index) };
}

/** Présente un payload sans attendre de résultat (lecture hors ligne : écran technique attendu). */
export async function presentPayloadNoResult(page: Page, payload: string, what: string): Promise<{ index: number; record: ProbeRecord }> {
    const index = await page.evaluate((p) => {
        const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
        if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
        return probe.present(p);
    }, payload);
    await expect.poll(async () => (await probeRecord(page, index)).readAt, { message: `${what} : le scanner n'a pas lu le QR présenté`, timeout: 30_000 }).not.toBeNull();
    return { index, record: await probeRecord(page, index) };
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
 * Ouvre /controller/scanner, choisit l'événement (sélecteur d'événement de l'écran du lot 6, ou écran
 * « Commencer le contrôle » du lot 7, D49), passe en mode caméra et attend un flux vidéo en lecture.
 */
export async function openScanner(page: Page, eventTitle: string): Promise<void> {
    await page.goto('/controller/scanner');
    const titleRe = new RegExp(escapeRe(eventTitle));
    const select = page.locator('select').filter({ has: page.locator('option', { hasText: eventTitle }) });
    const radio = page.getByRole('radio', { name: titleRe });
    const eventButton = page.getByRole('button', { name: titleRe });
    const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
    const heading = page.getByRole('heading', { name: titleRe });
    await expect(select.or(radio).or(eventButton).or(start).or(heading).first(),
        `scanner : l'événement « ${eventTitle} » n'est proposé ni dans le sélecteur ni sur l'écran de départ`).toBeVisible({ timeout: 45_000 });
    const usesSelect = await select.count() > 0;
    if (usesSelect) {
        const value = await select.first().locator('option', { hasText: eventTitle }).first().getAttribute('value');
        expect(value, `option de l'événement « ${eventTitle} »`).toBeTruthy();
        await select.first().selectOption(value as string);
        await expect(select.first(), `scanner : événement « ${eventTitle} » sélectionné`).toHaveValue(value as string);
    } else if (await radio.count() > 0) {
        await radio.first().check();
    } else if (await eventButton.count() > 0 && !(await heading.count())) {
        await eventButton.first().click();
    }
    if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
    const camera = page.getByRole('button', { name: /^caméra$/i });
    if (await camera.count() > 0 && (await camera.first().getAttribute('aria-pressed')) !== 'true') await camera.first().click();
    if (!usesSelect) {
        await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
    }
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
