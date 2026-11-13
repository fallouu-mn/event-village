'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    KeyRound,
    Eye,
    EyeOff,
    ShieldCheck,
    Check,
    X,
    Lock,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { getBrowserClient } from '@/lib/supabase/client';
import { detachPushSubscription } from '@/lib/push/client';
import { useToast } from '@/components/ui/Toast';

/**
 * Nouveau mot de passe (lot 6, contrat A5 : écran sur le système de design, logique inchangée).
 * Accès par le flux téléphone (drapeau sessionStorage ev_recovery_verified posé par /forgot-password et
 * session Supabase) ou par le lien email (événement PASSWORD_RECOVERY). Après la mise à jour : toutes les
 * sessions sont révoquées (/api/auth/sign-out-global), l'appareil est détaché du push, puis signOut.
 */

// Verrou du navigateur contre les essais répétés
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_reset_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_reset_failed_attempts';

/** Stockage du navigateur indisponible (navigation privée, quota) : signalé, le parcours continue. */
function storageWarning(action: string, err: unknown): void {
    console.warn(`[ResetPassword] stockage du navigateur indisponible (${action}) :`, err instanceof Error ? err.message : String(err));
}

/**
 * Refus de Supabase Auth à la mise à jour (8.2 i) : on décide sur le code, jamais sur le texte, qui est en anglais
 * et n'atteint que le journal.
 */
function passwordUpdateRefusalMessage(code: string | undefined): string {
    switch (code) {
        case 'same_password':
            return 'Choisissez un mot de passe différent de l\'ancien.';
        case 'weak_password':
            return 'Ce mot de passe est trop faible. Choisissez-en un plus long ou moins courant.';
        case 'session_expired':
        case 'session_not_found':
            return 'Votre demande de récupération a expiré. Recommencez depuis « Mot de passe oublié ».';
        case 'over_request_rate_limit':
            return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
        default:
            return 'Impossible de mettre à jour le mot de passe. Réessayez dans un instant.';
    }
}

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
    //       Attention : le hash fragment (#access_token=...&type=recovery) est traité de manière
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
            } catch (err) {
                storageWarning('drapeaux de récupération', err);
            }
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
        }).catch((err: unknown) => {
            console.warn('[ResetPassword] lecture de la session impossible :', err instanceof Error ? err.message : String(err));
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
        } catch (err) {
            storageWarning('lecture du verrou', err);
        }
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
                    } catch (err) {
                        storageWarning('levée du verrou', err);
                    }
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
        } catch (err) {
            storageWarning("lecture du nombre d'échecs", err);
        }

        const next = current + 1;
        setFailedAttempts(next);
        try {
            localStorage.setItem(STORAGE_KEY_ATTEMPTS, next.toString());
        } catch (err) {
            storageWarning("écriture du nombre d'échecs", err);
        }

        if (next >= MAX_FAILED_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
            try {
                localStorage.setItem(STORAGE_KEY_LOCKOUT, until.toString());
            } catch (err) {
                storageWarning('écriture du verrou', err);
            }
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
            // Lot 9 quater (A3 : G-04) : le mot de passe est posé par le serveur (POST /api/auth/reset-password), qui
            // n'accepte qu'une session de récupération, applique la règle commune, révoque toutes les sessions et fait
            // partir l'avis « mot de passe modifié ». L'appareil se détache des notifications push AVANT, tant que la
            // session authentifie encore le retrait (erreur journalisée par detachPushSubscription).
            const supabase = getBrowserClient();
            const currentSession = (await supabase.auth.getSession()).data.session;
            if (!currentSession?.access_token) {
                recordFailedAttempt(passwordUpdateRefusalMessage('session_not_found'));
                return;
            }
            await detachPushSubscription();
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.access_token}` },
                body: JSON.stringify({ password }),
            });
            const body = await res.json().catch(() => ({})) as { error?: string; code?: string };
            if (!res.ok) {
                console.error('[ResetPassword] mise à jour refusée :', res.status, body.code ?? '');
                const code = body.code === 'WEAK_PASSWORD' ? 'weak_password'
                    : (res.status === 401 || body.code === 'RECOVERY_SESSION_REQUIRED') ? 'session_not_found'
                    : res.status === 429 ? 'over_request_rate_limit' : undefined;
                recordFailedAttempt(passwordUpdateRefusalMessage(code));
                return;
            }

            // Nettoyer le flag de recovery
            try {
                sessionStorage.removeItem('ev_recovery_verified');
                sessionStorage.removeItem('ev_recovery_ts');
            } catch (err) {
                storageWarning('effacement des drapeaux de récupération', err);
            }

            // Nettoyer le compteur d'échecs
            try {
                localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
            } catch (err) {
                storageWarning('effacement du verrou', err);
            }

            // Toutes les sessions sont déjà révoquées par le serveur : on ferme la session locale du navigateur.
            await supabase.auth.signOut({ scope: 'local' });

            toast.success('Mot de passe mis à jour avec succès. Veuillez vous connecter.');

            router.replace('/login?reset=success');
        } catch (err: unknown) {
            console.error('[ResetPassword] mise à jour du mot de passe en échec :', err);
            recordFailedAttempt('Une erreur inattendue s\'est produite. Réessayez dans un instant.');
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
            <div className="flex justify-center py-12">
                <div role="status" className="space-y-3 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-fg-muted motion-safe:animate-pulse" aria-hidden="true">
                        <Lock size={24} />
                    </div>
                    <p className="text-sm font-medium text-fg-muted">
                        Vérification de la session sécurisée…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="flex justify-center">
                    <Logo variant="full" />
                </div>
                <PageHeader
                    title="Nouveau mot de passe"
                    description="Choisissez un mot de passe fort pour sécuriser votre compte."
                    className="pb-0 sm:pb-0"
                />

                {/* Carte du formulaire */}
                <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
                    {/* Verrouillage temporaire */}
                    {isLockedOut && (
                        <StatusBanner tone="danger" announce="alert" icon={<Lock size={20} />} title="Saisie temporairement bloquée">
                            <p>Trop de tentatives échouées. L&apos;accès est bloqué pendant quelques instants.</p>
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

                    {/* Tentatives restantes */}
                    {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && (
                        <StatusBanner tone="warning" title={`${failedAttempts} tentative${failedAttempts > 1 ? 's' : ''} échouée${failedAttempts > 1 ? 's' : ''} sur ${MAX_FAILED_ATTEMPTS}`}>
                            La saisie sera bloquée pendant {LOCKOUT_DURATION_SECONDS} secondes au bout de {MAX_FAILED_ATTEMPTS} échecs.
                        </StatusBanner>
                    )}

                    {/* Message d'erreur */}
                    {errorMessage && !isLockedOut && (
                        <StatusBanner tone="danger" announce="alert" title={errorMessage} />
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Nouveau mot de passe */}
                        <div className="relative">
                            <TextInput
                                id="reinitialisation-mot-de-passe"
                                label="Nouveau mot de passe"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="8 caractères au moins"
                                autoComplete="new-password"
                                required
                                disabled={isLockedOut || isLoading}
                                className={cn('pr-14', password.length > 0 && (allCriteriaMet ? 'border-success' : 'border-warning'))}
                            />
                            <IconButton
                                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                aria-controls="reinitialisation-mot-de-passe"
                                onClick={() => setShowPassword((v) => !v)}
                                disabled={isLockedOut || isLoading}
                                className="absolute bottom-px right-px"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </IconButton>
                        </div>

                        {/* Critères de robustesse */}
                        <PasswordStrengthChecklist password={password} />

                        {/* Confirmation */}
                        <div className="space-y-1.5">
                            <div className="relative">
                                <TextInput
                                    id="reinitialisation-confirmation"
                                    label="Confirmer le mot de passe"
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Le même mot de passe"
                                    autoComplete="new-password"
                                    required
                                    disabled={isLockedOut || isLoading}
                                    className={cn('pr-14', confirmPassword.length > 0 && (passwordsMatch ? 'border-success' : 'border-danger'))}
                                />
                                <IconButton
                                    aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                                    aria-controls="reinitialisation-confirmation"
                                    onClick={() => setShowConfirm((v) => !v)}
                                    disabled={isLockedOut || isLoading}
                                    className="absolute bottom-px right-px"
                                >
                                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                </IconButton>
                            </div>
                            {confirmPassword.length > 0 && (
                                <p
                                    aria-live="polite"
                                    className={cn('flex items-center gap-1.5 text-sm font-semibold', passwordsMatch ? 'text-success-fg' : 'text-danger-fg')}
                                >
                                    {passwordsMatch
                                        ? <><Check size={16} strokeWidth={3} aria-hidden="true" /> Les mots de passe correspondent</>
                                        : <><X size={16} strokeWidth={3} aria-hidden="true" /> Les mots de passe ne correspondent pas</>}
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
                            {isLockedOut ? `Bloqué (${lockoutRemaining} s)` : 'Définir le nouveau mot de passe'}
                        </Button>
                    </form>

                    {/* Note de sécurité */}
                    <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface-sunken p-3">
                        <KeyRound size={16} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden="true" />
                        <p className="text-sm leading-relaxed text-fg-muted">
                            Après confirmation, toutes vos sessions sont fermées, sur tous vos appareils, pour garantir la sécurité de votre compte.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
