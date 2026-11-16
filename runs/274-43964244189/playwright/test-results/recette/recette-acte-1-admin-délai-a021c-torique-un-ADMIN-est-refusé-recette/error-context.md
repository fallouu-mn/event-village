# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé
- Location: e2e/recette.spec.ts:316:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('listitem').filter({ has: getByText('Délai de garde des ventes', { exact: true }) }).getByRole('button', { name: /^enregistrer$/i })

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
        - generic [ref=e15]: Administration
        - link "Tableau de bord" [ref=e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e27]:
          - paragraph [ref=e28]: Gestion
          - generic [ref=e29]:
            - link "Événements" [ref=e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e47]:
          - paragraph [ref=e48]: Finances
          - link "Finance" [ref=e50] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=e54]:
          - paragraph [ref=e55]: Engagement
          - generic [ref=e56]:
            - link "Parrainage" [ref=e57] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e62] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=e67]:
          - paragraph [ref=e68]: Système
          - generic [ref=e69]:
            - link "Réglages" [ref=e70] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e75] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e80] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e87] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=e96] [cursor=pointer]:
          - /url: /
      - generic [ref=e101]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=e102] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e103]: ES
          - generic [ref=e104]:
            - generic [ref=e105]: Elhadji SuperAdmin
            - generic [ref=e106]: Super administrateur
        - generic [ref=e107]:
          - button "Se déconnecter" [ref=e108] [cursor=pointer]
          - button "Basculer le thème" [ref=e113] [cursor=pointer]
    - generic [ref=e117]:
      - banner [ref=e118]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e120] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 63 non lues" [ref=e127] [cursor=pointer]:
          - generic [ref=e131]: "63"
      - main [ref=e132]:
        - generic [ref=e134]:
          - generic [ref=e135]:
            - link "Accueil" [ref=e137] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=e142]:
              - generic [ref=e143]:
                - heading "Réglages de la plateforme" [level=1] [ref=e144]
                - paragraph [ref=e145]: Chaque modification est historisée et ne s’applique qu’aux opérations futures.
              - button "Actualiser" [ref=e147] [cursor=pointer]
          - navigation "Sommaire des réglages" [ref=e155]:
            - paragraph [ref=e156]: Thèmes
            - list [ref=e157]:
              - listitem [ref=e158]:
                - link "Finance" [ref=e159] [cursor=pointer]:
                  - /url: "#finance"
              - listitem [ref=e160]:
                - link "Contrôle d’accès" [ref=e161] [cursor=pointer]:
                  - /url: "#controle"
              - listitem [ref=e162]:
                - link "Contact du support" [ref=e163] [cursor=pointer]:
                  - /url: "#support"
              - listitem [ref=e164]:
                - link "Notifications et SMS" [ref=e165] [cursor=pointer]:
                  - /url: "#notifications"
              - listitem [ref=e166]:
                - link "Services en préparation" [ref=e167] [cursor=pointer]:
                  - /url: "#services"
          - region [ref=e168]:
            - generic [ref=e169]:
              - heading "Finance" [level=2] [ref=e170]
              - paragraph [ref=e174]: Frais, délais de disponibilité des ventes, retraits et commissions.
            - list [ref=e175]:
              - listitem [ref=e176]:
                - generic [ref=e177]:
                  - generic [ref=e178]:
                    - paragraph [ref=e179]: Frais de service
                    - paragraph [ref=e180]: Payés par l’acheteur, arrondis au franc CFA supérieur par billet. De 0 à 50 %.
                    - paragraph [ref=e181]:
                      - text: "Par défaut : 5 % · Modifié le"
                      - time [ref=e182]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e183]:
                    - generic [ref=e184]: 5 %
                    - button "Modifier Frais de service" [ref=e185] [cursor=pointer]:
                      - generic [ref=e190]: Modifier
              - listitem [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e193]:
                    - paragraph [ref=e194]: Durée de garde des places pendant un paiement (minutes)
                    - paragraph [ref=e195]: "Temps pendant lequel les places d’un paiement en attente restent réservées. Le paiement reste valable 1 heure chez SamirPay : validé après l’échéance, il donne les billets s’il reste des places, sinon il est remboursé automatiquement. Entier de 5 à 60."
                    - paragraph [ref=e196]:
                      - text: "Par défaut : 10 min · Modifié le"
                      - time [ref=e197]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e198]:
                    - generic [ref=e199]: 10 min
                    - button "Modifier Durée de garde des places pendant un paiement (minutes)" [ref=e200] [cursor=pointer]:
                      - generic [ref=e205]: Modifier
              - listitem [ref=e206]:
                - generic [ref=e207]:
                  - generic [ref=e208]:
                    - paragraph [ref=e209]: Prix minimum d’un billet payant (F CFA)
                    - paragraph [ref=e210]: Appliqué à toute catégorie payante créée ou dont le prix change ; un billet gratuit reste à 0. À ajuster quand SamirPay donnera son minimum d’encaissement. Entier de 1 à 100 000.
                    - paragraph [ref=e211]:
                      - text: "Par défaut : 100 F CFA · Modifié le"
                      - time [ref=e212]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e213]:
                    - generic [ref=e214]: 100 F CFA
                    - button "Modifier Prix minimum d’un billet payant (F CFA)" [ref=e215] [cursor=pointer]:
                      - generic [ref=e220]: Modifier
              - listitem [ref=e221]:
                - generic [ref=e222]:
                  - generic [ref=e223]:
                    - paragraph [ref=e224]: Frais agrégateur Wave
                    - paragraph [ref=e225]: Coût SamirPay d’un paiement Wave. De 0 à 10 %.
                    - paragraph [ref=e226]:
                      - text: "Par défaut : 1,5 % · Modifié le"
                      - time [ref=e227]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e228]:
                    - generic [ref=e229]: 1,5 %
                    - button "Modifier Frais agrégateur Wave" [ref=e230] [cursor=pointer]:
                      - generic [ref=e235]: Modifier
              - listitem [ref=e236]:
                - generic [ref=e237]:
                  - generic [ref=e238]:
                    - paragraph [ref=e239]: Frais agrégateur Orange Money
                    - paragraph [ref=e240]: Coût SamirPay d’un paiement Orange Money. De 0 à 10 %.
                    - paragraph [ref=e241]:
                      - text: "Par défaut : 1,5 % · Modifié le"
                      - time [ref=e242]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e243]:
                    - generic [ref=e244]: 1,5 %
                    - button "Modifier Frais agrégateur Orange Money" [ref=e245] [cursor=pointer]:
                      - generic [ref=e250]: Modifier
              - listitem [ref=e251]:
                - generic [ref=e252]:
                  - generic [ref=e253]:
                    - paragraph [ref=e254]: Frais agrégateur d’une annulation
                    - paragraph [ref=e255]: Qui supporte les frais agrégateur quand un billet est remboursé.
                    - paragraph [ref=e256]:
                      - text: "Par défaut : Event Village · Modifié le"
                      - time [ref=e257]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e258]:
                    - generic [ref=e259]: Event Village
                    - button "Modifier Frais agrégateur d’une annulation" [ref=e260] [cursor=pointer]:
                      - generic [ref=e265]: Modifier
              - listitem [ref=e266]:
                - generic [ref=e267]:
                  - generic [ref=e268]:
                    - paragraph [ref=e269]: Délai de garde des ventes
                    - paragraph [ref=e270]: "Désactivé : les ventes sont disponibles dès la confirmation du paiement."
                    - paragraph [ref=e271]:
                      - text: "Par défaut : Activé · Modifié le"
                      - time [ref=e272]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e273]: Activé
                - generic [ref=e275]:
                  - generic [ref=e276]:
                    - generic [ref=e277]: Nouvelle valeur
                    - combobox "Nouvelle valeur" [ref=e280] [cursor=pointer]:
                      - option "Activé"
                      - option "Désactivé" [selected]
                  - status [ref=e282]:
                    - generic [ref=e287]:
                      - paragraph [ref=e288]: Valeur risquée
                      - generic [ref=e289]: Un partenaire peut retirer avant l’événement ; s’il est annulé, Event Village rembourse sans pouvoir reprendre l’argent.
                  - generic [ref=e290]:
                    - generic [ref=e292]:
                      - text: Motif*
                      - generic [ref=e293]: (obligatoire)
                    - textbox "Motif (obligatoire)" [ref=e294]:
                      - /placeholder: "Ex : décision du comité du 15 novembre"
                    - paragraph [ref=e295]: 3 caractères au moins ; visible dans l’historique.
                  - generic [ref=e296]:
                    - button "Vérifier et enregistrer" [ref=e297] [cursor=pointer]
                    - button "Annuler" [ref=e304] [cursor=pointer]
              - listitem [ref=e310]:
                - generic [ref=e311]:
                  - generic [ref=e312]:
                    - paragraph [ref=e313]: Délai après la fin de l’événement
                    - paragraph [ref=e314]: Nombre d’heures avant que les ventes deviennent disponibles. De 0 à 720.
                    - paragraph [ref=e315]:
                      - text: "Par défaut : 48 h · Modifié le"
                      - time [ref=e316]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e317]:
                    - generic [ref=e318]: 48 h
                    - button "Modifier Délai après la fin de l’événement" [ref=e319] [cursor=pointer]:
                      - generic [ref=e324]: Modifier
              - listitem [ref=e325]:
                - generic [ref=e326]:
                  - generic [ref=e327]:
                    - paragraph [ref=e328]: Frais de retrait
                    - paragraph [ref=e329]: Arrondis au franc CFA supérieur, déduits du montant versé. De 0 à 10 %.
                    - paragraph [ref=e330]:
                      - text: "Par défaut : 1 % · Modifié le"
                      - time [ref=e331]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e332]:
                    - generic [ref=e333]: 1 %
                    - button "Modifier Frais de retrait" [ref=e334] [cursor=pointer]:
                      - generic [ref=e339]: Modifier
                - paragraph [ref=e340]: "Frais SamirPay constatés sur 90 jours : 0 % (maximum 0 %)."
              - listitem [ref=e341]:
                - generic [ref=e342]:
                  - generic [ref=e343]:
                    - paragraph [ref=e344]: Montant minimum de retrait
                    - paragraph [ref=e345]: Montant entier en francs CFA.
                    - paragraph [ref=e346]:
                      - text: "Par défaut : 5 000 F CFA · Modifié le"
                      - time [ref=e347]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e348]:
                    - generic [ref=e349]: 5 000 F CFA
                    - button "Modifier Montant minimum de retrait" [ref=e350] [cursor=pointer]:
                      - generic [ref=e355]: Modifier
              - listitem [ref=e356]:
                - generic [ref=e357]:
                  - generic [ref=e358]:
                    - paragraph [ref=e359]: Retraits par virement bancaire
                    - paragraph [ref=e360]: Tant qu’il est désactivé, seuls Wave et Orange Money sont proposés.
                    - paragraph [ref=e361]:
                      - text: "Par défaut : Désactivé · Modifié le"
                      - time [ref=e362]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e363]:
                    - generic [ref=e364]: Désactivé
                    - button "Modifier Retraits par virement bancaire" [ref=e365] [cursor=pointer]:
                      - generic [ref=e370]: Modifier
              - listitem [ref=e371]:
                - generic [ref=e372]:
                  - generic [ref=e373]:
                    - paragraph [ref=e374]: Délai de validation des commissions
                    - paragraph [ref=e375]: Jours avant qu’une commission de parrainage devienne disponible. De 7 à 14.
                    - paragraph [ref=e376]:
                      - text: "Par défaut : 7 jours · Modifié le"
                      - time [ref=e377]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e378]:
                    - generic [ref=e379]: 7 jours
                    - button "Modifier Délai de validation des commissions" [ref=e380] [cursor=pointer]:
                      - generic [ref=e385]: Modifier
              - listitem [ref=e386]:
                - generic [ref=e387]:
                  - generic [ref=e388]:
                    - paragraph [ref=e389]: Réserve de prudence
                    - paragraph [ref=e390]: "En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte. Elle est déduite de « Retirable par Event Village ». Automatique : les encaissements des 3 derniers jours. Montant fixe : le montant du réglage suivant."
                    - paragraph [ref=e391]:
                      - text: "Par défaut : Automatique : encaissements des 3 derniers jours · Modifié le"
                      - time [ref=e392]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e393]:
                    - generic [ref=e394]: "Automatique : encaissements des 3 derniers jours"
                    - button "Modifier Réserve de prudence" [ref=e395] [cursor=pointer]:
                      - generic [ref=e400]: Modifier
              - listitem [ref=e401]:
                - generic [ref=e402]:
                  - generic [ref=e403]:
                    - paragraph [ref=e404]: Montant fixe de la réserve de prudence
                    - paragraph [ref=e405]: Lu seulement quand la réserve est « Montant fixe ». Entier de 0 à 1 000 000 000 F CFA.
                    - paragraph [ref=e406]:
                      - text: "Par défaut : 0 F CFA · Modifié le"
                      - time [ref=e407]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e408]:
                    - generic [ref=e409]: 0 F CFA
                    - button "Modifier Montant fixe de la réserve de prudence" [ref=e410] [cursor=pointer]:
                      - generic [ref=e415]: Modifier
          - region [ref=e416]:
            - generic [ref=e417]:
              - heading "Contrôle d’accès" [level=2] [ref=e418]
              - paragraph [ref=e424]: Fenêtre de scan, saisie manuelle des numéros de billet, vente au guichet, seuil de stock affiché au public et alerte de refus à une porte.
            - list [ref=e425]:
              - listitem [ref=e426]:
                - generic [ref=e427]:
                  - generic [ref=e428]:
                    - paragraph [ref=e429]: Ouverture du contrôle avant le début
                    - paragraph [ref=e430]: Heures avant le début de l’événement à partir desquelles les billets peuvent être scannés. De 0 à 48.
                    - paragraph [ref=e431]:
                      - text: "Par défaut : 6 h · Modifié le"
                      - time [ref=e432]: lun. 16 nov. 2026 à 23:14
                  - generic [ref=e433]:
                    - generic [ref=e434]: 6 h
                    - button "Modifier Ouverture du contrôle avant le début" [ref=e435] [cursor=pointer]:
                      - generic [ref=e440]: Modifier
              - listitem [ref=e441]:
                - generic [ref=e442]:
                  - generic [ref=e443]:
                    - paragraph [ref=e444]: Fermeture du contrôle après la fin
                    - paragraph [ref=e445]: Heures après la fin de l’événement pendant lesquelles les billets peuvent encore être scannés. De 0 à 48.
                    - paragraph [ref=e446]:
                      - text: "Par défaut : 6 h · Modifié le"
                      - time [ref=e447]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e448]:
                    - generic [ref=e449]: 6 h
                    - button "Modifier Fermeture du contrôle après la fin" [ref=e450] [cursor=pointer]:
                      - generic [ref=e455]: Modifier
              - listitem [ref=e456]:
                - generic [ref=e457]:
                  - generic [ref=e458]:
                    - paragraph [ref=e459]: Saisie manuelle d’un numéro de billet
                    - paragraph [ref=e460]: Qui peut valider un billet par son numéro, toujours après vérification de la pièce d’identité.
                    - paragraph [ref=e461]:
                      - text: "Par défaut : Contrôleur affecté seul · Modifié le"
                      - time [ref=e462]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e463]:
                    - generic [ref=e464]: Contrôleur affecté seul
                    - button "Modifier Saisie manuelle d’un numéro de billet" [ref=e465] [cursor=pointer]:
                      - generic [ref=e470]: Modifier
              - listitem [ref=e471]:
                - generic [ref=e472]:
                  - generic [ref=e473]:
                    - paragraph [ref=e474]: Vente au guichet en espèces
                    - paragraph [ref=e475]: Un contrôleur autorisé à encaisser, avec une caisse ouverte, vend des billets au prix facial, sans frais.
                    - paragraph [ref=e476]:
                      - text: "Par défaut : Activé · Modifié le"
                      - time [ref=e477]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e478]:
                    - generic [ref=e479]: Activé
                    - button "Modifier Vente au guichet en espèces" [ref=e480] [cursor=pointer]:
                      - generic [ref=e485]: Modifier
              - listitem [ref=e486]:
                - generic [ref=e487]:
                  - generic [ref=e488]:
                    - paragraph [ref=e489]: Seuil « bientôt complet »
                    - paragraph [ref=e490]: Quand il reste ce nombre de places ou moins dans une catégorie, la page publique affiche le restant ; au-delà, seulement « disponible ». Entier de 1 à 1000.
                    - paragraph [ref=e491]:
                      - text: "Par défaut : 10 places · Modifié le"
                      - time [ref=e492]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e493]:
                    - generic [ref=e494]: 10 places
                    - button "Modifier Seuil « bientôt complet »" [ref=e495] [cursor=pointer]:
                      - generic [ref=e500]: Modifier
              - listitem [ref=e501]:
                - generic [ref=e502]:
                  - generic [ref=e503]:
                    - paragraph [ref=e504]: "Alerte de refus à une porte : nombre de refus"
                    - paragraph [ref=e505]: Quand une porte enregistre ce nombre de refus ou plus pendant la durée observée, l’organisateur reçoit une alerte, au plus une fois par porte et par durée. Comptent les billets invalides, déjà utilisés, annulés, remboursés, d’un autre événement, en attente de transfert, présentés dans la mauvaise zone ou pas encore entrés ; pas les refus liés au téléphone ou aux droits du contrôleur, à l’encaissement ni aux horaires de l’événement. Entier de 3 à 500.
                    - paragraph [ref=e506]:
                      - text: "Par défaut : 10 refus · Modifié le"
                      - time [ref=e507]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e508]:
                    - generic [ref=e509]: 10 refus
                    - 'button "Modifier Alerte de refus à une porte : nombre de refus" [ref=e510] [cursor=pointer]':
                      - generic [ref=e515]: Modifier
              - listitem [ref=e516]:
                - generic [ref=e517]:
                  - generic [ref=e518]:
                    - paragraph [ref=e519]: "Alerte de refus à une porte : durée observée"
                    - paragraph [ref=e520]: Durée pendant laquelle les refus d’une même porte sont comptés pour l’alerte. Entier de 1 à 60.
                    - paragraph [ref=e521]:
                      - text: "Par défaut : 5 min · Modifié le"
                      - time [ref=e522]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e523]:
                    - generic [ref=e524]: 5 min
                    - 'button "Modifier Alerte de refus à une porte : durée observée" [ref=e525] [cursor=pointer]':
                      - generic [ref=e530]: Modifier
          - region [ref=e531]:
            - generic [ref=e532]:
              - heading "Contact du support" [level=2] [ref=e533]
              - paragraph [ref=e537]: Moyens de joindre le support, affichés sur la page publique Aide et dans les messages de sécurité. Au moins un est exigé avant une séance réelle.
            - list [ref=e538]:
              - listitem [ref=e539]:
                - generic [ref=e540]:
                  - generic [ref=e541]:
                    - paragraph [ref=e542]: Numéro WhatsApp du support
                    - paragraph [ref=e543]: Format international, par exemple +221771234567. Laissez vide si aucun. Au moins un moyen de contact est exigé avant une séance réelle.
                    - paragraph [ref=e544]:
                      - text: "Par défaut : Non renseigné · Modifié le"
                      - time [ref=e545]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e546]:
                    - generic [ref=e547]: Non renseigné
                    - button "Modifier Numéro WhatsApp du support" [ref=e548] [cursor=pointer]:
                      - generic [ref=e553]: Modifier
              - listitem [ref=e554]:
                - generic [ref=e555]:
                  - generic [ref=e556]:
                    - paragraph [ref=e557]: Téléphone du support
                    - paragraph [ref=e558]: Format international, par exemple +221338000000. Laissez vide si aucun.
                    - paragraph [ref=e559]:
                      - text: "Par défaut : Non renseigné · Modifié le"
                      - time [ref=e560]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e561]:
                    - generic [ref=e562]: Non renseigné
                    - button "Modifier Téléphone du support" [ref=e563] [cursor=pointer]:
                      - generic [ref=e568]: Modifier
              - listitem [ref=e569]:
                - generic [ref=e570]:
                  - generic [ref=e571]:
                    - paragraph [ref=e572]: Email du support
                    - paragraph [ref=e573]: Adresse lue par l’équipe du support. Laissez vide si aucune.
                    - paragraph [ref=e574]:
                      - text: "Par défaut : Non renseigné · Modifié le"
                      - time [ref=e575]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e576]:
                    - generic [ref=e577]: Non renseigné
                    - button "Modifier Email du support" [ref=e578] [cursor=pointer]:
                      - generic [ref=e583]: Modifier
          - region [ref=e584]:
            - generic [ref=e585]:
              - heading "Notifications" [level=2] [ref=e586]
              - paragraph [ref=e590]: Rappels la veille et avant le début, SMS des rappels, plage de nuit sans SMS, plafond quotidien des SMS optionnels, alerte sur les SMS indispensables et rappels des billets gratuits.
            - list [ref=e591]:
              - listitem [ref=e592]:
                - generic [ref=e593]:
                  - generic [ref=e594]:
                    - paragraph [ref=e595]: Rappel la veille
                    - paragraph [ref=e596]: Rappel envoyé la veille du début aux porteurs d’un billet valable de l’événement en ligne.
                    - paragraph [ref=e597]:
                      - text: "Par défaut : Activé · Modifié le"
                      - time [ref=e598]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e599]:
                    - generic [ref=e600]: Activé
                    - button "Modifier Rappel la veille" [ref=e601] [cursor=pointer]:
                      - generic [ref=e606]: Modifier
              - listitem [ref=e607]:
                - generic [ref=e608]:
                  - generic [ref=e609]:
                    - paragraph [ref=e610]: Heure du rappel de la veille
                    - paragraph [ref=e611]: Heure de Dakar à laquelle part le rappel de la veille. De 6 à 20.
                    - paragraph [ref=e612]:
                      - text: "Par défaut : 10 h · Modifié le"
                      - time [ref=e613]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e614]:
                    - generic [ref=e615]: 10 h
                    - button "Modifier Heure du rappel de la veille" [ref=e616] [cursor=pointer]:
                      - generic [ref=e621]: Modifier
              - listitem [ref=e622]:
                - generic [ref=e623]:
                  - generic [ref=e624]:
                    - paragraph [ref=e625]: Rappel avant le début
                    - paragraph [ref=e626]: Rappel envoyé quelques heures avant le début, avec le conseil d’ouvrir son billet avant d’arriver.
                    - paragraph [ref=e627]:
                      - text: "Par défaut : Activé · Modifié le"
                      - time [ref=e628]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e629]:
                    - generic [ref=e630]: Activé
                    - button "Modifier Rappel avant le début" [ref=e631] [cursor=pointer]:
                      - generic [ref=e636]: Modifier
              - listitem [ref=e637]:
                - generic [ref=e638]:
                  - generic [ref=e639]:
                    - paragraph [ref=e640]: Heures avant le début
                    - paragraph [ref=e641]: Nombre d’heures entre le rappel et le début de l’événement. De 1 à 12.
                    - paragraph [ref=e642]:
                      - text: "Par défaut : 3 h · Modifié le"
                      - time [ref=e643]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e644]:
                    - generic [ref=e645]: 3 h
                    - button "Modifier Heures avant le début" [ref=e646] [cursor=pointer]:
                      - generic [ref=e651]: Modifier
              - listitem [ref=e652]:
                - generic [ref=e653]:
                  - generic [ref=e654]:
                    - paragraph [ref=e655]: SMS du rappel de la veille
                    - paragraph [ref=e656]: Envoi du SMS en plus de l’application et des notifications push.
                    - paragraph [ref=e657]:
                      - text: "Par défaut : Toujours · Modifié le"
                      - time [ref=e658]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e659]:
                    - generic [ref=e660]: Toujours
                    - button "Modifier SMS du rappel de la veille" [ref=e661] [cursor=pointer]:
                      - generic [ref=e666]: Modifier
                - status [ref=e667]:
                  - generic [ref=e672]:
                    - paragraph [ref=e673]: Valeur risquée
                    - generic [ref=e674]: Un SMS facturé par détenteur et par événement.
              - listitem [ref=e675]:
                - generic [ref=e676]:
                  - generic [ref=e677]:
                    - paragraph [ref=e678]: SMS du rappel avant le début
                    - paragraph [ref=e679]: Envoi du SMS en plus de l’application et des notifications push.
                    - paragraph [ref=e680]:
                      - text: "Par défaut : Seulement sans notification push · Modifié le"
                      - time [ref=e681]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e682]:
                    - generic [ref=e683]: Seulement sans notification push
                    - button "Modifier SMS du rappel avant le début" [ref=e684] [cursor=pointer]:
                      - generic [ref=e689]: Modifier
              - listitem [ref=e690]:
                - generic [ref=e691]:
                  - generic [ref=e692]:
                    - paragraph [ref=e693]: Début de la plage sans SMS
                    - paragraph [ref=e694]: Heure de Dakar à partir de laquelle aucun SMS optionnel ne part ; le rappel passe alors par les autres canaux. De 0 à 23.
                    - paragraph [ref=e695]:
                      - text: "Par défaut : 22 h · Modifié le"
                      - time [ref=e696]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e697]:
                    - generic [ref=e698]: 22 h
                    - button "Modifier Début de la plage sans SMS" [ref=e699] [cursor=pointer]:
                      - generic [ref=e704]: Modifier
              - listitem [ref=e705]:
                - generic [ref=e706]:
                  - generic [ref=e707]:
                    - paragraph [ref=e708]: Fin de la plage sans SMS
                    - paragraph [ref=e709]: Heure de Dakar de fin de la plage. Un début égal à la fin supprime la plage. De 0 à 23.
                    - paragraph [ref=e710]:
                      - text: "Par défaut : 8 h · Modifié le"
                      - time [ref=e711]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e712]:
                    - generic [ref=e713]: 8 h
                    - button "Modifier Fin de la plage sans SMS" [ref=e714] [cursor=pointer]:
                      - generic [ref=e719]: Modifier
              - listitem [ref=e720]:
                - generic [ref=e721]:
                  - generic [ref=e722]:
                    - paragraph [ref=e723]: Plafond quotidien des SMS optionnels
                    - paragraph [ref=e724]: "Nombre maximal de SMS optionnels (rappels, annonces, signaux aux professionnels) envoyés par jour de Dakar ; au-delà, ils partent sans SMS, par l’application et les notifications push. Les SMS indispensables (achat, transfert, annulation, remboursement, sécurité du compte) ne sont jamais plafonnés. Les administrateurs sont alertés à 80 %. De 0 à 1 000 000 ; 0 : aucun SMS optionnel."
                    - paragraph [ref=e725]:
                      - text: "Par défaut : 700 SMS · Modifié le"
                      - time [ref=e726]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e727]:
                    - generic [ref=e728]: 700 SMS
                    - button "Modifier Plafond quotidien des SMS optionnels" [ref=e729] [cursor=pointer]:
                      - generic [ref=e734]: Modifier
              - listitem [ref=e735]:
                - generic [ref=e736]:
                  - generic [ref=e737]:
                    - paragraph [ref=e738]: Seuil d’alerte des SMS indispensables du jour
                    - paragraph [ref=e739]: "Nombre de SMS indispensables envoyés dans la journée de Dakar à partir duquel les administrateurs sont alertés, une fois par jour. Ces SMS ne sont jamais plafonnés : le seuil sert à repérer un volume anormal. De 1 à 1 000 000."
                    - paragraph [ref=e740]:
                      - text: "Par défaut : 2 000 SMS · Modifié le"
                      - time [ref=e741]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e742]:
                    - generic [ref=e743]: 2 000 SMS
                    - button "Modifier Seuil d’alerte des SMS indispensables du jour" [ref=e744] [cursor=pointer]:
                      - generic [ref=e749]: Modifier
              - listitem [ref=e750]:
                - generic [ref=e751]:
                  - generic [ref=e752]:
                    - paragraph [ref=e753]: SMS des rappels pour les billets gratuits
                    - paragraph [ref=e754]: Pour un porteur qui ne détient que des billets gratuits ou des invitations de l’événement. Les rappels arrivent toujours dans l’application et en notification push.
                    - paragraph [ref=e755]:
                      - text: "Par défaut : Jamais · Modifié le"
                      - time [ref=e756]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e757]:
                    - generic [ref=e758]: Jamais
                    - button "Modifier SMS des rappels pour les billets gratuits" [ref=e759] [cursor=pointer]:
                      - generic [ref=e764]: Modifier
          - region [ref=e765]:
            - generic [ref=e766]:
              - heading "Services en préparation" [level=2] [ref=e767]
              - paragraph [ref=e771]: "Pas prêt pour le public : ces services ne sont pas encore vérifiés pour les paiements. Un service désactivé n’est ni visible ni utilisable par les clients et les partenaires. Pour en activer un, tapez ACTIVER."
            - list [ref=e772]:
              - listitem [ref=e773]:
                - generic [ref=e774]:
                  - generic [ref=e775]:
                    - paragraph [ref=e776]: Salles de fête
                    - paragraph [ref=e777]: Pas prêt pour le public
                    - paragraph [ref=e778]: "Réservation de salles par les clients et gestion des salles par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
                    - paragraph [ref=e779]:
                      - text: "Par défaut : Désactivé · Modifié le"
                      - time [ref=e780]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e781]:
                    - generic [ref=e782]: Désactivé
                    - button "Modifier Salles de fête" [ref=e783] [cursor=pointer]:
                      - generic [ref=e788]: Modifier
              - listitem [ref=e789]:
                - generic [ref=e790]:
                  - generic [ref=e791]:
                    - paragraph [ref=e792]: Réservation de tables
                    - paragraph [ref=e793]: Pas prêt pour le public
                    - paragraph [ref=e794]: "Réservation de tables dans les restaurants et gestion des tables par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
                    - paragraph [ref=e795]:
                      - text: "Par défaut : Désactivé · Modifié le"
                      - time [ref=e796]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e797]:
                    - generic [ref=e798]: Désactivé
                    - button "Modifier Réservation de tables" [ref=e799] [cursor=pointer]:
                      - generic [ref=e804]: Modifier
              - listitem [ref=e805]:
                - generic [ref=e806]:
                  - generic [ref=e807]:
                    - paragraph [ref=e808]: Commandes de repas
                    - paragraph [ref=e809]: Pas prêt pour le public
                    - paragraph [ref=e810]: "Menus, produits et commandes de repas. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent. Les achats de billets ne sont pas concernés."
                    - paragraph [ref=e811]:
                      - text: "Par défaut : Désactivé · Modifié le"
                      - time [ref=e812]: lun. 16 nov. 2026 à 22:43
                  - generic [ref=e813]:
                    - generic [ref=e814]: Désactivé
                    - button "Modifier Commandes de repas" [ref=e815] [cursor=pointer]:
                      - generic [ref=e820]: Modifier
          - region [ref=e821]:
            - heading "Historique des modifications" [level=2] [ref=e822]
            - list [ref=e827]:
              - listitem [ref=e828]:
                - paragraph [ref=e829]: Ouverture du contrôle avant le début
                - paragraph [ref=e830]:
                  - text: 24 h →
                  - generic [ref=e831]: devient
                  - text: 6 h
                - paragraph [ref=e832]:
                  - time [ref=e833]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e834]:
                - paragraph [ref=e835]: Ouverture du contrôle avant le début
                - paragraph [ref=e836]:
                  - text: 6 h →
                  - generic [ref=e837]: devient
                  - text: 24 h
                - paragraph [ref=e838]:
                  - time [ref=e839]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : ecart de caisse"
              - listitem [ref=e840]:
                - paragraph [ref=e841]: Ouverture du contrôle avant le début
                - paragraph [ref=e842]:
                  - text: 24 h →
                  - generic [ref=e843]: devient
                  - text: 6 h
                - paragraph [ref=e844]:
                  - time [ref=e845]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e846]:
                - paragraph [ref=e847]: Ouverture du contrôle avant le début
                - paragraph [ref=e848]:
                  - text: 6 h →
                  - generic [ref=e849]: devient
                  - text: 24 h
                - paragraph [ref=e850]:
                  - time [ref=e851]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : renvoi seulement"
              - listitem [ref=e852]:
                - paragraph [ref=e853]: Ouverture du contrôle avant le début
                - paragraph [ref=e854]:
                  - text: 24 h →
                  - generic [ref=e855]: devient
                  - text: 6 h
                - paragraph [ref=e856]:
                  - time [ref=e857]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e858]:
                - paragraph [ref=e859]: Ouverture du contrôle avant le début
                - paragraph [ref=e860]:
                  - text: 6 h →
                  - generic [ref=e861]: devient
                  - text: 24 h
                - paragraph [ref=e862]:
                  - time [ref=e863]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : taille du lot"
              - listitem [ref=e864]:
                - paragraph [ref=e865]: Ouverture du contrôle avant le début
                - paragraph [ref=e866]:
                  - text: 24 h →
                  - generic [ref=e867]: devient
                  - text: 6 h
                - paragraph [ref=e868]:
                  - time [ref=e869]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e870]:
                - paragraph [ref=e871]: Ouverture du contrôle avant le début
                - paragraph [ref=e872]:
                  - text: 6 h →
                  - generic [ref=e873]: devient
                  - text: 24 h
                - paragraph [ref=e874]:
                  - time [ref=e875]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : plein ecran"
              - listitem [ref=e876]:
                - paragraph [ref=e877]: Ouverture du contrôle avant le début
                - paragraph [ref=e878]:
                  - text: 24 h →
                  - generic [ref=e879]: devient
                  - text: 6 h
                - paragraph [ref=e880]:
                  - time [ref=e881]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e882]:
                - paragraph [ref=e883]: Ouverture du contrôle avant le début
                - paragraph [ref=e884]:
                  - text: 6 h →
                  - generic [ref=e885]: devient
                  - text: 24 h
                - paragraph [ref=e886]:
                  - time [ref=e887]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : barre achat"
              - listitem [ref=e888]:
                - paragraph [ref=e889]: Ouverture du contrôle avant le début
                - paragraph [ref=e890]:
                  - text: 24 h →
                  - generic [ref=e891]: devient
                  - text: 6 h
                - paragraph [ref=e892]:
                  - time [ref=e893]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e894]:
                - paragraph [ref=e895]: Ouverture du contrôle avant le début
                - paragraph [ref=e896]:
                  - text: 6 h →
                  - generic [ref=e897]: devient
                  - text: 24 h
                - paragraph [ref=e898]:
                  - time [ref=e899]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : reprise de session"
              - listitem [ref=e900]:
                - paragraph [ref=e901]: Ouverture du contrôle avant le début
                - paragraph [ref=e902]:
                  - text: 24 h →
                  - generic [ref=e903]: devient
                  - text: 6 h
                - paragraph [ref=e904]:
                  - time [ref=e905]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e906]:
                - paragraph [ref=e907]: Ouverture du contrôle avant le début
                - paragraph [ref=e908]:
                  - text: 6 h →
                  - generic [ref=e909]: devient
                  - text: 24 h
                - paragraph [ref=e910]:
                  - time [ref=e911]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : camera en arriere-plan"
              - listitem [ref=e912]:
                - paragraph [ref=e913]: Ouverture du contrôle avant le début
                - paragraph [ref=e914]:
                  - text: 24 h →
                  - generic [ref=e915]: devient
                  - text: 6 h
                - paragraph [ref=e916]:
                  - time [ref=e917]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e918]:
                - paragraph [ref=e919]: Ouverture du contrôle avant le début
                - paragraph [ref=e920]:
                  - text: 6 h →
                  - generic [ref=e921]: devient
                  - text: 24 h
                - paragraph [ref=e922]:
                  - time [ref=e923]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : vibrations"
              - listitem [ref=e924]:
                - paragraph [ref=e925]: Ouverture du contrôle avant le début
                - paragraph [ref=e926]:
                  - text: 24 h →
                  - generic [ref=e927]: devient
                  - text: 6 h
                - paragraph [ref=e928]:
                  - time [ref=e929]: lun. 16 nov. 2026 à 23:14
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e930]:
                - paragraph [ref=e931]: Ouverture du contrôle avant le début
                - paragraph [ref=e932]:
                  - text: 6 h →
                  - generic [ref=e933]: devient
                  - text: 24 h
                - paragraph [ref=e934]:
                  - time [ref=e935]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : mesure du scan"
              - listitem [ref=e936]:
                - paragraph [ref=e937]: Ouverture du contrôle avant le début
                - paragraph [ref=e938]:
                  - text: 24 h →
                  - generic [ref=e939]: devient
                  - text: 6 h
                - paragraph [ref=e940]:
                  - time [ref=e941]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e942]:
                - paragraph [ref=e943]: Ouverture du contrôle avant le début
                - paragraph [ref=e944]:
                  - text: 6 h →
                  - generic [ref=e945]: devient
                  - text: 24 h
                - paragraph [ref=e946]:
                  - time [ref=e947]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : idempotence"
              - listitem [ref=e948]:
                - paragraph [ref=e949]: Ouverture du contrôle avant le début
                - paragraph [ref=e950]:
                  - text: 24 h →
                  - generic [ref=e951]: devient
                  - text: 6 h
                - paragraph [ref=e952]:
                  - time [ref=e953]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e954]:
                - paragraph [ref=e955]: Ouverture du contrôle avant le début
                - paragraph [ref=e956]:
                  - text: 6 h →
                  - generic [ref=e957]: devient
                  - text: 24 h
                - paragraph [ref=e958]:
                  - time [ref=e959]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : cache sans api"
              - listitem [ref=e960]:
                - paragraph [ref=e961]: Ouverture du contrôle avant le début
                - paragraph [ref=e962]:
                  - text: 24 h →
                  - generic [ref=e963]: devient
                  - text: 6 h
                - paragraph [ref=e964]:
                  - time [ref=e965]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e966]:
                - paragraph [ref=e967]: Ouverture du contrôle avant le début
                - paragraph [ref=e968]:
                  - text: 6 h →
                  - generic [ref=e969]: devient
                  - text: 24 h
                - paragraph [ref=e970]:
                  - time [ref=e971]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : écart -5 min"
              - listitem [ref=e972]:
                - paragraph [ref=e973]: Ouverture du contrôle avant le début
                - paragraph [ref=e974]:
                  - text: 24 h →
                  - generic [ref=e975]: devient
                  - text: 6 h
                - paragraph [ref=e976]:
                  - time [ref=e977]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e978]:
                - paragraph [ref=e979]: Ouverture du contrôle avant le début
                - paragraph [ref=e980]:
                  - text: 6 h →
                  - generic [ref=e981]: devient
                  - text: 24 h
                - paragraph [ref=e982]:
                  - time [ref=e983]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : écart +5 min"
              - listitem [ref=e984]:
                - paragraph [ref=e985]: Ouverture du contrôle avant le début
                - paragraph [ref=e986]:
                  - text: 24 h →
                  - generic [ref=e987]: devient
                  - text: 6 h
                - paragraph [ref=e988]:
                  - time [ref=e989]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : restauration après le projet e2e terrain (lot 7)"
              - listitem [ref=e990]:
                - paragraph [ref=e991]: Ouverture du contrôle avant le début
                - paragraph [ref=e992]:
                  - text: 6 h →
                  - generic [ref=e993]: devient
                  - text: 24 h
                - paragraph [ref=e994]:
                  - time [ref=e995]: lun. 16 nov. 2026 à 23:12
                  - text: "· Par Elhadji SuperAdmin · Motif : projet e2e terrain (lot 7) : fumee prolongee"
              - listitem [ref=e996]:
                - paragraph [ref=e997]: Montant fixe de la réserve de prudence
                - paragraph [ref=e998]:
                  - text: — →
                  - generic [ref=e999]: devient
                  - text: 0 F CFA
                - paragraph [ref=e1000]:
                  - time [ref=e1001]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1002]:
                - paragraph [ref=e1003]: Réserve de prudence
                - paragraph [ref=e1004]:
                  - text: — →
                  - generic [ref=e1005]: devient
                  - text: "Automatique : encaissements des 3 derniers jours"
                - paragraph [ref=e1006]:
                  - time [ref=e1007]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1008]:
                - paragraph [ref=e1009]: Téléphone du support
                - paragraph [ref=e1010]:
                  - text: — →
                  - generic [ref=e1011]: devient
                  - text: Non renseigné
                - paragraph [ref=e1012]:
                  - time [ref=e1013]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1014]:
                - paragraph [ref=e1015]: Email du support
                - paragraph [ref=e1016]:
                  - text: — →
                  - generic [ref=e1017]: devient
                  - text: Non renseigné
                - paragraph [ref=e1018]:
                  - time [ref=e1019]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1020]:
                - paragraph [ref=e1021]: Numéro WhatsApp du support
                - paragraph [ref=e1022]:
                  - text: — →
                  - generic [ref=e1023]: devient
                  - text: Non renseigné
                - paragraph [ref=e1024]:
                  - time [ref=e1025]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1026]:
                - paragraph [ref=e1027]: "Alerte de refus à une porte : durée observée"
                - paragraph [ref=e1028]:
                  - text: — →
                  - generic [ref=e1029]: devient
                  - text: 5 min
                - paragraph [ref=e1030]:
                  - time [ref=e1031]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1032]:
                - paragraph [ref=e1033]: "Alerte de refus à une porte : nombre de refus"
                - paragraph [ref=e1034]:
                  - text: — →
                  - generic [ref=e1035]: devient
                  - text: 10 refus
                - paragraph [ref=e1036]:
                  - time [ref=e1037]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1038]:
                - paragraph [ref=e1039]: Durée de garde des places pendant un paiement (minutes)
                - paragraph [ref=e1040]:
                  - text: — →
                  - generic [ref=e1041]: devient
                  - text: 10 min
                - paragraph [ref=e1042]:
                  - time [ref=e1043]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1044]:
                - paragraph [ref=e1045]: Seuil d’alerte des SMS indispensables du jour
                - paragraph [ref=e1046]:
                  - text: — →
                  - generic [ref=e1047]: devient
                  - text: 2 000 SMS
                - paragraph [ref=e1048]:
                  - time [ref=e1049]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1050]:
                - paragraph [ref=e1051]: Prix minimum d’un billet payant (F CFA)
                - paragraph [ref=e1052]:
                  - text: — →
                  - generic [ref=e1053]: devient
                  - text: 100 F CFA
                - paragraph [ref=e1054]:
                  - time [ref=e1055]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1056]:
                - paragraph [ref=e1057]: Réservation de tables
                - paragraph [ref=e1058]:
                  - text: — →
                  - generic [ref=e1059]: devient
                  - text: Désactivé
                - paragraph [ref=e1060]:
                  - time [ref=e1061]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1062]:
                - paragraph [ref=e1063]: Salles de fête
                - paragraph [ref=e1064]:
                  - text: — →
                  - generic [ref=e1065]: devient
                  - text: Désactivé
                - paragraph [ref=e1066]:
                  - time [ref=e1067]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1068]:
                - paragraph [ref=e1069]: Plafond quotidien des SMS optionnels
                - paragraph [ref=e1070]:
                  - text: — →
                  - generic [ref=e1071]: devient
                  - text: 700 SMS
                - paragraph [ref=e1072]:
                  - time [ref=e1073]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1074]:
                - paragraph [ref=e1075]: SMS des rappels pour les billets gratuits
                - paragraph [ref=e1076]:
                  - text: — →
                  - generic [ref=e1077]: devient
                  - text: Jamais
                - paragraph [ref=e1078]:
                  - time [ref=e1079]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1080]:
                - paragraph [ref=e1081]: Réglage retiré ou sans libellé
                - paragraph [ref=e1082]:
                  - text: 2 000 →
                  - generic [ref=e1083]: devient
                  - text: —
                - paragraph [ref=e1084]:
                  - time [ref=e1085]: lun. 16 nov. 2026 à 22:43
                  - text: "· Par Automatique · Motif : suppression"
              - listitem [ref=e1086]:
                - paragraph [ref=e1087]: Commandes de repas
                - paragraph [ref=e1088]:
                  - text: — →
                  - generic [ref=e1089]: devient
                  - text: Désactivé
                - paragraph [ref=e1090]:
                  - time [ref=e1091]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1092]:
                - paragraph [ref=e1093]: Rappel la veille
                - paragraph [ref=e1094]:
                  - text: — →
                  - generic [ref=e1095]: devient
                  - text: Activé
                - paragraph [ref=e1096]:
                  - time [ref=e1097]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1098]:
                - paragraph [ref=e1099]: Réglage retiré ou sans libellé
                - paragraph [ref=e1100]:
                  - text: — →
                  - generic [ref=e1101]: devient
                  - text: 2 000
                - paragraph [ref=e1102]:
                  - time [ref=e1103]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1104]:
                - paragraph [ref=e1105]: Fin de la plage sans SMS
                - paragraph [ref=e1106]:
                  - text: — →
                  - generic [ref=e1107]: devient
                  - text: 8 h
                - paragraph [ref=e1108]:
                  - time [ref=e1109]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1110]:
                - paragraph [ref=e1111]: Début de la plage sans SMS
                - paragraph [ref=e1112]:
                  - text: — →
                  - generic [ref=e1113]: devient
                  - text: 22 h
                - paragraph [ref=e1114]:
                  - time [ref=e1115]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1116]:
                - paragraph [ref=e1117]: SMS du rappel avant le début
                - paragraph [ref=e1118]:
                  - text: — →
                  - generic [ref=e1119]: devient
                  - text: Seulement sans notification push
                - paragraph [ref=e1120]:
                  - time [ref=e1121]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1122]:
                - paragraph [ref=e1123]: SMS du rappel de la veille
                - paragraph [ref=e1124]:
                  - text: — →
                  - generic [ref=e1125]: devient
                  - text: Toujours
                - paragraph [ref=e1126]:
                  - time [ref=e1127]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1128]:
                - paragraph [ref=e1129]: Heures avant le début
                - paragraph [ref=e1130]:
                  - text: — →
                  - generic [ref=e1131]: devient
                  - text: 3 h
                - paragraph [ref=e1132]:
                  - time [ref=e1133]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1134]:
                - paragraph [ref=e1135]: Rappel avant le début
                - paragraph [ref=e1136]:
                  - text: — →
                  - generic [ref=e1137]: devient
                  - text: Activé
                - paragraph [ref=e1138]:
                  - time [ref=e1139]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1140]:
                - paragraph [ref=e1141]: Heure du rappel de la veille
                - paragraph [ref=e1142]:
                  - text: — →
                  - generic [ref=e1143]: devient
                  - text: 10 h
                - paragraph [ref=e1144]:
                  - time [ref=e1145]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1146]:
                - paragraph [ref=e1147]: Seuil « bientôt complet »
                - paragraph [ref=e1148]:
                  - text: — →
                  - generic [ref=e1149]: devient
                  - text: 10 places
                - paragraph [ref=e1150]:
                  - time [ref=e1151]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1152]:
                - paragraph [ref=e1153]: Ouverture du contrôle avant le début
                - paragraph [ref=e1154]:
                  - text: — →
                  - generic [ref=e1155]: devient
                  - text: 6 h
                - paragraph [ref=e1156]:
                  - time [ref=e1157]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1158]:
                - paragraph [ref=e1159]: Vente au guichet en espèces
                - paragraph [ref=e1160]:
                  - text: — →
                  - generic [ref=e1161]: devient
                  - text: Activé
                - paragraph [ref=e1162]:
                  - time [ref=e1163]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1164]:
                - paragraph [ref=e1165]: Fermeture du contrôle après la fin
                - paragraph [ref=e1166]:
                  - text: — →
                  - generic [ref=e1167]: devient
                  - text: 6 h
                - paragraph [ref=e1168]:
                  - time [ref=e1169]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1170]:
                - paragraph [ref=e1171]: Saisie manuelle d’un numéro de billet
                - paragraph [ref=e1172]:
                  - text: — →
                  - generic [ref=e1173]: devient
                  - text: Contrôleur affecté seul
                - paragraph [ref=e1174]:
                  - time [ref=e1175]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1176]:
                - paragraph [ref=e1177]: Frais agrégateur Wave
                - paragraph [ref=e1178]:
                  - text: — →
                  - generic [ref=e1179]: devient
                  - text: 1,5 %
                - paragraph [ref=e1180]:
                  - time [ref=e1181]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1182]:
                - paragraph [ref=e1183]: Délai de validation des commissions
                - paragraph [ref=e1184]:
                  - text: — →
                  - generic [ref=e1185]: devient
                  - text: 7 jours
                - paragraph [ref=e1186]:
                  - time [ref=e1187]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1188]:
                - paragraph [ref=e1189]: Retraits par virement bancaire
                - paragraph [ref=e1190]:
                  - text: — →
                  - generic [ref=e1191]: devient
                  - text: Désactivé
                - paragraph [ref=e1192]:
                  - time [ref=e1193]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1194]:
                - paragraph [ref=e1195]: Montant minimum de retrait
                - paragraph [ref=e1196]:
                  - text: — →
                  - generic [ref=e1197]: devient
                  - text: 5 000 F CFA
                - paragraph [ref=e1198]:
                  - time [ref=e1199]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1200]:
                - paragraph [ref=e1201]: Frais de retrait
                - paragraph [ref=e1202]:
                  - text: — →
                  - generic [ref=e1203]: devient
                  - text: 1 %
                - paragraph [ref=e1204]:
                  - time [ref=e1205]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1206]:
                - paragraph [ref=e1207]: Délai après la fin de l’événement
                - paragraph [ref=e1208]:
                  - text: — →
                  - generic [ref=e1209]: devient
                  - text: 48 h
                - paragraph [ref=e1210]:
                  - time [ref=e1211]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1212]:
                - paragraph [ref=e1213]: Délai de garde des ventes
                - paragraph [ref=e1214]:
                  - text: — →
                  - generic [ref=e1215]: devient
                  - text: Activé
                - paragraph [ref=e1216]:
                  - time [ref=e1217]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1218]:
                - paragraph [ref=e1219]: Frais agrégateur d’une annulation
                - paragraph [ref=e1220]:
                  - text: — →
                  - generic [ref=e1221]: devient
                  - text: Event Village
                - paragraph [ref=e1222]:
                  - time [ref=e1223]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1224]:
                - paragraph [ref=e1225]: Frais agrégateur Orange Money
                - paragraph [ref=e1226]:
                  - text: — →
                  - generic [ref=e1227]: devient
                  - text: 1,5 %
                - paragraph [ref=e1228]:
                  - time [ref=e1229]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
              - listitem [ref=e1230]:
                - paragraph [ref=e1231]: Frais de service
                - paragraph [ref=e1232]:
                  - text: — →
                  - generic [ref=e1233]: devient
                  - text: 5 %
                - paragraph [ref=e1234]:
                  - time [ref=e1235]: lun. 16 nov. 2026 à 22:43
                  - text: · Par Automatique
  - alert [ref=e1236]
```

# Test source

```ts
  227 |     await poster.setViewportSize(POSTER_SIZE);
  228 |     await poster.setContent(posterHtml({ title, kicker: 'Recette', dateLabel, venue: 'Corniche de Ngor', city: 'Dakar', organizer: r.p1.company, palette: 'ocean', motif: 'vagues' }));
  229 |     const png = await poster.screenshot({ type: 'png' });
  230 |     await poster.close();
  231 |     return png;
  232 | }
  233 | 
  234 | async function addCategory(page: Page, index: number, c: CategorySpec): Promise<void> {
  235 |     await page.getByRole('button', { name: /^ajouter une catégorie$/i }).click();
  236 |     const section = page.locator('section[aria-labelledby$="-titre"]').nth(index);
  237 |     await section.getByLabel(/^nom de la catégorie/i).fill(c.name);
  238 |     await section.getByLabel(/^prix/i).fill(String(c.price));
  239 |     await section.getByLabel(/^quantité mise en vente/i).fill(String(c.total));
  240 |     await section.getByRole('checkbox', { name: /^vendue en ligne/i }).setChecked(c.online);
  241 |     await section.getByRole('checkbox', { name: /^vendue au guichet/i }).setChecked(c.counter);
  242 |     await expect(section.getByText(c.result, { exact: true }), `résumé des canaux de « ${c.name} »`).toBeVisible();
  243 | }
  244 | 
  245 | /** Billets d'un compte sur un événement, du plus ancien au plus récent. */
  246 | async function ticketsOf(eventId: string, userId: string, categoryId: string): Promise<string[]> {
  247 |     const { data, error } = await serviceClient().from('tickets').select('id').eq('event_id', eventId).eq('user_id', userId).eq('category_id', categoryId).order('ticket_number');
  248 |     if (error) throw new Error(`[e2e] billets de ${userId} : ${error.message}`);
  249 |     return (data ?? []).map((t) => String(t.id));
  250 | }
  251 | 
  252 | async function ticketStatus(id: string): Promise<string> {
  253 |     const { data, error } = await serviceClient().from('tickets').select('status').eq('id', id).single();
  254 |     if (error || !data) throw new Error(`[e2e] billet ${id} : ${error?.message ?? 'introuvable'}`);
  255 |     return String(data.status);
  256 | }
  257 | 
  258 | /** Plein écran du résultat refermé : le scanner reçoit de nouveau les gestes. */
  259 | async function resultClosed(page: Page): Promise<void> {
  260 |     await expect(page.locator('[data-scan-state="result"]'), 'plein écran du résultat refermé').toHaveCount(0, { timeout: 20_000 });
  261 | }
  262 | 
  263 | async function expectScan(page: Page, payload: string, what: string, expected: string): Promise<void> {
  264 |     const { record } = await presentPayload(page, payload, what);
  265 |     await expect(page.locator(`[data-scan-result="${expected}"]`).first(), `${what} : « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  266 |     await resultClosed(page);
  267 | }
  268 | 
  269 | async function videoPlaying(page: Page, what: string): Promise<void> {
  270 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  271 |         .catch((err: unknown) => {
  272 |             throw new Error(`${what} : aucun flux vidéo en lecture (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  273 |         });
  274 | }
  275 | 
  276 | /** Remboursement unitaire à l'écran (A4) : recherche, motif, confirmation ; le POST ne part que de la seconde étape. */
  277 | async function refundOnScreen(page: Page, ticketNumber: string, reason: string, expectedNotice: RegExp): Promise<void> {
  278 |     await page.goto(`/partner/events/${r.e1.id}`);
  279 |     await openTab(page, /^ventes/i);
  280 |     await page.getByLabel(/^numéro du billet/i).fill(ticketNumber);
  281 |     await expectRoute(page, 'GET', /\/tickets\/lookup$/, () => page.getByRole('button', { name: /^rechercher le billet$/i }).click(), 200, `recherche du billet ${ticketNumber}`);
  282 |     await page.getByRole('button', { name: /^rembourser ce billet$/i }).click();
  283 |     const reasonDialog = page.getByRole('dialog', { name: /^motif du remboursement$/i });
  284 |     await expect(reasonDialog).toBeVisible();
  285 |     await reasonDialog.getByRole('textbox').fill(reason);
  286 |     await reasonDialog.getByRole('button', { name: /^continuer$/i }).click();
  287 |     const confirm = page.getByRole('alertdialog', { name: /^confirmer le remboursement/i });
  288 |     await expect(confirm).toBeVisible();
  289 |     await expect(confirm.getByText(reason), 'motif rappelé dans la confirmation').toBeVisible();
  290 |     await expect(confirm.getByRole('button', { name: /^revenir à la fiche$/i })).toBeVisible();
  291 |     await expectRoute(page, 'POST', /\/tickets\/[^/]+\/refund$/, () => confirm.getByRole('button', { name: /^rembourser le client$/i }).click(), 200, `remboursement du billet ${ticketNumber}`);
  292 |     await expect(page.getByText(expectedNotice).first(), `issue du remboursement du billet ${ticketNumber}`).toBeVisible();
  293 | }
  294 | 
  295 | test.beforeAll(() => {
  296 |     e2eConfig();
  297 | });
  298 | 
  299 | test.afterAll(async () => {
  300 |     const problems: string[] = [];
  301 |     const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  302 |     for (const [key, value] of Array.from(previousSettings.entries())) {
  303 |         await restoreSetting(key, value, superadminId).catch((err: unknown) => problems.push(err instanceof Error ? err.message : String(err)));
  304 |     }
  305 |     const balance = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE })
  306 |         .catch((err: unknown) => ({ status: 0, json: { error: err instanceof Error ? err.message : String(err) } }));
  307 |     if (balance.status !== 200) problems.push(`solde du faux SamirPay non rétabli : ${JSON.stringify(balance)}`);
  308 |     for (const { who, guard } of opened) {
  309 |         const seen = [...guard.blockingIssues(), ...guard.nonBlockingIssues()];
  310 |         if (seen.length > 0) console.log(`[e2e][recette] ${who} — observations du navigateur (non bloquantes) :\n${seen.join('\n')}`);
  311 |     }
  312 |     for (const c of Array.from(new Set(opened.map((o) => o.context)))) await c.close();
  313 |     if (problems.length > 0) throw new Error(`[e2e][recette] remise en état incomplète :\n${problems.join('\n')}`);
  314 | });
  315 | 
  316 | test('acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé', async ({ browser }, testInfo) => {
  317 |     for (const key of [HOLD_KEY, SCAN_WINDOW_KEY]) previousSettings.set(key, await settingValue(key));
  318 |     const page = await asRole(browser, testInfo, 'fumee-superadmin');
  319 |     const hold = 'Délai de garde des ventes';
  320 |     const holdReason = `Recette ${STAMP} : fonds disponibles dès le paiement`;
  321 | 
  322 |     await test.step('motif exigé, puis réglage enregistré et historisé', async () => {
  323 |         await page.goto('/admin/finance-settings');
  324 |         const row = settingRow(page, hold);
  325 |         await row.getByRole('button', { name: `Modifier ${hold}` }).click();
  326 |         await row.getByLabel(/^nouvelle valeur/i).selectOption('false');
> 327 |         await row.getByRole('button', { name: /^enregistrer$/i }).click();
      |                                                                   ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  328 |         await expect(row.getByText(/indiquez le motif/i), 'sans motif, rien n’est envoyé').toBeVisible();
  329 |         await row.getByRole('button', { name: /^annuler$/i }).click();
  330 | 
  331 |         const edited = await editSetting(page, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('false'), holdReason);
  332 |         await saveSetting(page, hold, edited, 'Désactivé');
  333 |         await expect(page.getByRole('listitem').filter({ hasText: holdReason }), 'motif dans l’historique des modifications').toBeVisible();
  334 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} en base`).toBe(false);
  335 |     });
  336 | 
  337 |     await test.step('fenêtre de scan portée à 24 h (billet et contrôle de la veille)', async () => {
  338 |         const label = 'Ouverture du contrôle avant le début';
  339 |         const row = await editSetting(page, label, (l) => l.getByLabel(/^nouvelle valeur/i).fill('24'), `Recette ${STAMP} : contrôle ouvert la veille`);
  340 |         await saveSetting(page, label, row, '24 h');
  341 |         expect(await settingValue(SCAN_WINDOW_KEY), `${SCAN_WINDOW_KEY} en base`).toBe(24);
  342 |     });
  343 | 
  344 |     await test.step('un ADMIN lit les réglages sans « Modifier » (R51), sa modification envoyée directement est refusée', async () => {
  345 |         const admin = await asRole(browser, testInfo, 'admin');
  346 |         await admin.goto('/admin/finance-settings');
  347 |         await expect(admin.getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i), 'lecture seule annoncée').toBeVisible();
  348 |         await expect(settingRow(admin, hold).getByText('Désactivé', { exact: true }), 'réglage lu par un ADMIN').toBeVisible();
  349 |         await expect(admin.getByRole('button', { name: /^modifier /i }), 'aucun bouton « Modifier » sans le droit (R51, B34)').toHaveCount(0);
  350 |         // Le serveur reste juge : la même modification envoyée sans l'écran est refusée
  351 |         const status = await admin.evaluate(async (key) => {
  352 |             const res = await fetch('/api/admin/finance-settings', {
  353 |                 method: 'PUT', headers: { 'Content-Type': 'application/json' },
  354 |                 body: JSON.stringify({ key, value: true, reason: 'Tentative d’un ADMIN sans le droit' }),
  355 |             });
  356 |             return res.status;
  357 |         }, HOLD_KEY);
  358 |         expect(status, 'modification par un ADMIN').toBe(403);
  359 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} inchangé après le refus`).toBe(false);
  360 |     });
  361 | });
  362 | 
  363 | test('acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2', async ({ browser }, testInfo) => {
  364 |     const partner = await asNew(browser, testInfo, 'P1');
  365 |     const admin = await asRole(browser, testInfo, 'fumee-superadmin');
  366 | 
  367 |     await test.step('inscription du partenaire : formulaire, 2 pièces, code SMS', async () => {
  368 |         await partner.goto('/partner/register');
  369 |         await partner.locator('#partenaire-raison-sociale').fill(r.p1.company);
  370 |         await partner.locator('#partenaire-description').fill('Organisateur de la recette de la billetterie. Données fictives.');
  371 |         await partner.locator('#partenaire-adresse').fill('12, route de la Corniche, Ngor');
  372 |         await partner.locator('#partenaire-ville').fill('Dakar');
  373 |         await partner.locator('#partenaire-prenom').fill(r.p1.firstName);
  374 |         await partner.locator('#partenaire-nom').fill('Recette');
  375 |         await partner.locator('#partenaire-telephone').fill(r.p1.local);
  376 |         await partner.locator('#partenaire-email').fill(r.p1.email);
  377 |         await partner.locator('#partenaire-mot-de-passe').fill(TEST_PASSWORD);
  378 |         await partner.locator('#partenaire-confirmation').fill(TEST_PASSWORD);
  379 |         await partner.locator('#partenaire-piece-identite').setInputFiles(pdfDocument('piece-identite.pdf'));
  380 |         await partner.locator('#partenaire-document-entreprise').setInputFiles(pdfDocument('rccm.pdf'));
  381 |         const seen = await smsSeen(r.p1.phone);
  382 |         // Lot 9 bis (R53, B40) : appel 1, code envoyé, rien n'est créé tant que le code n'est pas saisi
  383 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^envoyer mon dossier$/i }).click(), 200, 'dossier, appel 1 : envoi du code');
  384 |         await expect(partner.getByRole('heading', { name: /^vérifiez votre numéro$/i })).toBeVisible();
  385 |         const { data: early, error: earlyErr } = await serviceClient().from('users').select('id').in('phone', [r.p1.phone, r.p1.phone.slice(1)]);
  386 |         if (earlyErr) throw new Error(`[e2e] compte de P1 avant le code : ${earlyErr.message}`);
  387 |         expect(early ?? [], 'aucun compte créé avant le code (R53)').toEqual([]);
  388 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'inscription du partenaire'));
  389 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^vérifier le code$/i }).click(), 201, 'dossier, appel 2 : compte et fiche créés');
  390 |         await expect(partner.getByRole('heading', { name: /^dossier reçu$/i })).toBeVisible();
  391 |     });
  392 | 
  393 |     await test.step('R7 : espace partenaire en attente, « Compte en cours de vérification » avant la validation', async () => {
  394 |         await partner.getByRole('button', { name: /^ouvrir mon espace partenaire$/i }).click();
  395 |         await partner.waitForURL(/\/partner\/dashboard/, { timeout: 30_000 });
  396 |         await expect(partner.getByText('Compte en cours de vérification', { exact: true }).first(), 'bandeau du compte en attente (R7)').toBeVisible();
  397 |         // Session de l'inscription refermée : la connexion de P1 par son numéro est prouvée après la validation
  398 |         await partner.context().clearCookies();
  399 |     });
  400 | 
  401 |     await test.step('validation par le SUPERADMIN, après consultation d’une pièce', async () => {
  402 |         await admin.goto('/admin/dashboard');
  403 |         await openTab(admin, /^en attente/i);
  404 |         const row = admin.locator('tr').filter({ hasText: r.p1.company });
  405 |         await row.getByRole('button', { name: /^dossier$/i }).click();
  406 |         const details = admin.getByRole('dialog', { name: /^dossier du partenaire/i });
  407 |         await expect(details).toBeVisible();
  408 |         const signed = await expectRoute(admin, 'GET', '/api/partner/documents/signed-url',
  409 |             () => details.getByRole('button', { name: /^ouvrir la pièce d’identité/i }).click(), 200, 'lien de consultation de la pièce d’identité');
  410 |         expect(typeof signed.signedUrl, 'URL signée de la pièce').toBe('string');
  411 |         const file = await fetch(String(signed.signedUrl));
  412 |         expect(file.status, 'pièce lue par son URL signée').toBe(200);
  413 |         expect((await file.text()).startsWith('%PDF-'), 'pièce d’identité : le fichier déposé').toBe(true);
  414 |         await details.getByRole('button', { name: /^valider la candidature$/i }).click();
  415 |         const validation = admin.getByRole('alertdialog', { name: /^valider la candidature/i });
  416 |         await expectRoute(admin, 'PATCH', /^\/api\/admin\/partners\/[^/]+\/status$/, () => validation.getByRole('button', { name: /^valider la candidature$/i }).click(), 200, 'validation de la candidature');
  417 |         await expect(row, 'candidature sortie de la file').toHaveCount(0);
  418 |     });
  419 | 
  420 |     await test.step('P1 se connecte, crée E1 : affiche, programme, infos pratiques, 4 catégories et leurs canaux', async () => {
  421 |         // Lot 9 bis (R87) : l'adresse saisie attend sa vérification, P1 se connecte par son numéro
  422 |         await signIn(partner, r.p1.local, /^\/partner(\/|$)/);
  423 |         r.p1.userId = await userIdByPhone(r.p1.phone);
  424 | 
  425 |         const start = new Date(Date.now() + 20 * 3600_000);
  426 |         start.setUTCSeconds(0, 0);
  427 |         start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
```