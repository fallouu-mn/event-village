'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    UserPlus,
    ShieldCheck,
    RotateCcw,
    CheckCircle2,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { getBrowserClient } from '@/lib/supabase/client';
import { RegisterClientSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Inscription d'un client (lot 6, contrat A5 : écran sur le système de design, logique inchangée) :
 * validation RegisterClientSchema, POST /api/auth/register, code SMS (/api/auth/verify-otp), puis connexion
 * avec l'email réel ou l'email technique `<numéro>@eventvillage.sn`, et redirection selon le rôle.
 */

export default function RegisterPage() {
    const router = useRouter();
    const { refreshProfile } = useAuth();

    // État du formulaire
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');

    // Workflow étape (1: Formulaire, 2: Vérification OTP, 3: Compte Activé)
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [otpCode, setOtpCode] = useState('');
    const [countdown, setCountdown] = useState(60);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Décompte pour renvoi OTP
    useEffect(() => {
        if (step !== 2 || countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [step, countdown]);

    // Étape 1 : Soumission du formulaire d'inscription
    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const parseResult = RegisterClientSchema.safeParse({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            password,
            confirmPassword,
            referralCode: referralCode.trim() || undefined,
        });

        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Veuillez vérifier les informations saisies.';
            setErrorMessage(firstError);
            return;
        }

        setIsLoading(true);
        const normalizedPhone = normalizePhoneNumber(phone.trim());

        try {
            // 1. Enregistrement sécurisé via l'API serveur Next.js
            const registerRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone: phone.trim(),
                    email: email.trim() || undefined,
                    password,
                    confirmPassword,
                    referralCode: referralCode.trim() || undefined,
                }),
            });

            const registerData = await registerRes.json();
            if (!registerRes.ok) {
                throw new Error(registerData.error || 'Erreur lors de la création du compte.');
            }

            // Passage à l'étape 2 : Vérification OTP
            setStep(2);
            setCountdown(60);
            setSuccessMessage(`Code de confirmation envoyé par SMS au ${normalizedPhone}.`);
        } catch (err: unknown) {
            console.error('[RegisterPage] Erreur inscription:', err);
            const msg = err instanceof Error ? err.message : 'Erreur lors de la création du compte.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // Étape 2 : Vérification OTP et activation
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (otpCode.length !== 6) {
            setErrorMessage('Veuillez saisir le code à 6 chiffres reçu par SMS.');
            return;
        }

        setIsLoading(true);
        const supabase = getBrowserClient();
        const normalizedPhone = normalizePhoneNumber(phone.trim());
        const effectiveEmail = email.trim().toLowerCase() || `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

        try {
            // 1. Validation de l'OTP auprès du service backend
            const verifyRes = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, otpCode }),
            });

            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok) {
                throw new Error(verifyJson.error || 'Code de vérification incorrect.');
            }

            // 2. Connexion active à la session Supabase
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: effectiveEmail,
                password,
            });

            if (signInError) {
                console.warn('[Register] Connexion post-OTP:', signInError);
            }

            // Rafraîchir immédiatement le state utilisateur dans AuthProvider
            await refreshProfile();

            // 3. Récupération du rôle réel de l'utilisateur pour le Smart Routing
            //    (lot 1B.1 : profil en base uniquement, jamais user_metadata)
            let userRole: string = 'CLIENT';
            if (signInData?.user?.id) {
                const { data: userProfile, error: profileErr } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', signInData.user.id)
                    .maybeSingle();
                if (profileErr) console.error('[Register] lecture du profil pour la redirection :', profileErr.message);

                userRole = (userProfile as { role?: string } | null)?.role || 'CLIENT';
            }

            // 4. Smart Routing post-inscription selon le rôle
            let targetRoute = '/';
            switch (userRole) {
                case 'SUPERADMIN':
                case 'ADMIN':
                    targetRoute = '/admin';
                    break;
                case 'PARTENAIRE':
                    targetRoute = '/partner';
                    break;
                case 'CONTROLEUR':
                    targetRoute = '/controller/scanner';
                    break;
                case 'CLIENT':
                default:
                    targetRoute = '/';
                    break;
            }

            setStep(3);
            setTimeout(() => {
                router.refresh();
                window.location.href = targetRoute;
            }, 1200);
        } catch (err: unknown) {
            console.error('[RegisterPage] Erreur validation OTP:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la validation.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // Renvoi du code OTP
    const handleResendOtp = async () => {
        setErrorMessage(null);
        setIsLoading(true);
        const normalizedPhone = normalizePhoneNumber(phone.trim());

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Impossible d\'envoyer le SMS');

            setCountdown(60);
            setSuccessMessage('Un nouveau code OTP a été envoyé par SMS.');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Impossible de renvoyer le code.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const stepDescription = step === 1
        ? 'Rejoignez Event Village pour réserver vos billets, tables et commandes.'
        : step === 2
            ? 'Confirmez votre numéro de téléphone par SMS pour sécuriser vos accès.'
            : 'Bienvenue sur Event Village. Redirection en cours…';

    return (
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-lg space-y-5">
                <div className="flex justify-center">
                    <Logo variant="full" />
                </div>
                <PageHeader
                    eyebrow={<span className="text-sm font-semibold text-fg-muted">Étape {step} sur 3</span>}
                    title={step === 1 ? 'Créer un compte' : step === 2 ? 'Vérification du téléphone' : 'Compte activé'}
                    description={stepDescription}
                    className="pb-0 sm:pb-0"
                />

                {/* Carte du formulaire */}
                <div className="space-y-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
                    {/* Progression : informations, vérification, activation (décorative : l'étape est écrite au-dessus du titre) */}
                    <div aria-hidden="true" className="flex items-center justify-center gap-2">
                        {([1, 2, 3] as const).map((s) => (
                            <span
                                key={s}
                                className={cn(
                                    'h-2 rounded-full transition-colors duration-200',
                                    s === 3 && step === 3 ? 'w-12 bg-success' : step >= s ? 'w-12 bg-brand' : 'w-4 bg-border',
                                )}
                            />
                        ))}
                    </div>

                    {/* Messages d'erreur et de succès */}
                    {errorMessage && (
                        <StatusBanner tone="danger" announce="alert" title={errorMessage} />
                    )}

                    {successMessage && step !== 3 && (
                        <StatusBanner tone="success" icon={<ShieldCheck size={20} />} title={successMessage} />
                    )}

                    {/* ÉTAPE 1 : formulaire d'inscription */}
                    {step === 1 && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <TextInput
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

                            <TextInput
                                id="inscription-telephone"
                                label="Numéro de téléphone (Sénégal)"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="77 123 45 67 ou +221 78 987 65 43"
                                hint="Format sénégalais : 77, 78, 76, 70 ou 75."
                                required
                            />

                            <TextInput
                                id="inscription-email"
                                label="Adresse email (facultative)"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="client@domaine.com"
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={isLoading}
                                        className="absolute bottom-px right-px"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </IconButton>
                                </div>

                                <div className="relative">
                                    <TextInput
                                        id="inscription-confirmation"
                                        label="Confirmer le mot de passe"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Le même mot de passe"
                                        autoComplete="new-password"
                                        required
                                        className="pr-14"
                                    />
                                    <IconButton
                                        aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                                        aria-controls="inscription-confirmation"
                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                        disabled={isLoading}
                                        className="absolute bottom-px right-px"
                                    >
                                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </IconButton>
                                </div>
                            </div>

                            <PasswordStrengthChecklist password={password} />

                            <TextInput
                                id="inscription-parrainage"
                                label="Code de parrainage (facultatif)"
                                value={referralCode}
                                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                placeholder="ex : EV-AMB-1234"
                                autoComplete="off"
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                leftIcon={<UserPlus size={18} />}
                            >
                                Continuer vers la vérification
                            </Button>
                        </form>
                    )}

                    {/* ÉTAPE 2 : code reçu par SMS */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <p id="inscription-otp-aide" className="text-center text-sm font-semibold text-fg">
                                Code à 6 chiffres envoyé au <span className="whitespace-nowrap tabular-nums">{normalizePhoneNumber(phone)}</span>
                            </p>

                            <OtpInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={isLoading}
                                hasError={!!errorMessage}
                                describedBy="inscription-otp-aide"
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                disabled={otpCode.length !== 6}
                                leftIcon={<ShieldCheck size={18} />}
                            >
                                Valider mon inscription
                            </Button>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                                    Modifier mes informations
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-brand-fg"
                                    onClick={handleResendOtp}
                                    disabled={countdown > 0 || isLoading}
                                    leftIcon={<RotateCcw size={16} />}
                                >
                                    {countdown > 0 ? `Renvoyer (${countdown} s)` : 'Renvoyer le code SMS'}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ÉTAPE 3 : compte activé */}
                    {step === 3 && (
                        <div role="status" className="space-y-4 py-6 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-success-border bg-success-bg text-success-fg" aria-hidden="true">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-lg font-bold text-fg">
                                Compte activé avec succès
                            </h2>
                            <p className="mx-auto max-w-xs text-sm text-fg-muted">
                                Vous êtes désormais connecté à Event Village. Redirection automatique vers votre espace…
                            </p>
                        </div>
                    )}

                    {/* Lien vers la connexion */}
                    {step === 1 && (
                        <p className="flex flex-wrap items-center justify-center gap-x-1.5 border-t border-border pt-4 text-sm text-fg-muted">
                            <span>Déjà un compte ?</span>
                            <Link
                                href="/login"
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
