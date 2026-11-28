'use client';

/**
 * Lot 12d — fiche d'une commande côté partenaire : suivi de la livraison faite par l'établissement lui-même.
 *  - OrderAlerts : absence du client (attente de 30 minutes, puis décision de l'équipe Event Village, puis décision prise)
 *    et dernier signalement du client (motif en mots, état) ; tout est servi par la base.
 *  - DeliveryCallActions : « Appeler le client » (appel compté par PATCH { action: APPEL }, puis le téléphone compose
 *    le numéro) et « Client absent » après deux appels (PATCH { action: ABSENT }, confirmation). Refus du serveur
 *    affichés tels quels.
 */
import { useState } from 'react';
import { MessageSquareWarning, Phone, PhoneOff, UserX } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { instantHm } from '@/lib/tables/views';
import { issueReasonLabel } from '../../order-extras';
import type { PartnerOrder } from './order-types';

export function OrderAlerts({ order }: { order: PartnerOrder }) {
    const a = order.absence;
    const issue = order.issue;
    if (!a && !issue) return null;
    return (
        <div className="space-y-3">
            {a && a.phase === 'ATTENTE' && (
                <StatusBanner tone="warning" icon={<UserX size={20} />} title="Client absent">
                    {`Le client ne répond pas. La commande attend jusqu’à ${instantHm(a.wait_until ?? null)} un nouvel essai : il peut encore la recevoir avec son code. Ensuite, l’équipe Event Village décide de la suite.`}
                </StatusBanner>
            )}
            {a && a.phase === 'EQUIPE' && (
                <StatusBanner tone="warning" icon={<UserX size={20} />} title="Client toujours absent : l’équipe décide">
                    Gardez la commande à l’établissement. L’équipe Event Village décide de rembourser ou non le client et vous prévient. Si le client revient avant, remettez-la avec son code.
                </StatusBanner>
            )}
            {a && a.phase === 'DECIDEE' && (
                <StatusBanner tone="info" icon={<UserX size={20} />} title="Absence du client : décision prise">
                    {a.decision === 'RIEN' ? 'L’équipe Event Village a décidé de ne pas rembourser le client.' : 'L’équipe Event Village a décidé de rembourser le client.'}
                </StatusBanner>
            )}
            {issue && (
                <StatusBanner tone={issue.status === 'OUVERT' ? 'warning' : 'info'} icon={<MessageSquareWarning size={20} />}
                    title={issue.status === 'OUVERT' ? `Le client signale : ${issueReasonLabel(issue.reason).toLowerCase()}` : 'Signalement du client traité'}>
                    {issue.status === 'OUVERT'
                        ? 'L’équipe Event Village s’en occupe et peut vous contacter.'
                        : `Motif : ${issueReasonLabel(issue.reason).toLowerCase()}. L’équipe Event Village a répondu au client.`}
                </StatusBanner>
            )}
        </div>
    );
}

export function DeliveryCallActions({ order, onChanged }: { order: PartnerOrder; onChanged: () => Promise<void> }) {
    const [busy, setBusy] = useState<'APPEL' | 'ABSENT' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [askAbsent, setAskAbsent] = useState(false);
    const phone = order.contact?.phone ?? null;
    if (order.mode !== 'LIVRAISON' || order.state !== 'EN_ROUTE') return null;
    const calls = Number(order.calls ?? 0);

    const call = async () => {
        setError(null);
        setBusy('APPEL');
        try {
            await sendJson(`/api/partner/orders/${order.id}`, 'PATCH', { action: 'APPEL' });
            await onChanged();
        } catch (err) {
            setError(errorMessage(err, 'Appel non compté. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    const absent = async () => {
        setBusy('ABSENT');
        setError(null);
        try {
            await sendJson(`/api/partner/orders/${order.id}`, 'PATCH', { action: 'ABSENT' });
            setAskAbsent(false);
            await onChanged();
        } catch (err) {
            setError(errorMessage(err, 'Action impossible pour le moment.'));
            setAskAbsent(false);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground-strong">
                <Phone size={18} className="text-primary-text" aria-hidden="true" />
                Joindre le client
            </h3>
            {phone ? (
                <a
                    href={`tel:${phone}`}
                    onClick={() => void call()}
                    className={buttonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}
                    aria-label={`Appeler le client au ${phone}`}
                >
                    <Phone size={20} aria-hidden="true" />
                    Appeler le client
                </a>
            ) : (
                <p className="text-sm text-muted-foreground">Numéro du client indisponible.</p>
            )}
            <p className="text-sm text-muted-foreground" role="status">
                {calls === 0 ? 'Aucun appel pour l’instant.' : `${calls} appel${calls > 1 ? 's' : ''} sans réponse compté${calls > 1 ? 's' : ''}.`}
                {!order.absence && calls < 2 ? ' Après deux appels, vous pourrez dire le client absent.' : ''}
            </p>
            {order.can_report_absent && (
                <Button variant="outline" size="lg" fullWidth leftIcon={<PhoneOff size={20} />} isLoading={busy === 'ABSENT'} disabled={busy !== null}
                    onClick={() => { setError(null); setAskAbsent(true); }}>
                    Client absent
                </Button>
            )}
            {error && <p role="alert" className="break-words text-sm font-medium text-danger-text">{error}</p>}
            <ConfirmDialog
                isOpen={askAbsent}
                onClose={() => { if (busy === null) setAskAbsent(false); }}
                onConfirm={() => void absent()}
                title="Le client est absent ?"
                isLoading={busy === 'ABSENT'}
                confirmLabel="Oui, client absent"
                cancelLabel="Retour"
                variant="warning"
            >
                <p className="text-sm leading-relaxed text-foreground">
                    Le client est prévenu (SMS compris). La commande attend 30 minutes un nouvel essai, puis l’équipe Event Village décide de la suite. Rien n’est remboursé automatiquement.
                </p>
            </ConfirmDialog>
        </div>
    );
}
