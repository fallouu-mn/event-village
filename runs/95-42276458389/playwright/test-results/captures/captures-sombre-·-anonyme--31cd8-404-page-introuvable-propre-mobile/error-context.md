# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> evenement-introuvable — URL d’un événement inconnu : vrai 404, page introuvable propre
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: statut HTTP du document /events/00000000-0000-4000-8000-000000000404

expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 200
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
          - button "Notifications" [ref=e18] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e31] [cursor=pointer]:
            - /url: /login
      - main [ref=e35]:
        - generic [ref=e37]:
          - paragraph [ref=e44]: Erreur 404
          - heading "Événement introuvable" [level=1] [ref=e45]
          - paragraph [ref=e46]: Cet événement n’existe pas ou n’est pas ouvert au public. Vérifiez le lien reçu, ou parcourez les événements à venir.
          - generic [ref=e47]:
            - link "Voir les événements" [ref=e48] [cursor=pointer]:
              - /url: /explore
            - link "Retour à l’accueil" [ref=e54] [cursor=pointer]:
              - /url: /
    - navigation "Navigation rapide" [ref=e56]:
      - generic [ref=e57]:
        - link "Accueil" [ref=e58] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e63] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e68] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e72] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e77]
```

# Test source

```ts
  138 | async function markAllOnOneLine(page: Page): Promise<string | null> {
  139 |     const button = page.getByRole('button', { name: /^tout marquer comme lu$/i }).first();
  140 |     if (await button.count() === 0) return 'bouton « Tout marquer comme lu » absent de la cloche ouverte (notifications non lues attendues)';
  141 |     // Lignes du LIBELLÉ seulement : les rectangles des nœuds texte. Un Range sur tout le contenu du bouton rend
  142 |     // aussi la boîte de l'icône (svg de 16 px centré, haut à 2 px de celui de la ligne de texte de 20 px), comptée
  143 |     // à tort comme une seconde ligne (run 77 : libellé sur une ligne à l'écran, « 2 lignes » relevées).
  144 |     const lines = await button.evaluate((el) => {
  145 |         const tops = new Set<number>();
  146 |         const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  147 |         for (let node = walker.nextNode(); node; node = walker.nextNode()) {
  148 |             if (!node.textContent?.trim()) continue;
  149 |             const range = document.createRange();
  150 |             range.selectNodeContents(node);
  151 |             for (const r of Array.from(range.getClientRects())) if (r.width > 0) tops.add(Math.round(r.top));
  152 |         }
  153 |         return tops.size;
  154 |     });
  155 |     return lines > 1 ? `« Tout marquer comme lu » sur ${lines} lignes à 390 px (une seule attendue, §4.6)` : null;
  156 | }
  157 | 
  158 | function defineCapture(screen: Screen, theme: { key: ThemeKey }, role: CaptureRole): void {
  159 |     test(`${screen.id} — ${screen.titre}`, async ({ page, context, guard }, testInfo) => {
  160 |         const vue = testInfo.project.name === 'mobile' ? 'mobile' : 'ordinateur';
  161 |         const view = `${vue}-${theme.key}` as CaptureView;
  162 |         test.skip(Boolean(screen.views) && !screen.views?.includes(view), `vue ${view} non capturée pour cet écran (${(screen.views ?? []).join(', ')})`);
  163 |         const file = `${screen.id}__${vue}__${theme.key}.png`;
  164 |         const started = Date.now();
  165 |         const record: CaptureRecord = {
  166 |             file, screen: screen.id, titre: screen.titre, vue, theme: theme.key, role,
  167 |             url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: [], error: null, durationMs: 0,
  168 |         };
  169 |         try {
  170 |             const demo: DemoIds | null = screen.needsIds ? readDemoIds() : null;
  171 |             record.url = screen.path(demo);
  172 |             guard.configure({
  173 |                 allowFailures: [...(screen.allowFailures ?? []), ...(screen.injectError ? [screen.injectError] : [])],
  174 |                 ignoreConsoleErrors: Boolean(screen.injectError),
  175 |             });
  176 |             if (screen.serviceWorkers === 'allow') record.notes.push('service worker autorisé dans ce contexte (D7 : bloqué partout ailleurs)');
  177 |             if (screen.initStorage) {
  178 |                 const entries = Object.entries(screen.initStorage);
  179 |                 record.notes.push(`localStorage posé avant le chargement : ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  180 |                 await context.addInitScript(setStorageBeforeLoad, entries);
  181 |             }
  182 |             if (screen.slowTimers) {
  183 |                 record.notes.push(`minuteries de ${screen.slowTimers.minDelayMs} ms ou plus étirées ×${screen.slowTimers.factor} (état tenu pendant les contrôles)`);
  184 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  185 |             }
  186 |             if (screen.injectError) {
  187 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  188 |                 await page.route(screen.injectError, (route) => route.fulfill({
  189 |                     status: 500,
  190 |                     contentType: 'application/json; charset=utf-8',
  191 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  192 |                 }));
  193 |             }
  194 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  195 |             for (const stub of stubs) {
  196 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  197 |                 await page.route(stub.url, async (route) => {
  198 |                     if (!methodMatches(stub.method, route.request().method())) {
  199 |                         await route.fallback();
  200 |                         return;
  201 |                     }
  202 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  203 |                 });
  204 |             }
  205 |             for (const hold of screen.holdRequests ?? []) {
  206 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  207 |                 await page.route(hold.url, async (route) => {
  208 |                     if (!methodMatches(hold.method, route.request().method())) {
  209 |                         await route.fallback();
  210 |                         return;
  211 |                     }
  212 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  213 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  214 |                 });
  215 |             }
  216 |             if (screen.fakePush) {
  217 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  218 |                 record.notes.push(screen.fakePush === 'granted'
  219 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  220 |                     : screen.fakePush === 'denied'
  221 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  222 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  223 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  224 |             }
  225 |             if (screen.fakeCamera) {
  226 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  227 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  228 |                 await context.addInitScript(installFakeCamera, { mode });
  229 |             }
  230 |             if (screen.offline === 'before-load') {
  231 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  232 |                 guard.freeze();
  233 |                 await context.setOffline(true);
  234 |             }
  235 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  236 |             record.status = response ? response.status() : null;
  237 |             if (screen.expectStatus !== undefined) {
> 238 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
      |                                                                                ^ Error: statut HTTP du document /events/00000000-0000-4000-8000-000000000404
  239 |             }
  240 |             if (screen.offline === 'after-load') {
  241 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  242 |                 guard.freeze();
  243 |                 await context.setOffline(true);
  244 |             }
  245 |             const sc = { page, context, guard, ids: demo };
  246 |             if (screen.ready) await screen.ready(sc);
  247 |             await settle(page, guard, record.notes);
  248 |             if (screen.actions) {
  249 |                 await screen.actions(sc);
  250 |                 await settle(page, guard, record.notes);
  251 |             }
  252 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  253 |                 const problem = await markAllOnOneLine(page);
  254 |                 if (problem) record.blocking.push(problem);
  255 |             }
  256 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  257 |             record.blocking.push(...checks.blocking);
  258 |             record.warnings.push(...checks.warnings);
  259 |             record.axeDetails = checks.axeDetails;
  260 |             record.smallTextDetails = checks.smallTextDetails;
  261 |             record.metrics = checks.metrics;
  262 |             const shot = await capture(page, screen, file);
  263 |             record.captured = true;
  264 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |         } catch (err) {
  266 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  267 |             if (!record.captured && !page.isClosed()) {
  268 |                 await capture(page, screen, file).then(
  269 |                     async (shot) => {
  270 |                         record.captured = true;
  271 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  272 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  273 |                     },
  274 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  275 |                 );
  276 |             }
  277 |             throw err;
  278 |         } finally {
  279 |             record.blocking.push(...guard.blockingIssues());
  280 |             record.warnings.push(...guard.nonBlockingIssues());
  281 |             record.durationMs = Date.now() - started;
  282 |             writeCaptureRecord(record);
  283 |         }
  284 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
  285 |     });
  286 | }
  287 | 
  288 | for (const theme of THEMES) {
  289 |     for (const role of ROLE_ORDER) {
  290 |         const screens = SCREENS.filter((s) => s.role === role);
  291 |         if (screens.length === 0) continue;
  292 |         test.describe(`${theme.key} · ${role}`, () => {
  293 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  294 | 
  295 |             for (const screen of screens) {
  296 |                 if (screen.serviceWorkers === 'allow') {
  297 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  298 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  299 |                         test.use({ serviceWorkers: 'allow' });
  300 |                         defineCapture(screen, theme, role);
  301 |                     });
  302 |                 } else {
  303 |                     defineCapture(screen, theme, role);
  304 |                 }
  305 |             }
  306 |         });
  307 |     }
  308 | }
  309 | 
```