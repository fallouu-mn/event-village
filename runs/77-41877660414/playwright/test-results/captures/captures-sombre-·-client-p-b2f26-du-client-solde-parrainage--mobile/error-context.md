# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> portefeuille — Portefeuille du client (solde, parrainage)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de portefeuille__mobile__sombre.png

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
          - generic [ref=e40]:
            - heading "Portefeuille de parrainage" [level=1] [ref=e41]
            - paragraph [ref=e42]: Vos commissions N1 et N2 deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
          - region [ref=e43]:
            - heading "Soldes" [level=2] [ref=e44]
            - generic [ref=e45]:
              - generic [ref=e46]:
                - generic [ref=e47]: Disponible au retrait
                - generic [ref=e48]: Client standard
              - paragraph [ref=e52]: 0 F CFA
              - paragraph [ref=e53]: Commissions validées, retirables dès maintenant.
            - generic [ref=e54]:
              - generic [ref=e55]:
                - paragraph [ref=e56]: En attente
                - paragraph [ref=e60]: 0 F CFA
                - paragraph [ref=e61]: Chaque commission devient disponible après son délai de validation.
              - generic [ref=e62]:
                - paragraph [ref=e63]: Retraits en cours
                - paragraph [ref=e67]: 0 F CFA
                - paragraph [ref=e68]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e69]:
                - paragraph [ref=e70]: Créance
                - paragraph [ref=e74]: 0 F CFA
                - paragraph [ref=e75]: Aucune somme à compenser.
          - region [ref=e76]:
            - generic [ref=e77]:
              - heading "Retirer mes commissions" [level=2] [ref=e78]
              - paragraph [ref=e82]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e83]:
              - listitem [ref=e84]:
                - generic [aria-hidden] [ref=e85]: "1"
                - generic [ref=e86]: Demande
              - listitem [ref=e88]:
                - generic [aria-hidden] [ref=e89]: "2"
                - generic [ref=e90]: Code SMS
              - listitem [ref=e92]:
                - generic [aria-hidden] [ref=e93]: "3"
                - generic [ref=e94]: Suivi
            - generic [ref=e95]:
              - group "Recevoir sur" [ref=e96]:
                - generic [ref=e97]: Recevoir sur *
                - generic [ref=e98]:
                  - generic [ref=e99] [cursor=pointer]:
                    - radio "Wave" [ref=e100]
                    - generic [ref=e101]:
                      - generic [aria-hidden] [ref=e102]: W
                      - generic [ref=e103]: Wave
                  - generic [ref=e104] [cursor=pointer]:
                    - radio "Orange Money" [ref=e105]
                    - generic [ref=e106]:
                      - generic [aria-hidden] [ref=e107]: OM
                      - generic [ref=e108]: Orange Money
              - generic [ref=e109]:
                - generic [ref=e110]: Numéro Mobile Money qui reçoit le retrait *
                - textbox "Numéro Mobile Money qui reçoit le retrait" [ref=e111]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 05
                - paragraph [ref=e112]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e113]:
                - generic [ref=e114]: Montant à retirer (F CFA) *
                - textbox "Montant à retirer (F CFA)" [ref=e115]:
                  - /placeholder: "Ex : 10000"
                - paragraph [ref=e116]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e117]
          - region [ref=e123]:
            - generic [ref=e130]:
              - heading "Votre lien de parrainage" [level=2] [ref=e131]
              - paragraph [ref=e132]: "Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls."
            - generic [ref=e133]:
              - paragraph [ref=e134]: https://eventvillage.sn/r/EV-000105
              - button "Copier mon lien" [ref=e135] [cursor=pointer]
            - generic [ref=e141]:
              - generic [ref=e142]:
                - paragraph [ref=e143]: Génération 1 (filleuls directs)
                - generic [ref=e144]:
                  - generic [ref=e145]: 5 %
                  - generic [ref=e146]: 0 filleul
              - generic [ref=e147]:
                - paragraph [ref=e148]: Génération 2 (sous-filleuls)
                - generic [ref=e149]:
                  - generic [ref=e150]: 2 %
                  - generic [ref=e151]: 0 filleul
          - region [ref=e152]:
            - heading "Mes retraits" [level=2] [ref=e153]
            - generic [ref=e154]:
              - heading "Aucun retrait" [level=3] [ref=e159]
              - paragraph [ref=e160]: Vous n’avez pas encore retiré de commissions.
          - region [ref=e161]:
            - heading "Historique du compte" [level=2] [ref=e162]
            - generic [ref=e163]:
              - heading "Aucune opération" [level=3] [ref=e169]
              - paragraph [ref=e170]: "Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
    - navigation "Navigation rapide" [ref=e171]:
      - generic [ref=e172]:
        - link "Accueil" [ref=e173] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e178] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e183] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e187] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e192]
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
      |                                                                   ^ Error: contrôles bloquants de portefeuille__mobile__sombre.png
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