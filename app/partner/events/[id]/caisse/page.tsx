'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, KeyRound, Copy, Check, ShieldAlert,
    Banknote, Receipt, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, Loader2, Users, FileText, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ZSummaryModal } from '@/components/shifts/ShiftModals';
import type { Shift, ShiftSummary } from '@/lib/shifts/shift.service';

export default function PartnerEventCaissePage() {
    const { id: eventId } = useParams<{ id: string }>();
    const router = useRouter();
    const toast = useToast();

    const [eventTitle, setEventTitle]   = useState('');
    const [eventStatus, setEventStatus] = useState('');
    const [shifts, setShifts]           = useState<Shift[]>([]);
    const [loading, setLoading]         = useState(true);

    // PIN Generation state
    const [generatingPin, setGeneratingPin] = useState(false);
    const [generatedPin, setGeneratedPin]   = useState<string | null>(null);
    const [pinCopied, setPinCopied]         = useState(false);
    const [showPinModal, setShowPinModal]   = useState(false);
    // Lot 4.7 : régénération confirmée ; seconde confirmation si des caisses sont ouvertes (409 OPEN_SHIFTS)
    const [pinConfirm, setPinConfirm] = useState<{ step: 'confirm' } | { step: 'open_shifts'; count: number } | null>(null);

    // Inspection Z modal
    const [selectedSummary, setSelectedSummary] = useState<ShiftSummary | null>(null);
    const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);

    const fetchEventData = useCallback(async () => {
        try {
            const [evRes, shiftsRes] = await Promise.all([
                fetch(`/api/partner/events/${eventId}`),
                fetch(`/api/partner/events/${eventId}/shifts`),
            ]);

            const evData = await evRes.json();
            if (evData.event) {
                setEventTitle(evData.event.title || 'Événement');
                setEventStatus(evData.event.status || '');
            }

            const shiftsData = await shiftsRes.json();
            if (shiftsData.success) {
                setShifts(shiftsData.shifts || []);
            }
        } catch {
            toast.error('Impossible de charger les données de caisse.');
        } finally {
            setLoading(false);
        }
    }, [eventId, toast]);

    useEffect(() => {
        if (eventId) fetchEventData();
    }, [eventId, fetchEventData]);

    // Génération du PIN Régisseur : toujours confirmée ; caisses ouvertes → confirmation explicite
    const requestPin = async (confirmOpenShifts: boolean) => {
        setGeneratingPin(true);
        try {
            const res = await fetch(`/api/partner/events/${eventId}/regisseur-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true, confirmOpenShifts }),
            });
            const data = await res.json();
            if (res.status === 409 && data.code === 'OPEN_SHIFTS') {
                setPinConfirm({ step: 'open_shifts', count: Number(data.open_shifts) || openShiftsCount });
                return;
            }
            if (!res.ok || !data.success) {
                setPinConfirm(null);
                toast.error(data.error || 'Erreur lors de la génération du code PIN.');
                return;
            }

            setPinConfirm(null);
            setGeneratedPin(data.pin);
            setShowPinModal(true);
            toast.success('Nouveau code PIN régisseur généré.');
        } catch {
            toast.error('Erreur réseau.');
        } finally {
            setGeneratingPin(false);
        }
    };

    const handleCopyPin = () => {
        if (!generatedPin) return;
        navigator.clipboard.writeText(generatedPin);
        setPinCopied(true);
        setTimeout(() => setPinCopied(false), 2500);
        toast.success('Code PIN copié dans le presse-papier.');
    };

    // Consultation du résumé Z de caisse
    const handleViewSummary = async (shiftId: string) => {
        setLoadingSummaryId(shiftId);
        try {
            const res = await fetch(`/api/controller/shifts/${shiftId}/summary`);
            const data = await res.json();
            if (data.success && data.summary) {
                setSelectedSummary(data.summary);
            } else {
                toast.error(data.error || 'Impossible de charger le ticket Z.');
            }
        } catch {
            toast.error('Erreur réseau.');
        } finally {
            setLoadingSummaryId(null);
        }
    };

    // Calcul des KPI consolidés
    const totalOpeningFloat = shifts.reduce((acc, s) => acc + (Number(s.opening_float_amount) || 0), 0);
    const totalExpectedCash = shifts.reduce((acc, s) => acc + (Number(s.expected_cash_total) || 0), 0);
    const totalDeclaredCash = shifts.reduce((acc, s) => acc + (Number(s.declared_cash_total) || 0), 0);
    // Écart : sessions clôturées seulement (une session ouverte n'a pas encore d'écart, partner-ux-15)
    const totalDiscrepancy  = shifts
        .filter(s => s.status !== 'OUVERT')
        .reduce((acc, s) => acc + (Number(s.discrepancy_amount) || 0), 0);
    const openShiftsCount   = shifts.filter(s => s.status === 'OUVERT').length;
    const discrepancyNeutral = openShiftsCount > 0 && totalDiscrepancy === 0;
    const closedShiftsCount = shifts.filter(s => s.status === 'CLOTURE').length;
    const disputeShiftsCount= shifts.filter(s => s.status === 'LITIGE').length;

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

            {/* Barre de navigation / Fil d'ariane */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/partner/events/${eventId}/team`}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Retour à l'équipe"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-slate-900 dark:text-white">Z de Caisse & Sessions</h1>
                            {eventStatus && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                    {eventStatus}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{eventTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={`/partner/events/${eventId}/team`}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                    >
                        <Users size={14} /> Gérer l&apos;équipe
                    </Link>
                    <Button
                        onClick={fetchEventData}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="text-xs font-bold"
                    >
                        <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
                    </Button>
                </div>
            </div>

            {/* ── Section 1 : Carte PIN Régisseur ── */}
            <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500 text-white">
                            <KeyRound size={18} />
                        </div>
                        <h2 className="text-base font-black text-slate-900 dark:text-white">Code PIN Régisseur de Caisse</h2>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                        Le code PIN régisseur co-signe la clôture de chaque caisse (procès-verbal Z) et peut valider son ouverture (remise du fond de caisse). Seule son empreinte salée est conservée : générer un nouveau code annule l&apos;ancien.
                    </p>
                </div>

                <Button
                    onClick={() => setPinConfirm({ step: 'confirm' })}
                    disabled={generatingPin}
                    className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm py-2.5 px-4 rounded-xl"
                >
                    {generatingPin ? (
                        <Loader2 size={16} className="animate-spin mr-1.5" />
                    ) : (
                        <KeyRound size={15} className="mr-1.5" />
                    )}
                    Générer un code PIN Régisseur
                </Button>
            </div>

            {/* ── Section 2 : Cartes KPI de Caisse ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Sessions Actives / Total */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Sessions</span>
                        <Receipt size={16} />
                    </div>
                    <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">{shifts.length}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">{openShiftsCount} ouvertes</span>
                        <span>•</span>
                        <span>{closedShiftsCount} closes</span>
                    </p>
                </div>

                {/* 2. Total Fonds de Caisse */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Fonds Engagés</span>
                        <Banknote size={16} />
                    </div>
                    <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                        {totalOpeningFloat.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Avances initiales régisseur</p>
                </div>

                {/* 3. Espèces Encaissées (Attendu) */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Espèces Perçues</span>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        +{totalExpectedCash.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Billets physiques réglés</p>
                </div>

                {/* 4. Écart Net Global */}
                <div className={`p-4 rounded-2xl border shadow-sm space-y-1 ${
                    discrepancyNeutral
                        ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                        : totalDiscrepancy === 0
                            ? 'bg-emerald-500/5 border-emerald-500/30'
                            : totalDiscrepancy < 0
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Écart (sessions clôturées)</span>
                        <AlertTriangle size={16} className={discrepancyNeutral ? 'text-slate-400' : totalDiscrepancy === 0 ? 'text-emerald-500' : 'text-red-500'} />
                    </div>
                    <p className={`text-2xl font-black font-mono ${
                        discrepancyNeutral
                            ? 'text-slate-900 dark:text-white'
                            : totalDiscrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                        {totalDiscrepancy > 0 ? `+${totalDiscrepancy.toLocaleString('fr-FR')}` : totalDiscrepancy.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {openShiftsCount > 0
                            ? `${openShiftsCount} session(s) encore ouverte(s) : écart provisoire`
                            : totalDiscrepancy === 0 ? 'Aucun écart sur les sessions clôturées' : 'Divergences constatées'}
                    </p>
                </div>
            </div>

            {/* ── Section 3 : Liste des Sessions de Caisse ── */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Historique des Sessions de Caisse ({shifts.length})
                    </h3>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                        <Loader2 size={24} className="animate-spin mx-auto text-[#FF5722]" />
                        <p className="text-xs">Chargement des sessions...</p>
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                        <Receipt size={32} className="mx-auto text-slate-300 dark:text-zinc-700" />
                        <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">Aucune session de caisse pour le moment</p>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                            Dès qu&apos;un contrôleur habilité ouvre sa session de caisse, son activité apparaîtra ici en temps réel.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-3.5">Contrôleur</th>
                                    <th className="p-3.5">Statut</th>
                                    <th className="p-3.5">Horodatages</th>
                                    <th className="p-3.5 text-right">Fond initial</th>
                                    <th className="p-3.5 text-right">Attendu</th>
                                    <th className="p-3.5 text-right">Déclaré</th>
                                    <th className="p-3.5 text-right">Écart</th>
                                    <th className="p-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                                {shifts.map((s) => {
                                    const userObj = s.users;
                                    const ctrlName = userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : 'Contrôleur';
                                    const hasDiscrepancy = s.discrepancy_amount !== null && s.discrepancy_amount !== 0;

                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                                                <p className="truncate max-w-[140px]">{ctrlName || 'Contrôleur'}</p>
                                                {userObj?.phone && <p className="text-[10px] text-slate-400 font-normal">{userObj.phone}</p>}
                                            </td>
                                            <td className="p-3.5">
                                                {s.status === 'OUVERT' ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Ouvert
                                                    </span>
                                                ) : s.status === 'CLOTURE' ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                                        Clôturé
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                                        Litige
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-[11px] text-slate-500 dark:text-zinc-400">
                                                <p>Ouv: {new Date(s.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                {s.closed_at && <p>Clôt: {new Date(s.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>}
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold text-slate-600 dark:text-zinc-400">
                                                {Number(s.opening_float_amount).toLocaleString('fr-FR')} F
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                +{Number(s.expected_cash_total).toLocaleString('fr-FR')} F
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold">
                                                {s.declared_cash_total !== null ? `${Number(s.declared_cash_total).toLocaleString('fr-FR')} F` : '—'}
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-black">
                                                {s.discrepancy_amount === null ? (
                                                    <span className="text-slate-400">—</span>
                                                ) : s.discrepancy_amount === 0 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">0 F</span>
                                                ) : (
                                                    <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900">
                                                        {s.discrepancy_amount > 0 ? `+${s.discrepancy_amount.toLocaleString('fr-FR')}` : `${s.discrepancy_amount.toLocaleString('fr-FR')}`} F
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleViewSummary(s.id)}
                                                    disabled={loadingSummaryId === s.id}
                                                    className="text-xs font-bold text-[#FF5722] hover:bg-[#FF5722]/10"
                                                >
                                                    {loadingSummaryId === s.id ? (
                                                        <Loader2 size={13} className="animate-spin" />
                                                    ) : (
                                                        <FileText size={14} className="mr-1" />
                                                    )}
                                                    Voir Z
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal Affichage Unique du Code PIN ── */}
            {showPinModal && generatedPin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-amber-500/40 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                            <div className="p-2 rounded-xl bg-amber-500 text-white">
                                <KeyRound size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">Code PIN Régisseur Généré</h3>
                                <p className="text-[11px] text-amber-600 font-bold">Affichage Unique — Sécurité Renforcée</p>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-zinc-950 border-2 border-dashed border-amber-400 text-center space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Code PIN de Session</span>
                            <p className="text-3xl font-black font-mono tracking-widest text-slate-900 dark:text-white">
                                {generatedPin}
                            </p>
                            <div className="pt-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleCopyPin}
                                    variant="outline"
                                    className="text-xs font-bold border-amber-400 text-amber-700 dark:text-amber-300"
                                >
                                    {pinCopied ? <Check size={14} className="mr-1 text-emerald-500" /> : <Copy size={14} className="mr-1" />}
                                    {pinCopied ? 'Code copié !' : 'Copier le code PIN'}
                                </Button>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs flex items-start gap-2 leading-relaxed">
                            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                            <span>
                                <strong>ATTENTION :</strong> Ce code secret ne sera <u>plus jamais affiché</u>. Transmettez-le directement et exclusivement au régisseur physique présent sur les lieux pour co-signer les sessions de caisse.
                            </span>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button
                                onClick={() => setShowPinModal(false)}
                                className="bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold text-xs"
                            >
                                J&apos;ai bien noté le code PIN
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirmations de génération du PIN ── */}
            <ConfirmDialog
                isOpen={pinConfirm !== null}
                onClose={() => { if (!generatingPin) setPinConfirm(null); }}
                onConfirm={() => requestPin(pinConfirm?.step === 'open_shifts')}
                isLoading={generatingPin}
                variant={pinConfirm?.step === 'open_shifts' ? 'danger' : 'warning'}
                title={pinConfirm?.step === 'open_shifts' ? 'Des caisses sont encore ouvertes' : 'Générer un nouveau code PIN ?'}
                message={pinConfirm?.step === 'open_shifts'
                    ? `${pinConfirm.count} caisse(s) ouverte(s) : leur clôture exigera le nouveau code. Transmettez-le aux contrôleurs concernés. Régénérer quand même ?`
                    : 'L’ancien code régisseur cessera immédiatement d’être valable. Transmettez le nouveau code au régisseur présent sur place.'}
                confirmLabel={pinConfirm?.step === 'open_shifts' ? 'Régénérer quand même' : 'Générer le code'}
            />

            {/* ── Modal Ticket Z de Caisse ── */}
            <ZSummaryModal
                isOpen={!!selectedSummary}
                onClose={() => setSelectedSummary(null)}
                summary={selectedSummary}
            />

        </div>
    );
}
