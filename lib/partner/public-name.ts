/**
 * Carte B3 (contre-vérification, T2 ; décision du client du 25/11) : nom d'une partenaire montré au public et aux
 * clientes. C'est le nom commercial (obligatoire à l'inscription et dans le profil) ; la raison sociale (nom légal) n'est
 * jamais montrée hors de l'administration et de l'espace de la partenaire. Partenaires d'avant l'obligation, sans nom
 * commercial : « Partenaire Event Village ». Même règle en base : hall_search, venue_search, notif_tickets_scanned, vue
 * public_partners (supabase/migrations/20261210000001_cb3_lieux_publics.sql, section 10).
 */
export const PARTNER_FALLBACK_NAME = 'Partenaire Event Village';

export function partnerPublicName(partner: { commercial_name?: string | null } | null | undefined): string {
    const name = typeof partner?.commercial_name === 'string' ? partner.commercial_name.trim() : '';
    return name.length > 0 ? name : PARTNER_FALLBACK_NAME;
}
