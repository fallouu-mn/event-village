'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/auth/OtpInput';
import { createBrowserClient } from '@supabase/ssr';

function ControllerSetupForm() {
    const router       = useRouter();
    const searchParams = useSearchParams();

    const [phone, setPhone]               = useState(searchParams.get('phone') ?? '');
    const [otp, setOtp]                   = useState('');
    const [password, setPassword]         = useState('');
    const [confirmPwd, setConfirmPwd]     = useState('');
    const [showPwd, setShowPwd]           = useState(false);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');
    const [success, setSuccess]           = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPwd) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        if (password.length < 8) {
            setError('Le mot de passe doit comporter au moins 8 caractères.');
            return;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            setError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
            return;
        }

        setLoading(true);
        try {
            const res  = await fetch('/api/controller/setup', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    phone:        phone.replace(/\s/g, ''),
                    otp_code:     otp.trim(),
                    new_password: password,
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'activation.');

            setSuccess(true);

            // Connexion automatique avec l'email synthétique + mot de passe
            // L'email synthétique = format utilisé par resolve-phone et le trigger
            // signInWithPassword({ phone }) = OTP natif Supabase, pas compatible
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const rawPhone = phone.replace(/\s/g, '');
            const normalizedPhone = rawPhone.startsWith('+221') ? rawPhone
                : rawPhone.startsWith('221') ? `+${rawPhone}` : `+221${rawPhone}`;
            const loginEmail = `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

            const { error: loginErr } = await supabase.auth.signInWithPassword({
                email:    loginEmail,
                password,
            });

            if (!loginErr) {
                router.push('/controller/scanner');
            } else {
                // Fallback : login manuel avec message d'activation
                router.push('/login?message=account_activated');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erreur inattendue.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
                <div className="text-center space-y-3">
                    <ShieldCheck size={48} className="text-emerald-500 mx-auto" />
                    <h1 className="text-base font-black text-slate-900 dark:text-white">Compte activé !</h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Redirection en cours…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm space-y-6">
                {/* En-tête */}
                <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center mx-auto">
                        <KeyRound size={22} className="text-[#FF5722]" />
                    </div>
                    <h1 className="text-base font-black text-slate-900 dark:text-white">Activer votre compte</h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Entrez le code reçu par SMS et définissez votre mot de passe.
                    </p>
                </div>

                {/* Formulaire */}
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30">
                            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* Téléphone */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                                Numéro de téléphone
                            </label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="77 123 45 67"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    required
                                    className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold focus:outline-none focus:border-[#FF5722]"
                                />
                            </div>
                        </div>

                        {/* Code OTP */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-2">
                                Code d&apos;activation (SMS)
                            </label>
                            <OtpInput
                                value={otp}
                                onChange={setOtp}
                                disabled={loading}
                                hasError={!!error && error.toLowerCase().includes('otp')}
                            />
                        </div>

                        {/* Nouveau mot de passe */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                                Nouveau mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    placeholder="Majuscule, minuscule, chiffre, 8+ car."
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs focus:outline-none focus:border-[#FF5722]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                >
                                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirmation */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                                Confirmer le mot de passe
                            </label>
                            <input
                                type={showPwd ? 'text' : 'password'}
                                placeholder="Répétez votre mot de passe"
                                value={confirmPwd}
                                onChange={e => setConfirmPwd(e.target.value)}
                                required
                                className={`w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-xs focus:outline-none ${
                                    confirmPwd && password !== confirmPwd
                                        ? 'border-red-400 focus:border-red-500'
                                        : 'border-slate-200 dark:border-zinc-700 focus:border-[#FF5722]'
                                }`}
                            />
                            {confirmPwd && password !== confirmPwd && (
                                <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                            )}
                        </div>

                        <Button
                            variant="primary"
                            fullWidth
                            size="lg"
                            isLoading={loading}
                            disabled={!phone || otp.length < 6 || !password || password !== confirmPwd}
                        >
                            Activer mon compte
                        </Button>
                    </form>
                </div>

                <p className="text-center text-[11px] text-slate-400 dark:text-zinc-500">
                    Déjà un compte ?{' '}
                    <a href="/login" className="font-bold text-[#FF5722] hover:underline">Se connecter</a>
                </p>
            </div>
        </div>
    );
}

export default function ControllerSetupPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-sm text-slate-400">Chargement…</p></div>}>
            <ControllerSetupForm />
        </Suspense>
    );
}
