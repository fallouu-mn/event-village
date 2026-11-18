'use client';

/**
 * Équipe de contrôle de l'organisateur — finition 1 (E-13, E-14, E-17) : la liste est le composant commun TeamPanel
 * (portée « tous les événements »), le même que l'onglet Équipe du pilotage, sur une seule lecture serveur
 * (GET /api/partner/team). Temps réel : les changements de statut des événements (event_status_history) relancent la
 * lecture ; relecture de secours toutes les 60 s dans TeamPanel (acceptation, refus, expiration d'une invitation).
 *
 * Finition 3d (point 4b) : un admin (qui n'est pas lui-même organisatrice) choisit l'organisatrice dans une liste avec
 * recherche (OrganizerPicker) : fini « ?partnerId= » tapé à la main. Le choix est gardé dans l'adresse (?partnerId=, lien
 * et rechargement) ; « Changer d'organisatrice » ramène à la liste. Le serveur décide toujours (events.read pour lire,
 * events.write pour agir, motif demandé à l'admin par TeamPanel).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TeamPanel } from '@/components/partner/team/TeamPanel';
import { OrganizerPicker, type PickedOrganizer } from '@/components/partner/team/OrganizerPicker';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function PartnerTeamPage() {
    const router = useRouter();
    const { hasAnyRole } = useAuth();
    const actsAsAdmin = hasAnyRole(['ADMIN', 'SUPERADMIN']) && !hasAnyRole(['PARTENAIRE']);
    const [scopePartnerId, setScopePartnerId] = useState<string | null>(null);
    const [pickedName, setPickedName] = useState<string | null>(null);
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

    const pick = (o: PickedOrganizer) => {
        setScopePartnerId(o.partner_id);
        setPickedName(o.name);
        router.replace(`/partner/team?partnerId=${encodeURIComponent(o.partner_id)}`);
    };
    const change = () => {
        setScopePartnerId(null);
        setPickedName(null);
        router.replace('/partner/team');
    };
    const showPicker = actsAsAdmin && !scopePartnerId;

    return (
        <div className="mx-auto max-w-6xl space-y-6 py-6 pb-24">
            <PageHeader
                title="Équipe de contrôle"
                description={actsAsAdmin
                    ? 'Les personnes qui scannent les billets à l’entrée des événements de l’organisatrice choisie : leur état, leur porte et leurs espèces, événement par événement.'
                    : 'Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement.'}
            />
            {ready && showPicker && <OrganizerPicker onPick={pick} />}
            {ready && !showPicker && (
                <>
                    {actsAsAdmin && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-foreground-strong">
                                {pickedName
                                    ? <>Organisatrice : <span className="font-semibold">{pickedName}</span></>
                                    : <>Équipe de l’organisatrice choisie.</>}
                            </p>
                            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={change}>Changer d’organisatrice</Button>
                        </div>
                    )}
                    <TeamPanel scope="all" partnerId={scopePartnerId} signal={signal} liveStatus={liveStatus} />
                </>
            )}
        </div>
    );
}
