'use client';

/**
 * Mes commandes et réservations (lot 7, 7.3, E4 ; D5, D55).
 *  - Données : GET /api/orders. Le compte vient de la session (plus de ?userId=, faille IDOR corrigée côté
 *    serveur) ; la route ne lit que les services ouverts.
 *  - Onglets selon les interrupteurs (useFeatureFlags) : « Tables », « Salles », « Repas » n'apparaissent que
 *    si leur service est ouvert ; la page entière répond 404 quand les trois sont fermés (app/orders/layout.tsx).
 *  - Erreur de chargement : état d'erreur avec « Réessayer » (plus de « Aucune commande trouvée » trompeur).
 *  - Statuts par leurs libellés français, jamais l'enum ; système de design (tokens, 14 px au moins).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, ChevronRight, CreditCard, LogIn, ShoppingBag, Utensils } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabPanel, type TabItem } from '@/components/ui/Tabs';
import { useAuth } from '@/components/providers/AuthProvider';
import { useFeatureFlags, type ClientFeatureFlags } from '@/lib/features/client';
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
  detailsUrl: string;
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

/** Statuts des commandes et des réservations (order_status_enum, reservation_status) en mots. */
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

function statusMeta(status: string): { label: string; variant: BadgeVariant } {
  return STATUS_META[status] ?? { label: 'Statut à vérifier', variant: 'neutral' };
}

function readOrders(body: unknown): OrderRow[] | null {
  if (!isRecord(body) || !Array.isArray(body.orders)) return null;
  return body.orders.flatMap((raw: unknown) => {
    if (!isRecord(raw)) return [];
    const id = nonEmptyString(raw.id);
    const type = raw.type;
    if (!id || (type !== 'TABLE_RESERVATION' && type !== 'HALL_RESERVATION' && type !== 'FOOD_ORDER')) return [];
    const detailsUrl = nonEmptyString(raw.detailsUrl);
    return [{
      id,
      orderNumber: nonEmptyString(raw.orderNumber) ?? '',
      type,
      title: nonEmptyString(raw.title) ?? 'Commande',
      totalAmountFormatted: nonEmptyString(raw.totalAmountFormatted) ?? '—',
      status: nonEmptyString(raw.status) ?? '',
      paymentMethod: nonEmptyString(raw.paymentMethod) ?? '',
      dateFormatted: nonEmptyString(raw.dateFormatted) ?? '',
      detailsUrl: detailsUrl && detailsUrl.startsWith('/') && !detailsUrl.startsWith('//') ? detailsUrl : '/orders',
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

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Mes commandes et réservations"
        description="Vos réservations de tables et de salles, et vos commandes de repas. Vos billets sont dans Mes billets."
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
          <ul className="space-y-4">
            {visible.map((order) => {
              const Icon = KIND_ICON[order.type];
              const meta = statusMeta(order.status);
              return (
                <li
                  key={order.id}
                  className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-5 transition-colors hover:border-border-strong sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {order.orderNumber && <span className="font-mono text-sm font-semibold text-fg-muted">{order.orderNumber}</span>}
                        <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                      </div>
                      <h2 className="break-words text-base font-semibold text-fg">{order.title}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                        {order.dateFormatted && (
                          <span className="flex items-center gap-1">
                            <Calendar size={16} aria-hidden="true" />
                            <span>{order.dateFormatted}</span>
                          </span>
                        )}
                        {order.paymentMethod && (
                          <span className="flex items-center gap-1">
                            <CreditCard size={16} aria-hidden="true" />
                            <span>{order.paymentMethod}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <span className="text-lg font-bold tabular-nums text-fg">{order.totalAmountFormatted}</span>
                    <LinkButton href={order.detailsUrl} variant="secondary" size="sm" rightIcon={<ChevronRight size={16} />}>
                      Consulter
                    </LinkButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={activeTab === 'ALL' ? 'Aucune commande pour le moment' : 'Aucune commande dans cette catégorie'}
            description="Vos réservations et commandes apparaîtront ici dès qu’elles seront enregistrées."
            actionLabel="Découvrir les événements"
            actionHref="/explore"
          />
        )}
      </PanelFrame>
    </div>
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
