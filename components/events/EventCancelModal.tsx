'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface EventCancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle: string;
    onSuccess?: () => void;
    isAdmin?: boolean;
}

export const EventCancelModal: React.FC<EventCancelModalProps> = ({
    isOpen,
    onClose,
    eventId,
    eventTitle,
    onSuccess,
    isAdmin = false,
}) => {
    const toast = useToast();
    const [internalReason, setInternalReason] = useState('');
    const [publicNotice, setPublicNotice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!internalReason.trim() || internalReason.trim().length < 3) {
            toast.error("Veuillez indiquer un motif d'annulation détaillé (minimum 3 caractères).");
            return;
        }

        if (!isConfirmed) {
            toast.error('Veuillez cocher la case pour confirmer que vous comprenez les conséquences financières.');
            return;
        }

        setIsLoading(true);

        try {
            const endpoint = isAdmin
                ? `/api/admin/events/${eventId}/cancel`
                : `/api/partner/events/${eventId}/cancel`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    internalReason: internalReason.trim(),
                    publicNotice: publicNotice.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Une erreur est survenue lors de l'annulation.");
            }

            toast.success(
                data.refundsProcessed > 0
                    ? `Événement annulé avec succès. ${data.refundsProcessed} remboursement(s) Mobile Money exécuté(s).`
                    : 'Événement annulé avec succès.'
            );

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Échec de l'annulation de l'événement.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
                            <ShieldAlert size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                {isAdmin ? 'Annulation Administrative' : 'Annuler cet Événement'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-xs">
                                {eventTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Warning Box */}
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs font-black">
                            <AlertTriangle size={16} />
                            <span>Action irréversible & Remboursements Automatiques</span>
                        </div>
                        <p className="text-[11px] text-red-600 dark:text-red-300 leading-relaxed">
                            L&apos;annulation d&apos;un événement invalide immédiatement tous les billets émis et déclenche le reversement automatique des fonds aux acheteurs via Mobile Money (Wave / Orange Money).
                        </p>
                    </div>

                    {/* Internal Reason */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Motif d&apos;annulation (Requis) <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={internalReason}
                            onChange={(e) => setInternalReason(e.target.value)}
                            placeholder="Ex : Indisponibilité majeure de l'artiste / Cas de force majeure..."
                            rows={3}
                            required
                            disabled={isLoading}
                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none"
                        />
                    </div>

                    {/* Public Notice */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Message public pour les participants (Optionnel)
                        </label>
                        <textarea
                            value={publicNotice}
                            onChange={(e) => setPublicNotice(e.target.value)}
                            placeholder="Message affiché sur la page de l'événement et transmis par email aux acheteurs..."
                            rows={2}
                            disabled={isLoading}
                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none"
                        />
                    </div>

                    {/* Checkbox confirmation */}
                    <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isConfirmed}
                            onChange={(e) => setIsConfirmed(e.target.checked)}
                            disabled={isLoading}
                            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 leading-snug">
                            Je confirme vouloir annuler définitivement cet événement et autoriser le remboursement automatique des acheteurs.
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-800">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Abandonner
                        </Button>
                        <Button
                            type="submit"
                            variant="danger"
                            size="md"
                            disabled={isLoading || !isConfirmed || !internalReason.trim()}
                            isLoading={isLoading}
                            leftIcon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        >
                            {isLoading ? 'Annulation & Remboursements...' : "Confirmer l'annulation"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
