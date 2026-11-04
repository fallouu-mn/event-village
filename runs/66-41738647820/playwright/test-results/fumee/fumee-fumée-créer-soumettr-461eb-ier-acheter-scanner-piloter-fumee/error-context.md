# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:192:5

# Error details

```
Error: locator.check: Element is outside of the viewport
Call log:
  - waiting for getByRole('dialog').or(getByRole('alertdialog')).getByRole('radio', { name: /^wave/i })
    - locator resolved to <input required="" type="radio" value="WAVE" class="peer sr-only" name=":r0:-operator"/>
  - attempting click action
    - scrolling into view if needed
    - done scrolling

```

# Test source

```ts
  66  | 
  67  | /** Clic sur une action ; si une modale de confirmation s'ouvre, elle est confirmée (même libellé ou « Confirmer »). */
  68  | async function actionWithConfirm(page: Page, scope: Locator, action: RegExp): Promise<void> {
  69  |     await scope.getByRole('button', { name: action }).click();
  70  |     const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  71  |     if (await dialog.isVisible()) {
  72  |         await dialog.getByRole('button', { name: new RegExp(`${action.source}|confirmer`, 'i') }).last().click();
  73  |         await expect(dialog).toBeHidden();
  74  |     }
  75  | }
  76  | 
  77  | /** Indicateur de la page de pilotage : plus petit bloc du panneau qui porte le libellé et un nombre. */
  78  | function kpi(panel: Locator, label: RegExp): Locator {
  79  |     return panel.locator('dl, li, article, section, div')
  80  |         .filter({ has: panel.page().getByText(label) })
  81  |         .filter({ hasText: /\d/ })
  82  |         .last();
  83  | }
  84  | 
  85  | async function fakeServices(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  86  |     const res = await fetch(`${e2eConfig().fakeServicesUrl}${pathName}`, {
  87  |         method: 'POST',
  88  |         headers: { 'content-type': 'application/json' },
  89  |         body: JSON.stringify(body),
  90  |     });
  91  |     const text = await res.text();
  92  |     let json: Record<string, unknown>;
  93  |     try {
  94  |         json = text ? JSON.parse(text) as Record<string, unknown> : {};
  95  |     } catch (err) {
  96  |         throw new Error(`faux services ${pathName} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
  97  |     }
  98  |     return { status: res.status, json };
  99  | }
  100 | 
  101 | // ── Lot 6 (contrat P3) : outils des étapes 7 à 10 ──────────────────────────
  102 | 
  103 | interface FakeSms { ticket: string; msisdn: string; message: string; receivedAt: string }
  104 | 
  105 | /** SMS reçus par le faux MTarget pour ce numéro (200 derniers, plus récent d'abord). */
  106 | async function fakeSmsTo(phone: string): Promise<FakeSms[]> {
  107 |     const digits = phone.replace(/\D/g, '');
  108 |     const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/sms?to=${digits}&limit=200`);
  109 |     const text = await res.text();
  110 |     if (!res.ok) throw new Error(`faux MTarget /__test/sms : HTTP ${res.status} ${text.slice(0, 200)}`);
  111 |     let body: { messages?: FakeSms[] };
  112 |     try {
  113 |         body = JSON.parse(text) as { messages?: FakeSms[] };
  114 |     } catch (err) {
  115 |         throw new Error(`faux MTarget /__test/sms : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
  116 |     }
  117 |     if (!Array.isArray(body.messages)) throw new Error(`faux MTarget /__test/sms : liste absente ${text.slice(0, 200)}`);
  118 |     return body.messages;
  119 | }
  120 | 
  121 | /** SMS arrivés depuis le repère (tickets connus avant l'étape), du plus ancien au plus récent. */
  122 | function smsSince(all: FakeSms[], before: ReadonlySet<string>): FakeSms[] {
  123 |     return all.filter((m) => !before.has(m.ticket)).reverse();
  124 | }
  125 | 
  126 | /** Réglage notif.* entier lu dans platform_settings (valeur historisée du contrat I1). */
  127 | async function notifSettingInt(key: string): Promise<number> {
  128 |     const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
  129 |     if (error) throw new Error(`réglage ${key} : ${error.message}`);
  130 |     const value = Number((data?.value as { value?: unknown } | null | undefined)?.value);
  131 |     if (!Number.isInteger(value)) throw new Error(`réglage ${key} illisible : ${JSON.stringify(data)}`);
  132 |     return value;
  133 | }
  134 | 
  135 | /** Heure de Dakar dans la plage de silence [start, end) (plage vide si start = end, à cheval sur minuit si start > end). */
  136 | function inQuietHours(hour: number, start: number, end: number): boolean {
  137 |     if (start === end) return false;
  138 |     return start > end ? hour >= start || hour < end : hour >= start && hour < end;
  139 | }
  140 | 
  141 | /** Jour de Dakar (AAAA-MM-JJ, UTC+0) décalé de `offset` jours. */
  142 | function dakarDayFrom(base: Date, offset: number): string {
  143 |     const d = new Date(base.getTime());
  144 |     d.setUTCDate(d.getUTCDate() + offset);
  145 |     return d.toISOString().slice(0, 10);
  146 | }
  147 | 
  148 | /** Données de rendu comme l'envoyeur (dispatcher.ts, renderData) : template_data complété, sans rien écraser. */
  149 | function renderData(row: OutboxLine, event: Record<string, unknown>): Record<string, unknown> {
  150 |     const data: Record<string, unknown> = { ...(row.template_data ?? {}) };
  151 |     for (const [k, v] of Object.entries(event)) if (data[k] === undefined) data[k] = v;
  152 |     return data;
  153 | }
  154 | 
  155 | function brief(rows: OutboxLine[]): string {
  156 |     return JSON.stringify(rows.map((r) => ({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, user: r.recipient_user_id })));
  157 | }
  158 | 
  159 | /** Achat d'un billet par l'interface, comme à l'étape 4, depuis la page publique de l'événement. */
  160 | async function buyThroughUi(client: Page, eventId: string, category: string): Promise<string> {
  161 |     await client.goto(`/events/${eventId}`);
  162 |     await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  163 |     await client.getByRole('button', { name: /^acheter/i }).click();
  164 |     const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  165 |     await expect(dialog).toBeVisible();
> 166 |     await dialog.getByRole('radio', { name: /^wave/i }).check({ force: true });
      |                                                         ^ Error: locator.check: Element is outside of the viewport
  167 |     await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  168 |     await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  169 |     await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  170 |     const succeeded = client.waitForResponse(async (r) => {
  171 |         if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  172 |         const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  173 |         return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  174 |     }, { timeout: 45_000 });
  175 |     const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  176 |     expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  177 |     expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  178 |     const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  179 |     await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  180 |     return status.ticket_ids[0];
  181 | }
  182 | 
  183 | /** Cloche ouverte sur « Mes billets » ; renvoie le panneau (région « Notifications »). */
  184 | async function openBell(client: Page): Promise<Locator> {
  185 |     await client.goto('/tickets');
  186 |     await client.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  187 |     const panel = client.getByRole('region', { name: /^notifications$/i });
  188 |     await expect(panel).toBeVisible();
  189 |     return panel;
  190 | }
  191 | 
  192 | test('fumée : créer, soumettre, valider, publier, acheter, scanner, piloter', async ({ browser }, testInfo) => {
  193 |     const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
  194 |     const title = `Fumée — Concert des Parcelles ${stamp}`;
  195 |     const category = 'Entrée générale';
  196 |     const start = new Date(Date.now() + 2 * 3600_000);
  197 |     start.setUTCSeconds(0, 0);
  198 |     start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
  199 |     const end = new Date(start.getTime() + 4 * 3600_000);
  200 |     const s = dakarParts(start);
  201 |     const e = dakarParts(end);
  202 |     let eventId = '';
  203 |     let ticketId = '';
  204 | 
  205 |     const contexts: BrowserContext[] = [];
  206 |     const guards: Array<{ role: string; guard: PageGuard }> = [];
  207 |     async function pageAs(role: 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client', withCamera = false): Promise<Page> {
  208 |         const context = await openRoleContext(browser, testInfo, role);
  209 |         if (withCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  210 |         contexts.push(context);
  211 |         const page = await context.newPage();
  212 |         guards.push({ role, guard: new PageGuard(page) });
  213 |         return page;
  214 |     }
  215 | 
  216 |     try {
  217 |         const partner = await pageAs('fumee-organisateur', true);
  218 | 
  219 |         await test.step('1. le partenaire crée l’événement (début dans 2 h)', async () => {
  220 |             await partner.goto('/partner/events/new');
  221 |             await partner.getByLabel(/^titre/i).fill(title);
  222 |             await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  223 |             await partner.getByLabel(/^description/i).fill('Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives.');
  224 |             await partner.getByLabel(/date de début/i).fill(s.date);
  225 |             await partner.getByLabel(/heure de début/i).fill(s.time);
  226 |             await partner.getByLabel(/date de fin/i).fill(e.date);
  227 |             await partner.getByLabel(/heure de fin/i).fill(e.time);
  228 |             await partner.getByLabel(/^lieu/i).fill('Esplanade des Parcelles Assainies');
  229 |             await partner.getByLabel(/^ville/i).fill('Dakar');
  230 |             await partner.getByLabel(/capacité/i).fill('100');
  231 | 
  232 |             const posterPage = await partner.context().newPage();
  233 |             await posterPage.setViewportSize(POSTER_SIZE);
  234 |             await posterPage.setContent(posterHtml({
  235 |                 title: 'Concert des Parcelles', kicker: 'Fumée', dateLabel: `${s.date} · ${s.time}`, venue: 'Esplanade des Parcelles Assainies',
  236 |                 city: 'Dakar', organizer: 'Organisateur de test', palette: 'terre', motif: 'soleil',
  237 |             }));
  238 |             const poster = await posterPage.screenshot({ type: 'png' });
  239 |             await posterPage.close();
  240 |             const upload = partner.waitForResponse((r) => r.url().includes('/api/partner/upload') && r.request().method() === 'POST');
  241 |             await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-fumee.png', mimeType: 'image/png', buffer: poster });
  242 |             expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  243 | 
  244 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  245 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  246 |             }
  247 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  248 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  249 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  250 |             await partner.getByLabel(/^prix/i).fill('5000');
  251 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  252 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  253 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  254 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  255 |         });
  256 | 
  257 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  258 |             const card = cardOf(partner, title, /^soumettre/i);
  259 |             await actionWithConfirm(partner, card, /^soumettre/i);
  260 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  261 |                 .toContainText(/en attente de validation/i);
  262 |         });
  263 | 
  264 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  265 |             const admin = await pageAs('fumee-superadmin');
  266 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
```