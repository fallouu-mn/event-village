import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { GET as linkTarget } from '@/app/api/tables/link/[code]/route';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryError } from '@/components/halls/client/RetryError';
import { readOnServer } from '@/app/halls/reservations/read-on-server';

/**
 * Lot 11b : lien court des SMS (« /t/<code> »). Page serveur : elle demande la cible à GET /api/tables/link/[code] avec
 * la session de la requête, puis redirige vers la réservation (client ou établissement). Sans session : connexion, puis
 * retour ici. Code inconnu ou réservation d'un autre compte : 404 sans indice. Sans interrupteur.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ma réservation — Event Village', robots: { index: false } };

export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const safe = /^[2-9a-hjkmnp-z]{7}$/.test(code) ? code : '';
    if (!safe) notFound();
    const read = await readOnServer<string>(
        `/api/tables/link/${safe}`,
        (req) => linkTarget(req, { params: Promise.resolve({ code: safe }) }),
        (b) => (typeof b.target === 'string' && b.target.startsWith('/') && !b.target.startsWith('//') ? b.target : null),
    );
    if (read.kind === 'login') redirect(`/login?redirect=${encodeURIComponent(`/t/${safe}`)}`);
    if (read.kind === 'not-found') notFound();
    if (read.kind !== 'ok') {
        return (
            <div className="space-y-2">
                <PageHeader title="Ma réservation" back={{ href: '/tables/reservations', label: 'Mes réservations' }} />
                <RetryError title="La réservation n’a pas pu être ouverte" description={read.message} />
            </div>
        );
    }
    redirect(read.data);
}
