'use client';

/**
 * Lot 7 (7.3, D58, contrat 3.5) — « ce que vous allez recevoir » sur la page de suivi d'un paiement en
 * attente (/paiement/<id>).
 *
 * Tout vient de GET /api/payments/<id>/status : événement (titre, début à Dakar), billets par catégorie,
 * numéro payeur masqué (payer_phone_masked, jamais le numéro en clair), canaux de la confirmation
 * réellement prévus (receipt_channels). Le texte d'attente est honnête : la confirmation ne dépend pas de
 * cette page ; si elle se ferme, l'achat reste enregistré et le client est prévenu.
 */

import React from 'react';
import { Bell, CalendarDays, Mail, MessageSquareText, Smartphone, Ticket } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface PaymentWaitingItem {
  categoryName: string | null;
  quantity: number;
}

export interface PaymentWaitingInfoProps {
  /** Cible du paiement (target_type) : TICKET, SUBSCRIPTION… */
  targetType: string | null;
  event: { title: string; startAt: string | null } | null;
  ticketCount: number;
  items: PaymentWaitingItem[];
  /** payer_phone_masked de la route de statut. */
  payerPhoneMasked: string | null;
  /** receipt_channels de la route de statut : IN_APP, PUSH, EMAIL, SMS. */
  receiptChannels: string[];
}

const CHANNEL_TEXT: Record<string, { icon: React.ElementType; text: (phone: string | null) => string }> = {
  SMS: { icon: MessageSquareText, text: (phone) => (phone ? `Un SMS de confirmation au ${phone}` : 'Un SMS de confirmation') },
  EMAIL: { icon: Mail, text: () => 'Un email de confirmation, avec le détail de l’achat' },
  IN_APP: { icon: Bell, text: () => 'Une notification dans Event Village' },
  PUSH: { icon: Smartphone, text: () => 'Une notification sur votre téléphone, si vous les avez activées' },
};

const CHANNEL_ORDER = ['SMS', 'EMAIL', 'IN_APP', 'PUSH'];

export function PaymentWaitingInfo({ targetType, event, ticketCount, items, payerPhoneMasked, receiptChannels }: PaymentWaitingInfoProps) {
  const isTicket = targetType === 'TICKET';
  const smsPlanned = receiptChannels.includes('SMS') && Boolean(payerPhoneMasked);
  const channels = CHANNEL_ORDER.filter((c) => receiptChannels.includes(c));
  const lines = items.filter((item) => item.quantity > 0);

  return (
    <section aria-labelledby="paiement-attente-recevoir" className="space-y-4 rounded-2xl border border-border bg-surface-sunken p-4">
      <h2 id="paiement-attente-recevoir" className="text-base font-bold text-fg">
        Ce que vous allez recevoir
      </h2>

      {isTicket && (event || ticketCount > 0) && (
        <div className="space-y-2">
          {event && (
            <div className="flex items-start gap-2.5">
              <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-fg">{event.title}</p>
                {event.startAt && (
                  <p className="text-sm text-fg-muted">
                    <time dateTime={event.startAt}>{formatDateTime(event.startAt)}</time>
                  </p>
                )}
              </div>
            </div>
          )}
          {ticketCount > 0 && (
            <div className="flex items-start gap-2.5">
              <Ticket size={18} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
              <div className="min-w-0 text-sm text-fg">
                <p className="font-semibold">
                  {ticketCount > 1 ? `${ticketCount} billets` : '1 billet'}, avec leur QR code, dans Mes billets
                </p>
                {lines.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-fg-muted">
                    {lines.map((item, index) => (
                      <li key={`${item.categoryName ?? 'categorie'}-${index}`}>
                        {item.quantity} × {item.categoryName ?? 'Billet'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {channels.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-fg">Dès la confirmation :</p>
          <ul className="mt-1.5 space-y-1.5">
            {channels.map((channel) => {
              const { icon: Icon, text } = CHANNEL_TEXT[channel];
              return (
                <li key={channel} className="flex items-start gap-2.5 text-sm text-fg">
                  <Icon size={18} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
                  <span>{text(payerPhoneMasked)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="rounded-xl border border-info-border bg-info-bg p-3 text-sm leading-relaxed text-info-fg">
        {isTicket ? (
          smsPlanned ? (
            <>
              Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre achat est quand même enregistré : vous recevrez un SMS au{' '}
              <span className="whitespace-nowrap font-semibold tabular-nums">{payerPhoneMasked}</span> et vos billets apparaîtront dans Mes billets.
            </>
          ) : (
            <>
              Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre achat est quand même enregistré : vos billets apparaîtront dans Mes billets.
            </>
          )
        ) : (
          <>
            Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre paiement est quand même enregistré : vous serez prévenu dès sa confirmation.
          </>
        )}
      </p>
    </section>
  );
}
