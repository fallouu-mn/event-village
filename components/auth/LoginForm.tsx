'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    LogIn,
    Lock,
    KeyRound,
    ArrowRight,
    ShieldCheck,
    Briefcase,
    RotateCcw,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { detachPushSubscription } from '@/lib/push/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { useAuth } from '@/components/providers/AuthProvider';
import { resolvePostLoginRoute } from '@/lib/auth/resolve-post-login-route';

/**
 * Formulaire de connexion (lot 6, contrat A5). Rendu par app/login/page.tsx, composant serveur qui lit
 * `searchParams` (error, message, redirect) : plus de rendu intermédiaire sans formulaire (Suspense).
 *
 * Logique reprise à l'identique de l'ancienne page :
 *  - verrou du navigateur : 5 échecs → saisie bloquée 60 s (clés localStorage ev_login_lockout_until et
 *    ev_login_failed_attempts, relues au montage) ; il n'est qu'un confort, l'autorité reste le serveur
 *    (429 avec remainingSeconds de /api/auth/resolve-phone, /send-otp et /verify-otp) ;
 *  - téléphone → email par /api/auth/resolve-phone avant signInWithPassword ;
 *  - code SMS : /api/auth/send-otp puis /api/auth/verify-otp (isLogin), session par verifyOtp type « email » ;
 *  - après connexion : compte SUSPENDU → appareil détaché du push puis signOut, refreshSession pour les
 *    rôles non client, resolvePostLoginRoute, redirection après 400 ms.
 * Libellés figés par e2e/auth.setup.ts : « Email ou téléphone », « Mot de passe » (libellé exact, sans
 * mention « obligatoire » dans le nom accessible), « Se connecter ».
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_login_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_login_failed_attempts';

/** Codes ?error= posés par le middleware, la réinitialisation du mot de passe ou l'activation d'un contrôleur. */
const ERROR_MESSAGES: Record<string, string> = {
    unauthorized_admin: 'Accès restreint aux Administrateurs et Superadministrateurs.',
    unauthorized_partner: 'Accès restreint aux Partenaires professionnels validés.',
    unauthorized_scanner: 'Accès restreint aux Contrôleurs autorisés.',
    unauthorized_controller: 'Accès réservé aux contrôleurs.',
    account_deactivated: 'Votre compte contrôleur a été désactivé ou révoqué par l\'organisateur.',
    session_expired: 'Le lien a expiré : demandez un nouveau code.',
};

/** Codes ?message= (information, pas une erreur) posés par l'activation d'un contrôleur. */
const INFO_MESSAGES: Record<string, string> = {
    account_activated: 'Compte activé avec succès. Connectez-vous avec votre mot de passe.',
    already_configured: 'Ce compte est déjà activé : connectez-vous.',
};

/** Codes ?reset= posés par app/reset-password après la pose du nouveau mot de passe. */
const RESET_MESSAGES: Record<string, string> = {
    success: 'Mot de passe modifié : connectez-vous avec le nouveau.',
};

/** Destination transmise à l'inscription (D61) : chemin interne seulement (« / » au début, pas « // »), hors accueil. */
function isForwardableRedirect(redirectUrl: string): boolean {
    return redirectUrl.startsWith('/') && !redirectUrl.startsWith('//') && redirectUrl !== '/';
}

/** Stockage du navigateur indisponible (navigation privée, quota) : le verrou local est un confort, on le signale. */
function storageWarning(action: string, err: unknown): void {
    console.warn(`[LoginForm] stockage local indisponible (${action}) : le verrou du navigateur est ignoré, le serveur reste l'autorité.`, err instanceof Error ? err.message : String(err));
}

/** Lien texte de 44 px de haut (cible tactile), couleur de marque lisible. */
const TEXT_LINK = 'inline-flex min-h-11 items-center rounded-lg font-semibold text-brand-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export interface LoginFormProps {
    /** Destination demandée (?redirect=), « / » par défaut. */
    redirectUrl: string;
    /** Code d'erreur de l'URL (?error=) posé par le middleware ou l'activation d'un contrôleur. */
    errorParam: string | null;
    /** Message de l'URL (?message=) : account_activated, already_configured. */
    messageParam: string | null;
    /** Issue d'une réinitialisation du mot de passe (?reset=success). */
    resetParam: string | null;
}

export function LoginForm({ redirectUrl, errorParam, messageParam, resetParam }: LoginFormProps) {
    const router = useRouter();
    const { refreshProfile } = useAuth();

    const [isOtpMode, setIsOtpMode] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ── Verrou du navigateur contre les essais répétés ─────────────────────
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const [initialLockoutDuration, setInitialLockoutDuration] = useState(LOCKOUT_DURATION_SECONDS);

    // 1. Restauration au montage depuis localStorage (le verrou survit au rechargement de la page)
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
        } catch (err) {
            storageWarning('lecture du verrou', err);
        }
    }, []);

    // 2. Décompte du verrouillage
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
                    } catch (err) {
                        storageWarning('levée du verrou', err);
                    }
                    setSuccessMessage('Accès déverrouillé. Vous pouvez à nouveau saisir vos identifiants.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isLockedOut, lockoutRemaining]);

    // 3. Enregistrement d'un échec (lecture directe de localStorage)
    const recordFailedAttempt = useCallback((customError?: string) => {
        let currentAttempts = 0;
        try {
            const stored = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
            if (stored) currentAttempts = parseInt(stored, 10) || 0;
        } catch (err) {
            storageWarning('lecture du nombre d\'échecs', err);
        }

        const nextAttempts = currentAttempts + 1;
        setFailedAttempts(nextAttempts);

        try {
            localStorage.setItem(STORAGE_KEY_ATTEMPTS, nextAttempts.toString());
        } catch (err) {
            storageWarning('écriture du nombre d\'échecs', err);
        }

        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
            try {
                localStorage.setItem(STORAGE_KEY_LOCKOUT, lockoutUntil.toString());
            } catch (err) {
                storageWarning('écriture du verrou', err);
            }
            setIsLockedOut(true);
            setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
            setInitialLockoutDuration(LOCKOUT_DURATION_SECONDS);
            setErrorMessage(null); // le bandeau de verrouillage prend le relais
        } else {
            const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
            const attemptsWarning = `(${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage temporaire)`;
            setErrorMessage(
                customError ? `${customError} ${attemptsWarning}` : `Identifiant ou mot de passe incorrect. ${attemptsWarning}`
            );
        }
    }, []);

    // 4. Réinitialisation après succès
    const clearLockoutState = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY_LOCKOUT);
            localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
        } catch (err) {
            storageWarning('effacement du verrou', err);
        }
        setFailedAttempts(0);
        setIsLockedOut(false);
        setLockoutRemaining(0);
    }, []);

    // Paramètres de l'URL (?error=, ?message=, ?reset=) lus par la page serveur ; un code inconnu n'affiche rien.
    useEffect(() => {
        const known = errorParam ? ERROR_MESSAGES[errorParam] : undefined;
        if (known) setErrorMessage(known);

        const info = (resetParam ? RESET_MESSAGES[resetParam] : undefined) ?? (messageParam ? INFO_MESSAGES[messageParam] : undefined);
        if (info) setSuccessMessage(info);
    }, [errorParam, messageParam, resetParam]);

    // Décompte pour le renvoi du code
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Redirection après connexion réussie selon le rôle
    const handlePostLoginRedirect = async (userId: string) => {
        clearLockoutState();
        const supabase = getBrowserClient();

        const [{ data: profileData }, { data: rolesData }] = await Promise.all([
            supabase.from('users').select('role, status').eq('id', userId).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', userId),
        ]);

        const userProfile = profileData as { role?: string; status?: string } | null;

        if (userProfile?.status === 'SUSPENDU') {
            // Lot 6 (contrat F4) : l'appareil ne garde aucun abonnement push d'un compte suspendu.
            await detachPushSubscription();
            await supabase.auth.signOut();
            setErrorMessage('Votre compte est suspendu. Veuillez contacter le support.');
            setIsLoading(false);
            return;
        }

        const roles: string[] = (rolesData && rolesData.length > 0)
            ? rolesData.map((r: { role: string }) => r.role)
            : (userProfile?.role ? [userProfile.role] : ['CLIENT']);

        const hasNonClientRole = roles.some((r: string) => r !== 'CLIENT');
        if (hasNonClientRole) {
            await supabase.auth.refreshSession();
        }

        await refreshProfile();
        router.refresh();

        const target = resolvePostLoginRoute(roles, redirectUrl);

        setTimeout(() => {
            window.location.href = target;
        }, 400);
    };

    // 1. Connexion par mot de passe
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
            console.error('[LoginForm] Erreur connexion mot de passe:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la connexion. Veuillez réessayer.';
            recordFailedAttempt(msg);
            setIsLoading(false);
        }
    };

    // 2. Envoi du code par SMS
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
            console.error('[LoginForm] Erreur envoi OTP:', err);
            const msg = err instanceof Error ? err.message : 'Impossible d\'envoyer le code SMS.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Vérification du code
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

            if (verifyData.token_hash) {
                const { error: otpAuthError } = await supabase.auth.verifyOtp({
                    token_hash: verifyData.token_hash,
                    type: 'email',
                });
                if (otpAuthError) {
                    console.warn('[LoginForm] verifyOtp auth token notice:', otpAuthError);
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
            console.error('[LoginForm] Erreur validation OTP:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la vérification OTP.';
            setErrorMessage(msg);
            setIsLoading(false);
        }
    };

    const progressPercent = initialLockoutDuration > 0
        ? Math.max(0, Math.min(100, (lockoutRemaining / initialLockoutDuration) * 100))
        : 0;

    const switchMode = (otp: boolean) => {
        setIsOtpMode(otp);
        setErrorMessage(null);
    };

    const inputsDisabled = isLockedOut || isLoading;

    return (
        <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
            {/* Verrouillage temporaire (5 échecs, ou 429 du serveur) */}
            {isLockedOut && (
                <StatusBanner tone="danger" announce="alert" icon={<Lock size={20} />} title="Saisie temporairement bloquée">
                    <p>
                        Trop de tentatives infructueuses. Pour protéger votre compte et votre portefeuille, la saisie est bloquée
                        pendant quelques instants.
                    </p>
                    <p className="mt-2 font-semibold tabular-nums">
                        Nouvel essai possible dans {lockoutRemaining} s
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-danger-border" aria-hidden="true">
                        <div
                            className="h-full rounded-full bg-danger motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </StatusBanner>
            )}

            {/* Tentatives restantes avant le verrouillage */}
            {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && (
                <StatusBanner tone="warning" title={`${failedAttempts} tentative${failedAttempts > 1 ? 's' : ''} échouée${failedAttempts > 1 ? 's' : ''} sur ${MAX_FAILED_ATTEMPTS}`}>
                    La saisie sera bloquée pendant {LOCKOUT_DURATION_SECONDS} secondes au bout de {MAX_FAILED_ATTEMPTS} échecs.
                </StatusBanner>
            )}

            {/* Mode de connexion : mot de passe ou code SMS */}
            <div role="group" aria-label="Mode de connexion" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunken p-1">
                <button
                    type="button"
                    disabled={isLockedOut}
                    aria-pressed={!isOtpMode}
                    onClick={() => switchMode(false)}
                    className={cn(
                        'min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                        !isOtpMode ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
                    )}
                >
                    Mot de passe
                </button>
                <button
                    type="button"
                    disabled={isLockedOut}
                    aria-pressed={isOtpMode}
                    onClick={() => switchMode(true)}
                    className={cn(
                        'min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                        isOtpMode ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
                    )}
                >
                    Code SMS
                </button>
            </div>

            {/* Messages d'erreur et de succès */}
            {errorMessage && !isLockedOut && (
                <StatusBanner tone="danger" announce="alert" title={errorMessage} />
            )}

            {successMessage && (
                <StatusBanner tone="success" icon={<ShieldCheck size={20} />} title={successMessage} />
            )}

            {/* Connexion par mot de passe */}
            {!isOtpMode && (
                <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
                    <TextInput
                        id="login-identifiant"
                        label="Email ou téléphone"
                        type="text"
                        autoComplete="username"
                        disabled={inputsDisabled}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="77 123 45 67 ou adresse email"
                        hint="Le numéro sénégalais ou l'adresse email de votre compte."
                    />

                    <div className="relative">
                        <TextInput
                            id="login-mot-de-passe"
                            label="Mot de passe"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            disabled={inputsDisabled}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pr-14"
                            aside={(
                                <Link href="/forgot-password" className={cn(TEXT_LINK, isLockedOut && 'pointer-events-none opacity-50')}>
                                    Mot de passe oublié ?
                                </Link>
                            )}
                        />
                        <IconButton
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            aria-controls="login-mot-de-passe"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={inputsDisabled}
                            className="absolute bottom-px right-px"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </IconButton>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        isLoading={isLoading}
                        disabled={inputsDisabled}
                        leftIcon={isLockedOut ? <Lock size={18} /> : <LogIn size={18} />}
                    >
                        {isLockedOut ? `Bloqué (${lockoutRemaining} s)` : 'Se connecter'}
                    </Button>
                </form>
            )}

            {/* Connexion par code SMS */}
            {isOtpMode && (
                <div className="space-y-4">
                    {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
                            <TextInput
                                id="login-telephone-otp"
                                label="Numéro de téléphone (Sénégal)"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                disabled={inputsDisabled}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="77 123 45 67"
                                hint="Un code à 6 chiffres vous sera envoyé gratuitement par SMS."
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={inputsDisabled}
                                leftIcon={isLockedOut ? <Lock size={18} /> : <KeyRound size={18} />}
                            >
                                {isLockedOut ? `Bloqué (${lockoutRemaining} s)` : 'Recevoir le code SMS'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
                            <p id="login-otp-aide" className="text-center text-sm font-semibold text-fg">
                                Saisissez le code reçu par SMS
                            </p>

                            <OtpInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={inputsDisabled}
                                hasError={!!errorMessage}
                                describedBy="login-otp-aide"
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={inputsDisabled || otpCode.length !== 6}
                                leftIcon={isLockedOut ? <Lock size={18} /> : <ShieldCheck size={18} />}
                            >
                                {isLockedOut ? `Bloqué (${lockoutRemaining} s)` : 'Valider et se connecter'}
                            </Button>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isLockedOut}
                                    onClick={() => setOtpSent(false)}
                                >
                                    Modifier le numéro
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-brand-fg"
                                    onClick={() => handleSendOtp()}
                                    disabled={isLockedOut || countdown > 0 || isLoading}
                                    leftIcon={<RotateCcw size={16} />}
                                >
                                    {countdown > 0 ? `Renvoyer (${countdown} s)` : 'Renvoyer le code'}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Inscription client et espace professionnel */}
            <div className="space-y-3 border-t border-border pt-4">
                <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-fg-muted">
                    <span>Pas encore de compte ?</span>
                    <Link
                        href={isForwardableRedirect(redirectUrl) ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
                        className={TEXT_LINK}
                    >
                        Créer un compte client
                    </Link>
                </p>

                <Link
                    href="/partner/register"
                    className="group flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-3 transition-colors duration-200 hover:border-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                            <Briefcase size={18} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-fg group-hover:text-brand-fg">Espace professionnel</span>
                            <span className="block text-sm text-fg-muted">Organisateurs, salles et restaurants : devenir partenaire</span>
                        </span>
                    </span>
                    <ArrowRight size={18} className="flex-shrink-0 text-brand-fg" aria-hidden="true" />
                </Link>
            </div>
        </div>
    );
}
