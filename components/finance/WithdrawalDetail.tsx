/**
 * Finition 5 (point 2) — page d'arrivée d'un avis de retrait (WITHDRAWAL_PAID, _REJECTED, _UNCERTAIN, _DELAYED) : le
 * retrait précis, lu par le serveur avec la session de la requête (GET /api/finance/withdrawals/<envoi>, appelée
 * directement, modèle d'app/tickets/page.tsx). Sans session : connexion puis retour ; retrait inconnu, d'un autre compte
 * ou d'un autre espace (portefeuille / finances pro) : même 404 « Cet élément n'est plus disponible ».
 * Composant serveur : statut, montants, opérateur et ce qu'il reste à faire ; jetons du système de design seulement.
 */
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { GET as readWithdrawal } from '@/app/api/finance/withdrawals/[id]/route';
import { RetryError } from '@/components/halls/client/RetryError';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime, formatFcfa } from '@/lib/format';
import { withdrawalAmountLine, withdrawalStatusView } from '@/lib/finance/withdrawal-text';
import { maskPhone } from '@/lib/payments/payer-phone';
import { isObjectId } from '@/lib/tickets/focus';

const GENERIC = 'Ce retrait n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez.';
const OPERATORS: Record<string, string> = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' };

type Read = { kind: 'ok'; w: Record<string, unknown> } | { kind: 'login' } | { kind: 'not-found' } | { kind: 'error'; message: string };

async function read(id: string): Promise<Read> {
    if (!isObjectId(id)) return { kind: 'not-found' };
    try {
        const h = await headers();
        if (!h.get('cookie')) return { kind: 'login' };
        const host = h.get('x-forwarded-host') ?? h.get('host');
        if (!host) return { kind: 'error', message: GENERIC };
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const path = `/api/finance/withdrawals/${encodeURIComponent(id)}`;
        const res = await readWithdrawal(new NextRequest(`${proto}://${host}${path}`, { headers: new Headers(h) }), { params: Promise.resolve({ id }) });
        if (res.status === 401) return { kind: 'login' };
        if (res.status === 404) return { kind: 'not-found' };
        const body = (await res.json().catch(() => null)) as { withdrawal?: Record<string, unknown>; error?: unknown } | null;
        if (!res.ok || !body?.withdrawal) return { kind: 'error', message: typeof body?.error === 'string' && body.error.trim() ? body.error : GENERIC };
        return { kind: 'ok', w: body.withdrawal };
    } catch (err) {
        console.error('[Page d’un retrait] lecture impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'error', message: GENERIC };
    }
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export async function WithdrawalDetail({ cashoutId, space }: { cashoutId: string; space: 'pro' | 'portefeuille' }) {
    const back = space === 'pro' ? { href: '/partner/finance', label: 'Mes finances' } : { href: '/wallet', label: 'Mon portefeuille' };
    const r = await read(cashoutId);
    if (r.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`${back.href}/retraits/${cashoutId}`)}`);
    if (r.kind === 'not-found') notFound();
    if (r.kind === 'error') {
        return (
            <div className="space-y-2">
                <PageHeader title="Mon retrait" back={back} />
                <RetryError title="Votre retrait n’a pas pu être chargé" description={r.message} />
            </div>
        );
    }
    const w = r.w;
    // Un retrait du portefeuille ouvert depuis les finances pro (ou l'inverse) : même 404, aucun indice
    if ((w.account_kind === 'PARRAINAGE') !== (space === 'portefeuille')) notFound();
    const status = str(w.effective_status) ?? str(w.status) ?? 'PENDING';
    const delayed = w.delayed === true;
    const view = withdrawalStatusView({ status, delayed });
    const createdAt = str(w.created_at);
    const processedAt = str(w.processed_at);
    const reason = str(w.rejection_reason);
    const operator = OPERATORS[String(w.operator ?? '')] ?? 'Mobile Money';
    const phone = str(w.phone_number);

    return (
        <div className="space-y-6 pb-24 lg:pb-12">
            <PageHeader title="Mon retrait" description={createdAt ? `Demandé le ${formatDateTime(createdAt)}.` : undefined} back={back} />
            <section aria-labelledby="retrait-montant" className="mx-auto w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="retrait-montant" className="text-3xl font-bold tabular-nums text-foreground-strong">{formatFcfa(num(w.gross_amount))}</h2>
                    <Badge variant={view.tone}>{view.label}</Badge>
                </div>
                <p className="text-base leading-relaxed text-foreground">{view.next}</p>
                {status === 'REJECTED' && reason && <p className="text-sm text-danger-text">Motif : {reason}</p>}
                <dl className="divide-y divide-border border-t border-border text-sm">
                    <div className="flex justify-between gap-4 py-3">
                        <dt className="text-muted-foreground">Montant</dt>
                        <dd className="text-right tabular-nums text-foreground-strong">
                            {withdrawalAmountLine({ status, delayed, net: num(w.net_amount), fee: num(w.fee_amount), processedAt })}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                        <dt className="text-muted-foreground">Envoyé vers</dt>
                        <dd className="text-right text-foreground-strong">{operator}{phone && <span className="tabular-nums"> · {maskPhone(phone)}</span>}</dd>
                    </div>
                    {processedAt && (
                        <div className="flex justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">Traité le</dt>
                            <dd className="text-right text-foreground-strong"><time dateTime={processedAt}>{formatDateTime(processedAt)}</time></dd>
                        </div>
                    )}
                </dl>
                <LinkButton href={back.href} variant="secondary" className="w-full sm:w-auto">{space === 'pro' ? 'Voir mes finances' : 'Voir mon portefeuille'}</LinkButton>
            </section>
        </div>
    );
}
