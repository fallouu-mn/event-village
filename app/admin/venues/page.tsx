'use client';

/**
 * Lot 11b (administration) : file de validation des établissements de la réservation de tables (restaurants, bars,
 * espaces), droit halls.validate. Même gabarit que la file des salles (app/admin/halls/page.tsx).
 *  - Onglets par statut (En attente de validation par défaut, Validé, Refusé, Suspendu) avec les nombres du serveur
 *    (`counts`) ; l'onglet courant est porté par `?status=` (lien direct vers la file).
 *  - Recherche dans le nom ou la ville (anti-rebond de 300 ms), pagination serveur (20 par page).
 *  - Lignes : photo, nom, genre, ville, partenaire, tables, « Envoyé le … » (onglet En attente) ; chaque ligne ouvre la
 *    fiche de décision (/admin/venues/[id]).
 *  - Lien retour vers la file des salles (le menu n'a pas d'entrée pour les établissements).
 *  - Aucun chiffre calculé ici : établissements, nombres et total viennent de GET /api/admin/venues.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, CalendarClock, ClipboardCheck, ImageOff, LayoutGrid, MapPin, Search, Store } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { Badge } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { Pagination } from '@/components/ui/Pagination';
import { TextInput } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, toDakarDateTimeLocal } from '@/lib/format';
import { readError } from '@/components/halls/admin/types';
import {
  DEFAULT_VENUE_STATUS,
  SUBMITTED_UNKNOWN,
  VENUE_ADMIN_STATUSES,
  VENUE_STATUS_ADMIN_HINT,
  isVenueAdminStatus,
  isVenuesResponse,
  photoCountText,
  tablesCountText,
  venueName,
  venueStatusLabel,
  type AdminVenueRow,
  type AdminVenuesResponse,
  type VenueAdminStatus,
} from '@/components/tables/admin/types';

const SEARCH_DEBOUNCE_MS = 300;
const ID_PREFIX = 'admin-etablissements';
const LOAD_ERROR = 'Impossible de charger les établissements. Vérifiez votre connexion, puis réessayez.';

type Phase = 'loading' | 'ready' | 'error';

const LINK_CLASS = 'flex min-h-11 min-w-0 items-center break-words rounded font-semibold text-foreground-strong underline-offset-4 hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Vignette de l'établissement (décorative : le nom suit). */
function Thumb({ v, className }: { v: AdminVenueRow; className: string }) {
  if (!v.photo) {
    return (
      <span className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ${className}`} aria-hidden="true">
        <ImageOff size={18} />
      </span>
    );
  }
  return (
    // Photos servies par le stockage du projet : pas d'optimiseur next/image (même choix que les salles).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={v.photo} alt="" loading="lazy" decoding="async" className={`flex-shrink-0 rounded-lg bg-muted object-cover ${className}`} />
  );
}

function PartnerBadge({ validated }: { validated: boolean }) {
  return validated
    ? <Badge variant="success" size="sm">Compte validé</Badge>
    : <Badge variant="warning" size="sm">Compte non validé</Badge>;
}

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des établissements" className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-12 w-16 flex-shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/4 max-w-sm" />
            <Skeleton className="h-4 w-1/2 max-w-xs" />
          </div>
          <Skeleton className="hidden h-7 w-28 sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function AdminVenuesPage() {
  const [tab, setTab] = useTabParam<VenueAdminStatus>(VENUE_ADMIN_STATUSES, DEFAULT_VENUE_STATUS, 'status');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminVenuesResponse | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestSeq = useRef(0);

  // Recherche : appliquée 300 ms après la dernière frappe (ou tout de suite à la validation du champ).
  useEffect(() => {
    const next = searchInput.trim();
    if (next === query) return undefined;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setPhase('loading');
    setErrorMessage(null);
    const params = new URLSearchParams({ status: tab, page: String(page) });
    if (query) params.set('q', query);
    try {
      const res = await fetch(`/api/admin/venues?${params.toString()}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok || !isVenuesResponse(body)) {
        setErrorMessage(readError(body) ?? LOAD_ERROR);
        setPhase('error');
        return;
      }
      setData(body);
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[admin/venues] chargement de la file en échec', err);
      setErrorMessage(LOAD_ERROR);
      setPhase('error');
    }
  }, [page, tab, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await load();
    } finally {
      setIsRetrying(false);
    }
  };

  const changeTab = (next: string): void => {
    if (!isVenueAdminStatus(next)) return;
    setTab(next);
    setPage(1);
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setQuery('');
    setPage(1);
  };

  const tabs: TabItem[] = useMemo(() => VENUE_ADMIN_STATUSES.map((s) => ({
    id: s,
    label: venueStatusLabel(s),
    count: data ? Number(data.counts[s] ?? 0) : undefined,
  })), [data]);

  const showReason = tab === 'REFUSEE' || tab === 'SUSPENDUE';
  const pendingTab = tab === DEFAULT_VENUE_STATUS;
  const dateHeader = pendingTab ? 'Envoyé le' : 'Mis à jour le';
  /** Date montrée : envoi en validation (onglet « En attente »), sinon dernière mise à jour. */
  const dateOf = (v: AdminVenueRow): string | null => (pendingTab ? v.submittedAt ?? null : v.updatedAt);
  const reasonHeader = tab === 'SUSPENDUE' ? 'Motif de la suspension' : 'Motif du refus';
  const hrefOf = (v: AdminVenueRow): string => `/admin/venues/${v.id}`;
  const subtitleOf = (v: AdminVenueRow): string => [v.kindLabel, v.city].filter(Boolean).join(' · ');

  const columns: DataColumn<AdminVenueRow>[] = [
    {
      key: 'etablissement',
      header: 'Établissement',
      render: (v) => (
        <div className="flex min-w-0 items-center gap-3">
          <Thumb v={v} className="h-12 w-16" />
          <div className="flex min-w-0 flex-col">
            <Link href={hrefOf(v)} className={LINK_CLASS}>{venueName(v.name)}</Link>
            <span className="text-sm text-muted-foreground">{subtitleOf(v) || photoCountText(v.photoCount)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'tables',
      header: 'Tables',
      align: 'right',
      render: (v) => <span className="whitespace-nowrap tabular-nums">{tablesCountText(v.tablesCount)}</span>,
    },
    {
      key: 'partenaire',
      header: 'Partenaire',
      render: (v) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="break-words">{v.partnerName ?? 'Partenaire inconnue'}</span>
          <PartnerBadge validated={v.partnerValidated} />
        </div>
      ),
    },
    {
      key: 'date',
      header: dateHeader,
      render: (v) => {
        const at = dateOf(v);
        if (at) return <time dateTime={toDakarDateTimeLocal(at)} className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatDateTime(at)}</time>;
        return <span className="text-sm text-muted-foreground">{pendingTab ? SUBMITTED_UNKNOWN : '—'}</span>;
      },
    },
    ...(showReason ? [{
      key: 'motif',
      header: reasonHeader,
      render: (v: AdminVenueRow) => (
        <span className="line-clamp-3 max-w-xs break-words text-sm text-foreground-strong">{v.reason ?? 'Aucun motif enregistré.'}</span>
      ),
    }] : []),
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (v) => (
        <LinkButton href={hrefOf(v)} variant="secondary" size="sm" aria-label={`Examiner l’établissement ${venueName(v.name)}`}>
          Examiner
        </LinkButton>
      ),
    },
  ];

  const renderCard = (v: AdminVenueRow) => {
    const at = dateOf(v);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Thumb v={v} className="h-16 w-20" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={hrefOf(v)} className={`${LINK_CLASS} text-base`}>{venueName(v.name)}</Link>
            <span className="text-sm text-muted-foreground">{[v.kindLabel, photoCountText(v.photoCount)].join(' · ')}</span>
          </div>
        </div>
        <dl className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {v.city && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 flex-shrink-0"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Ville</span></dt>
              <dd className="min-w-0 break-words">{v.city}</dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 flex-shrink-0"><LayoutGrid size={16} aria-hidden="true" /><span className="sr-only">Tables</span></dt>
            <dd className="tabular-nums">{tablesCountText(v.tablesCount)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 flex-shrink-0"><Building2 size={16} aria-hidden="true" /><span className="sr-only">Partenaire</span></dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="break-words font-medium text-foreground-strong">{v.partnerName ?? 'Partenaire inconnue'}</span>
              <PartnerBadge validated={v.partnerValidated} />
            </dd>
          </div>
          {(at || pendingTab) && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 flex-shrink-0"><CalendarClock size={16} aria-hidden="true" /><span className="sr-only">{dateHeader}</span></dt>
              <dd>
                {at ? (
                  <>
                    {`${dateHeader} `}
                    <time dateTime={toDakarDateTimeLocal(at)} className="tabular-nums">{formatDateTime(at)}</time>
                  </>
                ) : SUBMITTED_UNKNOWN}
              </dd>
            </div>
          )}
          {showReason && (
            <div className="mt-1 flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2">
              <dt className="font-medium text-foreground-strong">{reasonHeader}</dt>
              <dd className="break-words text-foreground-strong">{v.reason ?? 'Aucun motif enregistré.'}</dd>
            </div>
          )}
        </dl>
        <LinkButton href={hrefOf(v)} variant="secondary" fullWidth>
          Examiner l’établissement
        </LinkButton>
      </div>
    );
  };

  const emptyState = (() => {
    if (query) {
      return (
        <EmptyState
          icon={<Search size={28} />}
          title="Aucun résultat"
          description={`Aucun établissement « ${venueStatusLabel(tab)} » ne contient « ${query} » dans son nom ou sa ville. Vérifiez l’orthographe ou cherchez par ville.`}
          actionLabel="Effacer la recherche"
          onAction={clearSearch}
        />
      );
    }
    if (tab === DEFAULT_VENUE_STATUS) {
      return (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="Aucun établissement à valider"
          description="Les restaurants, bars et espaces envoyés par les partenaires apparaissent ici. Rien n’attend votre décision pour le moment."
        />
      );
    }
    return (
      <EmptyState
        icon={<Store size={28} />}
        title={`Aucun établissement « ${venueStatusLabel(tab)} »`}
        description={VENUE_STATUS_ADMIN_HINT[tab]}
      />
    );
  })();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Établissements à valider"
        description="Examinez les restaurants, bars et espaces envoyés par les partenaires pour la réservation de tables : validez-les pour les rendre réservables, refusez-les avec un motif, ou suspendez un établissement déjà validé."
        actions={(
          <LinkButton href="/admin/halls" variant="ghost" size="sm" leftIcon={<Building2 size={18} />}>
            Salles à valider
          </LinkButton>
        )}
      />

      <form
        role="search"
        aria-label="Rechercher un établissement"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(searchInput.trim());
          setPage(1);
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <TextInput
          type="search"
          label="Rechercher par nom ou ville"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Nom de l’établissement ou ville"
          autoComplete="off"
          maxLength={80}
          fieldClassName="flex-1 sm:max-w-md"
        />
        {searchInput && (
          <Button type="button" variant="ghost" onClick={clearSearch}>
            Effacer
          </Button>
        )}
      </form>

      <ScrollableTabs tabs={tabs} value={tab} onChange={changeTab} ariaLabel="Statut des établissements" idPrefix={ID_PREFIX} />

      <TabPanel idPrefix={ID_PREFIX} tabIdValue={tab} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{VENUE_STATUS_ADMIN_HINT[tab]}</p>

        {phase === 'loading' && <ListSkeleton />}

        {phase === 'error' && (
          <ErrorState
            title="Établissements indisponibles"
            description={errorMessage ?? LOAD_ERROR}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        )}

        {phase === 'ready' && data && (
          <>
            <DataList
              items={data.venues}
              columns={columns}
              getKey={(v) => v.id}
              breakpoint="xl"
              caption={`Établissements : ${venueStatusLabel(tab)}`}
              renderCard={renderCard}
              empty={emptyState}
            />
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0 });
              }}
              ariaLabel="Pages des établissements"
            />
          </>
        )}
      </TabPanel>
    </div>
  );
}
