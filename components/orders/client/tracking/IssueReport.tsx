'use client';

/**
 * Lot 12d (point 3) — « Signaler un problème » sur une commande, pour son client, après le début de la préparation
 * (`can_report` servi par la base). Motif en puces (Retard, Commande incomplète, Erreur, Autre) et texte court
 * (300 caractères au plus, obligatoire pour « Autre ») ; POST /api/orders/[id]/issue ; refus du serveur affiché tel quel.
 * Ensuite : « Signalement envoyé » (l'équipe Event Village s'en occupe), puis « Signalement traité » avec sa réponse.
 * Aucun remboursement automatique : l'écran ne promet rien d'autre.
 */
import { useState } from 'react';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';
import { ISSUE_REASONS, issueReasonLabel, type IssueReason } from '../../order-extras';
import type { OrderView } from './order-view';

const DETAILS_MAX = 300;

export function IssueReport({ order, onSent }: { order: OrderView; onSent: () => void }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<IssueReason | null>(null);
    const [details, setDetails] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const issue = order.issue;

    if (!order.canReport && !issue) return null;

    const send = async () => {
        if (busy || !reason) return;
        const text = details.trim();
        if (reason === 'AUTRE' && text.length < 5) {
            setError('Dites en quelques mots ce qui ne va pas.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/issue`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, details: text || null }),
            });
            const body = await readJsonBody(res, 'commande/signalement');
            if (!res.ok) {
                setError(serverErrorMessage(body) ?? 'Signalement impossible pour le moment. Réessayez.');
                return;
            }
            setOpen(false);
            setReason(null);
            setDetails('');
            onSent();
        } catch (err) {
            console.error('[commande] signalement injoignable :', err instanceof Error ? err.message : String(err));
            setError('Connexion impossible : réessayez dans un instant.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section aria-labelledby="probleme-titre" className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 id="probleme-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <MessageSquareWarning size={20} className="text-primary-text" aria-hidden="true" />
                Un problème avec la commande ?
            </h2>
            {issue && issue.status === 'OUVERT' && (
                <div role="status" className="flex items-start gap-3 rounded-2xl border border-info-border bg-info-soft p-4 text-info-text ev-fade-in">
                    <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="font-semibold">Signalement envoyé</p>
                        <p className="text-sm">{`${issueReasonLabel(issue.reason)} : l’équipe Event Village s’en occupe et vous répond ici.`}</p>
                    </div>
                </div>
            )}
            {issue && issue.status !== 'OUVERT' && (
                <div className="rounded-2xl border border-success-border bg-success-soft p-4 text-success-text">
                    <p className="font-semibold">Signalement traité</p>
                    {issue.closeNote && <p className="mt-1 break-words text-sm text-foreground">{`Réponse de l’équipe Event Village : ${issue.closeNote}`}</p>}
                </div>
            )}
            {order.canReport && (
                <>
                    <p className="text-sm text-muted-foreground">Retard, article manquant, erreur : prévenez l’équipe Event Village, elle contacte l’établissement.</p>
                    <Button variant="secondary" fullWidth onClick={() => { setError(null); setOpen(true); }}>
                        Signaler un problème
                    </Button>
                </>
            )}

            <ConfirmDialog
                isOpen={open}
                onClose={() => { if (!busy) setOpen(false); }}
                onConfirm={() => void send()}
                title="Signaler un problème"
                confirmLabel="Envoyer le signalement"
                cancelLabel="Retour"
                variant="default"
                isLoading={busy}
                confirmDisabled={reason === null}
            >
                <fieldset className="min-w-0">
                    <legend className="mb-2 text-sm font-semibold text-foreground-strong">Qu’est-ce qui ne va pas ?</legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motif du signalement">
                        {ISSUE_REASONS.map((r) => {
                            const on = reason === r.value;
                            return (
                                <button key={r.value} type="button" role="radio" aria-checked={on} onClick={() => { setReason(r.value); setError(null); }}
                                    className={cn(
                                        'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-fast',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                                        on ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                                    )}>
                                    {r.label}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
                <div className="mt-4">
                    <Textarea
                        id="signalement-details"
                        label={reason === 'AUTRE' ? 'Dites-nous en quelques mots' : 'Précisez (facultatif)'}
                        rows={3}
                        maxLength={DETAILS_MAX}
                        showCount
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        error={error ?? undefined}
                    />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Rien n’est remboursé automatiquement : l’équipe regarde votre commande et vous répond.</p>
            </ConfirmDialog>
        </section>
    );
}

/** Lot 12d (point 2) — bandeau du client quand le livreur ne le joint pas, puis quand l'équipe décide. */
export function AbsenceNotice({ order, hourOf }: { order: OrderView; hourOf: (iso: string | null) => string }) {
    const a = order.absence;
    if (!a || order.state !== 'EN_ROUTE') return null;
    if (a.phase === 'ATTENTE') {
        return (
            <div role="alert" className="rounded-2xl border border-warning-border bg-warning-soft p-4 text-warning-text ev-fade-in">
                <p className="font-bold">Le livreur n’arrive pas à vous joindre</p>
                <p className="mt-1 text-sm text-foreground">{`Il attend jusqu’à ${hourOf(a.waitUntil)}. Rappelez le numéro qui vous a appelé et donnez-lui votre code.`}</p>
            </div>
        );
    }
    return (
        <div role="status" className="rounded-2xl border border-warning-border bg-warning-soft p-4 text-warning-text">
            <p className="font-bold">L’équipe Event Village décide de la suite</p>
            <p className="mt-1 text-sm text-foreground">Vous n’avez pas pu être joint à temps. Vous serez prévenu de la décision ; si vous joignez le livreur avant, il peut encore vous remettre la commande avec votre code.</p>
        </div>
    );
}
