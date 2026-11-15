-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T2 : la propriétaire n'ouvre une caisse sur son
-- événement qu'avec une fiche VALIDE
-- ============================================================================
-- Recopie de shift_can_handle_cash (20261111000003_lot9quater_droits.sql) ; seul changement : la branche de la
-- propriétaire exige p.status = 'VALIDE', comme counter_sale et scan_scanner_authorized (20261115000003 et …04). Le
-- contrôleur affecté avec le droit d'encaisser, le SUPERADMIN et l'ADMIN access.operate sont inchangés. Appelée par
-- shift_open et l'encaissement d'un billet au scan ; la clôture d'une caisse déjà ouverte n'en dépend pas (l'argent
-- encaissé se rend toujours). Réservée au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.shift_can_handle_cash(p_user uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.status = 'ACTIF')
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_user AND ec.can_accept_cash)
         OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                     WHERE e.id = p_event AND p.user_id = p_user AND p.status = 'VALIDE')
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = 'SUPERADMIN')
         OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = 'ADMIN')
             AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_user AND ap.permission = 'access.operate')))
$$;

REVOKE ALL ON FUNCTION public.shift_can_handle_cash(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shift_can_handle_cash(uuid, uuid) TO service_role;
