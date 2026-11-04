/**
 * Lot 5.1 — caméra simulée pour le scanner (fumée, captures du scanner).
 *
 * Mode « camera » (par défaut) : getUserMedia renvoie le flux d'un canvas ; le test y dessine
 * l'image du QR dynamique prise sur la page du client (`__evFakeCamera.show(dataUrl)`), et le
 * décodeur réel de l'application (BarcodeDetector s'il existe, sinon ZXing) la lit.
 * Mode « barcode-detector » (repli, E2E_SCAN_MODE=barcode-detector) : en plus, un faux
 * BarcodeDetector renvoie le payload fourni par le test (`__evFakeCamera.setPayload(payload)`),
 * lu dans la réponse /api/tickets/<id>/live-code du client.
 * Script d'initialisation : exécuté dans la page avant tout script de l'application.
 *
 * Lot 7 (run 80) : installCameraDiagnostics / cameraDiagSnapshot / describeCameraScan, diagnostic de l'étape 5 de
 * la fumée (images analysées, POST du scan, état de l'écran), pour qu'un scan sans résultat dise pourquoi.
 */
import type { Page, TestInfo } from '@playwright/test';

export type FakeScanMode = 'camera' | 'barcode-detector';

export function fakeScanMode(): FakeScanMode {
    const raw = process.env.E2E_SCAN_MODE;
    if (!raw || raw === 'camera') return 'camera';
    if (raw === 'barcode-detector') return 'barcode-detector';
    throw new Error(`[e2e] E2E_SCAN_MODE invalide : « ${raw} » (valeurs admises : camera, barcode-detector).`);
}

/** Fonction sérialisée par Playwright (addInitScript) : aucune référence extérieure. */
export function installFakeCamera(arg: { mode: FakeScanMode }): void {
    const devices = navigator.mediaDevices;
    if (!devices) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let image: HTMLImageElement | null = null;
    let payload: string | null = null;
    const paint = () => {
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (image) ctx.drawImage(image, 160, 80, 320, 320);
    };
    paint();
    window.setInterval(paint, 50);
    const fakeDevice = {
        deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée (tests de bout en bout)',
        toJSON() { return { deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée' }; },
    } as unknown as MediaDeviceInfo;
    devices.getUserMedia = async () => canvas.captureStream(15);
    devices.enumerateDevices = async () => [fakeDevice];
    const target = window as unknown as {
        __evFakeCamera?: { show: (dataUrl: string) => Promise<void>; setPayload: (p: string) => void };
        BarcodeDetector?: unknown;
    };
    target.__evFakeCamera = {
        show: (dataUrl: string) => new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => { image = img; paint(); resolve(); };
            img.onerror = () => reject(new Error('image du QR illisible'));
            img.src = dataUrl;
        }),
        setPayload: (p: string) => { payload = p; },
    };
    if (arg.mode === 'barcode-detector') {
        class FakeBarcodeDetector {
            static async getSupportedFormats(): Promise<string[]> { return ['qr_code']; }
            async detect(): Promise<Array<{ rawValue: string; format: string; cornerPoints: unknown[]; boundingBox: DOMRectReadOnly }>> {
                return payload ? [{ rawValue: payload, format: 'qr_code', cornerPoints: [], boundingBox: new DOMRectReadOnly(0, 0, 1, 1) }] : [];
            }
        }
        target.BarcodeDetector = FakeBarcodeDetector;
    }
}

// ── Diagnostic du scan caméra (fumée, étape 5 ; run 80) ─────────────────────

export interface CameraDiagPost {
    /** performance.now() à l'envoi. */
    at: number;
    status: number | null;
    error: string | null;
    response: string | null;
    doneAt: number | null;
}
export interface CameraDiagSnapshot {
    /** Images analysées par le décodeur depuis le chargement : image vidéo dessinée dans un canvas (décodeur logiciel) ou detect() natif. */
    analysedFrames: number;
    posts: CameraDiagPost[];
    now: number;
}

/**
 * Script d'initialisation de la page qui scanne en mode caméra (aucune référence extérieure) : ne change rien au
 * comportement, il compte et journalise.
 *  - images analysées : chaque image vidéo dessinée dans un canvas (CameraQrScanner, décodeur logiciel : une par
 *    tour de boucle) et chaque appel de BarcodeDetector.detect (décodeur natif) ; un compteur qui avance prouve
 *    que la boucle de détection tourne ;
 *  - POST /api/controller/scan : heure, statut, erreur réseau, début de la réponse (fetch enveloppé, mêmes
 *    arguments, même réponse, comme la sonde du projet terrain).
 */
export function installCameraDiagnostics(): void {
    const diag = { analysedFrames: 0, posts: [] as CameraDiagPost[] };
    (window as unknown as { __evCameraDiag?: typeof diag }).__evCameraDiag = diag;

    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function countedDrawImage(this: CanvasRenderingContext2D, ...args: unknown[]): void {
        if (args[0] instanceof HTMLVideoElement) diag.analysedFrames += 1;
        (drawImage as (...a: unknown[]) => void).apply(this, args);
    } as typeof drawImage;

    const Native = (window as unknown as { BarcodeDetector?: { prototype: { detect: (...a: unknown[]) => unknown } } }).BarcodeDetector;
    if (Native && typeof Native.prototype?.detect === 'function') {
        const detect = Native.prototype.detect;
        Native.prototype.detect = function countedDetect(this: unknown, ...args: unknown[]): unknown {
            diag.analysedFrames += 1;
            return detect.apply(this, args);
        };
    }

    const originalFetch = window.fetch;
    window.fetch = function diagFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        let path = '';
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        try {
            path = new URL(input instanceof Request ? input.url : String(input), window.location.href).pathname;
        } catch (err) {
            console.warn(`[e2e][diagnostic caméra] URL de fetch illisible : ${err instanceof Error ? err.message : String(err)}`);
        }
        const promise = originalFetch.call(window, input, init);
        if (method !== 'POST' || path !== '/api/controller/scan') return promise;
        const entry: CameraDiagPost = { at: performance.now(), status: null, error: null, response: null, doneAt: null };
        diag.posts.push(entry);
        return promise.then((res) => {
            entry.status = res.status;
            entry.doneAt = performance.now();
            res.clone().text().then((t) => { entry.response = t.slice(0, 300); }, (err: unknown) => {
                entry.response = `corps illisible : ${err instanceof Error ? err.message : String(err)}`;
            });
            return res;
        }, (err: unknown) => {
            entry.error = err instanceof Error ? `${err.name} : ${err.message}` : String(err);
            entry.doneAt = performance.now();
            throw err;
        });
    };
}

/** Compteurs du diagnostic à un instant (à prendre juste avant de présenter le QR). */
export async function cameraDiagSnapshot(page: Page): Promise<CameraDiagSnapshot> {
    return page.evaluate(() => {
        const d = (window as unknown as { __evCameraDiag?: { analysedFrames: number; posts: CameraDiagPost[] } }).__evCameraDiag;
        if (!d) throw new Error('diagnostic de la caméra absent de la page (installCameraDiagnostics)');
        return { analysedFrames: d.analysedFrames, posts: d.posts.map((p) => ({ ...p })), now: performance.now() };
    });
}

/**
 * Diagnostic d'un scan caméra sans résultat (message d'échec) : images analysées depuis la présentation du QR
 * (boucle vivante ou non), décodeur annoncé par l'écran, POST du scan depuis la présentation, état de l'écran,
 * messages [camera], [partner/scan] et [scan] de la console. Image vidéo courante jointe au test.
 */
export async function describeCameraScan(page: Page, before: CameraDiagSnapshot, consoleLines: readonly string[], testInfo?: TestInfo): Promise<string> {
    const d = await page.evaluate((since) => {
        const diag = (window as unknown as { __evCameraDiag?: { analysedFrames: number; posts: CameraDiagPost[] } }).__evCameraDiag;
        const video = document.querySelector('video');
        const root = document.querySelector('[data-scan-decoder]');
        const text = document.body?.innerText ?? '';
        const states = ['Présentez le QR', 'Détection en pause', 'Caméra en veille', 'Caméra indisponible', 'Démarrage de la caméra', 'Entrée validée']
            .filter((s) => text.includes(s));
        const count = /(\d+) validé.{0,4}·\s*(\d+) refusé/.exec(text);
        return {
            frames: diag ? diag.analysedFrames : null,
            posts: diag ? diag.posts.filter((p) => p.at >= since).map((p) => ({ ...p })) : null,
            now: performance.now(),
            decoder: root?.getAttribute('data-scan-decoder') ?? null,
            video: video ? { readyState: video.readyState, paused: video.paused, width: video.videoWidth, height: video.videoHeight, attached: video.srcObject !== null } : null,
            states,
            counter: count ? `${count[1]} validé · ${count[2]} refusé` : null,
        };
    }, before.now);
    let frameNote = 'image vidéo non jointe';
    if (testInfo && d.video && d.video.width > 0) {
        try {
            const dataUrl = await page.evaluate(() => {
                const v = document.querySelector('video');
                if (!v) return null;
                const c = document.createElement('canvas');
                c.width = v.videoWidth;
                c.height = v.videoHeight;
                c.getContext('2d')?.drawImage(v, 0, 0);
                return c.toDataURL('image/png');
            });
            if (dataUrl) {
                await testInfo.attach('image-video-du-scanner.png', { body: Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'), contentType: 'image/png' });
                frameNote = 'image vidéo jointe (image-video-du-scanner.png)';
            }
        } catch (err) {
            frameNote = `image vidéo non jointe : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`;
        }
    }
    const seconds = ((d.now - before.now) / 1000).toFixed(1);
    const frames = d.frames === null ? 'diagnostic absent' : `${d.frames - before.analysedFrames} image(s) analysée(s) en ${seconds} s`;
    const posts = d.posts === null ? 'diagnostic absent' : d.posts.length === 0 ? 'aucun'
        : d.posts.map((p) => `[+${Math.round(p.at - before.now)} ms → ${p.status ?? (p.error ? `erreur ${p.error}` : 'sans réponse')}${p.response ? ` ${p.response.replace(/\s+/g, ' ').slice(0, 160)}` : ''}]`).join(' ');
    const video = d.video ? `readyState ${d.video.readyState}, ${d.video.paused ? 'en pause' : 'en lecture'}, ${d.video.width}×${d.video.height}, flux ${d.video.attached ? 'attaché' : 'détaché'}` : 'absente';
    return `diagnostic caméra : décodeur ${d.decoder ?? '—'} ; ${frames} depuis la présentation du QR ; POST /api/controller/scan depuis la présentation : ${posts} ; `
        + `écran : ${JSON.stringify(d.states)}, compteur « ${d.counter ?? '—'} », vidéo ${video} ; ${frameNote} ; `
        + `console [camera]/[partner/scan]/[scan] (${consoleLines.length}) : ${consoleLines.slice(-10).join(' | ') || 'aucun message'}`;
}
