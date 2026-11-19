# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-finance — Finances
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-finance (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "360 px : texte tronqué sans le texte entier : p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Concert des Lumières de Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Brunch électro des Almadies » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 15 000 F CFA » (78×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 9 000 F CFA » (70×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 30 000 F CFA » (78×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 18 000 F CFA » (78×18 px)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Gestion
          - generic [ref=f2e12]:
            - link "Tableau de bord" [ref=f2e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f2e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e31]:
          - paragraph [ref=f2e32]: Outils
          - generic [ref=f2e33]:
            - link "Finances" [ref=f2e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: MN
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Mariama Ndiaye
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: 99+
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e106]:
            - generic [ref=f2e107]:
              - heading "Finances" [level=1] [ref=f2e108]
              - paragraph [ref=f2e109]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=f2e110]:
              - link "Statistiques de ventes" [ref=f2e111] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=f2e116] [cursor=pointer]
          - region [ref=f2e124]:
            - heading "Soldes" [level=2] [ref=f2e125]
            - generic [ref=f2e126]:
              - paragraph [ref=f2e127]: Disponible au retrait
              - paragraph [ref=f2e128]: 0 F CFA
              - paragraph [ref=f2e129]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=f2e130]:
              - generic [ref=f2e131]:
                - paragraph [ref=f2e133]: En attente
                - paragraph [ref=f2e138]: 828 000 F CFA
                - paragraph [ref=f2e139]: "Prochaine disponibilité : sam. 21 nov. 2026 à 16:30."
              - generic [ref=f2e140]:
                - paragraph [ref=f2e142]: Retraits en cours
                - paragraph [ref=f2e147]: 0 F CFA
                - paragraph [ref=f2e148]: Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=f2e149]:
                - paragraph [ref=f2e151]: À compenser
                - paragraph [ref=f2e156]: 0 F CFA
                - paragraph [ref=f2e157]: Aucune somme à compenser.
          - region [ref=f2e158]:
            - generic [ref=f2e159]:
              - heading "Demander un retrait" [level=2] [ref=f2e160]
              - paragraph [ref=f2e164]: Wave ou Orange Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code.
            - list "Étapes du retrait" [ref=f2e165]:
              - listitem [ref=f2e166]:
                - generic [aria-hidden] [ref=f2e167]: "1"
                - generic [ref=f2e168]: Demande
              - listitem [ref=f2e170]:
                - generic [aria-hidden] [ref=f2e171]: "2"
                - generic [ref=f2e172]: Code SMS
              - listitem [ref=f2e174]:
                - generic [aria-hidden] [ref=f2e175]: "3"
                - generic [ref=f2e176]: Suivi
            - generic [ref=f2e177]:
              - group "Recevoir sur" [ref=f2e178]:
                - generic [ref=f2e179]: Recevoir sur *
                - generic [ref=f2e180]:
                  - generic [ref=f2e181] [cursor=pointer]:
                    - radio "Wave" [ref=f2e182]
                    - generic [ref=f2e183]:
                      - generic [aria-hidden] [ref=f2e184]: W
                      - generic [ref=f2e185]: Wave
                  - generic [ref=f2e186] [cursor=pointer]:
                    - radio "Orange Money" [ref=f2e187]
                    - generic [ref=f2e188]:
                      - generic [aria-hidden] [ref=f2e189]: OM
                      - generic [ref=f2e190]: Orange Money
              - generic [ref=f2e191]:
                - generic [ref=f2e193]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=f2e194]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=f2e195]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=f2e196]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=f2e197]:
                - generic [ref=f2e199]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=f2e200]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=f2e201]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=f2e202]: "Disponible : 0 F CFA. Les frais sont déduits du montant versé."
              - paragraph [ref=f2e203]: "Minimum de retrait : 5 000 F CFA. Frais : 1 % du montant."
              - button "Aucun montant disponible au retrait" [disabled] [ref=f2e204]
          - region [ref=f2e210]:
            - generic [ref=f2e211]:
              - heading "Mes retraits" [level=2] [ref=f2e212]
              - paragraph [ref=f2e213]: Vos 20 dernières demandes.
            - generic [ref=f2e214]:
              - heading "Aucun retrait" [level=3] [ref=f2e219]
              - paragraph [ref=f2e220]: Vous n’avez pas encore demandé de retrait.
          - region [ref=f2e221]:
            - generic [ref=f2e222]:
              - heading "Historique du compte" [level=2] [ref=f2e223]
              - paragraph [ref=f2e224]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=f2e225]:
              - listitem [ref=f2e226]:
                - generic [ref=f2e232]:
                  - paragraph [ref=f2e233]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e234]: (débit)
                  - paragraph [ref=f2e235]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e236]:
                    - time [ref=f2e237]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e238]: − 15 000 F CFA
              - listitem [ref=f2e239]:
                - generic [ref=f2e245]:
                  - paragraph [ref=f2e246]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e247]: (débit)
                  - paragraph [ref=f2e248]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e249]:
                    - time [ref=f2e250]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e251]: − 15 000 F CFA
              - listitem [ref=f2e252]:
                - generic [ref=f2e258]:
                  - paragraph [ref=f2e259]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e260]: (débit)
                  - paragraph [ref=f2e261]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e262]:
                    - time [ref=f2e263]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e264]: − 9 000 F CFA
              - listitem [ref=f2e265]:
                - generic [ref=f2e271]:
                  - paragraph [ref=f2e272]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e273]: (débit)
                  - paragraph [ref=f2e274]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e275]:
                    - time [ref=f2e276]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e277]: − 9 000 F CFA
              - listitem [ref=f2e278]:
                - generic [ref=f2e284]:
                  - paragraph [ref=f2e285]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e286]: (débit)
                  - paragraph [ref=f2e287]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e288]:
                    - time [ref=f2e289]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e290]: − 9 000 F CFA
              - listitem [ref=f2e291]:
                - generic [ref=f2e297]:
                  - paragraph [ref=f2e298]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e299]: (débit)
                  - paragraph [ref=f2e300]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e301]:
                    - time [ref=f2e302]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e303]: − 30 000 F CFA
              - listitem [ref=f2e304]:
                - generic [ref=f2e310]:
                  - paragraph [ref=f2e311]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e312]: (débit)
                  - paragraph [ref=f2e313]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e314]:
                    - time [ref=f2e315]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e316]: − 30 000 F CFA
              - listitem [ref=f2e317]:
                - generic [ref=f2e323]:
                  - paragraph [ref=f2e324]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e325]: (débit)
                  - paragraph [ref=f2e326]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e327]:
                    - time [ref=f2e328]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e329]: − 18 000 F CFA
              - listitem [ref=f2e330]:
                - generic [ref=f2e336]:
                  - paragraph [ref=f2e337]:
                    - text: Remboursement d’un billet
                    - generic [ref=f2e338]: (débit)
                  - paragraph [ref=f2e339]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e340]:
                    - time [ref=f2e341]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f2e342]: − 15 000 F CFA
              - listitem [ref=f2e343]:
                - generic [ref=f2e349]:
                  - paragraph [ref=f2e350]:
                    - text: Vente en ligne
                    - generic [ref=f2e351]: (crédit)
                  - paragraph [ref=f2e352]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f2e353]:
                    - time [ref=f2e354]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e355]:
                      - text: · en attente, disponible le
                      - time [ref=f2e356]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f2e357]: + 6 000 F CFA
              - listitem [ref=f2e358]:
                - generic [ref=f2e364]:
                  - paragraph [ref=f2e365]:
                    - text: Vente en ligne
                    - generic [ref=f2e366]: (crédit)
                  - paragraph [ref=f2e367]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e368]:
                    - time [ref=f2e369]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e370]:
                      - text: · en attente, disponible le
                      - time [ref=f2e371]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e372]: + 15 000 F CFA
              - listitem [ref=f2e373]:
                - generic [ref=f2e379]:
                  - paragraph [ref=f2e380]:
                    - text: Vente en ligne
                    - generic [ref=f2e381]: (crédit)
                  - paragraph [ref=f2e382]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e383]:
                    - time [ref=f2e384]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e385]:
                      - text: · en attente, disponible le
                      - time [ref=f2e386]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e387]: + 15 000 F CFA
              - listitem [ref=f2e388]:
                - generic [ref=f2e394]:
                  - paragraph [ref=f2e395]:
                    - text: Vente en ligne
                    - generic [ref=f2e396]: (crédit)
                  - paragraph [ref=f2e397]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e398]:
                    - time [ref=f2e399]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e400]:
                      - text: · en attente, disponible le
                      - time [ref=f2e401]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e402]: + 7 500 F CFA
              - listitem [ref=f2e403]:
                - generic [ref=f2e409]:
                  - paragraph [ref=f2e410]:
                    - text: Vente en ligne
                    - generic [ref=f2e411]: (crédit)
                  - paragraph [ref=f2e412]: « Nuit du Sabar — édition d’automne »
                  - paragraph [ref=f2e413]:
                    - time [ref=f2e414]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e415]:
                      - text: · en attente, disponible le
                      - time [ref=f2e416]: sam. 21 nov. 2026 à 16:30
                - generic [ref=f2e417]: + 10 000 F CFA
              - listitem [ref=f2e418]:
                - generic [ref=f2e424]:
                  - paragraph [ref=f2e425]:
                    - text: Vente en ligne
                    - generic [ref=f2e426]: (crédit)
                  - paragraph [ref=f2e427]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e428]:
                    - time [ref=f2e429]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e430]:
                      - text: · en attente, disponible le
                      - time [ref=f2e431]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e432]: + 30 000 F CFA
              - listitem [ref=f2e433]:
                - generic [ref=f2e439]:
                  - paragraph [ref=f2e440]:
                    - text: Vente en ligne
                    - generic [ref=f2e441]: (crédit)
                  - paragraph [ref=f2e442]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e443]:
                    - time [ref=f2e444]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e445]:
                      - text: · en attente, disponible le
                      - time [ref=f2e446]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e447]: + 15 000 F CFA
              - listitem [ref=f2e448]:
                - generic [ref=f2e454]:
                  - paragraph [ref=f2e455]:
                    - text: Vente en ligne
                    - generic [ref=f2e456]: (crédit)
                  - paragraph [ref=f2e457]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e458]:
                    - time [ref=f2e459]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e460]:
                      - text: · en attente, disponible le
                      - time [ref=f2e461]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e462]: + 15 000 F CFA
              - listitem [ref=f2e463]:
                - generic [ref=f2e469]:
                  - paragraph [ref=f2e470]:
                    - text: Vente en ligne
                    - generic [ref=f2e471]: (crédit)
                  - paragraph [ref=f2e472]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e473]:
                    - time [ref=f2e474]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e475]:
                      - text: · en attente, disponible le
                      - time [ref=f2e476]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e477]: + 30 000 F CFA
              - listitem [ref=f2e478]:
                - generic [ref=f2e484]:
                  - paragraph [ref=f2e485]:
                    - text: Vente en ligne
                    - generic [ref=f2e486]: (crédit)
                  - paragraph [ref=f2e487]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e488]:
                    - time [ref=f2e489]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e490]:
                      - text: · en attente, disponible le
                      - time [ref=f2e491]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e492]: + 15 000 F CFA
              - listitem [ref=f2e493]:
                - generic [ref=f2e499]:
                  - paragraph [ref=f2e500]:
                    - text: Vente en ligne
                    - generic [ref=f2e501]: (crédit)
                  - paragraph [ref=f2e502]: « Brunch électro des Almadies »
                  - paragraph [ref=f2e503]:
                    - time [ref=f2e504]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e505]:
                      - text: · en attente, disponible le
                      - time [ref=f2e506]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f2e507]: + 30 000 F CFA
              - listitem [ref=f2e508]:
                - generic [ref=f2e514]:
                  - paragraph [ref=f2e515]:
                    - text: Vente en ligne
                    - generic [ref=f2e516]: (crédit)
                  - paragraph [ref=f2e517]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e518]:
                    - time [ref=f2e519]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e520]:
                      - text: · en attente, disponible le
                      - time [ref=f2e521]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e522]: + 9 000 F CFA
              - listitem [ref=f2e523]:
                - generic [ref=f2e529]:
                  - paragraph [ref=f2e530]:
                    - text: Vente en ligne
                    - generic [ref=f2e531]: (crédit)
                  - paragraph [ref=f2e532]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e533]:
                    - time [ref=f2e534]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e535]:
                      - text: · en attente, disponible le
                      - time [ref=f2e536]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e537]: + 9 000 F CFA
              - listitem [ref=f2e538]:
                - generic [ref=f2e544]:
                  - paragraph [ref=f2e545]:
                    - text: Vente en ligne
                    - generic [ref=f2e546]: (crédit)
                  - paragraph [ref=f2e547]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e548]:
                    - time [ref=f2e549]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e550]:
                      - text: · en attente, disponible le
                      - time [ref=f2e551]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e552]: + 18 000 F CFA
              - listitem [ref=f2e553]:
                - generic [ref=f2e559]:
                  - paragraph [ref=f2e560]:
                    - text: Vente en ligne
                    - generic [ref=f2e561]: (crédit)
                  - paragraph [ref=f2e562]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e563]:
                    - time [ref=f2e564]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e565]:
                      - text: · en attente, disponible le
                      - time [ref=f2e566]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e567]: + 9 000 F CFA
              - listitem [ref=f2e568]:
                - generic [ref=f2e574]:
                  - paragraph [ref=f2e575]:
                    - text: Vente en ligne
                    - generic [ref=f2e576]: (crédit)
                  - paragraph [ref=f2e577]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e578]:
                    - time [ref=f2e579]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e580]:
                      - text: · en attente, disponible le
                      - time [ref=f2e581]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e582]: + 30 000 F CFA
              - listitem [ref=f2e583]:
                - generic [ref=f2e589]:
                  - paragraph [ref=f2e590]:
                    - text: Vente en ligne
                    - generic [ref=f2e591]: (crédit)
                  - paragraph [ref=f2e592]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e593]:
                    - time [ref=f2e594]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e595]:
                      - text: · en attente, disponible le
                      - time [ref=f2e596]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e597]: + 15 000 F CFA
              - listitem [ref=f2e598]:
                - generic [ref=f2e604]:
                  - paragraph [ref=f2e605]:
                    - text: Vente en ligne
                    - generic [ref=f2e606]: (crédit)
                  - paragraph [ref=f2e607]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e608]:
                    - time [ref=f2e609]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e610]:
                      - text: · en attente, disponible le
                      - time [ref=f2e611]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e612]: + 15 000 F CFA
              - listitem [ref=f2e613]:
                - generic [ref=f2e619]:
                  - paragraph [ref=f2e620]:
                    - text: Vente en ligne
                    - generic [ref=f2e621]: (crédit)
                  - paragraph [ref=f2e622]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f2e623]:
                    - time [ref=f2e624]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e625]:
                      - text: · en attente, disponible le
                      - time [ref=f2e626]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f2e627]: + 30 000 F CFA
              - listitem [ref=f2e628]:
                - generic [ref=f2e634]:
                  - paragraph [ref=f2e635]:
                    - text: Vente en ligne
                    - generic [ref=f2e636]: (crédit)
                  - paragraph [ref=f2e637]: « Soirée Kora & Lumières »
                  - paragraph [ref=f2e638]:
                    - time [ref=f2e639]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e640]:
                      - text: · en attente, disponible le
                      - time [ref=f2e641]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f2e642]: + 12 000 F CFA
              - listitem [ref=f2e643]:
                - generic [ref=f2e649]:
                  - paragraph [ref=f2e650]:
                    - text: Vente en ligne
                    - generic [ref=f2e651]: (crédit)
                  - paragraph [ref=f2e652]: « Soirée Kora & Lumières »
                  - paragraph [ref=f2e653]:
                    - time [ref=f2e654]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e655]:
                      - text: · en attente, disponible le
                      - time [ref=f2e656]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f2e657]: + 12 000 F CFA
              - listitem [ref=f2e658]:
                - generic [ref=f2e664]:
                  - paragraph [ref=f2e665]:
                    - text: Vente en ligne
                    - generic [ref=f2e666]: (crédit)
                  - paragraph [ref=f2e667]: « Soirée Kora & Lumières »
                  - paragraph [ref=f2e668]:
                    - time [ref=f2e669]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e670]:
                      - text: · en attente, disponible le
                      - time [ref=f2e671]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f2e672]: + 6 000 F CFA
              - listitem [ref=f2e673]:
                - generic [ref=f2e679]:
                  - paragraph [ref=f2e680]:
                    - text: Vente en ligne
                    - generic [ref=f2e681]: (crédit)
                  - paragraph [ref=f2e682]: « Soirée Kora & Lumières »
                  - paragraph [ref=f2e683]:
                    - time [ref=f2e684]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e685]:
                      - text: · en attente, disponible le
                      - time [ref=f2e686]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f2e687]: + 12 000 F CFA
              - listitem [ref=f2e688]:
                - generic [ref=f2e694]:
                  - paragraph [ref=f2e695]:
                    - text: Vente en ligne
                    - generic [ref=f2e696]: (crédit)
                  - paragraph [ref=f2e697]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e698]:
                    - time [ref=f2e699]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e700]:
                      - text: · en attente, disponible le
                      - time [ref=f2e701]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e702]: + 12 000 F CFA
              - listitem [ref=f2e703]:
                - generic [ref=f2e709]:
                  - paragraph [ref=f2e710]:
                    - text: Vente en ligne
                    - generic [ref=f2e711]: (crédit)
                  - paragraph [ref=f2e712]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e713]:
                    - time [ref=f2e714]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e715]:
                      - text: · en attente, disponible le
                      - time [ref=f2e716]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e717]: + 24 000 F CFA
              - listitem [ref=f2e718]:
                - generic [ref=f2e724]:
                  - paragraph [ref=f2e725]:
                    - text: Vente en ligne
                    - generic [ref=f2e726]: (crédit)
                  - paragraph [ref=f2e727]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e728]:
                    - time [ref=f2e729]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e730]:
                      - text: · en attente, disponible le
                      - time [ref=f2e731]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e732]: + 12 000 F CFA
              - listitem [ref=f2e733]:
                - generic [ref=f2e739]:
                  - paragraph [ref=f2e740]:
                    - text: Vente en ligne
                    - generic [ref=f2e741]: (crédit)
                  - paragraph [ref=f2e742]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e743]:
                    - time [ref=f2e744]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e745]:
                      - text: · en attente, disponible le
                      - time [ref=f2e746]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e747]: + 12 000 F CFA
              - listitem [ref=f2e748]:
                - generic [ref=f2e754]:
                  - paragraph [ref=f2e755]:
                    - text: Vente en ligne
                    - generic [ref=f2e756]: (crédit)
                  - paragraph [ref=f2e757]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e758]:
                    - time [ref=f2e759]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e760]:
                      - text: · en attente, disponible le
                      - time [ref=f2e761]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e762]: + 24 000 F CFA
              - listitem [ref=f2e763]:
                - generic [ref=f2e769]:
                  - paragraph [ref=f2e770]:
                    - text: Vente en ligne
                    - generic [ref=f2e771]: (crédit)
                  - paragraph [ref=f2e772]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e773]:
                    - time [ref=f2e774]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e775]:
                      - text: · en attente, disponible le
                      - time [ref=f2e776]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e777]: + 12 000 F CFA
              - listitem [ref=f2e778]:
                - generic [ref=f2e784]:
                  - paragraph [ref=f2e785]:
                    - text: Vente en ligne
                    - generic [ref=f2e786]: (crédit)
                  - paragraph [ref=f2e787]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e788]:
                    - time [ref=f2e789]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e790]:
                      - text: · en attente, disponible le
                      - time [ref=f2e791]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e792]: + 7 500 F CFA
              - listitem [ref=f2e793]:
                - generic [ref=f2e799]:
                  - paragraph [ref=f2e800]:
                    - text: Vente en ligne
                    - generic [ref=f2e801]: (crédit)
                  - paragraph [ref=f2e802]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e803]:
                    - time [ref=f2e804]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e805]:
                      - text: · en attente, disponible le
                      - time [ref=f2e806]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e807]: + 15 000 F CFA
              - listitem [ref=f2e808]:
                - generic [ref=f2e814]:
                  - paragraph [ref=f2e815]:
                    - text: Vente en ligne
                    - generic [ref=f2e816]: (crédit)
                  - paragraph [ref=f2e817]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e818]:
                    - time [ref=f2e819]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e820]:
                      - text: · en attente, disponible le
                      - time [ref=f2e821]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e822]: + 7 500 F CFA
              - listitem [ref=f2e823]:
                - generic [ref=f2e829]:
                  - paragraph [ref=f2e830]:
                    - text: Vente en ligne
                    - generic [ref=f2e831]: (crédit)
                  - paragraph [ref=f2e832]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e833]:
                    - time [ref=f2e834]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e835]:
                      - text: · en attente, disponible le
                      - time [ref=f2e836]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e837]: + 22 500 F CFA
              - listitem [ref=f2e838]:
                - generic [ref=f2e844]:
                  - paragraph [ref=f2e845]:
                    - text: Vente en ligne
                    - generic [ref=f2e846]: (crédit)
                  - paragraph [ref=f2e847]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e848]:
                    - time [ref=f2e849]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e850]:
                      - text: · en attente, disponible le
                      - time [ref=f2e851]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e852]: + 15 000 F CFA
              - listitem [ref=f2e853]:
                - generic [ref=f2e859]:
                  - paragraph [ref=f2e860]:
                    - text: Vente en ligne
                    - generic [ref=f2e861]: (crédit)
                  - paragraph [ref=f2e862]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e863]:
                    - time [ref=f2e864]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e865]:
                      - text: · en attente, disponible le
                      - time [ref=f2e866]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e867]: + 7 500 F CFA
              - listitem [ref=f2e868]:
                - generic [ref=f2e874]:
                  - paragraph [ref=f2e875]:
                    - text: Vente en ligne
                    - generic [ref=f2e876]: (crédit)
                  - paragraph [ref=f2e877]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e878]:
                    - time [ref=f2e879]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e880]:
                      - text: · en attente, disponible le
                      - time [ref=f2e881]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e882]: + 7 500 F CFA
              - listitem [ref=f2e883]:
                - generic [ref=f2e889]:
                  - paragraph [ref=f2e890]:
                    - text: Vente en ligne
                    - generic [ref=f2e891]: (crédit)
                  - paragraph [ref=f2e892]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f2e893]:
                    - time [ref=f2e894]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e895]:
                      - text: · en attente, disponible le
                      - time [ref=f2e896]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f2e897]: + 15 000 F CFA
              - listitem [ref=f2e898]:
                - generic [ref=f2e904]:
                  - paragraph [ref=f2e905]:
                    - text: Vente en ligne
                    - generic [ref=f2e906]: (crédit)
                  - paragraph [ref=f2e907]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f2e908]:
                    - time [ref=f2e909]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e910]:
                      - text: · en attente, disponible le
                      - time [ref=f2e911]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f2e912]: + 24 000 F CFA
              - listitem [ref=f2e913]:
                - generic [ref=f2e919]:
                  - paragraph [ref=f2e920]:
                    - text: Vente en ligne
                    - generic [ref=f2e921]: (crédit)
                  - paragraph [ref=f2e922]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f2e923]:
                    - time [ref=f2e924]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e925]:
                      - text: · en attente, disponible le
                      - time [ref=f2e926]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f2e927]: + 12 000 F CFA
              - listitem [ref=f2e928]:
                - generic [ref=f2e934]:
                  - paragraph [ref=f2e935]:
                    - text: Vente en ligne
                    - generic [ref=f2e936]: (crédit)
                  - paragraph [ref=f2e937]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f2e938]:
                    - time [ref=f2e939]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e940]:
                      - text: · en attente, disponible le
                      - time [ref=f2e941]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f2e942]: + 6 000 F CFA
              - listitem [ref=f2e943]:
                - generic [ref=f2e949]:
                  - paragraph [ref=f2e950]:
                    - text: Vente en ligne
                    - generic [ref=f2e951]: (crédit)
                  - paragraph [ref=f2e952]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f2e953]:
                    - time [ref=f2e954]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f2e955]:
                      - text: · en attente, disponible le
                      - time [ref=f2e956]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f2e957]: + 18 000 F CFA
  - alert [ref=f2e958]
```

# Test source

```ts
  6   |  * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
  7   |  * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
  8   |  *
  9   |  * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
  10  |  * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
  11  |  * (responsive.tsv et responsive.txt, publiés sur ci-results).
  12  |  */
  13  | import fs from 'node:fs';
  14  | import path from 'node:path';
  15  | import type { Page } from '@playwright/test';
  16  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  17  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  18  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  19  | import {
  20  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  21  | } from './support/responsive-pages';
  22  | import { runResponsiveChecks } from './support/responsive-checks';
  23  | 
  24  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  25  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  26  | 
  27  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  28  |     { key: 'clair', colorScheme: 'light' },
  29  |     { key: 'sombre', colorScheme: 'dark' },
  30  | ];
  31  | 
  32  | interface Size { width: number; height: number; paysage?: boolean }
  33  | 
  34  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  35  |     const base: Size[] = RESPONSIVE_WIDTHS
  36  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  37  |         .map((w) => ({ width: w.width, height: w.height }));
  38  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  39  |     return [...base, ...land];
  40  | }
  41  | 
  42  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  43  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  44  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  45  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  46  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  47  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  48  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  49  | }
  50  | 
  51  | interface ResponsiveRecord {
  52  |     page: string;
  53  |     titre: string;
  54  |     groupe: string;
  55  |     role: CaptureRole;
  56  |     theme: ThemeKey;
  57  |     url: string | null;
  58  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  59  |     notes: string[];
  60  |     error: string | null;
  61  | }
  62  | 
  63  | for (const theme of THEMES) {
  64  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  65  |     for (const role of roles) {
  66  |         test.describe(`${theme.key} · ${role}`, () => {
  67  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  68  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  69  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard }) => {
  70  |                     test.setTimeout(240_000);
  71  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  72  |                     try {
  73  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  74  |                         record.url = p.path(demo);
  75  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  76  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  77  |                         for (const size of sizesFor(p, theme.key)) {
  78  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  79  |                             await page.setViewportSize({ width: size.width, height: size.height });
  80  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  81  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  82  |                             if (p.ready) await p.ready(page);
  83  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  |                             if (p.actions) await p.actions(page);
  85  |                             await settle(page, record.notes, at);
  86  |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  87  |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  88  |                             let capture: string | null = null;
  89  |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  90  |                                 fs.mkdirSync(SHOTS, { recursive: true });
  91  |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  92  |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  93  |                             }
  94  |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  95  |                         }
  96  |                     } catch (err) {
  97  |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  98  |                         throw err;
  99  |                     } finally {
  100 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  101 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  102 |                         fs.mkdirSync(RESULTS, { recursive: true });
  103 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  104 |                     }
  105 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 106 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de org-finance (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```