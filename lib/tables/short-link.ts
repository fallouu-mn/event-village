/**
 * Lot 11b — lien court des SMS : « /t/<code> » mène à la réservation de table concernée.
 *
 * Le code (7 caractères, table_reservations.short_code) n'est PAS un secret : il ne donne accès à rien. La page exige
 * la session ; le code mène à la page de la réservation seulement pour son client (« Mes réservations ») ou pour la
 * partenaire propriétaire de l'établissement (espace de l'établissement) ; pour tout autre compte, ou un code inconnu :
 * introuvable, sans indice. Lecture par la clé de service, côté serveur.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export const SHORT_CODE_RE = /^[2-9a-hjkmnp-z]{7}$/;

export async function shortLinkTarget(userId: string, code: string): Promise<string | null> {
    if (!SHORT_CODE_RE.test(code)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('table_reservations').select('id, client_id, partner_id').eq('short_code', code).maybeSingle();
    if (error) throw new Error(`lien court ${code} : ${error.message}`);
    if (!data) return null;
    if (data.client_id === userId) return `/tables/reservations/${data.id}`;
    const { data: partner, error: pErr } = await supabase.from('partners').select('id').eq('user_id', userId).maybeSingle();
    if (pErr) throw new Error(`lien court ${code} : ${pErr.message}`);
    if (partner && partner.id === data.partner_id) return `/partner/tables/reservations/${data.id}`;
    return null;
}
