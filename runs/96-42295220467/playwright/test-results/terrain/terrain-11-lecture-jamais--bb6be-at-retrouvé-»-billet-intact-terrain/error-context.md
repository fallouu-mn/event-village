# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact
- Location: e2e/terrain.spec.ts:863:5

# Error details

```
Error: renvoi au retour : indicateur replayOnly dans le corps (3 envois coupés avant)

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: undefined
```

```
Error: renvoi d’une lecture que le serveur n’a jamais reçue : « non traité »

expect(locator).toBeVisible() failed

Locator: locator('[data-scan-result="not_processed"]').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - renvoi d’une lecture que le serveur n’a jamais reçue : « non traité » locator('[data-scan-result="not_processed"]').first() with timeout 30000ms
  - waiting for locator('[data-scan-result="not_processed"]').first()

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 1 non lue": "1"
  - link "Cheikh ControleurA":
    - /url: /controller/profile
- main:
  - heading "Terrain — renvoi seulement 21.50.05" [level=1]
  - paragraph:
    - status: "Vos entrées : 1 entrée"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - status:
    - paragraph: Caméra coupée
    - paragraph: "Application en arrière-plan : la caméra est coupée, votre contrôle reste ouvert."
  - button "Reprendre le contrôle"
  - group "Mode de contrôle":
    - button "Caméra" [pressed]
    - button "Saisie manuelle"
  - 'button "Derniers scans Vous : 1 entrée, 0 refus"'
  - group: Réglages de cet appareil
  - alert:
    - paragraph: Entrée validée
    - paragraph: "Résultat retrouvé : billet lu à 21:50."
    - paragraph: Birame ClientBis
    - paragraph: Entrée libre · TCK-20261106-9A114D8B89
    - paragraph: Touchez l’écran pour scanner le billet suivant
- alert
```

```
Error: jamais « Résultat retrouvé » : aucune lecture d’origine

expect(locator).toHaveCount(expected) failed

Locator:  getByText(/résultat retrouvé/i)
Expected: 0
Received: 1
Timeout:  15000ms

Call log:
  - jamais « Résultat retrouvé » : aucune lecture d’origine getByText(/résultat retrouvé/i) with timeout 15000ms
  - waiting for getByText(/résultat retrouvé/i)
    34 × locator resolved to 1 element
       - unexpected value "1"

```

```
Error: billet TCK-20261106-9A114D8B89 intact : rien n’a été composté par le renvoi

expect(received).toBe(expected) // Object.is equality

Expected: "VALIDE"
Received: "UTILISE"
```

# Test source

```ts
  815 |     } finally {
  816 |         await s.close();
  817 |         restoreTerrainSetting(ev);
  818 |     }
  819 | });
  820 | 
  821 | // ── 10. Taille réelle du lot hors ligne (lot 8, 8.2 x) ─────────────────────
  822 | 
  823 | const OFFLINE_LOT_MAX_ENCODED = 40_000;
  824 | 
  825 | test('10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés', async ({ browser }, testInfo) => {
  826 |     test.setTimeout(3 * 60_000);
  827 |     const s = new Session(browser, testInfo);
  828 |     let ev: TerrainEvent | null = null;
  829 |     try {
  830 |         ev = prepareTerrainEvent('taille du lot', 'client', 1);
  831 |         const ticket = ev.tickets[0];
  832 |         const client = await s.open('fumee-client');
  833 |         const lotPath = `/api/tickets/${ticket.id}/offline-codes`;
  834 |         const responded = client.page.waitForResponse((r) => new URL(r.url()).pathname === lotPath && r.request().method() === 'GET', { timeout: 45_000 });
  835 |         await client.page.goto('/tickets');
  836 |         const res = await responded;
  837 |         await res.finished();
  838 |         expect(res.status(), `téléchargement automatique du lot ${lotPath}`).toBe(200);
  839 |         const encoding = (await res.allHeaders())['content-encoding'] ?? null;
  840 |         const sizes = await res.request().sizes();
  841 |         // Ni content-length (absent en chunked), ni APIRequestContext : seule la mesure du navigateur dit ce qui a transité
  842 |         await expect.poll(() => client.page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, lotPath), {
  843 |             message: 'mesure du navigateur (Resource Timing) du téléchargement du lot', timeout: 10_000,
  844 |         }).toBeGreaterThan(0);
  845 |         const timing = await client.page.evaluate((p) => {
  846 |             const entry = performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === p) as PerformanceResourceTiming;
  847 |             return { encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize };
  848 |         }, lotPath);
  849 |         console.log(`[HORS-LIGNE-TRANSFERE] content-encoding=${encoding ?? 'aucun'} encodedBodySize=${timing.encodedBodySize} decodedBodySize=${timing.decodedBodySize} `
  850 |             + `transferSize=${timing.transferSize} responseBodySize=${sizes.responseBodySize} responseHeadersSize=${sizes.responseHeadersSize}`);
  851 |         expect(timing.decodedBodySize, 'taille décompressée du lot lue par le navigateur').toBeGreaterThan(0);
  852 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
  853 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
  854 |         expect.soft(timing.encodedBodySize, `corps transféré sous ${OFFLINE_LOT_MAX_ENCODED} octets`).toBeLessThan(OFFLINE_LOT_MAX_ENCODED);
  855 |     } finally {
  856 |         await s.close();
  857 |         restoreTerrainSetting(ev);
  858 |     }
  859 | });
  860 | 
  861 | // ── 11. Scan repris sans ligne en base (lot 8, 8.2 e) ──────────────────────
  862 | 
  863 | test('11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact', async ({ browser }, testInfo) => {
  864 |     test.setTimeout(4 * 60_000);
  865 |     const s = new Session(browser, testInfo);
  866 |     let ev: TerrainEvent | null = null;
  867 |     try {
  868 |         ev = prepareTerrainEvent('renvoi seulement', 'client-bis', 1);
  869 |         const ticket = ev.tickets[0];
  870 |         const holder = await s.holder('fumee-client-bis');
  871 |         const ctl = await s.open('fumee-controleur', { probe: true });
  872 |         const page = ctl.page;
  873 |         await openScanner(page, ev.title);
  874 | 
  875 |         const keys: Array<string | null> = [];
  876 |         page.on('request', (req) => {
  877 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  878 |         });
  879 | 
  880 |         // Toute lecture est coupée AVANT le serveur (aucun route.fetch) ; la première attend que l'application soit sortie
  881 |         let blocked = 0;
  882 |         let releaseAbort: () => void = () => undefined;
  883 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  884 |         const blockBeforeServer = async (route: Route): Promise<void> => {
  885 |             if (route.request().method() !== 'POST') {
  886 |                 await route.fallback();
  887 |                 return;
  888 |             }
  889 |             blocked += 1;
  890 |             if (blocked === 1) await abortGate;
  891 |             await route.abort('timedout');
  892 |         };
  893 |         await page.route('**/api/controller/scan', blockBeforeServer);
  894 |         const errorsBefore = await probePostErrors(page);
  895 |         await presentPayloadNoResult(page, await livePayload(holder, ticket.id), 'renvoi seulement : lecture coupée avant le serveur');
  896 |         await expect.poll(() => blocked, { message: 'lecture interceptée avant le serveur', timeout: 20_000 }).toBe(1);
  897 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  898 |         releaseAbort();
  899 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore, {
  900 |             message: 'trois essais sans réponse (même clé)', timeout: 30_000,
  901 |         }).toBeGreaterThanOrEqual(3);
  902 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan gardé sur l’appareil avec sa clé', timeout: 10_000 }).toEqual([keys[0]]);
  903 |         const blockedTotal = blocked;
  904 |         await page.unroute('**/api/controller/scan', blockBeforeServer);
  905 | 
  906 |         const resumed = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/controller/scan', { timeout: 20_000 });
  907 |         await setVisibility(page, 'visible'); // retour au premier plan : le scan est renvoyé
  908 |         const body = (await resumed).postDataJSON() as Record<string, unknown>;
  909 | 
  910 |         expect.soft(body.replayOnly, `renvoi au retour : indicateur replayOnly dans le corps (${blockedTotal} envois coupés avant)`).toBe(true);
  911 |         await expect.soft(page.locator('[data-scan-result="not_processed"]').first(), 'renvoi d’une lecture que le serveur n’a jamais reçue : « non traité »').toBeVisible({ timeout: 30_000 });
  912 |         await expect.soft(page.getByText(/résultat retrouvé/i), 'jamais « Résultat retrouvé » : aucune lecture d’origine').toHaveCount(0);
  913 |         expect.soft(new Set(keys).size, `même clé pour la lecture et son renvoi : ${JSON.stringify(keys)}`).toBe(1);
  914 |         const db = ticketScans(ticket.id);
> 915 |         expect(db.ticket.status, `billet ${ticket.number} intact : rien n’a été composté par le renvoi`).toBe('VALIDE');
      |                                                                                                          ^ Error: billet TCK-20261106-9A114D8B89 intact : rien n’a été composté par le renvoi
  916 |         expect(db.scans, 'aucune ligne ticket_scans pour ce billet').toEqual([]);
  917 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  918 |     } finally {
  919 |         await s.close();
  920 |         restoreTerrainSetting(ev);
  921 |     }
  922 | });
  923 | 
  924 | // ── 12. Écart de caisse (lot 8, 8.2 f) ─────────────────────────────────────
  925 | 
  926 | /** Permission espèces du contrôleur A sur cet événement : prepareTerrainEvent l'affecte sans elle. */
  927 | async function allowControllerCash(ev: TerrainEvent): Promise<void> {
  928 |     const { data, error } = await serviceClient().from('event_controllers').update({ can_accept_cash: true })
  929 |         .eq('event_id', ev.eventId).eq('user_id', ev.controllerUserId).select('user_id');
  930 |     if (error) throw new Error(`permission espèces du contrôleur A sur ${ev.eventId} : ${error.message}`);
  931 |     if ((data ?? []).length !== 1) throw new Error(`affectation du contrôleur A sur ${ev.eventId} introuvable`);
  932 | }
  933 | 
  934 | test('12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste', async ({ browser }, testInfo) => {
  935 |     test.setTimeout(3 * 60_000);
  936 |     const s = new Session(browser, testInfo);
  937 |     let ev: TerrainEvent | null = null;
  938 |     try {
  939 |         ev = prepareTerrainEvent('ecart de caisse', 'client-bis', 1);
  940 |         await allowControllerCash(ev);
  941 |         const ctl = await s.open('fumee-controleur', { probe: true });
  942 |         const page = ctl.page;
  943 |         await openScanner(page, ev.title);
  944 | 
  945 |         await page.getByRole('tab', { name: /^caisse$/i }).click();
  946 |         await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  947 |         const opening = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  948 |         await expect(opening).toBeVisible();
  949 |         const opened = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/controller/shifts/open' && r.request().method() === 'POST');
  950 |         await opening.getByRole('button', { name: /^ouvrir la caisse$/i }).click();
  951 |         const openedRes = await opened;
  952 |         expect(openedRes.status(), `ouverture de la caisse : ${(await openedRes.text()).slice(0, 300)}`).toBe(200);
  953 | 
  954 |         await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  955 |         const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  956 |         await expect(dialog).toBeVisible();
  957 |         const closeResponse = () => page.waitForResponse((r) => new URL(r.url()).pathname === '/api/controller/shifts/close' && r.request().method() === 'POST');
  958 | 
  959 |         // Rien d'encaissé : 1 000 F comptés font un écart de +1 000 F
  960 |         const counted = dialog.getByLabel(/^espèces encaissées comptées/i);
  961 |         await counted.fill('1000');
  962 |         const refusal = closeResponse();
  963 |         await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  964 |         const refused = await refusal;
  965 |         const refusedBody = (await refused.json()) as Record<string, unknown>;
  966 |         expect(refused.status(), `clôture avec écart : ${JSON.stringify(refusedBody)}`).toBe(400);
  967 |         expect(refusedBody.code, `clôture avec écart : ${JSON.stringify(refusedBody)}`).toBe('JUSTIFICATION_REQUIRED');
  968 |         await expect(dialog.getByText(/^écart constaté par le serveur$/i)).toBeVisible();
  969 |         // Soft : la caisse est fermée ensuite, même quand l'écart n'est pas affiché
  970 |         expect.soft(refusedBody.discrepancy, 'écart renvoyé par le serveur (contrat 3.6)').toBe(1000);
  971 |         await expect.soft(dialog.getByText(/écart de\s1\s000\sF\sCFA/i), 'texte « Écart de 1 000 F CFA » à l’écran').toBeVisible();
  972 | 
  973 |         await counted.fill('0');
  974 |         const closed = closeResponse();
  975 |         await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  976 |         const closedRes = await closed;
  977 |         expect(closedRes.status(), `clôture sans écart : ${(await closedRes.text()).slice(0, 300)}`).toBe(200);
  978 |         await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  979 |     } finally {
  980 |         await s.close();
  981 |         restoreTerrainSetting(ev);
  982 |     }
  983 | });
  984 | 
```