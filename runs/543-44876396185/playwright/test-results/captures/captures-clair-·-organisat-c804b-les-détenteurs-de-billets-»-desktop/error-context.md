# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-edition-prevenir — Modifier un événement publié — fenêtre « Prévenir les détenteurs de billets »
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de partenaire-edition-prevenir__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core target-size (serious, 1 nœud(s)) : All touch targets must be 24px large, or leave sufficient space",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - link "Event Village, accueil" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=e16]:
        - generic [ref=e17]:
          - paragraph [ref=e18]: Gestion
          - generic [ref=e19]:
            - link "Tableau de bord" [ref=e20] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e27] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e31] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e38]:
          - paragraph [ref=e39]: Outils
          - generic [ref=e40]:
            - link "Finances" [ref=e41] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e45] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e49] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e57] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e61] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e66] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e72] [cursor=pointer]:
          - /url: /
      - generic [ref=e78]:
        - link "Mariama Ndiaye Partenaire" [ref=e79] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e81]: MN
          - generic [ref=e82]:
            - generic [ref=e83]: Mariama Ndiaye
            - generic [ref=e84]: Partenaire
        - generic [ref=e85]:
          - button "Se déconnecter" [ref=e86] [cursor=pointer]
          - button "Basculer le thème" [ref=e91] [cursor=pointer]
    - generic [ref=e95]:
      - banner [ref=e96]:
        - link "Rechercher un événement…" [ref=e98] [cursor=pointer]:
          - /url: /explore
        - generic [ref=e103]:
          - button "Notifications, 32 non lues" [ref=e105] [cursor=pointer]:
            - generic [ref=e109]: "32"
          - button "Mariama Ndiaye" [ref=e111] [cursor=pointer]:
            - generic [aria-hidden] [ref=e112]: MN
      - main [ref=e116]:
        - generic [ref=e118]:
          - generic [ref=e119]:
            - link "Retour à mes événements" [ref=e121] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e127]:
              - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e129]': Publié
              - heading "Modifier l’événement" [level=1] [ref=e132]
              - paragraph [ref=e133]: Festival Jazz sur le Fleuve
          - status [ref=e134]:
            - generic [ref=e139]:
              - paragraph [ref=e140]: "Votre événement est validé : ce que vos modifications changent"
              - list [ref=e142]:
                - listitem [ref=e143]: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
                - listitem [ref=e144]: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
                - listitem [ref=e145]: "Titre : les détenteurs de billets sont prévenus dans l’application."
                - listitem [ref=e146]: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
                - listitem [ref=e147]: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
                - listitem [ref=e148]: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives."
          - navigation "Étapes du formulaire" [ref=e149]:
            - paragraph [ref=e150]: Étape 1 sur 5 — Informations générales
            - list [ref=e151]:
              - listitem [ref=e152]:
                - 'button "Étape 1 : Informations générales" [ref=e153] [cursor=pointer]':
                  - generic [aria-hidden] [ref=e154]: "1"
                  - generic [aria-hidden] [ref=e155]: Informations
              - listitem [ref=e157]:
                - 'button "Étape 2 : Programme" [ref=e158] [cursor=pointer]':
                  - generic [aria-hidden] [ref=e159]: "2"
                  - generic [aria-hidden] [ref=e160]: Programme
              - listitem [ref=e162]:
                - 'button "Étape 3 : Accès et informations pratiques" [ref=e163] [cursor=pointer]':
                  - generic [aria-hidden] [ref=e164]: "3"
                  - generic [aria-hidden] [ref=e165]: Accès
              - listitem [ref=e167]:
                - 'button "Étape 4 : Billetterie" [ref=e168] [cursor=pointer]':
                  - generic [aria-hidden] [ref=e169]: "4"
                  - generic [aria-hidden] [ref=e170]: Billets
              - listitem [ref=e172]:
                - 'button "Étape 5 : Contrôle à l’entrée (facultatif)" [ref=e173] [cursor=pointer]':
                  - generic [aria-hidden] [ref=e174]: "5"
                  - generic [aria-hidden] [ref=e175]: Contrôle
              - listitem [ref=e177]:
                - button "Vérifier avant d’envoyer" [ref=e178] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e183]: Vérifier
          - generic [ref=e185]:
            - heading "Informations générales" [level=2] [ref=e186]
            - generic [ref=e187]:
              - generic [ref=e188]:
                - generic [ref=e190]:
                  - text: Titre de l’événement*
                  - generic [ref=e191]: (obligatoire)
                - textbox "Titre de l’événement (obligatoire)" [ref=e192]:
                  - /placeholder: "Par exemple : Nuit du Mbalax"
                  - text: Festival Jazz sur le Fleuve
                - paragraph [ref=e193]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=e194]:
                - generic [ref=e195]:
                  - text: Type d’événement*
                  - generic [ref=e196]: (obligatoire)
                - radiogroup "Type d’événement (obligatoire)" [ref=e197]:
                  - radio "Concerts & Musique" [disabled] [ref=e198]
                  - radio "Festivals" [checked] [disabled] [ref=e200]
                  - radio "Gastronomie & Tables" [disabled] [ref=e204]
                  - radio "Salles & Réceptions" [disabled] [ref=e206]
                - paragraph [ref=e208]: "Verrouillé : des billets ont déjà été vendus ou réservés."
              - generic [ref=e212]:
                - generic [ref=e213]:
                  - generic [ref=e214]: Description
                  - generic [ref=e215]: 103 / 5000
                - textbox "Description" [ref=e216]:
                  - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
                  - text: "Deux soirées de jazz au bord du fleuve : quartets, big band du conservatoire et jam session de clôture."
              - generic [ref=e217]:
                - generic [ref=e218]: Affiche de l’événement
                - button "Affiche de l’événement" [ref=e219]
                - generic [ref=e220]:
                  - 'img "Aperçu : Affiche de l’événement" [ref=e221]'
                  - generic [ref=e222]:
                    - generic [ref=e223]: Aperçu sur les cartes du site
                    - generic [ref=e224]:
                      - generic [ref=e225] [cursor=pointer]: Remplacer l’image
                      - button "Supprimer l’image sélectionnée" [ref=e231] [cursor=pointer]
                - paragraph [ref=e236]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
              - group "Dates et horaires (heure de Dakar)" [ref=e237]:
                - generic [ref=e239]:
                  - generic [ref=e240]:
                    - generic [ref=e242]:
                      - text: Date de début*
                      - generic [ref=e243]: (obligatoire)
                    - textbox "Date de début (obligatoire)" [ref=e244]: 2026-12-03
                    - paragraph [ref=e245]: Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=e246]:
                    - generic [ref=e248]:
                      - text: Heure de début*
                      - generic [ref=e249]: (obligatoire)
                    - textbox "Heure de début (obligatoire)" [ref=e250]: 18:00
                    - paragraph [ref=e251]: Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=e252]:
                    - generic [ref=e253]: Date de fin
                    - textbox "Date de fin" [ref=e255]: 2026-12-04
                    - paragraph [ref=e256]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=e257]:
                    - generic [ref=e258]: Heure de fin
                    - textbox "Heure de fin" [ref=e260]: 00:00
                    - paragraph [ref=e261]: Facultative ; avec une heure de fin, la date de fin est demandée. Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=e262]:
                - generic [ref=e263]:
                  - generic [ref=e265]:
                    - text: Lieu*
                    - generic [ref=e266]: (obligatoire)
                  - textbox "Lieu (obligatoire)" [ref=e267]:
                    - /placeholder: "Par exemple : Grand Théâtre National"
                    - text: Quai des Pêcheurs — salle B
                  - paragraph [ref=e268]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e269]:
                  - generic [ref=e271]:
                    - text: Ville*
                    - generic [ref=e272]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=e274] [cursor=pointer]:
                    - option "Cap Skirring"
                    - option "Dakar"
                    - option "Diamniadio"
                    - option "Diourbel"
                    - option "Fatick"
                    - option "Guédiawaye"
                    - option "Joal-Fadiouth"
                    - option "Kaffrine"
                    - option "Kaolack"
                    - option "Kédougou"
                    - option "Kolda"
                    - option "Louga"
                    - option "Matam"
                    - option "Mbacké"
                    - option "Mbour"
                    - option "Pikine"
                    - option "Richard-Toll"
                    - option "Rufisque"
                    - option "Saint-Louis" [selected]
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
                  - paragraph [ref=e275]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=e276]:
                - generic [ref=e277]: Capacité totale (jauge)
                - spinbutton "Capacité totale (jauge)" [ref=e283]: "400"
                - paragraph [ref=e284]: "Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous 370 places."
            - generic [ref=e285]:
              - button "Précédent" [disabled] [ref=e286]
              - generic [ref=e291]:
                - button "Suivant" [ref=e292] [cursor=pointer]
                - button "Enregistrer les modifications" [ref=e297] [cursor=pointer]
  - alert [ref=e304]
  - alertdialog [ref=e307]:
    - generic [ref=e308]:
      - heading "Prévenir les détenteurs de billets" [level=2] [ref=e311]
      - button "Fermer" [ref=e312] [cursor=pointer]
    - generic [ref=e319]:
      - paragraph [ref=e320]: 12 détenteurs seront prévenus par SMS à 07:12.
      - paragraph [ref=e321]: Vos corrections faites d’ici là partiront dans le même SMS.
    - generic [ref=e322]:
      - button "Annuler" [active] [ref=e323] [cursor=pointer]
      - button "Enregistrer et prévenir" [ref=e325] [cursor=pointer]
```

# Test source

```ts
  224 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  225 |             }
  226 |             if (screen.injectError) {
  227 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  228 |                 await page.route(screen.injectError, (route) => route.fulfill({
  229 |                     status: 500,
  230 |                     contentType: 'application/json; charset=utf-8',
  231 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  232 |                 }));
  233 |             }
  234 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  235 |             for (const stub of stubs) {
  236 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  237 |                 await page.route(stub.url, async (route) => {
  238 |                     if (!methodMatches(stub.method, route.request().method())) {
  239 |                         await route.fallback();
  240 |                         return;
  241 |                     }
  242 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  243 |                 });
  244 |             }
  245 |             for (const hold of screen.holdRequests ?? []) {
  246 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  247 |                 await page.route(hold.url, async (route) => {
  248 |                     if (!methodMatches(hold.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  253 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  254 |                 });
  255 |             }
  256 |             if (screen.fakePush) {
  257 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  258 |                 record.notes.push(screen.fakePush === 'granted'
  259 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  260 |                     : screen.fakePush === 'denied'
  261 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  262 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  263 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  264 |             }
  265 |             if (screen.fakeCamera) {
  266 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  267 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  268 |                 await context.addInitScript(installFakeCamera, { mode });
  269 |             }
  270 |             if (screen.offline === 'before-load') {
  271 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  272 |                 guard.freeze();
  273 |                 await context.setOffline(true);
  274 |             }
  275 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  276 |             record.status = response ? response.status() : null;
  277 |             if (screen.expectStatus !== undefined) {
  278 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  279 |             }
  280 |             if (screen.offline === 'after-load') {
  281 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const sc = { page, context, guard, ids: demo };
  286 |             if (screen.ready) await screen.ready(sc);
  287 |             await settle(page, guard, record.notes);
  288 |             if (screen.actions) {
  289 |                 await screen.actions(sc);
  290 |                 await settle(page, guard, record.notes);
  291 |             }
  292 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  293 |                 const problem = await markAllOnOneLine(page);
  294 |                 if (problem) record.blocking.push(problem);
  295 |             }
  296 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  297 |             record.blocking.push(...checks.blocking);
  298 |             record.warnings.push(...checks.warnings);
  299 |             record.axeDetails = checks.axeDetails;
  300 |             record.smallTextDetails = checks.smallTextDetails;
  301 |             record.metrics = checks.metrics;
  302 |             const shot = await capture(page, screen, file);
  303 |             record.captured = true;
  304 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  305 |         } catch (err) {
  306 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  307 |             if (!record.captured && !page.isClosed()) {
  308 |                 await capture(page, screen, file).then(
  309 |                     async (shot) => {
  310 |                         record.captured = true;
  311 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  312 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  313 |                     },
  314 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  315 |                 );
  316 |             }
  317 |             throw err;
  318 |         } finally {
  319 |             record.blocking.push(...guard.blockingIssues());
  320 |             record.warnings.push(...guard.nonBlockingIssues());
  321 |             record.durationMs = Date.now() - started;
  322 |             writeCaptureRecord(record);
  323 |         }
> 324 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de partenaire-edition-prevenir__ordinateur__clair.png
  325 |     });
  326 | }
  327 | 
  328 | for (const theme of THEMES) {
  329 |     for (const role of ROLE_ORDER) {
  330 |         const screens = SCREENS.filter((s) => s.role === role);
  331 |         if (screens.length === 0) continue;
  332 |         test.describe(`${theme.key} · ${role}`, () => {
  333 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  334 | 
  335 |             for (const screen of screens) {
  336 |                 if (screen.serviceWorkers === 'allow') {
  337 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  338 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  339 |                         test.use({ serviceWorkers: 'allow' });
  340 |                         defineCapture(screen, theme, role);
  341 |                     });
  342 |                 } else {
  343 |                     defineCapture(screen, theme, role);
  344 |                 }
  345 |             }
  346 |         });
  347 |     }
  348 | }
  349 | 
```