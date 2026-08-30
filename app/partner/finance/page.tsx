'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Wallet,
    TrendingUp,
    ArrowDownCircle,
    Clock,
    CheckCircle2,
    Send,
    RefreshCw,
    Ticket,
    ShoppingBag,
    Building2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface FinanceData {
    grossRevenue: number;
    evCommission: number;
    netRevenue: number;
    soldeDisponible: number;
    totalWithdrawn: number;
    pendingAmount: number;
    breakdown: {
        tickets: { grossRevenue: number; netRevenue: number; commissionRate: number };
        orders: { grossRevenue: number; netRevenue: number; commissionRate: number };
        halls: { grossRevenue: number; netRevenue: number; commissionRate: number };
    };
}

interface Withdrawal {
    id: string;
    gross_amount: number;
    fee_amount: number;
    net_amount: number;
    status: string;
    withdrawal_method: string;
    payment_details: { phoneNumber?: string; operatorName?: string; firstName?: string; lastName?: string } | null;
    created_at: string;
    processed_at: string | null;
}

const withdrawalSchema = z.object({
    amount: z.number({ invalid_type_error: 'Montant requis.' }).min(5000, 'Minimum 5 000 FCFA.'),
    operatorName: z.enum(['WAVE', 'ORANGE_MONEY'], { required_error: 'Opérateur requis.' }),
    phoneNumber: z.string().min(8, 'Numéro invalide (min. 8 chiffres).'),
    firstName: z.string().min(1, 'Prénom requis.'),
    lastName: z.string().min(1, 'Nom requis.'),
});

type FormErrors = Partial<Record<string, string>>;

export default function PartnerFinancePage() {
    const { profile } = useAuth();
    const toast = useToast();

    const [finance, setFinance] = useState<FinanceData | null>(null);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Withdrawal form
    const [amount, setAmount] = useState<number | ''>('');
    const [operatorName, setOperatorName] = useState<'WAVE' | 'ORANGE_MONEY'>('WAVE');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showBreakdown, setShowBreakdown] = useState(false);

    // Pre-fill name from profile
    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '');
            setLastName(profile.last_name || '');
            if (profile.phone) setPhoneNumber(profile.phone);
        }
    }, [profile]);

    const fetchFinance = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/partner/finance');
            const data = await res.json();
            if (data.success) {
                setFinance(data.finance);
                setWithdrawals(data.withdrawals || []);
            } else {
                setError(data.error || 'Erreur de chargement.');
            }
        } catch {
            setError('Impossible de charger les données financières.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchFinance(); }, [fetchFinance]);

    // Calculate withdrawal preview (server-side formula: fee = 1%)
    const amountNum = typeof amount === 'number' ? amount : 0;
    const feeAmount = amountNum >= 5000 ? Math.round(amountNum * 0.01) : 0;
    const netAmount = amountNum - feeAmount;

    const validateForm = () => {
        const parsed = withdrawalSchema.safeParse({
            amount: amountNum,
            operatorName,
            phoneNumber,
            firstName,
            lastName,
        });
        if (!parsed.success) {
            const errs: FormErrors = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as string;
                if (!errs[key]) errs[key] = issue.message;
            }
            setFormErrors(errs);
            return false;
        }
        setFormErrors({});
        return true;
    };

    const handleWithdrawRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        setShowConfirm(true);
    };

    const handleConfirmWithdrawal = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/withdrawals/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum,
                    operatorName,
                    phoneNumber,
                    firstName,
                    lastName,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Demande de retrait soumise avec succès !');
                setShowConfirm(false);
                setAmount('');
                fetchFinance();
            } else {
                toast.error(data.error || 'Échec du retrait.');
                setShowConfirm(false);
            }
        } catch {
            toast.error('Erreur réseau.');
            setShowConfirm(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const kpis = finance
        ? [
            {
                label: 'CA Brut',
                value: finance.grossRevenue,
                icon: TrendingUp,
                color: 'text-slate-700 dark:text-zinc-300',
                bg: 'bg-slate-50 dark:bg-zinc-800',
            },
            {
                label: 'Frais Event Village',
                value: finance.evCommission,
                icon: ArrowDownCircle,
                color: 'text-red-600 dark:text-red-400',
                bg: 'bg-red-50 dark:bg-red-950/20',
            },
            {
                label: 'Revenu Net',
                value: finance.netRevenue,
                icon: CheckCircle2,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-950/20',
            },
            {
                label: 'Solde Disponible',
                value: finance.soldeDisponible,
                icon: Wallet,
                color: 'text-[#FF6B35]',
                bg: 'bg-orange-50 dark:bg-orange-950/20',
                highlight: true,
            },
        ]
        : [];

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-[#FF6B35]" />
                        Finances
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Revenus calculés côté serveur — toutes les transactions réelles
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={fetchFinance}
                    disabled={loading}
                >
                    Actualiser
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            {loading && !finance && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                    ))}
                </div>
            )}

            {finance && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {kpis.map((kpi) => {
                            const Icon = kpi.icon;
                            return (
                                <div
                                    key={kpi.label}
                                    className={`p-4 rounded-2xl border ${
                                        kpi.highlight
                                            ? 'border-[#FF6B35]/40 bg-orange-50 dark:bg-orange-950/20 shadow-sm'
                                            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                                    } space-y-2`}
                                >
                                    <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 ${kpi.color}`} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                            {kpi.label}
                                        </div>
                                        <div className={`text-base font-black mt-0.5 ${kpi.color}`}>
                                            {kpi.value.toLocaleString('fr-FR')}
                                            <span className="text-[10px] font-semibold ml-1">FCFA</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pending + withdrawn info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center gap-2 text-xs">
                            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <div>
                                <div className="font-bold text-amber-800 dark:text-amber-300">Retraits en attente</div>
                                <div className="font-black text-amber-700 dark:text-amber-400">
                                    {finance.pendingAmount.toLocaleString('fr-FR')} FCFA
                                </div>
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center gap-2 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                                <div className="font-bold text-slate-600 dark:text-zinc-300">Déjà retiré</div>
                                <div className="font-black text-slate-900 dark:text-white">
                                    {finance.totalWithdrawn.toLocaleString('fr-FR')} FCFA
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown toggle */}
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF6B35] transition-colors"
                        onClick={() => setShowBreakdown(!showBreakdown)}
                    >
                        <span>Détail par canal de revenus</span>
                        {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showBreakdown && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { label: 'Billetterie', icon: Ticket, data: finance.breakdown.tickets, note: 'Frais service payés par l\'acheteur' },
                                { label: 'Commandes', icon: ShoppingBag, data: finance.breakdown.orders, note: `Commission EV ${finance.breakdown.orders.commissionRate}%` },
                                { label: 'Salles', icon: Building2, data: finance.breakdown.halls, note: 'Frais agrégateur 1.5%' },
                            ].map(({ label, icon: Icon, data, note }) => (
                                <div key={label} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-[#FF6B35]" />
                                        <span className="text-xs font-black text-slate-900 dark:text-white">{label}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                                        <div className="flex justify-between">
                                            <span>CA Brut</span>
                                            <span className="font-bold text-slate-700 dark:text-zinc-300">
                                                {data.grossRevenue.toLocaleString('fr-FR')} F
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Net partenaire</span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                {data.netRevenue.toLocaleString('fr-FR')} F
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic">{note}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Withdrawal Form */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 space-y-5">
                <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-[#FF6B35]" />
                        Demander un retrait
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Minimum 5 000 FCFA · Frais 1% · Via Wave ou Orange Money
                    </p>
                </div>

                <form onSubmit={handleWithdrawRequest} className="space-y-4">
                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Montant à retirer (FCFA) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="5000"
                                placeholder="Ex: 50000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 pr-16 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">FCFA</span>
                        </div>
                        {formErrors.amount && <p className="mt-1 text-[11px] font-semibold text-red-500">{formErrors.amount}</p>}

                        {/* Live preview */}
                        {amountNum >= 5000 && (
                            <div className="mt-2 p-2.5 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-[11px] space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-zinc-400">Montant demandé</span>
                                    <span className="font-bold">{amountNum.toLocaleString('fr-FR')} FCFA</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-zinc-400">Frais retrait (1%)</span>
                                    <span className="font-bold text-red-600">− {feeAmount.toLocaleString('fr-FR')} FCFA</span>
                                </div>
                                <div className="flex justify-between border-t border-orange-200 dark:border-orange-900/40 pt-1">
                                    <span className="font-black text-slate-700 dark:text-zinc-200">Vous recevrez</span>
                                    <span className="font-black text-[#FF6B35]">{netAmount.toLocaleString('fr-FR')} FCFA</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Operator */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Opérateur <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['WAVE', 'ORANGE_MONEY'] as const).map((op) => (
                                <button
                                    key={op}
                                    type="button"
                                    onClick={() => setOperatorName(op)}
                                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                                        operatorName === op
                                            ? 'border-[#FF6B35] bg-orange-50 dark:bg-orange-950/20 text-[#FF6B35]'
                                            : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                                    }`}
                                >
                                    {op === 'WAVE' ? '🌊 Wave' : '🟠 Orange Money'}
                                </button>
                            ))}
                        </div>
                        {formErrors.operatorName && <p className="mt-1 text-[11px] font-semibold text-red-500">{formErrors.operatorName}</p>}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Numéro {operatorName === 'WAVE' ? 'Wave' : 'Orange Money'} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            placeholder="Ex: 77 123 45 67"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                        />
                        {formErrors.phoneNumber && <p className="mt-1 text-[11px] font-semibold text-red-500">{formErrors.phoneNumber}</p>}
                    </div>

                    {/* Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Prénom <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                            />
                            {formErrors.firstName && <p className="mt-1 text-[11px] font-semibold text-red-500">{formErrors.firstName}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Nom <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                            />
                            {formErrors.lastName && <p className="mt-1 text-[11px] font-semibold text-red-500">{formErrors.lastName}</p>}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        disabled={!finance || amountNum < 5000 || amountNum > (finance?.soldeDisponible || 0)}
                        leftIcon={<Send className="w-4 h-4" />}
                    >
                        {amountNum > 0 && finance && amountNum > finance.soldeDisponible
                            ? `Solde insuffisant (max ${finance.soldeDisponible.toLocaleString('fr-FR')} F)`
                            : 'Demander le retrait'}
                    </Button>
                </form>
            </div>

            {/* Withdrawal history */}
            <div className="space-y-3">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">Historique des retraits</h2>

                {withdrawals.length === 0 ? (
                    <EmptyState
                        title="Aucun retrait"
                        description="Vous n'avez pas encore effectué de demande de retrait."
                        icon={<Wallet size={28} />}
                    />
                ) : (
                    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {withdrawals.map((w) => (
                                <div key={w.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={w.status} />
                                            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                                                {w.payment_details?.operatorName || 'Mobile Money'}
                                                {w.payment_details?.phoneNumber && ` · ${w.payment_details.phoneNumber}`}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                                            {new Date(w.created_at).toLocaleString('fr-FR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                            {w.processed_at && ` · Traité le ${new Date(w.processed_at).toLocaleDateString('fr-FR')}`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-slate-900 dark:text-white">
                                            {w.gross_amount.toLocaleString('fr-FR')} FCFA
                                        </div>
                                        <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                                            Net : {w.net_amount.toLocaleString('fr-FR')} F · Frais : {w.fee_amount.toLocaleString('fr-FR')} F
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm dialog */}
            <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmWithdrawal}
                title="Confirmer le retrait"
                message={`Vous allez retirer ${amountNum.toLocaleString('fr-FR')} FCFA via ${operatorName === 'WAVE' ? 'Wave' : 'Orange Money'} (${phoneNumber}). Frais : ${feeAmount.toLocaleString('fr-FR')} FCFA. Vous recevrez ${netAmount.toLocaleString('fr-FR')} FCFA. Cette opération est irréversible.`}
                confirmLabel="Confirmer le retrait"
                variant="warning"
                isLoading={isSubmitting}
            />
        </div>
    );
}
