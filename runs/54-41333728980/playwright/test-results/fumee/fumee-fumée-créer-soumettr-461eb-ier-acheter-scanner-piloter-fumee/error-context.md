# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:79:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Entrée validée')
Expected: visible
Error: strict mode violation: getByText('Entrée validée') resolved to 2 elements:
    1) <p class="text-base font-bold leading-snug text-success-fg">Entrée validée</p> aka getByRole('paragraph').filter({ hasText: 'Entrée validée' })
    2) <span class="font-semibold text-slate-900 dark:text-white truncate">Entrée validée</span> aka getByRole('listitem').getByText('Entrée validée')

Call log:
  - Expect "toBeVisible" getByText('Entrée validée') with timeout 40000ms
  - waiting for getByText('Entrée validée')

```

# Test source

```ts
  130 | 
  131 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  132 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  133 |             }
  134 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  135 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  136 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  137 |             await partner.getByLabel(/^prix/i).fill('5000');
  138 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  139 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  140 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  141 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  142 |         });
  143 | 
  144 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  145 |             const card = cardOf(partner, title, /^soumettre/i);
  146 |             await actionWithConfirm(partner, card, /^soumettre/i);
  147 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  148 |                 .toContainText(/en attente de validation/i);
  149 |         });
  150 | 
  151 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  152 |             const admin = await pageAs('fumee-superadmin');
  153 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  154 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  155 |             admin.on('response', async (res) => {
  156 |                 const url = new URL(res.url());
  157 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  158 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  159 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  160 |             });
  161 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  162 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  163 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  164 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  165 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  166 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  167 |         });
  168 | 
  169 |         await test.step('3. le partenaire publie l’événement', async () => {
  170 |             await partner.goto('/partner/events');
  171 |             const card = cardOf(partner, title, /^publier/i);
  172 |             await actionWithConfirm(partner, card, /^publier/i);
  173 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  174 |                 .toContainText(/publié/i);
  175 |         });
  176 | 
  177 |         const client = await pageAs('fumee-client');
  178 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  179 |             await client.goto('/explore');
  180 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  181 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  182 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  183 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  184 |             await client.getByRole('button', { name: /^acheter/i }).click();
  185 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  186 |             await expect(dialog).toBeVisible();
  187 |             await dialog.getByRole('radio', { name: /^wave/i }).check({ force: true }); // radio masqué (sr-only) dans son libellé : le libellé reçoit le clic
  188 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  189 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  190 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  191 |             const succeeded = client.waitForResponse(async (r) => {
  192 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  193 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  194 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  195 |             }, { timeout: 45_000 });
  196 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  197 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  198 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  199 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  200 |             ticketId = status.ticket_ids[0];
  201 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  202 |         });
  203 | 
  204 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  205 |             await partner.goto('/partner/scan');
  206 |             const select = partner.getByLabel('Événement contrôlé');
  207 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  208 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  209 |             await select.selectOption(value as string);
  210 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  211 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  212 | 
  213 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  214 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  215 |             await client.goto('/tickets');
  216 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  217 |             const ticketCard = client.locator('li, article, section, div')
  218 |                 .filter({ has: client.getByText(title) })
  219 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  220 |                 .last();
  221 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  222 |             await expect(qr).toBeVisible();
  223 |             const png = await qr.screenshot();
  224 |             await partner.evaluate(async ({ dataUrl, p }) => {
  225 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  226 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  227 |                 cam.setPayload(p);
  228 |                 await cam.show(dataUrl);
  229 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
> 230 |             await expect(partner.getByText('Entrée validée')).toBeVisible({ timeout: 40_000 });
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  231 |         });
  232 | 
  233 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  234 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  235 |             await partner.goto(`/partner/events/${eventId}`);
  236 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  237 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  238 |             const panel = partner.getByRole('tabpanel');
  239 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  240 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  241 |         });
  242 |     } finally {
  243 |         const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
  244 |         if (issues.length > 0) {
  245 |             await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  246 |             console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
  247 |         }
  248 |         for (const c of contexts) await c.close();
  249 |     }
  250 | });
  251 | 
```