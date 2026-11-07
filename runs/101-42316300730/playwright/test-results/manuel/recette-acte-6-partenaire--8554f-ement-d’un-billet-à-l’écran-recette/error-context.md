# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran
- Location: e2e/recette.spec.ts:727:5

# Error details

```
Error: export : les billets de l’événement

expect(received).toContain(expected) // indexOf

Expected substring: "Standard"
Received string:    ""
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e11]:
          - generic [ref=f2e12]: EVENT
          - generic [ref=f2e13]: VILLAGE
      - navigation "Navigation principale" [ref=f2e14]:
        - generic [ref=f2e15]: Administration
        - link "Tableau de bord" [ref=f2e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e27]:
          - paragraph [ref=f2e28]: Gestion
          - generic [ref=f2e29]:
            - link "Événements" [ref=f2e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f2e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e47]:
          - paragraph [ref=f2e48]: Finances
          - generic [ref=f2e49]:
            - link "Finance" [ref=f2e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f2e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f2e57]:
          - paragraph [ref=f2e58]: Engagement
          - generic [ref=f2e59]:
            - link "Parrainage" [ref=f2e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f2e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f2e70]:
          - paragraph [ref=f2e71]: Système
          - generic [ref=f2e72]:
            - link "Journal d’audit" [ref=f2e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f2e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f2e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e101]: ES
          - generic [ref=f2e102]:
            - generic [ref=f2e103]: Elhadji SuperAdmin
            - generic [ref=f2e104]: Super administrateur
        - generic [ref=f2e105]:
          - button "Se déconnecter" [ref=f2e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e111] [cursor=pointer]
    - generic [ref=f2e115]:
      - banner [ref=f2e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 35 non lues" [ref=f2e125] [cursor=pointer]:
          - generic [ref=f2e129]: "35"
      - main [ref=f2e130]:
        - generic [ref=f2e132]:
          - generic [ref=f2e133]:
            - link "Retour aux événements" [ref=f2e135] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e140]:
              - generic [ref=f2e141]:
                - generic [ref=f2e142]:
                  - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f2e143]': Validé
                  - generic [ref=f2e146]: Concerts & Musique
                - heading "Recette — Nuit de Ngor 00.13.37" [level=1] [ref=f2e147]
                - paragraph [ref=f2e148]: Recette Productions 00.13.37 · sam. 7 nov. 2026 à 20:15
              - generic [ref=f2e149]:
                - button "Publier" [ref=f2e150] [cursor=pointer]
                - button "Annuler l’événement" [ref=f2e152] [cursor=pointer]
          - generic [ref=f2e154]:
            - generic [ref=f2e155]:
              - region [ref=f2e156]:
                - heading "Dates et lieu" [level=2] [ref=f2e157]
                - generic [ref=f2e158]:
                  - generic [ref=f2e159]:
                    - term [ref=f2e160]: Début
                    - definition [ref=f2e164]: sam. 7 nov. 2026 à 20:15
                  - generic [ref=f2e165]:
                    - term [ref=f2e166]: Fin
                    - definition [ref=f2e171]: dim. 8 nov. 2026 à 00:15
                  - generic [ref=f2e172]:
                    - term [ref=f2e173]: Lieu
                    - definition [ref=f2e178]: Corniche de Ngor, Dakar
                  - generic [ref=f2e179]:
                    - term [ref=f2e180]: Jauge déclarée
                    - definition [ref=f2e187]: 100 personnes
                - generic [ref=f2e188]:
                  - generic [ref=f2e189]:
                    - term [ref=f2e190]: Adresse
                    - definition [ref=f2e191]: 12, route de la Corniche, Ngor
                  - generic [ref=f2e192]:
                    - term [ref=f2e193]: Accès
                    - definition [ref=f2e194]: Entrée principale par la plage de Ngor.
                  - generic [ref=f2e195]:
                    - term [ref=f2e196]: Stationnement
                    - definition [ref=f2e197]: Parking surveillé devant le site.
                  - generic [ref=f2e198]:
                    - term [ref=f2e199]: Règlement
                    - definition [ref=f2e200]: Billet présenté sur téléphone, sans objet en verre.
              - region [ref=f2e201]:
                - heading "Description" [level=2] [ref=f2e202]
                - paragraph [ref=f2e203]: "Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives."
              - region [ref=f2e204]:
                - heading "Programme" [level=2] [ref=f2e205]
                - list [ref=f2e206]:
                  - listitem [ref=f2e207]:
                    - generic [ref=f2e208]: 20:30
                    - generic [ref=f2e209]:
                      - generic [ref=f2e210]:
                        - generic [ref=f2e211]: Grand cercle de recette
                        - generic [ref=f2e212]: Artiste
                      - paragraph [ref=f2e214]: Ensemble des Almadies
              - region [ref=f2e215]:
                - heading "Catégories et prix" [level=2] [ref=f2e216]
                - table [ref=f2e219]:
                  - caption [ref=f2e220]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=f2e221]:
                    - row [ref=f2e222]:
                      - columnheader "Catégorie" [ref=f2e223]
                      - columnheader "Prix" [ref=f2e224]
                      - columnheader "Quota" [ref=f2e225]
                      - columnheader "Période de vente" [ref=f2e226]
                      - columnheader "Par commande" [ref=f2e227]
                      - columnheader "Canaux et état" [ref=f2e228]
                  - rowgroup [ref=f2e229]:
                    - row [ref=f2e230]:
                      - cell "Standard" [ref=f2e231]
                      - cell "6 000 F CFA" [ref=f2e234]
                      - cell "50" [ref=f2e235]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e236]
                      - cell "10 au plus" [ref=f2e238]
                      - cell "En ligne et au guichet Active" [ref=f2e239]:
                        - generic [ref=f2e240]:
                          - generic [ref=f2e241]: En ligne et au guichet
                          - generic [ref=f2e243]: Active
                    - row [ref=f2e245]:
                      - cell "Sur place" [ref=f2e246]
                      - cell "5 000 F CFA" [ref=f2e249]
                      - cell "20" [ref=f2e250]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e251]
                      - cell "10 au plus" [ref=f2e253]
                      - cell "Sur place uniquement Active" [ref=f2e254]:
                        - generic [ref=f2e255]:
                          - generic [ref=f2e256]: Sur place uniquement
                          - generic [ref=f2e258]: Active
                    - row [ref=f2e260]:
                      - cell "Invitations" [ref=f2e261]
                      - cell "Gratuit" [ref=f2e264]
                      - cell "10" [ref=f2e265]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e266]
                      - cell "10 au plus" [ref=f2e268]
                      - cell "Invitations seulement Active" [ref=f2e269]:
                        - generic [ref=f2e270]:
                          - generic [ref=f2e271]: Invitations seulement
                          - generic [ref=f2e273]: Active
                    - row [ref=f2e275]:
                      - cell "Découverte" [ref=f2e276]
                      - cell "Gratuit" [ref=f2e279]
                      - cell "20" [ref=f2e280]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e281]
                      - cell "10 au plus" [ref=f2e283]
                      - cell "En ligne uniquement Active" [ref=f2e284]:
                        - generic [ref=f2e285]:
                          - generic [ref=f2e286]: En ligne uniquement
                          - generic [ref=f2e288]: Active
            - generic [ref=f2e290]:
              - region [ref=f2e291]:
                - heading "Affiche" [level=2] [ref=f2e292]
                - img "Affiche de « Recette — Nuit de Ngor 00.13.37 »" [ref=f2e293]
              - region [ref=f2e294]:
                - heading "Organisateur" [level=2] [ref=f2e295]
                - generic [ref=f2e296]:
                  - generic [ref=f2e297]:
                    - term [ref=f2e298]: Structure
                    - definition [ref=f2e304]:
                      - text: Recette Productions 00.13.37
                      - generic [ref=f2e305]: Compte validé
                  - generic [ref=f2e308]:
                    - term [ref=f2e309]: Responsable
                    - definition [ref=f2e316]: Mame Recette
                  - generic [ref=f2e317]:
                    - term [ref=f2e318]: Téléphone
                    - definition [ref=f2e322]:
                      - link "+221770417793" [ref=f2e323] [cursor=pointer]:
                        - /url: tel:+221770417793
                  - generic [ref=f2e324]:
                    - term [ref=f2e325]: Email
                    - definition [ref=f2e330]:
                      - link "p1.0417793@recette.eventvillage.local" [ref=f2e331] [cursor=pointer]:
                        - /url: mailto:p1.0417793@recette.eventvillage.local
                  - generic [ref=f2e332]:
                    - term [ref=f2e333]: Ville
                    - definition [ref=f2e338]: Dakar
              - region [ref=f2e339]:
                - heading "Historique des statuts" [level=2] [ref=f2e340]
                - list [ref=f2e341]:
                  - listitem [ref=f2e342]:
                    - paragraph [ref=f2e344]: En attente de validation → Validé
                    - paragraph [ref=f2e345]: Elhadji SuperAdmin (Administration) · Changement de statut
                    - paragraph [ref=f2e346]:
                      - time [ref=f2e347]: sam. 7 nov. 2026 à 00:13
                  - listitem [ref=f2e348]:
                    - paragraph [ref=f2e350]: Brouillon → En attente de validation
                    - paragraph [ref=f2e351]: Mame Recette (Organisateur) · Changement de statut
                    - paragraph [ref=f2e352]:
                      - time [ref=f2e353]: sam. 7 nov. 2026 à 00:13
                  - listitem [ref=f2e354]:
                    - paragraph [ref=f2e356]: "Création : Brouillon"
                    - paragraph [ref=f2e357]: Mame Recette (Organisateur) · Création
                    - paragraph [ref=f2e358]:
                      - time [ref=f2e359]: sam. 7 nov. 2026 à 00:13
  - alert [ref=f2e360]
```

# Test source

```ts
  648 |     await test.step('téléphone du client hors ligne : QR accepté', async () => {
  649 |         await sw.context().setOffline(true);
  650 |         byWho.get('C1-hors-ligne')?.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  651 |         const res = await sw.goto(`/billet/hors-ligne?id=${encodeURIComponent(r.tickets.std1)}`);
  652 |         expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  653 |         const qr = sw.locator('[data-ev-qr-payload]');
  654 |         await expect(qr, 'QR du billet affiché hors ligne').toBeVisible({ timeout: 20_000 });
  655 |         const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  656 |         expect(payload, 'payload affiché hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${r.tickets.std1}:\\d{6}$`));
  657 |         await expectScan(page, payload, 'billet présenté hors ligne', 'valid');
  658 |         await sw.context().setOffline(false);
  659 |         expect(await ticketStatus(r.tickets.std1), 'billet hors ligne composté').toBe('UTILISE');
  660 |     });
  661 | 
  662 |     await test.step('ancien code du billet transféré : refusé', async () => {
  663 |         if (!r.oldLot) throw new Error('lot d’avant le transfert absent (acte 4)');
  664 |         await expectScan(page, payloadFromLot(r.oldLot).payload, 'ancien code du billet transféré', 'qr_expired');
  665 |     });
  666 | 
  667 |     await test.step('saisie manuelle du billet transféré, pièce conforme', async () => {
  668 |         // Le transfert renumérote le billet (ticket_transfer_accept) : l'ancien numéro ne vaut plus rien
  669 |         [r.numbers.std2] = await ticketNumbers([r.tickets.std2]);
  670 |         await page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  671 |         await page.getByLabel(/^numéro du billet/i).fill(r.numbers.std2);
  672 |         await page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  673 |         await expect(page.getByRole('heading', { name: new RegExp(`billet ${escapeRe(r.numbers.std2)}`, 'i') })).toBeVisible();
  674 |         await page.getByRole('checkbox', { name: /^pièce d.identité conforme au titulaire/i }).check();
  675 |         await page.getByRole('button', { name: /^pièce conforme, valider l.entrée$/i }).click();
  676 |         await expect(page.locator('[data-scan-result="valid"]').first(), 'saisie manuelle : entrée validée').toBeVisible();
  677 |         await resultClosed(page);
  678 |         expect(await ticketStatus(r.tickets.std2), 'billet saisi à la main composté').toBe('UTILISE');
  679 |         await page.getByRole('button', { name: /^caméra$/i }).click();
  680 |         await videoPlaying(page, 'retour à la caméra');
  681 |     });
  682 | 
  683 |     await test.step('guichet : Sur place avec sa mention, Invitations et Découverte absentes, vente, reçu', async () => {
  684 |         await openTab(page, /^guichet$/i);
  685 |         const list = page.getByRole('list', { name: /^catégories en vente$/i });
  686 |         const onSite = list.getByRole('listitem').filter({ hasText: 'Sur place' });
  687 |         await expect(onSite.getByText('Sur place uniquement', { exact: true }), 'mention de la catégorie vendue au guichet seulement').toBeVisible();
  688 |         await expect(list.getByRole('listitem'), 'guichet : seules les catégories vendues au guichet').toHaveCount(2);
  689 |         await page.getByRole('button', { name: /^ajouter un billet sur place$/i }).click();
  690 |         await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toContainText(/5\s000/);
  691 |         await page.getByLabel(/^numéro de l.acheteur/i).fill(receiptTo);
  692 |         const sold = await expectRoute(page, 'POST', '/api/controller/counter-sale', () => page.getByRole('button', { name: /^j.ai reçu .*valider la vente$/i }).click(), 200, 'vente au guichet');
  693 |         expect(sold.receipt_queued, `reçu SMS mis en file : ${JSON.stringify(sold)}`).toBe(true);
  694 |         await expect(page.getByText(/reçu sms envoyé à l.acheteur/i), 'vente et reçu annoncés').toBeVisible();
  695 |     });
  696 | 
  697 |     await test.step('reprise de session : sortie puis retour, même événement, « Reprendre le contrôle »', async () => {
  698 |         await openTab(page, /^contrôle$/i);
  699 |         await videoPlaying(page, 'retour au contrôle après le guichet');
  700 |         await page.goto('/controller/profile');
  701 |         await expect(page.getByRole('heading', { level: 1 }).first(), 'page du profil du contrôleur ouverte').toBeVisible({ timeout: 30_000 });
  702 |         await page.goBack();
  703 |         await expectResumed(page, r.e1.title, 'camera', 'retour depuis le profil');
  704 |         await page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }).click();
  705 |         await videoPlaying(page, '« Reprendre le contrôle »');
  706 |     });
  707 | 
  708 |     await test.step('clôture de caisse sans écart, Z de caisse', async () => {
  709 |         await openTab(page, /^caisse$/i);
  710 |         await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  711 |         const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  712 |         await expect(dialog).toBeVisible();
  713 |         await dialog.getByLabel(/^espèces encaissées comptées/i).fill('5000');
  714 |         await expectRoute(page, 'POST', '/api/controller/shifts/close', () => dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click(), 200, 'clôture sans écart');
  715 |         const z = page.getByRole('dialog', { name: /^caisse clôturée$/i });
  716 |         await expect(z).toBeVisible();
  717 |         await z.getByRole('button', { name: /^terminé$/i }).click();
  718 |     });
  719 | 
  720 |     await test.step('invariants (a) à (t), puis reçu du guichet arrivé au faux MTarget', async () => {
  721 |         await assertInvariants('recette-controleur');
  722 |         const receipts = await fakeSmsTo(`+221${receiptTo}`);
  723 |         expect(receipts.length, 'reçu de la vente au guichet envoyé par la boîte d’envoi').toBe(1);
  724 |     });
  725 | });
  726 | 
  727 | test('acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran', async () => {
  728 |     const partner = known('P1');
  729 | 
  730 |     await test.step('pilotage : vendus, entrées, espèces, caisse clôturée', async () => {
  731 |         await partner.goto(`/partner/events/${r.e1.id}`);
  732 |         await openTab(partner, /^aperçu/i);
  733 |         const panel = partner.getByRole('tabpanel');
  734 |         // 2 Standard de C1, 2 du second client, 1 gratuit, 1 au guichet ; entrées : gratuit, hors ligne, saisie manuelle, guichet
  735 |         await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)6(\D|$)/);
  736 |         await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)4(\D|$)/);
  737 |         await openTab(partner, /^caisse/i);
  738 |         await expect(kpi(partner.getByRole('tabpanel'), /^espèces encaissées/i)).toContainText(/5\s000/);
  739 |         await expect(kpi(partner.getByRole('tabpanel'), /^caisses clôturées/i)).toContainText(/(^|\D)1(\D|$)/);
  740 |     });
  741 | 
  742 |     await test.step('export des participants, journalisé', async () => {
  743 |         await openTab(partner, /^clôture/i);
  744 |         const exported = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e1.id}/participants-export`);
  745 |         await partner.getByRole('button', { name: /^exporter les participants$/i }).click();
  746 |         const res = await exported;
  747 |         expect(res.status(), 'export des participants').toBe(200);
> 748 |         expect(await res.text(), 'export : les billets de l’événement').toContain('Standard');
      |                                                                         ^ Error: export : les billets de l’événement
  749 |         const { data, error } = await serviceClient().from('participant_exports').select('event_id').eq('id', String(res.headers()['x-export-id'])).maybeSingle();
  750 |         if (error) throw new Error(`[e2e] journal des exports : ${error.message}`);
  751 |         expect(data?.event_id, 'export écrit au journal').toBe(r.e1.id);
  752 |     });
  753 | 
  754 |     await test.step('rapport de clôture du tableau de bord : libellés, PDF', async () => {
  755 |         await partner.goto('/partner/dashboard');
  756 |         await partner.locator('tr').filter({ hasText: r.e1.title }).getByRole('button', { name: /^clôture$/i }).click();
  757 |         const dialog = partner.getByRole('dialog', { name: /^rapport de clôture$/i });
  758 |         await expect(dialog).toBeVisible();
  759 |         await expect(dialog.getByText(/^généré le/i)).toBeVisible();
  760 |         await expect(dialog.getByText('Entrées validées', { exact: true })).toBeVisible();
  761 |         await expectRoute(partner, 'GET', '/api/partner/reports/closing/pdf', () => dialog.getByRole('button', { name: /^télécharger le pdf$/i }).click(), 200, 'rapport PDF');
  762 |         await dialog.getByRole('button', { name: /^fermer$/i }).click();
  763 |         await expect(dialog).toBeHidden();
  764 |     });
  765 | 
  766 |     await test.step('/partner/finance : code SMS, retrait de 6 000 F, frais de 60 F, envoi au faux SamirPay', async () => {
  767 |         await partner.goto('/partner/finance');
  768 |         const wave = partner.getByRole('radio', { name: /^wave/i });
  769 |         await wave.dispatchEvent('click');
  770 |         await expect(wave).toBeChecked();
  771 |         await partner.getByLabel(/qui reçoit le retrait/i).fill(r.p1.local);
  772 |         await partner.getByLabel(/^montant à retirer/i).fill('6000');
  773 |         const seen = await smsSeen(r.p1.phone);
  774 |         await expectRoute(partner, 'POST', '/api/withdrawals/otp', () => partner.getByRole('button', { name: /^recevoir le code de confirmation$/i }).click(), 200, 'code de confirmation du retrait');
  775 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'code du retrait'));
  776 |         await expectRoute(partner, 'POST', '/api/withdrawals/request', () => partner.getByRole('button', { name: /^confirmer le retrait$/i }).click(), 200, 'demande de retrait');
  777 |         await expect(partner.getByText('Retrait versé', { exact: true })).toBeVisible();
  778 |         const summary = partner.locator('dl').filter({ hasText: 'Montant versé' });
  779 |         await expect(summary, 'frais de retrait').toContainText(/60\sF/);
  780 |         await expect(summary, 'montant versé').toContainText(/5\s940/);
  781 |         const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/samirpay/transactions`);
  782 |         const { transactions } = (await res.json()) as { transactions: Array<{ kind: string; amount: number; status: string }> };
  783 |         expect(transactions.filter((t) => t.kind === 'CASHOUT' && t.amount === 5940 && t.status === 'SUCCESS').length, 'envoi de 5 940 F au faux SamirPay').toBeGreaterThan(0);
  784 |     });
  785 | 
  786 |     await test.step('A4 : remboursement d’un billet à l’écran, double confirmation', async () => {
  787 |         await refundOnScreen(partner, r.numbers.refundShown, `Recette ${STAMP} : client empêché`, /^remboursement versé$/i);
  788 |         await expect.poll(() => ticketStatus(r.tickets.refundShown), { message: 'billet remboursé', timeout: 15_000 }).toBe('REMBOURSE');
  789 |     });
  790 | 
  791 |     await test.step('invariants (a) à (t)', async () => {
  792 |         await assertInvariants('recette-partenaire');
  793 |     });
  794 | });
  795 | 
  796 | test('acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public', async ({ browser }, testInfo) => {
  797 |     const partner = known('P1');
  798 |     const client = known('C1');
  799 | 
  800 |     await test.step('annulation par P1 dans la modale', async () => {
  801 |         await partner.goto(`/partner/events/${r.e2.id}`);
  802 |         await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  803 |         const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  804 |         await expect(dialog).toBeVisible();
  805 |         await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  806 |         await dialog.getByLabel(/^avis public aux participants/i).fill(NOTICE_E2);
  807 |         await dialog.getByLabel(/^motif interne/i).fill('Recette de la billetterie, lot 8.');
  808 |         await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(r.e2.title);
  809 |         const cancelled = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e2.id}/cancel` && res.request().method() === 'POST', { timeout: 60_000 });
  810 |         await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  811 |         const res = await cancelled;
  812 |         expect(res.status(), `annulation de E2 : ${(await res.text()).slice(0, 300)}`).toBe(200);
  813 |         await expect(dialog).toBeHidden();
  814 |     });
  815 | 
  816 |     await test.step('vraie route de l’envoyeur : avis d’annulation et de remboursement partis', async () => {
  817 |         await expect.poll(() => ticketStatus(r.tickets.e2), { message: 'billet de E2 remboursé par l’annulation', timeout: 30_000 }).toBe('REMBOURSE');
  818 |         await drainOutbox('après l’annulation de E2');
  819 |         const lines = (await outboxOfEvent(r.e2.id, ['EVENT_CANCELLED', 'REFUND_PAID'])).filter((l) => l.channel === 'SMS' && (l.recipient_user_id === r.c1.userId || l.recipient_phone === r.c1.phone));
  820 |         expect(lines.map((l) => `${l.type} ${l.status}`).sort(), `avis du client : ${JSON.stringify(lines.map((l) => ({ type: l.type, status: l.status, reason: l.reason })))}`)
  821 |             .toEqual(['EVENT_CANCELLED SENT', 'REFUND_PAID SENT']);
  822 |     });
  823 | 
  824 |     await test.step('Mes billets : billet Remboursé', async () => {
  825 |         await client.goto('/tickets?tab=tous');
  826 |         const card = client.locator('li, article').filter({ hasText: r.e2.title }).last();
  827 |         await expect(card, 'billet de E2 dans Mes billets').toBeVisible({ timeout: 30_000 });
  828 |         await expect(card, 'statut affiché').toContainText(/remboursé/i);
  829 |     });
  830 | 
  831 |     await test.step('page publique de E2 : bandeau et avis de l’organisateur', async () => {
  832 |         const visitor = await asNew(browser, testInfo, 'visiteur');
  833 |         const res = await visitor.goto(`/events/${r.e2.id}`);
  834 |         expect(res?.status(), 'page d’un événement annulé').toBe(200);
  835 |         await expect(visitor.getByText(NOTICE_E2), 'avis public').toBeVisible();
  836 |         await expect(visitor.getByRole('button', { name: /ajouter un billet/i }), 'plus aucune vente').toHaveCount(0);
  837 |     });
  838 | });
  839 | 
  840 | test('acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus', async ({ browser }, testInfo) => {
  841 |     const partner = known('P1');
  842 |     const superadmin = await asRole(browser, testInfo, 'fumee-superadmin');
  843 |     const admin = await asRole(browser, testInfo, 'admin');
  844 |     const { failedId } = readDemoIds().notifications;
  845 | 
  846 |     await test.step('supervision /admin/notifications, ligne en échec, relance', async () => {
  847 |         await admin.goto('/admin/notifications?status=FAILED');
  848 |         await expect(admin.getByRole('link', { name: /^voir le détail/i }).first(), 'ligne en échec dans la liste').toBeVisible();
```