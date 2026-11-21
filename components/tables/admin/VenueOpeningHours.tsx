/**
 * Lot 11b (administration) : horaires de la semaine d'un établissement sur la fiche de décision.
 * Les sept jours sont toujours listés (lundi d'abord) : un jour sans plage est dit « Fermé ». Une fermeture après
 * minuit est écrite en clair (« 19 h à 2 h (le lendemain) »). Valeurs de la route, mise en forme seulement.
 */

import React from 'react';
import { openingRangeText, weekdayLabel, type AdminVenueHours } from './types';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function VenueOpeningHours({ hours }: { hours: AdminVenueHours[] }) {
  if (hours.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun horaire renseigné : aucun créneau ne sera proposé aux clients tant que la partenaire n’en ajoute pas.
      </p>
    );
  }

  return (
    <dl className="flex flex-col divide-y divide-border">
      {DAYS.map((day) => {
        const ranges = hours
          .filter((h) => h.weekday === day)
          .sort((a, b) => a.opensAt.localeCompare(b.opensAt));
        return (
          <div key={day} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-base font-medium text-foreground-strong">{weekdayLabel(day)}</dt>
            <dd className="min-w-0 sm:text-right">
              {ranges.length === 0 ? (
                <span className="text-base text-muted-foreground">Fermé</span>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {ranges.map((r) => (
                    <li key={`${r.opensAt}-${r.closesAt}`} className="break-words text-base tabular-nums text-foreground-strong">
                      {openingRangeText(r)}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
