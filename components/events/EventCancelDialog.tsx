'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ErrorState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatFcfa, formatInteger } from '@/lib/format';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';

/**
 * Lot 5 (tâche 5.8, contrat J et D6) — annulation d'un événement par son organisateur ou par l'équipe
 * Event Village. API fixée (la zone admin l'importe) :
 *   <EventCancelDialog eventId eventTitle scope={'partner' | 'admin'} open onClose onCancelled />
 *  - lit l'impact sur GET /api/partner/events/[id]/cancellation (propriétaire ou admin) ;
 *  - demande l'avis public (au moins 10 caractères) et le motif interne (au moins 3) ;
 *  - exige de retaper le titre (ConfirmDialog, requireText) ;
 *  - envoie { publicNotice, internalReason, confirmTitle } à …/partner/… ou …/admin/events/[id]/cancel.
 * La base revérifie tout (statut, titre, longueurs) dans une seule transaction.
 */

export interface EventCancelDialogProps {
    eventId: string;
    eventTitle: string;
    scope: 'partner' | 'admin';
    open: boolean;
    onClose: () => void;
    onCancelled: () => void;
}

interface CancellationImpact {
    tickets: { online: number; cash: number; free: number; invitations: number };
    buyers: number;
    online_refund_total: number;
    cash_refund_total: number;
    pending_payments: number;
}

interface CancelResponse {
    success?: boolean;
    message?: string;
    refundsCreated?: number;
}

const MIN_NOTICE = 10;
const MIN_REASON = 3;
const MAX_TEXT = 2000;

function ImpactLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className={strong ? 'text-base font-bold text-fg tabular-nums' : 'text-sm font-semibold text-fg tabular-nums'}>{value}</dd>
        </div>
    );
}

export function EventCancelDialog({ eventId, eventTitle, scope, open, onClose, onCancelled }: EventCancelDialogProps) {
    const toast = useToast();
    const [impact, setImpact] = useState<CancellationImpact | null>(null);
    const [impactError, setImpactError] = useState<string | null>(null);
    const [impactLoading, setImpactLoading] = useState(false);
    const [publicNotice, setPublicNotice] = useState('');
    const [internalReason, setInternalReason] = useState('');
    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const loadImpact = useCallback(async () => {
        setImpactLoading(true);
        setImpactError(null);
        try {
            const body = await fetchJson<{ impact?: CancellationImpact; progress?: unknown }>(`/api/partner/events/${eventId}/cancellation`);
            if (!body.impact) {
                setImpact(null);
                setImpactError('Cet événement est déjà annulé : l’avancement des remboursements est affiché sur sa page.');
                return;
            }
            setImpact(body.impact);
        } catch (err) {
            setImpact(null);
            setImpactError(errorMessage(err, 'Lecture de l’impact de l’annulation impossible.'));
        } finally {
            setImpactLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (!open) return;
        setPublicNotice('');
        setInternalReason('');
        setTouched(false);
        setSubmitError(null);
        void loadImpact();
    }, [open, loadImpact]);

    const notice = publicNotice.trim();
    const reason = internalReason.trim();
    const noticeError = touched && notice.length < MIN_NOTICE ? `L’avis public doit contenir au moins ${MIN_NOTICE} caractères.` : undefined;
    const reasonError = touched && reason.length < MIN_REASON ? `Le motif interne doit contenir au moins ${MIN_REASON} caractères.` : undefined;
    const formValid = notice.length >= MIN_NOTICE && reason.length >= MIN_REASON;

    const submit = async (): Promise<void> => {
        setTouched(true);
        if (!formValid || !impact || submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        const payload = { publicNotice: notice, internalReason: reason, confirmTitle: eventTitle.trim() };
        try {
            const result = scope === 'admin'
                ? await sendJson<CancelResponse>(`/api/admin/events/${eventId}/cancel`, 'POST', payload)
                : await sendJson<CancelResponse>(`/api/partner/events/${eventId}/cancel`, 'POST', payload);
            toast.success(result.message || 'Événement annulé. Les participants sont prévenus et les remboursements sont lancés.');
            onCancelled();
            onClose();
        } catch (err) {
            setSubmitError(errorMessage(err, 'Annulation impossible pour le moment.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ConfirmDialog
            isOpen={open}
            onClose={() => {
                if (!submitting) onClose();
            }}
            onConfirm={() => void submit()}
            title="Annuler l’événement ?"
            message="L’annulation est définitive : la vente s’arrête, les participants sont prévenus et les billets payés en ligne sont remboursés automatiquement."
            confirmLabel="Confirmer l’annulation"
            cancelLabel="Garder l’événement"
            variant="danger"
            isLoading={submitting}
            requireText={eventTitle}
            requireTextLabel={`Pour confirmer, saisissez le titre exact de l’événement : « ${eventTitle} »`}
            confirmDisabled={!impact || impactLoading || !formValid}
            maxWidth="lg"
        >
            <section aria-labelledby="annulation-impact" className="flex flex-col gap-2">
                <h3 id="annulation-impact" className="text-base font-semibold text-fg">Impact de l’annulation</h3>
                {impactLoading && (
                    <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Calcul de l’impact en cours">
                        <span className="h-5 w-full rounded bg-surface-sunken motion-safe:animate-pulse" />
                        <span className="h-5 w-4/5 rounded bg-surface-sunken motion-safe:animate-pulse" />
                        <span className="h-5 w-3/5 rounded bg-surface-sunken motion-safe:animate-pulse" />
                    </div>
                )}
                {!impactLoading && impactError && (
                    <ErrorState
                        title="Impact indisponible"
                        description={impactError}
                        onRetry={() => void loadImpact()}
                        className="my-0 p-5"
                    />
                )}
                {!impactLoading && impact && (
                    <dl className="rounded-2xl border border-border bg-surface-sunken px-4 py-1">
                        <ImpactLine label="Acheteurs à prévenir" value={formatInteger(impact.buyers)} />
                        <ImpactLine label="Billets payés en ligne" value={formatInteger(impact.tickets.online)} />
                        <ImpactLine label="Billets payés en espèces" value={formatInteger(impact.tickets.cash)} />
                        <ImpactLine label="Billets gratuits et invitations" value={formatInteger(impact.tickets.free + impact.tickets.invitations)} />
                        <ImpactLine label="Remboursement en ligne (automatique)" value={formatFcfa(impact.online_refund_total)} strong />
                        <ImpactLine label="Espèces à rembourser par l’organisateur" value={formatFcfa(impact.cash_refund_total)} />
                        {impact.pending_payments > 0 && (
                            <ImpactLine label="Paiements en cours (refusés puis remboursés)" value={formatInteger(impact.pending_payments)} />
                        )}
                    </dl>
                )}
            </section>

            <Textarea
                label="Avis public aux participants"
                hint="Affiché sur la page de l’événement et envoyé aux acheteurs. Expliquez la raison et la suite (remboursement, report éventuel)."
                value={publicNotice}
                onChange={(e) => setPublicNotice(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={MAX_TEXT}
                showCount
                required
                rows={3}
                disabled={submitting}
                error={noticeError}
            />
            <Textarea
                label="Motif interne"
                hint="Visible seulement de l’organisateur et de l’équipe Event Village, jamais publié."
                value={internalReason}
                onChange={(e) => setInternalReason(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={MAX_TEXT}
                showCount
                required
                rows={2}
                disabled={submitting}
                error={reasonError}
            />
            {submitError && (
                <StatusBanner tone="danger" title="L’annulation n’a pas abouti" announce="alert">
                    {submitError}
                </StatusBanner>
            )}
        </ConfirmDialog>
    );
}

export default EventCancelDialog;
