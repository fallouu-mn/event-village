import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarOff, Clock, ExternalLink, Hourglass, MapPin, Navigation, ShieldCheck, Timer, Users, Wallet, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/LinkButton';
import { PlaceMap } from '@/components/lieux/PlaceMap';
import { RetryError } from '@/components/halls/client/RetryError';
import { BookingPanel } from '@/components/tables/client/BookingPanel';
import { VenueGallery } from '@/components/tables/client/VenueGallery';
import { capitalize, closureText, durationText, hoursRangeText, minutesText } from '@/components/tables/client/format';
import { publicVenue, type PublicVenue } from '@/lib/tables/queries';
import { WEEKDAYS, dakarToday, fcfaText } from '@/lib/tables/views';

/**
 * Lot 11b (écrans du client) : fiche publique d'un établissement (publicVenue de lib/tables/queries, même lecture que
 * GET /api/tables/[id]). Galerie glissable, genre, adresse et carte (chargée au toucher, seulement si la position
 * existe), horaires de la semaine, fermetures exceptionnelles à venir, règles en clair lues sur `rules` (annulation
 * gratuite, table gardée après l'heure, attente du paiement, délai de réponse), puis le panneau de réservation
 * (créneaux, plan de salle, devis de la base, réservation). Établissement absent, inactif ou non validé : 404
 * « Établissement introuvable ». Lecture impossible : « Réessayer ». Service fermé : 404 par la garde du groupe.
 */
export const dynamic = 'force-dynamic';

/** Lot Carte B3 : phrase de la fiche d'un établissement de particulier. */
const VENUE_ZONE_PROMISE = 'Chez un particulier : l’adresse exacte vous est donnée dès que votre réservation est confirmée.';

const readVenue = cache(async (id: string): Promise<PublicVenue | null | 'error'> => {
    try {
        return await publicVenue(id);
    } catch (err) {
        console.error('[Tables] fiche non lue :', err instanceof Error ? err.message : String(err));
        return 'error';
    }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const venue = await readVenue(id);
    if (!venue || venue === 'error') return { title: 'Réserver une table — Event Village' };
    return {
        title: `${venue.name} — Réserver une table — Event Village`,
        description: venue.description?.slice(0, 160) ?? `${venue.kindLabel} à ${venue.city ?? 'Dakar'} : choisissez votre heure et réservez votre table en ligne.`,
    };
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
    return (
        <section aria-labelledby={id} className="space-y-3">
            <h2 id={id} className="text-xl font-bold text-foreground-strong">{title}</h2>
            {children}
        </section>
    );
}

function Fact({ icon, children, sub }: { icon: ReactNode; children: ReactNode; sub?: ReactNode }) {
    return (
        <li className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">{icon}</span>
            <div className="min-w-0 pt-0.5">
                <p className="text-base font-semibold text-foreground-strong">{children}</p>
                {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
            </div>
        </li>
    );
}

function Rule({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <li className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
            <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground-strong">{title}</h3>
                <p className="mt-0.5 text-base leading-relaxed text-foreground">{children}</p>
            </div>
        </li>
    );
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const venue = await readVenue(id);
    if (venue === 'error') {
        return (
            <div className="space-y-4">
                <LinkButton href="/tables" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Tous les établissements</LinkButton>
                <RetryError title="L’établissement n’a pas pu être chargé" />
            </div>
        );
    }
    if (!venue) notFound();

    // Jour de Dakar (UTC+0) ; jour de la semaine ISO (1 = lundi)
    const today = dakarToday();
    const todayIso = ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const place = [venue.address, venue.city].filter(Boolean).join(', ');
    const hasPosition = venue.latitude !== null && venue.longitude !== null;
    const deposit = venue.depositPerPerson > 0;
    const manual = venue.confirmation === 'MANUELLE';
    const r = venue.rules;
    const week = WEEKDAYS.map((name, i) => ({
        iso: i + 1,
        name,
        ranges: venue.hours.filter((h) => h.weekday === i + 1).sort((a, b) => a.opensAt.localeCompare(b.opensAt)),
    }));

    return (
        <div className="space-y-4">
            <LinkButton href="/tables" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">
                Tous les établissements
            </LinkButton>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <article className="min-w-0 space-y-8 lg:col-span-2">
                    <VenueGallery photos={venue.photos} name={venue.name} />

                    <header className="space-y-2">
                        <Badge variant="brand">{venue.kindLabel}</Badge>
                        <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-4xl">{venue.name}</h1>
                        {place && (
                            <p className="flex items-start gap-1.5 text-base text-muted-foreground">
                                <MapPin size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{place}</span>
                            </p>
                        )}
                        {venue.partnerName && (
                            <p className="text-base text-muted-foreground">
                                {'Proposé par '}
                                <span className="font-semibold text-foreground-strong">{venue.partnerName}</span>
                            </p>
                        )}
                    </header>

                    <ul className="grid gap-4 sm:grid-cols-2" aria-label="L’essentiel">
                        <Fact icon={<Wallet size={20} />} sub={deposit ? 'Payé en ligne pour garder la table, frais de service en plus' : 'Aucun paiement pour réserver'}>
                            {deposit ? `Acompte ${fcfaText(venue.depositPerPerson)} par personne` : 'Réservation gratuite'}
                        </Fact>
                        <Fact icon={manual ? <Hourglass size={20} /> : <Zap size={20} />} sub={manual ? `L’établissement répond sous ${durationText(r.responseMinutes)}` : 'Votre table est confirmée tout de suite'}>
                            {manual ? 'Sur acceptation' : 'Confirmation immédiate'}
                        </Fact>
                        {venue.maxCapacity > 0 && (
                            <Fact icon={<Users size={20} />} sub="Selon les tables de l’établissement">
                                {`De ${Math.max(1, venue.minCapacity)} à ${venue.maxCapacity} personnes`}
                            </Fact>
                        )}
                        {venue.slotMinutes > 0 && (
                            <Fact icon={<Timer size={20} />} sub="Durée prévue pour votre repas ou votre soirée">
                                {`Table pour ${durationText(venue.slotMinutes)}`}
                            </Fact>
                        )}
                    </ul>

                    <LinkButton href="#reserver" variant="primary" fullWidth className="lg:hidden">
                        Choisir mon heure et réserver
                    </LinkButton>

                    {venue.description && (
                        <Section title="À propos" id="etab-a-propos">
                            <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">{venue.description}</p>
                        </Section>
                    )}

                    <Section title="Horaires" id="etab-horaires">
                        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                            {week.map((d) => {
                                const isToday = d.iso === todayIso;
                                return (
                                    <li key={d.iso} className={isToday ? 'flex flex-wrap items-start justify-between gap-x-4 gap-y-1 bg-primary-soft px-4 py-3' : 'flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3'}>
                                        <span className={isToday ? 'text-base font-bold text-primary-text' : 'text-base font-semibold text-foreground-strong'}>
                                            {capitalize(d.name)}
                                            {isToday && <span className="font-normal">{' · aujourd’hui'}</span>}
                                        </span>
                                        <span className="text-right text-base tabular-nums text-foreground">
                                            {d.ranges.length === 0
                                                ? <span className="text-muted-foreground">Fermé</span>
                                                : d.ranges.map((h, i) => <span key={`${h.opensAt}-${i}`} className="block">{hoursRangeText(h.opensAt, h.closesAt)}</span>)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        {venue.closures.length > 0 && (
                            <div className="space-y-2 rounded-2xl border border-warning-border bg-warning-soft p-4">
                                <h3 className="flex items-center gap-2 text-base font-semibold text-warning-text">
                                    <CalendarOff size={18} aria-hidden="true" />
                                    Fermetures exceptionnelles à venir
                                </h3>
                                <ul className="space-y-1">
                                    {venue.closures.map((c) => (
                                        <li key={`${c.startsAt}-${c.endsAt}`} className="text-base text-warning-text">{closureText(c.startsAt, c.endsAt)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Section>

                    {(place || hasPosition) && (
                        <Section title={venue.exact ? 'Adresse' : 'Quartier'} id="etab-adresse">
                            {place && <p className="text-base font-semibold text-foreground-strong">{place}</p>}
                            {!venue.exact && <p className="text-base text-muted-foreground">{VENUE_ZONE_PROMISE}</p>}
                            {hasPosition && (
                                <>
                                    <PlaceMap latitude={venue.latitude as number} longitude={venue.longitude as number} name={venue.name} area={venue.city} exact={venue.exact} />
                                    {/* Lot Carte B3 : itinéraire seulement vers le point exact d'un lieu professionnel */}
                                    {venue.exact && (
                                        <LinkButton
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`}
                                            external
                                            variant="secondary"
                                            leftIcon={<Navigation size={18} />}
                                            rightIcon={<ExternalLink size={16} />}
                                        >
                                            Voir l’itinéraire
                                        </LinkButton>
                                    )}
                                </>
                            )}
                        </Section>
                    )}

                    <Section title="Bon à savoir" id="etab-regles">
                        <ul className="space-y-4 rounded-2xl border border-border bg-card p-5">
                            <Rule icon={<ShieldCheck size={20} />} title="Annulation">
                                {deposit
                                    ? `Annulation gratuite jusqu’à ${r.cancelFreeHours} h avant l’heure : l’acompte vous est rendu en entier. Après, il est gardé par l’établissement.`
                                    : 'Réservation sans acompte : vous pouvez l’annuler jusqu’à l’heure prévue, sans frais.'}
                            </Rule>
                            <Rule icon={<Clock size={20} />} title="Retard">
                                {`Votre table est gardée ${minutesText(r.noShowMinutes)} après l’heure prévue. Au-delà, elle peut être donnée à d’autres clients.`}
                            </Rule>
                            {deposit && (
                                <Rule icon={<Wallet size={20} />} title="Paiement de l’acompte">
                                    {`Après la réservation, vous avez ${minutesText(r.holdMinutes)} pour payer par Wave ou Orange Money ; sinon la table est libérée. Des frais de service s’ajoutent : leur montant exact s’affiche avant de réserver.`}
                                </Rule>
                            )}
                            {manual && (
                                <Rule icon={<Hourglass size={20} />} title="Réponse de l’établissement">
                                    {`L’établissement accepte ou refuse votre demande sous ${durationText(r.responseMinutes)}. Sans réponse à temps, la demande est annulée${deposit ? ' et l’acompte vous est rendu' : ''}.`}
                                </Rule>
                            )}
                        </ul>
                    </Section>
                </article>

                <aside
                    id="reserver"
                    aria-labelledby="reserver-titre"
                    className="min-w-0 scroll-mt-20 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto"
                >
                    <BookingPanel
                        venue={{
                            id: venue.id,
                            name: venue.name,
                            depositPerPerson: venue.depositPerPerson,
                            confirmation: venue.confirmation,
                            floorPlan: venue.floorPlan,
                            zones: venue.zones,
                            minCapacity: venue.minCapacity,
                            maxCapacity: venue.maxCapacity,
                            slotMinutes: venue.slotMinutes,
                            rules: { holdMinutes: r.holdMinutes, responseMinutes: r.responseMinutes, cancelFreeHours: r.cancelFreeHours, noShowMinutes: r.noShowMinutes },
                        }}
                        today={today}
                    />
                </aside>
            </div>
        </div>
    );
}
