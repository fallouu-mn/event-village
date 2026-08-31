'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    KeyRound,
    Phone,
    Mail,
    ArrowLeft,
    ShieldCheck,
    AlertCircle,
    RotateCcw,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [step, setStep] = useState<1 | 2>(1);
    const [otpCode, setOtpCode] = useState('');
    const [countdown, setCountdown] = useState(60);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (step !== 2 || countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [step, countdown]);

    // Étape 1 : Demande de récupération par email ou téléphone
    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const val = identifier.trim();
        if (!val) {
            setErrorMessage('Veuillez renseigner votre email ou numéro de téléphone.');
            return;
        }

        setIsLoading(true);
        const supabase = getBrowserClient();
        const isEmail = val.includes('@');

        try {
            if (isEmail) {
                const { error } = await supabase.auth.resetPasswordForEmail(val.toLowerCase(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) throw error;
                setSuccessMessage('Un lien de réinitialisation vous a été envoyé par email.');
            } else {
                const normalizedPhone = normalizePhoneNumber(val);
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: normalizedPhone, purpose: 'PASSWORD_RESET' }),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Impossible d\'envoyer le code SMS.');

                setStep(2);
                setCountdown(60);
                setSuccessMessage(`Un code de récupération a été envoyé par SMS au ${normalizedPhone}.`);
            }
        } catch (err: unknown) {
            console.error('[ForgotPassword] Erreur demande:', err);
            const msg = err instanceof Error ? err.message : 'Impossible de traiter la demande.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // Étape 2 : Validation du code OTP pour récupération par SMS
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
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
                body: JSON.stringify({ phone: normalizedPhone, otpCode }),
            });

            const verifyData = await res.json();
            if (!res.ok) {
                throw new Error(verifyData.error || 'Code de vérification incorrect.');
            }

            if (verifyData.token_hash) {
                const supabase = getBrowserClient();
                await supabase.auth.verifyOtp({
                    token_hash: verifyData.token_hash,
                    type: 'magiclink',
                });
            }

            router.push('/reset-password');
        } catch (err: unknown) {
            console.error('[ForgotPassword] Erreur validation code:', err);
            const msg = err instanceof Error ? err.message : 'Échec de la validation.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md space-y-6">
                {/* Header & Logo */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <Logo variant="full" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Mot de passe oublié
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        {step === 1
                            ? 'Recevez un code de récupération par SMS ou un lien par email.'
                            : 'Saisissez le code SMS reçu pour réinitialiser votre mot de passe.'}
                    </p>
                </div>

                {/* Carte Formulaire */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-6">
                    {/* Messages */}
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

                    {step === 1 && (
                        <form onSubmit={handleRequestReset} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Email ou Téléphone (Sénégal)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="ex: 77 123 45 67 ou compte@email.com"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                    />
                                    {identifier.includes('@') ? (
                                        <Mail size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    ) : (
                                        <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                leftIcon={<KeyRound size={18} />}
                            >
                                Envoyer les instructions
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
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
                                Valider et réinitialiser
                            </Button>

                            <div className="flex items-center justify-between text-xs pt-1">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium"
                                >
                                    Modifier l&apos;identifiant
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRequestReset}
                                    disabled={countdown > 0 || isLoading}
                                    className="text-[#FF5722] font-bold disabled:opacity-50 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} />
                                    <span>{countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer'}</span>
                                </button>
                            </div>
                        </form>
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
