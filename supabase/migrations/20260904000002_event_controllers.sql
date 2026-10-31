-- event_controllers : liaison contrôleur ↔ événement avec permissions granulaires.
-- Un contrôleur peut être assigné à plusieurs événements.
-- Un événement peut avoir plusieurs contrôleurs.

CREATE TABLE IF NOT EXISTS event_controllers (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID        NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    can_accept_cash BOOLEAN   NOT NULL DEFAULT false,
    created_by    UUID        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_controller UNIQUE (event_id, user_id)
);

COMMENT ON TABLE event_controllers IS
    'Sous-comptes contrôleurs assignés par un partenaire à un événement donné.';

ALTER TABLE event_controllers ENABLE ROW LEVEL SECURITY;

-- Le partenaire (created_by) voit les assignations qu'il a créées
CREATE POLICY "ec_select_by_creator"
    ON event_controllers FOR SELECT TO authenticated
    USING (created_by = auth.uid());

-- Le contrôleur voit ses propres assignations
CREATE POLICY "ec_select_by_controller"
    ON event_controllers FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Toutes les mutations passent par le service_role (routes API) qui bypasse RLS

CREATE INDEX IF NOT EXISTS idx_ec_event_id   ON event_controllers (event_id);
CREATE INDEX IF NOT EXISTS idx_ec_user_id    ON event_controllers (user_id);
CREATE INDEX IF NOT EXISTS idx_ec_created_by ON event_controllers (created_by);
