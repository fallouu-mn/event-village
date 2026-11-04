# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-finances — Partenaire — finances (écritures, retraits)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de partenaire-finances__mobile__clair.png

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
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - heading "Finances" [level=1] [ref=e37]
              - paragraph [ref=e38]: Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde.
            - generic [ref=e39]:
              - link "Statistiques de ventes" [ref=e40] [cursor=pointer]:
                - /url: /partner/stats
              - button "Actualiser" [ref=e45] [cursor=pointer]
          - region [ref=e53]:
            - heading "Soldes" [level=2] [ref=e54]
            - generic [ref=e55]:
              - paragraph [ref=e56]: Disponible au retrait
              - paragraph [ref=e57]: 0 F CFA
              - paragraph [ref=e58]: Montant que vous pouvez retirer dès maintenant.
            - generic [ref=e59]:
              - generic [ref=e60]:
                - paragraph [ref=e62]: En attente
                - paragraph [ref=e67]: 828 000 F CFA
                - paragraph [ref=e68]: "Prochaine disponibilité : ven. 6 nov. 2026 à 23:30."
              - generic [ref=e69]:
                - paragraph [ref=e71]: Retraits en cours
                - paragraph [ref=e76]: 0 F CFA
                - paragraph [ref=e77]: Montant réservé pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=e78]:
                - paragraph [ref=e80]: Créance
                - paragraph [ref=e85]: 0 F CFA
                - paragraph [ref=e86]: Aucune somme à compenser.
          - region [ref=e87]:
            - generic [ref=e88]:
              - heading "Demander un retrait" [level=2] [ref=e89]
              - paragraph [ref=e93]: Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
            - list "Étapes du retrait" [ref=e94]:
              - listitem [ref=e95]:
                - generic [aria-hidden] [ref=e96]: "1"
                - generic [ref=e97]: Demande
              - listitem [ref=e99]:
                - generic [aria-hidden] [ref=e100]: "2"
                - generic [ref=e101]: Code SMS
              - listitem [ref=e103]:
                - generic [aria-hidden] [ref=e104]: "3"
                - generic [ref=e105]: Suivi
            - generic [ref=e106]:
              - group "Recevoir sur" [ref=e107]:
                - generic [ref=e108]: Recevoir sur *
                - generic [ref=e109]:
                  - generic [ref=e110] [cursor=pointer]:
                    - radio "Wave" [ref=e111]
                    - generic [ref=e112]:
                      - generic [aria-hidden] [ref=e113]: W
                      - generic [ref=e114]: Wave
                  - generic [ref=e115] [cursor=pointer]:
                    - radio "Orange Money" [ref=e116]
                    - generic [ref=e117]:
                      - generic [aria-hidden] [ref=e118]: OM
                      - generic [ref=e119]: Orange Money
              - generic [ref=e120]:
                - generic [ref=e122]:
                  - text: Numéro Mobile Money qui reçoit le retrait*
                  - generic [ref=e123]: (obligatoire)
                - textbox "Numéro Mobile Money qui reçoit le retrait (obligatoire)" [ref=e124]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=e125]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=e126]:
                - generic [ref=e128]:
                  - text: Montant à retirer (F CFA)*
                  - generic [ref=e129]: (obligatoire)
                - textbox "Montant à retirer (F CFA) (obligatoire)" [ref=e130]:
                  - /placeholder: "Ex : 50000"
                - paragraph [ref=e131]: "Disponible : 0 F CFA. Frais calculés à la demande et déduits du montant versé."
              - button "Aucun montant disponible au retrait" [disabled] [ref=e132]
          - region [ref=e138]:
            - generic [ref=e139]:
              - heading "Mes retraits" [level=2] [ref=e140]
              - paragraph [ref=e141]: Vos 20 dernières demandes.
            - generic [ref=e142]:
              - heading "Aucun retrait" [level=3] [ref=e147]
              - paragraph [ref=e148]: Vous n’avez pas encore demandé de retrait.
          - region [ref=e149]:
            - generic [ref=e150]:
              - heading "Historique du compte" [level=2] [ref=e151]
              - paragraph [ref=e152]: Les 50 dernières écritures, de la plus récente à la plus ancienne.
            - list [ref=e153]:
              - listitem [ref=e154]:
                - generic [ref=e160]:
                  - paragraph [ref=e161]:
                    - text: Remboursement d’un billet
                    - generic [ref=e162]: (débit)
                  - paragraph [ref=e163]: Remboursement REFUND-05bbecb7-5bd8-4747-9cdf-6bd9920f0fa4 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e164]:
                    - time [ref=e165]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e166]: − 15 000 F CFA
              - listitem [ref=e167]:
                - generic [ref=e173]:
                  - paragraph [ref=e174]:
                    - text: Remboursement d’un billet
                    - generic [ref=e175]: (débit)
                  - paragraph [ref=e176]: Remboursement REFUND-db7d31b9-3a45-4d22-aa18-8c92cc561f25 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e177]:
                    - time [ref=e178]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e179]: − 9 000 F CFA
              - listitem [ref=e180]:
                - generic [ref=e186]:
                  - paragraph [ref=e187]:
                    - text: Remboursement d’un billet
                    - generic [ref=e188]: (débit)
                  - paragraph [ref=e189]: Remboursement REFUND-d9d9af90-f7c7-48d5-b328-a8ae269a4358 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e190]:
                    - time [ref=e191]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e192]: − 30 000 F CFA
              - listitem [ref=e193]:
                - generic [ref=e199]:
                  - paragraph [ref=e200]:
                    - text: Remboursement d’un billet
                    - generic [ref=e201]: (débit)
                  - paragraph [ref=e202]: Remboursement REFUND-b070bf40-493c-4f16-8b61-cf04f0389bd5 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e203]:
                    - time [ref=e204]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e205]: − 15 000 F CFA
              - listitem [ref=e206]:
                - generic [ref=e212]:
                  - paragraph [ref=e213]:
                    - text: Remboursement d’un billet
                    - generic [ref=e214]: (débit)
                  - paragraph [ref=e215]: Remboursement REFUND-ac7a0774-a60b-4d4f-8174-f9189313dec7 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e216]:
                    - time [ref=e217]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e218]: − 15 000 F CFA
              - listitem [ref=e219]:
                - generic [ref=e225]:
                  - paragraph [ref=e226]:
                    - text: Remboursement d’un billet
                    - generic [ref=e227]: (débit)
                  - paragraph [ref=e228]: Remboursement REFUND-827af424-4e78-4e18-894e-6ba73d48c763 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e229]:
                    - time [ref=e230]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e231]: − 30 000 F CFA
              - listitem [ref=e232]:
                - generic [ref=e238]:
                  - paragraph [ref=e239]:
                    - text: Remboursement d’un billet
                    - generic [ref=e240]: (débit)
                  - paragraph [ref=e241]: Remboursement REFUND-1cad3c39-d95c-483e-8645-286279c48f77 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e242]:
                    - time [ref=e243]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e244]: − 9 000 F CFA
              - listitem [ref=e245]:
                - generic [ref=e251]:
                  - paragraph [ref=e252]:
                    - text: Remboursement d’un billet
                    - generic [ref=e253]: (débit)
                  - paragraph [ref=e254]: Remboursement REFUND-09ceee00-009b-40cb-9363-777b7d821ca0 (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e255]:
                    - time [ref=e256]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e257]: − 18 000 F CFA
              - listitem [ref=e258]:
                - generic [ref=e264]:
                  - paragraph [ref=e265]:
                    - text: Remboursement d’un billet
                    - generic [ref=e266]: (débit)
                  - paragraph [ref=e267]: Remboursement REFUND-08189d95-0f9b-40d9-9a65-0faf1035740d (EVENT_CANCELLATION_REFUND)
                  - paragraph [ref=e268]:
                    - time [ref=e269]: mer. 4 nov. 2026 à 17:44
                - generic [ref=e270]: − 9 000 F CFA
              - listitem [ref=e271]:
                - generic [ref=e277]:
                  - paragraph [ref=e278]:
                    - text: Vente en ligne
                    - generic [ref=e279]: (crédit)
                  - paragraph [ref=e280]: Vente en ligne TX-EV-1793814291005-489D9030 (TICKET)
                  - paragraph [ref=e281]:
                    - time [ref=e282]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e283]:
                      - text: · en attente, disponible le
                      - time [ref=e284]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e285]: + 6 000 F CFA
              - listitem [ref=e286]:
                - generic [ref=e292]:
                  - paragraph [ref=e293]:
                    - text: Vente en ligne
                    - generic [ref=e294]: (crédit)
                  - paragraph [ref=e295]: Vente en ligne TX-EV-1793814290978-D519605D (TICKET)
                  - paragraph [ref=e296]:
                    - time [ref=e297]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e298]:
                      - text: · en attente, disponible le
                      - time [ref=e299]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e300]: + 15 000 F CFA
              - listitem [ref=e301]:
                - generic [ref=e307]:
                  - paragraph [ref=e308]:
                    - text: Vente en ligne
                    - generic [ref=e309]: (crédit)
                  - paragraph [ref=e310]: Vente en ligne TX-EV-1793814290951-F6EABE43 (TICKET)
                  - paragraph [ref=e311]:
                    - time [ref=e312]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e313]:
                      - text: · en attente, disponible le
                      - time [ref=e314]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e315]: + 15 000 F CFA
              - listitem [ref=e316]:
                - generic [ref=e322]:
                  - paragraph [ref=e323]:
                    - text: Vente en ligne
                    - generic [ref=e324]: (crédit)
                  - paragraph [ref=e325]: Vente en ligne TX-EV-1793814290924-57A7A018 (TICKET)
                  - paragraph [ref=e326]:
                    - time [ref=e327]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e328]:
                      - text: · en attente, disponible le
                      - time [ref=e329]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e330]: + 7 500 F CFA
              - listitem [ref=e331]:
                - generic [ref=e337]:
                  - paragraph [ref=e338]:
                    - text: Vente en ligne
                    - generic [ref=e339]: (crédit)
                  - paragraph [ref=e340]: Vente en ligne TX-EV-1793814290897-B0879379 (TICKET)
                  - paragraph [ref=e341]:
                    - time [ref=e342]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e343]:
                      - text: · en attente, disponible le
                      - time [ref=e344]: ven. 6 nov. 2026 à 23:30
                - generic [ref=e345]: + 10 000 F CFA
              - listitem [ref=e346]:
                - generic [ref=e352]:
                  - paragraph [ref=e353]:
                    - text: Vente en ligne
                    - generic [ref=e354]: (crédit)
                  - paragraph [ref=e355]: Vente en ligne TX-EV-1793814290659-D88A7607 (TICKET)
                  - paragraph [ref=e356]:
                    - time [ref=e357]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e358]:
                      - text: · en attente, disponible le
                      - time [ref=e359]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e360]: + 30 000 F CFA
              - listitem [ref=e361]:
                - generic [ref=e367]:
                  - paragraph [ref=e368]:
                    - text: Vente en ligne
                    - generic [ref=e369]: (crédit)
                  - paragraph [ref=e370]: Vente en ligne TX-EV-1793814290632-8931C240 (TICKET)
                  - paragraph [ref=e371]:
                    - time [ref=e372]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e373]:
                      - text: · en attente, disponible le
                      - time [ref=e374]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e375]: + 15 000 F CFA
              - listitem [ref=e376]:
                - generic [ref=e382]:
                  - paragraph [ref=e383]:
                    - text: Vente en ligne
                    - generic [ref=e384]: (crédit)
                  - paragraph [ref=e385]: Vente en ligne TX-EV-1793814290603-729E48C1 (TICKET)
                  - paragraph [ref=e386]:
                    - time [ref=e387]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e388]:
                      - text: · en attente, disponible le
                      - time [ref=e389]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e390]: + 15 000 F CFA
              - listitem [ref=e391]:
                - generic [ref=e397]:
                  - paragraph [ref=e398]:
                    - text: Vente en ligne
                    - generic [ref=e399]: (crédit)
                  - paragraph [ref=e400]: Vente en ligne TX-EV-1793814290576-9114400F (TICKET)
                  - paragraph [ref=e401]:
                    - time [ref=e402]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e403]:
                      - text: · en attente, disponible le
                      - time [ref=e404]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e405]: + 30 000 F CFA
              - listitem [ref=e406]:
                - generic [ref=e412]:
                  - paragraph [ref=e413]:
                    - text: Vente en ligne
                    - generic [ref=e414]: (crédit)
                  - paragraph [ref=e415]: Vente en ligne TX-EV-1793814290550-2E4EC1B8 (TICKET)
                  - paragraph [ref=e416]:
                    - time [ref=e417]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e418]:
                      - text: · en attente, disponible le
                      - time [ref=e419]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e420]: + 15 000 F CFA
              - listitem [ref=e421]:
                - generic [ref=e427]:
                  - paragraph [ref=e428]:
                    - text: Vente en ligne
                    - generic [ref=e429]: (crédit)
                  - paragraph [ref=e430]: Vente en ligne TX-EV-1793814290522-904D4C56 (TICKET)
                  - paragraph [ref=e431]:
                    - time [ref=e432]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e433]:
                      - text: · en attente, disponible le
                      - time [ref=e434]: ven. 6 nov. 2026 à 23:45
                - generic [ref=e435]: + 30 000 F CFA
              - listitem [ref=e436]:
                - generic [ref=e442]:
                  - paragraph [ref=e443]:
                    - text: Vente en ligne
                    - generic [ref=e444]: (crédit)
                  - paragraph [ref=e445]: Vente en ligne TX-EV-1793814290495-957648AD (TICKET)
                  - paragraph [ref=e446]:
                    - time [ref=e447]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e448]:
                      - text: · en attente, disponible le
                      - time [ref=e449]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e450]: + 9 000 F CFA
              - listitem [ref=e451]:
                - generic [ref=e457]:
                  - paragraph [ref=e458]:
                    - text: Vente en ligne
                    - generic [ref=e459]: (crédit)
                  - paragraph [ref=e460]: Vente en ligne TX-EV-1793814290468-8A5041C5 (TICKET)
                  - paragraph [ref=e461]:
                    - time [ref=e462]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e463]:
                      - text: · en attente, disponible le
                      - time [ref=e464]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e465]: + 9 000 F CFA
              - listitem [ref=e466]:
                - generic [ref=e472]:
                  - paragraph [ref=e473]:
                    - text: Vente en ligne
                    - generic [ref=e474]: (crédit)
                  - paragraph [ref=e475]: Vente en ligne TX-EV-1793814290442-A6548739 (TICKET)
                  - paragraph [ref=e476]:
                    - time [ref=e477]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e478]:
                      - text: · en attente, disponible le
                      - time [ref=e479]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e480]: + 18 000 F CFA
              - listitem [ref=e481]:
                - generic [ref=e487]:
                  - paragraph [ref=e488]:
                    - text: Vente en ligne
                    - generic [ref=e489]: (crédit)
                  - paragraph [ref=e490]: Vente en ligne TX-EV-1793814290415-AEEC0C2E (TICKET)
                  - paragraph [ref=e491]:
                    - time [ref=e492]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e493]:
                      - text: · en attente, disponible le
                      - time [ref=e494]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e495]: + 9 000 F CFA
              - listitem [ref=e496]:
                - generic [ref=e502]:
                  - paragraph [ref=e503]:
                    - text: Vente en ligne
                    - generic [ref=e504]: (crédit)
                  - paragraph [ref=e505]: Vente en ligne TX-EV-1793814290388-C66446F5 (TICKET)
                  - paragraph [ref=e506]:
                    - time [ref=e507]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e508]:
                      - text: · en attente, disponible le
                      - time [ref=e509]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e510]: + 30 000 F CFA
              - listitem [ref=e511]:
                - generic [ref=e517]:
                  - paragraph [ref=e518]:
                    - text: Vente en ligne
                    - generic [ref=e519]: (crédit)
                  - paragraph [ref=e520]: Vente en ligne TX-EV-1793814290359-6B8DB40D (TICKET)
                  - paragraph [ref=e521]:
                    - time [ref=e522]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e523]:
                      - text: · en attente, disponible le
                      - time [ref=e524]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e525]: + 15 000 F CFA
              - listitem [ref=e526]:
                - generic [ref=e532]:
                  - paragraph [ref=e533]:
                    - text: Vente en ligne
                    - generic [ref=e534]: (crédit)
                  - paragraph [ref=e535]: Vente en ligne TX-EV-1793814290329-43096541 (TICKET)
                  - paragraph [ref=e536]:
                    - time [ref=e537]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e538]:
                      - text: · en attente, disponible le
                      - time [ref=e539]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e540]: + 15 000 F CFA
              - listitem [ref=e541]:
                - generic [ref=e547]:
                  - paragraph [ref=e548]:
                    - text: Vente en ligne
                    - generic [ref=e549]: (crédit)
                  - paragraph [ref=e550]: Vente en ligne TX-EV-1793814290301-9FA5031C (TICKET)
                  - paragraph [ref=e551]:
                    - time [ref=e552]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e553]:
                      - text: · en attente, disponible le
                      - time [ref=e554]: mar. 24 nov. 2026 à 20:30
                - generic [ref=e555]: + 30 000 F CFA
              - listitem [ref=e556]:
                - generic [ref=e562]:
                  - paragraph [ref=e563]:
                    - text: Vente en ligne
                    - generic [ref=e564]: (crédit)
                  - paragraph [ref=e565]: Vente en ligne TX-EV-1793814290077-97910F88 (TICKET)
                  - paragraph [ref=e566]:
                    - time [ref=e567]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e568]:
                      - text: · en attente, disponible le
                      - time [ref=e569]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e570]: + 12 000 F CFA
              - listitem [ref=e571]:
                - generic [ref=e577]:
                  - paragraph [ref=e578]:
                    - text: Vente en ligne
                    - generic [ref=e579]: (crédit)
                  - paragraph [ref=e580]: Vente en ligne TX-EV-1793814290051-83B0666F (TICKET)
                  - paragraph [ref=e581]:
                    - time [ref=e582]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e583]:
                      - text: · en attente, disponible le
                      - time [ref=e584]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e585]: + 12 000 F CFA
              - listitem [ref=e586]:
                - generic [ref=e592]:
                  - paragraph [ref=e593]:
                    - text: Vente en ligne
                    - generic [ref=e594]: (crédit)
                  - paragraph [ref=e595]: Vente en ligne TX-EV-1793814290024-6A6C6EE5 (TICKET)
                  - paragraph [ref=e596]:
                    - time [ref=e597]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e598]:
                      - text: · en attente, disponible le
                      - time [ref=e599]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e600]: + 6 000 F CFA
              - listitem [ref=e601]:
                - generic [ref=e607]:
                  - paragraph [ref=e608]:
                    - text: Vente en ligne
                    - generic [ref=e609]: (crédit)
                  - paragraph [ref=e610]: Vente en ligne TX-EV-1793814289997-BD60FF77 (TICKET)
                  - paragraph [ref=e611]:
                    - time [ref=e612]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e613]:
                      - text: · en attente, disponible le
                      - time [ref=e614]: lun. 23 nov. 2026 à 23:30
                - generic [ref=e615]: + 12 000 F CFA
              - listitem [ref=e616]:
                - generic [ref=e622]:
                  - paragraph [ref=e623]:
                    - text: Vente en ligne
                    - generic [ref=e624]: (crédit)
                  - paragraph [ref=e625]: Vente en ligne TX-EV-1793814289119-7D3793EC (TICKET)
                  - paragraph [ref=e626]:
                    - time [ref=e627]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e628]:
                      - text: · en attente, disponible le
                      - time [ref=e629]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e630]: + 12 000 F CFA
              - listitem [ref=e631]:
                - generic [ref=e637]:
                  - paragraph [ref=e638]:
                    - text: Vente en ligne
                    - generic [ref=e639]: (crédit)
                  - paragraph [ref=e640]: Vente en ligne TX-EV-1793814289091-0DAFEEA9 (TICKET)
                  - paragraph [ref=e641]:
                    - time [ref=e642]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e643]:
                      - text: · en attente, disponible le
                      - time [ref=e644]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e645]: + 24 000 F CFA
              - listitem [ref=e646]:
                - generic [ref=e652]:
                  - paragraph [ref=e653]:
                    - text: Vente en ligne
                    - generic [ref=e654]: (crédit)
                  - paragraph [ref=e655]: Vente en ligne TX-EV-1793814289059-9BEAEEB5 (TICKET)
                  - paragraph [ref=e656]:
                    - time [ref=e657]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e658]:
                      - text: · en attente, disponible le
                      - time [ref=e659]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e660]: + 12 000 F CFA
              - listitem [ref=e661]:
                - generic [ref=e667]:
                  - paragraph [ref=e668]:
                    - text: Vente en ligne
                    - generic [ref=e669]: (crédit)
                  - paragraph [ref=e670]: Vente en ligne TX-EV-1793814289030-E5924171 (TICKET)
                  - paragraph [ref=e671]:
                    - time [ref=e672]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e673]:
                      - text: · en attente, disponible le
                      - time [ref=e674]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e675]: + 12 000 F CFA
              - listitem [ref=e676]:
                - generic [ref=e682]:
                  - paragraph [ref=e683]:
                    - text: Vente en ligne
                    - generic [ref=e684]: (crédit)
                  - paragraph [ref=e685]: Vente en ligne TX-EV-1793814289002-4142B4FC (TICKET)
                  - paragraph [ref=e686]:
                    - time [ref=e687]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e688]:
                      - text: · en attente, disponible le
                      - time [ref=e689]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e690]: + 24 000 F CFA
              - listitem [ref=e691]:
                - generic [ref=e697]:
                  - paragraph [ref=e698]:
                    - text: Vente en ligne
                    - generic [ref=e699]: (crédit)
                  - paragraph [ref=e700]: Vente en ligne TX-EV-1793814288975-F49841F0 (TICKET)
                  - paragraph [ref=e701]:
                    - time [ref=e702]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e703]:
                      - text: · en attente, disponible le
                      - time [ref=e704]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e705]: + 12 000 F CFA
              - listitem [ref=e706]:
                - generic [ref=e712]:
                  - paragraph [ref=e713]:
                    - text: Vente en ligne
                    - generic [ref=e714]: (crédit)
                  - paragraph [ref=e715]: Vente en ligne TX-EV-1793814288947-A6DD67C3 (TICKET)
                  - paragraph [ref=e716]:
                    - time [ref=e717]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e718]:
                      - text: · en attente, disponible le
                      - time [ref=e719]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e720]: + 7 500 F CFA
              - listitem [ref=e721]:
                - generic [ref=e727]:
                  - paragraph [ref=e728]:
                    - text: Vente en ligne
                    - generic [ref=e729]: (crédit)
                  - paragraph [ref=e730]: Vente en ligne TX-EV-1793814288913-C0833707 (TICKET)
                  - paragraph [ref=e731]:
                    - time [ref=e732]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e733]:
                      - text: · en attente, disponible le
                      - time [ref=e734]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e735]: + 15 000 F CFA
              - listitem [ref=e736]:
                - generic [ref=e742]:
                  - paragraph [ref=e743]:
                    - text: Vente en ligne
                    - generic [ref=e744]: (crédit)
                  - paragraph [ref=e745]: Vente en ligne TX-EV-1793814288882-D4FFE400 (TICKET)
                  - paragraph [ref=e746]:
                    - time [ref=e747]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e748]:
                      - text: · en attente, disponible le
                      - time [ref=e749]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e750]: + 7 500 F CFA
              - listitem [ref=e751]:
                - generic [ref=e757]:
                  - paragraph [ref=e758]:
                    - text: Vente en ligne
                    - generic [ref=e759]: (crédit)
                  - paragraph [ref=e760]: Vente en ligne TX-EV-1793814288855-1A5C99B3 (TICKET)
                  - paragraph [ref=e761]:
                    - time [ref=e762]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e763]:
                      - text: · en attente, disponible le
                      - time [ref=e764]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e765]: + 22 500 F CFA
              - listitem [ref=e766]:
                - generic [ref=e772]:
                  - paragraph [ref=e773]:
                    - text: Vente en ligne
                    - generic [ref=e774]: (crédit)
                  - paragraph [ref=e775]: Vente en ligne TX-EV-1793814288828-58514D48 (TICKET)
                  - paragraph [ref=e776]:
                    - time [ref=e777]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e778]:
                      - text: · en attente, disponible le
                      - time [ref=e779]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e780]: + 15 000 F CFA
              - listitem [ref=e781]:
                - generic [ref=e787]:
                  - paragraph [ref=e788]:
                    - text: Vente en ligne
                    - generic [ref=e789]: (crédit)
                  - paragraph [ref=e790]: Vente en ligne TX-EV-1793814288801-2CCC2A98 (TICKET)
                  - paragraph [ref=e791]:
                    - time [ref=e792]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e793]:
                      - text: · en attente, disponible le
                      - time [ref=e794]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e795]: + 7 500 F CFA
              - listitem [ref=e796]:
                - generic [ref=e802]:
                  - paragraph [ref=e803]:
                    - text: Vente en ligne
                    - generic [ref=e804]: (crédit)
                  - paragraph [ref=e805]: Vente en ligne TX-EV-1793814288771-FDD6BE93 (TICKET)
                  - paragraph [ref=e806]:
                    - time [ref=e807]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e808]:
                      - text: · en attente, disponible le
                      - time [ref=e809]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e810]: + 7 500 F CFA
              - listitem [ref=e811]:
                - generic [ref=e817]:
                  - paragraph [ref=e818]:
                    - text: Vente en ligne
                    - generic [ref=e819]: (crédit)
                  - paragraph [ref=e820]: Vente en ligne TX-EV-1793814288743-20E83DD7 (TICKET)
                  - paragraph [ref=e821]:
                    - time [ref=e822]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e823]:
                      - text: · en attente, disponible le
                      - time [ref=e824]: jeu. 19 nov. 2026 à 00:00
                - generic [ref=e825]: + 15 000 F CFA
              - listitem [ref=e826]:
                - generic [ref=e832]:
                  - paragraph [ref=e833]:
                    - text: Vente en ligne
                    - generic [ref=e834]: (crédit)
                  - paragraph [ref=e835]: Vente en ligne TX-EV-1793814288716-14596DF8 (TICKET)
                  - paragraph [ref=e836]:
                    - time [ref=e837]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e838]:
                      - text: · en attente, disponible le
                      - time [ref=e839]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e840]: + 24 000 F CFA
              - listitem [ref=e841]:
                - generic [ref=e847]:
                  - paragraph [ref=e848]:
                    - text: Vente en ligne
                    - generic [ref=e849]: (crédit)
                  - paragraph [ref=e850]: Vente en ligne TX-EV-1793814288690-C893D058 (TICKET)
                  - paragraph [ref=e851]:
                    - time [ref=e852]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e853]:
                      - text: · en attente, disponible le
                      - time [ref=e854]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e855]: + 12 000 F CFA
              - listitem [ref=e856]:
                - generic [ref=e862]:
                  - paragraph [ref=e863]:
                    - text: Vente en ligne
                    - generic [ref=e864]: (crédit)
                  - paragraph [ref=e865]: Vente en ligne TX-EV-1793814288660-595AC62E (TICKET)
                  - paragraph [ref=e866]:
                    - time [ref=e867]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e868]:
                      - text: · en attente, disponible le
                      - time [ref=e869]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e870]: + 6 000 F CFA
              - listitem [ref=e871]:
                - generic [ref=e877]:
                  - paragraph [ref=e878]:
                    - text: Vente en ligne
                    - generic [ref=e879]: (crédit)
                  - paragraph [ref=e880]: Vente en ligne TX-EV-1793814288633-B80707C3 (TICKET)
                  - paragraph [ref=e881]:
                    - time [ref=e882]: mer. 4 nov. 2026 à 17:44
                    - generic [ref=e883]:
                      - text: · en attente, disponible le
                      - time [ref=e884]: sam. 7 nov. 2026 à 17:45
                - generic [ref=e885]: + 18 000 F CFA
    - navigation "Navigation rapide" [ref=e886]:
      - generic [ref=e887]:
        - link "Accueil" [ref=e888] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e895] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e899] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e907] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e911] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e916]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-finances__mobile__clair.png
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