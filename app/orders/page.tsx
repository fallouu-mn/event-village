'use client';

/**
 * Mes commandes et réservations (lot 7, 7.3, E4 ; D5, D55 ; lot 12b).
 *  - Données : GET /api/orders. Le compte vient de la session (plus de ?userId=, faille IDOR corrigée côté
 *    serveur) ; la route ne lit que les services ouverts.
 *  - Onglets selon les interrupteurs (useFeatureFlags) : « Tables », « Salles », « Repas » n'apparaissent que
 *    si leur service est ouvert ; la page entière répond 404 quand les trois sont fermés (app/orders/layout.tsx).
 *  - Erreur de chargement : état d'erreur avec « Réessayer » (plus de « Aucune commande trouvée » trompeur).
 *  - Lot 12b : commandes de repas sur leur état détaillé (libellé et groupe servis par la route) : « En cours »,
 *    « Terminées », « Non payées à temps » rangées à part (repliées) ; lien vers le suivi /orders/<id> ;
 *    « Commander à nouveau » sur une commande terminée (ajout du 26/11) : la carte de l'établissement rouvre le panier
 *    avec les mêmes plats encore disponibles, devis relu par le serveur. Salles et tables : affichage inchangé.
 *  - Statuts par leurs libellés français, jamais l'enum ; système de design (jetons, 14 px au moins).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, ChevronDown, ChevronRight, Clock, CreditCard, LogIn, RotateCcw, ShoppingBag, Utensils } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabPanel, type TabItem } from '@/components/ui/Tabs';
import { useAuth } from '@/components/providers/AuthProvider';
import { useFeatureFlags, type ClientFeatureFlags } from '@/lib/features/client';
import { formatFcfa, formatTime } from '@/lib/format';
import { etaLabel, stateTone, type OrderListGroup } from '@/lib/orders/client-view';
import { isRecord, nonEmptyString, readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';

type OrderKind = 'TABLE_RESERVATION' | 'HALL_RESERVATION' | 'FOOD_ORDER';
type TabId = 'ALL' | OrderKind;

interface OrderRow {
  id: string;
  orderNumber: string;
  type: OrderKind;
  title: string;
  totalAmountFormatted: string;
  status: string;
  paymentMethod: string;
  dateFormatted: string;
  detailsUrl: string | null;
  /** Lot 12b (repas) : libellé de l'état servi par la route, groupe, établissement, reste à payer, fin du délai de paiement. */
  statusLabel: string | null;
  group: OrderListGroup | null;
  venueId: string | null;
  balanceDue: number;
  holdExpiresAt: string | null;
  /** Correctifs après contre-vérification (idée 10) : mode et heure estimée servis par la base, rappelés ici. */
  mode: string | null;
  estimatedAt: string | null;
}

const KIND_TABS: Array<{ id: OrderKind; label: string; feature: keyof ClientFeatureFlags }> = [
  { id: 'TABLE_RESERVATION', label: 'Tables', feature: 'tables' },
  { id: 'HALL_RESERVATION', label: 'Salles', feature: 'halls' },
  { id: 'FOOD_ORDER', label: 'Repas', feature: 'orders' },
];

const KIND_ICON: Record<OrderKind, React.ElementType> = {
  TABLE_RESERVATION: Utensils,
  HALL_RESERVATION: Building2,
  FOOD_ORDER: ShoppingBag,
};

/** Statuts des réservations (reservation_status) en mots. */
const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  EN_PREPARATION: { label: 'En préparation', variant: 'info' },
  PRETE: { label: 'Prête', variant: 'info' },
  EN_LIVRAISON: { label: 'En livraison', variant: 'info' },
  LIVREE: { label: 'Livrée', variant: 'success' },
  TERMINEE: { label: 'Terminée', variant: 'neutral' },
  ANNULEE: { label: 'Annulée', variant: 'danger' },
  REJETEE: { label: 'Refusée', variant: 'danger' },
};

/** Libellé et ton d'une ligne : une commande de repas porte son libellé (état détaillé), une réservation son statut. */
function statusMeta(order: OrderRow): { label: string; variant: BadgeVariant } {
  if (order.type === 'FOOD_ORDER' && order.statusLabel) return { label: order.statusLabel, variant: stateTone(order.status) };
  return STATUS_META[order.status] ?? { label: 'Statut à vérifier', variant: 'neutral' };
}

const GROUPS: readonly OrderListGroup[] = ['EN_COURS', 'TERMINEE', 'NON_PAYEE'];

function readOrders(body: unknown): OrderRow[] | null {
  if (!isRecord(body) || !Array.isArray(body.orders)) return null;
  return body.orders.flatMap((raw: unknown) => {
    if (!isRecord(raw)) return [];
    const id = nonEmptyString(raw.id);
    const type = raw.type;
    if (!id || (type !== 'TABLE_RESERVATION' && type !== 'HALL_RESERVATION' && type !== 'FOOD_ORDER')) return [];
    const detailsUrl = nonEmptyString(raw.detailsUrl);
    const group = GROUPS.includes(raw.group as OrderListGroup) ? (raw.group as OrderListGroup) : null;
    const balance = Number(raw.balanceDue);
    return [{
      id,
      orderNumber: nonEmptyString(raw.orderNumber) ?? '',
      type,
      title: nonEmptyString(raw.title) ?? 'Commande',
      totalAmountFormatted: nonEmptyString(raw.totalAmountFormatted) ?? '—',
      status: nonEmptyString(raw.status) ?? '',
      paymentMethod: nonEmptyString(raw.paymentMethod) ?? '',
      dateFormatted: nonEmptyString(raw.dateFormatted) ?? '',
      detailsUrl: detailsUrl && detailsUrl.startsWith('/') && !detailsUrl.startsWith('//') ? detailsUrl : null,
      statusLabel: nonEmptyString(raw.statusLabel),
      group,
      venueId: nonEmptyString(raw.venueId),
      balanceDue: Number.isFinite(balance) ? balance : 0,
      holdExpiresAt: nonEmptyString(raw.holdExpiresAt),
      mode: nonEmptyString(raw.mode),
      estimatedAt: nonEmptyString(raw.estimatedAt) ?? nonEmptyString(raw.scheduledFor),
    }];
  });
}

const ID_PREFIX = 'commandes';

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const flags = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<TabId>('ALL');
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      const body = await readJsonBody(res, 'commandes');
      if (!res.ok) {
        console.error(`[commandes] chargement refusé (HTTP ${res.status}) :`, body);
        setLoadError(serverErrorMessage(body) ?? `Vos commandes n’ont pas pu être chargées (erreur ${res.status}).`);
        return;
      }
      const rows = readOrders(body);
      if (!rows) {
        console.error('[commandes] réponse inattendue :', body);
        setLoadError('Réponse inattendue du serveur : vos commandes n’ont pas pu être affichées.');
        return;
      }
      setOrders(rows);
      setLoadError(null);
    } catch (err) {
      console.error('[commandes] chargement impossible :', err instanceof Error ? err.message : String(err));
      setLoadError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user?.id) {
      // Compte perdu (déconnexion dans un autre onglet) : plus rien du compte à l'écran
      setOrders(null);
      setIsLoading(false);
      return;
    }
    void loadOrders();
  }, [user?.id, isAuthLoading, loadOrders]);

  // Onglets des seuls services ouverts (D55) ; « Toutes » d'abord, avec le nombre de lignes.
  const tabs: TabItem[] = useMemo(() => {
    const open = KIND_TABS.filter((t) => flags?.[t.feature] === true);
    const count = (kind: OrderKind | null) => (orders ? orders.filter((o) => kind === null || o.type === kind).length : undefined);
    return [
      { id: 'ALL', label: 'Toutes', count: count(null) },
      ...open.map((t) => ({ id: t.id, label: t.label, count: count(t.id) })),
    ];
  }, [flags, orders]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab('ALL');
  }, [tabs, activeTab]);

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<LogIn size={28} />}
          title="Connectez-vous pour voir vos commandes"
          description="Vos réservations de tables et de salles et vos commandes de repas sont liées à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Forders"
        />
      </div>
    );
  }

  const visible = (orders ?? []).filter((o) => activeTab === 'ALL' || o.type === activeTab);
  const current = visible.filter((o) => o.group === 'EN_COURS');
  const reservations = visible.filter((o) => o.group === null);
  const done = visible.filter((o) => o.group === 'TERMINEE');
  const unpaid = visible.filter((o) => o.group === 'NON_PAYEE');
  const shown = current.length + reservations.length + done.length;

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Mes commandes et réservations"
        description="Vos commandes de repas et vos réservations de tables et de salles. Vos billets sont dans Mes billets."
        actions={(
          <LinkButton href="/tickets" variant="secondary" size="sm">
            Mes billets
          </LinkButton>
        )}
      />

      {tabs.length > 1 && (
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          ariaLabel="Type de commande"
          idPrefix={ID_PREFIX}
        />
      )}

      <PanelFrame withTabs={tabs.length > 1} tabIdValue={activeTab}>
        {isLoading || isAuthLoading ? (
          <div className="space-y-4" role="status" aria-busy="true">
            <span className="sr-only">Chargement de vos commandes…</span>
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        ) : loadError ? (
          <ErrorState
            title="Commandes indisponibles"
            description={loadError}
            onRetry={() => void loadOrders()}
            isRetrying={isLoading}
          />
        ) : visible.length > 0 ? (
          <div className="space-y-8">
            {current.length > 0 && <OrderSection title="En cours" rows={current} />}
            {reservations.length > 0 && <OrderSection title={current.length > 0 || done.length > 0 ? 'Réservations' : null} rows={reservations} />}
            {done.length > 0 && <OrderSection title="Terminées" rows={done} />}
            {unpaid.length > 0 && (
              <details className="group rounded-3xl border border-border bg-card" open={shown === 0}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-5 py-3 text-base font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span>{`Non payées à temps (${unpaid.length})`}</span>
                  <ChevronDown size={18} className="text-muted-foreground transition-transform duration-fast group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-3 px-3 pb-3 sm:px-5 sm:pb-5">
                  <p className="text-sm text-muted-foreground">Ces commandes n’ont pas été payées dans le délai : rien n’a été débité et les plats ont été remis en vente.</p>
                  <OrderList rows={unpaid} />
                </div>
              </details>
            )}
          </div>
        ) : (
          <EmptyState
            illustrated
            title={activeTab === 'ALL' ? 'Aucune commande pour l’instant' : 'Aucune commande dans cette catégorie'}
            description="Commandez dans un restaurant ou une boutique : vos commandes et réservations apparaîtront ici."
            actionLabel={flags?.tables ? 'Voir les restaurants' : 'Découvrir les événements'}
            actionHref={flags?.tables ? '/tables' : '/explore'}
          />
        )}
      </PanelFrame>
    </div>
  );
}

function OrderSection({ title, rows }: { title: string | null; rows: OrderRow[] }) {
  return (
    <section className="space-y-3" aria-label={title ?? 'Réservations'}>
      {title && <h2 className="text-lg font-bold text-foreground-strong">{title}</h2>}
      <OrderList rows={rows} />
    </section>
  );
}

function OrderList({ rows }: { rows: OrderRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((order) => {
        const Icon = KIND_ICON[order.type];
        const meta = statusMeta(order);
        const food = order.type === 'FOOD_ORDER';
        const reorder = food && order.group === 'TERMINEE' && order.venueId;
        // Heure estimée par la base (« Prête vers 13 h 05 ») : commande en cours et déjà envoyée au restaurant
        const eta = food && order.group === 'EN_COURS' && !order.holdExpiresAt ? etaLabel(order.mode, order.estimatedAt, new Date().toISOString().slice(0, 10)) : null;
        return (
          <li
            key={order.id}
            className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-input sm:flex-row sm:items-center"
            data-commande={order.id}
          >
            <div className="flex min-w-0 items-start gap-4">
              <span className="mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {order.orderNumber && <span className="font-mono text-sm font-semibold text-muted-foreground">{order.orderNumber}</span>}
                  <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                </div>
                <h3 className="break-words text-base font-semibold text-foreground-strong">{order.title}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {order.dateFormatted && (
                    <span className="flex items-center gap-1">
                      <Calendar size={16} aria-hidden="true" />
                      <span>{order.dateFormatted}</span>
                    </span>
                  )}
                  {!food && order.paymentMethod && (
                    <span className="flex items-center gap-1">
                      <CreditCard size={16} aria-hidden="true" />
                      <span>{order.paymentMethod}</span>
                    </span>
                  )}
                  {food && order.holdExpiresAt && (
                    <span className="flex items-center gap-1 font-semibold text-warning-text">
                      <Clock size={16} aria-hidden="true" />
                      <span className="tabular-nums">{`À payer avant ${formatTime(order.holdExpiresAt)}`}</span>
                    </span>
                  )}
                  {eta && (
                    <span className="flex items-center gap-1 font-semibold text-foreground" data-testid="heure-estimee-liste">
                      <Clock size={16} aria-hidden="true" />
                      <span className="tabular-nums">{eta}</span>
                    </span>
                  )}
                  {food && order.group === 'EN_COURS' && order.balanceDue > 0 && !order.holdExpiresAt && (
                    <span className="tabular-nums">{`Reste à payer : ${formatFcfa(order.balanceDue)}`}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:flex-nowrap sm:items-end sm:border-t-0 sm:pt-0">
              <span className="text-lg font-bold tabular-nums text-foreground-strong">{order.totalAmountFormatted}</span>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {reorder && (
                  <LinkButton href={`/restaurants/${order.venueId}/menu?reprendre=${order.id}`} variant="secondary" size="sm" leftIcon={<RotateCcw size={16} />}>
                    Commander à nouveau
                  </LinkButton>
                )}
                {order.detailsUrl && (
                  <LinkButton href={order.detailsUrl} variant={food && order.group === 'EN_COURS' ? 'primary' : 'secondary'} size="sm" rightIcon={<ChevronRight size={16} />}>
                    {food && order.group === 'EN_COURS' ? 'Suivre' : 'Consulter'}
                  </LinkButton>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Panneau relié à son onglet quand les onglets sont affichés ; simple bloc sinon (un seul service ouvert). */
function PanelFrame({ withTabs, tabIdValue, children }: { withTabs: boolean; tabIdValue: string; children: React.ReactNode }) {
  if (!withTabs) return <div>{children}</div>;
  return (
    <TabPanel idPrefix={ID_PREFIX} tabIdValue={tabIdValue}>
      {children}
    </TabPanel>
  );
}
