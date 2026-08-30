'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Lock,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { getBrowserClient } from '@/lib/supabase/client';
import { ResetPasswordSchema } from '@/lib/validations/auth';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const parseResult = ResetPasswordSchema.safeParse({
            password,
            confirmPassword,
        });

        if (!parseResult.success) {
            setErrorMessage(parseResult.error.errors[0]?.message || 'Les mots de passe ne correspondent pas.');
            return;
        }

        setIsLoading(true);
        const supabase = getBrowserClient();

        try {
            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) throw error;

            setIsSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 2500);
        } catch (err: unknown) {
            console.error('[ResetPassword] Erreur mise à jour:', err);
            const msg = err instanceof Error ? err.message : 'Impossible de réinitialiser le mot de passe.';
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
                        Nouveau mot de passe
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        Choisissez un nouveau mot de passe sécurisé pour votre compte.
                    </p>
                </div>

                {/* Carte Formulaire */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-6">
                    {errorMessage && (
                        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {!isSuccess ? (
                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Nouveau mot de passe
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 6 caractères"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
                                    />
                                    <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Confirmer le mot de passe
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5722] transition-all"
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
                                leftIcon={<ShieldCheck size={18} />}
                            >
                                Enregistrer le mot de passe
                            </Button>
                        </form>
                    ) : (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-500 shadow-md">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">
                                Mot de passe modifié avec succès !
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                Redirection vers la page de connexion en cours...
                            </p>
                            <Link href="/login">
                                <Button variant="secondary" size="md" fullWidth rightIcon={<ArrowRight size={16} />}>
                                    Se connecter maintenant
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
