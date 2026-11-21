'use client';

/**
 * Lot 11b (écrans du client) : annulation d'une réservation de table, avec l'aperçu de la base AVANT de confirmer.
 *  1. GET /api/tables/reservations/[id]/cancel-preview (table_cancel_preview : même règle que l'annulation, même
 *     arrondi que le remboursement) ;
 *  2. fenêtre de confirmation qui dit ce que le client récupère : « Vous récupérez 21 000 F CFA », ou « L'acompte
 *     n'est pas remboursé : l'annulation arrive moins de 2 h avant l'heure », ou rien n'a été payé ; annulation
 *     impossible (déjà commencée, déjà annulée) : message de la base, sans bouton de confirmation ;
 *  3. POST /api/tables/reservations/[id]/cancel avec le montant de l'aperçu (expected_refund, contre-vérification T3) ;
 *     si la base répond PREVIEW_CHANGED (l'heure de l'annulation gratuite est passée pendant la lecture), le nouvel
 *     aperçu est relu et la fenêtre redemande la confirmation ; sinon message de la route, rafraîchissement de la page.
 * Aucun montant n'est calculé ici : tout vient de l'aperçu.
 */
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlarmClock, Undo2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { fcfaText } from '@/lib/tables/views';
import { localText } from './format';

interface CancelPreview {
    canCancel: boolean;
    message: string | null;
    paidAmount: number;
    refundAmount: number;
    keptAmount: number;
    refundPercent: number;
    freeUntil: string | null;
    cancelFreeHours: number;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className={strong ? 'text-base font-semibold text-foreground-strong' : 'text-sm text-foreground'}>{label}</dt>
            <dd className={strong ? 'text-lg font-bold tabular-nums text-foreground-strong' : 'text-sm font-semibold tabular-nums text-foreground-strong'}>{value}</dd>
        </div>
    );
}

function headline(p: CancelPreview): string {
    if (p.paidAmount <= 0) return 'Rien n’a été payé : l’annulation ne vous coûte rien.';
    if (p.refundAmount <= 0) return `L’acompte n’est pas remboursé : l’annulation arrive moins de ${p.cancelFreeHours} h avant l’heure.`;
    if (p.keptAmount > 0) return `Vous récupérez ${fcfaText(p.refundAmount)} ; ${fcfaText(p.keptAmount)} sont gardés selon les conditions.`;
    return `Vous récupérez ${fcfaText(p.refundAmount)}.`;
}

export function useTableCancel(reservationId: string): { start: () => void; starting: boolean; dialog: React.ReactNode } {
    const router = useRouter();
    const toast = useToast();
    const [, startRefresh] = useTransition();
    const [preview, setPreview] = useState<CancelPreview | null>(null);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [changed, setChanged] = useState(false);

    const loadPreview = async (): Promise<CancelPreview | null> => {
        const body = await fetchJson<{ preview?: CancelPreview }>(`/api/tables/reservations/${reservationId}/cancel-preview`);
        return body.preview ?? null;
    };

    const start = async () => {
        setStarting(true);
        setChanged(false);
        try {
            const p = await loadPreview();
            if (p) setPreview(p);
            else toast.error('Le montant rendu n’a pas pu être calculé. Réessayez.');
        } catch (err) {
            toast.error(errorMessage(err, 'Le montant rendu n’a pas pu être calculé. Réessayez.'));
        } finally {
            setStarting(false);
        }
    };

    const confirm = async () => {
        if (!preview) return;
        setCancelling(true);
        try {
            const body = await sendJson<{ message?: string }>(`/api/tables/reservations/${reservationId}/cancel`, 'POST', { expected_refund: preview.refundAmount });
            setPreview(null);
            setChanged(false);
            toast.success(typeof body.message === 'string' && body.message ? body.message : 'Réservation annulée.');
            startRefresh(() => router.refresh());
        } catch (err) {
            if (err instanceof ApiError && err.code === 'PREVIEW_CHANGED') {
                // Contre-vérification T3 : le montant a changé, rien n'est annulé ; nouvel aperçu, nouvelle confirmation
                try {
                    const p = await loadPreview();
                    if (p) {
                        setPreview(p);
                        setChanged(true);
                    } else {
                        setPreview(null);
                        toast.error('Le montant rendu n’a pas pu être recalculé. Réessayez.');
                    }
                } catch (again) {
                    setPreview(null);
                    toast.error(errorMessage(again, 'Le montant rendu n’a pas pu être recalculé. Réessayez.'));
                }
            } else {
                toast.error(errorMessage(err, 'Annulation impossible pour le moment. Réessayez.'));
            }
        } finally {
            setCancelling(false);
        }
    };

    const close = () => {
        if (!cancelling) setPreview(null);
    };

    let dialog: React.ReactNode = null;
    if (preview && !preview.canCancel) {
        dialog = (
            <Modal isOpen onClose={close} title="Annulation impossible" maxWidth="md">
                <div className="space-y-4">
                    <p className="text-base leading-relaxed text-foreground-strong">{preview.message ?? 'Cette réservation ne peut plus être annulée.'}</p>
                    <Button variant="secondary" fullWidth onClick={close}>Fermer</Button>
                </div>
            </Modal>
        );
    } else {
        dialog = (
            <ConfirmDialog
                isOpen={preview !== null}
                onClose={close}
                onConfirm={confirm}
                title="Annuler la réservation ?"
                variant="danger"
                confirmLabel="Confirmer l’annulation"
                cancelLabel="Garder ma table"
                isLoading={cancelling}
                maxWidth="md"
            >
                {preview && (
                    <div className="space-y-4">
                        {changed && (
                            <StatusBanner tone="warning" announce="alert" title="Le montant rendu a changé">
                                L’heure de l’annulation gratuite est passée pendant votre lecture. Vérifiez le nouveau montant, puis confirmez si vous annulez toujours.
                            </StatusBanner>
                        )}
                        <p className="flex items-start gap-2 text-base font-semibold leading-relaxed text-foreground-strong">
                            <Undo2 size={20} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span>{headline(preview)}</span>
                        </p>
                        {preview.paidAmount > 0 && (
                            <dl className="divide-y divide-border rounded-xl border border-border px-4">
                                <Row label="Déjà payé" value={fcfaText(preview.paidAmount)} />
                                <Row label={`Rendu (${preview.refundPercent} %)`} value={fcfaText(preview.refundAmount)} strong />
                                {preview.keptAmount > 0 && <Row label="Gardé selon les conditions" value={fcfaText(preview.keptAmount)} />}
                            </dl>
                        )}
                        {preview.refundAmount > 0 && (
                            <p className="text-sm text-muted-foreground">Le remboursement est versé sur le compte Wave ou Orange Money qui a payé.</p>
                        )}
                        {preview.paidAmount > 0 && preview.refundAmount > 0 && preview.freeUntil && localText(preview.freeUntil) && (
                            <p className="text-sm text-muted-foreground">{`Annulation gratuite jusqu’au ${localText(preview.freeUntil)}.`}</p>
                        )}
                        <p className="flex items-start gap-2 text-sm text-muted-foreground">
                            <AlarmClock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span>L’annulation est définitive : la table est libérée pour d’autres clients et l’établissement est prévenu.</span>
                        </p>
                    </div>
                )}
            </ConfirmDialog>
        );
    }

    return { start, starting, dialog };
}
