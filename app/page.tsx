import React, { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, Gift, QrCode, Search, Smartphone, Ticket, Undo2 } from 'lucide-react';
import { HomeLive } from '@/app/_accueil/HomeLive';
import { HomeNearby } from '@/app/_accueil/HomeNearby';
import { LiveNowItem, LiveNowSection } from '@/app/_accueil/LiveNow';
import { CardRow, FeaturedRow, ROW, ROW_ITEM, ROW_SIZES, SectionHead, cardProps } from '@/app/_accueil/sections';
import { loadHomeData, type HomeData } from '@/app/_accueil/data.server';
import { EventCard } from '@/components/events/EventCard';
import { CardTransitions } from '@/components/events/CardLink';
import { CardLiveBadges } from '@/components/events/CardLiveBadge';
import { CardFavorites } from '@/components/events/CardFavorites';
import { AccessNotice } from '@/components/layout/AccessNotice';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { exploreHref } from '@/lib/events/catalog-filters';
import { formatPercent } from '@/lib/format';

/**
 * Accueil public (lot 5, tâches 5.3 et 5.13 ; contrats E, O3, O5, Q ; design 1b, points 1, 3, 10 et 11).
 *
 * Préparé par le serveur et régénéré au plus toutes les 60 s (`revalidate`, lectures sous unstable_cache) : aucune
 * donnée personnelle dans ce HTML partagé. Parties personnelles et vivantes en îlots client chargés après :
 * message d'accès refusé (lit l'adresse), « Près de chez vous » (ville du profil ou de l'appareil), temps réel
 * (public_event_state), « En ce moment » et badges « En cours » (calculés sur le téléphone à partir des heures).
 *
 * Ordre : accroche et recherche ; « En ce moment » (seulement s'il y en a) ; « À la une » (choix du Superadmin, sinon
 * les plus vendus des 7 derniers jours, sinon les prochains événements) ; Cette semaine ; Gratuits ; Par catégorie ;
 * Près de chez vous ; comment ça marche ; parrainage (taux lus dans referral_config, bloc absent sans ligne active) ;
 * organisateurs (le seul grand bouton en dégradé de la page) ; pied de page.
 * Aucun chiffre ni promesse inventés (docs/design/stitch/charte-faciloop.md) : les nombres affichés sont des comptes du
 * catalogue ou des réglages lus en base.
 */
export const revalidate = 60;

const PROMISES = [
  { icon: Smartphone, title: 'Wave et Orange Money', text: 'Payez depuis votre téléphone, le billet arrive aussitôt dans « Mes billets ».' },
  { icon: QrCode, title: 'QR code dynamique', text: 'Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée.' },
  { icon: Undo2, title: 'Remboursement automatique', text: 'Événement annulé : les billets payés en ligne sont remboursés.' },
] as const;

const ORGANIZER_POINTS = [
  'Création et publication de vos événements, validées par notre équipe',
  'Ventes et entrées suivies en direct, contrôleurs et caisses sur place',
  'Fonds versés sur votre compte après l’événement',
] as const;

const SHORTCUTS = [
  { label: 'Aujourd’hui', href: exploreHref({ quand: 'aujourdhui' }) },
  { label: 'Ce week-end', href: exploreHref({ quand: 'weekend' }) },
  { label: 'Cette semaine', href: exploreHref({ quand: 'semaine' }) },
  { label: 'Gratuit', href: exploreHref({ gratuit: true }) },
] as const;

const CHIP = 'ev-press inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground-strong transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const FEATURED_HEAD: Record<HomeData['featured']['source'], { title: string; hint: string }> = {
  'a-la-une': { title: 'À la une', hint: 'La sélection de l’équipe Event Village.' },
  populaires: { title: 'Populaires', hint: 'Les événements les plus demandés des 7 derniers jours.' },
  prochainement: { title: 'Prochainement', hint: 'Les prochains événements à l’affiche.' },
};

/** Taux de referral_config (en %) : « 5 % », « 2,5 % ». */
function rate(value: number): string {
  return formatPercent(value / 100, 2);
}

async function readHome(): Promise<HomeData | null> {
  try {
    return await loadHomeData();
  } catch (err) {
    // Pendant la construction (base peut-être injoignable), la page se construit quand même avec l'état d'erreur ; ensuite,
    // une panne est levée : en régénération, Next garde la dernière page réussie au lieu de servir une erreur.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.error('[accueil] catalogue indisponible pendant la construction :', err instanceof Error ? err.message : String(err));
      return null;
    }
    throw err;
  }
}

export default async function HomePage() {
  const data = await readHome();
  const year = new Date().getUTCFullYear();
  const live = data?.sections.liveCandidates ?? [];
  const liveAtRender = data?.sections.liveAtRender ?? [];
  // Image principale du premier écran : la première carte en cours si la rangée est rendue, sinon la première de « À la une ».
  const firstLiveId = live.find((e) => liveAtRender.includes(e.id))?.id ?? null;

  return (
    <div className="space-y-12 pb-24 sm:space-y-16 lg:pb-12">
      {/* Accès refusé par le middleware (8.2 j) : rien sans clé connue */}
      <Suspense fallback={null}>
        <AccessNotice />
        {/* Design 1b (run 376) : un seul îlot pour les transitions des cartes, un seul pour leurs badges « En cours » */}
        <CardTransitions />
        <CardLiveBadges />
        {/* Design 1d (point 8) : un seul îlot pour les cœurs des favoris */}
        <CardFavorites />
      </Suspense>

      {/* 1. Accroche et recherche */}
      <section aria-labelledby="accueil-titre" className="pt-2 sm:pt-6">
        <h1 id="accueil-titre" className="max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
          Vos prochaines sorties au Sénégal
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Concerts, festivals, soirées et rencontres&nbsp;: choisissez votre place, payez avec Wave ou Orange Money et présentez
          votre billet à l’entrée.
        </p>
        <Form action="/explore" role="search" className="mt-5 flex max-w-xl gap-2">
          <label htmlFor="accueil-recherche" className="sr-only">Rechercher un événement</label>
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="accueil-recherche"
              name="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              maxLength={120}
              placeholder="Artiste, lieu, organisateur…"
              className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-3 text-base text-foreground-strong placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
          <button type="submit" className={buttonClasses({ variant: 'primary', size: 'lg', className: 'min-h-12 flex-shrink-0' })}>
            Rechercher
          </button>
        </Form>
        <nav aria-label="Raccourcis" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {SHORTCUTS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className={CHIP}>{s.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {!data ? (
        <EmptyState illustrated
          icon={<Ticket size={28} />}
          title="Impossible d’afficher les événements"
          description="La liste n’a pas pu être chargée. Vérifiez votre connexion, puis réessayez."
          actionLabel="Réessayer"
          actionHref="/"
        />
      ) : (
        <>
          {/* 2. En ce moment : rendu par le serveur, affiné sur le téléphone à la bonne minute */}
          {live.length > 0 && (
            <LiveNowSection items={live.map((e) => ({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt }))} liveAtRender={liveAtRender} labelledBy="en-ce-moment-titre">
              <SectionHead id="en-ce-moment-titre" title="En ce moment" hint="Ces événements ont déjà commencé." />
              <ul className={ROW}>
                {live.map((e) => (
                  <LiveNowItem key={e.id} id={e.id} className={ROW_ITEM}>
                    <EventCard {...cardProps(e)} sizes={ROW_SIZES} priority={e.id === firstLiveId} />
                  </LiveNowItem>
                ))}
              </ul>
            </LiveNowSection>
          )}

          {/* 3. À la une (temps réel : indicateur « En direct ») */}
          {data.featured.events.length > 0 ? (
            <section aria-labelledby="une-titre" className="space-y-4">
              <SectionHead
                id="une-titre"
                title={FEATURED_HEAD[data.featured.source].title}
                hint={FEATURED_HEAD[data.featured.source].hint}
                href="/explore"
                linkLabel="Tout voir"
                aside={<HomeLive />}
              />
              <FeaturedRow events={data.featured.events} priorityFirst={firstLiveId === null} />
            </section>
          ) : (
            <section aria-labelledby="une-titre" className="space-y-4">
              <SectionHead id="une-titre" title="À l’affiche" aside={<HomeLive />} />
              <EmptyState illustrated
                icon={<Ticket size={28} />}
                title="Aucun événement à l’affiche pour le moment"
                description="Les prochains événements apparaîtront ici dès leur publication."
                className="my-0"
              />
            </section>
          )}

          {/* 4. Cette semaine */}
          {data.sections.week.total > 0 && (
            <section aria-labelledby="semaine-titre" className="ev-offscreen space-y-4">
              <SectionHead
                id="semaine-titre"
                title="Cette semaine"
                hint="Aujourd’hui et les six prochains jours."
                href={exploreHref({ quand: 'semaine' })}
                linkLabel={`Tout voir (${data.sections.week.total})`}
              />
              <CardRow events={data.sections.week.events} />
            </section>
          )}

          {/* 5. Gratuits */}
          {data.sections.free.total > 0 && (
            <section aria-labelledby="gratuits-titre" className="ev-offscreen space-y-4">
              <SectionHead
                id="gratuits-titre"
                title="Gratuits"
                hint="Des événements avec une entrée gratuite."
                href={exploreHref({ gratuit: true })}
                linkLabel={`Tout voir (${data.sections.free.total})`}
              />
              <CardRow events={data.sections.free.events} />
            </section>
          )}

          {/* 6. Par catégorie */}
          {data.sections.byCategory.length > 0 && (
            <section aria-labelledby="categories-titre" className="ev-offscreen space-y-6">
              <div className="space-y-3">
                <h2 id="categories-titre" className="text-xl font-bold tracking-tight text-foreground-strong sm:text-2xl">Par catégorie</h2>
                <ul className="flex flex-wrap gap-2">
                  {data.sections.byCategory.map((c) => (
                    <li key={c.id}>
                      <Link href={exploreHref({ categorie: c.id })} prefetch={false} className={CHIP}>
                        {c.label}
                        <span className="ml-1.5 tabular-nums text-muted-foreground">{c.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {data.sections.byCategory.map((c) => (
                <div key={c.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <h3 className="text-lg font-bold text-foreground-strong">{c.label}</h3>
                    <Link
                      href={exploreHref({ categorie: c.id })}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-text hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={`Tout voir : ${c.label}`}
                    >
                      Tout voir
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <CardRow events={c.events} />
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {/* 7. Près de chez vous : îlot client (ville du profil ou de l'appareil, jamais dans le HTML en cache) */}
      <HomeNearby cities={data?.cities ?? []} />

      {/* 8. Comment ça marche */}
      <section aria-labelledby="fonctionnement-titre" className="ev-offscreen space-y-4">
        <h2 id="fonctionnement-titre" className="text-xl font-bold tracking-tight text-foreground-strong sm:text-2xl">Comment ça marche</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map((item) => (
            <li key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                <item.icon size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground-strong">{item.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 9. Parrainage : taux réels de referral_config, bloc absent sans ligne active */}
      {data?.referral && (
        <section aria-labelledby="parrainage-titre" className="ev-offscreen flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
              <Gift size={20} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <h2 id="parrainage-titre" className="text-xl font-bold tracking-tight text-foreground-strong">Parrainez vos proches</h2>
              <p className="max-w-2xl text-base leading-relaxed text-foreground">
                Partagez votre lien de parrainage : vous recevez <strong className="tabular-nums text-foreground-strong">{rate(data.referral.rateN1)}</strong> de
                la part d’Event Village sur les achats en ligne de vos filleuls pendant{' '}
                <strong className="tabular-nums text-foreground-strong">{data.referral.months} mois</strong>
                {data.referral.rateN2 > 0 && (
                  <>, et <strong className="tabular-nums text-foreground-strong">{rate(data.referral.rateN2)}</strong> sur ceux des personnes qu’ils parrainent</>
                )}
                .
              </p>
            </div>
          </div>
          <LinkButton href="/wallet" variant="secondary" rightIcon={<ArrowRight size={16} />} className="flex-shrink-0">
            Obtenir mon lien
          </LinkButton>
        </section>
      )}

      {/* 10. Organisateurs et salles : le seul grand bouton en dégradé de la page */}
      <section aria-labelledby="organisateurs-titre" className={cn('ev-offscreen grid gap-5', data?.hallsEnabled && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
        <div className="rounded-xl bg-muted p-6 sm:p-10">
          <p className="text-sm font-semibold text-primary-text">Espace organisateur</p>
          <h2 id="organisateurs-titre" className="mt-2 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-foreground-strong sm:text-3xl">
            Vous organisez des événements ? Vendez vos billets avec Event Village.
          </h2>
          <ul className="mt-5 space-y-3">
            {ORGANIZER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base text-foreground">
                <BadgeCheck size={20} className="mt-0.5 flex-shrink-0 text-success-text" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <LinkButton href="/partner/register" variant="gradient" rightIcon={<ArrowRight size={20} />}>
              Devenir partenaire
            </LinkButton>
          </div>
        </div>

        {data?.hallsEnabled && (
          <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6 sm:p-8">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                <Building2 size={20} />
              </span>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground-strong">Une salle pour votre réception ?</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne.
              </p>
            </div>
            <LinkButton href="/halls" variant="secondary" rightIcon={<ArrowRight size={16} />}>
              Voir les salles
            </LinkButton>
          </div>
        )}
      </section>

      {/* 11. Pied de page */}
      <footer className="border-t border-border pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="text-base font-bold text-foreground-strong">Event Village</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {data?.hallsEnabled ? 'Billetterie, salles et événements au Sénégal.' : 'Billetterie et événements au Sénégal.'}
            </p>
          </div>
          <nav aria-label="Liens du pied de page">
            <ul className="flex flex-wrap gap-x-2 gap-y-1">
              {[
                { label: 'Explorer', href: '/explore' },
                { label: 'Mes billets', href: '/tickets' },
                ...(data?.hallsEnabled ? [{ label: 'Salles', href: '/halls' }] : []),
                { label: 'Devenir partenaire', href: '/partner/register' },
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
        <p className="mt-6 text-sm text-muted-foreground">
          Event Village, {year}. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
}
