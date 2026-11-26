# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · sombre : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:207:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-tables-editeur]').locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' })

```

# Page snapshot

```yaml
- generic [ref=f3e1]:
  - generic [ref=f3e2]:
    - complementary [ref=f3e4]:
      - generic [ref=f3e5]:
        - link "Event Village, accueil" [ref=f3e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f3e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f3e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f3e16]:
        - generic [ref=f3e17]:
          - paragraph [ref=f3e18]: Gestion
          - generic [ref=f3e19]:
            - link "Tableau de bord" [ref=f3e20] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f3e27] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f3e31] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f3e38]:
          - paragraph [ref=f3e39]: Outils
          - generic [ref=f3e40]:
            - link "Finances" [ref=f3e41] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f3e45] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f3e49] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f3e57] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f3e61] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f3e66] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f3e72] [cursor=pointer]:
          - /url: /
      - generic [ref=f3e78]:
        - link "Khady Sarr Partenaire" [ref=f3e79] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f3e81]: KS
          - generic [ref=f3e82]:
            - generic [ref=f3e83]: Khady Sarr
            - generic [ref=f3e84]: Partenaire
        - generic [ref=f3e85]:
          - button "Se déconnecter" [ref=f3e86] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=f3e91] [cursor=pointer]
    - generic [ref=f3e99]:
      - banner [ref=f3e100]:
        - link "Rechercher un événement…" [ref=f3e102] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f3e107]:
          - button "Notifications, 18 non lues" [ref=f3e109] [cursor=pointer]:
            - generic [ref=f3e113]: "18"
          - button "Khady Sarr" [ref=f3e115] [cursor=pointer]:
            - generic [aria-hidden] [ref=f3e116]: KS
      - main [ref=f3e118]:
        - generic [ref=f3e120]:
          - generic [ref=f3e121]:
            - link "Retour à mes événements" [ref=f3e123] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f3e129]:
              - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f3e131]': Publié
              - heading "Modifier l’événement" [level=1] [ref=f3e134]
              - paragraph [ref=f3e135]: Nuit des tables 31a6ef
          - status [ref=f3e136]:
            - generic [ref=f3e141]:
              - paragraph [ref=f3e142]: "Votre événement est validé : ce que vos modifications changent"
              - list [ref=f3e144]:
                - listitem [ref=f3e145]: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
                - listitem [ref=f3e146]: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
                - listitem [ref=f3e147]: "Titre : les détenteurs de billets sont prévenus dans l’application."
                - listitem [ref=f3e148]: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
                - listitem [ref=f3e149]: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
                - listitem [ref=f3e150]: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous les places mises en vente, billets et tables compris."
          - navigation "Étapes du formulaire" [ref=f3e151]:
            - paragraph [ref=f3e152]: Étape 4 sur 5 — Billetterie
            - list [ref=f3e153]:
              - listitem [ref=f3e154]:
                - 'button "Étape 1 : Informations générales (terminée)" [ref=f3e155] [cursor=pointer]':
                  - generic [aria-hidden] [ref=f3e159]: Informations
              - listitem [ref=f3e161]:
                - 'button "Étape 2 : Programme (terminée)" [ref=f3e162] [cursor=pointer]':
                  - generic [aria-hidden] [ref=f3e166]: Programme
              - listitem [ref=f3e168]:
                - 'button "Étape 3 : Accès et informations pratiques (terminée)" [ref=f3e169] [cursor=pointer]':
                  - generic [aria-hidden] [ref=f3e173]: Accès
              - listitem [ref=f3e175]:
                - 'button "Étape 4 : Billetterie" [ref=f3e176] [cursor=pointer]':
                  - generic [aria-hidden] [ref=f3e177]: "4"
                  - generic [aria-hidden] [ref=f3e178]: Billets
              - listitem [ref=f3e180]:
                - 'button "Étape 5 : Contrôle à l’entrée (facultatif)" [ref=f3e181] [cursor=pointer]':
                  - generic [aria-hidden] [ref=f3e182]: "5"
                  - generic [aria-hidden] [ref=f3e183]: Contrôle
              - listitem [ref=f3e185]:
                - button "Vérifier avant d’envoyer" [ref=f3e186] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f3e191]: Vérifier
          - generic [ref=f3e193]:
            - heading "Billetterie" [level=2] [ref=f3e194]
            - tablist "Billets ou tables" [ref=f3e196]:
              - tab "Billets" [ref=f3e197] [cursor=pointer]
              - tab "Tables" [selected] [ref=f3e199] [cursor=pointer]
            - tabpanel "Tables" [ref=f3e201]:
              - generic [ref=f3e202]:
                - region "Jauge en places" [ref=f3e203]:
                  - generic [ref=f3e204]:
                    - heading "Jauge en places" [level=3] [ref=f3e205]
                    - paragraph [ref=f3e206]: 48 libres
                  - paragraph [ref=f3e207]: "152 places sur 200 : 80 en billets, 72 en tables"
                  - list "Détail de la jauge" [ref=f3e211]:
                    - listitem [ref=f3e212]:
                      - text: Billets
                      - generic [ref=f3e214]: "80"
                    - listitem [ref=f3e215]:
                      - text: Tables
                      - generic [ref=f3e217]: "72"
                    - listitem [ref=f3e218]:
                      - text: Libres
                      - generic [ref=f3e220]: "48"
                - status [ref=f3e221]:
                  - generic [ref=f3e227]:
                    - paragraph [ref=f3e228]: Tables en lecture seule
                    - generic [ref=f3e229]: La vente de tables n’est pas encore ouverte sur Event Village.
                - region [ref=f3e230]:
                  - heading "Types de tables" [level=3] [ref=f3e232]
                  - list [ref=f3e233]:
                    - listitem [ref=f3e234]:
                      - generic [ref=f3e235]:
                        - generic [ref=f3e236]:
                          - paragraph [ref=f3e237]: Carré VIP
                          - paragraph [ref=f3e238]: 6 places · 4 tables · 24 places en tout
                        - generic [ref=f3e239]: En vente
                      - paragraph [ref=f3e241]:
                        - text: 150 000 F CFA la table,
                        - generic [ref=f3e242]: soit 25 000 F CFA par personne
                      - generic [ref=f3e243]:
                        - generic [ref=f3e244]:
                          - term [ref=f3e245]: "Compris :"
                          - definition [ref=f3e246]: Une bouteille et un plateau de fruits
                        - generic [ref=f3e247]:
                          - term [ref=f3e248]: "Sur place :"
                          - definition [ref=f3e249]: 50 000 F de consommations sur place
                      - paragraph [ref=f3e250]: 1 vendue · 0 en paiement · 3 libres
                      - paragraph [ref=f3e251]: "Prix et places figés : une table est vendue ou en cours de paiement."
                    - listitem [ref=f3e255]:
                      - generic [ref=f3e256]:
                        - generic [ref=f3e257]:
                          - paragraph [ref=f3e258]: Table ronde
                          - paragraph [ref=f3e259]: 8 places · 6 tables · 48 places en tout
                        - generic [ref=f3e260]: En vente
                      - paragraph [ref=f3e262]:
                        - text: 120 000 F CFA la table,
                        - generic [ref=f3e263]: soit 15 000 F CFA par personne
                      - generic [ref=f3e265]:
                        - term [ref=f3e266]: "Compris :"
                        - definition [ref=f3e267]: Softs à volonté
                      - paragraph [ref=f3e268]: 1 vendue · 1 en paiement · 4 libres
                      - paragraph [ref=f3e269]: "Prix et places figés : une table est vendue ou en cours de paiement."
                - region [ref=f3e273]:
                  - generic [ref=f3e274]:
                    - heading "Tables et plan" [level=3] [ref=f3e275]
                    - paragraph [ref=f3e276]: 10 tables enregistrées
                  - tablist "Vue des tables" [ref=f3e278]:
                    - tab "Plan" [selected] [ref=f3e279] [cursor=pointer]
                    - tab "Liste et numéros" [ref=f3e281] [cursor=pointer]
                  - tabpanel "Plan" [ref=f3e283]:
                    - generic [ref=f3e284]:
                      - generic [ref=f3e285]:
                        - group "Plan des tables de l’événement" [ref=f3e286]:
                          - generic [ref=f3e287]:
                            - img "Table 1, 6 places, libre, Carré VIP" [ref=f3e288]:
                              - generic [aria-hidden] [ref=f3e290]:
                                - generic [ref=f3e291]: "1"
                                - generic [ref=f3e292]: "6"
                            - img "Table 2, 6 places, libre, Carré VIP" [ref=f3e298]:
                              - generic [aria-hidden] [ref=f3e300]:
                                - generic [ref=f3e301]: "2"
                                - generic [ref=f3e302]: "6"
                            - img "Table 3, 6 places, vendue, Carré VIP" [ref=f3e308]:
                              - generic [aria-hidden] [ref=f3e310]:
                                - generic [ref=f3e311]: "3"
                                - generic [ref=f3e312]: "6"
                            - img "Table 4, 6 places, libre, Carré VIP" [ref=f3e322]:
                              - generic [aria-hidden] [ref=f3e324]:
                                - generic [ref=f3e325]: "4"
                                - generic [ref=f3e326]: "6"
                            - img "Table 5, 8 places, vendue, Table ronde" [ref=f3e332]:
                              - generic [aria-hidden] [ref=f3e334]:
                                - generic [ref=f3e335]: "5"
                                - generic [ref=f3e336]: "8"
                            - img "Table 6, 8 places, en cours de paiement, Table ronde" [ref=f3e346]:
                              - generic [aria-hidden] [ref=f3e348]:
                                - generic [ref=f3e349]: "6"
                                - generic [ref=f3e350]: "8"
                            - img "Table 7, 8 places, libre, Table ronde" [ref=f3e360]:
                              - generic [aria-hidden] [ref=f3e362]:
                                - generic [ref=f3e363]: "7"
                                - generic [ref=f3e364]: "8"
                            - img "Table 8, 8 places, libre, Table ronde" [ref=f3e370]:
                              - generic [aria-hidden] [ref=f3e372]:
                                - generic [ref=f3e373]: "8"
                                - generic [ref=f3e374]: "8"
                            - img "Table 9, 8 places, libre, Table ronde" [ref=f3e380]:
                              - generic [aria-hidden] [ref=f3e382]:
                                - generic [ref=f3e383]: "9"
                                - generic [ref=f3e384]: "8"
                            - img "Table 10, 8 places, libre, Table ronde" [ref=f3e390]:
                              - generic [aria-hidden] [ref=f3e392]:
                                - generic [ref=f3e393]: "10"
                                - generic [ref=f3e394]: "8"
                        - list "Légende du plan" [ref=f3e400]:
                          - listitem [ref=f3e401]:
                            - generic [ref=f3e403]: Libre
                          - listitem [ref=f3e404]:
                            - generic [ref=f3e406]: En paiement
                          - listitem [ref=f3e407]:
                            - generic [ref=f3e409]: Vendue
                        - paragraph [ref=f3e410]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                        - paragraph [ref=f3e411]
                      - region "Plan montré aux clients" [ref=f3e412]:
                        - generic [ref=f3e414]:
                          - generic [ref=f3e415]:
                            - generic [ref=f3e416]: Montrer le plan aux clients
                            - paragraph [ref=f3e417]: Les clients choisissent leur table sur le plan.
                          - generic [ref=f3e418]:
                            - generic [aria-hidden] [ref=f3e419]: Activé
                            - switch "Montrer le plan aux clients" [checked] [disabled] [ref=f3e420]
                        - group "Aperçu de la vue client" [ref=f3e423]:
                          - generic [ref=f3e424]: "Vue client :"
                          - button "Téléphone" [ref=f3e425] [cursor=pointer]
                          - button "Ordinateur" [active] [pressed] [ref=f3e430] [cursor=pointer]
                        - generic [ref=f3e435]:
                          - generic [ref=f3e436]:
                            - paragraph [ref=f3e437]: Choisissez votre table
                            - generic [ref=f3e438]:
                              - group "Aperçu du plan tel que le client le voit" [ref=f3e439]:
                                - generic [ref=f3e440]:
                                  - img "Table 1, 6 places, libre" [ref=f3e441]:
                                    - generic [aria-hidden] [ref=f3e443]:
                                      - generic [ref=f3e444]: "1"
                                      - generic [ref=f3e445]: "6"
                                  - img "Table 2, 6 places, libre" [ref=f3e451]:
                                    - generic [aria-hidden] [ref=f3e453]:
                                      - generic [ref=f3e454]: "2"
                                      - generic [ref=f3e455]: "6"
                                  - img "Table 3, 6 places, déjà prise à cette heure" [ref=f3e461]:
                                    - generic [aria-hidden] [ref=f3e463]:
                                      - generic [ref=f3e464]: "3"
                                      - generic [ref=f3e465]: "6"
                                  - img "Table 4, 6 places, libre" [ref=f3e475]:
                                    - generic [aria-hidden] [ref=f3e477]:
                                      - generic [ref=f3e478]: "4"
                                      - generic [ref=f3e479]: "6"
                                  - img "Table 5, 8 places, déjà prise à cette heure" [ref=f3e485]:
                                    - generic [aria-hidden] [ref=f3e487]:
                                      - generic [ref=f3e488]: "5"
                                      - generic [ref=f3e489]: "8"
                                  - img "Table 6, 8 places, déjà prise à cette heure" [ref=f3e499]:
                                    - generic [aria-hidden] [ref=f3e501]:
                                      - generic [ref=f3e502]: "6"
                                      - generic [ref=f3e503]: "8"
                                  - img "Table 7, 8 places, libre" [ref=f3e513]:
                                    - generic [aria-hidden] [ref=f3e515]:
                                      - generic [ref=f3e516]: "7"
                                      - generic [ref=f3e517]: "8"
                                  - img "Table 8, 8 places, libre" [ref=f3e523]:
                                    - generic [aria-hidden] [ref=f3e525]:
                                      - generic [ref=f3e526]: "8"
                                      - generic [ref=f3e527]: "8"
                                  - img "Table 9, 8 places, libre" [ref=f3e533]:
                                    - generic [aria-hidden] [ref=f3e535]:
                                      - generic [ref=f3e536]: "9"
                                      - generic [ref=f3e537]: "8"
                                  - img "Table 10, 8 places, libre" [ref=f3e543]:
                                    - generic [aria-hidden] [ref=f3e545]:
                                      - generic [ref=f3e546]: "10"
                                      - generic [ref=f3e547]: "8"
                              - list "Légende du plan" [ref=f3e553]:
                                - listitem [ref=f3e554]:
                                  - generic [ref=f3e556]: Libre
                                - listitem [ref=f3e557]:
                                  - generic [ref=f3e559]: Déjà prise
                              - paragraph [ref=f3e560]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                              - paragraph [ref=f3e561]
                          - paragraph [ref=f3e562]: "Aperçu : les tables vendues ou en paiement apparaissent « Déjà prise »."
                - paragraph [ref=f3e563]: Aucune commission sur les tables. Le client paie la table en entier, plus les frais de service habituels ; chaque invité reçoit son billet.
            - generic [ref=f3e566]:
              - button "Précédent" [ref=f3e567] [cursor=pointer]
              - generic [ref=f3e572]:
                - button "Suivant" [ref=f3e573] [cursor=pointer]
                - button "Enregistrer les modifications" [ref=f3e578] [cursor=pointer]
  - alert [ref=f3e585]
```

# Test source

```ts
  141 |     });
  142 |     const vipId = String((vip.type as Record<string, unknown>).id);
  143 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  144 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', eventId).order('number');
  145 |     if (error || !rows) throw new Error(`[l11cc] tables de l'événement : ${error?.message}`);
  146 |     // Carré VIP en 2 × 2 en haut à gauche, tables rondes en deux rangées en bas
  147 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 37.5], [32.5, 37.5]];
  148 |     const rondePos = [[52.5, 62.5], [67.5, 62.5], [82.5, 62.5], [52.5, 80], [67.5, 80], [82.5, 80]];
  149 |     let iv = 0;
  150 |     let ir = 0;
  151 |     const tables = rows.map((t) => {
  152 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  153 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  154 |     });
  155 |     await rpcOk('event_tables_save', { event_id: eventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  156 | 
  157 |     const vipTables = rows.filter((t) => t.category_id === vipId);
  158 |     const rondeTables = rows.filter((t) => t.category_id === rondeId);
  159 |     const awa = await createClientAccount(`l11cc-a-${STAMP}`);
  160 |     const fatou = await createClientAccount(`l11cc-b-${STAMP}`);
  161 |     const moussa = await createClientAccount(`l11cc-c-${STAMP}`);
  162 |     const guest = await createClientAccount(`l11cc-g-${STAMP}`);
  163 |     const bookingA = await buyTable(eventId, awa, vipId, String(vipTables[2].id), true);
  164 |     await buyTable(eventId, fatou, rondeId, String(rondeTables[0].id), true);
  165 |     await buyTable(eventId, moussa, rondeId, String(rondeTables[1].id), false);
  166 | 
  167 |     const { data: seats, error: sErr } = await service.from('tickets').select('id, ticket_number').eq('event_table_booking_id', bookingA!).order('ticket_number');
  168 |     if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cc] places de la table : ${sErr?.message ?? seats?.length}`);
  169 |     const transfer = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[0].id, actor_id: awa.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  170 |     await rpcOk('ticket_transfer_accept', { transfer_id: transfer.transfer_id, actor_id: guest.userId });
  171 | 
  172 |     const controller = await createControllerAccount(`l11cc-${STAMP}`);
  173 |     const { error: aErr } = await service.from('event_controllers').upsert(
  174 |         { event_id: eventId, user_id: controller.userId, can_accept_cash: false, created_by: owner.userId, entry_point: 'Entrée principale' },
  175 |         { onConflict: 'event_id,user_id' });
  176 |     if (aErr) throw new Error(`[l11cc] affectation du contrôleur : ${aErr.message}`);
  177 |     // La place envoyée (seats[0]) est réémise au nom de l’invitée : les entrées portent sur deux places restées au titulaire
  178 |     for (const seat of seats.slice(1, 3)) {
  179 |         const number = String(seat.ticket_number);
  180 |         const { data, error: scanErr } = await service.rpc('ticket_scan', { p: {
  181 |             scanner_id: controller.userId, event_id: eventId, method: 'MANUAL', ticket_number: number, identity_verified: true,
  182 |             payload_hash: createHash('sha256').update(number.toUpperCase()).digest('hex'), client_key: `l11cc-${randomUUID()}`,
  183 |         } });
  184 |         if (scanErr || (data as { result?: string } | null)?.result !== 'valid') throw new Error(`[l11cc] entrée de la place ${number} : ${scanErr?.message ?? JSON.stringify(data)}`);
  185 |     }
  186 |     return { eventId, title, controller, seatNumber: String(seats[3].ticket_number) };
  187 | }
  188 | 
  189 | let seeded: Seeded | null = null;
  190 | let superadmin = '';
  191 | let previous: boolean | null = null;
  192 | 
  193 | test.beforeAll(async () => {
  194 |     test.setTimeout(240_000);
  195 |     superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  196 |     const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
  197 |     previous = (data?.value as { value?: boolean } | null)?.value === true;
  198 |     await setTablesService(true, superadmin);
  199 |     seeded = await seed(superadmin);
  200 | });
  201 | 
  202 | test.afterAll(async () => {
  203 |     if (superadmin) await setTablesService(previous === true, superadmin);
  204 | });
  205 | 
  206 | for (const theme of THEMES) {
  207 |     test(`tables d’un événement · ${theme.key} : organisatrice, porte, scanner, administration (390 et 1440 px)`, async ({ browser }, testInfo) => {
  208 |         test.setTimeout(600_000);
  209 |         const data = seeded!;
  210 |         const owner = readDemoIds().accounts.organisateur3;
  211 | 
  212 |         // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
  213 |         const org = await themedContext(browser, testInfo, theme.scheme);
  214 |         await login(org, owner.email);
  215 |         const page = await org.newPage();
  216 |         for (const w of WIDTHS) {
  217 |             await page.setViewportSize({ width: w.width, height: w.height });
  218 |             await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
  219 |             await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  220 |             await page.getByRole('button', { name: /^Étape 4 : Billetterie$/ }).click();
  221 |             await page.getByRole('tab', { name: 'Tables' }).click();
  222 |             const editor = page.locator('[data-tables-editeur]');
  223 |             await expect(editor).toBeVisible({ timeout: 30_000 });
  224 |             // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
  225 |             await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
  226 |             await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
  227 |             await settle(page);
  228 |             await checkLayout(page, w.width, w.phone, 'éditeur des tables');
  229 |             await shot(page, 'editeur', w.width, theme.key);
  230 |             await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
  231 |             // Plan en édition : une table choisie (panneau de réglage)
  232 |             const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
  233 |             if (await table1.count() > 0) await table1.first().click();
  234 |             await settle(page);
  235 |             await shot(page, 'plan-edition', w.width, theme.key);
  236 |             await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
  237 |             await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
  238 |             await settle(page);
  239 |             await shot(page, 'vue-client', w.width, theme.key);
  240 |             // Type figé : prix et places verrouillés, avec la raison
> 241 |             await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
      |                                                                                                             ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  242 |             const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
  243 |             await expect(dialog).toBeVisible();
  244 |             await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
  245 |             await expect(dialog).toContainText('Soit 25');
  246 |             await expect(dialog).toContainText('par personne.');
  247 |             await settle(page);
  248 |             await shot(page, 'type-fige', w.width, theme.key, false);
  249 |             await page.keyboard.press('Escape');
  250 | 
  251 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  252 |             const pil = page.locator('[data-tables-pilotage]');
  253 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  254 |             await expect(pil.locator('text="Awa S." >> visible=true').first()).toBeVisible();
  255 |             await settle(page);
  256 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  257 |             await shot(page, 'pilotage', w.width, theme.key);
  258 | 
  259 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  260 |             const door = page.locator('[data-porte]');
  261 |             await expect(door).toBeVisible({ timeout: 30_000 });
  262 |             await expect(door.getByText('2/6').first()).toBeVisible();
  263 |             await settle(page);
  264 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  265 |             await shot(page, 'porte', w.width, theme.key);
  266 |             await door.locator('[data-porte-table] button').first().click();
  267 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  268 |             await settle(page);
  269 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  270 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  271 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  272 |             await settle(page);
  273 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  274 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  275 |             await page.emulateMedia({ media: 'print' });
  276 |             await settle(page);
  277 |             await shot(page, 'porte-impression', w.width, theme.key);
  278 |             await page.emulateMedia({ media: 'screen' });
  279 |         }
  280 |         await org.close();
  281 | 
  282 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  283 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  284 |         await login(ctl, data.controller.email);
  285 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
  286 |         const cpage = await ctl.newPage();
  287 |         for (const w of WIDTHS) {
  288 |             await cpage.setViewportSize({ width: w.width, height: w.height });
  289 |             await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
  290 |             await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
  291 |             await settle(cpage);
  292 |             await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
  293 |             await shot(cpage, 'porte-controleur', w.width, theme.key);
  294 | 
  295 |             await cpage.route(/\/api\/controller\/scan$/, async (route) => {
  296 |                 if (route.request().method() !== 'POST') return route.continue();
  297 |                 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
  298 |                     result: 'valid', replayed: false, message: 'Entrée validée',
  299 |                     ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
  300 |                     table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
  301 |                 }) });
  302 |             });
  303 |             await cpage.goto('/controller/scanner', { waitUntil: 'load' });
  304 |             // Premier passage : écran de départ ; ensuite, le scanner retrouve le contrôle en cours (« Reprendre le contrôle »)
  305 |             const start = cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i });
  306 |             const resume = cpage.getByRole('button', { name: 'Reprendre le contrôle' });
  307 |             await expect(start.or(resume)).toBeVisible({ timeout: 30_000 });
  308 |             if (await resume.isVisible()) await resume.click();
  309 |             else await start.click();
  310 |             await cpage.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  311 |             await expect(cpage.getByRole('link', { name: 'Liste des tables' })).toHaveAttribute('href', `/controller/porte/${data.eventId}`);
  312 |             await cpage.evaluate((p) => {
  313 |                 const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  314 |                 if (!cam) throw new Error('caméra simulée absente');
  315 |                 cam.setPayload(p);
  316 |             }, `EVT1:00000000-0000-4000-8000-000000000971:482913`);
  317 |             const overlay = cpage.locator('[data-scan-state="result"][data-scan-result="valid"]');
  318 |             await expect(overlay).toBeVisible({ timeout: 20_000 });
  319 |             await expect(overlay.locator('[data-scan-table]')).toContainText('Table 3 · Carré VIP');
  320 |             await expect(overlay.locator('[data-scan-table]')).toContainText('3/6 entrés');
  321 |             await cpage.waitForTimeout(250);
  322 |             await shot(cpage, 'scanner-badge', w.width, theme.key, false);
  323 |             await cpage.unroute(/\/api\/controller\/scan$/);
  324 |         }
  325 |         await ctl.close();
  326 | 
  327 |         // ── Administration : fiche de l'événement ─────────────────────────────────────────────────────────────────
  328 |         const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('admin'));
  329 |         const apage = await adm.newPage();
  330 |         for (const w of WIDTHS) {
  331 |             await apage.setViewportSize({ width: w.width, height: w.height });
  332 |             await apage.goto(`/admin/events/${data.eventId}`, { waitUntil: 'load' });
  333 |             const section = apage.locator('[data-admin-tables]');
  334 |             await expect(section).toBeVisible({ timeout: 30_000 });
  335 |             await expect(section.locator('text="Carré VIP" >> visible=true').first()).toBeVisible();
  336 |             await section.scrollIntoViewIfNeeded();
  337 |             await settle(apage);
  338 |             await checkLayout(apage, w.width, w.phone, 'fiche de l’administration');
  339 |             await section.screenshot({ path: path.join(SHOTS, `l11cc-admin__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 80 });
  340 |         }
  341 |         await adm.close();
```