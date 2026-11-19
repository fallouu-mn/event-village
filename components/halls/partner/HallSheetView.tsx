'use client';

/**
 * Lot 10b (point 3) : fiche d'une salle pour sa propriétaire (GET /api/partner/halls/[id]).
 * Statut en mots (hallStatusView), motif si refusée ou suspendue, photos (la première est la principale), informations
 * clés (capacité, prix, acompte, règle d'annulation, adresse, équipements, description), actions Modifier et
 * « Renvoyer en validation » (refusée), puis le calendrier des réservations (HallCalendar). Après la création ou une
 * modification, un message (paramètre `enregistree` de l'adresse).
 */
import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Pencil, Send, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useServerData } from '@/components/partner/useServerData';
import { fcfaText, hallStatusView, POLICY_LABELS } from '@/lib/halls/views';
import { formatInteger } from '@/lib/format';
import { HallCalendar } from './HallCalendar';
import { HallSheetSkeleton } from './HallSkeletons';
import { showsReason, toneBanner, toneVariant, type OwnHall, type PolicyKey } from './hall-api';
import { useHallActions } from './useHallActions';

export type SavedNotice = 'creee' | 'modifiee' | null;

function depositText(h: OwnHall): string {
    if (h.deposit_value === null || h.deposit_value === undefined) return 'Valeur par défaut d’Event Village';
    if (h.deposit_mode === 'MONTANT_FIXE') return `${fcfaText(h.deposit_value)} (montant fixe)`;
    return `${String(h.deposit_value).replace('.', ',')} % du prix`;
}

function Fact({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl bg-muted px-4 py-3', wide && 'sm:col-span-2')}>
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="break-words text-base font-semibold text-foreground-strong tabular-nums">{children}</dd>
        </div>
    );
}

function Gallery({ photos, name }: { photos: string[]; name: string }) {
    const [current, setCurrent] = useState(0);
    if (photos.length === 0) {
        return (
            <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted text-muted-foreground sm:aspect-[21/9]">
                <Building2 size={32} aria-hidden="true" />
                <p className="text-sm">Aucune photo : ajoutez-en depuis « Modifier ».</p>
            </div>
        );
    }
    const index = Math.min(current, photos.length - 1);
    return (
        <div className="flex flex-col gap-3">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[21/9]">
                {/* eslint-disable-next-line @next/next/no-img-element -- photo de la salle (stockage du projet), cadre fixe réservé */}
                <img
                    src={photos[index]}
                    alt={index === 0 ? `Photo principale de ${name}` : `Photo ${index + 1} de ${name}`}
                    decoding="async"
                    className="h-full w-full object-cover"
                />
                {index === 0 && (
                    <span className="absolute left-3 top-3 rounded-lg border border-border bg-card px-2 py-1 text-sm font-semibold text-foreground-strong shadow-sm">
                        Photo principale
                    </span>
                )}
            </div>
            {photos.length > 1 && (
                <ul className="flex flex-wrap gap-2" aria-label="Choisir la photo affichée">
                    {photos.map((url, i) => (
                        <li key={url}>
                            <button
                                type="button"
                                onClick={() => setCurrent(i)}
                                aria-label={`Afficher la photo ${i + 1}`}
                                aria-pressed={i === index}
                                className={cn(
                                    'block h-14 w-20 overflow-hidden rounded-lg border-2 bg-muted transition-opacity duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    i === index ? 'border-primary-text' : 'border-transparent opacity-80 hover:opacity-100',
                                )}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la photo */}
                                <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function HallSheetView({ hallId, policyTexts, saved }: { hallId: string; policyTexts: Record<PolicyKey, string> | null; saved: SavedNotice }) {
    const base = `/partner/halls/${encodeURIComponent(hallId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ hall: OwnHall }>(`/api/partner/halls/${encodeURIComponent(hallId)}`);
    const actions = useHallActions({ onChanged: () => void reload() });
    const [savedShown, setSavedShown] = useState<SavedNotice>(saved);

    // Lien « Calendrier » (#calendrier) : la section n'existe qu'une fois la salle chargée, on s'y rend alors
    const loaded = !!data?.hall;
    useEffect(() => {
        if (!loaded || window.location.hash !== '#calendrier') return;
        document.getElementById('calendrier')?.scrollIntoView({ block: 'start' });
    }, [loaded]);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <HallSheetSkeleton />
                <span className="sr-only">Chargement de la salle…</span>
            </div>
        );
    }

    const hall = data?.hall;
    if (!hall) {
        return (
            <div className="mx-auto w-full max-w-5xl">
                <PageHeader back={{ href: '/partner/halls', label: 'Mes salles' }} title="Salle" />
                <ErrorState
                    title="Salle indisponible"
                    description={error ?? 'Cette salle n’a pas pu être chargée.'}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            </div>
        );
    }

    const view = hallStatusView(hall.validation_status);
    const refused = hall.validation_status === 'REFUSEE';
    const photos = Array.isArray(hall.images) ? hall.images.filter((u): u is string => typeof u === 'string' && !!u) : [];
    const amenities = Array.isArray(hall.amenities) ? hall.amenities.filter((a): a is string => typeof a === 'string' && !!a) : [];
    const policy = hall.cancellation_policy && POLICY_LABELS[hall.cancellation_policy] ? hall.cancellation_policy as PolicyKey : null;

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                back={{ href: '/partner/halls', label: 'Mes salles' }}
                eyebrow={(
                    <>
                        <Badge variant={toneVariant(view.tone)}>{view.label}</Badge>
                        {!hall.is_active && <Badge variant="neutral">Retirée de la vente</Badge>}
                    </>
                )}
                title={hall.name}
                description={[hall.city, hall.capacity ? `${formatInteger(hall.capacity)} personnes` : null].filter(Boolean).join(' · ') || undefined}
                actions={(
                    <>
                        <LinkButton href={`${base}/edit`} variant="secondary" leftIcon={<Pencil size={18} />}>Modifier</LinkButton>
                        {refused && (
                            <Button
                                leftIcon={<Send size={18} />}
                                isLoading={actions.busyId === hall.id}
                                disabled={actions.busyId !== null}
                                onClick={() => void actions.submit({ id: hall.id, name: hall.name })}
                            >
                                Renvoyer en validation
                            </Button>
                        )}
                    </>
                )}
            />

            {savedShown && (
                <StatusBanner
                    tone="success"
                    title={savedShown === 'creee' ? 'Salle enregistrée.' : 'Modifications enregistrées.'}
                    action={<Button type="button" variant="ghost" size="sm" onClick={() => setSavedShown(null)}>Fermer</Button>}
                    className="mb-4"
                >
                    {savedShown === 'creee'
                        ? 'Elle sera vérifiée par l’équipe d’Event Village avant d’être visible. Vous recevrez un message dès qu’elle aura été examinée.'
                        : refused ? 'Renvoyez la salle en validation quand vos corrections sont terminées.' : undefined}
                </StatusBanner>
            )}

            {actions.banner}

            <StatusBanner tone={toneBanner(view.tone)} title={view.label} className="mb-6">
                <span className="block">{view.hint}</span>
                {showsReason(hall.validation_status) && hall.validation_reason && (
                    <span className="mt-2 block">
                        <span className="font-semibold">Motif de l’équipe d’Event Village : </span>
                        <span className="break-words">{hall.validation_reason}</span>
                    </span>
                )}
                {!hall.is_active && (
                    <span className="mt-2 block">La salle est retirée de la vente : les clients ne peuvent pas la réserver. Remettez-la en vente depuis « Mes salles ».</span>
                )}
            </StatusBanner>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="flex flex-col gap-6 lg:col-span-3">
                    <Gallery photos={photos} name={hall.name} />
                    {hall.description && (
                        <section aria-labelledby="salle-description" className="flex flex-col gap-2">
                            <h2 id="salle-description" className="text-lg font-bold text-foreground-strong">Description</h2>
                            <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">{hall.description}</p>
                        </section>
                    )}
                    {amenities.length > 0 && (
                        <section aria-labelledby="salle-equipements" className="flex flex-col gap-2">
                            <h2 id="salle-equipements" className="text-lg font-bold text-foreground-strong">Équipements</h2>
                            <ul className="flex flex-wrap gap-2">
                                {amenities.map((a) => (
                                    <li key={a} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground-strong">{a}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <section aria-labelledby="salle-infos" className="flex flex-col gap-3 lg:col-span-2">
                    <h2 id="salle-infos" className="text-lg font-bold text-foreground-strong">Informations clés</h2>
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <Fact label="Prix par jour">{hall.price_per_day ? fcfaText(hall.price_per_day) : 'Non renseigné'}</Fact>
                        <Fact label="Prix par heure">{hall.price_per_hour ? fcfaText(hall.price_per_hour) : 'Location à l’heure non proposée'}</Fact>
                        <Fact label="Acompte">{depositText(hall)}</Fact>
                        <Fact label="Capacité">{hall.capacity ? <span className="tabular-nums">{`${formatInteger(hall.capacity)} personnes`}</span> : 'Non renseignée'}</Fact>
                        <Fact label="Règle d’annulation" wide>
                            <span className="block">{policy ? POLICY_LABELS[policy] : 'Non renseignée'}</span>
                            {policy && policyTexts?.[policy] && (
                                <span className="mt-1 block text-sm font-normal leading-relaxed text-foreground">{policyTexts[policy]}</span>
                            )}
                        </Fact>
                        <Fact label="Adresse" wide>
                            <span className="flex items-start gap-1.5">
                                <MapPin size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span>{[hall.address, hall.city].filter(Boolean).join(', ') || 'Non renseignée'}</span>
                            </span>
                            {(hall.latitude === null || hall.longitude === null) && (
                                <span className="mt-1 block text-sm font-normal text-warning-text">Position sur la carte à placer depuis « Modifier ».</span>
                            )}
                        </Fact>
                    </dl>
                    <LinkButton href="/partner/halls/recettes" variant="ghost" leftIcon={<Wallet size={18} />} className="self-start">
                        Voir les recettes des salles
                    </LinkButton>
                </section>
            </div>

            <div className="mt-8">
                <HallCalendar hallId={hall.id} />
            </div>

            {actions.dialog}
        </div>
    );
}
