'use client';

/**
 * Finition 5 (point 2) — page d'arrivée d'un avis sur un billet : le billet précis (/tickets/<billet>) ou les billets du
 * compte pour un événement (/tickets/<événement>). Mêmes cartes que « Mes billets » (TicketCard : QR, transfert,
 * remboursement, hors ligne), sans les onglets ; liste préparée par le serveur (app/tickets/focus-read.ts), relue par
 * router.refresh() après un transfert ou un remboursement. « Mes billets » (page mesurée) n'est pas modifiée.
 */
import React, { useCallback, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { TicketCard } from '@/components/tickets/TicketCard';
import { useMinuteNow } from '@/components/tickets/TicketWallet';
import type { TransferTicketData } from '@/components/tickets/TransferModal';
import { PageHeader } from '@/components/ui/PageHeader';
import type { MyTicket } from '@/app/tickets/TicketsView';

const TransferModal = dynamic(() => import('@/components/tickets/TransferModal').then((m) => m.TransferModal), { ssr: false });
const TransferExplainerModal = dynamic(() => import('@/components/tickets/TransferExplainerModal').then((m) => m.TransferExplainerModal), { ssr: false });

export function TicketsFocusView({ tickets, title, description, serverNow }: { tickets: MyTicket[]; title: string; description: string; serverNow: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const now = useMinuteNow(serverNow);
  const [transferTicket, setTransferTicket] = useState<TransferTicketData | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader title={title} description={description} back={{ href: '/tickets', label: 'Tous mes billets' }} />
      <ul className={tickets.length > 1 ? 'grid gap-6 md:grid-cols-2' : 'mx-auto max-w-md'} aria-label={tickets.length > 1 ? `${tickets.length} billets` : 'Billet'}>
        {tickets.map((ticket, index) => (
          <li key={ticket.id} id={`billet-${ticket.id}`} className="min-w-0">
            <TicketCard
              eager={index === 0}
              id={ticket.id}
              eventId={ticket.eventId}
              ticketNumber={ticket.ticketNumber}
              eventTitle={ticket.eventTitle}
              eventSubtitle={ticket.eventSubtitle}
              eventImageUrl={ticket.eventImageUrl}
              dateFormatted={ticket.dateFormatted}
              timeFormatted={ticket.timeFormatted}
              venue={ticket.venue}
              seat={ticket.seat}
              status={ticket.status}
              usedAt={ticket.usedAt}
              isTransferLocked={ticket.isTransferLocked}
              activeTransfer={ticket.activeTransfer}
              offline={ticket.offline ?? null}
              price={ticket.price}
              serviceFee={ticket.serviceFee ?? 0}
              saleChannel={ticket.saleChannel ?? null}
              eventStatus={ticket.eventStatus}
              codeVisible={ticket.codeVisible === true}
              transferAllowed={ticket.transferAllowed === true}
              eventNotice={ticket.eventNotice ?? null}
              refundDelayed={ticket.refundDelayed === true}
              postponementRefund={ticket.postponementRefund ?? null}
              categoryColor={ticket.categoryColor ?? null}
              startsAt={ticket.startsAt ?? null}
              endsAt={ticket.endsAt ?? null}
              now={now}
              onRefunded={refresh}
              onTransferClick={() => setTransferTicket({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                eventTitle: ticket.eventTitle,
                dateFormatted: ticket.dateFormatted,
                timeFormatted: ticket.timeFormatted,
                seat: ticket.seat,
                venue: ticket.venue,
              })}
              onCancelTransferSuccess={refresh}
              onOpenExplainer={() => setIsExplainerOpen(true)}
            />
          </li>
        ))}
      </ul>

      {transferTicket && (
        <TransferModal
          isOpen
          onClose={() => setTransferTicket(null)}
          ticket={transferTicket}
          onTransferSuccess={refresh}
          onOpenExplainer={() => {
            setTransferTicket(null);
            setIsExplainerOpen(true);
          }}
        />
      )}
      {isExplainerOpen && <TransferExplainerModal isOpen onClose={() => setIsExplainerOpen(false)} />}
    </div>
  );
}
