'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { KeyRound, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OtpInput } from '@/components/auth/OtpInput';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';

/**
 * Finition 3d — « mot de passe et code administrateur » d'une action sensible (changer un rôle, changer le numéro d'un
 * admin, créer des codes de secours). `run(action)` lance l'action ; si le serveur répond PASSWORD_CONFIRMATION_REQUIRED
 * ou ADMIN_CODE_CONFIRMATION_REQUIRED (lib/admin/identity-check.ts), la fenêtre demande ce qui manque (mot de passe par
 * POST /api/admin/step-up, code reçu par SMS par POST /api/admin/step-up/sms), puis relance l'action une fois. Annulé :
 * `run` rend null et rien n'est fait. Le serveur décide toujours ; la fenêtre ne fait qu'aider.
 */

type Step = 'PASSWORD' | 'CODE';
const STEP_OF: Readonly<Record<string, Step>> = {
    PASSWORD_CONFIRMATION_REQUIRED: 'PASSWORD',
    ADMIN_CODE_CONFIRMATION_REQUIRED: 'CODE',
};

interface Pending {
    action: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (err: unknown) => void;
}

export function useIdentityConfirm(): { run: <T>(action: () => Promise<T>) => Promise<T | null>; dialog: React.ReactNode } {
    const [step, setStep] = useState<Step | null>(null);
    const pending = useRef<Pending | null>(null);

    const run = useCallback(<T,>(action: () => Promise<T>): Promise<T | null> => {
        return action().catch((err: unknown) => {
            const need = err instanceof ApiError ? STEP_OF[String(err.code)] : undefined;
            if (!need) throw err;
            return new Promise<T | null>((resolve, reject) => {
                pending.current = { action, resolve: resolve as (v: unknown) => void, reject };
                setStep(need);
            });
        });
    }, []);

    const finish = useCallback((outcome: { value?: unknown; error?: unknown; cancelled?: boolean }) => {
        const p = pending.current;
        pending.current = null;
        setStep(null);
        if (!p) return;
        if (outcome.cancelled) p.resolve(null);
        else if (outcome.error !== undefined) p.reject(outcome.error);
        else p.resolve(outcome.value);
    }, []);

    /** Relance l'action après une preuve ; une autre preuve encore demandée change d'étape, sans fermer. */
    const retry = useCallback(async (): Promise<string | null> => {
        const p = pending.current;
        if (!p) return null;
        try {
            const value = await p.action();
            finish({ value });
            return null;
        } catch (err) {
            const need = err instanceof ApiError ? STEP_OF[String(err.code)] : undefined;
            if (need) {
                setStep(need);
                return need;
            }
            finish({ error: err });
            return null;
        }
    }, [finish]);

    const dialog = step ? <IdentityDialog step={step} onRetry={retry} onCancel={() => finish({ cancelled: true })} /> : null;
    return { run, dialog };
}

function IdentityDialog({ step, onRetry, onCancel }: { step: Step; onRetry: () => Promise<string | null>; onCancel: () => void }) {
    const errorId = useId();
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const failure = (err: unknown, fallback: string) => {
        const wait = err instanceof ApiError && err.status === 429 ? retryAfterOf(err.body) : null;
        setError(wait ? `${errorMessage(err, fallback)} ${formatRetryDelay(wait)}` : errorMessage(err, fallback));
    };

    const submitPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || busy) return;
        setBusy(true); setError(null);
        try {
            await sendJson('/api/admin/step-up', 'POST', { password });
            setPassword('');
            await onRetry();
        } catch (err) {
            failure(err, 'Mot de passe non vérifié. Réessayez.');
        } finally { setBusy(false); }
    };

    const sendCode = async () => {
        setBusy(true); setError(null);
        try {
            await sendJson('/api/admin/step-up/sms', 'POST', {});
            setCodeSent(true);
        } catch (err) {
            failure(err, 'Le code n’a pas pu être envoyé. Réessayez.');
        } finally { setBusy(false); }
    };

    const submitCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6 || busy) return;
        setBusy(true); setError(null);
        try {
            await sendJson('/api/admin/step-up/sms', 'POST', { code });
            setCode('');
            await onRetry();
        } catch (err) {
            failure(err, 'Code refusé. Réessayez.');
        } finally { setBusy(false); }
    };

    const isPassword = step === 'PASSWORD';
    return (
        <Modal
            isOpen
            onClose={() => { if (!busy) onCancel(); }}
            title={isPassword ? 'Confirmez votre mot de passe' : 'Code administrateur'}
            subtitle={isPassword
                ? 'Cette action est sensible : saisissez votre mot de passe pour continuer.'
                : 'Cette action est sensible : confirmez-la avec le code administrateur reçu par SMS.'}
            icon={isPassword ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
            maxWidth="md"
            busy={busy}
        >
            <div className="space-y-4">
                {error && <StatusBanner tone="danger" announce="alert" title="Vérification impossible"><span id={errorId}>{error}</span></StatusBanner>}
                {isPassword ? (
                    <form className="space-y-4" onSubmit={(e) => void submitPassword(e)}>
                        <TextInput label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy} leftIcon={<KeyRound size={18} />}>Continuer</Button>
                    </form>
                ) : !codeSent ? (
                    <Button type="button" variant="primary" size="lg" fullWidth isLoading={busy} onClick={() => void sendCode()} leftIcon={<MessageSquareText size={18} />}>
                        Recevoir le code par SMS
                    </Button>
                ) : (
                    <form className="space-y-4" onSubmit={(e) => void submitCode(e)}>
                        <p className="text-sm text-fg">Saisissez les 6 chiffres reçus par SMS. Le code est valable 10 minutes.</p>
                        <OtpInput value={code} onChange={setCode} disabled={busy} hasError={!!error} describedBy={error ? errorId : undefined} />
                        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy} disabled={code.length !== 6} leftIcon={<ShieldCheck size={18} />}>
                            Valider le code
                        </Button>
                        <Button type="button" variant="ghost" size="sm" fullWidth onClick={() => void sendCode()} disabled={busy}>Recevoir un nouveau code</Button>
                    </form>
                )}
                <Button type="button" variant="secondary" size="sm" fullWidth disabled={busy} onClick={onCancel}>Annuler</Button>
            </div>
        </Modal>
    );
}
