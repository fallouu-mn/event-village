'use client';

/**
 * Équipe de contrôle de l'organisateur — finition 1 (E-13, E-14, E-17) : la liste est le composant commun TeamPanel
 * (portée « tous les événements »), le même que l'onglet Équipe du pilotage, sur une seule lecture serveur
 * (GET /api/partner/team). Un admin arrive ici avec ?partnerId= (organisateur choisi) ; sans lui, le serveur répond
 * « Choisissez l’organisateur dont vous gérez l’équipe. ».
 * Temps réel : les changements de statut des événements (event_status_history) relancent la lecture ; relecture de
 * secours toutes les 60 s dans TeamPanel (acceptation, refus, expiration d'une invitation).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { TeamPanel } from '@/components/partner/team/TeamPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function PartnerTeamPage() {
    const [scopePartnerId, setScopePartnerId] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('partnerId');
        setScopePartnerId(value && /^[0-9a-f-]{36}$/i.test(value) ? value : null);
        setReady(true);
    }, []);

    const [signal, setSignal] = useState(0);
    const bump = useCallback(() => setSignal((n) => n + 1), []);
    const { status: liveStatus } = useRealtimeRefresh({
        channelKey: 'partner-team-statuts',
        subscriptions: [{ table: 'event_status_history', event: 'INSERT' }],
        onSignal: bump,
    });

    return (
        <div className="mx-auto max-w-6xl space-y-6 py-6 pb-24">
            <PageHeader
                title="Équipe de contrôle"
                description="Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
            />
            {ready && <TeamPanel scope="all" partnerId={scopePartnerId} signal={signal} liveStatus={liveStatus} />}
        </div>
    );
}
