'use client';

/**
 * Lot 10b (point 3) : écran de modification d'une salle. Lit la salle (GET /api/partner/halls/[id] : seulement une salle
 * de la partenaire de la session, sinon « Salle introuvable ») puis affiche le formulaire commun en mode modification.
 */
import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/EmptyState';
import { useServerData } from '@/components/partner/useServerData';
import { HallForm } from './HallForm';
import { HallFormSkeleton } from './HallSkeletons';
import type { OwnHall, PolicyKey } from './hall-api';

export function HallEditView({ hallId, policyTexts }: { hallId: string; policyTexts: Record<PolicyKey, string> | null }) {
    const sheetHref = `/partner/halls/${encodeURIComponent(hallId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ hall: OwnHall }>(`/api/partner/halls/${encodeURIComponent(hallId)}`);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <HallFormSkeleton />
                <span className="sr-only">Chargement de la salle…</span>
            </div>
        );
    }

    if (error || !data?.hall) {
        return (
            <div className="mx-auto w-full max-w-4xl">
                <PageHeader back={{ href: '/partner/halls', label: 'Mes salles' }} title="Modifier la salle" />
                <ErrorState
                    title="Salle indisponible"
                    description={error ?? 'Cette salle n’a pas pu être chargée.'}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-4xl pb-10">
            <PageHeader
                back={{ href: sheetHref, label: 'Retour à la salle' }}
                title="Modifier la salle"
                description={data.hall.name}
            />
            <HallForm mode="edit" hall={data.hall} policyTexts={policyTexts} />
        </div>
    );
}
