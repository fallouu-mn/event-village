# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-finance — Finances
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-finance (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   "320 px : texte hors de l’écran : p.truncate.text-sm « « Nuit du Sabar — édition d’automne » » de 81 à 335 px (fenêtre 320 px)",
+   "320 px : texte tronqué sans le texte entier : p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Concert des Lumières de Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Brunch électro des Almadies » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 15 000 F CFA » (99×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 9 000 F CFA » (91×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 30 000 F CFA » (99×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 18 000 F CFA » (99×18 px)",
+   "360 px : texte tronqué sans le texte entier : p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Concert des Lumières de Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Brunch électro des Almadies » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent)",
+   "360 px : textes qui se chevauchent : p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 15 000 F CFA » (78×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 9 000 F CFA » (70×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 30 000 F CFA » (78×18 px) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » sur span.whitespace-nowrap.text-sm « − 18 000 F CFA » (78×18 px)",
+   "390 px : texte tronqué sans le texte entier : p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Concert des Lumières de Gorée » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Brunch électro des Almadies » » (points de suspension, texte entier absent) ; p.truncate.text-sm « « Croisière musicale vers Gorée » » (points de suspension, texte entier absent)",
+   "390 px : textes qui se chevauchent : span.whitespace-nowrap.text-sm « − 15 000 F CFA » sur p.truncate.text-sm « « Croisière musicale vers Gorée » » (48×8 px) ; span.whitespace-nowrap.text-sm « − 9 000 F CFA » sur p.truncate.text-sm « « Croisière musicale vers Gorée » » (40×8 px) ; span.whitespace-nowrap.text-sm « − 30 000 F CFA » sur p.truncate.text-sm « « Croisière musicale vers Gorée » » (48×8 px) ; span.whitespace-nowrap.text-sm « − 18 000 F CFA » sur p.truncate.text-sm « « Croisière musicale vers Gorée » » (48×8 px)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e6]: Event Village
      - navigation "Navigation principale" [ref=f5e9]:
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e31]:
          - paragraph [ref=f5e32]: Outils
          - generic [ref=f5e33]:
            - link "Finances" [ref=f5e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e73]: MN
          - generic [ref=f5e74]:
            - generic [ref=f5e75]: Mariama Ndiaye
            - generic [ref=f5e76]: Partenaire
        - generic [ref=f5e77]:
          - button "Se déconnecter" [ref=f5e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e83] [cursor=pointer]
    - generic [ref=f5e87]:
      - banner [ref=f5e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e97] [cursor=pointer]:
          - generic [ref=f5e101]: 99+
      - main [ref=f5e102]:
        - generic [ref=f5e104]:
          - generic [ref=f5e106]:
            - generic [ref=f5e107]:
              - heading "Finances" [level=1] [ref=f5e108]
              - paragraph [ref=f5e109]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=f5e110]:
              - link "Statistiques de ventes" [ref=f5e111] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=f5e116] [cursor=pointer]
          - region [ref=f5e124]:
            - heading "Soldes" [level=2] [ref=f5e125]
            - generic [ref=f5e126]:
              - paragraph [ref=f5e127]: Disponible au retrait
              - paragraph [ref=f5e128]: 0 F CFA
              - paragraph [ref=f5e129]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=f5e130]:
              - generic [ref=f5e131]:
                - paragraph [ref=f5e133]: En attente
                - paragraph [ref=f5e138]: 828 000 F CFA
                - paragraph [ref=f5e139]: "Prochaine disponibilité : sam. 21 nov. 2026 à 16:30."
              - generic [ref=f5e140]:
                - paragraph [ref=f5e142]: Retraits en cours
                - paragraph [ref=f5e147]: 0 F CFA
                - paragraph [ref=f5e148]: Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=f5e149]:
                - paragraph [ref=f5e151]: À compenser
                - paragraph [ref=f5e156]: 0 F CFA
                - paragraph [ref=f5e157]: Aucune somme à compenser.
          - region [ref=f5e158]:
            - generic [ref=f5e159]:
              - heading "Demander un retrait" [level=2] [ref=f5e160]
              - paragraph [ref=f5e164]: Wave ou Orange Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code.
            - list "Étapes du retrait" [ref=f5e165]:
              - listitem [ref=f5e166]:
                - generic [aria-hidden] [ref=f5e167]: "1"
                - generic [ref=f5e168]: Demande
              - listitem [ref=f5e170]:
                - generic [aria-hidden] [ref=f5e171]: "2"
                - generic [ref=f5e172]: Code SMS
              - listitem [ref=f5e174]:
                - generic [aria-hidden] [ref=f5e175]: "3"
                - generic [ref=f5e176]: Suivi
            - generic [ref=f5e177]:
              - group "Recevoir sur" [ref=f5e178]:
                - generic [ref=f5e179]: Recevoir sur *
                - generic [ref=f5e180]:
                  - generic [ref=f5e181] [cursor=pointer]:
                    - radio "Wave" [ref=f5e182]
                    - generic [ref=f5e183]:
                      - generic [aria-hidden] [ref=f5e184]: W
                      - generic [ref=f5e185]: Wave
                  - generic [ref=f5e186] [cursor=pointer]:
                    - radio "Orange Money" [ref=f5e187]
                    - generic [ref=f5e188]:
                      - generic [aria-hidden] [ref=f5e189]: OM
                      - generic [ref=f5e190]: Orange Money
              - generic [ref=f5e191]:
                - generic [ref=f5e193]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=f5e194]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=f5e195]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=f5e196]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=f5e197]:
                - generic [ref=f5e199]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=f5e200]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=f5e201]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=f5e202]: "Disponible : 0 F CFA. Les frais sont déduits du montant versé."
              - paragraph [ref=f5e203]: "Minimum de retrait : 5 000 F CFA. Frais : 1 % du montant."
              - button "Aucun montant disponible au retrait" [disabled] [ref=f5e204]
          - region [ref=f5e210]:
            - generic [ref=f5e211]:
              - heading "Mes retraits" [level=2] [ref=f5e212]
              - paragraph [ref=f5e213]: Vos 20 dernières demandes.
            - generic [ref=f5e214]:
              - heading "Aucun retrait" [level=3] [ref=f5e219]
              - paragraph [ref=f5e220]: Vous n’avez pas encore demandé de retrait.
          - region [ref=f5e221]:
            - generic [ref=f5e222]:
              - heading "Historique du compte" [level=2] [ref=f5e223]
              - paragraph [ref=f5e224]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=f5e225]:
              - listitem [ref=f5e226]:
                - generic [ref=f5e232]:
                  - paragraph [ref=f5e233]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e234]: (débit)
                  - paragraph [ref=f5e235]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e236]:
                    - time [ref=f5e237]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e238]: − 15 000 F CFA
              - listitem [ref=f5e239]:
                - generic [ref=f5e245]:
                  - paragraph [ref=f5e246]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e247]: (débit)
                  - paragraph [ref=f5e248]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e249]:
                    - time [ref=f5e250]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e251]: − 15 000 F CFA
              - listitem [ref=f5e252]:
                - generic [ref=f5e258]:
                  - paragraph [ref=f5e259]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e260]: (débit)
                  - paragraph [ref=f5e261]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e262]:
                    - time [ref=f5e263]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e264]: − 9 000 F CFA
              - listitem [ref=f5e265]:
                - generic [ref=f5e271]:
                  - paragraph [ref=f5e272]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e273]: (débit)
                  - paragraph [ref=f5e274]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e275]:
                    - time [ref=f5e276]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e277]: − 9 000 F CFA
              - listitem [ref=f5e278]:
                - generic [ref=f5e284]:
                  - paragraph [ref=f5e285]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e286]: (débit)
                  - paragraph [ref=f5e287]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e288]:
                    - time [ref=f5e289]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e290]: − 9 000 F CFA
              - listitem [ref=f5e291]:
                - generic [ref=f5e297]:
                  - paragraph [ref=f5e298]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e299]: (débit)
                  - paragraph [ref=f5e300]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e301]:
                    - time [ref=f5e302]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e303]: − 30 000 F CFA
              - listitem [ref=f5e304]:
                - generic [ref=f5e310]:
                  - paragraph [ref=f5e311]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e312]: (débit)
                  - paragraph [ref=f5e313]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e314]:
                    - time [ref=f5e315]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e316]: − 30 000 F CFA
              - listitem [ref=f5e317]:
                - generic [ref=f5e323]:
                  - paragraph [ref=f5e324]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e325]: (débit)
                  - paragraph [ref=f5e326]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e327]:
                    - time [ref=f5e328]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e329]: − 18 000 F CFA
              - listitem [ref=f5e330]:
                - generic [ref=f5e336]:
                  - paragraph [ref=f5e337]:
                    - text: Remboursement d’un billet
                    - generic [ref=f5e338]: (débit)
                  - paragraph [ref=f5e339]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e340]:
                    - time [ref=f5e341]: jeu. 19 nov. 2026 à 10:34
                - generic [ref=f5e342]: − 15 000 F CFA
              - listitem [ref=f5e343]:
                - generic [ref=f5e349]:
                  - paragraph [ref=f5e350]:
                    - text: Vente en ligne
                    - generic [ref=f5e351]: (crédit)
                  - paragraph [ref=f5e352]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f5e353]:
                    - time [ref=f5e354]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e355]:
                      - text: · en attente, disponible le
                      - time [ref=f5e356]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f5e357]: + 6 000 F CFA
              - listitem [ref=f5e358]:
                - generic [ref=f5e364]:
                  - paragraph [ref=f5e365]:
                    - text: Vente en ligne
                    - generic [ref=f5e366]: (crédit)
                  - paragraph [ref=f5e367]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e368]:
                    - time [ref=f5e369]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e370]:
                      - text: · en attente, disponible le
                      - time [ref=f5e371]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e372]: + 15 000 F CFA
              - listitem [ref=f5e373]:
                - generic [ref=f5e379]:
                  - paragraph [ref=f5e380]:
                    - text: Vente en ligne
                    - generic [ref=f5e381]: (crédit)
                  - paragraph [ref=f5e382]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e383]:
                    - time [ref=f5e384]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e385]:
                      - text: · en attente, disponible le
                      - time [ref=f5e386]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e387]: + 15 000 F CFA
              - listitem [ref=f5e388]:
                - generic [ref=f5e394]:
                  - paragraph [ref=f5e395]:
                    - text: Vente en ligne
                    - generic [ref=f5e396]: (crédit)
                  - paragraph [ref=f5e397]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e398]:
                    - time [ref=f5e399]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e400]:
                      - text: · en attente, disponible le
                      - time [ref=f5e401]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e402]: + 7 500 F CFA
              - listitem [ref=f5e403]:
                - generic [ref=f5e409]:
                  - paragraph [ref=f5e410]:
                    - text: Vente en ligne
                    - generic [ref=f5e411]: (crédit)
                  - paragraph [ref=f5e412]: « Nuit du Sabar — édition d’automne »
                  - paragraph [ref=f5e413]:
                    - time [ref=f5e414]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e415]:
                      - text: · en attente, disponible le
                      - time [ref=f5e416]: sam. 21 nov. 2026 à 16:30
                - generic [ref=f5e417]: + 10 000 F CFA
              - listitem [ref=f5e418]:
                - generic [ref=f5e424]:
                  - paragraph [ref=f5e425]:
                    - text: Vente en ligne
                    - generic [ref=f5e426]: (crédit)
                  - paragraph [ref=f5e427]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e428]:
                    - time [ref=f5e429]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e430]:
                      - text: · en attente, disponible le
                      - time [ref=f5e431]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e432]: + 30 000 F CFA
              - listitem [ref=f5e433]:
                - generic [ref=f5e439]:
                  - paragraph [ref=f5e440]:
                    - text: Vente en ligne
                    - generic [ref=f5e441]: (crédit)
                  - paragraph [ref=f5e442]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e443]:
                    - time [ref=f5e444]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e445]:
                      - text: · en attente, disponible le
                      - time [ref=f5e446]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e447]: + 15 000 F CFA
              - listitem [ref=f5e448]:
                - generic [ref=f5e454]:
                  - paragraph [ref=f5e455]:
                    - text: Vente en ligne
                    - generic [ref=f5e456]: (crédit)
                  - paragraph [ref=f5e457]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e458]:
                    - time [ref=f5e459]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e460]:
                      - text: · en attente, disponible le
                      - time [ref=f5e461]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e462]: + 15 000 F CFA
              - listitem [ref=f5e463]:
                - generic [ref=f5e469]:
                  - paragraph [ref=f5e470]:
                    - text: Vente en ligne
                    - generic [ref=f5e471]: (crédit)
                  - paragraph [ref=f5e472]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e473]:
                    - time [ref=f5e474]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e475]:
                      - text: · en attente, disponible le
                      - time [ref=f5e476]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e477]: + 30 000 F CFA
              - listitem [ref=f5e478]:
                - generic [ref=f5e484]:
                  - paragraph [ref=f5e485]:
                    - text: Vente en ligne
                    - generic [ref=f5e486]: (crédit)
                  - paragraph [ref=f5e487]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e488]:
                    - time [ref=f5e489]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e490]:
                      - text: · en attente, disponible le
                      - time [ref=f5e491]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e492]: + 15 000 F CFA
              - listitem [ref=f5e493]:
                - generic [ref=f5e499]:
                  - paragraph [ref=f5e500]:
                    - text: Vente en ligne
                    - generic [ref=f5e501]: (crédit)
                  - paragraph [ref=f5e502]: « Brunch électro des Almadies »
                  - paragraph [ref=f5e503]:
                    - time [ref=f5e504]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e505]:
                      - text: · en attente, disponible le
                      - time [ref=f5e506]: sam. 21 nov. 2026 à 16:45
                - generic [ref=f5e507]: + 30 000 F CFA
              - listitem [ref=f5e508]:
                - generic [ref=f5e514]:
                  - paragraph [ref=f5e515]:
                    - text: Vente en ligne
                    - generic [ref=f5e516]: (crédit)
                  - paragraph [ref=f5e517]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e518]:
                    - time [ref=f5e519]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e520]:
                      - text: · en attente, disponible le
                      - time [ref=f5e521]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e522]: + 9 000 F CFA
              - listitem [ref=f5e523]:
                - generic [ref=f5e529]:
                  - paragraph [ref=f5e530]:
                    - text: Vente en ligne
                    - generic [ref=f5e531]: (crédit)
                  - paragraph [ref=f5e532]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e533]:
                    - time [ref=f5e534]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e535]:
                      - text: · en attente, disponible le
                      - time [ref=f5e536]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e537]: + 9 000 F CFA
              - listitem [ref=f5e538]:
                - generic [ref=f5e544]:
                  - paragraph [ref=f5e545]:
                    - text: Vente en ligne
                    - generic [ref=f5e546]: (crédit)
                  - paragraph [ref=f5e547]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e548]:
                    - time [ref=f5e549]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e550]:
                      - text: · en attente, disponible le
                      - time [ref=f5e551]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e552]: + 18 000 F CFA
              - listitem [ref=f5e553]:
                - generic [ref=f5e559]:
                  - paragraph [ref=f5e560]:
                    - text: Vente en ligne
                    - generic [ref=f5e561]: (crédit)
                  - paragraph [ref=f5e562]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e563]:
                    - time [ref=f5e564]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e565]:
                      - text: · en attente, disponible le
                      - time [ref=f5e566]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e567]: + 9 000 F CFA
              - listitem [ref=f5e568]:
                - generic [ref=f5e574]:
                  - paragraph [ref=f5e575]:
                    - text: Vente en ligne
                    - generic [ref=f5e576]: (crédit)
                  - paragraph [ref=f5e577]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e578]:
                    - time [ref=f5e579]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e580]:
                      - text: · en attente, disponible le
                      - time [ref=f5e581]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e582]: + 30 000 F CFA
              - listitem [ref=f5e583]:
                - generic [ref=f5e589]:
                  - paragraph [ref=f5e590]:
                    - text: Vente en ligne
                    - generic [ref=f5e591]: (crédit)
                  - paragraph [ref=f5e592]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e593]:
                    - time [ref=f5e594]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e595]:
                      - text: · en attente, disponible le
                      - time [ref=f5e596]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e597]: + 15 000 F CFA
              - listitem [ref=f5e598]:
                - generic [ref=f5e604]:
                  - paragraph [ref=f5e605]:
                    - text: Vente en ligne
                    - generic [ref=f5e606]: (crédit)
                  - paragraph [ref=f5e607]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e608]:
                    - time [ref=f5e609]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e610]:
                      - text: · en attente, disponible le
                      - time [ref=f5e611]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e612]: + 15 000 F CFA
              - listitem [ref=f5e613]:
                - generic [ref=f5e619]:
                  - paragraph [ref=f5e620]:
                    - text: Vente en ligne
                    - generic [ref=f5e621]: (crédit)
                  - paragraph [ref=f5e622]: « Croisière musicale vers Gorée »
                  - paragraph [ref=f5e623]:
                    - time [ref=f5e624]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e625]:
                      - text: · en attente, disponible le
                      - time [ref=f5e626]: sam. 21 nov. 2026 à 17:45
                - generic [ref=f5e627]: + 30 000 F CFA
              - listitem [ref=f5e628]:
                - generic [ref=f5e634]:
                  - paragraph [ref=f5e635]:
                    - text: Vente en ligne
                    - generic [ref=f5e636]: (crédit)
                  - paragraph [ref=f5e637]: « Soirée Kora & Lumières »
                  - paragraph [ref=f5e638]:
                    - time [ref=f5e639]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e640]:
                      - text: · en attente, disponible le
                      - time [ref=f5e641]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f5e642]: + 12 000 F CFA
              - listitem [ref=f5e643]:
                - generic [ref=f5e649]:
                  - paragraph [ref=f5e650]:
                    - text: Vente en ligne
                    - generic [ref=f5e651]: (crédit)
                  - paragraph [ref=f5e652]: « Soirée Kora & Lumières »
                  - paragraph [ref=f5e653]:
                    - time [ref=f5e654]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e655]:
                      - text: · en attente, disponible le
                      - time [ref=f5e656]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f5e657]: + 12 000 F CFA
              - listitem [ref=f5e658]:
                - generic [ref=f5e664]:
                  - paragraph [ref=f5e665]:
                    - text: Vente en ligne
                    - generic [ref=f5e666]: (crédit)
                  - paragraph [ref=f5e667]: « Soirée Kora & Lumières »
                  - paragraph [ref=f5e668]:
                    - time [ref=f5e669]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e670]:
                      - text: · en attente, disponible le
                      - time [ref=f5e671]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f5e672]: + 6 000 F CFA
              - listitem [ref=f5e673]:
                - generic [ref=f5e679]:
                  - paragraph [ref=f5e680]:
                    - text: Vente en ligne
                    - generic [ref=f5e681]: (crédit)
                  - paragraph [ref=f5e682]: « Soirée Kora & Lumières »
                  - paragraph [ref=f5e683]:
                    - time [ref=f5e684]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e685]:
                      - text: · en attente, disponible le
                      - time [ref=f5e686]: mar. 8 déc. 2026 à 23:30
                - generic [ref=f5e687]: + 12 000 F CFA
              - listitem [ref=f5e688]:
                - generic [ref=f5e694]:
                  - paragraph [ref=f5e695]:
                    - text: Vente en ligne
                    - generic [ref=f5e696]: (crédit)
                  - paragraph [ref=f5e697]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e698]:
                    - time [ref=f5e699]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e700]:
                      - text: · en attente, disponible le
                      - time [ref=f5e701]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e702]: + 12 000 F CFA
              - listitem [ref=f5e703]:
                - generic [ref=f5e709]:
                  - paragraph [ref=f5e710]:
                    - text: Vente en ligne
                    - generic [ref=f5e711]: (crédit)
                  - paragraph [ref=f5e712]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e713]:
                    - time [ref=f5e714]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e715]:
                      - text: · en attente, disponible le
                      - time [ref=f5e716]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e717]: + 24 000 F CFA
              - listitem [ref=f5e718]:
                - generic [ref=f5e724]:
                  - paragraph [ref=f5e725]:
                    - text: Vente en ligne
                    - generic [ref=f5e726]: (crédit)
                  - paragraph [ref=f5e727]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e728]:
                    - time [ref=f5e729]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e730]:
                      - text: · en attente, disponible le
                      - time [ref=f5e731]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e732]: + 12 000 F CFA
              - listitem [ref=f5e733]:
                - generic [ref=f5e739]:
                  - paragraph [ref=f5e740]:
                    - text: Vente en ligne
                    - generic [ref=f5e741]: (crédit)
                  - paragraph [ref=f5e742]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e743]:
                    - time [ref=f5e744]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e745]:
                      - text: · en attente, disponible le
                      - time [ref=f5e746]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e747]: + 12 000 F CFA
              - listitem [ref=f5e748]:
                - generic [ref=f5e754]:
                  - paragraph [ref=f5e755]:
                    - text: Vente en ligne
                    - generic [ref=f5e756]: (crédit)
                  - paragraph [ref=f5e757]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e758]:
                    - time [ref=f5e759]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e760]:
                      - text: · en attente, disponible le
                      - time [ref=f5e761]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e762]: + 24 000 F CFA
              - listitem [ref=f5e763]:
                - generic [ref=f5e769]:
                  - paragraph [ref=f5e770]:
                    - text: Vente en ligne
                    - generic [ref=f5e771]: (crédit)
                  - paragraph [ref=f5e772]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e773]:
                    - time [ref=f5e774]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e775]:
                      - text: · en attente, disponible le
                      - time [ref=f5e776]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e777]: + 12 000 F CFA
              - listitem [ref=f5e778]:
                - generic [ref=f5e784]:
                  - paragraph [ref=f5e785]:
                    - text: Vente en ligne
                    - generic [ref=f5e786]: (crédit)
                  - paragraph [ref=f5e787]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e788]:
                    - time [ref=f5e789]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e790]:
                      - text: · en attente, disponible le
                      - time [ref=f5e791]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e792]: + 7 500 F CFA
              - listitem [ref=f5e793]:
                - generic [ref=f5e799]:
                  - paragraph [ref=f5e800]:
                    - text: Vente en ligne
                    - generic [ref=f5e801]: (crédit)
                  - paragraph [ref=f5e802]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e803]:
                    - time [ref=f5e804]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e805]:
                      - text: · en attente, disponible le
                      - time [ref=f5e806]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e807]: + 15 000 F CFA
              - listitem [ref=f5e808]:
                - generic [ref=f5e814]:
                  - paragraph [ref=f5e815]:
                    - text: Vente en ligne
                    - generic [ref=f5e816]: (crédit)
                  - paragraph [ref=f5e817]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e818]:
                    - time [ref=f5e819]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e820]:
                      - text: · en attente, disponible le
                      - time [ref=f5e821]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e822]: + 7 500 F CFA
              - listitem [ref=f5e823]:
                - generic [ref=f5e829]:
                  - paragraph [ref=f5e830]:
                    - text: Vente en ligne
                    - generic [ref=f5e831]: (crédit)
                  - paragraph [ref=f5e832]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e833]:
                    - time [ref=f5e834]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e835]:
                      - text: · en attente, disponible le
                      - time [ref=f5e836]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e837]: + 22 500 F CFA
              - listitem [ref=f5e838]:
                - generic [ref=f5e844]:
                  - paragraph [ref=f5e845]:
                    - text: Vente en ligne
                    - generic [ref=f5e846]: (crédit)
                  - paragraph [ref=f5e847]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e848]:
                    - time [ref=f5e849]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e850]:
                      - text: · en attente, disponible le
                      - time [ref=f5e851]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e852]: + 15 000 F CFA
              - listitem [ref=f5e853]:
                - generic [ref=f5e859]:
                  - paragraph [ref=f5e860]:
                    - text: Vente en ligne
                    - generic [ref=f5e861]: (crédit)
                  - paragraph [ref=f5e862]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e863]:
                    - time [ref=f5e864]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e865]:
                      - text: · en attente, disponible le
                      - time [ref=f5e866]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e867]: + 7 500 F CFA
              - listitem [ref=f5e868]:
                - generic [ref=f5e874]:
                  - paragraph [ref=f5e875]:
                    - text: Vente en ligne
                    - generic [ref=f5e876]: (crédit)
                  - paragraph [ref=f5e877]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e878]:
                    - time [ref=f5e879]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e880]:
                      - text: · en attente, disponible le
                      - time [ref=f5e881]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e882]: + 7 500 F CFA
              - listitem [ref=f5e883]:
                - generic [ref=f5e889]:
                  - paragraph [ref=f5e890]:
                    - text: Vente en ligne
                    - generic [ref=f5e891]: (crédit)
                  - paragraph [ref=f5e892]: « Festival Jazz sur le Fleuve »
                  - paragraph [ref=f5e893]:
                    - time [ref=f5e894]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e895]:
                      - text: · en attente, disponible le
                      - time [ref=f5e896]: ven. 4 déc. 2026 à 00:00
                - generic [ref=f5e897]: + 15 000 F CFA
              - listitem [ref=f5e898]:
                - generic [ref=f5e904]:
                  - paragraph [ref=f5e905]:
                    - text: Vente en ligne
                    - generic [ref=f5e906]: (crédit)
                  - paragraph [ref=f5e907]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f5e908]:
                    - time [ref=f5e909]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e910]:
                      - text: · en attente, disponible le
                      - time [ref=f5e911]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f5e912]: + 24 000 F CFA
              - listitem [ref=f5e913]:
                - generic [ref=f5e919]:
                  - paragraph [ref=f5e920]:
                    - text: Vente en ligne
                    - generic [ref=f5e921]: (crédit)
                  - paragraph [ref=f5e922]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f5e923]:
                    - time [ref=f5e924]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e925]:
                      - text: · en attente, disponible le
                      - time [ref=f5e926]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f5e927]: + 12 000 F CFA
              - listitem [ref=f5e928]:
                - generic [ref=f5e934]:
                  - paragraph [ref=f5e935]:
                    - text: Vente en ligne
                    - generic [ref=f5e936]: (crédit)
                  - paragraph [ref=f5e937]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f5e938]:
                    - time [ref=f5e939]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e940]:
                      - text: · en attente, disponible le
                      - time [ref=f5e941]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f5e942]: + 6 000 F CFA
              - listitem [ref=f5e943]:
                - generic [ref=f5e949]:
                  - paragraph [ref=f5e950]:
                    - text: Vente en ligne
                    - generic [ref=f5e951]: (crédit)
                  - paragraph [ref=f5e952]: « Concert des Lumières de Gorée »
                  - paragraph [ref=f5e953]:
                    - time [ref=f5e954]: jeu. 19 nov. 2026 à 10:34
                    - generic [ref=f5e955]:
                      - text: · en attente, disponible le
                      - time [ref=f5e956]: dim. 22 nov. 2026 à 10:45
                - generic [ref=f5e957]: + 18 000 F CFA
  - alert [ref=f5e958]
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
      |                                                                                        ^ Error: contrôles responsive de org-finance (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```