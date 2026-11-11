# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> verification-email — Vérification d’une adresse email — « Confirmer mon adresse » (rien n’est validé au chargement)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: statut HTTP du document /verify-email?t=e2e-jeton-factice-jamais-envoye-0123456789abcdef

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e37]:
          - paragraph [ref=e38]: Espaces métier
          - link "Devenir partenaire" [ref=e40] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e46]:
        - link "Se connecter" [ref=e47] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=e53] [cursor=pointer]
    - generic [ref=e61]:
      - banner [ref=e62]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e64] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e71] [cursor=pointer]
      - main [ref=e75]:
        - generic [ref=e77]:
          - paragraph [ref=e82]: Erreur 404
          - heading "Page introuvable" [level=1] [ref=e83]
          - paragraph [ref=e84]: Cette page n’existe pas ou n’est pas disponible. Vérifiez l’adresse, ou repartez de l’accueil.
          - generic [ref=e85]:
            - link "Retour à l’accueil" [ref=e86] [cursor=pointer]:
              - /url: /
            - link "Voir les événements" [ref=e92] [cursor=pointer]:
              - /url: /explore
  - alert [ref=e94]
```

# Test source

```ts
  164 | async function markAllOnOneLine(page: Page): Promise<string | null> {
  165 |     const button = page.getByRole('button', { name: /^tout marquer comme lu$/i }).first();
  166 |     if (await button.count() === 0) return 'bouton « Tout marquer comme lu » absent de la cloche ouverte (notifications non lues attendues)';
  167 |     // Lignes du LIBELLÉ seulement : les rectangles des nœuds texte. Un Range sur tout le contenu du bouton rend
  168 |     // aussi la boîte de l'icône (svg de 16 px centré, haut à 2 px de celui de la ligne de texte de 20 px), comptée
  169 |     // à tort comme une seconde ligne (run 77 : libellé sur une ligne à l'écran, « 2 lignes » relevées).
  170 |     const lines = await button.evaluate((el) => {
  171 |         const tops = new Set<number>();
  172 |         const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  173 |         for (let node = walker.nextNode(); node; node = walker.nextNode()) {
  174 |             if (!node.textContent?.trim()) continue;
  175 |             const range = document.createRange();
  176 |             range.selectNodeContents(node);
  177 |             for (const r of Array.from(range.getClientRects())) if (r.width > 0) tops.add(Math.round(r.top));
  178 |         }
  179 |         return tops.size;
  180 |     });
  181 |     return lines > 1 ? `« Tout marquer comme lu » sur ${lines} lignes à 390 px (une seule attendue, §4.6)` : null;
  182 | }
  183 | 
  184 | function defineCapture(screen: Screen, theme: { key: ThemeKey }, role: CaptureRole): void {
  185 |     test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
  186 |         const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
  187 |         const view = `${vue}-${theme.key}` as CaptureView;
  188 |         test.skip(Boolean(screen.views) && !screen.views?.includes(view), `vue ${view} non capturée pour cet écran (${(screen.views ?? []).join(', ')})`);
  189 |         const file = `${screen.id}__${vue}__${theme.key}.png`;
  190 |         const started = Date.now();
  191 |         const record: CaptureRecord = {
  192 |             file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
  193 |             url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
  194 |         };
  195 |         try {
  196 |             const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
  197 |             record.url = screen.path(demo);
  198 |             guard.configure({
  199 |                 allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
  200 |                 ignoreConsoleErrors: Boolean(screen.injectError),
  201 |             });
  202 |             if (screen.serviceWorkers === 'allow') record.notes.push('service worker autorisé dans ce contexte (D7 : bloqué partout ailleurs)');
  203 |             if (screen.initStorage) {
  204 |                 const entries = Object.entries(screen.initStorage);
  205 |                 record.notes.push(`localStorage posé avant le chargement : ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  206 |                 await context.addInitScript(setStorageBeforeLoad, entries);
  207 |             }
  208 |             if (screen.slowTimers) {
  209 |                 record.notes.push(`minuteries de ${screen.slowTimers.minDelayMs} ms ou plus étirées ×${screen.slowTimers.factor} (état tenu pendant les contrôles)`);
  210 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  211 |             }
  212 |             if (screen.injectError) {
  213 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  214 |                 await page.route(screen.injectError, (route) => route.fulfill({
  215 |                     status: 500,
  216 |                     contentType: 'application/json; charset=utf-8',
  217 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  218 |                 }));
  219 |             }
  220 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  221 |             for (const stub of stubs) {
  222 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  223 |                 await page.route(stub.url, async (route) => {
  224 |                     if (!methodMatches(stub.method, route.request().method())) {
  225 |                         await route.fallback();
  226 |                         return;
  227 |                     }
  228 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  229 |                 });
  230 |             }
  231 |             for (const hold of screen.holdRequests ?? []) {
  232 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  233 |                 await page.route(hold.url, async (route) => {
  234 |                     if (!methodMatches(hold.method, route.request().method())) {
  235 |                         await route.fallback();
  236 |                         return;
  237 |                     }
  238 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  239 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  240 |                 });
  241 |             }
  242 |             if (screen.fakePush) {
  243 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  244 |                 record.notes.push(screen.fakePush === 'granted'
  245 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  246 |                     : screen.fakePush === 'denied'
  247 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  248 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  249 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  250 |             }
  251 |             if (screen.fakeCamera) {
  252 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  253 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  254 |                 await context.addInitScript(installFakeCamera, { mode });
  255 |             }
  256 |             if (screen.offline === 'before-load') {
  257 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  258 |                 guard.freeze();
  259 |                 await context.setOffline(true);
  260 |             }
  261 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  262 |             record.status = response ? response.status() : null;
  263 |             if (screen.expectStatus !== undefined) {
> 264 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
      |                                                                                ^ Error: statut HTTP du document /verify-email?t=e2e-jeton-factice-jamais-envoye-0123456789abcdef
  265 |             }
  266 |             if (screen.offline === 'after-load') {
  267 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  268 |                 guard.freeze();
  269 |                 await context.setOffline(true);
  270 |             }
  271 |             const sc = { page, context, guard, ids: demo };
  272 |             if (screen.ready) await screen.ready(sc);
  273 |             await settle(page, guard, record.notes);
  274 |             if (screen.actions) {
  275 |                 await screen.actions(sc);
  276 |                 await settle(page, guard, record.notes);
  277 |             }
  278 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  279 |                 const problem = await markAllOnOneLine(page);
  280 |                 if (problem) record.blocking.push(problem);
  281 |             }
  282 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  283 |             record.blocking.push(...checks.blocking);
  284 |             record.warnings.push(...checks.warnings);
  285 |             record.axeDetails = checks.axeDetails;
  286 |             record.smallTextDetails = checks.smallTextDetails;
  287 |             record.metrics = checks.metrics;
  288 |             const shot = await capture(page, screen, file);
  289 |             record.captured = true;
  290 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  291 |         } catch (err) {
  292 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  293 |             if (!record.captured && !page.isClosed()) {
  294 |                 await capture(page, screen, file).then(
  295 |                     async (shot) => {
  296 |                         record.captured = true;
  297 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  298 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  299 |                     },
  300 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  301 |                 );
  302 |             }
  303 |             throw err;
  304 |         } finally {
  305 |             record.blocking.push(...guard.blockingIssues());
  306 |             record.warnings.push(...guard.nonBlockingIssues());
  307 |             record.durationMs = Date.now() - started;
  308 |             writeCaptureRecord(record);
  309 |         }
  310 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
  311 |     });
  312 | }
  313 | 
  314 | for (const theme of THEMES) {
  315 |     for (const role of ROLE_ORDER) {
  316 |         const screens = SCREENS.filter((s) => s.role === role);
  317 |         if (screens.length === 0) continue;
  318 |         test.describe(`${theme.key} · ${role}`, () => {
  319 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  320 | 
  321 |             for (const screen of screens) {
  322 |                 if (screen.serviceWorkers === 'allow') {
  323 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  324 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  325 |                         test.use({ serviceWorkers: 'allow' });
  326 |                         defineCapture(screen, theme, role);
  327 |                     });
  328 |                 } else {
  329 |                     defineCapture(screen, theme, role);
  330 |                 }
  331 |             }
  332 |         });
  333 |     }
  334 | }
  335 | 
```