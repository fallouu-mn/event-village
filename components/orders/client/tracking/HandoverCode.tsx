'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useAuth } from '@/components/providers/AuthProvider';
import { isRecord, nonEmptyString, readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';

/**
 * Lot 12b (décision 1 du client, 21/11) — code de remise affiché dans la commande, en 4 grandes cases lisibles par le
 * livreur ou le comptoir. Lu par GET /api/orders/<id>/code (client connecté de la commande seulement, réponse jamais
 * mise en cache) et gardé UNIQUEMENT dans l'état de ce composant : jamais dans le stockage du navigateur, l'adresse de la
 * page ni la console. Effacé dès que la commande n'attend plus de remise (`active` faux), au démontage, et quand le
 * compte se déconnecte (useAuth). « Recevoir un nouveau code » : POST /api/orders/<id>/code (SMS), puis relecture.
 */
export function HandoverCode({ orderId, active, resendsLeft, version, onResent }: {
    orderId: string;
    /** La commande attend sa remise et un code a été émis. */
    active: boolean;
    resendsLeft: number;
    /** Change à chaque nouveau code (nombre de nouveaux codes restants servi par la commande) : le code est relu. */
    version: string;
    onResent: () => void;
}) {
    const { isAuthenticated } = useAuth();
    const [code, setCode] = useState<string | null>(null);
    const [locked, setLocked] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const visible = active && isAuthenticated;

    const load = useCallback(async (signal: AbortSignal) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/code`, { cache: 'no-store', signal });
            const body = await readJsonBody(res, 'commande/code');
            if (signal.aborted) return;
            if (!res.ok || !isRecord(body)) {
                setCode(null);
                setProblem(serverErrorMessage(body) ?? 'Le code n’a pas pu être affiché. Réessayez dans un instant.');
                return;
            }
            const value = nonEmptyString(body.code);
            setCode(value && /^[0-9]{4}$/.test(value) ? value : null);
            setLocked(body.locked === true);
            setProblem(value ? null : 'Le code n’a pas pu être affiché. Réessayez dans un instant.');
        } catch (err) {
            if (signal.aborted) return;
            // Jamais le code dans la console : seulement la nature de l'erreur
            console.error('[commande] code de remise injoignable :', err instanceof Error ? err.name : 'erreur');
            setProblem('Connexion impossible : le code s’affichera dès le retour du réseau.');
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        if (!visible) {
            setCode(null);
            setProblem(null);
            setLocked(false);
            return;
        }
        const ctrl = new AbortController();
        void load(ctrl.signal);
        return () => {
            ctrl.abort();
            setCode(null);
        };
    }, [visible, version, load]);

    const resend = async () => {
        if (sending) return;
        setSending(true);
        setNotice(null);
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/code`, { method: 'POST' });
            const body = await readJsonBody(res, 'commande/nouveau-code');
            if (!res.ok) {
                setProblem(serverErrorMessage(body) ?? 'Nouveau code impossible pour le moment.');
                return;
            }
            setNotice(isRecord(body) ? nonEmptyString(body.message) : null);
            onResent();
        } catch (err) {
            console.error('[commande] nouveau code injoignable :', err instanceof Error ? err.message : String(err));
            setProblem('Connexion impossible : réessayez dans un instant.');
        } finally {
            setSending(false);
        }
    };

    if (!visible) return null;

    return (
        <section aria-labelledby="code-remise-titre" className="rounded-3xl border-2 border-primary bg-card p-5 shadow-sm sm:p-6" data-testid="code-remise">
            <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-primary-text" aria-hidden="true" />
                <h2 id="code-remise-titre" className="text-lg font-bold text-foreground-strong">Votre code de remise</h2>
            </div>
            <p className="mt-1 text-base text-foreground">Montrez ce code à la remise.</p>

            <div className="mt-4 flex justify-center gap-2.5 sm:gap-3" aria-live="polite">
                {code ? (
                    <>
                        <span className="sr-only">{`Code : ${code.split('').join(' ')}`}</span>
                        {code.split('').map((digit, i) => (
                            <span
                                key={i}
                                aria-hidden="true"
                                data-testid="case-code"
                                className="flex h-20 w-16 items-center justify-center rounded-2xl border-2 border-border bg-background text-5xl font-extrabold tabular-nums text-foreground-strong sm:h-24 sm:w-20 sm:text-6xl"
                            >
                                {digit}
                            </span>
                        ))}
                    </>
                ) : loading ? (
                    <span className="flex min-h-20 items-center gap-2 text-base text-muted-foreground" role="status">
                        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                        Affichage du code…
                    </span>
                ) : null}
            </div>

            {locked && (
                <StatusBanner tone="warning" title="Trop d’essais" className="mt-4">
                    <p>Ce code a été mal saisi trop de fois : demandez un nouveau code, il s’affichera ici.</p>
                </StatusBanner>
            )}
            {problem && !code && <p className="mt-4 text-center text-sm font-medium text-danger-text" role="alert">{problem}</p>}
            {notice && <p className="mt-4 text-center text-sm text-success-text" role="status">{notice}</p>}

            <div className="mt-4 flex flex-col items-center gap-1">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void resend()}
                    disabled={sending || resendsLeft <= 0}
                    leftIcon={sending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                >
                    Recevoir un nouveau code
                </Button>
                <p className="text-sm text-muted-foreground">
                    {resendsLeft > 0
                        ? `Le code arrive aussi par SMS. ${resendsLeft > 1 ? `${resendsLeft} nouveaux codes possibles.` : 'Un nouveau code possible.'}`
                        : 'Le code arrive aussi par SMS. Plus de nouveau code possible : contactez l’établissement.'}
                </p>
            </div>
        </section>
    );
}
