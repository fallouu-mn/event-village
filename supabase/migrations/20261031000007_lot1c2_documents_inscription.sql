-- ============================================================================
-- EVENT VILLAGE — LOT 1C.2 : documents d'inscription partenaire
-- ============================================================================
-- Avant : le dépôt public renvoyait un chemin « pending_registrations/<type>_<horodatage>_<6
-- caractères> », recopié tel quel par le client dans /api/partner/register ; /api/partner/
-- documents/signed-url délivrait une URL signée de tout chemin pending_registrations/… à
-- n'importe quel compte ACTIF, et les chemins des partenaires validés sont lisibles par REST.
--
-- Après :
--  - chaque dépôt est tracé dans partner_document_uploads (service_role uniquement) : chemin
--    aléatoire (UUID), empreinte SHA-256 du jeton de dépôt remis au déposant, expiration,
--    rattachement au dossier partenaire (usage unique) ;
--  - l'URL signée se demande par dossier et type de pièce (propriétaire ou admin) ou par jeton
--    de dépôt non rattaché ; le chemin vient toujours de cette table ;
--  - Storage : plus aucune écriture par les rôles API (le dépôt passe par la route serveur) ;
--    lecture directe seulement pour l'admin et pour le dossier « <uid>/ » du compte.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_document_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_path TEXT NOT NULL UNIQUE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('id_card', 'business_doc')),
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_document_uploads_partner
    ON public.partner_document_uploads (claimed_partner_id, doc_type, claimed_at DESC);

ALTER TABLE public.partner_document_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_document_uploads FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.partner_document_uploads TO service_role;

COMMENT ON TABLE public.partner_document_uploads IS
    'Dépôts de pièces d''inscription partenaire (lot 1C.2) : chemin aléatoire, jeton de dépôt haché, rattachement unique au dossier. Service_role uniquement.';

-- Storage : écritures réservées au service_role (route /api/partner/documents/upload).
DROP POLICY IF EXISTS "partner_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "partner_documents_update_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "partner_documents_delete_own_or_admin" ON storage.objects;
-- partner_documents_select_own_or_admin (migration 0005) est conservée : dossier « <uid>/ »
-- du compte ou admin. Les dépôts sont sous « pending/<uuid>/ », donc invisibles d'un compte tiers.
