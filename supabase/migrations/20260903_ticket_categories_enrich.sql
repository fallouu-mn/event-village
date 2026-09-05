-- Migration : enrichissement des catégories de billets
-- max_per_order : limite anti-fraude par commande (§35 CDC)
-- is_visible : toggle de visibilité publique

ALTER TABLE ticket_categories
    ADD COLUMN IF NOT EXISTS max_per_order INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN ticket_categories.max_per_order IS 'Nombre maximum de billets de cette catégorie par commande (anti-fraude)';
COMMENT ON COLUMN ticket_categories.is_visible IS 'Visibilité publique de la catégorie (le partenaire peut masquer certains billets)';
