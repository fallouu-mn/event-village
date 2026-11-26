import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { readVenueMenu } from '@/lib/orders/menu.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/restaurants/[id]/menu — carte des plats d'un ÉTABLISSEMENT (lot 12b ; [id] est l'établissement, comme
 * /api/restaurants/[id]/tables depuis le lot 11a). Public, lecture seule, aucune session lue.
 *
 * Servie par la base (order_venue_menu) : établissement actif, validé, d'une partenaire VALIDE et ouvert à la commande ;
 * catégories, produits (photo de la fiche ou rien, prix, suppléments actifs, disponibilité, plat du jour et portions
 * restantes, réglementé ou en vérification affichés avec leur prix et jamais commandables), modes de remise, zones et
 * minimum, acompte proposé, horaires et heures possibles. Aucun champ interne (stock exact, décision de
 * l'administration).
 *
 * Avant le lot 12b : produits d'une partenaire (sans établissement), photo de remplacement venue d'un site extérieur.
 * Contre-vérification de la 11a (T6) gardée : identifiant exact seulement ; un identifiant partiel, inconnu, d'un
 * établissement non listé ou fermé à la commande répond 404, sans rien dire de plus.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const noStore = { 'Cache-Control': 'no-store' };
    try {
        // Lot 7 (7.3, D11, D56) : GET public, interrupteur d'abord (404 si le service est fermé)
        const closed = await guardFeature('orders', 'GET /api/restaurants/[id]/menu');
        if (closed) return closed;
        const { id } = await props.params;
        const menu = await readVenueMenu(id);
        if (!menu) {
            return NextResponse.json({ error: 'Cet établissement n’existe pas ou ne prend pas de commande en ce moment.', code: 'RESTAURANT_NOT_FOUND' },
                { status: 404, headers: noStore });
        }
        return NextResponse.json({ success: true, menu }, { headers: noStore });
    } catch (err: unknown) {
        const res = apiFailure('GET /api/restaurants/[id]/menu', err, { message: 'Impossible de charger la carte. Réessayez.', code: 'MENU_UNAVAILABLE', status: 500 });
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
}
