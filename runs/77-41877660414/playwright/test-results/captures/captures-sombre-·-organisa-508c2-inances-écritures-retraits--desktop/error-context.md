# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-finances — Partenaire — finances (écritures, retraits)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de partenaire-finances__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "valeur technique affichée : EVENT_CANCELLATION_REFUND (×9) — ex. texte : « Remboursement REFUND-05bbecb7-5bd8-4747-9cdf-6bd9920f0fa4 (EVENT_CANCELLATION_RE » ; texte : « Remboursement REFUND-db7d31b9-3a45-4d22-aa18-8c92cc561f25 (EVENT_CANCELLATION_RE » ; texte : « Remboursement REFUND-d9d9af90-f7c7-48d5-b328-a8ae269a4358 (EVENT_CANCELLATION_RE »",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e88] [cursor=pointer]
    - generic [ref=e96]:
      - banner [ref=e97]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e99] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 97 non lues" [ref=e106] [cursor=pointer]:
          - generic [ref=e110]: "97"
      - main [ref=e111]:
        - generic [ref=e113]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - heading "Finances" [level=1] [ref=e117]
              - paragraph [ref=e118]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=e119]:
              - link "Statistiques de ventes" [ref=e120] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=e125] [cursor=pointer]
          - region [ref=e133]:
            - heading "Soldes" [level=2] [ref=e134]
            - generic [ref=e135]:
              - paragraph [ref=e136]: Disponible au retrait
              - paragraph [ref=e137]: 0 F CFA
              - paragraph [ref=e138]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=e139]:
              - generic [ref=e140]:
                - paragraph [ref=e142]: En attente
                - paragraph [ref=e147]: 828 000 F CFA
                - paragraph [ref=e148]: "Prochaine disponibilité : ven. 6 nov. 2026 à 23:30."
              - generic [ref=e149]:
                - paragraph [ref=e151]: Retraits en cours
                - paragraph [ref=e156]: 0 F CFA
                - paragraph [ref=e157]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e158]:
                - paragraph [ref=e160]: Créance
                - paragraph [ref=e165]: 0 F CFA
                - paragraph [ref=e166]: Aucune somme à compenser.
          - region [ref=e167]:
            - generic [ref=e168]:
              - heading "Demander un retrait" [level=2] [ref=e169]
              - paragraph [ref=e173]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e174]:
              - listitem [ref=e175]:
                - generic [aria-hidden] [ref=e176]: "1"
                - generic [ref=e177]: Demande
              - listitem [ref=e179]:
                - generic [aria-hidden] [ref=e180]: "2"
                - generic [ref=e181]: Code SMS
              - listitem [ref=e183]:
                - generic [aria-hidden] [ref=e184]: "3"
                - generic [ref=e185]: Suivi
            - generic [ref=e186]:
              - group "Recevoir sur" [ref=e187]:
                - generic [ref=e188]: Recevoir sur *
                - generic [ref=e189]:
                  - generic [ref=e190] [cursor=pointer]:
                    - radio "Wave" [ref=e191]
                    - generic [ref=e192]:
                      - generic [aria-hidden] [ref=e193]: W
                      - generic [ref=e194]: Wave
                  - generic [ref=e195] [cursor=pointer]:
                    - radio "Orange Money" [ref=e196]
                    - generic [ref=e197]:
                      - generic [aria-hidden] [ref=e198]: OM
                      - generic [ref=e199]: Orange Money
              - generic [ref=e200]:
                - generic [ref=e202]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=e203]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=e204]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=e205]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e206]:
                - generic [ref=e208]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=e209]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=e210]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=e211]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e212]
          - region [ref=e218]:
            - generic [ref=e219]:
              - heading "Mes retraits" [level=2] [ref=e220]
              - paragraph [ref=e221]: Vos 20 dernières demandes.
            - generic [ref=e222]:
              - heading "Aucun retrait" [level=3] [ref=e227]
              - paragraph [ref=e228]: Vous n’avez pas encore demandé de retrait.
          - region [ref=e229]:
            - generic [ref=e230]:
              - heading "Historique du compte" [level=2] [ref=e231]
              - paragraph [ref=e232]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=e233]:
              - listitem [ref=e234]:
                - generic [ref=e240]:
                  - paragraph [ref=e241]:
                    - text: Remboursement d’un billet
                    - generic [ref=e242]: (débit)
                  - paragraph [ref=e243]: Remboursement REFUND-05bbecb7-5bd8-4747-9cdf-6bd9920f0fa4 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e244]:
                    - time [ref=e245]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e246]: − 15 000 F CFA
              - listitem [ref=e247]:
                - generic [ref=e253]:
                  - paragraph [ref=e254]:
                    - text: Remboursement d’un billet
                    - generic [ref=e255]: (débit)
                  - paragraph [ref=e256]: Remboursement REFUND-db7d31b9-3a45-4d22-aa18-8c92cc561f25 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e257]:
                    - time [ref=e258]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e259]: − 9 000 F CFA
              - listitem [ref=e260]:
                - generic [ref=e266]:
                  - paragraph [ref=e267]:
                    - text: Remboursement d’un billet
                    - generic [ref=e268]: (débit)
                  - paragraph [ref=e269]: Remboursement REFUND-d9d9af90-f7c7-48d5-b328-a8ae269a4358 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e270]:
                    - time [ref=e271]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e272]: − 30 000 F CFA
              - listitem [ref=e273]:
                - generic [ref=e279]:
                  - paragraph [ref=e280]:
                    - text: Remboursement d’un billet
                    - generic [ref=e281]: (débit)
                  - paragraph [ref=e282]: Remboursement REFUND-b070bf40-493c-4f16-8b61-cf04f0389bd5 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e283]:
                    - time [ref=e284]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e285]: − 15 000 F CFA
              - listitem [ref=e286]:
                - generic [ref=e292]:
                  - paragraph [ref=e293]:
                    - text: Remboursement d’un billet
                    - generic [ref=e294]: (débit)
                  - paragraph [ref=e295]: Remboursement REFUND-ac7a0774-a60b-4d4f-8174-f9189313dec7 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e296]:
                    - time [ref=e297]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e298]: − 15 000 F CFA
              - listitem [ref=e299]:
                - generic [ref=e305]:
                  - paragraph [ref=e306]:
                    - text: Remboursement d’un billet
                    - generic [ref=e307]: (débit)
                  - paragraph [ref=e308]: Remboursement REFUND-827af424-4e78-4e18-894e-6ba73d48c763 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e309]:
                    - time [ref=e310]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e311]: − 30 000 F CFA
              - listitem [ref=e312]:
                - generic [ref=e318]:
                  - paragraph [ref=e319]:
                    - text: Remboursement d’un billet
                    - generic [ref=e320]: (débit)
                  - paragraph [ref=e321]: Remboursement REFUND-1cad3c39-d95c-483e-8645-286279c48f77 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e322]:
                    - time [ref=e323]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e324]: − 9 000 F CFA
              - listitem [ref=e325]:
                - generic [ref=e331]:
                  - paragraph [ref=e332]:
                    - text: Remboursement d’un billet
                    - generic [ref=e333]: (débit)
                  - paragraph [ref=e334]: Remboursement REFUND-09ceee00-009b-40cb-9363-777b7d821ca0 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e335]:
                    - time [ref=e336]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e337]: − 18 000 F CFA
              - listitem [ref=e338]:
                - generic [ref=e344]:
                  - paragraph [ref=e345]:
                    - text: Remboursement d’un billet
                    - generic [ref=e346]: (débit)
                  - paragraph [ref=e347]: Remboursement REFUND-08189d95-0f9b-40d9-9a65-0faf1035740d (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e348]:
                    - time [ref=e349]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e350]: − 9 000 F CFA
              - listitem [ref=e351]:
                - generic [ref=e357]:
                  - paragraph [ref=e358]:
                    - text: Vente en ligne
                    - generic [ref=e359]: (crédit)
                  - paragraph [ref=e360]: Vente en ligne TX-EV-1793814291005-489D9030 (TICKET)
                  - paragraph [ref=e361]:
                    - time [ref=e362]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e363]:
                      - text: · en attente, disponible le
                      - time [ref=e364]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e365]: + 6 000 F CFA
              - listitem [ref=e366]:
                - generic [ref=e372]:
                  - paragraph [ref=e373]:
                    - text: Vente en ligne
                    - generic [ref=e374]: (crédit)
                  - paragraph [ref=e375]: Vente en ligne TX-EV-1793814290978-D519605D (TICKET)
                  - paragraph [ref=e376]:
                    - time [ref=e377]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e378]:
                      - text: · en attente, disponible le
                      - time [ref=e379]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e380]: + 15 000 F CFA
              - listitem [ref=e381]:
                - generic [ref=e387]:
                  - paragraph [ref=e388]:
                    - text: Vente en ligne
                    - generic [ref=e389]: (crédit)
                  - paragraph [ref=e390]: Vente en ligne TX-EV-1793814290951-F6EABE43 (TICKET)
                  - paragraph [ref=e391]:
                    - time [ref=e392]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e393]:
                      - text: · en attente, disponible le
                      - time [ref=e394]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e395]: + 15 000 F CFA
              - listitem [ref=e396]:
                - generic [ref=e402]:
                  - paragraph [ref=e403]:
                    - text: Vente en ligne
                    - generic [ref=e404]: (crédit)
                  - paragraph [ref=e405]: Vente en ligne TX-EV-1793814290924-57A7A018 (TICKET)
                  - paragraph [ref=e406]:
                    - time [ref=e407]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e408]:
                      - text: · en attente, disponible le
                      - time [ref=e409]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e410]: + 7 500 F CFA
              - listitem [ref=e411]:
                - generic [ref=e417]:
                  - paragraph [ref=e418]:
                    - text: Vente en ligne
                    - generic [ref=e419]: (crédit)
                  - paragraph [ref=e420]: Vente en ligne TX-EV-1793814290897-B0879379 (TICKET)
                  - paragraph [ref=e421]:
                    - time [ref=e422]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e423]:
                      - text: · en attente, disponible le
                      - time [ref=e424]: ven. 6 nov. 2026 à 23:30
                - generic [ref=e425]: + 10 000 F CFA
              - listitem [ref=e426]:
                - generic [ref=e432]:
                  - paragraph [ref=e433]:
                    - text: Vente en ligne
                    - generic [ref=e434]: (crédit)
                  - paragraph [ref=e435]: Vente en ligne TX-EV-1793814290659-D88A7607 (TICKET)
                  - paragraph [ref=e436]:
                    - time [ref=e437]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e438]:
                      - text: · en attente, disponible le
                      - time [ref=e439]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e440]: + 30 000 F CFA
              - listitem [ref=e441]:
                - generic [ref=e447]:
                  - paragraph [ref=e448]:
                    - text: Vente en ligne
                    - generic [ref=e449]: (crédit)
                  - paragraph [ref=e450]: Vente en ligne TX-EV-1793814290632-8931C240 (TICKET)
                  - paragraph [ref=e451]:
                    - time [ref=e452]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e453]:
                      - text: · en attente, disponible le
                      - time [ref=e454]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e455]: + 15 000 F CFA
              - listitem [ref=e456]:
                - generic [ref=e462]:
                  - paragraph [ref=e463]:
                    - text: Vente en ligne
                    - generic [ref=e464]: (crédit)
                  - paragraph [ref=e465]: Vente en ligne TX-EV-1793814290603-729E48C1 (TICKET)
                  - paragraph [ref=e466]:
                    - time [ref=e467]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e468]:
                      - text: · en attente, disponible le
                      - time [ref=e469]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e470]: + 15 000 F CFA
              - listitem [ref=e471]:
                - generic [ref=e477]:
                  - paragraph [ref=e478]:
                    - text: Vente en ligne
                    - generic [ref=e479]: (crédit)
                  - paragraph [ref=e480]: Vente en ligne TX-EV-1793814290576-9114400F (TICKET)
                  - paragraph [ref=e481]:
                    - time [ref=e482]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e483]:
                      - text: · en attente, disponible le
                      - time [ref=e484]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e485]: + 30 000 F CFA
              - listitem [ref=e486]:
                - generic [ref=e492]:
                  - paragraph [ref=e493]:
                    - text: Vente en ligne
                    - generic [ref=e494]: (crédit)
                  - paragraph [ref=e495]: Vente en ligne TX-EV-1793814290550-2E4EC1B8 (TICKET)
                  - paragraph [ref=e496]:
                    - time [ref=e497]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e498]:
                      - text: · en attente, disponible le
                      - time [ref=e499]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e500]: + 15 000 F CFA
              - listitem [ref=e501]:
                - generic [ref=e507]:
                  - paragraph [ref=e508]:
                    - text: Vente en ligne
                    - generic [ref=e509]: (crédit)
                  - paragraph [ref=e510]: Vente en ligne TX-EV-1793814290522-904D4C56 (TICKET)
                  - paragraph [ref=e511]:
                    - time [ref=e512]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e513]:
                      - text: · en attente, disponible le
                      - time [ref=e514]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e515]: + 30 000 F CFA
              - listitem [ref=e516]:
                - generic [ref=e522]:
                  - paragraph [ref=e523]:
                    - text: Vente en ligne
                    - generic [ref=e524]: (crédit)
                  - paragraph [ref=e525]: Vente en ligne TX-EV-1793814290495-957648AD (TICKET)
                  - paragraph [ref=e526]:
                    - time [ref=e527]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e528]:
                      - text: · en attente, disponible le
                      - time [ref=e529]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e530]: + 9 000 F CFA
              - listitem [ref=e531]:
                - generic [ref=e537]:
                  - paragraph [ref=e538]:
                    - text: Vente en ligne
                    - generic [ref=e539]: (crédit)
                  - paragraph [ref=e540]: Vente en ligne TX-EV-1793814290468-8A5041C5 (TICKET)
                  - paragraph [ref=e541]:
                    - time [ref=e542]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e543]:
                      - text: · en attente, disponible le
                      - time [ref=e544]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e545]: + 9 000 F CFA
              - listitem [ref=e546]:
                - generic [ref=e552]:
                  - paragraph [ref=e553]:
                    - text: Vente en ligne
                    - generic [ref=e554]: (crédit)
                  - paragraph [ref=e555]: Vente en ligne TX-EV-1793814290442-A6548739 (TICKET)
                  - paragraph [ref=e556]:
                    - time [ref=e557]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e558]:
                      - text: · en attente, disponible le
                      - time [ref=e559]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e560]: + 18 000 F CFA
              - listitem [ref=e561]:
                - generic [ref=e567]:
                  - paragraph [ref=e568]:
                    - text: Vente en ligne
                    - generic [ref=e569]: (crédit)
                  - paragraph [ref=e570]: Vente en ligne TX-EV-1793814290415-AEEC0C2E (TICKET)
                  - paragraph [ref=e571]:
                    - time [ref=e572]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e573]:
                      - text: · en attente, disponible le
                      - time [ref=e574]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e575]: + 9 000 F CFA
              - listitem [ref=e576]:
                - generic [ref=e582]:
                  - paragraph [ref=e583]:
                    - text: Vente en ligne
                    - generic [ref=e584]: (crédit)
                  - paragraph [ref=e585]: Vente en ligne TX-EV-1793814290388-C66446F5 (TICKET)
                  - paragraph [ref=e586]:
                    - time [ref=e587]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e588]:
                      - text: · en attente, disponible le
                      - time [ref=e589]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e590]: + 30 000 F CFA
              - listitem [ref=e591]:
                - generic [ref=e597]:
                  - paragraph [ref=e598]:
                    - text: Vente en ligne
                    - generic [ref=e599]: (crédit)
                  - paragraph [ref=e600]: Vente en ligne TX-EV-1793814290359-6B8DB40D (TICKET)
                  - paragraph [ref=e601]:
                    - time [ref=e602]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e603]:
                      - text: · en attente, disponible le
                      - time [ref=e604]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e605]: + 15 000 F CFA
              - listitem [ref=e606]:
                - generic [ref=e612]:
                  - paragraph [ref=e613]:
                    - text: Vente en ligne
                    - generic [ref=e614]: (crédit)
                  - paragraph [ref=e615]: Vente en ligne TX-EV-1793814290329-43096541 (TICKET)
                  - paragraph [ref=e616]:
                    - time [ref=e617]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e618]:
                      - text: · en attente, disponible le
                      - time [ref=e619]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e620]: + 15 000 F CFA
              - listitem [ref=e621]:
                - generic [ref=e627]:
                  - paragraph [ref=e628]:
                    - text: Vente en ligne
                    - generic [ref=e629]: (crédit)
                  - paragraph [ref=e630]: Vente en ligne TX-EV-1793814290301-9FA5031C (TICKET)
                  - paragraph [ref=e631]:
                    - time [ref=e632]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e633]:
                      - text: · en attente, disponible le
                      - time [ref=e634]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e635]: + 30 000 F CFA
              - listitem [ref=e636]:
                - generic [ref=e642]:
                  - paragraph [ref=e643]:
                    - text: Vente en ligne
                    - generic [ref=e644]: (crédit)
                  - paragraph [ref=e645]: Vente en ligne TX-EV-1793814290077-97910F88 (TICKET)
                  - paragraph [ref=e646]:
                    - time [ref=e647]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e648]:
                      - text: · en attente, disponible le
                      - time [ref=e649]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e650]: + 12 000 F CFA
              - listitem [ref=e651]:
                - generic [ref=e657]:
                  - paragraph [ref=e658]:
                    - text: Vente en ligne
                    - generic [ref=e659]: (crédit)
                  - paragraph [ref=e660]: Vente en ligne TX-EV-1793814290051-83B0666F (TICKET)
                  - paragraph [ref=e661]:
                    - time [ref=e662]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e663]:
                      - text: · en attente, disponible le
                      - time [ref=e664]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e665]: + 12 000 F CFA
              - listitem [ref=e666]:
                - generic [ref=e672]:
                  - paragraph [ref=e673]:
                    - text: Vente en ligne
                    - generic [ref=e674]: (crédit)
                  - paragraph [ref=e675]: Vente en ligne TX-EV-1793814290024-6A6C6EE5 (TICKET)
                  - paragraph [ref=e676]:
                    - time [ref=e677]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e678]:
                      - text: · en attente, disponible le
                      - time [ref=e679]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e680]: + 6 000 F CFA
              - listitem [ref=e681]:
                - generic [ref=e687]:
                  - paragraph [ref=e688]:
                    - text: Vente en ligne
                    - generic [ref=e689]: (crédit)
                  - paragraph [ref=e690]: Vente en ligne TX-EV-1793814289997-BD60FF77 (TICKET)
                  - paragraph [ref=e691]:
                    - time [ref=e692]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e693]:
                      - text: · en attente, disponible le
                      - time [ref=e694]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e695]: + 12 000 F CFA
              - listitem [ref=e696]:
                - generic [ref=e702]:
                  - paragraph [ref=e703]:
                    - text: Vente en ligne
                    - generic [ref=e704]: (crédit)
                  - paragraph [ref=e705]: Vente en ligne TX-EV-1793814289119-7D3793EC (TICKET)
                  - paragraph [ref=e706]:
                    - time [ref=e707]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e708]:
                      - text: · en attente, disponible le
                      - time [ref=e709]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e710]: + 12 000 F CFA
              - listitem [ref=e711]:
                - generic [ref=e717]:
                  - paragraph [ref=e718]:
                    - text: Vente en ligne
                    - generic [ref=e719]: (crédit)
                  - paragraph [ref=e720]: Vente en ligne TX-EV-1793814289091-0DAFEEA9 (TICKET)
                  - paragraph [ref=e721]:
                    - time [ref=e722]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e723]:
                      - text: · en attente, disponible le
                      - time [ref=e724]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e725]: + 24 000 F CFA
              - listitem [ref=e726]:
                - generic [ref=e732]:
                  - paragraph [ref=e733]:
                    - text: Vente en ligne
                    - generic [ref=e734]: (crédit)
                  - paragraph [ref=e735]: Vente en ligne TX-EV-1793814289059-9BEAEEB5 (TICKET)
                  - paragraph [ref=e736]:
                    - time [ref=e737]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e738]:
                      - text: · en attente, disponible le
                      - time [ref=e739]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e740]: + 12 000 F CFA
              - listitem [ref=e741]:
                - generic [ref=e747]:
                  - paragraph [ref=e748]:
                    - text: Vente en ligne
                    - generic [ref=e749]: (crédit)
                  - paragraph [ref=e750]: Vente en ligne TX-EV-1793814289030-E5924171 (TICKET)
                  - paragraph [ref=e751]:
                    - time [ref=e752]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e753]:
                      - text: · en attente, disponible le
                      - time [ref=e754]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e755]: + 12 000 F CFA
              - listitem [ref=e756]:
                - generic [ref=e762]:
                  - paragraph [ref=e763]:
                    - text: Vente en ligne
                    - generic [ref=e764]: (crédit)
                  - paragraph [ref=e765]: Vente en ligne TX-EV-1793814289002-4142B4FC (TICKET)
                  - paragraph [ref=e766]:
                    - time [ref=e767]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e768]:
                      - text: · en attente, disponible le
                      - time [ref=e769]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e770]: + 24 000 F CFA
              - listitem [ref=e771]:
                - generic [ref=e777]:
                  - paragraph [ref=e778]:
                    - text: Vente en ligne
                    - generic [ref=e779]: (crédit)
                  - paragraph [ref=e780]: Vente en ligne TX-EV-1793814288975-F49841F0 (TICKET)
                  - paragraph [ref=e781]:
                    - time [ref=e782]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e783]:
                      - text: · en attente, disponible le
                      - time [ref=e784]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e785]: + 12 000 F CFA
              - listitem [ref=e786]:
                - generic [ref=e792]:
                  - paragraph [ref=e793]:
                    - text: Vente en ligne
                    - generic [ref=e794]: (crédit)
                  - paragraph [ref=e795]: Vente en ligne TX-EV-1793814288947-A6DD67C3 (TICKET)
                  - paragraph [ref=e796]:
                    - time [ref=e797]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e798]:
                      - text: · en attente, disponible le
                      - time [ref=e799]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e800]: + 7 500 F CFA
              - listitem [ref=e801]:
                - generic [ref=e807]:
                  - paragraph [ref=e808]:
                    - text: Vente en ligne
                    - generic [ref=e809]: (crédit)
                  - paragraph [ref=e810]: Vente en ligne TX-EV-1793814288913-C0833707 (TICKET)
                  - paragraph [ref=e811]:
                    - time [ref=e812]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e813]:
                      - text: · en attente, disponible le
                      - time [ref=e814]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e815]: + 15 000 F CFA
              - listitem [ref=e816]:
                - generic [ref=e822]:
                  - paragraph [ref=e823]:
                    - text: Vente en ligne
                    - generic [ref=e824]: (crédit)
                  - paragraph [ref=e825]: Vente en ligne TX-EV-1793814288882-D4FFE400 (TICKET)
                  - paragraph [ref=e826]:
                    - time [ref=e827]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e828]:
                      - text: · en attente, disponible le
                      - time [ref=e829]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e830]: + 7 500 F CFA
              - listitem [ref=e831]:
                - generic [ref=e837]:
                  - paragraph [ref=e838]:
                    - text: Vente en ligne
                    - generic [ref=e839]: (crédit)
                  - paragraph [ref=e840]: Vente en ligne TX-EV-1793814288855-1A5C99B3 (TICKET)
                  - paragraph [ref=e841]:
                    - time [ref=e842]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e843]:
                      - text: · en attente, disponible le
                      - time [ref=e844]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e845]: + 22 500 F CFA
              - listitem [ref=e846]:
                - generic [ref=e852]:
                  - paragraph [ref=e853]:
                    - text: Vente en ligne
                    - generic [ref=e854]: (crédit)
                  - paragraph [ref=e855]: Vente en ligne TX-EV-1793814288828-58514D48 (TICKET)
                  - paragraph [ref=e856]:
                    - time [ref=e857]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e858]:
                      - text: · en attente, disponible le
                      - time [ref=e859]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e860]: + 15 000 F CFA
              - listitem [ref=e861]:
                - generic [ref=e867]:
                  - paragraph [ref=e868]:
                    - text: Vente en ligne
                    - generic [ref=e869]: (crédit)
                  - paragraph [ref=e870]: Vente en ligne TX-EV-1793814288801-2CCC2A98 (TICKET)
                  - paragraph [ref=e871]:
                    - time [ref=e872]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e873]:
                      - text: · en attente, disponible le
                      - time [ref=e874]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e875]: + 7 500 F CFA
              - listitem [ref=e876]:
                - generic [ref=e882]:
                  - paragraph [ref=e883]:
                    - text: Vente en ligne
                    - generic [ref=e884]: (crédit)
                  - paragraph [ref=e885]: Vente en ligne TX-EV-1793814288771-FDD6BE93 (TICKET)
                  - paragraph [ref=e886]:
                    - time [ref=e887]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e888]:
                      - text: · en attente, disponible le
                      - time [ref=e889]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e890]: + 7 500 F CFA
              - listitem [ref=e891]:
                - generic [ref=e897]:
                  - paragraph [ref=e898]:
                    - text: Vente en ligne
                    - generic [ref=e899]: (crédit)
                  - paragraph [ref=e900]: Vente en ligne TX-EV-1793814288743-20E83DD7 (TICKET)
                  - paragraph [ref=e901]:
                    - time [ref=e902]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e903]:
                      - text: · en attente, disponible le
                      - time [ref=e904]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e905]: + 15 000 F CFA
              - listitem [ref=e906]:
                - generic [ref=e912]:
                  - paragraph [ref=e913]:
                    - text: Vente en ligne
                    - generic [ref=e914]: (crédit)
                  - paragraph [ref=e915]: Vente en ligne TX-EV-1793814288716-14596DF8 (TICKET)
                  - paragraph [ref=e916]:
                    - time [ref=e917]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e918]:
                      - text: · en attente, disponible le
                      - time [ref=e919]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e920]: + 24 000 F CFA
              - listitem [ref=e921]:
                - generic [ref=e927]:
                  - paragraph [ref=e928]:
                    - text: Vente en ligne
                    - generic [ref=e929]: (crédit)
                  - paragraph [ref=e930]: Vente en ligne TX-EV-1793814288690-C893D058 (TICKET)
                  - paragraph [ref=e931]:
                    - time [ref=e932]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e933]:
                      - text: · en attente, disponible le
                      - time [ref=e934]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e935]: + 12 000 F CFA
              - listitem [ref=e936]:
                - generic [ref=e942]:
                  - paragraph [ref=e943]:
                    - text: Vente en ligne
                    - generic [ref=e944]: (crédit)
                  - paragraph [ref=e945]: Vente en ligne TX-EV-1793814288660-595AC62E (TICKET)
                  - paragraph [ref=e946]:
                    - time [ref=e947]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e948]:
                      - text: · en attente, disponible le
                      - time [ref=e949]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e950]: + 6 000 F CFA
              - listitem [ref=e951]:
                - generic [ref=e957]:
                  - paragraph [ref=e958]:
                    - text: Vente en ligne
                    - generic [ref=e959]: (crédit)
                  - paragraph [ref=e960]: Vente en ligne TX-EV-1793814288633-B80707C3 (TICKET)
                  - paragraph [ref=e961]:
                    - time [ref=e962]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e963]:
                      - text: · en attente, disponible le
                      - time [ref=e964]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e965]: + 18 000 F CFA
  - alert [ref=e966]
```

# Test source

```ts
  176 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  177 |             }
  178 |             if (screen.injectError) {
  179 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  180 |                 await page.route(screen.injectError, (route) => route.fulfill({
  181 |                     status: 500,
  182 |                     contentType: 'application/json; charset=utf-8',
  183 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  184 |                 }));
  185 |             }
  186 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  187 |             for (const stub of stubs) {
  188 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  189 |                 await page.route(stub.url, async (route) => {
  190 |                     if (!methodMatches(stub.method, route.request().method())) {
  191 |                         await route.fallback();
  192 |                         return;
  193 |                     }
  194 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  195 |                 });
  196 |             }
  197 |             for (const hold of screen.holdRequests ?? []) {
  198 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  199 |                 await page.route(hold.url, async (route) => {
  200 |                     if (!methodMatches(hold.method, route.request().method())) {
  201 |                         await route.fallback();
  202 |                         return;
  203 |                     }
  204 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  205 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  206 |                 });
  207 |             }
  208 |             if (screen.fakePush) {
  209 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  210 |                 record.notes.push(screen.fakePush === 'granted'
  211 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  212 |                     : screen.fakePush === 'denied'
  213 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  214 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  215 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  216 |             }
  217 |             if (screen.fakeCamera) {
  218 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  219 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  220 |                 await context.addInitScript(installFakeCamera, { mode });
  221 |             }
  222 |             if (screen.offline === 'before-load') {
  223 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  224 |                 guard.freeze();
  225 |                 await context.setOffline(true);
  226 |             }
  227 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  228 |             record.status = response ? response.status() : null;
  229 |             if (screen.expectStatus !== undefined) {
  230 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  231 |             }
  232 |             if (screen.offline === 'after-load') {
  233 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  234 |                 guard.freeze();
  235 |                 await context.setOffline(true);
  236 |             }
  237 |             const sc = { page, context, guard, ids: demo };
  238 |             if (screen.ready) await screen.ready(sc);
  239 |             await settle(page, guard, record.notes);
  240 |             if (screen.actions) {
  241 |                 await screen.actions(sc);
  242 |                 await settle(page, guard, record.notes);
  243 |             }
  244 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  245 |                 const problem = await markAllOnOneLine(page);
  246 |                 if (problem) record.blocking.push(problem);
  247 |             }
  248 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  249 |             record.blocking.push(...checks.blocking);
  250 |             record.warnings.push(...checks.warnings);
  251 |             record.axeDetails = checks.axeDetails;
  252 |             record.smallTextDetails = checks.smallTextDetails;
  253 |             record.metrics = checks.metrics;
  254 |             const shot = await capture(page, screen, file);
  255 |             record.captured = true;
  256 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  257 |         } catch (err) {
  258 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  259 |             if (!record.captured && !page.isClosed()) {
  260 |                 await capture(page, screen, file).then(
  261 |                     async (shot) => {
  262 |                         record.captured = true;
  263 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  264 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |                     },
  266 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  267 |                 );
  268 |             }
  269 |             throw err;
  270 |         } finally {
  271 |             record.blocking.push(...guard.blockingIssues());
  272 |             record.warnings.push(...guard.nonBlockingIssues());
  273 |             record.durationMs = Date.now() - started;
  274 |             writeCaptureRecord(record);
  275 |         }
> 276 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de partenaire-finances__ordinateur__sombre.png
  277 |     });
  278 | }
  279 | 
  280 | for (const theme of THEMES) {
  281 |     for (const role of ROLE_ORDER) {
  282 |         const screens = SCREENS.filter((s) => s.role === role);
  283 |         if (screens.length === 0) continue;
  284 |         test.describe(`${theme.key} · ${role}`, () => {
  285 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  286 | 
  287 |             for (const screen of screens) {
  288 |                 if (screen.serviceWorkers === 'allow') {
  289 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  290 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  291 |                         test.use({ serviceWorkers: 'allow' });
  292 |                         defineCapture(screen, theme, role);
  293 |                     });
  294 |                 } else {
  295 |                     defineCapture(screen, theme, role);
  296 |                 }
  297 |             }
  298 |         });
  299 |     }
  300 | }
  301 | 
```