import { notFound } from 'next/navigation';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatFcfa } from '@/lib/format';
import { operatorLabel } from '@/lib/notifications/catalog';

/**
 * Lot 8 (8.1, contrats 3.13 et 5.3) — /dev/paiements : paiements simulés en attente d'une décision.
 *
 * Fichier `.dev.tsx` : présent sous `next dev` seulement (premier verrou, next.config.mjs). Deuxième verrou : middleware.ts.
 * Troisième : le contrôle ci-dessous. Lecture sur le faux service, à 127.0.0.1 : le téléphone passe par cette page, jamais
 * par le faux service, qui n'écoute que le PC. Aucune session : le téléphone d'essai n'est pas forcément connecté.
 * L'actualisation est un vrai rechargement (GET du formulaire) : un lien vers la même adresse pourrait servir le cache du routeur.
 */
const DEFAULT_FAKE_PORT = 4010;
const READ_TIMEOUT_MS = 5_000;

interface PendingPayment {
  id: string;
  amount: number;
  operatorName: string;
  telephone: string;
  createdAt: string;
}

interface FakeTransaction extends Omit<PendingPayment, 'id'> {
  transactionId: string;
  kind: string;
  status: string;
}

/** Paiements en attente parmi les 50 dernières opérations du faux service, ou null s'il ne répond pas. */
async function readPendingPayments(): Promise<PendingPayment[] | null> {
  const raw = process.env.EV_DEV_FAKE_PORT;
  const port = raw ? Number(raw) : DEFAULT_FAKE_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[dev/paiements] EV_DEV_FAKE_PORT invalide');
    return null;
  }
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__test/samirpay/transactions`, { cache: 'no-store', signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`[dev/paiements] lecture refusée par le faux service : HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { transactions?: FakeTransaction[] };
    if (!Array.isArray(body.transactions)) {
      console.error('[dev/paiements] réponse du faux service sans liste de transactions');
      return null;
    }
    return body.transactions.filter((t) => t.kind === 'CASHIN' && t.status === 'PENDING').map((t) => ({
      id: t.transactionId, amount: t.amount, operatorName: t.operatorName, telephone: t.telephone, createdAt: t.createdAt,
    }));
  } catch (err) {
    console.error('[dev/paiements] faux service injoignable :', err);
    return null;
  }
}

const COLUMNS: DataColumn<PendingPayment>[] = [
  { key: 'amount', header: 'Montant', hideOnCard: true, render: (p) => <span className="font-semibold tabular-nums text-fg">{formatFcfa(p.amount)}</span> },
  { key: 'operator', header: 'Opérateur', render: (p) => operatorLabel(p.operatorName) },
  { key: 'phone', header: 'Téléphone', render: (p) => <span className="tabular-nums">{p.telephone}</span> },
  { key: 'created', header: 'Créé le', render: (p) => <time dateTime={p.createdAt} className="tabular-nums">{formatDateTime(p.createdAt)}</time> },
  {
    key: 'open',
    header: 'Action',
    align: 'right',
    render: (p) => (
      <LinkButton href={`/dev/paiements/${p.id}`} variant="secondary" rightIcon={<ChevronRight size={18} />} aria-label={`Ouvrir le paiement de ${formatFcfa(p.amount)}`}>
        Ouvrir
      </LinkButton>
    ),
  },
];

const Refresh = ({ label }: { label: string }) => (
  <form method="get">
    <Button type="submit" variant="secondary" leftIcon={<RefreshCw size={18} />}>{label}</Button>
  </form>
);

export default async function FakePaymentsPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.EV_INTEGRATIONS !== 'fake') notFound();
  const payments = await readPendingPayments();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title="Paiements simulés"
        description="Validez ou refusez ici les paiements créés pendant vos essais."
        actions={payments ? <Refresh label="Actualiser" /> : undefined}
        className="pb-0 sm:pb-0"
      />
      <StatusBanner tone="warning" title="Paiement simulé : aucun argent réel" />
      {payments === null ? (
        <StatusBanner tone="danger" title="Faux service injoignable" announce="alert" action={<Refresh label="Réessayer" />}>
          Lancez npm run fake:samirpay dans un autre terminal, puis réessayez.
        </StatusBanner>
      ) : (
        <DataList
          items={payments}
          columns={COLUMNS}
          getKey={(p) => p.id}
          caption="Paiements simulés en attente"
          cardTitle={(p) => <span className="tabular-nums">{formatFcfa(p.amount)}</span>}
          empty={<EmptyState title="Aucun paiement en attente" description="Lancez un achat payant : il apparaîtra ici après un clic sur Actualiser." />}
        />
      )}
    </div>
  );
}
