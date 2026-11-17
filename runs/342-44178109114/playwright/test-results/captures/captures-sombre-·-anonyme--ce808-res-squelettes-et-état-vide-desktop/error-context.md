# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> design-composants — Design 1a — en-tête, composants de base, repères, squelettes et état vide
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de design-composants__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "5 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 13 px « 10 000 F » (span > span.ev-repere.ev-repere--prix > span.ev-repere__billet) ; 13 px « Gratuit » (span > span.ev-repere.ev-repere--prix > span.ev-repere__billet) ; 13 px « 5 000 F » (span > span.ev-repere.ev-repere--choisi > span.ev-repere__billet) ; 13 px « À la une » (span > span.ev-repere.ev-repere--une > span.ev-repere__billet) ; 13 px « 3 événements » (span > span.ev-repere.ev-repere--pile > span.ev-repere__billet)",
+   "axe-core aria-valid-attr-value (critical, 1 nœud(s)) : ARIA attributes must conform to valid values",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Menu principal
          - generic [ref=e12]:
            - link "Accueil" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e32]:
          - paragraph [ref=e33]: Espaces métier
          - link "Devenir partenaire" [ref=e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e41]:
        - link "Se connecter" [ref=e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=e48] [cursor=pointer]
    - generic [ref=e56]:
      - banner [ref=e57]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e59] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e66] [cursor=pointer]
      - main [ref=e70]:
        - generic [ref=e72]:
          - heading "Composants" [level=1] [ref=e73]
          - region [ref=e74]:
            - heading "Boutons" [level=2] [ref=e75]
            - generic [ref=e76]:
              - button "Enregistrer" [ref=e77] [cursor=pointer]
              - button "Annuler" [ref=e79] [cursor=pointer]
              - button "Voir le programme" [ref=e81] [cursor=pointer]
              - button "Plus tard" [ref=e83] [cursor=pointer]
              - button "Rembourser 10 000 F CFA" [ref=e85] [cursor=pointer]
            - button "Choisir mes billets" [ref=e87] [cursor=pointer]
          - region [ref=e89]:
            - heading "Champs" [level=2] [ref=e90]
            - generic [ref=e91]:
              - generic [ref=e92]: Nom complet
              - textbox "Nom complet" [ref=e94]: Awa Ndiaye
              - paragraph [ref=e95]: Tel qu’il figure sur votre pièce d’identité.
            - generic [ref=e96]:
              - generic [ref=e98]:
                - text: Numéro de téléphone*
                - generic [ref=e99]: (obligatoire)
              - textbox "Numéro de téléphone (obligatoire)" [invalid] [ref=e100]: 77 12
              - paragraph [ref=e101]:
                - generic [ref=e104]: Saisissez les 9 chiffres de votre numéro.
          - region [ref=e105]:
            - heading "Cartes" [level=2] [ref=e106]
            - generic [ref=e107]:
              - generic [ref=e108]:
                - paragraph [ref=e109]: Recettes en ligne nettes
                - paragraph [ref=e110]: 245 000 F CFA
              - article [ref=e111]:
                - generic [ref=e113]:
                  - generic [ref=e114]:
                    - generic [aria-hidden] [ref=e115]:
                      - generic [ref=e116]: "20"
                      - generic [ref=e117]: déc.
                    - heading [level=3] [ref=e119]:
                      - link "Festival des lumières de Saint-Louis" [ref=e120] [cursor=pointer]:
                        - /url: /events/00000000-0000-4000-8000-000000000001
                  - generic [ref=e121]:
                    - generic [ref=e122]: Dernières places
                    - generic [ref=e124]: Concert
                  - list [ref=e126]:
                    - listitem [ref=e127]:
                      - generic [ref=e130]: samedi 20 décembre à 20 h 00
                    - listitem [ref=e131]:
                      - generic [ref=e135]: Saint-Louis · Place Faidherbe
                  - generic [ref=e137]:
                    - paragraph [ref=e138]: À partir de
                    - paragraph [ref=e139]: 10 000 F CFA
          - region [ref=e152]:
            - heading "Onglets, pastilles et filtres" [level=2] [ref=e153]
            - tablist "Sections de l’événement" [ref=e155]:
              - tab "Programme" [selected] [ref=e156] [cursor=pointer]
              - tab "Billets , 3" [ref=e158] [cursor=pointer]:
                - generic [ref=e159]: Billets
                - generic [ref=e160]:
                  - generic [ref=e161]: ","
                  - text: "3"
              - tab "Lieu" [ref=e162] [cursor=pointer]
            - generic [ref=e164]:
              - generic [ref=e165]: Gratuit
              - generic [ref=e167]: Dernières places
              - generic [ref=e169]: Complet
              - generic [ref=e171]: Nouveau
              - generic [ref=e173]: Brouillon
            - generic [ref=e175]:
              - button "Concerts" [pressed] [ref=e176] [cursor=pointer]:
                - generic [aria-hidden] [ref=e177]: ✓
                - text: Concerts
              - button "Gratuit" [ref=e178] [cursor=pointer]
              - button "Cette semaine" [ref=e179] [cursor=pointer]
          - region [ref=e180]:
            - heading "Retours et fenêtres" [level=2] [ref=e181]
            - generic [ref=e182]:
              - button "Montrer les toasts" [ref=e183] [cursor=pointer]
              - button "Ouvrir la confirmation" [ref=e185] [cursor=pointer]
          - region [ref=e187]:
            - heading "Chargement et état vide" [level=2] [ref=e188]
            - generic [ref=e209]:
              - heading "Aucun événement cette semaine" [level=3] [ref=e215]
              - paragraph [ref=e216]: Élargissez la recherche à tout le mois ou à une autre ville.
              - button "Voir tout le mois" [ref=e217] [cursor=pointer]
          - region [ref=e219]:
            - heading "Repères de la carte" [level=2] [ref=e220]
            - generic [ref=e221]:
              - img "10 000 F" [ref=e222]
              - img "Gratuit" [ref=e226]
              - img "Événement choisi, 5 000 F" [ref=e230]:
                - generic [ref=e231]: 5 000 F
              - img "À la une" [ref=e234]
              - img "3 événements" [ref=e238]
          - region [ref=e241]:
            - generic [ref=e244]:
              - heading "12 événements autour de vous" [level=2] [ref=e245]
              - button "Tout afficher" [ref=e246] [cursor=pointer]
  - alert [ref=e247]
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
      |                                                                   ^ Error: contrôles bloquants de design-composants__ordinateur__sombre.png
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