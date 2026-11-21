# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> cloche-ouverte — Cloche ouverte (non lues d’abord, Tout marquer comme lu)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: /^notifications$/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: /^notifications$/i }) with timeout 15000ms
  - waiting for getByRole('region', { name: /^notifications$/i })

```

```yaml
- banner:
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
  - navigation "Rubriques":
    - link "Accueil":
      - /url: /
    - link "Explorer":
      - /url: /explore
    - link "Mes billets":
      - /url: /tickets
    - link "Portefeuille":
      - /url: /wallet
  - link "Rechercher un événement…":
    - /url: /explore
  - button "Notifications, 10 non lues" [expanded]: "10"
  - button "Fatou Mbaye"
- main:
  - status: En direct
  - heading "Mes billets" [level=1]
  - paragraph: "Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
  - link "Mes billets sans réseau":
    - /url: /billet/hors-ligne
  - button "Comment marche le transfert ?"
  - link "Réserver un billet":
    - /url: /explore
  - tablist "Filtrer mes billets":
    - tab "À venir"
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus , 1" [selected]
  - tabpanel "Reçus , 1":
    - list:
      - listitem:
        - article "Festival Jazz sur le Fleuve":
          - heading "Festival Jazz sur le Fleuve" [level=3]
          - paragraph: Envoyé par Marième N.
          - term: Date
          - definition: jeu. 3 déc. 2026 à 18:00
          - term: Lieu
          - definition: Quai des Pêcheurs, Saint-Louis
          - term: Billet
          - definition: Pass soirée · 7 500 F CFA
          - term: Délai
          - definition: À accepter avant le lun. 23 nov. 2026 à 04:50
          - button "Accepter le billet"
          - button "Refuser le billet pour Festival Jazz sur le Fleuve": Refuser
  - status
- alert: Mes billets
- dialog "Notifications":
  - heading "Notifications" [level=2]
  - button "Fermer les notifications"
  - button "Tout marquer comme lu"
  - group "Filtrer les notifications":
    - button "Toutes" [pressed]
    - button "Non lues (10)"
  - region "Aujourd’hui":
    - heading "Aujourd’hui" [level=3]
    - list:
      - listitem:
        - 'button "Non lue : Réservation demandée Il y a 16 min Réservation de salle Votre demande pour « Salle des Fromagers » le mar. 15 déc. 2026 est enregistrée. Payez 189 000 F CFA avant 05:05 pour garder la date : sans paiement, elle sera libérée. Consulter"':
          - text: "Non lue : Réservation demandée"
          - time: Il y a 16 min
          - text: "Réservation de salle Votre demande pour « Salle des Fromagers » le mar. 15 déc. 2026 est enregistrée. Payez 189 000 F CFA avant 05:05 pour garder la date : sans paiement, elle sera libérée. Consulter"
        - 'button "Marquer comme lue : Réservation demandée"'
      - listitem:
        - 'button "Non lue : Remboursement versé Il y a 16 min 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ». Consulter"':
          - text: "Non lue : Remboursement versé"
          - time: Il y a 16 min
          - text: 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ». Consulter
        - 'button "Marquer comme lue : Remboursement versé"'
      - listitem:
        - 'button "Non lue : Événement annulé Il y a 16 min Statut de l’événement « Croisière musicale vers Gorée » du sam. 21 nov. 2026 à 09:00 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours. Consulter"':
          - text: "Non lue : Événement annulé"
          - time: Il y a 16 min
          - text: Statut de l’événement « Croisière musicale vers Gorée » du sam. 21 nov. 2026 à 09:00 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours. Consulter
        - 'button "Marquer comme lue : Événement annulé"'
      - listitem:
        - 'button "Non lue : Bienvenue Il y a 16 min Entrée contrôlée Bienvenue à « Nuit du Sabar — édition d’automne » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée. Consulter"':
          - text: "Non lue : Bienvenue"
          - time: Il y a 16 min
          - text: Entrée contrôlée Bienvenue à « Nuit du Sabar — édition d’automne » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée. Consulter
        - 'button "Marquer comme lue : Bienvenue"'
      - listitem:
        - 'button "Non lue : Invitation de Baobab Scène Il y a 16 min Contrôle d’accès Baobab Scène vous invite à contrôler l''entrée de « Festival Jazz sur le Fleuve ». Répondez avant le mar. 24 nov. 2026 à 04:50. Consulter"':
          - text: "Non lue : Invitation de Baobab Scène"
          - time: Il y a 16 min
          - text: Contrôle d’accès Baobab Scène vous invite à contrôler l'entrée de « Festival Jazz sur le Fleuve ». Répondez avant le mar. 24 nov. 2026 à 04:50. Consulter
        - 'button "Marquer comme lue : Invitation de Baobab Scène"'
      - listitem:
        - 'button "Non lue : Un billet vous est transféré Il y a 16 min Transfert de billet Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le lun. 23 nov. 2026 à 04:50. Consulter"':
          - text: "Non lue : Un billet vous est transféré"
          - time: Il y a 16 min
          - text: Transfert de billet Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le lun. 23 nov. 2026 à 04:50. Consulter
        - 'button "Marquer comme lue : Un billet vous est transféré"'
      - listitem:
        - 'button "Non lue : Bienvenue Il y a 16 min Entrée contrôlée Bienvenue à « Brunch électro des Almadies » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée. Consulter"':
          - text: "Non lue : Bienvenue"
          - time: Il y a 16 min
          - text: Entrée contrôlée Bienvenue à « Brunch électro des Almadies » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée. Consulter
        - 'button "Marquer comme lue : Bienvenue"'
      - listitem:
        - 'button "Non lue : Achat confirmé Il y a 16 min Billet 1 billet pour « Concert des Lumières de Gorée » le dim. 22 nov. 2026 à 01:00. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Achat confirmé"
          - time: Il y a 16 min
          - text: "Billet 1 billet pour « Concert des Lumières de Gorée » le dim. 22 nov. 2026 à 01:00. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets. Consulter"
        - 'button "Marquer comme lue : Achat confirmé"'
      - listitem:
        - 'button "Non lue : Achat confirmé Il y a 16 min Billet 1 billet pour « Festival Jazz sur le Fleuve » le jeu. 3 déc. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Achat confirmé"
          - time: Il y a 16 min
          - text: "Billet 1 billet pour « Festival Jazz sur le Fleuve » le jeu. 3 déc. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets. Consulter"
        - 'button "Marquer comme lue : Achat confirmé"'
      - listitem:
        - 'button "Non lue : Achat confirmé Il y a 16 min Billet 1 billet pour « Brunch électro des Almadies » le sam. 21 nov. 2026 à 06:00. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Achat confirmé"
          - time: Il y a 16 min
          - text: "Billet 1 billet pour « Brunch électro des Almadies » le sam. 21 nov. 2026 à 06:00. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter"
        - 'button "Marquer comme lue : Achat confirmé"'
      - listitem:
        - 'button "Achat confirmé Il y a 16 min Billet 2 billets pour « Nuit du Sabar — édition d’automne » le sam. 21 nov. 2026 à 05:45. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: Achat confirmé
          - time: Il y a 16 min
          - text: "Billet 2 billets pour « Nuit du Sabar — édition d’automne » le sam. 21 nov. 2026 à 05:45. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets. Consulter"
      - listitem:
        - 'button "Achat confirmé Il y a 16 min Billet 1 billet pour « Croisière musicale vers Gorée » le sam. 21 nov. 2026 à 09:00. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: Achat confirmé
          - time: Il y a 16 min
          - text: "Billet 1 billet pour « Croisière musicale vers Gorée » le sam. 21 nov. 2026 à 09:00. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter"
  - link "Voir toutes les notifications":
    - /url: /notifications
  - link "Préférences":
    - /url: /profile/notifications
```

# Test source

```ts
  1178 |     },
  1179 |     {
  1180 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  1181 |         actions: async ({ page, context, guard }) => {
  1182 |             guard.freeze();
  1183 |             await context.setOffline(true);
  1184 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  1185 |         },
  1186 |     },
  1187 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  1188 |     {
  1189 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  1190 |         ready: async ({ page }) => {
  1191 |             await expectHeading(page, /^connexion$/i);
  1192 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  1193 |         },
  1194 |     },
  1195 |     {
  1196 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  1197 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  1198 |     },
  1199 |     {
  1200 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  1201 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  1202 |     },
  1203 |     // ── Client ──────────────────────────────────────────────────────────────
  1204 |     {
  1205 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir', // A10 : sans onglet, « Reçus » d'office (transfert entrant du seed)
  1206 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1207 |         // Design 1b (point 8) : portefeuille, cartes de billet à la couleur de la catégorie
  1208 |         ready: async ({ page }) => { await expect(page.locator('article[aria-label^="Billet pour"]').first()).toBeVisible({ timeout: 30_000 }); },
  1209 |     },
  1210 |     // Design 1b (point 8) : QR en grand, fond blanc (la luminosité du téléphone ne se règle pas depuis le web)
  1211 |     {
  1212 |         id: 'mes-billets-qr-grand', titre: 'Mes billets — QR en grand sur fond blanc', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir',
  1213 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1214 |         ready: async ({ page }) => { await expect(page.locator('article[aria-label^="Billet pour"]').first()).toBeVisible({ timeout: 30_000 }); },
  1215 |         actions: async ({ page }) => {
  1216 |             await page.getByRole('button', { name: 'Agrandir le QR code en plein écran' }).first().click();
  1217 |             await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15_000 });
  1218 |         },
  1219 |     },
  1220 |     // Design 1b (point 8) : petite fête après l'achat (retour du paiement réussi : ?fete=1), annoncée par un toast
  1221 |     {
  1222 |         id: 'mes-billets-fete', titre: 'Mes billets — après l’achat (« Vos billets sont là. »)', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir&fete=1',
  1223 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1224 |         ready: async ({ page }) => { await expect(page.getByText('Vos billets sont là.').first()).toBeVisible({ timeout: 30_000 }); },
  1225 |     },
  1226 |     {
  1227 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  1228 |         path: () => '/tickets?tab=recus',
  1229 |         ready: async ({ page }) => {
  1230 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  1231 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  1232 |         },
  1233 |     },
  1234 |     {
  1235 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  1236 |         path: () => '/profile/notifications', fakePush: 'granted',
  1237 |         ready: async ({ page }) => {
  1238 |             await preferencesReady(page, /^désactivées$/i);
  1239 |             await expectNoPermissionPrompt(page);
  1240 |         },
  1241 |         actions: async ({ page }) => {
  1242 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  1243 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  1244 |             const res = await registered;
  1245 |             // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
  1246 |             if (res.status() !== 200) {
  1247 |                 throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
  1248 |             }
  1249 |             await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
  1250 |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  1251 |             const counters = await fakePushCounters(page);
  1252 |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  1253 |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  1254 |         },
  1255 |     },
  1256 |     {
  1257 |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  1258 |         path: () => '/profile/notifications', fakePush: 'denied',
  1259 |         ready: async ({ page }) => {
  1260 |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  1261 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  1262 |             await expectNoPermissionPrompt(page);
  1263 |         },
  1264 |     },
  1265 |     {
  1266 |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  1267 |         path: () => '/profile/notifications', fakePush: 'unsupported',
  1268 |         ready: async ({ page }) => {
  1269 |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  1270 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  1271 |         },
  1272 |     },
  1273 |     {
  1274 |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  1275 |         actions: async ({ page }) => {
  1276 |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  1277 |             const panel = page.getByRole('region', { name: /^notifications$/i });
> 1278 |             await expect(panel).toBeVisible();
       |                                 ^ Error: expect(locator).toBeVisible() failed
  1279 |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  1280 |         },
  1281 |     },
  1282 |     {
  1283 |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  1284 |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  1285 |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  1286 |     },
  1287 |     // Lot 10b : notification de la réservation de salle du seed, lien vers une page fermée (HALL_RESERVATION_PREFETCH)
  1288 |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications', allowFailures: [HALL_RESERVATION_PREFETCH] },
  1289 |     {
  1290 |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  1291 |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  1292 |     },
  1293 |     // ── Organisateur ────────────────────────────────────────────────────────
  1294 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  1295 |     {
  1296 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  1297 |         actions: async ({ page }) => openTab(page, /^annulé/i),
  1298 |     },
  1299 |     {
  1300 |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  1301 |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  1302 |     },
  1303 |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  1304 |     // Finition 2a : étape Accès du formulaire (carte du lieu, recherche), captures avant et après
  1305 |     {
  1306 |         id: 'partenaire-creation-acces', titre: 'Création d’un événement — étape Accès (carte du lieu)', role: 'organisateur', needsIds: true,
  1307 |         path: () => '/partner/events/new',
  1308 |         actions: async ({ page }) => {
  1309 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
  1310 |             await expect(page.getByRole('heading', { name: /^accès et informations pratiques$/i })).toBeVisible();
  1311 |             // Finition 2b (C) : écran tactile (vues téléphone), le bouton « Déplacer la carte » est amené sur la barre d'actions
  1312 |             // fixe ; au point commun, c'est la barre qui reçoit l'appui (« Suivant » jamais recouvert) ; puis haut de page
  1313 |             if (await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)) {
  1314 |                 const move = page.getByRole('button', { name: /^déplacer la carte$/i });
  1315 |                 await expect(move, 'bouton « Déplacer la carte » (écran tactile)').toBeVisible();
  1316 |                 const hit = await move.evaluate((btn) => {
  1317 |                     const bar = document.querySelector('.form-action-bar');
  1318 |                     if (!bar) return 'barre d’actions absente';
  1319 |                     const start = btn.getBoundingClientRect();
  1320 |                     const barStart = bar.getBoundingClientRect();
  1321 |                     const shift = start.top + start.height / 2 - (barStart.top + barStart.height / 2);
  1322 |                     window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' });
  1323 |                     const r = btn.getBoundingClientRect();
  1324 |                     const b = bar.getBoundingClientRect();
  1325 |                     const y = b.top + b.height / 2;
  1326 |                     const el = document.elementFromPoint(r.left + r.width / 2, y);
  1327 |                     window.scrollTo({ top: 0, behavior: 'instant' });
  1328 |                     if (!(r.top < y && r.bottom > y)) return `bouton non amené sur la barre (bouton ${Math.round(r.top)} à ${Math.round(r.bottom)}, milieu de la barre ${Math.round(y)})`;
  1329 |                     return el && bar.contains(el) ? 'barre' : `barre recouverte par « ${(el?.textContent ?? '').trim().slice(0, 40)} »`;
  1330 |                 });
  1331 |                 expect(hit, 'appui au point commun du bouton de la carte et de la barre d’actions').toBe('barre');
  1332 |             }
  1333 |         },
  1334 |     },
  1335 |     // Finition 2a (captures « après » seulement) : la même étape descendue jusqu'à la recherche et à la carte (aucun repère
  1336 |     // avant un choix) ; l'étape Informations avec un début à 22:00 sans fin (« Fin retenue : … à 04:00 » et son aide)
  1337 |     {
  1338 |         id: 'partenaire-creation-carte', titre: 'Création d’un événement — recherche de lieu et carte sans repère', role: 'organisateur', needsIds: true,
  1339 |         path: () => '/partner/events/new',
  1340 |         actions: async ({ page }) => {
  1341 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
  1342 |             const search = page.getByRole('search', { name: 'Rechercher un lieu' });
  1343 |             await expect(search).toBeVisible();
  1344 |             await expect(page.getByRole('region', { name: 'Carte du lieu' })).toBeVisible();
  1345 |             await search.evaluate((el) => {
  1346 |                 el.scrollIntoView({ block: 'start' });
  1347 |                 window.scrollBy(0, -96);
  1348 |             });
  1349 |         },
  1350 |     },
  1351 |     {
  1352 |         id: 'partenaire-creation-fin-retenue', titre: 'Création d’un événement — fin retenue sans heure de fin', role: 'organisateur', needsIds: true,
  1353 |         path: () => '/partner/events/new',
  1354 |         actions: async ({ page }) => {
  1355 |             const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  1356 |             await page.getByLabel(/^date de début/i).fill(day);
  1357 |             await page.getByLabel(/^heure de début/i).fill('22:00');
  1358 |             const retained = page.getByText(/^Fin retenue : /);
  1359 |             await expect(retained).toBeVisible();
  1360 |             await retained.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  1361 |         },
  1362 |     },
  1363 |     // Finition 2b : les cinq étapes de la création (Informations : partenaire-creation ; Accès : partenaire-creation-acces),
  1364 |     // l'écran « Vérifier avant d'envoyer » (formulaire vide : liste de ce qui manque) et la fenêtre « Prévenir »
  1365 |     ...([
  1366 |         ['partenaire-creation-programme', 'Création d’un événement — étape 2, Programme', /programme/i, /^programme$/i],
  1367 |         // Nom accessible d'une case du pas à pas : le titre de l'étape (« Billetterie »), le libellé visible est masqué (run 263)
  1368 |         ['partenaire-creation-billets', 'Création d’un événement — étape 4, Billets (couleur au contrôle, prix minimum)', /billetterie/i, /^billetterie$/i],
  1369 |         ['partenaire-creation-controle', 'Création d’un événement — étape 5, Contrôle à l’entrée (facultatif)', /contrôle/i, /^contrôle à l’entrée \(facultatif\)$/i],
  1370 |         ['partenaire-creation-verifier', 'Création d’un événement — Vérifier avant d’envoyer (ce qui manque)', /vérifier/i, /^vérifier avant d’envoyer$/i],
  1371 |     ] as const).map(([id, titre, stepButton, heading]): Screen => ({
  1372 |         id, titre, role: 'organisateur', needsIds: true,
  1373 |         path: () => '/partner/events/new',
  1374 |         actions: async ({ page }) => {
  1375 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: stepButton }).click();
  1376 |             await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  1377 |             // Une seule barre fixe en bas : « Navigation rapide » masquée tant que la barre du formulaire est affichée (règle
  1378 |             // :has() de app/globals.css ; au-delà de 1 024 px, elle l'est de toute façon)
```