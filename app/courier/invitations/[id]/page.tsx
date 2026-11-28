import type { Metadata } from 'next';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { CourierInvitation } from '@/components/orders/courier/CourierInvitation';
import { COURIER_PATHS } from '@/components/orders/courier/courier-view';

/**
 * Lot 12d — invitation à livrer pour un établissement (lien de l'avis ORDER_COURIER_INVITED) : accepter ou refuser.
 * Invitation illisible, inconnue ou adressée à un autre compte : « Cet élément n'est plus disponible ». Garde du service :
 * app/courier/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Invitation à livrer — Event Village', robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CourierInvitationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID_RE.test(id)) return <UnavailableItem actionLabel="Mes livraisons" actionHref={COURIER_PATHS.home} />;
    return <CourierInvitation invitationId={id} />;
}
