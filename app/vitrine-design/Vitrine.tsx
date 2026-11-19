'use client';

import React, { useState } from 'react';
import { CalendarX2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { clusterLabel, mapMarkerHtml } from '@/components/ui/MapMarker';
import { EventCardSkeleton, ListRowSkeleton, StatCardSkeleton } from '@/components/ui/Skeleton';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { EventCard } from '@/components/events/EventCard';
import { CardTransitions } from '@/components/events/CardLink';
import { CardLiveBadges } from '@/components/events/CardLiveBadge';

/** Design 1a : vitrine des composants (données fictives), pour les captures en clair et en sombre. */
export function Vitrine() {
  const toast = useToast();
  const [tab, setTab] = useState('programme');
  const [chips, setChips] = useState<Record<string, boolean>>({ concerts: true, gratuit: false, semaine: false });
  const [confirm, setConfirm] = useState(false);

  const showToasts = (): void => {
    toast.success('Billet transféré à Awa Ndiaye.');
    toast.undoable('Événement retiré de vos favoris.', () => toast.info('Événement remis dans vos favoris.'));
    toast.error('Le chargement a échoué. Vérifiez votre connexion.', { onRetry: () => undefined });
  };

  return (
    <div className="space-y-10 pb-40">
      <CardTransitions />
      <CardLiveBadges />
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground-strong lg:text-4xl">Composants</h1>

      <section aria-labelledby="v-boutons" className="space-y-4">
        <h2 id="v-boutons" className="text-xl font-bold text-foreground-strong">Boutons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Enregistrer</Button>
          <Button variant="secondary">Retour</Button>
          <Button variant="outline">Voir le programme</Button>
          <Button variant="ghost">Plus tard</Button>
          <Button variant="danger">Rembourser 10 000 F CFA</Button>
        </div>
        <Button variant="gradient">Choisir mes billets</Button>
      </section>

      <section aria-labelledby="v-champs" className="grid gap-4 md:grid-cols-2">
        <h2 id="v-champs" className="text-xl font-bold text-foreground-strong md:col-span-2">Champs</h2>
        <TextInput label="Nom complet" hint="Tel qu’il figure sur votre pièce d’identité." defaultValue="Awa Ndiaye" />
        <TextInput label="Numéro de téléphone" required defaultValue="77 12" error="Saisissez les 9 chiffres de votre numéro." />
      </section>

      <section aria-labelledby="v-cartes" className="space-y-4">
        <h2 id="v-cartes" className="text-xl font-bold text-foreground-strong">Cartes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="space-y-2 p-5">
            <p className="text-sm font-semibold text-muted-foreground">Recettes en ligne nettes</p>
            <p className="text-2xl font-extrabold tabular-nums text-foreground-strong">245 000 F CFA</p>
          </Card>
          <EventCard
            id="00000000-0000-4000-8000-000000000001"
            title="Festival des lumières de Saint-Louis"
            dateFormatted="samedi 20 décembre"
            dayNumber="20"
            monthShort="déc."
            timeFormatted="20 h 00"
            venue="Place Faidherbe"
            city="Saint-Louis"
            categoryLabel="Concert"
            price={10000}
            stock="LOW"
          />
          <EventCardSkeleton />
        </div>
      </section>

      <section aria-labelledby="v-onglets" className="space-y-4">
        <h2 id="v-onglets" className="text-xl font-bold text-foreground-strong">Onglets, pastilles et filtres</h2>
        <Tabs
          ariaLabel="Sections de l’événement"
          idPrefix="vitrine"
          value={tab}
          onChange={setTab}
          tabs={[{ id: 'programme', label: 'Programme' }, { id: 'billets', label: 'Billets', count: 3 }, { id: 'lieu', label: 'Lieu' }]}
        />
        <TabPanel idPrefix="vitrine" tabIdValue={tab} className="text-sm text-muted-foreground">
          {tab === 'programme' ? 'Ouverture des portes à 19 h.' : tab === 'billets' ? 'Trois formules en vente.' : 'Place Faidherbe, Saint-Louis.'}
        </TabPanel>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Gratuit</Badge>
          <Badge variant="warning">Dernières places</Badge>
          <Badge variant="danger">Complet</Badge>
          <Badge variant="info">Nouveau</Badge>
          <Badge variant="neutral">Brouillon</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {[['concerts', 'Concerts'], ['gratuit', 'Gratuit'], ['semaine', 'Cette semaine']].map(([key, label]) => (
            <FilterChip key={key} pressed={chips[key]} onClick={() => setChips((c) => ({ ...c, [key]: !c[key] }))}>
              {label}
            </FilterChip>
          ))}
        </div>
      </section>

      <section aria-labelledby="v-retours" className="space-y-4">
        <h2 id="v-retours" className="text-xl font-bold text-foreground-strong">Retours et fenêtres</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={showToasts}>Montrer les toasts</Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>Ouvrir la confirmation</Button>
        </div>
        <ConfirmDialog
          isOpen={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
          title="Rembourser ce billet ?"
          message="L’acheteur reçoit 10 000 F CFA sur son compte Wave sous 48 heures."
          confirmLabel="Rembourser 10 000 F CFA"
          cancelLabel="Garder le billet"
          variant="danger"
        />
      </section>

      <section aria-labelledby="v-etats" className="grid gap-4 md:grid-cols-2">
        <h2 id="v-etats" className="text-xl font-bold text-foreground-strong md:col-span-2">Chargement et état vide</h2>
        <div className="space-y-4">
          <StatCardSkeleton />
          <div className="rounded-xl border border-border bg-card px-4">
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        </div>
        <EmptyState
          icon={<CalendarX2 size={28} />}
          title="Aucun événement cette semaine"
          description="Élargissez la recherche à tout le mois ou à une autre ville."
          actionLabel="Voir tout le mois"
          onAction={() => undefined}
        />
      </section>

      <section aria-labelledby="v-reperes" className="space-y-4">
        <h2 id="v-reperes" className="text-xl font-bold text-foreground-strong">Repères de la carte</h2>
        <div className="flex flex-wrap items-end gap-6 rounded-xl bg-muted p-6">
          <span role="img" aria-label="10 000 F" dangerouslySetInnerHTML={{ __html: mapMarkerHtml('prix', '10 000 F') }} />
          <span role="img" aria-label="Gratuit" dangerouslySetInnerHTML={{ __html: mapMarkerHtml('prix', 'Gratuit') }} />
          <span role="img" aria-label="Événement choisi, 5 000 F" dangerouslySetInnerHTML={{ __html: mapMarkerHtml('choisi', '5 000 F') }} />
          <span role="img" aria-label="À la une" dangerouslySetInnerHTML={{ __html: mapMarkerHtml('une', 'À la une') }} />
          <span role="img" aria-label={clusterLabel(3)} dangerouslySetInnerHTML={{ __html: mapMarkerHtml('pile', clusterLabel(3)) }} />
        </div>
      </section>

      <section aria-labelledby="v-feuille" className="space-y-4">
        <h2 id="v-feuille" className="text-xl font-bold text-foreground-strong">Feuille glissante</h2>
        <BottomSheet title="12 événements autour de vous" initial="moitie" preview>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search size={16} aria-hidden="true" />
            Liste des événements visibles sur la carte.
          </p>
        </BottomSheet>
      </section>
    </div>
  );
}
