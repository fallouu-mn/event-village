'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import dynamic from 'next/dynamic';
import { loadDoorList } from '@/components/event-tables/load-door';

/** Liste chargée par le chargeur unique de la porte (rien de la liste dans le morceau de la page). */
const DoorList = dynamic(() => loadDoorList().then((m) => ({ default: m.DoorList })), {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-2xl bg-muted motion-safe:animate-pulse" role="status" aria-label="Chargement de la liste de la porte" />,
});

/**
 * Lot 11c-c — liste de la porte des tables, pour un contrôleur affecté à l'événement (espace contrôleur, thème sombre
 * forcé). La liste est servie par GET /api/events/[id]/tables/door, qui refuse (403) tout contrôleur d'un autre
 * événement ; le titre vient des affectations du contrôleur.
 */
export default function ControllerDoorListPage() {
    const params = useParams<{ id: string }>();
    const eventId = typeof params?.id === 'string' ? params.id : '';
    const [title, setTitle] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return undefined;
        let cancelled = false;
        fetch('/api/controller/assignments', { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = (await res.json()) as { assignments?: Array<{ events?: { id?: string; title?: string } | null }> };
                const found = (body.assignments ?? []).find((a) => a.events?.id === eventId);
                if (!cancelled) setTitle(found?.events?.title ?? null);
            })
            .catch((err: unknown) => console.warn('[porte] titre de l’événement illisible :', err instanceof Error ? err.message : String(err)));
        return () => { cancelled = true; };
    }, [eventId]);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:py-8">
            <div className="print:hidden"><LinkButton href="/controller/scanner" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Scanner</LinkButton></div>
            {eventId && <DoorList eventId={eventId} title={title} />}
        </div>
    );
}
