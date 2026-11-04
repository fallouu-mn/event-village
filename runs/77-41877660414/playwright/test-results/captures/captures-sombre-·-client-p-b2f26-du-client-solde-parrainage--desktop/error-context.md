# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> portefeuille — Portefeuille du client (solde, parrainage)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de portefeuille__ordinateur__sombre.png

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
          - button "Basculer le thème" [pressed] [ref=e58] [cursor=pointer]
    - generic [ref=e66]:
      - banner [ref=e67]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e69] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 8 non lues" [ref=e76] [cursor=pointer]:
          - generic [ref=e80]: "8"
      - main [ref=e81]:
        - generic [ref=e83]:
          - generic [ref=e86]:
            - heading "Portefeuille de parrainage" [level=1] [ref=e87]
            - paragraph [ref=e88]: Vos commissions N1 et N2 deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
          - region [ref=e89]:
            - heading "Soldes" [level=2] [ref=e90]
            - generic [ref=e91]:
              - generic [ref=e92]:
                - generic [ref=e93]: Disponible au retrait
                - generic [ref=e94]: Client standard
              - paragraph [ref=e98]: 0 F CFA
              - paragraph [ref=e99]: Commissions validées, retirables dès maintenant.
            - generic [ref=e100]:
              - generic [ref=e101]:
                - paragraph [ref=e102]: En attente
                - paragraph [ref=e106]: 0 F CFA
                - paragraph [ref=e107]: Chaque commission devient disponible après son délai de validation.
              - generic [ref=e108]:
                - paragraph [ref=e109]: Retraits en cours
                - paragraph [ref=e113]: 0 F CFA
                - paragraph [ref=e114]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e115]:
                - paragraph [ref=e116]: Créance
                - paragraph [ref=e120]: 0 F CFA
                - paragraph [ref=e121]: Aucune somme à compenser.
          - region [ref=e122]:
            - generic [ref=e123]:
              - heading "Retirer mes commissions" [level=2] [ref=e124]
              - paragraph [ref=e128]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e129]:
              - listitem [ref=e130]:
                - generic [aria-hidden] [ref=e131]: "1"
                - generic [ref=e132]: Demande
              - listitem [ref=e134]:
                - generic [aria-hidden] [ref=e135]: "2"
                - generic [ref=e136]: Code SMS
              - listitem [ref=e138]:
                - generic [aria-hidden] [ref=e139]: "3"
                - generic [ref=e140]: Suivi
            - generic [ref=e141]:
              - group "Recevoir sur" [ref=e142]:
                - generic [ref=e143]: Recevoir sur *
                - generic [ref=e144]:
                  - generic [ref=e145] [cursor=pointer]:
                    - radio "Wave" [ref=e146]
                    - generic [ref=e147]:
                      - generic [aria-hidden] [ref=e148]: W
                      - generic [ref=e149]: Wave
                  - generic [ref=e150] [cursor=pointer]:
                    - radio "Orange Money" [ref=e151]
                    - generic [ref=e152]:
                      - generic [aria-hidden] [ref=e153]: OM
                      - generic [ref=e154]: Orange Money
              - generic [ref=e155]:
                - generic [ref=e156]: Numéro Mobile Money qui reçoit le retrait *
                - textbox "Numéro Mobile Money qui reçoit le retrait" [ref=e157]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 05
                - paragraph [ref=e158]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e159]:
                - generic [ref=e160]: Montant à retirer (F CFA) *
                - textbox "Montant à retirer (F CFA)" [ref=e161]:
                  - /placeholder: "Ex : 10000"
                - paragraph [ref=e162]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e163]
          - region [ref=e169]:
            - generic [ref=e176]:
              - heading "Votre lien de parrainage" [level=2] [ref=e177]
              - paragraph [ref=e178]: "Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls."
            - generic [ref=e179]:
              - paragraph [ref=e180]: https://eventvillage.sn/r/EV-000105
              - button "Copier mon lien" [ref=e181] [cursor=pointer]
            - generic [ref=e187]:
              - generic [ref=e188]:
                - paragraph [ref=e189]: Génération 1 (filleuls directs)
                - generic [ref=e190]:
                  - generic [ref=e191]: 5 %
                  - generic [ref=e192]: 0 filleul
              - generic [ref=e193]:
                - paragraph [ref=e194]: Génération 2 (sous-filleuls)
                - generic [ref=e195]:
                  - generic [ref=e196]: 2 %
                  - generic [ref=e197]: 0 filleul
          - region [ref=e198]:
            - heading "Mes retraits" [level=2] [ref=e199]
            - generic [ref=e200]:
              - heading "Aucun retrait" [level=3] [ref=e205]
              - paragraph [ref=e206]: Vous n’avez pas encore retiré de commissions.
          - region [ref=e207]:
            - heading "Historique du compte" [level=2] [ref=e208]
            - generic [ref=e209]:
              - heading "Aucune opération" [level=3] [ref=e215]
              - paragraph [ref=e216]: "Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
  - alert [ref=e217]
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
      |                                                                   ^ Error: contrôles bloquants de portefeuille__ordinateur__sombre.png
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