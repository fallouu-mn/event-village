'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, LogIn, Store, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { readInvitation, type CourierInvitation as Invitation } from './courier-view';

/**
 * Lot 12d — invitation à livrer pour un établissement (/courier/invitations/<id>, lien de l'avis ORDER_COURIER_INVITED) :
 * GET /api/courier/invitations/<id> (invitation adressée au compte seulement), puis « Accepter » ou « Refuser »
 * (POST { accept }). Invitation d'un autre compte ou inconnue : « Cet élément n'est plus disponible ». Refus du serveur
 * affichés tels quels.
 */

const STATUS_TEXT: Record<string, { title: string; text: string }> = {
    ACTIVE: { title: 'Vous livrez pour cet établissement', text: 'Les commandes qu’il vous confie apparaissent dans vos livraisons.' },
    DECLINED: { title: 'Invitation refusée', text: 'Vous avez refusé cette invitation. L’établissement peut vous en envoyer une nouvelle.' },
    REMOVED: { title: 'Invitation terminée', text: 'Cet établissement ne vous confie plus de livraisons.' },
};

export function CourierInvitation({ invitationId }: { invitationId: string }) {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [inv, setInv] = useState<Invitation | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const body = await fetchJson<unknown>(`/api/courier/invitations/${encodeURIComponent(invitationId)}`);
            const view = readInvitation(body);
            if (!view) {
                setError('L’invitation n’a pas pu être affichée. Réessayez.');
                return;
            }
            setInv(view);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) setMissing(true);
            else setError(errorMessage(err, 'L’invitation n’a pas pu être chargée.'));
        } finally {
            setLoading(false);
        }
    }, [invitationId]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        void load();
    }, [authLoading, isAuthenticated, load]);

    const answer = async (accept: boolean) => {
        setBusy(accept ? 'accept' : 'decline');
        setActionError(null);
        try {
            const r = await sendJson<{ message?: string }>(`/api/courier/invitations/${encodeURIComponent(invitationId)}`, 'POST', { accept });
            setDone(typeof r.message === 'string' ? r.message : accept ? 'Vous livrez maintenant pour cet établissement.' : 'Invitation refusée.');
            setInv((prev) => (prev ? { ...prev, status: accept ? 'ACTIVE' : 'DECLINED' } : prev));
        } catch (err) {
            setActionError(errorMessage(err, 'Réponse impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    if (!authLoading && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
                <EmptyState
                    icon={<LogIn size={28} />}
                    title="Connectez-vous"
                    description="Connectez-vous avec le numéro invité pour répondre à l’invitation."
                    actionLabel="Se connecter"
                    actionHref={`/login?redirect=${encodeURIComponent(`/courier/invitations/${invitationId}`)}`}
                />
            </div>
        );
    }
    if (missing) return <UnavailableItem actionLabel="Mes livraisons" actionHref="/courier/orders" />;
    if (loading && !inv) {
        return (
            <div role="status" aria-busy="true" className="mx-auto max-w-lg space-y-4 pb-24 pt-6 lg:pb-12">
                <Skeleton className="h-10 w-2/3 rounded-xl" />
                <Skeleton className="h-48 rounded-3xl" />
                <span className="sr-only">Chargement de l’invitation…</span>
            </div>
        );
    }
    if (!inv) {
        return (
            <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
                <ErrorState title="Invitation indisponible" description={error ?? undefined} onRetry={() => void load()} />
            </div>
        );
    }

    const answered = STATUS_TEXT[inv.status];

    return (
        <div className="mx-auto max-w-lg space-y-5 pb-24 pt-6 lg:pb-12">
            <div className="flex flex-col items-center rounded-3xl border-2 border-border bg-card p-6 text-center sm:p-8">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary-text" aria-hidden="true">
                    <Bike size={32} />
                </div>
                <h1 className="break-words text-2xl font-extrabold leading-tight text-foreground-strong">{inv.partnerName} vous invite à livrer</h1>
                <p className="mt-2 text-base text-foreground-strong">
                    Vous verrez seulement les livraisons qui vous sont confiées : adresse du client, et son numéro pendant la livraison.
                </p>
                {inv.venues.length > 0 && (
                    <ul className="mt-4 w-full space-y-2 text-left" aria-label="Établissements">
                        {inv.venues.map((v) => (
                            <li key={v} className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-base font-semibold text-foreground-strong">
                                <Store size={18} aria-hidden="true" className="flex-shrink-0 text-muted-foreground" />
                                <span className="min-w-0 break-words">{v}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {actionError && <StatusBanner tone="danger" title="Réponse refusée" announce="alert">{actionError}</StatusBanner>}

            {inv.status === 'PENDING' ? (
                <div className="space-y-3">
                    <Button variant="gradient" fullWidth onClick={() => void answer(true)} isLoading={busy === 'accept'} disabled={busy !== null} leftIcon={<CheckCircle2 size={22} />}>
                        Accepter
                    </Button>
                    <Button variant="outline" size="lg" fullWidth className="min-h-14 text-lg" onClick={() => void answer(false)} isLoading={busy === 'decline'} disabled={busy !== null} leftIcon={<XCircle size={22} />}>
                        Refuser
                    </Button>
                </div>
            ) : (
                <StatusBanner tone={inv.status === 'ACTIVE' ? 'success' : 'neutral'} title={answered?.title ?? 'Invitation déjà traitée'}>
                    {done ?? answered?.text ?? 'Cette invitation a déjà reçu une réponse.'}
                </StatusBanner>
            )}

            {inv.status !== 'PENDING' && (
                <LinkButton href="/courier/orders" variant="secondary" size="lg" fullWidth className="min-h-14 text-lg">Mes livraisons</LinkButton>
            )}
        </div>
    );
}
