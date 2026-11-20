'use client';

/**
 * Lot 10b (point 3) : actions de la propriétaire sur une salle, partagées par « Mes salles » et la fiche.
 *  - « Renvoyer en validation » (salle refusée) : POST /api/partner/halls/[id]/submit ; le refus de la route (salle
 *    incomplète…) est affiché tel quel ;
 *  - retirer de la vente / remettre en vente : PUT /api/partner/halls/[id] { is_active }, après confirmation ;
 *  - supprimer : DELETE /api/partner/halls/[id], après confirmation ; une salle déjà réservée est refusée par la route
 *    (« Retirez-la de la vente à la place »), message affiché.
 * Une seule action à la fois (aucun double envoi). Le résultat est rendu par `banner` (bandeau annoncé) et un toast.
 * Lot 10b (correctifs, point 2) : le renvoi direct s’affiche « Renvoyer sans modifier » ; « Corriger et renvoyer »
 * passe par le formulaire (enregistrement puis renvoi). Le message d'échec garde la phrase de la route.
 */
import React, { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { putJson } from './hall-api';

export type HallActionKind = 'deactivate' | 'activate' | 'delete';

interface HallRef {
    id: string;
    name: string;
}

interface Notice {
    tone: 'success' | 'danger';
    title: string;
    text?: string;
}

const COPY: Record<HallActionKind, { title: (name: string) => string; message: string; confirm: string; variant: 'danger' | 'warning' | 'default' }> = {
    deactivate: {
        title: (name) => `Retirer « ${name} » de la vente ?`,
        message: 'Les clients ne pourront plus la réserver. Les réservations déjà faites sont maintenues. Vous pourrez la remettre en vente à tout moment.',
        confirm: 'Retirer de la vente',
        variant: 'warning',
    },
    activate: {
        title: (name) => `Remettre « ${name} » en vente ?`,
        message: 'Les clients pourront de nouveau la réserver, si elle est validée par l’équipe d’Event Village.',
        confirm: 'Remettre en vente',
        variant: 'default',
    },
    delete: {
        title: (name) => `Supprimer « ${name} » ?`,
        message: 'La salle est supprimée définitivement. Une salle déjà réservée ne peut pas être supprimée : retirez-la plutôt de la vente.',
        confirm: 'Supprimer la salle',
        variant: 'danger',
    },
};

export function useHallActions({ onChanged, onDeleted }: { onChanged: () => void; onDeleted?: (id: string) => void }) {
    const toast = useToast();
    const [pending, setPending] = useState<{ kind: HallActionKind; hall: HallRef } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const busyRef = useRef(false);

    const begin = (id: string): boolean => {
        if (busyRef.current) return false;
        busyRef.current = true;
        setBusyId(id);
        setNotice(null);
        return true;
    };
    const end = () => {
        busyRef.current = false;
        setBusyId(null);
    };

    /** Renvoi en validation d'une salle refusée (sans fenêtre : l'action est sans risque et se défait par l'équipe). */
    const submit = async (hall: HallRef) => {
        if (!begin(hall.id)) return;
        try {
            await sendJson(`/api/partner/halls/${encodeURIComponent(hall.id)}/submit`, 'POST');
            setNotice({ tone: 'success', title: `« ${hall.name} » est renvoyée en validation.`, text: 'Vous recevrez un message dès que l’équipe d’Event Village l’aura examinée.' });
            toast.success('Salle renvoyée en validation.');
            onChanged();
        } catch (err) {
            setNotice({
                tone: 'danger',
                title: `« ${hall.name} » n’a pas été renvoyée en validation.`,
                text: `${errorMessage(err, 'Envoi impossible pour le moment. Réessayez.')} Pour compléter la salle, touchez « Corriger et renvoyer ».`,
            });
        } finally {
            end();
        }
    };

    const confirm = async () => {
        if (!pending) return;
        const { kind, hall } = pending;
        if (!begin(hall.id)) return;
        try {
            if (kind === 'delete') {
                await sendJson(`/api/partner/halls/${encodeURIComponent(hall.id)}`, 'DELETE');
                setNotice({ tone: 'success', title: `« ${hall.name} » est supprimée.` });
                toast.success('Salle supprimée.');
                setPending(null);
                if (onDeleted) onDeleted(hall.id);
                else onChanged();
            } else {
                const active = kind === 'activate';
                await putJson(`/api/partner/halls/${encodeURIComponent(hall.id)}`, { is_active: active });
                setNotice({ tone: 'success', title: active ? `« ${hall.name} » est remise en vente.` : `« ${hall.name} » est retirée de la vente.` });
                toast.success(active ? 'Salle remise en vente.' : 'Salle retirée de la vente.');
                setPending(null);
                onChanged();
            }
        } catch (err) {
            setPending(null);
            setNotice({
                tone: 'danger',
                title: kind === 'delete' ? `« ${hall.name} » n’a pas été supprimée.` : `« ${hall.name} » n’a pas été modifiée.`,
                text: errorMessage(err, 'Action impossible pour le moment. Réessayez.'),
            });
        } finally {
            end();
        }
    };

    const copy = pending ? COPY[pending.kind] : null;

    const dialog = (
        <ConfirmDialog
            isOpen={pending !== null}
            onClose={() => { if (!busyRef.current) setPending(null); }}
            onConfirm={() => void confirm()}
            title={copy && pending ? copy.title(pending.hall.name) : ''}
            message={copy?.message}
            confirmLabel={copy?.confirm}
            cancelLabel="Annuler"
            variant={copy?.variant ?? 'default'}
            isLoading={busyId !== null}
        />
    );

    const banner = notice ? (
        <StatusBanner
            tone={notice.tone}
            title={notice.title}
            announce={notice.tone === 'danger' ? 'alert' : 'status'}
            action={<Button type="button" variant="ghost" size="sm" onClick={() => setNotice(null)}>Fermer</Button>}
            className="mb-4"
        >
            {notice.text}
        </StatusBanner>
    ) : null;

    return {
        ask: (kind: HallActionKind, hall: HallRef) => { setNotice(null); setPending({ kind, hall }); },
        submit,
        busyId,
        dialog,
        banner,
    };
}
