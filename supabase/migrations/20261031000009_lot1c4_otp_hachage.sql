-- ============================================================================
-- EVENT VILLAGE — LOT 1C.4 : codes OTP hachés
-- ============================================================================
-- otp_codes ne stocke plus le code en clair : empreinte HMAC-SHA256 (hexadécimal) calculée par
-- le serveur avec le secret dédié OTP_HASH_SECRET (lib/auth/otp-store.ts), message lié au
-- numéro. Les codes existants sont invalidés (supprimés) : un code en cours de validité
-- (10 minutes) doit être redemandé.
-- La recherche reste « dernier code non consommé du numéro », puis comparaison en temps
-- constant côté serveur : pas d'index sur l'empreinte (le comptage des essais ne doit pas être
-- contourné par une recherche directe).
-- ============================================================================

DELETE FROM public.otp_codes;

ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE public.otp_codes ALTER COLUMN code_hash SET NOT NULL;
ALTER TABLE public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_code_hash_hex;
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_code_hash_hex CHECK (code_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE public.otp_codes DROP COLUMN IF EXISTS code;

DROP INDEX IF EXISTS public.idx_otp_codes_phone;
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created ON public.otp_codes (phone, created_at DESC);

-- Privilèges du lot 1A, rappelés
REVOKE ALL ON TABLE public.otp_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.otp_codes TO service_role;
