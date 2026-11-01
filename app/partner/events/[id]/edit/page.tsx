'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { EventForm } from '@/components/events/EventForm';

/** Édition d'un événement (lot 5, contrat F6) : le formulaire partagé, en mode édition. */
export default function EditEventPage() {
    const params = useParams<{ id: string }>();
    const eventId = typeof params?.id === 'string' ? params.id : '';
    return <EventForm key={eventId} mode="edit" eventId={eventId} />;
}
