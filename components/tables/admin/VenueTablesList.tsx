/**
 * Lot 11b (administration) : zones et tables d'un établissement sur la fiche de décision.
 * Tables rangées par zone (dans l'ordre de la route), puis « Sans zone ». Chaque table : numéro et capacité
 * (« 2 à 4 personnes » quand un minimum est fixé) ; une table ou une zone désactivée par la partenaire le dit en mots.
 * Aucun total calculé : seulement les valeurs de la route.
 */

import React from 'react';
import { Armchair, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { tableCapacityText, tableName, tablesCountText, type AdminVenueTable, type AdminVenueZone } from './types';

interface Group {
  key: string;
  title: string;
  inactive: boolean;
  tables: AdminVenueTable[];
}

function TableItem({ t }: { t: AdminVenueTable }) {
  return (
    <li className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <Armchair size={16} className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="break-words text-base font-semibold text-foreground-strong">{tableName(t)}</span>
          <span className="text-sm tabular-nums text-muted-foreground">{tableCapacityText(t)}</span>
        </span>
      </span>
      {!t.isActive && <Badge variant="neutral" size="sm">Désactivée</Badge>}
    </li>
  );
}

export function VenueTablesList({ zones, tables }: { zones: AdminVenueZone[]; tables: AdminVenueTable[] }) {
  if (tables.length === 0 && zones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted px-4 py-6 text-center text-muted-foreground">
        <LayoutGrid size={28} aria-hidden="true" />
        <p className="text-sm">Aucune zone ni table : la partenaire doit ajouter ses tables pour que les clients puissent réserver.</p>
      </div>
    );
  }

  const zoneIds = new Set(zones.map((z) => z.id));
  const groups: Group[] = zones.map((z) => ({
    key: z.id,
    title: z.name?.trim() || 'Zone sans nom',
    inactive: !z.isActive,
    tables: tables.filter((t) => t.zoneId === z.id),
  }));
  const loose = tables.filter((t) => !t.zoneId || !zoneIds.has(t.zoneId));
  if (loose.length > 0) groups.push({ key: 'sans-zone', title: zones.length > 0 ? 'Sans zone' : 'Tables', inactive: false, tables: loose });

  const noActiveTable = !tables.some((t) => t.isActive);

  return (
    <div className="flex flex-col gap-5">
      {noActiveTable && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-text">
          Aucune table active : même validé, l’établissement ne pourra pas recevoir de réservation.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-foreground-strong">{g.title}</h3>
            <span className="text-sm text-muted-foreground">{tablesCountText(g.tables.length)}</span>
            {g.inactive && <Badge variant="neutral" size="sm">Zone désactivée</Badge>}
          </div>
          {g.tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune table dans cette zone.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.tables.map((t) => <TableItem key={t.id} t={t} />)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
