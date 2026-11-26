'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/**
 * Lot 11c-b — « Table gardée 9:42 » : fin de la garde servie par le serveur (expires_at de l'achat). Avertissement à 1
 * minute (icône et texte, jamais la couleur seule). Le temps visible n'est pas lu à chaque seconde par un lecteur d'écran :
 * une région polie annonce seulement le début, la dernière minute et la fin.
 */
export function HoldCountdown({ expiresAt, tableLabel }: { expiresAt: string; tableLabel: string }) {
    const end = Date.parse(expiresAt);
    const [now, setNow] = useState(() => Date.now());
    // Annonce du début figée (sinon la région polie parlerait à chaque minute)
    const [startMinutes] = useState(() => (Number.isFinite(end) ? Math.max(1, Math.round((end - Date.now()) / 60_000)) : 0));
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const left = Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
    const minutes = Math.floor(left / 60);
    const seconds = left % 60;
    const clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const warning = left > 0 && left <= 60;
    const over = left === 0;
    const announce = over
        ? `Le délai de garde de ${tableLabel} est passé.`
        : warning ? `Moins d’une minute pour valider le paiement de ${tableLabel}.` : `${tableLabel} est gardée pendant ${startMinutes} minute${startMinutes > 1 ? 's' : ''}.`;

    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                over ? 'border-border bg-muted text-foreground-strong' : warning ? 'border-warning-border bg-warning-soft text-warning-text' : 'border-info-border bg-info-soft text-info-text',
            )}
        >
            {warning || over ? <AlertTriangle size={22} aria-hidden="true" className="flex-shrink-0" /> : <Clock size={22} aria-hidden="true" className="flex-shrink-0" />}
            <div className="min-w-0">
                <p className="text-base font-semibold">
                    {over ? 'Délai de garde passé' : <>Table gardée <span role="timer" aria-live="off" className="tabular-nums">{clock}</span></>}
                </p>
                <p className="text-sm">
                    {over
                        ? 'Si vous avez validé le paiement, il est encore vérifié : ne payez pas une seconde fois.'
                        : warning ? 'Moins d’une minute : validez le paiement maintenant.' : 'Personne d’autre ne peut la prendre pendant ce temps.'}
                </p>
            </div>
            <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
    );
}
