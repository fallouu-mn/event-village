'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Eye, EyeOff, LogIn, MessageSquareText, Pencil, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
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
import { safeInternalPath } from '@/lib/auth/safe-redirect';
import { LOGIN_PREFILL_PHONE_KEY } from '@/components/auth/LoginForm';

/**
 * Inscription d'un client — lot 7 (7.3, D1, D61, contrat 3.6) : « numéro d'abord ».
 *  1. Numéro : POST /api/auth/register/start envoie un code par SMS. Aucun compte n'est créé. Un numéro déjà
 *     inscrit (409 PHONE_ALREADY_REGISTERED) propose « Recevoir un code de connexion » (connexion).
 *  2. Code et profil : POST /api/auth/register vérifie et consomme le code AVANT de créer le compte (ACTIF,
 *     numéro vérifié). Prénom, nom, mot de passe (bouton « Afficher »), puis l'adresse email, facultative mais
 *     visible (lot 9 bis, G.47) ; le code de parrainage seul reste sous « Plus d'options ». Renvoi du code après le
 *     délai servi par le serveur (resend_after).
 * Puis connexion par signInWithPassword avec l'email du compte rendu par la route : l'adresse technique
 * une adresse technique (lot 9 quater : « u…@comptes.eventvillage.invalid », jamais tirée du numéro ; lot 9 bis, R87 : l'adresse saisie attend sa vérification dans users.email_pending et
 * n'est jamais identifiant de connexion avant), et redirection vers ?redirect= (chemin interne seulement, jamais
 * « //… »), conservé depuis la connexion.
 * Adresse saisie : la page ne redirige pas tout de suite, elle dit le sort du lien de vérification (envoyé, valable
 * 24 heures ; non parti ; envoi des emails indisponible) et propose « Continuer », pour que la personne sache où
 * chercher le lien. Refus qui nomme un champ (adresse réservée ou invalide, code de parrainage inconnu, R86) : message
 * sous le champ, qui reçoit le focus ; le code SMS reste valable.
 */

type Step = 'phone' | 'profile';

/** Longueur admise par RegisterWithCodeSchema : un lien trafiqué ne bloque pas l'inscription sur un refus de validation. */
const REFERRAL_CODE_MAX = 64;


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

/** Champs dont l'erreur est dite sous le champ (refus de validation ou de la route qui les nomment). */
type FieldName = 'email' | 'referralCode';

function fieldNameOf(value: unknown): FieldName | null {
    return value === 'email' || value === 'referralCode' ? value : null;
}

/** Sort du lien de vérification de l'adresse saisie (contrat 4.6 : `email_verification` de la réponse). */
interface EmailNotice {
    tone: 'success' | 'warning';
    title: string;
    text: string;
}

function emailNoticeOf(state: unknown, address: string): EmailNotice {
    if (state === 'SENT') {
        return { tone: 'success', title: 'Vérifiez votre adresse email', text: `Un lien de vérification a été envoyé à ${address}. Il est valable 24 heures.` };
    }
    if (state === 'NOT_CONFIGURED') {
        return {
            tone: 'warning',
            title: 'Adresse enregistrée, non vérifiée',
            text: 'L’envoi des emails n’est pas encore disponible. Votre adresse est enregistrée : vous pourrez la vérifier plus tard.',
        };
    }
    return { tone: 'warning', title: 'Adresse enregistrée, non vérifiée', text: 'Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil.' };
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
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
    const [emailNotice, setEmailNotice] = useState<EmailNotice | null>(null);
    const [created, setCreated] = useState(false);

    const firstNameRef = useRef<HTMLInputElement | null>(null);
    const emailRef = useRef<HTMLInputElement | null>(null);
    const referralRef = useRef<HTMLInputElement | null>(null);
    /** Champ à focaliser après le rendu (le champ du parrainage n'existe qu'une fois les options ouvertes). */
    const [focusField, setFocusField] = useState<FieldName | null>(null);

    // ?redirect= conservé depuis la connexion (D61) et ?ref= du lien de parrainage (A2), lus dans le navigateur
    // seulement. « Plus d'options » s'ouvre pour que le code prérempli reste visible et modifiable.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setRedirectTo(safeInternalPath(params.get('redirect')));
        const ref = params.get('ref')?.trim();
        if (ref) {
            setReferralCode(ref.slice(0, REFERRAL_CODE_MAX).toUpperCase());
            setMoreOptions(true);
        }
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

    useEffect(() => {
        if (!focusField) return;
        (focusField === 'email' ? emailRef : referralRef).current?.focus();
        setFocusField(null);
    }, [focusField]);

    // Compte créé avec une adresse : le formulaire disparaît, le focus va sur « Continuer », juste après le message du
    // lien (annoncé par son bandeau).
    useEffect(() => {
        if (created) document.getElementById('inscription-continuer')?.focus();
    }, [created]);

    /** Erreur d'un champ effacée dès qu'il est modifié. */
    const clearFieldError = (field: FieldName) => {
        setFieldErrors((current) => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    /** Erreur dite sous son champ ; le code de parrainage ouvre d'abord « Plus d'options ». */
    const showFieldError = (field: FieldName, message: string) => {
        setFieldErrors({ [field]: message });
        if (field === 'referralCode') setMoreOptions(true);
        setFocusField(field);
    };

    const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login';
    // Lot 9 quinquies (B6 : E-57) : « Recevoir un code de connexion » ouvre l'onglet « Code SMS », numéro prérempli (passé par
    // sessionStorage, jamais dans l'adresse)
    const codeLoginHref = `/login?mode=code${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ''}`;
    const rememberPhoneForLogin = () => {
        try {
            sessionStorage.setItem(LOGIN_PREFILL_PHONE_KEY, phone.trim());
        } catch (err) {
            console.warn('[inscription] numéro non transmis à la connexion :', err instanceof Error ? err.message : String(err));
        }
    };

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
        setFieldErrors({});
        setEmailNotice(null);

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
            const issue = parsed.error.errors[0];
            const message = issue?.message ?? 'Vérifiez les informations saisies.';
            const field = fieldNameOf(issue?.path[0]);
            if (field) showFieldError(field, message);
            else setErrorMessage(message);
            return;
        }

        setIsLoading(true);
        try {
            const result = await postJson('/api/auth/register', payload);
            if (!result.ok) {
                const code = codeOf(result);
                const message = messageOf(result, `Le compte n’a pas pu être créé (erreur ${result.status}).`);
                const field = fieldNameOf(result.body?.field);
                if (code === 'INVALID_CODE' || code === 'CODE_EXPIRED' || code === 'TOO_MANY_ATTEMPTS' || code === 'REGISTRATION_CODE_REQUIRED') {
                    setCodeError(code === 'TOO_MANY_ATTEMPTS' ? `${message} Demandez un nouveau code.` : message);
                } else if (field) {
                    // R86 (REFERRAL_CODE_UNKNOWN) et adresse refusée (INVALID_FIELD) : sous le champ ; le code SMS reste valable.
                    showFieldError(field, message);
                } else {
                    if (code === 'ACCOUNT_ALREADY_EXISTS') setAlreadyRegistered(true);
                    setErrorMessage(message);
                }
                return;
            }

            // Compte créé (numéro vérifié) : ouverture de la session par la route de connexion de l'application, avec le
            // numéro vérifié rendu par l'inscription. Contre-vérification du lot 9 quinquies (point 2) : le navigateur ne
            // parle plus à GoTrue avec un identifiant (GoTrue ne connaît qu'une adresse technique secrète).
            const accountPhone = typeof result.body?.phone === 'string' && result.body.phone ? result.body.phone : null;
            if (!accountPhone) {
                console.error('[RegisterPage] réponse d’inscription sans numéro');
                setSignInFailed(true);
                return;
            }
            const pendingEmail = typeof result.body?.email_pending === 'string' && result.body.email_pending ? result.body.email_pending : null;
            const notice = pendingEmail ? emailNoticeOf(result.body?.email_verification, pendingEmail) : null;
            setEmailNotice(notice);
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: accountPhone, password }),
            });
            const login = (await loginRes.json().catch((err: unknown) => {
                console.error('[RegisterPage] réponse de connexion illisible, code HTTP', loginRes.status, err);
                return null;
            })) as { ok?: boolean; code?: string } | null;
            if (!loginRes.ok || login?.ok !== true) {
                console.error('[RegisterPage] connexion après inscription impossible :', loginRes.status, login?.code ?? '');
                setSignInFailed(true);
                return;
            }
            // Session posée par le serveur (cookies) : relue par le navigateur, comme après la connexion (LoginForm)
            const { error: refreshError } = await getBrowserClient().auth.refreshSession();
            if (refreshError) {
                console.error('[RegisterPage] session posée par le serveur illisible dans le navigateur :', refreshError.message);
                setSignInFailed(true);
                return;
            }
            await refreshProfile();
            if (notice) {
                // Le message du lien reste lisible : la personne continue quand elle l'a lu.
                setCreated(true);
                return;
            }
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
                        : created
                            ? 'Votre compte est créé et votre numéro est vérifié.'
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
                                <LinkButton href={codeLoginHref} onClick={rememberPhoneForLogin} variant="secondary" size="sm" leftIcon={<LogIn size={16} />}>
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

                    {signInFailed && emailNotice && (
                        <StatusBanner tone={emailNotice.tone} title={emailNotice.title}>
                            {emailNotice.text}
                        </StatusBanner>
                    )}

                    {infoMessage && step === 'profile' && !signInFailed && !created && (
                        <StatusBanner tone="success" icon={<ShieldCheck size={20} />} title={infoMessage} />
                    )}

                    {/* Compte créé avec une adresse : sort du lien de vérification, puis « Continuer » (G.47, R87). */}
                    {created && emailNotice && (
                        <div className="space-y-4">
                            <StatusBanner tone={emailNotice.tone} title={emailNotice.title}>
                                {emailNotice.text}
                            </StatusBanner>
                            <Button
                                id="inscription-continuer"
                                type="button"
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={() => { window.location.href = redirectTo ?? '/'; }}
                                rightIcon={<ArrowRight size={18} />}
                            >
                                Continuer
                            </Button>
                        </div>
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
                    {step === 'profile' && !created && (
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
                                        placeholder="10 caractères au moins"
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

                            {/* Lot 9 bis (G.47) : l'email reste facultatif mais n'est plus caché sous « Plus d'options ». */}
                            <TextInput
                                ref={emailRef}
                                id="inscription-email"
                                label="Adresse email (facultative)"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                maxLength={254}
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearFieldError('email');
                                }}
                                placeholder="client@domaine.com"
                                hint="Recommandé : recevez vos billets et confirmations par email"
                                error={fieldErrors.email}
                            />

                            <div className="rounded-2xl border border-border">
                                <button
                                    type="button"
                                    aria-expanded={moreOptions}
                                    aria-controls="inscription-options"
                                    onClick={() => setMoreOptions((v) => !v)}
                                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-fg transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span>Plus d’options : code de parrainage</span>
                                    <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 transition-transform motion-reduce:transition-none', moreOptions && 'rotate-180')} />
                                </button>
                                {moreOptions && (
                                    <div id="inscription-options" className="space-y-4 border-t border-border p-4">
                                        <TextInput
                                            ref={referralRef}
                                            id="inscription-parrainage"
                                            label="Code de parrainage (facultatif)"
                                            value={referralCode}
                                            onChange={(e) => {
                                                setReferralCode(e.target.value.toUpperCase());
                                                clearFieldError('referralCode');
                                            }}
                                            placeholder="ex : EV-AMB-1234"
                                            autoComplete="off"
                                            error={fieldErrors.referralCode}
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

                    {!created && (
                        <p className="flex flex-wrap items-center justify-center gap-x-1.5 border-t border-border pt-4 text-sm text-fg-muted">
                            <span>Déjà un compte ?</span>
                            <Link
                                href={loginHref}
                                className="inline-flex min-h-11 items-center rounded-lg font-semibold text-brand-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                Se connecter
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
