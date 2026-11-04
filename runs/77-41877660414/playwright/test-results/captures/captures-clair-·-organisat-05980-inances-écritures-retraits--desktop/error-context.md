# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-finances — Partenaire — finances (écritures, retraits)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de partenaire-finances__ordinateur__clair.png

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
          - button "Basculer le thème" [ref=e88] [cursor=pointer]
    - generic [ref=e92]:
      - banner [ref=e93]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e95] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 97 non lues" [ref=e102] [cursor=pointer]:
          - generic [ref=e106]: "97"
      - main [ref=e107]:
        - generic [ref=e109]:
          - generic [ref=e111]:
            - generic [ref=e112]:
              - heading "Finances" [level=1] [ref=e113]
              - paragraph [ref=e114]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=e115]:
              - link "Statistiques de ventes" [ref=e116] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=e121] [cursor=pointer]
          - region [ref=e129]:
            - heading "Soldes" [level=2] [ref=e130]
            - generic [ref=e131]:
              - paragraph [ref=e132]: Disponible au retrait
              - paragraph [ref=e133]: 0 F CFA
              - paragraph [ref=e134]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=e135]:
              - generic [ref=e136]:
                - paragraph [ref=e138]: En attente
                - paragraph [ref=e143]: 828 000 F CFA
                - paragraph [ref=e144]: "Prochaine disponibilité : ven. 6 nov. 2026 à 23:30."
              - generic [ref=e145]:
                - paragraph [ref=e147]: Retraits en cours
                - paragraph [ref=e152]: 0 F CFA
                - paragraph [ref=e153]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e154]:
                - paragraph [ref=e156]: Créance
                - paragraph [ref=e161]: 0 F CFA
                - paragraph [ref=e162]: Aucune somme à compenser.
          - region [ref=e163]:
            - generic [ref=e164]:
              - heading "Demander un retrait" [level=2] [ref=e165]
              - paragraph [ref=e169]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e170]:
              - listitem [ref=e171]:
                - generic [aria-hidden] [ref=e172]: "1"
                - generic [ref=e173]: Demande
              - listitem [ref=e175]:
                - generic [aria-hidden] [ref=e176]: "2"
                - generic [ref=e177]: Code SMS
              - listitem [ref=e179]:
                - generic [aria-hidden] [ref=e180]: "3"
                - generic [ref=e181]: Suivi
            - generic [ref=e182]:
              - group "Recevoir sur" [ref=e183]:
                - generic [ref=e184]: Recevoir sur *
                - generic [ref=e185]:
                  - generic [ref=e186] [cursor=pointer]:
                    - radio "Wave" [ref=e187]
                    - generic [ref=e188]:
                      - generic [aria-hidden] [ref=e189]: W
                      - generic [ref=e190]: Wave
                  - generic [ref=e191] [cursor=pointer]:
                    - radio "Orange Money" [ref=e192]
                    - generic [ref=e193]:
                      - generic [aria-hidden] [ref=e194]: OM
                      - generic [ref=e195]: Orange Money
              - generic [ref=e196]:
                - generic [ref=e198]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=e199]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=e200]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=e201]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e202]:
                - generic [ref=e204]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=e205]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=e206]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=e207]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e208]
          - region [ref=e214]:
            - generic [ref=e215]:
              - heading "Mes retraits" [level=2] [ref=e216]
              - paragraph [ref=e217]: Vos 20 dernières demandes.
            - generic [ref=e218]:
              - heading "Aucun retrait" [level=3] [ref=e223]
              - paragraph [ref=e224]: Vous n’avez pas encore demandé de retrait.
          - region [ref=e225]:
            - generic [ref=e226]:
              - heading "Historique du compte" [level=2] [ref=e227]
              - paragraph [ref=e228]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=e229]:
              - listitem [ref=e230]:
                - generic [ref=e236]:
                  - paragraph [ref=e237]:
                    - text: Remboursement d’un billet
                    - generic [ref=e238]: (débit)
                  - paragraph [ref=e239]: Remboursement REFUND-05bbecb7-5bd8-4747-9cdf-6bd9920f0fa4 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e240]:
                    - time [ref=e241]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e242]: − 15 000 F CFA
              - listitem [ref=e243]:
                - generic [ref=e249]:
                  - paragraph [ref=e250]:
                    - text: Remboursement d’un billet
                    - generic [ref=e251]: (débit)
                  - paragraph [ref=e252]: Remboursement REFUND-db7d31b9-3a45-4d22-aa18-8c92cc561f25 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e253]:
                    - time [ref=e254]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e255]: − 9 000 F CFA
              - listitem [ref=e256]:
                - generic [ref=e262]:
                  - paragraph [ref=e263]:
                    - text: Remboursement d’un billet
                    - generic [ref=e264]: (débit)
                  - paragraph [ref=e265]: Remboursement REFUND-d9d9af90-f7c7-48d5-b328-a8ae269a4358 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e266]:
                    - time [ref=e267]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e268]: − 30 000 F CFA
              - listitem [ref=e269]:
                - generic [ref=e275]:
                  - paragraph [ref=e276]:
                    - text: Remboursement d’un billet
                    - generic [ref=e277]: (débit)
                  - paragraph [ref=e278]: Remboursement REFUND-b070bf40-493c-4f16-8b61-cf04f0389bd5 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e279]:
                    - time [ref=e280]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e281]: − 15 000 F CFA
              - listitem [ref=e282]:
                - generic [ref=e288]:
                  - paragraph [ref=e289]:
                    - text: Remboursement d’un billet
                    - generic [ref=e290]: (débit)
                  - paragraph [ref=e291]: Remboursement REFUND-ac7a0774-a60b-4d4f-8174-f9189313dec7 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e292]:
                    - time [ref=e293]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e294]: − 15 000 F CFA
              - listitem [ref=e295]:
                - generic [ref=e301]:
                  - paragraph [ref=e302]:
                    - text: Remboursement d’un billet
                    - generic [ref=e303]: (débit)
                  - paragraph [ref=e304]: Remboursement REFUND-827af424-4e78-4e18-894e-6ba73d48c763 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e305]:
                    - time [ref=e306]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e307]: − 30 000 F CFA
              - listitem [ref=e308]:
                - generic [ref=e314]:
                  - paragraph [ref=e315]:
                    - text: Remboursement d’un billet
                    - generic [ref=e316]: (débit)
                  - paragraph [ref=e317]: Remboursement REFUND-1cad3c39-d95c-483e-8645-286279c48f77 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e318]:
                    - time [ref=e319]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e320]: − 9 000 F CFA
              - listitem [ref=e321]:
                - generic [ref=e327]:
                  - paragraph [ref=e328]:
                    - text: Remboursement d’un billet
                    - generic [ref=e329]: (débit)
                  - paragraph [ref=e330]: Remboursement REFUND-09ceee00-009b-40cb-9363-777b7d821ca0 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e331]:
                    - time [ref=e332]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e333]: − 18 000 F CFA
              - listitem [ref=e334]:
                - generic [ref=e340]:
                  - paragraph [ref=e341]:
                    - text: Remboursement d’un billet
                    - generic [ref=e342]: (débit)
                  - paragraph [ref=e343]: Remboursement REFUND-08189d95-0f9b-40d9-9a65-0faf1035740d (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e344]:
                    - time [ref=e345]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e346]: − 9 000 F CFA
              - listitem [ref=e347]:
                - generic [ref=e353]:
                  - paragraph [ref=e354]:
                    - text: Vente en ligne
                    - generic [ref=e355]: (crédit)
                  - paragraph [ref=e356]: Vente en ligne TX-EV-1793814291005-489D9030 (TICKET)
                  - paragraph [ref=e357]:
                    - time [ref=e358]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e359]:
                      - text: · en attente, disponible le
                      - time [ref=e360]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e361]: + 6 000 F CFA
              - listitem [ref=e362]:
                - generic [ref=e368]:
                  - paragraph [ref=e369]:
                    - text: Vente en ligne
                    - generic [ref=e370]: (crédit)
                  - paragraph [ref=e371]: Vente en ligne TX-EV-1793814290978-D519605D (TICKET)
                  - paragraph [ref=e372]:
                    - time [ref=e373]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e374]:
                      - text: · en attente, disponible le
                      - time [ref=e375]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e376]: + 15 000 F CFA
              - listitem [ref=e377]:
                - generic [ref=e383]:
                  - paragraph [ref=e384]:
                    - text: Vente en ligne
                    - generic [ref=e385]: (crédit)
                  - paragraph [ref=e386]: Vente en ligne TX-EV-1793814290951-F6EABE43 (TICKET)
                  - paragraph [ref=e387]:
                    - time [ref=e388]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e389]:
                      - text: · en attente, disponible le
                      - time [ref=e390]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e391]: + 15 000 F CFA
              - listitem [ref=e392]:
                - generic [ref=e398]:
                  - paragraph [ref=e399]:
                    - text: Vente en ligne
                    - generic [ref=e400]: (crédit)
                  - paragraph [ref=e401]: Vente en ligne TX-EV-1793814290924-57A7A018 (TICKET)
                  - paragraph [ref=e402]:
                    - time [ref=e403]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e404]:
                      - text: · en attente, disponible le
                      - time [ref=e405]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e406]: + 7 500 F CFA
              - listitem [ref=e407]:
                - generic [ref=e413]:
                  - paragraph [ref=e414]:
                    - text: Vente en ligne
                    - generic [ref=e415]: (crédit)
                  - paragraph [ref=e416]: Vente en ligne TX-EV-1793814290897-B0879379 (TICKET)
                  - paragraph [ref=e417]:
                    - time [ref=e418]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e419]:
                      - text: · en attente, disponible le
                      - time [ref=e420]: ven. 6 nov. 2026 à 23:30
                - generic [ref=e421]: + 10 000 F CFA
              - listitem [ref=e422]:
                - generic [ref=e428]:
                  - paragraph [ref=e429]:
                    - text: Vente en ligne
                    - generic [ref=e430]: (crédit)
                  - paragraph [ref=e431]: Vente en ligne TX-EV-1793814290659-D88A7607 (TICKET)
                  - paragraph [ref=e432]:
                    - time [ref=e433]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e434]:
                      - text: · en attente, disponible le
                      - time [ref=e435]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e436]: + 30 000 F CFA
              - listitem [ref=e437]:
                - generic [ref=e443]:
                  - paragraph [ref=e444]:
                    - text: Vente en ligne
                    - generic [ref=e445]: (crédit)
                  - paragraph [ref=e446]: Vente en ligne TX-EV-1793814290632-8931C240 (TICKET)
                  - paragraph [ref=e447]:
                    - time [ref=e448]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e449]:
                      - text: · en attente, disponible le
                      - time [ref=e450]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e451]: + 15 000 F CFA
              - listitem [ref=e452]:
                - generic [ref=e458]:
                  - paragraph [ref=e459]:
                    - text: Vente en ligne
                    - generic [ref=e460]: (crédit)
                  - paragraph [ref=e461]: Vente en ligne TX-EV-1793814290603-729E48C1 (TICKET)
                  - paragraph [ref=e462]:
                    - time [ref=e463]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e464]:
                      - text: · en attente, disponible le
                      - time [ref=e465]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e466]: + 15 000 F CFA
              - listitem [ref=e467]:
                - generic [ref=e473]:
                  - paragraph [ref=e474]:
                    - text: Vente en ligne
                    - generic [ref=e475]: (crédit)
                  - paragraph [ref=e476]: Vente en ligne TX-EV-1793814290576-9114400F (TICKET)
                  - paragraph [ref=e477]:
                    - time [ref=e478]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e479]:
                      - text: · en attente, disponible le
                      - time [ref=e480]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e481]: + 30 000 F CFA
              - listitem [ref=e482]:
                - generic [ref=e488]:
                  - paragraph [ref=e489]:
                    - text: Vente en ligne
                    - generic [ref=e490]: (crédit)
                  - paragraph [ref=e491]: Vente en ligne TX-EV-1793814290550-2E4EC1B8 (TICKET)
                  - paragraph [ref=e492]:
                    - time [ref=e493]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e494]:
                      - text: · en attente, disponible le
                      - time [ref=e495]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e496]: + 15 000 F CFA
              - listitem [ref=e497]:
                - generic [ref=e503]:
                  - paragraph [ref=e504]:
                    - text: Vente en ligne
                    - generic [ref=e505]: (crédit)
                  - paragraph [ref=e506]: Vente en ligne TX-EV-1793814290522-904D4C56 (TICKET)
                  - paragraph [ref=e507]:
                    - time [ref=e508]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e509]:
                      - text: · en attente, disponible le
                      - time [ref=e510]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e511]: + 30 000 F CFA
              - listitem [ref=e512]:
                - generic [ref=e518]:
                  - paragraph [ref=e519]:
                    - text: Vente en ligne
                    - generic [ref=e520]: (crédit)
                  - paragraph [ref=e521]: Vente en ligne TX-EV-1793814290495-957648AD (TICKET)
                  - paragraph [ref=e522]:
                    - time [ref=e523]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e524]:
                      - text: · en attente, disponible le
                      - time [ref=e525]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e526]: + 9 000 F CFA
              - listitem [ref=e527]:
                - generic [ref=e533]:
                  - paragraph [ref=e534]:
                    - text: Vente en ligne
                    - generic [ref=e535]: (crédit)
                  - paragraph [ref=e536]: Vente en ligne TX-EV-1793814290468-8A5041C5 (TICKET)
                  - paragraph [ref=e537]:
                    - time [ref=e538]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e539]:
                      - text: · en attente, disponible le
                      - time [ref=e540]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e541]: + 9 000 F CFA
              - listitem [ref=e542]:
                - generic [ref=e548]:
                  - paragraph [ref=e549]:
                    - text: Vente en ligne
                    - generic [ref=e550]: (crédit)
                  - paragraph [ref=e551]: Vente en ligne TX-EV-1793814290442-A6548739 (TICKET)
                  - paragraph [ref=e552]:
                    - time [ref=e553]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e554]:
                      - text: · en attente, disponible le
                      - time [ref=e555]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e556]: + 18 000 F CFA
              - listitem [ref=e557]:
                - generic [ref=e563]:
                  - paragraph [ref=e564]:
                    - text: Vente en ligne
                    - generic [ref=e565]: (crédit)
                  - paragraph [ref=e566]: Vente en ligne TX-EV-1793814290415-AEEC0C2E (TICKET)
                  - paragraph [ref=e567]:
                    - time [ref=e568]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e569]:
                      - text: · en attente, disponible le
                      - time [ref=e570]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e571]: + 9 000 F CFA
              - listitem [ref=e572]:
                - generic [ref=e578]:
                  - paragraph [ref=e579]:
                    - text: Vente en ligne
                    - generic [ref=e580]: (crédit)
                  - paragraph [ref=e581]: Vente en ligne TX-EV-1793814290388-C66446F5 (TICKET)
                  - paragraph [ref=e582]:
                    - time [ref=e583]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e584]:
                      - text: · en attente, disponible le
                      - time [ref=e585]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e586]: + 30 000 F CFA
              - listitem [ref=e587]:
                - generic [ref=e593]:
                  - paragraph [ref=e594]:
                    - text: Vente en ligne
                    - generic [ref=e595]: (crédit)
                  - paragraph [ref=e596]: Vente en ligne TX-EV-1793814290359-6B8DB40D (TICKET)
                  - paragraph [ref=e597]:
                    - time [ref=e598]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e599]:
                      - text: · en attente, disponible le
                      - time [ref=e600]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e601]: + 15 000 F CFA
              - listitem [ref=e602]:
                - generic [ref=e608]:
                  - paragraph [ref=e609]:
                    - text: Vente en ligne
                    - generic [ref=e610]: (crédit)
                  - paragraph [ref=e611]: Vente en ligne TX-EV-1793814290329-43096541 (TICKET)
                  - paragraph [ref=e612]:
                    - time [ref=e613]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e614]:
                      - text: · en attente, disponible le
                      - time [ref=e615]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e616]: + 15 000 F CFA
              - listitem [ref=e617]:
                - generic [ref=e623]:
                  - paragraph [ref=e624]:
                    - text: Vente en ligne
                    - generic [ref=e625]: (crédit)
                  - paragraph [ref=e626]: Vente en ligne TX-EV-1793814290301-9FA5031C (TICKET)
                  - paragraph [ref=e627]:
                    - time [ref=e628]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e629]:
                      - text: · en attente, disponible le
                      - time [ref=e630]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e631]: + 30 000 F CFA
              - listitem [ref=e632]:
                - generic [ref=e638]:
                  - paragraph [ref=e639]:
                    - text: Vente en ligne
                    - generic [ref=e640]: (crédit)
                  - paragraph [ref=e641]: Vente en ligne TX-EV-1793814290077-97910F88 (TICKET)
                  - paragraph [ref=e642]:
                    - time [ref=e643]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e644]:
                      - text: · en attente, disponible le
                      - time [ref=e645]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e646]: + 12 000 F CFA
              - listitem [ref=e647]:
                - generic [ref=e653]:
                  - paragraph [ref=e654]:
                    - text: Vente en ligne
                    - generic [ref=e655]: (crédit)
                  - paragraph [ref=e656]: Vente en ligne TX-EV-1793814290051-83B0666F (TICKET)
                  - paragraph [ref=e657]:
                    - time [ref=e658]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e659]:
                      - text: · en attente, disponible le
                      - time [ref=e660]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e661]: + 12 000 F CFA
              - listitem [ref=e662]:
                - generic [ref=e668]:
                  - paragraph [ref=e669]:
                    - text: Vente en ligne
                    - generic [ref=e670]: (crédit)
                  - paragraph [ref=e671]: Vente en ligne TX-EV-1793814290024-6A6C6EE5 (TICKET)
                  - paragraph [ref=e672]:
                    - time [ref=e673]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e674]:
                      - text: · en attente, disponible le
                      - time [ref=e675]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e676]: + 6 000 F CFA
              - listitem [ref=e677]:
                - generic [ref=e683]:
                  - paragraph [ref=e684]:
                    - text: Vente en ligne
                    - generic [ref=e685]: (crédit)
                  - paragraph [ref=e686]: Vente en ligne TX-EV-1793814289997-BD60FF77 (TICKET)
                  - paragraph [ref=e687]:
                    - time [ref=e688]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e689]:
                      - text: · en attente, disponible le
                      - time [ref=e690]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e691]: + 12 000 F CFA
              - listitem [ref=e692]:
                - generic [ref=e698]:
                  - paragraph [ref=e699]:
                    - text: Vente en ligne
                    - generic [ref=e700]: (crédit)
                  - paragraph [ref=e701]: Vente en ligne TX-EV-1793814289119-7D3793EC (TICKET)
                  - paragraph [ref=e702]:
                    - time [ref=e703]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e704]:
                      - text: · en attente, disponible le
                      - time [ref=e705]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e706]: + 12 000 F CFA
              - listitem [ref=e707]:
                - generic [ref=e713]:
                  - paragraph [ref=e714]:
                    - text: Vente en ligne
                    - generic [ref=e715]: (crédit)
                  - paragraph [ref=e716]: Vente en ligne TX-EV-1793814289091-0DAFEEA9 (TICKET)
                  - paragraph [ref=e717]:
                    - time [ref=e718]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e719]:
                      - text: · en attente, disponible le
                      - time [ref=e720]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e721]: + 24 000 F CFA
              - listitem [ref=e722]:
                - generic [ref=e728]:
                  - paragraph [ref=e729]:
                    - text: Vente en ligne
                    - generic [ref=e730]: (crédit)
                  - paragraph [ref=e731]: Vente en ligne TX-EV-1793814289059-9BEAEEB5 (TICKET)
                  - paragraph [ref=e732]:
                    - time [ref=e733]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e734]:
                      - text: · en attente, disponible le
                      - time [ref=e735]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e736]: + 12 000 F CFA
              - listitem [ref=e737]:
                - generic [ref=e743]:
                  - paragraph [ref=e744]:
                    - text: Vente en ligne
                    - generic [ref=e745]: (crédit)
                  - paragraph [ref=e746]: Vente en ligne TX-EV-1793814289030-E5924171 (TICKET)
                  - paragraph [ref=e747]:
                    - time [ref=e748]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e749]:
                      - text: · en attente, disponible le
                      - time [ref=e750]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e751]: + 12 000 F CFA
              - listitem [ref=e752]:
                - generic [ref=e758]:
                  - paragraph [ref=e759]:
                    - text: Vente en ligne
                    - generic [ref=e760]: (crédit)
                  - paragraph [ref=e761]: Vente en ligne TX-EV-1793814289002-4142B4FC (TICKET)
                  - paragraph [ref=e762]:
                    - time [ref=e763]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e764]:
                      - text: · en attente, disponible le
                      - time [ref=e765]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e766]: + 24 000 F CFA
              - listitem [ref=e767]:
                - generic [ref=e773]:
                  - paragraph [ref=e774]:
                    - text: Vente en ligne
                    - generic [ref=e775]: (crédit)
                  - paragraph [ref=e776]: Vente en ligne TX-EV-1793814288975-F49841F0 (TICKET)
                  - paragraph [ref=e777]:
                    - time [ref=e778]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e779]:
                      - text: · en attente, disponible le
                      - time [ref=e780]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e781]: + 12 000 F CFA
              - listitem [ref=e782]:
                - generic [ref=e788]:
                  - paragraph [ref=e789]:
                    - text: Vente en ligne
                    - generic [ref=e790]: (crédit)
                  - paragraph [ref=e791]: Vente en ligne TX-EV-1793814288947-A6DD67C3 (TICKET)
                  - paragraph [ref=e792]:
                    - time [ref=e793]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e794]:
                      - text: · en attente, disponible le
                      - time [ref=e795]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e796]: + 7 500 F CFA
              - listitem [ref=e797]:
                - generic [ref=e803]:
                  - paragraph [ref=e804]:
                    - text: Vente en ligne
                    - generic [ref=e805]: (crédit)
                  - paragraph [ref=e806]: Vente en ligne TX-EV-1793814288913-C0833707 (TICKET)
                  - paragraph [ref=e807]:
                    - time [ref=e808]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e809]:
                      - text: · en attente, disponible le
                      - time [ref=e810]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e811]: + 15 000 F CFA
              - listitem [ref=e812]:
                - generic [ref=e818]:
                  - paragraph [ref=e819]:
                    - text: Vente en ligne
                    - generic [ref=e820]: (crédit)
                  - paragraph [ref=e821]: Vente en ligne TX-EV-1793814288882-D4FFE400 (TICKET)
                  - paragraph [ref=e822]:
                    - time [ref=e823]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e824]:
                      - text: · en attente, disponible le
                      - time [ref=e825]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e826]: + 7 500 F CFA
              - listitem [ref=e827]:
                - generic [ref=e833]:
                  - paragraph [ref=e834]:
                    - text: Vente en ligne
                    - generic [ref=e835]: (crédit)
                  - paragraph [ref=e836]: Vente en ligne TX-EV-1793814288855-1A5C99B3 (TICKET)
                  - paragraph [ref=e837]:
                    - time [ref=e838]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e839]:
                      - text: · en attente, disponible le
                      - time [ref=e840]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e841]: + 22 500 F CFA
              - listitem [ref=e842]:
                - generic [ref=e848]:
                  - paragraph [ref=e849]:
                    - text: Vente en ligne
                    - generic [ref=e850]: (crédit)
                  - paragraph [ref=e851]: Vente en ligne TX-EV-1793814288828-58514D48 (TICKET)
                  - paragraph [ref=e852]:
                    - time [ref=e853]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e854]:
                      - text: · en attente, disponible le
                      - time [ref=e855]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e856]: + 15 000 F CFA
              - listitem [ref=e857]:
                - generic [ref=e863]:
                  - paragraph [ref=e864]:
                    - text: Vente en ligne
                    - generic [ref=e865]: (crédit)
                  - paragraph [ref=e866]: Vente en ligne TX-EV-1793814288801-2CCC2A98 (TICKET)
                  - paragraph [ref=e867]:
                    - time [ref=e868]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e869]:
                      - text: · en attente, disponible le
                      - time [ref=e870]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e871]: + 7 500 F CFA
              - listitem [ref=e872]:
                - generic [ref=e878]:
                  - paragraph [ref=e879]:
                    - text: Vente en ligne
                    - generic [ref=e880]: (crédit)
                  - paragraph [ref=e881]: Vente en ligne TX-EV-1793814288771-FDD6BE93 (TICKET)
                  - paragraph [ref=e882]:
                    - time [ref=e883]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e884]:
                      - text: · en attente, disponible le
                      - time [ref=e885]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e886]: + 7 500 F CFA
              - listitem [ref=e887]:
                - generic [ref=e893]:
                  - paragraph [ref=e894]:
                    - text: Vente en ligne
                    - generic [ref=e895]: (crédit)
                  - paragraph [ref=e896]: Vente en ligne TX-EV-1793814288743-20E83DD7 (TICKET)
                  - paragraph [ref=e897]:
                    - time [ref=e898]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e899]:
                      - text: · en attente, disponible le
                      - time [ref=e900]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e901]: + 15 000 F CFA
              - listitem [ref=e902]:
                - generic [ref=e908]:
                  - paragraph [ref=e909]:
                    - text: Vente en ligne
                    - generic [ref=e910]: (crédit)
                  - paragraph [ref=e911]: Vente en ligne TX-EV-1793814288716-14596DF8 (TICKET)
                  - paragraph [ref=e912]:
                    - time [ref=e913]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e914]:
                      - text: · en attente, disponible le
                      - time [ref=e915]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e916]: + 24 000 F CFA
              - listitem [ref=e917]:
                - generic [ref=e923]:
                  - paragraph [ref=e924]:
                    - text: Vente en ligne
                    - generic [ref=e925]: (crédit)
                  - paragraph [ref=e926]: Vente en ligne TX-EV-1793814288690-C893D058 (TICKET)
                  - paragraph [ref=e927]:
                    - time [ref=e928]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e929]:
                      - text: · en attente, disponible le
                      - time [ref=e930]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e931]: + 12 000 F CFA
              - listitem [ref=e932]:
                - generic [ref=e938]:
                  - paragraph [ref=e939]:
                    - text: Vente en ligne
                    - generic [ref=e940]: (crédit)
                  - paragraph [ref=e941]: Vente en ligne TX-EV-1793814288660-595AC62E (TICKET)
                  - paragraph [ref=e942]:
                    - time [ref=e943]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e944]:
                      - text: · en attente, disponible le
                      - time [ref=e945]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e946]: + 6 000 F CFA
              - listitem [ref=e947]:
                - generic [ref=e953]:
                  - paragraph [ref=e954]:
                    - text: Vente en ligne
                    - generic [ref=e955]: (crédit)
                  - paragraph [ref=e956]: Vente en ligne TX-EV-1793814288633-B80707C3 (TICKET)
                  - paragraph [ref=e957]:
                    - time [ref=e958]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e959]:
                      - text: · en attente, disponible le
                      - time [ref=e960]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e961]: + 18 000 F CFA
  - alert [ref=e962]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-finances__ordinateur__clair.png
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