'use client';

import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { useServerData } from '@/components/partner/useServerData';
import dynamic from 'next/dynamic';
import { loadDoorList } from '@/components/event-tables/load-door';
import type { PilotageOverview } from '@/components/partner/pilotage/types';

/** Liste chargée par le chargeur unique de la porte (rien de la liste dans le morceau de la page). */
const DoorList = dynamic(() => loadDoorList().then((m) => ({ default: m.DoorList })), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl bg-muted motion-safe:animate-pulse" role="status" aria-label="Chargement de la liste de la porte" />,
});

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
