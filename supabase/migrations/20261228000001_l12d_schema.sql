-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 01 : schéma (client absent, signalements, fermetures, pause, allergènes)
-- ============================================================================
-- Décisions du client (26-27/11) : client absent après deux appels du livreur, attente de 30 minutes avec nouvel essai
-- possible, puis décision de l'équipe Event Village (rien d'automatique sur l'argent) ; « Signaler un problème » pour le
-- client après le début de la préparation (l'équipe est prévenue, aucun remboursement automatique) ; fermetures
-- exceptionnelles : la partenaire voit les commandes prévues dedans et décide commande par commande ; pause des
-- commandes en un geste ; allergènes et piment sur le produit.
--  1. orders : appels du livreur (delivery_calls, last_call_at), absence du client (absent_reported_at, absent_wait_until,
--     absent_escalated_at, absent_decision, absent_decided_at, absent_decided_by) ; écritures par les fonctions en base
--     seulement (garde orders_flow_guard du lot 12a, inchangée) ;
--  2. order_issues : signalements d'un client (motif, texte court, état), un seul ouvert par commande (index unique
--     partiel) ; lecture et écriture REST fermées (service_role seul) ;
--  3. order_closure_keeps : commande gardée par la partenaire pendant une fermeture exceptionnelle (« Garder »), une fois
--     par fermeture et par commande ; service_role seul ;
--  4. venues : pause des commandes (orders_paused_until, orders_paused_by, orders_pause_end_notified) ; aucune écriture
--     REST sur venues (aucune règle d'écriture, droits de colonnes inchangés) ;
--  5. products : allergènes (liste fermée de 14 allergènes courants) et niveau de piment (0 à 3, vide = non renseigné) ;
--     colonnes non données à la REST (droits par colonne du lot 12c : une colonne ajoutée n'est pas lisible) ; écrites
--     par order_product_details_set (migration 05), lues par la carte des plats (order_venue_menu).
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, DROP … IF EXISTS puis ADD, index IF NOT EXISTS.
-- Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Commandes : appels du livreur et absence du client
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_reported_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_wait_until TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_escalated_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_decision TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_decided_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS absent_decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_absence_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_absence_chk CHECK (
    delivery_calls BETWEEN 0 AND 50
    AND (absent_decision IS NULL OR absent_decision IN ('TOUT', 'PART', 'RIEN'))
    AND (absent_wait_until IS NULL OR absent_reported_at IS NOT NULL)
    AND (absent_escalated_at IS NULL OR absent_reported_at IS NOT NULL)
    AND (absent_decision IS NULL OR absent_decided_at IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_orders_absent_wait ON public.orders(absent_wait_until)
    WHERE absent_reported_at IS NOT NULL AND absent_escalated_at IS NULL AND absent_decided_at IS NULL;

COMMENT ON COLUMN public.orders.delivery_calls IS
    'Lot 12d : appels du client par le livreur (bouton « Appeler », compté par order_courier_action APPEL) ; « Client absent » demande deux appels au moins.';
COMMENT ON COLUMN public.orders.absent_reported_at IS
    'Lot 12d : le livreur a signalé le client absent (après deux appels) ; la commande reste en route, attend absent_wait_until (30 minutes, nouvel essai possible), puis passe à la décision de l''équipe (absent_escalated_at).';
COMMENT ON COLUMN public.orders.absent_decision IS
    'Lot 12d : décision de l''équipe Event Village sur une absence : TOUT (tout rendu), PART (une part, en pourcentage), RIEN ; jamais automatique.';

-- ----------------------------------------------------------------------------
-- 2. Signalements d'un client
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'OUVERT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    close_note TEXT
);
ALTER TABLE public.order_issues DROP CONSTRAINT IF EXISTS order_issues_chk;
ALTER TABLE public.order_issues ADD CONSTRAINT order_issues_chk CHECK (
    reason IN ('RETARD', 'INCOMPLETE', 'ERREUR', 'AUTRE')
    AND status IN ('OUVERT', 'TRAITE')
    AND (details IS NULL OR length(details) BETWEEN 1 AND 300)
    AND (close_note IS NULL OR length(close_note) BETWEEN 1 AND 300)
    AND ((status = 'OUVERT') = (closed_at IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_issues_open ON public.order_issues(order_id) WHERE status = 'OUVERT';
CREATE INDEX IF NOT EXISTS idx_order_issues_order ON public.order_issues(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_issues_open ON public.order_issues(created_at) WHERE status = 'OUVERT';
COMMENT ON TABLE public.order_issues IS
    'Lot 12d : problème signalé par le client après le début de la préparation (retard, commande incomplète, erreur, autre) ; un seul ouvert par commande ; traité par l''équipe Event Village (aucun remboursement automatique). Service_role seul.';
ALTER TABLE public.order_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_issues FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_issues TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Commandes gardées pendant une fermeture exceptionnelle
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_closure_keeps (
    closure_id UUID NOT NULL REFERENCES public.venue_closures(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    kept_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    kept_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (closure_id, order_id)
);
COMMENT ON TABLE public.order_closure_keeps IS
    'Lot 12d : la partenaire garde une commande prévue pendant une fermeture exceptionnelle (« Garder ») ; rien d''automatique. Service_role seul.';
ALTER TABLE public.order_closure_keeps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_closure_keeps FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_closure_keeps TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Pause des commandes d'un établissement
-- ----------------------------------------------------------------------------
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS orders_paused_until TIMESTAMPTZ;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS orders_paused_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS orders_pause_end_notified BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN public.venues.orders_paused_until IS
    'Lot 12d : plus de nouvelle commande jusqu''à cette heure (pause de 15, 30 ou 60 minutes posée par la partenaire) ; fin automatique (comparaison à l''heure courante) ; le devis refuse pendant la pause.';
CREATE INDEX IF NOT EXISTS idx_venues_pause_end ON public.venues(orders_paused_until) WHERE NOT orders_pause_end_notified;

-- ----------------------------------------------------------------------------
-- 5. Allergènes et piment d'un produit
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS spice_level SMALLINT;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_allergens_chk;
ALTER TABLE public.products ADD CONSTRAINT products_allergens_chk CHECK (
    allergens <@ ARRAY['GLUTEN', 'CRUSTACES', 'OEUFS', 'POISSON', 'ARACHIDES', 'SOJA', 'LAIT', 'FRUITS_A_COQUE',
                       'CELERI', 'MOUTARDE', 'SESAME', 'SULFITES', 'LUPIN', 'MOLLUSQUES']::text[]
    AND cardinality(allergens) <= 14
    AND (spice_level IS NULL OR spice_level BETWEEN 0 AND 3));
COMMENT ON COLUMN public.products.allergens IS
    'Lot 12d : allergènes du produit (liste fermée des 14 allergènes courants), affichés sur la fiche du plat côté client.';
COMMENT ON COLUMN public.products.spice_level IS
    'Lot 12d : niveau de piment de 0 (pas pimenté) à 3 (très pimenté) ; vide = non renseigné. Filtre « sans piment » de la carte : 0.';
