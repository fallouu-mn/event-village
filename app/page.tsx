'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Compass,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Ticket,
  Undo2,
} from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { readCatalog, type CatalogEvent } from '@/lib/events/catalog-client';
import { useFeatureFlags } from '@/lib/features/client';

/**
 * Accueil public (lot 5, tâches 5.3 et 5.13 ; contrats E, O3, O5, Q).
 *  - « À l'affiche » : GET /api/events (PUBLIE à venir, prix du serveur, « Bientôt en vente » sans
 *    catégorie achetable), mis à jour en direct sur le résumé public public_event_state.
 *  - Aucune photo d'une banque d'images : décor sur les tokens du thème, affiches du stockage du projet.
 *  - Seuls des liens vers des pages existantes ; aucune donnée de contact factice.
 */

const ALL = 'tous';
const HOME_LIMIT = 8;

const PROMISES = [
  { icon: Smartphone, title: 'Wave et Orange Money', text: 'Payez depuis votre téléphone, le billet arrive aussitôt.' },
  { icon: QrCode, title: 'QR code dynamique', text: 'Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée.' },
  { icon: Undo2, title: 'Remboursement automatique', text: 'Événement annulé : les billets payés en ligne sont remboursés.' },
] as const;

const ORGANIZER_POINTS = [
  'Création et publication de vos événements, validées par notre équipe',
  'Ventes et entrées suivies en direct, contrôleurs et caisses sur place',
  'Fonds versés sur votre compte après l’événement',
] as const;

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[16/10] w-full bg-surface-sunken motion-safe:animate-pulse" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-4 w-1/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-5 w-3/4 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  // Lot 7 (7.3, D55) : carte et lien « Salles » seulement si features.halls_enabled est ouvert (masqués tant
  // que l'interrupteur n'est pas lu ; /halls répond 404 quand il est fermé).
  const featureFlags = useFeatureFlags();
  const hallsEnabled = featureFlags?.halls === true;
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState('');

  const load = useCallback(async (mode: 'initial' | 'silent') => {
    const result = await readCatalog('accueil');
    if (result.ok) {
      setEvents(result.events);
      setLoadError(null);
      setRefreshError(null);
      setPhase('ready');
      return;
    }
    if (mode === 'initial') {
      setLoadError(result.message);
      setPhase('error');
    } else {
      setRefreshError(result.message);
    }
  }, []);

  const refreshEvents = useCallback(() => load('silent'), [load]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Temps réel (contrat O5) : publication, suspension, annulation ou fin d'un événement → la liste est
  // rechargée par le serveur, sans recharger la page.
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'accueil-public',
    subscriptions: [{ table: 'public_event_state' }],
    onSignal: refreshEvents,
  });

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load('initial');
    } finally {
      setIsRetrying(false);
    }
  };

  const shown = useMemo(
    () => events.filter((evt) => category === ALL || evt.category === category).slice(0, HOME_LIMIT),
    [events, category],
  );

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  return (
    <div className="space-y-14 pb-24 sm:space-y-20 lg:pb-12">
      {/* 1. Accroche */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-border bg-surface px-5 py-10 shadow-sm sm:px-10 sm:py-14 lg:px-14">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-decor/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-brand-decor/10 blur-3xl" aria-hidden="true" />

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-fg/30 bg-brand-bg px-3.5 py-1.5 text-sm font-semibold text-brand-fg">
              <BadgeCheck size={16} aria-hidden="true" />
              Billetterie officielle au Sénégal
            </p>
            <h1 className="max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight text-fg sm:text-5xl">
              Découvrez, réservez et vivez les événements qui comptent.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et
              présentez votre billet à l’entrée.
            </p>

            <form role="search" onSubmit={onSearch} className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative flex-1">
                <TextInput
                  label="Rechercher un événement"
                  hideLabel
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Artiste, lieu, organisateur…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-12 pl-11"
                />
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              </div>
              <Button type="submit" size="lg" leftIcon={<Compass size={18} />}>
                Explorer
              </Button>
            </form>
          </div>

          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {PROMISES.map((item) => (
              <li key={item.title} className="flex items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                  <item.icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-fg">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. À l'affiche (temps réel) */}
      <section aria-labelledby="affiche-titre" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="affiche-titre" className="text-2xl font-bold tracking-tight text-fg">À l’affiche</h2>
            <LiveIndicator status={liveStatus} />
          </div>
          <LinkButton href="/explore" variant="ghost" size="sm" rightIcon={<ArrowRight size={16} />}>
            Tous les événements
          </LinkButton>
        </div>

        <div role="group" aria-label="Catégorie" className="flex flex-wrap gap-2">
          {[{ id: ALL, label: 'Tous' }, ...EVENT_CATEGORIES].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.id)}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  active
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-sunken',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {refreshError && phase === 'ready' && (
          <StatusBanner
            tone="warning"
            announce="alert"
            title="La liste n’a pas pu être mise à jour"
            action={(
              <Button variant="secondary" size="sm" onClick={() => void refreshEvents()} leftIcon={<RefreshCw size={16} />}>
                Réessayer
              </Button>
            )}
          >
            {refreshError} Les événements affichés sont ceux du dernier chargement.
          </StatusBanner>
        )}

        {phase === 'error' ? (
          <ErrorState
            title="Impossible d’afficher les événements"
            description={loadError ?? 'La liste n’a pas pu être chargée. Vérifiez votre connexion, puis réessayez.'}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        ) : phase === 'loading' ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : shown.length > 0 ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((evt, i) => (
              <li key={evt.id}>
                <EventCard
                  id={evt.id}
                  title={evt.title}
                  subtitle={evt.subtitle}
                  imageUrl={evt.imageUrl}
                  dateFormatted={evt.dateFormatted}
                  dayNumber={evt.dayNumber}
                  monthShort={evt.monthShort}
                  timeFormatted={evt.timeFormatted}
                  venue={evt.venue}
                  city={evt.city}
                  categoryLabel={evt.categoryLabel}
                  price={evt.price}
                  priority={i < 2}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Ticket size={28} />}
            title={category === ALL ? 'Aucun événement à l’affiche pour le moment' : 'Aucun événement dans cette catégorie'}
            description={category === ALL
              ? 'Les prochains événements apparaîtront ici dès leur publication, sans recharger la page.'
              : 'Choisissez une autre catégorie ou parcourez tout le catalogue.'}
            actionLabel={category === ALL ? undefined : 'Voir toutes les catégories'}
            onAction={category === ALL ? undefined : () => setCategory(ALL)}
          />
        )}
      </section>

      {/* 3. Organisateurs et salles */}
      <section aria-labelledby="organisateurs-titre" className={cn('grid gap-5', hallsEnabled && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-brand-decor/10 blur-3xl" aria-hidden="true" />
          <p className="text-sm font-semibold text-brand-fg">Espace organisateur</p>
          <h2 id="organisateurs-titre" className="mt-2 text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl">
            Vous organisez des événements ? Vendez vos billets avec Event Village.
          </h2>
          <ul className="mt-5 space-y-3">
            {ORGANIZER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base text-fg">
                <BadgeCheck size={20} className="mt-0.5 flex-shrink-0 text-success-fg" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/partner/register" size="lg" rightIcon={<ArrowRight size={18} />}>
              Devenir organisateur
            </LinkButton>
          </div>
        </div>

        {hallsEnabled && (
          <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border bg-surface-sunken p-6 sm:p-8">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                <Building2 size={20} />
              </span>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-fg">Une salle pour votre réception ?</h2>
              <p className="mt-2 text-base leading-relaxed text-fg-muted">
                Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne.
              </p>
            </div>
            <LinkButton href="/halls" variant="secondary" rightIcon={<ArrowRight size={16} />}>
              Voir les salles
            </LinkButton>
          </div>
        )}
      </section>

      {/* 4. Pied de page */}
      <footer className="border-t border-border pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="text-base font-bold text-fg">Event Village</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              {hallsEnabled ? 'Billetterie, salles et événements au Sénégal.' : 'Billetterie et événements au Sénégal.'}
            </p>
          </div>
          <nav aria-label="Liens du pied de page">
            <ul className="flex flex-wrap gap-x-2 gap-y-1">
              {[
                { label: 'Explorer', href: '/explore' },
                { label: 'Mes billets', href: '/tickets' },
                ...(hallsEnabled ? [{ label: 'Salles', href: '/halls' }] : []),
                { label: 'Devenir organisateur', href: '/partner/register' },
              ].map((link) => (
                <li key={link.href}>
                  <LinkButton href={link.href} variant="ghost" size="sm">
                    {link.label}
                  </LinkButton>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-6 text-sm text-fg-muted">
          Event Village, {new Date().getFullYear()}. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
}
