'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
    KeyRound,
    Eye,
    EyeOff,
    ShieldCheck,
    Check,
    X,
    Lock,
    Clock,
    AlertCircle,
    AlertTriangle,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { getBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

// =========================================================================
// 🛡️ ANTI-FORCE BRUTE — RESET FLOW
// =========================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_reset_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_reset_failed_attempts';


export default function ResetPasswordPage() {
    const router = useRouter();
    const toast = useToast();

    const [isCheckingSession, setIsCheckingSession] = useState(true);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // ── Anti-brute-force state ──────────────────────────────────────────────
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const [initialLockoutDuration, setInitialLockoutDuration] = useState(LOCKOUT_DURATION_SECONDS);

    // ── 1. Garde de session ────────────────────────────────────────────────
    // Accepte deux flux :
    //   A. Flux téléphone/OTP  → sessionStorage flag 'ev_recovery_verified' + session Supabase
    //   B. Flux email          → session Supabase créée par le clic sur le lien magique
    //       ⚠️ Le hash fragment (#access_token=...&type=recovery) est traité de manière
    //       asynchrone par le client Supabase. getSession() seul peut retourner null
    //       avant que le hash ne soit consommé → on écoute aussi onAuthStateChange.
    useEffect(() => {
        const supabase = getBrowserClient();
        let cancelled = false;
        let fallbackTimer: ReturnType<typeof setTimeout>;

        const grant = () => {
            if (cancelled) return;
            // Nettoyer le flag OTP expiré (>15 min) mais laisser passer
            try {
                const flag = sessionStorage.getItem('ev_recovery_verified');
                const ts = sessionStorage.getItem('ev_recovery_ts');
                if (flag && ts) {
                    const age = Date.now() - parseInt(ts, 10);
                    if (age > 15 * 60 * 1000) {
                        sessionStorage.removeItem('ev_recovery_verified');
                        sessionStorage.removeItem('ev_recovery_ts');
                    }
                }
            } catch {}
            setIsCheckingSession(false);
        };

        const deny = () => {
            if (cancelled) return;
            router.replace('/login?error=session_expired');
        };

        // Écouter PASSWORD_RECOVERY pour le flux email (hash fragment asynchrone)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            if (event === 'PASSWORD_RECOVERY' && session) {
                clearTimeout(fallbackTimer);
                grant();
            }
        });

        // Vérifier si une session existe déjà (flux OTP ou revisit)
        supabase.auth.getSession().then(({ data: { session } }: any) => {
            if (session) {
                grant();
            } else {
                // Pas de session immédiate — laisser 4s pour que le hash fragment
                // soit traité par le client Supabase (flux email)
                fallbackTimer = setTimeout(deny, 4000);
            }
        }).catch(() => {
            fallbackTimer = setTimeout(deny, 4000);
        });

        return () => {
            cancelled = true;
            clearTimeout(fallbackTimer);
            subscription.unsubscribe();
        };
    }, [router]);

    // ── 2. Lecture localStorage anti-brute-force ───────────────────────────
    useEffect(() => {
        try {
            const storedAttempts = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
            const storedLockout = localStorage.getItem(STORAGE_KEY_LOCKOUT);

            if (storedAttempts) {
                const count = parseInt(storedAttempts, 10);
                if (!isNaN(count)) setFailedAttempts(count);
            }

            if (storedLockout) {
                const lockoutUntil = parseInt(storedLockout, 10);
                const now = Date.now();
                if (!isNaN(lockoutUntil) && lockoutUntil > now) {
                    const remaining = Math.ceil((lockoutUntil - now) / 1000);
                    setIsLockedOut(true);
                    setLockoutRemaining(remaining);
                    setInitialLockoutDuration(Math.max(LOCKOUT_DURATION_SECONDS, remaining));
                } else {
                    localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                    localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
                }
            }
        } catch {}
    }, []);

    // ── 3. Décompte verrouillage ───────────────────────────────────────────
    useEffect(() => {
        if (!isLockedOut || lockoutRemaining <= 0) return;
        const interval = setInterval(() => {
            setLockoutRemaining((prev) => {
                if (prev <= 1) {
                    setIsLockedOut(false);
                    setFailedAttempts(0);
                    try {
                        localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                        localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
                    } catch {}
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isLockedOut, lockoutRemaining]);

    // ── Critères ───────────────────────────────────────────────────────────
    const allCriteriaMet = allPasswordCriteriaMet(password);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

    // ── Enregistrement d'un échec ──────────────────────────────────────────
    const recordFailedAttempt = (msg: string) => {
        let current = 0;
        try {
            const stored = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
            if (stored) current = parseInt(stored, 10) || 0;
        } catch {}

        const next = current + 1;
        setFailedAttempts(next);
        try { localStorage.setItem(STORAGE_KEY_ATTEMPTS, next.toString()); } catch {}

        if (next >= MAX_FAILED_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
            try { localStorage.setItem(STORAGE_KEY_LOCKOUT, until.toString()); } catch {}
            setIsLockedOut(true);
            setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
            setInitialLockoutDuration(LOCKOUT_DURATION_SECONDS);
            setErrorMessage(null);
        } else {
            const remaining = MAX_FAILED_ATTEMPTS - next;
            const warn = `(${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage)`;
            setErrorMessage(`${msg} ${warn}`);
        }
    };

    // ── Soumission ─────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut || isLoading) return;

        setErrorMessage(null);

        if (!allCriteriaMet) {
            setErrorMessage('Votre mot de passe ne respecte pas tous les critères de sécurité.');
            return;
        }

        if (!passwordsMatch) {
            setErrorMessage('Les mots de passe ne correspondent pas.');
            return;
        }

        setIsLoading(true);

        try {
            const supabase = getBrowserClient();
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                recordFailedAttempt(error.message || 'Impossible de mettre à jour le mot de passe.');
                return;
            }

            // Nettoyer le flag de recovery
            try {
                sessionStorage.removeItem('ev_recovery_verified');
                sessionStorage.removeItem('ev_recovery_ts');
            } catch {}

            // Nettoyer le compteur d'échecs
            try {
                localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
            } catch {}

            // Révoquer TOUTES les sessions (tous appareils) via admin API
            const currentSession = (await supabase.auth.getSession()).data.session;
            if (currentSession?.access_token) {
                await fetch('/api/auth/sign-out-global', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${currentSession.access_token}` },
                });
            }
            await supabase.auth.signOut();

            toast.success('Mot de passe mis à jour avec succès. Veuillez vous connecter.');

            router.replace('/login?reset=success');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Une erreur inattendue s\'est produite.';
            recordFailedAttempt(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const progressPercent = initialLockoutDuration > 0
        ? Math.max(0, Math.min(100, (lockoutRemaining / initialLockoutDuration) * 100))
        : 0;

    // ── Écran de vérification de session ──────────────────────────────────
    if (isCheckingSession) {
        return (
            <div className="min-h-[85vh] flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto animate-pulse">
                        <Lock size={24} className="text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                        Vérification de la session sécurisée…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <Logo variant="full" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Nouveau mot de passe
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        Choisissez un mot de passe fort pour sécuriser votre compte.
                    </p>
                </div>

                {/* Carte Formulaire */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-6 relative transition-all duration-300">

                    {/* 🔒 BANNIÈRE VERROUILLAGE SÉCURITÉ */}
                    {isLockedOut && (
                        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-red-500/15 via-red-500/5 to-amber-500/10 border-2 border-red-500/40 dark:border-red-500/50 shadow-xl shadow-red-500/10 animate-in fade-in duration-300 space-y-4">
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-black text-red-700 dark:text-red-300 tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                <span>Verrouillé</span>
                            </div>

                            <div className="flex items-start gap-3.5 pr-20">
                                <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0 shadow-inner">
                                    <Lock size={22} className="animate-bounce duration-1000" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-red-950 dark:text-red-200 tracking-tight">
                                        Protection Anti-Intrusion
                                    </h3>
                                    <p className="text-[11px] text-red-900/80 dark:text-red-300/80 leading-relaxed">
                                        5 tentatives de soumission échouées. L&apos;accès est temporairement bloqué.
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/90 border border-red-200 dark:border-red-900/60 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    <Clock size={15} className="text-red-500 animate-spin duration-3000" />
                                    <span>Déverrouillage dans :</span>
                                </div>
                                <div className="px-3 py-1 rounded-xl bg-red-500 text-white font-mono text-sm font-black tracking-widest shadow-sm">
                                    {lockoutRemaining < 10 ? `0${lockoutRemaining}s` : `${lockoutRemaining}s`}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="w-full h-1.5 rounded-full bg-red-200/60 dark:bg-red-950/80 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-red-500 to-[#FF5722] transition-all duration-1000 ease-linear rounded-full"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Avertissement tentatives */}
                    {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2.5">
                            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                            <span>
                                <strong>Attention :</strong> {failedAttempts}/{MAX_FAILED_ATTEMPTS} tentatives échouées.
                            </span>
                        </div>
                    )}

                    {/* Message d'erreur */}
                    {errorMessage && !isLockedOut && (
                        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Champ Nouveau mot de passe */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                Nouveau mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                    disabled={isLockedOut || isLoading}
                                    className={clsx(
                                        'w-full px-4 py-3 pr-11 rounded-2xl bg-slate-50 dark:bg-zinc-900 border text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none transition-all',
                                        password.length > 0 && allCriteriaMet
                                            ? 'border-emerald-500 focus:border-emerald-500'
                                            : password.length > 0
                                            ? 'border-amber-400 focus:border-amber-400'
                                            : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722]',
                                        isLockedOut && 'opacity-50 cursor-not-allowed'
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Checklist de robustesse */}
                        <PasswordStrengthChecklist password={password} />

                        {/* Champ Confirmation */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                Confirmer le mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                    disabled={isLockedOut || isLoading}
                                    className={clsx(
                                        'w-full px-4 py-3 pr-11 rounded-2xl bg-slate-50 dark:bg-zinc-900 border text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none transition-all',
                                        confirmPassword.length > 0 && passwordsMatch
                                            ? 'border-emerald-500 focus:border-emerald-500'
                                            : confirmPassword.length > 0
                                            ? 'border-red-400 focus:border-red-400'
                                            : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722]',
                                        isLockedOut && 'opacity-50 cursor-not-allowed'
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm((v) => !v)}
                                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && (
                                <p className={clsx(
                                    'text-[10px] font-bold mt-1.5 flex items-center gap-1',
                                    passwordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                                )}>
                                    {passwordsMatch
                                        ? <><Check size={11} strokeWidth={3} /> Les mots de passe correspondent</>
                                        : <><X size={11} strokeWidth={3} /> Les mots de passe ne correspondent pas</>
                                    }
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                            disabled={isLockedOut || isLoading || !allCriteriaMet || !passwordsMatch}
                            leftIcon={isLockedOut ? <Lock size={18} /> : <ShieldCheck size={18} />}
                        >
                            {isLockedOut ? `Verrouillé (${lockoutRemaining}s)` : 'Définir le nouveau mot de passe'}
                        </Button>
                    </form>

                    {/* Note sécurité */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex items-start gap-2.5">
                        <KeyRound size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                            Après confirmation, votre session actuelle sera automatiquement déconnectée pour garantir la sécurité de votre compte.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
