# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 10 [partenaire] [contrôleur] [client] : grande soirée, deux zones, trois portes, liste des invités, mauvaise zone, double entrée, catégorie épuisée puis réouverte
- Location: e2e/recette.spec.ts:1225:5

# Error details

```
Error: refus de la jauge, texte exact

expect(locator).toBeVisible() failed

Locator: locator('section').filter({ has: getByRole('heading', { name: 'SIMPLE', exact: true, level: 3 }) }).getByText('Les quantités mises en vente des catégories actives totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27).', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - refus de la jauge, texte exact locator('section').filter({ has: getByRole('heading', { name: 'SIMPLE', exact: true, level: 3 }) }).getByText('Les quantités mises en vente des catégories actives totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27).', { exact: true }).first() with timeout 15000ms
  - waiting for locator('section').filter({ has: getByRole('heading', { name: 'SIMPLE', exact: true, level: 3 }) }).getByText('Les quantités mises en vente des catégories actives totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27).', { exact: true }).first()

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
  - button "Replier la barre latérale" [expanded]
  - navigation "Navigation principale":
    - paragraph: Gestion
    - link "Tableau de bord":
      - /url: /partner/dashboard
    - link "Événements":
      - /url: /partner/events
    - link "Équipe":
      - /url: /partner/team
    - paragraph: Outils
    - link "Finances":
      - /url: /partner/finance
    - link "Statistiques":
      - /url: /partner/stats
    - link "Scanner les billets":
      - /url: /partner/scan
    - link "Calendrier":
      - /url: /partner/calendar
    - link "Abonnement":
      - /url: /partner/subscription
    - link "Profil partenaire":
      - /url: /partner/profile
    - link "Retour au site":
      - /url: /
  - link "Aïssatou OrgaA Partenaire":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement…":
    - /url: /explore
  - button "Notifications, 47 non lues": "47"
  - button "Aïssatou OrgaA"
- main:
  - link "Retour à mes événements":
    - /url: /partner/events
  - text: Publié
  - heading "Modifier l’événement" [level=1]
  - paragraph: Recette — Grande soirée 17.37.45
  - status:
    - paragraph: "Votre événement est validé : ce que vos modifications changent"
    - list:
      - listitem: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
      - listitem: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
      - listitem: "Titre : les détenteurs de billets sont prévenus dans l’application."
      - listitem: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
      - listitem: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
      - listitem: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives."
  - navigation "Étapes du formulaire":
    - paragraph: Étape 4 sur 5 — Billetterie
    - list:
      - listitem:
        - 'button "Étape 1 : Informations générales (terminée)"'
      - listitem:
        - 'button "Étape 2 : Programme (terminée)"'
      - listitem:
        - 'button "Étape 3 : Accès et informations pratiques (terminée)"'
      - listitem:
        - 'button "Étape 4 : Billetterie"'
      - listitem:
        - 'button "Étape 5 : Contrôle à l’entrée (facultatif)"'
      - listitem:
        - button "Vérifier avant d’envoyer"
  - heading "Billetterie" [level=2]
  - paragraph: Chaque catégorie s’enregistre séparément. Le prix ne change plus dès qu’un billet est vendu ou réservé ; la quantité ne descend jamais sous les ventes.
  - region "VVIP":
    - heading "VVIP" [level=3]
    - paragraph: Aucun billet vendu · En ligne et au guichet
    - button "Supprimer la catégorie VVIP"
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: VVIP
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)": "30000"
    - paragraph: "Billet payant : 100 F CFA au moins. 0 pour une entrée gratuite."
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "5"
    - paragraph: Nombre de billets de cette catégorie (1 à 100 000).
    - paragraph: Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie.
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente"
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 0 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
    - group "Où vendre cette catégorie":
      - text: Où vendre cette catégorie
      - checkbox "Vendue en ligne" [checked]
      - text: Vendue en ligne
      - paragraph: Affichée sur la page de l’événement et achetable sur le site.
      - checkbox "Vendue au guichet" [checked]
      - text: Vendue au guichet
      - paragraph: Proposée au contrôleur et vendue en espèces à l’entrée.
      - paragraph: "Résultat : En ligne et au guichet"
    - group "Au contrôle des entrées":
      - text: Au contrôle des entrées Couleur au contrôle
      - radiogroup "Couleur au contrôle":
        - radio "Blanc"
        - radio "Argent"
        - radio "Rose"
        - radio "Turquoise"
        - radio "Bleu nuit"
        - radio "Violet" [checked]
        - radio "Noir"
      - paragraph: Bande de couleur montrée au contrôleur avec le nom de la catégorie. Proposée automatiquement, modifiable.
      - text: Consigne d’entrée
      - textbox "Consigne d’entrée":
        - /placeholder: "Par exemple : Remettre bracelet doré"
      - paragraph: Facultative, 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée.
    - checkbox "Catégorie active" [checked]
    - text: Catégorie active
    - button "Enregistrer la catégorie" [disabled]
  - region "SIMPLE":
    - heading "SIMPLE" [level=3]
    - paragraph: 2 billets vendus · En ligne et au guichet
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: SIMPLE
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)" [disabled]: "5000"
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)" [invalid]: "4"
    - paragraph: "Jamais sous les ventes : 2 billets vendus, 0 en cours de paiement."
    - paragraph: Les places mises en vente, avec celles déjà vendues des catégories arrêtées, totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27).
    - paragraph: Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie.
    - paragraph: "Prix verrouillé : 2 billets vendus. Créez une autre catégorie pour un nouveau tarif."
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente"
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 0 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
    - group "Où vendre cette catégorie":
      - text: Où vendre cette catégorie
      - checkbox "Vendue en ligne" [checked]
      - text: Vendue en ligne
      - paragraph: Affichée sur la page de l’événement et achetable sur le site.
      - checkbox "Vendue au guichet" [checked]
      - text: Vendue au guichet
      - paragraph: Proposée au contrôleur et vendue en espèces à l’entrée.
      - paragraph: "Résultat : En ligne et au guichet"
    - group "Au contrôle des entrées":
      - text: Au contrôle des entrées Couleur au contrôle
      - radiogroup "Couleur au contrôle":
        - radio "Blanc" [checked]
        - radio "Argent"
        - radio "Rose"
        - radio "Turquoise"
        - radio "Bleu nuit"
        - radio "Violet"
        - radio "Noir"
      - paragraph: Bande de couleur montrée au contrôleur avec le nom de la catégorie. Proposée automatiquement, modifiable.
      - text: Consigne d’entrée
      - textbox "Consigne d’entrée":
        - /placeholder: "Par exemple : Remettre bracelet doré"
      - paragraph: Facultative, 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée.
    - checkbox "Catégorie active" [checked]
    - text: Catégorie active
    - alert:
      - paragraph: Les places mises en vente, avec celles déjà vendues des catégories arrêtées, totaliseraient 29 places. Augmentez d’abord la capacité totale de l’événement (actuellement 27).
    - button "Enregistrer la catégorie"
  - region "VIP":
    - heading "VIP" [level=3]
    - paragraph: 2 billets vendus · En ligne et au guichet
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: VIP
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)" [disabled]: "15000"
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "20"
    - paragraph: "Jamais sous les ventes : 2 billets vendus, 0 en cours de paiement."
    - paragraph: Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie.
    - paragraph: "Prix verrouillé : 2 billets vendus. Créez une autre catégorie pour un nouveau tarif."
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente"
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 0 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
    - group "Où vendre cette catégorie":
      - text: Où vendre cette catégorie
      - checkbox "Vendue en ligne" [checked]
      - text: Vendue en ligne
      - paragraph: Affichée sur la page de l’événement et achetable sur le site.
      - checkbox "Vendue au guichet" [checked]
      - text: Vendue au guichet
      - paragraph: Proposée au contrôleur et vendue en espèces à l’entrée.
      - paragraph: "Résultat : En ligne et au guichet"
    - group "Au contrôle des entrées":
      - text: Au contrôle des entrées Couleur au contrôle
      - radiogroup "Couleur au contrôle":
        - radio "Blanc"
        - radio "Argent"
        - radio "Rose" [checked]
        - radio "Turquoise"
        - radio "Bleu nuit"
        - radio "Violet"
        - radio "Noir"
      - paragraph: Bande de couleur montrée au contrôleur avec le nom de la catégorie. Proposée automatiquement, modifiable.
      - text: Consigne d’entrée
      - textbox "Consigne d’entrée":
        - /placeholder: "Par exemple : Remettre bracelet doré"
        - text: Remettre bracelet doré — orienter vers le carré VIP
      - paragraph: Facultative, 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée.
    - checkbox "Catégorie active" [checked]
    - text: Catégorie active
    - button "Enregistrer la catégorie" [disabled]
  - button "Ajouter une catégorie"
  - button "Précédent"
  - button "Suivant"
  - button "Enregistrer les modifications"
- alert
```

# Test source

```ts
  1284 |         await general.getByRole('button', { name: /^ajouter une porte$/i }).click();
  1285 |         await general.getByLabel(/^nom de la porte/i).nth(1).fill('Porte Sud');
  1286 |         await zonesRegion.getByRole('button', { name: /^ajouter une zone$/i }).click();
  1287 |         const carre = zoneItems.nth(1);
  1288 |         await carre.getByLabel(/^nom de la zone/i).fill('Carré VIP');
  1289 |         await carre.getByRole('radio', { name: /^contrôle de zone/i }).check();
  1290 |         for (const name of ['VIP', 'VVIP']) await carre.getByRole('checkbox', { name: categoryBox(name) }).check();
  1291 |         await expect(carre.getByRole('checkbox', { name: categoryBox('SIMPLE') }), '« Carré VIP » n’admet pas SIMPLE').not.toBeChecked();
  1292 |         await carre.getByLabel(/^nom de la porte/i).fill('Accès carré');
  1293 |         const saved = await expectRoute(partner, 'PUT', `/api/partner/events/${eventId}/zones`,
  1294 |             () => zonesRegion.getByRole('button', { name: /^enregistrer les zones$/i }).click(), 200, 'zones et portes');
  1295 |         const zones = (saved.zones ?? []) as Array<{ name: string; kind: string; category_ids: string[]; gates: Array<{ name: string }> }>;
  1296 |         expect(zones.map((z) => `${z.name} ${z.kind} ${z.category_ids.length} ${z.gates.map((g) => g.name).join(' + ')}`), 'configuration enregistrée')
  1297 |             .toEqual(['Entrée générale ENTREE 3 Porte Nord + Porte Sud', 'Carré VIP CONTROLE 2 Accès carré']);
  1298 | 
  1299 |         // Équipe : onglet Équipe du pilotage
  1300 |         await partner.goto(`/partner/events/${eventId}?tab=equipe`);
  1301 |         await expect(partner.getByRole('tab', { name: /^équipe/i }), 'onglet Équipe ouvert par ?tab=equipe').toHaveAttribute('aria-selected', 'true');
  1302 |         // fumee-controleur, déjà de l'équipe de PARTNER_A : affecté directement
  1303 |         // Finition 1 (E-14, E-18) : invitations dans la fenêtre « Inviter un contrôleur » (étapes recalées, signalées)
  1304 |         const inviteDialog = partner.getByRole('dialog', { name: /^inviter un contrôleur$/i });
  1305 |         await partner.getByRole('button', { name: /^inviter un contrôleur$/i }).click();
  1306 |         await inviteDialog.getByLabel(/^numéro de téléphone/i).fill(controllerA.phone.replace(/^\+221/, ''));
  1307 |         await expectRoute(partner, 'POST', '/api/partner/team/invite', () => inviteDialog.getByRole('button', { name: /^inviter$/i }).click(), 201, 'affectation de fumee-controleur');
  1308 |         // K2, compte établi inconnu de PARTNER_A : confirmation, puis invitation qu'il accepte lui-même (0.5)
  1309 |         await partner.getByRole('button', { name: /^inviter un contrôleur$/i }).click();
  1310 |         await inviteDialog.getByLabel(/^numéro de téléphone/i).fill(k2.local);
  1311 |         const asked = await expectRoute(partner, 'POST', '/api/partner/team/invite', () => inviteDialog.getByRole('button', { name: /^inviter$/i }).click(), 200, 'K2 : compte existant');
  1312 |         expect(asked.requires_confirmation, `K2 inconnu de la partenaire : confirmation demandée (${JSON.stringify(asked)})`).toBe(true);
  1313 |         const existing = partner.getByRole('dialog', { name: /^ce numéro a déjà un compte/i });
  1314 |         await expect(existing).toBeVisible();
  1315 |         const invited = await expectRoute(partner, 'POST', '/api/partner/team/invite', () => existing.getByRole('button', { name: /^envoyer l.invitation$/i }).click(), 201, 'invitation de K2');
  1316 |         expect(typeof invited.invitation_id, 'invitation à accepter, aucune affectation directe').toBe('string');
  1317 | 
  1318 |         await signIn(k2Page, k2.email, /^\/controller\/scanner/);
  1319 |         await k2Page.goto('/invitations');
  1320 |         const offer = k2Page.getByRole('article').filter({ hasText: title });
  1321 |         await expect(offer, 'invitation de PARTNER_A pour la grande soirée').toBeVisible({ timeout: 30_000 });
  1322 |         await expectRoute(k2Page, 'POST', /^\/api\/account\/controller-invitations\/[^/]+$/, () => offer.getByRole('button', { name: /^accepter l.invitation$/i }).click(), 200, 'K2 accepte');
  1323 |         await expect(k2Page.getByText(/^vous contrôlez maintenant les événements de /i), 'acceptation annoncée').toBeVisible();
  1324 | 
  1325 |         await partner.reload();
  1326 |         await expect(partner.getByRole('tab', { name: /^équipe/i })).toHaveAttribute('aria-selected', 'true');
  1327 |         const team = partner.getByRole('table', { name: /^contrôleurs de l’équipe$/i });
  1328 |         await setGate(partner, team, controllerA.firstName, 'Porte Nord — Entrée générale', false);
  1329 |         await setGate(partner, team, k2.firstName, 'Porte Sud — Entrée générale', true);
  1330 |         const { data: gates, error: gatesErr } = await serviceClient().from('event_gates').select('id, name').eq('event_id', eventId);
  1331 |         if (gatesErr) throw new Error(`[e2e] portes de la grande soirée : ${gatesErr.message}`);
  1332 |         const gateName = new Map((gates ?? []).map((g) => [String(g.id), String(g.name)]));
  1333 |         const { data: rows, error: rowsErr } = await serviceClient().from('event_controllers').select('user_id, gate_id, gate_change_allowed').eq('event_id', eventId);
  1334 |         if (rowsErr) throw new Error(`[e2e] équipe de la grande soirée : ${rowsErr.message}`);
  1335 |         const controllerAId = await userIdByEmail(controllerA.email);
  1336 |         expect((rows ?? []).map((x) => `${x.user_id === k2.userId ? 'K2' : x.user_id === controllerAId ? 'A' : String(x.user_id)} ${gateName.get(String(x.gate_id)) ?? 'sans porte'} ${String(x.gate_change_allowed)}`).sort(),
  1337 |             'équipe en base : une porte chacun, K2 seul peut en changer').toEqual(['A Porte Nord false', 'K2 Porte Sud true']);
  1338 |     });
  1339 | 
  1340 |     await test.step('2. client : 2 SIMPLE et 1 VIP ; partenaire : invitation VIP « Awa Diop » à un numéro sans compte', async () => {
  1341 |         simple = await buyThroughUi(client, eventId, 'SIMPLE', 2);
  1342 |         vip = (await buyThroughUi(client, eventId, 'VIP', 1))[0];
  1343 | 
  1344 |         await partner.goto(`/partner/events/${eventId}?tab=invitations`);
  1345 |         await expect(partner.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
  1346 |         const panel = partner.getByRole('tabpanel');
  1347 |         const category = panel.getByLabel(/^catégorie/i);
  1348 |         const value = await category.locator('option', { hasText: /^VIP/ }).getAttribute('value');
  1349 |         if (!value) throw new Error('[e2e] option « VIP » sans valeur dans le champ Catégorie');
  1350 |         await category.selectOption(value);
  1351 |         await panel.getByLabel(/^numéro 1(?!\d)/i).fill(guestPhone.replace(/^\+221/, ''));
  1352 |         await panel.getByLabel(/^nom de l.invité 1(?!\d)/i).fill('Awa Diop');
  1353 |         await panel.getByLabel(/^billets par numéro/i).selectOption('1');
  1354 |         await panel.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  1355 |         const confirm = partner.getByRole('alertdialog', { name: /^confirmer l.envoi/i });
  1356 |         await expect(confirm.getByText('Awa Diop', { exact: true }), 'colonne « Invité » de la confirmation').toBeVisible();
  1357 |         const sent = await expectRoute(partner, 'POST', `/api/partner/events/${eventId}/invitations`, () => confirm.getByRole('button', { name: /^confirmer$/i }).click(), 200, 'invitation nommée');
  1358 |         expect(sent, 'un billet pour un numéro').toMatchObject({ ok: true, ticket_count: 1, phone_count: 1 });
  1359 | 
  1360 |         const { data: invitations, error } = await serviceClient().from('tickets').select('id, user_id, guest_name, status').eq('event_id', eventId).eq('sale_channel', 'INVITATION');
  1361 |         if (error) throw new Error(`[e2e] invitations de la grande soirée : ${error.message}`);
  1362 |         expect((invitations ?? []).map((t) => `${String(t.guest_name)} ${String(t.user_id)} ${String(t.status)}`), 'invitation nommée sans porteur').toEqual(['Awa Diop null VALIDE']);
  1363 |         guestTicket = String(invitations![0].id);
  1364 |     });
  1365 | 
  1366 |     await test.step('3. SIMPLE épuisée puis réouverte : fiche et carte relues sans recharger', async () => {
  1367 |         const visitorContext = await openAnonymousContext(browser, testInfo, 'clair');
  1368 |         const catalog = adopt('visiteur-grande-soiree', visitorContext, await visitorContext.newPage());
  1369 |         const sheet = adopt('visiteur-grande-soiree-fiche', visitorContext, await visitorContext.newPage());
  1370 |         await catalog.goto(`/explore?q=${encodeURIComponent(title)}`);
  1371 |         const card = catalog.locator('article').filter({ has: catalog.getByRole('heading', { name: title, exact: true }) });
  1372 |         await expect(card, 'carte de la grande soirée au catalogue').toBeVisible({ timeout: 30_000 });
  1373 |         await expect(card.getByText(fcfa(15_000)), 'SIMPLE épuisée : « À partir de 15 000 F CFA »').toBeVisible();
  1374 |         await expect(card.getByText(/^(Complet|Dernières places)$/), 'aucun badge de stock sur la carte').toHaveCount(0);
  1375 |         await sheet.goto(`/events/${eventId}`);
  1376 |         const simpleLine = sheet.getByRole('listitem').filter({ has: sheet.getByRole('heading', { level: 3, name: 'SIMPLE', exact: true }) });
  1377 |         await expect(simpleLine.getByText('Complet', { exact: true }), 'fiche : SIMPLE « Complet »').toBeVisible({ timeout: 30_000 });
  1378 | 
  1379 |         await partner.goto(editUrl);
  1380 |         await openTicketing(partner);
  1381 |         const quantity = categorySection(partner, 'SIMPLE').getByLabel(/^quantité mise en vente/i);
  1382 |         await quantity.fill('4');
  1383 |         await expectRoute(partner, 'PATCH', CATEGORY_ROUTE, () => categorySection(partner, 'SIMPLE').getByRole('button', { name: /^enregistrer la catégorie$/i }).click(), 409, 'SIMPLE à 4 sur une jauge de 27');
> 1384 |         await expect(categorySection(partner, 'SIMPLE').getByText(GRANDE_SOIREE_QUOTA_REFUSAL, { exact: true }).first(), 'refus de la jauge, texte exact').toBeVisible();
       |                                                                                                                                                            ^ Error: refus de la jauge, texte exact
  1385 |         await quantity.fill('2'); // brouillon rendu à sa valeur : la page se quitte sans garde
  1386 | 
  1387 |         await partner.goto(editUrl);
  1388 |         const capacity = partner.getByLabel(/^capacité totale/i);
  1389 |         await expect(capacity, 'jauge lue').toHaveValue('27');
  1390 |         await capacity.fill('29');
  1391 |         await expectRoute(partner, 'PUT', `/api/partner/events/${eventId}`, () => partner.getByRole('button', { name: /^enregistrer les modifications$/i }).click(), 200, 'jauge portée à 29');
  1392 |         await openTicketing(partner);
  1393 |         await categorySection(partner, 'SIMPLE').getByLabel(/^quantité mise en vente/i).fill('4');
  1394 |         await expectRoute(partner, 'PATCH', CATEGORY_ROUTE, () => categorySection(partner, 'SIMPLE').getByRole('button', { name: /^enregistrer la catégorie$/i }).click(), 200, 'SIMPLE portée à 4');
  1395 | 
  1396 |         // Sans recharger : la fiche et la carte suivent le temps réel (consigne 5)
  1397 |         await expect(simpleLine.getByText('Plus que 2 places', { exact: true }), 'fiche relue en direct : SIMPLE « Plus que 2 places »').toBeVisible({ timeout: 45_000 });
  1398 |         await expect(card.getByText(fcfa(5_000)), 'carte relue en direct : « À partir de 5 000 F CFA »').toBeVisible({ timeout: 45_000 });
  1399 |         await expect(card.getByText(/^(Complet|Dernières places)$/), 'aucun badge : 18 VIP restent au-dessus du seuil (X6)').toHaveCount(0);
  1400 |     });
  1401 | 
  1402 |     await test.step('4. double entrée : SIMPLE#1 vert à la Porte Nord, puis « Déjà utilisé » à la Porte Sud', async () => {
  1403 |         await north.goto('/controller/scanner');
  1404 |         await chooseEvent(north, title, /^Votre porte : Porte Nord · Entrée générale \(Entrée\)\./, false);
  1405 |         await startControl(north, title);
  1406 |         await scanShown(north, await livePayload(client, simple[0]), 'SIMPLE#1 à la Porte Nord', 'valid', async (o) => {
  1407 |             await expect(o).toHaveAttribute('data-scan-category', 'accepte');
  1408 |             await expect(o.getByText('SIMPLE', { exact: true }), 'catégorie').toBeVisible();
  1409 |             await expect(o.getByText('Zone : Entrée générale · Porte Nord', { exact: true }), 'zone et porte').toBeVisible();
  1410 |         });
  1411 |         expect(await ticketStatus(simple[0]), 'SIMPLE#1 composté').toBe('UTILISE');
  1412 | 
  1413 |         await k2Page.goto('/controller/scanner');
  1414 |         await chooseEvent(k2Page, title, /^Votre porte : Porte Sud · Entrée générale \(Entrée\)\./, true);
  1415 |         await startControl(k2Page, title);
  1416 |         await scanShown(k2Page, usedPayload(simple[0], 'SIMPLE#1 à la Porte Sud'), 'SIMPLE#1 à la Porte Sud', 'already_used', async (o) => {
  1417 |             await expect(o.getByText(/^Déjà utilisé à \d{1,2}:\d{2}, Porte Nord$/), 'heure et porte de la première entrée (X5)').toBeVisible();
  1418 |         });
  1419 |     });
  1420 | 
  1421 |     await test.step('5. K2 à « Accès carré » : mauvaise zone, pas encore entré ; VIP à la Porte Nord avec sa consigne ; accès autorisé', async () => {
  1422 |         await k2Page.getByRole('button', { name: 'Changer d’événement' }).click();
  1423 |         await chooseEvent(k2Page, title, /^Votre porte : Porte Sud · Entrée générale \(Entrée\)\./, true);
  1424 |         await k2Page.getByRole('button', { name: /^changer de porte$/i }).click();
  1425 |         const picker = k2Page.getByRole('dialog', { name: /^choisir ma porte$/i });
  1426 |         await expect(picker).toBeVisible();
  1427 |         await picker.getByRole('radio', { name: /^Accès carré · Carré VIP \(Contrôle de zone\)$/ }).check();
  1428 |         await expectRoute(k2Page, 'POST', '/api/controller/gate', () => picker.getByRole('button', { name: /^enregistrer cette porte$/i }).click(), 200, 'K2 passe à « Accès carré »');
  1429 |         await expect(picker).toBeHidden();
  1430 |         await chooseEvent(k2Page, title, /^Votre porte : Accès carré · Carré VIP \(Contrôle de zone\)\./, true);
  1431 |         await startControl(k2Page, title);
  1432 | 
  1433 |         const wrong = await scanShown(k2Page, usedPayload(simple[0], 'SIMPLE#1 à l’accès du carré'), 'SIMPLE#1 à l’accès du carré', 'wrong_zone', async (o) => {
  1434 |             await expect(o).toHaveAttribute('data-scan-category', 'oriente');
  1435 |             await expect(o.getByText('Accès refusé : billet SIMPLE', { exact: true }), 'mauvaise zone').toBeVisible();
  1436 |             await expect(o.getByText('Présentez-vous à : Entrée générale', { exact: true })).toBeVisible();
  1437 |         });
  1438 |         await expect.poll(async () => (await probeVibrations(k2Page)).filter((v) => v.at >= wrong.armedAt).map((v) => v.pattern.join(',')),
  1439 |             { message: 'vibration orange de la mauvaise zone', timeout: 10_000 }).toContain('250,100,250');
  1440 |         await scanShown(k2Page, await livePayload(client, vip), 'VIP jamais entré à l’accès du carré', 'not_entered', async (o) => {
  1441 |             await expect(o).toHaveAttribute('data-scan-category', 'oriente');
  1442 |             await expect(o.getByText('Pas encore entré', { exact: true })).toBeVisible();
  1443 |             await expect(o.getByText('Passez d’abord par : Entrée générale', { exact: true })).toBeVisible();
  1444 |         });
  1445 |         expect(await ticketStatus(vip), 'un contrôle de zone ne composte jamais').toBe('VALIDE');
  1446 |         await scanShown(north, await livePayload(client, vip), 'VIP à la Porte Nord', 'valid', async (o) => {
  1447 |             await expect(o.getByText('VIP', { exact: true }), 'catégorie').toBeVisible();
  1448 |             await expect(o.getByText(GRANDE_SOIREE_VIP_INSTRUCTION, { exact: true }), 'consigne de VIP').toBeVisible();
  1449 |             await expect(o.getByText('Zone : Entrée générale · Porte Nord', { exact: true })).toBeVisible();
  1450 |         });
  1451 |         await scanShown(k2Page, usedPayload(vip, 'VIP entré, à l’accès du carré'), 'VIP entré, à l’accès du carré', 'zone_ok', async (o) => {
  1452 |             await expect(o).toHaveAttribute('data-scan-category', 'accepte');
  1453 |             await expect(o.getByText('Accès autorisé', { exact: true })).toBeVisible();
  1454 |             await expect(o.getByText('Zone : Carré VIP', { exact: true })).toBeVisible();
  1455 |             await expect(o.getByText(/^Entré à \d{1,2}:\d{2}, Porte Nord$/)).toBeVisible();
  1456 |         });
  1457 |     });
  1458 | 
  1459 |     await test.step('6. Porte Nord : liste des invités, « Awa Diop », pièce vérifiée, entrée validée ; plus rien à valider ensuite', async () => {
  1460 |         await north.getByRole('button', { name: /^liste des invités$/i }).click();
  1461 |         const search = north.getByRole('region', { name: /^liste des invités$/i });
  1462 |         await expect(search).toBeVisible();
  1463 |         await search.getByLabel(/^numéro de l.invité/i).fill(guestDigits);
  1464 |         await expectRoute(north, 'POST', '/api/controller/scan/guests', () => search.getByRole('button', { name: /^rechercher$/i }).click(), 200, 'recherche par les 4 derniers chiffres');
  1465 |         const found = search.getByRole('list', { name: /^invités trouvés$/i }).getByRole('listitem');
  1466 |         await expect(found, 'un invité trouvé').toHaveCount(1);
  1467 |         for (const text of ['Awa Diop', 'VIP', '1 billet']) await expect(found.getByText(text, { exact: true }), `carte de l’invité : « ${text} »`).toBeVisible();
  1468 |         await found.getByRole('button', { name: /^choisir$/i }).click();
  1469 |         await expect(north.getByText('Vérifiez la pièce d’identité', { exact: true })).toBeVisible();
  1470 |         const verified = north.getByRole('checkbox', { name: /^j.ai vérifié la pièce d.identité$/i });
  1471 |         await expect(verified, 'case décochée').not.toBeChecked();
  1472 |         const admit = north.getByRole('button', { name: /^valider l.entrée d.une personne$/i });
  1473 |         await expect(admit, 'validation impossible sans la pièce').toBeDisabled();
  1474 |         await verified.check();
  1475 |         await admit.click();
  1476 |         const overlay = north.locator('[data-scan-state="result"][data-scan-result="valid"]');
  1477 |         await expect(overlay, 'invitée validée par la liste').toBeVisible({ timeout: 30_000 });
  1478 |         await expect(overlay.getByText('Awa Diop', { exact: true }).first(), 'porteur : nom de l’invitée').toBeVisible();
  1479 |         await expect(overlay.getByText('Invitation', { exact: true }), 'badge Invitation').toBeVisible();
  1480 |         await resultClosed(north);
  1481 |         expect(await ticketStatus(guestTicket), 'invitation compostée').toBe('UTILISE');
  1482 |         const { data: transfers, error } = await serviceClient().from('ticket_transfers').select('status').eq('ticket_id', guestTicket);
  1483 |         if (error) throw new Error(`[e2e] transfert de l’invitation : ${error.message}`);
  1484 |         expect((transfers ?? []).map((t) => String(t.status)), 'transfert clos ADMITTED').toEqual(['ADMITTED']);
```