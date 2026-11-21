# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

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
  - button "Notifications, 4 non lues" [expanded]: "4"
  - button "Awa Client"
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
    - tab "À venir" [selected]
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus"
  - tabpanel "À venir":
    - region "Billets à venir":
      - 'list "Billets à venir : glissez ou utilisez les flèches pour passer d’un billet à l’autre"':
        - listitem:
          - article "Billet pour Fumée — Rappels des Parcelles 05.19.46":
            - paragraph: "Catégorie : Entrée générale"
            - heading "Fumée — Rappels des Parcelles 05.19.46" [level=2]
            - paragraph: Orga A (test)
            - text: Valable Dans 2 jours et 14 h
            - term: Date
            - definition: 23 NOV 2026
            - term: Heure d’accès
            - definition: 20:00
            - term: Lieu
            - definition: Esplanade des Parcelles Assainies
            - term: Prix
            - definition: 5 000 F CFA
            - term: Frais de service
            - definition: 250 F CFA
            - button "Agrandir le QR code en plein écran":
              - img "QR d’entrée dynamique"
            - paragraph: "Numéro du billet : TCK-20261121-8A77C4464F"
            - paragraph: Touchez le QR pour l’agrandir.
            - text: Code renouvelé toutes les 20 s Nouveau code dans 3 secondes
            - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
            - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
            - status: Disponible sans réseau à partir du dim. 22 nov. 2026 à 20:00
            - paragraph: Billet authentique, émis par Event Village
            - button "Transférer"
            - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
            - button "Partager ou copier le lien de l’événement": Lien
            - button "Télécharger le billet en PDF": PDF
            - group "Ajouter à mon agenda":
              - button "Ajouter à mon agenda"
              - button "Google Agenda"
            - button "Aide au transfert"
        - listitem:
          - article "Billet pour TEST Concert A (publié, à venir)":
            - paragraph: "Catégorie : Standard"
            - heading "TEST Concert A (publié, à venir)" [level=2]
            - paragraph: Orga A (test)
            - text: Valable Dans 30 jours et 14 h
            - term: Date
            - definition: 21 DÉC 2026
            - term: Heure d’accès
            - definition: 20:00
            - term: Lieu
            - definition: Salle de test, Dakar
            - term: Prix
            - definition: 5 000 F CFA
            - button "Agrandir le QR code en plein écran":
              - img "QR d’entrée dynamique"
            - paragraph: "Numéro du billet : TCK-FIXTURE-CLIENT-A-1"
            - paragraph: Touchez le QR pour l’agrandir.
            - text: Code renouvelé toutes les 20 s Nouveau code dans 3 secondes
            - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
            - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
            - status: Disponible sans réseau à partir du dim. 20 déc. 2026 à 20:00
            - paragraph: Billet authentique, émis par Event Village
            - button "Transférer"
            - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
            - button "Partager ou copier le lien de l’événement": Lien
            - button "Télécharger le billet en PDF": PDF
            - group "Ajouter à mon agenda":
              - button "Ajouter à mon agenda"
              - button "Google Agenda"
            - button "Aide au transfert"
  - status
- alert
- dialog "Notifications":
  - heading "Notifications" [level=2]
  - button "Fermer les notifications"
  - button "Tout marquer comme lu"
  - group "Filtrer les notifications":
    - button "Toutes" [pressed]
    - button "Non lues (4)"
  - region "Aujourd’hui":
    - heading "Aujourd’hui" [level=3]
    - list:
      - listitem:
        - 'button "Non lue : Rappel : c''est demain À l’instant Rappel « Fumée — Rappels des Parcelles 05.19.46 » demain à 20:00, Esplanade des Parcelles Assainies, Dakar. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Rappel : c'est demain"
          - time: À l’instant
          - text: Rappel « Fumée — Rappels des Parcelles 05.19.46 » demain à 20:00, Esplanade des Parcelles Assainies, Dakar. Vos billets sont dans Mes billets. Consulter
        - 'button "Marquer comme lue : Rappel : c''est demain"'
      - listitem:
        - 'button "Non lue : Achat confirmé À l’instant Billet 1 billet pour « Fumée — Rappels des Parcelles 05.19.46 » le lun. 23 nov. 2026 à 20:00. Total payé : 5 250 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Achat confirmé"
          - time: À l’instant
          - text: "Billet 1 billet pour « Fumée — Rappels des Parcelles 05.19.46 » le lun. 23 nov. 2026 à 20:00. Total payé : 5 250 F CFA. Vos billets sont dans Mes billets. Consulter"
        - 'button "Marquer comme lue : Achat confirmé"'
      - listitem:
        - 'button "Non lue : Bienvenue À l’instant Entrée contrôlée Bienvenue à « Fumée — Concert des Parcelles 05.19.46 » ! Bonne soirée avec TEST Organisateur A. Votre entrée est validée. Consulter"':
          - text: "Non lue : Bienvenue"
          - time: À l’instant
          - text: Entrée contrôlée Bienvenue à « Fumée — Concert des Parcelles 05.19.46 » ! Bonne soirée avec TEST Organisateur A. Votre entrée est validée. Consulter
        - 'button "Marquer comme lue : Bienvenue"'
      - listitem:
        - 'button "Non lue : Achat confirmé À l’instant Billet 1 billet pour « Fumée — Concert des Parcelles 05.19.46 » le sam. 21 nov. 2026 à 07:20. Total payé : 5 250 F CFA. Vos billets sont dans Mes billets. Consulter"':
          - text: "Non lue : Achat confirmé"
          - time: À l’instant
          - text: "Billet 1 billet pour « Fumée — Concert des Parcelles 05.19.46 » le sam. 21 nov. 2026 à 07:20. Total payé : 5 250 F CFA. Vos billets sont dans Mes billets. Consulter"
        - 'button "Marquer comme lue : Achat confirmé"'
  - link "Voir toutes les notifications":
    - /url: /notifications
  - link "Préférences":
    - /url: /profile/notifications
```

# Test source

```ts
  127 |     return data;
  128 | }
  129 | 
  130 | export function brief(rows: OutboxLine[]): string {
  131 |     return JSON.stringify(rows.map((r) => ({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, user: r.recipient_user_id })));
  132 | }
  133 | 
  134 | /**
  135 |  * Achat par l'interface, comme à l'étape 4, depuis la page publique de l'événement ; renvoie tous les billets émis
  136 |  * (lot 7 : `quantity` billets de la catégorie, pour la fumée prolongée).
  137 |  */
  138 | export async function buyThroughUi(client: Page, eventId: string, category: string, quantity = 1, payerPhone = fumeePayerPhone()): Promise<string[]> {
  139 |     await client.goto(`/events/${eventId}`);
  140 |     for (let i = 0; i < quantity; i++) {
  141 |         await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  142 |     }
  143 |     await client.getByRole('button', { name: /^acheter/i }).click();
  144 |     const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  145 |     await expect(dialog).toBeVisible();
  146 |     // Radio masqué (sr-only) dans son libellé : check({ force: true }) le jugeait parfois hors de l'écran dans la
  147 |     // modale (run 66) ; le clic est envoyé à l'élément, puis la sélection est vérifiée.
  148 |     const wave = dialog.getByRole('radio', { name: /^wave/i });
  149 |     await wave.dispatchEvent('click');
  150 |     await expect(wave).toBeChecked();
  151 |     await dialog.getByLabel(/numéro/i).fill(payerPhone);
  152 |     await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  153 |     await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  154 |     const succeeded = client.waitForResponse(async (r) => {
  155 |         if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  156 |         const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  157 |         return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  158 |     }, { timeout: 45_000 });
  159 |     const done = await fakeServices('/__test/samirpay/complete', { telephone: payerPhone });
  160 |     expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  161 |     expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  162 |     const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  163 |     await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  164 |     expect(status.ticket_ids.length, `billets émis par l’achat de ${quantity} billet(s)`).toBe(quantity);
  165 |     return status.ticket_ids;
  166 | }
  167 | 
  168 | // ── Fumée, lot 7 (D81, fumée prolongée) : étapes 8, 10 et 11 à 16 ───────────
  169 | 
  170 | export interface IdentifiedSms { sms: FakeSms; line: SentSmsLine | null }
  171 | 
  172 | /** SMS du faux MTarget identifiés par la boîte d'envoi (provider_message_id = ticket), imprimés [FUMEE-SMS]. */
  173 | export async function identifySms(label: string, received: FakeSms[], names: Record<string, string>): Promise<IdentifiedSms[]> {
  174 |     const lines = await outboxByProviderIds(received.map((m) => m.ticket));
  175 |     const byTicket = new Map(lines.map((l) => [l.provider_message_id, l]));
  176 |     const out = received.map((sms) => ({ sms, line: byTicket.get(sms.ticket) ?? null }));
  177 |     console.log(`[FUMEE-SMS] ${label} : ${out.length} SMS`);
  178 |     for (const { sms, line } of out) {
  179 |         console.log(line
  180 |             ? `[FUMEE-SMS]   ${line.type} · ${line.event_id ? names[line.event_id] ?? `événement ${line.event_id}` : 'sans événement'} · clé ${line.idempotency_key} · ${line.status} · ticket ${sms.ticket} · ${sms.receivedAt}`
  181 |             : `[FUMEE-SMS]   NON IDENTIFIÉ · ticket ${sms.ticket} · ${sms.receivedAt} · « ${sms.message.slice(0, 80)} »`);
  182 |     }
  183 |     return out;
  184 | }
  185 | 
  186 | /** Lot hors ligne d'un billet lu dans IndexedDB (lib/tickets/offline-store.ts : base event-village-offline, magasin lots). */
  187 | export interface StoredLot { ticket_id: string; secret_version: number; prefix: string; step_seconds: number; digits: number; first_counter: number; count: number; codes: string }
  188 | 
  189 | export async function readStoredLots(page: Page, ticketId: string): Promise<StoredLot[]> {
  190 |     return page.evaluate(async (id) => {
  191 |         const db = await new Promise<IDBDatabase>((resolve, reject) => {
  192 |             const r = indexedDB.open('event-village-offline');
  193 |             r.onsuccess = () => resolve(r.result);
  194 |             r.onerror = () => reject(r.error ?? new Error('ouverture de event-village-offline impossible'));
  195 |         });
  196 |         try {
  197 |             if (!db.objectStoreNames.contains('lots')) return [];
  198 |             return await new Promise<StoredLot[]>((resolve, reject) => {
  199 |                 const q = db.transaction('lots', 'readonly').objectStore('lots').index('ticketId').getAll(id);
  200 |                 q.onsuccess = () => resolve((q.result as Array<{ lot: StoredLot }>).map((r) => r.lot));
  201 |                 q.onerror = () => reject(q.error ?? new Error('lecture du magasin lots impossible'));
  202 |             });
  203 |         } finally {
  204 |             db.close();
  205 |         }
  206 |     }, ticketId);
  207 | }
  208 | 
  209 | /** Payload du pas courant calculé depuis un lot (même règle que pickOfflineCode, heure du serveur local ≈ Date.now()). */
  210 | export function payloadFromLot(lot: StoredLot, at = Date.now()): { payload: string; counter: number } {
  211 |     const counter = Math.floor(at / (Number(lot.step_seconds) * 1000));
  212 |     const index = counter - Number(lot.first_counter);
  213 |     if (index < 0 || index >= Number(lot.count)) throw new Error(`pas ${counter} hors du lot du billet ${lot.ticket_id} (premier ${lot.first_counter}, ${lot.count} codes)`);
  214 |     const digits = Number(lot.digits);
  215 |     const code = lot.codes.substr(index * digits, digits);
  216 |     if (!/^\d+$/.test(code)) throw new Error(`code illisible dans le lot du billet ${lot.ticket_id} (pas ${counter})`);
  217 |     return { payload: `${lot.prefix}:${lot.ticket_id}:${code}`, counter };
  218 | }
  219 | 
  220 | export const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';
  221 | 
  222 | /** Cloche ouverte sur « Mes billets » ; renvoie le panneau (région « Notifications »). */
  223 | export async function openBell(client: Page): Promise<Locator> {
  224 |     await client.goto('/tickets');
  225 |     await client.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  226 |     const panel = client.getByRole('region', { name: /^notifications$/i });
> 227 |     await expect(panel).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
  228 |     return panel;
  229 | }
  230 | 
  231 | // ── Scanner : reprise de session (projet terrain, amendement A10) ──────────
  232 | 
  233 | /** Contrôle repris sans repasser par l'écran de choix : même événement, même mode ; caméra : « Reprendre le contrôle ». */
  234 | export async function expectResumed(page: Page, title: string, mode: 'camera' | 'manual', what: string): Promise<void> {
  235 |     await expect(page.getByRole('heading', { level: 1, name: title }), `${what} : même événement repris (barre d'état du scanner)`).toBeVisible({ timeout: 45_000 });
  236 |     await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i }), `${what} : l'écran de choix n'est pas réaffiché`).toHaveCount(0);
  237 |     const pressed = page.getByRole('button', { name: mode === 'camera' ? /^caméra$/i : /^saisie manuelle$/i });
  238 |     await expect(pressed, `${what} : même mode (${mode === 'camera' ? 'caméra' : 'saisie manuelle'})`).toHaveAttribute('aria-pressed', 'true');
  239 |     if (mode === 'camera') {
  240 |         await expect(page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }), `${what} : écran « Reprendre le contrôle »`).toBeVisible();
  241 |     }
  242 | }
  243 | 
  244 | // ── Recette (contrat 15.5) ─────────────────────────────────────────────────
  245 | 
  246 | /** Onglet d'une page (rôle tab), sélection vérifiée. */
  247 | export async function openTab(page: Page, name: RegExp): Promise<void> {
  248 |     const tab = page.getByRole('tab', { name });
  249 |     await tab.click();
  250 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  251 | }
  252 | 
  253 | /** Tickets des SMS déjà reçus par ce numéro : repère avant une demande de code. */
  254 | export async function smsSeen(phone: string): Promise<Set<string>> {
  255 |     return new Set((await fakeSmsTo(phone)).map((m) => m.ticket));
  256 | }
  257 | 
  258 | /**
  259 |  * Code à 6 chiffres du dernier SMS reçu par ce numéro depuis le repère. Aucune route de test dans l'application : le code
  260 |  * n'est lu que sur le faux MTarget. Attente plafonnée : l'envoi est synchrone côté application.
  261 |  */
  262 | export async function smsCode(phone: string, seen: ReadonlySet<string>, what: string): Promise<string> {
  263 |     let code = '';
  264 |     await expect.poll(async () => {
  265 |         const fresh = (await fakeSmsTo(phone)).filter((m) => !seen.has(m.ticket));
  266 |         code = fresh.map((m) => /(?<!\d)\d{6}(?!\d)/.exec(m.message)?.[0] ?? '').find(Boolean) ?? '';
  267 |         return code;
  268 |     }, { message: `${what} : code à 6 chiffres reçu par SMS sur le faux MTarget`, timeout: 20_000, intervals: [250, 500, 1000] }).toMatch(/^\d{6}$/);
  269 |     return code;
  270 | }
  271 | 
  272 | /** Code saisi dans OtpInput : le premier champ accepte les 6 chiffres (remplissage automatique du code reçu). */
  273 | export async function fillOtp(page: Page, code: string): Promise<void> {
  274 |     await page.getByRole('textbox', { name: /^chiffre 1 sur 6$/i }).fill(code);
  275 |     await expect(page.getByRole('textbox', { name: /^chiffre 6 sur 6$/i }), 'code réparti sur les 6 champs').toHaveValue(code.slice(-1));
  276 | }
  277 | 
  278 | /** Valeur courante d'un réglage de platform_settings (contrat I1 : { value }). */
  279 | export async function settingValue(key: string): Promise<unknown> {
  280 |     const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
  281 |     if (error) throw new Error(`[e2e] réglage ${key} : ${error.message}`);
  282 |     if (!data) throw new Error(`[e2e] réglage ${key} absent de platform_settings`);
  283 |     return (data.value as { value?: unknown } | null)?.value;
  284 | }
  285 | 
  286 | /** Réglage écrit comme la route, par finance_setting_set : remise en état après la recette, jamais une étape du parcours. */
  287 | export async function restoreSetting(key: string, value: unknown, superadminId: string): Promise<void> {
  288 |     const { data, error } = await serviceClient().rpc('finance_setting_set', {
  289 |         p_key: key, p_value: { value }, p_actor: superadminId, p_reason: 'Remise en état après la recette e2e (lot 8).',
  290 |     });
  291 |     if (error) throw new Error(`[e2e] finance_setting_set ${key} : ${error.code ?? ''} ${error.message}`);
  292 |     if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[e2e] finance_setting_set ${key} refusé : ${JSON.stringify(data)}`);
  293 | }
  294 | 
  295 | /**
  296 |  * Boîte d'envoi vidée par la vraie route (Bearer CRON_SECRET, adaptateurs de l'application pointés sur les faux services),
  297 |  * passages répétés jusqu'à ce qu'aucune ligne due ne reste. Même hôte que run-e2e.mjs : le serveur écoute sur 127.0.0.1.
  298 |  */
  299 | export async function drainOutbox(what: string): Promise<number> {
  300 |     const secret = process.env.CRON_SECRET;
  301 |     if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
  302 |     let total = 0;
  303 |     for (let i = 0; i < 30; i++) {
  304 |         const res = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, { method: 'GET', headers: { authorization: `Bearer ${secret}` } });
  305 |         const text = await res.text();
  306 |         if (res.status !== 200) throw new Error(`${what} : route de l’envoyeur, HTTP ${res.status} ${text.slice(0, 300)}`);
  307 |         let report: { claimed?: unknown };
  308 |         try {
  309 |             report = JSON.parse(text) as { claimed?: unknown };
  310 |         } catch (err) {
  311 |             throw new Error(`${what} : réponse de l’envoyeur illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 300)}`);
  312 |         }
  313 |         const claimed = Number(report.claimed);
  314 |         if (!Number.isInteger(claimed)) throw new Error(`${what} : réponse de l’envoyeur sans « claimed » : ${text.slice(0, 300)}`);
  315 |         if (claimed === 0) {
  316 |             console.log(`[e2e][recette] ${what} : ${total} ligne(s) envoyée(s) par la vraie route`);
  317 |             return total;
  318 |         }
  319 |         total += claimed;
  320 |     }
  321 |     throw new Error(`${what} : lignes encore dues après 30 passages de l’envoyeur (${total} réservées)`);
  322 | }
  323 | 
  324 | const INVARIANTS_SCRIPT = path.join('scripts', 'e2e', 'invariants-run.ts');
  325 | 
  326 | /**
  327 |  * Invariants (a) à (v) sur toute la base locale, boîte d'envoi d'abord vidée par la vraie route (L79) : le script exige de
```