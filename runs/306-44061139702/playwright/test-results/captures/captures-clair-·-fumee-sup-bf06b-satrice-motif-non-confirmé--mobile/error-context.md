# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-especes-rendues — Administration — événement annulé : « Marquer rendu » à la place de l’organisatrice, motif (non confirmé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-especes-rendues__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 1 nœud(s)) : Elements must have their visible text as part of their accessible name",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 58 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "58"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: ES
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Mes événements" [ref=e36] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e42]:
              - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e44]': Annulé
              - heading "Croisière musicale vers Gorée" [level=1] [ref=e47]
              - paragraph [ref=e48]:
                - generic [ref=e49]:
                  - generic [ref=e50]: mar. 17 nov. 2026 à 15:00
                  - generic [ref=e53]: Embarcadère du port de Dakar, Dakar
          - region [ref=e57]:
            - generic [ref=e58]:
              - generic [ref=e59]:
                - heading "Remboursements" [level=2] [ref=e60]
                - paragraph [ref=e61]: Avancement des remboursements des billets payés en ligne après l’annulation.
              - button "Actualiser l’avancement des remboursements" [ref=e62] [cursor=pointer]
            - generic [ref=e69]:
              - status [ref=e70]:
                - generic [ref=e75]:
                  - paragraph [ref=e76]: "Retardé : l’équipe Event Village s’en occupe"
                  - paragraph [ref=e78]: "2 remboursements (18 900 F CFA) : versement retardé, repris par l’équipe Event Village. Rien n’est à faire de votre côté."
              - generic [ref=e79]:
                - generic [ref=e80]:
                  - paragraph [ref=e82]: Versés
                  - paragraph [ref=e87]: 113 400 F CFA
                  - paragraph [ref=e88]: 5 remboursements
                - generic [ref=e89]:
                  - paragraph [ref=e91]: En cours
                  - paragraph [ref=e96]: 25 200 F CFA
                  - paragraph [ref=e97]: 2 remboursements
                - generic [ref=e98]:
                  - paragraph [ref=e100]: En vérification
                  - paragraph [ref=e106]: 18 900 F CFA
                  - paragraph [ref=e107]: "2 remboursements : issue à confirmer auprès de l’opérateur"
                - generic [ref=e108]:
                  - paragraph [ref=e110]: À reprendre
                  - paragraph [ref=e115]: 0 F CFA
                  - paragraph [ref=e116]: 0 remboursements échoués ou bloqués, à reprendre
              - generic [ref=e117]:
                - paragraph [ref=e119]: Espèces du guichet rendues par l’organisateur
                - paragraph [ref=e124]: 0 F CFA sur 18 000 F CFA
                - paragraph [ref=e125]: 0 vente sur 1 cochée « Remboursé » (jamais remboursées par Event Village)
          - region [ref=e126]:
            - generic [ref=e127]:
              - generic [ref=e128]:
                - heading "Espèces à rembourser par l’organisateur" [level=2] [ref=e129]
                - paragraph [ref=e130]: "Ventes au guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis cochez « Remboursé »."
              - button "Actualiser la liste des espèces à rembourser" [ref=e131] [cursor=pointer]
            - generic [ref=e138]:
              - generic [ref=e139]:
                - generic [ref=e140]:
                  - paragraph [ref=e142]: Ventes au guichet
                  - paragraph [ref=e147]: 18 000 F CFA
                  - paragraph [ref=e148]: 1 vente à rendre en espèces
                - generic [ref=e149]:
                  - paragraph [ref=e151]: Déjà remboursé
                  - paragraph [ref=e156]: 0 F CFA
                  - paragraph [ref=e157]: 0 vente cochée « Remboursé » sur 1
              - status [ref=e158]:
                - generic [ref=e163]:
                  - paragraph [ref=e164]: À la place de l’organisatrice
                  - generic [ref=e165]: "Si l’organisatrice ne peut pas le faire, marquez rendues les espèces d’une vente avec un motif : elle en est prévenue."
              - list "Ventes au guichet à rembourser en espèces" [ref=e166]:
                - listitem [ref=e167]:
                  - generic [ref=e168]:
                    - paragraph [ref=e169]:
                      - generic [ref=e170]: Vente 7B51FF88
                      - generic [ref=e171]: 18 000 F CFA
                    - paragraph [ref=e172]: 2 billets · *** ** 05
                    - paragraph [ref=e173]:
                      - text: Vendue le
                      - time [ref=e174]: mar. 17 nov. 2026 à 10:58
                      - text: par Lamine Cissé
                  - button "Marquer rendues les espèces de la vente 7B51FF88, 18 000 F CFA" [ref=e176] [cursor=pointer]:
                    - generic [ref=e177]: Marquer rendu
          - generic [ref=e178]:
            - tablist "Rubriques du pilotage" [ref=e181]:
              - tab "Aperçu" [selected] [ref=e182] [cursor=pointer]
              - tab "Infos" [ref=e184] [cursor=pointer]
              - tab "Ventes" [ref=e186] [cursor=pointer]
              - tab "Invitations" [ref=e188] [cursor=pointer]
              - tab "Entrées" [ref=e190] [cursor=pointer]
              - tab "Équipe" [ref=e192] [cursor=pointer]
              - tab "Caisse" [ref=e194] [cursor=pointer]
              - tab "Clôture" [ref=e196] [cursor=pointer]
            - tabpanel "Aperçu" [ref=e198]:
              - generic [ref=e199]:
                - region [ref=e200]:
                  - generic [ref=e202]:
                    - heading "Billetterie" [level=2] [ref=e203]
                    - paragraph [ref=e204]: Billets valides et utilisés, hors invitations.
                  - generic [ref=e205]:
                    - generic [ref=e206]:
                      - paragraph [ref=e208]: Billets vendus
                      - paragraph [ref=e212]: "2"
                      - paragraph [ref=e213]: Toutes catégories, y compris désactivées
                    - generic [ref=e214]:
                      - paragraph [ref=e216]: Vente
                      - paragraph [ref=e222]: Arrêtée
                      - paragraph [ref=e223]: "Événement annulé : aucune place n’est plus proposée"
                    - generic [ref=e224]:
                      - paragraph [ref=e226]: Invitations
                      - paragraph [ref=e232]: "0"
                      - paragraph [ref=e233]: Places offertes, comptées à part
                - region [ref=e234]:
                  - generic [ref=e236]:
                    - heading "Contrôle d’accès" [level=2] [ref=e237]
                    - paragraph [ref=e238]: Passages validés au scan et au guichet.
                  - generic [ref=e239]:
                    - generic [ref=e240]:
                      - paragraph [ref=e242]: Entrées
                      - paragraph [ref=e247]: "2"
                      - paragraph [ref=e248]: dont 2 au guichet
                    - generic [ref=e249]:
                      - paragraph [ref=e251]: Taux de présence
                      - paragraph [ref=e257]: 100 %
                      - paragraph [ref=e258]: Part des participants attendus (ventes et invitations) déjà passés
                - region [ref=e259]:
                  - generic [ref=e261]:
                    - heading "Recettes" [level=2] [ref=e262]
                    - paragraph [ref=e263]: Montants des billets, remboursements déduits pour les ventes en ligne.
                  - generic [ref=e264]:
                    - generic [ref=e265]:
                      - paragraph [ref=e267]: En ligne
                      - paragraph [ref=e271]:
                        - generic [ref=e272]: 0 F CFA
                      - paragraph [ref=e273]: Paiements mobiles confirmés
                    - generic [ref=e274]:
                      - paragraph [ref=e276]: En espèces
                      - paragraph [ref=e281]:
                        - generic [ref=e282]: 18 000 F CFA
                      - paragraph [ref=e283]: Encaissées par vos contrôleurs
                    - generic [ref=e284]:
                      - paragraph [ref=e286]: Remboursé
                      - paragraph [ref=e291]:
                        - generic [ref=e292]: 150 000 F CFA
                      - paragraph [ref=e293]: Remboursements en ligne
                - paragraph [ref=e294]:
                  - text: Chiffres calculés le
                  - time [ref=e295]: mar. 17 nov. 2026 à 11:04
                  - text: .
    - navigation "Navigation rapide" [ref=e296]:
      - generic [ref=e297]:
        - link "Accueil" [ref=e298] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e303] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e308] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e312] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e317]
  - alertdialog [ref=e320]:
    - generic [ref=e321]:
      - heading "Marquer ces espèces rendues ?" [level=2] [ref=e324]
      - button "Fermer" [ref=e325] [cursor=pointer]
    - generic [ref=e331]:
      - paragraph [ref=e336]: "Vente 7B51FF88 : 18 000 F CFA. Faites-le seulement si l’argent a bien été rendu à l’acheteur. Ce marquage est définitif. L’organisatrice est prévenue (cloche, notification et email), avec votre motif ; l’acheteur ne reçoit aucun message."
      - generic [ref=e337]:
        - term [ref=e338]: Vente
        - definition [ref=e339]: 7B51FF88
        - term [ref=e340]: Billets
        - definition [ref=e341]: 2 billets
        - term [ref=e342]: Acheteur
        - definition [ref=e343]: "*** ** 05"
      - generic [ref=e344]:
        - generic [ref=e346]:
          - text: Motif (obligatoire)*
          - generic [ref=e347]: (obligatoire)
        - textbox "Motif (obligatoire) (obligatoire)" [active] [ref=e348]
        - paragraph [ref=e349]: 3 caractères au moins. L’organisatrice le lit dans son avis ; il reste dans le journal.
    - generic [ref=e350]:
      - button "Pas encore" [ref=e351] [cursor=pointer]
      - button "Marquer rendu" [disabled] [ref=e353]
```

# Test source

```ts
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
  264 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
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
> 310 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de admin-especes-rendues__mobile__clair.png
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