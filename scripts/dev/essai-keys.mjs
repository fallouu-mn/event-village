/**
 * Lot 8 (8.1, L19) — valeur partagée par scripts/dev/essai-start.mjs et scripts/dev/fake-samirpay.mjs : le
 * serveur du mode B l'envoie à la place des clés SamirPay et MTarget, ni clé ni mot de passe réels. Le faux
 * service y reconnaît le mode B pour servir sa propre page de paiement.
 */
export const ESSAI_SERVER_KEY = 'essai-apercu-dev-fake';
