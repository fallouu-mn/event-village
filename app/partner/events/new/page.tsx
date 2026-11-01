'use client';

import React from 'react';
import { EventForm } from '@/components/events/EventForm';

/** Création d'un événement (lot 5, contrat F6) : le formulaire partagé, en mode création. */
export default function NewEventPage() {
    return <EventForm mode="create" />;
}
