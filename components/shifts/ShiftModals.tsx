'use client';

import React, { useState } from 'react';
import {
    Banknote, Lock, ShieldCheck, AlertCircle,
    CheckCircle2, Printer, X, Loader2, Coins, Receipt, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Shift, ShiftSummary } from '@/lib/shifts/shift.service';

// ──────────────────────────────────────────────────────────
// 1. BANNIÈRE D'ÉTAT DE CAISSE (CONTRÔLEUR SCANNER)
// ──────────────────────────────────────────────────────────

interface ShiftStatusBannerProps {
    canAcceptCash: boolean;
    activeShift: Shift | null;
    onOpenShiftClick: () => void;
    onCloseShiftClick: () => void;
}

export function ShiftStatusBanner({
    canAcceptCash,
    activeShift,
    onOpenShiftClick,
    onCloseShiftClick,
}: ShiftStatusBannerProps) {
    if (!canAcceptCash) return null;

    if (activeShift) {
        const totalInHandExpected = (Number(activeShift.opening_float_amount) || 0) + (Number(activeShift.expected_cash_total) || 0);

        return (
            <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-slate-900 dark:text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5 sm:mt-0">
                        <Banknote size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Caisse Ouverte
                            </span>
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                                Début : {new Date(activeShift.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                            <span className="text-slate-600 dark:text-zinc-300">
                                Fond : <strong className="text-slate-900 dark:text-white font-mono">{Number(activeShift.opening_float_amount).toLocaleString('fr-FR')} F</strong>
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600 dark:text-zinc-300">
                                Encaissé : <strong className="text-emerald-600 dark:text-emerald-400 font-mono">+{Number(activeShift.expected_cash_total).toLocaleString('fr-FR')} F</strong>
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-700 dark:text-zinc-200 font-bold">
                                Total attendu : <strong className="font-mono text-slate-900 dark:text-white">{totalInHandExpected.toLocaleString('fr-FR')} FCFA</strong>
                            </span>
                        </div>
                    </div>
                </div>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCloseShiftClick}
                    className="w-full sm:w-auto shrink-0 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-black font-bold text-xs"
                >
                    <Receipt size={14} className="mr-1.5" /> Clôturer (Z de Caisse)
                </Button>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 dark:text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 sm:mt-0">
                    <Coins size={18} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Caisse Fermée
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                            Encaissement espèces bloqué
                        </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 max-w-xl">
                        Vous devez ouvrir votre session de caisse avec le régisseur avant d&apos;encaisser des billets physiques à l&apos;entrée.
                    </p>
                </div>
            </div>

            <Button
                type="button"
                size="sm"
                onClick={onOpenShiftClick}
                className="w-full sm:w-auto shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm"
            >
                <Lock size={14} className="mr-1.5" /> Ouvrir ma caisse
            </Button>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 2. MODAL D'OUVERTURE DE SHIFT
// ──────────────────────────────────────────────────────────

interface OpenShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle?: string;
    onShiftOpened: (shift: Shift) => void;
}

export function OpenShiftModal({
    isOpen,
    onClose,
    eventId,
    eventTitle,
    onShiftOpened,
}: OpenShiftModalProps) {
    const [openingFloat, setOpeningFloat] = useState('0');
    const [regisseurPin, setRegisseurPin] = useState('');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/controller/shifts/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: eventId,
                    opening_float_amount: Number(openingFloat) || 0,
                    regisseur_pin: regisseurPin.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Erreur lors de l\'ouverture de caisse.');
                return;
            }

            onShiftOpened(data.shift);
            onClose();
        } catch {
            setError('Erreur réseau lors de la communication serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500 text-white">
                            <Banknote size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">Ouvrir la Session de Caisse</h3>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[240px]">{eventTitle || 'Événement'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Fond de caisse initial remis par le régisseur (FCFA)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="500"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                placeholder="0"
                                required
                                className="w-full pl-3 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">FCFA</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Montant physique remis en espèces pour démarrer votre caisse.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Code PIN Régisseur (4 à 6 chiffres)
                        </label>
                        <input
                            type="password"
                            maxLength={6}
                            value={regisseurPin}
                            onChange={(e) => setRegisseurPin(e.target.value)}
                            placeholder="••••••"
                            required
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-base font-mono tracking-widest text-center text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Demandez au régisseur présent sur site de composer son code PIN.</p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmer l\'ouverture'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 3. MODAL DE CLÔTURE & GESTION D'ÉCART (Z DE CAISSE)
// ──────────────────────────────────────────────────────────

interface CloseShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    shift: Shift;
    onShiftClosed: (summary: ShiftSummary) => void;
}

export function CloseShiftModal({
    isOpen,
    onClose,
    shift,
    onShiftClosed,
}: CloseShiftModalProps) {
    const [declaredCash, setDeclaredCash]               = useState('');
    const [justification, setJustification]             = useState('');
    const [regisseurPin, setRegisseurPin]               = useState('');
    const [loading, setLoading]                         = useState(false);
    const [error, setError]                             = useState('');

    if (!isOpen) return null;

    const expectedCash = Number(shift.expected_cash_total) || 0;
    const openingFloat = Number(shift.opening_float_amount) || 0;
    const totalPhysicalExpected = expectedCash + openingFloat;

    const declaredNum = declaredCash.trim() === '' ? null : Number(declaredCash);
    // L'écart se calcule sur les espèces perçues (declared - expected)
    const discrepancy = declaredNum !== null ? declaredNum - expectedCash : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (declaredNum === null) {
            setError('Veuillez saisir le montant total compté.');
            return;
        }

        if (discrepancy !== 0 && !justification.trim()) {
            setError('Une justification textuelle est strictement obligatoire en cas d\'écart de caisse.');
            return;
        }

        if (!regisseurPin.trim()) {
            setError('Le code PIN régisseur est obligatoire pour co-signer la clôture.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/controller/shifts/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shift_id: shift.id,
                    declared_cash_total: declaredNum,
                    discrepancy_justification: justification.trim() || undefined,
                    regisseur_pin: regisseurPin.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Erreur lors de la clôture de caisse.');
                return;
            }

            onShiftClosed(data.summary);
            onClose();
        } catch {
            setError('Erreur réseau lors de la communication serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 my-8">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#FF5722] text-white">
                            <Receipt size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">Clôture de Caisse (Z)</h3>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Décompte physique contradictoire</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Rappel des montants calculés */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                        <span>Fond de caisse initial :</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-zinc-200">{openingFloat.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                        <span>Total encaissements (attendu) :</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{expectedCash.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 dark:border-zinc-700 flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>Espèces totales à rendre au régisseur :</span>
                        <span className="font-mono text-sm text-[#FF5722]">{totalPhysicalExpected.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Montant compté */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Montant des encaissements compté en main (hors fond)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={declaredCash}
                                onChange={(e) => setDeclaredCash(e.target.value)}
                                placeholder={expectedCash.toString()}
                                required
                                className="w-full pl-3 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">FCFA</span>
                        </div>
                    </div>

                    {/* Affichage de l'écart */}
                    {discrepancy !== null && (
                        <div className={`p-3 rounded-xl border text-xs font-bold ${
                            discrepancy === 0
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : discrepancy < 0
                                    ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span>Écart de caisse :</span>
                                <span className="text-sm font-mono font-black">
                                    {discrepancy > 0 ? `+${discrepancy.toLocaleString('fr-FR')}` : discrepancy.toLocaleString('fr-FR')} FCFA
                                </span>
                            </div>
                            <p className="text-[10px] font-normal mt-0.5 opacity-80">
                                {discrepancy === 0
                                    ? 'Comptabilité parfaite : le montant déclaré correspond exactement au montant attendu.'
                                    : discrepancy < 0
                                        ? `Déficit constaté de ${Math.abs(discrepancy).toLocaleString('fr-FR')} FCFA. Une justification est obligatoire.`
                                        : `Excédent constaté de +${discrepancy.toLocaleString('fr-FR')} FCFA. Une justification est obligatoire.`
                                }
                            </p>
                        </div>
                    )}

                    {/* Justification si écart != 0 */}
                    {discrepancy !== null && discrepancy !== 0 && (
                        <div>
                            <label className="block text-xs font-bold text-red-600 dark:text-red-400 mb-1">
                                Justification de l&apos;écart (obligatoire) *
                            </label>
                            <textarea
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                                rows={2}
                                placeholder="Ex: Rendu de monnaie manquant, billet non rendu, pourboire client..."
                                required
                                className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                            />
                        </div>
                    )}

                    {/* Code PIN régisseur co-signataire */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Co-signature : Code PIN Régisseur
                        </label>
                        <input
                            type="password"
                            maxLength={6}
                            value={regisseurPin}
                            onChange={(e) => setRegisseurPin(e.target.value)}
                            placeholder="••••••"
                            required
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-base font-mono tracking-widest text-center text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Le régisseur valide le décompte et signe la clôture avec son code secret.</p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Valider & Clôturer'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 4. MODAL TICKET Z DE CAISSE (RÉCAPITULATIF IMPRIMABLE)
// ──────────────────────────────────────────────────────────

interface ZSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: ShiftSummary | null;
}

export function ZSummaryModal({
    isOpen,
    onClose,
    summary,
}: ZSummaryModalProps) {
    if (!isOpen || !summary) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 my-8 print:m-0 print:p-0 print:border-none print:shadow-none">
                
                {/* En-tête modal (masqué à l'impression) */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800 print:hidden">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500 text-white">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">Ticket Z de Caisse Validé</h3>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Session clôturée avec succès</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Ticket Thermique imprimable ── */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-slate-300 dark:border-zinc-700 font-mono text-xs text-slate-800 dark:text-zinc-200 space-y-3 print:bg-white print:text-black print:border-black">
                    <div className="text-center pb-3 border-b border-slate-300 dark:border-zinc-700 print:border-black">
                        <p className="font-black text-sm uppercase tracking-wider">EVENT VILLAGE</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">TICKET Z DE CAISSE</p>
                        <p className="text-[10px] text-slate-400 mt-1">{summary.event_title}</p>
                    </div>

                    <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                            <span>Réf Session :</span>
                            <span className="font-bold">{summary.shift_id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Contrôleur :</span>
                            <span className="font-bold">{summary.controller_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Ouverture :</span>
                            <span>{new Date(summary.opened_at).toLocaleString('fr-FR')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Clôture :</span>
                            <span>{summary.closed_at ? new Date(summary.closed_at).toLocaleString('fr-FR') : 'En cours'}</span>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-300 dark:border-zinc-700 print:border-black space-y-1 text-[11px]">
                        <div className="flex justify-between">
                            <span>Fond initial :</span>
                            <span className="font-bold">{summary.opening_float_amount.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total attendu :</span>
                            <span className="font-bold">{summary.expected_cash_total.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total déclaré :</span>
                            <span className="font-bold">{(summary.declared_cash_total ?? 0).toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div className="pt-1 border-t border-slate-300 dark:border-zinc-700 print:border-black flex justify-between font-black text-xs">
                            <span>Écart constaté :</span>
                            <span className={summary.discrepancy_amount && summary.discrepancy_amount !== 0 ? 'text-red-600' : 'text-emerald-600'}>
                                {summary.discrepancy_amount && summary.discrepancy_amount > 0 ? `+${summary.discrepancy_amount}` : summary.discrepancy_amount ?? 0} FCFA
                            </span>
                        </div>
                    </div>

                    {summary.discrepancy_justification && (
                        <div className="pt-2 border-t border-slate-300 dark:border-zinc-700 print:border-black text-[10px]">
                            <p className="font-bold text-slate-600 dark:text-zinc-400">Justification écart :</p>
                            <p className="italic text-slate-700 dark:text-zinc-300">&ldquo;{summary.discrepancy_justification}&rdquo;</p>
                        </div>
                    )}

                    <div className="pt-3 border-t border-slate-300 dark:border-zinc-700 print:border-black text-center text-[10px] text-slate-400 dark:text-zinc-500">
                        <p className="font-bold text-slate-600 dark:text-zinc-400">✓ Visa Régisseur Confirmé (Code PIN)</p>
                        <p className="text-[9px] mt-0.5">Certifié conforme par Event Village Engine</p>
                    </div>
                </div>

                {/* Actions (masquées à l'impression) */}
                <div className="flex items-center justify-end gap-2 pt-2 print:hidden">
                    <Button type="button" variant="outline" onClick={handlePrint} className="font-bold text-xs">
                        <Printer size={14} className="mr-1.5" /> Imprimer le Z
                    </Button>
                    <Button type="button" onClick={onClose} className="bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold text-xs">
                        Terminé
                    </Button>
                </div>
            </div>
        </div>
    );
}
