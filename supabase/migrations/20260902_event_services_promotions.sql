-- Colonne services JSONB sur events (persistance des services activés)
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Table des demandes de promotion sponsorisée
CREATE TABLE IF NOT EXISTS sponsored_promotions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'EN_ATTENTE'
                    CHECK (status IN ('EN_ATTENTE', 'APPROUVEE', 'REFUSEE', 'EXPIREE')),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES users(id),
    start_date      DATE,
    end_date        DATE,
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sponsored_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners see own promotions"
    ON sponsored_promotions FOR SELECT
    USING (partner_id IN (
        SELECT id FROM partners WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins manage promotions"
    ON sponsored_promotions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'SUPERADMIN')
        )
    );

CREATE INDEX IF NOT EXISTS idx_sponsored_promotions_event_id ON sponsored_promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_promotions_status ON sponsored_promotions(status);
