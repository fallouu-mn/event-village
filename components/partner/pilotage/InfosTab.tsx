'use client';

import React from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useServerData } from '@/components/partner/useServerData';
import { PilotageSection } from './PilotageBlocks';
import { formatEventDateTime } from '@/lib/format';
import { retainedEnd } from '@/lib/events/event-end';

/**
 * Finition 2a — onglet « Infos » du pilotage : dates, fin retenue (même règle que la base, jamais « Non précisée »),
 * lieu et informations pratiques, tels qu'ils sont enregistrés. Source : GET /api/partner/events/[id] (lecture
 * seule ; la modification passe par « Modifier »).
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
            <dt className="text-sm text-fg-muted">
                <span className="absolute left-0 top-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken text-fg-muted" aria-hidden="true">
                    {icon}
                </span>
                {label}
            </dt>
            <dd className="break-words text-base font-medium text-fg">{children}</dd>
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
    const practical = ev.practical_info && typeof ev.practical_info === 'object'
        ? Object.entries(PRACTICAL_LABELS)
            .map(([key, label]) => ({ key, label, value: text(ev.practical_info?.[key]) }))
            .filter((r): r is { key: string; label: string; value: string } => r.value !== null)
        : [];

    return (
        <div className="flex flex-col gap-8">
            <PilotageSection title="Dates et horaires" description="Heure de Dakar.">
                <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
                    <InfoItem icon={<CalendarDays size={18} />} label="Début">{formatEventDateTime(ev.start_date, ev.start_time)}</InfoItem>
                    <InfoItem icon={<Clock size={18} />} label="Fin">
                        {end ? end.text : '—'}
                        {end?.note && <span className="block text-sm font-normal text-fg-muted">{end.note}</span>}
                    </InfoItem>
                </dl>
            </PilotageSection>

            <PilotageSection title="Lieu">
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <InfoItem icon={<MapPin size={18} />} label="Lieu">
                            {[ev.location, ev.city].filter(Boolean).join(', ') || 'Non renseigné'}
                        </InfoItem>
                    </dl>
                    {practical.length > 0 && (
                        <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                            {practical.map((p) => (
                                <div key={p.key} className="min-w-0">
                                    <dt className="text-sm text-fg-muted">{p.label}</dt>
                                    <dd className="whitespace-pre-line break-words text-base text-fg">{p.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </PilotageSection>
        </div>
    );
}
