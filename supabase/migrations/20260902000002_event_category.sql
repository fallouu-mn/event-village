-- Ajout de la colonne category sur la table events
-- Source de vérité unique pour les catégories CDC V3.0

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_category') THEN
        CREATE TYPE event_category AS ENUM (
            'CONCERT',
            'FESTIVAL',
            'FOOD',
            'SALLE'
        );
    END IF;
END $$;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS category event_category;
