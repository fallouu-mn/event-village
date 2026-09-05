'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, ShieldCheck, Calendar,
    MapPin, KeyRound, Eye, EyeOff, CheckCircle2, Loader2,
    Banknote, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface Assignment {
    id: string;
    can_accept_cash: boolean;
    created_at: string;
    events: {
        id: string;
        title: string;
        date: string;
        location: string;
        status: string;
    } | null;
}

interface ControllerProfile {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
    status: string;
    created_at: string;
}

export default function ControllerProfilePage() {
    const toast = useToast();

    const [profile, setProfile] = useState<ControllerProfile | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    // Changement mot de passe
    const [currentPwd, setCurrentPwd]   = useState('');
    const [newPwd, setNewPwd]           = useState('');
    const [confirmPwd, setConfirmPwd]   = useState('');
    const [showPwd, setShowPwd]         = useState(false);
    const [saving, setSaving]           = useState(false);
    const [pwdError, setPwdError]       = useState('');

    useEffect(() => {
        fetch('/api/controller/profile')
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setProfile(data.profile);
                    setAssignments(data.assignments ?? []);
                }
            })
            .catch(() => toast.error('Impossible de charger le profil.'))
            .finally(() => setLoading(false));
    }, [toast]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError('');

        if (newPwd !== confirmPwd) {
            setPwdError('Les mots de passe ne correspondent pas.');
            return;
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPwd)) {
            setPwdError('Majuscule, minuscule, chiffre, 8+ caractères requis.');
            return;
        }

        setSaving(true);
        try {
            const res  = await fetch('/api/controller/profile', {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');
            toast.success('Mot de passe mis à jour avec succès.');
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
        } catch (err: unknown) {
            setPwdError(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setSaving(false);
        }
    };

    const displayName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Contrôleur'
        : '';

    const displayPhone = profile?.phone?.replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') ?? '';

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/controller/scanner"
                    aria-label="Retour au scanner"
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-600 dark:text-zinc-400" />
                </Link>
                <div>
                    <h1 className="text-base font-black text-slate-900 dark:text-white">Mon Profil</h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Informations et sécurité</p>
                </div>
            </div>

            {/* Identité */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center shrink-0">
                        <span className="text-lg font-black text-[#FF5722]">
                            {displayName[0]?.toUpperCase() ?? 'C'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{displayName}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20">
                            <ShieldCheck size={10} /> Contrôleur
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                    <Phone size={13} className="text-slate-400" />
                    <span className="font-mono font-bold">{displayPhone || '—'}</span>
                </div>

                {profile?.created_at && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                        <Calendar size={13} />
                        <span>Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                )}
            </div>

            {/* Événements assignés */}
            <div className="space-y-3">
                <h2 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Mes événements ({assignments.length})
                </h2>

                {assignments.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                        <p className="text-xs text-slate-400 dark:text-zinc-500">Aucun événement assigné.</p>
                    </div>
                ) : (
                    assignments.map(a => (
                        <div
                            key={a.id}
                            className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1.5"
                        >
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {a.events?.title ?? 'Événement'}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                {a.events?.date && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <Calendar size={10} />
                                        {new Date(a.events.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                                {a.events?.location && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <MapPin size={10} />
                                        {a.events.location}
                                    </span>
                                )}
                                {a.can_accept_cash ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        <Banknote size={10} /> Encaissement autorisé
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <AlertCircle size={10} /> Sans encaissement
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Changement mot de passe */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <KeyRound size={15} className="text-[#FF5722]" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Changer le mot de passe</h2>
                </div>

                {pwdError && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30">
                        <p className="text-xs text-red-600 dark:text-red-400">{pwdError}</p>
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3">
                    {/* Mot de passe actuel */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                            Mot de passe actuel
                        </label>
                        <div className="relative">
                            <input
                                type={showPwd ? 'text' : 'password'}
                                value={currentPwd}
                                onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); }}
                                placeholder="••••••••"
                                required
                                className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs focus:outline-none focus:border-[#FF5722]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPwd(!showPwd)}
                                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Nouveau mot de passe */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                            Nouveau mot de passe
                        </label>
                        <input
                            type={showPwd ? 'text' : 'password'}
                            value={newPwd}
                            onChange={e => { setNewPwd(e.target.value); setPwdError(''); }}
                            placeholder="Majuscule, minuscule, chiffre, 8+ car."
                            required
                            minLength={8}
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs focus:outline-none focus:border-[#FF5722]"
                        />
                    </div>

                    {/* Confirmation */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                            Confirmer le nouveau mot de passe
                        </label>
                        <input
                            type={showPwd ? 'text' : 'password'}
                            value={confirmPwd}
                            onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
                            placeholder="Répétez le nouveau mot de passe"
                            required
                            className={`w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-xs focus:outline-none ${
                                confirmPwd && newPwd !== confirmPwd
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-slate-200 dark:border-zinc-700 focus:border-[#FF5722]'
                            }`}
                        />
                        {confirmPwd && newPwd !== confirmPwd && (
                            <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                        )}
                    </div>

                    <Button
                        variant="primary"
                        fullWidth
                        size="lg"
                        isLoading={saving}
                        disabled={!currentPwd || !newPwd || newPwd !== confirmPwd}
                        leftIcon={<CheckCircle2 size={15} />}
                    >
                        Mettre à jour le mot de passe
                    </Button>
                </form>
            </div>
        </div>
    );
}
