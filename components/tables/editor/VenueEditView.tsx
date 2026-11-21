'use client';

/**
 * Lot 11b — modification d'un établissement par sa propriétaire. Lit la fiche (GET /api/partner/venues/[id] : seulement
 * un établissement de la partenaire de la session, sinon « introuvable ») puis montre :
 *  - le statut de validation en bandeau ; refusé : motif et « Renvoyer en validation » (POST …/submit) ;
 *  - le formulaire commun (VenueForm, PATCH : fiche, photos, horaires, réglages) ;
 *  - les zones et les tables, enregistrées une à une (ZonesTablesManager) ;
 *  - les liens vers le plan de salle et les fermetures exceptionnelles.
 */
import { useState } from 'react';
import { CalendarOff, ChevronRight, LayoutDashboard, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { VenueFormSkeleton } from './EditorSkeletons';
import { VenueForm } from './VenueForm';
import { ZonesTablesManager } from './ZonesTablesManager';
import { SECTION_CARD, SectionTitle } from './form-parts';
import { apiMessage, defaultsOf, type OwnVenue } from './venue-api';

export function toneBadge(tone: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    return tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info' ? tone : 'neutral';
}

export function VenueEditView({ venueId }: { venueId: string }) {
    const router = useRouter();
    const toast = useToast();
    const url = `/api/partner/venues/${encodeURIComponent(venueId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ venue: OwnVenue }>(url);
    const [sending, setSending] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <VenueFormSkeleton actions={2} />
                <span className="sr-only">Chargement de l’établissement…</span>
            </div>
        );
    }

    if (error || !data?.venue) {
        return (
            <div className="mx-auto w-full max-w-4xl">
                <PageHeader back={{ href: '/partner/tables', label: 'Mes établissements' }} title="Modifier l’établissement" />
                <ErrorState
                    title="Établissement indisponible"
                    description={error ?? 'Cet établissement n’a pas pu être chargé.'}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            </div>
        );
    }

    const venue = data.venue;
    const base = `/partner/tables/edition/${encodeURIComponent(venue.id)}`;
    const refused = venue.status === 'REFUSEE';
    const suspended = venue.status === 'SUSPENDUE';
    const pendingReview = venue.status === 'EN_ATTENTE_VALIDATION';

    const resubmit = async () => {
        if (sending) return;
        setSending(true);
        setSubmitError(null);
        try {
            await sendJson(`${url}/submit`, 'POST');
            toast.success('Établissement renvoyé en validation.');
            router.push(`/partner/tables/${encodeURIComponent(venue.id)}?enregistre=renvoye`);
        } catch (err) {
            setSubmitError(apiMessage(err, 'Envoi impossible pour le moment. Réessayez.'));
            setSending(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-4xl pb-10">
            <PageHeader
                back={{ href: `/partner/tables/${encodeURIComponent(venue.id)}`, label: 'Retour à l’établissement' }}
                eyebrow={<Badge variant={toneBadge(venue.statusTone)}>{venue.statusLabel}</Badge>}
                title={refused ? 'Corriger et renvoyer' : 'Modifier l’établissement'}
                description={venue.name}
            />

            <div className="flex flex-col gap-6">
                {refused && (
                    <StatusBanner
                        tone="danger"
                        title="Établissement refusé : corrigez-le puis renvoyez-le en validation"
                        action={(
                            <Button type="button" size="sm" leftIcon={<Send size={16} />} isLoading={sending} disabled={sending} onClick={() => void resubmit()}>
                                Renvoyer en validation
                            </Button>
                        )}
                    >
                        <span className="block font-semibold">Motif de l’équipe d’Event Village :</span>
                        <span className="mt-1 block whitespace-pre-line break-words rounded-xl border border-danger-border bg-card px-3 py-2 text-base font-medium text-foreground-strong">
                            {venue.reason?.trim() || 'Aucun motif n’a été transmis.'}
                        </span>
                        <span className="mt-2 block">Corrigez la fiche, les zones ou les tables, puis renvoyez l’établissement.</span>
                        {submitError && <span role="alert" className="mt-2 block break-words font-semibold">{submitError}</span>}
                    </StatusBanner>
                )}
                {suspended && (
                    <StatusBanner tone="suspended" title="Établissement suspendu par Event Village">
                        <span className="block">{venue.statusHint}</span>
                        {venue.reason?.trim() && <span className="mt-1 block whitespace-pre-line break-words font-medium">{`Motif : ${venue.reason.trim()}`}</span>}
                    </StatusBanner>
                )}
                {pendingReview && (
                    <StatusBanner tone="warning" title="En attente de validation">
                        {venue.statusHint} Vous pouvez encore le corriger.
                    </StatusBanner>
                )}

                <nav aria-label="Autres réglages de l’établissement" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Link
                        href={`${base}/plan`}
                        className="group flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                            <LayoutDashboard size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-foreground-strong">Plan de salle</span>
                            <span className="block text-sm text-muted-foreground">{venue.floorPlan ? 'Montré aux clients' : 'Placez vos tables, montrez le plan'}</span>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" className="flex-shrink-0 text-muted-foreground transition-transform duration-fast motion-safe:group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                        href={`${base}/fermetures`}
                        className="group flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                            <CalendarOff size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-foreground-strong">Fermetures exceptionnelles</span>
                            <span className="block text-sm text-muted-foreground">
                                {venue.closures.length > 0 ? `${venue.closures.length} à venir` : 'Jour férié, travaux, soirée privée'}
                            </span>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" className="flex-shrink-0 text-muted-foreground transition-transform duration-fast motion-safe:group-hover:translate-x-0.5" />
                    </Link>
                </nav>

                <VenueForm key={venue.id} mode="edit" venue={venue} defaults={defaultsOf(venue.defaults)} onSaved={() => void reload()} />

                <section aria-labelledby="etab-s-tables" className={SECTION_CARD}>
                    <SectionTitle n={6} id="etab-s-tables" title="Zones et tables" text="Chaque changement est enregistré tout de suite. Une table réservée se désactive au lieu d’être supprimée." />
                    <ZonesTablesManager venueId={venue.id} zones={venue.zones} tables={venue.tables} onChanged={reload} />
                </section>
            </div>
        </div>
    );
}
