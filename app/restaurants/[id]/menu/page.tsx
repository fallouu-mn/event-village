import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { MenuView } from '@/components/orders/client/menu/MenuView';
import { readVenueMenu } from '@/lib/orders/menu.server';

export const dynamic = 'force-dynamic';

/**
 * Lot 12b — carte des plats d'un établissement ([id] = établissement) : lue sur le serveur par la base
 * (order_venue_menu), rendue tout de suite (photos, plats, prix) ; panier et commande dans MenuView. Établissement
 * inconnu, non listé, fermé à la commande ou identifiant partiel : 404 (app/restaurants/[id]/menu/not-found.tsx). Le
 * service fermé répond déjà 404 par le layout (interrupteur features.orders_enabled).
 * Avant le lot 12b : page client par partenaire, total calculé dans le navigateur, photo de remplacement extérieure.
 */
const menuOf = cache(async (id: string) => readVenueMenu(id));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const menu = await menuOf(id);
    if (!menu) return { title: 'Carte introuvable — Event Village' };
    return {
        title: `${menu.venue.name} — Commander — Event Village`,
        description: `La carte de ${menu.venue.name}${menu.venue.city ? ` à ${menu.venue.city}` : ''} : commandez en ligne, en livraison, à emporter ou sur place.`,
    };
}

export default async function VenueMenuPage({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const menu = await menuOf(id);
    if (!menu) notFound();
    const raw = query.reprendre;
    const reorderId = typeof raw === 'string' && UUID_RE.test(raw) ? raw : null;
    return <MenuView menu={menu} reorderId={reorderId} />;
}
