# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: statut HTTP du document /profile/payments

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 8 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "8"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: FM
      - main [ref=e35]:
        - generic [ref=e37]:
          - paragraph [ref=e42]: Erreur 404
          - heading "Page introuvable" [level=1] [ref=e43]
          - paragraph [ref=e44]: Cette page n’existe pas ou n’est pas disponible. Vérifiez l’adresse, ou repartez de l’accueil.
          - generic [ref=e45]:
            - link "Retour à l’accueil" [ref=e46] [cursor=pointer]:
              - /url: /
            - link "Voir les événements" [ref=e52] [cursor=pointer]:
              - /url: /explore
    - navigation "Navigation rapide" [ref=e54]:
      - generic [ref=e55]:
        - link "Accueil" [ref=e56] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e61] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e66] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e70] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e75]
```

# Test source

```ts
  153 | async function markAllOnOneLine(page: Page): Promise<string | null> {
  154 |     const button = page.getByRole('button', { name: /^tout marquer comme lu$/i }).first();
  155 |     if (await button.count() === 0) return 'bouton « Tout marquer comme lu » absent de la cloche ouverte (notifications non lues attendues)';
  156 |     // Lignes du LIBELLÉ seulement : les rectangles des nœuds texte. Un Range sur tout le contenu du bouton rend
  157 |     // aussi la boîte de l'icône (svg de 16 px centré, haut à 2 px de celui de la ligne de texte de 20 px), comptée
  158 |     // à tort comme une seconde ligne (run 77 : libellé sur une ligne à l'écran, « 2 lignes » relevées).
  159 |     const lines = await button.evaluate((el) => {
  160 |         const tops = new Set<number>();
  161 |         const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  162 |         for (let node = walker.nextNode(); node; node = walker.nextNode()) {
  163 |             if (!node.textContent?.trim()) continue;
  164 |             const range = document.createRange();
  165 |             range.selectNodeContents(node);
  166 |             for (const r of Array.from(range.getClientRects())) if (r.width > 0) tops.add(Math.round(r.top));
  167 |         }
  168 |         return tops.size;
  169 |     });
  170 |     return lines > 1 ? `« Tout marquer comme lu » sur ${lines} lignes à 390 px (une seule attendue, §4.6)` : null;
  171 | }
  172 | 
  173 | function defineCapture(screen: Screen, theme: { key: ThemeKey }, role: CaptureRole): void {
  174 |     test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
  175 |         const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
  176 |         const view = `${vue}-${theme.key}` as CaptureView;
  177 |         test.skip(Boolean(screen.views) && !screen.views?.includes(view), `vue ${view} non capturée pour cet écran (${(screen.views ?? []).join(', ')})`);
  178 |         const file = `${screen.id}__${vue}__${theme.key}.png`;
  179 |         const started = Date.now();
  180 |         const record: CaptureRecord = {
  181 |             file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
  182 |             url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
  183 |         };
  184 |         try {
  185 |             const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
  186 |             record.url = screen.path(demo);
  187 |             guard.configure({
  188 |                 allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
  189 |                 ignoreConsoleErrors: Boolean(screen.injectError),
  190 |             });
  191 |             if (screen.serviceWorkers === 'allow') record.notes.push('service worker autorisé dans ce contexte (D7 : bloqué partout ailleurs)');
  192 |             if (screen.initStorage) {
  193 |                 const entries = Object.entries(screen.initStorage);
  194 |                 record.notes.push(`localStorage posé avant le chargement : ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  195 |                 await context.addInitScript(setStorageBeforeLoad, entries);
  196 |             }
  197 |             if (screen.slowTimers) {
  198 |                 record.notes.push(`minuteries de ${screen.slowTimers.minDelayMs} ms ou plus étirées ×${screen.slowTimers.factor} (état tenu pendant les contrôles)`);
  199 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  200 |             }
  201 |             if (screen.injectError) {
  202 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  203 |                 await page.route(screen.injectError, (route) => route.fulfill({
  204 |                     status: 500,
  205 |                     contentType: 'application/json; charset=utf-8',
  206 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  207 |                 }));
  208 |             }
  209 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  210 |             for (const stub of stubs) {
  211 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  212 |                 await page.route(stub.url, async (route) => {
  213 |                     if (!methodMatches(stub.method, route.request().method())) {
  214 |                         await route.fallback();
  215 |                         return;
  216 |                     }
  217 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  218 |                 });
  219 |             }
  220 |             for (const hold of screen.holdRequests ?? []) {
  221 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  222 |                 await page.route(hold.url, async (route) => {
  223 |                     if (!methodMatches(hold.method, route.request().method())) {
  224 |                         await route.fallback();
  225 |                         return;
  226 |                     }
  227 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  228 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  229 |                 });
  230 |             }
  231 |             if (screen.fakePush) {
  232 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  233 |                 record.notes.push(screen.fakePush === 'granted'
  234 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  235 |                     : screen.fakePush === 'denied'
  236 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  237 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  238 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  239 |             }
  240 |             if (screen.fakeCamera) {
  241 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  242 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  243 |                 await context.addInitScript(installFakeCamera, { mode });
  244 |             }
  245 |             if (screen.offline === 'before-load') {
  246 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  247 |                 guard.freeze();
  248 |                 await context.setOffline(true);
  249 |             }
  250 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  251 |             record.status = response ? response.status() : null;
  252 |             if (screen.expectStatus !== undefined) {
> 253 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
      |                                                                                ^ Error: statut HTTP du document /profile/payments
  254 |             }
  255 |             if (screen.offline === 'after-load') {
  256 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  257 |                 guard.freeze();
  258 |                 await context.setOffline(true);
  259 |             }
  260 |             const sc = { page, context, guard, ids: demo };
  261 |             if (screen.ready) await screen.ready(sc);
  262 |             await settle(page, guard, record.notes);
  263 |             if (screen.actions) {
  264 |                 await screen.actions(sc);
  265 |                 await settle(page, guard, record.notes);
  266 |             }
  267 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  268 |                 const problem = await markAllOnOneLine(page);
  269 |                 if (problem) record.blocking.push(problem);
  270 |             }
  271 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  272 |             record.blocking.push(...checks.blocking);
  273 |             record.warnings.push(...checks.warnings);
  274 |             record.axeDetails = checks.axeDetails;
  275 |             record.smallTextDetails = checks.smallTextDetails;
  276 |             record.metrics = checks.metrics;
  277 |             const shot = await capture(page, screen, file);
  278 |             record.captured = true;
  279 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  280 |         } catch (err) {
  281 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  282 |             if (!record.captured && !page.isClosed()) {
  283 |                 await capture(page, screen, file).then(
  284 |                     async (shot) => {
  285 |                         record.captured = true;
  286 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  287 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  288 |                     },
  289 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  290 |                 );
  291 |             }
  292 |             throw err;
  293 |         } finally {
  294 |             record.blocking.push(...guard.blockingIssues());
  295 |             record.warnings.push(...guard.nonBlockingIssues());
  296 |             record.durationMs = Date.now() - started;
  297 |             writeCaptureRecord(record);
  298 |         }
  299 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
  300 |     });
  301 | }
  302 | 
  303 | for (const theme of THEMES) {
  304 |     for (const role of ROLE_ORDER) {
  305 |         const screens = SCREENS.filter((s) => s.role === role);
  306 |         if (screens.length === 0) continue;
  307 |         test.describe(`${theme.key} · ${role}`, () => {
  308 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  309 | 
  310 |             for (const screen of screens) {
  311 |                 if (screen.serviceWorkers === 'allow') {
  312 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  313 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  314 |                         test.use({ serviceWorkers: 'allow' });
  315 |                         defineCapture(screen, theme, role);
  316 |                     });
  317 |                 } else {
  318 |                     defineCapture(screen, theme, role);
  319 |                 }
  320 |             }
  321 |         });
  322 |     }
  323 | }
  324 | 
```