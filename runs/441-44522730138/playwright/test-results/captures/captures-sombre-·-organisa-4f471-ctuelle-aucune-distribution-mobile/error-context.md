# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-categorie-invitations — Catégorie sans aucun canal : aide factuelle, aucune distribution
- Location: e2e/captures.spec.ts:185:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i })
    - locator resolved to <button type="button" class="group relative flex min-h-11 w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <span aria-hidden="true" class="absolute right-1/2 top-[21px] h-0.5 w-full bg-border"></span> from <li data-etat="a-venir" class="relative min-w-0 flex-1">…</li> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <button type="submit" class="inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none transition-[background-color,border-color,color,filter,transform] duration-fast ease-standard motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-11 px-4 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-pr…>…</button> from <form novalidate="" class="flex flex-col gap-6 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">…</form> subtree intercepts pointer events
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
      - <button type="submit" class="inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none transition-[background-color,border-color,color,filter,transform] duration-fast ease-standard motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-11 px-4 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-pr…>…</button> from <form novalidate="" class="flex flex-col gap-6 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">…</form> subtree intercepts pointer events
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
            - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e41]': Publié
            - heading "Modifier l’événement" [level=1] [ref=e44]
            - paragraph [ref=e45]: Nuit du Sabar — édition d’automne
        - status [ref=e46]:
          - generic [ref=e51]:
            - paragraph [ref=e52]: "Votre événement est validé : ce que vos modifications changent"
            - list [ref=e54]:
              - listitem [ref=e55]: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
              - listitem [ref=e56]: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
              - listitem [ref=e57]: "Titre : les détenteurs de billets sont prévenus dans l’application."
              - listitem [ref=e58]: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
              - listitem [ref=e59]: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
              - listitem [ref=e60]: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives."
        - navigation "Étapes du formulaire" [ref=e61]:
          - paragraph [ref=e62]: Étape 1 sur 5 — Informations générales
          - list [ref=e63]:
            - listitem [ref=e64]:
              - 'button "Étape 1 : Informations générales" [ref=e65] [cursor=pointer]':
                - generic [aria-hidden] [ref=e66]: "1"
            - listitem [ref=e68]:
              - 'button "Étape 2 : Programme" [ref=e70] [cursor=pointer]':
                - generic [aria-hidden] [ref=e71]: "2"
            - listitem [ref=e73]:
              - 'button "Étape 3 : Accès et informations pratiques" [ref=e75] [cursor=pointer]':
                - generic [aria-hidden] [ref=e76]: "3"
            - listitem [ref=e78]:
              - 'button "Étape 4 : Billetterie" [ref=e80] [cursor=pointer]':
                - generic [aria-hidden] [ref=e81]: "4"
            - listitem [ref=e83]:
              - 'button "Étape 5 : Contrôle à l’entrée (facultatif)" [ref=e85] [cursor=pointer]':
                - generic [aria-hidden] [ref=e86]: "5"
            - listitem [ref=e88]:
              - button "Vérifier avant d’envoyer" [ref=e90] [cursor=pointer]
        - generic [ref=e96]:
          - heading "Informations générales" [level=2] [ref=e97]
          - generic [ref=e98]:
            - generic [ref=e99]:
              - generic [ref=e101]:
                - text: Titre de l’événement*
                - generic [ref=e102]: (obligatoire)
              - textbox "Titre de l’événement (obligatoire)" [ref=e103]:
                - /placeholder: "Par exemple : Nuit du Mbalax"
                - text: Nuit du Sabar — édition d’automne
              - paragraph [ref=e104]: Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e105]:
              - generic [ref=e106]:
                - text: Type d’événement*
                - generic [ref=e107]: (obligatoire)
              - radiogroup "Type d’événement (obligatoire)" [ref=e108]:
                - radio "Concerts & Musique" [checked] [disabled] [ref=e109]
                - radio "Festivals" [disabled] [ref=e113]
                - radio "Gastronomie & Tables" [disabled] [ref=e115]
                - radio "Salles & Réceptions" [disabled] [ref=e117]
              - paragraph [ref=e119]: "Verrouillé : des billets ont déjà été vendus ou réservés."
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]: Description
                - generic [ref=e126]: 195 / 5000
              - textbox "Description" [ref=e127]:
                - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
                - text: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
            - generic [ref=e128]:
              - generic [ref=e129]: Affiche de l’événement
              - button "Affiche de l’événement" [ref=e130]
              - generic [ref=e131]:
                - 'img "Aperçu : Affiche de l’événement" [ref=e132]'
                - generic [ref=e133]:
                  - generic [ref=e134]: Aperçu sur les cartes du site
                  - generic [ref=e135]:
                    - generic [ref=e136] [cursor=pointer]: Remplacer l’image
                    - button "Supprimer l’image sélectionnée" [ref=e142] [cursor=pointer]
              - paragraph [ref=e147]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
            - group "Dates et horaires (heure de Dakar)" [ref=e148]:
              - generic [ref=e150]:
                - generic [ref=e151]:
                  - generic [ref=e153]:
                    - text: Date de début*
                    - generic [ref=e154]: (obligatoire)
                  - textbox "Date de début (obligatoire)" [ref=e155]: 2026-11-19
                  - paragraph [ref=e156]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e157]:
                  - generic [ref=e159]:
                    - text: Heure de début*
                    - generic [ref=e160]: (obligatoire)
                  - textbox "Heure de début (obligatoire)" [ref=e161]: 13:15
                  - paragraph [ref=e162]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e163]:
                  - generic [ref=e164]: Date de fin
                  - textbox "Date de fin" [ref=e166]: 2026-11-19
                  - paragraph [ref=e167]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e168]:
                  - generic [ref=e169]: Heure de fin
                  - textbox "Heure de fin" [ref=e171]: 18:15
                  - paragraph [ref=e172]: Facultative ; avec une heure de fin, la date de fin est demandée. Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e173]:
              - generic [ref=e174]:
                - generic [ref=e176]:
                  - text: Lieu*
                  - generic [ref=e177]: (obligatoire)
                - textbox "Lieu (obligatoire)" [ref=e178]:
                  - /placeholder: "Par exemple : Grand Théâtre National"
                  - text: Esplanade de la Corniche Ouest
                - paragraph [ref=e179]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=e180]:
                - generic [ref=e182]:
                  - text: Ville*
                  - generic [ref=e183]: (obligatoire)
                - combobox "Ville (obligatoire)" [ref=e185] [cursor=pointer]:
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
                - paragraph [ref=e186]: Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e187]:
              - generic [ref=e188]: Capacité totale (jauge)
              - spinbutton "Capacité totale (jauge)" [ref=e194]: "300"
              - paragraph [ref=e195]: "Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous 250 places."
          - generic [ref=e196]:
            - button "Précédent" [disabled] [ref=e197]
            - generic [ref=e202]:
              - button "Suivant" [ref=e203] [cursor=pointer]
              - button "Enregistrer les modifications" [ref=e208] [cursor=pointer]
  - alert [ref=e215]
```

# Test source

```ts
  234 | const SCAN_URL = /\/api\/controller\/scan$/;
  235 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  236 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  237 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  238 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  239 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  240 | 
  241 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  242 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  243 |     const result = String(body.result);
  244 |     return {
  245 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  246 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  247 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  248 |         ready: async ({ page }) => startScanner(page),
  249 |         actions: async (c) => {
  250 |             await presentToFakeDetector(c.page, demoPayload(c));
  251 |             await expectScanResult(c.page, result);
  252 |         },
  253 |     };
  254 | }
  255 | 
  256 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  257 | function offlineLink(page: Page, ticketId: string): Locator {
  258 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  259 | }
  260 | 
  261 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  262 | 
  263 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  264 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  265 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  266 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  267 |     return counters;
  268 | }
  269 | 
  270 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  271 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  272 |     await expectHeading(page, /^préférences de notification$/i);
  273 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  274 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  275 | }
  276 | 
  277 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  278 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  279 |     const counters = await fakePushCounters(page);
  280 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  281 | }
  282 | 
  283 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  284 | 
  285 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  286 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  287 | 
  288 | function cdpKids(node: CdpNode): CdpNode[] {
  289 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  290 | }
  291 | 
  292 | function findDateInput(node: CdpNode): CdpNode | null {
  293 |     const attrs = node.attributes ?? [];
  294 |     if (node.nodeName === 'INPUT') {
  295 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  296 |     }
  297 |     for (const kid of cdpKids(node)) {
  298 |         const found = findDateInput(kid);
  299 |         if (found) return found;
  300 |     }
  301 |     return null;
  302 | }
  303 | 
  304 | function cdpText(node: CdpNode): string {
  305 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  306 |     return own + cdpKids(node).map(cdpText).join('');
  307 | }
  308 | 
  309 | /**
  310 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  311 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  312 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  313 |  */
  314 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  315 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  316 |     const cdp = await c.context.newCDPSession(c.page);
  317 |     try {
  318 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  319 |         const input = findDateInput(root);
  320 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
  321 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
  322 |     } finally {
  323 |         await cdp.detach();
  324 |     }
  325 | }
  326 | 
  327 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  328 | async function fontSizePx(target: Locator): Promise<number> {
  329 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  330 | }
  331 | 
  332 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  333 | async function openTicketingStep(page: Page): Promise<void> {
> 334 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
      |                                                                                                                           ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  335 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  336 | }
  337 | 
  338 | const ONLINE_BOX = /^vendue en ligne/i;
  339 | const COUNTER_BOX = /^vendue au guichet/i;
  340 | 
  341 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  342 | function categorySections(page: Page): Locator {
  343 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  344 | }
  345 | 
  346 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  347 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  348 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  349 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  350 | /**
  351 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  352 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  353 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  354 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  355 |  */
  356 | const CASHOUTS_TO_RESUME = {
  357 |     items: [
  358 |         {
  359 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  360 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  361 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  362 |         },
  363 |         {
  364 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  365 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  366 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  367 |         },
  368 |         {
  369 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  370 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  371 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  372 |         },
  373 |         {
  374 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  375 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  376 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  377 |         },
  378 |         {
  379 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  380 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  381 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  382 |         },
  383 |     ],
  384 |     total: 5,
  385 | };
  386 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  387 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  388 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  389 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  390 | const EMPTY_RECONCILIATION = {
  391 |     summary: {
  392 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  393 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  394 |     },
  395 |     items: [],
  396 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  397 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  398 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  399 |     cashoutFeesReal: 4290,
  400 |     cashoutFeesEstimated: 4200,
  401 |     gap: 90,
  402 |     cashoutFeeRate: 1.5,
  403 |     cashoutCount: 12,
  404 |     cashinFeesReal: null,
  405 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  406 | };
  407 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  408 | const CASHOUTS_STUBS: StubResponse[] = [
  409 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  410 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  411 | ];
  412 | 
  413 | // ── Finition 3a : argent de l'administration (page Finance, accueil) ─────────
  414 | // Réponses imposées aux montants cohérents entre eux (voir le rapport de la finition 3a) : les captures montrent chaque
  415 | // état sans dépendre des données du seed ; les règles de calcul sont prouvées par les suites f3a-* (base locale).
  416 | const F3A_SUMMARY_URL = /\/api\/admin\/finance\/summary(\?.*)?$/;
  417 | const F3A_PAYMENTS_URL = /\/api\/admin\/finance\/payments(\?.*)?$/;
  418 | const F3A_DEBTS_URL = /\/api\/admin\/finance\/debts(\?.*)?$/;
  419 | const F3A_WAITING_URL = /\/api\/admin\/finance\/waiting(\?.*)?$/;
  420 | const F3A_PERIOD = {
  421 |     key: 'month', from: '2026-11-01T00:00:00.000Z', to: '2026-11-17T00:00:00.000Z', firstDay: '2026-11-01', lastDay: '2026-11-16',
  422 |     label: 'Ce mois-ci', range: 'du 1er au 16 novembre 2026',
  423 | };
  424 | const F3A_SUMMARY = {
  425 |     computed_at: '2026-11-16T14:32:00.000Z',
  426 |     earned: {
  427 |         from: F3A_PERIOD.from, to: F3A_PERIOD.to, total: 182437.5, payments: 412, volume: 9845000, service_fees: 468810,
  428 |         aggregator_fees: 147675, net_revenue: 321135, refunded_net: 41200, duplicate_withheld: 157.5, service_net: 280092.5,
  429 |         commissions: 9870.25, commissions_unrecovered: 0, withdrawal_fees: 38500, withdrawals_paid: 37, samirpay_fees: 126284.75,
  430 |         cashouts_with_fees: 52, rebilled: 0,
  431 |     },
  432 |     owed_partners: {
  433 |         total: 6412850, ledger: 6108850, available: 4233600, pending: 1875250, frozen: 98000, withdrawable_now: 4135600,
  434 |         withdrawals_in_progress: 304000, withdrawals_in_progress_count: 3, accounts: 28,
```