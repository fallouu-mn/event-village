'use client';

/**
 * Invitations à contrôler (lot 9 bis, tâche 26 ; R37, B62, contrat 4.3).
 *
 * Une partenaire qui invite un client existant à contrôler ses événements ne lui donne plus le rôle d'office : le
 * titulaire reçoit le SMS CONTROLLER_INVITATION et répond ici.
 *  - Source : GET /api/account/controller-invitations (invitations en attente du compte connecté ; une invitation
 *    échue n'est plus servie).
 *  - « Accepter » : POST /api/account/controller-invitations/[id] { accept: true } ; rôle Contrôleur et affectations
 *    aux événements encore ouverts, puis lien vers le scanner.
 *  - « Refuser » : confirmation, puis { accept: false } ; rien d'autre n'est fait.
 *  - Refus du serveur (introuvable, échue, déjà répondue, compte non actif) affichés tels quels, liste relue.
 * Page protégée par le middleware (session exigée) ; rien de neuf dans le layout racine.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, Hourglass, ScanLine, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime } from '@/lib/format';

interface ControllerInvitation {
    id: string;
    company: string;
    events: Array<{ id: string; title: string; start_at: string | null }>;
    expires_at: string;
}

const ENDPOINT = '/api/account/controller-invitations';

function plural(n: number, one: string, many: string): string {
    return `${n} ${n > 1 ? many : one}`;
}

export default function ControllerInvitationsPage() {
    const toast = useToast();
    const [items, setItems] = useState<ControllerInvitation[]>([]);
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [answering, setAnswering] = useState<string | null>(null);
    const [declineTarget, setDeclineTarget] = useState<ControllerInvitation | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [accepted, setAccepted] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const body = await fetchJson<{ items?: unknown }>(ENDPOINT);
            if (!Array.isArray(body.items)) throw new Error('réponse sans liste d’invitations');
            setItems(body.items as ControllerInvitation[]);
            setLoadError(null);
            setPhase('ready');
        } catch (err) {
            console.error('[invitations] lecture impossible :', err instanceof Error ? err.message : String(err));
            setLoadError(errorMessage(err, 'Vos invitations n’ont pas pu être chargées.'));
            setPhase((p) => (p === 'ready' ? 'ready' : 'error'));
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const retry = async () => {
        setRetrying(true);
        try {
            await load();
        } finally {
            setRetrying(false);
        }
    };

    /** Réponse du titulaire ; un refus du serveur est dit en clair et la liste relue. */
    const answer = async (invitation: ControllerInvitation, accept: boolean) => {
        if (answering) return;
        setAnswering(invitation.id);
        setActionError(null);
        try {
            const reply = await sendJson<{ message?: string }>(`${ENDPOINT}/${encodeURIComponent(invitation.id)}`, 'POST', { accept });
            toast.success(reply.message || (accept ? 'Invitation acceptée.' : 'Invitation refusée.'));
            if (accept) setAccepted(invitation.company);
            setDeclineTarget(null);
        } catch (err) {
            console.error('[invitations] réponse impossible :', err instanceof Error ? err.message : String(err));
            setActionError(errorMessage(err, 'Votre réponse n’a pas pu être enregistrée. Réessayez.'));
            setDeclineTarget(null);
        } finally {
            setAnswering(null);
            await load();
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6 py-6 pb-24">
            <PageHeader
                title="Invitations à contrôler"
                description="Un organisateur vous propose de contrôler l’entrée de ses événements. Rien ne change sur votre compte tant que vous n’avez pas accepté."
            />

            {accepted && (
                <StatusBanner
                    tone="success"
                    title={`Vous contrôlez maintenant les événements de ${accepted}`}
                    action={<LinkButton href="/controller/scanner" variant="primary" size="sm" leftIcon={<ScanLine size={16} />}>Ouvrir le scanner</LinkButton>}
                >
                    Le scanner est accessible depuis votre compte, sans nouvelle inscription.
                </StatusBanner>
            )}

            {actionError && (
                <StatusBanner tone="danger" announce="alert" title="Réponse non enregistrée">
                    {actionError}
                </StatusBanner>
            )}

            {phase === 'loading' ? (
                <div className="space-y-3" role="status" aria-busy="true">
                    <span className="sr-only">Chargement de vos invitations…</span>
                    <div className="h-40 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" aria-hidden="true" />
                </div>
            ) : phase === 'error' ? (
                <ErrorState
                    title="Impossible d’afficher vos invitations"
                    description={loadError ?? undefined}
                    onRetry={() => void retry()}
                    isRetrying={retrying}
                />
            ) : items.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck size={28} />}
                    title="Aucune invitation en attente"
                    description="Quand un organisateur vous invite à contrôler ses événements, vous recevez un SMS et l’invitation apparaît ici."
                />
            ) : (
                <ul className="space-y-4">
                    {items.map((inv) => (
                        <li key={inv.id}>
                            <article aria-labelledby={`invitation-${inv.id}`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
                                <div className="space-y-1">
                                    <h2 id={`invitation-${inv.id}`} className="break-words text-base font-semibold text-fg">{inv.company}</h2>
                                    <p className="text-sm text-fg-muted">
                                        Vous invite à contrôler l’entrée de {plural(inv.events.length, 'événement', 'événements')}.
                                    </p>
                                </div>
                                {inv.events.length > 0 && (
                                    <ul className="space-y-2 rounded-xl border border-border bg-surface-sunken p-3 text-sm">
                                        {inv.events.map((ev) => (
                                            <li key={ev.id} className="flex items-start gap-2 text-fg">
                                                <CalendarClock size={16} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />
                                                <span className="min-w-0">
                                                    <span className="block break-words font-semibold">{ev.title}</span>
                                                    {ev.start_at && <time dateTime={ev.start_at} className="text-fg-muted">{formatDateTime(ev.start_at)}</time>}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p className="flex items-start gap-2 text-sm font-semibold text-warning-fg">
                                    <Hourglass size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                    <span>À accepter avant le <time dateTime={inv.expires_at}>{formatDateTime(inv.expires_at)}</time></span>
                                </p>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        variant="primary"
                                        fullWidth
                                        leftIcon={<Check size={18} aria-hidden="true" />}
                                        isLoading={answering === inv.id && declineTarget === null}
                                        disabled={answering !== null}
                                        onClick={() => void answer(inv, true)}
                                    >
                                        Accepter l’invitation
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        leftIcon={<X size={18} aria-hidden="true" />}
                                        disabled={answering !== null}
                                        onClick={() => { setActionError(null); setDeclineTarget(inv); }}
                                    >
                                        Refuser
                                    </Button>
                                </div>
                            </article>
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                isOpen={declineTarget !== null}
                onClose={() => { if (answering === null) setDeclineTarget(null); }}
                onConfirm={() => { if (declineTarget) void answer(declineTarget, false); }}
                title="Refuser cette invitation ?"
                message={declineTarget ? `${declineTarget.company} ne pourra pas vous affecter à ses événements. L’organisateur pourra vous inviter de nouveau plus tard.` : undefined}
                confirmLabel="Refuser l’invitation"
                cancelLabel="Revenir"
                variant="warning"
                isLoading={answering !== null}
            />
        </div>
    );
}
