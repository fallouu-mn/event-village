# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-creation — Établissement — création d’un établissement (formulaire)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-creation__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 7 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
        - generic [ref=e13]:
          - button "Notifications, 37 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "37"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: MN
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Mes établissements" [ref=e33] [cursor=pointer]:
              - /url: /partner/tables
            - generic [ref=e39]:
              - heading "Ajouter un établissement" [level=1] [ref=e40]
              - paragraph [ref=e41]: "Décrivez le lieu, ses horaires et ses tables : vos clients réservent en quelques secondes."
          - generic [ref=e42]:
            - status [ref=e43]:
              - generic [ref=e48]:
                - paragraph [ref=e49]: L’établissement sera vérifié par l’équipe d’Event Village avant d’être visible.
                - generic [ref=e50]: Vous recevrez un message dès qu’il aura été examiné. Votre saisie est gardée sur cet appareil si vous quittez la page.
            - region [ref=e51]:
              - generic [ref=e53]:
                - generic [aria-hidden] [ref=e54]: "1"
                - generic [ref=e55]:
                  - heading "L’établissement" [level=2] [ref=e56]
                  - paragraph [ref=e57]: Ce que les clients voient en premier.
              - group "Genre" [ref=e58]:
                - generic [ref=e60]:
                  - generic [ref=e61] [cursor=pointer]:
                    - radio "Restaurant Repas assis, déjeuner ou dîner." [checked] [ref=e62]
                    - generic [ref=e63]:
                      - generic [ref=e64]: Restaurant
                      - generic [ref=e71]: Repas assis, déjeuner ou dîner.
                  - generic [ref=e72] [cursor=pointer]:
                    - radio "Bar Lounge, bar, rooftop, club." [ref=e73]
                    - generic [ref=e74]:
                      - generic [ref=e75]: Bar
                      - generic [ref=e79]: Lounge, bar, rooftop, club.
                  - generic [ref=e80] [cursor=pointer]:
                    - radio "Espace Terrasse, plage, espace privatisable." [ref=e81]
                    - generic [ref=e82]:
                      - generic [ref=e83]: Espace
                      - generic [ref=e88]: Terrasse, plage, espace privatisable.
              - generic [ref=e89]:
                - generic [ref=e91]:
                  - text: Nom*
                  - generic [ref=e92]: (obligatoire)
                - textbox "Nom (obligatoire)" [ref=e93]:
                  - /placeholder: "Par exemple : Le Lagon 1"
              - generic [ref=e94]:
                - generic [ref=e95]:
                  - generic [ref=e96]: Description
                  - generic [ref=e97]: 0 / 2000
                - textbox "Description" [ref=e98]:
                  - /placeholder: Cuisine, ambiance, musique, tenue, ce qui vous rend unique…
            - region [ref=e99]:
              - generic [ref=e101]:
                - generic [aria-hidden] [ref=e102]: "2"
                - generic [ref=e103]:
                  - heading "Adresse et position" [level=2] [ref=e104]
                  - paragraph [ref=e105]: Pour que les clients vous trouvent.
              - generic [ref=e106]:
                - generic [ref=e107]:
                  - generic [ref=e109]:
                    - text: Adresse*
                    - generic [ref=e110]: (obligatoire)
                  - textbox "Adresse (obligatoire)" [ref=e111]:
                    - /placeholder: Rue, quartier, point de repère
                - generic [ref=e112]:
                  - generic [ref=e114]:
                    - text: Ville*
                    - generic [ref=e115]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=e117] [cursor=pointer]:
                    - option "Choisir la ville" [disabled] [selected]
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
                    - option "Saint-Louis"
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
              - group "Position sur la carte (conseillée)" [ref=e118]:
                - paragraph [ref=e120]: "Placez le repère sur l’entrée : la carte s’affiche sur votre fiche."
                - generic [ref=e121]:
                  - search "Rechercher un lieu" [ref=e122]:
                    - generic [ref=e123]:
                      - generic [ref=e124]:
                        - generic [ref=e125]: Rechercher un lieu
                        - textbox "Rechercher un lieu" [ref=e127]:
                          - /placeholder: "Par exemple : Grand Théâtre, Dakar"
                      - button "Rechercher" [ref=e128] [cursor=pointer]
                    - generic [ref=e134]: "Lieux : © contributeurs OpenStreetMap"
                  - generic [ref=e136]:
                    - paragraph [ref=e137]: Touchez la carte pour placer le repère à l’entrée du lieu. Un doigt fait défiler la page ; deux doigts, ou « Déplacer la carte », déplacent la carte.
                    - button "Ma position" [ref=e138] [cursor=pointer]
                  - generic [ref=e144]:
                    - region "Carte du lieu" [ref=e145]:
                      - generic:
                        - generic [ref=e146]:
                          - button "Zoom avant" [ref=e147] [cursor=pointer]: +
                          - button "Zoom arrière" [ref=e148] [cursor=pointer]: −
                        - generic: © contributeurs OpenStreetMap
                    - button "Déplacer la carte" [ref=e150] [cursor=pointer]
                  - generic [ref=e158]:
                    - generic [ref=e159]:
                      - generic [ref=e160]: Latitude
                      - textbox "Latitude" [ref=e162]:
                        - /placeholder: "Par exemple : 14.6937"
                    - generic [ref=e163]:
                      - generic [ref=e164]: Longitude
                      - textbox "Longitude" [ref=e166]:
                        - /placeholder: "Par exemple : -17.4441"
            - region [ref=e167]:
              - generic [ref=e169]:
                - generic [aria-hidden] [ref=e170]: "3"
                - generic [ref=e171]:
                  - heading "Photos" [level=2] [ref=e172]
                  - paragraph [ref=e173]: "De 1 à 12 photos. La première est la couverture, montrée dans la recherche. Photos : 0 sur 12."
              - generic [ref=e174]:
                - paragraph [ref=e175]
                - generic [ref=e176]:
                  - generic [ref=e177]:
                    - text: Ajouter une photo*
                    - generic [ref=e178]: (obligatoire)
                  - button "Ajouter une photo (obligatoire)" [ref=e179]
                  - generic [ref=e180] [cursor=pointer]: Choisir une image ou la déposer ici
                  - paragraph [ref=e187]: JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; la salle, la terrasse, une table dressée, un plat.
            - region [ref=e188]:
              - generic [ref=e190]:
                - generic [aria-hidden] [ref=e191]: "4"
                - generic [ref=e192]:
                  - heading "Horaires" [level=2] [ref=e193]
                  - paragraph [ref=e194]: "Jour par jour, jusqu’à 4 plages. Une plage peut finir après minuit : le client réserve jusqu’à la fermeture moins la durée d’une réservation."
              - list [ref=e197]:
                - listitem [ref=e198]:
                  - generic [ref=e200]:
                    - generic [ref=e201]:
                      - generic [ref=e202] [cursor=pointer]: Lundi
                      - paragraph [ref=e203]: 12 h à 23 h
                    - generic [ref=e204]:
                      - generic [aria-hidden] [ref=e205]: Activé
                      - switch "Lundi" [checked] [ref=e206] [cursor=pointer]
                  - generic [ref=e209]:
                    - generic [ref=e211]:
                      - generic [ref=e212]:
                        - generic [ref=e213]: Ouvre à
                        - textbox "Ouvre à" [ref=e215]: 12:00
                      - generic [ref=e216]:
                        - generic [ref=e217]: Ferme à
                        - textbox "Ferme à" [ref=e219]: 23:00
                      - button "Retirer la plage 1 du lundi" [ref=e220] [cursor=pointer]
                    - generic [ref=e225]:
                      - button "Ajouter une plage" [ref=e226] [cursor=pointer]
                      - button "Copier les horaires du lundi sur tous les jours" [ref=e230] [cursor=pointer]:
                        - generic [ref=e235]: Copier sur tous les jours
                - listitem [ref=e236]:
                  - generic [ref=e238]:
                    - generic [ref=e239]:
                      - generic [ref=e240] [cursor=pointer]: Mardi
                      - paragraph [ref=e241]: 12 h à 23 h
                    - generic [ref=e242]:
                      - generic [aria-hidden] [ref=e243]: Activé
                      - switch "Mardi" [checked] [ref=e244] [cursor=pointer]
                  - generic [ref=e247]:
                    - generic [ref=e249]:
                      - generic [ref=e250]:
                        - generic [ref=e251]: Ouvre à
                        - textbox "Ouvre à" [ref=e253]: 12:00
                      - generic [ref=e254]:
                        - generic [ref=e255]: Ferme à
                        - textbox "Ferme à" [ref=e257]: 23:00
                      - button "Retirer la plage 1 du mardi" [ref=e258] [cursor=pointer]
                    - generic [ref=e263]:
                      - button "Ajouter une plage" [ref=e264] [cursor=pointer]
                      - button "Copier les horaires du mardi sur tous les jours" [ref=e268] [cursor=pointer]:
                        - generic [ref=e273]: Copier sur tous les jours
                - listitem [ref=e274]:
                  - generic [ref=e276]:
                    - generic [ref=e277]:
                      - generic [ref=e278] [cursor=pointer]: Mercredi
                      - paragraph [ref=e279]: 12 h à 23 h
                    - generic [ref=e280]:
                      - generic [aria-hidden] [ref=e281]: Activé
                      - switch "Mercredi" [checked] [ref=e282] [cursor=pointer]
                  - generic [ref=e285]:
                    - generic [ref=e287]:
                      - generic [ref=e288]:
                        - generic [ref=e289]: Ouvre à
                        - textbox "Ouvre à" [ref=e291]: 12:00
                      - generic [ref=e292]:
                        - generic [ref=e293]: Ferme à
                        - textbox "Ferme à" [ref=e295]: 23:00
                      - button "Retirer la plage 1 du mercredi" [ref=e296] [cursor=pointer]
                    - generic [ref=e301]:
                      - button "Ajouter une plage" [ref=e302] [cursor=pointer]
                      - button "Copier les horaires du mercredi sur tous les jours" [ref=e306] [cursor=pointer]:
                        - generic [ref=e311]: Copier sur tous les jours
                - listitem [ref=e312]:
                  - generic [ref=e314]:
                    - generic [ref=e315]:
                      - generic [ref=e316] [cursor=pointer]: Jeudi
                      - paragraph [ref=e317]: 12 h à 23 h
                    - generic [ref=e318]:
                      - generic [aria-hidden] [ref=e319]: Activé
                      - switch "Jeudi" [checked] [ref=e320] [cursor=pointer]
                  - generic [ref=e323]:
                    - generic [ref=e325]:
                      - generic [ref=e326]:
                        - generic [ref=e327]: Ouvre à
                        - textbox "Ouvre à" [ref=e329]: 12:00
                      - generic [ref=e330]:
                        - generic [ref=e331]: Ferme à
                        - textbox "Ferme à" [ref=e333]: 23:00
                      - button "Retirer la plage 1 du jeudi" [ref=e334] [cursor=pointer]
                    - generic [ref=e339]:
                      - button "Ajouter une plage" [ref=e340] [cursor=pointer]
                      - button "Copier les horaires du jeudi sur tous les jours" [ref=e344] [cursor=pointer]:
                        - generic [ref=e349]: Copier sur tous les jours
                - listitem [ref=e350]:
                  - generic [ref=e352]:
                    - generic [ref=e353]:
                      - generic [ref=e354] [cursor=pointer]: Vendredi
                      - paragraph [ref=e355]: 12 h à 23 h
                    - generic [ref=e356]:
                      - generic [aria-hidden] [ref=e357]: Activé
                      - switch "Vendredi" [checked] [ref=e358] [cursor=pointer]
                  - generic [ref=e361]:
                    - generic [ref=e363]:
                      - generic [ref=e364]:
                        - generic [ref=e365]: Ouvre à
                        - textbox "Ouvre à" [ref=e367]: 12:00
                      - generic [ref=e368]:
                        - generic [ref=e369]: Ferme à
                        - textbox "Ferme à" [ref=e371]: 23:00
                      - button "Retirer la plage 1 du vendredi" [ref=e372] [cursor=pointer]
                    - generic [ref=e377]:
                      - button "Ajouter une plage" [ref=e378] [cursor=pointer]
                      - button "Copier les horaires du vendredi sur tous les jours" [ref=e382] [cursor=pointer]:
                        - generic [ref=e387]: Copier sur tous les jours
                - listitem [ref=e388]:
                  - generic [ref=e390]:
                    - generic [ref=e391]:
                      - generic [ref=e392] [cursor=pointer]: Samedi
                      - paragraph [ref=e393]: 12 h à 23 h
                    - generic [ref=e394]:
                      - generic [aria-hidden] [ref=e395]: Activé
                      - switch "Samedi" [checked] [ref=e396] [cursor=pointer]
                  - generic [ref=e399]:
                    - generic [ref=e401]:
                      - generic [ref=e402]:
                        - generic [ref=e403]: Ouvre à
                        - textbox "Ouvre à" [ref=e405]: 12:00
                      - generic [ref=e406]:
                        - generic [ref=e407]: Ferme à
                        - textbox "Ferme à" [ref=e409]: 23:00
                      - button "Retirer la plage 1 du samedi" [ref=e410] [cursor=pointer]
                    - generic [ref=e415]:
                      - button "Ajouter une plage" [ref=e416] [cursor=pointer]
                      - button "Copier les horaires du samedi sur tous les jours" [ref=e420] [cursor=pointer]:
                        - generic [ref=e425]: Copier sur tous les jours
                - listitem [ref=e426]:
                  - generic [ref=e428]:
                    - generic [ref=e429]:
                      - generic [ref=e430] [cursor=pointer]: Dimanche
                      - paragraph [ref=e431]: 12 h à 23 h
                    - generic [ref=e432]:
                      - generic [aria-hidden] [ref=e433]: Activé
                      - switch "Dimanche" [checked] [ref=e434] [cursor=pointer]
                  - generic [ref=e437]:
                    - generic [ref=e439]:
                      - generic [ref=e440]:
                        - generic [ref=e441]: Ouvre à
                        - textbox "Ouvre à" [ref=e443]: 12:00
                      - generic [ref=e444]:
                        - generic [ref=e445]: Ferme à
                        - textbox "Ferme à" [ref=e447]: 23:00
                      - button "Retirer la plage 1 du dimanche" [ref=e448] [cursor=pointer]
                    - generic [ref=e453]:
                      - button "Ajouter une plage" [ref=e454] [cursor=pointer]
                      - button "Copier les horaires du dimanche sur tous les jours" [ref=e458] [cursor=pointer]:
                        - generic [ref=e463]: Copier sur tous les jours
            - region [ref=e464]:
              - generic [ref=e466]:
                - generic [aria-hidden] [ref=e467]: "5"
                - generic [ref=e468]:
                  - heading "Zones et tables" [level=2] [ref=e469]
                  - paragraph [ref=e470]: Les tables que vos clients peuvent réserver, avec leur nombre de places.
              - generic [ref=e472]:
                - generic [ref=e473]:
                  - generic [ref=e474]:
                    - heading "Zones (facultatif)" [level=3] [ref=e475]
                    - paragraph [ref=e476]: "Terrasse, salle, étage, coin VIP : le client peut choisir où s’asseoir."
                  - button "Ajouter une zone" [ref=e478] [cursor=pointer]
                - generic [ref=e482]:
                  - heading "Ajout rapide" [level=3] [ref=e483]
                  - paragraph [ref=e489]: Ajoutez plusieurs tables identiques d’un coup, numérotées à la suite.
                  - generic [ref=e490]:
                    - generic [ref=e491]:
                      - generic [ref=e492]: Tables
                      - textbox "Tables" [ref=e494]: "5"
                    - generic [ref=e495]:
                      - generic [ref=e496]: Places chacune
                      - textbox "Places chacune" [ref=e498]: "4"
                    - button "Ajouter 5 tables de 4" [ref=e499] [cursor=pointer]
                - generic [ref=e503]:
                  - generic [ref=e504]:
                    - heading "Tables" [level=3] [ref=e505]
                    - paragraph [ref=e506]: 1 table · 4 places
                  - list [ref=e512]:
                    - listitem [ref=e513]:
                      - generic [ref=e514]:
                        - generic [ref=e515]:
                          - generic [ref=e516]: Numéro
                          - textbox "Numéro" [ref=e518]: "1"
                        - generic [ref=e519]:
                          - generic [ref=e520]: Places
                          - textbox "Places" [ref=e522]: "4"
                        - generic [ref=e523]:
                          - generic [ref=e524]: Minimum
                          - textbox "Minimum" [ref=e526]:
                            - /placeholder: "1"
                        - button "Retirer la table 1" [ref=e528] [cursor=pointer]
                  - button "Ajouter une table" [ref=e534] [cursor=pointer]
                  - paragraph [ref=e538]: "« Minimum » : le plus petit groupe accepté à cette table (laissez vide pour 1). Vous pourrez placer les tables sur un plan de salle après la validation."
                - paragraph [ref=e539]
            - region [ref=e540]:
              - generic [ref=e542]:
                - generic [aria-hidden] [ref=e543]: "6"
                - generic [ref=e544]:
                  - heading "Réglages des réservations" [level=2] [ref=e545]
                  - paragraph [ref=e546]: Comment une demande devient une table gardée.
              - group "Confirmation" [ref=e547]:
                - generic [ref=e549]:
                  - generic [ref=e550] [cursor=pointer]:
                    - radio "Confirmation immédiate La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté." [checked] [ref=e551]
                    - generic [ref=e552]:
                      - generic [ref=e553]: Confirmation immédiate
                      - generic [ref=e558]: La table est gardée dès que le client réserve (et paie l’acompte s’il y en a un). Rien à faire de votre côté.
                  - generic [ref=e559] [cursor=pointer]:
                    - radio "J’accepte chaque demande Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client." [ref=e560]
                    - generic [ref=e561]:
                      - generic [ref=e562]: J’accepte chaque demande
                      - generic [ref=e569]: Vous avez 2 heures pour répondre à chaque demande. Sans réponse, elle est annulée et l’acompte rendu au client.
              - generic [ref=e570]:
                - generic [ref=e571]:
                  - generic [ref=e572]: Acompte par personne (F CFA)
                  - textbox "Acompte par personne (F CFA)" [ref=e574]:
                    - /placeholder: Vide = réservation gratuite
                  - paragraph [ref=e575]: Facultatif, de 100 à 1 000 000 F CFA. Des frais de service de 5 % sont payés par le client en plus.
                - generic [ref=e576]:
                  - generic [ref=e577]: Durée d’une réservation
                  - combobox "Durée d’une réservation" [ref=e580] [cursor=pointer]:
                    - 'option "Durée habituelle d’Event Village : 2 h" [selected]'
                    - option "30 min"
                    - option "45 min"
                    - option "1 h"
                    - option "1 h 15"
                    - option "1 h 30"
                    - option "1 h 45"
                    - option "2 h"
                    - option "2 h 15"
                    - option "2 h 30"
                    - option "2 h 45"
                    - option "3 h"
                    - option "3 h 15"
                    - option "3 h 30"
                    - option "3 h 45"
                    - option "4 h"
                    - option "4 h 15"
                    - option "4 h 30"
                    - option "4 h 45"
                    - option "5 h"
                    - option "5 h 15"
                    - option "5 h 30"
                    - option "5 h 45"
                    - option "6 h"
                  - paragraph [ref=e581]: Le temps pendant lequel la table est gardée pour un groupe.
              - paragraph [ref=e582]:
                - generic [ref=e586]: "Sans acompte, la réservation est gratuite pour le client. Un client en retard de plus de 30 minutes peut être noté absent : la table est libérée."
            - generic [ref=e587]:
              - link "Annuler" [ref=e588] [cursor=pointer]:
                - /url: /partner/tables
              - button "Envoyer en validation" [ref=e590] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e596]:
      - generic [ref=e597]:
        - link "Accueil" [ref=e598] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e605] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e609] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e617] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e621] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e626]
```

# Test source

```ts
  225 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  226 |             }
  227 |             if (screen.injectError) {
  228 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  229 |                 await page.route(screen.injectError, (route) => route.fulfill({
  230 |                     status: 500,
  231 |                     contentType: 'application/json; charset=utf-8',
  232 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  233 |                 }));
  234 |             }
  235 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  236 |             for (const stub of stubs) {
  237 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  238 |                 await page.route(stub.url, async (route) => {
  239 |                     if (!methodMatches(stub.method, route.request().method())) {
  240 |                         await route.fallback();
  241 |                         return;
  242 |                     }
  243 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  244 |                 });
  245 |             }
  246 |             for (const hold of screen.holdRequests ?? []) {
  247 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  248 |                 await page.route(hold.url, async (route) => {
  249 |                     if (!methodMatches(hold.method, route.request().method())) {
  250 |                         await route.fallback();
  251 |                         return;
  252 |                     }
  253 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  254 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  255 |                 });
  256 |             }
  257 |             if (screen.fakePush) {
  258 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  259 |                 record.notes.push(screen.fakePush === 'granted'
  260 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  261 |                     : screen.fakePush === 'denied'
  262 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  263 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  264 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  265 |             }
  266 |             if (screen.fakeCamera) {
  267 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  268 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  269 |                 await context.addInitScript(installFakeCamera, { mode });
  270 |             }
  271 |             if (screen.offline === 'before-load') {
  272 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  273 |                 guard.freeze();
  274 |                 await context.setOffline(true);
  275 |             }
  276 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  277 |             record.status = response ? response.status() : null;
  278 |             if (screen.expectStatus !== undefined) {
  279 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  280 |             }
  281 |             if (screen.offline === 'after-load') {
  282 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  283 |                 guard.freeze();
  284 |                 await context.setOffline(true);
  285 |             }
  286 |             const sc = { page, context, guard, ids: demo };
  287 |             if (screen.ready) await screen.ready(sc);
  288 |             await settle(page, guard, record.notes);
  289 |             if (screen.actions) {
  290 |                 await screen.actions(sc);
  291 |                 await settle(page, guard, record.notes);
  292 |             }
  293 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  294 |                 const problem = await markAllOnOneLine(page);
  295 |                 if (problem) record.blocking.push(problem);
  296 |             }
  297 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  298 |             record.blocking.push(...checks.blocking);
  299 |             record.warnings.push(...checks.warnings);
  300 |             record.axeDetails = checks.axeDetails;
  301 |             record.smallTextDetails = checks.smallTextDetails;
  302 |             record.metrics = checks.metrics;
  303 |             const shot = await capture(page, screen, file);
  304 |             record.captured = true;
  305 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  306 |         } catch (err) {
  307 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  308 |             if (!record.captured && !page.isClosed()) {
  309 |                 await capture(page, screen, file).then(
  310 |                     async (shot) => {
  311 |                         record.captured = true;
  312 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  313 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  314 |                     },
  315 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  316 |                 );
  317 |             }
  318 |             throw err;
  319 |         } finally {
  320 |             record.blocking.push(...guard.blockingIssues());
  321 |             record.warnings.push(...guard.nonBlockingIssues());
  322 |             record.durationMs = Date.now() - started;
  323 |             writeCaptureRecord(record);
  324 |         }
> 325 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de org-tables-creation__mobile__sombre.png
  326 |     });
  327 | }
  328 | 
  329 | for (const theme of THEMES) {
  330 |     for (const role of ROLE_ORDER) {
  331 |         const screens = SCREENS.filter((s) => s.role === role);
  332 |         if (screens.length === 0) continue;
  333 |         test.describe(`${theme.key} · ${role}`, () => {
  334 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  335 | 
  336 |             for (const screen of screens) {
  337 |                 if (screen.serviceWorkers === 'allow') {
  338 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  339 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  340 |                         test.use({ serviceWorkers: 'allow' });
  341 |                         defineCapture(screen, theme, role);
  342 |                     });
  343 |                 } else {
  344 |                     defineCapture(screen, theme, role);
  345 |                 }
  346 |             }
  347 |         });
  348 |     }
  349 | }
  350 | 
```