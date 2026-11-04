'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Eye, EyeOff, LogIn, MessageSquareText, Pencil, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { getBrowserClient } from '@/lib/supabase/client';
import { RegisterStartSchema, RegisterWithCodeSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Inscription d'un client — lot 7 (7.3, D1, D61, contrat 3.6) : « numéro d'abord ».
 *  1. Numéro : POST /api/auth/register/start envoie un code par SMS. Aucun compte n'est créé. Un numéro déjà
 *     inscrit (409 PHONE_ALREADY_REGISTERED) propose « Recevoir un code de connexion » (connexion).
 *  2. Code et profil : POST /api/auth/register vérifie et consomme le code AVANT de créer le compte (ACTIF,
 *     numéro vérifié). Prénom, nom, mot de passe (bouton « Afficher ») ; email et parrainage sous « Plus
 *     d'options ». Renvoi du code après le délai servi par le serveur (resend_after).
 * Puis connexion par signInWithPassword (email réel, sinon email technique `<numéro>@eventvillage.sn`) et
 * redirection vers ?redirect= (chemin interne seulement, jamais « //… »), conservé depuis la connexion.
 * Plus d'écran « Compte activé » ni de vérification séparée par code : deux écrans au lieu de trois.
 */

type Step = 'phone' | 'profile';

/** Destination interne (?redirect=) : commence par « / », jamais « // » ni « /\ » (redirection ouverte). */
function safeInternalPath(raw: string | null): string | null {
    if (!raw) return null;
    const value = raw.trim();
    if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
    return value;
}

interface ApiResult {
    ok: boolean;
    status: number;
    body: Record<string, unknown> | null;
}

async function postJson(url: string, payload: unknown): Promise<ApiResult> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    let body: Record<string, unknown> | null = null;
    try {
        const parsed: unknown = await res.json();
        body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch (err) {
        console.error(`[RegisterPage] ${url} : réponse illisible (HTTP ${res.status})`, err);
    }
    return { ok: res.ok, status: res.status, body };
}

function messageOf(result: ApiResult, fallback: string): string {
    const error = result.body?.error;
    return typeof error === 'string' && error.trim() !== '' ? error : fallback;
}

function codeOf(result: ApiResult): string | null {
    const code = result.body?.code;
    return typeof code === 'string' ? code : null;
}

export default function RegisterPage() {
    const { refreshProfile } = useAuth();

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [confirmedPhone, setConfirmedPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [moreOptions, setMoreOptions] = useState(false);
    const [email, setEmail] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);
    const [signInFailed, setSignInFailed] = useState(false);

    const firstNameRef = useRef<HTMLInputElement | null>(null);

    // ?redirect= conservé depuis la connexion (D61), lu dans le navigateur seulement.
    useEffect(() => {
        setRedirectTo(safeInternalPath(new URLSearchParams(window.location.search).get('redirect')));
    }, []);

    // Décompte avant un nouveau code (délai servi par le serveur).
    useEffect(() => {
        if (resendIn <= 0) return;
        const timer = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(timer);
    }, [resendIn]);

    useEffect(() => {
        if (step === 'profile') firstNameRef.current?.focus();
    }, [step]);

    const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login';

    /** Étape 1 (et renvoi) : code d'inscription envoyé par SMS, aucun compte créé. */
    const sendCode = async (mode: 'first' | 'resend') => {
        setErrorMessage(null);
        setCodeError(null);
        setInfoMessage(null);
        setAlreadyRegistered(false);

        const target = mode === 'first' ? phone.trim() : confirmedPhone;
        const parsed = RegisterStartSchema.safeParse({ phone: target });
        if (!parsed.success) {
            setErrorMessage(parsed.error.errors[0]?.message ?? 'Numéro de téléphone sénégalais invalide (ex : 77 123 45 67).');
            return;
        }

        setIsLoading(true);
        try {
            const result = await postJson('/api/auth/register/start', { phone: target });
            if (!result.ok) {
                if (codeOf(result) === 'PHONE_ALREADY_REGISTERED') {
                    setAlreadyRegistered(true);
                    setStep('phone');
                }
                setErrorMessage(messageOf(result, `Le code n’a pas pu être envoyé (erreur ${result.status}). Réessayez.`));
                return;
            }
            const servedPhone = typeof result.body?.phone === 'string' ? result.body.phone : normalizePhoneNumber(target);
            const resendAfter = typeof result.body?.resend_after === 'number' ? result.body.resend_after : 60;
            setConfirmedPhone(servedPhone);
            setResendIn(Math.max(0, Math.round(resendAfter)));
            setOtpCode('');
            setStep('profile');
            setInfoMessage(mode === 'first' ? `Code envoyé par SMS au ${servedPhone}.` : `Nouveau code envoyé au ${servedPhone} : seul le dernier code reçu est valable.`);
        } catch (err) {
            console.error('[RegisterPage] envoi du code d’inscription impossible :', err);
            setErrorMessage('Connexion impossible : le code n’a pas pu être envoyé. Vérifiez votre réseau puis réessayez.');
        } finally {
            setIsLoading(false);
        }
    };

    /** Étape 2 : le serveur vérifie et consomme le code, puis crée le compte ; ouverture de la session. */
    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setCodeError(null);
        setSignInFailed(false);

        if (!/^\d{6}$/.test(otpCode)) {
            setCodeError('Saisissez le code à 6 chiffres reçu par SMS.');
            return;
        }
        const payload = {
            phone: confirmedPhone,
            code: otpCode,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            password,
            email: email.trim() || undefined,
            referralCode: referralCode.trim() || undefined,
        };
        const parsed = RegisterWithCodeSchema.safeParse(payload);
        if (!parsed.success) {
            setErrorMessage(parsed.error.errors[0]?.message ?? 'Vérifiez les informations saisies.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await postJson('/api/auth/register', payload);
            if (!result.ok) {
                const code = codeOf(result);
                const message = messageOf(result, `Le compte n’a pas pu être créé (erreur ${result.status}).`);
                if (code === 'INVALID_CODE' || code === 'CODE_EXPIRED' || code === 'TOO_MANY_ATTEMPTS' || code === 'REGISTRATION_CODE_REQUIRED') {
                    setCodeError(code === 'TOO_MANY_ATTEMPTS' ? `${message} Demandez un nouveau code.` : message);
                } else {
                    if (code === 'ACCOUNT_ALREADY_EXISTS') setAlreadyRegistered(true);
                    setErrorMessage(message);
                }
                return;
            }

            // Compte créé (numéro vérifié) : ouverture de la session avec l'email du compte.
            const accountEmail = typeof result.body?.email === 'string' && result.body.email
                ? result.body.email
                : (email.trim().toLowerCase() || `${confirmedPhone.replace('+', '')}@eventvillage.sn`);
            const supabase = getBrowserClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: accountEmail, password });
            if (signInError) {
                console.error('[RegisterPage] connexion après inscription impossible :', signInError.message);
                setSignInFailed(true);
                return;
            }
            await refreshProfile();
            window.location.href = redirectTo ?? '/';
        } catch (err) {
            console.error('[RegisterPage] création du compte impossible :', err);
            setErrorMessage('Connexion interrompue : votre compte n’a peut-être pas été créé. Réessayez, ou connectez-vous si vous avez déjà terminé.');
        } finally {
            setIsLoading(false);
        }
    };

    const changePhone = () => {
        setStep('phone');
        setOtpCode('');
        setCodeError(null);
        setErrorMessage(null);
        setInfoMessage(null);
    };

    return (
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-lg space-y-5">
                <div className="flex justify-center">
                    <Logo variant="full" />
                </div>
                <PageHeader
                    eyebrow={<span className="text-sm font-semibold text-fg-muted">{step === 'phone' ? 'Étape 1 sur 2 : votre numéro' : 'Étape 2 sur 2 : code et profil'}</span>}
                    title="Créer un compte"
                    description={step === 'phone'
                        ? 'Commencez par votre numéro : nous vous envoyons un code par SMS pour le vérifier.'
                        : 'Saisissez le code reçu, puis vos informations : votre compte est créé dès que le code est vérifié.'}
                    className="pb-0 sm:pb-0"
                />

                <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
                    {/* Progression (décorative : l'étape est écrite au-dessus du titre) */}
                    <div aria-hidden="true" className="flex items-center justify-center gap-2">
                        {(['phone', 'profile'] as const).map((s) => (
                            <span
                                key={s}
                                className={cn(
                                    'h-2 rounded-full transition-colors duration-200',
                                    s === step || (s === 'phone' && step === 'profile') ? 'w-12 bg-brand' : 'w-4 bg-border',
                                )}
                            />
                        ))}
                    </div>

                    {errorMessage && (
                        <StatusBanner
                            tone="danger"
                            announce="alert"
                            title={errorMessage}
                            action={alreadyRegistered ? (
                                <LinkButton href={loginHref} variant="secondary" size="sm" leftIcon={<LogIn size={16} />}>
                                    Recevoir un code de connexion
                                </LinkButton>
                            ) : undefined}
                        />
                    )}

                    {signInFailed && (
                        <StatusBanner
                            tone="success"
                            title="Compte créé : connectez-vous pour continuer"
                            action={(
                                <LinkButton href={loginHref} variant="secondary" size="sm" leftIcon={<LogIn size={16} />}>
                                    Se connecter
                                </LinkButton>
                            )}
                        >
                            Votre numéro est vérifié, mais la session n’a pas pu s’ouvrir automatiquement.
                        </StatusBanner>
                    )}

                    {infoMessage && step === 'profile' && !signInFailed && (
                        <StatusBanner tone="success" icon={<ShieldCheck size={20} />} title={infoMessage} />
                    )}

                    {/* ÉTAPE 1 : numéro */}
                    {step === 'phone' && (
                        <form
                            noValidate
                            onSubmit={(e) => {
                                e.preventDefault();
                                void sendCode('first');
                            }}
                            className="space-y-4"
                        >
                            <TextInput
                                id="inscription-telephone"
                                label="Numéro de téléphone (Sénégal)"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    setAlreadyRegistered(false);
                                }}
                                placeholder="77 123 45 67"
                                hint="Mobile sénégalais : 70, 75, 76, 77 ou 78. Le code arrive par SMS sur ce numéro."
                                required
                            />
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                leftIcon={<MessageSquareText size={18} />}
                            >
                                Recevoir le code par SMS
                            </Button>
                        </form>
                    )}

                    {/* ÉTAPE 2 : code reçu et profil */}
                    {step === 'profile' && (
                        <form noValidate onSubmit={handleCreateAccount} className="space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-sunken px-4 py-2">
                                <p className="text-sm text-fg">
                                    Numéro : <span className="whitespace-nowrap font-semibold tabular-nums">{confirmedPhone}</span>
                                </p>
                                <Button type="button" variant="ghost" size="sm" onClick={changePhone} disabled={isLoading} leftIcon={<Pencil size={16} />}>
                                    Modifier le numéro
                                </Button>
                            </div>

                            <fieldset className="space-y-3">
                                <legend id="inscription-otp-titre" className="text-sm font-semibold text-fg">Code reçu par SMS</legend>
                                <p id="inscription-otp-aide" className="text-sm text-fg-muted">
                                    6 chiffres, envoyés au <span className="whitespace-nowrap tabular-nums">{confirmedPhone}</span>.
                                </p>
                                <OtpInput
                                    value={otpCode}
                                    onChange={(value) => {
                                        setOtpCode(value);
                                        setCodeError(null);
                                    }}
                                    disabled={isLoading}
                                    hasError={Boolean(codeError)}
                                    describedBy={codeError ? 'inscription-otp-aide inscription-otp-erreur' : 'inscription-otp-aide'}
                                />
                                {codeError && (
                                    <p id="inscription-otp-erreur" role="alert" className="text-sm font-medium text-danger-fg">{codeError}</p>
                                )}
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-brand-fg"
                                        onClick={() => void sendCode('resend')}
                                        disabled={resendIn > 0 || isLoading}
                                        leftIcon={<RotateCcw size={16} />}
                                    >
                                        {resendIn > 0 ? `Nouveau code dans ${resendIn} s` : 'Recevoir un nouveau code'}
                                    </Button>
                                </div>
                            </fieldset>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <TextInput
                                    ref={firstNameRef}
                                    id="inscription-prenom"
                                    label="Prénom"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Moussa"
                                    autoComplete="given-name"
                                    required
                                />
                                <TextInput
                                    id="inscription-nom"
                                    label="Nom"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Diop"
                                    autoComplete="family-name"
                                    required
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <TextInput
                                        id="inscription-mot-de-passe"
                                        label="Mot de passe"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="8 caractères au moins"
                                        autoComplete="new-password"
                                        required
                                        className={cn('pr-14', password.length > 0 && (allPasswordCriteriaMet(password) ? 'border-success' : 'border-warning'))}
                                    />
                                    <IconButton
                                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                        aria-controls="inscription-mot-de-passe"
                                        aria-pressed={showPassword}
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={isLoading}
                                        className="absolute bottom-px right-px"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </IconButton>
                                </div>
                                <PasswordStrengthChecklist password={password} id="inscription-mot-de-passe-criteres" />
                            </div>

                            <div className="rounded-2xl border border-border">
                                <button
                                    type="button"
                                    aria-expanded={moreOptions}
                                    aria-controls="inscription-options"
                                    onClick={() => setMoreOptions((v) => !v)}
                                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-fg transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span>Plus d’options : email, code de parrainage</span>
                                    <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 transition-transform motion-reduce:transition-none', moreOptions && 'rotate-180')} />
                                </button>
                                {moreOptions && (
                                    <div id="inscription-options" className="space-y-4 border-t border-border p-4">
                                        <TextInput
                                            id="inscription-email"
                                            label="Adresse email (facultative)"
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="client@domaine.com"
                                            hint="Pour recevoir vos confirmations d’achat par email."
                                        />
                                        <TextInput
                                            id="inscription-parrainage"
                                            label="Code de parrainage (facultatif)"
                                            value={referralCode}
                                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                            placeholder="ex : EV-AMB-1234"
                                            autoComplete="off"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={otpCode.length !== 6}
                                leftIcon={<UserPlus size={18} />}
                            >
                                Créer mon compte
                            </Button>
                        </form>
                    )}

                    <p className="flex flex-wrap items-center justify-center gap-x-1.5 border-t border-border pt-4 text-sm text-fg-muted">
                        <span>Déjà un compte ?</span>
                        <Link
                            href={loginHref}
                            className="inline-flex min-h-11 items-center rounded-lg font-semibold text-brand-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
