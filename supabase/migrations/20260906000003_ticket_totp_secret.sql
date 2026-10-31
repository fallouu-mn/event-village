-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20260906 : TOTP SECRET POUR QR CODE DYNAMIQUE
-- Protection contre la fraude par capture d'écran / partage WhatsApp (Pre-mortem §1.2)
-- ============================================================================

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS totp_secret TEXT;

COMMENT ON COLUMN public.tickets.totp_secret IS 'Secret cryptographique aléatoire pour la génération et validation du QR Code dynamique TOTP (RFC 6238).';
