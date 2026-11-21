import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, MapPin, Navigation, Users, Wallet } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { VenueMap } from '@/components/event-page/VenueMap';
import { HallBookingPanel } from '@/components/halls/client/HallBookingPanel';
import { HallCalendar } from '@/components/halls/client/HallCalendar';
import { HallGallery } from '@/components/halls/client/HallGallery';
import { RetryError } from '@/components/halls/client/RetryError';
import { countText } from '@/components/halls/client/format';
import { publicHall, type PublicHall } from '@/lib/halls/queries';
import { fcfaText } from '@/lib/halls/views';

/**
 * Lot 10b (point 2) : fiche publique d'une salle (publicHall de lib/halls/queries, même lecture que GET /api/halls/[id]).
 * Galerie, capacité, équipements, description, adresse et carte (chargée au toucher, seulement si la position existe),
 * acompte, échéance du solde, règle d'annulation, calendrier des disponibilités ; panneau de réservation (devis du
 * serveur avant de payer, réservation, paiement). Salle absente, inactive ou non validée : 404 « Salle introuvable ».
 * Lecture impossible : « Réessayer ». Service fermé : 404 par app/halls/layout.tsx.
 * Correctifs du lot 10b : durée réelle pendant laquelle la date est gardée pour payer (hall.holdMinutes, réglage du
 * serveur), dite dans « Paiement et annulation » et passée au panneau de réservation.
 */
export const dynamic = 'force-dynamic';

const readHall = cache(async (id: string): Promise<PublicHall | null | 'error'> => {
    try {
        return await publicHall(id);
    } catch (err) {
        console.error('[Salle] fiche non lue :', err instanceof Error ? err.message : String(err));
        return 'error';
    }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const hall = await readHall(id);
    if (!hall || hall === 'error') return { title: 'Salle de fête — Event Village' };
    return {
        title: `${hall.name} — Salles de fête — Event Village`,
        description: hall.description?.slice(0, 160) ?? `Salle de fête à ${hall.city ?? 'Dakar'}, jusqu’à ${hall.capacity} invités.`,
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

export default async function HallPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const hall = await readHall(id);
    if (hall === 'error') {
        return (
            <div className="space-y-4">
                <LinkButton href="/halls" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">Toutes les salles</LinkButton>
                <RetryError title="La salle n’a pas pu être chargée" />
            </div>
        );
    }
    if (!hall) notFound();

    // Jour de Dakar (UTC+0)
    const today = new Date().toISOString().slice(0, 10);
    const place = [hall.address, hall.city].filter(Boolean).join(', ');
    const hasPosition = hall.latitude !== null && hall.longitude !== null;
    const hourly = hall.pricePerHour !== null;

    return (
        <div className="space-y-4">
            <LinkButton href="/halls" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">
                Toutes les salles
            </LinkButton>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <article className="min-w-0 space-y-8 lg:col-span-2">
                    <HallGallery photos={hall.photos} name={hall.name} />

                    <header className="space-y-2">
                        <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-4xl">{hall.name}</h1>
                        {place && (
                            <p className="flex items-start gap-1.5 text-base text-muted-foreground">
                                <MapPin size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{place}</span>
                            </p>
                        )}
                        {hall.partnerName && (
                            <p className="text-base text-muted-foreground">
                                {'Proposée par '}
                                <span className="font-semibold text-foreground-strong">{hall.partnerName}</span>
                            </p>
                        )}
                    </header>

                    <ul className="grid gap-4 sm:grid-cols-2" aria-label="L’essentiel">
                        <Fact icon={<Users size={20} />} sub="Capacité indiquée par la salle">
                            {`Jusqu’à ${countText(hall.capacity)} invités`}
                        </Fact>
                        <Fact icon={<Wallet size={20} />} sub={hourly ? `ou ${fcfaText(hall.pricePerHour)} par heure` : 'Location à la journée'}>
                            {`${fcfaText(hall.pricePerDay)} par jour`}
                        </Fact>
                    </ul>

                    <LinkButton href="#reserver" variant="primary" fullWidth className="lg:hidden">
                        Choisir une date et réserver
                    </LinkButton>

                    {hall.description && (
                        <Section title="À propos de la salle" id="salle-a-propos">
                            <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">{hall.description}</p>
                        </Section>
                    )}

                    {hall.amenities.length > 0 && (
                        <Section title="Équipements" id="salle-equipements">
                            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                                {hall.amenities.map((a) => (
                                    <li key={a} className="flex items-start gap-2 text-base text-foreground">
                                        <Check size={18} className="mt-0.5 flex-shrink-0 text-success-text" aria-hidden="true" />
                                        <span className="min-w-0 break-words">{a}</span>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {(place || hasPosition) && (
                        <Section title="Adresse" id="salle-adresse">
                            {place && <p className="text-base font-semibold text-foreground-strong">{place}</p>}
                            {hasPosition && (
                                <>
                                    <VenueMap latitude={hall.latitude as number} longitude={hall.longitude as number} venueName={place || hall.name} eventName={hall.name} />
                                    <LinkButton
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${hall.latitude},${hall.longitude}`}
                                        external
                                        variant="secondary"
                                        leftIcon={<Navigation size={18} />}
                                        rightIcon={<ExternalLink size={16} />}
                                    >
                                        Voir l’itinéraire
                                    </LinkButton>
                                </>
                            )}
                        </Section>
                    )}

                    <Section title="Paiement et annulation" id="salle-conditions">
                        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Acompte</h3>
                                <p className="mt-1 text-base leading-relaxed text-foreground">{hall.depositText}</p>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Solde</h3>
                                <p className="mt-1 text-base leading-relaxed text-foreground">
                                    {hall.balanceDueDays > 0
                                        ? `Le reste est à payer au plus tard ${hall.balanceDueDays} jours avant la date. Pour une date plus proche, tout se paie en une fois.`
                                        : 'Le reste est à payer avant la date.'}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Délai pour payer</h3>
                                <p className="mt-1 text-base leading-relaxed text-foreground">
                                    {`La date est gardée ${hall.holdMinutes > 1 ? `${hall.holdMinutes} minutes` : `${hall.holdMinutes} minute`} pour payer, par Wave ou Orange Money. Sans paiement, elle est libérée.`}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Frais de service</h3>
                                <p className="mt-1 text-base leading-relaxed text-foreground">Ils s’ajoutent au prix ; leur montant exact s’affiche avant de payer.</p>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Conditions d’annulation</h3>
                                <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-foreground">{hall.cancellation}</p>
                            </div>
                        </div>
                    </Section>

                    <Section title="Disponibilités" id="salle-disponibilites">
                        <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
                            <HallCalendar hallId={hall.id} today={today} hourly={hourly} />
                        </div>
                    </Section>
                </article>

                <aside
                    id="reserver"
                    aria-labelledby="reserver-titre"
                    className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto"
                >
                    <HallBookingPanel
                        hall={{ id: hall.id, name: hall.name, pricePerDay: hall.pricePerDay, pricePerHour: hall.pricePerHour, holdMinutes: hall.holdMinutes }}
                        today={today}
                    />
                </aside>
            </div>
        </div>
    );
}
