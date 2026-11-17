'use client';

/**
 * Onglet Équipe du pilotage — finition 1 (E-11, E-14) : la liste est le composant commun TeamPanel (portée « un
 * événement »), le même que /partner/team, sur la même lecture serveur (GET /api/partner/team?eventId=). Liste visible
 * au premier écran ; l'invitation passe dans une fenêtre ; invitations en attente, expirées, refusées et annulées
 * visibles ici aussi ; « Caisse ouverte » et les entrées ouvrent les onglets Caisse et Entrées (onOpenTab).
 * Finition 2b (B, E-23) : « Zones et portes » (lot 9 ter) a quitté l'onglet pour l'étape « Contrôle à l'entrée » du
 * formulaire de l'événement, où les couleurs se changent aussi ; « Modifier les portes et les couleurs » y mène.
 */
import React from 'react';
import { TeamPanel } from '@/components/partner/team/TeamPanel';

export function TeamTab({ eventId, signal, onOpenTab }: {
    eventId: string;
    /** Conservé pour l'appelant : le serveur sert lui-même l'état de l'événement (validé, terminé…). */
    eventStatus?: string;
    signal: number;
    onOpenTab?: (tab: 'caisse' | 'entrees') => void;
}) {
    return (
        <div className="flex flex-col gap-6">
            <TeamPanel scope="event" eventId={eventId} signal={signal} onOpenTab={onOpenTab} />
        </div>
    );
}
