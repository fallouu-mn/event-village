'use client';

/**
 * Lot 12d — actions d'argent de l'administration sur une commande, toujours confirmées avec le montant écrit :
 *  - « Annuler et rembourser » (POST /api/admin/orders/[id]/cancel) : motif envoyé au client et à l'établissement, faute
 *    de l'établissement notée ou non ; le bouton de confirmation écrit le montant rendu servi par la base (refundable) ;
 *  - décision après l'absence du client (POST /api/admin/orders/[id]/absence) : tout, une part (1 à 99 %) ou rien, motif ;
 *    le montant rendu est demandé au serveur (aperçu), écrit sur le bouton de confirmation et renvoyé avec la décision ;
 *    s'il a changé, le serveur refuse (montant nouveau affiché) et rien n'est écrit.
 * Aucun montant calculé dans le navigateur ; refus du serveur affichés tels quels.
 */

import React, { useEffect, useState } from 'react';
import { Ban, Calculator, CheckCircle2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput, Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa, formatTime } from '@/lib/format';

const REASON_MIN = 5;
const REASON_MAX = 300;

/** « Annuler et rembourser » : bouton, puis confirmation avec motif et montant écrit. */
export function CancelOrderAction({ orderId, orderNumber, refundable, onDone }: {
    orderId: string; orderNumber: string; refundable: number; onDone: (message: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [fault, setFault] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) { setReason(''); setFault(true); setError(null); }
    }, [open]);

    const tooShort = reason.trim().length < REASON_MIN;
    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await sendJson<{ message?: string }>(`/api/admin/orders/${orderId}/cancel`, 'POST', { reason: reason.trim(), partnerFault: fault });
            setOpen(false);
            await onDone(r.message ?? 'Commande annulée.');
        } catch (err) {
            setError(errorMessage(err, 'Annulation impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button variant="danger" leftIcon={<Ban size={18} aria-hidden="true" />} onClick={() => setOpen(true)}>
                Annuler et rembourser
            </Button>
            <ConfirmDialog
                isOpen={open}
                onClose={() => { if (!busy) setOpen(false); }}
                onConfirm={() => void confirm()}
                title="Annuler et rembourser"
                message={refundable > 0
                    ? `La commande ${orderNumber} est annulée et le client remboursé de ${formatFcfa(refundable)} sur son compte de paiement. Le client et l’établissement reçoivent votre motif.`
                    : `La commande ${orderNumber} est annulée. Rien n’a été payé en ligne : aucun remboursement. Le client et l’établissement reçoivent votre motif.`}
                confirmLabel={refundable > 0 ? `Rembourser ${formatFcfa(refundable)}` : 'Annuler la commande'}
                variant="danger"
                isLoading={busy}
                confirmDisabled={tooShort}
                maxWidth="md"
            >
                <Textarea
                    label="Motif"
                    hint={`Envoyé au client et à l’établissement (${REASON_MIN} caractères au moins).`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={REASON_MAX}
                    showCount
                    rows={3}
                    disabled={busy}
                    data-autofocus="true"
                />
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground">
                    <input
                        type="checkbox"
                        checked={fault}
                        onChange={(e) => setFault(e.target.checked)}
                        disabled={busy}
                        className="mt-0.5 h-5 w-5 flex-shrink-0 accent-primary"
                    />
                    <span>Faute de l’établissement (notée dans son suivi)</span>
                </label>
                {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
            </ConfirmDialog>
        </>
    );
}

type Decision = 'TOUT' | 'PART' | 'RIEN';
const DECISIONS: ReadonlyArray<{ id: Decision; label: string; help: string }> = [
    { id: 'TOUT', label: 'Rembourser tout', help: 'Tout ce qui a été payé en ligne est rendu.' },
    { id: 'PART', label: 'Rembourser une part', help: 'Une part de chaque paiement, en pourcentage.' },
    { id: 'RIEN', label: 'Ne rien rembourser', help: 'La commande est close sans remboursement.' },
];

interface Preview { decision: Decision; percent: number | null; refundAmount: number; paid: number }

/** Décision de l'équipe après l'absence du client : choix, motif, aperçu du montant servi par le serveur, confirmation. */
export function AbsenceDecisionPanel({ orderId, waitUntil, onDone }: { orderId: string; waitUntil?: string; onDone: (message: string) => Promise<void> }) {
    const [decision, setDecision] = useState<Decision | null>(null);
    const [percent, setPercent] = useState('50');
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [changed, setChanged] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Tout changement de choix annule l'aperçu : le montant écrit doit toujours être celui du choix affiché
    useEffect(() => {
        setPreview(null);
        setChanged(null);
    }, [decision, percent]);

    const percentValid = decision !== 'PART' || /^\d{1,2}$/.test(percent) && Number(percent) >= 1 && Number(percent) <= 99;
    const reasonValid = reason.trim().length >= REASON_MIN;
    const canPreview = decision !== null && percentValid && reasonValid && !busy;

    const payload = () => ({ decision, ...(decision === 'PART' ? { percent: Number(percent) } : {}), reason: reason.trim() });

    const askPreview = async () => {
        setBusy(true);
        setError(null);
        setChanged(null);
        try {
            const r = await sendJson<{ preview: Preview }>(`/api/admin/orders/${orderId}/absence`, 'POST', { ...payload(), preview: true });
            setPreview(r.preview);
        } catch (err) {
            setError(errorMessage(err, 'Montant indisponible pour le moment. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        if (!preview) return;
        setBusy(true);
        setError(null);
        try {
            const r = await sendJson<{ message?: string }>(`/api/admin/orders/${orderId}/absence`, 'POST', { ...payload(), expectedAmount: preview.refundAmount });
            await onDone(r.message ?? 'Décision enregistrée.');
        } catch (err) {
            if (err instanceof ApiError && err.code === 'AMOUNT_CHANGED') {
                const fresh = Number(err.body?.refund_amount);
                setChanged(err.message);
                if (Number.isFinite(fresh)) setPreview({ ...preview, refundAmount: fresh });
                return;
            }
            setError(errorMessage(err, 'Décision non enregistrée. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="border-warning-text p-4 sm:p-5">
            <section aria-labelledby="absence-decision-title" className="space-y-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-text" aria-hidden="true"><UserX size={20} /></span>
                    <div className="min-w-0">
                        <h2 id="absence-decision-title" className="text-lg font-semibold text-foreground-strong">Décider après l’absence du client</h2>
                        <p className="text-sm text-muted-foreground">
                            Le livreur a appelé deux fois sans réponse{waitUntil ? `, puis attendu jusqu’à ${formatTime(waitUntil)}` : ''}. Choisissez la suite : le client et l’établissement reçoivent votre motif.
                        </p>
                    </div>
                </div>

                <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-semibold text-foreground-strong">Remboursement</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {DECISIONS.map((d) => (
                            <label
                                key={d.id}
                                className={cn(
                                    'flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-sm transition-colors duration-fast ease-standard',
                                    decision === d.id ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground hover:bg-muted',
                                )}
                            >
                                <span className="flex items-center gap-2 font-semibold">
                                    <input type="radio" name={`absence-${orderId}`} value={d.id} checked={decision === d.id} onChange={() => setDecision(d.id)} disabled={busy} className="h-4 w-4 accent-primary" />
                                    {d.label}
                                </span>
                                <span className={decision === d.id ? 'text-primary-text' : 'text-muted-foreground'}>{d.help}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {decision === 'PART' && (
                    <TextInput
                        label="Part rendue (en %)"
                        hint="De 1 à 99 %, appliquée à chaque paiement en ligne."
                        inputMode="numeric"
                        value={percent}
                        onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                        error={percentValid ? undefined : 'Indiquez une part de 1 à 99 %.'}
                        fieldClassName="sm:max-w-xs"
                        disabled={busy}
                    />
                )}

                <Textarea
                    label="Motif"
                    hint={`Envoyé au client et à l’établissement (${REASON_MIN} caractères au moins).`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={REASON_MAX}
                    showCount
                    rows={3}
                    disabled={busy}
                />

                {changed && <StatusBanner tone="warning" title="Montant changé">{changed}</StatusBanner>}
                {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}

                {preview ? (
                    <div className="space-y-3 rounded-xl border border-border bg-background p-4 motion-safe:animate-in motion-safe:fade-in" aria-live="polite">
                        <p className="text-sm text-muted-foreground">Montant rendu au client, calculé par Event Village :</p>
                        <p className="text-2xl font-bold tabular-nums text-foreground-strong">{formatFcfa(preview.refundAmount)}</p>
                        <p className="text-sm text-muted-foreground">Payé en ligne : <span className="tabular-nums">{formatFcfa(preview.paid)}</span></p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant={preview.refundAmount > 0 ? 'primary' : 'danger'} leftIcon={<CheckCircle2 size={18} aria-hidden="true" />} onClick={() => void confirm()} isLoading={busy}>
                                {preview.refundAmount > 0 ? `Confirmer : rembourser ${formatFcfa(preview.refundAmount)}` : 'Confirmer : ne rien rembourser'}
                            </Button>
                            <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>Modifier le choix</Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="secondary" leftIcon={<Calculator size={18} aria-hidden="true" />} onClick={() => void askPreview()} disabled={!canPreview} isLoading={busy}>
                        Voir le montant rendu
                    </Button>
                )}
            </section>
        </Card>
    );
}
