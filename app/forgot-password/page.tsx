'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    KeyRound,
    Phone,
    ArrowLeft,
    ShieldCheck,
    RotateCcw,
    Lock,
    Check,
    CheckCircle2,
    Send,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';

/**
 * Mot de passe oublié (lot 6, contrat A5 : écran sur le système de design, logique inchangée).
 *  - Email : resetPasswordForEmail ; l'écran de succès s'affiche toujours (erreur ou exception comprises)
 *    pour ne jamais révéler si un compte existe.
 *  - Téléphone : /api/auth/send-otp (purpose PASSWORD_RESET), /api/auth/verify-otp, session par verifyOtp
 *    type « magiclink », puis drapeaux sessionStorage ev_recovery_verified / ev_recovery_ts lus par
 *    /reset-password.
 *  - Verrou du navigateur (clés ev_recovery_lockout_until / ev_recovery_failed_attempts) en plus du 429 du
 *    serveur.
 */

// Verrou du navigateur contre les essais répétés (le serveur reste l'autorité : 429 avec remainingSeconds)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_KEY_LOCKOUT = 'ev_recovery_lockout_until';
const STORAGE_KEY_ATTEMPTS = 'ev_recovery_failed_attempts';

type FlowMode = 'email' | 'phone' | null;
type Step = 1 | 2 | 'email-sent';

/** Stockage du navigateur indisponible (navigation privée, quota) : signalé, le parcours continue. */
function storageWarning(action: string, err: unknown): void {
    console.warn(`[ForgotPassword] stockage du navigateur indisponible (${action}) :`, err instanceof Error ? err.message : String(err));
}

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
        } catch (err) {
            storageWarning('lecture du verrou', err);
        }
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
                    } catch (err) {
                        storageWarning('levée du verrou', err);
                    }
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
        } catch (err) {
            // Exception réseau : journalisée, et l'écran reste celui du succès pour ne jamais révéler si le
            // compte existe (comportement inchangé).
            console.warn('[ForgotPassword] demande de lien de récupération en échec :', err instanceof Error ? err.message : String(err));
            setStep('email-sent');
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
            } catch (err) {
                // Sans ces drapeaux, /reset-password s'appuie sur la seule session Supabase créée par verifyOtp.
                storageWarning('drapeaux de récupération', err);
            }

            // Réinitialiser le compteur d'échecs
            try {
                localStorage.removeItem(STORAGE_KEY_LOCKOUT);
                localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
            } catch (err) {
                storageWarning('effacement du verrou', err);
            }

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
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="flex justify-center">
                    <Logo variant="full" />
                </div>
                <PageHeader
                    eyebrow={step !== 'email-sent'
                        ? <span className="text-sm font-semibold text-fg-muted">Étape {step === 1 ? 1 : 2} sur 2</span>
                        : undefined}
                    title="Mot de passe oublié"
                    description={stepLabels[step]}
                    className="pb-0 sm:pb-0"
                />

                {/* Carte principale */}
                <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
                    {/* Progression (décorative : l'étape est écrite au-dessus du titre) */}
                    {step !== 'email-sent' && (
                        <div aria-hidden="true" className="flex items-center justify-center gap-2">
                            {([1, 2] as const).map((s) => {
                                const stepNum = step as number;
                                return (
                                    <React.Fragment key={s}>
                                        <span
                                            className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-200',
                                                stepNum === s
                                                    ? 'border-brand bg-brand text-on-brand'
                                                    : stepNum > s
                                                        ? 'border-success bg-success text-on-tone'
                                                        : 'border-border bg-surface text-fg-muted',
                                            )}
                                        >
                                            {stepNum > s ? <Check size={16} strokeWidth={3} /> : s}
                                        </span>
                                        {s < 2 && (
                                            <span className={cn('h-0.5 w-14 rounded-full transition-colors duration-200', stepNum > s ? 'bg-success' : 'bg-border')} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}

                    {/* Verrouillage temporaire (5 codes incorrects, ou 429 du serveur) */}
                    {isLockedOut && (
                        <StatusBanner tone="danger" announce="alert" icon={<Lock size={20} />} title="Saisie temporairement bloquée">
                            <p>
                                Trop de tentatives infructueuses. La saisie est bloquée pendant quelques instants pour protéger votre compte.
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

                    {/* Tentatives restantes */}
                    {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && (
                        <StatusBanner tone="warning" title={`${failedAttempts} tentative${failedAttempts > 1 ? 's' : ''} échouée${failedAttempts > 1 ? 's' : ''} sur ${MAX_FAILED_ATTEMPTS}`}>
                            La saisie sera bloquée pendant {LOCKOUT_DURATION_SECONDS} secondes au bout de {MAX_FAILED_ATTEMPTS} échecs.
                        </StatusBanner>
                    )}

                    {/* Erreur */}
                    {errorMessage && !isLockedOut && (
                        <StatusBanner tone="danger" announce="alert" title={errorMessage} />
                    )}

                    {/* Code envoyé par SMS */}
                    {successMessage && step === 2 && (
                        <StatusBanner tone="success" icon={<ShieldCheck size={20} />} title={successMessage} />
                    )}

                    {/* ===================================================== */}
                    {/* ÉTAPE 1 — IDENTIFIANT (email OU téléphone)             */}
                    {/* ===================================================== */}
                    {step === 1 && (
                        <form onSubmit={handleStep1Submit} className="space-y-4">
                            <TextInput
                                id="recuperation-identifiant"
                                label="Email ou numéro de téléphone"
                                type="text"
                                inputMode={inputMode === 'email' ? 'email' : 'tel'}
                                value={identifier}
                                onChange={(e) => handleIdentifierChange(e.target.value)}
                                placeholder="ex : email@domaine.com ou 77 123 45 67"
                                required
                                autoComplete="username"
                                disabled={isLockedOut || isLoading}
                                hint={inputMode === 'email'
                                    ? 'Récupération par lien envoyé à cette adresse email.'
                                    : inputMode === 'phone'
                                        ? 'Récupération par code envoyé par SMS à ce numéro.'
                                        : undefined}
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={isLockedOut || isLoading || !identifier.trim()}
                                leftIcon={isLockedOut ? <Lock size={18} /> : inputMode === 'email' ? <Send size={18} /> : inputMode === 'phone' ? <Phone size={18} /> : <KeyRound size={18} />}
                            >
                                {isLockedOut
                                    ? `Bloqué (${lockoutRemaining} s)`
                                    : inputMode === 'email'
                                        ? 'Envoyer le lien de récupération'
                                        : inputMode === 'phone'
                                            ? 'Envoyer le code SMS'
                                            : 'Continuer'}
                            </Button>
                        </form>
                    )}

                    {/* ===================================================== */}
                    {/* ÉTAPE 2 — CODE REÇU PAR SMS (flux téléphone seulement) */}
                    {/* ===================================================== */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <p id="recuperation-otp-aide" className="text-center text-sm font-semibold text-fg">
                                Code envoyé au <span className="whitespace-nowrap tabular-nums text-brand-fg">{normalizePhoneNumber(identifier.trim())}</span>
                            </p>

                            <OtpInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={isLockedOut || isLoading}
                                hasError={!!errorMessage}
                                describedBy="recuperation-otp-aide"
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
                                {isLockedOut ? `Bloqué (${lockoutRemaining} s)` : 'Valider le code'}
                            </Button>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setStep(1); setOtpCode(''); setErrorMessage(null); setSuccessMessage(null); }}
                                    disabled={isLockedOut}
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

                    {/* ===================================================== */}
                    {/* LIEN ENVOYÉ — écran de confirmation                    */}
                    {/* ===================================================== */}
                    {step === 'email-sent' && (
                        <div className="space-y-5">
                            <StatusBanner tone="success" icon={<CheckCircle2 size={20} />} title="Lien envoyé">
                                Si un compte correspond à cette adresse, un lien de récupération vient de lui être envoyé.
                                Ouvrez-le pour choisir un nouveau mot de passe.
                            </StatusBanner>

                            <div className="space-y-2 rounded-2xl border border-info-border bg-info-bg p-4 text-info-fg">
                                <h2 className="text-sm font-semibold">Que faire ensuite ?</h2>
                                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                                    <li>Ouvrez l&apos;email reçu de <strong>no-reply@eventvillage.sn</strong>.</li>
                                    <li>Choisissez <strong>« Réinitialiser mon mot de passe »</strong>.</li>
                                    <li>Le lien expire dans <strong>60 minutes</strong>. Pensez à vérifier le dossier des courriers indésirables.</li>
                                </ol>
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

                    {/* Retour à la connexion */}
                    <div className="flex justify-center border-t border-border pt-4">
                        <LinkButton href="/login" variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
                            Retour à la connexion
                        </LinkButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
