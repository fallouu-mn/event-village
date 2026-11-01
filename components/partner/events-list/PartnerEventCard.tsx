'use client';

import React from 'react';
import Image from 'next/image';
import { Ban, CalendarDays, Gauge, ImageOff, MapPin, Pencil, Send, Trash2, Undo2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatEventDateTime } from '@/lib/format';
import { isProjectStorageImage } from '@/lib/events/event-image';

/** Action possible lue dans event_actions (contrat D5) : statut visé, motif exigé, libellé du serveur. */
export interface EventAction {
    to: string;
    reason_required: boolean;
    label: string;
}

export interface LastReason {
    kind: 'REFUS' | 'SUSPENSION';
    reason: string | null;
    at: string | null;
}

export interface PartnerEventItem {
    id: string;
    title: string;
    start_date: string | null;
    start_time: string | null;
    location: string | null;
    city: string | null;
    status: string;
    image_url: string | null;
    actions: EventAction[];
    can_edit: boolean;
    can_cancel: boolean;
    last_reason: LastReason | null;
}

/** Statuts sans exploitation (rien à piloter) : la carte ne propose pas « Piloter ». */
const NOT_PILOTABLE = new Set(['BROUILLON', 'EN_ATTENTE']);

function actionIcon(to: string): React.ReactNode {
    if (to === 'EN_ATTENTE') return <Send size={18} />;
    if (to === 'PUBLIE') return <Upload size={18} />;
    return <Undo2 size={18} />;
}

export interface PartnerEventCardProps {
    event: PartnerEventItem;
    /** Action en cours sur cette carte (statut visé), pour l'état de chargement du bouton. */
    pendingTo: string | null;
    onTransition: (event: PartnerEventItem, action: EventAction) => void;
    onCancel: (event: PartnerEventItem) => void;
    onDelete: (event: PartnerEventItem) => void;
}

/**
 * Carte d'un événement de la liste de l'organisateur (tâche 5.11) : statut en libellé humain, motif de
 * refus ou de suspension, actions tirées de event_actions (jamais codées en dur).
 */
export function PartnerEventCard({ event, pendingTo, onTransition, onCancel, onDelete }: PartnerEventCardProps) {
    const titleId = `evenement-${event.id}-titre`;
    const place = [event.location, event.city].filter(Boolean).join(', ');
    const busy = pendingTo !== null;
    const reason = event.last_reason;

    return (
        <article aria-labelledby={titleId} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface sm:flex-row">
            <div className="relative aspect-[16/9] w-full flex-shrink-0 bg-surface-sunken sm:aspect-auto sm:w-48 lg:w-56">
                {isProjectStorageImage(event.image_url) ? (
                    <Image src={event.image_url} alt="" fill sizes="(min-width: 1024px) 224px, (min-width: 640px) 192px, 100vw" className="object-cover" />
                ) : (
                    <div className="flex h-full min-h-32 w-full items-center justify-center text-fg-muted" aria-hidden="true">
                        <ImageOff size={28} />
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge domain="event" status={event.status} size="sm" />
                </div>
                <h2 id={titleId} className="break-words text-lg font-bold leading-snug text-fg">{event.title}</h2>
                <ul className="flex flex-col gap-1.5 text-sm text-fg-muted">
                    <li className="flex items-start gap-2">
                        <CalendarDays size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{formatEventDateTime(event.start_date, event.start_time)}</span>
                    </li>
                    {place && (
                        <li className="flex items-start gap-2">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{place}</span>
                        </li>
                    )}
                </ul>

                {reason && (
                    <StatusBanner
                        tone={reason.kind === 'SUSPENSION' ? 'suspended' : 'danger'}
                        title={reason.kind === 'SUSPENSION' ? 'Suspendu par l’équipe Event Village' : 'Refusé par l’équipe Event Village'}
                    >
                        <p>{reason.reason || 'Aucun motif communiqué.'}</p>
                        {reason.at && (
                            <p className="mt-1 text-fg-muted">
                                Le <time dateTime={reason.at}>{formatDateTime(reason.at)}</time>
                            </p>
                        )}
                    </StatusBanner>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {event.actions.map((action) => (
                        <Button
                            key={action.to}
                            variant={action.to === 'PUBLIE' || action.to === 'EN_ATTENTE' ? 'primary' : 'secondary'}
                            size="sm"
                            leftIcon={actionIcon(action.to)}
                            isLoading={pendingTo === action.to}
                            disabled={busy}
                            onClick={() => onTransition(event, action)}
                        >
                            {action.label}
                        </Button>
                    ))}
                    {!NOT_PILOTABLE.has(event.status) && (
                        <LinkButton href={`/partner/events/${event.id}`} variant="secondary" size="sm" leftIcon={<Gauge size={18} />}>
                            Piloter
                        </LinkButton>
                    )}
                    {event.can_edit && (
                        <LinkButton href={`/partner/events/${event.id}/edit`} variant="ghost" size="sm" leftIcon={<Pencil size={18} />}>
                            Modifier
                        </LinkButton>
                    )}
                    {event.can_cancel && (
                        <Button variant="ghost" size="sm" leftIcon={<Ban size={18} />} disabled={busy} onClick={() => onCancel(event)} className="text-danger-fg">
                            Annuler l’événement
                        </Button>
                    )}
                    {event.status === 'BROUILLON' && (
                        <Button variant="ghost" size="sm" leftIcon={<Trash2 size={18} />} disabled={busy} onClick={() => onDelete(event)} className="text-danger-fg">
                            Supprimer le brouillon
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}
