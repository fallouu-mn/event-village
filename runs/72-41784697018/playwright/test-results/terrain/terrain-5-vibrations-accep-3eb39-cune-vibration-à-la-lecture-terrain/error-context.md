# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture
- Location: e2e/terrain.spec.ts:390:5

# Error details

```
Error: code qui ne se vérifie pas : aucun résultat de scan affiché ([data-scan-result]) après la lecture

code qui ne se vérifie pas : aucun résultat de scan affiché ([data-scan-result]) après la lecture

expect(received).not.toBeNull()

Received: null

Call Log:
- Timeout 45000ms exceeded while waiting on the predicate
```

# Test source

```ts
  121 |                 r.resultAt = now;
  122 |                 r.result = fresh[0].split('|')[1] || null;
  123 |                 return;
  124 |             }
  125 |             if (r.readAt !== null && now - r.readAt > 60_000) return;
  126 |             requestAnimationFrame(tick);
  127 |         };
  128 |         requestAnimationFrame(tick);
  129 |     };
  130 | 
  131 |     // navigator.vibrate simulé : motifs enregistrés (aucune vibration réelle en tête sans écran)
  132 |     try {
  133 |         Object.defineProperty(Navigator.prototype, 'vibrate', {
  134 |             configurable: true,
  135 |             writable: true,
  136 |             value: (pattern: VibratePattern): boolean => {
  137 |                 vibrations.push({ at: performance.now(), pattern: Array.isArray(pattern) ? pattern.map(Number) : [Number(pattern)] });
  138 |                 return true;
  139 |             },
  140 |         });
  141 |     } catch (err) {
  142 |         console.warn(`[e2e][sonde] navigator.vibrate non simulé : ${err instanceof Error ? err.message : String(err)}`);
  143 |     }
  144 | 
  145 |     // Caméra simulée : flux d'un canvas peint en continu (readyState ≥ 2), chaque flux est enregistré
  146 |     const devices = navigator.mediaDevices;
  147 |     if (devices) {
  148 |         const canvas = document.createElement('canvas');
  149 |         canvas.width = 640;
  150 |         canvas.height = 480;
  151 |         const ctx = canvas.getContext('2d');
  152 |         let frame = 0;
  153 |         window.setInterval(() => {
  154 |             if (!ctx) return;
  155 |             frame += 1;
  156 |             ctx.fillStyle = '#ffffff';
  157 |             ctx.fillRect(0, 0, canvas.width, canvas.height);
  158 |             ctx.fillStyle = '#111111';
  159 |             ctx.fillText(`e2e ${frame}`, 20, 40);
  160 |         }, 66);
  161 |         const fakeDevice = {
  162 |             deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée (projet terrain)',
  163 |             toJSON() { return { deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'Caméra simulée' }; },
  164 |         } as unknown as MediaDeviceInfo;
  165 |         devices.getUserMedia = async () => {
  166 |             const stream = canvas.captureStream(15);
  167 |             streams.push(stream);
  168 |             return stream;
  169 |         };
  170 |         devices.enumerateDevices = async () => [fakeDevice];
  171 |     }
  172 | 
  173 |     class ProbeBarcodeDetector {
  174 |         static async getSupportedFormats(): Promise<string[]> { return ['qr_code']; }
  175 |         async detect(): Promise<Array<{ rawValue: string; format: string; cornerPoints: unknown[]; boundingBox: DOMRectReadOnly }>> {
  176 |             const r = armed;
  177 |             if (!r) return [];
  178 |             armed = null;
  179 |             r.readAt = performance.now();
  180 |             watch(r, signature());
  181 |             return [{ rawValue: r.payload, format: 'qr_code', cornerPoints: [], boundingBox: new DOMRectReadOnly(0, 0, 1, 1) }];
  182 |         }
  183 |     }
  184 |     w.BarcodeDetector = ProbeBarcodeDetector;
  185 | 
  186 |     w.__evScanProbe = {
  187 |         records,
  188 |         vibrations,
  189 |         /** Présente un QR : rendu une seule fois au prochain appel de detect() par l'application. */
  190 |         present(payload: string): number {
  191 |             const r: ProbeRecord = { payload, armedAt: performance.now(), readAt: null, pendingAt: null, resultAt: null, result: null };
  192 |             records.push(r);
  193 |             armed = r;
  194 |             return records.length - 1;
  195 |         },
  196 |         tracks(): Array<{ kind: string; readyState: string }> {
  197 |             return streams.flatMap((s) => s.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState })));
  198 |         },
  199 |     };
  200 | }
  201 | 
  202 | interface ProbeHandle {
  203 |     records: ProbeRecord[];
  204 |     vibrations: ProbeVibration[];
  205 |     present(payload: string): number;
  206 |     tracks(): Array<{ kind: string; readyState: string }>;
  207 | }
  208 | 
  209 | /** Présente un payload au scanner et attend sa lecture puis le changement de résultat (sonde). */
  210 | export async function presentPayload(page: Page, payload: string, what: string, timeoutMs = 45_000): Promise<{ index: number; record: ProbeRecord }> {
  211 |     const index = await page.evaluate((p) => {
  212 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  213 |         if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
  214 |         return probe.present(p);
  215 |     }, payload);
  216 |     await expect.poll(async () => (await probeRecord(page, index)).readAt, {
  217 |         message: `${what} : le scanner n'a pas lu le QR présenté (caméra en pause, en veille, ou détection arrêtée)`, timeout: timeoutMs,
  218 |     }).not.toBeNull();
  219 |     await expect.poll(async () => (await probeRecord(page, index)).resultAt, {
  220 |         message: `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`, timeout: timeoutMs,
> 221 |     }).not.toBeNull();
      |            ^ Error: code qui ne se vérifie pas : aucun résultat de scan affiché ([data-scan-result]) après la lecture
  222 |     return { index, record: await probeRecord(page, index) };
  223 | }
  224 | 
  225 | /** Présente un payload sans attendre de résultat (lecture hors ligne : écran technique attendu). */
  226 | export async function presentPayloadNoResult(page: Page, payload: string, what: string): Promise<{ index: number; record: ProbeRecord }> {
  227 |     const index = await page.evaluate((p) => {
  228 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  229 |         if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
  230 |         return probe.present(p);
  231 |     }, payload);
  232 |     await expect.poll(async () => (await probeRecord(page, index)).readAt, { message: `${what} : le scanner n'a pas lu le QR présenté`, timeout: 30_000 }).not.toBeNull();
  233 |     return { index, record: await probeRecord(page, index) };
  234 | }
  235 | 
  236 | export async function probeRecord(page: Page, index: number): Promise<ProbeRecord> {
  237 |     return page.evaluate((i) => {
  238 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  239 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  240 |         const r = probe.records[i];
  241 |         if (!r) throw new Error(`lecture ${i} inconnue de la sonde`);
  242 |         return { ...r };
  243 |     }, index);
  244 | }
  245 | 
  246 | export async function probeVibrations(page: Page): Promise<ProbeVibration[]> {
  247 |     return page.evaluate(() => {
  248 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  249 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  250 |         return probe.vibrations.map((v) => ({ at: v.at, pattern: [...v.pattern] }));
  251 |     });
  252 | }
  253 | 
  254 | export async function probeTracks(page: Page): Promise<Array<{ kind: string; readyState: string }>> {
  255 |     return page.evaluate(() => {
  256 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  257 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  258 |         return probe.tracks();
  259 |     });
  260 | }
  261 | 
  262 | /** Marques de l'application (`performance.mark('ev-scan:read'|'ev-scan:pending'|'ev-scan:result')`). */
  263 | export async function scanMarks(page: Page): Promise<Array<{ name: string; startTime: number }>> {
  264 |     return page.evaluate(() => performance.getEntriesByType('mark')
  265 |         .filter((m) => m.name.startsWith('ev-scan:'))
  266 |         .map((m) => ({ name: m.name, startTime: m.startTime })));
  267 | }
  268 | 
  269 | // ── Écran du contrôleur ────────────────────────────────────────────────────
  270 | 
  271 | function escapeRe(s: string): string {
  272 |     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  273 | }
  274 | 
  275 | /**
  276 |  * Ouvre /controller/scanner, choisit l'événement (sélecteur d'événement de l'écran du lot 6, ou écran
  277 |  * « Commencer le contrôle » du lot 7, D49), passe en mode caméra et attend un flux vidéo en lecture.
  278 |  */
  279 | export async function openScanner(page: Page, eventTitle: string): Promise<void> {
  280 |     await page.goto('/controller/scanner');
  281 |     const titleRe = new RegExp(escapeRe(eventTitle));
  282 |     const select = page.locator('select').filter({ has: page.locator('option', { hasText: eventTitle }) });
  283 |     const radio = page.getByRole('radio', { name: titleRe });
  284 |     const eventButton = page.getByRole('button', { name: titleRe });
  285 |     const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  286 |     const heading = page.getByRole('heading', { name: titleRe });
  287 |     await expect(select.or(radio).or(eventButton).or(start).or(heading).first(),
  288 |         `scanner : l'événement « ${eventTitle} » n'est proposé ni dans le sélecteur ni sur l'écran de départ`).toBeVisible({ timeout: 45_000 });
  289 |     const usesSelect = await select.count() > 0;
  290 |     if (usesSelect) {
  291 |         const value = await select.first().locator('option', { hasText: eventTitle }).first().getAttribute('value');
  292 |         expect(value, `option de l'événement « ${eventTitle} »`).toBeTruthy();
  293 |         await select.first().selectOption(value as string);
  294 |         await expect(select.first(), `scanner : événement « ${eventTitle} » sélectionné`).toHaveValue(value as string);
  295 |     } else if (await radio.count() > 0) {
  296 |         await radio.first().check();
  297 |     } else if (await eventButton.count() > 0 && !(await heading.count())) {
  298 |         await eventButton.first().click();
  299 |     }
  300 |     if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  301 |     const camera = page.getByRole('button', { name: /^caméra$/i });
  302 |     if (await camera.count() > 0 && (await camera.first().getAttribute('aria-pressed')) !== 'true') await camera.first().click();
  303 |     if (!usesSelect) {
  304 |         await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
  305 |     }
  306 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  307 |         .catch((err: unknown) => {
  308 |             throw new Error(`scanner : aucun flux vidéo en lecture après le choix de l'événement (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  309 |         });
  310 | }
  311 | 
  312 | /** Payload du QR dynamique courant d'un billet, lu par la route du porteur depuis sa page (cookies de session). */
  313 | export async function livePayload(holderPage: Page, ticketId: string): Promise<string> {
  314 |     const out = await holderPage.evaluate(async (id) => {
  315 |         const res = await fetch(`/api/tickets/${id}/live-code`, { cache: 'no-store' });
  316 |         const text = await res.text();
  317 |         return { status: res.status, text };
  318 |     }, ticketId);
  319 |     if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
  320 |     let payload = '';
  321 |     try {
```