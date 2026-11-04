# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 4. mesure du scan : 10 lectures en réseau normal, 10 en 3G, puis une lecture hors ligne
- Location: e2e/terrain.spec.ts:265:5

# Error details

```
Error: live-code du billet c4a61371-3a0b-4da4-b5af-f55545a8a581 : HTTP 409 {"error":"Ce billet n’est plus valable à l’entrée.","status":"UTILISE"}
```

# Test source

```ts
  219 |     await expect.poll(async () => (await probeRecord(page, index)).resultAt, {
  220 |         message: `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`, timeout: timeoutMs,
  221 |     }).not.toBeNull();
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
> 319 |     if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
      |                                   ^ Error: live-code du billet c4a61371-3a0b-4da4-b5af-f55545a8a581 : HTTP 409 {"error":"Ce billet n’est plus valable à l’entrée.","status":"UTILISE"}
  320 |     let payload = '';
  321 |     try {
  322 |         payload = String((JSON.parse(out.text) as { payload?: unknown }).payload ?? '');
  323 |     } catch (err) {
  324 |         throw new Error(`live-code du billet ${ticketId} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${out.text.slice(0, 200)}`);
  325 |     }
  326 |     if (!payload.includes(ticketId)) throw new Error(`live-code du billet ${ticketId} : payload inattendu « ${payload.slice(0, 120)} »`);
  327 |     return payload;
  328 | }
  329 | 
  330 | /** Payload dont le code ne se vérifie pas (même billet, même préfixe) : refus attendu (qr_expired / invalid). */
  331 | export function forgedPayload(payload: string): string {
  332 |     const m = /^(.*:)(\d{6})$/.exec(payload);
  333 |     if (!m) throw new Error(`payload sans code à 6 chiffres : « ${payload.slice(0, 120)} »`);
  334 |     const forged = String((Number(m[2]) + 500_001) % 1_000_000).padStart(6, '0');
  335 |     return `${m[1]}${forged}`;
  336 | }
  337 | 
  338 | // ── Statistiques et fichiers de mesure ─────────────────────────────────────
  339 | 
  340 | export function median(values: number[]): number | null {
  341 |     if (values.length === 0) return null;
  342 |     const s = [...values].sort((a, b) => a - b);
  343 |     const mid = Math.floor(s.length / 2);
  344 |     return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  345 | }
  346 | 
  347 | /** Centile par rang (nearest-rank) : p95 de 10 valeurs = la plus grande. */
  348 | export function percentile(values: number[], p: number): number | null {
  349 |     if (values.length === 0) return null;
  350 |     const s = [...values].sort((a, b) => a - b);
  351 |     const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  352 |     return s[rank - 1];
  353 | }
  354 | 
  355 | export function fmtMs(v: number | null): string {
  356 |     return v === null ? '—' : String(Math.round(v));
  357 | }
  358 | 
  359 | /** Écrit un TSV dans .e2e-captures/perf/ (remplace le fichier). */
  360 | export function writePerfFile(name: string, content: string): string {
  361 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  362 |     const file = path.join(PERF_DIR, name);
  363 |     fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  364 |     return file;
  365 | }
  366 | 
  367 | /** Ajoute des lignes à un fichier de .e2e-captures/perf/ ; l'en-tête n'est écrit qu'à la création. */
  368 | export function appendPerfFile(name: string, header: string | null, lines: string[]): string {
  369 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  370 |     const file = path.join(PERF_DIR, name);
  371 |     const prefix = !fs.existsSync(file) && header ? `${header}\n` : '';
  372 |     fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, 'utf8');
  373 |     return file;
  374 | }
  375 | 
```