# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2
- Location: e2e/recette.spec.ts:363:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^ouvrir mon espace partenaire$/i })

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
            - link "Utilisateurs" [ref=e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e47]:
          - paragraph [ref=e48]: Finances
          - generic [ref=e49]:
            - link "Finance" [ref=e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=e57]:
          - paragraph [ref=e58]: Engagement
          - generic [ref=e59]:
            - link "Parrainage" [ref=e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=e70]:
          - paragraph [ref=e71]: Système
          - generic [ref=e72]:
            - link "Journal d’audit" [ref=e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=e94] [cursor=pointer]:
          - /url: /
      - generic [ref=e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e101]: ES
          - generic [ref=e102]:
            - generic [ref=e103]: Elhadji SuperAdmin
            - generic [ref=e104]: Super administrateur
        - generic [ref=e105]:
          - button "Se déconnecter" [ref=e106] [cursor=pointer]
          - button "Basculer le thème" [ref=e111] [cursor=pointer]
    - generic [ref=e115]:
      - banner [ref=e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 63 non lues" [ref=e125] [cursor=pointer]:
          - generic [ref=e129]: "63"
      - main [ref=e130]:
        - generic [ref=e132]:
          - generic [ref=e133]:
            - link "Administration" [ref=e135] [cursor=pointer]:
              - /url: /admin
            - generic [ref=e140]:
              - generic [ref=e141]:
                - heading "Réglages de la plateforme" [level=1] [ref=e142]
                - paragraph [ref=e143]: Chaque modification est historisée et ne s’applique qu’aux opérations futures.
              - button "Actualiser" [ref=e145] [cursor=pointer]
          - region [ref=e153]:
            - generic [ref=e154]:
              - heading "Finance" [level=2] [ref=e155]
              - paragraph [ref=e159]: Frais, délais de disponibilité des ventes, retraits et commissions.
            - list [ref=e160]:
              - listitem [ref=e161]:
                - generic [ref=e162]:
                  - generic [ref=e163]:
                    - paragraph [ref=e164]: Frais de service
                    - paragraph [ref=e165]: Payés par l’acheteur, arrondis au franc CFA supérieur par billet. De 0 à 50 %.
                    - paragraph [ref=e166]:
                      - text: Modifié le
                      - time [ref=e167]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e168]:
                    - generic [ref=e169]: 5 %
                    - button "Modifier Frais de service" [ref=e170] [cursor=pointer]:
                      - generic [ref=e175]: Modifier
              - listitem [ref=e176]:
                - generic [ref=e177]:
                  - generic [ref=e178]:
                    - paragraph [ref=e179]: Durée de garde des places pendant un paiement (minutes)
                    - paragraph [ref=e180]: "Temps pendant lequel les places d’un paiement en attente restent réservées. Le paiement reste valable 1 heure chez SamirPay : validé après l’échéance, il donne les billets s’il reste des places, sinon il est remboursé automatiquement. Entier de 5 à 60."
                    - paragraph [ref=e181]:
                      - text: Modifié le
                      - time [ref=e182]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e183]:
                    - generic [ref=e184]: 10 min
                    - button "Modifier Durée de garde des places pendant un paiement (minutes)" [ref=e185] [cursor=pointer]:
                      - generic [ref=e190]: Modifier
              - listitem [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e193]:
                    - paragraph [ref=e194]: Prix minimum d’un billet payant (F CFA)
                    - paragraph [ref=e195]: Appliqué à toute catégorie payante créée ou dont le prix change ; un billet gratuit reste à 0. À ajuster quand SamirPay donnera son minimum d’encaissement. Entier de 1 à 100 000.
                    - paragraph [ref=e196]:
                      - text: Modifié le
                      - time [ref=e197]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e198]:
                    - generic [ref=e199]: 100 F CFA
                    - button "Modifier Prix minimum d’un billet payant (F CFA)" [ref=e200] [cursor=pointer]:
                      - generic [ref=e205]: Modifier
              - listitem [ref=e206]:
                - generic [ref=e207]:
                  - generic [ref=e208]:
                    - paragraph [ref=e209]: Frais agrégateur Wave
                    - paragraph [ref=e210]: Coût SamirPay d’un paiement Wave. De 0 à 10 %.
                    - paragraph [ref=e211]:
                      - text: Modifié le
                      - time [ref=e212]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e213]:
                    - generic [ref=e214]: 1,5 %
                    - button "Modifier Frais agrégateur Wave" [ref=e215] [cursor=pointer]:
                      - generic [ref=e220]: Modifier
              - listitem [ref=e221]:
                - generic [ref=e222]:
                  - generic [ref=e223]:
                    - paragraph [ref=e224]: Frais agrégateur Orange Money
                    - paragraph [ref=e225]: Coût SamirPay d’un paiement Orange Money. De 0 à 10 %.
                    - paragraph [ref=e226]:
                      - text: Modifié le
                      - time [ref=e227]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e228]:
                    - generic [ref=e229]: 1,5 %
                    - button "Modifier Frais agrégateur Orange Money" [ref=e230] [cursor=pointer]:
                      - generic [ref=e235]: Modifier
              - listitem [ref=e236]:
                - generic [ref=e237]:
                  - generic [ref=e238]:
                    - paragraph [ref=e239]: Frais agrégateur d’une annulation
                    - paragraph [ref=e240]: Qui supporte les frais agrégateur quand un billet est remboursé.
                    - paragraph [ref=e241]:
                      - text: Modifié le
                      - time [ref=e242]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e243]:
                    - generic [ref=e244]: Event Village
                    - button "Modifier Frais agrégateur d’une annulation" [ref=e245] [cursor=pointer]:
                      - generic [ref=e250]: Modifier
              - listitem [ref=e251]:
                - generic [ref=e252]:
                  - generic [ref=e253]:
                    - paragraph [ref=e254]: Délai de garde des ventes
                    - paragraph [ref=e255]: "Désactivé : les ventes sont disponibles dès la confirmation du paiement."
                    - paragraph [ref=e256]:
                      - text: Modifié le
                      - time [ref=e257]: sam. 14 nov. 2026 à 13:10
                  - generic [ref=e258]:
                    - generic [ref=e259]: Désactivé
                    - button "Modifier Délai de garde des ventes" [ref=e260] [cursor=pointer]:
                      - generic [ref=e265]: Modifier
              - listitem [ref=e266]:
                - generic [ref=e267]:
                  - generic [ref=e268]:
                    - paragraph [ref=e269]: Délai après la fin de l’événement
                    - paragraph [ref=e270]: Nombre d’heures avant que les ventes deviennent disponibles. De 0 à 720.
                    - paragraph [ref=e271]:
                      - text: Modifié le
                      - time [ref=e272]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e273]:
                    - generic [ref=e274]: 48 h
                    - button "Modifier Délai après la fin de l’événement" [ref=e275] [cursor=pointer]:
                      - generic [ref=e280]: Modifier
              - listitem [ref=e281]:
                - generic [ref=e282]:
                  - generic [ref=e283]:
                    - paragraph [ref=e284]: Frais de retrait
                    - paragraph [ref=e285]: Arrondis au franc CFA supérieur, déduits du montant versé. De 0 à 10 %.
                    - paragraph [ref=e286]:
                      - text: Modifié le
                      - time [ref=e287]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e288]:
                    - generic [ref=e289]: 1 %
                    - button "Modifier Frais de retrait" [ref=e290] [cursor=pointer]:
                      - generic [ref=e295]: Modifier
                - paragraph [ref=e296]: "Frais SamirPay constatés sur 90 jours : 0 % (maximum 0 %)."
              - listitem [ref=e297]:
                - generic [ref=e298]:
                  - generic [ref=e299]:
                    - paragraph [ref=e300]: Montant minimum de retrait
                    - paragraph [ref=e301]: Montant entier en francs CFA.
                    - paragraph [ref=e302]:
                      - text: Modifié le
                      - time [ref=e303]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e304]:
                    - generic [ref=e305]: 5 000 F CFA
                    - button "Modifier Montant minimum de retrait" [ref=e306] [cursor=pointer]:
                      - generic [ref=e311]: Modifier
              - listitem [ref=e312]:
                - generic [ref=e313]:
                  - generic [ref=e314]:
                    - paragraph [ref=e315]: Retraits par virement bancaire
                    - paragraph [ref=e316]: Tant qu’il est désactivé, seuls Wave et Orange Money sont proposés.
                    - paragraph [ref=e317]:
                      - text: Modifié le
                      - time [ref=e318]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e319]:
                    - generic [ref=e320]: Désactivé
                    - button "Modifier Retraits par virement bancaire" [ref=e321] [cursor=pointer]:
                      - generic [ref=e326]: Modifier
              - listitem [ref=e327]:
                - generic [ref=e328]:
                  - generic [ref=e329]:
                    - paragraph [ref=e330]: Délai de validation des commissions
                    - paragraph [ref=e331]: Jours avant qu’une commission de parrainage devienne disponible. De 7 à 14.
                    - paragraph [ref=e332]:
                      - text: Modifié le
                      - time [ref=e333]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e334]:
                    - generic [ref=e335]: 7 jours
                    - button "Modifier Délai de validation des commissions" [ref=e336] [cursor=pointer]:
                      - generic [ref=e341]: Modifier
          - region [ref=e342]:
            - generic [ref=e343]:
              - heading "Contrôle d’accès" [level=2] [ref=e344]
              - paragraph [ref=e350]: Fenêtre de scan, saisie manuelle des numéros de billet, vente au guichet, seuil de stock affiché au public et alerte de refus à une porte.
            - list [ref=e351]:
              - listitem [ref=e352]:
                - generic [ref=e353]:
                  - generic [ref=e354]:
                    - paragraph [ref=e355]: Ouverture du contrôle avant le début
                    - paragraph [ref=e356]: Heures avant le début de l’événement à partir desquelles les billets peuvent être scannés. De 0 à 48.
                    - paragraph [ref=e357]:
                      - text: Modifié le
                      - time [ref=e358]: sam. 14 nov. 2026 à 13:10
                  - generic [ref=e359]:
                    - generic [ref=e360]: 24 h
                    - button "Modifier Ouverture du contrôle avant le début" [ref=e361] [cursor=pointer]:
                      - generic [ref=e366]: Modifier
              - listitem [ref=e367]:
                - generic [ref=e368]:
                  - generic [ref=e369]:
                    - paragraph [ref=e370]: Fermeture du contrôle après la fin
                    - paragraph [ref=e371]: Heures après la fin de l’événement pendant lesquelles les billets peuvent encore être scannés. De 0 à 48.
                    - paragraph [ref=e372]:
                      - text: Modifié le
                      - time [ref=e373]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e374]:
                    - generic [ref=e375]: 6 h
                    - button "Modifier Fermeture du contrôle après la fin" [ref=e376] [cursor=pointer]:
                      - generic [ref=e381]: Modifier
              - listitem [ref=e382]:
                - generic [ref=e383]:
                  - generic [ref=e384]:
                    - paragraph [ref=e385]: Saisie manuelle d’un numéro de billet
                    - paragraph [ref=e386]: Qui peut valider un billet par son numéro, toujours après vérification de la pièce d’identité.
                    - paragraph [ref=e387]:
                      - text: Modifié le
                      - time [ref=e388]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e389]:
                    - generic [ref=e390]: Contrôleur affecté seul
                    - button "Modifier Saisie manuelle d’un numéro de billet" [ref=e391] [cursor=pointer]:
                      - generic [ref=e396]: Modifier
              - listitem [ref=e397]:
                - generic [ref=e398]:
                  - generic [ref=e399]:
                    - paragraph [ref=e400]: Vente au guichet en espèces
                    - paragraph [ref=e401]: Un contrôleur autorisé à encaisser, avec une caisse ouverte, vend des billets au prix facial, sans frais.
                    - paragraph [ref=e402]:
                      - text: Modifié le
                      - time [ref=e403]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e404]:
                    - generic [ref=e405]: Activé
                    - button "Modifier Vente au guichet en espèces" [ref=e406] [cursor=pointer]:
                      - generic [ref=e411]: Modifier
              - listitem [ref=e412]:
                - generic [ref=e413]:
                  - generic [ref=e414]:
                    - paragraph [ref=e415]: Seuil « bientôt complet »
                    - paragraph [ref=e416]: Quand il reste ce nombre de places ou moins dans une catégorie, la page publique affiche le restant ; au-delà, seulement « disponible ». Entier de 1 à 1000.
                    - paragraph [ref=e417]:
                      - text: Modifié le
                      - time [ref=e418]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e419]:
                    - generic [ref=e420]: 10 places
                    - button "Modifier Seuil « bientôt complet »" [ref=e421] [cursor=pointer]:
                      - generic [ref=e426]: Modifier
              - listitem [ref=e427]:
                - generic [ref=e428]:
                  - generic [ref=e429]:
                    - paragraph [ref=e430]: "Alerte de refus à une porte : nombre de refus"
                    - paragraph [ref=e431]: Quand une porte enregistre ce nombre de refus ou plus pendant la durée observée, l’organisateur reçoit une alerte, au plus une fois par porte et par durée. Comptent les billets invalides, déjà utilisés, annulés, remboursés, d’un autre événement, en attente de transfert, présentés dans la mauvaise zone ou pas encore entrés ; pas les refus liés au téléphone ou aux droits du contrôleur, à l’encaissement ni aux horaires de l’événement. Entier de 3 à 500.
                    - paragraph [ref=e432]:
                      - text: Modifié le
                      - time [ref=e433]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e434]:
                    - generic [ref=e435]: 10 refus
                    - 'button "Modifier Alerte de refus à une porte : nombre de refus" [ref=e436] [cursor=pointer]':
                      - generic [ref=e441]: Modifier
              - listitem [ref=e442]:
                - generic [ref=e443]:
                  - generic [ref=e444]:
                    - paragraph [ref=e445]: "Alerte de refus à une porte : durée observée"
                    - paragraph [ref=e446]: Durée pendant laquelle les refus d’une même porte sont comptés pour l’alerte. Entier de 1 à 60.
                    - paragraph [ref=e447]:
                      - text: Modifié le
                      - time [ref=e448]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e449]:
                    - generic [ref=e450]: 5 min
                    - 'button "Modifier Alerte de refus à une porte : durée observée" [ref=e451] [cursor=pointer]':
                      - generic [ref=e456]: Modifier
          - region [ref=e457]:
            - generic [ref=e458]:
              - heading "Contact du support" [level=2] [ref=e459]
              - paragraph [ref=e463]: Moyens de joindre le support, affichés sur la page publique Aide et dans les messages de sécurité. Au moins un est exigé avant une séance réelle.
            - list [ref=e464]:
              - listitem [ref=e465]:
                - generic [ref=e466]:
                  - generic [ref=e467]:
                    - paragraph [ref=e468]: Numéro WhatsApp du support
                    - paragraph [ref=e469]: Format international, par exemple +221771234567. Laissez vide si aucun. Au moins un moyen de contact est exigé avant une séance réelle.
                    - paragraph [ref=e470]:
                      - text: Modifié le
                      - time [ref=e471]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e472]:
                    - generic [ref=e473]: Non renseigné
                    - button "Modifier Numéro WhatsApp du support" [ref=e474] [cursor=pointer]:
                      - generic [ref=e479]: Modifier
              - listitem [ref=e480]:
                - generic [ref=e481]:
                  - generic [ref=e482]:
                    - paragraph [ref=e483]: Téléphone du support
                    - paragraph [ref=e484]: Format international, par exemple +221338000000. Laissez vide si aucun.
                    - paragraph [ref=e485]:
                      - text: Modifié le
                      - time [ref=e486]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e487]:
                    - generic [ref=e488]: Non renseigné
                    - button "Modifier Téléphone du support" [ref=e489] [cursor=pointer]:
                      - generic [ref=e494]: Modifier
              - listitem [ref=e495]:
                - generic [ref=e496]:
                  - generic [ref=e497]:
                    - paragraph [ref=e498]: Email du support
                    - paragraph [ref=e499]: Adresse lue par l’équipe du support. Laissez vide si aucune.
                    - paragraph [ref=e500]:
                      - text: Modifié le
                      - time [ref=e501]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e502]:
                    - generic [ref=e503]: Non renseigné
                    - button "Modifier Email du support" [ref=e504] [cursor=pointer]:
                      - generic [ref=e509]: Modifier
          - region [ref=e510]:
            - generic [ref=e511]:
              - heading "Notifications" [level=2] [ref=e512]
              - paragraph [ref=e516]: Rappels la veille et avant le début, SMS des rappels, plage de nuit sans SMS, plafond quotidien des SMS optionnels, alerte sur les SMS indispensables et rappels des billets gratuits.
            - list [ref=e517]:
              - listitem [ref=e518]:
                - generic [ref=e519]:
                  - generic [ref=e520]:
                    - paragraph [ref=e521]: Rappel la veille
                    - paragraph [ref=e522]: Rappel envoyé la veille du début aux porteurs d’un billet valable de l’événement en ligne.
                    - paragraph [ref=e523]:
                      - text: Modifié le
                      - time [ref=e524]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e525]:
                    - generic [ref=e526]: Activé
                    - button "Modifier Rappel la veille" [ref=e527] [cursor=pointer]:
                      - generic [ref=e532]: Modifier
              - listitem [ref=e533]:
                - generic [ref=e534]:
                  - generic [ref=e535]:
                    - paragraph [ref=e536]: Heure du rappel de la veille
                    - paragraph [ref=e537]: Heure de Dakar à laquelle part le rappel de la veille. De 6 à 20.
                    - paragraph [ref=e538]:
                      - text: Modifié le
                      - time [ref=e539]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e540]:
                    - generic [ref=e541]: 10 h
                    - button "Modifier Heure du rappel de la veille" [ref=e542] [cursor=pointer]:
                      - generic [ref=e547]: Modifier
              - listitem [ref=e548]:
                - generic [ref=e549]:
                  - generic [ref=e550]:
                    - paragraph [ref=e551]: Rappel avant le début
                    - paragraph [ref=e552]: Rappel envoyé quelques heures avant le début, avec le conseil d’ouvrir son billet avant d’arriver.
                    - paragraph [ref=e553]:
                      - text: Modifié le
                      - time [ref=e554]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e555]:
                    - generic [ref=e556]: Activé
                    - button "Modifier Rappel avant le début" [ref=e557] [cursor=pointer]:
                      - generic [ref=e562]: Modifier
              - listitem [ref=e563]:
                - generic [ref=e564]:
                  - generic [ref=e565]:
                    - paragraph [ref=e566]: Heures avant le début
                    - paragraph [ref=e567]: Nombre d’heures entre le rappel et le début de l’événement. De 1 à 12.
                    - paragraph [ref=e568]:
                      - text: Modifié le
                      - time [ref=e569]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e570]:
                    - generic [ref=e571]: 3 h
                    - button "Modifier Heures avant le début" [ref=e572] [cursor=pointer]:
                      - generic [ref=e577]: Modifier
              - listitem [ref=e578]:
                - generic [ref=e579]:
                  - generic [ref=e580]:
                    - paragraph [ref=e581]: SMS du rappel de la veille
                    - paragraph [ref=e582]: Envoi du SMS en plus de l’application et des notifications push.
                    - paragraph [ref=e583]:
                      - text: Modifié le
                      - time [ref=e584]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e585]:
                    - generic [ref=e586]: Toujours
                    - button "Modifier SMS du rappel de la veille" [ref=e587] [cursor=pointer]:
                      - generic [ref=e592]: Modifier
              - listitem [ref=e593]:
                - generic [ref=e594]:
                  - generic [ref=e595]:
                    - paragraph [ref=e596]: SMS du rappel avant le début
                    - paragraph [ref=e597]: Envoi du SMS en plus de l’application et des notifications push.
                    - paragraph [ref=e598]:
                      - text: Modifié le
                      - time [ref=e599]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e600]:
                    - generic [ref=e601]: Seulement sans notification push
                    - button "Modifier SMS du rappel avant le début" [ref=e602] [cursor=pointer]:
                      - generic [ref=e607]: Modifier
              - listitem [ref=e608]:
                - generic [ref=e609]:
                  - generic [ref=e610]:
                    - paragraph [ref=e611]: Début de la plage sans SMS
                    - paragraph [ref=e612]: Heure de Dakar à partir de laquelle aucun SMS optionnel ne part ; le rappel passe alors par les autres canaux. De 0 à 23.
                    - paragraph [ref=e613]:
                      - text: Modifié le
                      - time [ref=e614]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e615]:
                    - generic [ref=e616]: 22 h
                    - button "Modifier Début de la plage sans SMS" [ref=e617] [cursor=pointer]:
                      - generic [ref=e622]: Modifier
              - listitem [ref=e623]:
                - generic [ref=e624]:
                  - generic [ref=e625]:
                    - paragraph [ref=e626]: Fin de la plage sans SMS
                    - paragraph [ref=e627]: Heure de Dakar de fin de la plage. Un début égal à la fin supprime la plage. De 0 à 23.
                    - paragraph [ref=e628]:
                      - text: Modifié le
                      - time [ref=e629]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e630]:
                    - generic [ref=e631]: 8 h
                    - button "Modifier Fin de la plage sans SMS" [ref=e632] [cursor=pointer]:
                      - generic [ref=e637]: Modifier
              - listitem [ref=e638]:
                - generic [ref=e639]:
                  - generic [ref=e640]:
                    - paragraph [ref=e641]: Plafond quotidien des SMS optionnels
                    - paragraph [ref=e642]: "Nombre maximal de SMS optionnels (rappels, annonces, signaux aux professionnels) envoyés par jour de Dakar ; au-delà, ils partent sans SMS, par l’application et les notifications push. Les SMS indispensables (achat, transfert, annulation, remboursement, sécurité du compte) ne sont jamais plafonnés. Les administrateurs sont alertés à 80 %. De 0 à 1 000 000 ; 0 : aucun SMS optionnel."
                    - paragraph [ref=e643]:
                      - text: Modifié le
                      - time [ref=e644]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e645]:
                    - generic [ref=e646]: 700 SMS
                    - button "Modifier Plafond quotidien des SMS optionnels" [ref=e647] [cursor=pointer]:
                      - generic [ref=e652]: Modifier
              - listitem [ref=e653]:
                - generic [ref=e654]:
                  - generic [ref=e655]:
                    - paragraph [ref=e656]: Seuil d’alerte des SMS indispensables du jour
                    - paragraph [ref=e657]: "Nombre de SMS indispensables envoyés dans la journée de Dakar à partir duquel les administrateurs sont alertés, une fois par jour. Ces SMS ne sont jamais plafonnés : le seuil sert à repérer un volume anormal. De 1 à 1 000 000."
                    - paragraph [ref=e658]:
                      - text: Modifié le
                      - time [ref=e659]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e660]:
                    - generic [ref=e661]: 2 000 SMS
                    - button "Modifier Seuil d’alerte des SMS indispensables du jour" [ref=e662] [cursor=pointer]:
                      - generic [ref=e667]: Modifier
              - listitem [ref=e668]:
                - generic [ref=e669]:
                  - generic [ref=e670]:
                    - paragraph [ref=e671]: SMS des rappels pour les billets gratuits
                    - paragraph [ref=e672]: Pour un porteur qui ne détient que des billets gratuits ou des invitations de l’événement. Les rappels arrivent toujours dans l’application et en notification push.
                    - paragraph [ref=e673]:
                      - text: Modifié le
                      - time [ref=e674]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e675]:
                    - generic [ref=e676]: Jamais
                    - button "Modifier SMS des rappels pour les billets gratuits" [ref=e677] [cursor=pointer]:
                      - generic [ref=e682]: Modifier
          - region [ref=e683]:
            - generic [ref=e684]:
              - heading "Services en préparation" [level=2] [ref=e685]
              - paragraph [ref=e689]: "Pas prêt pour le public : ces services ne sont pas encore vérifiés pour les paiements. Un service désactivé n’est ni visible ni utilisable par les clients et les partenaires. Pour en activer un, tapez ACTIVER."
            - list [ref=e690]:
              - listitem [ref=e691]:
                - generic [ref=e692]:
                  - generic [ref=e693]:
                    - paragraph [ref=e694]: Salles de fête
                    - paragraph [ref=e695]: Pas prêt pour le public
                    - paragraph [ref=e696]: "Réservation de salles par les clients et gestion des salles par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
                    - paragraph [ref=e697]:
                      - text: Modifié le
                      - time [ref=e698]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e699]:
                    - generic [ref=e700]: Désactivé
                    - button "Modifier Salles de fête" [ref=e701] [cursor=pointer]:
                      - generic [ref=e706]: Modifier
              - listitem [ref=e707]:
                - generic [ref=e708]:
                  - generic [ref=e709]:
                    - paragraph [ref=e710]: Réservation de tables
                    - paragraph [ref=e711]: Pas prêt pour le public
                    - paragraph [ref=e712]: "Réservation de tables dans les restaurants et gestion des tables par les partenaires. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent."
                    - paragraph [ref=e713]:
                      - text: Modifié le
                      - time [ref=e714]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e715]:
                    - generic [ref=e716]: Désactivé
                    - button "Modifier Réservation de tables" [ref=e717] [cursor=pointer]:
                      - generic [ref=e722]: Modifier
              - listitem [ref=e723]:
                - generic [ref=e724]:
                  - generic [ref=e725]:
                    - paragraph [ref=e726]: Commandes de repas
                    - paragraph [ref=e727]: Pas prêt pour le public
                    - paragraph [ref=e728]: "Menus, produits et commandes de repas. Désactivé : les pages répondent « page introuvable » et les entrées de menu disparaissent. Les achats de billets ne sont pas concernés."
                    - paragraph [ref=e729]:
                      - text: Modifié le
                      - time [ref=e730]: sam. 14 nov. 2026 à 12:41
                  - generic [ref=e731]:
                    - generic [ref=e732]: Désactivé
                    - button "Modifier Commandes de repas" [ref=e733] [cursor=pointer]:
                      - generic [ref=e738]: Modifier
          - region [ref=e739]:
            - heading "Historique des modifications" [level=2] [ref=e740]
            - list [ref=e745]:
              - listitem [ref=e746]:
                - paragraph [ref=e747]: Ouverture du contrôle avant le début
                - paragraph [ref=e748]:
                  - text: 6 h →
                  - generic [ref=e749]: devient
                  - text: 24 h
                - paragraph [ref=e750]:
                  - time [ref=e751]: sam. 14 nov. 2026 à 13:10
                  - text: "· Recette 13.10.25 : contrôle ouvert la veille"
              - listitem [ref=e752]:
                - paragraph [ref=e753]: Délai de garde des ventes
                - paragraph [ref=e754]:
                  - text: Activé →
                  - generic [ref=e755]: devient
                  - text: Désactivé
                - paragraph [ref=e756]:
                  - time [ref=e757]: sam. 14 nov. 2026 à 13:10
                  - text: "· Recette 13.10.25 : fonds disponibles dès le paiement"
              - listitem [ref=e758]:
                - paragraph [ref=e759]: Ouverture du contrôle avant le début
                - paragraph [ref=e760]:
                  - text: 24 h →
                  - generic [ref=e761]: devient
                  - text: 6 h
                - paragraph [ref=e762]:
                  - time [ref=e763]: sam. 14 nov. 2026 à 13:07
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e764]:
                - paragraph [ref=e765]: Ouverture du contrôle avant le début
                - paragraph [ref=e766]:
                  - text: 6 h →
                  - generic [ref=e767]: devient
                  - text: 24 h
                - paragraph [ref=e768]:
                  - time [ref=e769]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : ecart de caisse"
              - listitem [ref=e770]:
                - paragraph [ref=e771]: Ouverture du contrôle avant le début
                - paragraph [ref=e772]:
                  - text: 24 h →
                  - generic [ref=e773]: devient
                  - text: 6 h
                - paragraph [ref=e774]:
                  - time [ref=e775]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e776]:
                - paragraph [ref=e777]: Ouverture du contrôle avant le début
                - paragraph [ref=e778]:
                  - text: 6 h →
                  - generic [ref=e779]: devient
                  - text: 24 h
                - paragraph [ref=e780]:
                  - time [ref=e781]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : renvoi seulement"
              - listitem [ref=e782]:
                - paragraph [ref=e783]: Ouverture du contrôle avant le début
                - paragraph [ref=e784]:
                  - text: 24 h →
                  - generic [ref=e785]: devient
                  - text: 6 h
                - paragraph [ref=e786]:
                  - time [ref=e787]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e788]:
                - paragraph [ref=e789]: Ouverture du contrôle avant le début
                - paragraph [ref=e790]:
                  - text: 6 h →
                  - generic [ref=e791]: devient
                  - text: 24 h
                - paragraph [ref=e792]:
                  - time [ref=e793]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : taille du lot"
              - listitem [ref=e794]:
                - paragraph [ref=e795]: Ouverture du contrôle avant le début
                - paragraph [ref=e796]:
                  - text: 24 h →
                  - generic [ref=e797]: devient
                  - text: 6 h
                - paragraph [ref=e798]:
                  - time [ref=e799]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e800]:
                - paragraph [ref=e801]: Ouverture du contrôle avant le début
                - paragraph [ref=e802]:
                  - text: 6 h →
                  - generic [ref=e803]: devient
                  - text: 24 h
                - paragraph [ref=e804]:
                  - time [ref=e805]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : plein ecran"
              - listitem [ref=e806]:
                - paragraph [ref=e807]: Ouverture du contrôle avant le début
                - paragraph [ref=e808]:
                  - text: 24 h →
                  - generic [ref=e809]: devient
                  - text: 6 h
                - paragraph [ref=e810]:
                  - time [ref=e811]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e812]:
                - paragraph [ref=e813]: Ouverture du contrôle avant le début
                - paragraph [ref=e814]:
                  - text: 6 h →
                  - generic [ref=e815]: devient
                  - text: 24 h
                - paragraph [ref=e816]:
                  - time [ref=e817]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : barre achat"
              - listitem [ref=e818]:
                - paragraph [ref=e819]: Ouverture du contrôle avant le début
                - paragraph [ref=e820]:
                  - text: 24 h →
                  - generic [ref=e821]: devient
                  - text: 6 h
                - paragraph [ref=e822]:
                  - time [ref=e823]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e824]:
                - paragraph [ref=e825]: Ouverture du contrôle avant le début
                - paragraph [ref=e826]:
                  - text: 6 h →
                  - generic [ref=e827]: devient
                  - text: 24 h
                - paragraph [ref=e828]:
                  - time [ref=e829]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : reprise de session"
              - listitem [ref=e830]:
                - paragraph [ref=e831]: Ouverture du contrôle avant le début
                - paragraph [ref=e832]:
                  - text: 24 h →
                  - generic [ref=e833]: devient
                  - text: 6 h
                - paragraph [ref=e834]:
                  - time [ref=e835]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e836]:
                - paragraph [ref=e837]: Ouverture du contrôle avant le début
                - paragraph [ref=e838]:
                  - text: 6 h →
                  - generic [ref=e839]: devient
                  - text: 24 h
                - paragraph [ref=e840]:
                  - time [ref=e841]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : camera en arriere-plan"
              - listitem [ref=e842]:
                - paragraph [ref=e843]: Ouverture du contrôle avant le début
                - paragraph [ref=e844]:
                  - text: 24 h →
                  - generic [ref=e845]: devient
                  - text: 6 h
                - paragraph [ref=e846]:
                  - time [ref=e847]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e848]:
                - paragraph [ref=e849]: Ouverture du contrôle avant le début
                - paragraph [ref=e850]:
                  - text: 6 h →
                  - generic [ref=e851]: devient
                  - text: 24 h
                - paragraph [ref=e852]:
                  - time [ref=e853]: sam. 14 nov. 2026 à 13:06
                  - text: "· projet e2e terrain (lot 7) : vibrations"
              - listitem [ref=e854]:
                - paragraph [ref=e855]: Ouverture du contrôle avant le début
                - paragraph [ref=e856]:
                  - text: 24 h →
                  - generic [ref=e857]: devient
                  - text: 6 h
                - paragraph [ref=e858]:
                  - time [ref=e859]: sam. 14 nov. 2026 à 13:06
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e860]:
                - paragraph [ref=e861]: Ouverture du contrôle avant le début
                - paragraph [ref=e862]:
                  - text: 6 h →
                  - generic [ref=e863]: devient
                  - text: 24 h
                - paragraph [ref=e864]:
                  - time [ref=e865]: sam. 14 nov. 2026 à 13:05
                  - text: "· projet e2e terrain (lot 7) : mesure du scan"
              - listitem [ref=e866]:
                - paragraph [ref=e867]: Ouverture du contrôle avant le début
                - paragraph [ref=e868]:
                  - text: 24 h →
                  - generic [ref=e869]: devient
                  - text: 6 h
                - paragraph [ref=e870]:
                  - time [ref=e871]: sam. 14 nov. 2026 à 13:05
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e872]:
                - paragraph [ref=e873]: Ouverture du contrôle avant le début
                - paragraph [ref=e874]:
                  - text: 6 h →
                  - generic [ref=e875]: devient
                  - text: 24 h
                - paragraph [ref=e876]:
                  - time [ref=e877]: sam. 14 nov. 2026 à 13:04
                  - text: "· projet e2e terrain (lot 7) : idempotence"
              - listitem [ref=e878]:
                - paragraph [ref=e879]: Ouverture du contrôle avant le début
                - paragraph [ref=e880]:
                  - text: 24 h →
                  - generic [ref=e881]: devient
                  - text: 6 h
                - paragraph [ref=e882]:
                  - time [ref=e883]: sam. 14 nov. 2026 à 13:04
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e884]:
                - paragraph [ref=e885]: Ouverture du contrôle avant le début
                - paragraph [ref=e886]:
                  - text: 6 h →
                  - generic [ref=e887]: devient
                  - text: 24 h
                - paragraph [ref=e888]:
                  - time [ref=e889]: sam. 14 nov. 2026 à 13:04
                  - text: "· projet e2e terrain (lot 7) : cache sans api"
              - listitem [ref=e890]:
                - paragraph [ref=e891]: Ouverture du contrôle avant le début
                - paragraph [ref=e892]:
                  - text: 24 h →
                  - generic [ref=e893]: devient
                  - text: 6 h
                - paragraph [ref=e894]:
                  - time [ref=e895]: sam. 14 nov. 2026 à 13:04
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e896]:
                - paragraph [ref=e897]: Ouverture du contrôle avant le début
                - paragraph [ref=e898]:
                  - text: 6 h →
                  - generic [ref=e899]: devient
                  - text: 24 h
                - paragraph [ref=e900]:
                  - time [ref=e901]: sam. 14 nov. 2026 à 13:04
                  - text: "· projet e2e terrain (lot 7) : écart -5 min"
              - listitem [ref=e902]:
                - paragraph [ref=e903]: Ouverture du contrôle avant le début
                - paragraph [ref=e904]:
                  - text: 24 h →
                  - generic [ref=e905]: devient
                  - text: 6 h
                - paragraph [ref=e906]:
                  - time [ref=e907]: sam. 14 nov. 2026 à 13:04
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e908]:
                - paragraph [ref=e909]: Ouverture du contrôle avant le début
                - paragraph [ref=e910]:
                  - text: 6 h →
                  - generic [ref=e911]: devient
                  - text: 24 h
                - paragraph [ref=e912]:
                  - time [ref=e913]: sam. 14 nov. 2026 à 13:04
                  - text: "· projet e2e terrain (lot 7) : écart +5 min"
              - listitem [ref=e914]:
                - paragraph [ref=e915]: Ouverture du contrôle avant le début
                - paragraph [ref=e916]:
                  - text: 24 h →
                  - generic [ref=e917]: devient
                  - text: 6 h
                - paragraph [ref=e918]:
                  - time [ref=e919]: sam. 14 nov. 2026 à 13:04
                  - text: · restauration après le projet e2e terrain (lot 7)
              - listitem [ref=e920]:
                - paragraph [ref=e921]: Ouverture du contrôle avant le début
                - paragraph [ref=e922]:
                  - text: 6 h →
                  - generic [ref=e923]: devient
                  - text: 24 h
                - paragraph [ref=e924]:
                  - time [ref=e925]: sam. 14 nov. 2026 à 13:04
                  - text: "· projet e2e terrain (lot 7) : fumee prolongee"
              - listitem [ref=e926]:
                - paragraph [ref=e927]: Téléphone du support
                - paragraph [ref=e928]:
                  - text: — →
                  - generic [ref=e929]: devient
                  - text: Non renseigné
                - paragraph [ref=e930]:
                  - time [ref=e931]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e932]:
                - paragraph [ref=e933]: Email du support
                - paragraph [ref=e934]:
                  - text: — →
                  - generic [ref=e935]: devient
                  - text: Non renseigné
                - paragraph [ref=e936]:
                  - time [ref=e937]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e938]:
                - paragraph [ref=e939]: Numéro WhatsApp du support
                - paragraph [ref=e940]:
                  - text: — →
                  - generic [ref=e941]: devient
                  - text: Non renseigné
                - paragraph [ref=e942]:
                  - time [ref=e943]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e944]:
                - paragraph [ref=e945]: "Alerte de refus à une porte : durée observée"
                - paragraph [ref=e946]:
                  - text: — →
                  - generic [ref=e947]: devient
                  - text: 5 min
                - paragraph [ref=e948]:
                  - time [ref=e949]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e950]:
                - paragraph [ref=e951]: "Alerte de refus à une porte : nombre de refus"
                - paragraph [ref=e952]:
                  - text: — →
                  - generic [ref=e953]: devient
                  - text: 10 refus
                - paragraph [ref=e954]:
                  - time [ref=e955]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e956]:
                - paragraph [ref=e957]: Durée de garde des places pendant un paiement (minutes)
                - paragraph [ref=e958]:
                  - text: — →
                  - generic [ref=e959]: devient
                  - text: 10 min
                - paragraph [ref=e960]:
                  - time [ref=e961]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e962]:
                - paragraph [ref=e963]: Seuil d’alerte des SMS indispensables du jour
                - paragraph [ref=e964]:
                  - text: — →
                  - generic [ref=e965]: devient
                  - text: 2 000 SMS
                - paragraph [ref=e966]:
                  - time [ref=e967]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e968]:
                - paragraph [ref=e969]: Prix minimum d’un billet payant (F CFA)
                - paragraph [ref=e970]:
                  - text: — →
                  - generic [ref=e971]: devient
                  - text: 100 F CFA
                - paragraph [ref=e972]:
                  - time [ref=e973]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e974]:
                - paragraph [ref=e975]: Réservation de tables
                - paragraph [ref=e976]:
                  - text: — →
                  - generic [ref=e977]: devient
                  - text: Désactivé
                - paragraph [ref=e978]:
                  - time [ref=e979]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e980]:
                - paragraph [ref=e981]: Salles de fête
                - paragraph [ref=e982]:
                  - text: — →
                  - generic [ref=e983]: devient
                  - text: Désactivé
                - paragraph [ref=e984]:
                  - time [ref=e985]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e986]:
                - paragraph [ref=e987]: Plafond quotidien des SMS optionnels
                - paragraph [ref=e988]:
                  - text: — →
                  - generic [ref=e989]: devient
                  - text: 700 SMS
                - paragraph [ref=e990]:
                  - time [ref=e991]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e992]:
                - paragraph [ref=e993]: SMS des rappels pour les billets gratuits
                - paragraph [ref=e994]:
                  - text: — →
                  - generic [ref=e995]: devient
                  - text: Jamais
                - paragraph [ref=e996]:
                  - time [ref=e997]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e998]:
                - paragraph [ref=e999]: Réglage retiré ou sans libellé
                - paragraph [ref=e1000]:
                  - text: 2 000 →
                  - generic [ref=e1001]: devient
                  - text: —
                - paragraph [ref=e1002]:
                  - time [ref=e1003]: sam. 14 nov. 2026 à 12:41
                  - text: · suppression
              - listitem [ref=e1004]:
                - paragraph [ref=e1005]: Commandes de repas
                - paragraph [ref=e1006]:
                  - text: — →
                  - generic [ref=e1007]: devient
                  - text: Désactivé
                - paragraph [ref=e1008]:
                  - time [ref=e1009]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1010]:
                - paragraph [ref=e1011]: Rappel la veille
                - paragraph [ref=e1012]:
                  - text: — →
                  - generic [ref=e1013]: devient
                  - text: Activé
                - paragraph [ref=e1014]:
                  - time [ref=e1015]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1016]:
                - paragraph [ref=e1017]: Réglage retiré ou sans libellé
                - paragraph [ref=e1018]:
                  - text: — →
                  - generic [ref=e1019]: devient
                  - text: 2 000
                - paragraph [ref=e1020]:
                  - time [ref=e1021]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1022]:
                - paragraph [ref=e1023]: Fin de la plage sans SMS
                - paragraph [ref=e1024]:
                  - text: — →
                  - generic [ref=e1025]: devient
                  - text: 8 h
                - paragraph [ref=e1026]:
                  - time [ref=e1027]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1028]:
                - paragraph [ref=e1029]: Début de la plage sans SMS
                - paragraph [ref=e1030]:
                  - text: — →
                  - generic [ref=e1031]: devient
                  - text: 22 h
                - paragraph [ref=e1032]:
                  - time [ref=e1033]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1034]:
                - paragraph [ref=e1035]: SMS du rappel avant le début
                - paragraph [ref=e1036]:
                  - text: — →
                  - generic [ref=e1037]: devient
                  - text: Seulement sans notification push
                - paragraph [ref=e1038]:
                  - time [ref=e1039]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1040]:
                - paragraph [ref=e1041]: SMS du rappel de la veille
                - paragraph [ref=e1042]:
                  - text: — →
                  - generic [ref=e1043]: devient
                  - text: Toujours
                - paragraph [ref=e1044]:
                  - time [ref=e1045]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1046]:
                - paragraph [ref=e1047]: Heures avant le début
                - paragraph [ref=e1048]:
                  - text: — →
                  - generic [ref=e1049]: devient
                  - text: 3 h
                - paragraph [ref=e1050]:
                  - time [ref=e1051]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1052]:
                - paragraph [ref=e1053]: Rappel avant le début
                - paragraph [ref=e1054]:
                  - text: — →
                  - generic [ref=e1055]: devient
                  - text: Activé
                - paragraph [ref=e1056]:
                  - time [ref=e1057]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1058]:
                - paragraph [ref=e1059]: Heure du rappel de la veille
                - paragraph [ref=e1060]:
                  - text: — →
                  - generic [ref=e1061]: devient
                  - text: 10 h
                - paragraph [ref=e1062]:
                  - time [ref=e1063]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1064]:
                - paragraph [ref=e1065]: Seuil « bientôt complet »
                - paragraph [ref=e1066]:
                  - text: — →
                  - generic [ref=e1067]: devient
                  - text: 10 places
                - paragraph [ref=e1068]:
                  - time [ref=e1069]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1070]:
                - paragraph [ref=e1071]: Ouverture du contrôle avant le début
                - paragraph [ref=e1072]:
                  - text: — →
                  - generic [ref=e1073]: devient
                  - text: 6 h
                - paragraph [ref=e1074]:
                  - time [ref=e1075]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1076]:
                - paragraph [ref=e1077]: Vente au guichet en espèces
                - paragraph [ref=e1078]:
                  - text: — →
                  - generic [ref=e1079]: devient
                  - text: Activé
                - paragraph [ref=e1080]:
                  - time [ref=e1081]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1082]:
                - paragraph [ref=e1083]: Fermeture du contrôle après la fin
                - paragraph [ref=e1084]:
                  - text: — →
                  - generic [ref=e1085]: devient
                  - text: 6 h
                - paragraph [ref=e1086]:
                  - time [ref=e1087]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1088]:
                - paragraph [ref=e1089]: Saisie manuelle d’un numéro de billet
                - paragraph [ref=e1090]:
                  - text: — →
                  - generic [ref=e1091]: devient
                  - text: Contrôleur affecté seul
                - paragraph [ref=e1092]:
                  - time [ref=e1093]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1094]:
                - paragraph [ref=e1095]: Frais agrégateur Wave
                - paragraph [ref=e1096]:
                  - text: — →
                  - generic [ref=e1097]: devient
                  - text: 1,5 %
                - paragraph [ref=e1098]:
                  - time [ref=e1099]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1100]:
                - paragraph [ref=e1101]: Délai de validation des commissions
                - paragraph [ref=e1102]:
                  - text: — →
                  - generic [ref=e1103]: devient
                  - text: 7 jours
                - paragraph [ref=e1104]:
                  - time [ref=e1105]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1106]:
                - paragraph [ref=e1107]: Retraits par virement bancaire
                - paragraph [ref=e1108]:
                  - text: — →
                  - generic [ref=e1109]: devient
                  - text: Désactivé
                - paragraph [ref=e1110]:
                  - time [ref=e1111]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1112]:
                - paragraph [ref=e1113]: Montant minimum de retrait
                - paragraph [ref=e1114]:
                  - text: — →
                  - generic [ref=e1115]: devient
                  - text: 5 000 F CFA
                - paragraph [ref=e1116]:
                  - time [ref=e1117]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1118]:
                - paragraph [ref=e1119]: Frais de retrait
                - paragraph [ref=e1120]:
                  - text: — →
                  - generic [ref=e1121]: devient
                  - text: 1 %
                - paragraph [ref=e1122]:
                  - time [ref=e1123]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1124]:
                - paragraph [ref=e1125]: Délai après la fin de l’événement
                - paragraph [ref=e1126]:
                  - text: — →
                  - generic [ref=e1127]: devient
                  - text: 48 h
                - paragraph [ref=e1128]:
                  - time [ref=e1129]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1130]:
                - paragraph [ref=e1131]: Délai de garde des ventes
                - paragraph [ref=e1132]:
                  - text: — →
                  - generic [ref=e1133]: devient
                  - text: Activé
                - paragraph [ref=e1134]:
                  - time [ref=e1135]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1136]:
                - paragraph [ref=e1137]: Frais agrégateur d’une annulation
                - paragraph [ref=e1138]:
                  - text: — →
                  - generic [ref=e1139]: devient
                  - text: Event Village
                - paragraph [ref=e1140]:
                  - time [ref=e1141]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1142]:
                - paragraph [ref=e1143]: Frais agrégateur Orange Money
                - paragraph [ref=e1144]:
                  - text: — →
                  - generic [ref=e1145]: devient
                  - text: 1,5 %
                - paragraph [ref=e1146]:
                  - time [ref=e1147]: sam. 14 nov. 2026 à 12:41
              - listitem [ref=e1148]:
                - paragraph [ref=e1149]: Frais de service
                - paragraph [ref=e1150]:
                  - text: — →
                  - generic [ref=e1151]: devient
                  - text: 5 %
                - paragraph [ref=e1152]:
                  - time [ref=e1153]: sam. 14 nov. 2026 à 12:41
  - alert [ref=e1154]
```

# Test source

```ts
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
  327 |         await row.getByRole('button', { name: /^enregistrer$/i }).click();
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
> 394 |         await partner.getByRole('button', { name: /^ouvrir mon espace partenaire$/i }).click();
      |                                                                                        ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  428 |         const s = dakarParts(start);
  429 |         const e = dakarParts(new Date(start.getTime() + 4 * 3600_000));
  430 |         await partner.goto('/partner/events/new');
  431 |         await partner.getByLabel(/^titre/i).fill(r.e1.title);
  432 |         await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  433 |         await partner.getByLabel(/^description/i).fill('Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives.');
  434 |         await partner.getByLabel(/date de début/i).fill(s.date);
  435 |         await partner.getByLabel(/heure de début/i).fill(s.time);
  436 |         await partner.getByLabel(/date de fin/i).fill(e.date);
  437 |         await partner.getByLabel(/heure de fin/i).fill(e.time);
  438 |         await partner.getByLabel(/^lieu/i).fill('Corniche de Ngor');
  439 |         await partner.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  440 |         await partner.getByLabel(/capacité/i).fill('100');
  441 |         const upload = partner.waitForResponse((res) => res.url().includes('/api/partner/upload') && res.request().method() === 'POST');
  442 |         await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-recette.png', mimeType: 'image/png', buffer: await posterPng(partner, 'Nuit de Ngor', `${s.date} · ${s.time}`) });
  443 |         expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  444 | 
  445 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  446 |         await expect(partner.getByRole('heading', { level: 2, name: /^programme$/i })).toBeVisible();
  447 |         await partner.getByRole('button', { name: /^ajouter une ligne$/i }).click();
  448 |         await partner.getByLabel(/^heure/i).fill(PROGRAM.time);
  449 |         await partner.getByLabel(/^intitulé/i).fill(PROGRAM.title);
  450 |         await partner.getByLabel(/^artiste ou intervenant/i).fill(PROGRAM.participant);
  451 | 
  452 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  453 |         await expect(partner.getByRole('heading', { level: 2, name: /^accès et informations pratiques$/i })).toBeVisible();
  454 |         await partner.getByLabel(/^adresse précise/i).fill(PRACTICAL.address);
  455 |         await partner.getByLabel(/^stationnement/i).fill(PRACTICAL.parking);
  456 |         await partner.getByLabel(/^indications d.accès/i).fill(PRACTICAL.access);
  457 |         await partner.getByLabel(/^règles à respecter/i).fill(PRACTICAL.rules);
  458 | 
  459 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  460 |         await expect(partner.getByRole('heading', { level: 2, name: /^billetterie$/i })).toBeVisible();
  461 |         for (let i = 0; i < CATEGORIES.length; i++) await addCategory(partner, i, CATEGORIES[i]);
  462 |         await partner.getByRole('button', { name: /^enregistrer le brouillon$/i }).click();
  463 |         await partner.waitForURL(/\/partner\/events(\?|$)/);
  464 |         await expect(partner.getByText(r.e1.title, { exact: true })).toBeVisible();
  465 | 
  466 |         const { data: ev, error } = await serviceClient().from('events').select('id').eq('title', r.e1.title).single();
  467 |         if (error || !ev) throw new Error(`[e2e] événement E1 : ${error?.message ?? 'introuvable'}`);
  468 |         r.e1.id = String(ev.id);
  469 |         const { data: cats, error: catErr } = await serviceClient().from('ticket_categories').select('id, name, sale_online, sale_counter, is_visible').eq('event_id', r.e1.id);
  470 |         if (catErr) throw new Error(`[e2e] catégories de E1 : ${catErr.message}`);
  471 |         for (const c of cats ?? []) r.e1.categories[String(c.name)] = String(c.id);
  472 |         expect((cats ?? []).map((c) => `${String(c.name)} ${String(c.sale_online)} ${String(c.sale_counter)} ${String(c.is_visible)}`).sort(), 'canaux enregistrés, is_visible en miroir')
  473 |             .toEqual(CATEGORIES.map((c) => `${c.name} ${c.online} ${c.counter} ${c.online}`).sort());
  474 |     });
  475 | 
  476 |     await test.step('soumission par P1, validation par le SUPERADMIN, publication par P1', async () => {
  477 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^soumettre/i), /^soumettre/i);
  478 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/en attente de validation/i);
  479 | 
  480 |         await admin.goto('/admin/events?status=EN_ATTENTE');
  481 |         await admin.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).click();
  482 |         await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  483 |         await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  484 |         await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  485 | 
  486 |         await partner.goto('/partner/events');
  487 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^publier/i), /^publier/i);
  488 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/publié/i);
  489 |     });
  490 | 
  491 |     await test.step('E2 de P1 à J+2 (RPC du lot 5), Standard 3 000 F : l’annulation de l’acte 7 ne touche pas E1', async () => {
  492 |         const day = dakarDayFrom(new Date(), 2);
  493 |         r.e2.id = await createPublishedEvent({
  494 |             partnerUserId: r.p1.userId,
```