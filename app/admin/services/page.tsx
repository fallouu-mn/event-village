'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, ShoppingBag, Ticket, Utensils } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFeatureFlags, type ClientFeatureFlags } from '@/lib/features/client';
import { formatFcfa, formatShortDate, toDakarDateTimeLocal } from '@/lib/format';

/**
 * Lot 5 (tâche 5.7) — supervision des catalogues (salles, tables, produits, commandes), en lecture.
 * La modération des événements n'est plus ici : elle passe par /admin/events et les transitions de la
 * machine à états (contrat D4). Cet écran n'écrit plus aucun statut.
 * Lot 8 (8.2 o, contrat 10.3, L59) : un service fermé par son interrupteur reste consultable ici et le dit en tête
 * du panneau. Tant que les interrupteurs ne sont pas lus (flags null, ou lecture en échec), rien n'est annoncé.
 */

const TAB_IDS = ['evenements', 'salles', 'tables', 'produits', 'commandes'] as const;
type TabId = (typeof TAB_IDS)[number];
type CatalogTab = Exclude<TabId, 'evenements'>;
const ID_PREFIX = 'admin-services';

const TABS: TabItem[] = [
  { id: 'evenements', label: 'Événements' },
  { id: 'salles', label: 'Salles de fête' },
  { id: 'tables', label: 'Restaurants et tables' },
  { id: 'produits', label: 'Produits et traiteurs' },
  { id: 'commandes', label: 'Commandes' },
];

/** Type demandé à GET /api/admin/services et clé de la réponse, par onglet. */
const API_TYPE: Record<CatalogTab, 'halls' | 'tables' | 'products' | 'orders'> = {
  salles: 'halls',
  tables: 'tables',
  produits: 'products',
  commandes: 'orders',
};

/** Interrupteur de chaque onglet (lib/features/client) : la vente de produits et les commandes partagent « orders ». */
const TAB_FLAG: Record<CatalogTab, keyof ClientFeatureFlags> = {
  salles: 'halls',
  tables: 'tables',
  produits: 'orders',
  commandes: 'orders',
};

interface CatalogRow {
  id: string;
  name: string;
  owner: string;
  detail: string;
  amount: string;
  state: { label: string; variant: BadgeVariant };
  createdAt: string | null;
}

const PRODUCT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  DISPONIBLE: { label: 'Disponible', variant: 'success' },
  INDISPONIBLE: { label: 'Indisponible', variant: 'neutral' },
  EPUISE: { label: 'Épuisé', variant: 'warning' },
  SUSPENDU: { label: 'Suspendu', variant: 'danger' },
};

const ORDER_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  CONFIRMEE: { label: 'Confirmée', variant: 'info' },
  EN_PREPARATION: { label: 'En préparation', variant: 'info' },
  PRETE: { label: 'Prête', variant: 'info' },
  EN_LIVRAISON: { label: 'En livraison', variant: 'info' },
  LIVREE: { label: 'Livrée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'danger' },
  REJETEE: { label: 'Rejetée', variant: 'danger' },
};

const UNKNOWN_STATE = { label: 'Statut inconnu', variant: 'neutral' as BadgeVariant };

type Raw = Record<string, unknown>;

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function companyOf(v: unknown): string | null {
  const one = Array.isArray(v) ? v[0] : v;
  return one && typeof one === 'object' ? text((one as Raw).company_name) : null;
}

function activeState(v: unknown): { label: string; variant: BadgeVariant } {
  return v === false ? { label: 'Inactif', variant: 'neutral' } : { label: 'Actif', variant: 'success' };
}

/** Ligne d'affichage d'un élément de catalogue (libellés, montants formatés ; aucun code brut). */
function toRow(tab: CatalogTab, item: Raw): CatalogRow {
  const id = String(item.id);
  const createdAt = text(item.created_at);
  switch (tab) {
    case 'salles': {
      const capacity = num(item.capacity);
      const perDay = num(item.price_per_day);
      return {
        id,
        name: text(item.name) ?? 'Salle sans nom',
        owner: companyOf(item.partners) ?? 'Organisateur inconnu',
        detail: capacity ? `${capacity} personnes` : 'Capacité non renseignée',
        amount: perDay !== null ? `${formatFcfa(perDay)} par jour` : 'Sur devis',
        state: activeState(item.is_active),
        createdAt,
      };
    }
    case 'tables': {
      const zone = item.restaurant_zones && typeof item.restaurant_zones === 'object' ? (item.restaurant_zones as Raw) : null;
      const capacity = num(item.capacity);
      return {
        id,
        name: `Table ${text(item.table_number) ?? '—'}`,
        owner: companyOf(zone?.partners) ?? 'Restaurant inconnu',
        detail: [text(zone?.name), capacity ? `${capacity} places` : null].filter(Boolean).join(' · ') || 'Zone non renseignée',
        amount: '—',
        state: activeState(item.is_active),
        createdAt,
      };
    }
    case 'produits': {
      const price = num(item.price);
      const category = item.product_categories && typeof item.product_categories === 'object' ? text((item.product_categories as Raw).name) : null;
      return {
        id,
        name: text(item.name) ?? 'Produit sans nom',
        owner: companyOf(item.partners) ?? 'Partenaire inconnu',
        detail: category ?? 'Sans catégorie',
        amount: price !== null ? formatFcfa(price) : '—',
        state: PRODUCT_STATUS[String(item.status)] ?? UNKNOWN_STATE,
        createdAt,
      };
    }
    case 'commandes': {
      const total = num(item.total_amount);
      const user = item.users && typeof item.users === 'object' ? (item.users as Raw) : null;
      const client = [text(user?.first_name), text(user?.last_name)].filter(Boolean).join(' ');
      return {
        id,
        name: `Commande ${text(item.order_number) ?? id.slice(0, 8)}`,
        owner: companyOf(item.partners) ?? 'Partenaire inconnu',
        detail: client ? `Client : ${client}` : 'Client non renseigné',
        amount: total !== null ? formatFcfa(total) : '—',
        state: ORDER_STATUS[String(item.order_status)] ?? UNKNOWN_STATE,
        createdAt,
      };
    }
    default:
      return { id, name: '—', owner: '—', detail: '—', amount: '—', state: UNKNOWN_STATE, createdAt };
  }
}

const COLUMNS: DataColumn<CatalogRow>[] = [
  { key: 'name', header: 'Élément', render: (r) => <span className="font-semibold text-fg">{r.name}</span>, hideOnCard: true },
  { key: 'owner', header: 'Partenaire', render: (r) => r.owner },
  { key: 'detail', header: 'Détail', render: (r) => <span className="text-fg-muted">{r.detail}</span> },
  { key: 'amount', header: 'Montant', align: 'right', render: (r) => <span className="whitespace-nowrap tabular-nums">{r.amount}</span> },
  { key: 'state', header: 'État', render: (r) => <Badge variant={r.state.variant} size="sm">{r.state.label}</Badge> },
  {
    key: 'created',
    header: 'Créé le',
    render: (r) => (r.createdAt
      ? <time dateTime={toDakarDateTimeLocal(r.createdAt)} className="whitespace-nowrap tabular-nums">{formatShortDate(r.createdAt)}</time>
      : '—'),
  },
];

const EMPTY_ICONS: Record<CatalogTab, React.ReactNode> = {
  salles: <Building2 size={28} />,
  tables: <Utensils size={28} />,
  produits: <ShoppingBag size={28} />,
  commandes: <Ticket size={28} />,
};

type Phase = 'loading' | 'ready' | 'error';

function CatalogPanel({ tab }: { tab: CatalogTab }) {
  const flags = useFeatureFlags();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setPhase('loading');
    setErrorMessage(null);
    const type = API_TYPE[tab];
    try {
      const res = await fetch(`/api/admin/services?type=${type}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (mine !== seq.current) return;
      const list = body && typeof body === 'object' ? (body as Raw)[type] : null;
      if (!res.ok || !Array.isArray(list)) {
        if (res.status === 403) throw new Error('Votre compte n’a pas l’autorisation de consulter ce catalogue.');
        throw new Error('Impossible de charger ce catalogue pour le moment.');
      }
      setRows((list as Raw[]).map((item) => toRow(tab, item)));
      setPhase('ready');
    } catch (err) {
      if (mine !== seq.current) return;
      console.error(`[admin/services] chargement « ${type} » en échec`, err);
      setErrorMessage(err instanceof Error && !/fetch|network/i.test(err.message) ? err.message : 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
      setPhase('error');
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const closedNotice = flags?.[TAB_FLAG[tab]] === false ? (
    <StatusBanner tone="neutral" title="Service désactivé">
      Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.
    </StatusBanner>
  ) : null;

  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        {closedNotice}
        <div role="status" aria-busy="true" aria-label="Chargement du catalogue" className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {closedNotice}
        <ErrorState
          title="Catalogue indisponible"
          description={errorMessage ?? undefined}
          onRetry={() => {
            setIsRetrying(true);
            void load().finally(() => setIsRetrying(false));
          }}
          isRetrying={isRetrying}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {closedNotice}
      <DataList
        items={rows}
        columns={COLUMNS}
        getKey={(r) => r.id}
        caption={TABS.find((t) => t.id === tab)?.label ?? 'Catalogue'}
        cardTitle={(r) => r.name}
        empty={<EmptyState icon={EMPTY_ICONS[tab]} title="Aucun élément" description="Aucun partenaire n’a encore rien enregistré dans ce catalogue." />}
      />
    </div>
  );
}

export default function AdminServicesPage() {
  const [tab, setTab] = useTabParam<TabId>(TAB_IDS, 'evenements');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: '/admin/dashboard', label: 'Tableau de bord' }}
        title="Catalogues et services"
        description="Vue d’ensemble, en lecture, des salles, tables, produits et commandes des partenaires."
      />

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(next) => {
          if ((TAB_IDS as readonly string[]).includes(next)) setTab(next as TabId);
        }}
        ariaLabel="Catalogues"
        idPrefix={ID_PREFIX}
      />

      <TabPanel idPrefix={ID_PREFIX} tabIdValue={tab}>
        {tab === 'evenements' ? (
          <StatusBanner
            tone="info"
            icon={<CalendarDays size={20} />}
            title="La modération des événements a son propre écran"
            action={(
              <LinkButton href="/admin/events" rightIcon={<ArrowRight size={16} />}>
                Ouvrir les événements
              </LinkButton>
            )}
          >
            File de validation, fiche complète, refus et suspension motivés, annulation avec remboursements : tout se fait
            depuis l’écran Événements.
          </StatusBanner>
        ) : (
          <CatalogPanel key={tab} tab={tab} />
        )}
      </TabPanel>
    </div>
  );
}
