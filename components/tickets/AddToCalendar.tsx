'use client';

import React from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';

export interface AddToCalendarProps {
  eventId: string;
  title: string;
  /** Début et fin retenue (instants ISO). */
  startsAt: string;
  endsAt: string;
  location?: string | null;
  className?: string;
}

/**
 * Design 1d (point 7) — « Ajouter à mon agenda » sur le billet et après l'achat : fichier .ics (iPhone, Android, Outlook)
 * ou lien Google Agenda, à l'heure de Dakar (lib/events/calendar-links.ts). Le fichier est fabriqué sur le téléphone,
 * rien n'est envoyé au serveur. Le module de l'agenda n'est chargé qu'au toucher (poids de Mes billets).
 */
export function AddToCalendar({ eventId, title, startsAt, endsAt, location, className }: AddToCalendarProps) {
  const toast = useToast();

  const details = async () => {
    const mod = await import('@/lib/events/calendar-links');
    const event = {
      id: eventId,
      title,
      startsAt,
      endsAt,
      location: location ?? null,
      url: `${window.location.origin}/events/${eventId}`,
      details: 'Votre billet est dans Mes billets, sur Event Village.',
    };
    return { mod, event };
  };

  const downloadIcs = async (): Promise<void> => {
    try {
      const { mod, event } = await details();
      const blob = new Blob([mod.buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mod.icsFileName(title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Ouvrez le fichier pour l’ajouter à votre agenda.');
    } catch (err) {
      console.error('[agenda] fichier non créé :', err instanceof Error ? err.message : String(err));
      toast.error('Le fichier de l’agenda n’a pas pu être créé. Réessayez.');
    }
  };

  const openGoogle = async (): Promise<void> => {
    try {
      const { mod, event } = await details();
      // Lien ouvert dans un nouvel onglet, sans accès à cette page (noopener, noreferrer)
      const a = document.createElement('a');
      a.href = mod.googleCalendarUrl(event);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('[agenda] lien Google Agenda non créé :', err instanceof Error ? err.message : String(err));
      toast.error('Google Agenda n’a pas pu être ouvert. Réessayez.');
    }
  };

  return (
    <div role="group" aria-label="Ajouter à mon agenda" className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
      <Button variant="secondary" size="sm" onClick={() => void downloadIcs()} leftIcon={<CalendarPlus size={16} aria-hidden="true" />}>
        Ajouter à mon agenda
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void openGoogle()}>
        Google Agenda
      </Button>
    </div>
  );
}
