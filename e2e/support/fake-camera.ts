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
 */
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
