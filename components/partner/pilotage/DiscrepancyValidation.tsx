'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatFcfa } from '@/lib/format';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import type { Shift } from '@/lib/shifts/shift.service';
import { PilotageSection } from './PilotageBlocks';

const PasswordConfirmDialog = dynamic(
    () => import('@/components/auth/PasswordConfirmDialog').then((m) => m.PasswordConfirmDialog),
    { ssr: false },
);

const PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED';

function controllerName(s: Shift): string {
    const name = `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''}`.trim();
    return name || 'Compte sans nom';
}

/**
 * Lot 9 quater (C7 : AUD-16) — écarts de caisse à valider par l'organisatrice, dans l'onglet Caisse du pilotage.
 * Une caisse fermée avec un écart n'est plus co-signée par le PIN régisseur saisi sur le téléphone du contrôleur :
 * l'organisatrice valide l'écart depuis sa session (POST /api/partner/shifts/<id>/validate-discrepancy), mot de passe
 * saisi depuis moins de 10 minutes (sinon la saisie du mot de passe s'ouvre, puis l'action repart). Lecture par
 * GET /api/partner/events/<id>/shifts ; rien ne s'affiche s'il n'y a aucun écart en attente.
 */
export function DiscrepancyValidation({ eventId, signal }: { eventId: string; signal: number }) {
    const toast = useToast();
    const { data, reload } = useServerData<{ shifts: Shift[] }>(`/api/partner/events/${eventId}/shifts`, signal);
    const [busy, setBusy] = useState<string | null>(null);
    const [needsPassword, setNeedsPassword] = useState<string | null>(null);

    const pending = (data?.shifts ?? []).filter((s) => s.status === 'CLOTURE'
        && Number(s.discrepancy_amount ?? 0) !== 0 && !s.discrepancy_validated_at);

    const validate = async (shiftId: string): Promise<void> => {
        setBusy(shiftId);
        try {
            await sendJson(`/api/partner/shifts/${shiftId}/validate-discrepancy`, 'POST', {});
            toast.success('Écart validé.');
            await reload();
        } catch (err) {
            if (err instanceof ApiError && err.code === PASSWORD_CONFIRMATION_REQUIRED) {
                setNeedsPassword(shiftId);
                return;
            }
            toast.error(errorMessage(err, 'L’écart n’a pas pu être validé.'));
        } finally {
            setBusy(null);
        }
    };

    if (pending.length === 0) return null;

    return (
        <PilotageSection
            title="Écarts à valider"
            description="Une caisse fermée avec un écart attend votre validation. Vérifiez la justification du contrôleur avant de valider."
        >
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {pending.map((s) => (
                    <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm">
                            <p className="font-semibold text-fg">
                                {controllerName(s)} · écart de <span className="tabular-nums">{formatFcfa(Number(s.discrepancy_amount))}</span>
                            </p>
                            {s.discrepancy_justification && <p className="text-fg-muted">« {s.discrepancy_justification} »</p>}
                            {s.closed_at && (
                                <p className="text-fg-muted">Fermée le <time dateTime={s.closed_at}>{formatDateTime(s.closed_at)}</time></p>
                            )}
                        </div>
                        <Button variant="primary" leftIcon={<ShieldCheck size={18} aria-hidden="true" />} isLoading={busy === s.id}
                            onClick={() => void validate(s.id)} aria-label={`Valider l’écart de la caisse de ${controllerName(s)}`}>
                            Valider l’écart
                        </Button>
                    </li>
                ))}
            </ul>
            {needsPassword && (
                <PasswordConfirmDialog
                    isOpen={needsPassword !== null}
                    onClose={() => setNeedsPassword(null)}
                    onConfirmed={() => {
                        const id = needsPassword;
                        setNeedsPassword(null);
                        if (id) void validate(id);
                    }}
                />
            )}
        </PilotageSection>
    );
}
