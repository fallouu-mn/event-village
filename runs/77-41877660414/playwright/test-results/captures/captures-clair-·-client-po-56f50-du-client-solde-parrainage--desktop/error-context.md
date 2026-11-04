# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> portefeuille — Portefeuille du client (solde, parrainage)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de portefeuille__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core color-contrast (serious, 1 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
+ ]
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
        - link "Fatou Mbaye Client" [ref=e47] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e48]: FM
          - generic [ref=e49]:
            - generic [ref=e50]: Fatou Mbaye
            - generic [ref=e51]: Client
        - generic [ref=e52]:
          - button "Se déconnecter" [ref=e53] [cursor=pointer]
          - button "Basculer le thème" [ref=e58] [cursor=pointer]
    - generic [ref=e62]:
      - banner [ref=e63]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e65] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 8 non lues" [ref=e72] [cursor=pointer]:
          - generic [ref=e76]: "8"
      - main [ref=e77]:
        - generic [ref=e79]:
          - generic [ref=e82]:
            - heading "Portefeuille de parrainage" [level=1] [ref=e83]
            - paragraph [ref=e84]: Vos commissions N1 et N2 deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
          - region [ref=e85]:
            - heading "Soldes" [level=2] [ref=e86]
            - generic [ref=e87]:
              - generic [ref=e88]:
                - generic [ref=e89]: Disponible au retrait
                - generic [ref=e90]: Client standard
              - paragraph [ref=e94]: 0 F CFA
              - paragraph [ref=e95]: Commissions validées, retirables dès maintenant.
            - generic [ref=e96]:
              - generic [ref=e97]:
                - paragraph [ref=e98]: En attente
                - paragraph [ref=e102]: 0 F CFA
                - paragraph [ref=e103]: Chaque commission devient disponible après son délai de validation.
              - generic [ref=e104]:
                - paragraph [ref=e105]: Retraits en cours
                - paragraph [ref=e109]: 0 F CFA
                - paragraph [ref=e110]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e111]:
                - paragraph [ref=e112]: Créance
                - paragraph [ref=e116]: 0 F CFA
                - paragraph [ref=e117]: Aucune somme à compenser.
          - region [ref=e118]:
            - generic [ref=e119]:
              - heading "Retirer mes commissions" [level=2] [ref=e120]
              - paragraph [ref=e124]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e125]:
              - listitem [ref=e126]:
                - generic [aria-hidden] [ref=e127]: "1"
                - generic [ref=e128]: Demande
              - listitem [ref=e130]:
                - generic [aria-hidden] [ref=e131]: "2"
                - generic [ref=e132]: Code SMS
              - listitem [ref=e134]:
                - generic [aria-hidden] [ref=e135]: "3"
                - generic [ref=e136]: Suivi
            - generic [ref=e137]:
              - group "Recevoir sur" [ref=e138]:
                - generic [ref=e139]: Recevoir sur *
                - generic [ref=e140]:
                  - generic [ref=e141] [cursor=pointer]:
                    - radio "Wave" [ref=e142]
                    - generic [ref=e143]:
                      - generic [aria-hidden] [ref=e144]: W
                      - generic [ref=e145]: Wave
                  - generic [ref=e146] [cursor=pointer]:
                    - radio "Orange Money" [ref=e147]
                    - generic [ref=e148]:
                      - generic [aria-hidden] [ref=e149]: OM
                      - generic [ref=e150]: Orange Money
              - generic [ref=e151]:
                - generic [ref=e152]: Numéro Mobile Money qui reçoit le retrait *
                - textbox "Numéro Mobile Money qui reçoit le retrait" [ref=e153]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 05
                - paragraph [ref=e154]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e155]:
                - generic [ref=e156]: Montant à retirer (F CFA) *
                - textbox "Montant à retirer (F CFA)" [ref=e157]:
                  - /placeholder: "Ex : 10000"
                - paragraph [ref=e158]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e159]
          - region [ref=e165]:
            - generic [ref=e172]:
              - heading "Votre lien de parrainage" [level=2] [ref=e173]
              - paragraph [ref=e174]: "Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls."
            - generic [ref=e175]:
              - paragraph [ref=e176]: https://eventvillage.sn/r/EV-000105
              - button "Copier mon lien" [ref=e177] [cursor=pointer]
            - generic [ref=e183]:
              - generic [ref=e184]:
                - paragraph [ref=e185]: Génération 1 (filleuls directs)
                - generic [ref=e186]:
                  - generic [ref=e187]: 5 %
                  - generic [ref=e188]: 0 filleul
              - generic [ref=e189]:
                - paragraph [ref=e190]: Génération 2 (sous-filleuls)
                - generic [ref=e191]:
                  - generic [ref=e192]: 2 %
                  - generic [ref=e193]: 0 filleul
          - region [ref=e194]:
            - heading "Mes retraits" [level=2] [ref=e195]
            - generic [ref=e196]:
              - heading "Aucun retrait" [level=3] [ref=e201]
              - paragraph [ref=e202]: Vous n’avez pas encore retiré de commissions.
          - region [ref=e203]:
            - heading "Historique du compte" [level=2] [ref=e204]
            - generic [ref=e205]:
              - heading "Aucune opération" [level=3] [ref=e211]
              - paragraph [ref=e212]: "Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
  - alert [ref=e213]
```

# Test source

```ts
  176 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  177 |             }
  178 |             if (screen.injectError) {
  179 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  180 |                 await page.route(screen.injectError, (route) => route.fulfill({
  181 |                     status: 500,
  182 |                     contentType: 'application/json; charset=utf-8',
  183 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  184 |                 }));
  185 |             }
  186 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  187 |             for (const stub of stubs) {
  188 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  189 |                 await page.route(stub.url, async (route) => {
  190 |                     if (!methodMatches(stub.method, route.request().method())) {
  191 |                         await route.fallback();
  192 |                         return;
  193 |                     }
  194 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  195 |                 });
  196 |             }
  197 |             for (const hold of screen.holdRequests ?? []) {
  198 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  199 |                 await page.route(hold.url, async (route) => {
  200 |                     if (!methodMatches(hold.method, route.request().method())) {
  201 |                         await route.fallback();
  202 |                         return;
  203 |                     }
  204 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  205 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  206 |                 });
  207 |             }
  208 |             if (screen.fakePush) {
  209 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  210 |                 record.notes.push(screen.fakePush === 'granted'
  211 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  212 |                     : screen.fakePush === 'denied'
  213 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  214 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  215 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  216 |             }
  217 |             if (screen.fakeCamera) {
  218 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  219 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  220 |                 await context.addInitScript(installFakeCamera, { mode });
  221 |             }
  222 |             if (screen.offline === 'before-load') {
  223 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  224 |                 guard.freeze();
  225 |                 await context.setOffline(true);
  226 |             }
  227 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  228 |             record.status = response ? response.status() : null;
  229 |             if (screen.expectStatus !== undefined) {
  230 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  231 |             }
  232 |             if (screen.offline === 'after-load') {
  233 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  234 |                 guard.freeze();
  235 |                 await context.setOffline(true);
  236 |             }
  237 |             const sc = { page, context, guard, ids: demo };
  238 |             if (screen.ready) await screen.ready(sc);
  239 |             await settle(page, guard, record.notes);
  240 |             if (screen.actions) {
  241 |                 await screen.actions(sc);
  242 |                 await settle(page, guard, record.notes);
  243 |             }
  244 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  245 |                 const problem = await markAllOnOneLine(page);
  246 |                 if (problem) record.blocking.push(problem);
  247 |             }
  248 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  249 |             record.blocking.push(...checks.blocking);
  250 |             record.warnings.push(...checks.warnings);
  251 |             record.axeDetails = checks.axeDetails;
  252 |             record.smallTextDetails = checks.smallTextDetails;
  253 |             record.metrics = checks.metrics;
  254 |             const shot = await capture(page, screen, file);
  255 |             record.captured = true;
  256 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  257 |         } catch (err) {
  258 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  259 |             if (!record.captured && !page.isClosed()) {
  260 |                 await capture(page, screen, file).then(
  261 |                     async (shot) => {
  262 |                         record.captured = true;
  263 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  264 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |                     },
  266 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  267 |                 );
  268 |             }
  269 |             throw err;
  270 |         } finally {
  271 |             record.blocking.push(...guard.blockingIssues());
  272 |             record.warnings.push(...guard.nonBlockingIssues());
  273 |             record.durationMs = Date.now() - started;
  274 |             writeCaptureRecord(record);
  275 |         }
> 276 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de portefeuille__ordinateur__clair.png
  277 |     });
  278 | }
  279 | 
  280 | for (const theme of THEMES) {
  281 |     for (const role of ROLE_ORDER) {
  282 |         const screens = SCREENS.filter((s) => s.role === role);
  283 |         if (screens.length === 0) continue;
  284 |         test.describe(`${theme.key} · ${role}`, () => {
  285 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  286 | 
  287 |             for (const screen of screens) {
  288 |                 if (screen.serviceWorkers === 'allow') {
  289 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  290 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  291 |                         test.use({ serviceWorkers: 'allow' });
  292 |                         defineCapture(screen, theme, role);
  293 |                     });
  294 |                 } else {
  295 |                     defineCapture(screen, theme, role);
  296 |                 }
  297 |             }
  298 |         });
  299 |     }
  300 | }
  301 | 
```