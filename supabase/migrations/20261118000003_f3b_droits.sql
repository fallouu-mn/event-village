-- Finition 3b (E-36) — droits d'administration retirés.
--
-- Vérifié avant le retrait (rapport de la finition 3b) :
--   - pricing.manage ne servait qu'à POST /api/admin/pricing, qui n'écrivait que trois clés relues par rien
--     (subscription_packs, aggregator_fees, communication_tariffs) ; la page « Tarification » n'était plus qu'un renvoi ;
--   - shifts.read ne servait qu'à GET /api/admin/shifts/audit, appelée par aucun écran.
-- La page et les deux routes sont retirées du code ; ces droits ne sont plus attribuables (lib/admin/permissions.ts).
-- Ici : les lignes déjà attribuées sont effacées (elles n'ouvraient plus rien). Les trois clés de réglage restent en base,
-- inertes (docs/apres-lancement.md). Sans BEGIN ni COMMIT ; rejouable (une seconde exécution n'efface rien).

DELETE FROM public.admin_permissions WHERE permission IN ('pricing.manage', 'shifts.read');
