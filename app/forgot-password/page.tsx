'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
    KeyRound,
    Phone,
    Mail,
    ArrowLeft,
    ShieldCheck,
    AlertCircle,
    RotateCcw,
    Lock,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Send,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';

// =========================================================================
// 🛡️ ANTI-FORCE BRUTE — RECOVERY FLOW
// =========================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_recovery_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_recovery_failed_attempts';

type FlowMode = 'email' | 'phone' | null;
type Step = 1 | 2 | 'email-sent';

function detectMode(value: string): FlowMode {
    if (value.includes('@')) return 'email';
    const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
    if (/^(\+221|00221|221)?[7][05678]\d{7}$/.test(cleaned) || /^\d{8,9}$/.test(cleaned)) return 'phone';
    if (cleaned.length > 3) return value.includes('@') ? 'email' : null;
    return null;
}

export default function ForgotPasswordPage() {
    const router = useRouter();

    // ── État principal ─────────────────────────────────────────────────────
    const [identifier, setIdentifier] = useState('');
    const [step, setStep] = useState<Step>(1);
    const [inputMode, setInputMode] = useState<FlowMode>(null);
    const [otpCode, setOtpCode] = useState('');
    const [countdown, setCountdown] = useState(0);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ── Anti-brute-force state ──────────────────────────────────────────────
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const [initialLockoutDuration, setInitialLockoutDuration] = useState(LOCKOUT_DURATION_SECONDS);

    // Détection dynamique du mode à chaque frappe
    const handleIdentifierChange = (val: string) => {
        setIdentifier(val);
        setInputMode(detectMode(val));
        setErrorMessage(null);
    };

    // ── 1. Lecture localStorage au montage ────────────────────────────────
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

    // ── 2. Décompte verrouillage ───────────────────────────────────────────
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
                    setSuccessMessage('Accès déverrouillé. Vous pouvez réessayer.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isLockedOut, lockoutRemaining]);

    // ── 3. Enregistrement d'un échec ──────────────────────────────────────
    const recordFailedAttempt = useCallback((msg?: string) => {
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
            setErrorMessage(msg ? `${msg} ${warn}` : `Identifiant incorrect. ${warn}`);
        }
    }, []);

    // ── 4. Décompte renvoi SMS ─────────────────────────────────────────────
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // =========================================================================
    // FLUX EMAIL : resetPasswordForEmail (Supabase natif)
    // =========================================================================
    const handleEmailRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut) return;

        const email = identifier.trim().toLowerCase();
        if (!email.includes('@') || !email.includes('.')) {
            setErrorMessage('Adresse email invalide. Vérifiez votre saisie.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const supabase = getBrowserClient();
            const redirectTo = typeof window !== 'undefined'
                ? `${window.location.origin}/reset-password`
                : '/reset-password';

            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

            if (error) {
                // Ne pas révéler si l'email existe en base (sécurité)
                if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
                    setInitialLockoutDuration(LOCKOUT_DURATION_SECONDS);
                    setErrorMessage(null);
                    return;
                }
                // Erreur silencieuse pour ne pas révéler l'existence du compte
            }

            // Toujours afficher le succès (même si l'email n'existe pas — sécurité)
            setStep('email-sent');
        } catch {
            setStep('email-sent'); // Afficher succès même en cas d'exception réseau
        } finally {
            setIsLoading(false);
        }
    };

    // =========================================================================
    // FLUX TÉLÉPHONE : Envoi OTP via API
    // =========================================================================
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isLockedOut) return;

        setErrorMessage(null);
        setSuccessMessage(null);

        const normalizedPhone = normalizePhoneNumber(identifier.trim());
        if (!/^\+221[7][05678]\d{7}$/.test(normalizedPhone)) {
            setErrorMessage('Veuillez saisir un numéro de téléphone sénégalais valide (ex: 77 123 45 67).');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, purpose: 'PASSWORD_RESET' }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(data.remainingSeconds || LOCKOUT_DURATION_SECONDS);
                    setInitialLockoutDuration(data.remainingSeconds || LOCKOUT_DURATION_SECONDS);
                    setErrorMessage(null);
                    return;
                }
                throw new Error(data.error || "Impossible d'envoyer le code SMS.");
            }

            setStep(2);
            setCountdown(60);
            setOtpCode('');
            setSuccessMessage(`Code de récupération envoyé par SMS au ${normalizedPhone}.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Impossible d'envoyer le code SMS.";
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Soumission étape 1 : router vers le bon flux ───────────────────────
    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputMode === 'email') return handleEmailRecovery(e);
        if (inputMode === 'phone') return handleSendOtp(e);
        setErrorMessage("Saisissez une adresse email ou un numéro de téléphone sénégalais valide.");
    };

    // =========================================================================
    // FLUX TÉLÉPHONE : Vérification OTP
    // =========================================================================
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut) return;

        if (otpCode.length !== 6) {
            setErrorMessage('Veuillez saisir le code complet à 6 chiffres.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        const normalizedPhone = normalizePhoneNumber(identifier.trim());

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, otpCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
                    setInitialLockoutDuration(LOCKOUT_DURATION_SECONDS);
                    setErrorMessage(null);
                    return;
                }
                recordFailedAttempt(data.error || 'Code de vérification incorrect ou expiré.');
                return;
            }

            // OTP valide — créer la session Supabase pour permettre updateUser
            if (data.token_hash) {
                const supabase = getBrowserClient();
                await supabase.auth.verifyOtp({
                    token_hash: data.token_hash,
                    type: 'magiclink',
                });
            }

            // Poser le flag de recovery avant navigation
            try {
                sessionStorage.setItem('ev_recovery_verified', '1');
                sessionStorage.setItem('ev_recovery_ts', Date.now().toString());
            } catch {}

            // Réinitialiser le compteur d'échecs
            try {
                localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
            } catch {}

            router.push('/reset-password');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Échec de la vérification.';
            recordFailedAttempt(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const progressPercent = initialLockoutDuration > 0
        ? Math.max(0, Math.min(100, (lockoutRemaining / initialLockoutDuration) * 100))
        : 0;

    // ── Labels dynamiques selon le mode ───────────────────────────────────
    const stepLabels: Record<Step, string> = {
        1: inputMode === 'email'
            ? 'Entrez votre adresse email pour recevoir un lien de récupération.'
            : inputMode === 'phone'
            ? 'Entrez votre numéro de téléphone pour recevoir un code SMS.'
            : 'Entrez votre email ou numéro de téléphone pour récupérer votre accès.',
        2: 'Saisissez le code à 6 chiffres reçu par SMS pour continuer.',
        'email-sent': 'Vérifiez votre boîte de réception.',
    };

    // =========================================================================
    // RENDU
    // =========================================================================
    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md space-y-6">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <Logo variant="full" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Récupération du compte
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        {stepLabels[step]}
                    </p>
                </div>

                {/* Indicateurs d'étapes — masqués sur l'écran succès email */}
                {step !== 'email-sent' && (
                    <div className="flex items-center gap-2 justify-center">
                        {([1, 2] as const).map((s) => {
                            const stepNum = step as number;
                            return (
                                <React.Fragment key={s}>
                                    <div className={clsx(
                                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all',
                                        stepNum === s
                                            ? 'bg-[#FF5722] border-[#FF5722] text-white shadow-md shadow-[#FF5722]/30'
                                            : stepNum > s
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-400'
                                    )}>
                                        {stepNum > s ? '✓' : s}
                                    </div>
                                    {s < 2 && (
                                        <div className={clsx(
                                            'flex-1 h-0.5 rounded-full max-w-[60px] transition-all',
                                            stepNum > s ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700'
                                        )} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* Carte principale */}
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
                                        5 codes incorrects consécutifs. La saisie est temporairement bloquée pour protéger votre compte.
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
                                <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500">
                                    <span>Sécurité active</span>
                                    <span>F5 / Rechargement bloqué</span>
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

                    {/* Erreur */}
                    {errorMessage && !isLockedOut && (
                        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Succès SMS */}
                    {successMessage && step === 2 && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                            <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* ===================================================== */}
                    {/* ÉTAPE 1 — SAISIE IDENTIFIANT (email OU téléphone)      */}
                    {/* ===================================================== */}
                    {step === 1 && (
                        <form onSubmit={handleStep1Submit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Email ou numéro de téléphone
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode={inputMode === 'email' ? 'email' : 'tel'}
                                        value={identifier}
                                        onChange={(e) => handleIdentifierChange(e.target.value)}
                                        placeholder="ex: email@domain.com ou 77 123 45 67"
                                        required
                                        autoComplete="username"
                                        disabled={isLockedOut || isLoading}
                                        className={clsx(
                                            'w-full px-4 py-3 pr-11 rounded-2xl bg-slate-50 dark:bg-zinc-900 border text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all',
                                            isLockedOut && 'opacity-50 cursor-not-allowed',
                                            'border-slate-200 dark:border-zinc-800'
                                        )}
                                    />
                                    <div className="absolute right-3.5 top-3.5 text-slate-400">
                                        {inputMode === 'email' ? <Mail size={16} /> : <Phone size={16} />}
                                    </div>
                                </div>

                                {/* Badge mode détecté */}
                                {inputMode && (
                                    <div className={clsx(
                                        'mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border',
                                        inputMode === 'email'
                                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
                                            : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-[#FF5722]'
                                    )}>
                                        {inputMode === 'email'
                                            ? <><Mail size={10} /> Récupération par lien email</>
                                            : <><Phone size={10} /> Récupération par SMS</>
                                        }
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={isLockedOut || isLoading || !identifier.trim()}
                                leftIcon={isLockedOut ? <Lock size={18} /> : inputMode === 'email' ? <Send size={18} /> : <KeyRound size={18} />}
                            >
                                {isLockedOut
                                    ? `Verrouillé (${lockoutRemaining}s)`
                                    : inputMode === 'email'
                                    ? 'Envoyer le lien de récupération'
                                    : inputMode === 'phone'
                                    ? 'Envoyer le code SMS'
                                    : 'Continuer'
                                }
                            </Button>
                        </form>
                    )}

                    {/* ===================================================== */}
                    {/* ÉTAPE 2 — SAISIE OTP (flux téléphone seulement)        */}
                    {/* ===================================================== */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div className="text-center">
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    Code envoyé au <strong className="text-[#FF5722]">{normalizePhoneNumber(identifier.trim())}</strong>
                                </span>
                            </div>

                            <OtpInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={isLockedOut || isLoading}
                                hasError={!!errorMessage}
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={isLockedOut || isLoading || otpCode.length !== 6}
                                leftIcon={isLockedOut ? <Lock size={18} /> : <ShieldCheck size={18} />}
                            >
                                {isLockedOut ? `Verrouillé (${lockoutRemaining}s)` : 'Valider le code'}
                            </Button>

                            <div className="flex items-center justify-between text-xs pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setStep(1); setOtpCode(''); setErrorMessage(null); setSuccessMessage(null); }}
                                    disabled={isLockedOut}
                                    className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium disabled:opacity-50"
                                >
                                    Modifier le numéro
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSendOtp()}
                                    disabled={isLockedOut || countdown > 0 || isLoading}
                                    className="text-[#FF5722] font-bold disabled:opacity-50 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} />
                                    <span>{countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer le code'}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ===================================================== */}
                    {/* SUCCÈS EMAIL — Écran de confirmation                   */}
                    {/* ===================================================== */}
                    {step === 'email-sent' && (
                        <div className="space-y-5 text-center">
                            <div className="flex justify-center">
                                <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                                    <CheckCircle2 size={40} className="text-emerald-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                    Lien envoyé avec succès
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                    Un lien de récupération a été envoyé à votre adresse email. Veuillez cliquer sur ce lien pour choisir un nouveau mot de passe.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-left space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
                                    Que faire ensuite ?
                                </p>
                                <ul className="text-[11px] text-sky-800 dark:text-sky-200 space-y-1.5 leading-relaxed">
                                    <li className="flex items-start gap-1.5">
                                        <span className="text-sky-500 mt-0.5 flex-shrink-0">1.</span>
                                        <span>Ouvrez l&apos;email reçu de <strong>no-reply@eventvillage.sn</strong></span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="text-sky-500 mt-0.5 flex-shrink-0">2.</span>
                                        <span>Cliquez sur <strong>&quot;Réinitialiser mon mot de passe&quot;</strong></span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="text-sky-500 mt-0.5 flex-shrink-0">3.</span>
                                        <span>Le lien expire dans <strong>60 minutes</strong>. Vérifiez aussi vos spams.</span>
                                    </li>
                                </ul>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                fullWidth
                                onClick={() => { setStep(1); setIdentifier(''); setInputMode(null); }}
                            >
                                Modifier l&apos;adresse email
                            </Button>
                        </div>
                    )}

                    {/* Retour connexion */}
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-zinc-300 hover:text-[#FF5722] transition-colors"
                        >
                            <ArrowLeft size={14} />
                            <span>Retour à la connexion</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
