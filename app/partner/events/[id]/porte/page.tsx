'use client';

import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { useServerData } from '@/components/partner/useServerData';
import { DoorList } from '@/components/event-tables/DoorList';
import type { PilotageOverview } from '@/components/partner/pilotage/types';

/**
 * Lot 11c-c — liste de la porte des tables, pour l'organisatrice (et l'administration habilitée, qui ouvre aussi le
 * pilotage). La liste elle-même est servie par GET /api/events/[id]/tables/door, qui vérifie le droit de scanner
 * l'événement ; le titre vient de l'aperçu du pilotage.
 */
export default function PartnerDoorListPage() {
    const params = useParams<{ id: string }>();
    const eventId = typeof params?.id === 'string' ? params.id : '';
    const overview = useServerData<PilotageOverview>(eventId ? `/api/partner/events/${eventId}/pilotage/overview` : null);
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-6 lg:py-8">
            <div className="print:hidden">
                <LinkButton href={`/partner/events/${eventId}?tab=tables`} variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Pilotage</LinkButton>
            </div>
            {eventId && <DoorList eventId={eventId} title={overview.data?.event.title ?? null} />}
        </div>
    );
}
