import React from 'react';
import { cn } from './cn';

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Classe des cellules de la colonne (tableau). */
  className?: string;
  /** Masquée dans la carte mobile (déjà dans le titre de la carte, par exemple). */
  hideOnCard?: boolean;
}

export interface DataListProps<T> {
  items: T[];
  columns: DataColumn<T>[];
  getKey: (item: T) => string;
  /** Légende du tableau (lue par les lecteurs d'écran, masquée visuellement si `captionHidden`). */
  caption: string;
  captionHidden?: boolean;
  /** Carte mobile sur mesure ; sinon, les colonnes en liste de définitions. */
  renderCard?: (item: T) => React.ReactNode;
  /** Titre de la carte mobile par défaut. */
  cardTitle?: (item: T) => React.ReactNode;
  /** Affiché quand `items` est vide (EmptyState). */
  empty?: React.ReactNode;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Données tabulaires responsives (contrat Q) : tableau à partir de md, cartes en dessous ; jamais de
 * défilement horizontal à 390 px.
 */
export function DataList<T>({ items, columns, getKey, caption, captionHidden = true, renderCard, cardTitle, empty, className }: DataListProps<T>) {
  if (items.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={className}>
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <caption className={cn('px-4 py-3 text-left text-sm font-semibold text-fg', captionHidden && 'sr-only')}>{caption}</caption>
          <thead className="bg-surface-sunken">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 font-semibold text-fg-muted', ALIGN[c.align ?? 'left'], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={getKey(item)} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle text-fg', ALIGN[c.align ?? 'left'], c.className)}>
                    {c.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden flex flex-col gap-3" aria-label={caption}>
        {items.map((item) => (
          <li key={getKey(item)} className="rounded-2xl border border-border bg-surface p-4">
            {renderCard ? (
              renderCard(item)
            ) : (
              <>
                {cardTitle && <div className="mb-3 text-base font-semibold text-fg">{cardTitle(item)}</div>}
                <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
                  {columns.filter((c) => !c.hideOnCard).map((c) => (
                    <React.Fragment key={c.key}>
                      <dt className="text-fg-muted">{c.header}</dt>
                      <dd className="min-w-0 break-words text-fg">{c.render(item)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
