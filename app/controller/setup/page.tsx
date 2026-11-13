'use client';

import React, { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { getBrowserClient } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/validations/auth';

/**
 * Activation d'un compte contrôleur (lien de l'invitation : /controller/setup?phone=…). Lot 7 (7.0 f) :
 *  - la page reçoit `searchParams` en prop : plus de useSearchParams sous Suspense, le formulaire est dans le
 *    premier rendu (motif retiré de la connexion au lot 6, course de e2e/auth.setup.ts). Aucun nouveau fichier
 *    .tsx n'est permis par le contrat (section 12) : la page reste un composant client, sans repli ;
 *  - D67 : la règle affichée est celle du serveur (app/api/controller/setup/route.ts ; lot 9 quater : règle commune, 8
 *    caractères, une majuscule, un chiffre, un caractère spécial) ;
 *  - un compte déjà activé mène à /login?message=already_configured (message affiché par LoginForm) ;
 *  - lot 9 bis (R58, B36, contrat 5.14) : connexion automatique par POST /api/auth/login (numéro et mot de passe, même
 *    chemin que la connexion ; la correspondance numéro → compte reste côté serveur), puis la session posée en cookies
 *    est relue par le navigateur ; en cas d'échec, /login?message=account_activated ;
 *  - lot 9 bis (R102, B43) : un compte suspendu n'est pas activé (403 ACCOUNT_NOT_ACTIVE, message de la route affiché).
 */

interface ControllerSetupPageProps {
    searchParams?: Record<string, string | string[] | undefined>;
}

// Lot 9 quater (A5 : G-31) : règle commune du mot de passe (StrongPasswordSchema, lib/validations/auth.ts), la même que
// celle du serveur de l'activation
const PASSWORD_RULES: Array<{ key: string; label: string; test: (p: string) => boolean }> = [
    { key: 'length', label: 'Au moins 8 caractères', test: (p) => p.length >= 8 },
    { key: 'upper', label: 'Une majuscule (A-Z)', test: (p) => /[A-Z]/.test(p) },
    { key: 'digit', label: 'Un chiffre (0-9)', test: (p) => /[0-9]/.test(p) },
    { key: 'special', label: 'Un caractère spécial (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
    try {
        const body: unknown = await res.json();
        return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    } catch (err) {
        console.error(`[activation contrôleur] ${what} : réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        return {};
    }
}

/** Connexion après activation ; false si elle échoue (la personne se connecte alors elle-même). */
async function signInAfterActivation(phone: string, password: string): Promise<boolean> {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: phone, password }),
        });
        const reply = await readJson(res, 'connexion automatique');
        if (!res.ok || reply.ok !== true) {
            console.warn('[activation contrôleur] connexion automatique refusée, code', typeof reply.code === 'string' ? reply.code : res.status);
            return false;
        }
        // Session posée en cookies par le serveur : le navigateur la relit (et prévient AuthProvider).
        const { data, error } = await getBrowserClient().auth.refreshSession();
        if (error || !data.user) {
            console.warn('[activation contrôleur] session posée par le serveur illisible :', error?.message ?? 'aucune session');
            return false;
        }
        return true;
    } catch (err) {
        console.error('[activation contrôleur] connexion automatique injoignable :', err instanceof Error ? err.message : String(err));
        return false;
    }
}

export default function ControllerSetupPage({ searchParams }: ControllerSetupPageProps) {
    const router = useRouter();
    const uid = useId();
    const otpLabelId = `${uid}-code`;

    const [phone, setPhone] = useState(() => firstParam(searchParams?.phone));
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activated, setActivated] = useState(false);

    const rules = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) }));
    const passwordValid = rules.every((r) => r.passed);
    const mismatch = confirmPwd.length > 0 && password !== confirmPwd;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const normalizedPhone = normalizePhoneNumber(phone.trim());
        if (!normalizedPhone) {
            setError('Indiquez le numéro qui a reçu l’invitation.');
            return;
        }
        if (otp.length !== 6) {
            setError('Saisissez les 6 chiffres du code reçu par SMS.');
            return;
        }
        if (!passwordValid) {
            setError('Le mot de passe doit comporter au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.');
            return;
        }
        if (password !== confirmPwd) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/controller/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, otp_code: otp.trim(), new_password: password }),
            });
            const data = await readJson(res, 'activation');
            if (!res.ok) {
                if (data.code === 'ACCOUNT_ALREADY_CONFIGURED') {
                    router.push('/login?message=already_configured');
                    return;
                }
                // Les messages de la route sont rédigés en français par le serveur (jamais une erreur de la base).
                setError(typeof data.error === 'string' && data.error ? data.error : `Activation impossible (erreur ${res.status}). Réessayez.`);
                return;
            }

            setActivated(true);
            const signedIn = await signInAfterActivation(normalizedPhone, password);
            router.push(signedIn ? '/controller/scanner' : '/login?message=account_activated');
        } catch (err) {
            console.error('[activation contrôleur] activation injoignable :', err instanceof Error ? err.message : String(err));
            setError('Connexion impossible : vérifiez votre réseau, puis réessayez. Si le problème continue, demandez une nouvelle invitation.');
        } finally {
            setLoading(false);
        }
    };

    if (activated) {
        return (
            <div className="flex justify-center py-8">
                <div className="w-full max-w-md space-y-4 text-center" role="status">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg text-success-fg" aria-hidden="true">
                        <ShieldCheck size={28} />
                    </span>
                    <h1 className="text-2xl font-bold text-fg">Compte activé</h1>
                    <p className="text-base text-fg-muted">Connexion en cours, vous allez arriver sur le scanner.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-md space-y-5">
                <PageHeader
                    eyebrow={(
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
                            <KeyRound size={22} />
                        </span>
                    )}
                    title="Activer votre compte contrôleur"
                    description="Saisissez le code reçu par SMS avec l’invitation, puis choisissez votre mot de passe."
                    className="pb-0 sm:pb-0"
                />

                <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
                    {error && (
                        <StatusBanner tone="danger" announce="alert" title="Activation impossible">
                            {error}
                        </StatusBanner>
                    )}

                    <TextInput
                        label="Numéro de téléphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="77 123 45 67"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="tabular-nums"
                    />

                    <div className="space-y-1.5">
                        <p id={otpLabelId} className="text-sm font-semibold text-fg">Code d’activation reçu par SMS</p>
                        <div role="group" aria-labelledby={otpLabelId}>
                            <OtpInput value={otp} onChange={setOtp} disabled={loading} hasError={Boolean(error) && otp.length === 6} />
                        </div>
                        <p className="text-sm text-fg-muted">Le code est valable 24 heures. Sans code, demandez une nouvelle invitation à votre organisateur.</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <TextInput
                                label="Mot de passe"
                                type={showPwd ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                hint="8 caractères au moins, avec une majuscule, un chiffre et un caractère spécial."
                                fieldClassName="min-w-0 flex-1"
                            />
                            <IconButton
                                aria-label={showPwd ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                                aria-pressed={showPwd}
                                variant="ghost"
                                onClick={() => setShowPwd((v) => !v)}
                                className="mt-7"
                            >
                                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                            </IconButton>
                        </div>
                        <ul className="space-y-1.5 rounded-2xl border border-border bg-surface-sunken p-3" aria-label="Règles du mot de passe">
                            {rules.map((r) => (
                                <li key={r.key} className="flex items-center gap-2 text-sm">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                                            r.passed ? 'border-success bg-success text-on-tone' : 'border-border bg-surface text-fg-muted',
                                        )}
                                    >
                                        {r.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                                    </span>
                                    <span className={r.passed ? 'font-medium text-success-fg' : 'text-fg-muted'}>
                                        {r.label}
                                        <span className="sr-only">{r.passed ? ' : respecté' : ' : manquant'}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <TextInput
                        label="Confirmer le mot de passe"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        error={mismatch ? 'Les mots de passe ne correspondent pas.' : undefined}
                    />

                    <Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
                        Activer mon compte
                    </Button>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-fg-muted">
                    <span>Compte déjà activé ?</span>
                    <LinkButton href="/login" variant="ghost" size="sm">Se connecter</LinkButton>
                </div>
            </div>
        </div>
    );
}
