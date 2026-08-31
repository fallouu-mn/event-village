'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    LogIn,
    Phone,
    Lock,
    KeyRound,
    AlertCircle,
    ArrowRight,
    ShieldCheck,
    Briefcase,
    RotateCcw,
    ShieldAlert,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { useAuth } from '@/components/providers/AuthProvider';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_login_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_login_failed_attempts';

export default function LoginPage() {
    const router = useRouter();
    const { refreshProfile } = useAuth();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect') || '/';
    const errorParam = searchParams.get('error');

    const [isOtpMode, setIsOtpMode] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // =========================================================================
    // 🛡️ SYSTÈME ANTI-FORCE BRUTE & VERROUILLAGE SÉCURITÉ (Look Bancaire)
    // =========================================================================
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const [initialLockoutDuration, setInitialLockoutDuration] = useState(LOCKOUT_DURATION_SECONDS);

    // 1. Initialisation au montage depuis localStorage (survit aux F5 / rechargements)
    useEffect(() => {
        try {
            const storedLockout = localStorage.getItem(STORAGE_KEY_LOCKOUT);
            const storedAttempts = localStorage.getItem(STORAGE_KEY_ATTEMPTS);

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
                    setFailedAttempts(0);
                    setIsLockedOut(false);
                }
            }
        } catch {}
    }, []);

    // 2. Décompte temps réel du verrouillage de sécurité
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
                    setSuccessMessage('Accès déverrouillé. Vous pouvez à nouveau saisir vos identifiants.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isLockedOut, lockoutRemaining]);

    // 3. Enregistrement d'un échec de connexion
    const recordFailedAttempt = useCallback((customError?: string) => {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        try {
            localStorage.setItem(STORAGE_KEY_ATTEMPTS, nextAttempts.toString());
        } catch {}

        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
            try {
                localStorage.setItem(STORAGE_KEY_LOCKOUT, lockoutUntil.toString());
            } catch {}
            setIsLockedOut(true);
            setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
            setInitialLockoutDuration(LOCKOUT_DURATION_SECONDS);
            setErrorMessage(null); // L'alerte bancaire rouge prend le relais
        } else {
            const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
            const attemptsWarning = `(${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage temporaire)`;
            setErrorMessage(
                customError ? `${customError} ${attemptsWarning}` : `Identifiant ou mot de passe incorrect. ${attemptsWarning}`
            );
        }
    }, [failedAttempts]);

    // 4. Réinitialisation après succès
    const clearLockoutState = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY_LOCKOUT);
            localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
        } catch {}
        setFailedAttempts(0);
        setIsLockedOut(false);
        setLockoutRemaining(0);
    }, []);

    // Gestion des erreurs dans l'URL
    useEffect(() => {
        if (errorParam === 'unauthorized_admin') {
            setErrorMessage('Accès restreint aux Administrateurs et Superadministrateurs.');
        } else if (errorParam === 'unauthorized_partner') {
            setErrorMessage('Accès restreint aux Partenaires professionnels validés.');
        } else if (errorParam === 'unauthorized_scanner') {
            setErrorMessage('Accès restreint aux Contrôleurs autorisés.');
        }
    }, [errorParam]);

    // Décompte pour renvoi OTP
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Redirection après connexion réussie selon le rôle
    const handlePostLoginRedirect = async (userId: string) => {
        clearLockoutState();
        const supabase = getBrowserClient();
        const { data: profile } = await supabase
            .from('users')
            .select('role, status')
            .eq('id', userId)
            .maybeSingle();

        const userProfile = profile as { role?: string; status?: string } | null;

        if (userProfile?.status === 'SUSPENDU') {
            await supabase.auth.signOut();
            setErrorMessage('Votre compte est suspendu. Veuillez contacter le support.');
            setIsLoading(false);
            return;
        }

        // Synchroniser le cookie de session sb-access-token
        const sessionRes = await supabase.auth.getSession();
        const activeToken = sessionRes.data.session?.access_token;
        if (activeToken) {
            const maxAge = 60 * 60 * 24 * 7;
            document.cookie = `sb-access-token=${encodeURIComponent(activeToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
        }

        // Rafraîchir immédiatement le state utilisateur dans AuthProvider
        await refreshProfile();
        router.refresh();

        const role = userProfile?.role;
        let target = redirectUrl && redirectUrl !== '/' ? redirectUrl : '/';

        if (!redirectUrl || redirectUrl === '/') {
            switch (role) {
                case 'SUPERADMIN':
                case 'ADMIN':
                    target = '/admin';
                    break;
                case 'PARTENAIRE':
                    target = '/partner';
                    break;
                case 'CONTROLEUR':
                    target = '/scan';
                    break;
                case 'CLIENT':
                default:
                    target = '/';
                    break;
            }
        }

        setTimeout(() => {
            window.location.href = target;
        }, 400);
    };

    // 1. Connexion classique par Mot de Passe (Email ou Téléphone)
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut) return;

        setErrorMessage(null);
        setSuccessMessage(null);

        if (!identifier.trim() || !password) {
            setErrorMessage('Veuillez renseigner votre identifiant et votre mot de passe.');
            return;
        }

        setIsLoading(true);
        const supabase = getBrowserClient();

        try {
            const isEmail = identifier.includes('@');
            let loginEmail = identifier.trim().toLowerCase();

            if (!isEmail) {
                const normalizedPhone = normalizePhoneNumber(identifier.trim());
                // Résolution serveur sécurisée du compte associé au numéro de téléphone
                const resolveRes = await fetch('/api/auth/resolve-phone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: normalizedPhone }),
                });

                const resolveData = await resolveRes.json();
                if (!resolveRes.ok) {
                    if (resolveRes.status === 429) {
                        setIsLockedOut(true);
                        setLockoutRemaining(resolveData.remainingSeconds || LOCKOUT_DURATION_SECONDS);
                        throw new Error(resolveData.error || 'Trop de requêtes. Verrouillage temporaire.');
                    }
                    recordFailedAttempt('Aucun compte associé à ce numéro de téléphone.');
                    setIsLoading(false);
                    return;
                }
                loginEmail = resolveData.email;
            }

            const authResult = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password,
            });

            if (authResult.error) {
                if (authResult.error.message.includes('Invalid login credentials')) {
                    recordFailedAttempt('Identifiant ou mot de passe incorrect.');
                    setIsLoading(false);
                    return;
                }
                throw authResult.error;
            }

            if (authResult.data.user) {
                await handlePostLoginRedirect(authResult.data.user.id);
            }
        } catch (err: unknown) {
            console.error('[LoginPage] Erreur connexion mot de passe:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la connexion. Veuillez réessayer.';
            setErrorMessage(msg);
            setIsLoading(false);
        }
    };

    // 2. Envoi du code OTP par SMS via MTarget
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
            // Vérifier d'abord si le compte existe avant d'envoyer un SMS
            const resolveRes = await fetch('/api/auth/resolve-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone }),
            });

            const resolveData = await resolveRes.json();
            if (!resolveRes.ok) {
                if (resolveRes.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(resolveData.remainingSeconds || LOCKOUT_DURATION_SECONDS);
                }
                throw new Error(resolveData.error || 'Aucun compte associé à ce numéro de téléphone. Veuillez vous inscrire.');
            }

            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(data.remainingSeconds || LOCKOUT_DURATION_SECONDS);
                }
                throw new Error(data.error || 'Impossible d\'envoyer le code SMS.');
            }

            setOtpSent(true);
            setCountdown(60);
            setSuccessMessage(`Code de confirmation envoyé par SMS au ${normalizedPhone}.`);
        } catch (err: unknown) {
            console.error('[LoginPage] Erreur envoi OTP:', err);
            const msg = err instanceof Error ? err.message : 'Impossible d\'envoyer le code SMS.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Vérification du code OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut) return;

        setErrorMessage(null);

        if (otpCode.length !== 6) {
            setErrorMessage('Veuillez saisir le code complet à 6 chiffres.');
            return;
        }

        setIsLoading(true);
        const normalizedPhone = normalizePhoneNumber(identifier.trim());

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, otpCode, isLogin: true }),
            });

            const verifyData = await res.json();
            if (!res.ok) {
                if (res.status === 429) {
                    setIsLockedOut(true);
                    setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
                } else {
                    recordFailedAttempt('Code OTP incorrect ou expiré.');
                }
                throw new Error(verifyData.error || 'Code OTP incorrect.');
            }

            const supabase = getBrowserClient();

            // Établissement de la session Supabase avec le token hash
            if (verifyData.token_hash) {
                const { error: otpAuthError } = await supabase.auth.verifyOtp({
                    token_hash: verifyData.token_hash,
                    type: 'email',
                });
                if (otpAuthError) {
                    console.warn('[LoginPage] verifyOtp auth token notice:', otpAuthError);
                }
            }

            const userId = verifyData.user?.id;
            if (userId) {
                await handlePostLoginRedirect(userId);
            } else {
                clearLockoutState();
                window.location.href = redirectUrl || '/';
            }
        } catch (err: unknown) {
            console.error('[LoginPage] Erreur validation OTP:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la vérification OTP.';
            setErrorMessage(msg);
            setIsLoading(false);
        }
    };

    // Calcul du pourcentage restant pour la barre de décompte visuelle
    const progressPercent = initialLockoutDuration > 0
        ? Math.max(0, Math.min(100, (lockoutRemaining / initialLockoutDuration) * 100))
        : 0;

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md space-y-6">
                {/* Header & Logo */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <Logo variant="full" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Connexion
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        Accédez à vos billets, commandes, réservations et portefeuille.
                    </p>
                </div>

                {/* Carte Principale */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-6 relative transition-all duration-300">

                    {/* ================================================================= */}
                    {/* 🔒 BANNIÈRE DE VERROUILLAGE SÉCURITÉ (DESIGN BANCAIRE HAUT DE GAMME) */}
                    {/* ================================================================= */}
                    {isLockedOut && (
                        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-red-500/15 via-red-500/5 to-amber-500/10 border-2 border-red-500/40 dark:border-red-500/50 shadow-xl shadow-red-500/10 animate-in fade-in duration-300 space-y-4">
                            {/* Point lumineux pulsant */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-black text-red-700 dark:text-red-300 tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                <span>Verrouillé</span>
                            </div>

                            <div className="flex items-start gap-3.5 pr-20">
                                <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0 shadow-inner">
                                    <Lock size={22} className="animate-bounce duration-1000" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-red-950 dark:text-red-200 tracking-tight flex items-center gap-1.5">
                                        Protection Anti-Intrusion
                                    </h3>
                                    <p className="text-[11px] text-red-900/80 dark:text-red-300/80 leading-relaxed">
                                        5 tentatives infructueuses consécutives. Par mesure de sécurité pour votre compte et votre portefeuille, la saisie est temporairement bloquée.
                                    </p>
                                </div>
                            </div>

                            {/* Boîtier Décompte en Temps Réel */}
                            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/90 border border-red-200 dark:border-red-900/60 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    <Clock size={15} className="text-red-500 animate-spin duration-3000" />
                                    <span>Déverrouillage automatique dans :</span>
                                </div>
                                <div className="px-3 py-1 rounded-xl bg-red-500 text-white font-mono text-sm font-black tracking-widest shadow-sm">
                                    {lockoutRemaining < 10 ? `0${lockoutRemaining}s` : `${lockoutRemaining}s`}
                                </div>
                            </div>

                            {/* Barre de progression fluide */}
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

                    {/* Avertissement de tentatives restantes si > 0 et < 5 */}
                    {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2.5">
                            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                            <span>
                                <strong>Attention :</strong> {failedAttempts}/{MAX_FAILED_ATTEMPTS} tentatives échouées. Le compte sera verrouillé à 5 erreurs.
                            </span>
                        </div>
                    )}

                    {/* Sélecteur Mode (Mot de passe / OTP) */}
                    <div className={`grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 text-xs font-bold ${isLockedOut ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button
                            type="button"
                            disabled={isLockedOut}
                            onClick={() => {
                                setIsOtpMode(false);
                                setErrorMessage(null);
                            }}
                            className={`py-2 rounded-xl transition-all ${
                                !isOtpMode
                                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Mot de passe
                        </button>
                        <button
                            type="button"
                            disabled={isLockedOut}
                            onClick={() => {
                                setIsOtpMode(true);
                                setErrorMessage(null);
                            }}
                            className={`py-2 rounded-xl transition-all ${
                                isOtpMode
                                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Code SMS (OTP)
                        </button>
                    </div>

                    {/* Messages d'erreur et de succès */}
                    {errorMessage && !isLockedOut && (
                        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-shake">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                            <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Formulaire Mot de passe */}
                    {!isOtpMode && (
                        <form onSubmit={handlePasswordLogin} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Email ou Téléphone
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        disabled={isLockedOut || isLoading}
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="ex: 77 123 45 67 ou client@email.com"
                                        required
                                        className={`w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all ${
                                            isLockedOut ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-800/40' : ''
                                        }`}
                                    />
                                    <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                        Mot de passe
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className={`text-[11px] font-bold text-[#FF5722] hover:underline ${
                                            isLockedOut ? 'pointer-events-none opacity-50' : ''
                                        }`}
                                    >
                                        Mot de passe oublié ?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        type="password"
                                        disabled={isLockedOut || isLoading}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className={`w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all ${
                                            isLockedOut ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-800/40' : ''
                                        }`}
                                    />
                                    <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={isLockedOut || isLoading}
                                leftIcon={isLockedOut ? <Lock size={18} /> : <LogIn size={18} />}
                            >
                                {isLockedOut ? `Verrouillé (${lockoutRemaining}s)` : 'Se connecter'}
                            </Button>
                        </form>
                    )}

                    {/* Formulaire OTP */}
                    {isOtpMode && (
                        <div className="space-y-4">
                            {!otpSent ? (
                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                            Numéro de Téléphone (Sénégal)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                disabled={isLockedOut || isLoading}
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                                placeholder="77 123 45 67"
                                                required
                                                className={`w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all ${
                                                    isLockedOut ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-800/40' : ''
                                                }`}
                                            />
                                            <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                                            Un code à 6 chiffres vous sera envoyé gratuitement par SMS.
                                        </p>
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        isLoading={isLoading}
                                        disabled={isLockedOut || isLoading}
                                        leftIcon={isLockedOut ? <Lock size={18} /> : <KeyRound size={18} />}
                                    >
                                        {isLockedOut ? `Verrouillé (${lockoutRemaining}s)` : 'Recevoir le code SMS'}
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-5">
                                    <div className="text-center space-y-1">
                                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                            Saisissez le code reçu par SMS
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
                                        {isLockedOut ? `Verrouillé (${lockoutRemaining}s)` : 'Valider et se connecter'}
                                    </Button>

                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <button
                                            type="button"
                                            disabled={isLockedOut}
                                            onClick={() => setOtpSent(false)}
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
                        </div>
                    )}

                    {/* Liens Inscription Client & Pro */}
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                        <div className="text-center">
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                                Pas encore de compte ?{' '}
                            </span>
                            <Link
                                href="/register"
                                className="text-xs font-black text-[#FF5722] hover:underline"
                            >
                                Créer un compte Client
                            </Link>
                        </div>

                        <Link
                            href="/partner/register"
                            className="p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 flex items-center justify-between group hover:border-[#FF5722] transition-all"
                        >
                            <div className="flex items-center gap-2.5">
                                <Briefcase size={16} className="text-[#FF5722]" />
                                <div className="text-left">
                                    <span className="text-xs font-black text-slate-900 dark:text-white block group-hover:text-[#FF5722] transition-colors">
                                        Espace Professionnel
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                                        Organisateurs, Salles & Restaurants : Devenir Partenaire
                                    </span>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-[#FF5722] group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
