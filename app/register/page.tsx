'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    UserPlus,
    User,
    Phone,
    Mail,
    Gift,
    ShieldCheck,
    AlertCircle,
    RotateCcw,
    CheckCircle2,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { RegisterClientSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { useAuth } from '@/components/providers/AuthProvider';

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

            if (signInData?.session?.access_token) {
                const maxAge = 60 * 60 * 24 * 7;
                document.cookie = `sb-access-token=${encodeURIComponent(signInData.session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
            }

            // Rafraîchir immédiatement le state utilisateur dans AuthProvider
            await refreshProfile();

            // 3. Récupération du rôle réel de l'utilisateur pour le Smart Routing
            let userRole: string = 'CLIENT';
            if (signInData?.user?.id) {
                const { data: userProfile } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', signInData.user.id)
                    .maybeSingle();

                userRole = (userProfile as { role?: string } | null)?.role || (signInData.user.user_metadata?.role as string) || 'CLIENT';
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
                    targetRoute = '/scan';
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

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 pb-20">
            <div className="w-full max-w-lg space-y-6">
                {/* Header & Logo */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <Logo variant="full" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        {step === 1 && 'Créer un compte Client'}
                        {step === 2 && 'Vérification du Téléphone'}
                        {step === 3 && 'Compte Activé !'}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        {step === 1 && 'Rejoignez Event Village pour réserver vos billets, tables et commandes.'}
                        {step === 2 && 'Confirmez votre numéro de téléphone par SMS pour sécuriser vos accès.'}
                        {step === 3 && 'Bienvenue sur Event Village ! Redirection en cours...'}
                    </p>
                </div>

                {/* Carte Formulaire */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-6">
                    {/* Indicateur d'étape */}
                    <div className="flex items-center justify-center gap-2">
                        <div className={`h-2 rounded-full transition-all ${step >= 1 ? 'w-12 bg-[#FF5722]' : 'w-4 bg-slate-200 dark:bg-zinc-800'}`} />
                        <div className={`h-2 rounded-full transition-all ${step >= 2 ? 'w-12 bg-[#FF5722]' : 'w-4 bg-slate-200 dark:bg-zinc-800'}`} />
                        <div className={`h-2 rounded-full transition-all ${step === 3 ? 'w-12 bg-emerald-500' : 'w-4 bg-slate-200 dark:bg-zinc-800'}`} />
                    </div>

                    {/* Messages d'erreur et de succès */}
                    {errorMessage && (
                        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
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

                    {/* ÉTAPE 1 : Formulaire d'inscription */}
                    {step === 1 && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Prénom
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Moussa"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                        />
                                        <User size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Nom
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Diop"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                        />
                                        <User size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Numéro de Téléphone (Sénégal) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="77 123 45 67 ou +221 78 987 65 43"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                    />
                                    <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                                    Format sénégalais : 77, 78, 76, 70 ou 75.
                                </span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Adresse Email (Optionnelle)
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="client@domaine.com"
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                    />
                                    <Mail size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Mot de passe *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Min. 6 caractères"
                                            required
                                            autoComplete="new-password"
                                            className="w-full px-4 py-3 pr-11 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            disabled={isLoading}
                                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Confirmer *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            autoComplete="new-password"
                                            className="w-full px-4 py-3 pr-11 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((v) => !v)}
                                            disabled={isLoading}
                                            aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                                            tabIndex={-1}
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Code de Parrainage (Optionnel)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                        placeholder="ex: EV-AMB-1234"
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                    />
                                    <Gift size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

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

                    {/* ÉTAPE 2 : Saisie OTP SMS */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="text-center space-y-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    Code SMS à 6 chiffres envoyé au {normalizePhoneNumber(phone)}
                                </span>
                            </div>

                            <OtpInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={isLoading}
                                hasError={!!errorMessage}
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

                            <div className="flex items-center justify-between text-xs pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium"
                                >
                                    Modifier mes informations
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={countdown > 0 || isLoading}
                                    className="text-[#FF5722] font-bold disabled:opacity-50 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} />
                                    <span>{countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer le code SMS'}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ÉTAPE 3 : Succès & Activation */}
                    {step === 3 && (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-500 shadow-md animate-bounce">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                Compte activé avec succès !
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
                                Vous êtes désormais connecté à Event Village. Redirection automatique vers votre espace...
                            </p>
                        </div>
                    )}

                    {/* Lien vers Login */}
                    {step === 1 && (
                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 text-center">
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                                Déjà un compte ?{' '}
                            </span>
                            <Link
                                href="/login"
                                className="text-xs font-black text-[#FF5722] hover:underline"
                            >
                                Se connecter
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
