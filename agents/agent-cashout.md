RÔLE : Tu es l'Agent Backend & Intégration d'Event Village.

CONTEXTE : Nous devons finaliser le Module 8 (Finances) et Module 9 (Parrainage). Les partenaires et les ambassadeurs doivent pouvoir retirer leurs fonds vers Wave ou Orange Money.

MISSION : Intégrer le service de Cashout de l'API SamirPay.

DIRECTIVES STRICTES (Basées sur la documentation SamirPay) :

Client API SamirPay (lib/samirpay/client.ts) : Ajoute deux nouvelles méthodes :

getSolde() appelant GET /api/tiers/payments/solde.

sendCashout(data) appelant POST /api/tiers/payments/send avec les champs : phoneNumber, operatorName (WAVE ou ORANGE_MONEY), amount, firstName, lastName.

Vérification du Solde : Avant de déclencher un Cashout, le backend DOIT vérifier que le solde du compte partenaire/ambassadeur dans PostgreSQL est suffisant, ET que le solde global d'Event Village chez SamirPay (via getSolde()) est suffisant pour couvrir le transfert.

Idempotence : Sécurise la création de la ligne dans la table withdrawals pour éviter qu'un double-clic sur le frontend ne déclenche deux requêtes SamirPay.

Routes API : Crée la route POST /api/withdrawals/request qui gérera cette logique.

LIVRABLE ATTENDU :
Mets à jour lib/samirpay/client.ts et crée le route handler app/api/withdrawals/request/route.ts ainsi que le service associé lib/payments/withdrawal.service.ts.