'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { loadEventMap } from '@/components/ui/event-map-load';
import { CalendarDays, Clock, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useServerData } from '@/components/partner/useServerData';
import { PilotageSection } from './PilotageBlocks';
import { formatEventDateTime } from '@/lib/format';
import { retainedEnd } from '@/lib/events/event-end';
import { directionsUrl } from '@/lib/events/directions';

// Finition 2a (3) : petite carte du lieu, chargée à la demande (Leaflet lit window)
const EventMap = dynamic(() => loadEventMap().then((m) => ({ default: m.EventMap })), {
    ssr: false,
    loading: () => <div className="h-48 w-full rounded-xl bg-muted motion-safe:animate-pulse sm:h-56" aria-hidden="true" />,
});

/**
 * Finition 2a — onglet « Infos » du pilotage : dates, fin retenue (même règle que la base, jamais « Non précisée »),
 * lieu avec sa petite carte et « Voir l’itinéraire » (point 3), informations pratiques, tels qu'ils sont enregistrés.
 * Source : GET /api/partner/events/[id] (lecture seule ; la modification passe par « Modifier »).
 */

interface InfosEvent {
    start_date: string | null;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    location: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    practical_info: Record<string, unknown> | null;
}

const PRACTICAL_LABELS: Record<string, string> = {
    address: 'Adresse',
    accessNotes: 'Accès',
    parking: 'Stationnement',
    contactPhone: 'Téléphone sur place',
    rules: 'Règlement',
};

function text(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function InfoItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="relative min-h-9 min-w-0 pl-12">
            <dt className="text-sm text-muted-foreground">
                <span className="absolute left-0 top-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
                    {icon}
                </span>
                {label}
            </dt>
            <dd className="break-words text-base font-medium text-foreground-strong">{children}</dd>
        </div>
    );
}

export function InfosTab({ eventId }: { eventId: string }) {
    const { data, error, loading, refreshing, reload } = useServerData<{ event: InfosEvent }>(eventId ? `/api/partner/events/${eventId}` : null);

    if (loading && !data) {
        return (
            <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Chargement des informations">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }
    if (!data) {
        return (
            <ErrorState
                title="Les informations n’ont pas pu être chargées"
                description={error ?? 'Réessayez dans un instant.'}
                onRetry={() => void reload()}
                isRetrying={refreshing}
            />
        );
    }

    const ev = data.event;
    const end = retainedEnd(ev);
    const hasPosition = typeof ev.latitude === 'number' && typeof ev.longitude === 'number';
    const practical = ev.practical_info && typeof ev.practical_info === 'object'
        ? Object.entries(PRACTICAL_LABELS)
            .map(([key, label]) => ({ key, label, value: text(ev.practical_info?.[key]) }))
            .filter((r): r is { key: string; label: string; value: string } => r.value !== null)
        : [];

    return (
        <div className="flex flex-col gap-8">
            <PilotageSection title="Dates et horaires" description="Heure de Dakar.">
                <dl className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
                    <InfoItem icon={<CalendarDays size={18} />} label="Début">{formatEventDateTime(ev.start_date, ev.start_time)}</InfoItem>
                    <InfoItem icon={<Clock size={18} />} label="Fin">
                        {end ? end.text : '—'}
                        {end?.note && <span className="block text-sm font-normal text-muted-foreground">{end.note}</span>}
                    </InfoItem>
                </dl>
            </PilotageSection>

            <PilotageSection title="Lieu">
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <InfoItem icon={<MapPin size={18} />} label="Lieu">
                            {[ev.location, ev.city].filter(Boolean).join(', ') || 'Non renseigné'}
                            {!hasPosition && (
                                <span className="block text-sm font-normal text-muted-foreground">Aucun repère sur la carte : placez-le depuis « Modifier », étape Accès.</span>
                            )}
                        </InfoItem>
                    </dl>
                    {hasPosition && (
                        <div className="flex flex-col gap-3">
                            <EventMap latitude={ev.latitude as number} longitude={ev.longitude as number} venueName={ev.location ?? undefined} />
                            <LinkButton
                                href={directionsUrl(ev.latitude as number, ev.longitude as number)}
                                external
                                variant="secondary"
                                leftIcon={<Navigation size={18} />}
                                rightIcon={<ExternalLink size={16} />}
                                className="self-start"
                            >
                                Voir l’itinéraire
                            </LinkButton>
                        </div>
                    )}
                    {practical.length > 0 && (
                        <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                            {practical.map((p) => (
                                <div key={p.key} className="min-w-0">
                                    <dt className="text-sm text-muted-foreground">{p.label}</dt>
                                    <dd className="whitespace-pre-line break-words text-base text-foreground-strong">{p.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </PilotageSection>
        </div>
    );
}
