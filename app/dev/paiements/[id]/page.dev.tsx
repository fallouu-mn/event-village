import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Button } from '@/components/ui/Button';
import { FakePaymentPanel, type FakePayment, type FakePaymentDecision, type FakePaymentOutcome } from '@/components/dev/FakePaymentPanel';
import { operatorLabel } from '@/lib/notifications/catalog';

/**
 * Lot 8 (8.1, contrats 3.13 et 5.3) — /dev/paiements/[id] : valider ou refuser un paiement simulé. Adresse donnée par le
 * faux service comme page de paiement, en mode A, sur le PC comme sur le téléphone.
 *
 * Fichier `.dev.tsx` : présent sous `next dev` seulement (premier verrou, next.config.mjs). Deuxième verrou : middleware.ts.
 * Troisième : le contrôle ci-dessous, repris dans l'action, qui est un point d'entrée public.
 * Lecture sur le faux service, à 127.0.0.1 ; décision par POST /api/dev/samirpay/<action>, seule voie vers le faux service.
 * Ce passage par le serveur évite tout appel réseau dans FakePaymentPanel (contrat 5.3) et tout fichier de plus.
 */
const DEFAULT_APP_PORT = 3000;
const DEFAULT_FAKE_PORT = 4010;
const READ_TIMEOUT_MS = 5_000;
// La route attend le webhook (30 s au plus), et sa première compilation sous next dev est lente.
const DECISION_TIMEOUT_MS = 60_000;

interface FakeTransaction {
  transactionId: string;
  kind: string;
  amount: number;
  operatorName: string;
  telephone: string;
  status: string;
  createdAt: string;
}

function devModeActive(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.EV_INTEGRATIONS === 'fake';
}

function localPort(raw: string | undefined, fallback: number): number | null {
  const port = raw ? Number(raw) : fallback;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

/** Paiements connus du faux service (ses 50 dernières opérations), ou null s'il ne répond pas. */
async function readFakePayments(): Promise<FakePayment[] | null> {
  const port = localPort(process.env.EV_DEV_FAKE_PORT, DEFAULT_FAKE_PORT);
  if (port === null) {
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
    return body.transactions.filter((t) => t.kind === 'CASHIN').map((t) => ({
      id: t.transactionId, amount: t.amount, operator: operatorLabel(t.operatorName), phone: t.telephone, status: t.status, createdAt: t.createdAt,
    }));
  } catch (err) {
    console.error('[dev/paiements] faux service injoignable :', err);
    return null;
  }
}

const UNAVAILABLE: FakePaymentOutcome = {
  tone: 'danger',
  title: 'Action impossible',
  detail: 'Le serveur de développement ne répond pas comme prévu. Regardez sa console, puis réessayez.',
};

const REFUSALS = new Map<string, FakePaymentOutcome>([
  ['INVALID_TRANSACTION', { tone: 'danger', title: 'Paiement simulé invalide', detail: 'Rouvrez ce paiement depuis la liste des paiements simulés.' }],
  ['TRANSACTION_NOT_FOUND', { tone: 'danger', title: 'Paiement simulé introuvable', detail: 'Le faux service ne le connaît pas. Recommencez l’achat.' }],
  ['TRANSACTION_ALREADY_DONE', { tone: 'warning', title: 'Paiement déjà traité', detail: 'Son état à jour est affiché dans ce panneau.' }],
  ['FAKE_SERVICE_DOWN', { tone: 'danger', title: 'Faux service injoignable', detail: 'Lancez npm run fake:samirpay, puis réessayez.' }],
  ['FAKE_PORT_INVALID', { tone: 'danger', title: 'Réglage invalide', detail: 'EV_DEV_FAKE_PORT doit être un numéro de port : corrigez .env.local, puis relancez le serveur.' }],
  ['FAKE_SERVICE_ERROR', { tone: 'danger', title: 'Application non prévenue', detail: 'Le faux service n’a pas pu joindre l’application. Regardez sa console, puis réessayez.', retry: true }],
]);

const DONE: Readonly<Record<FakePaymentDecision, FakePaymentOutcome>> = {
  validate: { tone: 'success', title: 'Paiement validé', detail: 'Le faux service a envoyé la confirmation à l’application. Sans billet après quelques secondes, regardez la console du serveur.', tickets: true },
  refuse: { tone: 'warning', title: 'Paiement refusé', detail: 'Aucun billet ne sera émis. L’application verra ce refus à sa prochaine vérification du paiement.' },
};

/** Décision de l'utilisateur. `id` et `decision` viennent du navigateur : la route contrôle le premier, la table le second. */
async function decidePayment(id: string, decision: FakePaymentDecision): Promise<FakePaymentOutcome> {
  'use server';
  if (!devModeActive()) notFound();
  if (decision !== 'validate' && decision !== 'refuse') return UNAVAILABLE;
  const port = localPort(process.env.EV_DEV_APP_PORT, DEFAULT_APP_PORT);
  if (port === null) {
    console.error('[dev/paiements] EV_DEV_APP_PORT invalide');
    return UNAVAILABLE;
  }
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/api/dev/samirpay/${decision}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionId: id }),
      cache: 'no-store',
      signal: AbortSignal.timeout(DECISION_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[dev/paiements] route ${decision} injoignable sur le port ${port} :`, err);
    return UNAVAILABLE;
  }
  revalidatePath('/dev/paiements', 'layout');
  if (res.ok) return DONE[decision];
  const body = (await res.json().catch((err: unknown) => {
    console.error(`[dev/paiements] réponse illisible de la route ${decision} (HTTP ${res.status}) :`, err);
    return null;
  })) as { code?: string } | null;
  return REFUSALS.get(body?.code ?? '') ?? UNAVAILABLE;
}

const Notice = () => <StatusBanner tone="warning" title="Paiement simulé : aucun argent réel" />;

export default async function FakePaymentPage({ params }: { params: { id: string } }) {
  if (!devModeActive()) notFound();
  const payments = await readFakePayments();
  const payment = payments?.find((p) => p.id === params.id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="Paiement simulé" back={{ href: '/dev/paiements', label: 'Retour aux paiements simulés' }} className="pb-0 sm:pb-0" />
      {payments === null && (
        <>
          <Notice />
          <StatusBanner
            tone="danger"
            title="Faux service injoignable"
            announce="alert"
            action={<form method="get"><Button type="submit" variant="secondary">Réessayer</Button></form>}
          >
            Lancez npm run fake:samirpay dans un autre terminal, puis réessayez.
          </StatusBanner>
        </>
      )}
      {payments !== null && !payment && (
        <>
          <Notice />
          <EmptyState
            title="Paiement simulé introuvable"
            description="Le faux service ne connaît pas ce paiement, ou il est trop ancien pour figurer dans ses 50 dernières opérations."
            actionLabel="Voir les paiements en attente"
            actionHref="/dev/paiements"
          />
        </>
      )}
      {payment && <FakePaymentPanel payment={payment} onDecide={decidePayment.bind(null, payment.id)} />}
    </div>
  );
}
