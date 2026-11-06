# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés
- Location: e2e/terrain.spec.ts:825:5

# Error details

```
Error: en-tête content-encoding de la réponse du lot

expect(received).toBe(expected) // Object.is equality

Expected: "gzip"
Received: null
```

```
Error: corps transféré plus petit que le corps décompressé

expect(received).toBeLessThan(expected)

Expected: < 33162
Received:   33162
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
        - generic [ref=e16]:
          - button "Notifications, 6 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "6"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Awa Client)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: AC
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - status [ref=e38]: En direct
              - heading "Mes billets" [level=1] [ref=e40]
              - paragraph [ref=e41]: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
            - generic [ref=e42]:
              - link "Afficher mes billets hors ligne" [ref=e43] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=e51] [cursor=pointer]
              - link "Réserver un billet" [ref=e57] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=e64]:
            - tab "À venir" [selected] [ref=e65] [cursor=pointer]
            - tab "Tous mes billets" [ref=e67] [cursor=pointer]
            - tab "Historique" [ref=e69] [cursor=pointer]
            - tab "Reçus" [ref=e71] [cursor=pointer]
          - tabpanel "À venir" [ref=e73]:
            - list [ref=e74]:
              - listitem [ref=e75]:
                - article "Billet pour Terrain — taille du lot 19.44.53" [ref=e76]:
                  - generic [ref=e77]:
                    - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e80]': Valable
                    - generic [ref=e83]:
                      - heading "Terrain — taille du lot 19.44.53" [level=2] [ref=e84]
                      - paragraph [ref=e85]: Orga A (test)
                    - generic [ref=e90]:
                      - generic [ref=e91]:
                        - generic [ref=e92]:
                          - term [ref=e93]: Date
                          - definition [ref=e94]: 07 NOV 2026
                        - generic [ref=e95]:
                          - term [ref=e96]: Heure d’accès
                          - definition [ref=e97]: 15:45
                        - generic [ref=e98]:
                          - term [ref=e99]: Lieu
                          - definition [ref=e100]: Esplanade des Parcelles Assainies
                        - generic [ref=e101]:
                          - term [ref=e102]: Emplacement
                          - definition [ref=e103]: Entrée libre
                      - generic [ref=e105]:
                        - img "QR d’entrée dynamique" [ref=e107]
                        - paragraph [ref=e110]:
                          - generic [ref=e111]: "Numéro du billet :"
                          - text: TCK-20261106-CA4316EB3E
                        - generic [ref=e112]:
                          - generic [ref=e113]:
                            - generic [ref=e114]: Code renouvelé toutes les 20 s
                            - generic [ref=e116]:
                              - generic [aria-hidden] [ref=e117]: 6 s
                              - generic [ref=e118]: Nouveau code dans 6 secondes
                          - paragraph [ref=e121]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e122]:
                            - generic [ref=e127]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e129]:
                          - generic [ref=e132]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=e133]:
                          - generic [ref=e137]: Billet authentique, émis par Event Village
                        - paragraph [ref=e138]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e139]:
                    - button "Transférer" [ref=e140] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e146] [cursor=pointer]:
                      - generic [ref=e150]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e151] [cursor=pointer]:
                      - generic [ref=e159]: Lien
                    - button "Télécharger le billet en PDF" [ref=e160] [cursor=pointer]:
                      - generic [ref=e165]: PDF
                    - button "Aide au transfert" [ref=e166] [cursor=pointer]
              - listitem [ref=e172]:
                - article "Billet pour Terrain — cache sans api 19.42.55" [ref=e173]:
                  - generic [ref=e174]:
                    - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e177]': Valable
                    - generic [ref=e180]:
                      - heading "Terrain — cache sans api 19.42.55" [level=2] [ref=e181]
                      - paragraph [ref=e182]: Orga A (test)
                    - generic [ref=e187]:
                      - generic [ref=e188]:
                        - generic [ref=e189]:
                          - term [ref=e190]: Date
                          - definition [ref=e191]: 07 NOV 2026
                        - generic [ref=e192]:
                          - term [ref=e193]: Heure d’accès
                          - definition [ref=e194]: 15:45
                        - generic [ref=e195]:
                          - term [ref=e196]: Lieu
                          - definition [ref=e197]: Esplanade des Parcelles Assainies
                        - generic [ref=e198]:
                          - term [ref=e199]: Emplacement
                          - definition [ref=e200]: Entrée libre
                      - generic [ref=e202]:
                        - img "QR d’entrée dynamique" [ref=e204]
                        - paragraph [ref=e207]:
                          - generic [ref=e208]: "Numéro du billet :"
                          - text: TCK-20261106-D60A08FBAB
                        - generic [ref=e209]:
                          - generic [ref=e210]:
                            - generic [ref=e211]: Code renouvelé toutes les 20 s
                            - generic [ref=e213]:
                              - generic [aria-hidden] [ref=e214]: 6 s
                              - generic [ref=e215]: Nouveau code dans 6 secondes
                          - paragraph [ref=e218]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e219]:
                            - generic [ref=e224]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e226]:
                          - generic [ref=e229]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=e230]:
                          - generic [ref=e234]: Billet authentique, émis par Event Village
                        - paragraph [ref=e235]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e236]:
                    - button "Transférer" [ref=e237] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e243] [cursor=pointer]:
                      - generic [ref=e247]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e248] [cursor=pointer]:
                      - generic [ref=e256]: Lien
                    - button "Télécharger le billet en PDF" [ref=e257] [cursor=pointer]:
                      - generic [ref=e262]: PDF
                    - button "Aide au transfert" [ref=e263] [cursor=pointer]
              - listitem [ref=e269]:
                - article "Billet pour TEST Concert A (publié, à venir)" [ref=e270]:
                  - generic [ref=e271]:
                    - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e274]': Valable
                    - generic [ref=e277]:
                      - heading "TEST Concert A (publié, à venir)" [level=2] [ref=e278]
                      - paragraph [ref=e279]: Orga A (test)
                    - generic [ref=e284]:
                      - generic [ref=e285]:
                        - generic [ref=e286]:
                          - term [ref=e287]: Date
                          - definition [ref=e288]: 06 DÉC 2026
                        - generic [ref=e289]:
                          - term [ref=e290]: Heure d’accès
                          - definition [ref=e291]: 20:00
                        - generic [ref=e292]:
                          - term [ref=e293]: Lieu
                          - definition [ref=e294]: Salle de test, Dakar
                        - generic [ref=e295]:
                          - term [ref=e296]: Emplacement
                          - definition [ref=e297]: Standard
                      - generic [ref=e299]:
                        - img "QR d’entrée dynamique" [ref=e301]
                        - paragraph [ref=e304]:
                          - generic [ref=e305]: "Numéro du billet :"
                          - text: TCK-FIXTURE-CLIENT-A-1
                        - generic [ref=e306]:
                          - generic [ref=e307]:
                            - generic [ref=e308]: Code renouvelé toutes les 20 s
                            - generic [ref=e310]:
                              - generic [aria-hidden] [ref=e311]: 6 s
                              - generic [ref=e312]: Nouveau code dans 6 secondes
                          - paragraph [ref=e315]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e316]:
                            - generic [ref=e321]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e323]:
                          - generic [ref=e327]: Disponible hors ligne à partir du sam. 5 déc. 2026 à 20:00
                        - paragraph [ref=e328]:
                          - generic [ref=e332]: Billet authentique, émis par Event Village
                        - paragraph [ref=e333]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e334]:
                    - button "Transférer" [ref=e335] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e341] [cursor=pointer]:
                      - generic [ref=e345]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e346] [cursor=pointer]:
                      - generic [ref=e354]: Lien
                    - button "Télécharger le billet en PDF" [ref=e355] [cursor=pointer]:
                      - generic [ref=e360]: PDF
                    - button "Aide au transfert" [ref=e361] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e367]:
      - generic [ref=e368]:
        - link "Accueil" [ref=e369] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e374] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e379] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e383] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e388]
```

# Test source

```ts
  753 |         released = true;
  754 |         await page.reload(); // fermeture puis réouverture de l'application pendant l'envoi
  755 |         await expectRecovered(page, 'billet 4, réouverture');
  756 |         await page.unroute('**/api/controller/scan', holdResponse);
  757 |         const keys4 = keys.slice(keysBefore4);
  758 |         expect(keys4.length, `billet 4 : lecture puis renvoi à la réouverture : ${JSON.stringify(keys4)}`).toBeGreaterThanOrEqual(2);
  759 |         expect(new Set(keys4).size, `billet 4 : même clé pour la lecture et le renvoi : ${JSON.stringify(keys4)}`).toBe(1);
  760 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 4 : scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  761 |         const db4 = ticketScans(t4.id);
  762 |         expect(db4.scans.filter((r) => r.accepted).length, `billet 4 : une seule entrée acceptée : ${JSON.stringify(db4.scans)}`).toBe(1);
  763 |         expect(db4.scans.filter((r) => r.result === 'already_used').length, `billet 4 : aucune ligne already_used : ${JSON.stringify(db4.scans)}`).toBe(0);
  764 |         expect(db4.ticket.status).toBe('UTILISE');
  765 |         await expectDoorCount(page, 4, 'après le renvoi du billet 4');
  766 |         await expectResumed(page, ev.title, 'camera', 'réouverture pendant l’envoi');
  767 |     } finally {
  768 |         await s.close();
  769 |         restoreTerrainSetting(ev);
  770 |     }
  771 | });
  772 | 
  773 | // ── 8 et 9. Éléments fixes de l'interface (lot 8, 8.2 s) ───────────────────
  774 | 
  775 | test('8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur', async ({ browser }, testInfo) => {
  776 |     test.setTimeout(3 * 60_000);
  777 |     const s = new Session(browser, testInfo);
  778 |     let ev: TerrainEvent | null = null;
  779 |     try {
  780 |         ev = prepareTerrainEvent('barre achat', 'client', 0, { priceFcfa: 5000 });
  781 |         const client = await s.open('fumee-client');
  782 |         await client.page.goto(`/events/${ev.eventId}`);
  783 |         await client.page.getByRole('button', { name: /^ajouter un billet entrée générale/i }).click();
  784 |         await expectBuyBarAnchored(client.page, 'fiche de l’événement');
  785 |     } finally {
  786 |         await s.close();
  787 |         restoreTerrainSetting(ev);
  788 |     }
  789 | });
  790 | 
  791 | test('9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force', async ({ browser }, testInfo) => {
  792 |     test.setTimeout(3 * 60_000);
  793 |     const s = new Session(browser, testInfo);
  794 |     let ev: TerrainEvent | null = null;
  795 |     try {
  796 |         ev = prepareTerrainEvent('plein ecran', 'client-bis', 1);
  797 |         const holder = await s.holder('fumee-client-bis');
  798 |         const ctl = await s.open('fumee-controleur', { probe: true });
  799 |         await openScanner(ctl.page, ev.title);
  800 |         // Code refusé : l'écran reste 3 s, le temps de la mesure, et le billet ne change pas d'état
  801 |         await presentPayload(ctl.page, forgedPayload(await livePayload(holder, ev.tickets[0].id)), 'code qui ne se vérifie pas');
  802 |         const box = await ctl.page.evaluate(() => {
  803 |             const overlay = document.querySelector('[data-scan-state="result"]');
  804 |             if (!overlay) return null;
  805 |             document.body.style.minHeight = '3000px';
  806 |             window.scrollTo({ top: 1000, behavior: 'instant' });
  807 |             const r = overlay.getBoundingClientRect();
  808 |             return { scrollY: window.scrollY, top: r.top, bottom: r.bottom, left: r.left, right: r.right, innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  809 |         });
  810 |         if (!box) throw new Error('plein écran du scanner fermé avant la mesure');
  811 |         const seen = JSON.stringify(box);
  812 |         expect(box.scrollY, `page défilée de force : ${seen}`).toBeGreaterThan(0);
  813 |         expect({ top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) }, `rectangle du plein écran : ${seen}`)
  814 |             .toEqual({ top: 0, left: 0, right: box.innerWidth, bottom: box.innerHeight });
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
> 853 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
      |                                                                                                    ^ Error: corps transféré plus petit que le corps décompressé
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
  915 |         expect(db.ticket.status, `billet ${ticket.number} intact : rien n’a été composté par le renvoi`).toBe('VALIDE');
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
```