'use client';

/**
 * Lot 10b (point 4) : file de validation des salles de fête pour l'administration (droit halls.validate).
 *  - Onglets par statut (En attente de validation par défaut, Validées, Refusées, Suspendues) avec les nombres du
 *    serveur (`counts`) ; l'onglet courant est porté par `?status=` (lien direct vers la file).
 *  - Recherche dans le nom ou la ville (anti-rebond de 300 ms), pagination serveur (20 par page).
 *  - Chaque ligne ouvre la fiche de décision (/admin/halls/[id]).
 *  - Aucun chiffre calculé ici : salles, prix, nombres et total viennent de GET /api/admin/halls.
 *  - Lot 10b (correctifs, point 4) : onglet « En attente » : date exacte d'envoi (`submittedAt`, « Envoyée le … »,
 *    « Date d'envoi inconnue » si elle manque) ; la file est triée par elle (route).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, CalendarClock, ClipboardCheck, ImageOff, MapPin, Search, Store, Users } from 'lucide-react';
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
import { formatDateTime, formatFcfa, formatInteger, toDakarDateTimeLocal } from '@/lib/format';
import {
  DEFAULT_HALL_STATUS,
  HALL_ADMIN_STATUSES,
  HALL_STATUS_ADMIN_HINT,
  SUBMITTED_UNKNOWN,
  hallStatusLabel,
  isHallsResponse,
  readError,
  type AdminHallRow,
  type AdminHallsResponse,
  type HallAdminStatus,
} from '@/components/halls/admin/types';

const SEARCH_DEBOUNCE_MS = 300;
const ID_PREFIX = 'admin-salles';
const LOAD_ERROR = 'Impossible de charger les salles. Vérifiez votre connexion, puis réessayez.';

type Phase = 'loading' | 'ready' | 'error';

const LINK_CLASS = 'flex min-h-11 min-w-0 items-center break-words rounded font-semibold text-foreground-strong underline-offset-4 hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function hallName(h: AdminHallRow): string {
  return h.name?.trim() || 'Salle sans nom';
}

function capacityText(n: number | null): string {
  return n === null ? 'Non précisée' : `${formatInteger(n)} ${n > 1 ? 'personnes' : 'personne'}`;
}

/** Vignette de la salle (décorative : le nom suit). */
function Thumb({ h, className }: { h: AdminHallRow; className: string }) {
  if (!h.photo) {
    return (
      <span className={`flex flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ${className}`} aria-hidden="true">
        <ImageOff size={18} />
      </span>
    );
  }
  return (
    // Photos servies par le stockage du projet : pas d'optimiseur next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={h.photo} alt="" loading="lazy" decoding="async" className={`flex-shrink-0 rounded-lg bg-muted object-cover ${className}`} />
  );
}

function PartnerBadge({ validated }: { validated: boolean }) {
  return validated
    ? <Badge variant="success" size="sm">Compte validé</Badge>
    : <Badge variant="warning" size="sm">Compte non validé</Badge>;
}

function photoCountText(n: number): string {
  if (n <= 0) return 'Aucune photo';
  return n === 1 ? '1 photo' : `${n} photos`;
}

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des salles" className="flex flex-col gap-3">
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

export default function AdminHallsPage() {
  const [tab, setTab] = useTabParam<HallAdminStatus>(HALL_ADMIN_STATUSES, DEFAULT_HALL_STATUS, 'status');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminHallsResponse | null>(null);
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
      const res = await fetch(`/api/admin/halls?${params.toString()}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok || !isHallsResponse(body)) {
        setErrorMessage(readError(body) ?? LOAD_ERROR);
        setPhase('error');
        return;
      }
      setData(body);
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[admin/halls] chargement de la file en échec', err);
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
    if (!(HALL_ADMIN_STATUSES as readonly string[]).includes(next)) return;
    setTab(next as HallAdminStatus);
    setPage(1);
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setQuery('');
    setPage(1);
  };

  const tabs: TabItem[] = useMemo(() => HALL_ADMIN_STATUSES.map((s) => ({
    id: s,
    label: hallStatusLabel(s),
    count: data ? Number(data.counts[s] ?? 0) : undefined,
  })), [data]);

  const showReason = tab === 'REFUSEE' || tab === 'SUSPENDUE';
  const pendingTab = tab === DEFAULT_HALL_STATUS;
  const dateHeader = pendingTab ? 'Envoyée le' : 'Mise à jour le';
  /** Date montrée : envoi en validation (onglet « En attente »), sinon dernière mise à jour. */
  const dateOf = (h: AdminHallRow): string | null => (pendingTab ? h.submittedAt ?? null : h.updatedAt);
  const reasonHeader = tab === 'SUSPENDUE' ? 'Motif de la suspension' : 'Motif du refus';
  const hrefOf = (h: AdminHallRow): string => `/admin/halls/${h.id}`;

  const columns: DataColumn<AdminHallRow>[] = [
    {
      key: 'salle',
      header: 'Salle',
      render: (h) => (
        <div className="flex min-w-0 items-center gap-3">
          <Thumb h={h} className="h-12 w-16" />
          <div className="flex min-w-0 flex-col">
            <Link href={hrefOf(h)} className={LINK_CLASS}>{hallName(h)}</Link>
            <span className="text-sm text-muted-foreground">{[h.city, photoCountText(h.photoCount)].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'capacite',
      header: 'Capacité',
      align: 'right',
      render: (h) => <span className="whitespace-nowrap tabular-nums">{capacityText(h.capacity)}</span>,
    },
    {
      key: 'prix',
      header: 'Prix par jour',
      align: 'right',
      render: (h) => (
        <div className="flex flex-col items-end">
          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground-strong">{formatFcfa(h.pricePerDay)}</span>
          {h.pricePerHour !== null && (
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{`${formatFcfa(h.pricePerHour)} l’heure`}</span>
          )}
        </div>
      ),
    },
    {
      key: 'partenaire',
      header: 'Partenaire',
      render: (h) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="break-words">{h.partnerName ?? 'Partenaire inconnue'}</span>
          <PartnerBadge validated={h.partnerValidated} />
        </div>
      ),
    },
    {
      key: 'date',
      header: dateHeader,
      render: (h) => {
        const at = dateOf(h);
        if (at) return <time dateTime={toDakarDateTimeLocal(at)} className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatDateTime(at)}</time>;
        return <span className="text-sm text-muted-foreground">{pendingTab ? SUBMITTED_UNKNOWN : '—'}</span>;
      },
    },
    ...(showReason ? [{
      key: 'motif',
      header: reasonHeader,
      render: (h: AdminHallRow) => (
        <span className="line-clamp-3 max-w-xs break-words text-sm text-foreground-strong">{h.reason ?? 'Aucun motif enregistré.'}</span>
      ),
    }] : []),
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (h) => (
        <LinkButton href={hrefOf(h)} variant="secondary" size="sm" aria-label={`Examiner la salle ${hallName(h)}`}>
          Examiner
        </LinkButton>
      ),
    },
  ];

  const renderCard = (h: AdminHallRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Thumb h={h} className="h-16 w-20" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={hrefOf(h)} className={`${LINK_CLASS} text-base`}>{hallName(h)}</Link>
          <span className="text-sm text-muted-foreground">{photoCountText(h.photoCount)}</span>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {h.city && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 flex-shrink-0"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Ville</span></dt>
            <dd className="min-w-0 break-words">{h.city}</dd>
          </div>
        )}
        <div className="flex items-start gap-2">
          <dt className="mt-0.5 flex-shrink-0"><Users size={16} aria-hidden="true" /><span className="sr-only">Capacité</span></dt>
          <dd className="tabular-nums">{capacityText(h.capacity)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="flex-shrink-0">Prix par jour</dt>
          <dd className="font-semibold tabular-nums text-foreground-strong">
            {formatFcfa(h.pricePerDay)}
            {h.pricePerHour !== null && <span className="font-normal text-muted-foreground">{` · ${formatFcfa(h.pricePerHour)} l’heure`}</span>}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="mt-0.5 flex-shrink-0"><Building2 size={16} aria-hidden="true" /><span className="sr-only">Partenaire</span></dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-words font-medium text-foreground-strong">{h.partnerName ?? 'Partenaire inconnue'}</span>
            <PartnerBadge validated={h.partnerValidated} />
          </dd>
        </div>
        {(() => {
          const at = dateOf(h);
          if (!at && !pendingTab) return null;
          return (
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
          );
        })()}
        {showReason && (
          <div className="mt-1 flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2">
            <dt className="font-medium text-foreground-strong">{reasonHeader}</dt>
            <dd className="break-words text-foreground-strong">{h.reason ?? 'Aucun motif enregistré.'}</dd>
          </div>
        )}
      </dl>
      <LinkButton href={hrefOf(h)} variant="secondary" fullWidth>
        Examiner la salle
      </LinkButton>
    </div>
  );

  const emptyState = (() => {
    if (query) {
      return (
        <EmptyState
          icon={<Search size={28} />}
          title="Aucun résultat"
          description={`Aucune salle « ${hallStatusLabel(tab)} » ne contient « ${query} » dans son nom ou sa ville.`}
          actionLabel="Effacer la recherche"
          onAction={clearSearch}
        />
      );
    }
    if (tab === DEFAULT_HALL_STATUS) {
      return (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="Aucune salle à valider"
          description="Les salles envoyées par les partenaires apparaissent ici. Rien n’attend votre décision pour le moment."
        />
      );
    }
    return (
      <EmptyState
        icon={<Building2 size={28} />}
        title={`Aucune salle « ${hallStatusLabel(tab)} »`}
        description={HALL_STATUS_ADMIN_HINT[tab]}
      />
    );
  })();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Salles à valider"
        description="Examinez les salles de fête envoyées par les partenaires : validez-les pour les rendre réservables, refusez-les avec un motif, ou suspendez une salle déjà validée."
        actions={(
          // Lot 11b : file des établissements (tables), sans entrée dans le menu (coquille commune).
          <LinkButton href="/admin/venues" variant="ghost" size="sm" leftIcon={<Store size={18} />}>
            Établissements à valider
          </LinkButton>
        )}
      />

      <form
        role="search"
        aria-label="Rechercher une salle"
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
          placeholder="Nom de la salle ou ville"
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

      <ScrollableTabs tabs={tabs} value={tab} onChange={changeTab} ariaLabel="Statut des salles" idPrefix={ID_PREFIX} />

      <TabPanel idPrefix={ID_PREFIX} tabIdValue={tab} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{HALL_STATUS_ADMIN_HINT[tab]}</p>

        {phase === 'loading' && <ListSkeleton />}

        {phase === 'error' && (
          <ErrorState
            title="Salles indisponibles"
            description={errorMessage ?? LOAD_ERROR}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        )}

        {phase === 'ready' && data && (
          <>
            <DataList
              items={data.halls}
              columns={columns}
              getKey={(h) => h.id}
              breakpoint="xl"
              caption={`Salles : ${hallStatusLabel(tab)}`}
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
              ariaLabel="Pages des salles"
            />
          </>
        )}
      </TabPanel>
    </div>
  );
}
