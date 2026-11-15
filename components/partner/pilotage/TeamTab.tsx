'use client';

/**
 * Onglet Équipe du pilotage — finition 1 (E-11, E-14) : la liste est le composant commun TeamPanel (portée « un
 * événement »), le même que /partner/team, sur la même lecture serveur (GET /api/partner/team?eventId=). Liste visible
 * au premier écran ; l'invitation passe dans une fenêtre ; invitations en attente, expirées, refusées et annulées
 * visibles ici aussi ; « Caisse ouverte » et les entrées ouvrent les onglets Caisse et Entrées (onOpenTab).
 * « Zones et portes » (lot 9 ter) reste sous la liste, en attendant l'étape « Entrées » de l'événement (après lancement).
 */
import React from 'react';
import { TeamPanel } from '@/components/partner/team/TeamPanel';
import { useServerData } from '@/components/partner/useServerData';
import { ZonesEditor, type ZonesConfig } from '@/components/partner/zones/ZonesEditor';

export function TeamTab({ eventId, signal, onOpenTab }: {
    eventId: string;
    /** Conservé pour l'appelant : le serveur sert lui-même l'état de l'événement (validé, terminé…). */
    eventStatus?: string;
    signal: number;
    onOpenTab?: (tab: 'caisse' | 'entrees') => void;
}) {
    const zones = useServerData<ZonesConfig>(`/api/partner/events/${eventId}/zones`, signal);
    const [teamSignal, setTeamSignal] = React.useState(0);
    return (
        <div className="flex flex-col gap-6">
            <TeamPanel scope="event" eventId={eventId} signal={signal + teamSignal} onOpenTab={onOpenTab} />
            {/* Complément 9 : éditeur des zones et des couleurs, cible du lien « Modifier les portes et les couleurs » */}
            <div id="portes-et-couleurs" className="scroll-mt-24">
            <ZonesEditor
                eventId={eventId}
                config={zones.data}
                loading={zones.loading}
                error={zones.error}
                refreshing={zones.refreshing}
                reload={zones.reload}
                onSaved={() => setTeamSignal((n) => n + 1)}
            />
            </div>
        </div>
    );
}
