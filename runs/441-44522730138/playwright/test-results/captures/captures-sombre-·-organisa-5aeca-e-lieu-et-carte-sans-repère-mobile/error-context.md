# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-creation-carte — Création d’un événement — recherche de lieu et carte sans repère
- Location: e2e/captures.spec.ts:185:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i })
    - locator resolved to <button type="button" class="group relative flex min-h-11 w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <span aria-hidden="true" class="absolute right-1/2 top-[21px] h-0.5 w-full bg-border"></span> from <li data-etat="a-venir" class="relative min-w-0 flex-1">…</li> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <span aria-hidden="true" class="absolute right-1/2 top-[21px] h-0.5 w-full bg-border"></span> from <li data-etat="a-venir" class="relative min-w-0 flex-1">…</li> subtree intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 shadow-subtle lg:px-8">…</header> intercepts pointer events
  7 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <span aria-hidden="true" class="absolute right-1/2 top-[21px] h-0.5 w-full bg-border"></span> from <li data-etat="a-venir" class="relative min-w-0 flex-1">…</li> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <span aria-hidden="true" class="absolute right-1/2 top-[21px] h-0.5 w-full bg-border"></span> from <li data-etat="a-venir" class="relative min-w-0 flex-1">…</li> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 shadow-subtle lg:px-8">…</header> intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 shadow-subtle lg:px-8">…</header> intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
        - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
          - /url: /
      - generic [ref=e13]:
        - button "Notifications, 99+ non lues" [ref=e15] [cursor=pointer]:
          - generic [ref=e19]: 99+
        - button "Basculer le thème" [ref=e21] [cursor=pointer]
        - link "Mon profil (Mariama Ndiaye)" [ref=e25] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e26]: MN
    - main [ref=e28]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - link "Retour à mes événements" [ref=e33] [cursor=pointer]:
            - /url: /partner/events
          - generic [ref=e39]:
            - heading "Créer un événement" [level=1] [ref=e40]
            - paragraph [ref=e41]: L’événement est enregistré en brouillon. À la dernière étape, vérifiez-le puis envoyez-le pour validation (ou plus tard, depuis la liste de vos événements).
        - navigation "Étapes du formulaire" [ref=e42]:
          - paragraph [ref=e43]: Étape 1 sur 5 — Informations générales
          - list [ref=e44]:
            - listitem [ref=e45]:
              - 'button "Étape 1 : Informations générales" [ref=e46] [cursor=pointer]':
                - generic [aria-hidden] [ref=e47]: "1"
            - listitem [ref=e49]:
              - 'button "Étape 2 : Programme" [ref=e51] [cursor=pointer]':
                - generic [aria-hidden] [ref=e52]: "2"
            - listitem [ref=e54]:
              - 'button "Étape 3 : Accès et informations pratiques" [ref=e56] [cursor=pointer]':
                - generic [aria-hidden] [ref=e57]: "3"
            - listitem [ref=e59]:
              - 'button "Étape 4 : Billetterie" [ref=e61] [cursor=pointer]':
                - generic [aria-hidden] [ref=e62]: "4"
            - listitem [ref=e64]:
              - 'button "Étape 5 : Contrôle à l’entrée (facultatif)" [ref=e66] [cursor=pointer]':
                - generic [aria-hidden] [ref=e67]: "5"
            - listitem [ref=e69]:
              - button "Vérifier avant d’envoyer" [ref=e71] [cursor=pointer]
        - generic [ref=e77]:
          - heading "Informations générales" [level=2] [ref=e78]
          - generic [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e82]:
                - text: Titre de l’événement*
                - generic [ref=e83]: (obligatoire)
              - textbox "Titre de l’événement (obligatoire)" [ref=e84]:
                - /placeholder: "Par exemple : Nuit du Mbalax"
            - generic [ref=e85]:
              - generic [ref=e86]:
                - text: Type d’événement*
                - generic [ref=e87]: (obligatoire)
              - radiogroup "Type d’événement (obligatoire)" [ref=e88]:
                - radio "Concerts & Musique" [ref=e89] [cursor=pointer]
                - radio "Festivals" [ref=e91] [cursor=pointer]
                - radio "Gastronomie & Tables" [ref=e93] [cursor=pointer]
                - radio "Salles & Réceptions" [ref=e95] [cursor=pointer]
            - generic [ref=e97]:
              - generic [ref=e98]:
                - generic [ref=e99]: Description
                - generic [ref=e100]: 0 / 5000
              - textbox "Description" [ref=e101]:
                - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
            - generic [ref=e102]:
              - generic [ref=e103]: Affiche de l’événement
              - button "Affiche de l’événement" [ref=e104]
              - generic [ref=e105] [cursor=pointer]: Choisir une image ou la déposer ici
              - paragraph [ref=e112]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
            - group "Dates et horaires (heure de Dakar)" [ref=e113]:
              - generic [ref=e115]:
                - generic [ref=e116]:
                  - generic [ref=e118]:
                    - text: Date de début*
                    - generic [ref=e119]: (obligatoire)
                  - textbox "Date de début (obligatoire)" [ref=e120]
                - generic [ref=e121]:
                  - generic [ref=e123]:
                    - text: Heure de début*
                    - generic [ref=e124]: (obligatoire)
                  - textbox "Heure de début (obligatoire)" [ref=e125]
                - generic [ref=e126]:
                  - generic [ref=e127]: Date de fin
                  - textbox "Date de fin" [ref=e129]
                  - paragraph [ref=e130]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain.
                - generic [ref=e131]:
                  - generic [ref=e132]: Heure de fin
                  - textbox "Heure de fin" [ref=e134]
                  - paragraph [ref=e135]: Facultative ; avec une heure de fin, la date de fin est demandée.
            - generic [ref=e136]:
              - generic [ref=e137]:
                - generic [ref=e139]:
                  - text: Lieu*
                  - generic [ref=e140]: (obligatoire)
                - textbox "Lieu (obligatoire)" [ref=e141]:
                  - /placeholder: "Par exemple : Grand Théâtre National"
              - generic [ref=e142]:
                - generic [ref=e144]:
                  - text: Ville*
                  - generic [ref=e145]: (obligatoire)
                - combobox "Ville (obligatoire)" [ref=e147] [cursor=pointer]:
                  - option "Cap Skirring"
                  - option "Dakar" [selected]
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
            - generic [ref=e148]:
              - generic [ref=e149]: Capacité totale (jauge)
              - spinbutton "Capacité totale (jauge)" [ref=e151]
              - paragraph [ref=e152]: Facultative. La somme des quantités des catégories actives ne peut pas la dépasser.
          - generic [ref=e153]:
            - button "Précédent" [disabled] [ref=e154]
            - button "Suivant" [ref=e160] [cursor=pointer]
  - alert [ref=e165]
```

# Test source

```ts
  1136 |         },
  1137 |         actions: async ({ page }) => {
  1138 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  1139 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  1140 |             const res = await registered;
  1141 |             // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
  1142 |             if (res.status() !== 200) {
  1143 |                 throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
  1144 |             }
  1145 |             await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
  1146 |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  1147 |             const counters = await fakePushCounters(page);
  1148 |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  1149 |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  1150 |         },
  1151 |     },
  1152 |     {
  1153 |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  1154 |         path: () => '/profile/notifications', fakePush: 'denied',
  1155 |         ready: async ({ page }) => {
  1156 |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  1157 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  1158 |             await expectNoPermissionPrompt(page);
  1159 |         },
  1160 |     },
  1161 |     {
  1162 |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  1163 |         path: () => '/profile/notifications', fakePush: 'unsupported',
  1164 |         ready: async ({ page }) => {
  1165 |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  1166 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  1167 |         },
  1168 |     },
  1169 |     {
  1170 |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  1171 |         actions: async ({ page }) => {
  1172 |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  1173 |             const panel = page.getByRole('region', { name: /^notifications$/i });
  1174 |             await expect(panel).toBeVisible();
  1175 |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  1176 |         },
  1177 |     },
  1178 |     {
  1179 |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  1180 |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  1181 |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  1182 |     },
  1183 |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  1184 |     {
  1185 |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  1186 |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  1187 |     },
  1188 |     // ── Organisateur ────────────────────────────────────────────────────────
  1189 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  1190 |     {
  1191 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  1192 |         actions: async ({ page }) => openTab(page, /^annulé/i),
  1193 |     },
  1194 |     {
  1195 |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  1196 |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  1197 |     },
  1198 |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  1199 |     // Finition 2a : étape Accès du formulaire (carte du lieu, recherche), captures avant et après
  1200 |     {
  1201 |         id: 'partenaire-creation-acces', titre: 'Création d’un événement — étape Accès (carte du lieu)', role: 'organisateur', needsIds: true,
  1202 |         path: () => '/partner/events/new',
  1203 |         actions: async ({ page }) => {
  1204 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
  1205 |             await expect(page.getByRole('heading', { name: /^accès et informations pratiques$/i })).toBeVisible();
  1206 |             // Finition 2b (C) : écran tactile (vues téléphone), le bouton « Déplacer la carte » est amené sur la barre d'actions
  1207 |             // fixe ; au point commun, c'est la barre qui reçoit l'appui (« Suivant » jamais recouvert) ; puis haut de page
  1208 |             if (await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)) {
  1209 |                 const move = page.getByRole('button', { name: /^déplacer la carte$/i });
  1210 |                 await expect(move, 'bouton « Déplacer la carte » (écran tactile)').toBeVisible();
  1211 |                 const hit = await move.evaluate((btn) => {
  1212 |                     const bar = document.querySelector('.form-action-bar');
  1213 |                     if (!bar) return 'barre d’actions absente';
  1214 |                     const start = btn.getBoundingClientRect();
  1215 |                     const barStart = bar.getBoundingClientRect();
  1216 |                     const shift = start.top + start.height / 2 - (barStart.top + barStart.height / 2);
  1217 |                     window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' });
  1218 |                     const r = btn.getBoundingClientRect();
  1219 |                     const b = bar.getBoundingClientRect();
  1220 |                     const y = b.top + b.height / 2;
  1221 |                     const el = document.elementFromPoint(r.left + r.width / 2, y);
  1222 |                     window.scrollTo({ top: 0, behavior: 'instant' });
  1223 |                     if (!(r.top < y && r.bottom > y)) return `bouton non amené sur la barre (bouton ${Math.round(r.top)} à ${Math.round(r.bottom)}, milieu de la barre ${Math.round(y)})`;
  1224 |                     return el && bar.contains(el) ? 'barre' : `barre recouverte par « ${(el?.textContent ?? '').trim().slice(0, 40)} »`;
  1225 |                 });
  1226 |                 expect(hit, 'appui au point commun du bouton de la carte et de la barre d’actions').toBe('barre');
  1227 |             }
  1228 |         },
  1229 |     },
  1230 |     // Finition 2a (captures « après » seulement) : la même étape descendue jusqu'à la recherche et à la carte (aucun repère
  1231 |     // avant un choix) ; l'étape Informations avec un début à 22:00 sans fin (« Fin retenue : … à 04:00 » et son aide)
  1232 |     {
  1233 |         id: 'partenaire-creation-carte', titre: 'Création d’un événement — recherche de lieu et carte sans repère', role: 'organisateur', needsIds: true,
  1234 |         path: () => '/partner/events/new',
  1235 |         actions: async ({ page }) => {
> 1236 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
       |                                                                                                                             ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  1237 |             const search = page.getByRole('search', { name: 'Rechercher un lieu' });
  1238 |             await expect(search).toBeVisible();
  1239 |             await expect(page.getByRole('region', { name: 'Carte du lieu' })).toBeVisible();
  1240 |             await search.evaluate((el) => {
  1241 |                 el.scrollIntoView({ block: 'start' });
  1242 |                 window.scrollBy(0, -96);
  1243 |             });
  1244 |         },
  1245 |     },
  1246 |     {
  1247 |         id: 'partenaire-creation-fin-retenue', titre: 'Création d’un événement — fin retenue sans heure de fin', role: 'organisateur', needsIds: true,
  1248 |         path: () => '/partner/events/new',
  1249 |         actions: async ({ page }) => {
  1250 |             const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  1251 |             await page.getByLabel(/^date de début/i).fill(day);
  1252 |             await page.getByLabel(/^heure de début/i).fill('22:00');
  1253 |             const retained = page.getByText(/^Fin retenue : /);
  1254 |             await expect(retained).toBeVisible();
  1255 |             await retained.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  1256 |         },
  1257 |     },
  1258 |     // Finition 2b : les cinq étapes de la création (Informations : partenaire-creation ; Accès : partenaire-creation-acces),
  1259 |     // l'écran « Vérifier avant d'envoyer » (formulaire vide : liste de ce qui manque) et la fenêtre « Prévenir »
  1260 |     ...([
  1261 |         ['partenaire-creation-programme', 'Création d’un événement — étape 2, Programme', /programme/i, /^programme$/i],
  1262 |         // Nom accessible d'une case du pas à pas : le titre de l'étape (« Billetterie »), le libellé visible est masqué (run 263)
  1263 |         ['partenaire-creation-billets', 'Création d’un événement — étape 4, Billets (couleur au contrôle, prix minimum)', /billetterie/i, /^billetterie$/i],
  1264 |         ['partenaire-creation-controle', 'Création d’un événement — étape 5, Contrôle à l’entrée (facultatif)', /contrôle/i, /^contrôle à l’entrée \(facultatif\)$/i],
  1265 |         ['partenaire-creation-verifier', 'Création d’un événement — Vérifier avant d’envoyer (ce qui manque)', /vérifier/i, /^vérifier avant d’envoyer$/i],
  1266 |     ] as const).map(([id, titre, stepButton, heading]): Screen => ({
  1267 |         id, titre, role: 'organisateur', needsIds: true,
  1268 |         path: () => '/partner/events/new',
  1269 |         actions: async ({ page }) => {
  1270 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: stepButton }).click();
  1271 |             await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  1272 |             // Une seule barre fixe en bas : « Navigation rapide » masquée tant que la barre du formulaire est affichée (règle
  1273 |             // :has() de app/globals.css ; au-delà de 1 024 px, elle l'est de toute façon)
  1274 |             await expect(page.getByRole('navigation', { name: /^navigation rapide$/i }), 'barre « Navigation rapide » sous le formulaire').toBeHidden();
  1275 |         },
  1276 |     })),
  1277 |     {
  1278 |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  1279 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1280 |     },
  1281 |     // Finition 2b (D, E-27) : lieu changé, « Enregistrer les modifications » : fenêtre « Prévenir » (jamais confirmée :
  1282 |     // rien n'est enregistré)
  1283 |     {
  1284 |         id: 'partenaire-edition-prevenir', titre: 'Modifier un événement publié — fenêtre « Prévenir les détenteurs de billets »', role: 'organisateur', needsIds: true,
  1285 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1286 |         actions: async ({ page }) => {
  1287 |             const place = page.locator('#ev-location');
  1288 |             await expect(place, 'champ « Lieu »').toBeVisible({ timeout: 30_000 });
  1289 |             await place.fill(`${await place.inputValue()} — salle B`);
  1290 |             await page.getByRole('button', { name: /^enregistrer les modifications$/i }).click();
  1291 |             const dialog = page.getByRole('alertdialog', { name: /^prévenir les détenteurs de billets$/i });
  1292 |             await expect(dialog, 'fenêtre « Prévenir »').toBeVisible({ timeout: 30_000 });
  1293 |             await expect(dialog.getByText(/(seront prévenus|sera prévenu) par SMS (à \d{2}:\d{2}|tout de suite)\./)).toBeVisible();
  1294 |             await expect(dialog.getByRole('button', { name: /^enregistrer et prévenir$/i })).toBeVisible();
  1295 |         },
  1296 |     },
  1297 |     {
  1298 |         id: 'partenaire-categorie-canaux', titre: 'Catégorie « Carré presse » : deux canaux, sur place uniquement', role: 'organisateur', needsIds: true,
  1299 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  1300 |         actions: async ({ page }) => {
  1301 |             await openTicketingStep(page);
  1302 |             const card = categorySections(page).filter({ has: page.getByRole('heading', { name: 'Carré presse', exact: true }) });
  1303 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  1304 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).toBeChecked();
  1305 |             await expect(card.getByText('Sur place uniquement').first()).toBeVisible();
  1306 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  1307 |         },
  1308 |     },
  1309 |     {
  1310 |         id: 'partenaire-categorie-invitations', titre: 'Catégorie sans aucun canal : aide factuelle, aucune distribution', role: 'organisateur', needsIds: true,
  1311 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  1312 |         actions: async ({ page }) => {
  1313 |             await openTicketingStep(page);
  1314 |             // Ligne ajoutée au seed par fix(8.0-seed) (L80) : son nom n'est pas fixé par le contrat, seul son résumé l'est
  1315 |             const card = categorySections(page).filter({ hasText: 'Invitations seulement' });
  1316 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  1317 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).not.toBeChecked();
  1318 |             await expect(card.getByText('Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage.')).toBeVisible();
  1319 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  1320 |         },
  1321 |     },
  1322 |     {
  1323 |         id: 'partenaire-rapport-cloture', titre: 'Rapport de clôture d’un événement terminé (modale du tableau de bord)', role: 'organisateur', needsIds: true,
  1324 |         path: () => '/partner/dashboard', references: [/^CLOTURE-[0-9A-F]{8}-\d{8}$/],
  1325 |         actions: async (c) => {
  1326 |             const { title } = ids(c.ids).events.termine;
  1327 |             const button = c.page.locator('tr, li, article')
  1328 |                 .filter({ hasText: title })
  1329 |                 .getByRole('button', { name: /^clôture$/i })
  1330 |                 .filter({ visible: true })
  1331 |                 .first();
  1332 |             const loaded = c.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/partner/reports/closing');
  1333 |             await button.click();
  1334 |             const report = await loaded;
  1335 |             expect(report.status(), `rapport de clôture de « ${title} »`).toBe(200);
  1336 |             const dialog = c.page.getByRole('dialog', { name: /^rapport de clôture$/i });
```