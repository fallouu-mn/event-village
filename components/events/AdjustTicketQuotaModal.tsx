'use client';

import React, { useState, useEffect } from 'react';
import {
    Ticket,
    AlertCircle,
    CheckCircle2,
    Plus,
    Minus,
    TrendingUp,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface CategoryData {
    id: string;
    name: string;
    price: number;
    total_quantity: number;
    sold_quantity: number;
    is_active?: boolean;
    is_visible?: boolean;
}

interface AdjustTicketQuotaModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle: string;
    eventCapacity?: number | null;
    categories: CategoryData[];
    onSuccess?: () => void;
}

export const AdjustTicketQuotaModal: React.FC<AdjustTicketQuotaModalProps> = ({
    isOpen,
    onClose,
    eventId,
    eventTitle,
    eventCapacity,
    categories,
    onSuccess,
}) => {
    const toast = useToast();
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [newTotal, setNewTotal] = useState<number>(0);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [isVisible, setIsVisible] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (categories && categories.length > 0) {
            const first = categories[0];
            setSelectedCatId(first.id);
            setNewTotal(first.total_quantity);
            setIsActive(first.is_active !== false);
            setIsVisible(first.is_visible !== false);
        }
    }, [categories, isOpen]);

    const selectedCategory = categories.find((c) => c.id === selectedCatId) || categories[0];

    const handleSelectCategory = (catId: string) => {
        setSelectedCatId(catId);
        const cat = categories.find((c) => c.id === catId);
        if (cat) {
            setNewTotal(cat.total_quantity);
            setIsActive(cat.is_active !== false);
            setIsVisible(cat.is_visible !== false);
        }
    };

    if (!isOpen || !selectedCategory) return null;

    const sold = Number(selectedCategory.sold_quantity || 0);
    const originalTotal = Number(selectedCategory.total_quantity || 0);
    const diff = newTotal - originalTotal;
    const calculatedAvailable = Math.max(0, newTotal - sold);
    const isSoldOut = sold >= originalTotal;

    // Check capacity limit
    const otherCategoriesSum = categories
        .filter((c) => c.id !== selectedCatId)
        .reduce((sum, c) => sum + Number(c.total_quantity || 0), 0);
    const totalWithNew = otherCategoriesSum + newTotal;
    const isExceedingCapacity = eventCapacity && eventCapacity > 0 && totalWithNew > eventCapacity;

    // Error states
    const isBelowSold = newTotal < sold;
    const canSubmit = !isBelowSold && !isExceedingCapacity && !isSubmitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/partner/events/${eventId}/categories/${selectedCatId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    total_quantity: newTotal,
                    is_active: isActive,
                    is_visible: isVisible,
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(
                    diff > 0
                        ? `Quota augmenté avec succès (+ ${diff} place${diff > 1 ? 's' : ''}) !`
                        : diff < 0
                        ? `Quota réduit avec succès (${diff} place${Math.abs(diff) > 1 ? 's' : ''}).`
                        : 'Paramètres du pass mis à jour.'
                );
                onSuccess?.();
                onClose();
            } else {
                toast.error(data.error || 'Erreur lors de la mise à jour du quota.');
            }
        } catch {
            toast.error('Erreur réseau. Veuillez réessayer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#FF5722]/10 text-[#FF5722] flex items-center justify-center">
                                <Ticket size={18} />
                            </div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                Gestion des Quotas & Stock
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-1">
                            {eventTitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Category Selector Tabs */}
                    {categories.length > 1 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                                Sélectionner la formule à modifier :
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map((cat) => {
                                    const isSelected = cat.id === selectedCatId;
                                    const catSold = Number(cat.sold_quantity || 0);
                                    const catTotal = Number(cat.total_quantity || 0);
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => handleSelectCategory(cat.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                isSelected
                                                    ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                                                    : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                                            }`}
                                        >
                                            {cat.name} ({catSold}/{catTotal})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Stock Overview Card */}
                    <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/60 rounded-2xl">
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                                Vendus
                            </span>
                            <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                                {sold}
                            </span>
                        </div>
                        <div className="text-center border-x border-slate-200 dark:border-zinc-700">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                                Quota Actuel
                            </span>
                            <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                                {originalTotal}
                            </span>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                                En Vente
                            </span>
                            <span
                                className={`text-lg font-black font-mono mt-0.5 block ${
                                    isSoldOut ? 'text-red-500' : 'text-emerald-500'
                                }`}
                            >
                                {isSoldOut ? 'Sold Out' : Math.max(0, originalTotal - sold)}
                            </span>
                        </div>
                    </div>

                    {/* Adjustment Controls */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                Nouveau Quota Total de Billets
                            </label>
                            {diff !== 0 && (
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        diff > 0
                                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                                            : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
                                    }`}
                                >
                                    {diff > 0 ? `+${diff} place${diff > 1 ? 's' : ''}` : `${diff} place${Math.abs(diff) > 1 ? 's' : ''}`}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNewTotal(Math.max(sold, newTotal - 10))}
                                disabled={newTotal <= sold}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                -10
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewTotal(Math.max(sold, newTotal - 1))}
                                disabled={newTotal <= sold}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <Minus size={16} />
                            </button>
                            <input
                                type="number"
                                min={sold}
                                value={newTotal}
                                onChange={(e) => setNewTotal(Number(e.target.value))}
                                className="flex-1 h-10 px-3 text-center text-base font-mono font-black text-slate-900 dark:text-white bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl focus:border-[#FF5722] outline-hidden transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setNewTotal(newTotal + 1)}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                            >
                                <Plus size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewTotal(newTotal + 10)}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                            >
                                +10
                            </button>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mr-1">
                                Réassort rapide :
                            </span>
                            {[+25, +50, +100].map((delta) => (
                                <button
                                    key={delta}
                                    type="button"
                                    onClick={() => setNewTotal(originalTotal + delta)}
                                    className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-[#FF5722]/10 hover:text-[#FF5722] transition-colors"
                                >
                                    +{delta}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Simulation Result Box */}
                    <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs space-y-1">
                        <div className="flex justify-between font-medium text-blue-900 dark:text-blue-200">
                            <span>Disponibilité après validation :</span>
                            <span className="font-bold font-mono">
                                {calculatedAvailable} place{calculatedAvailable > 1 ? 's' : ''} en vente
                            </span>
                        </div>
                        {eventCapacity && eventCapacity > 0 && (
                            <div className="flex justify-between text-[11px] text-blue-700 dark:text-blue-300">
                                <span>Capacité globale de la salle :</span>
                                <span className="font-mono">
                                    {totalWithNew} / {eventCapacity} places
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Alerts and Constraints */}
                    {isBelowSold && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>
                                Impossible de réduire le quota à <strong>{newTotal}</strong> : {sold} billets ont déjà été vendus.
                            </span>
                        </div>
                    )}

                    {isExceedingCapacity && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>
                                La somme des quotas ({totalWithNew}) dépasse la capacité maximale autorisée ({eventCapacity}).
                            </span>
                        </div>
                    )}

                    {/* Status and Visibility Toggles */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="w-4 h-4 rounded text-[#FF5722] focus:ring-[#FF5722] border-slate-300 dark:border-zinc-700"
                            />
                            <span>Activer la vente</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
                            <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={(e) => setIsVisible(e.target.checked)}
                                className="w-4 h-4 rounded text-[#FF5722] focus:ring-[#FF5722] border-slate-300 dark:border-zinc-700"
                            />
                            <span>Visible sur le site</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            disabled={!canSubmit}
                            isLoading={isSubmitting}
                            leftIcon={<CheckCircle2 size={16} />}
                        >
                            {diff > 0
                                ? `Confirmer l'ajout (+ ${diff} place${diff > 1 ? 's' : ''})`
                                : diff < 0
                                ? `Confirmer la réduction (${diff})`
                                : 'Enregistrer'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
