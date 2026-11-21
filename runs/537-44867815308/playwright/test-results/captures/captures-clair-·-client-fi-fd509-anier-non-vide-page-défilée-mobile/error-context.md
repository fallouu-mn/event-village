# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: bas de la barre au-dessus de la navigation, jamais recouvert — fiche de « ce soir », haut de page : {"scrollY":0,"scrollMax":2829,"top":655,"bottom":784,"left":0,"right":390,"innerWidth":390,"innerHeight":844,"navHeight":68}

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 66
Received:    60
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 10 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "10"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: FM
      - main [ref=e28]:
        - generic [ref=e30]:
          - region [ref=e31]:
            - generic [ref=e33]:
              - link "Retour aux événements" [ref=e34] [cursor=pointer]:
                - /url: /explore
                - generic [aria-hidden] [ref=e37]: Retour
              - generic [ref=e38]:
                - 'button "Mettre en favori : Nuit du Sabar — édition d’automne" [ref=e39] [cursor=pointer]'
                - button "Partager l’événement" [ref=e42] [cursor=pointer]
            - generic [ref=e49]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e51]
              - generic [ref=e52]:
                - generic [ref=e53]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e56]
                - paragraph [ref=e57]: Organisé par Baobab Scène
                - list "Date et lieu" [ref=e58]:
                  - listitem [ref=e59]:
                    - generic [ref=e62]:
                      - generic [ref=e63]: Samedi 21 novembre 2026 à 05:45
                      - generic [ref=e64]: Jusqu’à 10:45
                  - listitem [ref=e65]:
                    - generic [ref=e69]:
                      - generic [ref=e70]: Esplanade de la Corniche Ouest
                      - generic [ref=e71]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - paragraph [ref=e73]:
                  - generic [aria-hidden] [ref=e77]: Commence dans 53 min 06 s
                  - generic [ref=e78]: Commence dans 54 minutes
          - generic [ref=e80]:
            - article [ref=e81]:
              - list "Infos de l’événement" [ref=e82]:
                - listitem [ref=e83]:
                  - generic [ref=e87]:
                    - paragraph [ref=e88]: Billet dans l’application
                    - paragraph [ref=e89]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=e90]:
                - heading "À propos" [level=2] [ref=e91]
                - paragraph [ref=e92]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=e93]:
                - heading "Programme" [level=2] [ref=e94]
                - list [ref=e95]:
                  - listitem [ref=e96]:
                    - generic [ref=e98]:
                      - paragraph [ref=e99]: 19:30
                      - generic [ref=e100]: Activité
                    - paragraph [ref=e102]: Ouverture des portes
                  - listitem [ref=e103]:
                    - generic [ref=e105]:
                      - paragraph [ref=e106]: 20:30
                      - generic [ref=e107]: Artiste
                    - paragraph [ref=e109]: Première partie
                    - paragraph [ref=e110]: Troupe Kër Gëstu
                  - listitem [ref=e111]:
                    - generic [ref=e113]:
                      - paragraph [ref=e114]: 22:00
                      - generic [ref=e115]: Artiste
                    - paragraph [ref=e117]: Grand cercle de sabar
                    - paragraph [ref=e118]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e119]:
                    - generic [ref=e121]:
                      - paragraph [ref=e122]: 23:30
                      - generic [ref=e123]: Activité
                    - paragraph [ref=e125]: Bœuf final avec le public
              - region [ref=e126]:
                - heading "Lieu et accès" [level=2] [ref=e127]
                - generic [ref=e128]:
                  - paragraph [ref=e129]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e130]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=e131]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=e138]:
                    - generic [ref=e139]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=e143] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e148] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e158]:
                  - generic [ref=e165]:
                    - paragraph [ref=e166]: Stationnement
                    - generic [ref=e167]: Stationnement surveillé à proximité.
                  - generic [ref=e173]:
                    - paragraph [ref=e174]: Paiement
                    - generic [ref=e175]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=e181]:
                    - paragraph [ref=e182]: Règlement et consignes
                    - generic [ref=e183]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=e184]:
                - generic [ref=e186]:
                  - paragraph [ref=e187]: Organisateur
                  - paragraph [ref=e188]: Baobab Scène
            - complementary [ref=e189]:
              - generic [ref=e190]:
                - generic [ref=e191]:
                  - generic [ref=e192]:
                    - heading "Billetterie" [level=2] [ref=e193]
                    - paragraph [ref=e194]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=e195]: En direct
                - list "Catégories de billets" [ref=e197]:
                  - listitem [ref=e198]:
                    - generic [ref=e200]:
                      - generic [ref=e201]:
                        - heading "VIP" [level=3] [ref=e202]
                        - paragraph [ref=e203]: 15 000 F CFA
                        - paragraph [ref=e204]: Disponible
                        - paragraph [ref=e205]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=e206]:
                        - button "Retirer un billet VIP" [disabled] [ref=e207]
                        - status [ref=e210]: "0"
                        - button "Ajouter un billet VIP" [ref=e211] [cursor=pointer]
                  - listitem [ref=e214]:
                    - generic [ref=e216]:
                      - generic [ref=e217]:
                        - heading "Standard" [level=3] [ref=e218]
                        - paragraph [ref=e219]: 5 000 F CFA
                        - paragraph [ref=e220]: Disponible
                        - paragraph [ref=e221]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=e222]:
                        - button "Retirer un billet Standard" [ref=e223] [cursor=pointer]
                        - status [ref=e226]: "1"
                        - button "Ajouter un billet Standard" [active] [ref=e227] [cursor=pointer]
                    - paragraph [ref=e230]: "1 × 5 000 F CFA : 5 000 F CFA"
                - generic [ref=e231]:
                  - generic [ref=e232]:
                    - generic [ref=e233]:
                      - term [ref=e234]: Billets
                      - definition [ref=e235]: 5 000 F CFA
                    - generic [ref=e236]:
                      - term [ref=e237]: Frais de service
                      - definition [ref=e238]: 250 F CFA
                  - generic [ref=e239]:
                    - generic [ref=e240]: Total (1 billet)
                    - generic [ref=e241]: 5 250 F CFA
                  - button "Acheter 1 billet (5 250 F CFA)" [ref=e242] [cursor=pointer]
                  - paragraph [ref=e247]: Frais de service inclus dans le total, affiché avant le paiement.
                - generic [ref=e248]:
                  - paragraph [ref=e249]:
                    - generic [ref=e250]: Payer avec
                    - generic [ref=e251]: Wave
                    - generic [ref=e253]: ou
                    - generic [ref=e254]: Orange Money
                  - paragraph [ref=e256]: Billet avec QR code dans Mes billets, dès le paiement
              - region "Achat des billets" [ref=e261]:
                - generic [ref=e262]:
                  - generic [ref=e263]:
                    - paragraph [ref=e264]: 1 × Standard
                    - paragraph [ref=e265]: 5 250 F CFA
                  - button "Acheter (1)" [ref=e266] [cursor=pointer]
    - navigation "Navigation rapide":
      - generic [ref=e268]:
        - link "Accueil" [ref=e270] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e276] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e282] [cursor=pointer]:
          - /url: /tickets
        - link "Avis (nouvelles notifications)" [ref=e287] [cursor=pointer]:
          - /url: /notifications
          - generic [ref=e293]:
            - text: Avis
            - generic [ref=e294]: (nouvelles notifications)
        - link "Portefeuille" [ref=e295] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e301]
```

# Test source

```ts
  457 |         .map((m) => ({ name: m.name, startTime: m.startTime })));
  458 | }
  459 | 
  460 | // ── Écran du contrôleur ────────────────────────────────────────────────────
  461 | 
  462 | function escapeRe(s: string): string {
  463 |     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  464 | }
  465 | 
  466 | /**
  467 |  * Ouvre /controller/scanner sur l'écran « Commencer le contrôle » (ScannerStartScreen, D49, écran committé par
  468 |  * fix(7.2e)) : bouton radio de l'événement (nom accessible = titre, date, lieu), puis « Commencer le contrôle »,
  469 |  * mode caméra (aria-pressed), titre de l'événement dans la barre d'état, flux vidéo en lecture. Les replis du lot 6
  470 |  * (liste déroulante, bouton d'événement) sont retirés : l'écran réel est exigé.
  471 |  */
  472 | export async function openScanner(page: Page, eventTitle: string): Promise<void> {
  473 |     await page.goto('/controller/scanner');
  474 |     await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i }),
  475 |         'scanner : écran « Commencer le contrôle » (D49)').toBeVisible({ timeout: 45_000 });
  476 |     const radio = page.getByRole('radio', { name: new RegExp(escapeRe(eventTitle)) });
  477 |     await expect(radio, `scanner : l'événement « ${eventTitle} » est proposé sur l'écran de départ`).toHaveCount(1, { timeout: 45_000 });
  478 |     await radio.check();
  479 |     await expect(radio, `scanner : événement « ${eventTitle} » choisi`).toBeChecked();
  480 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  481 |     const camera = page.getByRole('button', { name: /^caméra$/i });
  482 |     await expect(camera, 'scanner : bascule « Caméra / Saisie manuelle » affichée après le départ').toBeVisible({ timeout: 30_000 });
  483 |     if ((await camera.getAttribute('aria-pressed')) !== 'true') await camera.click();
  484 |     await expect(camera, 'scanner : mode caméra').toHaveAttribute('aria-pressed', 'true');
  485 |     await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
  486 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  487 |         .catch((err: unknown) => {
  488 |             throw new Error(`scanner : aucun flux vidéo en lecture après le choix de l'événement (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  489 |         });
  490 | }
  491 | 
  492 | /** Payload du QR dynamique courant d'un billet, lu par la route du porteur depuis sa page (cookies de session). */
  493 | export async function livePayload(holderPage: Page, ticketId: string): Promise<string> {
  494 |     const out = await holderPage.evaluate(async (id) => {
  495 |         const res = await fetch(`/api/tickets/${id}/live-code`, { cache: 'no-store' });
  496 |         const text = await res.text();
  497 |         return { status: res.status, text };
  498 |     }, ticketId);
  499 |     if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
  500 |     let payload = '';
  501 |     try {
  502 |         payload = String((JSON.parse(out.text) as { payload?: unknown }).payload ?? '');
  503 |     } catch (err) {
  504 |         throw new Error(`live-code du billet ${ticketId} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${out.text.slice(0, 200)}`);
  505 |     }
  506 |     if (!payload.includes(ticketId)) throw new Error(`live-code du billet ${ticketId} : payload inattendu « ${payload.slice(0, 120)} »`);
  507 |     return payload;
  508 | }
  509 | 
  510 | /** Payload dont le code ne se vérifie pas (même billet, même préfixe) : refus attendu (qr_expired / invalid). */
  511 | export function forgedPayload(payload: string): string {
  512 |     const m = /^(.*:)(\d{6})$/.exec(payload);
  513 |     if (!m) throw new Error(`payload sans code à 6 chiffres : « ${payload.slice(0, 120)} »`);
  514 |     const forged = String((Number(m[2]) + 500_001) % 1_000_000).padStart(6, '0');
  515 |     return `${m[1]}${forged}`;
  516 | }
  517 | 
  518 | // ── Barre d'achat de la fiche d'un événement (lot 8, 8.2 s) ────────────────
  519 | 
  520 | /** Décalage du bas de la barre dans app/events/[id]/page.tsx : `bottom-[calc(4.5rem+…)]`, soit 72 px sans zone sûre. */
  521 | const BUY_BAR_OFFSET_PX = 72;
  522 | const POSITION_TOLERANCE_PX = 2;
  523 | 
  524 | interface BarPosition { scrollY: number; scrollMax: number; top: number; bottom: number; left: number; right: number; innerWidth: number; innerHeight: number; navHeight: number }
  525 | 
  526 | /**
  527 |  * Barre d'achat posée sur l'écran, en haut de page puis à mi-page (panier non vide attendu). Bloc conteneur piégé par
  528 |  * `.ev-page-enter` (PROUVÉ, contrat 11.3) : elle défile avec la page, loin sous l'écran, et n'a pas la largeur de l'écran.
  529 |  * Exigé aux deux positions : largeur pleine ; bas de la barre au-dessus de la barre de navigation, jamais recouvert ; et
  530 |  * au plus 72 px du bas de l'écran. La borne haute est le décalage actuel de la page, pas la hauteur de la navigation
  531 |  * (53 px mesurés) : voir la réponse de l'agent e2e, l'égalité du contrat 15.4 resterait fausse après le correctif 11.3.
  532 |  * Finit à mi-page.
  533 |  */
  534 | export async function expectBuyBarAnchored(page: Page, what: string): Promise<void> {
  535 |     const button = page.getByRole('button', { name: /^acheter \(/i });
  536 |     await expect(button, `${what} : bouton de la barre d'achat, montant calculé`).toBeVisible({ timeout: 20_000 });
  537 |     const bar = page.locator('div.fixed').filter({ has: button });
  538 |     await expect(bar, `${what} : une seule barre d'achat fixe`).toHaveCount(1);
  539 |     const at = (fraction: number): Promise<BarPosition> => bar.evaluate((el, f) => {
  540 |         const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
  541 |         window.scrollTo({ top: Math.round(scrollMax * f), behavior: 'instant' });
  542 |         const r = el.getBoundingClientRect();
  543 |         const nav = document.querySelector('nav[aria-label="Navigation rapide"]');
  544 |         return {
  545 |             scrollY: window.scrollY, scrollMax, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
  546 |             innerWidth: window.innerWidth, innerHeight: window.innerHeight, navHeight: nav ? nav.getBoundingClientRect().height : 0,
  547 |         };
  548 |     }, fraction);
  549 |     for (const [label, fraction] of [['haut de page', 0], ['mi-page', 0.5]] as const) {
  550 |         const p = await at(fraction);
  551 |         const seen = `${what}, ${label} : ${JSON.stringify(p)}`;
  552 |         expect(p.navHeight, `barre de navigation du bas présente — ${seen}`).toBeGreaterThan(0);
  553 |         if (fraction > 0) expect(p.scrollY, `page réellement défilée — ${seen}`).toBeGreaterThan(0);
  554 |         expect(Math.abs(p.left), `gauche de la barre au bord de l'écran — ${seen}`).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  555 |         expect(Math.abs(p.right - p.innerWidth), `droite de la barre au bord de l'écran — ${seen}`).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  556 |         const fromBottom = p.innerHeight - p.bottom;
> 557 |         expect(fromBottom, `bas de la barre au-dessus de la navigation, jamais recouvert — ${seen}`).toBeGreaterThanOrEqual(p.navHeight - POSITION_TOLERANCE_PX);
      |                                                                                                      ^ Error: bas de la barre au-dessus de la navigation, jamais recouvert — fiche de « ce soir », haut de page : {"scrollY":0,"scrollMax":2829,"top":655,"bottom":784,"left":0,"right":390,"innerWidth":390,"innerHeight":844,"navHeight":68}
  558 |         expect(fromBottom, `bas de la barre près du bas de l'écran — ${seen}`).toBeLessThanOrEqual(BUY_BAR_OFFSET_PX + POSITION_TOLERANCE_PX);
  559 |     }
  560 | }
  561 | 
  562 | // ── Statistiques et fichiers de mesure ─────────────────────────────────────
  563 | 
  564 | export function median(values: number[]): number | null {
  565 |     if (values.length === 0) return null;
  566 |     const s = [...values].sort((a, b) => a - b);
  567 |     const mid = Math.floor(s.length / 2);
  568 |     return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  569 | }
  570 | 
  571 | /** Centile par rang (nearest-rank) : p95 de 10 valeurs = la plus grande. */
  572 | export function percentile(values: number[], p: number): number | null {
  573 |     if (values.length === 0) return null;
  574 |     const s = [...values].sort((a, b) => a - b);
  575 |     const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  576 |     return s[rank - 1];
  577 | }
  578 | 
  579 | export function fmtMs(v: number | null): string {
  580 |     return v === null ? '—' : String(Math.round(v));
  581 | }
  582 | 
  583 | /** Écrit un TSV dans .e2e-captures/perf/ (remplace le fichier). */
  584 | export function writePerfFile(name: string, content: string): string {
  585 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  586 |     const file = path.join(PERF_DIR, name);
  587 |     fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  588 |     return file;
  589 | }
  590 | 
  591 | /** Ajoute des lignes à un fichier de .e2e-captures/perf/ ; l'en-tête n'est écrit qu'à la création. */
  592 | export function appendPerfFile(name: string, header: string | null, lines: string[]): string {
  593 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  594 |     const file = path.join(PERF_DIR, name);
  595 |     const prefix = !fs.existsSync(file) && header ? `${header}\n` : '';
  596 |     fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, 'utf8');
  597 |     return file;
  598 | }
  599 | 
```