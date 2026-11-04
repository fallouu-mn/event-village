# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-finances — Partenaire — finances (écritures, retraits)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de partenaire-finances__mobile__sombre.png

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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 97 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "97"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: MN
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - heading "Finances" [level=1] [ref=e41]
              - paragraph [ref=e42]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=e43]:
              - link "Statistiques de ventes" [ref=e44] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=e49] [cursor=pointer]
          - region [ref=e57]:
            - heading "Soldes" [level=2] [ref=e58]
            - generic [ref=e59]:
              - paragraph [ref=e60]: Disponible au retrait
              - paragraph [ref=e61]: 0 F CFA
              - paragraph [ref=e62]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=e63]:
              - generic [ref=e64]:
                - paragraph [ref=e66]: En attente
                - paragraph [ref=e71]: 828 000 F CFA
                - paragraph [ref=e72]: "Prochaine disponibilité : ven. 6 nov. 2026 à 23:30."
              - generic [ref=e73]:
                - paragraph [ref=e75]: Retraits en cours
                - paragraph [ref=e80]: 0 F CFA
                - paragraph [ref=e81]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e82]:
                - paragraph [ref=e84]: Créance
                - paragraph [ref=e89]: 0 F CFA
                - paragraph [ref=e90]: Aucune somme à compenser.
          - region [ref=e91]:
            - generic [ref=e92]:
              - heading "Demander un retrait" [level=2] [ref=e93]
              - paragraph [ref=e97]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e98]:
              - listitem [ref=e99]:
                - generic [aria-hidden] [ref=e100]: "1"
                - generic [ref=e101]: Demande
              - listitem [ref=e103]:
                - generic [aria-hidden] [ref=e104]: "2"
                - generic [ref=e105]: Code SMS
              - listitem [ref=e107]:
                - generic [aria-hidden] [ref=e108]: "3"
                - generic [ref=e109]: Suivi
            - generic [ref=e110]:
              - group "Recevoir sur" [ref=e111]:
                - generic [ref=e112]: Recevoir sur *
                - generic [ref=e113]:
                  - generic [ref=e114] [cursor=pointer]:
                    - radio "Wave" [ref=e115]
                    - generic [ref=e116]:
                      - generic [aria-hidden] [ref=e117]: W
                      - generic [ref=e118]: Wave
                  - generic [ref=e119] [cursor=pointer]:
                    - radio "Orange Money" [ref=e120]
                    - generic [ref=e121]:
                      - generic [aria-hidden] [ref=e122]: OM
                      - generic [ref=e123]: Orange Money
              - generic [ref=e124]:
                - generic [ref=e126]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=e127]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=e128]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=e129]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e130]:
                - generic [ref=e132]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=e133]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=e134]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=e135]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e136]
          - region [ref=e142]:
            - generic [ref=e143]:
              - heading "Mes retraits" [level=2] [ref=e144]
              - paragraph [ref=e145]: Vos 20 dernières demandes.
            - generic [ref=e146]:
              - heading "Aucun retrait" [level=3] [ref=e151]
              - paragraph [ref=e152]: Vous n’avez pas encore demandé de retrait.
          - region [ref=e153]:
            - generic [ref=e154]:
              - heading "Historique du compte" [level=2] [ref=e155]
              - paragraph [ref=e156]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=e157]:
              - listitem [ref=e158]:
                - generic [ref=e164]:
                  - paragraph [ref=e165]:
                    - text: Remboursement d’un billet
                    - generic [ref=e166]: (débit)
                  - paragraph [ref=e167]: Remboursement REFUND-05bbecb7-5bd8-4747-9cdf-6bd9920f0fa4 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e168]:
                    - time [ref=e169]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e170]: − 15 000 F CFA
              - listitem [ref=e171]:
                - generic [ref=e177]:
                  - paragraph [ref=e178]:
                    - text: Remboursement d’un billet
                    - generic [ref=e179]: (débit)
                  - paragraph [ref=e180]: Remboursement REFUND-db7d31b9-3a45-4d22-aa18-8c92cc561f25 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e181]:
                    - time [ref=e182]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e183]: − 9 000 F CFA
              - listitem [ref=e184]:
                - generic [ref=e190]:
                  - paragraph [ref=e191]:
                    - text: Remboursement d’un billet
                    - generic [ref=e192]: (débit)
                  - paragraph [ref=e193]: Remboursement REFUND-d9d9af90-f7c7-48d5-b328-a8ae269a4358 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e194]:
                    - time [ref=e195]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e196]: − 30 000 F CFA
              - listitem [ref=e197]:
                - generic [ref=e203]:
                  - paragraph [ref=e204]:
                    - text: Remboursement d’un billet
                    - generic [ref=e205]: (débit)
                  - paragraph [ref=e206]: Remboursement REFUND-b070bf40-493c-4f16-8b61-cf04f0389bd5 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e207]:
                    - time [ref=e208]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e209]: − 15 000 F CFA
              - listitem [ref=e210]:
                - generic [ref=e216]:
                  - paragraph [ref=e217]:
                    - text: Remboursement d’un billet
                    - generic [ref=e218]: (débit)
                  - paragraph [ref=e219]: Remboursement REFUND-ac7a0774-a60b-4d4f-8174-f9189313dec7 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e220]:
                    - time [ref=e221]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e222]: − 15 000 F CFA
              - listitem [ref=e223]:
                - generic [ref=e229]:
                  - paragraph [ref=e230]:
                    - text: Remboursement d’un billet
                    - generic [ref=e231]: (débit)
                  - paragraph [ref=e232]: Remboursement REFUND-827af424-4e78-4e18-894e-6ba73d48c763 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e233]:
                    - time [ref=e234]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e235]: − 30 000 F CFA
              - listitem [ref=e236]:
                - generic [ref=e242]:
                  - paragraph [ref=e243]:
                    - text: Remboursement d’un billet
                    - generic [ref=e244]: (débit)
                  - paragraph [ref=e245]: Remboursement REFUND-1cad3c39-d95c-483e-8645-286279c48f77 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e246]:
                    - time [ref=e247]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e248]: − 9 000 F CFA
              - listitem [ref=e249]:
                - generic [ref=e255]:
                  - paragraph [ref=e256]:
                    - text: Remboursement d’un billet
                    - generic [ref=e257]: (débit)
                  - paragraph [ref=e258]: Remboursement REFUND-09ceee00-009b-40cb-9363-777b7d821ca0 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e259]:
                    - time [ref=e260]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e261]: − 18 000 F CFA
              - listitem [ref=e262]:
                - generic [ref=e268]:
                  - paragraph [ref=e269]:
                    - text: Remboursement d’un billet
                    - generic [ref=e270]: (débit)
                  - paragraph [ref=e271]: Remboursement REFUND-08189d95-0f9b-40d9-9a65-0faf1035740d (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e272]:
                    - time [ref=e273]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e274]: − 9 000 F CFA
              - listitem [ref=e275]:
                - generic [ref=e281]:
                  - paragraph [ref=e282]:
                    - text: Vente en ligne
                    - generic [ref=e283]: (crédit)
                  - paragraph [ref=e284]: Vente en ligne TX-EV-1793814291005-489D9030 (TICKET)
                  - paragraph [ref=e285]:
                    - time [ref=e286]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e287]:
                      - text: · en attente, disponible le
                      - time [ref=e288]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e289]: + 6 000 F CFA
              - listitem [ref=e290]:
                - generic [ref=e296]:
                  - paragraph [ref=e297]:
                    - text: Vente en ligne
                    - generic [ref=e298]: (crédit)
                  - paragraph [ref=e299]: Vente en ligne TX-EV-1793814290978-D519605D (TICKET)
                  - paragraph [ref=e300]:
                    - time [ref=e301]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e302]:
                      - text: · en attente, disponible le
                      - time [ref=e303]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e304]: + 15 000 F CFA
              - listitem [ref=e305]:
                - generic [ref=e311]:
                  - paragraph [ref=e312]:
                    - text: Vente en ligne
                    - generic [ref=e313]: (crédit)
                  - paragraph [ref=e314]: Vente en ligne TX-EV-1793814290951-F6EABE43 (TICKET)
                  - paragraph [ref=e315]:
                    - time [ref=e316]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e317]:
                      - text: · en attente, disponible le
                      - time [ref=e318]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e319]: + 15 000 F CFA
              - listitem [ref=e320]:
                - generic [ref=e326]:
                  - paragraph [ref=e327]:
                    - text: Vente en ligne
                    - generic [ref=e328]: (crédit)
                  - paragraph [ref=e329]: Vente en ligne TX-EV-1793814290924-57A7A018 (TICKET)
                  - paragraph [ref=e330]:
                    - time [ref=e331]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e332]:
                      - text: · en attente, disponible le
                      - time [ref=e333]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e334]: + 7 500 F CFA
              - listitem [ref=e335]:
                - generic [ref=e341]:
                  - paragraph [ref=e342]:
                    - text: Vente en ligne
                    - generic [ref=e343]: (crédit)
                  - paragraph [ref=e344]: Vente en ligne TX-EV-1793814290897-B0879379 (TICKET)
                  - paragraph [ref=e345]:
                    - time [ref=e346]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e347]:
                      - text: · en attente, disponible le
                      - time [ref=e348]: ven. 6 nov. 2026 à 23:30
                - generic [ref=e349]: + 10 000 F CFA
              - listitem [ref=e350]:
                - generic [ref=e356]:
                  - paragraph [ref=e357]:
                    - text: Vente en ligne
                    - generic [ref=e358]: (crédit)
                  - paragraph [ref=e359]: Vente en ligne TX-EV-1793814290659-D88A7607 (TICKET)
                  - paragraph [ref=e360]:
                    - time [ref=e361]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e362]:
                      - text: · en attente, disponible le
                      - time [ref=e363]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e364]: + 30 000 F CFA
              - listitem [ref=e365]:
                - generic [ref=e371]:
                  - paragraph [ref=e372]:
                    - text: Vente en ligne
                    - generic [ref=e373]: (crédit)
                  - paragraph [ref=e374]: Vente en ligne TX-EV-1793814290632-8931C240 (TICKET)
                  - paragraph [ref=e375]:
                    - time [ref=e376]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e377]:
                      - text: · en attente, disponible le
                      - time [ref=e378]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e379]: + 15 000 F CFA
              - listitem [ref=e380]:
                - generic [ref=e386]:
                  - paragraph [ref=e387]:
                    - text: Vente en ligne
                    - generic [ref=e388]: (crédit)
                  - paragraph [ref=e389]: Vente en ligne TX-EV-1793814290603-729E48C1 (TICKET)
                  - paragraph [ref=e390]:
                    - time [ref=e391]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e392]:
                      - text: · en attente, disponible le
                      - time [ref=e393]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e394]: + 15 000 F CFA
              - listitem [ref=e395]:
                - generic [ref=e401]:
                  - paragraph [ref=e402]:
                    - text: Vente en ligne
                    - generic [ref=e403]: (crédit)
                  - paragraph [ref=e404]: Vente en ligne TX-EV-1793814290576-9114400F (TICKET)
                  - paragraph [ref=e405]:
                    - time [ref=e406]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e407]:
                      - text: · en attente, disponible le
                      - time [ref=e408]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e409]: + 30 000 F CFA
              - listitem [ref=e410]:
                - generic [ref=e416]:
                  - paragraph [ref=e417]:
                    - text: Vente en ligne
                    - generic [ref=e418]: (crédit)
                  - paragraph [ref=e419]: Vente en ligne TX-EV-1793814290550-2E4EC1B8 (TICKET)
                  - paragraph [ref=e420]:
                    - time [ref=e421]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e422]:
                      - text: · en attente, disponible le
                      - time [ref=e423]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e424]: + 15 000 F CFA
              - listitem [ref=e425]:
                - generic [ref=e431]:
                  - paragraph [ref=e432]:
                    - text: Vente en ligne
                    - generic [ref=e433]: (crédit)
                  - paragraph [ref=e434]: Vente en ligne TX-EV-1793814290522-904D4C56 (TICKET)
                  - paragraph [ref=e435]:
                    - time [ref=e436]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e437]:
                      - text: · en attente, disponible le
                      - time [ref=e438]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e439]: + 30 000 F CFA
              - listitem [ref=e440]:
                - generic [ref=e446]:
                  - paragraph [ref=e447]:
                    - text: Vente en ligne
                    - generic [ref=e448]: (crédit)
                  - paragraph [ref=e449]: Vente en ligne TX-EV-1793814290495-957648AD (TICKET)
                  - paragraph [ref=e450]:
                    - time [ref=e451]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e452]:
                      - text: · en attente, disponible le
                      - time [ref=e453]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e454]: + 9 000 F CFA
              - listitem [ref=e455]:
                - generic [ref=e461]:
                  - paragraph [ref=e462]:
                    - text: Vente en ligne
                    - generic [ref=e463]: (crédit)
                  - paragraph [ref=e464]: Vente en ligne TX-EV-1793814290468-8A5041C5 (TICKET)
                  - paragraph [ref=e465]:
                    - time [ref=e466]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e467]:
                      - text: · en attente, disponible le
                      - time [ref=e468]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e469]: + 9 000 F CFA
              - listitem [ref=e470]:
                - generic [ref=e476]:
                  - paragraph [ref=e477]:
                    - text: Vente en ligne
                    - generic [ref=e478]: (crédit)
                  - paragraph [ref=e479]: Vente en ligne TX-EV-1793814290442-A6548739 (TICKET)
                  - paragraph [ref=e480]:
                    - time [ref=e481]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e482]:
                      - text: · en attente, disponible le
                      - time [ref=e483]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e484]: + 18 000 F CFA
              - listitem [ref=e485]:
                - generic [ref=e491]:
                  - paragraph [ref=e492]:
                    - text: Vente en ligne
                    - generic [ref=e493]: (crédit)
                  - paragraph [ref=e494]: Vente en ligne TX-EV-1793814290415-AEEC0C2E (TICKET)
                  - paragraph [ref=e495]:
                    - time [ref=e496]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e497]:
                      - text: · en attente, disponible le
                      - time [ref=e498]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e499]: + 9 000 F CFA
              - listitem [ref=e500]:
                - generic [ref=e506]:
                  - paragraph [ref=e507]:
                    - text: Vente en ligne
                    - generic [ref=e508]: (crédit)
                  - paragraph [ref=e509]: Vente en ligne TX-EV-1793814290388-C66446F5 (TICKET)
                  - paragraph [ref=e510]:
                    - time [ref=e511]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e512]:
                      - text: · en attente, disponible le
                      - time [ref=e513]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e514]: + 30 000 F CFA
              - listitem [ref=e515]:
                - generic [ref=e521]:
                  - paragraph [ref=e522]:
                    - text: Vente en ligne
                    - generic [ref=e523]: (crédit)
                  - paragraph [ref=e524]: Vente en ligne TX-EV-1793814290359-6B8DB40D (TICKET)
                  - paragraph [ref=e525]:
                    - time [ref=e526]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e527]:
                      - text: · en attente, disponible le
                      - time [ref=e528]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e529]: + 15 000 F CFA
              - listitem [ref=e530]:
                - generic [ref=e536]:
                  - paragraph [ref=e537]:
                    - text: Vente en ligne
                    - generic [ref=e538]: (crédit)
                  - paragraph [ref=e539]: Vente en ligne TX-EV-1793814290329-43096541 (TICKET)
                  - paragraph [ref=e540]:
                    - time [ref=e541]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e542]:
                      - text: · en attente, disponible le
                      - time [ref=e543]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e544]: + 15 000 F CFA
              - listitem [ref=e545]:
                - generic [ref=e551]:
                  - paragraph [ref=e552]:
                    - text: Vente en ligne
                    - generic [ref=e553]: (crédit)
                  - paragraph [ref=e554]: Vente en ligne TX-EV-1793814290301-9FA5031C (TICKET)
                  - paragraph [ref=e555]:
                    - time [ref=e556]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e557]:
                      - text: · en attente, disponible le
                      - time [ref=e558]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e559]: + 30 000 F CFA
              - listitem [ref=e560]:
                - generic [ref=e566]:
                  - paragraph [ref=e567]:
                    - text: Vente en ligne
                    - generic [ref=e568]: (crédit)
                  - paragraph [ref=e569]: Vente en ligne TX-EV-1793814290077-97910F88 (TICKET)
                  - paragraph [ref=e570]:
                    - time [ref=e571]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e572]:
                      - text: · en attente, disponible le
                      - time [ref=e573]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e574]: + 12 000 F CFA
              - listitem [ref=e575]:
                - generic [ref=e581]:
                  - paragraph [ref=e582]:
                    - text: Vente en ligne
                    - generic [ref=e583]: (crédit)
                  - paragraph [ref=e584]: Vente en ligne TX-EV-1793814290051-83B0666F (TICKET)
                  - paragraph [ref=e585]:
                    - time [ref=e586]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e587]:
                      - text: · en attente, disponible le
                      - time [ref=e588]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e589]: + 12 000 F CFA
              - listitem [ref=e590]:
                - generic [ref=e596]:
                  - paragraph [ref=e597]:
                    - text: Vente en ligne
                    - generic [ref=e598]: (crédit)
                  - paragraph [ref=e599]: Vente en ligne TX-EV-1793814290024-6A6C6EE5 (TICKET)
                  - paragraph [ref=e600]:
                    - time [ref=e601]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e602]:
                      - text: · en attente, disponible le
                      - time [ref=e603]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e604]: + 6 000 F CFA
              - listitem [ref=e605]:
                - generic [ref=e611]:
                  - paragraph [ref=e612]:
                    - text: Vente en ligne
                    - generic [ref=e613]: (crédit)
                  - paragraph [ref=e614]: Vente en ligne TX-EV-1793814289997-BD60FF77 (TICKET)
                  - paragraph [ref=e615]:
                    - time [ref=e616]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e617]:
                      - text: · en attente, disponible le
                      - time [ref=e618]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e619]: + 12 000 F CFA
              - listitem [ref=e620]:
                - generic [ref=e626]:
                  - paragraph [ref=e627]:
                    - text: Vente en ligne
                    - generic [ref=e628]: (crédit)
                  - paragraph [ref=e629]: Vente en ligne TX-EV-1793814289119-7D3793EC (TICKET)
                  - paragraph [ref=e630]:
                    - time [ref=e631]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e632]:
                      - text: · en attente, disponible le
                      - time [ref=e633]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e634]: + 12 000 F CFA
              - listitem [ref=e635]:
                - generic [ref=e641]:
                  - paragraph [ref=e642]:
                    - text: Vente en ligne
                    - generic [ref=e643]: (crédit)
                  - paragraph [ref=e644]: Vente en ligne TX-EV-1793814289091-0DAFEEA9 (TICKET)
                  - paragraph [ref=e645]:
                    - time [ref=e646]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e647]:
                      - text: · en attente, disponible le
                      - time [ref=e648]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e649]: + 24 000 F CFA
              - listitem [ref=e650]:
                - generic [ref=e656]:
                  - paragraph [ref=e657]:
                    - text: Vente en ligne
                    - generic [ref=e658]: (crédit)
                  - paragraph [ref=e659]: Vente en ligne TX-EV-1793814289059-9BEAEEB5 (TICKET)
                  - paragraph [ref=e660]:
                    - time [ref=e661]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e662]:
                      - text: · en attente, disponible le
                      - time [ref=e663]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e664]: + 12 000 F CFA
              - listitem [ref=e665]:
                - generic [ref=e671]:
                  - paragraph [ref=e672]:
                    - text: Vente en ligne
                    - generic [ref=e673]: (crédit)
                  - paragraph [ref=e674]: Vente en ligne TX-EV-1793814289030-E5924171 (TICKET)
                  - paragraph [ref=e675]:
                    - time [ref=e676]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e677]:
                      - text: · en attente, disponible le
                      - time [ref=e678]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e679]: + 12 000 F CFA
              - listitem [ref=e680]:
                - generic [ref=e686]:
                  - paragraph [ref=e687]:
                    - text: Vente en ligne
                    - generic [ref=e688]: (crédit)
                  - paragraph [ref=e689]: Vente en ligne TX-EV-1793814289002-4142B4FC (TICKET)
                  - paragraph [ref=e690]:
                    - time [ref=e691]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e692]:
                      - text: · en attente, disponible le
                      - time [ref=e693]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e694]: + 24 000 F CFA
              - listitem [ref=e695]:
                - generic [ref=e701]:
                  - paragraph [ref=e702]:
                    - text: Vente en ligne
                    - generic [ref=e703]: (crédit)
                  - paragraph [ref=e704]: Vente en ligne TX-EV-1793814288975-F49841F0 (TICKET)
                  - paragraph [ref=e705]:
                    - time [ref=e706]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e707]:
                      - text: · en attente, disponible le
                      - time [ref=e708]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e709]: + 12 000 F CFA
              - listitem [ref=e710]:
                - generic [ref=e716]:
                  - paragraph [ref=e717]:
                    - text: Vente en ligne
                    - generic [ref=e718]: (crédit)
                  - paragraph [ref=e719]: Vente en ligne TX-EV-1793814288947-A6DD67C3 (TICKET)
                  - paragraph [ref=e720]:
                    - time [ref=e721]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e722]:
                      - text: · en attente, disponible le
                      - time [ref=e723]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e724]: + 7 500 F CFA
              - listitem [ref=e725]:
                - generic [ref=e731]:
                  - paragraph [ref=e732]:
                    - text: Vente en ligne
                    - generic [ref=e733]: (crédit)
                  - paragraph [ref=e734]: Vente en ligne TX-EV-1793814288913-C0833707 (TICKET)
                  - paragraph [ref=e735]:
                    - time [ref=e736]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e737]:
                      - text: · en attente, disponible le
                      - time [ref=e738]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e739]: + 15 000 F CFA
              - listitem [ref=e740]:
                - generic [ref=e746]:
                  - paragraph [ref=e747]:
                    - text: Vente en ligne
                    - generic [ref=e748]: (crédit)
                  - paragraph [ref=e749]: Vente en ligne TX-EV-1793814288882-D4FFE400 (TICKET)
                  - paragraph [ref=e750]:
                    - time [ref=e751]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e752]:
                      - text: · en attente, disponible le
                      - time [ref=e753]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e754]: + 7 500 F CFA
              - listitem [ref=e755]:
                - generic [ref=e761]:
                  - paragraph [ref=e762]:
                    - text: Vente en ligne
                    - generic [ref=e763]: (crédit)
                  - paragraph [ref=e764]: Vente en ligne TX-EV-1793814288855-1A5C99B3 (TICKET)
                  - paragraph [ref=e765]:
                    - time [ref=e766]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e767]:
                      - text: · en attente, disponible le
                      - time [ref=e768]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e769]: + 22 500 F CFA
              - listitem [ref=e770]:
                - generic [ref=e776]:
                  - paragraph [ref=e777]:
                    - text: Vente en ligne
                    - generic [ref=e778]: (crédit)
                  - paragraph [ref=e779]: Vente en ligne TX-EV-1793814288828-58514D48 (TICKET)
                  - paragraph [ref=e780]:
                    - time [ref=e781]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e782]:
                      - text: · en attente, disponible le
                      - time [ref=e783]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e784]: + 15 000 F CFA
              - listitem [ref=e785]:
                - generic [ref=e791]:
                  - paragraph [ref=e792]:
                    - text: Vente en ligne
                    - generic [ref=e793]: (crédit)
                  - paragraph [ref=e794]: Vente en ligne TX-EV-1793814288801-2CCC2A98 (TICKET)
                  - paragraph [ref=e795]:
                    - time [ref=e796]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e797]:
                      - text: · en attente, disponible le
                      - time [ref=e798]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e799]: + 7 500 F CFA
              - listitem [ref=e800]:
                - generic [ref=e806]:
                  - paragraph [ref=e807]:
                    - text: Vente en ligne
                    - generic [ref=e808]: (crédit)
                  - paragraph [ref=e809]: Vente en ligne TX-EV-1793814288771-FDD6BE93 (TICKET)
                  - paragraph [ref=e810]:
                    - time [ref=e811]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e812]:
                      - text: · en attente, disponible le
                      - time [ref=e813]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e814]: + 7 500 F CFA
              - listitem [ref=e815]:
                - generic [ref=e821]:
                  - paragraph [ref=e822]:
                    - text: Vente en ligne
                    - generic [ref=e823]: (crédit)
                  - paragraph [ref=e824]: Vente en ligne TX-EV-1793814288743-20E83DD7 (TICKET)
                  - paragraph [ref=e825]:
                    - time [ref=e826]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e827]:
                      - text: · en attente, disponible le
                      - time [ref=e828]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e829]: + 15 000 F CFA
              - listitem [ref=e830]:
                - generic [ref=e836]:
                  - paragraph [ref=e837]:
                    - text: Vente en ligne
                    - generic [ref=e838]: (crédit)
                  - paragraph [ref=e839]: Vente en ligne TX-EV-1793814288716-14596DF8 (TICKET)
                  - paragraph [ref=e840]:
                    - time [ref=e841]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e842]:
                      - text: · en attente, disponible le
                      - time [ref=e843]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e844]: + 24 000 F CFA
              - listitem [ref=e845]:
                - generic [ref=e851]:
                  - paragraph [ref=e852]:
                    - text: Vente en ligne
                    - generic [ref=e853]: (crédit)
                  - paragraph [ref=e854]: Vente en ligne TX-EV-1793814288690-C893D058 (TICKET)
                  - paragraph [ref=e855]:
                    - time [ref=e856]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e857]:
                      - text: · en attente, disponible le
                      - time [ref=e858]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e859]: + 12 000 F CFA
              - listitem [ref=e860]:
                - generic [ref=e866]:
                  - paragraph [ref=e867]:
                    - text: Vente en ligne
                    - generic [ref=e868]: (crédit)
                  - paragraph [ref=e869]: Vente en ligne TX-EV-1793814288660-595AC62E (TICKET)
                  - paragraph [ref=e870]:
                    - time [ref=e871]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e872]:
                      - text: · en attente, disponible le
                      - time [ref=e873]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e874]: + 6 000 F CFA
              - listitem [ref=e875]:
                - generic [ref=e881]:
                  - paragraph [ref=e882]:
                    - text: Vente en ligne
                    - generic [ref=e883]: (crédit)
                  - paragraph [ref=e884]: Vente en ligne TX-EV-1793814288633-B80707C3 (TICKET)
                  - paragraph [ref=e885]:
                    - time [ref=e886]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e887]:
                      - text: · en attente, disponible le
                      - time [ref=e888]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e889]: + 18 000 F CFA
    - navigation "Navigation rapide" [ref=e890]:
      - generic [ref=e891]:
        - link "Accueil" [ref=e892] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e899] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e903] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e911] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e915] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e920]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-finances__mobile__sombre.png
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