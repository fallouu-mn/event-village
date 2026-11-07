'use client';

import React, { useId, useRef, useState } from 'react';
import { Search, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextInput } from '@/components/ui/Field';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner, type StatusBannerTone } from '@/components/ui/StatusBanner';
import { apiErrorOf, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import { formatFcfa } from '@/lib/format';
import { ticketStatusLabel } from '@/lib/tickets/ticket-status';
import { PilotageSection } from './PilotageBlocks';

/**
 * Lot 8, anomalie A4 (contrat 3.11, 13.4) — remboursement d'un billet depuis l'onglet Ventes. Le partenaire
 * cherche le billet par son numéro (GET …/tickets/lookup), lit la fiche, donne un motif (ReasonDialog), puis
 * confirme le montant et le mode (ConfirmDialog) : le POST …/tickets/[ticketId]/refund ne part que de cette
 * seconde étape. La fiche sert à décider, le serveur recontrôle sous verrou et son montant fait foi au résultat.
 * Un billet gratuit encore valable se traite ici aussi : rien n'est versé et le billet est annulé (mode AUCUN).
 */

type RefundMode = 'CASHOUT' | 'ORGANISATEUR' | 'AUCUN';

interface TicketSheet {
    id: string;
    ticket_number: string;
    category: string | null;
    price: number;
    service_fee: number;
    status: string;
    sale_channel: string | null;
    holder_short: string | null;
    refundable: boolean;
    refund_mode: RefundMode;
}

interface RefundReply {
    mode: RefundMode;
    already: boolean;
    amount: number;
    cashout_status: string | null;
}

interface Notice {
    tone: StatusBannerTone;
    title: string;
    text?: string;
}

interface ModeCopy {
    action: string;
    reasonTitle: string;
    confirmTitle: string;
    confirmLabel: string;
    /** Conséquence de la décision, dite sur la fiche et répétée dans la confirmation. */
    effect: (amount: string) => string;
}

const MODE_COPY: Record<RefundMode, ModeCopy> = {
    CASHOUT: {
        action: 'Rembourser ce billet',
        reasonTitle: 'Motif du remboursement',
        confirmTitle: 'Confirmer le remboursement ?',
        confirmLabel: 'Rembourser le client',
        effect: (amount) => `Event Village verse ${amount} au client sur le compte qui a payé. Le billet ne donnera plus accès à l’événement.`,
    },
    ORGANISATEUR: {
        action: 'Rembourser ce billet',
        reasonTitle: 'Motif du remboursement',
        confirmTitle: 'Confirmer le remboursement ?',
        confirmLabel: 'Annuler le billet et rembourser',
        effect: (amount) => `Billet payé hors plateforme : Event Village ne verse rien, vous remettez vous-même ${amount} au client. Le billet sera annulé.`,
    },
    AUCUN: {
        action: 'Annuler ce billet gratuit',
        reasonTitle: 'Motif de l’annulation',
        confirmTitle: 'Annuler ce billet gratuit ?',
        confirmLabel: 'Annuler le billet',
        effect: () => 'Billet gratuit : rien n’est versé. Le billet sera annulé et ne donnera plus accès à l’événement.',
    },
};

const SALE_CHANNEL_LABELS: Record<string, string> = {
    ONLINE: 'En ligne',
    COUNTER: 'Au guichet',
    FREE: 'Gratuit',
    INVITATION: 'Invitation',
};

/** Refus connus de la route : le texte de la base peut citer un statut technique, il n'est jamais affiché. */
const REFUSAL_MESSAGES: Record<string, string> = {
    TICKET_NOT_REFUNDABLE: 'Ce billet n’est plus remboursable : son état a changé depuis la recherche.',
    PAYMENT_NOT_REFUNDABLE: 'Le paiement de ce billet ne peut pas être remboursé.',
    ALREADY_REFUNDED: 'Ce paiement est déjà entièrement remboursé.',
};

/** Montant annoncé avant la décision : en ligne, prix et frais de service ; en espèces, le prix seul, comme la RPC. */
function amountDue(ticket: TicketSheet): number {
    if (ticket.refund_mode === 'AUCUN') return 0;
    return ticket.refund_mode === 'CASHOUT' ? ticket.price + ticket.service_fee : ticket.price;
}

/** Résultat lu dans la réponse : seul un versement confirmé est annoncé comme versé. */
function outcomeOf(reply: RefundReply): Notice {
    const amount = formatFcfa(reply.amount);
    if (reply.already) {
        return { tone: 'info', title: 'Remboursement déjà enregistré', text: `Aucune nouvelle opération : ce remboursement de ${amount} avait déjà été demandé.` };
    }
    if (reply.mode === 'AUCUN') {
        return { tone: 'success', title: 'Billet annulé', text: 'Rien n’a été versé : ce billet gratuit ne donne plus accès à l’événement.' };
    }
    if (reply.mode === 'ORGANISATEUR') {
        return { tone: 'warning', title: 'Billet annulé, à vous de rembourser', text: `Remettez ${amount} au client : Event Village ne verse rien pour ce billet.` };
    }
    if (reply.cashout_status === 'CONFIRME') {
        return { tone: 'success', title: 'Remboursement versé', text: `${amount} ont été versés au client.` };
    }
    if (reply.cashout_status === 'ENVOYE') {
        return { tone: 'info', title: 'Remboursement envoyé', text: `${amount} sont en cours de versement. Le client sera prévenu dès la confirmation.` };
    }
    return { tone: 'warning', title: 'Remboursement enregistré, versement en attente', text: `Les ${amount} ne sont pas encore partis. L’équipe Event Village reprend ce versement.` };
}

function SheetRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <>
            <dt className="font-semibold">{label}</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </>
    );
}

export interface TicketRefundPanelProps {
    eventId: string;
    /** Remboursement enregistré : l'onglet relit les chiffres des ventes. */
    onRefunded?: () => void;
}

export function TicketRefundPanel({ eventId, onRefunded }: TicketRefundPanelProps) {
    const sheetTitleId = useId();
    const numberRef = useRef<HTMLInputElement>(null);
    const searchSeq = useRef(0);
    const [number, setNumber] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [sheet, setSheet] = useState<TicketSheet | null>(null);
    const [askingReason, setAskingReason] = useState(false);
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);

    const searchTicket = async (value: string) => {
        const mine = ++searchSeq.current;
        setSearching(true);
        setSearchError(null);
        try {
            const body = await fetchJson<{ ticket: TicketSheet }>(`/api/partner/events/${eventId}/tickets/lookup?number=${encodeURIComponent(value)}`);
            if (mine === searchSeq.current) setSheet(body.ticket);
        } catch (err) {
            if (mine !== searchSeq.current) return;
            setSheet(null);
            setSearchError(errorMessage(err, 'Recherche du billet impossible pour le moment.'));
        } finally {
            if (mine === searchSeq.current) setSearching(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const value = number.trim();
        setNotice(null);
        setSheet(null);
        if (!value) {
            setSearchError('Saisissez le numéro du billet.');
            return;
        }
        void searchTicket(value);
    };

    /** Une fiche ne survit pas à un autre numéro : on ne rembourse jamais le billet d'une recherche précédente. */
    const handleNumberChange = (value: string) => {
        searchSeq.current += 1;
        setNumber(value);
        setSearching(false);
        setSearchError(null);
        setNotice(null);
        setSheet(null);
    };

    const sendRefund = async () => {
        if (!sheet || sending) return;
        setSending(true);
        setSendError(null);
        try {
            const res = await fetch(`/api/partner/events/${eventId}/tickets/${sheet.id}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
                cache: 'no-store',
            });
            if (!res.ok) {
                const refused = await apiErrorOf(res);
                if (res.status >= 500) {
                    setSendError(refused.message);
                    return;
                }
                setConfirming(false);
                setNotice({ tone: 'danger', title: 'Remboursement refusé', text: (refused.code && REFUSAL_MESSAGES[refused.code]) || refused.message });
                await searchTicket(sheet.ticket_number);
                return;
            }
            const reply = (await res.json()) as RefundReply;
            setConfirming(false);
            setSheet(null);
            setNumber('');
            setNotice(outcomeOf(reply));
            onRefunded?.();
            window.requestAnimationFrame(() => numberRef.current?.focus());
        } catch (err) {
            console.warn('[remboursement] réponse non reçue (la relance ne crée pas de second remboursement)', err instanceof Error ? err.message : String(err));
            setSendError('Réseau indisponible : le remboursement n’est pas confirmé. Réessayez, il ne sera pas compté deux fois.');
        } finally {
            setSending(false);
        }
    };

    const copy = sheet ? MODE_COPY[sheet.refund_mode] : null;
    const amount = sheet ? formatFcfa(amountDue(sheet)) : '';

    return (
        <PilotageSection
            title="Remboursement d’un billet"
            description="Retrouvez le billet par le numéro imprimé dessus. Rien n’est remboursé avant votre confirmation."
        >
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
                <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
                    <TextInput
                        ref={numberRef}
                        label="Numéro du billet"
                        value={number}
                        onChange={(e) => handleNumberChange(e.target.value)}
                        placeholder="TCK-20261101-XXXXXXXXXX"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className="tabular-nums"
                        fieldClassName="min-w-0 flex-1"
                    />
                    <Button type="submit" variant="secondary" isLoading={searching} leftIcon={<Search size={18} />}>
                        Rechercher le billet
                    </Button>
                </form>

                {searchError && <StatusBanner tone="danger" title={searchError} announce="alert" />}
                {notice && <StatusBanner tone={notice.tone} title={notice.title} announce="alert" className="tabular-nums">{notice.text}</StatusBanner>}

                {sheet && copy && (
                    <section aria-labelledby={sheetTitleId} className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface-sunken p-4">
                        <h3 id={sheetTitleId} className="text-base font-semibold text-fg tabular-nums">Billet <span className="block break-all">{sheet.ticket_number}</span></h3>
                        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm text-fg tabular-nums">
                            <SheetRow label="Catégorie">{sheet.category || 'Non renseignée'}</SheetRow>
                            <SheetRow label="Porteur">{sheet.holder_short || 'Non renseigné'}</SheetRow>
                            <SheetRow label="Vente">{SALE_CHANNEL_LABELS[sheet.sale_channel ?? ''] ?? 'Non renseignée'}</SheetRow>
                            <SheetRow label="État">{ticketStatusLabel(sheet.status)}</SheetRow>
                            <SheetRow label="Prix">{formatFcfa(sheet.price)}</SheetRow>
                            <SheetRow label="Frais de service">{formatFcfa(sheet.service_fee)}</SheetRow>
                        </dl>
                        {sheet.refundable ? (
                            <>
                                <p className="text-sm leading-relaxed text-fg tabular-nums">{copy.effect(amount)}</p>
                                <Button
                                    variant="danger"
                                    fullWidth
                                    className="sm:w-auto sm:self-start"
                                    onClick={() => {
                                        setSendError(null);
                                        setAskingReason(true);
                                    }}
                                    leftIcon={<Undo2 size={18} />}
                                >
                                    {copy.action}
                                </Button>
                            </>
                        ) : (
                            <StatusBanner tone="neutral" title="Ce billet n’est pas remboursable">
                                Seul un billet encore valable, dont le paiement est confirmé, peut être remboursé.
                            </StatusBanner>
                        )}
                    </section>
                )}
            </div>

            {sheet && copy && (
                <>
                    <ReasonDialog
                        isOpen={askingReason}
                        onClose={() => setAskingReason(false)}
                        onConfirm={(motif) => {
                            setReason(motif);
                            setAskingReason(false);
                            setConfirming(true);
                        }}
                        title={copy.reasonTitle}
                        description={`Billet ${sheet.ticket_number}`}
                        hint="Au moins 3 caractères. Le motif est conservé avec cette opération."
                        confirmLabel="Continuer"
                        cancelLabel="Revenir à la fiche"
                    />
                    <ConfirmDialog
                        isOpen={confirming}
                        onClose={() => setConfirming(false)}
                        onConfirm={() => void sendRefund()}
                        title={copy.confirmTitle}
                        message={copy.effect(amount)}
                        confirmLabel={copy.confirmLabel}
                        cancelLabel="Revenir à la fiche"
                        variant="danger"
                        isLoading={sending}
                    >
                        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm text-fg tabular-nums">
                            <SheetRow label="Billet">{sheet.ticket_number}</SheetRow>
                            <SheetRow label="Montant">{sheet.refund_mode === 'AUCUN' ? 'Aucun versement' : amount}</SheetRow>
                            <SheetRow label="Motif">{reason}</SheetRow>
                        </dl>
                        {sendError && <StatusBanner tone="danger" title="Remboursement non confirmé" announce="alert">{sendError}</StatusBanner>}
                    </ConfirmDialog>
                </>
            )}
        </PilotageSection>
    );
}
